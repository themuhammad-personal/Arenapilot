// sd-agent.js on arena Direct Chat: the chat id, the recorded history, and recovery
// from server errors and cut-off replies. Run: npm run test:engine
//
// Root causes these pin down (found by reading the code, not by guessing):
//  - sessionId() only knew DeepSeek's /chat/s/{id}; arena's URL is /c/{id}, so it was
//    null and the keep-going nudge, the Continue chip and the exact-arguments repair
//    all returned early ("if (!sid) return") — they never ran on arena.
//  - arena has no history endpoint, so even with an id requestHistory() timed out.
//  - nothing listened for a failed or cut-off reply, so a 429, a 5xx, a dropped
//    stream or a reply cut inside a tool call just ended the task.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-agent.js'), 'utf8');

function load({ site = 'arena', href = 'https://arena.ai/c/E1', ring = [], lastUser = 'build the game', autoContinue = true, speed = 200 } = {}) {
  const events = new EventTarget();
  const sent = [];
  const toasts = [];
  const ctx = {
    console, clearTimeout, clearInterval, Promise,
    setTimeout: (fn, ms, ...a) => setTimeout(fn, (ms || 0) / speed, ...a),
    setInterval: (fn, ms, ...a) => { const h = setInterval(fn, (ms || 0) / speed, ...a); h.unref(); return h; },
    JSON, Math, Object, Array, String, Date, WeakMap, Uint8Array, TextDecoder, CustomEvent,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    navigator: { language: 'en' },
    location: { href },
    document: { documentElement: { lang: 'en' }, body: null, querySelector: () => null, addEventListener() {} },
    AndroidBridge: {
      sandboxInfo: () => JSON.stringify({ supported: true, enabled: true, mode: 'auto' }),
      sandboxStop: () => 0,
      setStorage: () => {},
      getStorage: (k) => (k === 'sd_agent_autocontinue' && !autoContinue ? '0' : ''),
      sandboxAgentActive: () => {},
    },
    addEventListener: (...a) => events.addEventListener(...a),
    removeEventListener: (...a) => events.removeEventListener(...a),
    dispatchEvent: (e) => events.dispatchEvent(e),
  };
  ctx.window = ctx;
  ctx.__sdSite = { id: site };
  ctx.__sdArena = { history: () => ring, lastUser: () => lastUser };
  ctx.__sdEngine = {
    isGenerating: () => false,
    toast: (m) => toasts.push(m),
    sendQuiet: (text, label) => { sent.push({ text, label }); },
    messageNodes: () => [],
  };
  ctx.__sdBridgeFetch = async () => ({ ok: true, result: { content: [] } });
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const turn = (d) => ctx.dispatchEvent(new CustomEvent('bds:arena-turn', { detail: JSON.stringify(d) }));
  return { win: ctx, sent, toasts, turn, ring };
}

const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));
const OK = { ok: true, kind: 'done', status: 200, finishReason: 'stop', chars: 50, empty: false };

test('sessionId: arena /c/{id}, a fresh arena chat, and DeepSeek unchanged', () => {
  assert.equal(load({ href: 'https://arena.ai/c/019abc-def' }).win.__sdAgent._sessionId(), '019abc-def');
  assert.equal(load({ href: 'https://arena.ai/text/direct' }).win.__sdAgent._sessionId(), 'arena');
  assert.equal(load({ site: 'deepseek', href: 'https://chat.deepseek.com/a/chat/s/abc' }).win.__sdAgent._sessionId(), 'abc');
  assert.equal(load({ site: 'deepseek', href: 'https://chat.deepseek.com/' }).win.__sdAgent._sessionId(), null);
});

test('arena: requestHistory returns the recorded raw turns at once (no endpoint to wait for)', async () => {
  const ring = [{ role: 'USER', content: 'hi' }, { role: 'ASSISTANT', content: 'a_b' }];
  const { win } = load({ ring });
  const h = await win.__sdAgent._requestHistory('E1');
  assert.deepEqual(JSON.parse(JSON.stringify(h)), ring);
});

