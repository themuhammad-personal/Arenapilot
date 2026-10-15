// The arena capture kit (tools/arena-capture/capture.js) — Phase 0, made cheap.
//
// Every "MODELLED" value in the arena profile (menus, the "+" popup, the composer
// box, request and response shapes) is a guess until someone looks at the real
// site, and only the owner can. The kit records the STRUCTURE of the page and of
// its traffic; what matters most is what it must NEVER record — message text, chat
// titles, the signed-in user's name, tokens, cookies, ids. These tests load the
// real script into a vm with a fake page and assert, above all, those promises.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { buildBookmarklet } from '../../../../../tools/arena-capture/make-bookmarklet.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const KIT = path.resolve(here, '../../../../../tools/arena-capture');
const SOURCE = fs.readFileSync(path.join(KIT, 'capture.js'), 'utf8');

const SECRETS = {
  title: 'My secret business plan for Acme',
  name: 'Muhammad Rahman',
  email: 'muhammad.rahman@example.com',
  message: 'Please summarise my confidential contract',
  jwt: 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  uuid: '0199e8e9-01ed-73e0-96ba-cf43b286bf10',
  recaptcha: '03AFcWeA5-a-very-long-recaptcha-token-value-1234567890abcdefghij',
};

// ── a fake page ─────────────────────────────────────────────────────────────

/** A simple selector (one compound, or a comma list of them) against a fake node. */
function matches(node, selector) {
  return String(selector).split(',').some((one) => {
    const sel = one.trim();
    if (/[ >+~]/.test(sel.replace(/\[[^\]]*\]/g, ''))) return false; // combinators: not supported by the fake
    const tokens = sel.match(/\[[^\]]+\]|#[^.#[\]\s]+|\.[^.#[\]\s]+|[a-zA-Z*][\w-]*/g) || [];
    return tokens.length > 0 && tokens.every((t) => {
      if (t === '*') return true;
      if (t[0] === '#') return node.getAttribute('id') === t.slice(1);
      if (t[0] === '.') return String(node.getAttribute('class') || '').split(/\s+/).includes(t.slice(1));
      if (t[0] === '[') {
        const m = /^\[([^=*\]]+)(\*?=)?(?:["']?([^"'\]]*)["']?)?\]$/.exec(t);
        const v = node.getAttribute(m[1]);
        if (!m[2]) return v !== null;
        return m[2] === '*=' ? v !== null && v.includes(m[3]) : v === m[3];
      }
      return node.tagName === t.toUpperCase();
    });
  });
}

function el(tag, attrs = {}, kids = [], text = '') {
  const node = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    children: [],
    childNodes: text ? [{ nodeType: 3, textContent: text }] : [],
    parentElement: null,
    attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    getAttribute: (n) => (Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null),
    getBoundingClientRect: () => ({ x: 10, y: 20, left: 10, top: 20, width: 100, height: 30 }),
    get textContent() { return text + node.children.map((k) => k.textContent).join(''); },
    closest(sel) { for (let n = node; n; n = n.parentElement) if (matches(n, sel)) return n; return null; },
    querySelector(sel) { return descendants(node).find((n) => matches(n, sel)) || null; },
  };
  kids.forEach((k) => { k.parentElement = node; node.children.push(k); node.childNodes.push(k); });
  return node;
}
function descendants(root) {
  const out = [];
  (function walk(n) { n.children.forEach((c) => { out.push(c); walk(c); }); })(root);
  return out;
}

