// Agentic playbook (v2.4.0).
//
// Direct Mode lets the owner pick the model, so the instruction block the app
// carries is where agentic behaviour is shaped. Grounded in the official
// guidance the plan cites (docs/PLAN.md section 3):
//   - OpenAI GPT-4.1 Prompting Guide: persistence, tool-calling, planning reminders
//   - Anthropic "Effective harnesses for long-running agents": progress files,
//     one verified step at a time, honest completion
// These tests prove the real sd-site.js carries each rule and that the Image
// modality still receives nothing (an image prompt must stay clean).
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-site.js'), 'utf8');

function load() {
  const win = { addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, console };
  const ctx = {
    window: win, console,
    document: { querySelector: () => null, querySelectorAll: () => [], cookie: '', documentElement: {} },
    navigator: { language: 'en' },
    location: { host: 'arena.ai', hostname: 'arena.ai', pathname: '/text/direct', href: 'https://arena.ai/text/direct' },
    URL, URLSearchParams, setTimeout, clearTimeout, JSON, Promise, Date, Math, Array, Object, String, Number, Map, Set,
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(SITE, ctx);
  return ctx.window.__sdSite;
}

const site = load();
const prompt = site.arenaPrompt;

test('the base prompt carries the agent playbook', () => {
  assert.match(prompt, /AGENT PLAYBOOK/);
  for (const rule of [/Persist:/, /Evidence over memory/, /Plan, then act/, /Small verified steps/,
    /Stay inside the chat limits/, /PLAN\.md \/ PROGRESS\.md/, /Finish honestly/]) {
    assert.match(prompt, rule);
  }
});

test('the playbook sits between the working rules and the Linux/MCP section', () => {
  const rules = prompt.indexOf('WORKING RULES');
  const playbook = prompt.indexOf('AGENT PLAYBOOK');
  const linux = prompt.indexOf('LINUX AND MCP');
  assert.ok(rules >= 0 && rules < playbook && playbook < linux);
});

test('the prompt stays model-neutral and keeps its safety rules', () => {
  assert.match(prompt, /not your model identity/);
  assert.match(prompt, /untrusted data/);
  assert.match(prompt, /never claim a tool ran merely because you printed code or a tag/);
  assert.ok(prompt.length < 12000, `prompt grew to ${prompt.length} chars`);
});

test('Code and Search add their own working rules; Image and Text add none', () => {
  const code = site.modalityProfile('webdev');
  const search = site.modalityProfile('search');
  assert.match(code.addendum, /scaffold first, then add one feature at a time/);
  assert.match(search.addendum, /cross-check at least two independent sources/);
  assert.equal(site.modalityProfile('chat').addendum, '');
  assert.equal(site.modalityProfile('image').inject, false);
  assert.equal(site.modalityProfile('image').addendum, '');
});
