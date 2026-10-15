#!/usr/bin/env python3
"""Bounded launch-only evidence in annotations; never export page/JS logs here."""
import argparse
import pathlib
import re


def clean(text):
    text = re.sub(r'https?://\S+', '<url>', text)
    text = re.sub(r'(?i)Bearer\s+\S+', 'Bearer <redacted>', text)
    text = re.sub(r'[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}', '<email>', text)
    text = re.sub(r'[A-Za-z0-9_-]{32,}', '<opaque>', text)
    return text[:250]


def summarize(folder, package):
    folder = pathlib.Path(folder)
    result = []
    for phase in ['first-boot', 'first-end', 'second-boot']:
        read = lambda suffix: (folder / f'{phase}-{suffix}.txt').read_text(errors='replace') if (folder / f'{phase}-{suffix}.txt').exists() else ''
        pid = read('pid').strip()
        if not pid and not read('exit-info'):
            continue
        rows = [f'{phase}: pid={pid if re.fullmatch(r"[0-9 ]+", pid) else "absent"}']
        # Android's ApplicationExitInfo: preserve reason/status/timestamp, not
        # description/trace paths or arbitrary process extras. A preceding
        # intentional force-stop must not be diagnosed as a relaunch crash.
        for line in read('exit-info').splitlines():
            if re.match(r'\s*(timestamp|pid|processName|reason|status|importance|pss|rss)[:=]', line):
                for key, value in re.findall(r'\b(timestamp|pid|processName|reason|status|importance|pss|rss)[:=]([^=]+?)(?=\s+\w+=|$)', line):
                    rows.append(clean(f'{key}={value.strip()}'))
        events = []
        for line in read('logcat').splitlines():
            if package in line and re.search(r'(ActivityManager|ActivityTaskManager|AndroidRuntime|libc)', line) and 'CONSOLE' not in line:
                events.append(clean(line.strip()))
        result.append('\n'.join(rows[:9] + events[-8:]))
    for file in sorted(folder.glob('launch-[0-9]*.log')):
        rows = [clean(line) for line in file.read_text(errors='replace').splitlines()
                if re.match(r'(Status:|Error:|Exception|Activity:|ThisTime:|TotalTime:|WaitTime:)', line)]
        result.append(file.name + ': ' + '; '.join(rows))
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('folder')
    parser.add_argument('--package', required=True, choices=['com.arenadeck.app', 'com.superdeepseek.app'])
    args = parser.parse_args()
    rows = summarize(args.folder, args.package)
    for row in rows[:6]:
        safe = row.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
        print(f'::notice title=Launch evidence::{safe}')
    if not rows:
        print('::warning::No launch evidence collected; startup is unverified')


if __name__ == '__main__':
    main()
