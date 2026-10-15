// Phase 3: arena.ai COVERAGE of the engine's built-in config.
//
// The engine reads its site knowledge from one config object (content.js's `PH`)
// plus a handful of hardcoded URLs and API paths. sd-site.js merges an arena.ai
// profile into that object and exposes the resolved URL/API facts as
// window.__sdUrl / window.__sdApi.
//
// This file makes completeness enforceable instead of hopeful:
//
//  1. EVERY leaf of the built-in config must be accounted for on arena.ai —
//     overridden by the profile, owner-protected, provably unread by the bundle,
//     inert (a DeepSeek-only value that cannot match arena's DOM/models), or
//     neutral (site-independent engine behaviour). Anything else fails the test
//     and prints the leaf, so a future bundle sync cannot silently ship a
//     DeepSeek selector into the arena build.
//  2. No "off" value may be an empty string: querySelector('') throws,
//     DOMTokenList.add/remove('') throws and text.includes('') matches
//     everything. Sentinels (OFF/OFF_TEXT) are asserted instead.
//  3. The hardcoded-site seams exist, are unique, and keep their DeepSeek
//     literal as a fallback, so a bundle staged without sd-site.js behaves
//     exactly as it did before Phase 1.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import * as acorn from 'acorn';

const here = path.dirname(fileURLToPath(import.meta.url));
const bds = path.join(here, '../../main/bds-assets/bds');
const read = (f) => fs.readFileSync(path.join(bds, f), 'utf8');
const CONTENT = read('content.js');
const SITE = read('sd-site.js');
const INJECTED = read('injected.js');
const NATIVE = read('sd-native.js');

// ── helpers ─────────────────────────────────────────────────────────────────

function configNode() {
  const ast = acorn.parse(CONTENT, { ecmaVersion: 'latest' });
  let found = null;
  (function walk(node) {
    if (!node || typeof node.type !== 'string' || found) return;
    if (node.type === 'VariableDeclarator' && node.id && node.id.name === 'PH') { found = node; return; }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'range') continue;
      const value = node[key];
      if (Array.isArray(value)) value.forEach((c) => c && typeof c.type === 'string' && walk(c));
      else if (value && typeof value.type === 'string') walk(value);
    }
  })(ast);
  return found;
}

/** A fresh host-realm copy of the engine's built-in (DeepSeek) config. */
function builtinConfig() {
  const decl = configNode();
  assert.ok(decl, 'no `PH` config declarator in content.js');
  const init = decl.init;
  assert.equal(init.type, 'CallExpression', 'the site-profile seam is gone from content.js');
  const literal = CONTENT.slice(init.arguments[0].start, init.arguments[0].end);
  return JSON.parse(JSON.stringify(vm.runInContext(`(${literal})`, vm.createContext({}))));
}

/** sd-site.js evaluated as if the page were https://<host>/. */
function loadSite(host) {
  const ctx = vm.createContext({ location: { host, hostname: host }, console });
  ctx.window = ctx;
  vm.runInContext(SITE, ctx);
  return ctx;
}

/** The built-in config after the arena profile merged into it. */
function arenaConfig() {
  const ctx = loadSite('arena.ai');
  ctx.__builtin = JSON.stringify(builtinConfig());
  const merged = vm.runInContext('window.__sdProfile(JSON.parse(__builtin))', ctx);
  return JSON.parse(JSON.stringify(merged));
}

function leaves(obj, prefix = '', out = []) {
  for (const [key, value] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === 'object' && !Array.isArray(value)) leaves(value, p, out);
    else out.push([p, value]);
  }
  return out;
}

const at = (obj, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), obj);
const times = (haystack, needle) => haystack.split(needle).length - 1;

// ── 1. Full coverage of the built-in config ─────────────────────────────────

/**
 * Owner-pinned: these must NEVER be overridden by a profile (the "+" sheet's
 * card set and the sidebar Advanced-settings entry keep their shipped shape).
 */
function isProtected(p) {
  return p.startsWith('features.attachMenu.') || p === 'features.sideBarMenuInjector.enabled';
}