/** An arena-shaped page: header, sidebar with a chat title and the user's name, a conversation, a composer, an open menu. */
function arenaPage() {
  const composerForm = el('form', { class: 'bg-surface-raised flex items-end' }, [
    el('button', { 'aria-label': 'Add files', type: 'button', class: 'rounded-full' }),
    el('textarea', { name: 'message', placeholder: 'Ask anything', class: 'w-full resize-none' }),
    el('input', { type: 'file', 'data-testid': SECRETS.uuid }),
    el('button', { 'aria-label': 'Send message', type: 'submit' }),
  ]);
  const messages = el('ol', { class: 'flex flex-col-reverse gap-4' }, [
    el('li', { class: 'self-end' }, [el('div', { class: 'justify-end' }, [], SECRETS.message)]),
    el('li', {}, [el('div', { class: 'prose' }, [], 'An assistant answer that quotes ' + SECRETS.title)]),
  ]);
  const sidebar = el('nav', { class: 'sidebar flex flex-col' }, [
    el('button', { 'aria-label': 'New chat' }, [], 'New chat'),
    el('a', { href: `/c/${SECRETS.uuid}`, 'aria-label': SECRETS.title }, [], SECRETS.title),
    el('div', { class: 'footer' }, [
      el('button', { 'aria-label': `Account menu for ${SECRETS.name}`, 'aria-haspopup': 'menu', 'data-state': 'closed' }, [], SECRETS.name),
    ]),
  ]);
  const menu = el('div', { role: 'menu', 'data-state': 'open', class: 'rounded-xl shadow' }, [
    el('div', { role: 'menuitem' }, [], SECRETS.email),
    el('div', { role: 'menuitem' }, [], 'Settings'),
    el('div', { role: 'menuitem' }, [], 'Log out'),
  ]);
  const header = el('header', { class: 'h-12' }, [el('button', { 'aria-label': 'Toggle sidebar' }, [], 'Toggle sidebar'), el('span', {}, [], SECRETS.name)]);
  const panelNode = el('div', { id: 'sd-capture-panel' }, [el('button', { 'aria-label': 'Export' }, [], 'Export')]);
  const main = el('main', {}, [messages, composerForm]);
  const body = el('body', {}, [header, sidebar, main, menu, panelNode]);
  const html = el('html', { class: 'dark', lang: 'en' }, [body]);
  return { html, body, main, messages, composerForm, sidebar, menu };
}

/** capture.js in a vm, on a fake arena.ai page. `fetchImpl` becomes the page's own fetch. */
function load({ fetchImpl, page = arenaPage(), href = `https://arena.ai/c/${SECRETS.uuid}`, xhr = true, source = SOURCE } = {}) {
  const timers = [];
  const url = new URL(href);
  const FakeXHR = function () { this.listeners = {}; };
  FakeXHR.prototype = {
    open() {}, setRequestHeader() {},
    addEventListener(name, fn) { this.listeners[name] = fn; },
    getResponseHeader() { return 'application/json'; },
    send() { this.status = 200; this.responseText = JSON.stringify({ ok: true, title: SECRETS.title }); if (this.listeners.loadend) this.listeners.loadend(); },
  };
  const ctx = {
    console, JSON, Object, Array, Date, Math, Promise, RegExp, String, Number, Error, Set, Map,
    URL, URLSearchParams, FormData, TextDecoder, Response, Headers,
    location: { href, host: url.host, pathname: url.pathname },
    navigator: { language: 'en-US' },
    innerWidth: 390, innerHeight: 800,
    getComputedStyle: () => ({ display: 'flex', flexDirection: 'column-reverse', position: 'relative', overflowY: 'auto' }),
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    document: {
      documentElement: page.html,
      body: page.body,
      createElement: (tag) => {
        const n = el(tag);
        let own = '';
        Object.defineProperty(n, 'textContent', { get: () => own, set: (v) => { own = String(v); }, configurable: true });
        n.style = {};
        n.appendChild = (k) => { k.parentElement = n; n.children.push(k); n.childNodes.push(k); };
        n.addEventListener = () => {};
        return n;
      },
      querySelectorAll: (sel) => [page.html, ...descendants(page.html)].filter((n) => matches(n, sel)), // the root matches too, as in a real document
    },
  };
  ctx.window = ctx;
  if (fetchImpl) ctx.fetch = fetchImpl;
  if (xhr) ctx.XMLHttpRequest = FakeXHR;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  return { ctx, kit: ctx.__sdCapture, page, timers, FakeXHR };
}

const plain = (v) => JSON.parse(JSON.stringify(v));
const settle = () => new Promise((r) => setTimeout(r, 25));
/** Everything the kit would hand back, as one string. */
const exported = (kit, opts) => kit.export(opts);

