// ArenaPilot branding — the single app's identity resources and its
// independence notice.
//
// Since the 2026-10-15 cleanup this repository builds ONE app: ArenaPilot
// (com.arenadeck.app). The old ArenaPilot/ArenaPilot product-flavor split
// is gone — the launcher art, the brand strings and the notice now live in the
// single `main` source set. These tests pin that identity:
//   * the app's name, boot title and launcher art;
//   * every ArenaPilot build carries a "not affiliated with arena.ai" notice;
//   * no flavor source set ever comes back.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, '../../main/..'); // android/app/src
const ARENA_RES = path.join(SRC, 'main', 'res');
const MAIN_JAVA = path.join(SRC, 'main', 'java');

const read = (...p) => fs.readFileSync(path.join(...p), 'utf8');

function walk(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, base));
    else out.push(path.relative(base, full).split(path.sep).join('/'));
  }
  return out.sort();
}

/** width, height and PNG colour type (2 = RGB, 6 = RGBA) from the IHDR chunk. */
function png(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.subarray(1, 4).toString('ascii'), 'PNG', `${file} is not a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20), colorType: b[25] };
}

const DENSITIES = { mdpi: 108, hdpi: 162, xhdpi: 216, xxhdpi: 324, xxxhdpi: 432 };

// ── 1. the flavor system is gone ────────────────────────────────────────────

test('the product-flavor source sets are gone — one app, one source set', () => {
  assert.ok(!fs.existsSync(path.join(SRC, 'arenaDeck')), 'src/arenaDeck must not come back');
  assert.ok(!fs.existsSync(path.join(SRC, 'deepseek')), 'src/deepseek must not come back');
  const gradle = read(path.resolve(here, '../../../build.gradle.kts'));
  assert.ok(!/productFlavors\s*\{/.test(gradle), 'no productFlavors block in app/build.gradle.kts');
  assert.match(gradle, /applicationId\s*=\s*"com\.arenadeck\.app"/, 'the single app id');
});

// ── 2. the launcher art ─────────────────────────────────────────────────────

test('the launcher art has the right size and transparency for every density', () => {
  for (const [density, px] of Object.entries(DENSITIES)) {
    const info = png(path.join(ARENA_RES, `mipmap-${density}`, 'ic_launcher_foreground.png'));
    assert.deepEqual([info.width, info.height], [px, px], `${density}: 108dp canvas = ${px}px`);
    assert.equal(info.colorType, 6, `${density}: the adaptive foreground must be transparent (RGBA)`);
  }
  const boot = png(path.join(ARENA_RES, 'drawable-nodpi', 'app_icon.png'));
  assert.deepEqual([boot.width, boot.height], [512, 512]);
  assert.equal(boot.colorType, 2,
    'the boot-screen icon is a full-bleed OPAQUE square: BootScreenView clips it to its own rounded tile');
});

test('the adaptive icon points at the foreground and backdrop the art overrides', () => {
  for (const file of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    const xml = read(ARENA_RES, 'mipmap-anydpi', file);
    assert.ok(xml.includes('@mipmap/ic_launcher_foreground'), `${file}: foreground name changed — the art would be dead`);
    assert.ok(xml.includes('@color/launcher_background'), `${file}: backdrop name changed — the override would be dead`);
  }
  assert.ok(read(ARENA_RES, 'values', 'colors.xml').includes('name="launcher_background"'),
    'the backdrop colour must exist to be referenced');
});

test('the generator and the committed backdrop colour agree', () => {
  const script = read(path.resolve(here, '../../../../../tools/icon/arena_deck_icon.py'));
  const fromScript = /LAUNCHER_BACKGROUND\s*=\s*"(#[0-9A-Fa-f]{6})"/.exec(script);
  assert.ok(fromScript, 'tools/icon/arena_deck_icon.py must define LAUNCHER_BACKGROUND');
  const fromXml = /<color name="launcher_background">(#[0-9A-Fa-f]{6})<\/color>/.exec(read(ARENA_RES, 'values', 'colors.xml'));
  assert.equal(fromXml[1].toUpperCase(), fromScript[1].toUpperCase(),
    'regenerate with: python3 tools/icon/arena_deck_icon.py');
});

// ── 3. strings ──────────────────────────────────────────────────────────────

test('the brand strings are the name, the boot title and the notice', () => {
  const xml = read(ARENA_RES, 'values', 'strings.xml');
  const get = (name) => new RegExp(`<string\\s+name="${name}"[^>]*>([\\s\\S]*?)<\\/string>`).exec(xml);
  assert.equal(get('app_name')[1], 'ArenaPilot');
  assert.equal(get('bds_boot_title')[1], 'ArenaPilot');
  for (const name of ['app_name', 'bds_boot_title', 'arena_notice_title', 'arena_notice_message', 'arena_notice_ok']) {
    assert.match(get(name)[0], /translatable="false"/, `${name} must be translatable="false"`);
  }
});

test('the notice says what the owner required, in English and Bengali', () => {
  const xml = read(ARENA_RES, 'values', 'strings.xml');
  const message = /<string name="arena_notice_message"[^>]*>([\s\S]*?)<\/string>/.exec(xml)[1];
  assert.match(message, /not affiliated with, endorsed by or sponsored by arena\.ai/);
  assert.match(message, /own terms and privacy policy/, 'arena.ai stays the party the user agrees terms with');
  assert.match(message, /[\u0980-\u09FF]/, 'a Bengali line is part of the notice');
  assert.match(message, /arena\.ai-এর সঙ্গে এর কোনো সম্পর্ক নেই/);
  assert.ok(!/official app/i.test(message.replace(/unofficial app/gi, '')), 'it must never read as an official app');
});

test('the notice discloses what the engine sends, and quotes the real setting labels', () => {
  const xml = read(ARENA_RES, 'values', 'strings.xml');
  const message = /<string name="arena_notice_message"[^>]*>([\s\S]*?)<\/string>/.exec(xml)[1];
  // the v2 data flow, in both languages: instructions ON by default (the
  // app's tools need them), memory a separate OFF-by-default opt-in
  assert.match(message, /app instructions are ON by default/);
  assert.match(message, /Stored memory stays OFF by default/);
  assert.match(message, /skills, characters, projects and tool definitions/);
  assert.match(message, /sent to arena\.ai and to the provider of the model you picked/);
  assert.match(message, /নির্দেশনা ডিফল্টে চালু/);
  assert.match(message, /মেমোরি ডিফল্টে বন্ধ/);
  assert.match(message, /প্রদানকারীর কাছে/);
  // …and the two switches it points at must be words the engine really shows,
  // with directions that now match the defaults (ON stops, OFF shares)
  assert.match(message, /turn ON “Disable Hidden System Prompt” to stop sharing/);
  assert.match(message, /Turn OFF “Disable Stored Memory Injection” separately to share memories/);
  const engine = fs.readFileSync(path.join(SRC, 'main', 'bds-assets', 'bds', 'content.js'), 'utf8');
  for (const [key, label] of [['disableSystemPrompt', 'Disable Hidden System Prompt'], ['disableMemory', 'Disable Stored Memory Injection']]) {
    assert.ok(message.includes(`“${label}”`), `the notice quotes “${label}”`);
    assert.ok(engine.includes(`"${key}":"${label}"`), `…and the engine's English locale says exactly that for ${key}`);
  }
});

