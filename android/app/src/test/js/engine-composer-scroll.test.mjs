// Phase 3 part 2: writing into a React-controlled composer, and scroll maths on
// a reversed message list.
//
// arena.ai's composer is `textarea[name="message"]` under React's control, and
// its message list is `ol.flex-col-reverse`. Both break assumptions the bundle
// was written with:
//
//  1. React drops an `input` event whose value its tracker has already seen, so
//     a bare `el.value = text` updates the DOM but not the framework state —
//     the send button stays disabled and nothing is sent. `sdsSetNativeValue`
//     writes through the prototype setter and clears the tracker first.
//  2. In a reversed column Chrome reports scrollTop <= 0 (0 == newest) and
//     "content below the element" is measured from the container's bottom edge,
//     so the old `scrollHeight - (offset + scrollTop)` formula reads the newest
//     message as "far from the end" — which silently disables auto-scroll and
//     the agent's run-once gate.
//
// Both functions are lifted OUT OF THE SHIPPED BUNDLE and run here against a
// fake DOM, so the tests assert real behaviour, not just that a string exists.
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

// ── 1. the React-safe writer ────────────────────────────────────────────────

function runWriter(body) {
  const ctx = vm.createContext({
    HTMLTextAreaElement: function HTMLTextAreaElement() {},
    HTMLInputElement: function HTMLInputElement() {},
  });
  return JSON.parse(vm.runInContext(`${fnSource('sdsSetNativeValue')}\n${body}`, ctx));
}

test('the composer writer goes through the prototype setter and clears React’s tracker', () => {
  const out = runWriter(`
    var written = [], tracker = [];
    Object.defineProperty(HTMLTextAreaElement.prototype, 'value', {
      configurable: true,
      get: function () { return ''; },
      set: function (v) { written.push(v); },
    });
    var el = { tagName: 'TEXTAREA', _valueTracker: { setValue: function (v) { tracker.push(v); } } };
    var ok = sdsSetNativeValue(el, 'হ্যালো arena');
    JSON.stringify({
      ok: ok, written: written, tracker: tracker,
      ownProp: Object.prototype.hasOwnProperty.call(el, 'value'),
    });
  `);
  assert.equal(out.ok, true);
  assert.deepEqual(out.written, ['হ্যালো arena'], 'the prototype setter must do the write');
  assert.deepEqual(out.tracker, [''], 'React’s value tracker must be cleared first, or the input event is dropped');
  assert.equal(out.ownProp, false, 'a bare el.value = … would leave an own property behind');
});

test('the composer writer handles inputs, contenteditable and junk', () => {
  const out = runWriter(`
    var written = [];
    Object.defineProperty(HTMLInputElement.prototype, 'value', {
      configurable: true, get: function () { return ''; }, set: function (v) { written.push(v); },
    });
    var input = { tagName: 'INPUT' };
    var editable = { tagName: 'DIV', isContentEditable: true, hasAttribute: function () { return false; } };
    var div = { tagName: 'DIV', hasAttribute: function () { return false; } };
    JSON.stringify({
      input: sdsSetNativeValue(input, 'x'), written: written,
      editable: sdsSetNativeValue(editable, 'y'), editableText: editable.textContent,
      junk: sdsSetNativeValue(div, 'z'), nul: sdsSetNativeValue(null, 'q'),
      numberBecomesString: (sdsSetNativeValue({ tagName: 'TEXTAREA' }, 42), true),
    });
  `);
  assert.equal(out.input, true);
  assert.deepEqual(out.written, ['x']);
  assert.equal(out.editable, true);
  assert.equal(out.editableText, 'y');
  assert.equal(out.junk, false, 'a plain div is not a composer');
  assert.equal(out.nul, false);
  assert.equal(out.numberBecomesString, true);
});

// ── 2. scroll maths, normal and reversed ────────────────────────────────────

/**
 * Runs the bundle's own `sdAtEnd` against a fake scroller.
 * [scroller] and [message] are the numbers a real layout would report.
 */
