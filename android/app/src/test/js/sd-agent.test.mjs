// Tests for bds/sd-agent.js (MCP activity and recovery). Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-agent.js'), 'utf8');

const enabled = (ref) => ['fixture', 'https://tools.example/mcp'].includes(ref);
const plain = (v) => JSON.parse(JSON.stringify(v));

/**
 * sd-agent in a vm context. `speed` divides every timer delay (the agent's
 * 700 ms…6 s continuity timers then take a few ms); `listeners` collects what
 * the agent registers on `document` so tests can fire (trusted) events.
 */
function load({ history = null, href = 'https://chat.deepseek.com/a/chat/s/abc', speed = 1 } = {}) {
  const events = new EventTarget();
  const calls = [];
  const store = new Map();
  const listeners = {};
  const ctx = {
    console, clearTimeout, clearInterval, Promise,
    setTimeout: (fn, ms, ...a) => setTimeout(fn, (ms || 0) / speed, ...a),
    setInterval: (fn, ms, ...a) => { const h = setInterval(fn, (ms || 0) / speed, ...a); h.unref(); return h; },
    JSON, Math, Object, Array, String, Date, WeakMap,
    Uint8Array, TextDecoder, CustomEvent,
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    navigator: { language: 'en' },
    location: { href },
    document: {
      documentElement: { lang: 'en' },
      body: null,
      querySelector: () => null,
      addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    },
    __sdEngine: { hasMcpServer: enabled },
    AndroidBridge: {
      getStorage: (k) => store.get(k), setStorage: (k,v) => store.set(k,v),
    },
    addEventListener: (...a) => events.addEventListener(...a),
    removeEventListener: (...a) => events.removeEventListener(...a),
    dispatchEvent: (e) => {
      events.dispatchEvent(e);
      if (e.type === 'bds:request-history-msgs' && history) {
        const { sessionId } = JSON.parse(e.detail);
        setTimeout(() => events.dispatchEvent(new CustomEvent('bds:history-msgs', {
          detail: JSON.stringify({ data: { biz_data: { chat_session: { id: sessionId }, chat_messages: history } } }),
        })), 5);
      }
      return true;
    },
  };
  ctx.window = ctx;
  ctx.__sdBridgeFetch = async (payload) => { calls.push(payload); return { ok: true, result: { content: [] } }; };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx);
  const fire = (type, ev) => (listeners[type] || []).forEach((fn) => fn(ev));
  return { win: ctx, calls, fire };
}

test('parses MCP tags: body JSON, args attribute, base64Args, self-closing', () => {
  const { win } = load();
  const b64 = Buffer.from(JSON.stringify({ command: 'echo "hi"' })).toString('base64url');
  const text = [
    'Plan first.',
    '<BDS:AUTO:MCP url="fixture" tool="write_file">{"path":"a_b.py","content":"x = \\"*y*\\"\\n"}</BDS:AUTO:MCP>',
    `<BDS:AUTO:MCP url="fixture" tool="run" args='{"command":"ls -la"}'>`,
    `<BDS:AUTO:MCP url="https://tools.example/mcp" tool="run" base64Args="${b64}"/>`,
  ].join('\n');
  const tags = win.__sdAgent._parseTags(text);
  assert.equal(tags.length, 3);
  assert.deepEqual(plain(win.__sdAgent._tagArgs(tags[0])), { path: 'a_b.py', content: 'x = "*y*"\n' });
  assert.deepEqual(plain(win.__sdAgent._tagArgs(tags[1])), { command: 'ls -la' });
  assert.deepEqual(plain(win.__sdAgent._tagArgs(tags[2])), { command: 'echo "hi"' });
});

test('APH tags (the current spelling) are parsed like BDS ones', () => {
  const { win } = load();
  const tags = win.__sdAgent._parseTags('<APH:AUTO:MCP url="fixture" tool="run">{"command":"echo a_b"}</APH:AUTO:MCP>');
  assert.equal(tags.length, 1);
  assert.deepEqual(plain(win.__sdAgent._tagArgs(tags[0])), { command: 'echo a_b' });
});

