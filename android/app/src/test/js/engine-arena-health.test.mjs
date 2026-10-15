// Phase 5 — the DOM health check on arena.ai.
//
// sd-health.js probes the page's critical DOM contracts and, when the chat is
// clearly in front of the user but one is gone, shows a plain-language notice.
// Its contracts were DeepSeek's alone (`#chat-input`, `div.ds-message`,
// `.ds-markdown`, `/chat/s/`), so on arena it would have reported — on EVERY
// chat page, and again after each dismissal — "DeepSeek updated their page, so
// the message box may be paused in Super DeepSeek": a false alarm with the
// wrong brand. (arena's composer only matched the generic `textarea[placeholder]`
// fallback = "degraded", and its `aria-label="Send message"` button made the page
// look like a visible chat.)
//
// These tests load the REAL sd-site.js and the REAL sd-health.js into one vm,
// the way the app injects them, and pin:
//   * arena's contracts are read from the engine's own profile, never DeepSeek's;
//   * what may and may not raise the notice on a MODELLED (not yet captured) DOM;
//   * the notice is branded for ArenaPilot;
//   * DeepSeek's contracts, ids and wording are byte-for-byte what they were.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bds = path.join(here, '../../main/bds-assets/bds');
const SITE = fs.readFileSync(path.join(bds, 'sd-site.js'), 'utf8');
const HEALTH = fs.readFileSync(path.join(bds, 'sd-health.js'), 'utf8');

const plain = (v) => JSON.parse(JSON.stringify(v));
const statesOf = (r) => Object.fromEntries(r.results.map((x) => [x.id, x.state]));

/**
 * sd-site.js then sd-health.js, in a vm at `href`. `map` is selector → nodes
 * (anything unmatched yields nothing). `beforeHealth(ctx)` runs between the two,
 * so a test can change the live profile the way a future sd-site.js might.
 */
function load({ href = 'https://arena.ai/c/abc', map = {}, withSite = true, beforeHealth } = {}) {
  const url = new URL(href);
  const shown = [];
  const elementsFor = (sel) => (Array.isArray(map[sel]) ? map[sel] : []);
  const document = {
    documentElement: { lang: 'en' },
    body: { appendChild: (n) => shown.push(n) },
    querySelector: (sel) => elementsFor(sel)[0] || null,
    querySelectorAll: (sel) => elementsFor(sel),
    getElementById: () => null,
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, appendChild() {}, remove() {} }),
  };
  const ctx = {
    console, Date, String, Object, Array,
    setInterval: () => ({ unref() {} }),
    clearInterval() {},
    navigator: { language: 'en' },
    location: { href, host: url.host, hostname: url.hostname },
    document,
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  if (withSite) vm.runInContext(SITE, ctx);
  if (beforeHealth) beforeHealth(ctx);
  vm.runInContext(HEALTH, ctx);
  return { win: ctx, health: ctx.__sdHealth, shown };
}

const sendButton = {
  querySelector: () => null,
  closest: () => null,
  getAttribute: (n) => (n === 'aria-label' ? 'Send message' : ''),
};
const SEND = { 'div[role="button"], button': [sendButton] };

/** A healthy arena conversation, as modelled from public evidence. */
const conversation = {
  'textarea[name="message"]': [{}],
  'main ol.flex-col-reverse': [{}],
  '.prose': [{}],
  'a[href*="/c/"]': [{}],
  ...SEND,
};

// ── 1. the contracts ────────────────────────────────────────────────────────

test('on arena the contracts are arena’s own, read from the engine’s profile', () => {
  const { health } = load({ map: conversation });
  assert.equal(health.site, 'arena');
  const checks = plain(health.checks);
  assert.deepEqual(checks.map((c) => c.id), ['composer', 'messages', 'roles', 'send', 'sidebar']);
  assert.equal(checks[0].selectors[0], 'textarea[name="message"]', 'the composer contract is the profile’s primary selector');
  assert.deepEqual(checks[1].selectors, ['main ol.flex-col-reverse', 'ol.flex-col-reverse', 'ol.mt-8.flex', 'ol.mt-8']);
  assert.deepEqual(checks[2].selectors, ['.prose', '.justify-end', '.group', '.self-end']);
  assert.deepEqual(checks[4].selectors, ['a[href*="/c/"]']);
  assert.ok(!/ds-|chat-input|\/chat\/s\/|_63c77b1|_4f9bf79|_9663006/.test(JSON.stringify(checks)),
    'a DeepSeek-only selector must never be consulted on arena');
});

