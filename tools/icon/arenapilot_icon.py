#!/usr/bin/env python3
"""ArenaPilot launcher art generator (V3 Core mark).

The mark is a bold "A" whose crossbar is a paper-plane / flight-path blade
ending in an arrowhead: cyan at the apex, deep blue at the base, on a deep-navy
tile. Everything is vector geometry (polygons with rounded corners) rasterised
with a tiny scan-line anti-aliaser, so this script needs ONLY the Python
standard library (no Pillow) and regenerates every density identically.

Writes, all under android/app/src/main/res/ unless noted:

    mipmap-{m,h,xh,xxh,xxxh}dpi/ic_launcher_foreground.png   adaptive foreground (RGBA)
    drawable-nodpi/app_icon.png                              boot-screen icon (opaque 512)
    docs/assets/icon.png                                     README icon (same art)

The launcher background colour (LAUNCHER_BACKGROUND) must match
values/colors.xml (engine-arena-branding.test.mjs checks this).

Constraints that shaped the geometry:

  * Adaptive icon: only the central 66dp circle of the 108dp canvas is
    guaranteed visible under every launcher mask, so the glyph is fitted inside it.
  * Boot screen: BootScreenView draws app_icon.png through a BitmapShader
    clipped to a rounded rect inset 5.8% with a 21.2% radius, so the bitmap is a
    full-bleed opaque square whose rim sits exactly on that rounded rect.

Run:  python3 tools/icon/arenapilot_icon.py [--preview DIR]
"""
from __future__ import annotations

import math
import os
import struct
import sys
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")

LAUNCHER_BACKGROUND = "#0F1422"
BG_TOP = (21, 27, 44)
BG_BOTTOM = (11, 15, 25)
RIM = (95, 106, 148)

# the boot-screen rounded tile (BootScreenView.ICON_TILE_INSET / _RADIUS)
TILE_INSET, TILE_RADIUS = 0.058, 0.212

# ── glyph geometry, authored on a 1024 canvas (x right, y down) ─────────────
# (x, y, corner radius)
BODY = [  # the A: left leg + apex + right leg + the flight-path blade
    (200, 752, 9), (461, 232, 52), (567, 232, 52), (696, 487, 4), (582, 531, 3),
    (508, 402, 17), (392, 635, 3), (782, 472, 3), (440, 700, 0), (340, 745, 70),
    (290, 764, 22), (215, 764, 10),
]
FOOT = [(720, 533, 3), (829, 745, 6), (822, 755, 6), (745, 754, 12), (668, 700, 44), (614, 600, 3)]
FOOT_SHADE = [(614, 600, 0), (720, 533, 0), (738, 568, 0), (640, 632, 0)]
ARROW = [(885, 398, 2), (727, 433, 3), (780, 466, 3), (803, 524, 3)]

GLYPH_CX, GLYPH_CY = 542.5, 498.5     # centre of the glyph's bounding box
GLYPH_TOP, GLYPH_BOTTOM = 232.0, 765.0

STOPS = [(0.0, (36, 232, 255)), (0.5, (19, 160, 248)), (1.0, (10, 98, 232))]
ARROW_STOPS = [(0.0, (40, 228, 255)), (1.0, (28, 196, 255))]


# ── geometry helpers ────────────────────────────────────────────────────────
def lerp(a, b, t):
    return a + (b - a) * t


def ramp(stops, t):
    t = max(0.0, min(1.0, t))
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        if t <= t1:
            f = (t - t0) / (t1 - t0) if t1 > t0 else 0.0
            return tuple(lerp(c0[i], c1[i], f) for i in range(3))
    return stops[-1][1]


