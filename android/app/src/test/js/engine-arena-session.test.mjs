// Phase 3, part 3 — the conversation marker: the last DeepSeek-only /chat/s/
// literals in content.js.
//
// Four places pulled the conversation id out of a URL or looked for a sidebar
// row, all through DeepSeek's `/chat/s/`. On arena a conversation lives at
// `/c/{id}`, so on arena those four would have found nothing: tags,
// timestamps, exports and every per-chat key would silently attach to nothing
// at all — the same class of quiet failure the composer patch fixed.
//
// These tests run the SHIPPED functions against a fake DOM and assert the
// behaviour of both sites, including that the DeepSeek patterns are compiled
// byte-for-byte as they were (`cS` keeps `[a-f0-9-]+`, the urlChanged read
// keeps its looser `[^/?#]+`).
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

const AGENT = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-agent.js'), 'utf8');

const times = (needle) => CONTENT.split(needle).length - 1;

/** The DeepSeek patterns the call sites still carry, verbatim. */
const DEEPSEEK_LOOSE_ID = '\\/chat\\/s\\/([^/?#]+)';

// ── a tiny DOM, enough for $6() ─────────────────────────────────────────────

function matchesSel(node, sel) {
  const attr = /^a\[href\*="([^"]*)"\]$/.exec(sel);
  if (attr) return node.tagName === 'A' && String(node.href).includes(attr[1]);
  return node.tagName === sel.toUpperCase();
}

function makeEl(tag, href) {
  const node = {
    nodeType: 1,
    tagName: String(tag).toUpperCase(),
    href: href || '',
    childNodes: [],
    parentNode: null,
    get children() { return node.childNodes.filter((c) => c.nodeType === 1); },
    appendChild(c) { c.parentNode = node; node.childNodes.push(c); return c; },
    matches: (sel) => matchesSel(node, sel),
    closest(sel) { for (let n = node; n && n.nodeType === 1; n = n.parentNode) if (matchesSel(n, sel)) return n; return null; },
    querySelectorAll: (sel) => collect(node).filter((n) => matchesSel(n, sel)),
    querySelector(sel) { return node.querySelectorAll(sel)[0] || null; },
  };
  return node;
}

function collect(node) {
  const out = [];
  const walk = (n) => n.childNodes.forEach((c) => { if (c.nodeType === 1) { out.push(c); walk(c); } });
  walk(node);
  return out;
}

/** A sidebar with one row per URL, plus the engine's own home link. */
function sidebar(urls) {
  const body = makeEl('body');
  urls.forEach((u) => {
    const link = makeEl('a', u);
    const title = makeEl('div');
    link.appendChild(title);
    body.appendChild(link);
  });
  const document = {
    body,
    documentElement: makeEl('html'),
    querySelectorAll: (sel) => body.querySelectorAll(sel),
    querySelector: (sel) => body.querySelector(sel),
  };
  const window = { __sdSite: undefined };
  const ctx = vm.createContext({ window, document, console });
  const names = ['sdsIsArena', 'sdsSessionId', 'sdsChatLinkSel', 'cS', 'wxe', '$6'];
  vm.runInContext(names.map(fnSource).join('\n'), ctx);
  return { body, window, run: (code) => vm.runInContext(code, ctx) };
}

// ── 1. id extraction ────────────────────────────────────────────────────────

test('cS reads DeepSeek’s id exactly as before', () => {
  const d = sidebar([]);
  d.window.__sdSite = { id: 'deepseek' };
  assert.equal(d.run('cS("https://chat.deepseek.com/a/chat/s/0f1e2d3c-4b5a-6789-abcd-ef0123456789")'),
    '0f1e2d3c-4b5a-6789-abcd-ef0123456789');
  assert.equal(d.run('cS("https://chat.deepseek.com/a/chat/s/notHex")'), null,
    'the strict [a-f0-9-] charset is preserved for the DeepSeek build');
  assert.equal(d.run('cS("https://arena.ai/c/whatever")'), null,
    'and it does not start matching arena URLs on DeepSeek');
  assert.equal(d.run('wxe !== undefined && typeof wxe'), 'function', 'wxe still wraps it');
  assert.equal(d.run('cS(null)'), null);
  assert.equal(d.run('cS("")'), null);
});

