#!/usr/bin/env python3
"""Arena merged-APK gate: no automatic downloadable emoji font dependency."""
import argparse
import subprocess
import sys

EMOJI_INITIALIZER = 'androidx.emoji2.text.EmojiCompatInitializer'


def check_manifest_dump(text):
    if 'E: manifest' not in text or 'E: application' not in text:
        return ['Compiled Android manifest could not be verified']
    if EMOJI_INITIALIZER in text:
        return ['Arena APK still auto-initializes downloadable emoji fonts']
    return []


def check(apk, aapt):
    result = subprocess.run([aapt, 'dump', 'xmltree', str(apk), 'AndroidManifest.xml'],
                            capture_output=True, text=True, check=True, timeout=30)
    return check_manifest_dump(result.stdout)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk')
    parser.add_argument('--aapt', required=True)
    args = parser.parse_args()
    try:
        errors = check(args.apk, args.aapt)
    except (OSError, subprocess.SubprocessError):
        errors = ['Cannot inspect Arena APK startup metadata']
    for error in errors:
        print(f'::error::{error}')
    if not errors:
        print('::notice::Arena merged manifest: automatic downloadable emoji initializer absent')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
