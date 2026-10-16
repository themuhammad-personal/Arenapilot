#!/usr/bin/env node
/**
 * CDP probe — look at the REAL arena.ai page from inside the CI emulator.
 *
 * The emulator smoke proves ArenaPilot launches and that the engine comes up. It
 * cannot say WHAT the engine found on the page, because the WebView's DOM is not
 * in the accessibility dump. A debug build, though, lets Chrome DevTools attach to
 * its WebView (BuildConfig.DEBUG -> setWebContentsDebuggingEnabled), so this
 * script connects over the DevTools protocol and asks the page directly:
 *
 *   * the engine's own state (injected? rail mounted? "+" sheet mounted? did the
 *     health check raise its notice?) — facts the unit tests can only model;
 *   * the arena.ai DOM an anonymous visitor gets, through tools/arena-capture's
 *     snap(): landmarks, the composer box, popups;
 *   * the engine's "+" sheet opened with a REAL mouse click (not .click()), and
 *     arena's own attach popup likewise;
 *   * the page-load network traffic, as shapes (same masking as the kit).
 *
 * Everything goes to <out>/cdp-capture.json and, so it can be read without the
 * artifact download, to the job's annotations: one readable summary line and the
 * whole capture gzipped + base64'd in chunks (unpackChunks() reverses it).
 *
 * Report-only by default. --required 1 makes missing runtime/UI evidence fail
 * CI; all step failures are still recorded before the gate is evaluated.
 *
 * Usage: node android/ci/cdp_probe.mjs --port 9222 --out /tmp/emulator-smoke \
 *          --capture tools/arena-capture/capture.js [--host 127.0.0.1] [--wait 12000]
 *        node android/ci/cdp_probe.mjs --report /tmp/emulator-smoke/cdp-capture.json
 *          (the saved capture again, as annotation chunks — its own workflow step,
 *           because GitHub allows ten annotations per step)
 * Needs: Node 22 (global WebSocket). No dependencies.
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const sleepMs = (ms) => new Promise((r) => setTimeout(r, ms));

// ── GitHub annotations ──────────────────────────────────────────────────────

const escapeData = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
const escapeProp = (s) => escapeData(s).replace(/:/g, '%3A').replace(/,/g, '%2C');

/** A workflow command line. Message and title are escaped as the runner expects. */
export function annotation(level, message, title) {
  return `::${level}${title ? ` title=${escapeProp(title)}` : ''}::${escapeData(message)}`;
}

/**
 * gzip + base64, cut into pieces that each fit one annotation. GitHub shows an
 * annotation message up to 4096 characters, so the pieces stay under that.
 */
export function packChunks(text, size = 3600) {
  const b64 = zlib.gzipSync(Buffer.from(text, 'utf8'), { level: 9 }).toString('base64');
  const chunks = [];
  for (let i = 0; i < b64.length; i += size) chunks.push(b64.slice(i, i + size));
  return chunks;
}
export function unpackChunks(chunks) {
  return zlib.gunzipSync(Buffer.from(chunks.join(''), 'base64')).toString('utf8');
}

// ── a minimal DevTools-protocol client over the global WebSocket ────────────

export function connect(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    let nextId = 1;
    const pending = new Map();
    const handlers = new Map();
    const client = {
      send(method, params = {}, timeoutMs = 30000) {
        return new Promise((res, rej) => {
          const id = nextId++;
          const timer = setTimeout(() => { pending.delete(id); rej(new Error(`timeout: ${method}`)); }, timeoutMs);
          pending.set(id, { res, rej, method, timer });
          ws.send(JSON.stringify({ id, method, params }));
        });
      },
      on(event, fn) {
        if (!handlers.has(event)) handlers.set(event, []);
        handlers.get(event).push(fn);
      },
      /** Resolves with the next `event`. Create it BEFORE the action that fires it. */
      waitFor(event, ms) {
        return new Promise((res, rej) => {
          const timer = setTimeout(() => rej(new Error(`no ${event} within ${ms} ms`)), ms);
          client.on(event, (params) => { clearTimeout(timer); res(params); });
        });
      },
      close() { try { ws.close(); } catch { /* already closed */ } },
    };
    ws.addEventListener('open', () => resolve(client));
    ws.addEventListener('error', () => reject(new Error('websocket error')));
    ws.addEventListener('message', (ev) => {
      let msg;
      try { msg = JSON.parse(typeof ev.data === 'string' ? ev.data : String(ev.data)); } catch { return; }
      if (msg.id && pending.has(msg.id)) {
        const p = pending.get(msg.id);
        pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.rej(new Error(`${p.method}: ${msg.error.message}`)); else p.res(msg.result);
      } else if (msg.method) {
        (handlers.get(msg.method) || []).forEach((fn) => fn(msg.params));
      }
    });
  });
}

// ── what we ask the page ────────────────────────────────────────────────────
// Each expression starts with a /*sdp:...*/ marker: it names the step in the
// protocol trace, and lets a test double tell the steps apart.