test('cS reads arena’s id from the profile’s marker', () => {
  const p = sidebar([]);
  p.window.__sdSite = { id: 'arena' };
  p.run('window.__sdUrl = { session: "/c/" }');
  assert.equal(p.run('cS("https://arena.ai/c/8e4f2a10-77bd-4a1e-9f00-1234567890ab")'),
    '8e4f2a10-77bd-4a1e-9f00-1234567890ab');
  assert.equal(p.run('cS("https://arena.ai/c/AbC_-123")'), 'AbC_-123',
    'arena ids are not restricted to DeepSeek’s hex charset');
  assert.equal(p.run('cS("https://arena.ai/c/AbC_-123?tab=1")'), 'AbC_-123', 'query cut');
  assert.equal(p.run('cS("https://arena.ai/c/AbC_-123/extra#x")'), 'AbC_-123', 'path/fragment cut');
  assert.equal(p.run('cS("https://arena.ai/c/")'), null, 'an empty id is not an id');
  assert.equal(p.run('cS("https://arena.ai/text/direct?model_a=x")'), null,
    'a new-chat URL is not a conversation');
  assert.equal(p.run('cS("https://chat.deepseek.com/a/chat/s/abc-123")'), null,
    'DeepSeek’s marker must not match on arena');
});

test('the looser urlChanged read keeps its own DeepSeek pattern', () => {
  const d = sidebar([]);
  d.window.__sdSite = { id: 'deepseek' };
  // `[^/?#]+` accepts what `[a-f0-9-]+` rejects — this site must keep accepting it.
  assert.equal(d.run(`sdsSessionId("https://chat.deepseek.com/a/chat/s/Session_9", ${JSON.stringify(DEEPSEEK_LOOSE_ID)})`),
    'Session_9');

  const p = sidebar([]);
  p.window.__sdSite = { id: 'arena' };
  p.run('window.__sdUrl = { session: "/c/" }');
  assert.equal(p.run(`sdsSessionId("https://arena.ai/c/xyz", ${JSON.stringify(DEEPSEEK_LOOSE_ID)})`), 'xyz');
});

test('a build without sd-site.js falls back to DeepSeek’s marker', () => {
  const p = sidebar([]);
  p.window.__sdSite = undefined; // no seam at all
  assert.equal(p.run(`cS("https://chat.deepseek.com/a/chat/s/abc-123")`), 'abc-123');
  assert.equal(p.run('sdsChatLinkSel()'), 'a[href*="/chat/s/"]');
});

// ── 2. the sidebar link lookup ──────────────────────────────────────────────

test('$6 finds the right chat row on each site', () => {
  const p = sidebar(['https://arena.ai/c/first', 'https://arena.ai/c/second']);
  p.window.__sdSite = { id: 'arena' };
  p.run('window.__sdUrl = { session: "/c/" }');
  assert.equal(p.run('$6("second").href'), 'https://arena.ai/c/second');
  assert.equal(p.run('$6("nope")'), null);

  const d = sidebar(['https://chat.deepseek.com/a/chat/s/aaaa', 'https://chat.deepseek.com/a/chat/s/bbbb']);
  d.window.__sdSite = { id: 'deepseek' };
  assert.equal(d.run('$6("bbbb").href'), 'https://chat.deepseek.com/a/chat/s/bbbb');
  assert.equal(d.run('$6("cccc")'), null);
});

test('an arena page with no conversation row yields null, not a wrong row', () => {
  const p = sidebar([]);
  p.window.__sdSite = { id: 'arena' };
  p.run('window.__sdUrl = { session: "/c/" }');
  assert.equal(p.run('$6("x")'), null);
  assert.equal(p.run('document.querySelectorAll(sdsChatLinkSel()).length'), 0);
});

// ── 3. the seams themselves ─────────────────────────────────────────────────

test('the sidebar lookups all ask for the site’s own marker', () => {
  assert.equal(times('function sdsChatLinkSel('), 1);
  assert.equal(times('sdsChatLinkSel()'), 5, 'one call in $6, one in Bxe, two in Y2t, one… ');
  assert.equal(times(`document.querySelectorAll(sdsChatLinkSel())`), 1);
  assert.equal(times(`s=t.closest(sdsChatLinkSel())`), 1);
  assert.equal(times(`r.target.closest(sdsChatLinkSel())`), 1);
  assert.equal(times(`s.querySelector(sdsChatLinkSel())`), 1);
  // the config value is NOT a hardcode and must survive untouched
  assert.equal(CONTENT.split(`chatLink:'a[href*="/chat/s/"]'`).length - 1, 1,
    'selectors.sidebar.chatLink is config, not a call site');
  assert.equal(CONTENT.split(`chatSession:"/chat/s/"`).length - 1, 1, 'and so is urlPatterns.chatSession');
});

