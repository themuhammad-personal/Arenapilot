#!/usr/bin/env python3
"""ArenaPilot launcher art generator.

ArenaPilot (com.arenadeck.app) is the one app this repository builds — the
arena.ai Direct Chat companion. The mark is an attitude indicator — the
pilot's instrument: a round dial split into a glowing sky and a deep-violet
ground by a neon horizon, with banked wings holding the centre, on a
deep-navy / cyan-violet palette. It is original artwork: it copies nothing
from arena.ai.

Everything is vector-computed (disc sectors, swept-wing polygons, rotated about
the dial centre) and rasterised with Pillow at 4x, then reduced with LANCZOS —
so no font, vector toolchain or hand-edited bitmap is involved, and the same
script regenerates every density identically.

What it writes, all under android/app/src/main/res/ (single app, single
source set since the 2026-10-15 flavor cleanup):

    mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher_foreground.png   adaptive foreground
    drawable-nodpi/app_icon.png                              boot-screen icon
    values/colors.xml                                        launcher_background

The mipmap-anydpi/ic_launcher*.xml point at @mipmap/ic_launcher_foreground
and @color/launcher_background.

Two hard constraints shaped the geometry:

  * Adaptive icon: only the central 66dp circle of the 108dp canvas is
    guaranteed visible under every launcher mask, so the whole dial is fitted
    inside that circle (the glow may spill, the solid art may not).
  * Boot screen: BootScreenView draws app_icon.png through a BitmapShader
    clipped to a rounded rect inset 5.8% with a 21.2% radius, so the bitmap is
    a full-bleed opaque square whose neon edge sits exactly on that rounded
    rect — it must not draw rounded corners of its own.

Run:   python3 tools/icon/arena_deck_icon.py [--preview DIR] [--docs PATH]
Needs: Pillow (development only — the PNGs are committed, the build never runs this).
"""
from __future__ import annotations

import math
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

# ── palette (shared family with the Super DeepSeek icon) ────────────────────
NAVY_LIFT = (22, 38, 66)
NAVY = (12, 21, 38)
NAVY_DEEP = (6, 11, 22)
CYAN = (56, 226, 255)
BLUE = (66, 133, 255)
VIOLET = (150, 96, 255)
ICE = (232, 251, 255)
LAUNCHER_BACKGROUND = "#0A1020"

# ── the attitude indicator, in units of the dial radius ─────────────────────
RIM = 0.045                       # neon rim width (fraction of the radius)
BANK = -11.0                      # the wings' bank angle, degrees — a live turn
HORIZON_W = 0.030                 # horizon line thickness
TICKS = (-60.0, 0.0, 60.0)        # roll-scale ticks around the top of the dial
TICK_LEN = 0.085

# the banked-wings symbol in dial-local units (origin = dial centre, y down)
WING_SPAN = 0.50                  # wingtip x
WING_ROOT_Y = 0.115               # wing root half-height at the centre
WING_TIP_Y = 0.055                # wingtip half-height (swept + tapered)
WING_LEAD = 0.145                 # leading-edge inset at the root
HUB = 0.075                       # centre dot radius
FIN_W, FIN_TOP, FIN_BASE = 0.045, 0.145, 0.235  # the small tail fin below

# the boot-screen rounded tile (BootScreenView.ICON_TILE_INSET / _RADIUS)
TILE_INSET, TILE_RADIUS = 0.058, 0.212


# ── small helpers ───────────────────────────────────────────────────────────
def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def gradient(size, stops, p0=(0.0, 0.0), p1=(1.0, 1.0)):
    """Linear gradient between two normalised points.

    Built at 128x128 and scaled up: a linear ramp survives bilinear
    resampling, and it keeps the whole run to a few seconds.
    """
    g = Image.new("RGB", (128, 128))
    px = g.load()
    x0, y0, x1, y1 = p0[0] * 127, p0[1] * 127, p1[0] * 127, p1[1] * 127
    dx, dy = (x1 - x0), (y1 - y0)
    denom = (dx * dx + dy * dy) or 1.0
    last = len(stops) - 1
    for y in range(128):
        for x in range(128):
            t = ((x - x0) * dx + (y - y0) * dy) / denom
            t = 0.0 if t < 0 else (1.0 if t > 1 else t)
            seg = min(int(t * last), last - 1)
            px[x, y] = lerp(stops[seg], stops[seg + 1], t * last - seg)
    return g.resize(size, Image.BILINEAR)


def over(canvas, mask, fill, opacity=1.0):
    """Straight-alpha 'over': [fill] shows through [mask]. Never darkens edges."""
    layer = fill.convert("RGBA")
    layer.putalpha(mask if opacity >= 1.0 else mask.point(lambda v: int(v * opacity)))
    canvas.alpha_composite(layer)


