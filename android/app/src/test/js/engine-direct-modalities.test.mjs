// Direct Mode, all four modalities (v2.3.0).
//
// arena.ai's Direct Chat has four home routes — /text/direct, /code/direct,
// /search/direct, /image/direct — and every conversation lives at /c/{id}. The
// request body names the modality (verified in arena's own shipped chunks:
// chat | webdev | search | image | video | audio | auto | p2l). Until v2.3.0 the
// engine knew only /text/direct, so on Code, Search and Image it answered
// "unknown" and paused every tool.
//
// These tests run the REAL sd-site.js and the REAL injected.js in one vm, the
// way the app injects them.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bds = path.join(here, '../../main/bds-assets/bds');
const SITE = fs.readFileSync(path.join(bds, 'sd-site.js'), 'utf8');
const INJECTED = fs.readFileSync(path.join(bds, 'injected.js'), 'utf8');
const BUNDLE = fs.readFileSync(path.join(bds, 'content.js'), 'utf8');

function boot({ pathname = '/text/direct', label = 'Direct', labels = [], config = null } = {}) {
  const sent = [];
  const events = new EventTarget();
  const control = { textContent: label };
  const extra = labels.map((textContent) => ({ textContent }));
  const form = { querySelector: () => control, querySelectorAll: () => extra };
  const win = {
    addEventListener: (...a) => events.addEventListener(...a),
    removeEventListener: (...a) => events.removeEventListener(...a),
    dispatchEvent: (e) => events.dispatchEvent(e),
    fetch: async (input, init) => {
      sent.push({ input, init });
      return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
    },
    console: { ...console, warn() {} },
  };
  const store = new Map();
  const ctx = {
    window: win,
    console: win.console,
    document: {
      querySelector: (sel) => (sel === 'textarea[name="message"]' ? { closest: () => form } : null),
      querySelectorAll: () => [], cookie: '', documentElement: {},
    },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      key: (i) => [...store.keys()][i] ?? null,
      get length() { return store.size; },
    },
    navigator: { language: 'en' },
    location: { host: 'arena.ai', hostname: 'arena.ai', pathname, href: `https://arena.ai${pathname}` },
    CustomEvent, Event, EventTarget, Headers, Request, Response, URL, URLSearchParams, TextDecoder, TextEncoder,
    XMLHttpRequest: function () {}, setTimeout, clearTimeout, JSON, Promise, Date, Math, Array, Object, String, Number, Map, Set,
    encodeURIComponent, decodeURIComponent,
  };
  ctx.XMLHttpRequest.prototype = { open() {}, send() {}, setRequestHeader() {}, addEventListener() {} };
  ctx.globalThis = ctx;
  win.localStorage = ctx.localStorage;
  win.XMLHttpRequest = ctx.XMLHttpRequest;
  win.location = ctx.location;
  win.document = ctx.document;
  vm.createContext(ctx);
  vm.runInContext(SITE, ctx);
  vm.runInContext(INJECTED, ctx);
  if (config) win.dispatchEvent(new CustomEvent('bds:config-update', { detail: JSON.stringify(config) }));
  return { win, ctx, control, sent, site: win.__sdSite, navigate: (p) => { ctx.location.pathname = p; } };
}

// ── routes ──────────────────────────────────────────────────────────────────

test('all four Direct home routes are Direct Mode, each with its own modality', () => {
  const expected = { '/text/direct': 'chat', '/code/direct': 'webdev', '/search/direct': 'search', '/image/direct': 'image' };
  for (const [route, modality] of Object.entries(expected)) {
    const p = boot({ pathname: route });
    assert.equal(p.site.arenaMode(), 'direct', route);
    assert.equal(p.site.arenaModality(), modality, route);
  }
});

test('the Video Direct route is a Direct surface whose prompt is never touched', () => {
  const p = boot({ pathname: '/video/direct' });
  assert.equal(p.site.arenaMode(), 'direct');
  assert.equal(p.site.arenaModality(), 'video');
  const caps = p.site.arenaCapabilities();
  assert.equal(caps.sharedUi, true);
  for (const key of ['promptContext', 'assistantScanning', 'mcp', 'continuity', 'memories', 'projects', 'personasSkills']) assert.equal(caps[key], false, key);
});

