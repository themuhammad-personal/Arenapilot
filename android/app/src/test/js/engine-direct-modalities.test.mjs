// Direct Mode, all four modalities (v2.3.0).
//
// arena.ai's Direct Chat has four home routes — /text/direct, /code/direct,
// /search/direct, /image/direct — and every conversation lives at /c/{id}. The
// request body names the modality (verified in arena's own shipped chunks:
// chat | webdev | search | image | video | audio | auto | p2l). Until v2.3.0 the
// engine knew only /text/direct, so on Code, Search and Image it answered
// "unknown" and paused every tool.
//
// These tests run the REAL sd-site.js and the REAL injected.js in one vm, the
// way the app injects them.
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
const INJECTED = fs.readFileSync(path.join(bds, 'injected.js'), 'utf8');
const BUNDLE = fs.readFileSync(path.join(bds, 'content.js'), 'utf8');

function boot({ pathname = '/text/direct', label = 'Direct', config = null } = {}) {
  const sent = [];
  const events = new EventTarget();
  const control = { textContent: label };
  const form = { querySelector: () => control };
  const win = {
    addEventListener: (...a) => events.addEventListener(...a),
    removeEventListener: (...a) => events.removeEventListener(...a),
    dispatchEvent: (e) => events.dispatchEvent(e),
    fetch: async (input, init) => {
      sent.push({ input, init });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
    console: { ...console, warn() {} },
  };
  const store = new Map();
  const ctx = {
    window: win,
    console: win.console,
    document: {
      querySelector: (sel) => (sel === 'textarea[name="message"]' ? { closest: () => form } : null),
      querySelectorAll: () => [], cookie: '', documentElement: {},
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    },
    navigator: { language: 'en' },
    location: { host: 'arena.ai', hostname: 'arena.ai', pathname, href: `https://arena.ai${pathname}` },
    CustomEvent, Event, EventTarget, Headers, Request, Response, URL, URLSearchParams, TextDecoder, TextEncoder,
    XMLHttpRequest: function () {}, setTimeout, clearTimeout, JSON, Promise, Date, Math, Array, Object, String, Number, Map, Set,
    encodeURIComponent, decodeURIComponent,
  };
  ctx.XMLHttpRequest.prototype = { open() {}, send() {}, setRequestHeader() {}, addEventListener() {} };
  ctx.globalThis = ctx;
  win.localStorage = ctx.localStorage;
  win.XMLHttpRequest = ctx.XMLHttpRequest;
  win.location = ctx.location;
  win.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext(SITE, ctx);
  vm.runInContext(INJECTED, ctx);
  if (config) win.dispatchEvent(new CustomEvent('bds:config-update', { detail: JSON.stringify(config) }));
  return { win, ctx, control, sent, site: win.__sdSite, navigate: (p) => { ctx.location.pathname = p; } };
}

// ── routes ──────────────────────────────────────────────────────────────────

test('all four Direct home routes are Direct Mode, each with its own modality', () => {
  const expected = { '/text/direct': 'chat', '/code/direct': 'webdev', '/search/direct': 'search', '/image/direct': 'image' };
  for (const [route, modality] of Object.entries(expected)) {
    const p = boot({ pathname: route });
    assert.equal(p.site.arenaMode(), 'direct', route);
    assert.equal(p.site.arenaModality(), modality, route);
  }
});

test('the content-script gate opens on every Direct route (it used to open on /text/direct only)', () => {
  const gate = BUNDLE.slice(BUNDLE.indexOf('function sdsArenaDirect(){'), BUNDLE.indexOf('\nfunction sdsArenaMessages()'));
  for (const route of ['/text/direct', '/code/direct', '/search/direct', '/image/direct']) {
    const p = boot({ pathname: route });
    vm.runInContext(gate, p.ctx);
    assert.equal(vm.runInContext('sdsArenaDirect()', p.ctx), true, route);
  }
});

test('a /c/{id} conversation keeps the modality it was started in', () => {
  const p = boot({ pathname: '/code/direct' });
  assert.equal(p.site.arenaMode(), 'direct');
  p.navigate('/c/019e-abc');
  assert.equal(p.site.arenaMode(), 'direct');
  assert.equal(p.site.arenaModality(), 'webdev', 'arena navigates to /c/{id} after the first send');
  p.site.noteModality('search');
  assert.equal(p.site.arenaModality(), 'search', 'a modality reported by a request body wins');
});

test('every non-Direct route stays unsupported or unknown — Battle, Side-by-side and Agent are untouched', () => {
  for (const slug of ['text', 'code', 'search', 'image', 'video']) {
    for (const mode of ['battle', 'side-by-side', 'agent']) {
      assert.equal(boot({ pathname: `/${slug}/${mode}` }).site.arenaMode(), 'unsupported', `${slug}/${mode}`);
    }
  }
  assert.equal(boot({ pathname: '/agent' }).site.arenaMode(), 'unsupported');
  for (const route of ['/leaderboard', '/c/id/extra', '/code', '/image/direct/extra']) {
    assert.notEqual(boot({ pathname: route }).site.arenaMode(), 'direct', route);
  }
  // a stale route cannot override the visible mode control
  assert.equal(boot({ pathname: '/code/direct', label: 'Battle' }).site.arenaMode(), 'unsupported');
  assert.equal(boot({ pathname: '/c/x', label: 'Side-by-side' }).site.arenaMode(), 'unsupported');
});

test('modality profiles: text, code and search run the engine; image never gets the instruction block', () => {
  const { site } = boot();
  assert.equal(site.modalityProfile('chat').inject, true);
  assert.equal(site.modalityProfile('webdev').inject, true);
  assert.equal(site.modalityProfile('search').inject, true);
  assert.equal(site.modalityProfile('image').inject, false);
  assert.equal(site.modalityProfile('video').inject, false);
  assert.equal(site.modalityProfile('something-new').inject, true, 'an unseen name behaves like chat, never silently off');
  assert.match(site.modalityProfile('webdev').addendum, /Arena Code/);
  assert.match(site.modalityProfile('search').addendum, /Arena Search/);
  assert.equal(site.modalityProfile('chat').addendum, '');
});

// ── what actually reaches arena ─────────────────────────────────────────────

const CREATE = 'https://arena.ai/nextjs-api/stream/create-evaluation';
const PLAIN = { 'content-type': 'text/plain;charset=UTF-8' };
const turn = (modality, content, id = 'E1') => ({
  id, mode: 'direct-battle', modelAId: 'm', userMessageId: 'u', modelAMessageId: 'a',
  userMessage: { content, experimental_attachments: [], metadata: {} },
  modality, recaptchaV3Token: 'TOKEN',
});
const CFG = { systemPrompt: 'SYS', memories: [], disableSystemPrompt: false, disableMemory: false };

async function send(route, modality, content) {
  const p = boot({ pathname: route, config: CFG });
  await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(turn(modality, content)) });
  return JSON.parse(p.sent[0].init.body);
}

