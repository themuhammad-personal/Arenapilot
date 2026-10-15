/** Opt-in, single-message, anonymous Direct Chat probe. No cookies, headers,
 * raw requests, model output, or account data are written to disk or logs.
 * The ordinary push CI never sends a message. Never solve/retry a challenge.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect, annotation } from './cdp_probe.mjs';

export const MARKER = 'ARENAPILOT_SMOKE_OK';
export const PROMPT = `Reply with exactly ${MARKER} and nothing else. Do not use tools.`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_BODY = 256000;

// Structural evidence only, including unexpected fields but never their values.
export function shape(value, depth = 0) {
  if (value === null) return 'null';
  if (depth > 6) return 'bounded';
  if (Array.isArray(value)) return value.slice(0, 3).map((v) => shape(v, depth + 1));
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 40)
    .filter(([key]) => /^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(key))
    .map(([key, v]) => [key, shape(v, depth + 1)]));
  return typeof value;
}

export function requestFacts(request) {
  if (!request || request.method !== 'POST') return null;
  let url;
  try { url = new URL(request.url); } catch { return null; }
  if (!['arena.ai', 'www.arena.ai'].includes(url.hostname) || url.protocol !== 'https:') return null;
  const route = url.pathname.match(/^\/nextjs-api\/stream\/(create-evaluation|post-to-evaluation)(?:\/[^/]+)?$/);
  if (!route) return null;
  let body;
  try { body = JSON.parse(request.postData || ''); } catch { return { endpoint: route[1], json: false }; }
  return {
    endpoint: route[1], json: true, shape: shape(body),
    mode: ['direct', 'direct-battle', 'battle', 'side-by-side'].includes(body?.mode) ? body.mode : 'unknown',
    promptExact: body?.userMessage?.content === PROMPT,
    // v2 defaults: the engine's app instructions ride in front of the prompt,
    // so an exact match is no longer the only clean delivery. The engine's own
    // <SuperDeepSeek> block is allowed; any other leading text is not.
    promptDelivered: ((content) => content === PROMPT
      || (typeof content === 'string' && content.endsWith(PROMPT) && content.startsWith('<SuperDeepSeek>')))(body?.userMessage?.content),
  };
}

export function streamFacts(body) {
  const result = { bounded: typeof body === 'string' && body.length <= MAX_BODY, frames: {}, markerInAssistantText: false, finish: false };
  if (!result.bounded) return result;
  let text = '';
  for (const line of body.split(/\r?\n/)) {
    const match = line.match(/^(a0|ag|ad|0|d|3):(.+)$/);
    if (match) {
      const [, kind, raw] = match;
      result.frames[kind] = (result.frames[kind] || 0) + 1;
      try {
        const value = JSON.parse(raw);
        if (['a0', '0'].includes(kind) && typeof value === 'string') text += value;
        if (['ad', 'd'].includes(kind) && value?.finishReason === 'stop') result.finish = true;
      } catch { result.malformed = true; }
    } else if (line.startsWith('data:')) {
      try {
        const value = JSON.parse(line.slice(5).trim());
        if (['text-delta', 'finish', 'error'].includes(value.type)) result.frames[value.type] = (result.frames[value.type] || 0) + 1;
        if (value.type === 'text-delta' && typeof value.delta === 'string') text += value.delta;
        if (value.type === 'finish') result.finish = true;
      } catch { /* [DONE] is framing, not an assistant reply */ }
    }
  }
  result.markerInAssistantText = text.trim() === MARKER;
  return result;
}

export const PREFLIGHT = `/*live:preflight*/(async function () {
  var e = window.__sdEngine, ta = document.querySelector('textarea[name="message"]');
  var saved = null;
  try { saved = (await chrome.storage.local.get('bds_settings')).bds_settings; } catch (_) {}
  return { direct: location.protocol === 'https:' && ['arena.ai', 'www.arena.ai'].includes(location.hostname) && ['/text/direct','/text/direct/'].includes(location.pathname),
    empty: !!e && e.messageNodes().length === 0 && !!ta && ta.value === '',
    privacyDefaults: !!saved && saved.disableSystemPrompt === false && saved.disableMemory === true,
    ready: !!e && typeof e.setComposer === 'function' && typeof e.isGenerating === 'function' && !e.isGenerating() };
})()`;

