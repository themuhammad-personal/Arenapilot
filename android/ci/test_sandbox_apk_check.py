import json
import pathlib
import struct
import subprocess
import tempfile
import unittest
import zipfile
from android.ci.sandbox_apk_check import check, ARCH
from android.ci.launch_report import summarize
from android.ci.crash_check import app_crashes


def elf(bits, machine):
    b = bytearray(64 if bits == 2 else 52)
    b[:6] = b'\x7fELF' + bytes([bits, 1])
    struct.pack_into('<H', b, 18, machine)
    return b


class RuntimePackagingTest(unittest.TestCase):
    def apk(self, folder, missing=None, corrupt=None, manifest=True):
        out = pathlib.Path(folder) / 'test.apk'
        with zipfile.ZipFile(out, 'w') as z:
            for abi, arch in ARCH.items():
                for lib in ['libproot.so', 'libproot-loader.so']:
                    member = f'lib/{abi}/{lib}'
                    if member != missing:
                        z.writestr(member, b'invalid' if corrupt == member else elf(*arch))
            if manifest:
                z.writestr('assets/sandbox/rootfs.json', json.dumps({'arches': {
                    abi: {'sha256': 'a' * 64, 'urls': ['https://example.org/rootfs.tar.gz']} for abi in ARCH
                }}))
        return out

    def test_complete_runtime_is_not_mistaken_for_a_missing_one(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertEqual(check(self.apk(d)), [])

    def test_missing_loader_or_manifest_or_bad_elf_is_not_accepted(self):
        with tempfile.TemporaryDirectory() as d:
            self.assertTrue(any('missing libproot-loader.so' in e for e in check(self.apk(d, missing='lib/x86_64/libproot-loader.so'))))
            self.assertTrue(any('invalid ELF' in e for e in check(self.apk(d, corrupt='lib/arm64-v8a/libproot.so'))))
            self.assertTrue(any('manifest missing' in e for e in check(self.apk(d, manifest=False))))

    def test_launch_report_preserves_phase_and_ignores_console_and_exit_descriptions(self):
        with tempfile.TemporaryDirectory() as d:
            base = pathlib.Path(d)
            (base / 'second-boot-pid.txt').write_text('4242\n')
            (base / 'second-boot-exit-info.txt').write_text(' reason=10 (USER REQUESTED) status=0\n importance=100 pss=95MB rss=205MB description=PRIVATE-DESCRIPTION trace=PRIVATE-PATH\n')
            (base / 'second-boot-logcat.txt').write_text('I chromium: PRIVATE-CONSOLE\n' + '\n'.join('I ActivityManager: Start proc 4242:com.arenadeck.app' for _ in range(40)))
            report = '\n'.join(summarize(d, 'com.arenadeck.app'))
            self.assertIn('second-boot: pid=4242', report)
            self.assertIn('reason=10 (USER REQUESTED)', report)
            self.assertNotIn('PRIVATE', report)


class CrashAttributionTest(unittest.TestCase):
    def test_helper_failure_is_not_an_app_crash_but_real_app_and_anr_still_fail(self):
        helper = "10-14 03:03:51.657  4887  4902 E AndroidRuntime: FATAL EXCEPTION: UiAutomation\n10-14 03:03:51.657  4887  4902 E AndroidRuntime: java.lang.RuntimeException: Bad file descriptor"
        self.assertEqual(app_crashes(helper, 'com.arenadeck.app', {'4242'}), [])
        own = helper + "\n10-14 03:04:00.000  4242  4242 E AndroidRuntime: FATAL EXCEPTION: main\n10-14 03:04:00.000  4242  4242 E AndroidRuntime: Process: com.arenadeck.app, PID: 4242"
        rows = app_crashes(own, 'com.arenadeck.app', {'4242'})
        self.assertTrue(rows)
        self.assertNotIn('UiAutomation', '\n'.join(rows))
        self.assertTrue(app_crashes('I ActivityManager: ANR in com.arenadeck.app', 'com.arenadeck.app'))
        self.assertTrue(app_crashes('F DEBUG : >>> com.arenadeck.app <<<', 'com.arenadeck.app'))
        self.assertEqual(app_crashes('I ActivityManager: ANR in com.arenadeck.app.other', 'com.arenadeck.app'), [])


class NativeCompatTest(unittest.TestCase):
    def test_unverified_proot_source_is_rejected_before_extraction(self):
        from scripts.build_proot import extract_source
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError, 'SHA-256 mismatch'):
                extract_source(b'untrusted source archive', pathlib.Path(d))
            self.assertEqual(list(pathlib.Path(d).iterdir()), [])

    def test_fork_patch_uses_only_equivalent_clone_flags_and_clears_unused_arguments(self):
        # Compile the actual added C switch cases, not a Python reimplementation.
        patch = pathlib.Path('scripts/proot-fork-compat.patch').read_text()
        added = '\n'.join(line[1:] for line in patch.splitlines()
                          if line.startswith('+') and not line.startswith('+++') and not line.startswith('+#include'))
        source = r"""
#define _GNU_SOURCE
#include <sched.h>
#include <signal.h>
#include <assert.h>
typedef struct { unsigned long regs[6]; int syscall; int restarted; } Tracee;
enum { PR_fork, PR_vfork, PR_clone };
enum { SYSARG_1, SYSARG_2, SYSARG_3, SYSARG_4, SYSARG_5 };
void set_sysnum(Tracee *t,int n) { t->syscall=n; }
void poke_reg(Tracee *t,int n,unsigned long v) { t->regs[n]=v; }
void restart_syscall_after_seccomp(Tracee *t) { t->restarted++; }
void compat(Tracee *tracee,int sysnum) { switch(sysnum) {
""" + added + r"""
} }
int main(void) {
  for (int kind=PR_fork; kind<=PR_vfork;kind++) {
    Tracee t={{999,999,999,999,999,999},-1,0};
    compat(&t,kind);
    assert(t.syscall==PR_clone && t.restarted==1);
    assert(t.regs[0]==(unsigned long)(SIGCHLD | (kind==PR_vfork ? CLONE_VM|CLONE_VFORK : 0)));
    for(int i=1;i<5;i++) assert(t.regs[i]==0);
  }
  return 0;
}
"""
        with tempfile.TemporaryDirectory() as d:
            binary = pathlib.Path(d) / 'fork-compat-test'
            build = subprocess.run(['cc', '-Wall', '-Werror', '-x', 'c', '-', '-o', str(binary)], input=source, text=True, capture_output=True)
            self.assertEqual(build.returncode, 0, build.stderr)
            self.assertEqual(subprocess.run([str(binary)]).returncode, 0)


