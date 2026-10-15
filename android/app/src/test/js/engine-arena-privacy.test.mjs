import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../../main/bds-assets/bds/', import.meta.url);
const content = fs.readFileSync(new URL('content.js', dir), 'utf8');
const site = fs.readFileSync(new URL('sd-site.js', dir), 'utf8');
const migration = content.slice(content.indexOf('async function sdsArenaPrivacyMigration('), content.indexOf('async function sdsRebrandStored('));

// Roadmap 3 (docs/arena/ROADMAP-3-BN.md), owner decision of 2026-10-14:
// app instructions are ON by default (the app's tools need them) and stored
// memory is OFF by default. Migration v2 therefore (a) moves instructions back
// to the new default — a v1 install never chose "off", v1 forced it — while
// (b) keeping whatever a user explicitly stored for memory, and never deletes
// anything. A stored v2 marker means the migration never runs twice.
test('fresh settings land on the v2 defaults; v1 installs keep their memory choice', async () => {
  const cases = [
    // [label, settings in, expected disableSystemPrompt, expected disableMemory]
    ['fresh install', {}, false, true],
    ['v1 both forced off', { disableSystemPrompt: true, disableMemory: true, customSystemPrompts: [{ content: 'mine' }] }, false, true],
    ['v1 user opted into memory', { disableSystemPrompt: true, disableMemory: false }, false, false],
  ];
  for (const [label, settings, wantPrompt, wantMemory] of cases) {
    const original = JSON.stringify(settings.customSystemPrompts);
    const writes = [];
    const ctx = vm.createContext({ B: { settings }, sdsIsArena: () => true, st: { settings: 'bds_settings' },
      chrome: { storage: { local: { set: async (v) => writes.push(JSON.stringify(v)) } } } });
    await vm.runInContext(migration + ';sdsArenaPrivacyMigration()', ctx);
    assert.equal(settings.disableSystemPrompt, wantPrompt, `${label}: instructions default`);
    assert.equal(settings.disableMemory, wantMemory, `${label}: memory default`);
    assert.equal(settings.arenaPrivacyVersion, 2, `${label}: version marker`);
    assert.equal(JSON.stringify(settings.customSystemPrompts), original, `${label}: nothing is deleted`);
    // a reload (version already 2) must not override anything, nor write again
    settings.disableSystemPrompt = true;
    await vm.runInContext('sdsArenaPrivacyMigration()', ctx);
    assert.equal(settings.disableSystemPrompt, true, `${label}: reload keeps a new explicit opt-out`);
    assert.equal(writes.length, 1, `${label}: exactly one storage write`);
  }
});

test('DeepSeek settings are untouched by Arena migration', async () => {
  const settings = { disableSystemPrompt: false, disableMemory: false };
  const ctx = vm.createContext({ B: { settings }, sdsIsArena: () => false });
  await vm.runInContext(migration + ';sdsArenaPrivacyMigration()', ctx);
  assert.deepEqual(settings, { disableSystemPrompt: false, disableMemory: false });
});

test('Arena default prompt is model-neutral, self-aware and honest about the new privacy defaults', () => {
  const ctx = vm.createContext({ window: {}, location: { host: 'arena.ai' } });
  vm.runInContext(site, ctx);
  const prompt = ctx.window.__sdSite.arenaPrompt;
  assert.match(prompt, /ArenaPilot/);
  assert.match(prompt, /not your model identity/);
  assert.match(prompt, /ABOUT ARENAPILOT/);
  assert.match(prompt, /third-party Android client/);
  assert.match(prompt, /say you do not know rather than guessing/);
  assert.match(prompt, /SDS:VISUALIZER/);
  assert.match(prompt, /SDS:AUTO:MCP/);
  assert.match(prompt, /Wait for their results/);
  // privacy wording matches the shipped behaviour: instructions on and sent
  // with the first message, memory a separate off-by-default opt-in
  assert.match(prompt, /sent with the first message of each conversation/);
  assert.match(prompt, /Stored memory is a separate opt-in and is off by default/);
  assert.doesNotMatch(prompt, /You are Super DeepSeek|built on DeepSeek|IS available to you|App instructions and stored memory are separate opt-ins and off by default/);
  assert.ok(content.includes('du=sdsIsArena()?window.__sdSite.arenaPrompt:sdsLegacyPrompt'));
  // engine defaults: instructions ON for everyone, memory OFF only in Arena
  assert.ok(content.includes('disableSystemPrompt:!1,disableMemory:sdsIsArena()'));
});

test('injected.js normalizes undefined Arena flags to the same v2 defaults', () => {
  const injected = fs.readFileSync(new URL('injected.js', dir), 'utf8');
  assert.ok(injected.includes(
    'disableSystemPrompt:sdsArenaPage()?e.disableSystemPrompt===true:!!e.disableSystemPrompt,' +
    'disableMemory:sdsArenaPage()?e.disableMemory!==false:!!e.disableMemory'));
});