test('the content-script gate opens on every Direct route (it used to open on /text/direct only)', () => {
  const gate = BUNDLE.slice(BUNDLE.indexOf('function sdsArenaCapability(name){'), BUNDLE.indexOf('\nfunction sdsArenaMessages()'));
  for (const route of ['/text/direct', '/code/direct', '/search/direct', '/image/direct']) {
    const p = boot({ pathname: route });
    vm.runInContext(gate, p.ctx);
    assert.equal(vm.runInContext('sdsArenaDirect()', p.ctx), true, route);
  }
});

test('capability matrix preserves prompt isolation and limits tool automation', () => {
  const expected = {
    '/text/direct': { promptContext: true, mcp: true, continuity: true, memories: true },
    '/code/direct': { promptContext: true, mcp: true, continuity: true, memories: true, projects: true, personasSkills: true },
    '/search/direct': { promptContext: true, mcp: true, continuity: true, memories: true, projects: true, personasSkills: true },
    '/video/direct': { promptContext: false, mcp: false, continuity: false, memories: false },
    '/chat': { promptContext: true, mcp: true, continuity: true, memories: true, projects: true, personasSkills: true },
    '/image/direct': { promptContext: false, mcp: false, continuity: false, memories: false },
  };
  for (const [route, flags] of Object.entries(expected)) {
    const caps = boot({ pathname: route }).site.arenaCapabilities();
    for (const [key, value] of Object.entries(flags)) assert.equal(caps[key], value, `${route} ${key}`);
  }
});

test('a /c/{id} conversation keeps the modality it was started in', () => {
  const p = boot({ pathname: '/code/direct' });
  assert.equal(p.site.arenaMode(), 'direct');
  p.navigate('/c/019e-abc');
  assert.equal(p.site.arenaMode(), 'direct');
  assert.equal(p.site.arenaModality(), 'webdev', 'arena navigates to /c/{id} after the first send');
  p.site.noteModality('search');
  assert.equal(p.site.arenaModality(), 'search', 'a modality reported by a request body wins');
});

test('every non-Direct route stays unsupported or unknown — Battle and Side-by-side are untouched, Agent is context-only', () => {
  for (const slug of ['text', 'code', 'search', 'image', 'video']) {
    for (const mode of ['battle', 'side-by-side']) {
      assert.equal(boot({ pathname: `/${slug}/${mode}` }).site.arenaMode(), 'unsupported', `${slug}/${mode}`);
    }
    assert.equal(boot({ pathname: `/${slug}/agent` }).site.arenaMode(), 'agent', `${slug}/agent`);
  }
  assert.equal(boot({ pathname: '/agent' }).site.arenaMode(), 'agent');
  for (const route of ['/agent', '/agent/some-task', '/text/agent']) {
    const caps = boot({ pathname: route }).site.arenaCapabilities();
    // Agent is context-only: read-only project/persona/skill/memory context, never tags, scanning or MCP.
    assert.equal(caps.agentContext, true, route);
    for (const key of ['sharedUi', 'assistantScanning', 'mcp', 'continuity', 'memories']) assert.equal(caps[key], false, `${route} ${key}: no tag protocol or tool automation next to Arena's native tools`);
  }
  for (const route of ['/leaderboard', '/c/id/extra', '/code', '/image/direct/extra']) {
    assert.notEqual(boot({ pathname: route }).site.arenaMode(), 'direct', route);
  }
  // a stale route cannot override the visible mode control
  assert.equal(boot({ pathname: '/code/direct', label: 'Battle' }).site.arenaMode(), 'unsupported');
  assert.equal(boot({ pathname: '/c/x', label: 'Side-by-side' }).site.arenaMode(), 'unsupported');
});

test('modality profiles: text, code and search run the engine; image never gets the instruction block', () => {
  const { site } = boot();
  assert.equal(site.modalityProfile('chat').inject, true);
  assert.equal(site.modalityProfile('webdev').inject, true);
  assert.equal(site.modalityProfile('search').inject, true);
  assert.equal(site.modalityProfile('image').inject, false);
  assert.equal(site.modalityProfile('video').inject, false);
  assert.equal(site.modalityProfile('something-new').inject, true, 'an unseen name behaves like chat, never silently off');
  assert.match(site.modalityProfile('webdev').addendum, /Arena Code/);
  assert.match(site.modalityProfile('search').addendum, /Arena Search/);
  assert.equal(site.modalityProfile('chat').addendum, '');
});