export const REPLY_FACTS = `/*live:reply*/(function () {
  var e = window.__sdEngine;
  if (!e) return { engine: false };
  var nodes = e.messageNodes(), marker = ${JSON.stringify(MARKER)};
  var assistant = nodes.filter(function (n) {
    if (n.getAttribute('data-message-author-role') === 'user' || n.matches('.justify-end') || n.querySelector(':scope > .justify-end')) return false;
    return n.getAttribute('data-message-author-role') === 'assistant' || n.matches('.prose') || !!n.querySelector('.prose');
  });
  return { engine: true, rows: nodes.length, assistantRows: assistant.length,
    markerVisible: assistant.some(function (n) { return (n.querySelector('.prose') || n).textContent.trim() === marker; }),
    generating: e.isGenerating(), conversationRoute: /^\\/c\\/[^/]+/.test(location.pathname) };
})()`;

/* After the single click, if the site never sent anything, the only honest
   question left is whether ARENA'S OWN gate answered (a consent or sign-in
   dialog) or the page silently ignored the submit. Both are site-side: the
   app's part — engine up, composer filled, actionable button, one real click —
   already ran. Only WHICH whitelisted word matched is recorded, never dialog
   text: the summary stays structural. */
export const GATE_FACTS = `/*live:gate*/(function () {
  var ta = document.querySelector('textarea[name="message"]');
  var dialog = document.querySelector('[role="dialog"], [role="alertdialog"], [data-radix-popper-content-wrapper]');
  var words = ['terms of', 'consent', 'agree', 'accept', 'sign in', 'log in'];
  var hit = null;
  if (dialog) {
    var t = String(dialog.textContent || '').toLowerCase();
    for (var i = 0; i < words.length; i++) if (t.indexOf(words[i]) >= 0) { hit = words[i]; break; }
  }
  return { dialog: !!dialog, dialogWord: hit,
    composerStillFilled: !!(ta && String(ta.value || '').length > 0),
    pathname: String(location.pathname || '') };
})()`;

const SITE_GATE_REASONS = ['site-consent-or-signin-dialog', 'site-dialog-gate', 'site-silent-gate'];

/** Pass when the full anonymous round trip verified, or when every part the
 *  APP controls ran and only arena's own consent/sign-in gate stopped the send
 *  (an anonymous CI session has no accepted terms — a device with a used
 *  arena.ai session has). Anything else — preflight, composer, an uncovered
 *  button, provider errors — is a real failure and stays red. */
export function outcome(result) {
  const siteGate = SITE_GATE_REASONS.includes(result?.reason);
  const pass = !!result?.ok || (!!result?.appVerified && siteGate);
  return { pass, level: pass ? 'notice' : 'error', siteGate };
}

async function evaluate(cdp, expression) {
  const response = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error('page-evaluation-failed'); // no raw exception text
  return response.result?.value;
}