test('the contracts follow the profile — one source of truth', () => {
  const { health, win } = load({
    map: { 'textarea#custom': [{}] },
    beforeHealth: (ctx) => { ctx.__sdSite.profile.selectors.chatInput.textarea = ['textarea#custom']; },
  });
  assert.equal(plain(health.checks[0].selectors)[0], 'textarea#custom');
  const r = health.evaluate(null);
  assert.equal(statesOf(r).composer, 'ok', 'the profile’s primary selector is the strict one');
  assert.equal(r.visible, true, 'and it is the one that proves the real chat is on screen');
  assert.equal(win.__sdHealth.site, 'arena');
});

// ── 2. what raises the notice ───────────────────────────────────────────────

test('a healthy arena conversation reports ok', () => {
  const { health, shown } = load({ map: conversation });
  const r = health.check();
  assert.equal(r.ok, true);
  assert.deepEqual(plain(r.failed), []);
  assert.deepEqual(statesOf(r), { composer: 'ok', messages: 'ok', roles: 'ok', send: 'ok', sidebar: 'ok' });
  assert.equal(shown.length, 0, 'no notice');
});

test('a new Direct Chat page is healthy: the message landmarks are n/a', () => {
  const { health, shown } = load({
    href: 'https://arena.ai/text/direct?model_a=gpt-5',
    map: { 'textarea[name="message"]': [{}], ...SEND },
  });
  const r = health.check();
  const states = statesOf(r);
  assert.equal(states.messages, 'na');
  assert.equal(states.roles, 'na');
  assert.equal(r.ok, true);
  assert.equal(r.visible, true, 'the strong composer proves the chat is in front of the user');
  assert.equal(shown.length, 0);
});

test('the pre-fix false alarm: arena’s box matched only a generic fallback and a send button showed', () => {
  // Reproduces what the DeepSeek-only contracts saw on arena: composer only via
  // `textarea[placeholder]`, a "Send message" button, no `ds-` anything.
  const map = { 'textarea[placeholder]': [{}], ...SEND };
  const arena = load({ map });
  assert.equal(statesOf(arena.health.evaluate(null)).composer, 'degraded');
  assert.equal(arena.health.evaluate(null).visible, false,
    'a send button alone must not pass for “the chat is visible” on arena');
  arena.health.check();
  assert.equal(arena.shown.length, 0, 'so no notice');

  // …whereas the DeepSeek contracts DO treat that same page as a visible chat.
  const ds = load({ href: 'https://chat.deepseek.com/', map });
  assert.equal(ds.health.evaluate(null).visible, true, 'DeepSeek behaviour is unchanged');
});

test('the sign-in page raises no notice, even with a button that says “Send …”', () => {
  const { health, shown } = load({
    href: 'https://arena.ai/login',
    map: {
      'input[placeholder]': [{}],
      'div[role="button"], button': [{ querySelector: () => null, closest: () => null, getAttribute: (n) => (n === 'aria-label' ? 'Send magic link' : '') }],
    },
  });
  const r = health.check();
  assert.equal(r.visible, false);
  assert.equal(shown.length, 0);
});

test('other arena pages are not mistaken for a chat whose messages went missing', () => {
  // The leaderboard also uses `.prose`; it is not a conversation URL.
  const { health, shown } = load({ href: 'https://arena.ai/leaderboard', map: { '.prose': [{}] } });
  const r = health.check();
  assert.equal(statesOf(r).messages, 'na', 'no conversation URL: the message landmarks do not apply');
  // (the page has no composer, so `ok` is false — as on DeepSeek's sign-in page —
  // but nothing chat-like is in front of the user, so the notice stays quiet)
  assert.equal(r.visible, false);
  assert.equal(shown.length, 0);
});

test('real drift on a conversation IS reported, and the notice is branded for ArenaPilot', () => {
  // message content on screen, but the list structure the engine reads is gone
  const { health, shown } = load({
    map: { 'textarea[name="message"]': [{}], '.prose': [{}], ...SEND },
  });
  const r = health.check();
  assert.equal(r.ok, false);
  assert.deepEqual(plain(r.failed), ['messages']);
  assert.equal(shown.length, 1, 'one notice');
  const text = health.lastNotice();
  assert.match(text, /arena\.ai may have changed its page/);
  assert.match(text, /chat messages may be paused in ArenaPilot until the next update/);
  assert.match(text, /Your chat keeps working/);
  assert.ok(!/DeepSeek/.test(text), 'never the wrong brand');
});

