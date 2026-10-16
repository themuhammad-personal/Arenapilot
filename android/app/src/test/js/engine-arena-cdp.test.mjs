// The CDP probe (android/ci/cdp_probe.mjs): looking at the real arena.ai page from
// inside the CI emulator.
//
// It talks to a WebView over the Chrome DevTools protocol, so these tests run it
// against a FAKE DevTools server: a real HTTP + WebSocket server (handshake and
// framing written out) whose "page" is a vm running the REAL tools/arena-capture
// kit on a small fake arena page. So every expression the probe sends is
// evaluated by the real kit code, and the mouse and keyboard events it sends are
// recorded. A CI round trip costs twelve minutes; getting this wrong there would
// only produce a warning, so it is made right here.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FACTS as FACTS_EXPRESSION, FILL_SET, FILL_BUTTON, FILL_CLEAR, DRAWER_FACTS as DRAWER_EXPRESSION, acceptanceFailures, annotation, annotations, chunkAnnotations, connect, packChunks, probe, report, slim, summarize, summaryAnnotations, unpackChunks } from '../../../../ci/cdp_probe.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(here, '../../../../..');
const KIT_PATH = path.join(REPO, 'tools/arena-capture/capture.js');
const KIT = fs.readFileSync(KIT_PATH, 'utf8');
const PROBE = path.join(REPO, 'android/ci/cdp_probe.mjs');

// ── a fake arena page (just enough DOM for the kit) ─────────────────────────