class ArenaStartupTest(unittest.TestCase):
    def test_compiled_manifest_gate_rejects_emoji_dependency_and_unreadable_data(self):
        from android.ci.startup_check import check_manifest_dump, EMOJI_INITIALIZER
        valid = 'E: manifest (line=1)\n  E: application (line=2)'
        self.assertEqual(check_manifest_dump(valid), [])
        self.assertTrue(check_manifest_dump(valid + '\n A: android:name="' + EMOJI_INITIALIZER + '"'))
        for invalid in ['', 'package: com.arenadeck.app', 'E: manifest']:
            self.assertTrue(check_manifest_dump(invalid))

    def test_arena_removes_only_automatic_emoji_startup_not_all_initializers(self):
        import xml.etree.ElementTree as ET
        source = pathlib.Path(__file__).resolve().parents[1] / 'app/src/main/AndroidManifest.xml'
        root = ET.parse(source).getroot()
        android = '{http://schemas.android.com/apk/res/android}'
        tools = '{http://schemas.android.com/tools}'
        providers = root.findall('./application/provider')
        startup = [p for p in providers if p.get(android + 'name') == 'androidx.startup.InitializationProvider']
        self.assertEqual(len(startup), 1, f'expected exactly one startup provider, got {[p.get(android + "name") for p in providers]}')
        provider = startup[0]
        self.assertEqual(provider.get(tools + 'node'), 'merge')
        children = provider.findall('meta-data')
        self.assertEqual(len(children), 1)
        self.assertEqual(children[0].get(android + 'name'), 'androidx.emoji2.text.EmojiCompatInitializer')
        self.assertEqual(children[0].get(tools + 'node'), 'remove')


if __name__ == '__main__':
    unittest.main()