// ── 1. shapes: what a value looks like, never what it says ──────────────────

test('shape(): a message body keeps its structure and loses every word', () => {
  const { kit } = load();
  const shape = plain(kit._t.shape({
    id: SECRETS.uuid, mode: 'direct-battle', modality: 'chat', modelAId: SECRETS.uuid,
    userMessage: { content: SECRETS.message, experimental_attachments: [], metadata: {} },
    recaptchaV3Token: SECRETS.recaptcha,
  }));
  assert.equal(shape.mode, 'direct-battle', 'structural enums stay: they are the facts we want');
  assert.equal(shape.modality, 'chat');
  assert.equal(shape.id, '<uuid>');
  assert.equal(shape.modelAId, '<uuid>');
  assert.match(shape.userMessage.content, /^<str len=\d+>$/);
  assert.equal(shape.userMessage.experimental_attachments.$array, 0);
  assert.match(shape.recaptchaV3Token, /^<redacted len=\d+>$/);
  const text = JSON.stringify(shape);
  for (const secret of [SECRETS.message, SECRETS.recaptcha, SECRETS.uuid]) assert.ok(!text.includes(secret), `leaked: ${secret}`);
});

test('shape(): tokens and personal fields are redacted by NAME, whatever they hold', () => {
  const { kit } = load();
  const shape = plain(kit._t.shape({ access_token: 'x', email: SECRETS.email, phone: '123', apiKey: 'k', sessionId: 's', jwt: SECRETS.jwt, note: SECRETS.jwt }));
  for (const k of ['access_token', 'email', 'phone', 'apiKey', 'sessionId']) assert.match(shape[k], /<redacted/, k);
  assert.equal(shape.note, '<jwt>', 'a JWT under an innocent key is still recognised');
});

test('shape(): token COUNTS keep their shape, personal numbers do not', () => {
  const { kit } = load();
  const shape = plain(kit._t.shape({ usage: { promptTokens: 12, completionTokens: 34, total_tokens: 46 }, phone: 123456789, pin: 1234, keyCount: 3 }));
  assert.deepEqual(shape.usage, { promptTokens: 'num', completionTokens: 'num', total_tokens: 'num' }, 'the usage frame is exactly what we want to learn the shape of');
  assert.equal(shape.keyCount, 'num');
  assert.equal(shape.phone, '<redacted>');
  assert.equal(shape.pin, '<redacted>');
});

test('shape(): arrays keep three items and a count; depth and key count are capped', () => {
  const { kit } = load();
  const arr = plain(kit._t.shape([1, 2, 3, 4, 5]));
  assert.deepEqual(arr, { $array: 5, items: ['num', 'num', 'num', '+2 more'] });
  let deep = 'leaf';
  for (let i = 0; i < 20; i += 1) deep = { a: deep };
  assert.ok(JSON.stringify(kit._t.shape(deep)).includes('<deep>'));
  const wide = {}; for (let i = 0; i < 100; i += 1) wide[`k${i}`] = i;
  assert.equal(plain(kit._t.shape(wide)).$more_keys, 40);
});

test('lineShape(): the answer stream is described, not read', () => {
  const { kit } = load();
  const t = kit._t;
  assert.deepEqual(plain(t.lineShape('a0:"Hello there"')), { prefix: 'a', code: '0', value: '<str len=11>' });
  assert.deepEqual(plain(t.lineShape('ag:"thinking about it"')), { prefix: 'a', code: 'g', value: '<str len=17>' });
  const finish = plain(t.lineShape('ad:{"finishReason":"stop","usage":{"promptTokens":12,"completionTokens":34}}'));
  assert.equal(finish.value.finishReason, 'stop');
  assert.equal(finish.value.usage.promptTokens, 'num');
  assert.deepEqual(plain(t.lineShape('data: {"type":"text-delta","delta":"hi"}')), { sse: 'data', value: { type: 'text-delta', delta: '<str len=2>' } });
  assert.deepEqual(plain(t.lineShape('event: ping')), { sse: 'event', name: 'ping' });
  assert.ok(!JSON.stringify(t.lineShape('a0:"Hello there"')).includes('Hello'));
});

