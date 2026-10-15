import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { PROMPT, MARKER, PREFLIGHT, REPLY_FACTS, GATE_FACTS, requestFacts, streamFacts, liveProbe, outcome } from '../../../../ci/arena-live-smoke.mjs';
import { acceptanceFailures } from '../../../../ci/cdp_probe.mjs';

const goodStream = `a0:${JSON.stringify(MARKER.slice(0, 10))}\na0:${JSON.stringify(MARKER.slice(10))}\nad:{"finishReason":"stop"}\n`;
const request = (extra = {}) => ({ method: 'POST', url: 'https://arena.ai/nextjs-api/stream/create-evaluation', postData: JSON.stringify({ mode: 'direct-battle', userMessage: { content: PROMPT }, recaptchaV3Token: 'PRIVATE-TOKEN', ...extra }) });

test('live request capture is exact, origin-bound, and structural: no tokens/content persisted', () => {
  const facts = requestFacts(request());
  assert.equal(facts.promptExact, true);
  assert.equal(facts.promptDelivered, true);
  assert.equal(facts.shape.recaptchaV3Token, 'string');
  assert.doesNotMatch(JSON.stringify(facts), /PRIVATE-TOKEN|ARENA_DECK/);
  assert.equal(requestFacts({ ...request(), url: 'https://arena.ai.evil.test/nextjs-api/stream/create-evaluation' }), null);
  assert.equal(requestFacts({ ...request(), method: 'GET' }), null);
  assert.equal(requestFacts(request({ userMessage: { content: PROMPT + 'EXTRA PRIVATE MEMORY' } })).promptExact, false);
  assert.equal(requestFacts(request({ userMessage: { content: PROMPT + 'EXTRA PRIVATE MEMORY' } })).promptDelivered, false);
  // v2 defaults: the engine's own instruction block in front of the prompt is
  // still a clean delivery — but only the engine's block, never other text
  const injected = requestFacts(request({ userMessage: { content: '<SuperDeepSeek>\nENGINE INSTRUCTIONS\n</SuperDeepSeek>\n\n' + PROMPT } }));
  assert.equal(injected.promptExact, false);
  assert.equal(injected.promptDelivered, true);
  assert.equal(requestFacts(request({ userMessage: { content: 'SOMETHING ELSE\n\n' + PROMPT } })).promptDelivered, false);
  assert.equal(requestFacts(request({ mode: 'unknown future mode' })).mode, 'unknown');
});

test('only completed assistant text frames can prove the reply: not reasoning, error or reflected input', () => {
  const good = streamFacts(goodStream);
  assert.equal(good.markerInAssistantText, true);
  assert.equal(good.finish, true);
  for (const body of [`ag:${JSON.stringify(MARKER)}\n`, `3:${JSON.stringify(MARKER)}\n`, JSON.stringify({ userMessage: PROMPT }), `a0:${JSON.stringify(PROMPT)}\n`]) {
    assert.equal(streamFacts(body).markerInAssistantText, false);
  }
  assert.equal(streamFacts('a0:not-json').malformed, true);
  assert.equal(streamFacts('x'.repeat(256001)).bounded, false);
  assert.equal(streamFacts(null).bounded, false);
  assert.doesNotMatch(JSON.stringify(good), new RegExp(MARKER));
});