test('the remaining /chat/s/ literals are config or fallbacks only', () => {
  const code = CONTENT.replace(/\/\*[\s\S]*?\*\//g, ''); // ignore the patch's own comment
  const lines = code.split('\n').filter((l) => l.includes('/chat/s/'));
  assert.ok(lines.length > 0);
  for (const line of lines) {
    const isFallback = line.includes('||"/chat/s/"') || line.includes(':"/chat/s/"');
    const isConfig = line.includes(`chatLink:'a[href*="/chat/s/"]'`) || line.includes(`chatSession:"/chat/s/"`);
    assert.ok(isFallback || isConfig, `a /chat/s/ literal is neither config nor fallback: ${line.slice(0, 160)}`);
  }
});

test('the two id reads go through the helper, keeping their own patterns', () => {
  assert.equal(times('function sdsSessionId('), 1);
  assert.equal(times('sdsSessionId('), 4, 'one definition, three call sites (including tool run-once session key)');
  assert.equal(times(`sdsSessionId(e,"\\\\/chat\\\\/s\\\\/([a-f0-9-]+)")`), 1, 'cS keeps the strict pattern');
  assert.equal(times(`sdsSessionId(location.href,"\\\\/chat\\\\/s\\\\/([^/?#]+)")`), 1,
    'the urlChanged read keeps its looser pattern');
  assert.equal(times('__sdUrl'), 19, 'seam count changed — re-audit the patched sites');
});

// ── 4. the sandbox agent's own session id ───────────────────────────────────
//
// sd-agent.js recovers a tool call's exact arguments from the site's history
// API, keyed on the conversation id it reads with its OWN `/chat/s/` regex. It
// is deliberately NOT site-aware. On arena that regex yields null, so
// exactArgs() returns the DOM-parsed payload at once. Making sessionId() match
// `/c/` alone would be a trap: requestHistory() would then wait out
// HISTORY_TIMEOUT_MS (5 s) on EVERY tool call, because arena's history response
// has a different shape (and is not even fetched — see engine-injected-payload).
// These tests make that trade-off impossible to change by accident.

test('sd-agent’s sessionId() reads DeepSeek’s marker only — arena yields null on purpose', () => {
  const sessionId = (href) => {
    const ctx = vm.createContext({ location: { href } });
    vm.runInContext(fnSourceOf(AGENT, 'sessionId'), ctx);
    return vm.runInContext('sessionId()', ctx);
  };
  assert.equal(sessionId('https://chat.deepseek.com/a/chat/s/abc-123'), 'abc-123');
  assert.equal(sessionId('https://arena.ai/c/8e4f2a10-77bd-4a1e-9f00-1234567890ab'), null);
  assert.equal(sessionId('https://arena.ai/text/direct'), null);
});

test('so exactArgs() hands arena’s payload back without waiting for a history that is not coming', () => {
  const body = fnSourceOf(AGENT, 'exactArgs');
  assert.ok(body.includes('var sid = sessionId();'));
  assert.ok(body.includes('if (!sid) return Promise.resolve(payload);'),
    'the early return is what spares arena a 5 s wait per tool call');
  assert.match(AGENT, /var HISTORY_TIMEOUT_MS = 5000;/, 'the wait this protects arena from');
  assert.equal(AGENT.split('chat\\/s\\/').length - 1, 1, 'one DeepSeek-only marker in the agent, and no arena twin');
  assert.ok(!AGENT.includes("'/c/'") && !AGENT.includes('\\/c\\/'), 'nothing in sd-agent.js reads arena’s /c/ yet');
});

/** A function's source out of a plain (non-bundled) script, by brace matching. */
function fnSourceOf(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from the file`);
  const brace = source.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') { depth -= 1; if (depth === 0) return source.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${name}`);
}


test('tool run-once session key is isolated between Arena conversations', () => {
  const ctx = vm.createContext({ window: { __sdSite: { id: 'arena' }, __sdUrl: { session: '/c/' } }, location: { href: 'https://arena.ai/c/one?model_a=x' } });
  vm.runInContext(['sdsIsArena', 'sdsSessionId', 'eF'].map(fnSource).join('\n'), ctx);
  assert.equal(vm.runInContext('eF()', ctx), 'one');
  ctx.location.href = 'https://arena.ai/c/two';
  assert.equal(vm.runInContext('eF()', ctx), 'two');
});
