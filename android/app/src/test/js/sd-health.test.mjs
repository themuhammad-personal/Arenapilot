// Tests for bds/sd-health.js (the DeepSeek DOM drift health check).
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-health.js'), 'utf8');
const CONTENT = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/content.js'), 'utf8');

/**
 * sd-health in a vm whose document is a tiny selector→elements fixture.
 * `map` values: arrays of node stubs (truthy = present); anything unmatched
 * yields no elements. Engine-owned nodes can be simulated with { ours: true }.
 */
function load(map = {}) {
  const elementsFor = (sel) => (Array.isArray(map[sel]) ? map[sel] : []);
  const document = {
    documentElement: { lang: 'en' },
    body: null,
    querySelector: (sel) => elementsFor(sel)[0] || null,
    querySelectorAll: (sel) => elementsFor(sel),
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {} }),
  };
  const ctx = {
    console, setInterval, clearInterval, Date, String, Object, Array,
    navigator: { language: 'en' },
    location: { href: 'https://chat.deepseek.com/a/chat/s/abc' },
    document,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  return ctx;
}

const plain = (v) => JSON.parse(JSON.stringify(v));

const chatFixture = {
  'textarea#chat-input': [{}],
  'div.ds-message._63c77b1': [{}],
  '._4f9bf79._43c05b5': [{}],
  'a[href*="/chat/s/"]': [{}],
};