test('live preflight expressions actually compile and reject existing chats/non-default privacy', async () => {
  new vm.Script(REPLY_FACTS);
  new vm.Script(GATE_FACTS);
  const saved = { disableSystemPrompt: false, disableMemory: true };
  const env = { location: { protocol: 'https:', hostname: 'arena.ai', pathname: '/text/direct' },
    document: { querySelector: () => ({ value: '' }) },
    chrome: { storage: { local: { get: async () => ({ bds_settings: saved }) } } },
    window: { __sdEngine: { messageNodes: () => [], setComposer: () => true, isGenerating: () => false } } };
  const ctx = vm.createContext(env);
  assert.ok(Object.values(await vm.runInContext(PREFLIGHT, ctx)).every(Boolean));
  saved.disableMemory = false;
  assert.equal((await vm.runInContext(PREFLIGHT, ctx)).privacyDefaults, false);
  saved.disableMemory = true;
  saved.disableSystemPrompt = true;
  assert.equal((await vm.runInContext(PREFLIGHT, ctx)).privacyDefaults, false);
  saved.disableSystemPrompt = false;
  env.location.pathname = '/c/existing';
  assert.equal((await vm.runInContext(PREFLIGHT, ctx)).direct, false);
  env.window.__sdEngine.messageNodes = () => [{}];
  assert.equal((await vm.runInContext(PREFLIGHT, ctx)).empty, false);
});

function fakeCdp(options = {}) {
  const handlers = new Map(), calls = [];
  const emit = (name, params) => handlers.get(name)?.(params);
  return {
    calls, on: (name, fn) => handlers.set(name, fn),
    async send(method, params = {}) {
      calls.push({ method, params });
      if (method === 'Runtime.evaluate') {
        const expression = params.expression;
        let value;
        if (expression.includes('live:preflight')) value = { direct: true, empty: true, privacyDefaults: !options.privacyOn, ready: true };
        if (expression.includes('live:fill')) value = true;
        if (expression.includes('live:send')) value = options.covered ? null : { x: 50, y: 50 };
        if (expression.includes('live:reply')) value = { engine: true, rows: 2, assistantRows: 1, markerVisible: !options.noReply, generating: false, conversationRoute: true };
        if (expression.includes('live:gate')) value = options.gate || { dialog: false, dialogWord: null, composerStillFilled: true, pathname: '/text/direct' };
        return { result: { value } };
      }
      if (method === 'Input.dispatchMouseEvent' && params.type === 'mouseReleased' && !options.noRequest) {
        emit('Network.requestWillBeSent', { requestId: '1', request: request(options.extra || {}) });
        emit('Network.responseReceived', { requestId: '1', response: { status: options.status || 200, mimeType: 'text/plain' } });
        emit('Network.loadingFinished', { requestId: '1' });
      }
      if (method === 'Network.getResponseBody') return { body: options.body ?? goodStream, base64Encoded: false };
      return {};
    },
  };
}
const probe = (cdp) => liveProbe(cdp, { pause: async () => {}, polls: 2 });

test('single real click + exact outgoing message + completed stream + assistant DOM are ALL required', async () => {
  const cdp = fakeCdp();
  const result = await probe(cdp);
  assert.equal(result.ok, true);
  assert.equal(result.reason, 'verified-anonymous-round-trip');
  assert.equal(cdp.calls.filter((c) => c.method === 'Input.dispatchMouseEvent' && c.params.type === 'mouseReleased').length, 1);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE-TOKEN|ARENAPILOT_SMOKE_OK/);
  for (const options of [{ noReply: true }, { body: 'unknown-protocol' }, { extra: { mode: 'battle' } }, { extra: { userMessage: { content: 'LEAK' } } }]) {
    assert.equal((await probe(fakeCdp(options))).ok, false);
  }
});

test('privacy-not-at-defaults / covered Send never sends; WAF/provider failure never retries or bypasses', async () => {
  for (const options of [{ privacyOn: true }, { covered: true }, { status: 403 }, { status: 429 }, { noReply: true }]) {
    const cdp = fakeCdp(options), result = await probe(cdp);
    assert.equal(result.ok, false);
    const clicks = cdp.calls.filter((c) => c.method === 'Input.dispatchMouseEvent' && c.params.type === 'mouseReleased');
    assert.equal(clicks.length, options.privacyOn || options.covered ? 0 : 1);
    if (options.status) assert.equal(result.reason, 'network-or-provider-blocked');
  }
});

