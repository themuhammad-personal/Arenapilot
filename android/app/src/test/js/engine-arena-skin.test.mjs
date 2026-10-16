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
const ENGINE_CSS = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/content.css'), 'utf8');

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
  assert.doesNotMatch(SKIN, /form:has\(textarea\[name="message"\]\)/,
    'the injected stylesheet does not take over Arena composer layout');
  assert.doesNotMatch(SKIN, /html\.sd-arena-native \.sd-arena-composer/,
    'older WebViews also keep the original composer styling');
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

test('native-preservation skin never restyles Arena-owned layout or controls', () => {
  assert.doesNotMatch(SKIN, /form:has\(/, 'do not override the original form/composer geometry');
  assert.doesNotMatch(SKIN, /\.sd-arena-composer\s+(?:textarea|button|\[role=)/,
    'do not impose textarea, Send or mode-control dimensions');
  assert.doesNotMatch(SKIN, /button\[aria-label="Send message"\]/,
    'the native Send button is owned by Arena CSS');
  assert.doesNotMatch(SKIN, /button\[aria-label\*=", model "/,
    'model picker width and truncation are not forced by the skin');
  assert.doesNotMatch(SKIN, /\[role="combobox"\]|select\s*\{/,
    'mode selector and native select keep their own states and dimensions');
  assert.doesNotMatch(SKIN, /\.bds-plus-btn|\.bds-attach-menu-mount/,
    'the injected Plus target is not resized by our stylesheet');
  assert.doesNotMatch(SKIN, /main \.prose|text-underline-offset|line-height: 1\.6/,
    'page typography and message styles remain Arena-owned');
  assert.doesNotMatch(SKIN, /(?:min-width|max-width|width|height):\s*(?:calc\(100vw|\d+vw|\d+vh)/,
    'no viewport-derived sizes are imposed on the page or composer');

  assert.ok(SKIN.includes('#bds-settings-rail[data-dock="sidebar"]'),
    'only the engine-owned Settings entry gets a sidebar placement rule');
  assert.match(SKIN, /#bds-settings-rail\[data-dock="pending"\]/,
    'Settings remains hidden until an original sidebar is detected');
  assert.match(SKIN, /#bds-settings-rail\[data-dock="composer"\]/,
    'Settings never falls back beside the native composer');
  assert.match(SKIN, /\.bds-arena-rail-label/);
  assert.doesNotMatch(SKIN, /background(?:-color)?\s*:\s*#[0-9a-f]{3,8}/i,
    'the stylesheet does not replace Arena palette colours');
  assert.match(ENGINE_CSS,
    /html:not\\(\\.sd-arena-native\\) div:not\\(#bds-root\\):has\\(>\\.bds-attach-menu-mount\\)\\{/,
    'the engine may style its own mount on other sites, not Arena\'s original controls');
  assert.doesNotMatch(ENGINE_CSS,
    /(?<!html:not\(\.sd-arena-native\) )div:has\(>\.bds-attach-menu-mount\)\{/,
    'no unscoped mount-parent rule can change Arena\'s mode/model/composer widths');

  assert.match(SITE, /function installArenaSidebarSettingsDock\(\)/);
  assert.match(SITE, /leaderboard/i);
  assert.match(SITE, /search/i);
  assert.match(SITE, /installArenaSidebarSettingsDock\(\);/);
  assert.match(SITE, /function syncOriginalAttachTrigger\(\)/);
  assert.match(SITE, /form button\[aria-label="Add files"\]/);
  assert.match(SITE, /enginePlus\.setAttribute\('aria-label', 'Arena attachment options'\)/,
    'the transparent engine hit target has its own accessible label');
  assert.match(SITE, /setImportantStyle\(enginePlus\.style, 'opacity', '0'\)/,
    'the engine hit target is transparent over the native icon');
  assert.match(SITE, /setImportantStyle\(original\.style, 'pointer-events', 'none'\)/,
    'only hit testing changes on the native Plus, not its visual style');
  assert.doesNotMatch(SITE, /setImportantStyle\(original\.style, 'display', 'flex'\)/,
    'the original Plus display mode is not forced');
  assert.match(SITE, /panel\.setAttribute\('data-bds-arena-sidebar', 'true'\)/);
  assert.doesNotMatch(SITE, /panel\.style\.setProperty\(['"](?:width|height|min-width|max-width)/,
    'sidebar width and height are never written by the adapter');
  const attachSync = SITE.slice(SITE.indexOf('function syncOriginalAttachTrigger()'), SITE.indexOf('function sync()'));
  assert.doesNotMatch(attachSync, /createElement\(/, 'the native icon is not cloned');
  assert.doesNotMatch(attachSync, /trigger\.click\(\)/, 'native interaction is not simulated');
});