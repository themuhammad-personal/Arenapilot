// The site-profile seam: one engine bundle, more than one chat site.
//
// Phase 1 contract (owner decision 2026-10-11: Direct Chat on arena.ai, a
// separate app flavour, zero regression on DeepSeek):
//
//  1. content.js carries EXACTLY ONE seam: its built-in config object is
//     handed to window.__sdProfile before anything reads it.
//  2. sd-site.js on chat.deepseek.com (and on any host it does not know)
//     returns the built-in object ITSELF — identity, not a copy, not a merge —
//     so the shipped DeepSeek engine is bit-for-bit unchanged.
//  3. On arena.ai the profile is merged INTO that same object, so every direct
//     reader of the config sees arena's values.
//  4. No profile may reshape the engine's OWN UI: the "+" attach sheet card
//     set and the sidebar "Advanced settings" injector stay exactly as shipped.
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
const CONTENT = fs.readFileSync(path.join(bds, 'content.js'), 'utf8');
const SITE = fs.readFileSync(path.join(bds, 'sd-site.js'), 'utf8');
const MAIN_ACTIVITY = fs.readFileSync(
  path.join(here, '../../main/java/com/superdeepseek/app/MainActivity.kt'), 'utf8');
const HARNESS = fs.readFileSync(path.join(here, '../../../../../tools/harness/harness.mjs'), 'utf8');

// ── The built-in config object, lifted out of the real bundle ────────────────

/** `PH`'s declarator: after the seam its init is __sdProfile({…}). */
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

const DECL = configNode();

/** A fresh, real copy of the engine's built-in config (DeepSeek values). */
function builtinConfig() {
  assert.ok(DECL, 'engine code moved: no `PH` config declarator in content.js');
  const init = DECL.init;
  assert.equal(init.type, 'CallExpression', 'the config is no longer wrapped by the site-profile seam');
  const callee = CONTENT.slice(init.callee.start, init.callee.end);
  assert.equal(callee, 'window.__sdProfile||function(x){return x}');
  const literal = init.arguments[0];
  assert.equal(literal.type, 'ObjectExpression');
  const ctx = { window: {} };
  vm.createContext(ctx);
  const raw = vm.runInContext('(' + CONTENT.slice(literal.start, literal.end) + ')', ctx);
  // The literal is pure data (271 nodes, no functions/undefined — asserted by
  // the JSON round-trip below being lossless), and the round-trip moves it into
  // THIS realm so deepStrictEqual does not trip over vm prototypes.
  const host = JSON.parse(JSON.stringify(raw));
  assert.equal(Object.keys(host).length, Object.keys(raw).length);
  return host;
}

/** sd-site.js loaded in a vm whose location.host is `host`. */
function loadSite(host, runTwice = false) {
  const ctx = { console };
  ctx.window = ctx;
  ctx.location = { host, hostname: host };
  vm.createContext(ctx);
  vm.runInContext(SITE, ctx);
  if (runTwice) vm.runInContext(SITE, ctx);
  return ctx;
}

// ── 1. The seam ──────────────────────────────────────────────────────────────

test('content.js carries exactly one site-profile seam', () => {
  const open = 'PH=(window.__sdProfile||function(x){return x})({features:{apiPlayground';
  const close = 'modelInputLimits:{instant:2621440,vision:2621440,expert:163840,deepthink:163840}}),mw=';
  assert.equal(CONTENT.split(open).length - 1, 1, 'seam open anchor must appear exactly once');
  assert.equal(CONTENT.split(close).length - 1, 1, 'seam close anchor must appear exactly once');
  // The unpatched spelling must be gone, or the config bypasses the profile.
  assert.equal(CONTENT.split('PH={features:{apiPlayground').length - 1, 0);
});

test('sd-site.js and content.js both parse', () => {
  assert.doesNotThrow(() => acorn.parse(SITE, { ecmaVersion: 2017 }));
  assert.ok(DECL, 'content.js parsed and exposed its config declarator');
});

// ── 2. Zero regression: DeepSeek and unknown hosts get the built-in object ───

