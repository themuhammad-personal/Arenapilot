import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { NATIVE_PROBE, PYTHON_COMMAND, nativeProbe } from '../../../../ci/sandbox-smoke.mjs';

function sandbox({ supported = true, failRun = false, swallowError = false, failInstall = false, failPython = false } = {}) {
  const calls = [], files = new Map();
  const result = (text, isError = false) => ({ ok: true, result: { content: [{ type: 'text', text }], isError } });
  const context = { window: {
    AndroidBridge: { sandboxInfo: () => JSON.stringify({ supported, enabled: true, installed: true }) },
    async __sdBridgeFetch(p) {
      calls.push(p);
      const { toolName: name, args } = p;
      if (p.type === 'bds-mcp-list-tools') return { ok: true, tools: ['run', 'write_file', 'read_file', 'edit_file', 'install_packages'].map((name) => ({ name })) };
      if (name === 'install_packages') { assert.deepEqual(Array.from(args.packages), ['python3']); return result(failInstall ? 'install failed' : 'installed', failInstall); }
      if (name === 'run') {
        if (args.command === PYTHON_COMMAND) return result(failPython ? '[exit 1 · 1ms]' : '42\n[exit 0 · 1ms]', failPython);
        if (args.command === 'exit 7') return result('$ exit 7\n[exit 7 · 10ms]', !swallowError);
        if (args.command.startsWith('rm -f')) return result('[exit 0 · 1ms]');
        assert.equal(args.command, "printf '%s\\n' 'ARENA_NATIVE_OK'");
        return result(failRun ? '[exit 1 · 1ms]' : '$ printf\nARENA_NATIVE_OK\n[exit 0 · 1ms]', failRun);
      }
      if (name === 'write_file') { files.set(args.path, args.content); return result('wrote'); }
      if (name === 'edit_file') { files.set(args.path, files.get(args.path).replace(args.old_text, args.new_text)); return result('edited'); }
      if (name === 'read_file') return result(files.get(args.path));
      throw new Error('unknown tool');
    },
  } };
  return { context: vm.createContext(context), calls, files };
}

test('native smoke executes bridge operations and preserves Unicode, quotes and backslashes (fixture)', async () => {
  const { context, calls, files } = sandbox();
  const result = await vm.runInContext(NATIVE_PROBE, context);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.stages.length, 12);
  assert.equal(files.get('/root/workspace/.arena-ci-smoke.txt'), 'বাংলা "quotes" and C:\\tmp\\file\nedited line\n');
  assert.equal(calls.filter((c) => c.toolName === 'run').length, 4);
  assert.doesNotMatch(JSON.stringify(result), /বাংলা|ARENA_NATIVE_OK/);
});

test('native smoke rejects missing runtime, failed execution and falsely successful nonzero exits', async () => {
  for (const options of [{ supported: false }, { failRun: true }, { swallowError: true }, { failInstall: true }, { failPython: true }]) {
    const fixture = sandbox(options);
    const result = await vm.runInContext(NATIVE_PROBE, fixture.context);
    assert.equal(result.ok, false);
    if (!options.supported && options.supported !== undefined) assert.equal(fixture.calls.length, 0);
    if (options.swallowError) assert.equal(result.stages.at(-1).name, 'nonzero-exit-is-error');
  }
});

test('CDP evaluation failure is never accepted as native success', async () => {
  assert.equal((await nativeProbe({ send: async () => ({ exceptionDetails: { text: 'secret exception' } }) })).ok, false);
  assert.equal((await nativeProbe({ send: async () => { throw new Error('secret'); } })).ok, false);
});

test('APK packaging and launch evidence Python regressions', () => {
  const r = spawnSync('python3', ['-m', 'unittest', 'android/ci/test_sandbox_apk_check.py'], {
    cwd: new URL('../../../../../', import.meta.url), encoding: 'utf8', timeout: 30000,
  });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});


test('primary APK and Arena emulator require the same patched runtime; normal smoke disables diagnostics', () => {
  const workflow = readFileSync(new URL('../../../../../.github/workflows/build-and-release-apk.yml', import.meta.url), 'utf8');
  const primary = workflow.split('  build-apk:')[1].split('  lint:')[0];
  const emulator = workflow.split('  emulator:')[1].split('  release-arena:')[0];
  for (const job of [primary, emulator]) {
    assert.match(job, /sdkmanager 'ndk;27\.2\.12479018'/);
    assert.match(job, /python3 scripts\/fetch_sandbox_deps\.py --patched-proot/);
  }
  assert.doesNotMatch(primary, /continue-on-error: true/);
  assert.match(primary, /python3 android\/ci\/sandbox_apk_check\.py/);
  const smoke = readFileSync(new URL('../../../../ci/emulator-smoke.sh', import.meta.url), 'utf8');
  assert.match(smoke, /if \[ "\$\{SMOKE_PROOT_TRACE:-0\}" = "1" \]; then/);
});