function atEnd({ flexDirection, scrollHeight, clientHeight, scrollTop, msgBottom, containerTop = 0, containerBottom = 0 }) {
  const ctx = vm.createContext({
    getComputedStyle: () => ({ overflowY: 'auto', flexDirection }),
    document: {},
  });
  ctx.document.body = { id: 'body' };
  ctx.document.documentElement = { id: 'html' };
  const script = `
    ${fnSource('sdAtEnd')}
    var s = {
      id: 'scroller', parentElement: document.body,
      scrollHeight: ${scrollHeight}, clientHeight: ${clientHeight}, scrollTop: ${scrollTop},
      getBoundingClientRect: function () { return { top: ${containerTop}, bottom: ${containerBottom} }; },
    };
    var e = {
      parentElement: s,
      getBoundingClientRect: function () { return { top: ${msgBottom - 90}, bottom: ${msgBottom} }; },
    };
    JSON.stringify(sdAtEnd(e));
  `;
  return JSON.parse(vm.runInContext(script, ctx));
}

test('a normal (DeepSeek) list still reports the end the way it always did', () => {
  // Newest message on screen, scrolled to the bottom.
  assert.equal(atEnd({
    flexDirection: 'column', scrollHeight: 5000, clientHeight: 800,
    scrollTop: 4200, msgBottom: 790, containerBottom: 800,
  }), true);
  // An older message, far above the content end.
  assert.equal(atEnd({
    flexDirection: 'column', scrollHeight: 5000, clientHeight: 800,
    scrollTop: 0, msgBottom: 1000, containerBottom: 800,
  }), false);
});

test('a reversed (arena) list reports the end at scrollTop 0', () => {
  const newest = {
    flexDirection: 'column-reverse', scrollHeight: 5000, clientHeight: 800,
    scrollTop: 0, msgBottom: 790, containerBottom: 800,
  };
  assert.equal(atEnd(newest), true, 'newest message on screen must count as "at the end"');

  // …and prove the pre-patch formula got it wrong, so this stays a regression test.
  const oldBelow = newest.scrollHeight - (newest.msgBottom - 0 + newest.scrollTop);
  assert.equal(oldBelow < Math.max(1600, 1.6 * newest.clientHeight), false,
    'the old scrollHeight-based formula read a reversed list as scrolled away');

  // Scrolled up 2000px: Chrome reports a negative scrollTop and the newest
  // message sits that far below the viewport. It is still the content end.
  assert.equal(atEnd({
    flexDirection: 'column-reverse', scrollHeight: 5000, clientHeight: 800,
    scrollTop: -2000, msgBottom: 2800, containerBottom: 800,
  }), true);

  // An old message near the top of the history: far from the end.
  assert.equal(atEnd({
    flexDirection: 'column-reverse', scrollHeight: 5000, clientHeight: 800,
    scrollTop: -4200, msgBottom: 100, containerBottom: 800,
  }), false);
});

// ── 3. the seams themselves ─────────────────────────────────────────────────

test('the bundle writes the composer through the safe writer, not a bare .value=', () => {
  assert.equal(times('function sdsSetNativeValue('), 1, 'exactly one definition');
  assert.equal(times('sdsSetNativeValue(i,t)'), 1, 'the memory-import write uses it');
  assert.equal(times('i.tagName==="TEXTAREA"?(i.value=t'), 0, 'no bare composer write left on that path');
  assert.ok(fnSource('sdsSetNativeValue').includes('_valueTracker'), 'tracker reset must stay in the writer');
});

test('the reversed-column branch exists exactly once and only affects reversed lists', () => {
  assert.equal(times('getComputedStyle(s).flexDirection==="column-reverse"'), 1);
  const src = fnSource('sdAtEnd');
  assert.match(src, /below=rev\?q\.bottom-r\.bottom-s\.scrollTop:s\.scrollHeight-\(r\.bottom-q\.top\+s\.scrollTop\)/,
    'the non-reversed formula must be byte-identical to the one that shipped');
});

test('the conversation gate follows the site and keeps its DeepSeek fallback', () => {
  assert.equal(times('location.href.includes((window.__sdUrl&&window.__sdUrl.session)||"/chat/s/")'), 2);
  assert.equal(times('__sdUrl'), 19, 'content.js seam count changed — re-audit the patched sites');
});