/**
 * INERT — a DeepSeek-only value that cannot match anything on arena.ai, so the
 * feature it feeds is naturally quiet there. Each entry says why, and why it is
 * NOT blanked (a merge cannot delete keys, and blank values are traps).
 */
const INERT = {
  'selectors.message.container': 'superseded on arena by selectors.message.containers (the four verified thread-list selectors); the singular DeepSeek key is never consulted in the arena branch',
  'selectors.modelBadge': 'DeepSeek CSS-module hash ._46a12ab; no arena equivalent (model badge is a Phase 5 item)',
  'selectors.sidebar.panel': 'DeepSeek CSS-module hash .dc04ec1d',
  'selectors.header.title': 'DeepSeek CSS-module hash ._7436101',
  'selectors.header.logoContainer': 'unread + DeepSeek hash ._262baab',
  'selectors.previewPanel': 'DeepSeek CSS-module hash ._519be07 (artifact panel)',
  'selectors.priceInsertion.headerRow': 'DeepSeek hashes; tokenPriceDisplay is off on arena',
  'selectors.codeBlock.banner': 'DeepSeek class .md-code-block-banner; arena code-block chrome is a Phase 5 item',
  'selectors.theme.lightClass': 'arena themes with html.dark only; "light" is a valid token arena never sets (blank would be a DOMTokenList trap)',
  'modelMappings.deepseek-v4-pro.aliases': 'keyed by DeepSeek model ids arena never reports; a deep merge cannot delete keys',
  'modelMappings.deepseek-v4-pro.displayName': 'same',
  'modelMappings.deepseek-v4-flash.aliases': 'same',
  'modelMappings.deepseek-v4-flash.displayName': 'same',
  'embeddedPricing.deepseek-v4-flash.input': 'DeepSeek model key + tokenPriceDisplay off',
  'embeddedPricing.deepseek-v4-flash.output': 'same',
  'embeddedPricing.deepseek-v4-pro.input': 'same',
  'embeddedPricing.deepseek-v4-pro.output': 'same',
  'embeddedPricing.deepseek-chat.input': 'same',
  'embeddedPricing.deepseek-chat.output': 'same',
  'embeddedPricing.deepseek-reasoner.input': 'same',
  'embeddedPricing.deepseek-reasoner.output': 'same',
};

/**
 * NEUTRAL — site-independent engine behaviour that must stay exactly as shipped
 * on arena too (engine-owned UI and tools, not site DOM/API knowledge).
 */
const NEUTRAL = {
  'features.fileUpload.enabled': 'engine-owned upload path (native picker + bridge)',
  'features.fileUpload.imagesEnabled': 'same',
  'features.fileUpload.dataTransfer': 'same',
  'features.fileUpload.nativeInput': 'same',
  'features.codeBlocks.runButtons.python': 'engine-owned code-block button (Linux sandbox)',
  'features.codeBlocks.runButtons.javascript': 'same',
  'features.codeBlocks.runButtons.typescript': 'same',
  'features.sidebar.search': 'engine-owned drawer UI; Phase 5 re-points its data source at /api/history/search',
  'features.systemPromptInjection.enabled': 'delivered through the site composer, not a DeepSeek API',
  'features.export.markdown': 'export reads the DOM through selectors.textExtraction',
  'features.export.pdf': 'same',
  'features.export.html': 'same',
  'features.export.image': 'same',
  'features.longWork.enabled': 'site-aware since Phase 3 (window.__sdUrl)',
  'features.rag.enabled': 'engine-owned feature',
  'features.characterRp.enabled': 'engine-owned feature',
  'features.autoFetch.web': 'engine tool, not a site API',
  'features.autoFetch.github': 'same',
  'features.autoFetch.twitter': 'same',
  'features.autoFetch.youtube': 'same',
  'features.autoFetch.search': 'same',
  'features.questionPanel.enabled': 'engine-owned UI',
  'features.codeRunner.enabled': 'engine-owned UI (Linux sandbox)',
  'features.tagManager.enabled': 'engine-owned UI; its DeepSeek sidebar anchors are inert',
  'features.selectionMode.enabled': 'engine-owned UI',
  'features.themeWatcher.enabled': 'watches html.dark, which arena also uses',
  'remoteConfig.url': 'empty in the shipped build too (no remote config)',
};

