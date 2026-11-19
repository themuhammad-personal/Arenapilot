// v2.2.0 scope: the settings overview and the "+" sheet only carry what the
// owner asked to keep (MCP, projects, memory, uploads, settings).
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

// Slash commands, Custom CSS and Integrations & backup were pruned in v2.2.0 but
// their pages and storage stayed, leaving working features with no way in. They
// are listed again (see settings-reachability.test.mjs); only the DeepSeek-only
// extras stay removed.
test('settings overview no longer lists the DeepSeek-only extras', () => {
  for (const key of ['deep_research', 'linux']) {
    assert.ok(!overview.includes(`key:"${key}"`), `row ${key} must be gone`);
  }
});

test('settings overview keeps the essentials', () => {
  for (const key of ['prompts', 'memory', 'language', 'mcp', 'projects', 'commands', 'chat', 'appearance', 'data', 'doctor']) {
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

test('MCP discovery never advertises a phantom device runtime or exports its state', () => {
  assert.doesNotMatch(injected, /Your Linux sandbox|promptContext\(|\/root\/workspace|sandbox:\/\/linux/);
  assert.match(injected, /Available tools:/);
  assert.doesNotMatch(content, /__sdSandboxServers|sdMountLinux/);
});

test('toasts never swallow taps (a toast over the composer must not block Send)', () => {
  const css = readFileSync(join(dir, 'content.css'), 'utf8');
  assert.ok(css.includes('#bds-root>#bds-toast-stack,#bds-root>#bds-toast-stack *{pointer-events:none}'));
  assert.ok(css.lastIndexOf('#bds-root>#bds-toast-stack') > css.indexOf('#bds-root>*{pointer-events:auto}'),
    'the toast rule must come after the generic #bds-root>* rule');
  assert.ok(!css.includes('box-shadow:var(--bds-shadow);pointer-events:auto;animation:bds-toast-in'));
});
