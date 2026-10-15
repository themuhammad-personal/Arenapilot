#!/usr/bin/env python3
"""Required runtime packaging gate; execution is tested separately on Android."""
import argparse
import json
import pathlib
import re
import struct
import sys
import zipfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2] / 'scripts'))
from fetch_sandbox_deps import ABIS, ANDROID_SYSTEM_LIBS, elf_dynamic

ARCH = {'arm64-v8a': (2, 183), 'armeabi-v7a': (1, 40), 'x86_64': (2, 62), 'x86': (1, 3)}


def check(apk):
    errors = []
    with zipfile.ZipFile(apk) as z:
        names = set(z.namelist())
        try:
            manifest = json.loads(z.read('assets/sandbox/rootfs.json'))
        except (KeyError, ValueError):
            manifest = {}
            errors.append('Alpine manifest missing or invalid')
        for abi in ABIS:
            prefix = f'lib/{abi}/'
            libs = {name[len(prefix):]: name for name in names if name.startswith(prefix) and name.endswith('.so')}
            for required in ['libproot.so', 'libproot-loader.so']:
                if required not in libs:
                    errors.append(f'{abi}: missing {required}')
            for name, member in libs.items():
                try:
                    data = z.read(member)
                    expected = ARCH[abi]
                    if name == 'libproot-loader32.so':
                        expected = ARCH['armeabi-v7a' if abi == 'arm64-v8a' else 'x86']
                    if data[:4] != b'\x7fELF' or data[5] != 1 or (data[4], struct.unpack_from('<H', data, 18)[0]) != expected:
                        raise ValueError('ELF architecture mismatch')
                    dependencies, _ = elf_dynamic(data)
                    for dep in dependencies:
                        if dep not in libs and dep not in ANDROID_SYSTEM_LIBS:
                            errors.append(f'{abi}/{name}: missing dependency {dep}')
                except (ValueError, IndexError, struct.error):
                    errors.append(f'{abi}/{name}: invalid ELF or wrong architecture')
            source = manifest.get('arches', {}).get(abi, {})
            if not re.fullmatch(r'[0-9a-f]{64}', source.get('sha256', '')) or not source.get('urls') or not all(isinstance(u, str) and u.startswith('https://') for u in source['urls']):
                errors.append(f'{abi}: missing verified HTTPS rootfs source')
    return errors


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('apk')
    args = parser.parse_args()
    try:
        errors = check(args.apk)
    except Exception:
        errors = ['Cannot inspect sandbox payload in APK']
    for error in errors:
        print(f'::error::Sandbox APK: {error}')
    if not errors:
        print('::notice::Sandbox APK: all four ABI runtimes, ELF dependencies and rootfs manifest verified (execution not implied)')
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