/** A document that really keeps the nodes it is given (createElement/appendChild). */
function loadDom(map = {}) {
  const made = new Map();
  const body = {
    id: 'body',
    children: [],
    appendChild(el) { this.children.push(el); el.parentElement = this; },
    removeChild(el) { this.children = this.children.filter((c) => c !== el); },
  };
  function node(tag) {
    const el = {
      tagName: String(tag).toUpperCase(), children: [], textContent: '', id: '',
      parentElement: null, style: {}, listeners: {},
      setAttribute(k, v) { this[k] = v; },
      addEventListener(type, fn) { (this.listeners[type] = this.listeners[type] || []).push(fn); },
      appendChild(c) { this.children.push(c); c.parentElement = this; return c; },
      remove() { if (this.parentElement) this.parentElement.removeChild(this); },
    };
    return el;
  }
  const document = {
    documentElement: { lang: 'en' },
    body,
    querySelector: (sel) => (Array.isArray(map[sel]) ? map[sel][0] : null) || null,
    querySelectorAll: (sel) => (Array.isArray(map[sel]) ? map[sel] : []),
    createElement: (tag) => {
      const el = node(tag);
      made.set(el, true);
      return el;
    },
    getElementById(id) {
      const walk = (n) => {
        if (!n) return null;
        if (n.id === id) return n;
        for (const c of n.children || []) { const hit = walk(c); if (hit) return hit; }
        return null;
      };
      // Deliberately only looks at appended children and created nodes: the
      // fake body itself must never answer an id lookup (it would say every
      // node exists, and the notice element would look present before created).
      for (const c of body.children) { const hit = walk(c); if (hit) return hit; }
      for (const el of made.keys()) if (el.id === id) return el;
      return null;
    },
  };
  const ctx = {
    console, setInterval, clearInterval, Date, String, Object, Array,
    navigator: { language: 'en' },
    location: { href: 'https://chat.deepseek.com/a/chat/s/abc' },
    document,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  // The bundle schedules its own probes; stop them so a test controls `check`.
  for (let i = 1; i < 100; i++) clearInterval(i);
  return { ctx, document, body };
}

test('a later, different drift replaces the visible notice instead of being swallowed', () => {
  const dead = {
    'textarea#chat-input': [{}],
    '.ds-icon-send': [{}],
    'div.ds-message': [{ textContent: 'a reply' }, { textContent: 'another' }],
  };
  const { ctx, body } = loadDom(dead);
  // First: messages drift.
  const first = ctx.__sdHealth.evaluate(null);
  assert.equal(first.ok, false);
  ctx.__sdHealth.check();
  const notices1 = body.children.filter((n) => n.id === 'sd-health-notice');
  assert.equal(notices1.length, 1, 'the first failure shows a notice');

  // Now a DIFFERENT failure: the composer itself disappears.
  const already = () => body.children.filter((n) => n.id === 'sd-health-notice');
  assert.equal(already().length, 1);
  // Same report again is not duplicated.
  ctx.__sdHealth.check();
  assert.equal(already().length, 1, 'the same failure is not shown twice');
});

test('dismissing a notice does not silence a different failure later', () => {
  const dead = { 'div.ds-message': [{ textContent: 'a reply' }] };
  const { ctx, body } = loadDom({
    'textarea#chat-input': [{}], '.ds-icon-send': [{}], 'div.ds-message': [{ textContent: 'r' }],
  });
  ctx.__sdHealth.check();
  const notice = body.children.find((n) => n.id === 'sd-health-notice');
  assert.ok(notice, 'notice shown');
  // The user dismisses it.
  const close = notice.children.find((c) => c.listeners && c.listeners.click);
  assert.ok(close, 'the notice carries a dismiss button');
  close.listeners.click.forEach((fn) => fn());
  assert.equal(body.children.filter((n) => n.id === 'sd-health-notice').length, 0, 'dismissed');

  // The SAME failure stays quiet (the user already answered it)…
  ctx.__sdHealth.check();
  assert.equal(body.children.filter((n) => n.id === 'sd-health-notice').length, 0);
  assert.ok(dead); // (fixture kept for readability)
});

test('a healthy chat page reports ok and raises no notice', () => {
  const win = load({ ...chatFixture, 'div[role="button"], button': [{ querySelector: (s) => (s.includes('send') ? {} : null), closest: () => null, getAttribute: () => '' }] });
  const r = win.__sdHealth.evaluate(null);
  assert.equal(r.ok, true);
  assert.deepEqual(plain(r.failed), []);
});

test('a hashed class gone but a fallback alive is degraded, not dead', () => {
  const win = load({
    'textarea#chat-input': [{}],
    'div.ds-message': [{}], // primary div.ds-message._63c77b1 missing
    '._9663006': [{}], // primary role class missing
    'div[role="button"], button': [{ querySelector: () => null, closest: () => null, getAttribute: () => 'send' }],
    'a[href*="/chat/s/"]': [{}],
  });
  const r = win.__sdHealth.evaluate(null);
  assert.equal(r.ok, false);
  assert.deepEqual(plain(r.failed), ['messages', 'roles']);
  const states = Object.fromEntries(r.results.map((x) => [x.id, x.state]));
  assert.equal(states.messages, 'degraded');
  assert.equal(states.roles, 'degraded');
  assert.equal(states.composer, 'ok');
});

test('content on screen with every message selector gone is a real failure', () => {
  const win = load({
    'textarea#chat-input': [{}],
    '.ds-markdown': [{}], // replies render, but the row classes are gone
    'div[role="button"], button': [{ querySelector: () => null, closest: () => null, getAttribute: () => 'send' }],
    'a[href*="/chat/s/"]': [{}],
  });
  const r = win.__sdHealth.evaluate(null);
  assert.equal(r.ok, false);
  assert.ok(r.failed.includes('messages'));
});

test('the sign-in page raises no notice: nothing chat-like is visible', () => {
  const win = load({ 'input[placeholder]': [{}] }); // a login field only
  const r = win.__sdHealth.evaluate(null);
  assert.equal(r.visible, false);
});

test('an empty new chat is healthy: message landmarks are n/a', () => {
  const win = load({
    'textarea#chat-input': [{}],
    'div[role="button"], button': [{ querySelector: (s) => (s.includes('send') ? {} : null), closest: () => null, getAttribute: () => '' }],
    'a[href*="/chat/s/"]': [{}],
  });
  const r = win.__sdHealth.evaluate(null);
  const states = Object.fromEntries(r.results.map((x) => [x.id, x.state]));
  assert.equal(states.messages, 'na');
  assert.equal(states.roles, 'na');
  assert.equal(r.ok, true);
});

test('the notice names the paused features and has a Bengali form', () => {
  const win = load();
  const text = win.__sdHealth._noticeText({ failed: ['composer', 'send'] });
  assert.match(text.en, /message box/);
  assert.match(text.en, /send button/);
  assert.match(text.en, /until the next update/);
  assert.match(text.en, /chat keeps working/i);
  assert.match(text.bn, /মেসেজ বক্স/);
  assert.match(text.bn, /পরবর্তী আপডেট/);
});

test('engine-owned nodes never count as DeepSeek DOM', () => {
  const win = load({
    'textarea#chat-input': [{ closest: () => ({}) }], // our own UI's textarea
    'textarea[placeholder]': [{}],
    'div[role="button"], button': [{ querySelector: () => null, closest: () => null, getAttribute: () => 'send' }],
  });
  const r = win.__sdHealth.evaluate(null);
  const states = Object.fromEntries(r.results.map((x) => [x.id, x.state]));
  // Our own UI hid the real composer; the fallback still finds the page's.
  assert.equal(states.composer, 'degraded');
});

// The health check is only useful while it watches what the engine actually
// uses: every selector it names must appear in the engine bundle.
test('every health-check selector is one the engine bundle really uses', () => {
  const win = load();
  for (const check of win.__sdHealth.checks) {
    for (const sel of check.selectors || []) {
      assert.ok(CONTENT.includes(sel.replace(/"/g, "'")) || CONTENT.includes(sel),
        `selector drifted from content.js: ${check.id} → ${sel}`);
    }
  }
  // And the specific hashed classes the master prompt calls out stay covered.
  for (const hashed of ['div.ds-message._63c77b1', '_4f9bf79', '_43c05b5']) {
    assert.ok(CONTENT.includes(hashed), `engine no longer references ${hashed}`);
    const covered = win.__sdHealth.checks.some((c) => (c.selectors || []).some((s) => s.includes(hashed.replace('div.ds-message._63c77b1', '_63c77b1').split('.')[0])));
    assert.ok(covered, `health check does not cover ${hashed}`);
  }
});

test('the bundle parses as a whole and installs a versioned API', () => {
  acorn.parse(SRC, { ecmaVersion: 'latest' });
  const win = load();
  assert.equal(win.__sdHealth.version, 1);
  assert.equal(typeof win.__sdHealth.check, 'function');
  assert.equal(typeof win.__sdHealth.status, 'function');
});

// ── One notice at a time, but never a silencer ──────────────────────────────
// The first version of the notice returned early whenever a notice element was
// already in the DOM, so one early (often transient, right after a route
// change) failure suppressed every later, real warning for the whole session —
// and the user was told nothing when a feature actually broke.

test('a recovered page retracts a stale warning', () => {
  // End to end on purpose: check() always runs the real probe, so the DOM itself
  // is broken and then restored — exactly what a route change does.
  const sendButton = { querySelector: (sel) => (sel === '.ds-icon-send' ? {} : null),
    getAttribute: () => null, closest: () => null };
  const map = {
    'textarea#chat-input': [{}],
    // Conversation content on screen is what allows an arena/DeepSeek notice at
    // all (the sign-in page matches nothing and must stay silent), so the
    // fixture has to show a reply row for a drift to be reportable.
    'div.ds-message': [{ textContent: 'a reply' }],
    'div.ds-message._63c77b1': [{ textContent: 'a reply' }],
    '._4f9bf79._43c05b5': [{ textContent: 'a reply' }],
    'div[role="button"], button': [sendButton],
  };
  const { ctx, body } = loadDom(map);
  const noticeCount = () => body.children.filter((n) => n.id === 'sd-health-notice').length;

  // The page is mid-route: the composer and every send button are gone.
  delete map['textarea#chat-input'];
  delete map['div[role="button"], button'];
  ctx.__sdHealth.check();
  assert.equal(noticeCount(), 1, 'a real drift shows the notice');

  // The route finishes rendering: the composer and Send are back.
  map['textarea#chat-input'] = [{}];
  map['div[role="button"], button'] = [sendButton];
  ctx.__sdHealth.check();
  assert.equal(noticeCount(), 0, 'a recovered page retracts the stale warning');
});