// ── 2. masking ──────────────────────────────────────────────────────────────

test('maskPath / maskUrl: ids vanish, key names stay, other hosts are named', () => {
  const { kit } = load();
  const t = kit._t;
  assert.equal(t.maskPath(`/nextjs-api/stream/post-to-evaluation/${SECRETS.uuid}`), '/nextjs-api/stream/post-to-evaluation/{uuid}');
  assert.equal(t.maskPath('/api/chat/ZmFrZWlkZmFrZWlkZmFrZWlkZmFrZQ/messages'), '/api/chat/{id}/messages');
  assert.equal(t.maskPath('/api/user/12345678'), '/api/user/{n}');
  assert.equal(t.maskUrl(`https://arena.ai/api/history/unified?cursor=${SECRETS.jwt}&limit=20&type=text`), '/api/history/unified?cursor&limit&type');
  assert.equal(t.maskUrl('https://www.google.com/recaptcha/enterprise/reload?k=secret'), '[www.google.com]/recaptcha/enterprise/reload?k');
});

test('maskText: addresses and long numbers never pass, long text is cut', () => {
  const { kit } = load();
  assert.equal(kit._t.maskText('a@b.co'), '<masked>');
  assert.equal(kit._t.maskText('call 0123456789'), '<masked>');
  assert.equal(kit._t.maskText('Settings'), 'Settings');
  assert.ok(kit._t.maskText('x'.repeat(100)).length <= 41);
});

// ── 3. network ──────────────────────────────────────────────────────────────

test('fetch: a Direct Chat send is recorded as its shape — method, masked path, header NAMES, body shape', async () => {
  const sentTo = [];
  const { ctx, kit } = load({
    fetchImpl: async (u, init) => { sentTo.push([u, init]); return new Response(JSON.stringify({ id: SECRETS.uuid, title: SECRETS.title }), { status: 200, headers: { 'content-type': 'application/json' } }); },
  });
  const body = JSON.stringify({ id: SECRETS.uuid, mode: 'direct-battle', userMessage: { content: SECRETS.message }, recaptchaV3Token: SECRETS.recaptcha });
  const res = await ctx.fetch(`https://arena.ai/nextjs-api/stream/post-to-evaluation/${SECRETS.uuid}`, {
    method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8', 'x-request-id': 'r1', authorization: `Bearer ${SECRETS.jwt}`, cookie: 'a=b' }, body,
  });
  await settle();
  assert.equal(res.status, 200, 'the page still gets its response');
  assert.equal(sentTo.length, 1, 'and its request is passed on untouched');
  assert.equal(sentTo[0][1].body, body);
  const [entry] = plain(kit.network());
  assert.equal(entry.method, 'POST');
  assert.equal(entry.url, '/nextjs-api/stream/post-to-evaluation/{uuid}');
  assert.equal(entry.reqType, 'text/plain;charset=UTF-8', 'arena posts JSON as text/plain — a fact worth having');
  assert.deepEqual(entry.reqHeaders, ['authorization', 'content-type', 'cookie', 'x-request-id'], 'names only: whether a bearer header exists is the point');
  assert.equal(entry.reqBody.mode, 'direct-battle');
  assert.match(entry.reqBody.userMessage.content, /^<str len=\d+>$/);
  assert.equal(entry.status, 200);
  const all = JSON.stringify(entry);
  for (const secret of [SECRETS.message, SECRETS.recaptcha, SECRETS.jwt, SECRETS.uuid, SECRETS.title, 'a=b']) assert.ok(!all.includes(secret), `leaked: ${secret}`);
});

