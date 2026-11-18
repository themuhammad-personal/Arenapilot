import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const src = fs.readFileSync(new URL('../../main/bds-assets/bds/content.js', import.meta.url), 'utf8');

function slice(start, end) {
  const i = src.indexOf(start);
  const j = src.indexOf(end, i);
  assert.ok(i >= 0 && j > i, `missing slice: ${start}`);
  return src.slice(i, j);
}

const code =
  slice('function sdNormalizeModes(', 'function H6(') +
  slice('function Nme(', 'function QQ(') +
  slice('let sdConfigRevision=', 'function Lme(');

function boot(store = {}) {
  let seq = 0;
  const events = [];
  const toasts = [];
  const seen = new Set();
  const c = {
    B: {
      projects: [],
      projectFiles: [],
      settings: { disableSystemPrompt: false },
      memories: {},
      characters: [],
      skills: [],
      mcpServers: [],
      deepResearch: {},
      deepCode: {},
      ui: {
        refreshCharacters() {},
        refreshSkills() {},
        showToast: (m) => toasts.push(m),
      },
    },
    location: { pathname: '/text/direct' },
    sdsIsArena: () => true,
    sdsArenaDirect: () => true,
    Us: () => `id_${++seq}`,
    I: (k, p) => (p && p.name ? `${k}:${p.name}` : k),
    Ny: () => null,
    cge: () => [],
    fA: () => [],
    sdVisibleMemories: () => [],
    st: {
      characters: 'bds_characters',
      skills: 'bds_skills',
    },
    chrome: {
      storage: {
        local: {
          set: async (obj) => Object.assign(store, JSON.parse(JSON.stringify(obj))),
        },
      },
    },
    window: {
      setTimeout,
      clearTimeout,
      __sdSite: { arenaModality: () => 'chat' },
      dispatchEvent: (e) => { if (e.detail) events.push(JSON.parse(e.detail)); },
    },
    CustomEvent,
    sdT: (a) => a,
    du: 'fixture',
    BA: { configUpdate: 'cfg' },
    M_e: () => '',
    UD: () => [],
    m1: async () => [],
    sdSeen: (m, kind, key) => {
      const k = `${m}|${kind}|${JSON.stringify(key)}`;
      if (seen.has(k)) return true;
      seen.add(k);
      return false;
    },
  };
  vm.createContext(c);
  vm.runInContext(code, c);
  c.B.characters = c.jme(store.bds_characters);
  c.B.skills = c.Nme(store.bds_skills);
  return { c, store, events, toasts };
}

test('jme normalizes multiple active personas down to one and preserves mode availability', () => {
  const { c } = boot({
    bds_characters: [
      { id: 'c1', name: 'First', content: 'A', active: true, modes: ['chat', 'invalid'] },
      { id: 'c2', name: 'Second', content: 'B', active: true, modes: ['webdev'] },
      { id: 'c3', name: 'AllModes', content: 'C', active: false, modes: ['chat', 'search', 'webdev'] },
    ],
  });
  assert.deepEqual(c.B.characters.map((x) => x.active), [true, false, false]);
  assert.deepEqual(Array.from(c.B.characters[0].modes), ['chat']);
  assert.deepEqual(Array.from(c.B.characters[1].modes), ['webdev']);
  assert.equal(c.B.characters[2].modes, null, 'all 3 valid modes normalize to null (all text-capable modes)');
});

test('Nme preserves skill usage + modes and Lr ships them in configUpdate', async () => {
  const { c, events } = boot({
    bds_skills: [
      { id: 's1', name: 'SQL', usage: 'sql, postgres', modes: ['webdev', 'chat'], content: 'Use indexes', active: true },
      { id: 's2', name: 'Off', usage: 'hidden', modes: ['search'], content: 'Hidden', active: false },
    ],
    bds_characters: [
      { id: 'p1', name: 'Reviewer', usage: 'strict code review', modes: ['webdev'], content: 'Be thorough.', active: true },
    ],
  });
  await c.Lr();
  const cfg = events.at(-1);
  assert.equal(cfg.skills.length, 1);
  assert.equal(cfg.skills[0].usage, 'sql, postgres');
  assert.deepEqual(Array.from(cfg.skills[0].modes), ['chat', 'webdev']);
  assert.equal(cfg.activeCharacter.name, 'Reviewer');
  assert.equal(cfg.activeCharacter.usage, 'strict code review');
  assert.deepEqual(Array.from(cfg.activeCharacter.modes), ['webdev']);
});

test('Txe and Dxe parse modes, enforce single active persona, and emit feedback', async () => {
  const { c, store, toasts } = boot();
  await c.Txe([{ name: 'Architect', usage: 'design', modes: 'chat, webdev', content: 'Design cleanly.' }]);
  await c.Dxe([{ name: 'Perf', usage: 'latency, profiling', modes: 'webdev', content: 'Measure first.' }]);
  assert.equal(c.B.characters.length, 1);
  assert.equal(c.B.characters[0].active, true);
  assert.deepEqual(Array.from(c.B.characters[0].modes), ['chat', 'webdev']);
  assert.equal(c.B.skills.length, 1);
  assert.deepEqual(Array.from(c.B.skills[0].modes), ['webdev']);
  assert.equal(toasts.length, 2);

  await c.Txe([{ name: 'Editor', usage: 'prose', modes: 'chat', content: 'Edit crisply.' }]);
  assert.deepEqual(Array.from(c.B.characters, (x) => [x.name, x.active]), [['Architect', false], ['Editor', true]]);
  await new Promise((r) => setTimeout(r, 350));
  assert.equal(store.bds_characters.length, 2);
  assert.equal(store.bds_skills.length, 1);
});

test('Ghe gates <APH:character_create> and <APH:skill_create> to settled live Direct assistant turns', () => {
  const i = src.indexOf('if(l==="assistant"&&u&&sdMayAuto(e,t,n)');
  assert.ok(i > 0, 'Ghe gate present');
  const gate = src.slice(i, i + 450);
  assert.match(gate, /l==="assistant"/);
  assert.match(gate, /sdMayAuto\(e,t,n\)/);
  assert.match(gate, /sdsArenaDirect\(\)&&!B\.settings\.disableSystemPrompt/);
  assert.match(gate, /h&&!Wu\(\)/);
  assert.match(gate, /sdSeen\(k,"char_create",x\)/);
  assert.match(gate, /sdSeen\(k,"skill_create",x\)/);
});
