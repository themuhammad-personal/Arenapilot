/** Actual AndroidBridge → Linux test, no model/chat involved. Fresh CI emulator
 * only. Separately reported so a working backend cannot masquerade as a working
 * assistant-to-tool loop. Only stage facts and bounded diagnostics from our
 * fixed synthetic command leave the page; no model/user content is collected. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, annotation } from './cdp_probe.mjs';

export const PYTHON_COMMAND = `python3 -c "from pathlib import Path; assert Path('/root/workspace/.arena-ci-smoke.txt').read_text().splitlines()[1] == 'edited line'; print(6*7)"`;

export const NATIVE_PROBE = `/*sandbox:smoke*/(async function () {
  var result = { kind: 'native-linux-bridge', ok: false, stages: [], phase: 'capability' };
  function add(name, ok) { result.stages.push({ name: name, ok: !!ok }); if (!ok) throw new Error(name); }
  function texts(r) { return r && r.result && Array.isArray(r.result.content) ? r.result.content.filter(function(c){return c.type==='text';}).map(function(c){return c.text;}).join('\\n') : ''; }
  function success(r) { return !!r && r.ok === true && !!r.result && r.result.isError === false; }
  function failedCommandFacts(r) {
    // Only OUR fixed synthetic commands on a fresh emulator call this helper.
    var message=String((r && r.error) || texts(r) || 'empty-native-reply');
    message=message.replace(/https?:[^\\s]+/g,'<url>').replace(/[A-Za-z0-9_-]{30,}/g,'<opaque>');
    if (message.length>2600) message=message.slice(0,200)+' ... '+message.slice(-2400);
    var info={}; try { info=JSON.parse(window.AndroidBridge.sandboxInfo()); } catch (_) {}
    return { transportOk:!!r && r.ok===true, toolError:!!(r && r.result && r.result.isError), installed:info.installed===true, message:message };
  }
  async function call(name, args) {
    result.phase = name;
    return window.__sdBridgeFetch({ type:'bds-mcp-call', serverUrl:'sandbox://linux', toolName:name, args:args });
  }
  try {
    var b=window.AndroidBridge;
    add('bridge-present', b && typeof b.sandboxInfo==='function' && typeof window.__sdBridgeFetch==='function');
    var info=JSON.parse(b.sandboxInfo());
    result.supported=info.supported===true; result.enabled=info.enabled===true;
    add('supported-and-enabled', result.supported && result.enabled);
    result.phase='tool-list';
    var list=await window.__sdBridgeFetch({type:'bds-mcp-list-tools',serverUrl:'sandbox://linux'});
    add('tool-list', list.ok===true && Array.isArray(list.tools) && ['run','write_file','read_file','edit_file','install_packages'].every(function(n){return list.tools.some(function(t){return t.name===n;});}));
    var run=await call('run',{command:"printf '%s\\\\n' 'ARENA_NATIVE_OK'",timeout_seconds:10});
    var ran=success(run) && texts(run).split('\\n').includes('ARENA_NATIVE_OK') && /\\[exit 0 [^\\]]*\\]$/.test(texts(run));
    if (!ran) result.diagnostic=failedCommandFacts(run);
    add('exec-output-and-zero-exit', ran);
    var failed=await call('run',{command:'exit 7',timeout_seconds:10});
    add('nonzero-exit-is-error', failed.ok===true && failed.result && failed.result.isError===true && /\\[exit 7 [^\\]]*\\]$/.test(texts(failed)));
    var file='/root/workspace/.arena-ci-smoke.txt';
    var content='বাংলা "quotes" and C:\\\\tmp\\\\file\\nsecond line\\n';
    var write=await call('write_file',{path:file,content:content});
    add('write-file',success(write));
    var edit=await call('edit_file',{path:file,old_text:'second line',new_text:'edited line'});
    add('edit-file',success(edit));
    var read=await call('read_file',{path:file});
    add('read-file-round-trip',success(read) && texts(read).includes('বাংলা "quotes" and C:\\\\tmp\\\\file') && texts(read).includes('edited line'));
    var packages=await call('install_packages',{packages:['python3']});
    if (!success(packages)) result.diagnostic=failedCommandFacts(packages);
    add('install-python-package',success(packages));
    var python=await call('run',{command:${JSON.stringify(PYTHON_COMMAND)},timeout_seconds:20});
    var pythonOk=success(python) && texts(python).split('\\n').includes('42') && /\\[exit 0 [^\\]]*\\]$/.test(texts(python));
    if (!pythonOk) result.diagnostic=failedCommandFacts(python);
    add('python-executes-and-reads-edited-file',pythonOk);
    var clean=await call('run',{command:'rm -f -- /root/workspace/.arena-ci-smoke.txt',timeout_seconds:10});
    add('cleanup',success(clean));
    result.installed=JSON.parse(b.sandboxInfo()).installed===true;
    add('installed',result.installed);
    result.ok=true; result.phase='complete';
  } catch (_) { result.ok=false; }
  return result;
})()`;

export async function nativeProbe(cdp) {
  try {
    const response = await cdp.send('Runtime.evaluate', { expression: NATIVE_PROBE, returnByValue: true, awaitPromise: true }, 360000);
    if (response.exceptionDetails || !response.result?.value) return { ok: false, phase: 'page-evaluation' };
    return response.result.value;
  } catch { return { ok: false, phase: 'devtools-or-install-timeout' }; }
}

export async function main() {
  const out = process.env.SMOKE_OUT || '/tmp/emulator-smoke';
  const file = path.join(out, 'sandbox-summary.json');
  if (process.argv.includes('--report')) {
    console.log(annotation('notice', fs.existsSync(file) ? 'Native sandbox: ' + fs.readFileSync(file, 'utf8') : 'Native sandbox: not verified (no summary)'));
    return 0;
  }
  if (process.env.SMOKE_NATIVE_SANDBOX !== '1') {
    console.log(annotation('error', 'Native sandbox smoke is limited to an explicitly enabled fresh CI emulator')); return 1;
  }
  let cdp, result;
  try {
    const targets = await (await fetch('http://127.0.0.1:9222/json', { signal: AbortSignal.timeout(10000) })).json();
    const target = targets.find((t) => t.type === 'page' && /^https:\/\/(www\.)?arena\.ai\//.test(t.url));
    if (!target) throw new Error('no-arena-target');
    cdp = await connect(target.webSocketDebuggerUrl);
    result = await nativeProbe(cdp);
  } catch { result = { ok: false, phase: 'devtools-unavailable' }; }
  finally { cdp?.close(); }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(result));
  console.log(annotation(result.ok ? 'notice' : 'error', 'Native sandbox: ' + JSON.stringify(result)));
  return result.ok ? 0 : 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((code) => process.exit(code));