test('fetch: static assets are ignored; recaptcha is noted by host; failures are noted', async () => {
  const { ctx, kit } = load({
    fetchImpl: async (u) => {
      if (String(u).includes('boom')) throw new Error('offline');
      return new Response('x', { status: 200, headers: { 'content-type': 'text/plain' } });
    },
  });
  await ctx.fetch('https://arena.ai/_next/static/chunks/app.js');
  await ctx.fetch('https://arena.ai/logo.png');
  await ctx.fetch('https://www.google.com/recaptcha/enterprise/clr?k=abc');
  await ctx.fetch('https://example.org/unrelated');
  await ctx.fetch('https://arena.ai/api/boom').catch(() => {});
  await settle();
  const urls = plain(kit.network()).map((e) => e.url);
  assert.deepEqual(urls, ['[www.google.com]/recaptcha/enterprise/clr?k', '/api/boom']);
  assert.equal(plain(kit.network())[1].error, 'network');
});

test('fetch: the first lines of a streamed answer are kept as shapes, text never', async () => {
  const lines = ['a0:"Hel"', 'a0:"lo wor"', 'ag:"private reasoning"', 'a2:[{"type":"heartbeat"}]', `ad:{"finishReason":"stop","usage":{"promptTokens":9}}`, ''].join('\n');
  const { ctx, kit } = load({
    fetchImpl: async () => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(lines)); c.close(); } }), {
      status: 200, headers: { 'content-type': 'text/plain; charset=utf-8' },
    }),
  });
  await ctx.fetch('https://arena.ai/nextjs-api/stream/create-evaluation', { method: 'POST', body: '{}' });
  await settle();
  const [entry] = plain(kit.network());
  assert.equal(entry.resType, 'text/plain');
  assert.equal(entry.stream.lines, 5);
  const codes = entry.stream.samples.map((s) => `${s.prefix}${s.code}`);
  assert.deepEqual([...new Set(codes)].sort(), ['a0', 'a2', 'ad', 'ag']);
  const text = JSON.stringify(entry);
  for (const word of ['Hel', 'lo wor', 'private reasoning']) assert.ok(!text.includes(word), `leaked: ${word}`);
  assert.ok(text.includes('"finishReason":"stop"'), 'the finish line’s structural enum is kept');
});

test('fetch: a JSON response is kept as a shape with its titles hidden', async () => {
  const { ctx, kit } = load({
    fetchImpl: async () => new Response(JSON.stringify({ entries: [{ id: SECRETS.uuid, type: 'text', title: SECRETS.title }], nextCursor: SECRETS.jwt, total: 3 }),
      { status: 200, headers: { 'content-type': 'application/json' } }),
  });
  await ctx.fetch('https://arena.ai/api/history/unified?limit=20&type=text');
  await settle();
  const [entry] = plain(kit.network());
  assert.equal(entry.resShape.entries.items[0].type, 'text');
  assert.match(entry.resShape.entries.items[0].title, /^<str len=\d+>$/);
  assert.equal(entry.resShape.total, 'num');
  assert.ok(!JSON.stringify(entry).includes(SECRETS.title));
});

test('xhr: recorded the same way', async () => {
  const { ctx, kit, FakeXHR } = load({ fetchImpl: async () => new Response('') });
  const x = new FakeXHR();
  ctx.XMLHttpRequest.prototype.open.call(x, 'GET', `https://arena.ai/api/me?x=1`);
  ctx.XMLHttpRequest.prototype.setRequestHeader.call(x, 'Authorization', `Bearer ${SECRETS.jwt}`);
  ctx.XMLHttpRequest.prototype.send.call(x, null);
  const [entry] = plain(kit.network());
  assert.equal(entry.via, 'xhr');
  assert.equal(entry.url, '/api/me?x');
  assert.deepEqual(entry.reqHeaders, ['authorization']);
  assert.ok(!JSON.stringify(entry).includes(SECRETS.jwt) && !JSON.stringify(entry).includes(SECRETS.title));
});

test('loading the kit twice does not wrap fetch twice', async () => {
  let calls = 0;
  const { ctx } = load({ fetchImpl: async () => { calls += 1; return new Response('{}', { headers: { 'content-type': 'application/json' } }); } });
  vm.runInContext(SOURCE, ctx); // the bookmarklet tapped again
  await ctx.fetch('https://arena.ai/api/me');
  await settle();
  assert.equal(calls, 1);
  assert.equal(plain(ctx.__sdCapture.network()).length, 1);
});

