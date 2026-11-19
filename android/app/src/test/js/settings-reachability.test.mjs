// Every Advanced-settings page the engine can open must have a way to reach it,
// and settings that cannot act on arena.ai must not be offered.
// Regression for commit 62d667e, which pruned the overview rows for Slash
// commands, Custom CSS and Integrations & backup while leaving their pages,
// storage and the "/" popup in place: users could type "/" but never create a
// command, and could not reach export/import.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('../../main/bds-assets/bds/', import.meta.url);
const content = fs.readFileSync(new URL('content.js', dir), 'utf8');
const skin = fs.readFileSync(new URL('our-skin.css', dir), 'utf8');

const start = content.indexOf('function sdBuildOverview(');
const end = content.indexOf('function sdFillHeader(');
assert.ok(start > 0 && end > start, 'sdBuildOverview is present');
const overview = content.slice(start, end);

test('Advanced settings overview has a row for every page that works on arena.ai', () => {
  for (const key of ['prompts', 'memory', 'language', 'mcp', 'projects', 'commands', 'chat', 'appearance', 'data', 'doctor']) {
    assert.match(overview, new RegExp(`key:\\\\?"${key}\\\\?"`), `overview row "${key}"`);
  }
});

test('each overview row opens a page the settings router knows', () => {
  for (const key of ['commands', 'appearance', 'data']) {
    assert.match(content, new RegExp(`A\\(i\\)===\\\\?"${key}\\\\?"\\?je\\(`), `page router handles "${key}"`);
    assert.match(overview, new RegExp(`h\\.go\\(\\\\?"${key}\\\\?"\\)`), `row "${key}" navigates to its page`);
  }
});

test('the long explanatory note is no longer injected above the settings list', () => {
  assert.ok(!overview.includes('bds-arena-privacy-note'));
});

test('DeepSeek-only token price estimation is hidden on arena.ai', () => {
  assert.match(skin, /#bds-drawer \.bds-toggle-row:has\(#bds-token-price\)[\s\S]*display:\s*none\s*!important/);
});