// ── 4. the notice itself ────────────────────────────────────────────────────

const ARENA_NOTICE = path.join(MAIN_JAVA, 'com', 'arenadeck', 'app', 'IndependenceNotice.kt');

test('ArenaPilot’s notice is shown once, never nags, and cannot crash the launch', () => {
  const kt = read(ARENA_NOTICE);
  assert.match(kt, /^package com\.arenadeck\.app$/m);
  assert.match(kt, /internal object IndependenceNotice/);
  assert.match(kt, /fun maybeShow\(activity: Activity\)/);
  assert.ok(kt.includes('R.string.arena_notice_title'));
  assert.ok(kt.includes('R.string.arena_notice_message'));
  assert.ok(kt.includes('R.string.arena_notice_ok'));
  assert.ok(kt.includes('.setCancelable(false)'), 'it needs an explicit acknowledgement');
  assert.ok(kt.includes('.setOnDismissListener'), '“seen” is recorded on dismissal, not on show');
  assert.ok(kt.includes('prefs.getBoolean(KEY_SEEN, false)'), 'once only');
  assert.ok(kt.includes('runCatching'), 'a failing dialog must not take the launch down');
  assert.ok(kt.includes('if (showing || activity.isFinishing || activity.isDestroyed) return'),
    'no stacked dialogs, none on a dying activity');
  // the flag is written only inside the dismiss listener
  assert.equal(kt.split('putBoolean(KEY_SEEN, true)').length - 1, 1);
  const dismiss = kt.indexOf('.setOnDismissListener');
  assert.ok(kt.indexOf('putBoolean(KEY_SEEN, true)') > dismiss, 'written after the dismiss listener opens');
});

