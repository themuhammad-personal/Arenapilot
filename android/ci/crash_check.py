#!/usr/bin/env python3
"""Attribute logcat crashes to the APK, not uiautomator/emulator helper processes."""
import argparse
import pathlib
import re
import sys


def pid_of(line):
    match = re.search(r'\s(\d+)\s+\d+\s+[VDIWEF]\s+\S+\s*:', line)
    return match.group(1) if match else None


def app_crashes(text, package, pids=()):
    lines = text.splitlines()
    package_re = re.escape(package) + r'(?=[:/\s,<]|$)'
    process_re = re.compile(r'Process:\s*' + package_re)
    results = []
    for index, line in enumerate(lines):
        if 'AndroidRuntime:' in line and 'FATAL EXCEPTION' in line:
            pid = pid_of(line)
            block = [line]
            for following in lines[index + 1:index + 30]:
                if 'FATAL EXCEPTION' in following:
                    break
                if 'AndroidRuntime:' in following and (pid is None or pid_of(following) == pid):
                    block.append(following)
            owned = pid is not None and pid in pids
            owned = owned or any(process_re.search(row) for row in block)
            if owned:
                results.extend(block[:16])
        elif re.search(r'Activity(?:Manager|TaskManager)\s*:', line) and re.search(r'(?:ANR in |Force finishing activity (?:\S+ )?)' + package_re, line):
            results.append(line)
        elif re.search(r'\bDEBUG\s*:', line) and re.search(r'>>>\s*' + re.escape(package) + r'(?::[^\s]+)?\s*<<<', line):
            results.append(line)
    return list(dict.fromkeys(results))[:30]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('logcat')
    parser.add_argument('package')
    parser.add_argument('--pid-file', action='append', default=[])
    args = parser.parse_args()
    pids = set()
    for file in args.pid_file:
        if pathlib.Path(file).exists():
            pids.update(re.findall(r'\b\d+\b', pathlib.Path(file).read_text()))
    rows = app_crashes(pathlib.Path(args.logcat).read_text(errors='replace'), args.package, pids)
    if rows:
        text = '\n'.join(re.sub(r'[A-Za-z0-9_-]{30,}', '<opaque>', row)[:220] for row in rows)
        safe = text.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print(f'::error::crash or ANR detected for {args.package}%0A{safe}')
        return 1
    print('no app-attributed crash/ANR markers (other processes are not this APK)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