def solid(size, rgb):
    return Image.new("RGB", size, rgb)


def rrect_points(w, h, r, seg=16):
    """A rounded rectangle centred on the origin, as a polygon."""
    hw, hh = w / 2.0, h / 2.0
    pts = []
    for cx, cy, a0 in ((hw - r, -hh + r, -90), (hw - r, hh - r, 0),
                       (-hw + r, hh - r, 90), (-hw + r, -hh + r, 180)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90.0 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def rotate_about(points, degrees, pivot):
    a = math.radians(degrees)
    c, s = math.cos(a), math.sin(a)
    return [(pivot[0] + (x - pivot[0]) * c - (y - pivot[1]) * s,
             pivot[1] + (x - pivot[0]) * s + (y - pivot[1]) * c) for x, y in points]


def stroke_polygon(p0, p1, width):
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    n = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / n * width / 2.0, dx / n * width / 2.0
    return [(p0[0] + nx, p0[1] + ny), (p1[0] + nx, p1[1] + ny),
            (p1[0] - nx, p1[1] - ny), (p0[0] - nx, p0[1] - ny)]


def silhouette(size, polygons=(), discs=()):
    m = Image.new("L", size, 0)
    d = ImageDraw.Draw(m)
    for poly in polygons:
        d.polygon(poly, fill=255)
    for (x, y), r in discs:
        d.ellipse([x - r, y - r, x + r, y + r], fill=255)
    return m


def blurred(mask, radius):
    return mask.filter(ImageFilter.GaussianBlur(max(radius, 0.5)))


# ── the mark ────────────────────────────────────────────────────────────────
def disc_points(cx, cy, r, a0, a1, seg=96):
    """A closed sector of a disc from a0 to a1 degrees (0 = +x, y down)."""
    pts = []
    for i in range(seg + 1):
        a = math.radians(a0 + (a1 - a0) * i / seg)
        pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    pts.append((cx, cy))
    return pts


def draw_dial(canvas, fit_radius, centre, glow_strength):
    """Draws the attitude-indicator dial onto [canvas] (RGBA, transparent)."""
    size = canvas.size
    cx, cy = centre
    r = fit_radius * 0.99

    # a soft light behind the whole instrument
    halo = silhouette(size, discs=[(centre, r * 0.97)])
    over(canvas, blurred(halo, r * 0.36), solid(size, BLUE), 0.22 * glow_strength)

    # the dial base, dropped a little for depth
    disc = silhouette(size, discs=[(centre, r)])
    shadow = ImageChops.offset(blurred(disc, 0.05 * r), 0, int(0.035 * r))
    over(canvas, shadow, solid(size, (0, 0, 0)), 0.55)
    over(canvas, disc, gradient(size, [NAVY_LIFT, NAVY, NAVY_DEEP], (0.3, 0.0), (0.7, 1.0)))

    # sky (upper half) and ground (lower half), split by the horizon
    sky = silhouette(size, [disc_points(cx, cy, r, 180, 360)])
    ground = silhouette(size, [disc_points(cx, cy, r, 0, 180)])
    over(canvas, ImageChops.multiply(disc, sky),
         gradient(size, [ICE, CYAN, BLUE], (0.08, 0.0), (0.30, 0.5)))
    over(canvas, ImageChops.multiply(disc, ground),
         gradient(size, [VIOLET, (86, 52, 150), NAVY_DEEP], (0.55, 0.5), (0.85, 1.0)))

    # a faint grid of latitude ticks on the ground, like the real instrument
    grid = Image.new("L", size, 0)
    dg = ImageDraw.Draw(grid)
    for frac in (0.30, 0.62):
        y = cy + r * frac
        half = math.sqrt(max(0.0, 1.0 - frac * frac)) * r
        dg.line([(cx - half, y), (cx + half, y)], fill=140, width=max(1, int(r * 0.014)))
    over(canvas, ImageChops.multiply(disc, grid), solid(size, (255, 255, 255)), 0.10)

    # the neon horizon line, glowing across the sky/ground split
    horizon = silhouette(size, polygons=[stroke_polygon((cx - r, cy), (cx + r, cy), HORIZON_W * 2 * r)])
    horizon = ImageChops.multiply(disc, horizon)
    over(canvas, blurred(horizon, 0.055 * r), solid(size, CYAN), 0.60 * glow_strength)
    over(canvas, horizon, gradient(size, [ICE, CYAN], (0.12, 0.5), (0.88, 0.5)))

    # the roll-scale ticks around the top of the dial
    tick_mask = Image.new("L", size, 0)
    dt = ImageDraw.Draw(tick_mask)
    for ang in TICKS:
        a = math.radians(ang - 90)  # the 0deg tick sits at the top
        x0, y0 = cx + r * 0.80 * math.cos(a), cy + r * 0.80 * math.sin(a)
        x1, y1 = cx + (r * 0.80 + TICK_LEN * r) * math.cos(a), cy + (r * 0.80 + TICK_LEN * r) * math.sin(a)
        dt.line([(x0, y0), (x1, y1)], fill=255, width=max(1, int(r * 0.020)))
    over(canvas, ImageChops.multiply(disc, tick_mask), solid(size, ICE), 0.85)

    # the neon rim, the instrument's bezel
    bezel = silhouette(size, discs=[(centre, r)])
    inner_disc = silhouette(size, discs=[(centre, r * (1.0 - 2 * RIM))])
    rim = ImageChops.subtract(bezel, inner_disc)
    edge = gradient(size, [CYAN, BLUE, VIOLET], (0.0, 0.0), (1.0, 1.0))
    over(canvas, blurred(rim, 0.030 * r), edge, 0.60 * glow_strength)
    over(canvas, rim, edge)

    draw_wings(canvas, centre, r, glow_strength)


def draw_wings(canvas, centre, r, glow_strength):
    """The banked wings: two swept wings, a tail fin and a hub — drawn, never typed."""
    size = canvas.size

    def banked(pts):
        return rotate_about(pts, BANK, (0.0, 0.0))

    def px(p):
        return (centre[0] + p[0] * r, centre[1] + p[1] * r)

    wing_l = banked([(-WING_SPAN, -WING_TIP_Y), (-WING_LEAD, -WING_ROOT_Y),
                     (-WING_LEAD, WING_ROOT_Y), (-WING_SPAN, WING_TIP_Y)])
    wing_r = banked([(WING_SPAN, -WING_TIP_Y), (WING_LEAD, -WING_ROOT_Y),
                     (WING_LEAD, WING_ROOT_Y), (WING_SPAN, WING_TIP_Y)])
    fin = banked([(-FIN_W, FIN_TOP), (FIN_W, FIN_TOP), (FIN_W * 0.45, FIN_BASE), (-FIN_W * 0.45, FIN_BASE)])

    symbol = silhouette(
        size,
        polygons=[[px(p) for p in poly] for poly in (wing_l, wing_r, fin)],
        discs=[(px(banked([(HUB, 0.0)])[0]), HUB * r)],
    )
    over(canvas, blurred(symbol, 0.045 * r), solid(size, CYAN), 0.55 * glow_strength)
    over(canvas, symbol, gradient(size, [ICE, (200, 244, 255)], (0.35, 0.25), (0.65, 0.9)))


def foreground(n):
    """The adaptive foreground: transparent, the whole dial inside 66dp."""
    canvas = Image.new("RGBA", (n, n), (0, 0, 0, 0))
    px_per_dp = n / 108.0
    draw_dial(canvas, fit_radius=33.0 * px_per_dp, centre=(n / 2.0, n / 2.0), glow_strength=1.0)
    return canvas


def tile(n):
    """The boot-screen icon: a full-bleed opaque square (see module docstring)."""
    size = (n, n)
    canvas = gradient(size, [(20, 36, 66), (10, 17, 32), (5, 9, 19)], (0.3, 0.0), (0.7, 1.0)).convert("RGBA")

    inset, rad = TILE_INSET * n, TILE_RADIUS * n
    box = (inset, inset, n - inset, n - inset)
    ring = Image.new("L", size, 0)
    ImageDraw.Draw(ring).rounded_rectangle(box, radius=rad, outline=255, width=max(2, int(n * 0.0125)))
    edge = gradient(size, [CYAN, BLUE, VIOLET], (0.0, 0.0), (1.0, 1.0))
    over(canvas, blurred(ring, n * 0.014), edge, 0.75)
    over(canvas, ring, edge, 1.0)

    draw_dial(canvas, fit_radius=n * 0.36, centre=(n / 2.0, n / 2.0 + n * 0.005), glow_strength=1.15)
    return canvas.convert("RGB")


# ── output ──────────────────────────────────────────────────────────────────
def write_assets():
    n = 432 * 4
    fg = foreground(n)
    for name, px in (("mdpi", 108), ("hdpi", 162), ("xhdpi", 216), ("xxhdpi", 324), ("xxxhdpi", 432)):
        out = os.path.join(RES, f"mipmap-{name}", "ic_launcher_foreground.png")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        fg.resize((px, px), Image.LANCZOS).save(out, optimize=True)
        print("wrote", os.path.relpath(out, ROOT))

    out = os.path.join(RES, "drawable-nodpi", "app_icon.png")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    tile(512 * 4).resize((512, 512), Image.LANCZOS).save(out, optimize=True)
    print("wrote", os.path.relpath(out, ROOT))

    colors = os.path.join(RES, "values", "colors.xml")
    os.makedirs(os.path.dirname(colors), exist_ok=True)
    # This is the ONE colors.xml now (the flavor override era is over), so the
    # launch palette ships in the same file. It is the chat's default dark
    # background (MainActivity.PAGE_DARK_DEFAULT), kept at its historical
    # value: "tap icon → splash → launch screen" must not flash or jump.
    with open(colors, "w", encoding="utf-8") as fh:
        fh.write(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            "<resources>\n"
            "    <!--\n"
            "      Launch palette. The system splash and the window use the chat's default\n"
            "      dark background (MainActivity.PAGE_DARK_DEFAULT), so \"tap icon → splash →\n"
            "      launch screen\" has no white flash and no colour jump. Once the real chat\n"
            "      colour has been measured on the device, the launch screen eases into it.\n"
            "      launcher_background is the adaptive-icon backdrop (ArenaPilot navy).\n"
            "    -->\n"
            f'    <color name="launcher_background">{LAUNCHER_BACKGROUND}</color>\n'
            '    <color name="bds_splash_bg">#1E1F23</color>\n'
            '    <color name="bds_window_bg">#1E1F23</color>\n'
            "</resources>\n"
        )
    print("wrote", os.path.relpath(colors, ROOT))


def write_preview(folder):
    """A contact sheet for human review (never shipped)."""
    os.makedirs(folder, exist_ok=True)
    n = 432
    fg = foreground(n * 4).resize((n, n), Image.LANCZOS)
    bg = Image.new("RGBA", (n, n), tuple(int(LAUNCHER_BACKGROUND[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    full = bg.copy()
    full.alpha_composite(fg)

    guide = full.copy()
    d = ImageDraw.Draw(guide)
    d.ellipse([n / 2 - 132, n / 2 - 132, n / 2 + 132, n / 2 + 132], outline=(255, 70, 70, 255), width=2)   # 66dp
    d.rectangle([n / 2 - 144, n / 2 - 144, n / 2 + 144, n / 2 + 144], outline=(255, 220, 70, 255), width=2)  # 72dp window

    def masked(shape, px):
        window = full.crop((n // 2 - 144, n // 2 - 144, n // 2 + 144, n // 2 + 144)).resize((px, px), Image.LANCZOS)
        m = Image.new("L", (px, px), 0)
        dm = ImageDraw.Draw(m)
        if shape == "circle":
            dm.ellipse([0, 0, px - 1, px - 1], fill=255)
        else:
            dm.rounded_rectangle([0, 0, px - 1, px - 1], radius=int(px * 0.30), fill=255)
        out = Image.new("RGBA", (px, px), (34, 36, 42, 255))
        out.paste(window, (0, 0), m)
        return out

    app = tile(512 * 2).resize((512, 512), Image.LANCZOS).convert("RGBA")
    inset, rad = int(TILE_INSET * 512), int(TILE_RADIUS * 512)
    clip = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(clip).rounded_rectangle([inset, inset, 511 - inset, 511 - inset], radius=rad, fill=255)
    boot = Image.new("RGBA", (512, 512), (30, 31, 35, 255))
    boot.paste(app, (0, 0), clip)

    sheet = Image.new("RGBA", (n + 280 + 512 + 60, 560), (34, 36, 42, 255))
    sheet.paste(guide, (10, 10))
    sheet.paste(masked("circle", 256), (n + 30, 10))
    sheet.paste(masked("squircle", 256), (n + 30, 290))
    sheet.paste(boot, (n + 280 + 40, 10))
    small = masked("circle", 48)
    sheet.paste(small, (n + 280 + 40, 530 - 48))
    sheet.convert("RGB").save(os.path.join(folder, "arenapilot_preview.png"))
    print("preview →", os.path.join(folder, "arenapilot_preview.png"))


def write_docs(path):
    """The square app tile for README/docs use (never shipped in the APK)."""
    tile(512 * 4).resize((512, 512), Image.LANCZOS).convert("RGB").save(path, optimize=True)
    print("docs icon →", path)


if __name__ == "__main__":
    if "--docs" in sys.argv:
        write_docs(sys.argv[sys.argv.index("--docs") + 1])
    elif "--preview" in sys.argv:
        write_preview(sys.argv[sys.argv.index("--preview") + 1])
    else:
        write_assets()
