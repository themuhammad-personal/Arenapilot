// arena Direct Chat — the turn recorder and the stream reader in injected.js.
//
// arena answers with a line protocol (a0:"text" · ag:"reasoning" · ad:{finishReason,usage}
// · a3:"error"), not DeepSeek's `data:` SSE. Before this, the engine never saw a reply end,
// a server error or an output-limit cut, and could not recover the RAW text of a reply.
// These tests run the REAL sd-site.js + injected.js in one vm and feed the page's fetch
// a real streaming Response.
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

const CREATE = 'https://arena.ai/nextjs-api/stream/create-evaluation';
const POST = 'https://arena.ai/nextjs-api/stream/post-to-evaluation/E1';

function streamOf(text, { abortAfter = false } = {}) {
  const enc = new TextEncoder();
  const half = Math.ceil(text.length / 2);
  return new ReadableStream({
    start(c) {
      // Two chunks, split mid-line: the reader must buffer across chunks.
      c.enqueue(enc.encode(text.slice(0, half)));
      c.enqueue(enc.encode(text.slice(half)));
      if (abortAfter) c.error(Object.assign(new Error('aborted'), { name: 'AbortError' }));
      else c.close();
    },
  });
}

/** `reply(url)` returns a Response (or throws). */
function boot(reply) {
  const events = new EventTarget();
  const seen = [];
  const win = {
    addEventListener: (...a) => events.addEventListener(...a),
    removeEventListener: (...a) => events.removeEventListener(...a),
    dispatchEvent: (e) => { seen.push({ type: e.type, detail: e.detail && JSON.parse(e.detail) }); return events.dispatchEvent(e); },
    fetch: async (input) => reply(typeof input === 'string' ? input : input.url),
    console: { ...console, warn() {} },
  };
  const store = new Map();
  const ctx = {
    window: win, console: win.console,
    document: { querySelector: () => null, querySelectorAll: () => [], cookie: '', documentElement: {} },
    localStorage: { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; } },
    navigator: { language: 'en' },
    location: { host: 'arena.ai', hostname: 'arena.ai', href: 'https://arena.ai/c/E1' },
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
  win.dispatchEvent(new CustomEvent('bds:config-update', { detail: JSON.stringify({ systemPrompt: 'SYS', disableSystemPrompt: false, memories: [], disableMemory: true }) }));
  return { win, seen };
}

const body = (content) => JSON.stringify({ id: 'E1', mode: 'direct-battle', modelAId: 'm', userMessageId: 'u', modelAMessageId: 'a', userMessage: { content, experimental_attachments: [], metadata: {} }, modality: 'chat', recaptchaV3Token: 'T' });
const send = (win, url, content) => win.fetch(url, { method: 'POST', headers: { 'content-type': 'text/plain;charset=UTF-8' }, body: body(content) });
const settle = () => new Promise((r) => setTimeout(r, 30));
const turns = (seen) => seen.filter((e) => e.type === 'bds:arena-turn').map((e) => e.detail);

const OK_STREAM = 'a0:"Hello "\na0:"wor_ld"\nad:{"finishReason":"stop","usage":{"promptTokens":11,"completionTokens":3}}\n';

test('a finished reply emits bds:token-usage (the reply-end signal that never fired on arena) and an ok turn', async () => {
  const { win, seen } = boot(() => new Response(streamOf(OK_STREAM), { status: 200, headers: { 'content-type': 'text/plain' } }));
  await send(win, CREATE, 'hi'); await settle();
  const usage = seen.filter((e) => e.type === 'bds:token-usage');
  assert.equal(usage.length, 1);
  assert.equal(usage[0].detail.inputTokens, 11);
  assert.equal(usage[0].detail.outputTokens, 3);
  assert.deepEqual(turns(seen), [{ ok: true, kind: 'done', status: 200, finishReason: 'stop', message: '', chars: 12, empty: false }]);
});