test('a site-side gate after the click is classified, evidenced and PASSES the app contract — anything else stays red', async () => {
  // arena.ai's anonymous CI session has accepted no terms, so its own dialog
  // (or silent noop) is the expected site-side outcome of the one click.
  const dialog = await probe(fakeCdp({ noRequest: true, gate: { dialog: true, dialogWord: 'terms of', composerStillFilled: true, pathname: '/text/direct' } }));
  assert.equal(dialog.ok, false);
  assert.equal(dialog.appVerified, true);
  assert.equal(dialog.reason, 'site-consent-or-signin-dialog');
  assert.deepEqual(outcome(dialog), { pass: true, level: 'notice', siteGate: true });

  const silent = await probe(fakeCdp({ noRequest: true, gate: { dialog: false, dialogWord: null, composerStillFilled: true, pathname: '/text/direct' } }));
  assert.equal(silent.reason, 'site-silent-gate');
  assert.equal(outcome(silent).pass, true);

  const unlabeled = await probe(fakeCdp({ noRequest: true, gate: { dialog: true, dialogWord: null, composerStillFilled: true, pathname: '/text/direct' } }));
  assert.equal(unlabeled.reason, 'site-dialog-gate');
  assert.equal(outcome(unlabeled).pass, true);

  // an app-side failure is never laundered into a pass: the click never
  // happened (not actionable), the composer never filled, the gate never saw a
  // working app at all.
  assert.equal(outcome({ ok: false, reason: 'send-not-actionable' }).pass, false);
  assert.equal(outcome({ ok: false, reason: 'composer-fill-failed' }).pass, false);
  assert.equal(outcome({ ok: false, attempted: true, appVerified: true, reason: 'contract-mismatch' }).pass, false);
  assert.equal(outcome({ ok: false, reason: 'site-silent-gate' }).pass, false, 'site gate without appVerified never passes');
  assert.equal(outcome({ ok: true, reason: 'verified-anonymous-round-trip' }).pass, true);
});

test('runtime gate cannot pass missing CDP facts, duplicate plus, hidden composer, script-only click, an undrivable composer or a dead drawer', () => {
  const good = { engine: { host: 'arena.ai', site: { id: 'arena' }, engine: { css: true, root: true, engineApi: 'object', handleBack: 'function' }, composer: { named: 1, rect: [0, 0, 320, 50] }, attach: { toggle: 1 } },
    sheetOpenedBy: 'real-click', steps: [],
    composerFill: { engine: true, set: true, valueMatches: true, sendButton: true, sendDisabledWhileFilled: false, cleared: true },
    drawer: { present: true, visible: true, rect: [0, 0, 300, 600], backdrop: true, railDock: 'composer' } };
  assert.deepEqual(acceptanceFailures(good), []);
  assert.ok(acceptanceFailures({}).length);
  assert.ok(acceptanceFailures({ ...good, sheetOpenedBy: 'js-click' }).includes('plus-not-touch-actionable'));
  assert.ok(acceptanceFailures({ ...good, engine: { ...good.engine, attach: { toggle: 2 } } }).includes('plus-count-not-one'));
  assert.ok(acceptanceFailures({ ...good, engine: { ...good.engine, composer: { named: 1, rect: [0, 0, 0, 0] } } }).includes('composer-not-visible'));
  // the composer-fill facts: React ignoring the engine's events is the one
  // failure mode that kills every feature at once, so the gate demands it
  for (const broken of [null, { engine: true, set: false, valueMatches: true, sendButton: true, cleared: true }, { engine: true, set: true, valueMatches: false, sendButton: true, cleared: true }, { engine: true, set: true, valueMatches: true, sendButton: true, cleared: false }]) {
    assert.ok(acceptanceFailures({ ...good, composerFill: broken }).includes('composer-not-drivable'), JSON.stringify(broken));
  }
  assert.ok(acceptanceFailures({ ...good, composerFill: { ...good.composerFill, sendButton: false } }).includes('send-button-missing'));
  assert.ok(acceptanceFailures({ ...good, drawer: { present: true, visible: false } }).includes('settings-drawer-not-openable'));
});