export const FACTS = `/*sdp:facts*/(function () {
  function q(s) { try { return document.querySelector(s); } catch (e) { return null; } }
  function count(s) { try { return document.querySelectorAll(s).length; } catch (e) { return -1; } }
  function rect(el) {
    if (!el) { return null; }
    try { var r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; } catch (e) { return null; }
  }
  function vis(el) { var r = rect(el); return !!(r && r[2] > 0 && r[3] > 0); }
  var h = window.__sdHealth;
  var st = null;
  try { st = h && h.status ? h.status() : null; } catch (e) { st = null; }
  var rail = q('#bds-settings-rail');
  var inputs = Array.prototype.slice.call(document.querySelectorAll('textarea, input')).filter(vis).slice(0, 8).map(function (e) {
    return { tag: e.tagName.toLowerCase(), type: e.type || null, name: e.getAttribute('name'), placeholder: String(e.getAttribute('placeholder') || '').slice(0, 40), id: String(e.id || '').slice(0, 24) };
  });
  var text = '';
  try { text = String(document.body.innerText || '').replace(/\\s+/g, ' ').trim(); } catch (e) { text = ''; }
  var root = q('#bds-root');
  /* every control around the message box: which one is arena's own attach / plus button? */
  var ta = q('textarea[name="message"]');
  var box = ta ? (ta.closest('form') || ta.parentElement) : null;
  var sendButton = q('button[aria-label="Send message"]');
  var composerTarget = 'none';
  try {
    if (box && box.matches && box.matches('form:has(textarea[name="message"])')) composerTarget = 'has';
  } catch (e) { /* :has() is not available in older Android WebViews */ }
  if (composerTarget === 'none' && box && ta && box.tagName &&
      String(box.tagName).toLowerCase() === 'form' && box.contains && box.contains(ta)) {
    composerTarget = 'native';
  }
  var composerRect = rect(box);
  var sendRect = rect(sendButton);
  var sendInsideComposer = !!(composerRect && sendRect &&
    sendRect[0] + sendRect[2] <= composerRect[0] + composerRect[2] + 1 &&
    composerRect[0] + composerRect[2] <= window.innerWidth + 1);
  var sendMinWidth = null;
  try { sendMinWidth = sendButton ? parseFloat(getComputedStyle(sendButton).minWidth) : null; } catch (e) {}
  var settingsLabel = rail ? (rail.querySelector('[data-bds-settings-label="true"]') || rail.querySelector('.bds-arena-rail-label')) : null;
  var settingsLabelDisplay = null;
  try { settingsLabelDisplay = settingsLabel ? getComputedStyle(settingsLabel).display : null; } catch (e) {}
  var up = box;
  for (var u = 0; u < 3 && up && up.parentElement && up.parentElement.tagName !== 'BODY'; u += 1) { up = up.parentElement; }
  var controls = up ? Array.prototype.slice.call(up.querySelectorAll('button, [role="button"], input[type="file"]')).slice(0, 16).map(function (b) {
    var p = b.querySelector ? b.querySelector('path') : null;
    return { tag: b.tagName.toLowerCase(), aria: b.getAttribute('aria-label'), title: b.getAttribute('title'), type: b.getAttribute('type'), cls: String(b.getAttribute('class') || '').slice(0, 70), rect: rect(b), svg: p ? String(p.getAttribute('d') || '').slice(0, 24) : null, hidden: !vis(b), engine: !!(b.closest && b.closest('#bds-root, .bds-attach-wrapper, .bds-composer-controls')) };
  }) : [];
  /* did the engine's "+" take arena's slot? one "+", in the left group, before the hidden "Add files" */
  var add = (function () {
    try {
      var messageBox = q('textarea[name="message"]') || q('textarea');
      var form = messageBox && messageBox.closest ? messageBox.closest('form') : null;
      if (!form) form = q('form');
      var buttons = form ? form.querySelectorAll('button') : [];
      for (var i = 0; i < buttons.length; i++) {
        var candidate = buttons[i];
        var label = candidate.getAttribute('aria-label');
        var cls = String(candidate.getAttribute('class') || '');
        if ((label === 'Add files' || label === 'Attach files') &&
            cls.indexOf('bds-plus-btn') < 0 &&
            !(candidate.closest && candidate.closest('.bds-attach-menu-mount, .bds-attach-wrapper'))) {
          return candidate;
        }
      }
    } catch (e) {}
    return null;
  })();
  var grp = add ? add.parentElement : null;
  /* the SITE's own file input (the engine's is inside its own mounts): the
     attach path's real contract — does it carry [multiple]? what accept? */
  var fi = (function () { try { return Array.prototype.slice.call(document.querySelectorAll('input[type="file"]')).filter(function (e) { return !(e.closest && e.closest('#bds-root, .bds-attach-wrapper, .bds-question-panel, .bds-rag-preview, .bds-preview-panel')); })[0] || null; } catch (e) { return null; } })();
  var nativeAddRect = rect(add);
  var enginePlus = q('.bds-plus-btn');
  var enginePlusRect = rect(enginePlus);
  function nearRects(a, b) {
    if (!a || !b || a.length < 4 || b.length < 4) return false;
    return Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 &&
      Math.abs(a[2] - b[2]) <= 1 && Math.abs(a[3] - b[3]) <= 1;
  }
  var nativeAddStyle = null;
  var enginePlusStyle = null;
  try { nativeAddStyle = add ? getComputedStyle(add) : null; } catch (e) {}
  try { enginePlusStyle = enginePlus ? getComputedStyle(enginePlus) : null; } catch (e) {}
  var plusOverlay = {
    aligned: nearRects(nativeAddRect, enginePlusRect),
    nativeVisible: !!(nativeAddRect && nativeAddStyle && nativeAddStyle.display !== 'none' && nativeAddStyle.visibility !== 'hidden'),
    nativePointerIntact: !!(nativeAddStyle && nativeAddStyle.pointerEvents !== 'none'),
    engineTargetReady: !!(enginePlusRect && enginePlusStyle && enginePlusStyle.display !== 'none' &&
      enginePlusStyle.visibility !== 'hidden' && enginePlusStyle.opacity === '0' && enginePlusStyle.pointerEvents === 'none')
  };
  var slot = {
    plus: enginePlusRect,
    addFilesDisplay: nativeAddStyle ? nativeAddStyle.display : null,
    plusOverlay: plusOverlay,
    group: grp ? Array.prototype.map.call(grp.children, function (c) {
      return c.tagName.toLowerCase() + (typeof c.className === 'string' && c.className ? '.' + c.className.split(' ')[0] : '') + (c.getAttribute('aria-label') ? '[' + c.getAttribute('aria-label') + ']' : '') + (c.getAttribute('role') ? '{' + c.getAttribute('role') + '}' : '');
    }) : null,
    form: rect(q('.bds-composer-controls'))
  };
  function html(el, n) { try { return el ? String(el.outerHTML).replace(/\\s+/g, ' ').slice(0, n) : null; } catch (e) { return null; } }
  return JSON.stringify({
    composerControls: controls,
    slot: slot,
    engineMarkup: { mount: html(q('.bds-attach-menu-mount'), 900), wrapper: html(q('.bds-attach-wrapper'), 700), controls: html(q('.bds-composer-controls'), 500) },
    host: location.host,
    path: location.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '{uuid}'),
    title: String(document.title || '').slice(0, 80),
    readyState: document.readyState,
    site: window.__sdSite ? { id: window.__sdSite.id, version: window.__sdSite.version } : null,
    api: window.__sdApi || null,
    engine: { css: !!q('#bds-css'), root: !!root, rootChildren: root ? root.children.length : 0, handleBack: typeof window.__sdHandleBack, engineApi: typeof window.__sdEngine, agent: typeof window.__sdAgent },
    rail: rail ? { label: rail.getAttribute('aria-label'), rect: rect(rail), visible: vis(rail) } : null,
    attach: { toggle: count('.bds-plus-btn'), mount: count('.bds-attach-menu-mount'), wrapper: count('.bds-attach-wrapper'), controls: count('.bds-composer-controls'), dropdown: count('.bds-attach-dropdown'), siteButton: nativeAddRect, overlayAligned: plusOverlay.aligned, nativePlusVisible: plusOverlay.nativeVisible, nativePlusPointerIntact: plusOverlay.nativePointerIntact, enginePlusOverlayReady: plusOverlay.engineTargetReady, fileInput: fi ? { multiple: fi.hasAttribute('multiple'), accept: String(fi.getAttribute('accept') || '').slice(0, 120) || null, disabled: fi.disabled === true } : null },
    composer: { named: count('textarea[name="message"]'), textareas: count('textarea'), rect: rect(q('textarea[name="message"]') || q('textarea')) },
    /* N0 evidence from the actual WebView: the real page is skinned in place,
       and we measure the existing Send control rather than trusting CSS source. */
    skin: {
      active: !!(window.__sdSite && window.__sdSite.id === 'arena'),
      composerTarget: composerTarget,
      sendInsideComposer: sendButton && composerRect && sendRect ? sendInsideComposer : null,
      sendMinWidth: sendMinWidth,
      viewportWidth: window.innerWidth,
      formRect: composerRect,
      sendRect: sendRect,
      settingsDock: rail ? rail.getAttribute('data-dock') : null,
      settingsLabelDisplay: settingsLabelDisplay,
      settingsRailVisible: (function () {
        if (!rail) return false;
        try {
          var rr = rail.getBoundingClientRect();
          var cs = getComputedStyle(rail);
          return cs.display !== 'none' && cs.visibility !== 'hidden' &&
            Number(cs.opacity || 1) > 0 && rr.width > 0 && rr.height > 0;
        } catch (_) { return false; }
      })()
    },
    health: { present: !!h, version: h ? h.version : null, site: h ? h.site : null, ok: st ? st.ok : null, visible: st ? st.visible : null, states: st && st.results ? st.results.map(function (r) { return r.id + ':' + r.state; }) : null, notice: !!q('#sd-health-notice') },
    login: /sign in|log in|sign up|continue with|create account/i.test(text.slice(0, 6000)),
    inputs: inputs,
    textSample: text.slice(0, 700)
  });
})()`;