test('the raw reply text is kept exactly (underscores and tags are not eaten by markdown)', async () => {
  const raw = 'Run <APH:AUTO:MCP url=\\"sandbox\\" tool=\\"run\\">{\\"command\\":\\"ls a_b\\"}</APH:AUTO:MCP>';
  const { win } = boot(() => new Response(streamOf(`a0:"${raw}"\nad:{"finishReason":"stop"}\n`), { status: 200 }));
  await send(win, CREATE, 'go'); await settle();
  const h = JSON.parse(JSON.stringify(win.__sdArena.history()));
  assert.equal(h.length, 2);
  assert.equal(h[0].role, 'USER');
  assert.equal(h[1].role, 'ASSISTANT');
  assert.equal(h[1].content, 'Run <APH:AUTO:MCP url="sandbox" tool="run">{"command":"ls a_b"}</APH:AUTO:MCP>');
});

test('lastUser() returns what the user wrote, not the injected system prompt', async () => {
  const { win } = boot(() => new Response(streamOf(OK_STREAM), { status: 200 }));
  await send(win, CREATE, 'build me a game'); await settle();
  assert.equal(win.__sdArena.lastUser(), 'build me a game');
  const h = JSON.parse(JSON.stringify(win.__sdArena.history()));
  assert.ok(h[0].content.includes('SYS'), 'the recorded content is what was really sent');
});

test('a reply cut by the output limit reports finishReason=length', async () => {
  const { win, seen } = boot(() => new Response(streamOf('a0:"part one"\nad:{"finishReason":"length"}\n'), { status: 200 }));
  await send(win, POST, 'again'); await settle();
  assert.equal(turns(seen)[0].finishReason, 'length');
  assert.equal(turns(seen)[0].ok, true);
});

test('an a3: stream error is reported, with its message', async () => {
  const { win, seen } = boot(() => new Response(streamOf('a0:"par"\na3:"Rate limit exceeded"\n'), { status: 200 }));
  await send(win, POST, 'x'); await settle();
  const t = turns(seen)[0];
  assert.equal(t.ok, false);
  assert.equal(t.kind, 'stream-error');
  assert.equal(t.message, 'Rate limit exceeded');
});

test('HTTP 429 / 500 / 413 are reported (before only >=500 was noticed, and not for arena at all)', async () => {
  for (const status of [429, 500, 413, 403]) {
    const { win, seen } = boot(() => new Response('{"error":"nope"}', { status }));
    await send(win, POST, 'x'); await settle();
    const t = turns(seen)[0];
    assert.equal(t.ok, false, String(status));
    assert.equal(t.kind, 'http');
    assert.equal(t.status, status);
    assert.match(t.message, /nope/);
  }
});

test('an empty reply (a stream with no text) is flagged empty', async () => {
  const { win, seen } = boot(() => new Response(streamOf('ad:{"finishReason":"stop"}\n'), { status: 200 }));
  await send(win, POST, 'x'); await settle();
  assert.equal(turns(seen)[0].empty, true);
});

test('a network failure of the chat request is reported, a user abort is not', async () => {
  const a = boot(() => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(send(a.win, POST, 'x'));
  assert.equal(turns(a.seen)[0].kind, 'network');
  const b = boot(() => { throw Object.assign(new Error('x'), { name: 'AbortError' }); });
  await assert.rejects(send(b.win, POST, 'x'));
  assert.equal(turns(b.seen).length, 0, 'the user pressed Stop: nothing to recover');
});

test('a stream aborted mid-way by the user (Stop) is not an error', async () => {
  const { win, seen } = boot(() => new Response(streamOf('a0:"abc"\n', { abortAfter: true }), { status: 200 }));
  await send(win, POST, 'x'); await settle();
  assert.equal(turns(seen).length, 0);
});

test('a first-turn request starts a fresh record (a new chat does not inherit the old one)', async () => {
  const { win } = boot(() => new Response(streamOf(OK_STREAM), { status: 200 }));
  await send(win, CREATE, 'first'); await settle();
  await send(win, POST, 'second'); await settle();
  assert.equal(win.__sdArena.history().length, 4);
  await send(win, CREATE, 'new chat'); await settle();
  assert.equal(win.__sdArena.history().length, 2);
  assert.equal(win.__sdArena.lastUser(), 'new chat');
});

test('the record is bounded', async () => {
  const { win } = boot(() => new Response(streamOf(OK_STREAM), { status: 200 }));
  for (let i = 0; i < 30; i++) { await send(win, POST, 'm' + i); await settle(); }
  assert.ok(win.__sdArena.history().length <= 16);
});
