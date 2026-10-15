// Phase 5 — the request body on arena.ai Direct Chat, end to end.
//
// injected.js rewrites an outgoing chat request so the engine's system prompt,
// memories, skills and tool-tag instructions reach the model — the whole basis
// of the high features (Deep Research, the Linux sandbox). Its two body shapes
// were DeepSeek's: `prompt` (a string) and `messages[]`. arena's Direct Chat
// sends neither:
//
//   POST /nextjs-api/stream/create-evaluation          (first turn)
//   POST /nextjs-api/stream/post-to-evaluation/{id}    (every later turn)
//     {id, mode:'direct-battle', modelAId, userMessageId, modelAMessageId,
//      userMessage:{content, experimental_attachments, metadata},
//      modality:'chat', recaptchaV3Token}
//
// (evidence: gpt4free's Arena provider, OwlusMain/arena_watcher and
// diegosouzapw/OmniRoute, three independent clients that send exactly this).
// Until now the rewriter passed such a request through untouched, so on arena
// nothing was ever injected. The plan had modelled the shape on Agent mode's
// create-chat (`message.parts[]`) — a different endpoint.
//
// These tests run the REAL sd-site.js and the REAL injected.js in one vm, the
// way the app injects them, and look at what reaches the page's own fetch.
// The DeepSeek scenarios are GOLDEN: their expected output was captured from
// the shipped file BEFORE the arena branch existed.
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

/**
 * sd-site.js, then injected.js, in a vm at `host`. `fetch` is a recorder: what
 * the page's own fetch is finally called with is what the server would get.
 */