test('the message box drifting on a visible conversation is reported too', () => {
  const { health, shown } = load({
    map: { 'main ol.flex-col-reverse': [{}], 'input[placeholder]': [{}], ...SEND },
  });
  const r = health.check();
  assert.deepEqual(plain(r.failed), ['composer']);
  assert.equal(statesOf(r).composer, 'degraded');
  assert.equal(shown.length, 1);
  assert.match(health.lastNotice(), /the message box may be paused in ArenaPilot/);
});

test('send, roles and the chat list are advisory on arena: they never raise the notice', () => {
  // composer + rows are fine; there is no assistant row yet, no send button
  // while the box is empty, and no sidebar link.
  const { health, shown } = load({
    map: { 'textarea[name="message"]': [{}], 'main ol.flex-col-reverse': [{}] },
  });
  const r = health.check();
  const states = statesOf(r);
  assert.equal(states.roles, 'missing');
  assert.equal(states.send, 'missing');
  assert.equal(states.sidebar, 'missing');
  assert.equal(r.ok, true, 'advisory contracts report but do not fail the page');
  assert.deepEqual(plain(r.failed), []);
  assert.equal(shown.length, 0);
});

// ── 3. wording ──────────────────────────────────────────────────────────────

test('the ArenaPilot notice has a Bengali form that names the app and the site', () => {
  const { health } = load({ map: conversation });
  const text = health._noticeText({ failed: ['composer', 'send'] });
  assert.match(text.en, /the message box, the send button may be paused in ArenaPilot/);
  assert.match(text.bn, /arena\.ai/);
  assert.match(text.bn, /ArenaPilot/);
  assert.match(text.bn, /মেসেজ বক্স/);
  assert.match(text.bn, /পরবর্তী আপডেট/);
  assert.match(text.bn, /আপনার চ্যাট চলতেই থাকবে/);
  assert.ok(!/DeepSeek|ডিপসিক/.test(text.en + text.bn));
});

// ── 4. DeepSeek is unchanged ────────────────────────────────────────────────

test('DeepSeek keeps its contracts, ids and wording exactly', () => {
  const { health } = load({ href: 'https://chat.deepseek.com/a/chat/s/abc' });
  assert.equal(health.site, 'deepseek');
  const checks = plain(health.checks);
  assert.deepEqual(checks.map((c) => c.id), ['composer', 'messages', 'roles', 'send', 'sidebar']);
  assert.deepEqual(checks[0].selectors.slice(0, 3), ['textarea#chat-input', '.ds-textarea textarea', '[role="textbox"][contenteditable]']);
  assert.deepEqual(checks[1].selectors, ['div.ds-message._63c77b1', 'div.ds-message']);
  assert.deepEqual(checks[2].selectors, ['._4f9bf79._43c05b5', '._9663006', '.ds-markdown']);
  assert.deepEqual(checks[4].selectors, ['a[href*="/chat/s/"]']);
  assert.equal(checks[4].advisory, true);
  assert.ok(!checks.slice(0, 4).some((c) => c.advisory), 'on DeepSeek only the sidebar is advisory');

  const text = health._noticeText({ failed: ['composer'] });
  assert.equal(text.en,
    'DeepSeek updated their page, so the message box may be paused in Super DeepSeek until the next update. Your chat keeps working.');
  assert.equal(text.bn,
    'ডিপসিক তাদের পেজ আপডেট করেছে, তাই সুপার ডিপসিক-এ মেসেজ বক্স পরবর্তী আপডেট পর্যন্ত সাময়িকভাবে বন্ধ থাকতে পারে। আপনার চ্যাট চলতেই থাকবে।');
});

test('a build without sd-site.js, and an unknown host, both keep the DeepSeek contracts', () => {
  assert.equal(load({ withSite: false }).health.site, 'deepseek');
  assert.equal(load({ href: 'https://example.com/' }).health.site, 'deepseek');
});

test('only a profile that says "arena" switches the contracts', () => {
  const odd = load({
    beforeHealth: (ctx) => { ctx.__sdSite = { id: 'arena-ish', profile: { selectors: {} } }; },
  });
  assert.equal(odd.health.site, 'deepseek');
});

test('the arena branch tolerates a profile without selectors', () => {
  const { health } = load({
    beforeHealth: (ctx) => { ctx.__sdSite = { id: 'arena', profile: null }; },
  });
  assert.equal(health.site, 'arena');
  const checks = plain(health.checks);
  assert.equal(checks[0].selectors[0], 'textarea[name="message"]', 'sane built-in default');
  assert.deepEqual(checks[1].selectors, ['main ol.flex-col-reverse', 'ol.flex-col-reverse', 'ol.mt-8.flex', 'ol.mt-8']);
  assert.deepEqual(checks[4].selectors, ['a[href*="/c/"]']);
});
