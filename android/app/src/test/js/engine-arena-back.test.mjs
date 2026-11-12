// Back navigation inside the engine's own overlays.
//
// The emulator gate caught this with a real tap: after opening Advanced settings
// from the Add to chat sheet's Settings card, pressing Back left the drawer on
// screen (`settings-drawer-back-failed`). The capture showed why — the drawer was
// open, `#bds-close` existed, and `__sdHandleBack` still returned without closing
// anything, because the overview's header has no `.bds-back-btn`:
//
//   closeDrawer(): back button → #bds-close → false
//   __sdHandleBack(): topRoot() found no *overlay*, the drawer fallback then
//                     asked for `.bds-back-btn` (absent on the list) and gave up.
//
// These tests boot content.js enough to run the real `__sdHandleBack` against a
// drawer that looks like the one in the capture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as acorn from 'acorn';

const SOURCE = fs.readFileSync(new URL('../../main/bds-assets/bds/content.js', import.meta.url), 'utf8');

/**
 * The back-navigation block of content.js: a small self-contained IIFE
 * (`var ROOT_RE … function shown … window.__sdHandleBack = …`). Running it whole
 * is the only honest way to test the handler — it closes over helpers that a
 * name-by-name harvest would have to guess, and the previous attempt to guess
 * silently ran the handler WITHOUT them (`topRoot is not defined` → `catch` →
 * `false`). The block is found by its own marker, so a moved block fails loudly.
 */
function backNavigationBlock() {
  const open = SOURCE.lastIndexOf('\n(function', SOURCE.search(/window\.__sdHandleBack\s*=\s*function\s*\(/));
  assert.ok(open > 0, 'engine moved: no IIFE around window.__sdHandleBack');
  const close = SOURCE.indexOf('})();', open);
  const block = SOURCE.slice(open, close + 5);
  // The block must be the unit that defines the handler, not a neighbour.
  assert.match(block, /window\.__sdHandleBack\s*=\s*function\s*\(\)/);
  assert.match(block, /function shown\(/);
  return block;
}

const BACK_BLOCK = backNavigationBlock();

/** A drawer whose header has no back button — the overview, exactly as captured. */
function drawer({ subpage = false } = {}) {
  const state = { closed: 0, subpageBack: 0, shown: true };
  const close = { tagName: 'BUTTON', id: 'bds-close', click: () => { state.closed++; state.shown = false; } };
  // A real control: shown() asks for isConnected + client rects as well as the
  // style, so a fixture without them is "invisible" and silently unhittable.
  const back = {
    tagName: 'BUTTON', className: 'bds-back-btn', isConnected: true,
    getClientRects: () => [{}],
    click: () => { state.subpageBack++; },
  };
  const header = {
    querySelector: (sel) => (subpage && sel.includes('bds-back-btn') ? back : null),
  };
  const root = {
    id: 'bds-drawer',
    className: 'bds-drawer',
    tagName: 'DIV',
    nodeType: 1,
    parentElement: null,
    header,
    querySelector: (sel) => {
      if (sel === '.bds-drawer-header') return header;
      if (sel === '.bds-drawer-header .bds-back-btn') return subpage ? back : null;
      if (sel === '.bds-drawer-header button') return close;
      if (sel === '.bds-back-btn') return subpage ? back : null;
      return null;
    },
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ top: 74, left: 0, width: 320, height: 542, bottom: 616, right: 320 }),
    getClientRects: () => [{ top: 74, left: 0, width: 320, height: 542 }],
    isConnected: true,
    click: () => { state.closed++; },
  };
  return { root, state, close, back };
}

function boot({ subpage = false, visible = true } = {}) {
  const d = drawer({ subpage });
  const nodes = new Map([['bds-drawer', d.root], ['bds-close', d.close]]);
  const document = {
    documentElement: { classList: { add() {}, remove() {}, contains: () => false } },
    body: { nodeType: 1, className: '', parentElement: null },
    // A closed drawer is gone from the document, not merely un-styled — the
    // handler's fallback asks getElementById, so this has to respect `visible`.
    getElementById: (id) => (visible ? nodes.get(id) || null : null),
    querySelector: (sel) => {
      if (sel === '.bds-drawer' || sel === '#bds-drawer') return visible ? d.root : null;
      if (sel.includes('bds-drawer-header')) return d.root.header;
      return null;
    },
    querySelectorAll: (sel) => (visible && sel.includes('bds-drawer') ? [d.root] : []),
    addEventListener() {},
    // topRoot() hit-tests the middle of the screen. Without this the handler
    // throws inside its own try/catch and reports "not handled" — which is
    // exactly the silent false-negative this file exists to prevent.
    elementFromPoint: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, addEventListener() {} }),
    head: { appendChild() {} },
  };
  const window = {
    innerWidth: 320,
    innerHeight: 640,
    addEventListener() {},
    matchMedia: () => ({ matches: false }),
    getComputedStyle: () => ({
      display: 'block', visibility: 'visible', position: 'fixed', opacity: '1',
      transform: 'none', zIndex: '10', pointerEvents: 'auto',
    }),
  };
  const ctx = vm.createContext({
    window, document, console,
    // In a browser these are globals (the handler reads them bare).
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    getComputedStyle: window.getComputedStyle,
    requestAnimationFrame: (fn) => fn(),
    setTimeout: (fn) => 0,
    clearTimeout() {},
    setInterval: () => 1,
    clearInterval() {},
    MutationObserver: class { observe() {} disconnect() {} },
    Element: class {},
    Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    localStorage: { getItem: () => null, setItem() {} },
  });
  ctx.window = ctx;
  vm.runInContext(BACK_BLOCK, ctx);
  assert.equal(typeof ctx.window.__sdHandleBack, 'function', 'the block must install the handler');
  return { ctx, d };
}

test('Back closes the settings drawer when its header has no back button', () => {
  const { ctx, d } = boot();
  const handled = ctx.window.__sdHandleBack();
  assert.equal(handled, true, 'Back must report that it consumed the press');
  assert.equal(d.state.closed, 1, 'Back must actually close the drawer (CI: settings-drawer-back-failed)');
});

test('Back inside a settings subpage returns to the list, and only then closes', () => {
  const { ctx, d } = boot({ subpage: true });
  assert.equal(ctx.window.__sdHandleBack(), true);
  assert.equal(d.state.subpageBack, 1, 'a subpage steps back to the list first');
  assert.equal(d.state.closed, 0, 'a subpage must not dismiss the whole drawer');
});

test('Back on a closed drawer is not consumed (the page keeps its own back)', () => {
  const { ctx } = boot({ visible: false });
  assert.equal(ctx.window.__sdHandleBack(), false);
});
