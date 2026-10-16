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
const AGENT = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/sd-agent.js'), 'utf8');
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

  assert.match(SITE, /function installArenaSettingsSidebarCleanup\(\)/,
    'Arena Settings no longer depends on a sidebar being present or visible');
  assert.match(SITE, /rail\.style\.setProperty\('display', 'none', 'important'\)/,
    'the old source rail is explicitly hidden instead of falling back beside native controls');
  assert.match(SITE, /removeNativeSettingsEntry\(\)/,
    'any stale cloned Settings row is removed during SPA or reinjection changes');
  assert.match(SITE, /installArenaSettingsSidebarCleanup\(\);/,
    'the Arena-only sidebar cleanup runs at profile initialization');
  assert.match(AGENT, /function addSettingsItem\(\)/,
    'the Settings option is added by the same engine that builds the Plus sheet tools');
  assert.match(AGENT, /function fitSettingsList\(sheet, list\)/,
    'the existing More tools list is given a measured scroll viewport on short screens');
  assert.match(AGENT, /list\.style\.setProperty\('overflow-y', 'auto'\)/,
    'Settings can be reached by scrolling inside the tool list, without hiding the header and quick actions');
  assert.match(AGENT, /list\.style\.setProperty\('max-height', available \+ 'px'\)/,
    'the list viewport is measured from the actual remaining sheet space, not a guessed CSS height');
  assert.match(AGENT, /width="18" height="18" viewBox="0 0 24 24"/,
    'Settings uses an icon large enough to match the other tool cards');
  assert.match(AGENT, /M12\.22 2h-\.44/,
    'Settings uses a conventional gear outline rather than the old malformed teeth path');
  assert.match(AGENT, /\.bds-attach-dropdown/);
  assert.match(AGENT, /sd-arena-settings-item/);
  assert.match(AGENT, /Manage app preferences, tools and integrations/);
  assert.match(AGENT, /parent\.appendChild\(btn\)/,
    'the Settings card is appended after the existing tool cards');
  assert.match(AGENT, /new CustomEvent\('bds:open-drawer'\)/,
    'the card opens the existing Settings drawer instead of a parallel UI');
  assert.match(AGENT, /setTimeout\(openSettings, 240\)/,
    'the attachment sheet closes before the Settings drawer opens');
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
  assert.doesNotMatch(attachSync, /original\.addEventListener\('click'/,
    'forwarding is delegated so React can replace the native button without losing it');
  const forwardingStart = SITE.indexOf('function forwardNativeAttachClick(event)');
  const forwardingEnd = SITE.indexOf('function sync()', forwardingStart);
  assert.ok(forwardingStart >= 0 && forwardingEnd > forwardingStart, 'delegated native Plus forwarder is present');
  const forwarding = SITE.slice(forwardingStart, forwardingEnd);
  assert.match(forwarding, /target\.closest\('form button\[aria-label="Add files"\], form button\[aria-label="Attach files"\]'\)/,
    'only Arena’s actual native attachment button triggers the bridge');
  assert.match(forwarding, /syncOriginalAttachTrigger\(\)[\s\S]*trigger\.click\(\)/,
    'a real native-button tap refreshes the engine overlay and opens the existing sheet');
  assert.doesNotMatch(forwarding, /original\.style\.setProperty\(|setImportantStyle\(original\.style/,
    'the forwarding bridge never changes Arena’s native button CSS');
  assert.doesNotMatch(attachSync, /original\.style\.setProperty\(|setImportantStyle\(original\.style/,
    'the overlay sync never changes Arena’s native button CSS');
});