test('a ">" inside a quoted attribute does not end the tag', () => {
  const { win } = load();
  const tags = win.__sdAgent._parseTags(`<BDS:AUTO:MCP url="fixture" tool="run" args='{"command":"echo 1 > f"}'></BDS:AUTO:MCP>`);
  assert.equal(tags.length, 1);
  assert.deepEqual(plain(win.__sdAgent._tagArgs(tags[0])), { command: 'echo 1 > f' });
});

test('backtick-quoted attributes accept JSON containing ">" and preserve tool arguments', () => {
  const { win } = load();
  const tick = String.fromCharCode(96);
  const text = '<APH:AUTO:MCP url=' + tick + 'https://tools.example/mcp' + tick +
    ' tool=' + tick + 'run' + tick +
    ' args=' + tick + '{"command":"echo 1 > f"}' + tick + '/>';
  const tags = win.__sdAgent._parseTags(text);
  assert.equal(tags.length, 1);
  assert.equal(tags[0].attrs.url, 'https://tools.example/mcp');
  assert.equal(tags[0].attrs.tool, 'run');
  assert.deepEqual(plain(win.__sdAgent._tagArgs(tags[0])), { command: 'echo 1 > f' });
});

test('JSON fences do not break a tool tag', () => {
  const { win } = load();
  const fence = String.fromCharCode(96).repeat(3);
  const text = '<APH:AUTO:MCP url="fixture" tool="run">' + fence + 'json\n{"command":"echo split > result.txt"}\n' + fence + '</APH:AUTO:MCP>';
  const tags = win.__sdAgent._parseTags(text);
  assert.equal(tags.length, 1);
  assert.deepEqual(plain(win.__sdAgent._tagArgs(tags[0])), { command: 'echo split > result.txt' });
});

test('an incomplete backtick-quoted opener is ignored rather than becoming an executable call', () => {
  const { win } = load();
  const tick = String.fromCharCode(96);
  const incomplete = '<APH:AUTO:MCP url=' + tick + 'fixture' +
    ' tool=' + tick + 'run' + tick +
    ' args=' + tick + '{"command":"must-not-run"}';
  assert.deepEqual(plain(win.__sdAgent._parseTags(incomplete)), []);
});

test('other bridge messages pass straight through', async () => {
  const { win, calls } = load();
  await win.__sdBridgeFetch({ type: 'bds-fetch-url', url: 'https://x' });
  await win.__sdBridgeFetch({ type: 'bds-mcp-call', serverUrl: 'https://tools.example/mcp', toolName: 't', args: {} });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].serverUrl, 'https://tools.example/mcp');
});

test('after Stop, fixture calls are refused without reaching the device', async () => {
  const { win, calls } = load();
  win.__sdAgent.stop(true);

  assert.equal(win.__sdAgentStopped, true);
  const reply = await win.__sdBridgeFetch({ type: 'bds-mcp-call', serverUrl: 'fixture', toolName: 'run', args: { command: 'ls' } });
  assert.equal(reply.ok, false);
  assert.equal(calls.length, 0);
});

test('Arena Stop uses only an actionable official composer control, never DeepSeek or tool UI', () => {
  for (const scenario of ['valid', 'missing', 'disabled', 'hidden', 'tool-ui', 'ambiguous', 'unrelated']) {
    const { win } = load({ href: 'https://arena.ai/c/test' });
    let clicks = 0;
    const button = {
      disabled: scenario === 'disabled',
      getAttribute: (key) => key === 'aria-label' ? (scenario === 'unrelated' ? 'Stop sharing' : 'Stop generating') : null,
      closest: () => scenario === 'tool-ui' ? {} : null,
      getBoundingClientRect: () => ({ width: scenario === 'hidden' ? 0 : 30, height: 30 }),
      click: () => { clicks++; },
    };
    const form = { querySelectorAll: () => scenario === 'missing' ? [] : scenario === 'ambiguous' ? [button, { ...button }] : [button] };
    win.__sdSite = { id: 'arena', arenaMode: () => 'direct', arenaModality: () => 'chat', profile: { selectors: { stopButton: { selectors: ['button[aria-label*="Stop"]'] } } } };
    win.document.querySelector = (selector) => {
      assert.equal(selector, 'textarea[name="message"]', 'Arena must not scan DeepSeek icons');
      return { closest: () => form };
    };
    win.getComputedStyle = () => ({ visibility: 'visible', display: 'block' });
    win.__sdAgent.stop(true);
    // Boot/continuity timers may query unrelated controls after this test.
    win.document.querySelector = () => null;

    assert.equal(win.__sdAgentStopped, true, scenario);
    assert.equal(clicks, scenario === 'valid' ? 1 : 0, scenario);
  }
});