test('arena: the keep-going nudge now works end to end (it was dead: no session id, no history)', async () => {
  const ring = [
    { role: 'USER', content: '<ArenaPilot>\n[APH:AUTO] MCP Result for run @ sandbox\n[APH:AUTO_MCP_RESULT]\n{"content":"ok"}\n[/APH:AUTO_MCP_RESULT]\n</ArenaPilot>' },
    { role: 'ASSISTANT', content: 'The server is up. Now I will run the tests:' },
  ];
  const { win } = load({ ring });
  const h = await win.__sdAgent._requestHistory(win.__sdAgent._sessionId());
  const body = win.__sdAgent._nudgeFor(h);
  assert.match(body, /ended without a tool call/);
});

test('classifyTurn: what is a problem and what is not', () => {
  const run = (d, last = '') => load({ ring: last ? [{ role: 'ASSISTANT', content: last }] : [] }).win.__sdAgent._classifyTurn({ ...OK, ...d });
  assert.equal(run({}), null);
  assert.equal(run({ finishReason: 'length' }), 'cut');
  assert.equal(run({ finishReason: 'max_tokens' }), 'cut');
  assert.equal(run({ finishReason: 'max-output-tokens' }), 'cut');
  assert.equal(run({ ok: false, kind: 'http', status: 429 }), 'error');
  assert.equal(run({ ok: false, kind: 'http', status: 500 }), 'error');
  assert.equal(run({ ok: false, kind: 'http', status: 503 }), 'error');
  assert.equal(run({ ok: false, kind: 'network', status: 0 }), 'error');
  assert.equal(run({ ok: false, kind: 'stream-error', message: 'x' }), 'error');
  assert.equal(run({ ok: false, kind: 'broken' }), 'error');
  assert.equal(run({ empty: true }), 'error');
  assert.equal(run({ ok: false, kind: 'http', status: 413 }), 'toobig');
  for (const st of [400, 401, 403]) assert.equal(run({ ok: false, kind: 'http', status: st }), 'fatal', String(st));
});

test('a reply that ends inside a tool call is a cut, even when the finish reason says stop', () => {
  const run = (last) => load({ ring: [{ role: 'ASSISTANT', content: last }] }).win.__sdAgent._classifyTurn(OK);
  assert.equal(run('Writing it:\n<APH:AUTO:MCP url="sandbox" tool="write_file">{"path":"a.py","content":"print('), 'cut');
  assert.equal(run('Writing it:\n<APH:AUTO:MCP url="sandbox" tool="run" args=\'{"command":"ls'), 'cut');
  assert.equal(run('Writing it:\n<APH:AUTO:MCP url="sandbox" tool="'), 'cut');
  assert.equal(run('<APH:AUTO:MCP url="sandbox" tool="run">{"command":"ls"}</APH:AUTO:MCP>'), null, 'a complete call is fine');
  assert.equal(run('<APH:AUTO:MCP url="sandbox" tool="run" base64Args="eyJ9"/>'), null, 'self-closing is complete');
  assert.equal(run('Explaining: `<APH:AUTO:MCP url="x"` is how a call starts.'), null, 'inline code is not a call');
  assert.equal(run('```\n<APH:AUTO:MCP url="sandbox" tool="run">\n```'), null, 'a fenced example is not a call');
});

test('a cut reply: the agent asks the model to continue, in smaller pieces', async () => {
  const { turn, sent, toasts } = load();
  turn({ ...OK, finishReason: 'length' });
  await wait();
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /cut off by the output length limit/);
  assert.match(sent[0].text, /append=true/);
  assert.equal(sent[0].label, 'Agent continue');
  assert.ok(toasts.some((m) => /cut off/.test(m)));
});

