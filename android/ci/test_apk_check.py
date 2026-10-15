"""Tests for apk_check.py — run: python3 -m unittest android/ci/test_apk_check.py

Builds small fake APKs (zip files) out of the repo's real launcher PNGs and
asserts the checker accepts the right one and rejects every wrong one. Needs
Pillow; the node wrapper (engine-arena-ci.test.mjs) skips these where it is absent.
"""
import itertools
import io
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent.parent
SRC = REPO / "android" / "app" / "src"
sys.path.insert(0, str(HERE))
import apk_check  # noqa: E402

ARENA = ("com.arenadeck.app", "ArenaPilot")
SD = ("com.superdeepseek.app", "Super DeepSeek")


class ApkCheck(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.ids = itertools.count()

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def apk(self, drop=None, foreign=False):
        """A fake APK from the repo's real launcher art (obfuscated entry names,
        as in a release build). `drop` omits one density; `foreign` packs solid
        red images instead — art that matches nothing in the repo."""
        path = self.tmp / f"{next(self.ids)}.apk"
        with zipfile.ZipFile(path, "w") as z:
            n = 0
            for rel in apk_check.ART:
                f = SRC / apk_check.SOURCE_SET / "res" / rel
                if f.exists() and not (drop and drop in rel):
                    data = f.read_bytes()
                    if foreign:
                        from PIL import Image

                        buf = io.BytesIO()
                        Image.new("RGBA", (108, 108), (255, 0, 0, 255)).save(buf, "PNG")
                        data = buf.getvalue()
                    z.writestr(f"res/{n:02x}.png", data)
                    n += 1
            z.writestr("res/zz.png", b"not a png")  # an undecodable entry must not break the scan
        return path

    def aapt(self, package, label):
        path = self.tmp / f"aapt-{next(self.ids)}"
        path.write_text(
            "#!/bin/sh\ncat <<'EOF'\n"
            f"package: name='{package}' versionCode='1'\n"
            f"application-label:'{label}'\n"
            "launchable-activity: name='com.superdeepseek.app.MainActivity'  label='' icon='' \nEOF\n"
        )
        path.chmod(0o755)
        return str(path)

    def run_check(self, apk, identity):
        return apk_check.main(["--apk", str(apk), "--repo", str(REPO), "--aapt", self.aapt(*identity)])

    def test_arena_apk_with_arena_art_passes(self):
        self.assertEqual(self.run_check(self.apk(), ARENA), 0)

    def test_apk_with_foreign_art_fails(self):
        self.assertEqual(self.run_check(self.apk(foreign=True), ARENA), 1)

    def test_a_missing_density_fails(self):
        self.assertEqual(self.run_check(self.apk(drop="xxhdpi"), ARENA), 1)

    def test_wrong_label_or_package_fails(self):
        self.assertEqual(self.run_check(self.apk(), (ARENA[0], SD[1])), 1)
        self.assertEqual(self.run_check(self.apk(), (SD[0], ARENA[1])), 1)

    def test_a_missing_apk_is_exit_2_never_a_pass(self):
        self.assertEqual(apk_check.main(["--apk", str(self.tmp / "nope.apk")]), 2)

    def test_badging_parser(self):
        facts = apk_check.parse_badging(
            "package: name='x.y' versionCode='3'\napplication-label:'Hi There'\n"
            "launchable-activity: name='a.b.Main'  label='' icon='' \n")
        self.assertEqual(facts, {"package": "x.y", "label": "Hi There", "launcher": "a.b.Main"})
        self.assertEqual(apk_check.parse_badging("garbage"), {"package": None, "label": None, "launcher": None})

    def test_the_cli_runs(self):
        r = subprocess.run([sys.executable, str(HERE / "apk_check.py"), "--help"], capture_output=True, text=True)
        self.assertEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
