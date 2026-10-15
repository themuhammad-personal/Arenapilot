// The engine's "+" in arena's REAL composer.
//
// Until now the arena composer in the tests was a model drawn from public code: a flat
// <form> with a button labelled "Attach files" and a file input beside it. The CI emulator
// has since opened the real arena.ai page over the DevTools protocol (android/ci/cdp_probe.mjs)
// and the real structure is different:
//
//   form
//     div (column)
//       input[type=file].hidden            ← a child of the COLUMN, not of the controls row
//       textarea[name=message]
//       div (controls row)
//         div (left group)
//           button[aria-label="Add files"] ← arena's own "+"  (not "Attach files")
//           button[role=combobox]          ← the Direct / Battle / Side-by-side / Agent switch
//         div (right group)
//           button                         ← an icon
//           button[aria-label="Send message"][type=submit]
//
// So `Yvt()` — which hid "whatever sits right before the file input", true on DeepSeek —
// hid nothing on arena, and the engine's "+" was appended at the very end of the form: two "+"
// buttons on screen, the engine's on a row of its own below the controls. DeepSeek's design is
// one "+": the engine's replaces the site's, in its slot. These tests build the REAL structure
// and pin that the engine's "+" now takes arena's slot — and that nothing else moved.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { makeEl } from './helpers/fake-dom.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/content.js'), 'utf8');

function fnSource(name) {
  const start = CONTENT.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from content.js`);
  const brace = CONTENT.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < CONTENT.length; i += 1) {
    if (CONTENT[i] === '{') depth += 1;
    else if (CONTENT[i] === '}') { depth -= 1; if (depth === 0) return CONTENT.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${name}`);
}

/**
 * arena's composer exactly as the real page showed it. `label` is the attach button's
 * aria-label (null = no label at all), `combobox` whether the mode switch is there.
 */
function realArena({ label = 'Add files', combobox = true, site = 'arena' } = {}) {
  const body = makeEl('body');
  const main = makeEl('main');
  body.appendChild(main);
  const card = makeEl('div'); card.className = 'bg-surface-primary relative flex flex-col'; main.appendChild(card);
  const inner = makeEl('div'); inner.className = 'bg-surface-secondary relative mx-auto'; card.appendChild(inner);
  const form = makeEl('form'); form.className = 'flex w-full flex-col items-start justify-center p-2'; inner.appendChild(form);
  const column = makeEl('div'); column.className = 'flex w-full flex-col justify-between gap-2'; form.appendChild(column);

  // engine elements that sit in the column above the input (the real capture shows them)
  const queue = makeEl('div'); queue.className = 'bds-question-panel bds-queue-panel'; column.appendChild(queue);
  const fileInput = makeEl('input', { type: 'file' }); fileInput.className = 'hidden'; column.appendChild(fileInput);
  const textarea = makeEl('textarea', { name: 'message', placeholder: 'Ask anything…' }); column.appendChild(textarea);

  const row = makeEl('div'); row.className = 'flex justify-between gap-4'; column.appendChild(row);
  const left = makeEl('div'); left.className = 'me-1 flex h-8 min-w-0 items-center gap-2'; row.appendChild(left);
  const attach = makeEl('button', label ? { 'aria-label': label, type: 'button', 'data-slot': 'tooltip-trigger' } : { type: 'button', 'data-slot': 'tooltip-trigger' });
  left.appendChild(attach);
  const mode = combobox ? makeEl('button', { role: 'combobox', type: 'button' }) : null;
  if (mode) left.appendChild(mode);
  const right = makeEl('div'); right.className = 'flex items-center gap-2'; row.appendChild(right);
  const icon = makeEl('button', { type: 'button' }); right.appendChild(icon);
  const send = makeEl('button', { 'aria-label': 'Send message', type: 'submit' }); right.appendChild(send);

  const mounts = [];
  const markers = [];
  const win = { __sdSite: site ? { id: site } : undefined, innerWidth: 320, innerHeight: 616 };
  const document = {
    body, documentElement: makeEl('html'),
    createElement: (tag) => makeEl(tag),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    querySelector: (sel) => body.querySelector(sel),
  };
  const ctx = vm.createContext({
    window: win, document,
    Rme: () => null, Mme: () => null, Kvt: () => null, NS: () => false, jvt: () => false,
    Ki: { getConfig: (key) => (key === 'selectors.chatInput.wrapper' ? ['form', '.bg-surface-raised'] : null) },
    Zi: (component, props) => mounts.push({ component, props }),
    NQ: (...els) => els.forEach((e) => e && markers.push(e)),
    Vvt: () => null,
    Lut: 'LUT', jut: 'JUT', jut2: 'x', Xut: 'XUT',
    B: { deepResearch: { enabled: false }, deepCode: { enabled: false } },
    setTimeout: (fn) => fn(),
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', width: '400px', flexDirection: 'column' }),
    console,
  });
  const names = ['sdsIsArena', 'sdsArenaComposer', 'sdsArenaInComposer', 'sdsArenaFileInput', 'sdsArenaAttachSlot',
    '_v', 'iT', 'PQ', 'Dme', 'V_', 'Yvt', 'Ovt', 'Qvt', 'Wvt', '$vt'];
  vm.runInContext(names.map(fnSource).join('\n'), ctx);
  return { body, form, column, fileInput, textarea, row, left, attach, mode, right, icon, send, mounts, markers, win, ctx,
    run: (code) => vm.runInContext(code, ctx) };
}