// ── what actually reaches arena ─────────────────────────────────────────────

const CREATE = 'https://arena.ai/nextjs-api/stream/create-evaluation';
const PLAIN = { 'content-type': 'text/plain;charset=UTF-8' };
const turn = (modality, content, id = 'E1') => ({
  id, mode: 'direct-battle', modelAId: 'm', userMessageId: 'u', modelAMessageId: 'a',
  userMessage: { content, experimental_attachments: [], metadata: {} },
  modality, recaptchaV3Token: 'TOKEN',
});
const CFG = { systemPrompt: 'SYS', memories: [], disableSystemPrompt: false, disableMemory: false };

async function send(route, modality, content) {
  const p = boot({ pathname: route, config: CFG });
  await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(turn(modality, content)) });
  return JSON.parse(p.sent[0].init.body);
}

test('text: the first turn carries the system prompt and no mode addendum (unchanged behaviour)', async () => {
  const sent = await send('/text/direct', 'chat', 'hello');
  assert.equal(sent.userMessage.content, '<ArenaPilot>\nSYS\n</ArenaPilot>\n\nhello');
});

test('code: the system prompt is followed by the Arena Code working rules', async () => {
  const sent = await send('/code/direct', 'webdev', 'build a todo app');
  const c = sent.userMessage.content;
  assert.ok(c.startsWith('<ArenaPilot>\nSYS\n\nMODE: Arena Code (WebDev)'), c.slice(0, 120));
  assert.ok(c.endsWith('</ArenaPilot>\n\nbuild a todo app'));
  assert.equal(sent.modality, 'webdev', 'the body arena receives keeps its modality');
  assert.equal(sent.recaptchaV3Token, 'TOKEN');
});

test('search: the system prompt is followed by the Arena Search working rules', async () => {
  const sent = await send('/search/direct', 'search', 'latest android release');
  assert.match(sent.userMessage.content, /MODE: Arena Search/);
  assert.match(sent.userMessage.content, /latest android release$/);
});

test('image: the user prompt reaches the image model exactly as typed', async () => {
  const sent = await send('/image/direct', 'image', 'a red fox in the snow, watercolor');
  assert.equal(sent.userMessage.content, 'a red fox in the snow, watercolor');
});

test('the body modality decides, even when the URL is a /c/{id} that says nothing', async () => {
  const p = boot({ pathname: '/c/019e-zzz', config: CFG });
  await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(turn('image', 'a lighthouse at dusk')) });
  assert.equal(JSON.parse(p.sent[0].init.body).userMessage.content, 'a lighthouse at dusk');
  assert.equal(p.site.arenaModality(), 'image');
});

test('an unseen modality name still gets the engine (a rename cannot switch tools off)', async () => {
  const sent = await send('/text/direct', 'brand-new-modality', 'hi');
  assert.match(sent.userMessage.content, /^<ArenaPilot>\nSYS\n<\/ArenaPilot>/);
});

test('Battle and Side-by-side bodies are still never rewritten', async () => {
  for (const mode of ['battle', 'side-by-side']) {
    const p = boot({ pathname: '/code/direct', config: CFG });
    const body = { ...turn('webdev', 'x'), mode };
    await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(body) });
    assert.equal(JSON.parse(p.sent[0].init.body).userMessage.content, 'x', mode);
  }
});

// ── the emulator gate for the three non-Text pages ──────────────────────────

test('emulator gate: Code, Search and Image must be Direct with the right modality', async () => {
  const { MODALITY_ROUTES, modalityFailures } = await import('../../../../ci/cdp_probe.mjs');
  assert.deepEqual(MODALITY_ROUTES.map((r) => r.path), ['/code/direct', '/search/direct', '/image/direct']);
  const [code] = MODALITY_ROUTES;
  const good = { composer: true, engine: true, mode: 'direct', modality: 'webdev', profile: 'webdev' };
  assert.deepEqual(modalityFailures(code, good), []);
  assert.deepEqual(modalityFailures(code, { ...good, mode: 'unknown' }), ['modality-webdev-mode-unknown'], 'the pre-v2.3.0 behaviour fails the gate');
  assert.deepEqual(modalityFailures(code, { ...good, modality: 'chat' }), ['modality-webdev-got-chat']);
  assert.deepEqual(modalityFailures(code, { ...good, engine: false }), ['modality-webdev-engine-not-injected']);
  assert.deepEqual(modalityFailures(code, { composer: false }), [], 'a sign-in or challenge page is skipped, not failed');
  assert.deepEqual(modalityFailures(code, null), ['modality-webdev-unreadable']);
});