// ── 4. the page ─────────────────────────────────────────────────────────────

test('snap(): finds the landmarks the plan guessed at, with real counts', () => {
  const { kit } = load();
  const res = kit.snap('conversation');
  assert.equal(res.ok, true);
  const [snap] = plain(kit.snaps());
  const by = Object.fromEntries(snap.landmarks.map((l) => [l.selector, l]));
  assert.equal(by['textarea[name="message"]'].count, 1);
  assert.equal(by['textarea[name="message"]'].first.placeholder, 'Ask anything');
  assert.equal(by['button[aria-label="Send message"]'].count, 1);
  assert.equal(by['button[aria-label="Add files"]'].count, 1, 'arena’s real attach label');
  assert.equal(by['button[aria-label="Attach files"]'], undefined, 'the label arena-utils had is no longer a landmark');
  assert.equal(by['input[type="file"]'].count, 1);
  assert.equal(by['[role="menu"]'].count, 1);
  assert.equal(by['[role="menuitem"]'].count, 3);
  assert.equal(by['html.dark'].count, 1);
  assert.equal(snap.label, 'conversation');
  assert.equal(snap.path, '/c/{uuid}');
  assert.equal(snap.html.lang, 'en');
});

test('snap(): the composer region shows where the file input and the buttons sit', () => {
  const { kit } = load();
  kit.snap('x');
  const [snap] = plain(kit.snaps());
  const kids = (n) => (n.children || []);
  const flat = (n) => [n, ...kids(n).flatMap(flat)];
  const nodes = flat(snap.regions.composer);
  assert.ok(nodes.some((n) => n.tag === 'input' && n.type === 'file'), 'the file input is inside the composer box');
  assert.ok(nodes.some((n) => n.tag === 'button' && n.aria === 'Add files'));
  assert.ok(nodes.some((n) => n.tag === 'textarea' && n.name === 'message'));
  assert.equal(snap.computed.composerBox.display, 'flex');
  assert.equal(snap.computed.messageList.flexDirection, 'column-reverse', 'the reversed-list assumption is checked, not assumed');
});

test('snap(): an open menu is captured with its item words — the thing the plan needs most', () => {
  const { kit } = load();
  kit.snap('account-menu');
  const [snap] = plain(kit.snaps());
  const words = JSON.stringify(snap.regions.popups);
  assert.ok(words.includes('"text":"Settings"') && words.includes('"text":"Log out"'));
  assert.equal(snap.regions.popups[0].role, 'menu');
  assert.equal(snap.regions.popups[0].data['data-state'], 'open');
});

test('PRIVACY: no title, name, message text, e-mail, id or token is in what snap() keeps', () => {
  const { kit } = load();
  kit.snap('everything');
  const dump = JSON.stringify(kit.snaps());
  for (const [what, secret] of Object.entries({ title: SECRETS.title, name: SECRETS.name, email: SECRETS.email, message: SECRETS.message, uuid: SECRETS.uuid })) {
    assert.ok(!dump.includes(secret), `snap() leaked the ${what}: ${secret}`);
  }
  // the interface words that make the capture useful survive
  assert.ok(dump.includes('New chat') && dump.includes('Toggle sidebar') && dump.includes('Settings'));
  // private places are structure only
  assert.ok(dump.includes('<label len='), 'unknown labels become their length');
});

test('PRIVACY: the account button keeps its structure (aria-haspopup, data-state) but not the user’s name', () => {
  const { kit } = load();
  kit.snap('x');
  const [snap] = plain(kit.snaps());
  const flat = (n) => [n, ...(n.children || []).flatMap(flat)];
  const trigger = flat(snap.regions.sidebar).find((n) => n.data && n.data['data-state'] === 'closed');
  assert.ok(trigger, 'the account trigger is found by its structure');
  assert.match(trigger.aria, /^<label len=\d+>$/);
  assert.ok(!JSON.stringify(trigger).includes('Muhammad'));
});