function matches(node, selector) {
  return String(selector).split(',').some((one) => {
    const sel = one.trim();
    if (/[ >+~]/.test(sel.replace(/\[[^\]]*\]/g, ''))) return false;
    const tokens = sel.match(/\[[^\]]+\]|#[^.#[\]\s]+|\.[^.#[\]\s]+|[a-zA-Z*][\w-]*/g) || [];
    return tokens.length > 0 && tokens.every((t) => {
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
    nodeType: 1, tagName: tag.toUpperCase(), children: [], childNodes: text ? [{ nodeType: 3, textContent: text }] : [], parentElement: null,
    attributes: Object.entries(attrs).map(([name, value]) => ({ name, value })),
    getAttribute: (n) => (Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null),
    getBoundingClientRect: () => ({ x: 10, y: 20, left: 10, top: 20, width: 100, height: 30 }),
    get textContent() { return text + node.children.map((k) => k.textContent).join(''); },
    closest(sel) { for (let n = node; n; n = n.parentElement) if (matches(n, sel)) return n; return null; },
    querySelector(sel) { return descendants(node).find((n) => matches(n, sel)) || null; },
    querySelectorAll(sel) { return descendants(node).filter((n) => matches(n, sel)); },
  };
  kids.forEach((k) => { k.parentElement = node; node.children.push(k); node.childNodes.push(k); });
  return node;
}
function descendants(root) { const out = []; (function walk(n) { n.children.forEach((c) => { out.push(c); walk(c); }); })(root); return out; }

const PRIVATE = { title: 'Quarterly plan for Acme Corp', email: 'someone@example.com', uuid: '0199e8e9-01ed-73e0-96ba-cf43b286bf10' };

/** The vm a DevTools "page" evaluates in: the fake arena page, with `fetch` and friends for the kit. */
function pageContext() {
  const composer = el('form', { class: 'flex' }, [
    el('button', { 'aria-label': 'Add files' }), el('textarea', { name: 'message', placeholder: 'Ask anything' }), el('button', { 'aria-label': 'Send message' }),
  ]);
  const side = el('nav', {}, [el('button', { 'aria-label': 'New chat' }, [], 'New chat'), el('a', { href: `/c/${PRIVATE.uuid}` }, [], PRIVATE.title)]);
  const body = el('body', {}, [el('header', {}, [el('button', { 'aria-label': 'Open sidebar' })]), side, el('main', {}, [composer])]);
  const html = el('html', { class: 'dark', lang: 'en' }, [body]);
  body.appendChild = (k) => { k.parentElement = body; body.children.push(k); body.childNodes.push(k); };
  const ctx = {
    console, JSON, Object, Array, Date, Math, Promise, RegExp, String, Number, Error, Set, Map, URL, URLSearchParams, FormData, TextDecoder, Response, Headers,
    location: { href: 'https://arena.ai/text/direct', host: 'arena.ai', pathname: '/text/direct' },
    navigator: { language: 'en-US' }, innerWidth: 390, innerHeight: 800,
    getComputedStyle: () => ({ display: 'flex', flexDirection: 'column', position: 'relative', overflowY: 'auto' }),
    setTimeout: () => 0,
    fetch: async () => new Response('{}'),
    document: {
      documentElement: html, body,
      createElement: (tag) => { const n = el(tag); let t = ''; Object.defineProperty(n, 'textContent', { get: () => t, set: (v) => { t = String(v); } }); n.style = {}; n.appendChild = (k) => { n.children.push(k); }; n.addEventListener = () => {}; return n; },
      querySelectorAll: (sel) => [html, ...descendants(html)].filter((n) => matches(n, sel)),
      querySelector: (sel) => [html, ...descendants(html)].find((n) => matches(n, sel)) || null,
    },
  };
  ctx.window = ctx;
  return vm.createContext(ctx);
}

// ── a fake DevTools server: HTTP /json + WebSocket ──────────────────────────

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function frame(text) {
  const payload = Buffer.from(text);
  let header;
  if (payload.length < 126) header = Buffer.from([0x81, payload.length]);
  else if (payload.length < 65536) { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
  else { header = Buffer.alloc(10); header[0] = 0x81; header[1] = 127; header.writeBigUInt64BE(BigInt(payload.length), 2); }
  return Buffer.concat([header, payload]);
}
/** Client frames are masked; this yields each complete text message in what has arrived so far. */
function* parseFrames(state, chunk) {
  state.buf = Buffer.concat([state.buf, chunk]);
  for (;;) {
    const b = state.buf;
    if (b.length < 2) return;
    const opcode = b[0] & 0x0f;
    let len = b[1] & 0x7f;
    let offset = 2;
    if (len === 126) { if (b.length < 4) return; len = b.readUInt16BE(2); offset = 4; }
    else if (len === 127) { if (b.length < 10) return; len = Number(b.readBigUInt64BE(2)); offset = 10; }
    const masked = !!(b[1] & 0x80);
    const maskLen = masked ? 4 : 0;
    if (b.length < offset + maskLen + len) return;
    const mask = masked ? b.subarray(offset, offset + 4) : null;
    const payload = Buffer.from(b.subarray(offset + maskLen, offset + maskLen + len));
    if (mask) for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
    state.buf = b.subarray(offset + maskLen + len);
    if (opcode === 8) return;
    if (opcode === 1) yield payload.toString('utf8');
  }
}

const FACTS = {
  host: 'arena.ai', path: '/text/direct', title: 'Arena', readyState: 'complete',
  site: { id: 'arena', version: 3 }, api: { firstTurn: '/nextjs-api/stream/create-evaluation' },
  engine: { css: true, root: true, rootChildren: 3, handleBack: 'function', engineApi: 'object', agent: 'object' },
  rail: { label: 'Advanced settings', rect: [8, 72, 240, 44], visible: true },
  attach: { toggle: 1, mount: 1, wrapper: 1, controls: 1, dropdown: 0, siteButton: [60, 700, 44, 44], overlayAligned: true, nativePlusVisible: true, nativePlusPointerIntact: true, enginePlusOverlayReady: true },
  composer: { named: 1, textareas: 1, rect: [20, 700, 340, 60] },
  skin: {
    active: true, composerTarget: 'has', sendInsideComposer: true,
    sendMinWidth: 0, viewportWidth: 320, formRect: [17, 469, 286, 100],
    sendRect: [250, 520, 44, 44], settingsDock: 'sidebar', settingsLabelDisplay: 'inline', settingsRailVisible: true, settingsRailVisible: true,
  },
  health: { present: true, version: 1, site: 'arena', ok: true, visible: true, states: ['composer:ok', 'messages:na'], notice: false },
  login: false, inputs: [{ tag: 'textarea', type: 'textarea', name: 'message', placeholder: 'Ask anything', id: '' }], textSample: 'Direct chat',
  slot: { plus: [60, 700, 44, 44], addFilesDisplay: 'flex', plusOverlay: { aligned: true, nativeVisible: true, nativePointerIntact: true, engineTargetReady: true }, group: ['div.bds-attach-menu-mount', 'button[Add files]', 'button{combobox}'], form: [17, 469, 286, 100] },
  composerControls: [{ tag: 'button', aria: 'Add files', title: null, type: null, cls: 'rounded-full', rect: [60, 700, 44, 44], svg: 'M12 5v14', hidden: false, engine: false }],
  engineMarkup: { mount: '<div class="bds-attach-menu-mount" data-bds-attach-menu-mounted="true"></div>', wrapper: '<div class="bds-attach-wrapper"></div>', controls: null },
};

/**
 * opts: targets(port) → /json list; factsThrow; noToggle; siteButton (rect found);
 * The server records `calls` (every CDP method with its params) and `labels` (snap labels).
 */
async function startFakeCdp(opts = {}) {
  const calls = [];
  const sockets = new Set(); // upgraded sockets are not tracked by server.close(): destroy them ourselves
  const state = { clickedToggle: false, sheetOpen: false, drawerOpen: false };
  const page = pageContext();
  let port = 0;
  const server = http.createServer((req, res) => {
    if (req.url === '/json') {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(opts.targets ? opts.targets(port) : [{ type: 'page', url: 'https://arena.ai/text/direct', webSocketDebuggerUrl: `ws://127.0.0.1:${port}/devtools/page/1` }]));
    } else { res.statusCode = 404; res.end(); }
  });
  function handle(msg, send) {
    calls.push({ method: msg.method, params: msg.params });
    const ok = (result = {}) => send({ id: msg.id, result });
    switch (msg.method) {
      case 'Page.reload':
        ok();
        setTimeout(() => {
          const ev = (method, params) => send({ method, params });
          ev('Network.requestWillBeSent', { requestId: 'r1', request: { url: 'https://arena.ai/api/me', method: 'GET', headers: { Authorization: 'Bearer SECRET-VALUE-1234567890', Accept: '*/*' } } });
          ev('Network.responseReceived', { requestId: 'r1', response: { status: 200, mimeType: 'application/json' } });
          ev('Network.loadingFinished', { requestId: 'r1' });
          ev('Network.requestWillBeSent', { requestId: 'r2', request: { url: 'https://arena.ai/_next/static/chunks/app.js', method: 'GET', headers: {} } });
          ev('Network.requestWillBeSent', { requestId: 'r3', request: { url: `https://arena.ai/nextjs-api/stream/post-to-evaluation/${PRIVATE.uuid}`, method: 'POST', headers: { 'Content-Type': 'text/plain' }, postData: JSON.stringify({ id: PRIVATE.uuid, mode: 'direct-battle', userMessage: { content: 'a private question' } }) } });
          ev('Network.responseReceived', { requestId: 'r3', response: { status: 200, mimeType: 'text/plain' } });
          ev('Network.loadingFinished', { requestId: 'r3' });
          ev('Runtime.consoleAPICalled', { type: 'error', args: [{ type: 'string', value: 'Minified React error #418; visit https://react.dev/errors/418?args[]=HTML' }] });
          ev('Runtime.exceptionThrown', { exceptionDetails: { text: 'Uncaught', exception: { description: 'Error: Minified React error #418\n    at Component (react)' } } });
          ev('Page.loadEventFired', { timestamp: 1 });
        }, 5);
        return;
      case 'Network.getResponseBody':
        return ok({ body: JSON.stringify({ id: PRIVATE.uuid, email: PRIVATE.email, plan: 'free' }), base64Encoded: false });
      case 'Input.dispatchMouseEvent':
        if (msg.params.type === 'mousePressed' && msg.params.x === 60 && msg.params.y === 700) {
          state.clickedToggle = true;
          if (!opts.realClickIgnored && !opts.neverOpens && opts.siteButton !== false) state.sheetOpen = true; // Arena's original Plus opens the engine sheet
        }
        if (msg.params.type === 'mousePressed' && msg.params.x === 100 && msg.params.y === 200) {
          state.internalClicked = true;
          if (!opts.neverOpens) state.sheetOpen = true; // internal fallback for hosts without Arena's button
        }
        if (msg.params.type === 'mousePressed' && msg.params.x === 60 && msg.params.y === 35) {
          state.sidebarOpen = true; // the existing Arena navigation button opens its drawer
        }
        if (msg.params.type === 'mousePressed' && msg.params.x === 8 && msg.params.y === 72) {
          state.drawerOpen = true; // the rail in the sidebar really opens settings
        }
        return ok();
      case 'Runtime.evaluate': {
        const expr = msg.params.expression;
        const marker = (/^\/\*sdp:([a-z]+)\*\//.exec(expr) || [])[1];
        const value = (v) => ok({ result: { type: typeof v, value: v } });
        const fail = (text) => ok({ exceptionDetails: { text, exception: { description: `Error: ${text}` } } });
        if (marker === 'facts') {
          if (opts.factsThrow) return fail('facts exploded');
          const facts = JSON.parse(JSON.stringify(FACTS));
          facts.rail.visible = !!state.sidebarOpen;
          facts.rail.rect = state.sidebarOpen ? [8, 72, 240, 44] : [0, 0, 0, 0];
          facts.skin.settingsDock = state.sidebarOpen ? 'native-sidebar' : 'pending';
          facts.skin.settingsLabelDisplay = state.sidebarOpen ? 'inline' : 'none';
          if (state.sidebarOpen && opts.siteButton !== false) facts.attach.siteButton = [60, 700, 44, 44];
          if (opts.siteButton === false) {
            facts.attach.siteButton = null;
            facts.attach.overlayAligned = false;
            facts.attach.nativePlusVisible = false;
            facts.attach.nativePlusPointerIntact = false;
            facts.attach.enginePlusOverlayReady = false;
          }
          if (state.sheetOpen) facts.attach.dropdown = 1;
          return value(JSON.stringify(facts));
        }
        if (marker === 'hit') {
          return value(JSON.stringify({ chain: ['button[aria-label=Add files]', 'div.flex.items-center', 'form'], viewport: [320, 616], mobileCss: true }));
        }
        if (marker === 'sheet') {
          const o = state.sheetOpen ? 1 : 0;
          return value(JSON.stringify({ dropdown: o, backdrop: o, header: o, items: o * 4, title: o, expanded: null, btnClass: 'bds-plus-btn' }));
        }
        if (marker === 'jsclick') {
          if (!opts.neverOpens) state.sheetOpen = true; // a script click opens it
          return value(true);
        }
        if (marker === 'sidegeometry') {
          return value(JSON.stringify(state.sidebarOpen && !opts.noRail
            ? { dock: 'native-sidebar', visible: true, inside: true, railRect: [8, 72, 240, 44], nativeRowRect: [8, 28, 240, 44], panelRect: [0, 0, 256, 616], nativeRowFound: true, entryFound: true, sameParent: true, hitTest: true, panelTag: 'current-visible-native-sidebar' }
            : { dock: 'pending', visible: false, inside: false, railRect: [0, 0, 0, 0], panelRect: null, nativeRowFound: false, entryFound: false, sameParent: false, hitTest: false, panelTag: null }));
        }
        if (marker === 'drawer') {
          const open = state.drawerOpen && !opts.drawerNeverOpens;
          return value(JSON.stringify(open
            ? { present: true, visible: true, rect: [0, 0, 320, 600], backdrop: true, railDock: 'native-sidebar' }
            : { present: false, visible: false, rect: null, backdrop: false, railDock: 'pending' }));
        }
        if (marker === 'back') { state.drawerOpen = false; return value(true); }
        if (marker === 'fillset') {
          if (opts.fillBroken) return value(JSON.stringify({ engine: true, set: false, valueMatches: false }));
          return value(JSON.stringify({ engine: true, set: true, valueMatches: true }));
        }
        if (marker === 'fillbtn') {
          return value(JSON.stringify({ sendButton: true, sendDisabledWhileFilled: opts.fillBtnDisabled === true }));
        }
        if (marker === 'fillclr') {
          return value(JSON.stringify({ cleared: true }));
        }
        if (marker === 'rect') {
          const found = (x, y, w, h) => value(JSON.stringify({ found: true, x, y, w, h }));
          if (expr.includes('Add files') && expr.includes(':not(.bds-plus-btn)')) return opts.siteButton === false ? value(JSON.stringify({ found: false })) : found(60, 700, 44, 44);
          if (expr.includes('bds-plus-btn')) return opts.noToggle ? value(JSON.stringify({ found: false })) : found(60, 700, 44, 44);
          if (expr.includes('Add files')) return opts.siteButton === false ? (opts.noToggle ? value(JSON.stringify({ found: false })) : found(60, 700, 44, 44)) : found(60, 700, 44, 44);
          if (expr.includes('data-bds-arena-settings-entry') || expr.includes('bds-settings-rail')) {
            if (opts.noRail) return value(JSON.stringify({ found: false }));
            return state.sidebarOpen ? found(8, 72, 240, 44) : found(0, 0, 0, 0);
          }
          return value(JSON.stringify({ found: false }));
        }
        try {
          if (marker === 'snap') calls.at(-1).label = (/snap\("([^"]+)"/.exec(expr) || [])[1];
          const out = vm.runInContext(expr, page);
          return ok({ result: { type: typeof out, value: out } });
        } catch (e) { return fail(e.message); }
      }
      default:
        return ok();
    }
  }
  server.on('upgrade', (req, socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    const accept = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + GUID).digest('base64');
    socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
    const st = { buf: Buffer.alloc(0) };
    socket.on('data', (chunk) => { for (const text of parseFrames(st, chunk)) handle(JSON.parse(text), (m) => socket.write(frame(JSON.stringify(m)))); });
    socket.on('error', () => {});
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
  return { port, calls, close: () => new Promise((r) => { sockets.forEach((sk) => sk.destroy()); server.closeAllConnections(); server.close(r); }), page };
}

async function runProbe(opts) {
  const fake = await startFakeCdp(opts);
  const cdp = await connect(`ws://127.0.0.1:${fake.port}/devtools/page/1`);
  try {
    const result = await probe(cdp, { kitSource: KIT, pageHost: 'arena.ai', wait: 0, pause: async () => {} });
    return { fake, result };
  } finally { cdp.close(); await fake.close(); }
}

// ── 1. the whole probe, end to end ──────────────────────────────────────────

test('the probe runs every step against a DevTools page and returns the engine’s facts', async () => {
  const { result } = await runProbe();
  const names = result.steps.map((s) => s.name);
  assert.deepEqual(names, ['enable', 'reload', 'facts', 'install-kit', 'snap:anon-page', 'plus-hit-test', 'plus-sheet-facts', 'engine-plus-sheet', 'arena-original-plus-trigger', 'mode-switch', 'settings-drawer', 'composer-fill', 'facts-after', 'export-kit', 'network']);
  assert.deepEqual(result.steps.filter((s) => !s.ok), [], 'every step succeeded');
  assert.equal(result.engine.site.id, 'arena');
  assert.equal(result.engine.rail.label, 'Advanced settings');
  assert.equal(result.engine.composer.named, 1);
  // page errors are counted and kept to their first line — no stacks, no page data
  assert.equal(result.console.count, 2);
  assert.equal(result.console.first[0], 'Minified React error #418; visit https://react.dev/errors/418?args[]=HTML');
  assert.ok(result.console.first.every((l) => !l.includes('\n')));
});

test('the engine’s "+" sheet is opened with a REAL pointer click on its toggle, and closed with Escape', async () => {
  const { fake, result } = await runProbe();
  const mouse = fake.calls.filter((c) => c.method === 'Input.dispatchMouseEvent').map((c) => `${c.params.type}@${c.params.x},${c.params.y}`);
  assert.deepEqual(mouse, [
    'mouseMoved@60,700', 'mousePressed@60,700', 'mouseReleased@60,700',
    'mouseMoved@60,700', 'mousePressed@60,700', 'mouseReleased@60,700',
    'mouseMoved@60,35', 'mousePressed@60,35', 'mouseReleased@60,35',
    'mouseMoved@8,72', 'mousePressed@8,72', 'mouseReleased@8,72',
  ], 'tap Arena’s original Plus, verify it again, then open the official sidebar and Settings row');
  const keys = fake.calls.filter((c) => c.method === 'Input.dispatchKeyEvent').map((c) => `${c.params.type}:${c.params.key}`);
  assert.deepEqual(keys, ['keyDown:Escape', 'keyUp:Escape', 'keyDown:Escape', 'keyUp:Escape'].slice(0, keys.length));
  assert.ok(keys.length >= 2 && keys.every((k) => k.endsWith('Escape')));
  assert.equal(result.engineSheet.dropdown, 1, 'after the click the sheet is on the page');
  assert.equal(result.engine.attach.dropdown, 0, 'and before it, it was not');
});

test('the kit’s panel is switched off before it is installed — it sat over the "+" and swallowed the real click', async () => {
  const { fake } = await runProbe();
  const order = fake.calls.filter((c) => c.method === 'Runtime.evaluate').map((c) => /^\/\*sdp:([a-z]+)\*\//.exec(c.params.expression)?.[1]);
  assert.ok(order.indexOf('nopanel') >= 0 && order.indexOf('nopanel') < order.indexOf('install'), 'no-panel first, then install');
  const nopanel = fake.calls.find((c) => c.params && c.params.expression && c.params.expression.startsWith('/*sdp:nopanel*/'));
  assert.match(nopanel.params.expression, /window\.__sdCaptureNoPanel = true/);
});

test('the kit’s panel is not drawn when a driver asks for none, and is drawn otherwise', async () => {
  const quiet = pageContext();
  vm.runInContext('window.__sdCaptureNoPanel = true', quiet);
  vm.runInContext(KIT, quiet);
  // the kit sets `panel.id` as a property, which a real DOM reflects into the attribute; the fake does not
  const panels = (ctx) => descendants(ctx.document.documentElement).filter((n) => n.id === 'sd-capture-panel' || n.getAttribute('id') === 'sd-capture-panel').length;
  assert.equal(panels(quiet), 0, 'no panel when asked for none');
  const person = pageContext();
  vm.runInContext(KIT, person);
  assert.equal(panels(person), 1, 'the panel is still drawn for a person');
});

test('the kit is installed from capture.js verbatim, and its snapshots come back with the labels asked for', async () => {
  const { fake, result } = await runProbe();
  const install = fake.calls.find((c) => c.method === 'Runtime.evaluate' && c.params.expression.startsWith('/*sdp:install*/'));
  assert.equal(install.params.expression, `/*sdp:install*/${KIT}`);
  assert.deepEqual(result.kitExport.snaps.map((s) => s.label), ['anon-page', 'engine-plus-sheet', 'arena-original-plus-trigger', 'settings-drawer']);
  const by = Object.fromEntries(result.kitExport.snaps[0].landmarks.map((l) => [l.selector, l]));
  assert.equal(by['textarea[name="message"]'].count, 1);
  assert.equal(by['textarea[name="message"]'].first.placeholder, 'Ask anything');
});

test('Arena’s original Plus is exercised only when the real button is present', async () => {
  const absent = await runProbe({ siteButton: false });
  assert.equal(absent.result.siteToggle.found, false);
  const present = await runProbe({});
  assert.equal(present.result.siteToggle.found, true);
  assert.ok(present.fake.calls.some((c) => c.method === 'Input.dispatchMouseEvent' && c.params.x === 60 && c.params.y === 700), 'clicked at the button');
  assert.deepEqual(present.result.kitExport.snaps.map((s) => s.label), ['anon-page', 'engine-plus-sheet', 'arena-original-plus-trigger', 'settings-drawer']);
});

test('a page without the engine’s toggle is reported, not clicked', async () => {
  const { fake, result } = await runProbe({ noToggle: true, siteButton: false });
  assert.equal(result.engineToggle.found, false);
  // nothing may be clicked at the missing toggle's coordinates — the drawer's
  // rail is a different element and may still get its real click
  assert.ok(!fake.calls.some((c) => c.method === 'Input.dispatchMouseEvent' && c.params.x === 100 && c.params.y === 200));
  assert.ok(result.steps.every((s) => s.ok));
});

// ── 1b. did the "+" sheet really open, and by which kind of click? ──────────

test('a real pointer click that opens the sheet is the end of it: no script click is tried', async () => {
  const { fake, result } = await runProbe();
  assert.equal(result.sheetOpenedBy, 'real-click');
  assert.equal(result.sheetAfterRealClick.dropdown, 1);
  assert.equal(result.sheetAfterJsClick, undefined);
  assert.ok(!fake.calls.some((c) => c.method === 'Runtime.evaluate' && c.params.expression.startsWith('/*sdp:jsclick*/')));
  assert.deepEqual(result.engineHit.chain.slice(0, 1), ['button[aria-label=Add files]'], 'Arena’s original Plus remains the real physical hit target');
  assert.equal(result.engineHit.mobileCss, true);
});

test('if the real click does not open it, a script click is tried — and the difference is the finding', async () => {
  const { fake, result } = await runProbe({ realClickIgnored: true });
  assert.equal(result.sheetAfterRealClick.dropdown, 0);
  assert.equal(result.sheetAfterJsClick.dropdown, 1);
  assert.equal(result.sheetOpenedBy, 'js-click');
  assert.ok(fake.calls.some((c) => c.method === 'Runtime.evaluate' && c.params.expression.startsWith('/*sdp:jsclick*/')));
  assert.match(summarize(result), /openedBy=js-click/);
});

test('if nothing opens it, that is recorded too, with both attempts', async () => {
  const { result } = await runProbe({ neverOpens: true });
  assert.equal(result.sheetOpenedBy, 'neither');
  assert.equal(result.sheetAfterRealClick.dropdown, 0);
  assert.equal(result.sheetAfterJsClick.dropdown, 0);
  assert.ok(result.steps.every((s) => s.ok), 'a sheet that will not open is a finding, not a failed step');
  assert.match(summarize(result), /openedBy=neither/);
});

// ── 2. the network, as shapes ───────────────────────────────────────────────

test('page-load requests are kept as masked shapes: ids and bodies hidden, static files skipped, header NAMES only', async () => {
  const { result } = await runProbe();
  const urls = result.network.map((n) => n.url);
  assert.deepEqual(urls, ['/api/me', '/nextjs-api/stream/post-to-evaluation/{uuid}']);
  const me = result.network[0];
  assert.equal(me.status, 200);
  assert.deepEqual(me.reqHeaders, ['accept', 'authorization'], 'the names are the point — whether a bearer header exists');
  assert.equal(me.resShape.plan, '<str len=4>');
  assert.equal(me.resShape.email, '<redacted len=19>');
  const post = result.network[1];
  assert.equal(post.reqBody.mode, 'direct-battle');
  assert.match(post.reqBody.userMessage.content, /^<str len=\d+>$/);
  const all = JSON.stringify(result);
  for (const secret of ['SECRET-VALUE', PRIVATE.email, 'a private question', PRIVATE.uuid, PRIVATE.title]) assert.ok(!all.includes(secret), `leaked: ${secret}`);
});

// ── 3. a probe never gates: steps fail alone ────────────────────────────────

test('a step that throws is recorded and the others still run', async () => {
  const { result } = await runProbe({ factsThrow: true });
  const failed = result.steps.filter((s) => !s.ok).map((s) => s.name).sort();
  assert.deepEqual(failed, ['facts', 'facts-after', 'plus-sheet-facts'], 'only the three that ask for facts — the click itself did not fail');
  assert.equal(result.sheetOpenedBy, 'real-click');
  assert.equal(result.steps.find((s) => s.name === 'engine-plus-sheet').ok, true);
  assert.match(result.steps.find((s) => s.name === 'facts').error, /facts exploded/);
  assert.equal(result.engine, undefined);
  assert.ok(result.kitExport.snaps.length >= 1, 'the kit part still ran');
  assert.ok(result.network.length >= 1, 'and so did the network part');
});

test('without capture.js the engine facts still come back', async () => {
  const fake = await startFakeCdp();
  const cdp = await connect(`ws://127.0.0.1:${fake.port}/devtools/page/1`);
  const result = await probe(cdp, { kitSource: null, pageHost: 'arena.ai', wait: 0, pause: async () => {} });
  cdp.close(); await fake.close();
  assert.equal(result.engine.site.id, 'arena');
  assert.equal(result.steps.find((s) => s.name === 'install-kit').ok, false);
  assert.equal(result.kitExport, undefined);
});

// ── 3b. the two new steps: the drawer, and the composer the engine must drive ─

test('the settings drawer is opened by a REAL click on the rail and closed by the engine’s own Back', async () => {
  const { result } = await runProbe();
  assert.equal(result.drawer.visible, true, 'opened');
  assert.equal(result.drawer.railDock, 'native-sidebar');
  assert.equal(result.settingsSidebarBeforeClick.dock, 'native-sidebar');
  assert.equal(result.settingsSidebarBeforeClick.visible, true);
  assert.equal(result.settingsSidebarBeforeClick.inside, true, 'Settings is inside the original Arena sidebar before it is clicked');
  assert.equal(result.drawerAfterBack.visible, false, 'the engine’s Back closes it');
  assert.ok(result.steps.find((s) => s.name === 'settings-drawer').ok);
  const noRail = await runProbe({ noRail: true });
  assert.equal(noRail.result.drawer.present, false);
  assert.ok(noRail.result.steps.find((s) => s.name === 'settings-drawer').ok, 'reported, not thrown');
});

test('the composer fill is captured without ever sending: fill, settle, read, clear', async () => {
  const { fake, result } = await runProbe();
  assert.deepEqual(result.composerFill, { engine: true, set: true, valueMatches: true, sendButton: true, sendDisabledWhileFilled: false, cleared: true });
  // the button state must be read AFTER the settle pause, never in the same
  // breath as the fill — the fake records the evaluate order
  const marks = fake.calls.filter((c) => c.method === 'Runtime.evaluate').map((c) => (/^\/\*sdp:([a-z]+)\*\//.exec(c.params.expression) || [])[1]);
  assert.ok(marks.indexOf('fillset') < marks.indexOf('fillbtn') && marks.indexOf('fillbtn') < marks.indexOf('fillclr'), 'fill → button → clear');
  // no key was ever pressed into the composer and the only real clicks are
  // the plus toggle and the settings rail — nothing that could send a message
  assert.ok(!fake.calls.some((c) => c.method === 'Input.dispatchKeyEvent' && c.params.key !== 'Escape'), 'no typing, no Enter — nothing that could send');
  const clicks = fake.calls.filter((c) => c.method === 'Input.dispatchMouseEvent' && c.params.type === 'mousePressed').map((c) => `${c.params.x},${c.params.y}`);
  assert.deepEqual(clicks, ['60,700', '60,700', '60,35', '8,72'],
    'only Arena’s original Plus, original sidebar button and visible Settings row are clicked');
});

test('a broken composer or a dead drawer fails the runtime gate', async () => {
  const fill = await runProbe({ fillBroken: true });
  assert.ok(acceptanceFailures(fill.result).includes('composer-not-drivable'));
  const drawer = await runProbe({ drawerNeverOpens: true });
  assert.ok(acceptanceFailures(drawer.result).includes('settings-drawer-not-openable'));
  const good = await runProbe();
  assert.deepEqual(acceptanceFailures(good.result), []);
});

test('the fill and drawer expressions really run against a page: they read the DOM, not hopes', () => {
  const ctx = pageContext();
  // a textarea with a real value property, driven by an engine like the real one
  vm.runInContext(`
    var taValue = '';
    var ta = document.querySelector('textarea[name="message"]');
    Object.defineProperty(ta, 'value', { get: function () { return taValue; }, set: function (v) { taValue = String(v); } });
    window.__sdEngine = { setComposer: function (t) { ta.value = String(t == null ? '' : t); return true; } };
    window.__sdHandleBack = function () { return true; };
  `, ctx);
  assert.deepEqual(JSON.parse(vm.runInContext(FILL_SET, ctx)), { engine: true, set: true, valueMatches: true });
  assert.deepEqual(JSON.parse(vm.runInContext(FILL_BUTTON, ctx)), { sendButton: true, sendDisabledWhileFilled: false });
  assert.deepEqual(JSON.parse(vm.runInContext(FILL_CLEAR, ctx)), { cleared: true });
  assert.equal(vm.runInContext('taValue', ctx), '', 'cleared afterwards');
  // a mounted drawer with its backdrop
  const drawer = el('div', { id: 'bds-drawer' });
  const backdrop = el('div', { class: 'bds-drawer-backdrop' });
  ctx.document.body.appendChild(drawer);
  ctx.document.body.appendChild(backdrop);
  const facts = JSON.parse(vm.runInContext(DRAWER_EXPRESSION, ctx));
  assert.equal(facts.present, true);
  assert.equal(facts.visible, true);
  assert.equal(facts.backdrop, true);
  assert.equal(facts.railDock, null, 'no rail on this page yet');
  // and with no engine at all, the fill expression says so instead of throwing
  const bare = JSON.parse(vm.runInContext(FILL_SET, pageContext()));
  assert.equal(bare.engine, false);
});

// ── 4. annotations ──────────────────────────────────────────────────────────

test('annotation(): the runner’s escaping for message and title', () => {
  assert.equal(annotation('notice', '50% done\nnext line'), '::notice::50%25 done%0Anext line');
  assert.equal(annotation('warning', 'x', 'a:b,c'), '::warning title=a%3Ab%2Cc::x');
});

test('packChunks / unpackChunks: any size round-trips, every chunk fits an annotation', () => {
  let text = '';
  for (let i = 0; i < 40000; i += 1) text += `${crypto.randomBytes(3).toString('hex')} `; // incompressible enough to need several chunks
  const chunks = packChunks(text);
  assert.ok(chunks.length >= 2, `chunks: ${chunks.length}`);
  assert.ok(chunks.every((c) => c.length <= 45000 && /^[A-Za-z0-9+/=]+$/.test(c)));
  assert.equal(unpackChunks(chunks), text);
  assert.equal(unpackChunks(packChunks('{"a":1}')), '{"a":1}');
});

test('N0 acceptance gate rejects a missing skin target or Send overflow without requiring a composer at the consent gate', () => {
  const missingSkin = { engine: JSON.parse(JSON.stringify(FACTS)) };
  missingSkin.engine.skin.active = false;
  assert.ok(acceptanceFailures(missingSkin).includes('arena-skin-inactive'));

  const missingTarget = { engine: JSON.parse(JSON.stringify(FACTS)) };
  missingTarget.engine.skin.composerTarget = 'none';
  assert.ok(acceptanceFailures(missingTarget).includes('composer-skin-target-missing'));

  const overflow = { engine: JSON.parse(JSON.stringify(FACTS)) };
  overflow.engine.skin.sendInsideComposer = false;
  assert.ok(acceptanceFailures(overflow).includes('send-outside-composer'));

  const undersizedSend = { engine: JSON.parse(JSON.stringify(FACTS)) };
  undersizedSend.engine.skin.sendRect = [250, 520, 0, 0];
  assert.ok(acceptanceFailures(undersizedSend).includes('send-target-not-visible'));

  const consentGate = { engine: JSON.parse(JSON.stringify(FACTS)) };
  consentGate.engine.composer.named = 0;
  assert.ok(!acceptanceFailures(consentGate).includes('composer-skin-target-missing'));
  assert.ok(!acceptanceFailures(consentGate).includes('send-outside-composer'));
});

test('the default output is the readable summary, the engine’s own markup and the composer’s controls — no payload', async () => {
  const { result } = await runProbe();
  const lines = annotations(result);
  assert.equal(lines.length, 3);
  assert.match(lines[0], /^::notice::CDP probe: page=arena\.ai\/text\/direct /);
  assert.match(lines[0], /rail=yes "Advanced [Ss]ettings"/i);
  assert.match(lines[0], /settingsAnchor\(dock=native-sidebar visible=yes inside=yes rect=\[8,72,240,44\]\)/);
  assert.match(lines[0], /plusSheet\(toggle=1 mount=1 wrapper=1 dropdownAfterClick=1 openedBy=real-click hit=\["button\[aria-label=Add files\]","div\.flex\.items-center","form"\] mobileCss=true\)/);
  assert.match(lines[0], /siteAttach=\[60,700,44,44\]/);
  assert.match(lines[0], /slot\(plus=\[60,700,44,44\] addFiles=flex group=\["div\.bds-attach-menu-mount","button\[Add files\]","button\{combobox\}"\]/);
  assert.match(lines[0], /fill\(set=yes value=yes sendBtn=yes sendEnabled=yes cleared=yes\)/);
  assert.match(lines[0], /skin\(active=yes composer=has sendInside=yes sendRect=\[250,520,44,44\] viewport=320 settingsDock=native-sidebar settingsLabel=inline\)/);
  assert.match(lines[0], /drawer\(visible=yes dock=native-sidebar backCloses=yes\)/);
  assert.match(lines[0], /all steps ran/);
  assert.match(lines[1], /^::notice::CDP engine markup: \{"mount":/);
  assert.match(lines[2], /^::notice::CDP composer controls: \[\{"tag":"button","aria":"Add files"/);
  assert.ok(lines.every((l) => l.length < 4096), 'each fits an annotation');
  assert.equal(summaryAnnotations(result).length, 3);
});

test('chunkAnnotations(): the whole capture in at most ten annotations, each under 4096, decodable from the lines alone', async () => {
  const { result } = await runProbe();
  const lines = chunkAnnotations(result);
  assert.match(lines[0], /^::notice::CDP capture: \d+ chunk\(s\)/);
  const chunkLines = lines.filter((l) => /^::notice title=cdp-capture-\d+-of-\d+::/.test(l));
  assert.ok(chunkLines.length >= 1 && chunkLines.length <= 10);
  assert.ok(chunkLines.every((l) => l.length < 4096), 'under what GitHub shows');
  const decoded = JSON.parse(unpackChunks(chunkLines.map((l) => l.replace(/^::notice title=[^:]*::/, ''))));
  assert.equal(decoded.engine.site.id, 'arena');
  assert.equal(decoded.network.length, 2);
});

test('a capture too big for ten chunks is slimmed, least useful detail first — never cut off mid-way', () => {
  const big = { steps: [{ name: 'x', ok: true }], engine: { site: { id: 'arena' } }, engineAfter: { site: { id: 'arena' } }, network: [], kitExport: { snaps: [] } };
  const rnd = () => crypto.randomBytes(9).toString('base64'); // incompressible
  const landmarks = Array.from({ length: 900 }, (_, i) => ({ selector: `s${i}`, count: i % 2, visible: 0, first: { tag: 'div', cls: rnd() + rnd() + rnd() } }));
  big.kitExport.snaps.push({ label: 'a', landmarks, regions: { sidebar: { tag: 'nav', cls: rnd() }, composer: { tag: 'form' } } });
  big.network = Array.from({ length: 40 }, (_, i) => ({ url: `/api/${i}`, resShape: { k: rnd() + rnd() + rnd() + rnd() + rnd() + rnd() } }));
  assert.ok(packChunks(JSON.stringify(big)).length > 10, 'the unslimmed capture does not fit');
  const lines = chunkAnnotations(big);
  assert.match(lines[0], /slimmed to level [1-4]/);
  const chunkLines = lines.filter((l) => l.includes('title=cdp-capture'));
  assert.ok(chunkLines.length <= 10);
  const decoded = JSON.parse(unpackChunks(chunkLines.map((l) => l.replace(/^::notice title=[^:]*::/, ''))));
  assert.equal(decoded.engineAfter.site.id, 'arena', 'what matters most survives every level');
  assert.ok(decoded.kitExport.snaps[0].regions.composer, 'the composer region is the last thing to go');
  assert.ok(slim(big, 1).kitExport.snaps[0].landmarks.every((l) => l.count > 0 && !l.first), 'level 1 drops absent landmarks and their detail');
  assert.equal(slim(big, 2).steps, undefined);
});

test('--report: prints the saved capture as chunks; a missing file is a warning, not a failure', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-report-'));
  const file = path.join(dir, 'cdp-capture.json');
  fs.writeFileSync(file, JSON.stringify({ engine: { site: { id: 'arena' } }, network: [] }));
  const ok = spawnSync(process.execPath, [PROBE, '--report', file], { encoding: 'utf8' });
  assert.equal(ok.status, 0);
  assert.match(ok.stdout, /::notice::CDP capture: 1 chunk\(s\)/);
  assert.match(ok.stdout, /::notice title=cdp-capture-1-of-1::/);
  const missing = spawnSync(process.execPath, [PROBE, '--report', path.join(dir, 'nope.json')], { encoding: 'utf8' });
  assert.equal(missing.status, 0);
  assert.match(missing.stdout, /::warning::no CDP capture to report/);
  assert.equal(report(path.join(dir, 'nope.json')), 0);
});

// ── 4b. the expressions that run IN the page ────────────────────────────────

test('FACTS is real JavaScript: run on a page it returns the engine’s state, including its mount markup', () => {
  const ctx = pageContext();
  ctx.__sdSite = { id: 'arena', version: 3 };
  ctx.__sdApi = { firstTurn: '/x' };
  ctx.__sdHandleBack = () => false;
  ctx.__sdHealth = { version: 1, site: 'arena', status: () => ({ ok: true, visible: true, results: [{ id: 'composer', state: 'ok' }] }) };
  const facts = JSON.parse(vm.runInContext(FACTS_EXPRESSION, ctx));
  assert.equal(facts.host, 'arena.ai');
  assert.equal(facts.site.id, 'arena');
  assert.equal(facts.engine.handleBack, 'function');
  assert.equal(facts.composer.named, 1);
  assert.deepEqual(facts.health.states, ['composer:ok']);
  assert.ok('engineMarkup' in facts, 'the engine’s mount markup is asked for');
  assert.equal(facts.attach.siteButton.length, 4, 'the site’s own attach button is found by its label on this page');
  assert.deepEqual(facts.composerControls.map((c) => c.aria), ['Add files', 'Send message'], 'every control around the message box, with its label');
  assert.ok(facts.composerControls.every((c) => c.engine === false && c.hidden === false));
  assert.equal(facts.slot.addFilesDisplay, 'flex', 'getComputedStyle of the site’s own attach button is asked for');
  assert.ok(Array.isArray(facts.slot.group) && facts.slot.group.some((g) => g.includes('[Add files]')), 'and the left group’s children, in order');
  assert.equal(facts.login, false);
});

test('FACTS survives a page with none of the engine on it', () => {
  const facts = JSON.parse(vm.runInContext(FACTS_EXPRESSION, pageContext()));
  assert.equal(facts.site, null);
  assert.equal(facts.engine.css, false);
  assert.equal(facts.rail, null);
  assert.equal(facts.health.present, false);
});

test('summarize(): says which steps failed', () => {
  const text = summarize({ steps: [{ name: 'facts', ok: false, error: 'boom' }, { name: 'reload', ok: true }], network: [] });
  assert.match(text, /FAILED STEPS: facts\(boom\)/);
  assert.match(text, /site=none/);
});

// ── 5. the command line ─────────────────────────────────────────────────────

function runCli(port, extra = []) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-out-'));
  const r = spawnSync(process.execPath, [PROBE, '--port', String(port), '--out', out, '--capture', KIT_PATH, '--wait', '0', ...extra], { encoding: 'utf8', timeout: 60000 });
  return { ...r, out, file: path.join(out, 'cdp-capture.json') };
}

test('CLI: finds the arena page, writes cdp-capture.json, prints annotations, exits 0', async () => {
  const fake = await startFakeCdp();
  const r = await new Promise((resolve) => {
    // spawnSync would block the event loop that serves the fake; run the CLI asynchronously
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-out-'));
    import('node:child_process').then(({ execFile }) => execFile(process.execPath, [PROBE, '--port', String(fake.port), '--out', out, '--capture', KIT_PATH, '--wait', '0'], { timeout: 60000 }, (err, stdout) => resolve({ code: err ? err.code : 0, stdout, out })));
  });
  await fake.close();
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^probing arena\.ai\/text\/direct$/m);
  assert.match(r.stdout, /::notice::CDP probe: page=arena\.ai/);
  const saved = JSON.parse(fs.readFileSync(path.join(r.out, 'cdp-capture.json'), 'utf8'));
  assert.equal(saved.engine.site.id, 'arena');
});

test('CLI: no page in the WebView, or nothing listening, is a warning and exit 0 — never a failure', async () => {
  const none = await startFakeCdp({ targets: () => [] });
  const r1 = await new Promise((resolve) => {
    import('node:child_process').then(({ execFile }) => execFile(process.execPath, [PROBE, '--port', String(none.port), '--out', os.tmpdir(), '--capture', KIT_PATH, '--wait', '0'], { timeout: 30000 }, (err, stdout) => resolve({ code: err ? err.code : 0, stdout })));
  });
  await none.close();
  assert.equal(r1.code, 0);
  assert.match(r1.stdout, /::warning::CDP probe: the WebView has no page target/);

  const r2 = runCli(1); // nothing listens on port 1
  assert.equal(r2.status, 0);
  assert.match(r2.stdout, /::warning::CDP probe could not run/);
});
