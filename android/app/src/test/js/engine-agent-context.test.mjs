// Agent Mode shared-engine context (V3 Core, Phase 2).
//
// Agent runs on Arena's own orchestrator, tools and sandbox. Its request format is not
// a documented contract, so the app adds ONLY read-only context (project, persona,
// relevant memory, task-matched skills) and only when the body can be verified:
// the text the composer held at send time must appear in the JSON body exactly once.
// These tests run the REAL sd-site.js and the REAL injected.js in one vm.
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

const PLAIN = { 'content-type': 'application/json' };
const AGENT_URL = 'https://arena.ai/nextjs-api/agent/send';

const CFG = {
  systemPrompt: 'SYS-TAG-PROTOCOL',
  disableSystemPrompt: false,
  disableMemory: false,
  memories: [{ key: 'preferred language', value: 'Bangla', importance: 'called' }, { key: 'garden', value: 'roses', importance: 'always' }],
  activeProject: { name: 'Ledger', instructions: 'Use double entry bookkeeping.' },
  activeCharacter: { id: 'c1', name: 'Coach', usage: '', modes: null, content: 'Speak plainly.' },
  skills: [
    { id: 's1', name: 'spreadsheet audit', usage: 'audit, ledger', modes: null, content: 'Check totals twice.' },
    { id: 's2', name: 'chat only skill', usage: 'audit', modes: ['chat'], content: 'RESTRICTED-SKILL' },
  ],
  mcpToolSchemas: [{ serverName: 'files', serverUrl: 'https://mcp.example/x', toolName: 'read', description: 'd', inputSchema: {} }],
};

function boot({ pathname = '/agent', config = CFG, origin = 'https://arena.ai' } = {}) {
  const sent = [];
  const events = new EventTarget();
  const control = { textContent: 'Agent' };
  const form = { querySelector: () => control, querySelectorAll: () => [] };
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
  const textarea = { value: '', closest: () => form };
  const ctx = {
    window: win,
    console: win.console,
    document: {
      querySelector: (sel) => (sel === 'textarea[name="message"]' ? textarea : null),
      querySelectorAll: () => [], cookie: '', documentElement: {},
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    },
    navigator: { language: 'en' },
    location: { host: 'arena.ai', hostname: 'arena.ai', origin, pathname, href: `${origin}${pathname}` },
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
  const publish = (p) => win.dispatchEvent(new CustomEvent('bds:config-update', { detail: JSON.stringify({ ...config, contextPath: p }) }));
  if (config) publish(pathname);
  const bodyOf = (i) => JSON.parse(sent[i].init.body);
  return {
    win, ctx, sent, site: win.__sdSite, bodyOf, events,
    type: (text) => win.__sdAgentCtx.snap(text),
    navigate: (p) => { ctx.location.pathname = p; ctx.location.href = `${origin}${p}`; publish(p); },
  };
}

const post = (p, body, url = AGENT_URL) => p.win.fetch(url, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(body) });

test('Agent gets a context-only capability set: no scanning, MCP, continuity or memory writes', () => {
  for (const route of ['/agent', '/agent/task123', '/text/agent']) {
    const caps = boot({ pathname: route }).site.arenaCapabilities();
    assert.equal(caps.agentContext, true, route);
    assert.equal(caps.promptContext, true, route);
    assert.equal(caps.projects, true, route);
    assert.equal(caps.personasSkills, true, route);
    for (const key of ['sharedUi', 'assistantScanning', 'mcp', 'continuity', 'memories']) assert.equal(caps[key], false, `${route} ${key}`);
  }
  for (const route of ['/text/battle', '/text/side-by-side', '/leaderboard']) {
    const caps = boot({ pathname: route }).site.arenaCapabilities();
    assert.equal(caps.agentContext, undefined, route);
    for (const value of Object.values(caps)) assert.equal(value, false, route);
  }
  assert.equal(boot({ pathname: '/text/direct' }).site.arenaCapabilities().agentContext, undefined);
});

