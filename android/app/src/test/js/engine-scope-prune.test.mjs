// v2.2.0 scope: the settings overview and the "+" sheet only carry what the
// owner asked to keep (sandbox, MCP, projects, memory, uploads, settings).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../../main/bds-assets/bds');
const content = readFileSync(join(dir, 'content.js'), 'utf8');
const injected = readFileSync(join(dir, 'injected.js'), 'utf8');

const overview = (() => {
  const a = content.indexOf('function sdBuildOverview(');
  const b = content.indexOf('function sdFillHeader(');
  assert.ok(a > 0 && b > a, 'overview builder located');
  return content.slice(a, b);
})();

test('settings overview no longer lists the removed extras', () => {
  for (const key of ['deep_research', 'commands', 'appearance', 'data']) {
    assert.ok(!overview.includes(`key:"${key}"`), `row ${key} must be gone`);
  }
});

test('settings overview keeps the essentials', () => {
  for (const key of ['prompts', 'memory', 'language', 'linux', 'mcp', 'projects', 'chat', 'doctor']) {
    assert.ok(overview.includes(`key:"${key}"`), `row ${key} must stay`);
  }
});

test('+ sheet never shows GitHub repo or web-page import cards', () => {
  assert.ok(!/C\(V,tt&&!!Zd\(`features\.attachMenu\.\$\{Le\}\.showGithub`\)/.test(content));
  assert.ok(!/C\(Z,tt&&!!Zd\(`features\.attachMenu\.\$\{Le\}\.showWeb`\)/.test(content));
  assert.ok(content.includes('C(V,!1,!0)') && content.includes('C(Z,!1,!0)'));
});

test('+ sheet drops the Deep Research card but keeps uploads and projects', () => {
  assert.ok(content.includes('try{dr.remove()}catch(_){}'));
  for (const k of ['attachMenu.uploadFolder', 'attachMenu.attachProject', 'bdsCam', 'bdsPho', 'async function Ot()']) {
    assert.ok(content.includes(k), `${k} must stay`);
  }
});

test('the sandbox prompt carries the engineering-discipline rules', () => {
  assert.ok(injected.includes('Engineering discipline'));
  assert.ok(injected.includes('numbered plan'));
  assert.ok(injected.includes('same error appears twice'));
});