const sidebarToggleExpr = `/*sdp:sidebar*/(function () {
  var nodes = Array.prototype.slice.call(document.querySelectorAll('button,[role="button"]'));
  var candidates = [];
  for (var i = 0; i < nodes.length; i++) {
    var el = nodes[i];
    var r = el.getBoundingClientRect();
    if (!(r.width >= 24 && r.height >= 24) || r.left < 0 || r.top < 0) continue;
    var label = String(el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').replace(/\\s+/g, ' ').trim();
    if (/sidebar|navigation|open menu|toggle menu|drawer/i.test(label) &&
        !/settings|advanced/i.test(label)) {
      candidates.push({ el: el, r: r, score: 0 });
      continue;
    }
    if (r.left <= window.innerWidth * 0.28 && r.top <= window.innerHeight * 0.2 &&
        !/new chat|add files|send|stop|settings|model|leaderboard|search/i.test(label) &&
        !el.closest('form')) {
      candidates.push({ el: el, r: r, score: 1 });
    }
  }
  if (!candidates.length) return JSON.stringify({ found: false });
  candidates.sort(function (a, b) { return a.score - b.score || a.r.top - b.r.top || a.r.left - b.r.left; });
  var r = candidates[0].r;
  return JSON.stringify({ found: true, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height });
})()`;

const rectExpr = (selector) => `/*sdp:rect*/(function (sel) {
  var el = document.querySelector(sel);
  if (!el) { return JSON.stringify({ found: false }); }
  try { el.scrollIntoView({ block: 'center' }); } catch (e) { /* not scrollable */ }
  var r = el.getBoundingClientRect();
  return JSON.stringify({ found: true, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height });
})(${JSON.stringify(selector)})`;

/** What is under the pointer (a chain of ancestors) and which layout (phone/desktop CSS) is active. */
const hitExpr = (x, y) => `/*sdp:hit*/(function (x, y) {
  var el = document.elementFromPoint(x, y);
  function d(e) { return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.split(' ').slice(0, 3).join('.') : ''); }
  var chain = [];
  for (var n = el, i = 0; n && i < 5; i += 1, n = n.parentElement) { chain.push(d(n)); }
  var mobile = null;
  try { mobile = window.matchMedia('(max-width: 767px)').matches; } catch (e) { mobile = null; }
  return JSON.stringify({ chain: chain, viewport: [window.innerWidth, window.innerHeight], mobileCss: mobile });
})(${x}, ${y})`;

/** Is the engine's "+" sheet on the page? Every name it might carry, and the button's own state. */
const SHEET_OPEN = `/*sdp:sheet*/(function () {
  function count(s) { try { return document.querySelectorAll(s).length; } catch (e) { return -1; } }
  var b = document.querySelector('.bds-plus-btn');
  return JSON.stringify({
    dropdown: count('.bds-attach-dropdown'), backdrop: count('.bds-attach-backdrop'), header: count('.bds-sheet-header'),
    items: count('.bds-attach-item'), title: count('.bds-sheet-title'),
    expanded: b ? b.getAttribute('aria-expanded') : null, btnClass: b ? String(b.className).slice(0, 80) : null
  });
})()`;
const sheetIsOpen = (o) => !!(o && (o.dropdown > 0 || o.backdrop > 0 || o.header > 0));