const mountsOf = (g) => g.mounts.filter((m) => m.component === 'LUT');
const hidden = (el) => (el._hover && el._hover.display) === 'none';

// ── 1. where the "+" lands ──────────────────────────────────────────────────

test('the engine’s "+" takes the slot of arena’s own "Add files" — before it, in the same group', () => {
  const g = realArena();
  g.run('$vt()');
  const mount = g.left.children.find((c) => c.classList.contains('bds-attach-menu-mount'));
  assert.ok(mount, 'the mount is in the left group of the controls row');
  assert.equal(g.left.children.indexOf(mount), 0, 'first in the group, where arena’s "+" was');
  assert.equal(g.left.children[1] === g.attach, true, 'arena’s own button right after it');
  assert.equal(g.left.children[2] === g.mode, true, 'then the mode switch, untouched');
  assert.equal(mountsOf(g).length, 1);
  assert.equal(mountsOf(g)[0].props.props.nativeInput === g.fileInput, true, 'and the sheet is given the real file input to drive');
});

test('arena’s own "+" is hidden, so there is ONE "+", as on DeepSeek', () => {
  const g = realArena();
  g.run('$vt()');
  assert.equal(hidden(g.attach), true, 'Add files is display:none');
  for (const [name, el] of Object.entries({ mode: g.mode, send: g.send, icon: g.icon, input: g.fileInput, textarea: g.textarea })) {
    assert.equal(hidden(el), false, `${name} is left alone`);
  }
});

test('the real file input is found though it is a child of the column, not of the controls row', () => {
  const g = realArena();
  assert.equal(g.run('PQ()') === g.fileInput, true);
  assert.equal(g.run('Dme(PQ())') === g.form, true, 'the container the other mounts use is still the form');
});

test('the other engine mounts keep their place (the end of the form): only the "+" moved', () => {
  const g = realArena();
  g.run('$vt()');
  const classes = g.form.children.map((c) => c.className);
  assert.ok(classes.some((c) => c.includes('bds-expand-toggle-mount')));
  assert.ok(classes.some((c) => c.includes('bds-rag-preview-mount')));
  assert.ok(!classes.some((c) => c.includes('bds-attach-menu-mount')), 'the "+" is no longer a child of the form');
});

test('calling it again — the SPA scan runs constantly — never adds a second mount or sheet', () => {
  const g = realArena();
  for (let i = 0; i < 4; i += 1) g.run('$vt()');
  assert.equal(g.left.children.filter((c) => c.classList.contains('bds-attach-menu-mount')).length, 1);
  assert.equal(mountsOf(g).length, 1);
  assert.equal(g.left.children.indexOf(g.left.children.find((c) => c.classList.contains('bds-attach-menu-mount'))), 0);
});

