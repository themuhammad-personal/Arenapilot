// The ArenaPilot design system: every engine surface takes its colours from Arena's own
// tokens, every setting has its own glyph, nothing pops up to announce updates, and the
// controls give haptic feedback. These run against the shipped files, not copies.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('../../main/bds-assets/bds/', import.meta.url);
const css = fs.readFileSync(new URL('content.css', dir), 'utf8');
const content = fs.readFileSync(new URL('content.js', dir), 'utf8');
const sheets = fs.readFileSync(new URL('sd-sheets.js', dir), 'utf8');
const health = fs.readFileSync(new URL('sd-health.js', dir), 'utf8');
const kt = (f) => fs.readFileSync(new URL(`../../main/java/com/arenadeck/app/${f}`, import.meta.url), 'utf8');

test('colour roles resolve to Arena\'s own page tokens, light and dark', () => {
  for (const role of ['--bds-bg-panel', '--bds-bg-elevated', '--bds-border', '--bds-text-primary', '--bds-text-secondary']) {
    const rx = new RegExp(`${role}:hsl\\(var\\(--(surface|border|text)-[a-z-]+,`, 'g');
    assert.ok((css.match(rx) || []).length >= 2, `${role} is defined from Arena tokens in light and in dark`);
  }
  assert.match(css, /html\.dark,body\.dark,\.dark :root\{/);
});

test('the old navy/cyan palette is gone from the engine stylesheet', () => {
  for (const legacy of ['#0f1422', '#171d2e', '--ap-grad', '--ap-cyan', '#4d6bfe', '#5b7bff']) {
    assert.ok(!css.includes(legacy), `${legacy} must not come back`);
  }
});

test('type, space, radius, motion and layer tokens exist and are used', () => {
  for (const t of ['--sd-r-md', '--sd-s-4', '--sd-fs-md', '--sd-dur-2', '--sd-ease', '--sd-touch', '--sd-z-drawer']) {
    assert.ok(css.includes(`${t}:`), `${t} is defined`);
    assert.ok(css.split(`var(${t}`).length > 1, `${t} is used`);
  }
});

test('touch targets are at least 48dp and reduced motion is respected', () => {
  assert.match(css, /--sd-touch:48px/);
  assert.match(css, /@media \(prefers-reduced-motion:reduce\)\{[^}]*#bds-drawer \*/);
  assert.match(css, /prefers-reduced-transparency/);
});

test('every Advanced-settings control id has its own glyph, and no two share one', () => {
  const ids = [...css.matchAll(/:has\(#bds-([a-z-]+)\)\{--sd-ico:url\("data:image\/svg\+xml,([^"]+)"\)/g)];
  assert.ok(ids.length >= 20, 'per-setting glyph rules exist');
  assert.equal(new Set(ids.map((m) => m[2])).size, ids.length, 'glyphs are unique');
  for (const id of ['disable-memory', 'disable-prompt', 'context-guard-enabled', 'inject-datetime', 'voice-mode', 'auto-zip']) {
    assert.ok(ids.some((m) => m[1] === id), `${id} has a glyph`);
    assert.ok(content.includes(`id="bds-${id}"`), `${id} is a real control in the settings page`);
  }
  assert.doesNotMatch(css, /url\(["']?https?:/, 'no network assets');
});

test('overview rows use distinct icons, including "Continue interrupted replies"', () => {
  assert.ok(content.includes('key:"agentContinue",icon:"continue"'));
  assert.ok(content.includes("\ncontinue:'<polyline"));
});

test('no update or health pop-up exists in the app or the engine', () => {
  const main = kt('MainActivity.kt');
  assert.ok(!/showUpdateDialog|maybeCheckForUpdate|downloadAndInstallUpdate/.test(main));
  assert.ok(!/createElement\('div'\);\s*el\.id = 'sd-health-notice'/.test(health));
  assert.ok(!/old\.className = 'bds-mode-notice'/.test(health));
  for (const loc of ['values', 'values-bn', 'values-fa', 'values-ru', 'values-tr', 'values-zh-rCN']) {
    const s = fs.readFileSync(new URL(`../../main/res/${loc}/strings.xml`, import.meta.url), 'utf8');
    assert.ok(!/bds_update_/.test(s), `${loc}: update strings are gone`);
  }
});

test('engine-owned controls tick through the native haptic bridge', () => {
  assert.match(sheets, /function installHaptics\(\)/);
  assert.match(sheets, /performHaptic\('tick'\)/);
  assert.match(sheets, /installHaptics\(\);\s*install\(\);/);
});

test('the model is introduced without naming a single mode', () => {
  const site = fs.readFileSync(new URL('sd-site.js', dir), 'utf8');
  const prompt = site.split('var ARENA_PROMPT')[1].split('].join')[0];
  assert.ok(!/Direct Chat/.test(prompt));
  assert.match(prompt, /an independent Android client for arena\.ai\./);
});