test('DeepSeek Stop retains its original icon-to-button action', () => {
  const { win } = load();
  let clicked = 0;
  win.document.querySelector = (selector) => {
    assert.equal(selector, '.ds-icon-stop-circle, .ds-icon-stop');
    return { closest: () => ({ click: () => { clicked++; } }) };
  };
  win.__sdAgent.stop(true);
  win.document.querySelector = () => null;
  assert.equal(clicked, 1);

});

test('tool-call spinners stop once a later message exists, or when all is idle', async () => {
  const { win } = load();
  const m1 = { id: 1, contains(x) { return x === this; } };
  const m2 = { id: 2, contains(x) { return x === this; } };
  const card = (msg) => {
    const cls = new Set(['bds-mcp-loading']);
    return { classList: { add: (c) => cls.add(c), has: (c) => cls.has(c) }, closest: () => msg, cls };
  };
  const old = card(m1);
  const current = card(m2);
  win.document.querySelectorAll = (sel) => {
    if (sel.startsWith('.bds-mcp-loading')) return [old, current].filter((c) => !c.cls.has('sd-done') && !c.cls.has('sd-stopped'));
    if (sel === '.ds-message') return [m1, m2];
    return [];
  };
  // A call is still running for the last message: only the older card is done.
  const running = win.__sdBridgeFetch({ type: 'bds-mcp-call', serverUrl: 'https://tools.example/mcp', toolName: 't', args: {} });
  assert.equal(win.__sdAgent._sweepCards(), 1);
  assert.ok(old.cls.has('sd-done'));
  assert.ok(!current.cls.has('sd-done'));
  await running;
  // Finished, but still inside the idle grace period.
  assert.equal(win.__sdAgent._sweepCards(), 1);
  // Later: idle → done.
  const realNow = win.Date.now;
  win.Date.now = () => realNow() + 10000;
  try {
    assert.equal(win.__sdAgent._sweepCards(), 0);
  } finally {
    win.Date.now = realNow;
  }
  assert.ok(current.cls.has('sd-done'));
});

const mcpResult = (tool) => '<ArenaPilot>\n[APH:AUTO] MCP Result for ' + tool + ' @ https://tools.example/mcp\n[APH:AUTO_MCP_RESULT]\n{}\n[/APH:AUTO_MCP_RESULT]\n</ArenaPilot>';

test('continuity: replies that announce more work are recognised', () => {
  const { win } = load();
  const u = win.__sdAgent._looksUnfinished;
  assert.equal(u('Files are written. Now I will run the tests:'), true);
  assert.equal(u("Let me check the output"), true);
  assert.equal(u('এখন টেস্ট চালাচ্ছি।'), true);
  assert.equal(u('Done! The app is in Downloads/app.zip.'), false);
  assert.equal(u('Should I also add dark mode?'), false);
  assert.equal(u('কাজ শেষ। ফাইলটি Downloads-এ আছে।'), false);
  assert.equal(u('Summary:\n```\nnext: x\n```\nAll tests pass.'), false);
});

