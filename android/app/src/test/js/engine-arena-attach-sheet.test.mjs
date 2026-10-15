// Phase 4, part 2 — the "+" sheet on arena.ai (HARD REQ 2).
//
// The whole attach flow hangs off three DeepSeek-shaped facts: the composer is
// `textarea#chat-input`, the controls row is the one holding the DeepThink
// button, and the site's file input lives in that row. On arena none of that is
// true, and the failure mode is quiet: the engine types into whatever
// `[role="textbox"]` it finds first, mounts its sheet into the wrong container,
// or returns early and shows no "+" at all.
//
// These tests run the SHIPPED functions out of content.js against a fake DOM,
// so they assert behaviour, not strings:
//   * `_v()` (the composer, used by setComposer/send/sdComposerText) and `iT()`
//     pick arena's `textarea[name="message"]` even when a decoy `[role="textbox"]`
//     sits earlier in the DOM, and still pick DeepSeek's `#chat-input` first;
//   * the file input is arena's composer one, not an avatar input;
//   * the container is derived from the composer, not from the file input;
//   * mounting can no longer throw when the reference is not a child;
//   * arena's own attach button is hidden, a card of its popup never is;
//   * `$vt()` mounts the sheet on arena even before a file input exists.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/content.js'), 'utf8');

function fnSource(name) {
  const start = CONTENT.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from content.js — the patch was lost`);
  const brace = CONTENT.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < CONTENT.length; i += 1) {
    if (CONTENT[i] === '{') depth += 1;
    else if (CONTENT[i] === '}') { depth -= 1; if (depth === 0) return CONTENT.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${name}`);
}

const times = (needle) => CONTENT.split(needle).length - 1;

// ── a fake DOM, with the selector surface these functions actually use ──────

/**
 * Splits a selector on its combinators, ignoring spaces inside brackets or
 * quotes — `button[aria-label="Attach files"]` is ONE compound selector.
 */
function splitSelector(one) {
  const parts = [];
  let cur = '';
  let depth = 0;
  let quote = null;
  for (const ch of one.trim()) {
    if (quote) { cur += ch; if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '[') { depth += 1; cur += ch; continue; }
    if (ch === ']') { depth -= 1; cur += ch; continue; }
    if (depth === 0 && ch === '>') { if (cur) { parts.push(cur); cur = ''; } parts.push('>'); continue; }
    if (depth === 0 && /\s/.test(ch)) { if (cur) { parts.push(cur); cur = ''; } continue; }
    cur += ch;
  }
  if (cur) parts.push(cur);
  return parts;
}

/** A compound selector (`textarea[name="message"]`): tag, `#id`, `.class`, `[attr]`. */
const SIMPLE_RE = /\[[^\]]+\]|#[^.#[\]\s>]+|\.[^.#[\]\s>]+|[a-zA-Z*][\w-]*/g;

function simpleMatch(node, part) {
  const tokens = String(part).match(SIMPLE_RE) || [];
  return tokens.every((t) => {
    if (t === '*') return true;
    if (t[0] === '#') return node.id === t.slice(1);
    if (t[0] === '.') return node.classList.contains(t.slice(1));
    if (t[0] === '[') {
      const m = /^\[([^=\]]+)(?:=["']?([^"']*)["']?)?\]$/.exec(t);
      if (!m) return false;
      const v = node.getAttribute(m[1]);
      return m[2] === undefined ? v !== null : v === m[2];
    }
    return node.tagName === t.toUpperCase();
  });
}

/**
 * A selector list, with descendant combinators — enough for the ones content.js
 * uses here (`textarea[name="message"]`, `.ds-textarea textarea`, `header,nav`…).
 */
function matchesSel(node, selector) {
  return String(selector).split(',').some((one) => {
    const parts = splitSelector(one);
    if (!simpleMatch(node, parts[parts.length - 1])) return false;
    let cur = node;
    let i = parts.length - 2;
    while (i >= 0) {
      if (parts[i] === '>') { // child combinator
        i -= 1;
        const p = cur.parentNode;
        if (!p || p.nodeType !== 1 || !simpleMatch(p, parts[i])) return false;
        cur = p;
        i -= 1;
        continue;
      }
      // a descendant step: walk up until an ancestor matches
      let up = cur.parentNode;
      while (up && up.nodeType === 1 && !simpleMatch(up, parts[i])) up = up.parentNode;
      if (!up || up.nodeType !== 1) return false;
      cur = up;
      i -= 1;
    }
    return true;
  });
}

