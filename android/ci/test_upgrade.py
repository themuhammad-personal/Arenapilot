"""Guard rails for the opt-in emulator upgrade test (not upgrade evidence)."""
import pathlib
import unittest
from unittest.mock import Mock, patch
from android.ci import upgrade_check as check


class UpgradeSafety(unittest.TestCase):
    def call(self, codes=(1352, 1353), qemu='1', existing=''):
        baseline = Mock(read_bytes=lambda: b'test fixture')
        # If verify() went past its preflight it would try to install the APK.
        def bridge(*args, **_):
            self.assertEqual(args[0], 'shell', 'preflight must never install or uninstall anything')
            return qemu if args[1] == 'getprop' else existing
        with patch.object(check, 'BASE_SHA256', check.hashlib.sha256(b'test fixture').hexdigest()), \
             patch.object(check, 'identity', side_effect=codes), patch.object(check, 'adb', side_effect=bridge):
            check.verify(baseline, Mock(), pathlib.Path('.'))

    def test_refuses_physical_devices(self):
        with self.assertRaisesRegex(RuntimeError, 'physical devices'):
            self.call(qemu='0')

    def test_refuses_existing_installation(self):
        with self.assertRaisesRegex(RuntimeError, 'already contains'):
            self.call(existing='package:com.arenadeck.app')

    def test_refuses_downgrade_even_with_same_signer(self):
        with self.assertRaisesRegex(RuntimeError, 'forward upgrade'):
            self.call(codes=(1352, 1000))