test('before the navigation observer runs, a previous chat config cannot decorate a new request',async()=>{
  const p=boot({pathname:'/c/old',config:{...CFG,contextPath:'/c/old',activeProject:{name:'old-project',instructions:'private'}}});p.navigate('/c/new');
  const body=JSON.stringify(turn('chat','untouched','new'));await p.win.fetch(CREATE,{method:'POST',headers:PLAIN,body});assert.equal(p.sent[0].init.body,body);
});
test('a mismatched conversation id cannot receive project context even at the same URL',async()=>{
  const p=boot({pathname:'/c/current',config:{...CFG,contextPath:'/c/current',activeProject:{name:'current',instructions:'private'}}});
  const body=JSON.stringify(turn('chat','untouched','other'));await p.win.fetch(CREATE,{method:'POST',headers:PLAIN,body});assert.equal(p.sent[0].init.body,body);
});


// ── unified /chat composer: Chat | Agent toggle + Auto/Text/Code/Web Search/Image/Video ──

test('the unified /chat home is a Chat surface that defaults to Auto', () => {
  const p = boot({ pathname: '/chat', label: '', labels: [] });
  assert.equal(p.site.arenaMode(), 'direct');
  assert.equal(p.site.arenaModality(), 'auto');
  assert.equal(p.site.arenaCapabilities().sharedUi, true);
  assert.equal(boot({ pathname: '/chat/', label: '' }).site.arenaMode(), 'direct');
  assert.notEqual(boot({ pathname: '/chat/extra/x', label: '' }).site.arenaMode(), 'direct');
});

test('composer labels decide Chat vs Agent vs Battle on /chat and /c/{id}', () => {
  for (const route of ['/chat', '/c/019e-abc']) {
    assert.equal(boot({ pathname: route, label: 'Chat' }).site.arenaMode(), 'direct', `${route} Chat`);
    assert.equal(boot({ pathname: route, label: 'Chat', labels: ['chat', 'web search', 'model'] }).site.arenaMode(), 'direct', `${route} Chat+menus`);
    assert.equal(boot({ pathname: route, label: 'Agent' }).site.arenaMode(), 'agent', `${route} Agent`);
    assert.equal(boot({ pathname: route, label: 'Chat', labels: ['agent'] }).site.arenaMode(), 'agent', `${route} Agent beats Chat`);
    assert.equal(boot({ pathname: route, label: 'Chat', labels: ['battle'] }).site.arenaMode(), 'unsupported', `${route} Battle always wins`);
  }
  // an unrecognised label on a conversation URL still fails closed
  assert.equal(boot({ pathname: '/c/x', label: 'Model' }).site.arenaMode(), 'unknown');
});

test('the modality menu label names the submode; each submode maps to the right engine profile', () => {
  const table = { Auto: ['auto', true], Text: ['chat', true], Code: ['webdev', true], 'Web Search': ['search', true], Image: ['image', false], Video: ['video', false] };
  for (const [label, [modality, inject]] of Object.entries(table)) {
    const p = boot({ pathname: '/chat', label: 'Chat', labels: [label.toLowerCase()] });
    assert.equal(p.site.arenaModality(), modality, label);
    assert.equal(p.site.arenaCapabilities().promptContext, inject, `${label} promptContext`);
    assert.equal(p.site.arenaCapabilities().personasSkills, inject, `${label} personasSkills`);
  }
  // the unified composer is still the only place that can say Image: a stale 'Image' label on
  // another page cannot leak through
  assert.equal(boot({ pathname: '/leaderboard', label: 'Chat', labels: ['image'] }).site.arenaCapabilities().promptContext, false);
});

