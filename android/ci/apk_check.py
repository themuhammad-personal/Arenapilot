#!/usr/bin/env python3
"""Static checks on a built ArenaPilot APK — what is *inside* it, without installing it.

Why this exists: a green build proves the resources merged; it does not prove
the right icon, name and package actually ended up in the APK. This reads the
APK itself:

  * package name, launcher label and launcher activity (`aapt dump badging`);
  * that every launcher PNG of the app is in the APK, pixel for pixel
    (compared decoded, so aapt2's lossless PNG re-encoding cannot fool it).

Usage:  apk_check.py --apk app.apk --repo . [--aapt PATH]
Exit:   0 = every check passed, 1 = at least one failed (each failure printed
        as a GitHub `::error::` line), 2 = the check itself could not run.
Needs:  Pillow (`pip install pillow`) — CI only, never part of an app build.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import re
import subprocess
import sys
import zipfile
from pathlib import Path

EXPECT_PACKAGE = "com.arenadeck.app"
EXPECT_LABEL = "ArenaPilot"
# The Kotlin lives in the historical `com.superdeepseek.app` namespace.
LAUNCHER_ACTIVITY = "com.superdeepseek.app.MainActivity"
SOURCE_SET = "main"  # single app, single source set since the 2026-10-15 cleanup
ART = [
    "mipmap-mdpi/ic_launcher_foreground.png",
    "mipmap-hdpi/ic_launcher_foreground.png",
    "mipmap-xhdpi/ic_launcher_foreground.png",
    "mipmap-xxhdpi/ic_launcher_foreground.png",
    "mipmap-xxxhdpi/ic_launcher_foreground.png",
    "drawable-nodpi/app_icon.png",
]


def parse_badging(text: str) -> dict:
    """The few facts we assert, out of `aapt dump badging` output."""

    def one(pattern: str):
        m = re.search(pattern, text, re.M)
        return m.group(1) if m else None

    return {
        "package": one(r"^package: name='([^']+)'"),
        "label": one(r"^application-label:'([^']*)'"),
        "launcher": one(r"^launchable-activity: name='([^']+)'"),
    }


def pixel_hash(png: bytes) -> str:
    from PIL import Image  # imported late so --help works without Pillow

    im = Image.open(io.BytesIO(png)).convert("RGBA")
    return f"{im.size[0]}x{im.size[1]}:" + hashlib.sha256(im.tobytes()).hexdigest()


def apk_art(apk: Path) -> set[str]:
    """Pixel hashes of every PNG under res/ in the APK."""
    out = set()
    with zipfile.ZipFile(apk) as z:
        for name in z.namelist():
            if name.startswith("res/") and name.endswith(".png"):
                try:
                    out.add(pixel_hash(z.read(name)))
                except Exception:
                    pass  # not a decodable raster (nine-patch, etc.) — irrelevant here
    return out


def source_art(repo: Path) -> dict[str, str]:
    base = repo / "android" / "app" / "src" / SOURCE_SET / "res"
    return {rel: pixel_hash((base / rel).read_bytes()) for rel in ART if (base / rel).exists()}


def run(apk: Path, repo: Path, aapt: str | None) -> list[str]:
    """Returns the list of failures (empty = all good); prints a line per check."""
    failures: list[str] = []

    def check(ok: bool, good: str, bad: str):
        print(("OK   " if ok else "FAIL ") + (good if ok else bad))
        if not ok:
            failures.append(bad)

    if aapt:
        text = subprocess.run([aapt, "dump", "badging", str(apk)], capture_output=True, text=True, check=True).stdout
        facts = parse_badging(text)
        check(facts["package"] == EXPECT_PACKAGE, f"package is {facts['package']}",
              f"package is {facts['package']!r}, expected {EXPECT_PACKAGE!r}")
        check(facts["label"] == EXPECT_LABEL, f"launcher label is {facts['label']!r}",
              f"launcher label is {facts['label']!r}, expected {EXPECT_LABEL!r}")
        check(facts["launcher"] == LAUNCHER_ACTIVITY, f"launcher activity is {facts['launcher']}",
              f"launcher activity is {facts['launcher']!r}, expected {LAUNCHER_ACTIVITY!r}")
    else:
        print("SKIP badging (no aapt given)")

    packed = apk_art(apk)
    own = source_art(repo)

    check(len(own) == len(ART), f"all {len(ART)} launcher images exist in the repo ({SOURCE_SET} source set)",
          f"the repo has only {len(own)}/{len(ART)} launcher images in {SOURCE_SET}")
    for rel, digest in own.items():
        check(digest in packed, f"{rel} is in the APK, pixel for pixel",
              f"{rel} is NOT in the APK — the launcher art did not reach the build")
    return failures


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--apk", required=True, type=Path)
    ap.add_argument("--repo", default=".", type=Path)
    ap.add_argument("--aapt", default=None, help="path to aapt (optional; skips the badging checks if absent)")
    args = ap.parse_args(argv)
    if not args.apk.exists():
        print(f"::error::apk_check: {args.apk} does not exist")
        return 2
    try:
        failures = run(args.apk, args.repo, args.aapt)
    except Exception as exc:  # the check itself broke — never report that as a pass
        print(f"::error::apk_check could not run: {exc}")
        return 2
    for f in failures:
        print(f"::error::ArenaPilot: {f}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
