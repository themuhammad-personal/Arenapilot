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
  assert.match(SKIN, /form:has\(textarea\[name="message"\]\)/,
    'responsive styles survive SPA replacement of the official composer');
  assert.match(SKIN, /html\.sd-arena-native \.sd-arena-composer/,
    'older WebViews have a class-based fallback for the original composer');
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
  assert.equal(result.observers[0].disconnected, true,
    'stop observing after the original composer is found to avoid transcript overhead');
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
  assert.match(SKIN, /max-width: 28vw/);
  assert.match(SKIN, /max-width: 16vw/);
  assert.match(SKIN, /button\.whitespace-nowrap:not\(\[aria-label\]\)/);
  assert.doesNotMatch(SKIN, /border-radius: (?:12|14)px/,
    'the skin must not redraw the official Arena controls');
  assert.doesNotMatch(SKIN, /font: inherit/,
    'the original button and composer typography stay under Arena control');
  assert.doesNotMatch(SKIN, /border: 0 !important/,
    'the skin must not strip the original textarea border');
  assert.match(SKIN, /> \* > \* > \* \{/);
  assert.match(SKIN, /max-width: 54vw/);
  assert.ok(SKIN.includes('#bds-settings-rail[data-dock="composer"]'));
  assert.ok(SKIN.includes('#bds-settings-rail[data-dock="sidebar"]'),
    'the existing Settings control has a dedicated sidebar presentation');
  assert.match(SKIN, /#bds-settings-rail\[data-dock="pending"\]/,
    'the Settings fallback is hidden outside the sidebar rather than floating by the composer');
  assert.match(SKIN, /#bds-settings-rail\[data-dock="composer"\]/,
    'the fallback remains hidden if an engine rescan briefly restores the old composer dock');
  assert.match(SKIN, /\.bds-arena-rail-label/);
  const SITE = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-site.js'), 'utf8');
  assert.match(SITE, /function installArenaSidebarSettingsDock\(\)/);
  assert.match(SITE, /leaderboard/i);
  assert.match(SITE, /search/i);
  assert.match(SITE, /installArenaSidebarSettingsDock\(\);/);
  assert.match(SITE, /function syncOriginalAttachTrigger\(\)/);
  assert.match(SITE, /form button\[aria-label="Add files"\]/);
  assert.match(SITE, /enginePlus\.setAttribute\('aria-label', 'Arena attachment options'\)/,
    'the working engine target has an accessible label without colliding with Arena’s native selector');
  assert.match(SITE, /setImportantStyle\(enginePlus\.style, 'opacity', '0'\)/,
    'the engine target is transparent over the untouched native icon');
  assert.match(SITE, /setImportantStyle\(original\.style, 'pointer-events', 'none'\)/,
    'the native icon remains visible while taps hit the working engine button');
  const attachSync = SITE.slice(SITE.indexOf('function syncOriginalAttachTrigger()'), SITE.indexOf('function sync()'));
  assert.doesNotMatch(attachSync, /createElement\(/,
    'the original icon is neither cloned nor replaced');
  assert.doesNotMatch(attachSync, /trigger\.click\(\)/,
    'the original button no longer relies on scripted click forwarding');
  assert.match(SKIN, /display: none !important/);
  assert.match(SKIN, /\.bds-plus-btn/);
  assert.match(SKIN, /min-height: 44px/);
  assert.match(SKIN, /input:not\(\[type="checkbox"\]\):not\(\[type="radio"\]\):not\(\[type="file"\]\)/);
  assert.match(SKIN, /button\[type="submit"\]/);
  assert.match(SKIN, /main \.prose table/);
  assert.match(SKIN, /line-height: 1\.6/);
  assert.match(SKIN, /line-height: 1\.3/);
  assert.match(SKIN, /padding-inline-start: 1\.35em/);
  assert.match(SKIN, /text-underline-offset: 0\.16em/);
  assert.match(SKIN, /border-inline-start: 3px solid currentColor/);
  assert.match(SKIN, /main \.prose img/);
  assert.match(SKIN, /main \.prose pre code/);
  assert.doesNotMatch(SKIN, /html\.sd-arena-native button\[aria-label\],/,
    'touch sizing must not indiscriminately resize every official page button');
  assert.doesNotMatch(SKIN, /background(?:-color)?\s*:\s*#[0-9a-f]{3,8}/i,
    'the skin must not replace arena.ai palette colours');
});