/** The one path no capture had ever proven on the real page: the engine
 *  driving arena's React composer. NO message is sent — fill, read the send
 *  button's state, clear. Facts only; the probe text never leaves the page. */
export const FILL_SET = `/*sdp:fillset*/(function () {
  var e = window.__sdEngine;
  if (!e || typeof e.setComposer !== 'function') { return JSON.stringify({ engine: false, set: false, valueMatches: false }); }
  var probe = 'arenapilot composer probe';
  var ta = document.querySelector('textarea[name="message"]');
  var set = e.setComposer(probe);
  var value = ta ? String(ta.value || '') : null;
  return JSON.stringify({ engine: true, set: set === true, valueMatches: value === probe });
})()`;
export const FILL_BUTTON = `/*sdp:fillbtn*/(function () {
  var btn = document.querySelector('button[aria-label="Send message"]');
  return JSON.stringify({ sendButton: !!btn, sendDisabledWhileFilled: btn ? (btn.disabled === true || btn.getAttribute('aria-disabled') === 'true') : null });
})()`;
export const FILL_CLEAR = `/*sdp:fillclr*/(function () {
  var e = window.__sdEngine;
  var ta = document.querySelector('textarea[name="message"]');
  var cleared = e && typeof e.setComposer === 'function' ? e.setComposer('') : false;
  var after = ta ? String(ta.value || '') : null;
  return JSON.stringify({ cleared: cleared === true && after === '' });
})()`;

/** The engine's own Settings drawer: present, visible, and its backdrop. */
export const DRAWER_FACTS = `/*sdp:drawer*/(function () {
  function q(s) { try { return document.querySelector(s); } catch (e) { return null; } }
  function r(el) { try { var b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; } catch (e) { return null; } }
  var d = q('#bds-drawer');
  var rail = q('#bds-settings-rail');
  var sheet = q('.bds-attach-dropdown');
  return JSON.stringify({
    present: !!d,
    visible: !!(d && r(d) && r(d)[2] > 0 && r(d)[3] > 0),
    rect: d ? r(d) : null,
    backdrop: !!q('.bds-drawer-backdrop'),
    railDock: rail && rail.dataset ? rail.dataset.dock : null,
    sheetVisible: !!(sheet && r(sheet) && r(sheet)[2] > 0 && r(sheet)[3] > 0)
  });
})()`;

export const SETTINGS_CARD_FACTS = `/*sdp:settingscard*/(function () {
  function q(s) { try { return document.querySelector(s); } catch (e) { return null; } }
  function r(el) { try { var b = el.getBoundingClientRect(); return [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)]; } catch (e) { return null; } }
  function shown(el) {
    if (!el || !r(el) || r(el)[2] < 1 || r(el)[3] < 1) return false;
    try {
      var n = el, depth = 0;
      while (n && depth++ < 64) {
        if (n.hasAttribute && (n.hasAttribute('hidden') || n.hasAttribute('inert') ||
            String(n.getAttribute('aria-hidden') || '').toLowerCase() === 'true')) return false;
        var cs = getComputedStyle(n);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.visibility === 'collapse' ||
            parseFloat(cs.opacity) <= 0.01) return false;
        if (n === document.documentElement) return true;
        n = n.parentElement;
      }
    } catch (e) { return false; }
    return false;
  }
  var sheet = q('.bds-attach-dropdown');
  var card = q('#sd-arena-settings-item');
  var rail = q('#bds-settings-rail');
  var items = sheet ? Array.prototype.slice.call(sheet.querySelectorAll('.bds-attach-item')) : [];
  var title = card && card.querySelector('.bds-item-title');
  var desc = card && card.querySelector('.bds-item-desc');
  return JSON.stringify({
    sheetPresent: !!sheet,
    sheetVisible: shown(sheet),
    present: !!card,
    count: sheet ? sheet.querySelectorAll('#sd-arena-settings-item').length : 0,
    visible: shown(card),
    insideSheet: !!(sheet && card && sheet.contains(card)),
    lastCard: !!card && items[items.length - 1] === card,
    title: title ? String(title.textContent || '').trim() : '',
    description: desc ? String(desc.textContent || '').trim() : '',
    rect: r(card),
    legacySidebarRows: document.querySelectorAll('[data-bds-arena-settings-entry="true"]').length,
    sourceRailVisible: shown(rail),
    sourceDock: rail && rail.dataset ? rail.dataset.dock : null
  });
})()`;

const snapExpr = (label) => `/*sdp:snap*/JSON.stringify(window.__sdCapture.snap(${JSON.stringify(label)}, { free: true }))`;
const maskExpr = (urls) => `/*sdp:mask*/JSON.stringify(${JSON.stringify(urls)}.map(function (u) { return window.__sdCapture._t.maskUrl(u); }))`;
const shapeExpr = (texts) => `/*sdp:shape*/JSON.stringify(${JSON.stringify(texts)}.map(function (t) { return t == null ? null : window.__sdCapture._t.shapeText(t); }))`;
const EXPORT = '/*sdp:export*/window.__sdCapture.export()';

// ── the probe ───────────────────────────────────────────────────────────────

const STATIC = /(^\/_next\/(static|image)|\.(js|css|map|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|mp4|webm)$)/i;
const THIRD = /(recaptcha|posthog|google-analytics|googletagmanager|sentry|cloudflare|trigger\.dev)/i;

function interesting(raw, pageHost) {
  let u;
  try { u = new URL(raw); } catch { return false; }
  return u.host === pageHost ? !STATIC.test(u.pathname) : THIRD.test(u.host + u.pathname);
}

async function evalValue(cdp, expression) {
  const r = await cdp.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) {
    const d = r.exceptionDetails;
    throw new Error(`page exception: ${(d.exception && d.exception.description) || d.text || 'unknown'}`.slice(0, 240));
  }
  return r.result ? r.result.value : undefined;
}
async function evalJson(cdp, expression) {
  const v = await evalValue(cdp, expression);
  return typeof v === 'string' ? JSON.parse(v) : v;
}

async function realClick(cdp, x, y) {
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}
async function pressEscape(cdp) {
  const key = { key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27, nativeVirtualKeyCode: 27 };
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key });
  await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key });
}