def rounded(poly, steps=10):
    """Closed polygon with per-vertex corner radius -> flattened outline."""
    n = len(poly)
    out = []
    for i in range(n):
        px, py, _ = poly[i - 1]
        x, y, r = poly[i]
        nx, ny, _ = poly[(i + 1) % n]
        if r <= 0:
            out.append((x, y))
            continue
        d1 = math.hypot(px - x, py - y)
        d2 = math.hypot(nx - x, ny - y)
        cut = min(r, d1 / 2.0, d2 / 2.0)
        ax, ay = x + (px - x) / d1 * cut, y + (py - y) / d1 * cut
        bx, by = x + (nx - x) / d2 * cut, y + (ny - y) / d2 * cut
        for s in range(steps + 1):
            t = s / steps
            u = 1.0 - t
            out.append((u * u * ax + 2 * u * t * x + t * t * bx,
                        u * u * ay + 2 * u * t * y + t * t * by))
    return out


def coverage(outline, w, h, ss=4):
    """Anti-aliased coverage (0..1) of a polygon on a w*h pixel grid."""
    edges = []
    m = len(outline)
    for i in range(m):
        x0, y0 = outline[i]
        x1, y1 = outline[(i + 1) % m]
        if y0 == y1:
            continue
        if y0 > y1:
            x0, y0, x1, y1 = x1, y1, x0, y0
        edges.append((y0, y1, x0, (x1 - x0) / (y1 - y0)))
    ys = [p[1] for p in outline]
    row_lo = max(0, int(math.floor(min(ys))))
    row_hi = min(h - 1, int(math.ceil(max(ys))))
    sw = w * ss
    cov = {}
    norm = 1.0 / (ss * ss)
    for row in range(row_lo, row_hi + 1):
        diff = [0] * (sw + 2)
        used = False
        for k in range(ss):
            y = row + (k + 0.5) / ss
            xs = [x0 + (y - y0) * sl for (y0, y1, x0, sl) in edges if y0 <= y < y1]
            if not xs:
                continue
            xs.sort()
            for j in range(0, len(xs) - 1, 2):
                a = max(0, int(math.ceil(xs[j] * ss - 0.5)))
                b = min(sw, int(math.ceil(xs[j + 1] * ss - 0.5)))
                if b > a:
                    diff[a] += 1
                    diff[b] -= 1
                    used = True
        if not used:
            continue
        acc = 0
        line = []
        sub = 0
        for x in range(sw):
            acc += diff[x]
            sub += acc
            if (x + 1) % ss == 0:
                line.append(sub * norm)
                sub = 0
        cov[row] = line
    return cov


class Canvas:
    def __init__(self, w, h, opaque_bg=None):
        self.w, self.h = w, h
        n = w * h
        self.r = [0.0] * n
        self.g = [0.0] * n
        self.b = [0.0] * n
        self.a = [0.0] * n
        if opaque_bg is not None:
            for y in range(h):
                c = opaque_bg(y)
                for x in range(w):
                    i = y * w + x
                    self.r[i], self.g[i], self.b[i], self.a[i] = c[0], c[1], c[2], 1.0

    def paint(self, cov, colour, strength=1.0):
        w = self.w
        for row, line in cov.items():
            base = row * w
            for x, c in enumerate(line):
                if c <= 0.0:
                    continue
                al = c * strength
                i = base + x
                col = colour(x + 0.5, row + 0.5)
                oa = self.a[i]
                na = al + oa * (1.0 - al)
                if na <= 0.0:
                    continue
                k = oa * (1.0 - al)
                self.r[i] = (col[0] * al + self.r[i] * k) / na
                self.g[i] = (col[1] * al + self.g[i] * k) / na
                self.b[i] = (col[2] * al + self.b[i] * k) / na
                self.a[i] = na

    def png(self, path, rgba=True):
        w, h = self.w, self.h
        raw = bytearray()
        for y in range(h):
            raw.append(0)
            for x in range(w):
                i = y * w + x
                raw += bytes((int(round(self.r[i])), int(round(self.g[i])), int(round(self.b[i]))))
                if rgba:
                    raw.append(int(round(max(0.0, min(1.0, self.a[i])) * 255)))

        def chunk(tag, data):
            body = tag + data
            return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)

        ihdr = struct.pack(">IIBBBBB", w, h, 8, 6 if rgba else 2, 0, 0, 0)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) +
                    chunk(b"IDAT", zlib.compress(bytes(raw), 9)) + chunk(b"IEND", b""))


