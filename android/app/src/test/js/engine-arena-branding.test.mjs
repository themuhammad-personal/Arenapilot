// ArenaPilot branding — the single app's identity resources and its
// independence notice.
//
// Since the 2026-10-15 cleanup this repository builds ONE app: ArenaPilot
// (com.arenadeck.app). The old Super DeepSeek/ArenaPilot product-flavor split
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

const ARENA_NOTICE = path.join(MAIN_JAVA, 'com', 'superdeepseek', 'app', 'IndependenceNotice.kt');

test('ArenaPilot’s notice is shown once, never nags, and cannot crash the launch', () => {
  const kt = read(ARENA_NOTICE);
  assert.match(kt, /^package com\.superdeepseek\.app$/m);
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
  const main = read(MAIN_JAVA, 'com', 'superdeepseek', 'app', 'MainActivity.kt');
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
