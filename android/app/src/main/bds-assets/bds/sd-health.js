/**
 * Super DeepSeek — DeepSeek DOM health check.
 *
 * The engine leans on DeepSeek's DOM, including hashed class names that can
 * change with any site update. When one of them drifts, features must NOT
 * fail silently: this script probes the critical contracts (composer, send
 * button, message rows, role classes) on a schedule, classifies each as
 * ok / degraded / missing, and — when the chat page is clearly in front of
 * the user but a contract is gone — shows one plain-language notice that
 * some features are paused until the next app update. Chat itself keeps
 * working: every probe has role/structure fallbacks.
 *
 * Site-aware: on arena.ai (ArenaPilot) the contracts come from the SAME profile
 * the engine is configured with (window.__sdSite.profile, written by
 * sd-site.js), so a DeepSeek-only selector can never raise a false alarm
 * there. Every other page keeps the DeepSeek contracts exactly as below.
 *
 * Exposed as window.__sdHealth (version, site, check, status, lastNotice) for
 * the native side and for tests.
 */
(function () {
  if (window.__sdHealth && window.__sdHealth.version) return;

  var NOTICE_SHOWN_KEY = 'sd_health_notice';
  var MAX_RUNS = 8;

  /**
   * Only arena.ai is special-cased. chat.deepseek.com, an unknown host and a
   * build without sd-site.js all keep the DeepSeek contracts below, unchanged.
   */
  var IS_ARENA = (function () {
    try { return !!(window.__sdSite && window.__sdSite.id === 'arena'); } catch (_) { return false; }
  })();

  /**
   * Critical DOM contracts. `selectors` are tried in order: the first entry
   * is the engine's primary selector (often a hashed class), the rest are the
   * structural fallbacks that keep a degraded page usable. `landmark` marks a
   * contract that only applies while conversation content is on screen;
   * `advisory` marks a nicety that never raises the notice.
   */
  var DEEPSEEK_CHECKS = [
    {
      id: 'composer',
      en: 'the message box',
      bn: 'মেসেজ বক্স',
      selectors: [
        'textarea#chat-input',
        '.ds-textarea textarea',
        '[role="textbox"][contenteditable]',
        '[role="textbox"]',
        '.ProseMirror[contenteditable]',
        'textarea[placeholder]',
        'input[placeholder]',
        '[contenteditable]',
      ],
    },
    {
      id: 'messages',
      en: 'chat messages',
      bn: 'চ্যাট মেসেজ',
      selectors: ['div.ds-message._63c77b1', 'div.ds-message'],
      landmark: true,
    },
    {
      id: 'roles',
      en: 'telling your messages from the AI’s',
      bn: 'ব্যবহারকারী ও AI-এর মেসেজ আলাদা করা',
      selectors: ['._4f9bf79._43c05b5', '._9663006', '.ds-markdown'],
      landmark: true,
    },
    {
      id: 'send',
      en: 'the send button',
      bn: 'পাঠানো বোতাম',
      probe: 'send',
    },
    {
      id: 'sidebar',
      en: 'the chat list',
      bn: 'চ্যাট তালিকা',
      selectors: ['a[href*="/chat/s/"]'],
      advisory: true,
    },
  ];

  /**
   * What a site contributes beyond its list of contracts:
   *   convo()          is conversation content on screen? (gates the landmarks)
   *   strong           composer matches that prove the real chat is in front of the user
   *   sendProvesChat   whether a send button alone counts as "the chat is visible"
   *   notice(names)    the plain-language warning, branded for the app it appears in
   */
  var DEEPSEEK_SITE = {
    checks: DEEPSEEK_CHECKS,
    convo: function () {
      return firstMatch(['div.ds-message', '[class*="ds-message"]', '.ds-markdown']) >= 0;
    },
    strong: ['textarea#chat-input', '.ds-textarea textarea'],
    sendProvesChat: true,
    notice: function (names) {
      return {
        en: 'DeepSeek updated their page, so ' + names.en + ' may be paused in Super DeepSeek until the next update. Your chat keeps working.',
        bn: 'ডিপসিক তাদের পেজ আপডেট করেছে, তাই সুপার ডিপসিক-এ ' + names.bn + ' পরবর্তী আপডেট পর্যন্ত সাময়িকভাবে বন্ধ থাকতে পারে। আপনার চ্যাট চলতেই থাকবে।',
      };
    },
  };

  function dot(cls) { return '.' + cls; }

  function unique(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) if (list[i] && out.indexOf(list[i]) < 0) out.push(list[i]);
    return out;
  }

  /**
   * arena.ai (Direct Chat). Read from the profile the engine itself runs on, so
   * this check can never watch a selector the engine stopped using. MODELLED
   * until Phase 0's real capture (see sd-site.js) — which is exactly why only
   * the contracts the engine cannot work without may raise the notice:
   *
   *   composer, messages   strict;
   *   send, roles, sidebar advisory — a send button may not exist while the box
   *                        is empty, a user-only conversation has no assistant
   *                        row yet, and a sign-in page has buttons labelled
   *                        "Send …" that must not pass for the chat.
   */
  function arenaSite() {
    var profile = null;
    try { profile = window.__sdSite && window.__sdSite.profile; } catch (_) {}
    var sel = (profile && profile.selectors) || {};
    var typed = (sel.chatInput && sel.chatInput.textarea && sel.chatInput.textarea.length)
      ? sel.chatInput.textarea : ['textarea[name="message"]'];
    var msg = sel.message || {};
    // Same contract as the engine's scanner (dexforint/arena-utils, verified on
    // arena.ai): four thread-list selectors — arena serves both reversed and
    // plain lists — and the health check reports whichever list exists.
    var rows = unique(Array.isArray(msg.containers) ? msg.containers : []);
    if (!rows.length) rows = ['main ol.flex-col-reverse', 'ol.flex-col-reverse', 'ol.mt-8.flex', 'ol.mt-8'];
    var plain = function (c) { return String(c).replace(/^:scope\s*>\s*\./, ''); };
    var asst = (msg.assistantRole && msg.assistantRole.length ? msg.assistantRole : ['prose']).map(plain).filter(function (c) { return /^[\w-]+$/.test(c); }).map(dot);
    var user = (msg.userRole && msg.userRole.length ? msg.userRole : ['justify-end']).map(plain).filter(function (c) { return /^[\w-]+$/.test(c); }).map(dot);
    var marker = (profile && profile.urlPatterns && profile.urlPatterns.chatSession) || '/c/';

    return {
      checks: [
        {
          id: 'composer',
          en: 'the message box',
          bn: 'মেসেজ বক্স',
          selectors: unique(typed.concat([
            '[role="textbox"][contenteditable]',
            '[role="textbox"]',
            '.ProseMirror[contenteditable]',
            'textarea[placeholder]',
            'input[placeholder]',
            '[contenteditable]',
          ])),
        },
        { id: 'messages', en: 'chat messages', bn: 'চ্যাট মেসেজ', selectors: rows, landmark: true },
        {
          id: 'roles',
          en: 'telling your messages from the AI’s',
          bn: 'ব্যবহারকারী ও AI-এর মেসেজ আলাদা করা',
          selectors: asst.concat(user),
          landmark: true,
          advisory: true,
        },
        { id: 'send', en: 'the send button', bn: 'পাঠানো বোতাম', probe: 'send', advisory: true },
        { id: 'sidebar', en: 'the chat list', bn: 'চ্যাট তালিকা', selectors: ['a[href*="' + marker + '"]'], advisory: true },
      ],
      // Only on a conversation URL: other arena pages (the leaderboard, say) also
      // use `.prose`, and must not look like a chat whose messages went missing.
      convo: function () {
        var href = '';
        try { href = String(location.href || ''); } catch (_) {}
        return href.indexOf(marker) >= 0 && firstMatch(rows.concat(asst)) >= 0;
      },
      strong: [typed[0]],
      sendProvesChat: false,
      notice: function (names) {
        return {
          en: 'arena.ai may have changed its page, so ' + names.en + ' may be paused in ArenaPilot until the next update. Your chat keeps working.',
          bn: 'arena.ai তাদের পেজ বদলে থাকতে পারে, তাই ArenaPilot-এ ' + names.bn + ' পরবর্তী আপডেট পর্যন্ত সাময়িকভাবে বন্ধ থাকতে পারে। আপনার চ্যাট চলতেই থাকবে।',
        };
      },
    };
  }

  var SITE = IS_ARENA ? arenaSite() : DEEPSEEK_SITE;
  var CHECKS = SITE.checks;

  /** Engine-owned nodes are never evidence about DeepSeek's own DOM. */
  var ENGINE_NODES = '#bds-root, #bds-drawer, #sd-agent-chip, #sd-continue-chip, #sd-health-notice, #sd-agent-confirm';

  function ours(el) {
    try { return !!(el && el.closest && el.closest(ENGINE_NODES)); } catch (_) { return false; }
  }

  function isBn() {
    try {
      var e = window.__sdEngine;
      var l = e && typeof e.locale === 'function' ? String(e.locale() || '') : '';
      return String(l || document.documentElement.lang || navigator.language || '')
        .toLowerCase().indexOf('bn') === 0;
    } catch (_) { return false; }
  }

  function t(en, bn) { return isBn() ? bn : en; }

  function firstMatch(selectors) {
    for (var i = 0; i < selectors.length; i++) {
      try {
        var found = document.querySelectorAll(selectors[i]);
        for (var j = 0; j < found.length; j++) {
          if (!ours(found[j])) return i;
        }
      } catch (_) {}
    }
    return -1;
  }

  /**
   * The send button: role/structure only (its classes churn the most).
   * Mirrors the engine's own bCe() idea: a button near the composer that is
   * not one of ours.
   */
  function probeSend() {
    try {
      var btns = Array.from(document.querySelectorAll('div[role="button"], button'));
      for (var i = 0; i < btns.length; i++) {
        var b = btns[i];
        if (!b || (b.closest && b.closest('#bds-root, #sd-agent-chip, #sd-health-notice'))) continue;
        if (b.querySelector && (b.querySelector('.ds-icon-send') || b.querySelector('[class*="send"]'))) return 'send-icon';
        var label = String(b.getAttribute && b.getAttribute('aria-label') || '');
        if (/send|পাঠ/i.test(label)) return 'send-label';
      }
    } catch (_) {}
    return null;
  }

  /** One pass over the contracts. Pure enough for tests (probe-able). */
  function evaluate(probeOverride) {
    var results = [];
    var strongComposer = false;
    var sendOk = false;
    // Conversation content on screen (excluding the engine's own UI)?
    var convo = probeOverride ? true : SITE.convo();
    for (var i = 0; i < CHECKS.length; i++) {
      var c = CHECKS[i];
      var state, matched = null;
      if (c.landmark && !convo) {
        results.push({ id: c.id, state: 'na', matched: null });
        continue;
      }
      if (probeOverride && c.probe) {
        matched = probeOverride(c.id);
        state = matched ? 'ok' : 'missing';
      } else if (c.probe === 'send') {
        matched = probeSend();
        state = matched ? 'ok' : 'missing';
      } else {
        var idx = firstMatch(c.selectors);
        if (idx === 0) { state = 'ok'; matched = c.selectors[0]; }
        else if (idx > 0) { state = 'degraded'; matched = c.selectors[idx]; }
        else state = 'missing';
      }
      if (c.id === 'send' && state === 'ok') sendOk = true;
      if (c.id === 'composer' && matched !== null && SITE.strong.indexOf(matched) >= 0) strongComposer = true;
      results.push({ id: c.id, state: state, matched: matched });
    }
    // The sign-in page (or a blank load) matches almost nothing: that is not
    // DOM drift, so the notice stays quiet unless the chat itself is clearly
    // in front of the user (conversation content, the real composer, or the
    // send button).
    var visible = !!probeOverride || convo || (SITE.sendProvesChat && sendOk) || strongComposer;
    var failed = results.filter(function (r) {
      return (r.state === 'missing' || r.state === 'degraded') && !checkById(r.id).advisory;
    });
    return {
      ok: failed.length === 0,
      visible: visible,
      results: results,
      failed: failed.map(function (r) { return r.id; }),
    };
  }

  function checkById(id) {
    for (var i = 0; i < CHECKS.length; i++) if (CHECKS[i].id === id) return CHECKS[i];
    return {};
  }

  function namesFor(ids) {
    var en = [], bn = [];
    for (var i = 0; i < CHECKS.length; i++) {
      if (ids.indexOf(CHECKS[i].id) >= 0) { en.push(CHECKS[i].en); bn.push(CHECKS[i].bn); }
    }
    return { en: en.join(', '), bn: bn.join(', ') };
  }

  var last = null;
  var lastNotice = null;

  function noticeText(report) {
    return SITE.notice(namesFor(report.failed));
  }

  function showNotice(report) {
    var text = noticeText(report);
    lastNotice = isBn() ? text.bn : text.en;
    try {
      if (window.__sdEngine && typeof window.__sdEngine.toast === 'function') {
        window.__sdEngine.toast(lastNotice);
      }
    } catch (_) {}
    try {
      if (!document.body) return;
      var old = document.getElementById('sd-health-notice');
      if (old) return; // one notice at a time, shown once per session
      var el = document.createElement('div');
      el.id = 'sd-health-notice';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);' +
        'bottom:calc(env(safe-area-inset-bottom,0px) + 84px);z-index:2147482900;' +
        'max-width:min(92vw,520px);box-sizing:border-box;padding:12px 14px;border-radius:14px;' +
        'background:rgba(28,28,32,.95);color:#f1f1f3;border:1px solid rgba(255,255,255,.1);' +
        'font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;' +
        'box-shadow:0 8px 28px rgba(0,0,0,.32);display:flex;gap:10px;align-items:flex-start';
      var msg = document.createElement('div');
      msg.textContent = lastNotice;
      var x = document.createElement('button');
      x.type = 'button';
      x.setAttribute('aria-label', t('Dismiss', 'বাতিল'));
      x.textContent = '✕';
      x.style.cssText = 'flex:none;border:0;background:transparent;color:#f1f1f3;opacity:.7;' +
        'font:600 14px/1 system-ui;padding:4px 6px';
      x.addEventListener('click', function () { el.remove(); });
      el.appendChild(msg);
      el.appendChild(x);
      document.body.appendChild(el);
    } catch (_) {}
    try {
      var b = window.AndroidBridge;
      if (b && typeof b.setStorage === 'function') b.setStorage(NOTICE_SHOWN_KEY, String(Date.now()));
    } catch (_) {}
  }

  function check() {
    var report = evaluate(null);
    last = report;
    if (!report.ok && report.visible) showNotice(report);
    return report;
  }

  // Inline with the composer, not another floating overlay. Mode changes can
  // happen long after the startup health timer finishes, including on /c/ URLs.
  function checkMode() {
    if (!IS_ARENA) return null;
    var mode = 'unknown';
    try { mode = window.__sdSite.arenaMode(); } catch (_) {}
    try {
      var old = document.getElementById('sd-arena-mode-notice');
      var input = document.querySelector('textarea[name="message"]');
      var form = input && input.closest('form');
      if (mode === 'direct' || !form) { if (old) old.remove(); return mode; }
      var text = mode === 'unsupported'
        ? t('ArenaPilot tools support Direct Chat only. Switch to Direct to use them; website chat is still available.', 'ArenaPilot-এর টুল শুধু Direct Chat-এ সমর্থিত। টুল ব্যবহার করতে Direct বেছে নিন; সাইটের চ্যাট ব্যবহার করা যাবে।')
        : t('ArenaPilot tools are paused: Direct Chat mode could not be verified. Select Direct to continue.', 'Direct Chat মোড নিশ্চিত করা যায়নি, তাই ArenaPilot-এর টুল থামানো আছে। চালাতে Direct বেছে নিন।');
      if (!old) {
        old = document.createElement('div'); old.id = 'sd-arena-mode-notice';
        old.className = 'bds-mode-notice'; old.setAttribute('role', 'status');
        old.style.cssText = 'width:100%;box-sizing:border-box;font:12px/1.5 system-ui;padding:8px 10px;border-radius:8px;background:rgba(128,128,128,.12);color:inherit';
      }
      if (old.textContent !== text) old.textContent = text;
      if (old.parentElement !== form) form.appendChild(old);
    } catch (_) {}
    return mode;
  }

  function status() {
    return last || evaluate(null);
  }

  window.__sdHealth = {
    version: 1,
    site: IS_ARENA ? 'arena' : 'deepseek',
    check: check,
    checkMode: checkMode,
    status: status,
    lastNotice: function () { return lastNotice; },
    evaluate: evaluate,
    checks: CHECKS,
    // Exposed for tests.
    _namesFor: namesFor,
    _noticeText: noticeText,
  };

  if (IS_ARENA) {
    var modeTimer = setInterval(checkMode, 1500);
    if (modeTimer && typeof modeTimer.unref === 'function') modeTimer.unref();
  }

  // Probe after the page settles (and once more later: the chat list and the
  // first conversation render after the SPA finishes booting).
  var runs = 0;
  var timer = setInterval(function () {
    runs++;
    check();
    if (runs >= MAX_RUNS || (last && last.ok)) clearInterval(timer);
  }, 4000);
  if (timer && typeof timer.unref === 'function') timer.unref();
})();