/**
 * Runs the whole probe against a connected CDP client and returns the capture
 * object. [pageHost] is the page's host (to tell its own requests from others').
 * [pause] is the sleep, injectable so tests do not wait.
 */
export async function probe(cdp, { kitSource, pageHost, wait = 12000, pause = sleepMs } = {}) {
  const steps = [];
  const result = { kit: 'sd-arena-cdp-probe', version: 1, capturedAt: new Date().toISOString(), pageHost, steps };
  async function step(name, fn) {
    try {
      const value = await fn();
      steps.push({ name, ok: true });
      return value;
    } catch (e) {
      steps.push({ name, ok: false, error: String((e && e.message) || e).slice(0, 200) });
      return undefined;
    }
  }

  // page errors, recorded from before the reload so hydration-time failures are
  // seen too — the first line of each, never a stack or page data
  const pageErrors = [];
  cdp.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') {
      const text = String((p.args || []).map((a) => (a && (a.value !== undefined ? a.value : a.description)) || (a && a.type) || '').join(' ')).split('\n')[0].slice(0, 180);
      if (text) pageErrors.push(text);
    }
  });
  cdp.on('Runtime.exceptionThrown', (p) => {
    const d = (p && p.exceptionDetails) || {};
    const text = String((d.exception && d.exception.description) || d.text || 'exception').split('\n')[0].slice(0, 180);
    pageErrors.push(text);
  });

  // network, recorded from before the reload so the whole page load is seen
  const net = new Map();
  cdp.on('Network.requestWillBeSent', (p) => {
    if (!p.request || !interesting(p.request.url, pageHost) || net.size >= 150) return;
    net.set(p.requestId, {
      method: p.request.method,
      url: p.request.url,
      reqHeaders: Object.keys(p.request.headers || {}).map((k) => k.toLowerCase()).sort(),
      postData: typeof p.request.postData === 'string' ? p.request.postData.slice(0, 200000) : null,
    });
  });
  cdp.on('Network.responseReceived', (p) => {
    const e = net.get(p.requestId);
    if (e && p.response) { e.status = p.response.status; e.mime = p.response.mimeType; }
  });
  cdp.on('Network.loadingFinished', (p) => { const e = net.get(p.requestId); if (e) e.finished = true; });
  cdp.on('Network.loadingFailed', (p) => { const e = net.get(p.requestId); if (e) e.failed = p.errorText || true; });

  await step('enable', async () => {
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('Network.enable', { maxPostDataSize: 20000 });
  });
  await step('reload', async () => {
    const loaded = cdp.waitFor('Page.loadEventFired', 30000);
    await cdp.send('Page.reload', { ignoreCache: true });
    await loaded;
  });
  await pause(wait); // the SPA hydrates, the app injects the engine, the health check's timers run

  result.engine = await step('facts', () => evalJson(cdp, FACTS));

  const installed = await step('install-kit', async () => {
    if (!kitSource) throw new Error('capture.js was not found');
    // the kit's panel is fixed at the bottom-left — right over the composer's "+". The first CI capture
    // showed the real click landing on it (hit=[button, div#sd-capture-panel, …]), so it is not drawn here.
    await evalValue(cdp, '/*sdp:nopanel*/window.__sdCaptureNoPanel = true;');
    await evalValue(cdp, `/*sdp:install*/${kitSource}`);
    return evalValue(cdp, '/*sdp:installed*/typeof window.__sdCapture');
  });
  const kitOk = installed === 'object';
  if (kitOk) await step('snap:anon-page', () => evalJson(cdp, snapExpr('anon-page')));

  // The engine's "+" sheet, opened the way a finger would: a real pointer click. If that does not open
  // it, a script click is tried and which of the two worked is recorded — and what was under the pointer.
  await step('engine-plus-sheet', async () => {
    /* Prefer the official, visible Arena button; the engine button is only
       an internal event target. The internal trigger is a fallback for hosts
       without the original control. */
    let t = await evalJson(cdp, rectExpr('button[aria-label="Add files"]'));
    result.engineToggle = t;
    if (!t.found || !(t.w > 0 && t.h > 0)) {
      t = await evalJson(cdp, rectExpr('.bds-plus-btn'));
      result.engineToggle = t;
    }
    if (!t.found || !(t.w > 0 && t.h > 0)) return 'no visible attach control on the page';
    result.engineHit = await step('plus-hit-test', () => evalJson(cdp, hitExpr(t.x, t.y)));
    await realClick(cdp, t.x, t.y);
    await pause(1200);
    let open = await evalJson(cdp, SHEET_OPEN);
    result.sheetAfterRealClick = open;
    result.sheetOpenedBy = sheetIsOpen(open) ? 'real-click' : null;
    if (!sheetIsOpen(open)) {
      await evalValue(cdp, "/*sdp:jsclick*/(function () { var b = document.querySelector('.bds-plus-btn'); if (b) { b.click(); } return !!b; })()");
      await pause(1000);
      open = await evalJson(cdp, SHEET_OPEN);
      result.sheetAfterJsClick = open;
      result.sheetOpenedBy = sheetIsOpen(open) ? 'js-click' : 'neither';
    }
    if (kitOk) await evalJson(cdp, snapExpr('engine-plus-sheet'));
    // its own step: if only the facts fail, the click and the snapshot above still count as done
    await step('plus-sheet-facts', async () => { result.engineSheet = Object.assign({}, (await evalJson(cdp, FACTS)).attach, { open }); });
    await pressEscape(cdp);
    await pause(500);
    return 'clicked';
  });

  // The original Arena button remains visible and routes to the existing attachment sheet.
  await step('arena-original-plus-trigger', async () => {
    /* Measure the native Arena button itself. Its transparent engine hit target
       is layered over the same coordinates, so this physical tap must open
       the current sheet while the original Arena SVG remains what is seen. */
    const t = await evalJson(cdp, rectExpr('form button[aria-label="Add files"]:not(.bds-plus-btn)'));
    result.siteToggle = t;
    if (!t.found || !(t.w >= 24 && t.h >= 24)) return 'site attach button absent or too small';
    await realClick(cdp, t.x, t.y);
    await pause(1200);
    result.originalPlusSheet = await evalJson(cdp, SHEET_OPEN);
    if (kitOk) await evalJson(cdp, snapExpr('arena-original-plus-trigger'));
    await pressEscape(cdp);
    await pause(500);
    return sheetIsOpen(result.originalPlusSheet) ? 'original visual Plus opens the engine sheet' : 'original Plus did not open the sheet';
  });

  // On the real page this combobox is the Direct / Battle / Side-by-side / Agent switch (a native
  // <select> behind it on a phone-sized view), not a model picker.
  await step('mode-switch', async () => {
    const t = await evalJson(cdp, rectExpr('button[role="combobox"]'));
    result.modeSwitch = t;
    if (!t.found) return 'no mode switch';
    await realClick(cdp, t.x, t.y);
    await pause(1200);
    if (kitOk) await evalJson(cdp, snapExpr('mode-switch'));
    await pressEscape(cdp);
    return 'clicked';
  });

  // Settings belongs in Arena's own sidebar, not beside the composer. Open the
  // site's existing navigation drawer first when its gear is not currently visible.
  // Settings is a card at the bottom of the existing Add to chat sheet.
  // It closes that sheet and opens the existing engine drawer; it is not a second UI.
  await step('settings-drawer', async () => {
    const plus = await evalJson(cdp, rectExpr('form button[aria-label="Add files"]:not(.bds-plus-btn)'));
    let trigger = plus;
    if (!trigger.found || !(trigger.w >= 24 && trigger.h >= 24)) {
      trigger = await evalJson(cdp, rectExpr('.bds-plus-btn'));
    }
    if (!trigger.found || !(trigger.w >= 24 && trigger.h >= 24)) {
      result.settingsCardBeforeClick = await evalJson(cdp, SETTINGS_CARD_FACTS);
      result.drawer = { present: false, visible: false, reason: 'plus-trigger-not-visible' };
      return 'Add to chat trigger not visible';
    }

    await realClick(cdp, trigger.x, trigger.y);
    await pause(900);
    result.settingsCardBeforeClick = await evalJson(cdp, SETTINGS_CARD_FACTS);
    if (!result.settingsCardBeforeClick || result.settingsCardBeforeClick.present !== true ||
        result.settingsCardBeforeClick.count !== 1 || result.settingsCardBeforeClick.insideSheet !== true ||
        result.settingsCardBeforeClick.lastCard !== true || result.settingsCardBeforeClick.sourceRailVisible === true ||
        result.settingsCardBeforeClick.legacySidebarRows !== 0) {
      result.drawer = { present: false, visible: false, reason: 'settings-card-not-last-in-plus-sheet' };
      return 'Settings card not present at the bottom of Add to chat';
    }

    await evalValue(cdp, `(function () {
      var card = document.querySelector('#sd-arena-settings-item');
      if (card && card.scrollIntoView) card.scrollIntoView({ block: 'end', behavior: 'instant' });
      return !!card;
    })()`);
    await pause(150);
    const t = await evalJson(cdp, rectExpr('#sd-arena-settings-item'));
    if (!t.found || !(t.w >= 44 && t.h >= 40)) {
      result.drawer = { present: false, visible: false, reason: 'settings-card-not-visible' };
      return 'Settings card could not be brought into the visible sheet area';
    }
    await realClick(cdp, t.x, t.y);
    await pause(1200);
    result.drawer = await evalJson(cdp, DRAWER_FACTS);
    if (kitOk) await evalJson(cdp, snapExpr('settings-drawer'));
    await evalValue(cdp, '/*sdp:back*/(function () { return typeof window.__sdHandleBack === "function" ? window.__sdHandleBack() : null; })()');
    await pause(600);
    result.drawerAfterBack = await evalJson(cdp, DRAWER_FACTS);
    return result.drawer.visible && result.drawer.sheetVisible === false
      ? 'Settings card opened the existing drawer; Add to chat closed'
      : 'Settings drawer did not open cleanly from the sheet';
  });

  // The composer itself: fill through the engine's API (never send), read, clear.
  // If React ignores the engine's events, every feature dies here — so this is
  // the fact the runtime gate below refuses to pass without. The button's state
  // is read only after a beat: React re-renders on its own schedule, and reading
  // it synchronously would report the stale pre-fill state.
  await step('composer-fill', async () => {
    const set = await evalJson(cdp, FILL_SET);
    let button = null;
    let clear = null;
    if (set && set.engine && set.set) {
      await pause(600);
      button = await evalJson(cdp, FILL_BUTTON);
      clear = await evalJson(cdp, FILL_CLEAR);
    }
    result.composerFill = Object.assign({}, set, button || {}, clear || {});
    return result.composerFill && result.composerFill.engine ? 'filled' : 'engine api missing';
  });

  result.engineAfter = await step('facts-after', () => evalJson(cdp, FACTS));
  result.console = { count: pageErrors.length, first: pageErrors.slice(0, 5) };
  if (kitOk) result.kitExport = await step('export-kit', async () => JSON.parse(await evalValue(cdp, EXPORT)));

  // page-load traffic, as shapes
  result.network = (await step('network', async () => {
    const rows = [...net.values()];
    const bodies = [];
    for (const row of rows) {
      let body = null;
      if (row.finished && /json/i.test(row.mime || '')) {
        try {
          const id = [...net.entries()].find(([, v]) => v === row)[0];
          const r = await cdp.send('Network.getResponseBody', { requestId: id });
          body = r.base64Encoded ? null : String(r.body || '').slice(0, 200000);
        } catch { body = null; }
      }
      bodies.push(body);
    }
    if (!kitOk || !rows.length) return rows.map((r) => ({ method: r.method, status: r.status, mime: r.mime }));
    const urls = await evalJson(cdp, maskExpr(rows.map((r) => r.url)));
    const reqShapes = await evalJson(cdp, shapeExpr(rows.map((r) => r.postData)));
    const resShapes = await evalJson(cdp, shapeExpr(bodies));
    return rows.map((r, i) => ({
      method: r.method, url: urls[i], status: r.status, mime: r.mime, reqHeaders: r.reqHeaders,
      reqBody: reqShapes[i], resShape: resShapes[i], failed: r.failed || undefined,
    }));
  })) || [];

  return result;
}