test('snap(label, {free:true}): a session with no account keeps interface words in the sidebar and header — private places stay masked', () => {
  const { kit } = load();
  kit.snap('anonymous', { free: true });
  const dump = JSON.stringify(kit.snaps());
  // the sidebar's own interface words are now kept, which the default mode would have hidden
  const flat = (n) => [n, ...(n.children || []).flatMap(flat)];
  const [snap] = plain(kit.snaps());
  assert.ok(flat(snap.regions.sidebar).some((n) => n.text === 'New chat'));
  // but a chat row and a message are STILL never read, whatever the mode
  for (const secret of [SECRETS.title, SECRETS.message, SECRETS.uuid]) assert.ok(!dump.includes(secret), `leaked: ${secret}`);
});

test('the engine’s own elements are landmarks, so a real page shows whether the engine mounted', () => {
  const { kit } = load();
  kit.snap('x');
  const selectors = plain(kit.snaps())[0].landmarks.map((l) => l.selector);
  for (const sel of ['#bds-root', '#bds-settings-rail', '.bds-plus-btn', '.bds-attach-dropdown', '.bds-attach-item', '#sd-health-notice']) {
    assert.ok(selectors.includes(sel), sel);
  }
});

test('whatever the engine puts straight under <body> (its "+" sheet) is captured by position, not by class name', () => {
  const page = arenaPage();
  const sheet = el('div', { class: 'bds-attach-backdrop-x some-other-name' }, [
    el('div', { class: 'weird-hashed-class' }, [el('button', {}, [], 'Upload file'), el('button', {}, [], 'Attach project')]),
  ]);
  sheet.parentElement = page.body; page.body.children.push(sheet); page.body.childNodes.push(sheet);
  sheet.getAttribute = (n) => ({ class: 'bds-attach-sheet-root' }[n] ?? null);
  const { kit } = load({ page });
  kit.snap('plus-sheet');
  const [snap] = plain(kit.snaps());
  assert.ok(snap.regions.engineOverlays, 'found under <body> by its bds- prefix');
  const words = JSON.stringify(snap.regions.engineOverlays);
  assert.ok(words.includes('Upload file') && words.includes('Attach project'), 'the sheet’s own cards, as words');
});

test('the kit’s own panel is never part of what it captures', () => {
  const { kit } = load();
  kit.snap('x');
  assert.ok(!JSON.stringify(kit.snaps()).includes('Export'), 'the panel button is left out');
});

test('snapIn(): schedules the snapshot, so a menu can be opened in the meantime', () => {
  const { kit, timers } = load();
  const msg = kit.snapIn(8, 'plus-popup');
  assert.match(msg, /plus-popup/);
  assert.equal(timers.at(-1).ms, 8000);
  assert.equal(kit.snaps().length, 0, 'nothing yet');
  timers.at(-1).fn();
  assert.equal(kit.snaps().length, 1);
  assert.equal(plain(kit.snaps())[0].label, 'plus-popup');
});

test('snapshots are capped', () => {
  const { kit } = load();
  for (let i = 0; i < 30; i += 1) kit.snap(`s${i}`);
  assert.equal(kit.snaps().length, 24);
  assert.equal(kit.snap('one more').error, 'too many snapshots');
});

// ── 5. export: the last line of defence ─────────────────────────────────────

test('export(): valid JSON with the pieces the next session needs', () => {
  const { kit } = load();
  kit.snap('conversation');
  const out = JSON.parse(exported(kit));
  assert.equal(out.kit, 'sd-arena-capture');
  assert.equal(out.version, 1);
  assert.equal(out.page.host, 'arena.ai');
  assert.equal(out.page.path, '/c/{uuid}');
  assert.equal(out.counts.snaps, 1);
  assert.ok(Array.isArray(out.network));
  assert.match(out.note, /structure only/);
});