test('the verified user text gets project, persona, memory and matched skills — and no tag protocol or MCP', async () => {
  const p = boot();
  p.type('please audit the ledger and my preferred language');
  await post(p, { id: 'x1', message: { role: 'user', parts: [{ type: 'text', text: 'please audit the ledger and my preferred language' }] }, recaptchaV3Token: 'T' });
  assert.equal(p.sent.length, 1);
  const body = p.bodyOf(0);
  const text = body.message.parts[0].text;
  assert.ok(text.endsWith('\n\nplease audit the ledger and my preferred language'), text.slice(-80));
  assert.match(text, /Ledger/);
  assert.match(text, /Use double entry bookkeeping\./);
  assert.match(text, /Speak plainly\./);
  assert.match(text, /Bangla/);
  assert.match(text, /Check totals twice\./);
  assert.match(text, /keep using Arena's native web search/);
  assert.doesNotMatch(text, /SYS-TAG-PROTOCOL|APH:AUTO:MCP|mcp\.example|RESTRICTED-SKILL/, 'no tag protocol, MCP block or mode-restricted skill');
  assert.doesNotMatch(text, /roses/, 'unrelated always-memory is withheld');
  assert.equal(body.id, 'x1');
  assert.equal(body.recaptchaV3Token, 'T');
});

test('fails closed: no typed snapshot, GET, cross-origin, telemetry URL, ambiguous, missing or non-JSON text', async () => {
  const cases = [];
  let p = boot(); // nothing typed
  await post(p, { message: 'hello agent' });
  cases.push(p);
  p = boot(); p.type('hello agent');
  await p.win.fetch(AGENT_URL, { method: 'GET' });
  cases.push(p);
  p = boot(); p.type('hello agent');
  await post(p, { message: 'hello agent' }, 'https://evil.example/collect');
  cases.push(p);
  p = boot(); p.type('hello agent');
  await post(p, { message: 'hello agent' }, 'https://arena.ai/api/telemetry/event');
  cases.push(p);
  p = boot(); p.type('hello agent');
  await post(p, { message: 'hello agent', title: 'hello agent' });
  cases.push(p);
  p = boot(); p.type('hello agent');
  await post(p, { message: 'something else entirely' });
  cases.push(p);
  p = boot(); p.type('hello agent');
  await p.win.fetch(AGENT_URL, { method: 'POST', headers: PLAIN, body: 'not json' });
  cases.push(p);
  for (const c of cases) {
    assert.equal(c.sent.length, 1);
    const raw = c.sent[0].init && c.sent[0].init.body;
    assert.ok(!/ArenaPilot|Ledger/.test(String(raw || '')), 'request must be byte-for-byte unchanged');
  }
  // a snapshot older than a minute is ignored
  p = boot(); p.type('hello agent');
  const realNow = Date.now; Date.now = () => realNow() + 61000;
  try { await post(p, { message: 'hello agent' }); } finally { Date.now = realNow; }
  assert.equal(p.bodyOf(0).message, 'hello agent');
});

test('Battle, leaderboard and unknown pages never use the Agent patcher', async () => {
  for (const route of ['/text/battle', '/leaderboard', '/code']) {
    const p = boot({ pathname: route });
    p.type('hello agent');
    await post(p, { message: 'hello agent' });
    assert.equal(p.bodyOf(0).message, 'hello agent', route);
  }
});

test('follow-up turns in the same Agent chat do not repeat unchanged project, persona or skills', async () => {
  const p = boot({ pathname: '/agent/chat1' });
  p.type('audit the ledger');
  await post(p, { message: 'audit the ledger' });
  assert.match(p.bodyOf(0).message, /Use double entry bookkeeping\./);
  p.type('audit the ledger again please');
  await post(p, { message: 'audit the ledger again please' });
  const second = p.bodyOf(1).message;
  assert.doesNotMatch(second, /Use double entry bookkeeping\.|Speak plainly\.|Check totals twice\./);
  assert.ok(second.endsWith('audit the ledger again please'));
});

test('a new Agent chat that gets its id after the first send does not repeat context within the same task', async () => {
  const p = boot({ pathname: '/agent' });
  p.type('audit the ledger');
  await post(p, { message: 'audit the ledger' });
  assert.match(p.bodyOf(0).message, /Use double entry bookkeeping\./);
  assert.equal(p.win.__sdAgentSent.path, '/agent');
  p.navigate('/agent/created1');
  p.type('audit the ledger totals');
  await post(p, { message: 'audit the ledger totals' });
  assert.doesNotMatch(p.bodyOf(1).message, /Use double entry bookkeeping\./);
});

test('system-prompt switch off leaves project, persona and skills out; memory switch off leaves memory out', async () => {
  let p = boot({ config: { ...CFG, disableSystemPrompt: true, disableMemory: false } });
  p.type('audit the ledger and my preferred language');
  await post(p, { message: 'audit the ledger and my preferred language' });
  let text = p.bodyOf(0).message;
  assert.match(text, /Bangla/);
  assert.doesNotMatch(text, /Use double entry|Speak plainly|Check totals/);
  p = boot({ config: { ...CFG, disableSystemPrompt: false, disableMemory: true } });
  p.type('audit the ledger and my preferred language');
  await post(p, { message: 'audit the ledger and my preferred language' });
  text = p.bodyOf(0).message;
  assert.doesNotMatch(text, /Bangla/);
  assert.match(text, /Use double entry/);
  p = boot({ config: { ...CFG, disableSystemPrompt: true, disableMemory: true } });
  p.type('audit the ledger');
  await post(p, { message: 'audit the ledger' });
  assert.equal(p.bodyOf(0).message, 'audit the ledger');
});

test('a stale config for another path never leaks context into this Agent request', async () => {
  const p = boot({ pathname: '/agent/a' });
  p.ctx.location.pathname = '/agent/b';
  p.type('audit the ledger');
  await post(p, { message: 'audit the ledger' });
  assert.equal(p.bodyOf(0).message, 'audit the ledger');
});

test('a persona restricted to modes is not applied to Agent', async () => {
  const p = boot({ config: { ...CFG, activeCharacter: { id: 'c2', name: 'Narrow', usage: '', modes: ['webdev'], content: 'ONLY-CODE-PERSONA' } } });
  p.type('audit the ledger');
  await post(p, { message: 'audit the ledger' });
  assert.doesNotMatch(p.bodyOf(0).message, /ONLY-CODE-PERSONA/);
});

test('a Request object input is rewritten without losing its method or headers', async () => {
  const p = boot();
  p.type('audit the ledger');
  const req = new Request(AGENT_URL, { method: 'POST', headers: { 'content-type': 'application/json', 'x-keep': '1' }, body: JSON.stringify({ message: 'audit the ledger' }) });
  await p.win.fetch(req);
  const sent = p.sent[0].input;
  assert.equal(sent.method, 'POST');
  assert.equal(sent.headers.get('x-keep'), '1');
  assert.match(JSON.parse(await sent.text()).message, /Use double entry bookkeeping\./);
});

test('content script: Agent chats own projects by id; the picker and draft binding are Agent-aware', () => {
  const route = BUNDLE.slice(BUNDLE.indexOf('function sdProjectRoute(){'), BUNDLE.indexOf('function sdRestoreProject(){'));
  const restore = BUNDLE.slice(BUNDLE.indexOf('function sdRestoreProject(){'), BUNDLE.indexOf('function sdCommitSelection(){'));
  const run = (pathname, direct, agent) => {
    const c = { location: { pathname }, sdsIsArena: () => true, sdsArenaDirect: () => direct, sdsArenaCapability: (n) => agent && n === 'agentContext' };
    vm.createContext(c);
    vm.runInContext(route, c);
    return JSON.parse(JSON.stringify(vm.runInContext('sdProjectRoute()', c)));
  };
  assert.deepEqual(run('/agent', false, true), { path: '/agent', chat: null, home: true, agent: true });
  assert.deepEqual(run('/agent/t1', false, true), { path: '/agent/t1', chat: 't1', home: false, agent: true });
  assert.deepEqual(run('/agent/c/t2', false, true), { path: '/agent/c/t2', chat: 't2', home: false, agent: true });
  assert.equal(run('/agent/c', false, true).chat, null);
  assert.deepEqual(run('/agent/t1', false, false), { path: '', chat: null, home: false }, 'no capability, no project routing');
  assert.equal(run('/c/abc', true, false).chat, 'abc', 'Direct routing is unchanged');
  assert.match(restore, /__sdAgentSent/);
  assert.match(BUNDLE, /\(sdsArenaDirect\(\)\|\|sdsArenaCapability\("agentContext"\)\)/);
});
