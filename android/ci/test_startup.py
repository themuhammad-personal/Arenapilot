import pathlib
import subprocess
import sys
import tempfile
import unittest
from android.ci.launch_report import summarize
from android.ci.crash_check import app_crashes
from android.ci.startup_check import check_entries


class PackagingAndLaunchTest(unittest.TestCase):
    def test_startup_gate_cli_is_runnable(self):
        subprocess.run([sys.executable, str(pathlib.Path(__file__).with_name('startup_check.py')), '--help'],
                       check=True, capture_output=True, timeout=10)

    def test_only_device_runtime_is_forbidden_not_document_sandbox(self):
        assets = ['assets/bds/sandbox.html', 'assets/bds/sandbox.js', 'assets/bds/sd-site.js']
        self.assertEqual(check_entries(assets), [])
        self.assertTrue(check_entries(assets[1:]))
        for retired in ['assets/sandbox/rootfs.json', 'lib/x86_64/libproot.so', 'lib/arm64-v8a/libproot-loader.so', 'lib/x86/libtalloc.so', 'lib/arm64-v8a/libandroid-shmem.so']:
            self.assertTrue(check_entries(assets + [retired]))

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