function makeEl(tag, attrs = {}) {
  const node = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    childNodes: [],
    parentNode: null,
    id: '',
    hidden: false,
    offsetParent: {},
    isConnected: true,
    dataset: {},
    _attrs: { ...attrs },
    _classes: [],
    _text: '',
    _html: '',
    _hover: {},
    get children() { return node.childNodes.filter((c) => c.nodeType === 1); },
    get className() { return node._classes.join(' '); },
    set className(v) { node._classes = String(v).split(/\s+/).filter(Boolean); },
    get innerHTML() { return node._html; },
    set innerHTML(v) { node._html = String(v); },
    get textContent() { return node._text + node.childNodes.map((c) => c.textContent).join(''); },
    set textContent(v) { node._text = String(v); node.childNodes = []; },
    get previousElementSibling() {
      const p = node.parentNode;
      if (!p) return null;
      const i = p.childNodes.indexOf(node);
      for (let k = i - 1; k >= 0; k -= 1) if (p.childNodes[k].nodeType === 1) return p.childNodes[k];
      return null;
    },
    get firstElementChild() { return node.children[0] || null; },
    get lastElementChild() { const k = node.children; return k.length ? k[k.length - 1] : null; },
    get nextElementSibling() {
      const p = node.parentNode;
      if (!p) return null;
      const i = p.childNodes.indexOf(node);
      for (let k = i + 1; k < p.childNodes.length; k += 1) if (p.childNodes[k].nodeType === 1) return p.childNodes[k];
      return null;
    },
    setAttribute(k, v) { node._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(node._attrs, k) ? node._attrs[k] : null; },
    appendChild(c) { c.parentNode = node; node.childNodes.push(c); return c; },
    insertBefore(c, ref) {
      if (ref && ref.parentNode !== node) { const e = new Error('NotFoundError'); e.name = 'NotFoundError'; throw e; }
      const at = ref ? node.childNodes.indexOf(ref) : -1;
      c.parentNode = node;
      if (at < 0) node.childNodes.push(c); else node.childNodes.splice(at, 0, c);
      return c;
    },
    get parentElement() { return node.parentNode && node.parentNode.nodeType === 1 ? node.parentNode : null; },
    contains(other) { for (let n = other; n; n = n.parentNode) if (n === node) return true; return false; },
    closest(sel) { for (let n = node; n && n.nodeType === 1; n = n.parentNode) if (matchesSel(n, sel)) return n; return null; },
    matches(sel) { return matchesSel(node, sel); },
    querySelectorAll(sel) { return collect(node).filter((n) => matchesSel(n, sel)); },
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
    getBoundingClientRect: () => ({ width: 400, height: 40, top: 500, left: 0, right: 400, bottom: 540 }),
  };
  node.classList = {
    add: (c) => { if (!node._classes.includes(c)) node._classes.push(c); },
    remove: (c) => { node._classes = node._classes.filter((x) => x !== c); },
    contains: (c) => node._classes.includes(c),
  };
  node.style = { getPropertyValue: (k) => node._hover[k] || '', setProperty: (k, v) => { node._hover[k] = v; }, width: '' };
  if (attrs.id) node.id = attrs.id;
  return node;
}

function collect(node) {
  const out = [];
  const walk = (n) => n.childNodes.forEach((c) => { if (c.nodeType === 1) { out.push(c); walk(c); } });
  walk(node);
  return out;
}

/**
 * An arena-shaped page: `main > form > [ textarea[name=message], buttons ]`,
 * plus decoys a generic selector would fall for.
 */
