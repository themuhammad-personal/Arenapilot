/**
 * Super DeepSeek — real-engine harness (Layer 2).
 *
 * Runs the REAL engine bundle (injected.js → content.css/our-skin.css →
 * content.js → sd-native.js + sd-agent.js + sd-sheets.js + sd-health.js —
 * exactly MainActivity's order) inside a real Chromium against a fixture
 * page that behaves like chat.deepseek.com (composer, message rows with the
 * hashed classes, streaming replies, send/stop toggle, history endpoints,
 * SPA navigation). The fake `AndroidBridge` keeps an in-memory store and a
 * scriptable sandbox; every call is recorded and mirrored to localStorage so
 * the log survives a reload.
 *
 * Screenshots go to tools/harness/artifacts/ (never committed).
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(here, '../..');
const ENGINE_DIR = path.join(REPO_ROOT, 'android/app/src/main/bds-assets/bds');
export const ARTIFACTS = path.join(here, 'artifacts');

/** MainActivity.injectBdsScripts() order. */
export const ENGINE_SEQUENCE = [
  { file: 'sd-site.js' },
  { file: 'injected.js' },
  { file: 'content.css', css: true },
  { file: 'our-skin.css', css: true },
  { file: 'content.js' },
  { file: 'sd-native.js' },
  { file: 'sd-agent.js' },
  { file: 'sd-sheets.js' },
  { file: 'sd-health.js' },
];

export async function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  // A system Chrome beats the bundled one (CI runners ship /usr/bin/google-chrome).
  for (const p of ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']) {
    if (fs.existsSync(p)) return p;
  }
  const chromium = require('@sparticuz/chromium');
  return chromium.executablePath();
}

export async function launchBrowser() {
  const puppeteer = require('puppeteer-core');
  // @sparticuz/chromium ships Lambda-flavoured flags (--single-process,
  // --no-zygote) that crash a desktop Chrome. Use them only for the bundled
  // binary; a system Chrome (CI: PUPPETEER_EXECUTABLE_PATH) gets plain flags.
  const useBundled = !process.env.PUPPETEER_EXECUTABLE_PATH;
  const chromium = require('@sparticuz/chromium');
  const executablePath = await resolveExecutablePath();
  const args = useBundled
    ? chromium.args
    : ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--font-render-hinting=none'];
  return puppeteer.launch({
    executablePath,
    args,
    headless: true,
    defaultViewport: { width: 412, height: 915, isMobile: true, hasTouch: true },
  });
}

const FIXTURE_HTML = fs.readFileSync(path.join(here, 'fixture/chat.html'), 'utf8');

/**
 * The in-page AndroidBridge double. `sandboxOutputs` maps a tool name (or
 * `run:<command substring>`) to the text the tool "produces"; every call is
 * recorded in window.__harness.bridge.calls and mirrored to localStorage.
 */
