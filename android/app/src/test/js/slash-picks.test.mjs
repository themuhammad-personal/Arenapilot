// /persona, /skill and /mcp: pick a persona, toggle a skill or an MCP server from the "/"
// popup. The helpers are cut out of the shipped content.js and run against a stubbed store, so
// this exercises the real code: what is toggled, what is persisted and what the popup lists.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const content = fs.readFileSync(new URL('../../main/bds-assets/bds/content.js', import.meta.url), 'utf8');
const a = content.indexOf('function sdSlashKinds()');
const b = content.indexOf('/* Slash commands page.');
assert.ok(a > 0 && b > a, 'slash-pick helpers not found in content.js');
const helpers = content.slice(a, b);

function make({ characters = [], skills = [], mcpServers = [] } = {}) {
  const saved = {};
  const toasts = [];
  const B = {
    characters, skills, mcpServers,
    ui: { showToast: (m) => toasts.push(m) },
  };
  const st = { characters: 'k_characters', skills: 'k_skills', mcpServers: 'k_mcp' };
  const chrome = { storage: { local: { set: async (o) => Object.assign(saved, JSON.parse(JSON.stringify(o))) } } };
  const sdT = (en) => en;
  const api = new Function('B', 'st', 'chrome', 'sdT',
    `${helpers}; return {sdSlashExtra, sdSlashDynamic, sdSlashRun, sdSlashList};`)(B, st, chrome, sdT);
  return { B, saved, toasts, api };
}

const chars = () => [
  { id: 'c1', name: 'Coder', content: 'x', active: true },
  { id: 'c2', name: 'Teacher', content: 'y', active: false },
];

test('the three commands are registered with a description, usage and icon', () => {
  const { api } = make();
  const extra = api.sdSlashExtra();
  assert.deepEqual(extra.map((c) => c.id), ['persona', 'skill', 'mcp']);
  for (const c of extra) {
    assert.ok(c.description && c.descKey && c.usage.startsWith('/' + c.id));
    assert.match(c.icon, /^<svg[\s\S]*<\/svg>$/);
    assert.equal(c.category, 'tools');
  }
});

test('/persona <name> activates exactly that persona and persists it', async () => {
  const { B, saved, api, toasts } = make({ characters: chars() });
  await api.sdSlashRun('persona', 'teach');
  assert.deepEqual(B.characters.map((c) => c.active), [false, true]);
  assert.deepEqual(saved.k_characters.map((c) => c.active), [false, true]);
  assert.match(toasts.at(-1), /Teacher/);
});

test('/persona off clears the active persona', async () => {
  const { B, saved, api } = make({ characters: chars() });
  await api.sdSlashRun('persona', 'off');
  assert.ok(B.characters.every((c) => !c.active));
  assert.ok(saved.k_characters.every((c) => !c.active));
});

test('/skill <name> toggles that skill only', async () => {
  const skills = [{ id: 's1', name: 'Reviewer', active: true }, { id: 's2', name: 'Writer', active: false }];
  const { B, saved, api } = make({ skills });
  await api.sdSlashRun('skill', '"Reviewer"');
  assert.deepEqual(B.skills.map((s) => s.active), [false, false]);
  await api.sdSlashRun('skill', 'writer');
  assert.deepEqual(saved.k_skills.map((s) => s.active), [false, true]);
});

test('/mcp <name> flips enabled and keeps the server definition', async () => {
  const mcp = [{ id: 'm1', name: 'Docs', serverUrl: 'https://example.com/mcp', enabled: true, tools: [] }];
  const { B, saved, api } = make({ mcpServers: mcp });
  await api.sdSlashRun('mcp', 'docs');
  assert.equal(B.mcpServers[0].enabled, false);
  assert.equal(saved.k_mcp[0].enabled, false);
  assert.equal(saved.k_mcp[0].serverUrl, 'https://example.com/mcp');
  await api.sdSlashRun('mcp', 'docs');
  assert.equal(saved.k_mcp[0].enabled, true);
});

test('no argument lists the items; unknown names and empty lists say so, nothing is saved', async () => {
  const { saved, api, toasts } = make({ characters: chars() });
  await api.sdSlashRun('persona', '');
  assert.match(toasts.at(-1), /● Coder/);
  assert.match(toasts.at(-1), /○ Teacher/);
  await api.sdSlashRun('persona', 'nobody');
  assert.match(toasts.at(-1), /Not found/);
  const empty = make();
  await empty.api.sdSlashRun('skill', 'x');
  assert.match(empty.toasts.at(-1), /Nothing to pick yet/);
  assert.deepEqual(saved, {});
  assert.deepEqual(empty.saved, {});
});

test('the popup lists real items for /per, /sk, /mc and nothing for a bare "/"', () => {
  const { api } = make({
    characters: chars(),
    skills: [{ id: 's1', name: 'Reviewer', active: true }],
    mcpServers: [{ id: 'm1', name: 'Docs', enabled: false }],
  });
  assert.deepEqual(api.sdSlashDynamic(''), []);
  const per = api.sdSlashDynamic('per');
  assert.deepEqual(per.map((c) => c.id), ['persona "Coder"', 'persona "Teacher"']);
  assert.match(per[0].descKey, /Coder · On/);
  assert.match(per[1].descKey, /Teacher · Off/);
  assert.deepEqual(api.sdSlashDynamic('sk').map((c) => c.id), ['skill "Reviewer"']);
  assert.match(api.sdSlashDynamic('mc')[0].descKey, /Docs · Off/);
  assert.deepEqual(api.sdSlashDynamic('revi').map((c) => c.id), ['skill "Reviewer"']);
});

test('the engine wires the commands into the registry, the dispatcher and the popup', () => {
  assert.ok(content.includes(',minArgs:0},...sdSlashExtra()];function _me('));
  assert.ok(content.includes('case"persona":case"skill":case"mcp":await sdSlashRun(e.id,n||t.join(" "))'));
  assert.ok(content.includes('...sdSlashDynamic(E).map('));
});

test('the registry can be built at load time, before the helper block has run', () => {
  // `var`s below the registry are still undefined while the script loads; only hoisted
  // function declarations are available. This is what crashed the first CI run.
  const registryAt = content.indexOf(',...sdSlashExtra()];function _me(');
  const helperAt = content.indexOf('function sdSlashKinds()');
  assert.ok(registryAt > 0 && helperAt > registryAt, 'helpers are declared after the registry');
  assert.doesNotMatch(content.slice(helperAt, content.indexOf('function sdSlashSvg')), /^var /m);
  assert.equal(make().api.sdSlashExtra().length, 3);
});