test('on chat.deepseek.com the profile is empty and the config is returned by identity', () => {
  const ctx = loadSite('chat.deepseek.com');
  assert.equal(ctx.__sdSite.id, 'deepseek');
  assert.equal(ctx.__sdSite.profile, null);

  const before = builtinConfig();
  const snapshot = structuredClone(before);
  const after = ctx.__sdProfile(before);

  assert.equal(after, before, 'must return the SAME object — a copy would detach readers');
  assert.deepEqual(after, snapshot, 'the DeepSeek config must not change at all');
});

test('an unknown host never receives arena values', () => {
  for (const host of ['evil.example.com', 'chat.deepseek.com.evil.example', '', 'lmarena.ai']) {
    const ctx = loadSite(host);
    assert.equal(ctx.__sdSite.id, 'deepseek', `host ${host || '(blank)'} must fall back to the built-in profile`);
    const cfg = builtinConfig();
    assert.equal(ctx.__sdProfile(cfg), cfg);
    assert.deepEqual(cfg.selectors.chatInput.textarea, ['#chat-input', 'textarea[placeholder]', 'div[contenteditable="true"]']);
  }
});

test('sd-site.js is idempotent and adds only its own globals', () => {
  const ctx = loadSite('chat.deepseek.com', true);
  assert.equal(ctx.__sdSite.version, 3);
  assert.equal(typeof ctx.__sdProfile, 'function');
  // __sdSite/__sdProfile (Phase 1) + __sdUrl/__sdApi (Phase 3, the resolved
  // facts the bundle's formerly hardcoded sites read). Nothing else: this file
  // runs in the page's own realm, so every extra global is a collision risk.
  const own = Object.keys(ctx).filter((k) => !['window', 'location', 'console'].includes(k)).sort();
  assert.deepEqual(own, ['__sdApi', '__sdProfile', '__sdSite', '__sdUrl']);
});

// ── 3. arena.ai: merged in place ─────────────────────────────────────────────

test('on arena.ai the profile is merged into the very same config object', () => {
  const ctx = loadSite('arena.ai');
  assert.equal(ctx.__sdSite.id, 'arena');

  const cfg = builtinConfig();
  const out = ctx.__sdProfile(cfg);
  assert.equal(out, cfg, 'the merge must be in place, so direct readers see it');

  // Composer / send / stop / messages — the Phase 3 anchor set.
  // (Spread into host arrays: merged values come from sd-site.js's vm realm.)
  assert.deepEqual([...cfg.selectors.chatInput.textarea], [
    'textarea[name="message"]', 'form textarea[name="message"]', 'form textarea', 'textarea[placeholder]',
  ], 'arrays replace, they are never concatenated with the DeepSeek ones');
  assert.deepEqual([...cfg.selectors.sendButton.selectors], ['button[aria-label="Send message"]', 'button']);
  assert.deepEqual([...cfg.selectors.message.containers], [
    'main ol.flex-col-reverse', 'ol.flex-col-reverse', 'ol.mt-8.flex', 'ol.mt-8',
  ]);
  assert.equal(cfg.selectors.codeBlock.container, "[data-code-block='true']");

  // API + URLs.
  // Direct Chat's own evaluation endpoints — NOT Agent mode's create-chat.
  assert.deepEqual([...cfg.api.chatCompletionPaths], [
    '/nextjs-api/stream/create-evaluation', '/nextjs-api/stream/post-to-evaluation/',
  ]);
  assert.equal(cfg.api.statusUrl, '');
  assert.equal(cfg.urlPatterns.chatSession, '/c/');
  assert.equal(cfg.urlPatterns.base, 'https://arena.ai/');
});