export function fakeBridgeSource({ locale = 'en-US' } = {}) {
  return `window.__harness = {
    bridge: { calls: [], store: {}, acts: [], studio: [], picks: [], fetches: [], logs: [] },
    events: [],
  };
(function () {
  var H = window.__harness;
  function persist() {
    try { localStorage.setItem('harness_log', JSON.stringify({
      calls: H.bridge.calls, acts: H.bridge.acts, studio: H.bridge.studio, fetches: H.bridge.fetches })); } catch (_) {}
  }
  function rec(kind, entry) {
    H.bridge.calls.push(Object.assign({ kind: kind, at: Date.now() }, entry));
    persist();
    return H.bridge.calls.length;
  }
  window.__harnessRestore = function () {
    try {
      var prev = JSON.parse(localStorage.getItem('harness_log') || 'null');
      if (prev) { H.bridge.calls = prev.calls || []; H.bridge.acts = prev.acts || []; H.bridge.studio = prev.studio || []; H.bridge.fetches = prev.fetches || []; }
    } catch (_) {}
  };
  window.__harnessClear = function () {
    H.bridge.calls = []; H.bridge.acts = []; H.bridge.studio = []; H.bridge.fetches = [];
    localStorage.removeItem('harness_log');
  };

  var FS = window.__sandboxFS = window.__sandboxFS || {};
  var OUTPUTS = window.__sandboxOutputs = window.__sandboxOutputs || {};

  function toolText(name, args) {
    if (name === 'run') {
      var cmd = String((args && args.command) || '');
      for (var key in OUTPUTS) {
        if (key.indexOf('run:') === 0 && cmd.indexOf(key.slice(4)) >= 0) return String(OUTPUTS[key]);
      }
      return String(OUTPUTS.run !== undefined ? OUTPUTS.run : 'ok');
    }
    if (OUTPUTS[name] !== undefined) return String(OUTPUTS[name]);
    return 'ok';
  }

  function mcpResult(name, args) {
    rec('mcp', { tool: name, args: args });
    if (name === 'write_file') { FS[String(args.path)] = String(args.content || ''); }
    if (name === 'read_file') return String(FS[String(args.path)] !== undefined ? FS[String(args.path)] : 'no such file');
    if (name === 'list_dir') return Object.keys(FS).join('\\n') || '(empty)';
    if (name === 'status') return 'Linux sandbox: Alpine 3.20 (x86_64), working\\nWorkspace: /root/workspace';
    return toolText(name, args);
  }

  window.__setSandboxOutputs = function (map) { OUTPUTS = window.__sandboxOutputs = map || {}; };

  window.AndroidBridge = {
    getStorage: function (k) { return (k in H.bridge.store) ? H.bridge.store[k] : null; },
    setStorage: function (k, v) { H.bridge.store[k] = String(v); persist(); },
    removeStorage: function (k) { delete H.bridge.store[k]; persist(); },
    getSystemLocale: function () { return ${JSON.stringify(locale)}; },
    reportTheme: function (isDark) { rec('theme', { isDark: !!isDark }); },
    pickFiles: function (mode, requestId) { H.bridge.picks.push({ mode: mode, requestId: requestId }); },
    downloadBlob: function () { rec('download', {}); },
    performHaptic: function () {},
    vibrate: function () {},
    getAssetUrl: function (p) { return 'https://chat.deepseek.com/bds/' + String(p || ''); },
    releaseBlob: function () {},
    onUiPolished: function () { rec('uiPolished', {}); },
    openStudio: function () { H.bridge.studio.push(Date.now()); persist(); },
    sandboxAgentActive: function (active) { H.bridge.acts.push(!!active); persist(); },
    sandboxStop: function () { rec('sandboxStop', {}); return 0; },
    sandboxReset: function () { rec('sandboxReset', {}); return true; },
    sandboxInfo: function () {
      return JSON.stringify({ supported: true, enabled: true, mode: 'auto', installed: true,
        distro: 'Alpine', version: '3.20', abi: 'x86_64', freeBytes: 512 * 1024 * 1024 });
    },
    sandboxContext: function () {
      return JSON.stringify({ installed: true, mode: 'auto', jobs: 0 });
    },
    fetch: function (payloadJson) {
      var payload = {};
      try { payload = JSON.parse(payloadJson || '{}'); } catch (e) { return JSON.stringify({ ok: false, error: 'bad json' }); }
      H.bridge.fetches.push(payload);
      persist();
      if (payload.type === 'bds-mcp-list-tools') {
        return JSON.stringify({ ok: true, tools: ['run', 'job', 'read_file', 'write_file', 'edit_file',
          'list_dir', 'install_packages', 'preview', 'export_file', 'status'].map(function (n) {
            return { name: n, description: n, inputSchema: { type: 'object', properties: {} } };
          }) });
      }
      if (payload.type === 'bds-mcp-call') {
        var args = payload.args || {};
        return JSON.stringify({ ok: true, result: { content: [{ type: 'text', text: mcpResult(payload.toolName, args) }] } });
      }
      if (payload.type === 'bds-fetch-url') {
        return JSON.stringify({ ok: true, status: 200, html: '<html><head><title>Fetched</title></head><body>page body</body></html>' });
      }
      return JSON.stringify({ ok: false, error: 'unsupported ' + payload.type });
    },
  };
})();`;
}