test('every built-in config leaf is accounted for on arena.ai', () => {
  const built = builtinConfig();
  const arena = arenaConfig();
  const all = leaves(built);
  assert.ok(all.length >= 140, `config shrank unexpectedly: ${all.length} leaves`);

  const unclassified = [];
  const unread = [];
  let overridden = 0;
  let protectedCount = 0;

  for (const [p, value] of all) {
    const arenaValue = at(arena, p);
    const differs = JSON.stringify(arenaValue) !== JSON.stringify(value);

    if (isProtected(p)) {
      // Owner-pinned AND untouched: the profile must not reshape engine UI.
      assert.ok(!differs, `protected key was overridden by the arena profile: ${p}`);
      protectedCount += 1;
      continue;
    }
    if (differs) { overridden += 1; continue; }

    // Not overridden: it must be provably harmless.
    const key = p.split('.').pop();
    if (times(CONTENT, key) <= 1) { unread.push(p); continue; } // only the literal mentions it
    if (Object.hasOwn(INERT, p)) continue;
    if (Object.hasOwn(NEUTRAL, p)) continue;
    unclassified.push(`${p} = ${JSON.stringify(value).slice(0, 90)}`);
  }

  assert.deepEqual(unclassified, [],
    'arena.ai would still read these DeepSeek values — override them in sd-site.js, '
    + 'or classify them in INERT/NEUTRAL with a reason:\n  ' + unclassified.join('\n  '));

  // The classification itself must stay honest.
  assert.ok(overridden >= 40, `expected the arena profile to override ~44 leaves, saw ${overridden}`);
  assert.equal(protectedCount, 34, 'the owner-pinned key set changed shape');
  assert.ok(unread.length >= 20, `expected ~24 provably-unread leaves, saw ${unread.length}`);
  for (const p of [...Object.keys(INERT), ...Object.keys(NEUTRAL)]) {
    assert.ok(at(built, p) !== undefined, `stale classification: ${p} is not a config leaf any more`);
    assert.equal(JSON.stringify(at(arena, p)), JSON.stringify(at(built, p)),
      `${p} is classified as untouched but the profile overrides it — move it out of INERT/NEUTRAL`);
  }
});

// ── 2. No empty-string traps ────────────────────────────────────────────────

/** Values that may legitimately be empty: URLs the engine checks before use. */
const EMPTY_ALLOWED = new Set([
  'api.statusUrl',            // statusMonitor is off on arena
  'api.pricing.officialUrl',  // tokenPriceDisplay is off on arena
  'api.pricing.githubUrl',    // empty in the shipped build too
  'remoteConfig.url',         // empty in the shipped build too
]);

test('no selector or match string is blanked on arena', () => {
  const arena = arenaConfig();
  const blank = leaves(arena)
    .filter(([p, v]) => v === '' && !EMPTY_ALLOWED.has(p))
    .map(([p]) => p);
  assert.deepEqual(blank, [],
    'blank values are traps (querySelector(\'\') throws, includes(\'\') matches everything): '
    + 'use sd-site.js\'s OFF/OFF_TEXT sentinels instead');

  // The sentinels themselves must be usable where they land.
  const off = arena.selectors.modelSwitcher;
  assert.match(off, /^\.[A-Za-z][\w-]*$/, 'OFF must be a valid, never-rendered class selector');
  assert.equal(off, arena.selectors.dropdownMenu.optionLabel);
  for (const mode of ['vision', 'expert', 'deepthink', 'instant', 'chat']) {
    assert.equal(arena.modelDetection.attrMap[mode], '__sds_off__',
      `modelDetection.attrMap.${mode} must not keep a DeepSeek mode name`);
  }
  assert.equal(arena.android.hideGetAppText, '__sds_off__');
  assert.equal(arena.android.hideDrawerAppItemText, '__sds_off__');
});