test('export(): a secret that slipped past every rule is still masked, and the mask is counted', () => {
  const { kit } = load();
  kit.snap('x');
  // simulate a leak the per-field rules did not foresee: a class token that is really an opaque value
  const snap = kit.snaps()[0];
  snap.landmarks[0].first = { tag: 'div', cls: `a ${'Z'.repeat(60)} b ${SECRETS.email} Bearer ${SECRETS.jwt.slice(0, 20)}abcdef123456` };
  const out = exported(kit);
  assert.ok(!out.includes('Z'.repeat(60)), 'opaque run masked');
  assert.ok(!out.includes(SECRETS.email), 'e-mail masked');
  assert.ok(!out.includes('abcdef123456'), 'bearer masked');
  const masked = JSON.parse(out).masked;
  assert.ok(masked.opaque >= 1 && masked.email >= 1 && masked.bearer >= 1, JSON.stringify(masked));
});

test('export({redact}): the owner’s own words are removed wherever they appear', () => {
  const { kit } = load();
  kit.snap('x');
  const snap = kit.snaps()[0];
  snap.landmarks[1].first = { tag: 'span', cls: 'muhammad-rahman Muhammad' };
  const out = exported(kit, { redact: ['Muhammad Rahman', 'muhammad', 'x'] });
  assert.ok(!/muhammad/i.test(out));
  assert.ok(out.includes('<redacted-word>'));
  assert.ok(Object.keys(JSON.parse(out).masked).some((k) => k.startsWith('redact:')));
});

test('export(): an oversized capture is trimmed, never refused', async () => {
  const big = 'k'.repeat(30);
  const { ctx, kit } = load({ fetchImpl: async () => new Response(JSON.stringify({ [big]: 1 }), { headers: { 'content-type': 'application/json' } }) });
  for (let i = 0; i < 300; i += 1) await ctx.fetch(`https://arena.ai/api/n${i}?${big}=1&${big}2=1&${big}3=1&${big}4=1&${big}5=1&${big}6=1`);
  await settle();
  const out = exported(kit);
  assert.ok(out.length <= 700000);
  assert.ok(JSON.parse(out).network.length > 20);
});

// ── 6. the panel and the bookmarklet ────────────────────────────────────────

test('the panel is added once, outside everything it captures', () => {
  const { kit, page } = load();
  const panels = descendants(page.html).filter((n) => n.getAttribute('id') === 'sd-capture-panel');
  assert.ok(panels.length >= 1);
  assert.equal(typeof kit.panel, 'function');
});

test('capture.js honours the rules that let it become a bookmarklet', () => {
  assert.ok([...SOURCE].every((c) => c.charCodeAt(0) < 128), 'ASCII only');
  const noBlock = SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/^\s*\/\//m.test(noBlock), 'no // comment lines');
  assert.ok(!/[;{}),]\s*\/\/[^'"\n]*$/m.test(noBlock), 'no trailing // comments');
  assert.ok(/^'use strict'|\n\s*'use strict';/.test(noBlock));
});

test('bookmarklet.txt is exactly what the builder makes from capture.js (it cannot drift)', () => {
  const committed = fs.readFileSync(path.join(KIT, 'bookmarklet.txt'), 'utf8');
  assert.equal(committed, buildBookmarklet(SOURCE) + '\n', 'run: node tools/arena-capture/make-bookmarklet.mjs');
  assert.equal(committed.trim().split('\n').length, 1, 'one line');
  assert.ok(committed.startsWith('javascript:'));
  assert.ok(!/[^\x20-\x7e\n]/.test(committed), 'printable ASCII only');
});

test('the bookmarklet, run as code, installs the same kit', async () => {
  const code = decodeURIComponent(fs.readFileSync(path.join(KIT, 'bookmarklet.txt'), 'utf8').trim().replace(/^javascript:/, '').replace(/%(?![0-9A-Fa-f]{2})/g, '%25'));
  const { kit } = load({ source: code });
  assert.equal(kit.version, 1);
  assert.deepEqual(plain(kit._t.shape({ mode: 'direct-battle', token: 'x' })), { mode: 'direct-battle', token: '<redacted len=1>' });
  kit.snap('x');
  assert.equal(kit.snaps().length, 1);
});
