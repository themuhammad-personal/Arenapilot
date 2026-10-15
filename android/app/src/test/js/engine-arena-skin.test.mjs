// ArenaPilot N0 page-skin regression tests.
// The official arena.ai document remains the only chat surface; this hook only
// marks nodes which already exist so CSS can make them work better on phones.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const SITE = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-site.js'), 'utf8');
const SKIN = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/our-skin.css'), 'utf8');

function runSite(host) {
  const htmlClasses = new Set();
  const formClasses = new Set();
  const form = { classList: { add: (name) => formClasses.add(name) } };
  const textarea = { closest: (selector) => selector === 'form' ? form : null };
  const document = {
    documentElement: { classList: { add: (name) => htmlClasses.add(name) } },
    querySelector: (selector) => selector === 'textarea[name="message"]' ? textarea : null,
  };
  const context = { console, location: { host, hostname: host }, document };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(SITE, context);
  return { context, htmlClasses, formClasses };
}

test('Arena skin tags the existing page and composer only', () => {
  const { context, htmlClasses, formClasses } = runSite('arena.ai');
  assert.equal(context.__sdSite.id, 'arena');
  assert.ok(htmlClasses.has('sd-arena-native'));
  assert.ok(formClasses.has('sd-arena-composer'));
  assert.equal(typeof context.document.createElement, 'undefined',
    'the skin hook must not create a parallel chat surface');
});

test('Arena skin is not enabled for DeepSeek or unknown hosts', () => {
  for (const host of ['chat.deepseek.com', 'example.com', 'arena.ai.evil.example']) {
    const { htmlClasses, formClasses } = runSite(host);
    assert.equal(htmlClasses.has('sd-arena-native'), false, host);
    assert.equal(formClasses.has('sd-arena-composer'), false, host);
  }
});

test('mobile skin preserves arena colours and protects the send/model controls', () => {
  assert.match(SKIN, /html\.sd-arena-native/);
  assert.match(SKIN, /button\[aria-label="Send message"\]/);
  assert.match(SKIN, /button\[aria-label\*=", model "\]/);
  assert.match(SKIN, /max-width: 54vw/);
  assert.doesNotMatch(SKIN, /background(?:-color)?\s*:\s*#[0-9a-f]{3,8}/i,
    'the skin must not replace arena.ai palette colours');
});