// ── 3. The Phase-3 anchor set on arena ──────────────────────────────────────

test('arena overrides the core chat loop', () => {
  const a = arenaConfig();
  assert.deepEqual([...a.selectors.chatInput.textarea].slice(0, 2),
    ['textarea[name="message"]', 'form textarea[name="message"]']);
  assert.deepEqual([...a.selectors.sendButton.selectors], ['button[aria-label="Send message"]', 'button']);
  assert.deepEqual([...a.selectors.stopButton.selectors], ['button[aria-label="Stop"]', 'button[aria-label*="Stop"]']);
  // The four verified thread-list selectors (dexforint/arena-utils): arena
  // serves both reversed and plain lists, and the engine reads the real order
  // from the page's computed flex-direction at scan time.
  assert.deepEqual([...a.selectors.message.containers], [
    'main ol.flex-col-reverse', 'ol.flex-col-reverse', 'ol.mt-8.flex', 'ol.mt-8',
  ]);
  assert.equal(a.selectors.message.rowExcludedClass, 'h-0');
  assert.equal(a.selectors.message.rowRequires, '.prose');
  assert.deepEqual([...a.selectors.message.userRole], ['justify-end', ':scope > .group', ':scope > .self-end']);
  assert.deepEqual([...a.selectors.message.assistantRole], ['prose']);
  assert.equal(a.selectors.codeBlock.container, "[data-code-block='true']");
  assert.equal(a.selectors.dropdownMenu.container, '[role="menu"]');
  assert.equal(a.selectors.fileInput, 'input[type="file"]', 'must also match a non-multiple input');
  assert.equal(a.urlPatterns.base, 'https://arena.ai/');
  assert.equal(a.urlPatterns.chatSession, '/c/');
  // Direct Chat sends through the evaluation endpoints (create-evaluation, then
  // post-to-evaluation/{id}); create-chat is Agent mode's, which is out of scope.
  assert.deepEqual([...a.api.chatCompletionPaths],
    ['/nextjs-api/stream/create-evaluation', '/nextjs-api/stream/post-to-evaluation/']);
  assert.equal(a.api.firstTurnPath, '/nextjs-api/stream/create-evaluation');
  // /api/chat/{id}/messages is Agent mode's history and no Direct Chat history
  // endpoint is known: nothing on arena may look like a session/history response.
  assert.equal(a.api.sessionFetchPath, '__sds_off__');
  assert.equal(a.api.historyMessagesPath, '__sds_off__');
  assert.equal(a.api.explicitHistory, false);
  assert.equal(a.selectors.theme.darkClass, 'dark');
});

// ── 4. Resolved surfaces (window.__sdUrl / window.__sdApi) ──────────────────

test('__sdUrl and __sdApi resolve per site, and never for a look-alike host', () => {
  const ds = loadSite('chat.deepseek.com');
  const arena = loadSite('arena.ai');
  const www = loadSite('www.arena.ai');
  const evil = loadSite('arena.ai.evil.example');

  const urls = (ctx) => vm.runInContext(
    'JSON.stringify({home:__sdUrl.home,session:__sdUrl.session,noSlash:__sdUrl.atHome(__sdUrl.home.replace(/\\/$/,"")),other:__sdUrl.atHome("https://example.com/")})', ctx);
  assert.deepEqual(JSON.parse(urls(ds)), {
    home: 'https://chat.deepseek.com/', session: '/chat/s/', noSlash: true, other: false,
  }, 'DeepSeek keeps the exact URLs the bundle used to hardcode');
  assert.deepEqual(JSON.parse(urls(arena)), {
    home: 'https://arena.ai/', session: '/c/', noSlash: true, other: false,
  });
  assert.deepEqual(JSON.parse(urls(www)), JSON.parse(urls(arena)), 'www.arena.ai is the same site');
  assert.deepEqual(JSON.parse(urls(evil)), JSON.parse(urls(ds)), 'a look-alike host falls back to DeepSeek');

  const api = (ctx) => JSON.parse(vm.runInContext('JSON.stringify(__sdApi)', ctx));
  assert.deepEqual(api(ds), {
    sessionFetch: '/api/v0/chat_session/fetch_page',
    historyMessages: '/api/v0/chat/history_messages',
    completion: '/api/v0/chat/completion',
    completionPaths: ['/api/v0/chat/completion', '/api/v0/chat/edit_message'],
    // the two Phase-5 surfaces: DeepSeek tells its first turn by parent_message_id
    // and always has a history endpoint, so both are inert there
    firstTurn: '',
    explicitHistory: true,
  }, 'injected.js hooks the same paths it always did');
  assert.deepEqual(api(arena).completionPaths, [...arenaConfig().api.chatCompletionPaths]);
  assert.equal(api(arena).sessionFetch, '__sds_off__');
  assert.equal(api(arena).historyMessages, '__sds_off__');
  assert.equal(api(arena).firstTurn, '/nextjs-api/stream/create-evaluation');
  assert.equal(api(arena).explicitHistory, false);
});