function boot({ host = 'chat.deepseek.com', config = null } = {}) {
  const sent = [];
  const xhrSent = [];
  const dispatched = [];
  const events = new EventTarget();
  const store = new Map();
  const win = {
    addEventListener: (...a) => events.addEventListener(...a),
    removeEventListener: (...a) => events.removeEventListener(...a),
    dispatchEvent: (e) => { dispatched.push({ type: e.type, detail: e.detail }); return events.dispatchEvent(e); },
    fetch: async (input, init) => {
      sent.push({ input, init });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
    console: { ...console, warn() {} },
  };
  const ctx = {
    window: win,
    console: win.console,
    document: { querySelector: () => null, querySelectorAll: () => [], cookie: '', documentElement: {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    },
    navigator: { language: 'en' },
    location: { host, hostname: host, href: `https://${host}/` },
    CustomEvent, Event, EventTarget, Headers, Request, Response, URL, URLSearchParams, TextDecoder, TextEncoder,
    XMLHttpRequest: function () {}, setTimeout, clearTimeout, JSON, Promise, Date, Math, Array, Object, String, Number, Map, Set,
    encodeURIComponent, decodeURIComponent,
  };
  ctx.XMLHttpRequest.prototype = { open() {}, send(body) { xhrSent.push(body); }, setRequestHeader() {}, addEventListener() {} };
  ctx.globalThis = ctx;
  win.localStorage = ctx.localStorage;
  win.XMLHttpRequest = ctx.XMLHttpRequest;
  win.location = ctx.location;
  win.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext(SITE, ctx);
  vm.runInContext(INJECTED, ctx);
  if (config) win.dispatchEvent(new CustomEvent('bds:config-update', { detail: JSON.stringify(config) }));
  return { win, ctx, sent, dispatched, xhrSent };
}

/** What reached the page's own fetch, in a comparable shape. */
const outgoing = (s) => ({
  input: typeof s.input === 'string' ? s.input : String(s.input && s.input.url),
  headers: Object.fromEntries(new Headers(s.init && s.init.headers)),
  body: s.init && s.init.body,
  credentials: s.init && s.init.credentials,
});

const BASE = { systemPrompt: 'SYS', memories: [{ key: 'name', value: 'Muhammad', importance: 'always' }] };
const DS = 'https://chat.deepseek.com/api/v0/chat/completion';
const JSON_HEADERS = { 'content-type': 'application/json' };

// ── 1. DeepSeek is unchanged (golden) ───────────────────────────────────────

const GOLDEN = {
  "G1_first": [
    {
      "input": "https://chat.deepseek.com/api/v0/chat/completion",
      "headers": {
        "content-type": "application/json"
      },
      "body": "{\"chat_session_id\":\"S1\",\"parent_message_id\":null,\"prompt\":\"<SuperDeepSeek>\\nSYS\\n</SuperDeepSeek>\\n\\n<SuperDeepSeek>\\n<SDS:memory_calls importance=\\\"always\\\">name: Muhammad</SDS:memory_calls>\\n</SuperDeepSeek>\\n\\nhello\",\"ref_file_ids\":[]}"
    }
  ],
  "G2_followup": [
    {
      "input": "https://chat.deepseek.com/api/v0/chat/completion",
      "headers": {
        "content-type": "application/json"
      },
      "body": "{\"chat_session_id\":\"S1\",\"parent_message_id\":7,\"message_id\":8,\"prompt\":\"<SuperDeepSeek>\\n<SDS:memory_calls importance=\\\"always\\\">name: Muhammad</SDS:memory_calls>\\n</SuperDeepSeek>\\n\\nand then?\",\"ref_file_ids\":[]}"
    }
  ],
  "G3_always": [
    {
      "input": "https://chat.deepseek.com/api/v0/chat/completion",
      "headers": {
        "content-type": "application/json"
      },
      "body": "{\"chat_session_id\":\"S1\",\"parent_message_id\":7,\"prompt\":\"<SuperDeepSeek>\\nSYS\\n</SuperDeepSeek>\\n\\n<SuperDeepSeek>\\n<SDS:memory_calls importance=\\\"always\\\">name: Muhammad</SDS:memory_calls>\\n</SuperDeepSeek>\\n\\nagain\",\"ref_file_ids\":[]}"
    }
  ],
  "G4_messages": [
    {
      "input": "https://chat.deepseek.com/api/v0/chat/completion",
      "headers": {
        "content-type": "application/json"
      },
      "body": "{\"model\":\"deepseek-chat\",\"messages\":[{\"role\":\"user\",\"content\":\"<SuperDeepSeek>\\nSYS\\n</SuperDeepSeek>\\n\\n<SuperDeepSeek>\\n<SDS:memory_calls importance=\\\"always\\\">name: Muhammad</SDS:memory_calls>\\n</SuperDeepSeek>\\n\\nhi\"}]}"
    }
  ],
  "G5_ctype": [
    {
      "input": "https://chat.deepseek.com/api/v0/chat/completion",
      "headers": {
        "content-type": "application/json"
      },
      "body": "{\"chat_session_id\":\"S2\",\"parent_message_id\":null,\"prompt\":\"<SuperDeepSeek>\\nSYS\\n</SuperDeepSeek>\\n\\n<SuperDeepSeek>\\n<SDS:memory_calls importance=\\\"always\\\">name: Muhammad</SDS:memory_calls>\\n</SuperDeepSeek>\\n\\nx\"}"
    }
  ],
  "G6_other": [
    {
      "input": "https://chat.deepseek.com/api/v0/other",
      "headers": {
        "content-type": "application/json"
      },
      "body": "{\"prompt\":\"x\"}"
    }
  ]
};

async function dsRun(cfg, calls) {
  const { win, sent } = boot({ config: { ...BASE, ...cfg } });
  for (const [url, init] of calls) await win.fetch(url, init);
  // the goldens are JSON: an undefined `credentials` is an absent key there
  return JSON.parse(JSON.stringify(sent.map(outgoing)));
}

test('DeepSeek golden: a first message gets the system prompt and memories, as it always did', async () => {
  const got = await dsRun({}, [[DS, { method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ chat_session_id: 'S1', parent_message_id: null, prompt: 'hello', ref_file_ids: [] }) }]]);
  assert.deepEqual(got, GOLDEN.G1_first);
});

test('DeepSeek golden: a follow-up gets the memories but not the system prompt again', async () => {
  const got = await dsRun({}, [[DS, { method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ chat_session_id: 'S1', parent_message_id: 7, message_id: 8, prompt: 'and then?', ref_file_ids: [] }) }]]);
  assert.deepEqual(got, GOLDEN.G2_followup);
});