test('continuity: nudge only inside a tool chain', () => {
  const { win } = load();
  const n = win.__sdAgent._nudgeFor;
  const chain = (reply) => [
    { role: 'USER', content: 'build it' },
    { role: 'ASSISTANT', content: 'x' },
    { role: 'USER', content: mcpResult('run') },
    { role: 'ASSISTANT', content: reply },
  ];
  assert.match(n(chain('Now I will install the packages:')), /without a tool call/);
  assert.equal(n(chain('All done, tests pass.')), null);
  assert.equal(n([{ role: 'USER', content: 'hi' }, { role: 'ASSISTANT', content: 'Let me think:' }]), null);
  assert.equal(n(chain('<APH:AUTO:MCP url="fixture" tool="run">{"command":"ls"}</APH:AUTO:MCP>')), null);
  assert.match(n(chain('<APH:AUTO:MCP url="fixture" tool="run">{"command":"echo "x""}</APH:AUTO:MCP>')), /valid JSON/);
  assert.equal(n([...chain('ok'), { role: 'USER', content: 'thanks' }]), null);
});

test('continuity: after a reply the engine re-checks it and an unfinished chain is nudged once', async () => {
  const history = [
    { role: 'USER', content: 'make an app' },
    { role: 'USER', content: mcpResult('write_file') },
    { role: 'ASSISTANT', content: 'Written. Now I will run it:' },
  ];
  const { win } = load({ history });
  // The agent has worked on this instruction (one fixture call went through).
  await win.__sdBridgeFetch({ type: 'bds-mcp-call', serverUrl: 'fixture', toolName: 'write_file', args: { path: 'a', content: '' } });
  let gen = true;
  const reprocessed = [];
  const sent = [];
  win.__sdEngine = { hasMcpServer: enabled,
    isGenerating: () => gen,
    reprocess: () => reprocessed.push(Date.now()),
    sendQuiet: (text, label) => { sent.push({ text, label }); },
  };
  await new Promise((r) => setTimeout(r, 700));
  gen = false;
  await new Promise((r) => setTimeout(r, 7600));
  assert.ok(reprocessed.length >= 3, 'engine asked to look at the reply again');
  assert.equal(sent.length, 1);
  assert.equal(sent[0].label, 'Agent continue');
  assert.match(sent[0].text, /^<ArenaPilot>\n\[APH:AUTO\] Agent continue\n[\s\S]*<\/ArenaPilot>$/);
});

// ── The agent loop must end: no nudge loops, no re-done work ───────────────

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const unfinishedChain = [
  { role: 'USER', content: 'make an app' },
  { role: 'USER', content: mcpResult('run') },
  { role: 'ASSISTANT', content: 'Written. Now I will run it:' },
];

/** One agent turn: a fixture call, then a reply that streams and ends. */
async function agentTurn(win, engine) {
  await win.__sdBridgeFetch({ type: 'bds-mcp-call', serverUrl: 'fixture', toolName: 'run', args: { command: 'ls' } });
  engine.gen = true;
  await wait(90);
  engine.gen = false;
  await wait(650);
}

function fakeEngine(win) {
  const engine = { gen: false, sent: [] };
  win.__sdEngine = { hasMcpServer: enabled,
    isGenerating: () => engine.gen,
    reprocess() {},
    sendQuiet: (text, label) => { engine.sent.push({ text, label }); },
  };
  return engine;
}

test('continuity: nudges are counted per instruction; tool calls in between never refill them', async () => {
  const { win, fire } = load({ history: unfinishedChain, speed: 20 });
  const engine = fakeEngine(win);
  await agentTurn(win, engine);
  assert.equal(engine.sent.length, 1);
  // The model answered the nudge by working again and stalled again.
  await agentTurn(win, engine);
  assert.equal(engine.sent.length, 2);
  // Before, every tool call reset the budget: an endless redo loop.
  await agentTurn(win, engine);
  await agentTurn(win, engine);
  assert.equal(engine.sent.length, 2, 'at most two nudges per instruction');
  // Automatic (untrusted) typing does not count as a new instruction …
  const composer = { closest: (sel) => (sel.startsWith('textarea') ? {} : null) };
  fire('input', { isTrusted: false, target: composer });
  await agentTurn(win, engine);
  assert.equal(engine.sent.length, 2);
  // … the user's own typing does.
  fire('input', { isTrusted: true, target: composer });
  await agentTurn(win, engine);
  assert.equal(engine.sent.length, 3);
});

