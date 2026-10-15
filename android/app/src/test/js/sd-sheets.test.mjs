import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../../main/bds-assets/bds/sd-sheets.js', import.meta.url), 'utf8');

function boot({ reduced = false, subpage = false } = {}) {
  let closeClicks = 0;
  let innerCalls = 0;
  const classes = new Set(subpage ? ['bds-open'] : []);
  const button = { isConnected: true, getClientRects: () => [{}], click: () => { closeClicks++; } };
  const backdrop = { style: {}, matches: (s) => s === '.bds-attach-backdrop' };
  const sheet = {
    isConnected: true, style: {}, previousElementSibling: backdrop,
    classList: { contains: (c) => classes.has(c), add: (c) => classes.add(c), remove: (c) => classes.delete(c) },
    getClientRects: () => [{}], getBoundingClientRect: () => ({ height: 300 }),
    querySelector: (s) => s === '.bds-sheet-close' || (subpage && s.includes('bds-back-btn')) ? button : null,
  };
  const document = {
    body: {}, documentElement: {}, head: { appendChild() {} },
    getElementById: (id) => subpage && id === 'bds-drawer' ? sheet : null,
    querySelector: () => null,
    querySelectorAll: (s) => s === (subpage ? '#bds-drawer.bds-open' : '.bds-attach-dropdown') ? [sheet] : [],
    createElement: () => ({}), addEventListener() {},
  };
  const window = { innerWidth: 412, matchMedia: () => ({ matches: reduced }),
    __sdHandleBack: () => { innerCalls++; return false; } };
  vm.runInNewContext(source, {
    window, document, console, WeakSet, Node: { DOCUMENT_POSITION_FOLLOWING: 4 },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible', zIndex: '10' }),
    requestAnimationFrame: (fn) => fn(), setTimeout: (fn) => fn(),
    setInterval: () => 1, clearInterval() {},
    MutationObserver: class { observe() {} },
  });
  return { window, sheet, closes: () => closeClicks, inners: () => innerCalls };
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