test('Auto classification: only the user words decide; image/video generation is never contaminated', () => {
  const { site } = boot({ pathname: '/chat', label: 'Chat' });
  const cases = [
    ['hello, can you explain monads?', 'chat'],
    ['', 'chat'],
    ['generate an image of a red fox in snow', 'image'],
    ['draw me a cozy cabin at night', 'image'],
    ['একটি সুন্দর লোগো বানাও', 'image'],
    ['create a video of waves crashing on rocks', 'video'],
    ['একটা ভিডিও তৈরি করে দাও', 'video'],
    ['build a landing page in html and css', 'webdev'],
    ['create a logo component in React', 'webdev'],
    ['why does my python function raise a TypeError', 'webdev'],
    ['what is the latest android release today', 'search'],
    ['আজকের খবর কী', 'search'],
    // Phase 3 finding: a media request that merely targets a website must stay Image/Video
    ['draw an icon for my website', 'image'],
    ['make a logo for my web app', 'image'],
    ['generate a poster for the landing page', 'image'],
    ['create a video for my website', 'video'],
    ['আমার website এর জন্য লোগো বানাও', 'image'],
    // ...while a website that merely contains media, or a language/code word, stays code
    ['create a website with a hero image', 'webdev'],
    ['design a landing page', 'webdev'],
    ['draw a mockup of my website', 'webdev'],
    ['create an svg icon', 'webdev'],
    ['write a REST api', 'webdev'],
  ];
  for (const [text, expected] of cases) assert.equal(site.classifyAuto(text), expected, text);
});

test('Auto request: image-like prompts reach arena untouched, others get the matching mode policy', async () => {
  const run = async (content) => {
    const p = boot({ pathname: '/chat', label: 'Chat', config: CFG });
    await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(turn('auto', content)) });
    return JSON.parse(p.sent[0].init.body);
  };
  assert.equal((await run('generate an image of a red fox in snow')).userMessage.content, 'generate an image of a red fox in snow');
  assert.equal((await run('create a video of waves crashing on rocks')).userMessage.content, 'create a video of waves crashing on rocks');
  const text = await run('explain monads simply');
  assert.equal(text.userMessage.content, '<ArenaPilot>\nSYS\n</ArenaPilot>\n\nexplain monads simply');
  assert.equal(text.modality, 'auto', 'arena still receives the modality it was sent');
  assert.match((await run('build a landing page in html and css')).userMessage.content, /MODE: Arena Code/);
  assert.match((await run('what is the latest android release today')).userMessage.content, /MODE: Arena Search/);
  // an Auto image request that names a website is still sent byte-for-byte
  assert.equal((await run('draw an icon for my website')).userMessage.content, 'draw an icon for my website');
  assert.equal((await run('create a video for my website')).userMessage.content, 'create a video for my website');
  assert.match((await run('create a website with a hero image')).userMessage.content, /MODE: Arena Code/);
});


// ── Phase 3 (Text & Code): independent negative isolation cases ─────────────
// These pin what must NOT happen: a mode never receives another mode's playbook,
// mode-restricted skills/personas never leak across Text and Code, Video is never
// decorated, and every field Arena needs is preserved on the wire.

const P3 = {
  ...CFG,
  activeProject: { name: 'CoreApp', instructions: 'PROJECT_RULES' },
  activeCharacter: { name: 'Mentor', usage: 'patient coaching', modes: ['chat'], content: 'PERSONA_RULES' },
  skills: [
    { name: 'SQL Helper', usage: 'PostgreSQL, SQL indexing, query plan', modes: ['chat'], content: 'SQL_TEXT_ONLY' },
    { name: 'CSS Grid', usage: 'css layout, grid, flexbox', modes: ['webdev'], content: 'CSS_CODE_ONLY' },
  ],
};

async function sendWith(route, modality, content, cfg, extra = {}) {
  const p = boot({ pathname: route, config: cfg });
  const body = { ...turn(modality, content), ...extra };
  await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(body) });
  return { body, raw: p.sent[0].init.body, sent: JSON.parse(p.sent[0].init.body) };
}

test('Phase 3: a mode never receives another mode\'s playbook', async () => {
  const text = (await sendWith('/text/direct', 'chat', 'hello there', CFG)).sent.userMessage.content;
  const code = (await sendWith('/code/direct', 'webdev', 'build a todo app', CFG)).sent.userMessage.content;
  const search = (await sendWith('/search/direct', 'search', 'latest android release', CFG)).sent.userMessage.content;
  assert.doesNotMatch(text, /MODE: Arena (Code|Search)/, 'Text carries no Code/Search rules');
  assert.match(code, /MODE: Arena Code/);
  assert.doesNotMatch(code, /MODE: Arena Search/, 'Code carries no Search rules');
  assert.match(search, /MODE: Arena Search/);
  assert.doesNotMatch(search, /MODE: Arena Code/, 'Search carries no Code rules');
});