# ── drawing the mark ────────────────────────────────────────────────────────
def draw_glyph(cv, to_px, k):
    """Paint the glyph. to_px maps logo units -> pixels; k = pixels per logo unit."""
    def xf(poly):
        return [to_px(x, y) for x, y in rounded(poly)]

    top_px = to_px(0, GLYPH_TOP)[1]

    def vertical(stops):
        def colour(px, py):
            return ramp(stops, (py - top_px) / ((GLYPH_BOTTOM - GLYPH_TOP) * k))
        return colour

    a_top = to_px(0, 398)[1]
    a_span = max(1.0, to_px(0, 524)[1] - a_top)

    body = coverage(xf(BODY), cv.w, cv.h)
    foot = coverage(xf(FOOT), cv.w, cv.h)
    shade = coverage(xf(FOOT_SHADE), cv.w, cv.h)
    arrow = coverage(xf(ARROW), cv.w, cv.h)
    cv.paint(body, vertical(STOPS))
    cv.paint(foot, vertical(STOPS))
    # the darker band where the foot meets the blade's slipstream, clipped to the foot
    clipped = {}
    for r, line in shade.items():
        f = foot.get(r)
        if f:
            clipped[r] = [min(c, f[x]) for x, c in enumerate(line)]
    cv.paint(clipped, lambda px, py: (8, 84, 214), 0.55)
    cv.paint(arrow, lambda px, py: ramp(ARROW_STOPS, (py - a_top) / a_span))


def rounded_rect_ring(cv, inset, radius, width, colour):
    """Anti-aliased rim hugging the inside of a rounded rect's edge."""
    w, h = cv.w, cv.h
    cx, cy = w / 2.0, h / 2.0
    hx, hy = w / 2.0 - inset - radius, h / 2.0 - inset - radius
    half = width / 2.0
    cov = {}
    for y in range(h):
        line = []
        for x in range(w):
            qx = abs(x + 0.5 - cx) - hx
            qy = abs(y + 0.5 - cy) - hy
            d = math.hypot(max(qx, 0.0), max(qy, 0.0)) + min(max(qx, qy), 0.0) - radius
            c = 0.5 - (abs(d + half) - half)
            line.append(max(0.0, min(1.0, c)))
        cov[y] = line
    cv.paint(cov, lambda px, py: colour)


def boot_icon(size=512):
    def bg(y):
        t = y / (size - 1)
        return tuple(lerp(BG_TOP[i], BG_BOTTOM[i], t) for i in range(3))
    cv = Canvas(size, size, bg)
    tile = size * (1.0 - 2.0 * TILE_INSET)
    k = tile / 954.0                           # the logo's own tile is 954 units wide
    rounded_rect_ring(cv, size * TILE_INSET, size * TILE_RADIUS, max(2.0, size * 0.0075), RIM)
    c = size / 2.0
    draw_glyph(cv, lambda x, y: (c + (x - 512.0) * k, c + (y - 512.0) * k), k)
    return cv


def foreground(px):
    """Adaptive foreground: the glyph fitted inside the 66dp safe circle."""
    cv = Canvas(px, px)
    k = 0.078 * px / 108.0
    c = px / 2.0
    draw_glyph(cv, lambda x, y: (c + (x - GLYPH_CX) * k, c + (y - GLYPH_CY) * k), k)
    return cv


DENSITIES = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}


def main(argv):
    preview = argv[argv.index("--preview") + 1] if "--preview" in argv else None
    for name, px in DENSITIES.items():
        foreground(px).png(os.path.join(RES, f"mipmap-{name}", "ic_launcher_foreground.png"))
        print("wrote", name, px)
    boot = boot_icon(512)
    boot.png(os.path.join(RES, "drawable-nodpi", "app_icon.png"), rgba=False)
    boot.png(os.path.join(ROOT, "docs", "assets", "icon.png"), rgba=False)
    if preview:
        foreground(432).png(os.path.join(preview, "fg.png"))
    print("launcher_background =", LAUNCHER_BACKGROUND)


if __name__ == "__main__":
    main(sys.argv[1:])
