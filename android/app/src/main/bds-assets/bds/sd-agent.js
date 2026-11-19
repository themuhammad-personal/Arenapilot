/* ArenaPilot: MCP activity, Stop, reply recovery and the app settings entry. */
(function () {
  'use strict';
  if (window.__sdAgent && window.__sdAgent.version) return;

  var IDLE_MS = 10000;
  var HISTORY_TIMEOUT_MS = 5000;

  function bridge() { return window.AndroidBridge || null; }

  /** The app's language: the engine's own setting first, then the page / phone. */
  function isBn() {
    try {
      var e = window.__sdEngine;
      var l = e && typeof e.locale === 'function' ? String(e.locale() || '') : '';
      return String(l || document.documentElement.lang || navigator.language || '').toLowerCase().indexOf('bn') === 0;
    } catch (_) { return false; }
  }

  function t(en, bn) { return isBn() ? bn : en; }

  function toast(message) {
    try {
      var e = window.__sdEngine;
      if (e && typeof e.toast === 'function') { e.toast(message); return; }
    } catch (_) {}
    console.info('[SD]', message);
  }

  // Consult the live configuration: an arbitrary URL in a chat is not permission.
  function configured(ref) {
    var e = window.__sdEngine;
    return !!(e && typeof e.hasMcpServer === 'function' && e.hasMcpServer(ref));
  }

  function directTools() {
    if (!onArena()) return true;
    try {
      var site = window.__sdSite;
      return !!(site && typeof site.arenaCapabilities === 'function' && site.arenaCapabilities().mcp === true);
    } catch (_) { return false; }
  }

  function parseAttrs(raw) {
    var a = {};
    // Model variants sometimes put attribute values in backticks. Treat
    // them as a quote delimiter (including ">" inside the quoted JSON), not
    // as part of an unquoted tool/url/args value.
    var re = /([A-Za-z0-9_:-]+)\s*=\s*("([^"]*)"|'([^']*)'|\x60([^\x60]*)\x60|([^\s"'\x60>]+))/g;
    var m;
    while ((m = re.exec(raw))) {
      a[m[1]] = m[3] !== undefined ? m[3] :
        (m[4] !== undefined ? m[4] : (m[5] !== undefined ? m[5] : m[6]));
    }
    return a;
  }

  /** Every <APH:AUTO:MCP …>body</APH:AUTO:MCP> (or self-closing) tag, in order. */
  function parseTags(text) {
    var out = [];
    var s = String(text || '');
    var re = /<(?:APH|[BS]DS):(?:AUTO:)?MCP\b/gi;
    var m;
    while ((m = re.exec(s))) {
      var i = m.index + m[0].length;
      var q = null;
      for (; i < s.length; i++) {
        var c = s[i];
        if (q) { if (c === q) q = null; }
        else if (c === '"' || c === "'" || c === '\x60') q = c;
        else if (c === '>') break;
      }
      if (i >= s.length) break;
      var attrsRaw = s.slice(m.index + m[0].length, i);
      var selfClosing = /\/\s*$/.test(attrsRaw);
      if (selfClosing) attrsRaw = attrsRaw.replace(/\/\s*$/, '');
      var body = '';
      var end = i + 1;
      if (!selfClosing) {
        var close = /<\/(?:APH|[BS]DS):(?:AUTO:)?MCP\s*>/gi;
        close.lastIndex = i + 1;
        var cm = close.exec(s);
        if (cm) { body = s.slice(i + 1, cm.index); end = cm.index + cm[0].length; }
      }
      out.push({ attrs: parseAttrs(attrsRaw), body: body, closed: selfClosing || end > i + 1 });
      re.lastIndex = end;
    }
    return out;
  }

  function b64urlDecode(v) {
    var s = String(v || '').trim().replace(/-/g, '+').replace(/_/g, '/');
    if (!s) return null;
    s += '='.repeat((4 - s.length % 4) % 4);
    try {
      var bin = atob(s);
      var bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new TextDecoder().decode(bytes);
    } catch (_) { return null; }
  }

  function parseJsonObject(text) {
    var s = String(text || '').trim();
    if (!s) return null;
    // Tolerate a ```json fence around the body.
    var f = s.match(/^```[a-zA-Z0-9_-]*\s*\n([\s\S]*?)\n?```$/);
    if (f) s = f[1].trim();
    try {
      var v = JSON.parse(s);
      return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
    } catch (_) { return null; }
  }

  function tagArgs(tag) {
    var a = tag.attrs || {};
    var b64 = a.base64Args || a.base64args;
    if (b64) {
      var dec = parseJsonObject(b64urlDecode(b64));
      if (dec) return dec;
    }
    if (a.args) {
      var v = parseJsonObject(a.args);
      if (v) return v;
    }
    return parseJsonObject(tag.body);
  }

  function messageText(m) {
    if (!m || typeof m !== 'object') return '';
    if (Array.isArray(m.fragments) && m.fragments.length) {
      return m.fragments
        .filter(function (f) { return f && typeof f.content === 'string' && !/THINK/i.test(String(f.type || '')); })
        .map(function (f) { return f.content; })
        .join('\n');
    }
    return typeof m.content === 'string' ? m.content : '';
  }

  function onArena() {
    try { return !!(window.__sdSite && window.__sdSite.id === 'arena'); } catch (_) { return false; }
  }

  /**
   * The id of the open chat. DeepSeek's page is /chat/s/{id}; arena's is /c/{id}.
   * This only knew DeepSeek's, so on arena it was always null — and every
   * feature that starts with "if (!sid) return" (the keep-going nudge, the
   * Continue chip) silently did nothing. A fresh
   * arena chat has no id in the URL yet, so arena falls back to a placeholder.
   */
  function sessionId() {
    var href = String(location.href || '');
    var m = href.match(/\/chat\/s\/([^/?#]+)/);
    if (m) return m[1];
    if (onArena()) {
      m = href.match(/\/c\/([^/?#]+)/);
      return m ? m[1] : 'arena';
    }
    return null;
  }

  /** Chat history through the engine's own hook (it adds the auth header). */
  function requestHistory(sid) {
    // arena has no history endpoint the engine may call. injected.js records
    // the raw turns the page itself sent and received (the exact text, not the
    // markdown-rendered DOM) and hands them over in DeepSeek's message shape.
    if (onArena()) {
      try {
        var rec = window.__sdArena;
        if (rec && typeof rec.history === 'function') return Promise.resolve(rec.history());
      } catch (_) {}
      return Promise.resolve(null);
    }
    return new Promise(function (resolve) {
      var done = false;
      var timer = null;
      function finish(v) {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener('bds:history-msgs', on);
        resolve(v);
      }
      function on(ev) {
        var d = ev && ev.detail;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
        var bd = d && d.data && d.data.biz_data;
        if (!bd || !bd.chat_session || bd.chat_session.id !== sid) return;
        finish(Array.isArray(bd.chat_messages) ? bd.chat_messages : null);
      }
      timer = setTimeout(function () { finish(null); }, HISTORY_TIMEOUT_MS);
      window.addEventListener('bds:history-msgs', on);
      try {
        window.dispatchEvent(new CustomEvent('bds:request-history-msgs', { detail: JSON.stringify({ sessionId: sid }) }));
      } catch (_) { finish(null); }
    });
  }

  // ── Agent activity, Stop ───────────────────────────────────────────────────

  var state = { pending: 0, active: false, lastActivity: 0, label: '' };
  window.__sdAgentStopped = false;

  function describe(p) {
    return String(p && p.toolName || t('Working…', 'কাজ করছে…')).slice(0, 70);
  }

  function generating() {
    try {
      var e = window.__sdEngine;
      if (e && typeof e.isGenerating === 'function') return !!e.isGenerating();
    } catch (_) {}
    return !!document.querySelector('.ds-icon-stop-circle, .ds-icon-stop');
  }

  var pollTimer = null;

  function ensurePoll() {
    if (pollTimer) return;
    pollTimer = setInterval(function () {
      if (generating()) state.lastActivity = Date.now();
      if (state.active && state.pending === 0 && Date.now() - state.lastActivity > IDLE_MS) {
        state.active = false;
        render();
      }
      if (!state.active) { clearInterval(pollTimer); pollTimer = null; }
    }, 1000);
  }

  function beginCall(payload) {
    // Nudges are counted per instruction of the user, not per tool call: a
    // model that answers a nudge by redoing work must not earn new nudges.
    var scope = taskScope();
    if (scope !== state.scope) { state.pending = 0; flow.base = flow.calls; flow.nudges = 0; }
    state.scope = scope;
    flow.calls++;
    state.pending++;
    state.active = true;
    state.lastActivity = Date.now();
    state.label = describe(payload);
    render();
    ensurePoll();
  }

  function endCall(scope) {
    if (scope !== state.scope) return;
    state.pending = Math.max(0, state.pending - 1);
    state.lastActivity = Date.now();
    render();
  }

  function clickOfficialStop() {
    if (window.__sdSite && window.__sdSite.id === 'arena') {
      // The Arena stop labels remain MODELLED until a live-stream capture.
      // Never fall back to DeepSeek icons or a page-wide "stop" substring:
      // a reply, preview or our own agent chip can contain unrelated controls.
      try {
        var input = document.querySelector('textarea[name="message"]');
        var form = input && input.closest('form');
        var profile = window.__sdSite.profile;
        var selectors = profile && profile.selectors && profile.selectors.stopButton && profile.selectors.stopButton.selectors;
        if (!form || !Array.isArray(selectors) || !selectors.length) return;
        var buttons = Array.from(form.querySelectorAll(selectors.join(', '))).filter(function (b) {
          if (b.disabled || b.getAttribute('aria-disabled') === 'true' ||
              b.closest('#bds-root, #sd-agent-chip, #sd-agent-confirm, .bds-attach-wrapper, .bds-question-panel, .bds-dr-revision-panel, [hidden], [inert], [aria-hidden="true"]')) return false;
          if (!/^stop(?: generating| response)?$/i.test(String(b.getAttribute('aria-label') || '').trim())) return false;
          var rect = b.getBoundingClientRect(), style = window.getComputedStyle(b);
          return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
        });
        if (buttons.length === 1) buttons[0].click();
      } catch (_) { /* Native stop must still complete if the site DOM changes. */ }
      return;
    }
    var icon = document.querySelector('.ds-icon-stop-circle, .ds-icon-stop');
    if (!icon) return;
    var btn = icon.closest('[role="button"], button') || icon;
    try { btn.click(); } catch (_) {}
  }

  function stopAgent(silent) {
    window.__sdAgentStopped = true;
    window.__sdAgentStopEpoch = (window.__sdAgentStopEpoch || 0) + 1;
    flow.timers.forEach(clearTimeout); flow.timers = [];
    clearTimeout(recover.timer); recover.pending = false;
    if (directTools()) clickOfficialStop();
    state.active = false;
    state.pending = 0;
    hideContinueChip();
    render();
    if (!silent) toast(t('Agent stopped. Write a message to continue.', 'এজেন্ট থামানো হয়েছে। চালিয়ে যেতে একটি মেসেজ লিখুন।'));
  }

  function resume() {
    clearTimeout(recover.timer); recover.pending = false;
    recover.cuts = 0;
    recover.errs = 0;
    flow.nudges = 0;
    flow.base = flow.calls;
    if (window.__sdAgentStopped) window.__sdAgentStopped = false;
  }

  function isComposer(el) {
    return !!(el && el.closest && el.closest('textarea, [contenteditable="true"], [role="textbox"]') &&
      !el.closest('#bds-root, #sd-agent-chip, #sd-agent-confirm'));
  }

  function installResumeListeners() {
    // Only the user's own typing or tapping re-arms the loop; the engine's
    // automatic messages dispatch untrusted events.
    document.addEventListener('input', function (ev) { if (ev.isTrusted && isComposer(ev.target)) resume(); }, true);
    document.addEventListener('keydown', function (ev) {
      if (!ev.isTrusted || ev.key !== 'Enter' || !isComposer(ev.target)) return;
      resume();
      if (!ev.shiftKey) userSent();
    }, true);
    document.addEventListener('click', function (ev) {
      if (!ev.isTrusted || !ev.target || !ev.target.closest) return;
      var btn = ev.target.closest('[role="button"], button');
      if (!btn || !btn.querySelector) return;
      if (btn.querySelector('.ds-icon-send')) { resume(); userSent(); }
      // The user stopped a reply by hand: no automatic "continue" after it.
      else if (btn.querySelector('.ds-icon-stop-circle, .ds-icon-stop')) flow.nudges = MAX_NUDGES;
    }, true);
  }

  // ── Scroll: the reader's position wins ───────────────────────────────────
  //
  // DeepSeek jumps to the bottom of the chat whenever a message is sent,
  // including the agent's automatic ones, so a user reading further up was
  // pulled down again and again. Once the user has scrolled away from the
  // bottom, a jump that no touch, wheel, click or key of the user caused is
  // undone. The user's own actions (sending, the scroll-down arrow, flinging
  // down) always go through, and following the reply resumes as soon as the
  // user is back at the bottom.

  var USER_WINDOW_MS = 1200;
  var MOMENTUM_GAP_MS = 150;
  var NEAR_BOTTOM_PX = 96;
  var guard = { touching: false, moved: false, dragged: false, lastInput: 0, states: null, fix: null, epoch: 0 };

  /** The user sent a message: they want to follow the reply, wherever they were. */
  function userSent() { guard.epoch++; hideContinueChip(); }

  function guardScroller(ev) {
    var tg = ev && ev.target;
    if (!tg || tg === document || tg === window) return document.scrollingElement || document.documentElement || null;
    return tg.nodeType === 1 ? tg : null;
  }

  function guardSkips(el) {
    if (!el || !el.closest || el.clientHeight < 160) return true;
    return !!el.closest('#bds-root, #bds-drawer, .bds-attach-dropdown, .bds-project-panel, #sd-agent-confirm, ' +
      '#sd-agent-chip, textarea, [contenteditable="true"], pre, [role="dialog"]');
  }

  function guardUserActive() {
    var idle = Date.now() - guard.lastInput;
    if (guard.touching && idle > 8000) guard.touching = false;   // a lost touchend
    return guard.touching || idle < USER_WINDOW_MS;
  }

  function onGuardScroll(ev) {
    var el = guardScroller(ev);
    if (!directTools() || !guard.states || guardSkips(el)) return;
    var now = Date.now();
    var top = el.scrollTop;
    var nearBottom = el.scrollHeight - el.clientHeight - top <= NEAR_BOTTOM_PX;
    var st = guard.states.get(el);
    // A new chat starts at its own bottom: nothing carries over.
    if (!st || st.url !== location.href || st.epoch !== guard.epoch) {
      st = { url: location.href, epoch: guard.epoch, away: false, top: top, last: 0, user: false };
      guard.states.set(el, st);
    }
    var gap = now - st.last;
    st.last = now;
    if (guard.fix && guard.fix.el === el) {
      var ours = Math.abs(top - guard.fix.top) < 2;
      guard.fix = null;
      if (ours) return;
    }
    // Touch, wheel, click or key of the user, and the fling that follows it.
    // A drag or a fling moves the view a little per frame: one big jump down
    // during or right after it is still somebody else's.
    var byUser = guardUserActive() || (st.user && gap < MOMENTUM_GAP_MS);
    if (byUser && (guard.touching || guard.dragged) && top - st.top > el.clientHeight * 0.75) byUser = false;
    if (byUser) {
      st.user = true;
      st.away = !nearBottom;
      st.top = top;
      return;
    }
    st.user = false;
    if (!st.away) { st.top = top; return; }
    var jump = top - st.top;
    if (jump > 0 && (nearBottom || jump > el.clientHeight * 0.6)) {
      guard.fix = { el: el, top: st.top };
      el.scrollTop = st.top;
      return;
    }
    // Small moves (content above changing size) and moves up are kept; the
    // frames of one animated jump are measured from where it started.
    if (jump < 0 || gap >= MOMENTUM_GAP_MS) st.top = top;
  }

  function touchY(ev) {
    var t = ev && ev.touches && ev.touches[0];
    return t && typeof t.clientY === 'number' ? t.clientY : 0;
  }

  function installScrollGuard() {
    if (typeof WeakMap !== 'function' || guard.states) return;
    guard.states = new WeakMap();
    var mark = function (ev) {
      if (!ev.isTrusted) return;
      if (ev.type === 'wheel') guard.dragged = true;
      else if (ev.type === 'keydown' || ((ev.type === 'mousedown' || ev.type === 'pointerdown') && !guard.touching)) guard.dragged = false;
      // Typing a character is not a scroll of the user; Enter, arrows and pages are.
      if (ev.type === 'keydown' && typeof ev.key === 'string' && ev.key.length === 1) return;
      guard.lastInput = Date.now();
    };
    document.addEventListener('touchstart', function (ev) {
      if (!ev.isTrusted) return;
      guard.touching = true;
      guard.moved = false;
      guard.dragged = false;
      guard.startY = touchY(ev);
      guard.lastInput = Date.now();
    }, { capture: true, passive: true });
    document.addEventListener('touchmove', function (ev) {
      if (!ev.isTrusted || guard.moved) return;
      // Beyond the touch slop: a drag, not a shaky tap.
      if (Math.abs(touchY(ev) - guard.startY) > 10) guard.moved = guard.dragged = true;
    }, { capture: true, passive: true });
    var release = function (ev) {
      if (!ev.isTrusted) return;
      guard.touching = !!(ev.touches && ev.touches.length);
      // A tap (the scroll-down arrow, a link) may jump anywhere; a drag may not.
      guard.dragged = guard.moved;
      guard.lastInput = Date.now();
    };
    document.addEventListener('touchend', release, { capture: true, passive: true });
    document.addEventListener('touchcancel', release, { capture: true, passive: true });
    ['touchmove', 'wheel', 'pointerdown', 'mousedown', 'keydown'].forEach(function (type) {
      document.addEventListener(type, mark, { capture: true, passive: true });
    });
    document.addEventListener('scroll', onGuardScroll, { capture: true, passive: true });
  }

  // ── Continuity: never leave a task half done ──────────────────────────────
  //
  // 1. The engine looks at a reply's tool calls only when the DOM of that reply
  //    changes. When the last change lands while the stop button is still
  //    showing, the calls were never run and the agent just stood still. After
  //    every reply the engine is asked to look again (idempotent: each call is
  //    handled once per message).
  // 2. In the middle of a tool chain, a reply that ends without a tool call but
  //    announces more work ("Now I'll run the tests:") or carries a tool tag the
  //    engine could not read, gets one quiet, invisible nudge to continue.

  var flow = { calls: 0, base: 0, nudges: 0, was: false, timers: [] };
  var MAX_NUDGES = 2;
  var REPROCESS_AT = [700, 2900, 5200];
  var NUDGE_AT = 6200;

  function reprocess() {
    if (!directTools()) return;
    try { var e = window.__sdEngine; if (e && typeof e.reprocess === 'function') e.reprocess(); } catch (_) {}
  }

  /** Last line of the prose, without code blocks. */
  function tailLine(text) {
    var s = String(text || '').replace(/```[\s\S]*?(```|$)/g, ' ').replace(/<(?:APH|[BS]DS):[\s\S]*$/i, ' ');
    var lines = s.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
    return lines.length ? lines[lines.length - 1].slice(-300) : '';
  }

  // Closings and success lines: the reply is a finished answer. Missing a
  // stalled reply costs one "continue" from the user; nudging a finished one
  // makes the model redo the work, so every doubt means "finished".
  var CLOSING = /\b(let me know|feel free|if you(?:'d| would)? (?:like|need|want|have)|hope (?:this|that|it) helps|happy coding|enjoy|anything else|all set|you can now|summary)\b/i;
  var CLOSING_BN = /(জানাবেন|জানান|বলবেন|বলুন|আশা করি|প্রয়োজনে|দরকার হলে|সম্পন্ন|শেষ হয়েছে|তৈরি হয়েছে|সারসংক্ষেপ)/;
  var DONE = /(✅|✔|🎉|\b(?:done|finished|complete|completed|succeeded|successfully|all tests pass(?:ed)?)\b)/i;

  /** The reply (before any tool tag) ends with a code block. */
  function endsWithBlock(text) {
    var s = String(text || '').replace(/<(?:APH|[BS]DS):[\s\S]*$/i, '').trim();
    return /```\s*$/.test(s);
  }

  /** The reply announces more work instead of finishing or asking. */
  function looksUnfinished(text) {
    if (endsWithBlock(text)) return false;
    var l = tailLine(text).replace(/[*_`~]+/g, '').trim();
    if (!l || /[?？]\s*$/.test(l)) return false;
    if (CLOSING.test(l) || CLOSING_BN.test(l) || DONE.test(l)) return false;
    if (/(:|：|…|\.\.\.)\s*$/.test(l)) return true;
    if (/\b(let me|let's|i'll|i will|i am going to|i'm going to|now i|next,? i|going to)\b/i.test(l)) return true;
    return /(করছি|করব|করবো|করা যাক|দেখি|দেখা যাক|দেখছি|চালাচ্ছি|চালাই|লিখছি|শুরু করছি|ঠিক করছি)\s*[।.:…!]*\s*$/.test(l);
  }

  function isToolResultMessage(m) {
    var text = messageText(m);
    return /\[(?:APH|[BS]DS):AUTO_MCP_(RESULT|ERROR)\]|\[(?:APH|[BS]DS):AUTO\] Agent continue/.test(text);
  }

  /** What to tell the model, or null when the reply is fine as it is. */
  function nudgeFor(messages) {
    if (!messages || messages.length < 2) return null;
    var last = messages[messages.length - 1];
    if (String((last && last.role) || '').toUpperCase() !== 'ASSISTANT') return null;
    var prev = null;
    for (var i = messages.length - 2; i >= 0; i--) {
      if (String((messages[i] && messages[i].role) || '').toUpperCase() === 'USER') { prev = messages[i]; break; }
    }
    if (!prev || !isToolResultMessage(prev)) return null;
    var text = messageText(last);
    var tags = parseTags(text).filter(function (tag) {
      var a = tag.attrs || {};
      return configured(a.url || a.serverUrl || '');
    });
    if (tags.length) {
      var bad = tags.filter(function (tag) { return !tagArgs(tag); });
      if (!bad.length) return null;
      return 'Your last tool call could not be read: its arguments must be one valid JSON object. ' +
        'Send the tool call again with valid JSON (escape quotes and newlines inside strings, or use base64Args).';
    }
    if (!looksUnfinished(text)) return null;
    return 'Your last reply ended without a tool call. If steps of the task remain, continue now with the next tool call. ' +
      'If the task is complete, reply with one short line saying so and no tool call. Never repeat work that is already done.';
  }

  // Capture this before scheduling work, not when its callback eventually fires.
  function taskScope() {
    if (window.__sdAgentStopped || !directTools()) return null;
    return String(location.href || '').split(/[?#]/)[0] + '|' +
      (onArena() ? window.__sdSite.arenaModality() : '') + '|' + (window.__sdAgentStopEpoch || 0);
  }

  function sendNudge(body, countBudget) {
    var e = window.__sdEngine;
    var origin = taskScope();
    if (!origin || !e || typeof e.sendQuiet !== 'function') return;
    // A user-tapped Continue never spends the automatic keep-going budget.
    if (countBudget !== false) flow.nudges++;
    e.sendQuiet(['<ArenaPilot>', '[APH:AUTO] Agent continue', body, '</ArenaPilot>'].join('\n'), 'Agent continue', function () { return origin === taskScope(); });
  }

  function maybeNudge(callsAtEnd, origin) {
    if (!origin || origin !== taskScope() || recover.pending) return;
    if (flow.calls !== callsAtEnd || flow.nudges >= MAX_NUDGES || window.__sdAgentStopped || !autoContinue()) return;
    // Only inside a task the agent works on for the current instruction.
    if (flow.calls === flow.base || state.scope !== origin) return;
    if (state.pending || mcpPending || generating()) return;
    var sid = sessionId();
    if (!sid || !directTools()) return;
    requestHistory(sid).then(function (messages) {
      if (origin !== taskScope() || sid !== sessionId() || flow.calls !== callsAtEnd || window.__sdAgentStopped || state.pending || mcpPending || generating()) return;
      var body = nudgeFor(messages);
      if (body) sendNudge(body);
    });
  }

  function onReplyEnd() {
    var origin = taskScope();
    if (!origin) return;
    var callsAtEnd = flow.calls;
    function later(f, ms) { flow.timers.push(setTimeout(function () { if (origin === taskScope()) f(); }, ms)); }
    REPROCESS_AT.forEach(function (ms) { later(reprocess, ms); });
    later(function () { maybeNudge(callsAtEnd, origin); }, NUDGE_AT);
    // After the automatic path has had its chance, offer the human one.
    later(maybeOfferContinue, NUDGE_AT + 1500);
  }

  // ── Recovery: a server error or a cut-off reply must not end the task ───────
  //
  // Direct Chat is where tasks used to die: arena answered with an error (rate
  // limit, 5xx, a dropped stream) or the reply hit the output limit in the middle
  // of a tool call, and nothing noticed — the loop just stopped and the user saw
  // a half-finished task. injected.js now reports every finished turn as
  // `bds:arena-turn`; this decides what to do about the bad ones:
  //   cut     the reply ended on the output limit, or inside a tool call
  //           -> ask the model to continue, in smaller pieces
  //   toobig  arena rejected the message as too large (HTTP 413)
  //           -> ask the model to re-run with less output
  //   error   429 / 5xx / dropped stream / empty reply
  //           -> wait (back-off) and ask the model to carry on, restating the
  //              last message in case arena never received it
  //   fatal   400 / 401 / 403: sign-in, captcha or a malformed request —
  //           retrying cannot help, so say so instead of looping
  //   empty   a stream with no text: ambiguous, so it only tells the user and
  //           offers the Continue chip — it never sends a message by itself
  // Each path has a small budget (re-armed by the user's own next message), and
  // none of it runs after Stop.

  var recover = { cuts: 0, errs: 0, pending: false, timer: null, last: null };
  var MAX_CUTS = 3;
  var MAX_ERRS = 3;

  function arenaTurns() {
    try {
      var rec = window.__sdArena;
      return rec && typeof rec.history === 'function' ? rec.history() : [];
    } catch (_) { return []; }
  }

  function lastAssistantRaw() {
    var h = arenaTurns();
    for (var i = h.length - 1; i >= 0; i--) {
      if (String(h[i].role).toUpperCase() === 'ASSISTANT') return String(h[i].content || '');
    }
    return '';
  }

  function lastUserRaw() {
    try {
      var rec = window.__sdArena;
      return rec && typeof rec.lastUser === 'function' ? String(rec.lastUser() || '') : '';
    } catch (_) { return ''; }
  }

  /** The reply ends inside a tool call (opening tag without its end). */
  function endsInsideToolCall(text) {
    var s = String(text || '').replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');
    var opens = (s.match(/<(?:APH|[BS]DS):(?:AUTO:)?MCP\b/gi) || []).length;
    if (!opens) return false;
    var tags = parseTags(s);
    if (tags.length < opens) return true;
    return !tags[tags.length - 1].closed;
  }

  function middleCut(text, max) {
    var s = String(text || '');
    if (s.length <= max) return s;
    var head = Math.floor(max * 0.4);
    return s.slice(0, head) + '\n…[cut]…\n' + s.slice(s.length - (max - head));
  }

  function classifyTurn(d) {
    if (!d.ok) {
      var st = Number(d.status) || 0;
      if (st === 413) return 'toobig';
      if (st === 400 || st === 401 || st === 403) return 'fatal';
      return 'error';
    }
    // A stream with no text at all is ambiguous (a model that answered with
    // nothing, or a page that mocks the network), so it is never retried by
    // sending a message: the user is told and the Continue chip is offered.
    if (d.empty) return 'empty';
    if (/length|max[_-]?(?:output[_-]?)?tokens/i.test(String(d.finishReason || ''))) return 'cut';
    if (endsInsideToolCall(lastAssistantRaw())) return 'cut';
    return null;
  }

  function why(d) {
    if (d.kind === 'http') return 'HTTP ' + d.status;
    if (d.kind === 'network') return 'network error';
    if (d.kind === 'broken') return 'the stream was interrupted';
    if (d.kind === 'stream-error') return String(d.message || 'stream error').slice(0, 120);
    if (d.empty) return 'empty reply';
    return 'error';
  }

  function backoffMs(d, n) {
    var rate = Number(d.status) === 429 || /rate|too many|quota|limit/i.test(String(d.message || ''));
    var steps = rate ? [15000, 30000, 60000] : [3000, 8000, 20000];
    return steps[Math.min(n, steps.length) - 1];
  }

  function recoveryBody(kind, d) {
    if (kind === 'cut') {
      return 'Your last reply was cut off by the output length limit. Continue exactly where it stopped and do not repeat anything. ' +
        'If it stopped inside a tool call, check whether it ran before retrying. Use only arguments supported by that tool and keep the next reply short.';
    }
    if (kind === 'toobig') {
      return 'The server rejected the last message because it was too large. The result of your last action did not reach you. ' +
        'Use a smaller result or summarize it, without repeating actions that already succeeded.';
    }
    var last = middleCut(lastUserRaw(), 6000);
    return 'The previous request failed on the server (' + why(d) + '). Continue the task from where you were; do not redo work that is already finished.' +
      (last ? ' If you never received my last message, it is repeated here:\n---\n' + last + '\n---' : '');
  }

  function fireRecovery(kind, d, tries, origin) {
    if (!directTools() || origin !== recoveryScope() || window.__sdAgentStopped) { recover.pending = false; return; }
    if ((generating() || state.pending > 0 || mcpPending) && tries < 25) {
      recover.timer = setTimeout(function () { fireRecovery(kind, d, tries + 1, origin); }, 800);
      return;
    }
    recover.pending = false;
    recover.last = { kind: kind, at: Date.now() };
    sendNudge(recoveryBody(kind, d), false);
  }

  function recoveryScope() { return taskScope(); }

  function scheduleRecovery(kind, d) {
    if (recover.pending) return;
    if (kind === 'empty') {
      toast(t('Arena returned an empty reply. Tap Continue (or send "continue") to retry.',
        'Arena খালি উত্তর দিয়েছে। আবার চেষ্টা করতে Continue চাপুন (বা "continue" পাঠান)।'));
      var atEmpty = taskScope();
      setTimeout(function () { if (atEmpty === taskScope()) maybeOfferContinue(); }, 1500);
      return;
    }
    if (kind === 'fatal') {
      toast(Number(d.status) === 400
        ? t('Arena rejected the request (HTTP 400). Send your message again.', 'Arena অনুরোধটি গ্রহণ করেনি (HTTP 400)। মেসেজটি আবার পাঠান।')
        : t('Arena refused the request (HTTP ' + d.status + '). Sign in again or finish the check on the page, then send your message.',
            'Arena অনুরোধ প্রত্যাখ্যান করেছে (HTTP ' + d.status + ')। আবার সাইন ইন করুন বা পেজের যাচাই শেষ করে মেসেজ পাঠান।'));
      return;
    }
    if (!autoContinue()) {
      toast(t('The reply did not finish (' + why(d) + '). Send "continue" to carry on.', 'উত্তরটি শেষ হয়নি (' + why(d) + ')। চালিয়ে যেতে "continue" পাঠান।'));
      return;
    }
    var n = kind === 'error' ? ++recover.errs : ++recover.cuts;
    var max = kind === 'error' ? MAX_ERRS : MAX_CUTS;
    if (n > max) {
      toast(t('Arena keeps failing (' + why(d) + '). Stopped retrying — send a message to continue.',
        'Arena বারবার ব্যর্থ হচ্ছে (' + why(d) + ')। আর চেষ্টা করা হচ্ছে না — চালিয়ে যেতে মেসেজ পাঠান।'));
      return;
    }
    var delay = kind === 'error' ? backoffMs(d, n) : 1200;
    recover.pending = true;
    if (kind === 'error') {
      toast(t('Arena error (' + why(d) + '). Retrying in ' + Math.round(delay / 1000) + ' s (' + n + '/' + max + ')…',
        'Arena ত্রুটি (' + why(d) + ')। ' + Math.round(delay / 1000) + ' সেকেন্ডে আবার চেষ্টা (' + n + '/' + max + ')…'));
    } else if (kind === 'cut') {
      toast(t('The reply was cut off. Asking the AI to continue…', 'উত্তর মাঝপথে কেটে গেছে। AI-কে চালিয়ে যেতে বলা হচ্ছে…'));
    } else {
      toast(t('The last result was too large. Asking the AI to shorten it…', 'শেষ ফলাফল অনেক বড় ছিল। AI-কে ছোট করতে বলা হচ্ছে…'));
    }
    var origin = recoveryScope();
    recover.timer = setTimeout(function () { fireRecovery(kind, d, 0, origin); }, delay);
  }

  function onArenaTurn(ev) {
    try {
      var d = ev && ev.detail;
      if (typeof d === 'string') d = JSON.parse(d);
      if (!d || !onArena() || !directTools() || window.__sdAgentStopped) return;
      var kind = classifyTurn(d);
      if (!kind) { recover.errs = 0; return; }
      scheduleRecovery(kind, d);
    } catch (_) {}
  }

  try { window.addEventListener('bds:arena-turn', onArenaTurn); } catch (_) {}

  // ── Reply-end detection ─────────────────────────────────────────────────────
  //
  // The old watcher only acted when the 500 ms poll happened to see the page
  // generating at one tick and idle at the next. A short agent reply ("Now I
  // will run the tests:") can stream and finish between two polls, which left
  // keep-going nudges, the Continue chip and the reprocess timers dead on
  // arrival. Three signals now cover the gap: the poll edge, a thread-growth
  // stall check, and injected.js's per-completion bds:token-usage event. Each
  // reply ends exactly once (signature match, so reprocess or an outgoing
  // quiet send cannot retrigger it).
  function threadSig() {
    try {
      var all = messageNodes();
      if (!all.length) return '0';
      var last = all[all.length - 1];
      var md = (last.querySelector && last.querySelector('.ds-markdown,.prose')) || last;
      return all.length + ':' + String(md.textContent || '').length;
    } catch (_) { return ''; }
  }

  var lastEndSig = null;
  function noteReplyEnd(force) {
    var sig = threadSig();
    // The poll edge (force) is once-per-generating-window by construction; the
    // fallback and completion-event paths must additionally see new thread
    // content so reprocess or an outgoing quiet send cannot retrigger them.
    if (!force && sig === lastEndSig) return;
    lastEndSig = sig;
    onReplyEnd();
  }
  function checkReplyEnd() {
    try { if (!generating()) noteReplyEnd(); } catch (_) {}
  }

  function watchReplies() {
    var lastSig = threadSig();
    var lastGrow = 0, lastScope = taskScope();
    setInterval(function () {
      var scope = taskScope();
      if (lastScope !== scope) {
        lastScope = scope; lastSig = threadSig(); lastGrow = 0; lastEndSig = lastSig;
        flow.was = false; hideContinueChip();
        if (chip) chip.hidden = true;
      }
      if (!scope) {
        if (flow.timers.length) { flow.timers.forEach(clearTimeout); flow.timers = []; }
        hideContinueChip();
        if (chip) chip.hidden = true;
        flow.was = false;
        return;
      }
      var g = generating();
      if (g && flow.timers.length) { flow.timers.forEach(clearTimeout); flow.timers = []; }
      if (g) hideContinueChip();
      if (flow.was && !g) noteReplyEnd(true);
      flow.was = g;
      // Fallback for replies the poll cannot see: the thread grew and then
      // went quiet while nothing is generating.
      var sig = threadSig();
      if (sig !== lastSig) { lastSig = sig; lastGrow = Date.now(); }
      else if (!g && lastGrow && Date.now() - lastGrow >= 450 && !flow.timers.length) {
        lastGrow = 0;
        noteReplyEnd();
      }
    }, 500);
    try {
      // injected.js fires this when a completion response ends — the most
      // reliable end-of-reply signal on the real page.
      window.addEventListener('bds:token-usage', function () {
        var scope = taskScope();
        if (!scope) return;
        function check() { if (scope === taskScope()) checkReplyEnd(); }
        setTimeout(check, 600);
        var late = setTimeout(check, 1800);
        if (late && typeof late.unref === 'function') late.unref();
      });
    } catch (_) {}
  }

  // ── Continue task chip ──────────────────────────────────────────────────────
  //
  // The run-once gate (sd_seen) rightly refuses to re-run finished tool calls,
  // but a crash or reload right after a finished reply can leave the chain
  // stalled with no automatic way forward. When the loop is idle and the last
  // assistant reply still owes work — a tool call whose result never arrived,
  // or an unfinished promise — the user gets one small chip: tap to let the
  // agent continue (quietly, and told to never repeat finished work). It is
  // user-initiated, so it never counts against the 2-nudge keep-going budget.

  var CONTINUE_BODY = {
    'missing-result': 'Your last tool call has no result in this chat. If it did not run, send that tool call again (once); if it already ran, never run it again. Then continue the task. Never repeat work that is already done.',
    'unreadable': 'Your last tool call could not be read: its arguments must be one valid JSON object. Send the tool call again with valid JSON (escape quotes and newlines inside strings, or use base64Args). Never repeat work that is already done.',
    'unfinished': 'Your last reply ended without a tool call. If steps of the task remain, continue now with the next tool call. If the task is complete, reply with one short line saying so and no tool call. Never repeat work that is already done.'
  };

  /**
   * What the last assistant reply still owes the task, or null when the
   * conversation is at rest. Pure scan of the history messages:
   * 'missing-result' — a configured MCP tool call is the last thing said
   * (its result never arrived); 'unreadable' — tool tags the engine could not
   * parse; 'unfinished' — the reply announces more work but carries no call.
   */
  function lastTaskStall(messages) {
    if (!messages || !messages.length) return null;
    var last = messages[messages.length - 1];
    if (String((last && last.role) || '').toUpperCase() !== 'ASSISTANT') return null;
    var text = messageText(last);
    if (!text) return null;
    var tags = parseTags(text).filter(function (tag) {
      var a = tag.attrs || {};
      return configured(a.url || a.serverUrl || '');
    });
    if (tags.length) {
      return tags.some(function (tag) { return tagArgs(tag); }) ? 'missing-result' : 'unreadable';
    }
    return messages.some(isToolResultMessage) && looksUnfinished(text) ? 'unfinished' : null;
  }

  function continueBody(kind) {
    return CONTINUE_BODY[kind] || CONTINUE_BODY['unfinished'];
  }

  var continueChip = null;
  var continueKind = null, continueScope = null;

  function ensureContinueChip() {
    if (continueChip && document.body && document.body.contains(continueChip)) return continueChip;
    if (!document.body || !directTools()) return null;
    if (!document.getElementById('sd-agent-style')) {
      var st = document.createElement('style');
      st.id = 'sd-agent-style';
      st.textContent = STYLE;
      (document.head || document.documentElement).appendChild(st);
    }
    continueChip = document.createElement('div');
    continueChip.id = 'sd-continue-chip';
    continueChip.setAttribute('role', 'status');
    continueChip.hidden = true;
    var label = document.createElement('span');
    label.className = 'sd-label';
    label.textContent = t('Continue the task?', 'কাজটা চালিয়ে যাবেন?');
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = t('Continue task', 'কাজ চালিয়ে যান');
    btn.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      var kind = continueKind, current = continueScope === taskScope();
      hideContinueChip();
      if (kind && current && !window.__sdAgentStopped) sendNudge(continueBody(kind), false);
    });
    var x = document.createElement('button');
    x.type = 'button';
    x.className = 'sd-x';
    x.setAttribute('aria-label', t('Dismiss', 'বাতিল'));
    x.textContent = '✕';
    x.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); hideContinueChip(); });
    continueChip.appendChild(label);
    continueChip.appendChild(btn);
    continueChip.appendChild(x);
    document.body.appendChild(continueChip);
    return continueChip;
  }

  function showContinueChip(kind) {
    continueKind = kind; continueScope = taskScope();
    var c = ensureContinueChip();
    if (c) c.hidden = false;
  }

  function hideContinueChip() {
    continueKind = null; continueScope = null;
    var c = document.getElementById && document.getElementById('sd-continue-chip');
    if (c) c.hidden = true;
  }

  /** Offer the chip only when the loop is truly idle and the task is stalled. */
  function maybeOfferContinue() {
    // state.active is only a "task seen recently" flag (cleared 10 s after the
    // last call); a stalled task must still get its chip, so the gate is the
    // live signals — not the recency flag.
    if (!directTools() || window.__sdAgentStopped || state.pending > 0 || mcpPending) return;
    if (generating()) return;
    var sid = sessionId(), scope = taskScope();
    if (!sid || !scope) return;
    requestHistory(sid).then(function (messages) {
      if (scope !== taskScope() || sid !== sessionId() || !messages || window.__sdAgentStopped || state.pending > 0 || mcpPending) return;
      if (generating()) return;
      var kind = lastTaskStall(messages);
      if (kind) showContinueChip(kind);
      else hideContinueChip();
    });
  }

  // ── UI ─────────────────────────────────────────────────────────────────────

  var STYLE = [
    '#sd-agent-chip{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 58px);',
    'z-index:2147483000;display:flex;align-items:center;gap:10px;max-width:calc(100vw - 24px);box-sizing:border-box;',
    'padding:6px 6px 6px 12px;border-radius:999px;background:rgba(28,28,32,.94);color:#f1f1f3;',
    'font:500 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28);',
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.08)}',
    '#sd-agent-chip[hidden]{display:none}',
    '#sd-agent-chip .sd-spin{flex:none;width:12px;height:12px;border-radius:50%;border:2px solid rgba(255,255,255,.25);',
    'border-top-color:#8ab4ff;animation:sd-spin .9s linear infinite}',
    '#sd-agent-chip .sd-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
    'font-family:ui-monospace,"SFMono-Regular",Menlo,Consolas,monospace;font-size:12px;opacity:.92}',
    '#sd-agent-chip button{flex:none;display:flex;align-items:center;gap:6px;border:0;border-radius:999px;',
    'padding:7px 12px;background:rgba(255,255,255,.12);color:#fff;font:600 12px/1 system-ui,sans-serif}',
    '#sd-agent-chip button:active{background:rgba(255,255,255,.2)}',
    '#sd-agent-chip button i{width:9px;height:9px;border-radius:2px;background:#ff6b6b;display:block}',
    '@keyframes sd-spin{to{transform:rotate(360deg)}}',
    // "Continue task" offer after a stalled loop (crash/reload mid-task).
    '#sd-continue-chip{position:fixed;left:50%;transform:translateX(-50%);top:calc(env(safe-area-inset-top,0px) + 58px);',
    'z-index:2147483000;display:flex;align-items:center;gap:8px;box-sizing:border-box;',
    'padding:6px 6px 6px 14px;border-radius:999px;background:rgba(28,28,32,.94);color:#f1f1f3;',
    'font:500 13px/1.2 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.28);',
    '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);border:1px solid rgba(255,255,255,.08)}',
    '#sd-continue-chip[hidden]{display:none}',
    '#sd-continue-chip .sd-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;opacity:.92}',
    '#sd-continue-chip button{flex:none;display:flex;align-items:center;gap:6px;border:0;border-radius:999px;',
    'padding:7px 12px;background:#4d6bfe;color:#fff;font:600 12px/1 system-ui,sans-serif}',
    '#sd-continue-chip button:active{background:#3f5ce4}',
    '#sd-continue-chip button.sd-x{background:transparent;opacity:.65;padding:7px 10px}',
    // Tool cards in the chat: the spinner stops once the call is over.
    '.bds-mcp-loading.sd-done,.bds-mcp-loading.sd-stopped{animation:none!important}',
    '.bds-mcp-loading.sd-done{border-left-color:#22c55e!important}',
    '.bds-mcp-loading.sd-stopped{border-left-color:#8e8ea0!important}',
    '.sd-done .bds-mcp-loading-spinner,.sd-stopped .bds-mcp-loading-spinner{animation:none!important;',
    'border-color:transparent!important;position:relative}',
    '.sd-done .bds-mcp-loading-spinner::after{content:"";position:absolute;left:5px;top:1px;width:5px;height:10px;',
    'border:solid #22c55e;border-width:0 2px 2px 0;transform:rotate(45deg)}',
    '.sd-stopped .bds-mcp-loading-spinner::after{content:"";position:absolute;left:3px;top:3px;width:10px;height:10px;',
    'border-radius:2px;background:#8e8ea0}'
  ].join('');

  var chip = null;

  function ensureChip() {
    if (chip && document.body && document.body.contains(chip)) return chip;
    if (!document.body || !directTools()) return null;
    if (!document.getElementById('sd-agent-style')) {
      var st = document.createElement('style');
      st.id = 'sd-agent-style';
      st.textContent = STYLE;
      (document.head || document.documentElement).appendChild(st);
    }
    chip = document.createElement('div');
    chip.id = 'sd-agent-chip';
    chip.setAttribute('role', 'status');
    chip.hidden = true;
    var spin = document.createElement('span');
    spin.className = 'sd-spin';
    var label = document.createElement('span');
    label.className = 'sd-label';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.appendChild(document.createElement('i'));
    btn.appendChild(document.createTextNode(t('Stop', 'থামান')));
    btn.addEventListener('click', function (ev) { ev.preventDefault(); ev.stopPropagation(); stopAgent(false); });
    chip.appendChild(spin);
    chip.appendChild(label);
    chip.appendChild(btn);
    document.body.appendChild(chip);
    return chip;
  }

  function render() {
    if (!directTools()) { if (chip) chip.hidden = true; return; }
    var c = ensureChip();
    if (!c) return;
    c.hidden = !state.active || state.scope !== taskScope();
    var label = c.querySelector('.sd-label');
    if (label) label.textContent = state.pending > 0 ? state.label : t('Agent is working…', 'এজেন্ট কাজ করছে…');
  }

  var SETTINGS_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="bds-item-icon svelte-1y27tjy">' +
    '<path d="M12.22 2h-.44a2 2 0 0 0-2 1.72l-.16 1.13a7 7 0 0 0-1.6.92l-1.08-.46a2 2 0 0 0-2.5.92l-.22.38a2 2 0 0 0 .5 2.62l.9.7a7 7 0 0 0 0 1.84l-.9.7a2 2 0 0 0-.5 2.62l.22.38a2 2 0 0 0 2.5.92l1.08-.46a7 7 0 0 0 1.6.92l.16 1.13A2 2 0 0 0 11.78 22h.44a2 2 0 0 0 2-1.72l.16-1.13a7 7 0 0 0 1.6-.92l1.08.46a2 2 0 0 0 2.5-.92l.22-.38a2 2 0 0 0-.5-2.62l-.9-.7a7 7 0 0 0 0-1.84l.9-.7a2 2 0 0 0 .5-2.62l-.22-.38a2 2 0 0 0-2.5-.92l-1.08.46a7 7 0 0 0-1.6-.92l-.16-1.13A2 2 0 0 0 12.22 2Z"></path>' +
    '<circle cx="12" cy="12" r="3"></circle></svg>';

  function fitSettingsList(sheet, list) {
    if (!sheet || !list || !list.style || !window || !document.documentElement) return;
    try {
      var sheetRect = sheet.getBoundingClientRect();
      var listRect = list.getBoundingClientRect();
      var viewportHeight = Math.max(1, window.innerHeight || document.documentElement.clientHeight || sheetRect.bottom);
      try {
        var visual = window.visualViewport;
        if (visual && visual.height > 0) viewportHeight = Math.min(viewportHeight, visual.offsetTop + visual.height);
      } catch (_) {}

      var sheetStyle = window.getComputedStyle(sheet);
      var listStyle = window.getComputedStyle(list);
      var sheetBottomPadding = parseFloat(sheetStyle.paddingBottom) || 0;
      var sheetBottomBorder = parseFloat(sheetStyle.borderBottomWidth) || 0;
      var listChrome = (parseFloat(listStyle.paddingTop) || 0) +
        (parseFloat(listStyle.paddingBottom) || 0) +
        (parseFloat(listStyle.borderTopWidth) || 0) +
        (parseFloat(listStyle.borderBottomWidth) || 0);
      var headerHeight = Math.max(0, listRect.top - sheetRect.top);
      var maxSheetHeight = parseFloat(sheetStyle.maxHeight);
      if (!isFinite(maxSheetHeight) || maxSheetHeight <= 0 || maxSheetHeight > viewportHeight) {
        maxSheetHeight = viewportHeight;
      }
      var available = Math.floor(maxSheetHeight - headerHeight -
        sheetBottomPadding - sheetBottomBorder - listChrome);
      if (!isFinite(available) || available < 1) {
        list.style.removeProperty('max-height');
        return;
      }

      /* The Svelte list is a flex column; default flex-shrink would squash
       * the cards to fit and leave nothing to scroll. Keep their authored row
       * heights and let the list, rather than the cards, absorb overflow. */
      var rows = list.querySelectorAll('.bds-attach-item');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].style) rows[i].style.setProperty('flex-shrink', '0');
      }

      /* Keep the sheet header/actions in view. The existing More tools card
       * list owns its own scroll when seven cards exceed the available height. */
      list.style.setProperty('max-height', available + 'px');
      list.style.setProperty('min-height', '0');
      list.style.setProperty('overflow-y', 'auto');
      list.style.setProperty('overscroll-behavior-y', 'contain');
      list.style.setProperty('-webkit-overflow-scrolling', 'touch');
    } catch (_) {}
  }

  function addSettingsItem() {
    if (!window.__sdSite || window.__sdSite.id !== 'arena') return;
    var sheet = document.querySelector('.bds-attach-dropdown');
    if (!sheet) return;

    var btn = sheet.querySelector('#sd-arena-settings-item');
    var items = sheet.querySelectorAll('.bds-attach-item');
    var last = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].id !== 'sd-arena-settings-item' && items[i].parentNode) last = items[i];
    }
    if (!last || !last.parentNode) return;
    var parent = last.parentNode;

    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'sd-arena-settings-item';
      btn.className = 'bds-attach-item svelte-1y27tjy';
      btn.setAttribute('aria-label', t('Settings', 'সেটিংস'));
      btn.innerHTML = '<span class="bds-item-icon-box svelte-1y27tjy">' + SETTINGS_ICON + '</span> ' +
        '<span class="bds-item-content svelte-1y27tjy"><span class="bds-item-title svelte-1y27tjy"></span> ' +
        '<span class="bds-item-desc svelte-1y27tjy"></span></span>';
      btn.querySelector('.bds-item-title').textContent = t('Settings', 'সেটিংস');
      btn.querySelector('.bds-item-desc').textContent = t(
        'Manage app preferences, tools and integrations',
        'অ্যাপের পছন্দ, টুল ও ইন্টিগ্রেশন পরিচালনা করুন'
      );
      btn.addEventListener('click', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        if (ev && ev.stopPropagation) ev.stopPropagation();

        /* Let the existing sheet finish its close animation before raising Settings. */
        var close = sheet.querySelector('.bds-sheet-close');
        if (!close) {
          /* Match sd-sheets.js: find the backdrop belonging to this sheet,
           * not the first backdrop for a different hidden sheet in the DOM. */
          try {
            var sibling = sheet.previousElementSibling;
            while (sibling && !close) {
              if (sibling.matches && sibling.matches('.bds-attach-backdrop')) close = sibling;
              sibling = sibling.previousElementSibling;
            }
            if (!close) close = document.querySelector('.bds-attach-backdrop');
          } catch (_) {}
        }
        var openSettings = function () {
          try {
            if (window && typeof window.dispatchEvent === 'function' && typeof CustomEvent === 'function') {
              window.dispatchEvent(new CustomEvent('bds:open-drawer'));
            }
          } catch (_) {}
        };
        if (close && typeof close.click === 'function') {
          try { close.click(); } catch (_) {}
          setTimeout(openSettings, 240);
        } else {
          openSettings();
        }
      });
    }

    var cardWasMoved = btn.parentNode !== parent || parent.lastElementChild !== btn;
    if (cardWasMoved) parent.appendChild(btn);
    fitSettingsList(sheet, parent);
    if (cardWasMoved && typeof window.setTimeout === 'function') {
      /* The Add to chat sheet slides up for 280ms. Re-measure after that
       * animation so the list gets the final visible viewport, not its
       * translated off-screen position during the entrance frame. */
      window.setTimeout(function () {
        if (sheet.isConnected && parent.isConnected) fitSettingsList(sheet, parent);
      }, 320);
    }
  }

  function watchSheet() {
    addSettingsItem();
    if (!window.__sdArenaSettingsListResize) {
      var resizeSettingsList = function () { addSettingsItem(); };
      try {
        window.addEventListener('resize', resizeSettingsList, { passive: true });
        if (window.visualViewport && window.visualViewport.addEventListener) {
          window.visualViewport.addEventListener('resize', resizeSettingsList, { passive: true });
        }
        window.__sdArenaSettingsListResize = true;
      } catch (_) {}
    }
    if (typeof MutationObserver !== 'function' || !document.body) return;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; addSettingsItem(); }, 50);
    }).observe(document.body, { childList: true, subtree: true });
  }


  // Retain the existing native preference across updates.
  var PREF_CONTINUE = 'sd_agent_autocontinue';

  function pref(key, def) {
    try {
      var b = bridge();
      var v = b && typeof b.getStorage === 'function' ? b.getStorage(key) : null;
      return v === null || v === undefined || v === '' ? def : String(v);
    } catch (_) { return def; }
  }

  function setPref(key, value) {
    try { var b = bridge(); if (b && typeof b.setStorage === 'function') b.setStorage(key, String(value)); } catch (_) {}
  }

  function autoContinue() { return pref(PREF_CONTINUE, '1') !== '0'; }

  // ── Tool cards: stop the spinner when the call is over ─────────────────────
  //
  // The engine draws a spinning card for every tool call in a reply and never
  // updates it; the result arrives as the next message. A card is finished
  // once a later message exists, or when nothing is running any more.

  var mcpPending = 0;
  var mcpLastEnd = 0;
  var CARD_IDLE_MS = 4000;

  function trackMcp(promise) {
    mcpPending++;
    var done = function () { mcpPending = Math.max(0, mcpPending - 1); mcpLastEnd = Date.now(); sweepSoon(); };
    return Promise.resolve(promise).then(function (v) { done(); return v; }, function (e) { done(); throw e; });
  }

  function messageNodes() {
    var engine = window.__sdEngine;
    if (window.__sdSite && window.__sdSite.id === 'arena') {
      return engine && typeof engine.messageNodes === 'function' ? engine.messageNodes() : [];
    }
    return document.querySelectorAll('.ds-message');
  }

  function messageOf(el) {
    if (window.__sdSite && window.__sdSite.id === 'arena') {
      var nodes = messageNodes();
      for (var i = 0; i < nodes.length; i++) if (nodes[i].contains(el)) return nodes[i];
      return null;
    }
    return (el.closest && el.closest('.ds-message')) || null;
  }

  function lastMessage() {
    var all = messageNodes();
    return all.length ? all[all.length - 1] : null;
  }

  function sweepCards() {
    if (!document.querySelectorAll) return 0;
    var cards = document.querySelectorAll('.bds-mcp-loading:not(.sd-done):not(.sd-stopped)');
    if (!cards.length) return 0;
    var last = lastMessage();
    var idle = mcpPending === 0 && !generating() && Date.now() - Math.max(mcpLastEnd, state.lastActivity || 0) > CARD_IDLE_MS;
    var left = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var msg = messageOf(card);
      var superseded = !!(msg && last && msg !== last && !msg.contains(last));
      if (superseded || idle) card.classList.add(window.__sdAgentStopped && !superseded ? 'sd-stopped' : 'sd-done');
      else left++;
    }
    return left;
  }

  var sweepTimer = null;
  function sweepSoon() {
    if (sweepTimer) return;
    sweepTimer = setTimeout(function tick() {
      sweepTimer = null;
      if (sweepCards() > 0) sweepTimer = setTimeout(tick, 1500);
    }, 300);
  }

  function watchCards() {
    if (typeof MutationObserver !== 'function' || !document.body) return;
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        if (records[i].addedNodes && records[i].addedNodes.length) { sweepSoon(); return; }
      }
    }).observe(document.body, { childList: true, subtree: true });
    sweepSoon();
  }

  function install() {
    var inner = window.__sdBridgeFetch;
    if (typeof inner === 'function' && !inner.__sdAgentWrapped) {
      var wrapped = function (payload) {
        if (payload && payload.type === 'bds-mcp-authorize' &&
            (!directTools() || window.__sdAgentStopped || !configured(payload.serverUrl))) {
          return Promise.resolve({ok:false, code:'permission', error:'MCP approval is unavailable here.'});
        }
        if (payload && payload.type === 'bds-mcp-call') {
          if (!directTools() || window.__sdAgentStopped || !configured(payload.serverUrl)) {
            return Promise.resolve({ ok: false, error: 'MCP tool call is not enabled here.' });
          }
          var scope = taskScope();
          beginCall(payload);
          return trackMcp(Promise.resolve().then(function () {
            if (scope !== taskScope() || !configured(payload.serverUrl)) return { ok: false, error: 'MCP call cancelled.' };
            return inner(payload);
          })).finally(function () { endCall(scope); });
        }
        return inner(payload);
      };
      wrapped.__sdAgentWrapped = true;
      window.__sdBridgeFetch = wrapped;
    }
    installResumeListeners();
    installScrollGuard();
    watchReplies();
    // A reload mid-task leaves the run-once gate stalled; after the page has
    // settled, offer the user a way forward instead of staying silent.
    // (unref exists only in node's timers; the page's setTimeout returns a
    // number, so this stays a no-op in the app.)
    var settle = setTimeout(function () { maybeOfferContinue(); }, 9000);
    if (settle && typeof settle.unref === 'function') settle.unref();
    if (document.body) { watchSheet(); watchCards(); }
    else document.addEventListener('DOMContentLoaded', function () { watchSheet(); watchCards(); });
  }

  install();

  /**
   * One plain-language answer to "why is nothing happening?".
   *
   * The owner's report -- "the features are all there but none of them work"
   * -- was impossible to act on because every failure looked the same from the
   * outside: a model that ignored the protocol, a page whose request shape
   * changed, an unavailable tool. This reports the facts the engine
   * actually knows, so a screenshot of it is a usable bug report.
   */
  function diagnose() {
    var out = { version: 1, site: null, mode: null, composer: false, send: false,
      generating: false, agent: null, health: null, tools: null, modality: null };
    try { out.site = (window.__sdSite && window.__sdSite.id) || null; } catch (_) {}
    try { out.mode = window.__sdSite && typeof window.__sdSite.arenaMode === 'function'
      ? window.__sdSite.arenaMode() : null; } catch (_) {}
    try { out.modality = window.__sdSite && typeof window.__sdSite.arenaModality === 'function'
      ? window.__sdSite.arenaModality() : null; } catch (_) {}
    try { out.composer = !!document.querySelector('textarea[name="message"]'); } catch (_) {}
    try { out.send = !!document.querySelector('button[aria-label="Send message"]'); } catch (_) {}
    try { out.generating = generating(); } catch (_) {}
    out.agent = { active: state.active, pending: state.pending, nudges: flow.nudges, calls: flow.calls,
      stopped: !!window.__sdAgentStopped,
      recovery: { cuts: recover.cuts, errs: recover.errs, pending: recover.pending, last: recover.last } };
    try {
      if (window.__sdHealth && typeof window.__sdHealth.status === 'function') {
        var h = window.__sdHealth.status();
        out.health = { ok: !!h.ok, failed: h.failed || [], visible: !!h.visible };
      }
    } catch (_) {}
    try {
      var schemas = window.__sdEngine && window.__sdEngine.mcpToolSchemas;
      if (typeof schemas === 'function') schemas = schemas();
      out.tools = Array.isArray(schemas) ? schemas.map(function (t) { return t && t.toolName; }) : null;
    } catch (_) {}
    return out;
  }

  window.__sdAgent = {
    version: 1,
    stop: stopAgent,
    /** For the native side and for bug reports: what the engine sees right now. */
    diagnose: diagnose,
    isActive: function () { return state.active; },
    autoContinue: autoContinue,
    setAutoContinue: function (value) { setPref(PREF_CONTINUE, value ? '1' : '0'); },
    // Exposed for tests.
    _parseTags: parseTags,
    _tagArgs: tagArgs,
    _sweepCards: sweepCards,
    _looksUnfinished: looksUnfinished,
    _nudgeFor: nudgeFor,
    _noteReplyEnd: noteReplyEnd,
    _lastTaskStall: lastTaskStall,
    _continueBody: continueBody,
    _maybeOfferContinue: maybeOfferContinue,
    _continueKind: function () { return continueKind; },
    _scrollGuard: guard,
    _sessionId: sessionId,
    _requestHistory: requestHistory,
    _classifyTurn: classifyTurn,
    _endsInsideToolCall: endsInsideToolCall,
    _recovery: recover,
  };
})();
