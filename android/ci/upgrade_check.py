#!/usr/bin/env python3
"""Real v2.4.0 → candidate install -r, on a fresh, disposable emulator only.

Use the release app's real first-launch preference as the data sentinel. No
root, test-only app endpoints, access to private user files, login, clear-data,
uninstall, downgrade, or replacement signing. This does not test account sync.
"""
import argparse
import hashlib
import os
from pathlib import Path
import re
import subprocess
import time
from xml.etree import ElementTree as ET

PKG = 'com.arenadeck.app'
BASE_SHA256 = '26ef345dbd2dc54a88374bc10342d68efba2e537ca8bead2d56fcb71ab40099e'
SIGNER = 'ffdd6e6acd136fc2a955f6aa7be0df3c851c671caaffb8cbc53c3397e698383c'
NOTICE = 'An independent app'


def command(*args, timeout=60):
    return subprocess.run(args, check=True, capture_output=True, text=True,
                          errors='replace', timeout=timeout).stdout.strip()


def adb(*args, timeout=60):
    return command('adb', *args, timeout=timeout)


def require(value, message):
    if not value:
        raise RuntimeError(message)
    return value


def identity(apk, tools):
    dump = command(tools / 'aapt', 'dump', 'badging', apk)
    package = re.search(r"^package: name='([^']+)' versionCode='(\d+)'", dump, re.M)
    require(package and package[1] == PKG, 'Unexpected APK identity')
    output = command(tools / 'apksigner', 'verify', '--print-certs', apk)
    certs = re.findall(r'^Signer #\d+ certificate SHA-256 digest: (\w+)$', output, re.M)
    require(certs == [SIGNER], 'Release signing identity mismatch')
    return int(package[2])


def installed():
    dump = adb('shell', 'dumpsys', 'package', PKG)
    code = re.search(r'\bversionCode=(\d+)', dump)
    date = re.search(r'^\s*firstInstallTime=([^\r\n]+)', dump, re.M)
    uid = re.search(r'^package:com\.arenadeck\.app uid:(\d+)$', adb('shell', 'pm', 'list', 'packages', '-U', PKG), re.M)
    require(code and date and uid, 'Cannot read installed package identity')
    return int(code[1]), date[1].strip(), uid[1]


def launch():
    result = adb('shell', 'am', 'start', '-W', '-n', PKG + '/.MainActivity')
    require('Status: ok' in result and 'Error:' not in result, 'App launch failed')


def screen():
    # Never log the UI hierarchy: even a clean test device can display site text.
    path = '/sdcard/arenapilot-upgrade-window.xml'
    adb('shell', 'rm', '-f', path)
    adb('shell', 'uiautomator', 'dump', path, timeout=20)
    root = ET.fromstring(adb('exec-out', 'cat', path, timeout=10))
    return [n.attrib for n in root.iter('node') if n.get('package') == PKG]


def has_notice(nodes):
    return any(NOTICE in n.get('text', '') for n in nodes)


def ready(nodes):
    return any(n.get('class') == 'android.webkit.WebView' for n in nodes)


def wait_screen(predicate, message, seconds=80):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        try:
            nodes = screen()
            if nodes and predicate(nodes):
                return nodes
        except (subprocess.SubprocessError, ET.ParseError):
            pass
        time.sleep(2)
    raise RuntimeError(message)


def verify(baseline, candidate, tools):
    require(hashlib.sha256(baseline.read_bytes()).hexdigest() == BASE_SHA256, 'Not the pinned published v2.4.0 APK')
    before_code, after_code = identity(baseline, tools), identity(candidate, tools)
    require(before_code == 1352 and after_code > before_code, 'Not a forward upgrade from build 1352')
    require('1' in (adb('shell', 'getprop', 'ro.kernel.qemu'), adb('shell', 'getprop', 'ro.boot.qemu')),
            'Upgrade test refuses to touch physical devices')
    require(not adb('shell', 'pm', 'list', 'packages', PKG), 'Emulator already contains this app; refusing to modify it')

    require('Success' in adb('install', str(baseline), timeout=120), 'Published APK install failed')
    old, first_install, uid = installed()
    require(old == before_code, 'Wrong baseline installed')
    launch()
    initial = wait_screen(has_notice, 'Could not establish the baseline first-launch state')
    button = next((n for n in initial if n.get('resource-id') == 'android:id/button1' and n.get('enabled') == 'true'), None)
    bounds = re.fullmatch(r'\[(\d+),(\d+)\]\[(\d+),(\d+)\]', (button or {}).get('bounds', ''))
    require(bounds, 'No actionable baseline notice button')
    l, t, r, b = map(int, bounds.groups())
    adb('shell', 'input', 'tap', str((l + r) // 2), str((t + b) // 2))
    wait_screen(lambda ns: not has_notice(ns) and ready(ns), 'Baseline notice did not dismiss to the WebView')
    adb('shell', 'am', 'force-stop', PKG)

    # This is the actual release update. Never fall back to uninstall/install.
    require('Success' in adb('install', '-r', str(candidate), timeout=120), 'In-place replacement failed')
    require(installed() == (after_code, first_install, uid), 'Version, UID or original first-install time did not survive replacement')
    launch()
    # Give the native 18 s boot cap time to reveal the WebView or the notice.
    time.sleep(26)
    nodes = wait_screen(lambda ns: has_notice(ns) or ready(ns), 'Updated app did not reach a verifiable UI')
    require(not has_notice(nodes) and ready(nodes), 'Updated APK lost the accepted notice preference')
    require(re.fullmatch(r'[0-9]+', adb('shell', 'pidof', PKG)), 'Updated package is not alive')
    print(f'::notice::Release upgrade {old} -> {after_code} passed on emulator: same signer, UID and first-install time; persisted notice and live WebView verified.')


if __name__ == '__main__':
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument('baseline', type=Path)
    args.add_argument('candidate', type=Path)
    args.add_argument('--tools', type=Path, default=Path(os.environ.get('ANDROID_HOME', '')) / 'build-tools/34.0.0')
    opts = args.parse_args()
    try:
        verify(opts.baseline, opts.candidate, opts.tools)
    except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
        # adb errors such as INSTALL_FAILED_NO_MATCHING_ABIS are useful. Do not
        # dump command stdout or UI content; never retry using a destructive path.
        detail = str(exc)
        if isinstance(exc, subprocess.CalledProcessError):
            reason = re.search(r'INSTALL_FAILED_[A-Z_]+', str(exc.stderr) + str(exc.stdout))
            detail = reason[0] if reason else 'Command failed: ' + Path(exc.cmd[0]).name
        raise SystemExit('Upgrade verification failed: ' + detail)