test('text: the first turn carries the system prompt and no mode addendum (unchanged behaviour)', async () => {
  const sent = await send('/text/direct', 'chat', 'hello');
  assert.equal(sent.userMessage.content, '<ArenaPilot>\nSYS\n</ArenaPilot>\n\nhello');
});

test('code: the system prompt is followed by the Arena Code working rules', async () => {
  const sent = await send('/code/direct', 'webdev', 'build a todo app');
  const c = sent.userMessage.content;
  assert.ok(c.startsWith('<ArenaPilot>\nSYS\n\nMODE: Arena Code (WebDev)'), c.slice(0, 120));
  assert.ok(c.endsWith('</ArenaPilot>\n\nbuild a todo app'));
  assert.equal(sent.modality, 'webdev', 'the body arena receives keeps its modality');
  assert.equal(sent.recaptchaV3Token, 'TOKEN');
});

test('search: the system prompt is followed by the Arena Search working rules', async () => {
  const sent = await send('/search/direct', 'search', 'latest android release');
  assert.match(sent.userMessage.content, /MODE: Arena Search/);
  assert.match(sent.userMessage.content, /latest android release$/);
});

test('image: the user prompt reaches the image model exactly as typed', async () => {
  const sent = await send('/image/direct', 'image', 'a red fox in the snow, watercolor');
  assert.equal(sent.userMessage.content, 'a red fox in the snow, watercolor');
});