test('continuity: a reply end is scheduled once even when the thread stops changing', async () => {
  const { win } = load({ history: unfinishedChain, speed: 20 });
  const engine = fakeEngine(win);
  let repros = 0;
  win.__sdEngine.reprocess = () => { repros++; };
  // The old watcher missed short replies that streamed between two polls; the
  // fallback ends the reply from thread evidence, but must do so exactly once
  // (reprocess or an outgoing quiet send must not retrigger the timers).
  win.__sdAgent._noteReplyEnd();
  win.__sdAgent._noteReplyEnd();
  win.__sdAgent._noteReplyEnd();
  await wait(340);
  assert.equal(repros, 3, 'exactly one reply-end schedule (REPROCESS_AT has 3 timers)');
});

test('continuity: no nudge when the agent did no work for the current instruction', async () => {
  const { win } = load({ history: unfinishedChain, speed: 20 });
  const engine = fakeEngine(win);
  engine.gen = true;
  await wait(90);
  engine.gen = false;
  await wait(650);
  assert.equal(engine.sent.length, 0);
});

test('continuity: finished replies are never taken for unfinished ones', () => {
  const { win } = load();
  const u = win.__sdAgent._looksUnfinished;
  // Closings that used to trigger a nudge ("let me", a trailing ":" before a code block).
  assert.equal(u('The app is ready. Let me know if you want any changes.'), false);
  assert.equal(u('Feel free to ask if anything is unclear.'), false);
  assert.equal(u('Run it with:\n```bash\npython3 app.py\n```'), false);
  assert.equal(u('Everything works:\n```\n$ npm test\n3 passing\n```\n'), false);
  assert.equal(u('আর কিছু লাগলে জানাবেন।'), false);
  assert.equal(u('কাজ সম্পন্ন হয়েছে, নিচে সারসংক্ষেপ:'), false);
  assert.equal(u('All tests pass ✅ You can now open the preview:'), false);
  assert.equal(u('If you want, I can also add a dark mode…'), false);
  // Real stalls are still recognised.
  assert.equal(u('Files are written. Now I will run the tests:'), true);
  assert.equal(u("Next, I'll install Flask…"), true);
  assert.equal(u('এখন টেস্ট চালাচ্ছি।'), true);
});

test('continuity: the nudge never claims the task is unfinished', () => {
  const { win } = load();
  const body = win.__sdAgent._nudgeFor([
    { role: 'USER', content: 'x' }, { role: 'USER', content: mcpResult('run') },
    { role: 'ASSISTANT', content: 'Now I will run the tests:' },
  ]);
  assert.doesNotMatch(body, /not finished/);
  assert.match(body, /If the task is complete, reply with one short line/);
  assert.match(body, /Never repeat work that is already done/);
});

// ── Scroll guard ──────────────────────────────────────────────────────────

function scrollSetup() {
  const env = load();
  let clock = 1_000_000;
  env.win.Date = { now: () => clock };
  const el = {
    nodeType: 1, clientHeight: 600, scrollHeight: 6000, top: 5400, writes: 0,
    closest: () => null,
    get scrollTop() { return this.top; },
    set scrollTop(v) { this.top = v; this.writes++; },
  };
  const scroll = () => env.fire('scroll', { target: el });
  const later = (ms) => { clock += ms; };
  const userScroll = (to) => {
    env.fire('touchstart', { isTrusted: true });
    el.top = to; scroll();
    env.fire('touchend', { isTrusted: true, touches: [] });
  };
  return { ...env, el, scroll, later, userScroll };
}

test('scroll guard: an automatic jump to the bottom never pulls a reading user down', () => {
  const { el, scroll, later, userScroll } = scrollSetup();
  scroll();                                   // at the bottom
  el.top = 5400; later(2000); scroll();
  assert.equal(el.writes, 0, 'at the bottom the chat follows freely');
  userScroll(3000);
  later(2000);
  el.top = 5400; scroll();                    // DeepSeek scrolls down after an automatic send
  assert.equal(el.top, 3000, 'the jump is undone');
  scroll();                                   // the scroll event of our own correction
  assert.equal(el.top, 3000);
  later(500);
  el.top = 4900; scroll();                    // a big jump short of the bottom (> 60% of the view)
  assert.equal(el.top, 3000);
  scroll();
  later(500);
  el.top = 3060; scroll();                    // content above grew a little
  assert.equal(el.top, 3060, 'small shifts are kept');
  later(500);
  el.top = 1000; scroll();                    // content removed: moves up are kept
  assert.equal(el.top, 1000);
});