function arenaPage({ withFileInput = true, fileInputInComposer = true, withAvatar = true } = {}) {
  const body = makeEl('body');
  const main = makeEl('main');
  body.appendChild(main);
  const form = makeEl('form');
  main.appendChild(form);
  form.className = 'bg-surface-raised';

  const composer = makeEl('textarea', { name: 'message', placeholder: 'Ask anything' });
  const send = makeEl('button', { 'aria-label': 'Send message' });
  const attach = makeEl('button', { 'aria-label': 'Attach files' });
  form.appendChild(composer);
  form.appendChild(attach);
  form.appendChild(send);
  let fileInput = null;
  let popup = null;
  if (withFileInput) {
    fileInput = makeEl('input', { type: 'file' });
    if (fileInputInComposer) form.insertBefore(fileInput, send); // right after the site's own "+"
    else {
      popup = makeEl('div', { role: 'menu' });
      popup.appendChild(makeEl('button', { 'aria-label': 'Add photos' })); // a card of arena's own sheet
      popup.appendChild(fileInput);
    }
  }

  // a search box that satisfies [role="textbox"] and comes first in the document
  const search = makeEl('input', { role: 'textbox' });
  main.insertBefore(search, form);

  // an avatar upload, FIRST in document order — what a naive "first file input" grabs
  const header = makeEl('header');
  const avatar = withAvatar ? makeEl('input', { type: 'file' }) : null;
  if (avatar) header.appendChild(avatar);
  body.insertBefore(header, main);
  if (popup) body.insertBefore(popup, main);

  const mounts = [];
  const markers = [];
  const document = {
    body,
    documentElement: makeEl('html'),
    createElement: (tag) => makeEl(tag),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    querySelector: (sel) => body.querySelector(sel),
  };
  const win = { __sdSite: undefined, innerWidth: 1280, innerHeight: 800 };

  const ctx = vm.createContext({
    window: win,
    document: document,
    Rme: () => null,                       // DeepSeek's DeepThink-based row finder
    Mme: () => null,
    Kvt: () => null,
    NS: () => false,                       // _v()'s "is this one of ours" guard
    jvt: () => false,                      // the shipped "is the input usable" probe
    Ki: { getConfig: (key) => (key === 'selectors.chatInput.wrapper' ? ['form', '.bg-surface-raised'] : null) },
    Zi: (component, props) => mounts.push({ component, props }),
    NQ: (...els) => els.forEach((e) => e && markers.push(e)),
    Wvt: (container) => container,
    Vvt: () => null,
    Lut: 'LUT', jut: 'JUT', Xut: 'XUT',
    B: { deepResearch: { enabled: false }, deepCode: { enabled: false } },
    setTimeout: (fn) => fn(),
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', width: '400px', flexDirection: 'column' }),
    console,
  });
  const names = ['sdsIsArena', 'sdsArenaComposer', 'sdsArenaInComposer', 'sdsArenaFileInput', 'sdsArenaAttachSlot',
    '_v', 'iT', 'PQ', 'Dme', 'V_', 'Yvt', 'Ovt', 'Qvt', '$vt'];
  vm.runInContext(names.map(fnSource).join('\n'), ctx);

  return { body, main, form, composer, attach, send, search, avatar, fileInput, mounts, markers, win, ctx,
    run: (code) => vm.runInContext(code, ctx) };
}

// ── 1. the composer ─────────────────────────────────────────────────────────

test('the engine finds arena’s composer itself, not the first role="textbox"', () => {
  const p = arenaPage();
  p.win.__sdSite = { id: 'arena' };
  assert.equal(p.run('_v() && _v().getAttribute("name")'), 'message',
    '_v() drives setComposer/send — a decoy textbox must not win');
  assert.equal(p.run('iT() && iT().getAttribute("name")'), 'message', 'and the attach flow agrees');
  assert.notEqual(p.run('_v().tagName'), 'INPUT', 'the search box is not the composer');
});

test('DeepSeek still wins its own selector, wherever it is in the DOM', () => {
  const p = arenaPage();
  const legacy = makeEl('textarea', { id: 'chat-input' });
  p.form.appendChild(legacy);
  p.win.__sdSite = { id: 'deepseek' };
  assert.equal(p.run('_v() === document.querySelector("textarea#chat-input")'), true,
    'the DeepSeek build must keep resolving #chat-input first');
});

test('both composer lists name arena’s composer explicitly', () => {
  assert.equal(times(`'textarea[name="message"]','[role="textbox"][contenteditable]'`), 2,
    'the main finder (_v) and the attach flow (iT)');
  assert.ok(fnSource('_v').indexOf('textarea#chat-input') < fnSource('_v').indexOf('textarea[name="message"]'),
    'DeepSeek first, arena second');
  assert.ok(fnSource('_v').indexOf('textarea[name="message"]') < fnSource('_v').indexOf('textarea[placeholder]'),
    'arena’s explicit selector must beat the generic placeholder fallback');
});

// ── 2. the file input, the container, the mount ─────────────────────────────

test('arena’s own file input is the composer’s, never the avatar’s', () => {
  const p = arenaPage();
  p.win.__sdSite = { id: 'arena' };
  assert.equal(p.run('PQ() === document.querySelector("form input[type=\'file\']")'), true);

  // …and DeepSeek keeps the shipped order (first usable input), untouched.
  const d = arenaPage();
  d.win.__sdSite = { id: 'deepseek' };
  assert.equal(d.run('PQ() === document.querySelector("header input[type=\'file\']")'), true,
    'no arena cleverness leaks into the DeepSeek path');

  // MODELLED: when the composer has no input at all, arena still falls back to
  // the shipped order — which can be an avatar upload. Phase 0 confirms where
  // arena's own attach input lives before this is tightened.
  const noComposerInput = arenaPage({ fileInputInComposer: false });
  noComposerInput.win.__sdSite = { id: 'arena' };
  assert.equal(noComposerInput.run('PQ() === document.querySelector("header input[type=\'file\']")'), true,
    'documented fallback: an avatar input can win when the composer has none');
});

