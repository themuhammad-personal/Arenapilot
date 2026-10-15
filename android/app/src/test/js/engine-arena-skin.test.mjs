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

function runSite(host, initiallyHasComposer = true) {
  const htmlClasses = new Set();
  const formClasses = new Set();
  const observers = [];
  const form = { classList: { add: (name) => formClasses.add(name) } };
  const textarea = {
    nodeType: 1,
    matches: (selector) => selector === 'textarea[name="message"]',
    querySelectorAll: () => [],
    closest: (selector) => selector === 'form' ? form : null,
  };
  let hasComposer = initiallyHasComposer;
  let createdNodes = 0;
  class FakeMutationObserver {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {}
    disconnect() { this.disconnected = true; }
  }
  const document = {
    documentElement: { classList: { add: (name) => htmlClasses.add(name) } },
    querySelector: (selector) => selector === 'textarea[name="message"]' && hasComposer ? textarea : null,
    createElement: () => { createdNodes += 1; throw new Error('Do not create replacement chat UI'); },
  };
  const context = {
    console,
    location: { host, hostname: host },
    document,
    MutationObserver: FakeMutationObserver,
    setTimeout: () => 0,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(SITE, context);
  return {
    context, htmlClasses, formClasses, observers,
    enableComposer() {
      hasComposer = true;
      observers.forEach((observer) => observer.callback([{ addedNodes: [textarea] }]));
    },
    get createdNodes() { return createdNodes; },
  };
}

test('Arena skin tags the existing page and composer only', () => {
  const result = runSite('arena.ai');
  const { context, htmlClasses, formClasses } = result;
  assert.equal(context.__sdSite.id, 'arena');
  assert.ok(htmlClasses.has('sd-arena-native'));
  assert.ok(formClasses.has('sd-arena-composer'));
  assert.equal(result.createdNodes, 0,
    'the skin hook must not create a parallel chat surface');
});


test('Arena skin waits for the existing composer when the SPA mounts it late', () => {
  const result = runSite('arena.ai', false);
  assert.ok(result.htmlClasses.has('sd-arena-native'));
  assert.equal(result.formClasses.has('sd-arena-composer'), false);
  assert.equal(result.observers.length, 1);
  result.enableComposer();
  assert.ok(result.formClasses.has('sd-arena-composer'));
  assert.equal(result.observers[0].disconnected, false,
    'keep observing so a later SPA route replacement is handled too');
  assert.equal(result.createdNodes, 0);
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
