#!/usr/bin/env python3
"""Arena merged-APK gate: no automatic downloadable emoji font dependency."""
import argparse
import subprocess
import zipfile
import re

EMOJI_INITIALIZER = 'androidx.emoji2.text.EmojiCompatInitializer'


def check_manifest_dump(text):
    if 'E: manifest' not in text or 'E: application' not in text:
        return ['Compiled Android manifest could not be verified']
    if EMOJI_INITIALIZER in text:
        return ['Arena APK still auto-initializes downloadable emoji fonts']
    for removed in ('SandboxService', 'StudioActivity', 'android.permission.FOREGROUND_SERVICE_SPECIAL_USE'):
        if removed in text:
            return ['Retired device runtime component or permission in merged manifest: ' + removed]
    return []


def check_entries(names):
    # The document renderer is a browser iframe, not the native Linux guest.
    required = {'assets/bds/sandbox.html', 'assets/bds/sandbox.js', 'assets/bds/sd-site.js'}
    errors = ['Missing engine asset: ' + member for member in sorted(required - set(names))]
    for member in names:
        if member.startswith('assets/sandbox/') or re.fullmatch(r'lib/[^/]+/lib(?:proot[^/]*|talloc[^/]*|android-shmem)\.so', member):
            errors.append('Retired Linux runtime payload: ' + member)
    return errors


def check(apk, aapt):
    result = subprocess.run([aapt, 'dump', 'xmltree', str(apk), 'AndroidManifest.xml'],
                            capture_output=True, text=True, check=True, timeout=30)
    with zipfile.ZipFile(apk) as archive:
        return check_manifest_dump(result.stdout) + check_entries(archive.namelist())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('apk')
    parser.add_argument('--aapt', required=True)
    args = parser.parse_args()
    try:
        errors = check(args.apk, args.aapt)
    except (OSError, subprocess.SubprocessError, zipfile.BadZipFile):
        errors = ['Cannot inspect Arena APK startup metadata']
    for error in errors:
        print(f'::error::{error}')
    if not errors:
        print('::notice::Arena merged manifest: startup metadata, document assets and absence of device runtime verified')
    return 1 if errors else 0


if __name__ == '__main__':
    raise SystemExit(main())
