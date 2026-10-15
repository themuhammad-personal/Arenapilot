// Phase 4, part 1 — the "Advanced Settings" entry on arena.ai (HARD REQ 1).
//
// On chat.deepseek.com the entry is a row the engine inserts into the account
// menu, and it is the ONLY door into the settings drawer: no native menu, no
// other event dispatcher anywhere in the bundle. arena has none of DeepSeek's
// markup (its menu is role-based), so with the DeepSeek-only installer the
// drawer would simply be unreachable there.
//
// These tests run the SHIPPED functions out of content.js against a fake DOM,
// so they prove behaviour rather than the presence of a string:
//   * DeepSeek's own path still inserts the row into `.ds-dropdown-menu`, with
//     the same label, icon and `bds:open-drawer` event;
//   * on arena the row lands after the menu's own settings item, is marked as
//     ours, and opens the same, untouched drawer;
//   * the rail fallback exists (and only on arena), because a settings entry
//     that can silently disappear is worse than no entry at all.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const BDS = path.join(here, '../../main/bds-assets/bds');
const CONTENT = fs.readFileSync(path.join(BDS, 'content.js'), 'utf8');
const CSS = fs.readFileSync(path.join(BDS, 'content.css'), 'utf8');

/** The source of `function <name>(…) { … }`, brace-matched, from the bundle. */
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