// ── 5. The hardcoded-site seams, and their fallbacks ────────────────────────

test('the bundle reads the site surfaces instead of hardcoding DeepSeek', () => {
  // content.js: long-work home detection, three "go home" navigations, and the
  // two "are we inside a conversation" gates that used to test for /chat/s/.
  assert.equal(times(CONTENT, '__sdUrl'), 19, 'content.js seam count changed — re-audit the patched sites');
  assert.equal(times(CONTENT, 'location.href.includes((window.__sdUrl&&window.__sdUrl.session)||"/chat/s/")'), 2);
  assert.equal(times(CONTENT, 'window.__sdUrl?window.__sdUrl.atHome(e)'), 1, 'long-work home check');
  assert.equal(times(CONTENT, 'window.location.href=(window.__sdUrl&&window.__sdUrl.home)||"https://chat.deepseek.com/"'), 3,
    'three go-home navigations');
  // Every patched site keeps its DeepSeek literal, so a bundle staged without
  // sd-site.js still behaves exactly as before.
  assert.equal(times(CONTENT, 'https://chat.deepseek.com/'), 5, '1 config literal + 4 fallbacks');

  assert.equal(times(NATIVE, '__sdUrl'), 2, 'sd-native.js go-home seam');
  assert.equal(times(NATIVE, "|| 'https://chat.deepseek.com/'"), 1);

  // injected.js: the network-hook path list (fetch wrapper, XHR wrapper, the
  // constants block and the completion detector).
  assert.equal(times(INJECTED, '__sdApi'), 20, 'injected.js seam count changed — re-check the six sites (+ firstTurn, explicitHistory)');
  assert.equal(times(INJECTED, '(window.__sdApi&&window.__sdApi.sessionFetch)||"/api/v0/chat_session/fetch_page"'), 3);
  assert.equal(times(INJECTED, '(window.__sdApi&&window.__sdApi.historyMessages)||"/api/v0/chat/history_messages"'), 3);
  assert.equal(times(INJECTED, '(window.__sdApi&&window.__sdApi.completion)||"/api/v0/chat/completion"'), 1);
  assert.equal(times(INJECTED, '((window.__sdApi&&window.__sdApi.completionPaths)||["/api/v0/chat/completion","/api/v0/chat/edit_message"]).some(function(p){return l.includes(p)})'), 1);

  // The seams must not have introduced a second site-profile seam in content.js.
  assert.equal(times(CONTENT, 'window.__sdProfile||function(x){return x}'), 1);
});

test('the injected order still puts sd-site.js first', () => {
  const main = fs.readFileSync(
    path.join(here, '../../main/java/com/superdeepseek/app/MainActivity.kt'), 'utf8');
  const harness = fs.readFileSync(
    path.join(here, '../../../../../tools/harness/harness.mjs'), 'utf8');
  assert.ok(main.indexOf('readAsset("sd-site.js")') < main.indexOf('readAsset("injected.js")'),
    'sd-site.js must be evaluated before injected.js, which reads window.__sdApi');
  assert.ok(harness.indexOf("'sd-site.js'") < harness.indexOf("'injected.js'"),
    'the harness must stage the same order');
});