test('scroll guard: the user always wins (own scrolls, taps, sends, other chats)', () => {
  const { win, el, scroll, later, userScroll, fire } = scrollSetup();
  scroll();
  userScroll(3000);
  later(2000);
  // A tap (e.g. the scroll-down arrow) lets the following jump through.
  fire('pointerdown', { isTrusted: true, type: 'pointerdown' });
  el.top = 5400; scroll();
  assert.equal(el.top, 5400);
  // Back at the bottom: the chat follows again.
  later(2000);
  el.top = 5400; scroll();
  assert.equal(el.top, 5400);
  // Reading higher up, the user sends a message: the late jump to the reply goes through.
  userScroll(2000);
  later(2000);
  const send = { querySelector: (sel) => (sel === '.ds-icon-send' ? {} : null) };
  fire('click', { isTrusted: true, target: { closest: () => send } });
  later(3000);
  el.top = 5400; scroll();
  assert.equal(el.top, 5400);
  // Typing is not a scroll of the user.
  userScroll(2500);
  later(2000);
  fire('keydown', { isTrusted: true, type: 'keydown', key: 'a', target: { closest: () => null } });
  el.top = 5400; scroll();
  assert.equal(el.top, 2500);
  // Another chat starts at its own bottom.
  win.location.href = 'https://chat.deepseek.com/a/chat/s/other';
  later(2000);
  el.top = 5400; scroll();
  assert.equal(el.top, 5400);
});

test('scroll guard: the agent UI and small or editable scrollers are left alone', () => {
  const { win, fire } = scrollSetup();
  const g = win.__sdAgent._scrollGuard;
  assert.ok(g.states, 'installed');
  const inside = { nodeType: 1, clientHeight: 600, scrollHeight: 6000, top: 0, closest: (sel) => (sel.includes('#bds-root') ? {} : null),
    get scrollTop() { return this.top; }, set scrollTop(v) { throw new Error('must not write ' + v); } };
  fire('scroll', { target: inside });
  inside.top = 5400;
  fire('scroll', { target: inside });
  const tiny = { nodeType: 1, clientHeight: 80, scrollHeight: 900, top: 0, closest: () => null,
    get scrollTop() { return this.top; }, set scrollTop(v) { throw new Error('must not write ' + v); } };
  fire('scroll', { target: tiny });
  tiny.top = 820;
  fire('scroll', { target: tiny });
});

// ── Continue task chip (stalled loop after a crash/reload) ─────────────────

test('stall detection: a tool call with no result is the missing-result case', () => {
  const { win } = load();
  const s = win.__sdAgent._lastTaskStall;
  const call = '<APH:AUTO:MCP url="fixture" tool="run">{"command":"ls"}</APH:AUTO:MCP>';
  assert.equal(s([{ role: 'USER', content: 'do it' }, { role: 'ASSISTANT', content: call }]), 'missing-result');
  assert.equal(s([{ role: 'USER', content: 'do it' }, { role: 'ASSISTANT', content: 'Running:\n' + call }]), 'missing-result');
  // A result arrived after the call: the chain moved on — nothing owed.
  assert.equal(s([
    { role: 'USER', content: 'do it' },
    { role: 'ASSISTANT', content: call },
    { role: 'USER', content: mcpResult('run') },
    { role: 'ASSISTANT', content: 'All done, tests pass.' },
  ]), null);
});

test('stall detection: unreadable tool tags and unfinished prose', () => {
  const { win } = load();
  const s = win.__sdAgent._lastTaskStall;
  assert.equal(s([{ role: 'ASSISTANT', content: '<APH:AUTO:MCP url="fixture" tool="run">{"command":"echo "x""}</APH:AUTO:MCP>' }]), 'unreadable');
  assert.equal(s([{ role: 'USER', content: mcpResult('run') }, { role: 'ASSISTANT', content: 'Files are written. Now I will run the tests:' }]), 'unfinished');
  assert.equal(s([{ role: 'ASSISTANT', content: 'Here is the app: https://x/app.apk. Let me know if you need a dark theme.' }]), null);
  assert.equal(s([{ role: 'USER', content: 'thanks' }]), null);
  assert.equal(s([]), null);
  assert.equal(s([{ role: 'ASSISTANT', content: '' }]), null);
});

