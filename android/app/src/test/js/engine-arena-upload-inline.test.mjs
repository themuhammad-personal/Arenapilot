// Roadmap 3, step A3 — Arena upload delivery bypasses arena.ai's own
// attachment pipeline.
//
// Every "+" card lands in ONE function (the attach handler the sheet calls):
// it used to hand the file to the site's own <input type="file"> and dispatch
// "change", so arena.ai's official attachment restrictions (accepted types,
// per-model limits) decided the outcome — with no feedback, uploads silently
// did nothing. The owner decision (2026-10-14) is that the app's own features
// must not be limited by the site's attachment pipeline:
//
//   - text-like files (everything the cards themselves build: folder
//     *_workspace.txt, project *_context.txt, GitHub and web fetch .md/.txt,
//     picked text files) are delivered through the composer as message text,
//     which every Direct Chat model receives;
//   - images keep the site's own input as the only real path, and when the
//     input's accept list already refuses the file, the user gets a clear
//     message instead of a silent no-op;
//   - DeepSeek's flow is unchanged.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const content = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/content.js'), 'utf8');

/** The top-level helpers the attach handler calls, cut out of the bundle. */
function helpers() {
  const start = content.indexOf('function sdsArenaInlineFile(');
  assert.ok(start >= 0, 'sdsArenaInlineFile exists in the bundle');
  const end = content.indexOf('/*sds-arena-inline-end*/', start);
  assert.ok(end > start, 'the helper block carries its end marker');
  return content.slice(start, end);
}

const HELPERS = helpers();

function fileStub({ name = 'a.txt', type = 'text/plain', content = 'BODY' } = {}) {
  return new File([content], name, { type });
}

test('sdsArenaInlineFile: text-like files are inlined, images and binaries are not', () => {
  const ctx = vm.createContext({ File });
  vm.runInContext(HELPERS + ';globalThis.out=sdsArenaInlineFile', ctx);
  const out = (f) => ctx.out(f);
  assert.equal(out(fileStub({ name: 'notes.txt', type: 'text/plain' })), true);
  assert.equal(out(fileStub({ name: 'repo.md', type: 'text/markdown' })), true);
  assert.equal(out(fileStub({ name: 'x_workspace.txt', type: 'text/plain' })), true, 'folder card output');
  assert.equal(out(fileStub({ name: 'p_context.txt', type: 'text/plain' })), true, 'project card output');
  assert.equal(out(fileStub({ name: 'page.md', type: 'text/markdown' })), true, 'web card output');
  assert.equal(out(fileStub({ name: 'app.py', type: 'text/x-python' })), true, 'picked code file');
  assert.equal(out(fileStub({ name: 'data.json', type: 'application/json' })), true);
  assert.equal(out(fileStub({ name: 'no-extension', type: 'text/plain' })), true);
  assert.equal(out(fileStub({ name: 'photo.jpg', type: 'image/jpeg' })), false, 'image keeps the site pipeline');
  assert.equal(out(fileStub({ name: 'photo.png', type: 'image/png' })), false);
  assert.equal(out(fileStub({ name: 'archive.zip', type: 'application/zip' })), false);
  assert.equal(out(fileStub({ name: 'doc.pdf', type: 'application/pdf' })), false);
  assert.equal(out(null), false, 'robust against null');
});

test('sdsArenaDeliverFileInline: sends a fenced block through the composer, never the file input', async () => {
  const sent = [];
  const reads = [];
  const ctx = vm.createContext({
    File,
    EW: async (f) => { reads.push(f.name); return 'FILE-CONTENT'; },
    $S: async (parts, label) => { sent.push({ parts, label }); return true; },
  });
  vm.runInContext(HELPERS + ';globalThis.deliver=sdsArenaDeliverFileInline', ctx);
  const ok = await ctx.deliver(fileStub({ name: 'script.py', type: 'text/x-python' }));
  assert.equal(ok, true);
  assert.deepEqual(reads, ['script.py'], 'the file content is read');
  assert.equal(sent.length, 1, 'exactly one composer send');
  assert.match(sent[0].parts[0], /```python/);
  assert.match(sent[0].parts[0], /FILE-CONTENT/);
  assert.match(sent[0].parts[0], /script\.py/);
  assert.equal(typeof sent[0].label, 'string');
});

test('the attach handler routes Arena text files to the inline path BEFORE the native input', () => {
  const lrAt = content.indexOf('async function lr(Re){');
  assert.ok(lrAt > 0, 'the attach handler exists');
  const body = content.slice(lrAt, content.indexOf('function Pt(Re)', lrAt));
  const inlineAt = body.indexOf('sdsArenaInlineFile(Re)');
  const adaptAt = body.indexOf('__sdAdaptUpload');
  const dataTransferAt = body.indexOf('new DataTransfer');
  assert.ok(inlineAt > 0, 'the handler has an Arena inline branch');
  assert.ok(adaptAt > inlineAt, 'inline delivery is decided before upload adaptation');
  assert.ok(dataTransferAt > inlineAt, 'the site input is only used after the inline decision');
  assert.ok(body.indexOf('sdsArenaDeliverFileInline(Re)') > 0, 'the branch delivers inline');
  // images that the site's own input already refuses get a spoken reason
  const refused = body.indexOf('__sdUploadAccepted');
  assert.ok(refused > 0, 'a refusal check exists for the site pipeline');
  assert.ok(body.indexOf('showToast', refused) > refused, 'a refusal is surfaced, not silent');
  // a missing site input must be refused too: the $D fallback would read a
  // binary as text and send garbage — the one outcome that must never happen
  assert.ok(/if\(sdsIsArena\(\)\)\{if\(!Le\)\{/.test(body), 'no native input means a spoken refusal, never the text fallback');
});

test('the exposed accept check matches what sd-native.js really computes', () => {
  const native = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-native.js'), 'utf8');
  assert.ok(native.includes('window.__sdUploadAccepted'), 'sd-native exposes __sdUploadAccepted');
  assert.ok(/window\.__sdUploadAccepted\s*=\s*function/.test(native), 'it is a function assignment');
});

test('DeepSeek keeps the native-input path: the arena branch is gated on sdsIsArena()', () => {
  const lrAt = content.indexOf('async function lr(Re){');
  const body = content.slice(lrAt, content.indexOf('function Pt(Re)', lrAt));
  const gateAt = body.indexOf('sdsIsArena()');
  assert.ok(gateAt >= 0 && gateAt < body.indexOf('sdsArenaInlineFile(Re)'), 'the inline branch is Arena-only');
});