test('the arena merge keeps every built-in key it does not override', () => {
  const ctx = loadSite('arena.ai');
  const before = builtinConfig();
  const keepers = {
    previewPanel: before.selectors.previewPanel,
    renameInput: before.selectors.renameInput,
    modelBadge: before.selectors.modelBadge,
    codeBlockBanner: before.selectors.codeBlock.banner,
    remoteConfig: structuredClone(before.remoteConfig),
    contextGuard: structuredClone(before.features.deepResearch ?? {}),
  };
  ctx.__sdProfile(before);
  assert.equal(before.selectors.previewPanel, keepers.previewPanel);
  assert.equal(before.selectors.renameInput, keepers.renameInput);
  assert.equal(before.selectors.modelBadge, keepers.modelBadge);
  // Phase 3 does override the file input: arena's attach input is not
  // necessarily [multiple], and the arena selector is a superset of DeepSeek's.
  assert.equal(before.selectors.fileInput, 'input[type="file"]');
  assert.equal(before.selectors.codeBlock.banner, keepers.codeBlockBanner);
  assert.deepEqual(before.remoteConfig, keepers.remoteConfig);
  assert.deepEqual(before.features.deepResearch ?? {}, keepers.contextGuard);
  // Top-level groups survive; nothing is dropped by the merge.
  assert.deepEqual(Object.keys(before).sort(), [
    'android', 'api', 'embeddedPricing', 'features', 'modelDetection', 'modelInputLimits',
    'modelMappings', 'remoteConfig', 'selectors', 'urlPatterns',
  ]);
});

// ── 4. The engine's own UI is untouchable ────────────────────────────────────

test('no profile reshapes the "+" attach sheet or the Advanced settings entry', () => {
  const arena = loadSite('arena.ai').__sdSite.profile;

  // The card set of the attach sheet and the sidebar menu injector are the two
  // surfaces the owner pinned: a profile must not mention them at all.
  assert.equal(arena.features.attachMenu, undefined, 'the "+" sheet card set must stay as shipped');
  assert.equal(arena.features.sideBarMenuInjector, undefined, 'the Advanced settings injector must stay on');
  assert.equal(arena.features.questionPanel, undefined);
  assert.equal(arena.features.export, undefined);
  assert.equal(arena.features.rag, undefined);
  assert.equal(arena.features.codeRunner, undefined);
  assert.equal(arena.features.tagManager, undefined);

  const cfg = builtinConfig();
  const attachBefore = structuredClone(cfg.features.attachMenu);
  const injectorBefore = structuredClone(cfg.features.sideBarMenuInjector);
  loadSite('arena.ai').__sdProfile(cfg);
  assert.deepEqual(cfg.features.attachMenu, attachBefore, 'merged config keeps the shipped attach menu');
  assert.deepEqual(cfg.features.sideBarMenuInjector, injectorBefore);
});

test('arena only switches off features that talk to DeepSeek services', () => {
  const arena = loadSite('arena.ai').__sdSite.profile;
  const off = Object.entries(arena.features)
    .filter(([, v]) => v && v.enabled === false)
    .map(([k]) => k)
    .sort();
  assert.deepEqual(off, ['apiPlayground', 'statusMonitor', 'tokenPriceDisplay', 'whatsNewPopup']);
});

// ── 5. Injection order (native + harness agree) ──────────────────────────────

test('sd-site.js is injected before injected.js and content.js everywhere', () => {
  const kotlin = MAIN_ACTIVITY.indexOf('readAsset("sd-site.js")');
  const injected = MAIN_ACTIVITY.indexOf('readAsset("injected.js")');
  const content = MAIN_ACTIVITY.indexOf('readAsset("content.js")');
  assert.ok(kotlin > 0, 'MainActivity must read sd-site.js');
  assert.ok(kotlin < injected, 'sd-site.js must be read before injected.js');
  assert.ok(injected < content, 'injected.js must be read before content.js');

  const seq = HARNESS.slice(HARNESS.indexOf('export const ENGINE_SEQUENCE'));
  const files = [...seq.matchAll(/file: '([a-z.-]+)'/g)].map((m) => m[1]);
  assert.equal(files[0], 'sd-site.js', 'the harness must load the engine in MainActivity order');
  assert.deepEqual(files.slice(0, 5), ['sd-site.js', 'injected.js', 'content.css', 'our-skin.css', 'content.js']);
});