test('Phase 3: mode-restricted skills and personas do not leak between Text and Code', async () => {
  const textSql = (await sendWith('/text/direct', 'chat', 'Optimize my PostgreSQL query plan', P3)).sent.userMessage.content;
  const textCss = (await sendWith('/text/direct', 'chat', 'Center a div using css grid', P3)).sent.userMessage.content;
  const codeSql = (await sendWith('/code/direct', 'webdev', 'Optimize my PostgreSQL query plan', P3)).sent.userMessage.content;
  const codeCss = (await sendWith('/code/direct', 'webdev', 'Center a div using css grid', P3)).sent.userMessage.content;
  assert.match(textSql, /SQL_TEXT_ONLY/, 'a Text skill matches in Text');
  assert.doesNotMatch(textCss, /CSS_CODE_ONLY/, 'a Code-only skill never enters Text');
  assert.doesNotMatch(codeSql, /SQL_TEXT_ONLY/, 'a Text-only skill never enters Code');
  assert.match(codeCss, /CSS_CODE_ONLY/, 'a Code skill matches in Code');
  assert.match(textSql, /PERSONA_RULES/, 'a Text persona applies in Text');
  assert.doesNotMatch(codeCss, /PERSONA_RULES/, 'a Text-only persona never enters Code');
  assert.match(textSql, /PROJECT_RULES/, 'project instructions apply in Text');
  assert.match(codeCss, /PROJECT_RULES/, 'project instructions apply in Code');
});

test('Phase 3: Video never receives project, persona, memory, skills or a playbook', async () => {
  const cfg = { ...P3, memories: [{ key: 'language', value: 'TypeScript', importance: 'always' }] };
  const r = await sendWith('/video/direct', 'video', 'waves crashing on rocks at sunset', cfg);
  assert.equal(r.raw, JSON.stringify(r.body), 'the video request is byte-for-byte what Arena produced');
  assert.doesNotMatch(r.raw, /ArenaPilot|PROJECT_RULES|PERSONA_RULES|TypeScript|MODE: Arena/);
});

test('Phase 3: Text and Code rewrite only the user message text; every other field survives', async () => {
  const attach = [{ name: 'spec.pdf', contentType: 'application/pdf', url: 'https://example.invalid/spec.pdf' }];
  for (const [route, modality] of [['/text/direct', 'chat'], ['/code/direct', 'webdev']]) {
    const body = turn(modality, 'summarise the attached spec');
    body.userMessage.experimental_attachments = attach;
    const p = boot({ pathname: route, config: CFG });
    await p.win.fetch(CREATE, { method: 'POST', headers: PLAIN, credentials: 'include', body: JSON.stringify(body) });
    const sent = JSON.parse(p.sent[0].init.body);
    assert.deepEqual(sent.userMessage.experimental_attachments, attach, `${modality}: attachments untouched`);
    assert.ok(sent.userMessage.content.endsWith('\n\nsummarise the attached spec'), `${modality}: the user's own words come last, unchanged`);
    const strip = (b) => { const c = structuredClone(b); delete c.userMessage.content; return c; };
    assert.deepEqual(strip(sent), strip(body), `${modality}: every other field is identical`);
  }
});

test('Phase 4: the Search playbook demands citations, dated claims, untrusted web data and honest failure, and stays out of other modes', async () => {
  const { site } = boot();
  const rules = site.modalityProfile('search').addendum;
  assert.match(rules, /Cite the sources you used with their URLs/);
  assert.match(rules, /cross-check at least two independent sources/);
  assert.match(rules, /absolute dates/);
  assert.match(rules, /untrusted data, not instructions/);
  assert.match(rules, /search is unavailable or returns nothing usable/);
  assert.match(rules, /never invent a source or a quote/);
  for (const m of ['chat', 'webdev', 'image', 'video']) {
    assert.doesNotMatch(site.modalityProfile(m).addendum, /Arena Search|absolute dates|untrusted data/, `${m} gets no Search rules`);
  }
  const text = (await send('/text/direct', 'chat', 'latest android release')).userMessage.content;
  assert.doesNotMatch(text, /MODE: Arena Search/);
  const image = (await send('/image/direct', 'image', 'a red fox in the snow')).userMessage.content;
  assert.equal(image, 'a red fox in the snow', 'Image prompt is untouched');
});