/** One readable line: the facts that answer the plan's open questions. */
export function summarize(result) {
  const e = result.engineAfter || result.engine || {};
  const eng = e.engine || {};
  const att = e.attach || {};
  const rail = e.rail;
  const h = e.health || {};
  const failed = (result.steps || []).filter((s) => !s.ok).map((s) => `${s.name}(${s.error})`);
  const yn = (v) => (v ? 'yes' : 'no');
  return [
    `page=${e.host || '?'}${e.path || ''}`,
    `title="${e.title || ''}"`,
    `site=${e.site ? `${e.site.id}@v${e.site.version}` : 'none'}`,
    `engine(css=${yn(eng.css)} root=${yn(eng.root)} handleBack=${eng.handleBack || '?'})`,
    `rail=${rail ? `${yn(rail.visible)} "${rail.label}" at ${JSON.stringify(rail.rect)}` : 'absent'}`,
    `settingsCard(present=${yn((result.settingsCardBeforeClick || {}).present)} last=${yn((result.settingsCardBeforeClick || {}).lastCard)} inSheet=${yn((result.settingsCardBeforeClick || {}).insideSheet)} sourceRail=${yn((result.settingsCardBeforeClick || {}).sourceRailVisible)} title="${(result.settingsCardBeforeClick || {}).title || ''}")`,
    `plusSheet(toggle=${att.toggle ?? '?'} mount=${att.mount ?? '?'} wrapper=${att.wrapper ?? '?'} dropdownAfterClick=${(result.engineSheet || {}).dropdown ?? '?'} openedBy=${result.sheetOpenedBy ?? 'n/a'} hit=${JSON.stringify((result.engineHit || {}).chain)} mobileCss=${(result.engineHit || {}).mobileCss ?? '?'})`,
    `siteAttach=${JSON.stringify(att.siteButton)}`,
    `slot(plus=${JSON.stringify((e.slot || {}).plus)} addFiles=${(e.slot || {}).addFilesDisplay ?? '?'} group=${JSON.stringify((e.slot || {}).group)} form=${JSON.stringify((e.slot || {}).form)})`,
    `composer(named=${(e.composer || {}).named ?? '?'} textareas=${(e.composer || {}).textareas ?? '?'})`,
    `skin(active=${yn((e.skin || {}).active)} composer=${(e.skin || {}).composerTarget || '?'} sendInside=${(e.skin || {}).sendInsideComposer == null ? '?' : yn((e.skin || {}).sendInsideComposer)} sendRect=${JSON.stringify((e.skin || {}).sendRect || null)} viewport=${(e.skin || {}).viewportWidth ?? '?'} settingsDock=${(e.skin || {}).settingsDock || '?'} settingsLabel=${(e.skin || {}).settingsLabelDisplay || '?'})`,
    `health(site=${h.site || '?'} ok=${h.ok} visible=${h.visible} notice=${yn(h.notice)} ${(h.states || []).join(',')})`,
    `loginWall=${yn(e.login)}`,
    `fill(set=${result.composerFill ? yn(result.composerFill.set) : '?'} value=${result.composerFill ? yn(result.composerFill.valueMatches) : '?'} sendBtn=${result.composerFill ? yn(result.composerFill.sendButton) : '?'} sendEnabled=${result.composerFill && result.composerFill.sendButton ? yn(!result.composerFill.sendDisabledWhileFilled) : '?'} cleared=${result.composerFill ? yn(result.composerFill.cleared) : '?'})`,
    `drawer(visible=${result.drawer ? yn(result.drawer.visible) : '?'} dock=${result.drawer && result.drawer.railDock ? result.drawer.railDock : '?'} backCloses=${result.drawerAfterBack ? yn(!result.drawerAfterBack.visible) : '?'})`,
    `pageErrors=${result.console ? result.console.count : '?'}${result.console && result.console.first && result.console.first.length ? ` first="${result.console.first[0].slice(0, 80)}"` : ''}`,
    `network=${(result.network || []).length} requests`,
    failed.length ? `FAILED STEPS: ${failed.join('; ')}` : 'all steps ran',
  ].join(' | ');
}

