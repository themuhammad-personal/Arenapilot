// ArenaPilot N0 page-skin regression tests.
// The official arena.ai document remains the only chat surface. The native-preservation
// adapter must not stamp classes/attributes onto Arena-owned nodes to change their layout.
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
const ENGINE_JS = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/content.js'), 'utf8');

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

test('Arena native-preservation hook never marks React-owned page/composer nodes', () => {
  const result = runSite('arena.ai');
  const { context, htmlClasses, formClasses } = result;
  assert.equal(context.__sdSite.id, 'arena');
  assert.equal(htmlClasses.has('sd-arena-native'), false,
    'the html element is not mutated during Arena hydration');
  assert.equal(formClasses.has('sd-arena-composer'), false,
    'the original form remains free of engine-owned marker classes');
  assert.equal(result.observers.length, 0,
    'native-preservation mode does not install an observer just to tag the composer');
  assert.doesNotMatch(SKIN, /sd-arena-native|sd-arena-composer/,
    'no CSS depends on markers added to native page elements');
  assert.equal(result.createdNodes, 0,
    'the hook must not create a parallel chat surface');
});


test('Arena route transition does not need to mutate a late-mounted native composer', () => {
  const result = runSite('arena.ai', false);
  assert.equal(result.htmlClasses.has('sd-arena-native'), false);
  assert.equal(result.formClasses.has('sd-arena-composer'), false);
  assert.equal(result.observers.length, 0,
    'there is no class-tagging observer even before the composer mounts');
  result.enableComposer();
  assert.equal(result.formClasses.has('sd-arena-composer'), false);
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

  assert.ok(SKIN.includes('.bds-arena-rail[data-dock="sidebar"]'),
    'only the engine-owned Settings entry gets a sidebar placement rule');
  assert.match(SKIN, /\.bds-arena-rail\[data-dock="pending"\]/,
    'Settings remains hidden until an original sidebar is detected');
  assert.match(SKIN, /\.bds-arena-rail\[data-dock="composer"\]/,
    'Settings never falls back beside the native composer');
  assert.match(SKIN, /\.bds-arena-rail-label/);
  assert.doesNotMatch(SKIN, /background(?:-color)?\s*:\s*#[0-9a-f]{3,8}/i,
    'the stylesheet does not replace Arena palette colours');
  assert.match(ENGINE_CSS,
    /div:not\(#bds-root\):has\(>\.bds-attach-menu-mount\):not\(:has\(>\.bds-attach-menu-mount\[data-bds-preserve-native-layout="true"\]\)\)\{/,
    'the generic engine parent-flex rule skips the injected Arena mount');
  assert.match(SITE,
    /mount\.setAttribute\('data-bds-preserve-native-layout', 'true'\)/,
    'only the injected mount receives the marker used to preserve native Arena geometry');

  assert.match(SITE, /function installArenaSidebarSettingsDock\(\)/);
  assert.match(SITE, /leaderboard/i);
  assert.match(SITE, /search/i);
  assert.match(SITE, /installArenaSidebarSettingsDock\(\);/);
  assert.doesNotMatch(SITE, /classList\.add\('sd-arena-native'\)|classList\.add\('sd-arena-composer'\)/,
    'Arena hydration must not see classes injected onto the document or native composer');
  assert.match(SITE, /function syncOriginalAttachTrigger\(\)/);
  assert.match(SITE, /form button\[aria-label="Add files"\]/);
  assert.match(SITE, /enginePlus\.setAttribute\('aria-label', 'Arena attachment options'\)/,
    'the transparent engine hit target has its own accessible label');
  assert.match(SITE, /setImportantStyle\(enginePlus\.style, 'opacity', '0'\)/,
    'the engine hit target is transparent over the native icon');
  assert.doesNotMatch(SITE, /setImportantStyle\(original\.style|original\.style\.setProperty\(/,
    'the native Plus keeps its original display, pointer, border, radius and DOM state');
  assert.doesNotMatch(SITE, /panel\.setAttribute\('data-bds-arena-sidebar', 'true'\)/,
    'the React-owned sidebar is measured but never marked or mutated');
  assert.doesNotMatch(SITE, /panel\.style\.setProperty\(['"](?:width|height|min-width|max-width)/,
    'sidebar width and height are never written by the adapter');
  const railStart = ENGINE_JS.indexOf('function sdsArenaRail(){');
  const railEnd = ENGINE_JS.indexOf('function sdsArenaInstall(){', railStart);
  assert.ok(railStart >= 0 && railEnd > railStart, 'Arena Settings rail function is present');
  const railSource = ENGINE_JS.slice(railStart, railEnd);
  assert.match(railSource, /var host=document\.getElementById\("bds-root"\);\s*if\(!host\)return;/,
    'the Settings rail is only mounted inside the engine root and never falls back to the document body');
  assert.doesNotMatch(railSource, /host=sdsArenaComposer\(\)|host=n;/,
    'the engine rail is never appended into Arena’s React-owned sidebar or composer');
  const attachStart = ENGINE_JS.indexOf('function $vt(){');
  const attachEnd = ENGINE_JS.indexOf('function PQ(){', attachStart);
  assert.ok(attachStart >= 0 && attachEnd > attachStart, 'attachment-sheet hook is present');
  const attachSource = ENGINE_JS.slice(attachStart, attachEnd);
  assert.match(attachSource, /const ar=sdsIsArena\(\),root=ar\?document\.getElementById\("bds-root"\):null/,
    'Arena resolves its engine-owned overlay root');
  assert.match(attachSource, /o=ar\?V_\(root,"bds-attach-menu-mount"/,
    'the attachment sheet mount is isolated under the engine root');
  const attachSync = SITE.slice(SITE.indexOf('function syncOriginalAttachTrigger()'), SITE.indexOf('function sync()'));
  assert.doesNotMatch(attachSync, /createElement\(/, 'the native icon is not cloned');
  assert.match(attachSync, /original\.addEventListener\('click'/,
    'the native Arena button handles taps when geometry shifts between observer passes');
  assert.match(attachSync, /syncOriginalAttachTrigger\(\)[\s\S]*trigger\.click\(\)/,
    'a real native-button tap refreshes engine geometry and opens the existing sheet');
  assert.doesNotMatch(attachSync, /original\.style\.setProperty\(|setImportantStyle\(original\.style/,
    'the forwarding bridge never changes Arena’s native button CSS');
});