const ENGINE_HOOK = `
window.__harness.events = window.__harness.events || [];
['bds:mutation-applied', 'bds:network-error', 'bds:token-usage', 'bds:session-data'].forEach(function (type) {
  window.addEventListener(type, function (ev) {
    window.__harness.events.push({ type: type, at: Date.now(),
      detail: typeof ev.detail === 'string' ? ev.detail.slice(0, 2000) : ev.detail });
  });
});
`;

/** Load the engine in MainActivity's exact order. */
export async function installEngine(page) {
  for (const step of ENGINE_SEQUENCE) {
    const src = fs.readFileSync(path.join(ENGINE_DIR, step.file), 'utf8');
    if (step.css) {
      await page.evaluate((css, id) => {
        let el = document.getElementById(id);
        if (!el) {
          el = document.createElement('style');
          el.id = id;
          document.head.appendChild(el);
        }
        el.textContent += css;
      }, src, 'bds-css');
    } else {
      // Global eval: engine files share top-level declarations exactly like
      // WebView.evaluateJavascript (page.evaluate wraps strings as expressions).
      await page.evaluate((code) => (0, eval)(code), src);
    }
  }
  await page.evaluate((code) => (0, eval)(code), ENGINE_HOOK);
  // What UiPolish signals natively once the enhanced page is live.
  await page.evaluate(() => { window.AndroidBridge.onUiPolished(); });
}

/** One harness session: fixture page + fake bridge + real engine. */
export async function reinstallBridge(page, opts = {}) {
  await page.evaluate((code) => (0, eval)(code), fakeBridgeSource(opts));
  if (opts.restoreLog) await page.evaluate(() => window.__harnessRestore());
}

export async function openSession(browser, opts = {}) {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });

  await page.setRequestInterception(true);
  page.on('request', (req) => {
    const url = req.url();
    if (url.startsWith('https://chat.deepseek.com/api/')) {
      req.respond({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          // completion: SSE-shaped body, so injected.js's usage parser sees data lines
          object: 'chat.completion.chunk',
          choices: [{ delta: { content: '' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
          __fixture: true,
        }),
      }).catch(() => {});
      return;
    }
    if (req.resourceType() === 'document' && url.startsWith('https://chat.deepseek.com/')) {
      req.respond({ status: 200, contentType: 'text/html; charset=utf-8', body: FIXTURE_HTML }).catch(() => {});
      return;
    }
    if (url.startsWith('https://chat.deepseek.com/bds/')) {
      const rel = url.replace('https://chat.deepseek.com/bds/', '');
      const file = path.join(ENGINE_DIR, rel);
      if (file.startsWith(ENGINE_DIR) && fs.existsSync(file)) {
        req.respond({ status: 200, contentType: 'text/javascript', body: fs.readFileSync(file, 'utf8') }).catch(() => {});
        return;
      }
    }
    req.abort().catch(() => {});
  });

  await page.goto('https://chat.deepseek.com/a/chat/s/fixture-chat', { waitUntil: 'domcontentloaded' });
  await reinstallBridge(page, opts);
  await installEngine(page);
  await page.waitForSelector('#bds-root, textarea#chat-input', { timeout: 15000 }).catch(() => {});
  return { page, consoleErrors };
}

export async function shot(page, name) {
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  const file = path.join(ARTIFACTS, name + '.png');
  await page.screenshot({ path: file });
  return file;
}

export async function bridgeState(page) {
  return page.evaluate(() => ({
    calls: window.__harness.bridge.calls.slice(),
    acts: window.__harness.bridge.acts.slice(),
    studio: window.__harness.bridge.studio.slice(),
    fetches: window.__harness.bridge.fetches.slice(),
    events: window.__harness.events.slice(),
  }));
}

export async function setBeats(page, beats) {
  await page.evaluate((b) => window.__fixtureSetBeats(b), beats);
}

export async function setSandboxOutputs(page, map) {
  await page.evaluate((m) => window.__setSandboxOutputs(m), map);
}

export function mcpCalls(state) {
  return state.calls.filter((c) => c.kind === 'mcp');
}