// ── 2. finding arena’s button ───────────────────────────────────────────────

test('the slot is found by arena’s real label, and by the old modelled one', () => {
  for (const label of ['Add files', 'Attach files']) {
    const g = realArena({ label });
    assert.equal(g.run('sdsArenaAttachSlot().button') === g.attach, true, label);
    assert.equal(g.run('sdsArenaAttachSlot().group') === g.left, true, label);
  }
});

test('a localised or renamed label still works: the button right before the mode switch', () => {
  const g = realArena({ label: 'ফাইল যোগ করুন' });
  assert.equal(g.run('sdsArenaAttachSlot().button') === g.attach, true);
  g.run('$vt()');
  assert.equal(hidden(g.attach), true);
  assert.equal(g.left.children[0].classList.contains('bds-attach-menu-mount'), true);
});

test('with neither a known label nor the mode switch the engine keeps its old placement and hides nothing', () => {
  const g = realArena({ label: null, combobox: false });
  assert.equal(g.run('sdsArenaAttachSlot()'), null);
  g.run('$vt()');
  assert.equal(hidden(g.attach), false, 'never hide a button we cannot identify');
  assert.ok(g.form.children.some((c) => c.classList.contains('bds-attach-menu-mount')), 'the "+" is still offered, at the end of the form');
  assert.equal(mountsOf(g).length, 1);
});

test('the engine never claims one of its own buttons as arena’s', () => {
  const g = realArena();
  g.left.children.find((c) => c === g.attach).className = 'x';
  // an engine mount carrying a button with the same label must not be taken for arena’s
  const root = g.body.children[0]; // main
  const bdsRoot = Object.assign(g.ctx.document.createElement('div'), { id: 'bds-root' });
  root.appendChild(bdsRoot);
  const fake = g.ctx.document.createElement('button');
  fake.setAttribute('aria-label', 'Add files');
  bdsRoot.appendChild(fake);
  assert.equal(g.run('sdsArenaAttachSlot().button') === g.attach, true, 'the composer’s own button, not the one in #bds-root');
});

// ── 3. DeepSeek, and every other page, is untouched ─────────────────────────

test('off arena there is no slot, and Yvt() is exactly what it was', () => {
  const g = realArena({ site: 'deepseek' });
  assert.equal(g.run('sdsArenaAttachSlot()'), null);
  // DeepSeek's DOM: the site's "+" is the element right before the file input
  const toolbar = makeEl('div');
  const plus = makeEl('button', { type: 'button' });
  const input = makeEl('input', { type: 'file' });
  toolbar.appendChild(plus); toolbar.appendChild(input);
  g.body.appendChild(toolbar);
  g.ctx.__input = input;
  assert.equal(g.run('Yvt(__input)') === plus, true, 'the sibling rule, as always');
  assert.equal(g.run('Yvt(__input) === Yvt(__input)'), true);
});

test('off arena, a button whose label is "Add files" is nobody’s business', () => {
  const g = realArena({ site: 'deepseek' });
  g.run('$vt()');
  assert.equal(hidden(g.attach), false);
});

// ── 4. the source ───────────────────────────────────────────────────────────

test('the three seams are in the bundle, each exactly once', () => {
  const times = (needle) => CONTENT.split(needle).length - 1;
  assert.equal(times('function sdsArenaAttachSlot('), 1);
  assert.equal(times('function Yvt(e){if(sdsIsArena()){const sl=sdsArenaAttachSlot();return sl?sl.button:null}'), 1);
  assert.equal(times('i=e||sdsIsArena()?Yvt(e):null;'), 1, 'hide even before a file input exists');
  assert.equal(times('const sl=sdsArenaAttachSlot(),o=sl?V_(sl.group,"bds-attach-menu-mount",".bds-attach-wrapper",sl.button):V_(t,"bds-attach-menu-mount",".bds-attach-wrapper",e);'), 1);
  assert.equal(times('V_(t,"bds-attach-menu-mount",".bds-attach-wrapper",e)'), 1, 'the original call survives only as the fallback');
});