/** The gear icon the DeepSeek row already uses. */
const ICON = (() => {
  const m = /V2t=`([^`]*)`/.exec(CONTENT);
  assert.ok(m, 'V2t (the settings icon) is gone from content.js');
  return m[1];
})();

// ── a fake DOM, just big enough for the menu and the rail ───────────────────

function matchesSel(node, sel) {
  if (sel.startsWith('#')) return node.id === sel.slice(1);
  if (sel === 'button') return node.tagName === 'BUTTON';
  if (sel === 'a') return node.tagName === 'A';
  const attr = /^\[([\w-]+)="([^"]*)"\]$/.exec(sel);
  if (attr) return node.getAttribute(attr[1]) === attr[2];
  if (sel === '*') return true;
  if (sel.startsWith('.')) return node.classList.contains(sel.slice(1));
  return false;
}

function makeEl(tag, text = '') {
  const node = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    childNodes: [],
    parentNode: null,
    id: '',
    _attrs: {},
    _classes: [],
    _text: text,
    _html: '',
    _listeners: {},
    get children() { return node.childNodes.filter((c) => c.nodeType === 1); },
    get className() { return node._classes.join(' '); },
    set className(v) { node._classes = String(v).split(/\s+/).filter(Boolean); },
    get innerHTML() { return node._html; },
    set innerHTML(v) { node._html = String(v); },
    get textContent() { return node._text + node.childNodes.map((c) => c.textContent).join(''); },
    set textContent(v) { node._text = String(v); node.childNodes = []; },
    get nextSibling() {
      const p = node.parentNode;
      if (!p) return null;
      const i = p.childNodes.indexOf(node);
      return i < 0 ? null : p.childNodes[i + 1] || null;
    },
    setAttribute(k, v) { node._attrs[k] = String(v); },
    getAttribute(k) { return Object.prototype.hasOwnProperty.call(node._attrs, k) ? node._attrs[k] : null; },
    removeAttribute(k) { delete node._attrs[k]; },
    addEventListener(t, f) { (node._listeners[t] = node._listeners[t] || []).push(f); },
    appendChild(c) { c.parentNode = node; node.childNodes.push(c); return c; },
    insertBefore(c, ref) {
      const at = ref ? node.childNodes.indexOf(ref) : -1;
      c.parentNode = node;
      if (at < 0) node.childNodes.push(c); else node.childNodes.splice(at, 0, c);
      return c;
    },
    matches(sel) { return matchesSel(node, sel); },
    querySelectorAll(sel) { return collect(node).filter((n) => matchesSel(n, sel)); },
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
    dispatch(type, ev = {}) { (node._listeners[type] || []).forEach((f) => f(ev)); },
    click() { node.dispatch('click', { stopPropagation() {}, preventDefault() {} }); },
  };
  node.classList = {
    add: (c) => { if (!node._classes.includes(c)) node._classes.push(c); },
    remove: (c) => { node._classes = node._classes.filter((x) => x !== c); },
    contains: (c) => node._classes.includes(c),
  };
  return node;
}

function collect(node) {
  const out = [];
  const walk = (n) => n.childNodes.forEach((c) => { if (c.nodeType === 1) { out.push(c); walk(c); } });
  walk(node);
  return out;
}

/**
 * A page with the engine's own container and, optionally, arena's role-based
 * menu. The bundle's functions are then evaluated against it.
 */
function page({ siteId = 'arena', locale = 'en', translation = null } = {}) {
  const body = makeEl('body');
  const html = makeEl('html');
  html.lang = 'en';
  const root = makeEl('div');
  root.id = 'bds-root';
  body.appendChild(root);

  const winEvents = [];
  const docEvents = [];
  const state = { bodyClicks: 0, docListeners: {}, observers: [] };
  body.click = () => { state.bodyClicks += 1; };

  const document = {
    body,
    documentElement: html,
    activeElement: null,
    createElement: (tag) => makeEl(tag),
    getElementById(id) { return collect(body).concat([body]).find((n) => n.id === id) || null; },
    querySelectorAll(sel) { return body.querySelectorAll(sel); },
    querySelector(sel) { return body.querySelector(sel); },
    addEventListener(t, f) { (state.docListeners[t] = state.docListeners[t] || []).push(f); },
    removeEventListener() {},
    dispatchEvent(e) { docEvents.push(e); return true; },
  };

  const window = {
    __sdSite: siteId === null ? undefined : { id: siteId },
    dispatchEvent(e) { winEvents.push(e); return true; },
  };

  const ur = {
    locale,
    t: (key) => (translation === null
      ? (key === 'sidebarMenu.advancedSettings' ? 'Advanced Settings' : key)
      : translation),
  };

  class FakeCustomEvent { constructor(type) { this.type = type; } }
  class FakeKeyboardEvent { constructor(type, init) { this.type = type; Object.assign(this, init); } }
  class FakeObserver {
    constructor(cb) { this.cb = cb; this.observed = null; state.observers.push(this); }
    observe(target, opts) { this.observed = { target, opts }; }
    disconnect() {}
    fire(records) { this.cb(records); }
  }

  const ctx = vm.createContext({
    window, document, ur, $vt: () => {}, sdsArenaAttachSlot: () => null, sdsArenaComposer: () => null,
    CustomEvent: FakeCustomEvent,
    KeyboardEvent: FakeKeyboardEvent,
    MutationObserver: FakeObserver,
    setTimeout: (fn) => { fn(); }, // a scheduled pass runs inline, so clicks are observable
    console,
  });

  const names = ['sdsIsArena', 'sdsIsBn', 'sdsAdvancedLabel', 'sdsArenaLabel', 'sdsIsSettingsText',
    'sdsArenaRowText', 'sdsArenaItems', 'sdsArenaCloseMenu', 'sdsArenaMenu', 'sdsArenaMenus',
    'sdsArenaRail', 'sdsArenaInstall', 'rw', 'WQ'];
  vm.runInContext(`${names.map(fnSource).join('\n')}\nvar V2t=${JSON.stringify(ICON)};`, ctx);

  return { ctx, body, root, state, winEvents, docEvents, run: (code) => vm.runInContext(code, ctx) };
}

/** arena's account menu: a [role="menu"] with [role="menuitem"] rows. */
function arenaMenu(labels = ['Profile', 'Settings', 'Log out']) {
  const menu = makeEl('div');
  menu.setAttribute('role', 'menu');
  const items = labels.map((l) => {
    const item = makeEl('div', l);
    item.setAttribute('role', 'menuitem');
    menu.appendChild(item);
    return item;
  });
  return { menu, items };
}

/** DeepSeek's account menu: `.ds-dropdown-menu-option__label` rows. */
function deepseekMenu(labels = ['Profile', 'Settings', 'Log out']) {
  const menu = makeEl('div');
  menu.className = 'ds-dropdown-menu';
  const items = labels.map((l) => {
    const item = makeEl('div');
    item.className = 'ds-dropdown-menu-option';
    const label = makeEl('div', l);
    label.className = 'ds-dropdown-menu-option__label';
    item.appendChild(label);
    menu.appendChild(item);
    return item;
  });
  return { menu, items };
}

const advanced = (scope) => scope.querySelectorAll('.bds-advanced-settings-option');

// ── 1. the DeepSeek path, still exactly as it was ───────────────────────────

test('on DeepSeek the row still lands in the account menu, unchanged', () => {
  const p = page({ siteId: 'deepseek' });
  p.run('window.__sdSite={id:"deepseek"}');
  const { menu, items } = deepseekMenu();
  p.body.appendChild(menu);

  p.run(`WQ(document.body.querySelector(".ds-dropdown-menu"))`);

  const rows = advanced(menu);
  assert.equal(rows.length, 1, 'exactly one row');
  const row = rows[0];
  assert.ok(row.classList.contains('ds-dropdown-menu-option'), 'keeps the site’s own option classes');
  assert.ok(!row.classList.contains('bds-arena-menu-option'), 'no arena styling on DeepSeek');
  assert.equal(menu.childNodes.indexOf(row), menu.childNodes.indexOf(items[1]) + 1,
    'the entry stays where it is: right after the site’s own settings item');
  assert.ok(row.innerHTML.includes(ICON), 'the eye-catching settings icon is the shipped one');
  assert.match(row.innerHTML, /Advanced Settings/);
  assert.equal(row.getAttribute('role'), null, 'DeepSeek’s version adds no role attribute');

  row.dispatch('click', { stopPropagation() {}, preventDefault() {} });
  assert.equal(p.state.bodyClicks, 1, 'the menu is dismissed the way DeepSeek’s own path did it');
  assert.deepEqual(p.winEvents.map((e) => e.type), ['bds:open-drawer']);
});

test('the label is built in one place, so the two rows cannot drift apart', () => {
  assert.equal(times('function sdsAdvancedLabel('), 1);
  assert.equal(times('sdsAdvancedLabel('), 3, 'one definition, one DeepSeek call, one arena call');
  assert.equal(times('i=sdsAdvancedLabel(n,r)'), 1, 'WQ builds its label through the helper');
  assert.equal(times('i=n?"\\u0985'), 0, 'the inline label expression is gone from WQ');
  assert.ok(fnSource('WQ').includes('rw(i,V2t,"bds-advanced-settings-option"'),
    'the DeepSeek row is still the shipped rw() call');
});

test('the label keeps its Bengali / translation / English ladder', () => {
  const p = page();
  const one = (code) => p.run(code);
  assert.equal(one('sdsAdvancedLabel(!0,null)'), 'অ্যাডভান্স সেটিংস');
  assert.equal(one('sdsAdvancedLabel(!1,void 0)'), 'Advanced Settings');
  assert.equal(one('sdsAdvancedLabel(!1,"sidebarMenu.advancedSettings")'), 'Advanced Settings',
    'an untranslated key falls back to English, never leaks the key');
  assert.equal(one('sdsAdvancedLabel(!1,"Paramètres")'), 'Paramètres');
  assert.equal(one('sdsIsBn()'), false);
  assert.equal(p.run('(function(){window.__sdSite={id:"arena"};ur.locale="bn";return sdsArenaLabel()})()'),
    'অ্যাডভান্স সেটিংস', 'the arena row uses the same builder');
});

// ── 2. the arena branch ─────────────────────────────────────────────────────

test('on arena the row is injected after the menu’s own settings item', () => {
  const p = page();
  const { menu, items } = arenaMenu();
  p.body.appendChild(menu);

  p.run('WQ(document.body.querySelector(\'[role="menu"]\'))');

  const rows = advanced(menu);
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.ok(row.classList.contains('bds-arena-menu-option'), 'marked for the arena CSS');
  assert.equal(row.getAttribute('role'), 'menuitem', 'a real item of a role-based menu');
  assert.equal(menu.childNodes.indexOf(row), menu.childNodes.indexOf(items[1]) + 1);
  assert.ok(row.innerHTML.includes(ICON));
  assert.match(row.innerHTML, /Advanced Settings/);

  row.dispatch('click', { stopPropagation() {}, preventDefault() {} });
  assert.deepEqual(p.winEvents.map((e) => e.type), ['bds:open-drawer'],
    'the same event opens the same, untouched drawer');
  assert.ok(p.docEvents.some((e) => e.type === 'keydown' && e.key === 'Escape'),
    'a React menu is dismissed with the key it listens for, not only a body click');
});

test('the arena row is added once per menu, whatever calls it again', () => {
  const p = page();
  const { menu } = arenaMenu();
  p.body.appendChild(menu);
  p.run('sdsArenaMenus();sdsArenaMenus();WQ(document.body.querySelector(\'[role="menu"]\'))');
  assert.equal(advanced(menu).length, 1);
});

test('a menu with no settings item is left alone — the rail carries the entry', () => {
  const p = page();
  const { menu } = arenaMenu(['Profile', 'Help', 'Log out']);
  p.body.appendChild(menu);
  p.run('sdsArenaMenus()');
  assert.equal(advanced(menu).length, 0);
  assert.equal(menu.childNodes.length, 3, 'nothing at all was added to the site’s menu');
});

test('arena items are found by role, then by control, then by position', () => {
  const p = page();
  assert.equal(p.run('sdsArenaItems(null).length'), 0);
  assert.equal(p.run('sdsArenaItems({}).length'), 0);

  const byRole = makeEl('div'); byRole.setAttribute('role', 'menu');
  const r1 = makeEl('div'); r1.setAttribute('role', 'menuitem'); byRole.appendChild(r1);
  p.body.appendChild(byRole);
  assert.equal(p.run('sdsArenaItems(document.body.querySelector(\'[role="menu"]\')).length'), 1);

  const byButton = makeEl('div'); byButton.setAttribute('role', 'menu');
  const b1 = makeEl('button'); const b2 = makeEl('button');
  byButton.appendChild(b1); byButton.appendChild(b2);
  p.body.appendChild(byButton);
  assert.equal(p.run('sdsArenaItems(document.querySelectorAll(\'[role="menu"]\')[1]).length'), 2);

  const bare = makeEl('div'); bare.setAttribute('role', 'menu');
  bare.appendChild(makeEl('div')); bare.appendChild(makeEl('div'));
  p.body.appendChild(bare);
  assert.equal(p.run('sdsArenaItems(document.querySelectorAll(\'[role="menu"]\')[2]).length'), 2);
});

test('the settings match follows the site’s own languages', () => {
  const p = page();
  const hit = (t) => p.run(`sdsIsSettingsText(${JSON.stringify(t)})`);
  for (const yes of ['Settings', 'Account settings', 'Preferences', 'সেটিংস', '设置', 'تنظیمات', 'Настройки', 'Ayarlar']) {
    assert.equal(hit(yes), true, `${yes} should find the site’s settings item`);
  }
  for (const no of ['Profile', 'Log out', 'Help', 'Impostazioni']) {
    assert.equal(hit(no), false, `${no} must not be mistaken for settings`);
  }
});

// ── 3. the permanent fallback ───────────────────────────────────────────────

test('arena gets an engine-owned rail inside the engine’s own root', () => {
  const p = page();
  p.run('sdsArenaInstall()');

  const rail = p.root.querySelector('#bds-settings-rail');
  assert.ok(rail, 'the rail lives in #bds-root, which every engine guard already treats as ours');
  assert.equal(rail.tagName, 'BUTTON');
  assert.equal(rail.getAttribute('aria-label'), 'Advanced Settings');
  assert.equal(rail.getAttribute('title'), 'Advanced Settings');
  const icon = rail.querySelector('.bds-arena-rail-icon');
  assert.ok(icon, 'the rail shows the icon');
  assert.ok(icon.innerHTML.includes(ICON), 'same icon as the menu row');

  rail.dispatch('click', { stopPropagation() {}, preventDefault() {} });
  assert.deepEqual(p.winEvents.map((e) => e.type), ['bds:open-drawer']);

  p.run('sdsArenaInstall()');
  assert.equal(p.root.querySelectorAll('#bds-settings-rail').length, 1, 'never duplicated');
});

test('the rail and its menu watcher exist only on arena', () => {
  const p = page({ siteId: 'deepseek' });
  p.run('sdsArenaInstall()');
  assert.equal(p.root.querySelectorAll('#bds-settings-rail').length, 0, 'nothing new on DeepSeek');
  assert.deepEqual(Object.keys(p.state.docListeners), [], 'not even a listener is registered');
  assert.equal(p.state.observers.length, 0, 'no observer either');

  const unknown = page({ siteId: null });
  unknown.run('sdsArenaInstall()');
  assert.equal(unknown.root.querySelectorAll('#bds-settings-rail').length, 0,
    'a build without sd-site.js behaves exactly as before');
});

test('the watcher picks a menu up however it appears', () => {
  const p = page();
  p.run('sdsArenaInstall()');

  // 1. arriving after a tap (the menu is rendered on demand)
  const { menu } = arenaMenu();
  p.body.appendChild(menu);
  p.state.docListeners.click.forEach((f) => f({}));
  assert.equal(advanced(menu).length, 1, 'a click pass finds the menu');

  // 2. arriving as a mutation (React re-render, or the menu opening right after tap)
  const { menu: second } = arenaMenu();
  const holder = makeEl('div');
  p.body.appendChild(holder);
  holder.appendChild(second);
  assert.equal(p.state.observers.length, 1);
  assert.equal(p.state.observers[0].observed.opts.childList, true);
  assert.equal(p.state.observers[0].observed.opts.subtree, true);
  p.state.observers[0].fire([{ addedNodes: [holder] }]);
  assert.equal(advanced(second).length, 1, 'a mutation pass finds a nested menu too');

  // 3. and it survives one install, however often boot runs
  p.run('sdsArenaInstall()');
  assert.equal(p.state.observers.length, 1, 'a single watcher, not one per boot');
});

// ── 4. the styles, and what must not change ─────────────────────────────────

test('the arena styles are engine-owned and cannot touch DeepSeek', () => {
  assert.ok(CSS.includes('.bds-arena-menu-option{'), 'the row brings its own styling');
  assert.ok(CSS.includes('#bds-settings-rail{'), 'and so does the rail');
  assert.match(CSS, /#bds-settings-rail\{[^}]*position:static/);
  assert.match(CSS, /\.bds-arena-menu-option\{[^}]*color:var\(--text-primary/, 'arena’s own theme variables win');

  // The engine’s back-gesture code treats any fixed bds-* node matching this
  // pattern as an overlay under the finger. The rail must not match it.
  const rootRe = new RegExp(String(/ROOT_RE = \/(.*)\/;/.exec(CONTENT)[1]));
  assert.equal(rootRe.test('bds-arena-rail'), false, 'the rail must not look like an overlay to sd-sheets');
  assert.equal(rootRe.test('bds-attach-backdrop'), true, 'sanity: the pattern still recognises real overlays');
});

test('the seam is still exactly where it was', () => {
  assert.equal(times('function sdsArenaMenu('), 1);
  assert.equal(times('function sdsArenaInstall('), 1);
  assert.equal(times('function sdsIsArena('), 1);
  assert.equal(times('sdsArenaInstall(),gge()'), 1, 'installed at boot, next to DeepSeek’s installer');
  assert.equal(times('function WQ(e){var a;if(sdsIsArena()){sdsArenaMenu(e);return}'), 1);
  assert.equal(times('document.querySelectorAll(".ds-dropdown-menu").forEach'), 2,
    'DeepSeek’s own installer scans are untouched (click pass + observer fallback)');
  assert.equal(times('function Y2t('), 1, 'and the installer itself is unmodified');
  assert.equal(times('bds-arena-menu-option'), 1, 'only the arena row carries the arena class');
});