/** The few readable lines: the summary, and the engine's own markup (why a piece may be missing). */
export function summaryAnnotations(result) {
  const lines = [annotation('notice', `CDP probe: ${summarize(result)}`)];
  const e = result.engineAfter || result.engine || {};
  if (e.engineMarkup) lines.push(annotation('notice', `CDP engine markup: ${JSON.stringify(e.engineMarkup)}`.slice(0, 3900)));
  if (e.composerControls) lines.push(annotation('notice', `CDP composer controls: ${JSON.stringify(e.composerControls)}`.slice(0, 3900)));
  return lines;
}

/**
 * The capture, made smaller step by step until it fits [maxChunks] annotations
 * (GitHub allows ten per step): each level drops the least useful detail first.
 */
export function slim(result, level) {
  const copy = JSON.parse(JSON.stringify(result));
  const kit = copy.kitExport;
  if (level >= 1 && kit) kit.snaps.forEach((sn) => { sn.landmarks = sn.landmarks.filter((l) => l.count > 0).map((l) => ({ selector: l.selector, count: l.count, visible: l.visible })); });
  if (level >= 2) { delete copy.steps; delete copy.engine; }
  if (level >= 3 && copy.network) copy.network.forEach((n) => { delete n.resShape; });
  if (level >= 4 && kit) kit.snaps.forEach((sn) => { delete sn.regions.sidebar; delete sn.regions.header; });
  return copy;
}

/** The whole capture as annotation lines: ≤ [maxChunks] chunks, plus a header saying which slimming level was needed. */
export function chunkAnnotations(result, maxChunks = 10) {
  for (let level = 0; level <= 5; level += 1) {
    const chunks = packChunks(JSON.stringify(slim(result, Math.min(level, 4))));
    if (chunks.length <= maxChunks || level === 5) {
      const head = annotation('notice', `CDP capture: ${chunks.length} chunk(s)${level ? `, slimmed to level ${Math.min(level, 4)}` : ''} — gzip+base64, reassemble in order`);
      return [head, ...chunks.slice(0, maxChunks).map((c, i) => annotation('notice', c, `cdp-capture-${i + 1}-of-${chunks.length}`))];
    }
  }
  return [];
}

