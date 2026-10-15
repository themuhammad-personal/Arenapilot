// Model-name classification for the per-message price badge (content.js: Z8).
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const bds = path.join(here, '../../main/bds-assets/bds');
const CONTENT = fs.readFileSync(path.join(bds, 'content.js'), 'utf8');

function slice(from, to) {
  const a = CONTENT.indexOf(from);
  const b = CONTENT.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `engine code moved: ${from}`);
  return CONTENT.slice(a, b);
}

// Z8 — self-contained in the bundle: param label in, pricing key out.
const CLASSIFIER = slice('function Z8(', 'function act(');

function setup(badgeText) {
  const ctx = {
    console, String,
    document: { querySelector: () => (badgeText == null ? null : { textContent: badgeText }) },
    B: { pricing: { modelName: null } },
  };
  vm.createContext(ctx);
  vm.runInContext(CLASSIFIER + '\nthis.Z8 = Z8;', ctx);
  return ctx;
}

test('the API-returned model label drives the pricing key', () => {
  const ctx = setup(null);
  assert.equal(ctx.Z8('pro'), 'deepseek-v4-pro');
  assert.equal(ctx.Z8('reasoner'), 'deepseek-v4-pro');
  assert.equal(ctx.Z8('expert'), 'deepseek-v4-pro');
  assert.equal(ctx.Z8('flash'), 'deepseek-v4-flash');
  assert.equal(ctx.Z8('chat'), 'deepseek-v4-flash');
  assert.equal(ctx.Z8('instant'), 'deepseek-v4-flash');
  assert.equal(ctx.Z8('DeepSeek-V4 Pro'), 'deepseek-v4-pro');
});

test('the model badge on the page drives the pricing key', () => {
  assert.equal(setup('Expert').Z8(null), 'deepseek-v4-pro');
  assert.equal(setup('Instant').Z8(null), 'deepseek-v4-flash');
  // Badge labels carry more than the bare word ("DeepSeek Expert",
  // "Instant · 64K"); the old exact-equality fell through to the flash
  // default and mis-priced every Pro message.
  assert.equal(setup('DeepSeek Expert').Z8(null), 'deepseek-v4-pro');
  assert.equal(setup('Expert · 64K').Z8(null), 'deepseek-v4-pro');
  assert.equal(setup('Instant · 64K').Z8(null), 'deepseek-v4-flash');
  assert.equal(setup('V4 Flash').Z8(null), 'deepseek-v4-flash');
});

test('the last detected model and the flash default back everything up', () => {
  const ctx = setup('something unrecognised');
  assert.equal(ctx.Z8(null), 'deepseek-v4-flash');
  ctx.B.pricing.modelName = 'deepseek-v4-pro';
  assert.equal(ctx.Z8(null), 'deepseek-v4-pro');
  assert.equal(ctx.Z8(''), 'deepseek-v4-pro');
});