test('MainActivity shows it after the launch screen, and no other code touches it', () => {
  const main = read(MAIN_JAVA, 'com', 'arenadeck', 'app', 'MainActivity.kt');
  assert.equal(main.split('IndependenceNotice.maybeShow(').length - 1, 2);

  const exit = main.indexOf('view.onExitFinished = {');
  assert.ok(exit > 0);
  const closing = main.indexOf('bootView = view', exit);
  assert.ok(main.slice(exit, closing).includes('IndependenceNotice.maybeShow(this@MainActivity)'),
    'the call belongs to the end of the launch screen’s exit, once the page is visible');

  const dismiss = main.indexOf('private fun dismissBoot()');
  assert.ok(main.slice(dismiss, dismiss + 400).includes('IndependenceNotice.maybeShow(this)'),
    'and the no-overlay path');

  for (const file of walk(MAIN_JAVA)) {
    if (file.endsWith('MainActivity.kt') || file.endsWith('IndependenceNotice.kt')) continue;
    assert.ok(!read(MAIN_JAVA, file).includes('IndependenceNotice'), `${file} must not reference the notice`);
  }
});

// ── User-facing links point at the app that actually ships ──────────────────
// The bundle's "what's new" links, the issue links, the settings help links and
// the model's own prompt all named the previous repository. That repository is
// still public and still serves a `super-deepseek-latest.apk` — a DIFFERENT app
// — so every one of those links sent users to an installer that is not this app.

test('no user-facing link or prompt points at the retired repository', () => {
  const content = read(SRC, 'main', 'bds-assets', 'bds', 'content.js');
  const site = read(SRC, 'main', 'bds-assets', 'bds', 'sd-site.js');
  for (const [name, src] of [['content.js', content], ['sd-site.js', site]]) {
    assert.equal(
      (src.match(/themuhammad-personal\/Super-Deepseek-/g) || []).length,
      0,
      `${name} still links to the repo that publishes a different app`,
    );
  }
  const links = content.match(/https:\/\/github\.com\/themuhammad-personal\/[A-Za-z0-9_.-]+/g) || [];
  assert.ok(links.length > 0, 'the engine still links somewhere');
  for (const link of links) {
    assert.equal(
      link,
      'https://github.com/themuhammad-personal/Arenapilot',
      `an unexpected repository link remains: ${link}`,
    );
  }
});

// ── The app does not name the software it started from ──────────────────────
// Owner decision (2026-11-12): "remove the Super DeepSeek dependency and anything
// else outside this app". The old name had reached the Kotlin package, the theme,
// the sandbox shell profile, the engine's product strings, the tool-tag prefix the
// model is taught, and the prompt sent to the site. None of that is this app.

/** Files a user can see the output of: the shell, the theme, and the engine. */
function shippedSources() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(kt|xml|js|css)$/.test(entry.name)) out.push(full);
    }
  };
  walk(path.join(SRC, 'main'));
  return out.filter((f) => !f.includes(`${path.sep}assets${path.sep}`)); // staged copy of bds
}

const OLD_NAMES = [/Super DeepSeek/, /SuperDeepSeek/, /superdeepseek/, /Better ?DeepSeek/];
// The one-time migration has to be able to RECOGNISE old stored data, and the
// engine must still parse old tag prefixes; those two functions are the exception.
const EXEMPT = new Set(['sdsRebrandStored', 'pxe', 'RG', 'B']);