test('stall detection: a non-fixture tool call is not our stalled chain', () => {
  const { win } = load();
  const s = win.__sdAgent._lastTaskStall;
  assert.equal(s([{ role: 'ASSISTANT', content: '<APH:AUTO:MCP url="https://other.example/mcp" tool="run">{"command":"x"}</APH:AUTO:MCP>' }]), null);
});

test('continue bodies tell the model to never repeat finished work', () => {
  const { win } = load();
  const b = win.__sdAgent._continueBody;
  for (const kind of ['missing-result', 'unreadable', 'unfinished']) {
    const body = b(kind);
    assert.match(body, /Never repeat work that is already done|never run it again/);
  }
  assert.match(b('missing-result'), /no result/);
  assert.match(b('unreadable'), /valid JSON/);
  assert.match(b('missing-result'), /if it already ran, never run it again/i);
});

test('continue chip: after a reload stall the user is offered the next step', async () => {
  const history = [
    { role: 'USER', content: 'make an app' },
    { role: 'ASSISTANT', content: 'Building first:\n<APH:AUTO:MCP url="fixture" tool="run">{"command":"ls"}</APH:AUTO:MCP>' },
  ];
  const { win } = load({ history });
  win.__sdEngine = { hasMcpServer: enabled, isGenerating: () => false, reprocess: () => {}, sendQuiet: () => {} };
  assert.equal(win.__sdAgent._continueKind(), null);
  win.__sdAgent._maybeOfferContinue();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(win.__sdAgent._continueKind(), 'missing-result');
});

test('continue chip: no offer while the model is still writing or the agent is stopped', async () => {
  const history = [
    { role: 'USER', content: 'make an app' },
    { role: 'ASSISTANT', content: 'Building first:\n<APH:AUTO:MCP url="fixture" tool="run">{"command":"ls"}</APH:AUTO:MCP>' },
  ];
  const { win } = load({ history });
  win.__sdEngine = { hasMcpServer: enabled, isGenerating: () => true, reprocess: () => {}, sendQuiet: () => {} };
  win.__sdAgent._maybeOfferContinue();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(win.__sdAgent._continueKind(), null);

  win.__sdEngine.isGenerating = () => false;
  win.__sdAgent.stop(true);
  win.__sdAgent._maybeOfferContinue();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(win.__sdAgent._continueKind(), null);
});

// ── Doctor surface ──────────────────────────────────────────────────────────
// "Everything is there but nothing works" was unactionable because every
// failure looked identical from outside. diagnose() reports what the engine
// actually knows, so one screenshot is a usable bug report.

test('diagnose reports composer, mode and tool facts without throwing', async () => {
  const { win } = load();
  const d = win.__sdAgent.diagnose();
  assert.equal(typeof d, 'object');
  assert.equal(d.version, 1);
  for (const key of ['site', 'mode', 'composer', 'send', 'generating', 'agent', 'health', 'tools']) {
    assert.ok(key in d, `diagnose reports ${key}`);
  }
  assert.equal(typeof d.agent.active, 'boolean');
  assert.equal(typeof d.composer, 'boolean');
});

test('no implicit server or device controls; continue preference keeps its v2 key', () => {
  const { win } = load();
  assert.equal(win.__sdSandboxServers, undefined);
  assert.equal(win.__sdAgent.promptContext, undefined);
  assert.equal('sandbox' in win.__sdAgent.diagnose(), false);
  win.AndroidBridge.setStorage('sd_agent_autocontinue', '0');
  assert.equal(win.__sdAgent.autoContinue(), false);
  win.__sdAgent.setAutoContinue(true);
  assert.equal(win.AndroidBridge.getStorage('sd_agent_autocontinue'), '1');
});