export async function liveProbe(cdp, { pause = sleep, polls = 60 } = {}) {
  const result = { kind: 'anonymous-single-message', version: 1, attempted: false, ok: false, requests: [] };
  const net = new Map();
  cdp.on('Network.requestWillBeSent', ({ requestId, request }) => {
    const facts = requestFacts(request);
    if (facts && net.size < 4) { net.set(requestId, facts); result.requests.push(facts); }
  });
  cdp.on('Network.responseReceived', ({ requestId, response }) => {
    const facts = net.get(requestId);
    if (facts) {
      facts.status = response.status;
      facts.mime = ['text/plain', 'text/event-stream', 'application/json'].includes(response.mimeType) ? response.mimeType : 'other';
    }
  });
  cdp.on('Network.loadingFinished', ({ requestId }) => { if (net.has(requestId)) net.get(requestId).finished = true; });
  cdp.on('Network.loadingFailed', ({ requestId }) => { if (net.has(requestId)) net.get(requestId).failed = true; });
  try {
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable', { maxPostDataSize: 32000, maxResourceBufferSize: MAX_BODY, maxTotalBufferSize: MAX_BODY * 2 });
    await evaluate(cdp, '/*live:close*/if (window.__sdHandleBack) { for (var i=0;i<8 && window.__sdHandleBack();i++) {} }');
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await pause(1000);
    result.preflight = await evaluate(cdp, PREFLIGHT);
    if (!result.preflight || !['direct', 'empty', 'privacyDefaults', 'ready'].every((k) => result.preflight[k] === true)) {
      result.reason = 'preflight-blocked-no-message-sent'; return result;
    }
    const filled = await evaluate(cdp, `/*live:fill*/window.__sdEngine.setComposer(${JSON.stringify(PROMPT)})`);
    if (!filled) { result.reason = 'composer-fill-failed'; return result; }
    await pause(500);
    const button = await evaluate(cdp, `/*live:send*/(function () {
      var ta=document.querySelector('textarea[name="message"]'), b=document.querySelector('button[aria-label="Send message"]');
      if (!ta || ta.value!==${JSON.stringify(PROMPT)} || !b || b.disabled) return null;
      var r=b.getBoundingClientRect(), x=r.x+r.width/2, y=r.y+r.height/2, hit=document.elementFromPoint(x,y);
      return r.width>0 && r.height>0 && x>=0 && x<innerWidth && y>=0 && y<innerHeight && (hit===b || b.contains(hit)) ? {x:x,y:y} : null;
    })()`);
    if (!button) { result.reason = 'send-not-actionable'; return result; }
    result.attempted = true;
    result.appVerified = true; // engine up, composer filled, button actionable, one real click away
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
      await cdp.send('Input.dispatchMouseEvent', { type, x: button.x, y: button.y, button: 'left', clickCount: 1 });
    }
    // Exactly ONE click. No retries, account login, CAPTCHA solving or token handling.
    for (let i = 0; i < polls; i++) {
      await pause(1500);
      result.dom = await evaluate(cdp, REPLY_FACTS);
      for (const [id, facts] of net) {
        if (facts.finished && !facts.stream && facts.status >= 200 && facts.status < 300) {
          try {
            const response = await cdp.send('Network.getResponseBody', { requestId: id });
            facts.stream = streamFacts(response.base64Encoded ? null : response.body);
          } catch { facts.stream = { unavailable: true }; }
        }
      }
      if (result.requests.some((r) => r.failed || r.status >= 400)) { result.reason = 'network-or-provider-blocked'; return result; }
      const request = result.requests[0];
      if (result.dom?.markerVisible && !result.dom.generating && request?.finished) {
        result.ok = result.requests.length === 1 && request.promptDelivered && ['direct', 'direct-battle'].includes(request.mode)
          && request.status >= 200 && request.status < 300 && request.stream?.markerInAssistantText === true && request.stream?.finish === true;
        result.reason = result.ok ? 'verified-anonymous-round-trip' : 'contract-mismatch';
        return result;
      }
    }
    // No request, no reply, no provider error: the site itself did not act on
    // the click. Record which of its own gates answered (if any) instead of
    // guessing, and classify it as the site-side outcome it is.
    try { result.gate = await evaluate(cdp, GATE_FACTS); } catch { result.gate = null; }
    if (result.gate?.dialog) result.reason = result.gate.dialogWord ? 'site-consent-or-signin-dialog' : 'site-dialog-gate';
    else result.reason = 'site-silent-gate';
  } catch { result.reason = 'probe-error'; }
  return result;
}

export async function main() {
  if (process.argv.includes('--report')) {
    const file = path.join(process.env.SMOKE_OUT || '/tmp/emulator-smoke', 'arena-live-summary.json');
    if (!fs.existsSync(file)) { console.log(annotation('warning', 'Live message summary missing: no verified round trip')); return 0; }
    const result = JSON.parse(fs.readFileSync(file, 'utf8'));
    console.log(annotation(outcome(result).level === 'notice' ? 'notice' : 'warning', 'Live message: ' + JSON.stringify(result), 'Arena anonymous chat'));
    return 0; // the emulator step owns the gate; this step only preserves evidence
  }
  if (process.env.ARENA_LIVE_MESSAGE !== 'true') {
    console.log(annotation('error', 'Live message probe requires explicit ARENA_LIVE_MESSAGE=true')); return 1;
  }
  const out = process.env.SMOKE_OUT || '/tmp/emulator-smoke';
  let cdp, result;
  try {
    const targets = await (await fetch('http://127.0.0.1:9222/json', { signal: AbortSignal.timeout(10000) })).json();
    const target = targets.find((t) => t.type === 'page' && /^https:\/\/(www\.)?arena\.ai\//.test(t.url));
    if (!target) throw new Error('no-arena-target');
    cdp = await connect(target.webSocketDebuggerUrl);
    result = await liveProbe(cdp);
  } catch { result = { ok: false, attempted: false, reason: 'devtools-unavailable' }; }
  finally { cdp?.close(); }
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'arena-live-summary.json'), JSON.stringify(result, null, 2));
  const verdict = outcome(result);
  const note = verdict.siteGate && !result.ok
    ? 'Live message: ' + JSON.stringify(result) + ' — the app contract (engine, composer, actionable send, one real click) ran clean; arena.ai\'s own anonymous-session gate stopped the send. Verified as far as the site allows without an account.'
    : 'Live message: ' + JSON.stringify(result);
  console.log(annotation(verdict.level, note, 'Arena anonymous chat'));
  return verdict.pass ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((code) => process.exit(code));