test('the container comes from the composer, even when the input lives elsewhere', () => {
  const p = arenaPage({ fileInputInComposer: false });
  p.win.__sdSite = { id: 'arena' };
  assert.equal(p.run('Dme(PQ()) === document.querySelector("form")'), true);

  const d = arenaPage({ fileInputInComposer: false });
  d.win.__sdSite = { id: 'deepseek' };
  assert.equal(d.run('Dme(PQ()) === PQ().parentElement'), true,
    'the shipped "file input’s parent" behaviour is what DeepSeek still gets');
});

test('mounting survives a reference that is not a child of the container', () => {
  const p = arenaPage({ fileInputInComposer: false });
  p.win.__sdSite = { id: 'arena' };
  const mount = p.run(`V_(document.querySelector("form"), "bds-attach-menu-mount", ".bds-attach-wrapper", PQ())`);
  assert.ok(mount, 'no NotFoundError — the sheet would have died with it');
  assert.equal(p.run('document.querySelector("form").lastElementChild.className.includes("bds-attach-menu-mount")'), true,
    'with a foreign reference the mount is appended instead of thrown away');

  // a valid reference still keeps the shipped ordering
  const q = arenaPage();
  q.win.__sdSite = { id: 'arena' };
  q.run(`V_(document.querySelector("form"), "bds-attach-menu-mount", ".bds-attach-wrapper", PQ())`);
  assert.equal(q.run('document.querySelector("form > .bds-attach-menu-mount").nextElementSibling.tagName'), 'INPUT',
    'the mount still goes directly before the file input when it can');
});

// ── 3. hiding the site’s own "+" ────────────────────────────────────────────

test('arena’s attach button is hidden, a card of its popup never is', () => {
  const p = arenaPage();
  p.win.__sdSite = { id: 'arena' };
  assert.equal(
    p.run(`Yvt(document.querySelector('form input[type="file"]')) === document.querySelector('button[aria-label="Attach files"]')`),
    true, 'the site’s own + is replaced by ours, as on DeepSeek');

  const q = arenaPage({ fileInputInComposer: false });
  q.win.__sdSite = { id: 'arena' };
  // (booleans only: a failed assert.equal on a fake DOM node inspects a circular graph and kills the run)
  assert.equal(q.run(`Yvt(document.querySelector('[role="menu"] input[type="file"]')) === document.querySelector('[role="menu"] button')`), false,
    'a card of arena’s popup must never be hidden');
  assert.equal(q.run(`Yvt(document.querySelector('[role="menu"] input[type="file"]')) === document.querySelector('form button[aria-label="Attach files"]')`), true,
    'what is hidden is the composer’s own attach button, whatever file input was asked about');

  const d = arenaPage({ fileInputInComposer: false });
  d.win.__sdSite = { id: 'deepseek' };
  assert.equal(
    d.run(`Yvt(document.querySelector('[role="menu"] input[type="file"]')) === document.querySelector('[role="menu"] button')`),
    true, 'DeepSeek’s behaviour is unchanged — it still hides whatever precedes the input');
});

// ── 4. the sheet itself ─────────────────────────────────────────────────────

test('arena gets the "+" sheet even before a file input exists', () => {
  const p = arenaPage({ withFileInput: false, withAvatar: false });
  p.win.__sdSite = { id: 'arena' };
  p.run('$vt()');
  const luts = p.mounts.filter((m) => m.component === 'LUT');
  assert.equal(luts.length, 1, 'the sheet must mount — the cards are the feature');
  assert.equal(luts[0].props.props.nativeInput === null, true,
    'Lut resolves the input itself at pick time, so a null input is safe here');
  assert.ok(p.run('!!document.querySelector("form .bds-attach-menu-mount")'), 'mounted into the composer');

  const d = arenaPage({ withFileInput: false, withAvatar: false });
  d.win.__sdSite = { id: 'deepseek' };
  d.run('$vt()');
  assert.equal(d.mounts.length, 0, 'DeepSeek keeps the shipped early return');
  assert.ok(d.markers.length > 0, 'and still gets its mounted-marker, exactly as before');
});

test('the sheet mount is the shipped one, and the seam counts still hold', () => {
  assert.equal(times('if((!e||!t)&&!(sdsIsArena()&&t&&t.children&&t.insertBefore)){NQ(n,t);return}'), 1);
  assert.equal(times('if(!e||!t){NQ(n,t);return}'), 0, 'the unguarded early return is gone');
  assert.equal(times('Zi(Lut,{target:o,props:{nativeInput:e}})'), 1, 'the sheet is mounted by the shipped line');
  for (const fn of ['sdsArenaComposer', 'sdsArenaInComposer', 'sdsArenaFileInput']) {
    assert.equal(times(`function ${fn}(`), 1, `${fn} defined once`);
  }
  // A lower bound on purpose: every new arena branch raises this, so an exact
  // number would break unrelated patches. A drop below it means gating was lost.
  assert.ok(times('sdsIsArena()') >= 13, 'every arena branch is gated (grep-style pin)');
});