test('the body modality decides, even when the URL is a /c/{id} that says nothing', async () => {
  const p = boot({ pathname: '/c/019e-zzz', config: CFG });
  await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(turn('image', 'a lighthouse at dusk')) });
  assert.equal(JSON.parse(p.sent[0].init.body).userMessage.content, 'a lighthouse at dusk');
  assert.equal(p.site.arenaModality(), 'image');
});

test('an unseen modality name still gets the engine (a rename cannot switch tools off)', async () => {
  const sent = await send('/text/direct', 'brand-new-modality', 'hi');
  assert.match(sent.userMessage.content, /^<ArenaPilot>\nSYS\n<\/ArenaPilot>/);
});

test('Battle and Side-by-side bodies are still never rewritten', async () => {
  for (const mode of ['battle', 'side-by-side']) {
    const p = boot({ pathname: '/code/direct', config: CFG });
    const body = { ...turn('webdev', 'x'), mode };
    await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(body) });
    assert.equal(JSON.parse(p.sent[0].init.body).userMessage.content, 'x', mode);
  }
});

// ── the emulator gate for the three non-Text pages ──────────────────────────

test('emulator gate: Code, Search and Image must be Direct with the right modality', async () => {
  const { MODALITY_ROUTES, modalityFailures } = await import('../../../../ci/cdp_probe.mjs');
  assert.deepEqual(MODALITY_ROUTES.map((r) => r.path), ['/code/direct', '/search/direct', '/image/direct']);
  const [code] = MODALITY_ROUTES;
  const good = { composer: true, engine: true, mode: 'direct', modality: 'webdev', profile: 'webdev' };
  assert.deepEqual(modalityFailures(code, good), []);
  assert.deepEqual(modalityFailures(code, { ...good, mode: 'unknown' }), ['modality-webdev-mode-unknown'], 'the pre-v2.3.0 behaviour fails the gate');
  assert.deepEqual(modalityFailures(code, { ...good, modality: 'chat' }), ['modality-webdev-got-chat']);
  assert.deepEqual(modalityFailures(code, { ...good, engine: false }), ['modality-webdev-engine-not-injected']);
  assert.deepEqual(modalityFailures(code, { composer: false }), [], 'a sign-in or challenge page is skipped, not failed');
  assert.deepEqual(modalityFailures(code, null), ['modality-webdev-unreadable']);
});

test('before the navigation observer runs, a previous chat config cannot decorate a new request',async()=>{
  const p=boot({pathname:'/c/old',config:{...CFG,contextPath:'/c/old',activeProject:{name:'old-project',instructions:'private'}}});p.navigate('/c/new');
  const body=JSON.stringify(turn('chat','untouched','new'));await p.win.fetch(CREATE,{method:'POST',headers:PLAIN,body});assert.equal(p.sent[0].init.body,body);
});
test('a mismatched conversation id cannot receive project context even at the same URL',async()=>{
  const p=boot({pathname:'/c/current',config:{...CFG,contextPath:'/c/current',activeProject:{name:'current',instructions:'private'}}});
  const body=JSON.stringify(turn('chat','untouched','other'));await p.win.fetch(CREATE,{method:'POST',headers:PLAIN,body});assert.equal(p.sent[0].init.body,body);
});