test('a server error: back off, then carry on and restate the last message', async () => {
  const { turn, sent, toasts } = load({ lastUser: 'build me a snake game in python' });
  turn({ ok: false, kind: 'http', status: 500, message: 'boom' });
  await wait(120);
  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /failed on the server \(HTTP 500\)/);
  assert.match(sent[0].text, /build me a snake game in python/);
  assert.ok(toasts.some((m) => /Retrying in/.test(m)));
});

test('a huge restated message is cut in the middle, not sent whole', async () => {
  const big = 'START' + 'x'.repeat(50000) + 'END';
  const { turn, sent } = load({ lastUser: big });
  turn({ ok: false, kind: 'stream-error', message: 'Rate limit exceeded' });
  await wait(120);
  assert.ok(sent[0].text.length < 7000);
  assert.ok(sent[0].text.includes('START') && sent[0].text.includes('END'));
  assert.match(sent[0].text, /Rate limit exceeded/);
});

test('HTTP 413: the model is told to re-run with less output', async () => {
  const { turn, sent } = load();
  turn({ ok: false, kind: 'http', status: 413, message: '' });
  await wait(60);
  assert.match(sent[0].text, /too large/);
  assert.match(sent[0].text, /less output/);
});

test('fatal errors (403 captcha / sign-in) are explained, never retried', async () => {
  const { turn, sent, toasts } = load();
  turn({ ok: false, kind: 'http', status: 403, message: '' });
  await wait(120);
  assert.equal(sent.length, 0);
  assert.ok(toasts.some((m) => /403/.test(m)));
});

test('the retry budget is bounded: three errors in a row, then it stops and says so', async () => {
  const { turn, sent, toasts, win } = load();
  for (let i = 0; i < 5; i++) { turn({ ok: false, kind: 'http', status: 500 }); await wait(250); }
  assert.equal(sent.length, 3);
  assert.ok(toasts.some((m) => /Stopped retrying/.test(m)));
  assert.equal(win.__sdAgent._recovery.errs, 5, 'every failure is counted, only the first three are retried');
});

test('a healthy reply resets the consecutive-error count', async () => {
  const { turn, win } = load();
  turn({ ok: false, kind: 'http', status: 500 });
  await wait(100);
  assert.equal(win.__sdAgent._recovery.errs, 1);
  turn(OK);
  assert.equal(win.__sdAgent._recovery.errs, 0);
});

test('Stop means stop: nothing is sent after the user stopped the agent', async () => {
  const { turn, sent, win } = load();
  win.__sdAgentStopped = true;
  turn({ ...OK, finishReason: 'length' });
  turn({ ok: false, kind: 'http', status: 500 });
  await wait(120);
  assert.equal(sent.length, 0);
});

test('Stop pressed while a retry is waiting cancels it', async () => {
  const { turn, sent, win } = load();
  turn({ ok: false, kind: 'http', status: 500 });
  win.__sdAgentStopped = true;
  await wait(120);
  assert.equal(sent.length, 0);
});

test('with automatic continue switched off, the user is told instead', async () => {
  const { turn, sent, toasts } = load({ autoContinue: false });
  turn({ ...OK, finishReason: 'length' });
  await wait(60);
  assert.equal(sent.length, 0);
  assert.ok(toasts.some((m) => /did not finish/.test(m)));
});

test('not arena: the engine ignores arena turns (DeepSeek build is unchanged)', async () => {
  const { turn, sent } = load({ site: 'deepseek', href: 'https://chat.deepseek.com/a/chat/s/abc' });
  turn({ ...OK, finishReason: 'length' });
  await wait(60);
  assert.equal(sent.length, 0);
});

test('diagnose() reports the recovery state', async () => {
  const { turn, win } = load();
  turn({ ...OK, finishReason: 'length' });
  await wait(60);
  const d = JSON.parse(JSON.stringify(win.__sdAgent.diagnose()));
  assert.equal(d.agent.recovery.cuts, 1);
  assert.equal(d.agent.recovery.last.kind, 'cut');
});