test('no shipped source names the old product (except the readers that must recognise it)', () => {
  const offenders = [];
  for (const file of shippedSources()) {
    if (file.endsWith('.jks')) continue;
    let src = fs.readFileSync(file, 'utf8');
    // drop the migration/reader functions: they exist to understand old data
    src = src
      .replace(/async function sdsRebrandStored\(\)\{[\s\S]*?\}function /, 'function ')
      .replace(/function (?:pxe|RG|B)\([\s\S]*?\nfunction /g, 'function ');
    for (const re of OLD_NAMES) {
      const hit = src.match(re);
      if (hit) offenders.push(`${path.relative(SRC, file)}: ${hit[0]}`);
    }
  }
  assert.deepEqual(offenders, [], 'the old product name is back in shipped code');
});

test('the package, theme and sandbox profile are ArenaPilot’s', () => {
  const manifest = read(SRC, 'main', 'AndroidManifest.xml');
  assert.doesNotMatch(manifest, /Theme\.SuperDeepSeek/);
  assert.match(manifest, /Theme\.ArenaPilot/);
  const gradle = read(SRC, '..', 'build.gradle.kts');
  assert.match(gradle, /namespace = "com\.arenadeck\.app"/);
  const sandbox = read(MAIN_JAVA, 'com', 'arenadeck', 'app', 'Sandbox.kt');
  assert.match(sandbox, /etc\/profile\.d\/arenapilot\.sh/);
});

test('the model is taught the prefix its own parser accepts', () => {
  const content = read(SRC, 'main', 'bds-assets', 'bds', 'content.js');
  const site = read(SRC, 'main', 'bds-assets', 'bds', 'sd-site.js');
  // The prompt the model reads must use APH:, and nothing may teach BDS:/SDS:.
  for (const [name, src] of [['content.js', content], ['sd-site.js', site]]) {
    const taught = (src.match(/<(?:APH|[BS]DS):[A-Za-z_]/g) || []);
    assert.ok(taught.length > 0, `${name} teaches no tags at all`);
    assert.ok(taught.every((t) => t.startsWith('<APH:')), `${name} still teaches ${taught.find((t) => !t.startsWith('<APH:'))}`);
  }
  // A tag written today must parse — the failure this test exists for was a
  // rename that taught APH: while the parser only knew [BS]DS.
  assert.match(content, /\(\?:APH\|\[BS\]DS\)/, 'the parser no longer accepts both prefixes');
});

// ── The model list, and why it is native ────────────────────────────────────
// The owner's screenshot: the site's model picker opens blank. The list is a
// release asset of THIS repo (models.json) plus a cache plus the copy in the APK.
test('the model list is served natively, from this repo, with three fallbacks', () => {
  const bridge = read(MAIN_JAVA, 'com', 'arenadeck', 'app', 'WebViewBridge.kt');
  const models = read(MAIN_JAVA, 'com', 'arenadeck', 'app', 'ModelList.kt');
  assert.match(bridge, /"bds-model-list"/, 'the page cannot ask for the list');
  assert.match(bridge, /"bds-model-list-cache"/, 'there is no offline path');
  assert.match(bridge, /"bds-model-list-capture"/, 'a good site response is never kept');
  // Three sources in order: download, cache, bundled.
  assert.match(bridge, /"remote"/);
  assert.match(bridge, /"cache"/);
  assert.match(bridge, /"bundled"/);
  // And the URL is this repository's release, not someone else's CDN.
  assert.match(models, /github\.com\/\$owner\/\$repo\/releases\/download/);
  assert.doesNotMatch(models, /cdn\.|jsdelivr|unpkg/);
});

test('the published list and the copy in the APK are the same file', () => {
  const repoRoot = path.resolve(SRC, '..', '..', '..'); // → the checkout root
  const staged = fs.readFileSync(path.join(repoRoot, 'models.json'), 'utf8');
  const published = JSON.parse(staged);
  assert.ok(Array.isArray(published.models) && published.models.length > 0, 'a shipped empty list is an empty picker');
  for (const m of published.models) {
    assert.ok(m.id && m.name, `model without id/name: ${JSON.stringify(m)}`);
  }
  // The build stages exactly this file; a second copy would drift.
  const gradle = read(SRC, '..', 'build.gradle.kts');
  assert.match(gradle, /from\(rootProject\.file\("\.\.\/models\.json"\)\)/);
});