/** Everything the probe prints by default (the chunks go in their own workflow step: annotations are limited per step). */
export function annotations(result) {
  return summaryAnnotations(result);
}

// ── command line ────────────────────────────────────────────────────────────

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

/** `--report <file>`: print the capture a previous run saved, as annotation chunks. */
export function report(file) {
  let result;
  try { result = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
    console.log(annotation('warning', `no CDP capture to report (${String((e && e.message) || e).slice(0, 120)})`));
    return 0;
  }
  for (const line of chunkAnnotations(result)) console.log(line);
  return 0;
}

/** Runtime/UI gate only; passing this does NOT prove that chat/tools work. */
export function acceptanceFailures(result) {
  const e = result.engineAfter || result.engine || {};
  const errors = [];
  if (!['arena.ai', 'www.arena.ai'].includes(e.host) || e.site?.id !== 'arena') errors.push('arena-profile-missing');
  if (!e.engine?.css || !e.engine?.root || e.engine?.engineApi !== 'object' || e.engine?.handleBack !== 'function') errors.push('engine-not-ready');
  if (['arena.ai', 'www.arena.ai'].includes(e.host) && (!e.skin || e.skin.active !== true)) errors.push('arena-skin-inactive');
  if (e.composer?.named !== 1 || !(e.composer?.rect?.[2] > 0 && e.composer?.rect?.[3] > 0)) errors.push('composer-not-visible');
  if (e.composer?.named === 1) {
    if (!e.skin || !['has', 'native'].includes(e.skin.composerTarget)) errors.push('composer-skin-target-missing');
    if (!e.skin || e.skin.sendInsideComposer !== true) errors.push('send-outside-composer');
    const sendRect = e.skin?.sendRect;
    if (!Array.isArray(sendRect) || !(Number(sendRect[2]) > 0 && Number(sendRect[3]) > 0)) {
      errors.push('send-target-not-visible');
    }
  }
  if (e.attach?.toggle !== 1) errors.push('plus-count-not-one');
  if (!e.attach?.siteButton || !(Number(e.attach.siteButton[2]) >= 24 && Number(e.attach.siteButton[3]) >= 24) ||
      e.attach.nativePlusVisible !== true || e.attach.nativePlusPointerIntact !== true ||
      e.attach.enginePlusOverlayReady !== true) {
    errors.push('arena-original-plus-native-bridge-not-ready');
  }
  if (result.sheetOpenedBy !== 'real-click') errors.push('plus-not-touch-actionable');
  if (!sheetIsOpen(result.originalPlusSheet)) errors.push('arena-original-plus-does-not-open-sheet');
  const fill = result.composerFill;
  if (!fill || fill.engine !== true || fill.set !== true || fill.valueMatches !== true || fill.cleared !== true) errors.push('composer-not-drivable');
  if (fill && fill.sendButton === false) errors.push('send-button-missing');
  const settingsCard = result.settingsCardBeforeClick;
  const cardOk = !!(settingsCard && settingsCard.present === true &&
      settingsCard.count === 1 && settingsCard.visible === true && settingsCard.insideSheet === true &&
      settingsCard.lastCard === true && settingsCard.legacySidebarRows === 0 &&
      settingsCard.sourceRailVisible !== true && settingsCard.sourceDock === 'sheet');
  if (!cardOk) errors.push('settings-card-not-last-in-plus-sheet');
  if (settingsCard && (settingsCard.sourceRailVisible === true || settingsCard.legacySidebarRows !== 0)) {
    errors.push('settings-sidebar-row-still-visible');
  }
  const drawer = result.drawer;
  if (!drawer || drawer.visible !== true) errors.push('settings-drawer-not-openable-from-sheet-card');
  else {
    if (drawer.railDock !== 'sheet') errors.push('settings-drawer-opened-by-wrong-entry');
    if (drawer.sheetVisible === true) errors.push('settings-sheet-not-closed-before-drawer');
  }
  if (!result.drawerAfterBack || result.drawerAfterBack.visible !== false) errors.push('settings-drawer-back-failed');
  for (const step of result.steps || []) {
    if (!step.ok && ['enable', 'reload', 'facts', 'facts-after'].includes(step.name)) errors.push(step.name + '-failed');
  }
  return errors;
}

export async function main() {
  const reportFile = arg('report', null);
  if (reportFile) return report(reportFile);
  const required = arg('required', '0') === '1';
  const host = arg('host', '127.0.0.1');
  const port = arg('port', '9222');
  const outDir = arg('out', '/tmp/emulator-smoke');
  const kitPath = arg('capture', 'tools/arena-capture/capture.js');
  const wait = Number(arg('wait', '12000'));
  let cdp;
  try {
    const targets = await (await fetch(`http://${host}:${port}/json`)).json();
    const pages = targets.filter((t) => t.type === 'page');
    const page = pages.find((t) => /arena\.ai/.test(t.url)) || pages[0];
    if (!page) { console.log(annotation(required ? 'error' : 'warning', 'CDP probe: the WebView has no page target')); return required ? 1 : 0; }
    const pageHost = new URL(page.url).host;
    console.log(`probing ${pageHost}${new URL(page.url).pathname.replace(/[0-9a-f-]{36}/g, '{uuid}')}`);
    cdp = await connect(page.webSocketDebuggerUrl);
    let kitSource = null;
    try { kitSource = fs.readFileSync(kitPath, 'utf8'); } catch { /* recorded as a failed step */ }
    const result = await probe(cdp, { kitSource, pageHost, wait });
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'cdp-capture.json'), JSON.stringify(result));
    for (const line of annotations(result)) console.log(line);
    const failures = acceptanceFailures(result);
    if (required && failures.length) console.log(annotation('error', 'Runtime gate: ' + failures.join(', ')));
    return required && failures.length ? 1 : 0;
  } catch (e) {
    console.log(annotation(required ? 'error' : 'warning', `CDP probe could not run: ${String((e && e.message) || e).slice(0, 300)}`));
    return required ? 1 : 0;
  } finally {
    if (cdp) cdp.close();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