test('DeepSeek golden: frequency "always" injects on a follow-up too', async () => {
  const got = await dsRun({ systemPromptInjectionFrequency: 'always' }, [[DS, { method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ chat_session_id: 'S1', parent_message_id: 7, prompt: 'again', ref_file_ids: [] }) }]]);
  assert.deepEqual(got, GOLDEN.G3_always);
});

test('DeepSeek golden: an OpenAI-style messages[] body is injected into the last user message', async () => {
  const got = await dsRun({}, [[DS, { method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: 'hi' }] }) }]]);
  assert.deepEqual(got, GOLDEN.G4_messages);
});

test('DeepSeek golden: a rewritten request still says application/json, charset or not', async () => {
  const got = await dsRun({}, [[DS, { method: 'POST', headers: { 'content-type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ chat_session_id: 'S2', parent_message_id: null, prompt: 'x' }) }]]);
  assert.deepEqual(got, GOLDEN.G5_ctype);
});

test('DeepSeek golden: a request that is not a completion is left alone', async () => {
  const got = await dsRun({}, [['https://chat.deepseek.com/api/v0/other', { method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ prompt: 'x' }) }]]);
  assert.deepEqual(got, GOLDEN.G6_other);
});

test('DeepSeek never rewrites an arena-shaped body', async () => {
  const body = JSON.stringify({ id: 'E1', userMessage: { content: 'hi', experimental_attachments: [], metadata: {} } });
  const got = await dsRun({}, [['https://chat.deepseek.com/nextjs-api/stream/create-evaluation',
    { method: 'POST', headers: JSON_HEADERS, body }]]);
  assert.equal(got[0].body, body);
});

// ── 2. arena Direct Chat ────────────────────────────────────────────────────

const ARENA = 'https://arena.ai';
const CREATE = `${ARENA}/nextjs-api/stream/create-evaluation`;
const POST = (id) => `${ARENA}/nextjs-api/stream/post-to-evaluation/${id}`;
const PLAIN = { 'content-type': 'text/plain;charset=UTF-8', 'x-request-id': 'req-1' };

/** The body arena's own client sends for a Direct Chat turn. */
function turn(id, content, extra = {}) {
  return {
    id,
    mode: 'direct-battle',
    modelAId: '0199e8e9-01ed-73e0-96ba-cf43b286bf10',
    userMessageId: 'u-1',
    modelAMessageId: 'm-1',
    userMessage: { content, experimental_attachments: [], metadata: {} },
    modality: 'chat',
    recaptchaV3Token: 'RECAPTCHA-TOKEN',
    ...extra,
  };
}

const SYS_BLOCK = '<SuperDeepSeek>\nSYS\n</SuperDeepSeek>';
const MEM_BLOCK = '<SuperDeepSeek>\n<SDS:memory_calls importance="always">name: Muhammad</SDS:memory_calls>\n</SuperDeepSeek>';

async function arenaRun(cfg, calls) {
  const run = boot({ host: 'arena.ai', config: { ...BASE, disableSystemPrompt: false, disableMemory: false, ...cfg } });
  for (const [url, body, headers] of calls) {
    await run.win.fetch(url, { method: 'POST', headers: headers || PLAIN, credentials: 'include', body: typeof body === 'string' ? body : JSON.stringify(body) });
  }
  return { ...run, out: run.sent.map(outgoing) };
}

test('arena: the first turn carries the system prompt and memories in userMessage.content', async () => {
  const { out } = await arenaRun({}, [[CREATE, turn('E1', 'hello')]]);
  const sent = JSON.parse(out[0].body);
  assert.equal(sent.userMessage.content, `${SYS_BLOCK}\n\n${MEM_BLOCK}\n\nhello`);
  assert.equal(out[0].input, CREATE);
});

test('arena: nothing but userMessage.content changes — not a key, not their order', async () => {
  const body = turn('E1', 'hello', { modelBId: undefined });
  const { out } = await arenaRun({}, [[CREATE, body]]);
  const original = JSON.parse(JSON.stringify(body));
  const sent = JSON.parse(out[0].body);
  const stripped = (b) => ({ ...b, userMessage: { ...b.userMessage, content: '' } });
  assert.deepEqual(stripped(sent), stripped(original));
  assert.deepEqual(Object.keys(sent), Object.keys(original), 'key order');
  assert.deepEqual(Object.keys(sent.userMessage), ['content', 'experimental_attachments', 'metadata']);
  assert.equal(sent.recaptchaV3Token, 'RECAPTCHA-TOKEN', 'the page-minted token is untouched');
});

test('arena: the request keeps the headers and credentials the page chose', async () => {
  const { out } = await arenaRun({}, [[CREATE, turn('E1', 'hello')]]);
  assert.equal(out[0].headers['content-type'], 'text/plain;charset=UTF-8',
    'arena sends its JSON as text/plain — it must not be turned into application/json');
  assert.equal(out[0].headers['x-request-id'], 'req-1');
  assert.equal(out[0].credentials, 'include');
});

test('arena: a follow-up (post-to-evaluation) does not repeat the system prompt', async () => {
  const { out } = await arenaRun({}, [
    [CREATE, turn('E1', 'hello')],
    [POST('E1'), turn('E1', 'and then?')],
  ]);
  assert.equal(JSON.parse(out[1].body).userMessage.content, `${MEM_BLOCK}\n\nand then?`);
});

test('arena: frequency "always" injects on every turn', async () => {
  const { out } = await arenaRun({ systemPromptInjectionFrequency: 'always' }, [
    [CREATE, turn('E1', 'one')],
    [POST('E1'), turn('E1', 'two')],
  ]);
  assert.ok(JSON.parse(out[0].body).userMessage.content.startsWith(SYS_BLOCK));
  assert.ok(JSON.parse(out[1].body).userMessage.content.startsWith(SYS_BLOCK));
});

test('arena: frequency "every_x" counts this conversation’s own turns', async () => {
  const cfg = { systemPromptInjectionFrequency: 'every_x', systemPromptInjectionInterval: 2 };
  const calls = [[CREATE, turn('E1', 't1')]];
  for (let i = 2; i <= 5; i += 1) calls.push([POST('E1'), turn('E1', `t${i}`)]);
  const { out } = await arenaRun(cfg, calls);
  const has = (i) => JSON.parse(out[i].body).userMessage.content.startsWith(SYS_BLOCK);
  assert.deepEqual([0, 1, 2, 3, 4].map(has), [true, false, true, false, true], 'turns 1, 3 and 5');
});

test('arena: two conversations are counted separately', async () => {
  const cfg = { systemPromptInjectionFrequency: 'every_x', systemPromptInjectionInterval: 2 };
  const { out } = await arenaRun(cfg, [
    [CREATE, turn('E1', 'a1')],
    [CREATE, turn('E2', 'b1')],
    [POST('E1'), turn('E1', 'a2')],
    [POST('E2'), turn('E2', 'b2')],
  ]);
  const has = (i) => JSON.parse(out[i].body).userMessage.content.startsWith(SYS_BLOCK);
  assert.deepEqual([0, 1, 2, 3].map(has), [true, true, false, false]);
});

test('arena: text the user pasted from an earlier injected message is stripped before re-injecting', async () => {
  const pasted = `${SYS_BLOCK}\n\nwhat I typed`;
  const { out } = await arenaRun({}, [[CREATE, turn('E1', pasted)]]);
  const content = JSON.parse(out[0].body).userMessage.content;
  assert.equal(content, `${SYS_BLOCK}\n\n${MEM_BLOCK}\n\nwhat I typed`);
  assert.equal(content.split('SYS').length - 1, 1, 'one system prompt, not two');
});

test('arena: bds:mutation-applied reports the conversation id and what was added', async () => {
  const { dispatched } = await arenaRun({}, [[CREATE, turn('E9', 'hello')]]);
  const ev = dispatched.find((d) => d.type === 'bds:mutation-applied');
  assert.ok(ev, 'the engine is told, as on DeepSeek');
  const detail = JSON.parse(ev.detail);
  assert.equal(detail.conversationId, 'E9');
  assert.equal(detail.userPrompt, 'hello');
  assert.ok(detail.injectedText.includes('SYS'));
});

test('arena: an over-long message is truncated to the profile’s input limit', async () => {
  const cfg = { modelInputLimits: { instant: 400, vision: 400, expert: 400, deepthink: 400 } };
  const { out } = await arenaRun(cfg, [[CREATE, turn('E1', 'x'.repeat(2000))]]);
  const content = JSON.parse(out[0].body).userMessage.content;
  assert.equal(content.length, 400);
  assert.ok(content.endsWith('...[truncated by Super DeepSeek]...'));
});

test('arena: with nothing to inject the body is passed through untouched', async () => {
  const body = JSON.stringify(turn('E1', 'hello'));
  const { out } = await arenaRun({ systemPrompt: '', memories: [], disableSystemPrompt: true, disableMemory: true }, [[CREATE, body]]);
  assert.equal(out[0].body, body, 'identical bytes, no re-serialisation');
});

// ── 2b. Direct Chat only ────────────────────────────────────────────────────

test('arena: the two-model modes are never rewritten (owner decision: Direct Chat only)', async () => {
  for (const mode of ['battle', 'side-by-side']) {
    const body = JSON.stringify(turn('E1', 'hello', { mode }));
    const { out } = await arenaRun({}, [[CREATE, body]]);
    assert.equal(out[0].body, body, `${mode}: byte for byte`);
  }
});

test('arena: only known Direct Chat modes inject', async () => {
  for (const mode of ['direct-battle', 'direct']) {
    const body = turn('E1', 'hello');
    if (mode === undefined) delete body.mode; else body.mode = mode;
    const { out } = await arenaRun({}, [[CREATE, body]]);
    assert.ok(JSON.parse(out[0].body).userMessage.content.startsWith(SYS_BLOCK), String(mode));
  }
});

// ── 3. what must never be rewritten ─────────────────────────────────────────

test('arena: shapes the adapter does not know are passed through byte for byte', async () => {
  const shapes = {
    agentParts: JSON.stringify({ message: { id: 'm', role: 'user', parts: [{ type: 'text', text: 'hi' }] }, recaptchaV3Token: 't' }),
    contentNotAString: JSON.stringify(turn('E1', 'x', { userMessage: { content: ['x'], metadata: {} } })),
    noUserMessage: JSON.stringify({ id: 'E1', mode: 'direct-battle' }),
    notJson: 'this is not json',
  };
  for (const [name, body] of Object.entries(shapes)) {
    const { out } = await arenaRun({}, [[CREATE, body]]);
    assert.equal(out[0].body, body, name);
  }
});

test('arena: requests that are not Direct Chat sends are never rewritten', async () => {
  const body = JSON.stringify(turn('E1', 'hello'));
  const others = [
    `${ARENA}/nextjs-api/stream/stop/E1/messages/M1`,
    `${ARENA}/nextjs-api/stream/rerun/E1`,
    `${ARENA}/nextjs-api/stream/resample/E1`,
    `${ARENA}/nextjs-api/stream/retry-evaluation-session-message/E1/messages/M1`,
    `${ARENA}/nextjs-api/stream/create-chat`,
    `${ARENA}/api/chat/E1/messages`,
  ];
  for (const url of others) {
    const { out } = await arenaRun({}, [[url, body]]);
    assert.equal(out[0].body, body, url);
  }
});

test('arena: responses of unrelated /messages URLs are not cloned, parsed or announced', async () => {
  const { win, dispatched } = boot({ host: 'arena.ai', config: BASE });
  await win.fetch(`${ARENA}/nextjs-api/stream/stop/E1/messages/M1`, { method: 'POST', headers: PLAIN, body: '{}' });
  await win.fetch(`${ARENA}/api/chat/E1/messages?limit=20`, { method: 'GET' });
  const types = dispatched.map((d) => d.type);
  assert.ok(!types.includes('bds:session-data'), 'no DeepSeek-shaped session event');
  assert.ok(!types.includes('bds:history-msgs'), 'no DeepSeek-shaped history event');
});

// ── 4. the engine's own history fetch ───────────────────────────────────────

test('arena: the engine never calls a history URL built from a DeepSeek template', async () => {
  const { win, sent } = boot({ host: 'arena.ai', config: BASE });
  win.dispatchEvent(new CustomEvent('bds:request-history-msgs', { detail: JSON.stringify({ sessionId: 'E1' }) }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sent.length, 0, 'no request was made');
});

test('DeepSeek still fetches its history, with the user’s credentials, exactly as before', async () => {
  const { win, sent } = boot({ host: 'chat.deepseek.com', config: BASE });
  win.dispatchEvent(new CustomEvent('bds:request-history-msgs', { detail: JSON.stringify({ sessionId: 'S1' }) }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(sent.length, 1);
  assert.equal(outgoing(sent[0]).input, '/api/v0/chat/history_messages?chat_session_id=S1');
  assert.equal(outgoing(sent[0]).credentials, 'include');
});

// ── 5. the surfaces the rewriter reads ──────────────────────────────────────

test('__sdApi: arena tells injected.js which request opens a conversation', () => {
  const read = (host) => JSON.parse(JSON.stringify(boot({ host }).win.__sdApi));
  const arena = read('arena.ai');
  assert.deepEqual(arena.completionPaths, ['/nextjs-api/stream/create-evaluation', '/nextjs-api/stream/post-to-evaluation/']);
  assert.equal(arena.firstTurn, '/nextjs-api/stream/create-evaluation');
  assert.equal(arena.explicitHistory, false);
  assert.equal(arena.sessionFetch, '__sds_off__', 'a token no URL can contain');
  assert.equal(arena.historyMessages, '__sds_off__');

  const ds = read('chat.deepseek.com');
  assert.equal(ds.firstTurn, '', 'DeepSeek tells its first turn by parent_message_id, not by URL');
  assert.equal(ds.explicitHistory, true);
});

test('create-chat (Agent mode) is not a completion path: the engine does not support that mode', () => {
  const api = JSON.parse(JSON.stringify(boot({ host: 'arena.ai' }).win.__sdApi));
  assert.ok(!api.completionPaths.some((p) => p.includes('create-chat')));
});

// ── 6. credentials ──────────────────────────────────────────────────────────
//
// injected.js can look a bearer token up (localStorage keys like /token|auth|session/i,
// an `authorization` header it sees go by) so its own history fetch can send it.
// arena authenticates with cookies, and its history endpoint is unknown, so on
// arena the engine must not read or keep any credential at all — then no later
// change (a history endpoint, a new feature) can send one anywhere by accident.

test('arena: a token in storage is never read — even if a history endpoint is enabled later', async () => {
  // a Supabase/Auth0-style session left in storage before the script loads
  const run = bootSeeded('arena.ai', {
    'sb-project-auth-token': JSON.stringify({ access_token: 'JWT-ARENA-SECRET-1234567890', refresh_token: 'r' }),
  });
  run.win.__sdApi.explicitHistory = true; // pretend a real history endpoint exists later
  run.win.dispatchEvent(new CustomEvent('bds:request-history-msgs', { detail: JSON.stringify({ sessionId: 'E1' }) }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(run.sent.length, 1, 'the request itself is made (we lifted the gate)');
  const headers = outgoing(run.sent[0]).headers;
  assert.ok(!('authorization' in headers), 'but it carries no credential');
  assert.ok(!JSON.stringify(run.sent[0]).includes('JWT-ARENA-SECRET'), 'and the secret is nowhere in it');
});

test('arena: an authorization header the page sends is not remembered either', async () => {
  const run = boot({ host: 'arena.ai', config: BASE });
  await run.win.fetch(CREATE, { method: 'POST', headers: { ...PLAIN, authorization: 'Bearer SNIFFED-TOKEN-123456789' }, body: JSON.stringify(turn('E1', 'hi')) });
  run.sent.length = 0;
  run.win.__sdApi.explicitHistory = true;
  run.win.dispatchEvent(new CustomEvent('bds:request-history-msgs', { detail: JSON.stringify({ sessionId: 'E1' }) }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(run.sent.length, 1);
  assert.ok(!JSON.stringify(run.sent[0]).includes('SNIFFED-TOKEN'), 'the sniffed header never leaves the page');
  assert.ok(!('authorization' in outgoing(run.sent[0]).headers));
});

test('DeepSeek: the token lookup and the history header are exactly as before', async () => {
  const run = bootSeeded('chat.deepseek.com', { ds_auth_token: 'T'.repeat(32) });
  run.win.dispatchEvent(new CustomEvent('bds:request-history-msgs', { detail: JSON.stringify({ sessionId: 'S1' }) }));
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(run.sent.length, 1);
  assert.equal(outgoing(run.sent[0]).headers.authorization, `Bearer ${'T'.repeat(32)}`);
});

/** boot() with localStorage pre-seeded, so injected.js sees the values when it loads. */
function bootSeeded(host, entries) {
  const sent = [];
  const events = new EventTarget();
  const store = new Map(Object.entries(entries));
  const win = {
    addEventListener: (...a) => events.addEventListener(...a),
    removeEventListener: (...a) => events.removeEventListener(...a),
    dispatchEvent: (e) => events.dispatchEvent(e),
    fetch: async (input, init) => { sent.push({ input, init }); return new Response('{}', { status: 200 }); },
    console: { ...console, warn() {} },
  };
  const ctx = {
    window: win, console: win.console,
    document: { querySelector: () => null, querySelectorAll: () => [], cookie: '', documentElement: {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    },
    navigator: { language: 'en' }, location: { host, hostname: host, href: `https://${host}/` },
    CustomEvent, Event, EventTarget, Headers, Request, Response, URL, URLSearchParams, TextDecoder, TextEncoder,
    XMLHttpRequest: function () {}, setTimeout, clearTimeout, JSON, Promise, Date, Math, Array, Object, String, Number, Map, Set,
    encodeURIComponent, decodeURIComponent,
  };
  ctx.XMLHttpRequest.prototype = { open() {}, send() {}, setRequestHeader() {}, addEventListener() {} };
  ctx.globalThis = ctx;
  win.localStorage = ctx.localStorage; win.XMLHttpRequest = ctx.XMLHttpRequest; win.location = ctx.location; win.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext(SITE, ctx);
  vm.runInContext(INJECTED, ctx);
  return { win, ctx, sent };
}

// ArenaPilot privacy contract: defaults are deny, not merely empty initial data.
test('arena privacy: no config, or everything explicitly disabled, leaves requests byte-identical', async () => {
  const secretConfig = { ...BASE, skills: [{ name: 'secret', content: 'PRIVATE SKILL' }],
    systemPromptEntries: [{ id: 's', content: 'PRIVATE MULTI', schedule: { type: 'always' } }],
    activeCharacter: { name: 'private', content: 'PRIVATE PERSONA' },
    activeProject: { name: 'private', instructions: 'PRIVATE PROJECT', files: [] },
    mcpToolSchemas: [{ serverName: 'private', toolName: 'run', inputSchema: {} }],
    preferredLang: 'bn', injectSystemDateTime: true,
    deepResearch: { enabled: true, runId: 'private-run' } };
  for (const config of [null, { ...secretConfig, disableSystemPrompt: true, disableMemory: true }]) {
    const run = boot({ host: 'arena.ai', config });
    const body = JSON.stringify(turn('privacy', 'hello'), null, 2);
    await run.win.fetch(CREATE, { method: 'POST', headers: PLAIN, body });
    assert.equal(run.sent[0].init.body, body);
    assert.equal(run.dispatched.filter((e) => e.type === 'bds:mutation-applied').length, 0);
  }
});

test('arena privacy: omitted toggles mean the v2 defaults — instructions on, memory off', async () => {
  const secretConfig = { ...BASE, skills: [{ name: 'secret', content: 'PRIVATE SKILL' }],
    systemPromptEntries: [{ id: 's', content: 'PRIVATE MULTI', schedule: { type: 'always' } }] };
  const run = boot({ host: 'arena.ai', config: secretConfig });
  const body = JSON.stringify(turn('privacy', 'hello'), null, 2);
  await run.win.fetch(CREATE, { method: 'POST', headers: PLAIN, body });
  const content = JSON.parse(run.sent[0].init.body).userMessage.content;
  assert.match(content, /PRIVATE MULTI/, 'app instructions ship without an explicit opt-in (entries supersede the single prompt)');
  assert.match(content, /PRIVATE SKILL/, 'skills ride along with instructions');
  assert.doesNotMatch(content, /Muhammad/, 'stored memory still needs its own opt-in');
});

test('arena privacy: memory-only opt-in does not leak multi-prompt, skills, persona, project or MCP', async () => {
  const { out } = await arenaRun({ disableSystemPrompt: true, disableMemory: false,
    systemPromptEntries: [{ id: 'secret', content: 'PRIVATE MULTI', schedule: { type: 'always' } }],
    skills: [{ name: 'secret', content: 'PRIVATE SKILL' }],
    activeCharacter: { name: 'secret', content: 'PRIVATE PERSONA' },
    activeProject: { name: 'secret', instructions: 'PRIVATE PROJECT', files: [] },
    mcpToolSchemas: [{ serverName: 'secret', toolName: 'run', inputSchema: {} }],
    deepResearch: { enabled: true, runId: 'private-run' },
  }, [[CREATE, turn('privacy', 'hello')]]);
  assert.equal(JSON.parse(out[0].body).userMessage.content, MEM_BLOCK + '\n\nhello');
});

test('arena privacy: instructions can be enabled without stored memory', async () => {
  const { out } = await arenaRun({ disableSystemPrompt: false, disableMemory: true }, [[CREATE, turn('privacy', 'hello')]]);
  assert.equal(JSON.parse(out[0].body).userMessage.content, SYS_BLOCK + '\n\nhello');
});

test('arena privacy: disabling again takes effect on the next request', async () => {
  const run = boot({ host: 'arena.ai', config: { ...BASE, disableSystemPrompt: false, disableMemory: false } });
  const body = JSON.stringify(turn('privacy', 'hello'));
  await run.win.fetch(CREATE, { method: 'POST', body });
  assert.match(run.sent[0].init.body, /SYS/);
  run.win.dispatchEvent(new CustomEvent('bds:config-update', { detail: JSON.stringify({ ...BASE, disableSystemPrompt: true, disableMemory: true }) }));
  await run.win.fetch(CREATE, { method: 'POST', body });
  assert.equal(run.sent[1].init.body, body);
});


test('arena privacy gate also covers real XMLHttpRequest hooks', () => {
  // v2 defaults: omitted toggles mean instructions on (memory still off).
  const cases = [
    ['explicitly off', { disableSystemPrompt: true, disableMemory: true }, false],
    ['omitted toggles (new default)', {}, true],
    ['explicitly on', { disableSystemPrompt: false, disableMemory: false }, true],
  ];
  for (const [label, flags, injects] of cases) {
    const run = boot({ host: 'arena.ai', config: { ...BASE, ...flags } });
    const xhr = new run.ctx.XMLHttpRequest();
    xhr.open('POST', CREATE);
    const body = JSON.stringify(turn('xhr-privacy', 'hello'), null, 2);
    xhr.send(body);
    assert.equal(run.xhrSent.length, 1);
    if (injects) assert.match(run.xhrSent[0], /SYS/, label);
    else assert.equal(run.xhrSent[0], body, label);
  }
});


test('arena: unknown or missing modes fail closed even after opting in', async () => {
  for (const mode of [undefined, 'agent', 'some-future-mode']) {
    const body = turn('unknown', 'plain');
    if (mode === undefined) delete body.mode; else body.mode = mode;
    const { out } = await arenaRun({}, [[CREATE, body]]);
    assert.equal(out[0].body, JSON.stringify(body));
  }
});
