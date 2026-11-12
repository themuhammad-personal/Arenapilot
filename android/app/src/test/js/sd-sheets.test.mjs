import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../main/bds-assets/bds/sd-sheets.js', import.meta.url), 'utf8');

function boot({ reduced = false, subpage = false, drawer = false } = {}) {
  let closeClicks = 0;
  let innerCalls = 0;
  const classes = new Set(subpage || drawer ? ['bds-open'] : []);
  const button = { isConnected: true, getClientRects: () => [{}], click: () => { closeClicks++; } };
  const backdrop = { style: {}, matches: (s) => s === '.bds-attach-backdrop' };
  const sheet = {
    isConnected: true, style: {}, previousElementSibling: backdrop,
    classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    getClientRects: () => [{}], getBoundingClientRect: () => ({ height: 300 }),
    querySelector: (s) => s === '.bds-sheet-close' || s === '.bds-drawer-header button' ||
      (!drawer && subpage && s.includes('bds-back-btn')) ? button : null,
  };
  const document = {
    body: {}, documentElement: {}, head: { appendChild() {} },
    getElementById: (id) => (subpage || drawer) && id === 'bds-drawer' ? sheet : null,
    querySelector: () => null,
    querySelectorAll: (s) => s === (subpage || drawer ? '#bds-drawer.bds-open' : '.bds-attach-dropdown') ? [sheet] : [],
    createElement: () => ({}), addEventListener() {},
  };
  const dispatched = [];
  const window = { innerWidth: 412, matchMedia: () => ({ matches: reduced }),
    dispatchEvent: (e) => { dispatched.push(e.type); return true; },
    __sdHandleBack: () => { innerCalls++; return false; } };
  vm.runInNewContext(source, {
    window, document, console, WeakSet, Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    CustomEvent: class { constructor(type) { this.type = type; } },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', zIndex: '10' }),
    requestAnimationFrame: (fn) => fn(), setTimeout: (fn) => fn(),
    setInterval: () => 1, clearInterval() {},
    MutationObserver: class { observe() {} },
  });
  return { window, sheet, closes: () => closeClicks, inners: () => innerCalls, dispatched };
}

test('animated Back closes the captured control, not an offscreen hit-test', () => {
  const b = boot();
  assert.equal(b.window.__sdHandleBack(), true);
  assert.equal(b.closes(), 1, 'actually closes component state after sliding out');
  assert.equal(b.inners(), 0, 'the old handler cannot find an already-offscreen sheet');
  assert.equal(b.sheet.style.transform, '', 'inline animation is cleaned up');
});

test('Back on a settings subpage delegates without dismissing the whole sheet', () => {
  const b = boot({ subpage: true });
  b.window.__sdHandleBack();
  assert.equal(b.closes(), 0);
  assert.equal(b.inners(), 1);
});

test('reduced-motion Back keeps the unanimated legacy path', () => {
  const b = boot({ reduced: true });
  b.window.__sdHandleBack();
  assert.equal(b.closes(), 0);
  assert.equal(b.inners(), 1);
});

// ── The state CI captured ───────────────────────────────────────────────────
// After a Settings tap the drawer was in the document with class `bds-open`, no
// measurable box, and `drawer.visible=false`. Back then found "nothing open"
// (handled=false) and left the drawer in place; the next tap on "+" went to the
// sheet *behind* the drawer's ghost. These pin the two facts that mattered.

test('a drawer left open but unmeasurable is still closed by Back', () => {
  const closeClicks = [];
  const closeButton = { isConnected: true, getClientRects: () => [], click: () => closeClicks.push('close') };
  const backdrop = { style: {}, matches: (s) => s === '.bds-drawer-backdrop', click: () => closeClicks.push('backdrop') };
  const classes = new Set(['bds-open']);
  const drawer = {
    isConnected: true, style: {}, id: 'bds-drawer', previousElementSibling: backdrop,
    classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    // Present, but translated away: nothing to measure.
    getClientRects: () => [], getBoundingClientRect: () => ({ width: 0, height: 0, top: 0 }),
    querySelector: (s) => (s === '.bds-drawer-header button' ? closeButton : s.includes('bds-back-btn') ? null : null),
  };
  const document = {
    body: {}, documentElement: {}, head: { appendChild() {} },
    getElementById: (id) => (id === 'bds-drawer' ? drawer : id === 'bds-close' ? closeButton : null),
    querySelector: (s) => (s === '.bds-drawer-backdrop' ? backdrop : null),
    querySelectorAll: (s) => (s === '#bds-drawer.bds-open' ? [drawer] : []),
    createElement: () => ({}), addEventListener() {},
  };
  const window = { innerWidth: 412, matchMedia: () => ({ matches: false }), __sdHandleBack: () => false };
  vm.runInNewContext(source, {
    window, document, console, WeakSet, Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    CustomEvent: class { constructor(type) { this.type = type; } },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', zIndex: '10' }),
    requestAnimationFrame: (fn) => fn(), setTimeout: (fn) => fn(),
    setInterval: () => 1, clearInterval() {},
    MutationObserver: class { observe() {} },
  });
  assert.equal(window.__sdHandleBack(), true, 'Back must consume the press, not report "nothing open"');
  assert.deepEqual(closeClicks, ['close'], "the drawer's own close button closes it, not the backdrop");
});

test('closing the drawer dispatches the engine intent that owns its state', () => {
  // The emulator proved the click alone is not enough: the button was visible,
  // sized and connected, the click ran, and the drawer stayed open. The engine
  // closes the drawer's state on 'bds:close-drawer'; that is the contract now.
  const b = boot({ subpage: false, drawer: true });
  b.window.__sdHandleBack();
  assert.ok(b.dispatched.includes('bds:close-drawer'),
    'the intent must be dispatched; got ' + JSON.stringify(b.dispatched));
});
