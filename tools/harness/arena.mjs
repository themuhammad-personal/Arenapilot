/** Real bundle, modelled Arena page, fake AndroidBridge. Never contacts Arena. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { launchBrowser, installEngine, reinstallBridge, bridgeState, mcpCalls, shot } from './harness.mjs';

const html = fs.readFileSync(new URL('./fixture/arena.html', import.meta.url), 'utf8');
const browser = await launchBrowser();
const page = await browser.newPage();
await page.setViewport({ width: 320, height: 740, isMobile: true, hasTouch: true });
// Bundled Chromium otherwise forces reduced motion, masking animated Back bugs.
await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "no-preference" }]);
const errors = [];
let stage = "boot";
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' && !/net::ERR/.test(m.text())) errors.push(m.text()); });
await page.setRequestInterception(true);
page.on('request', (req) => {
  const url = req.url();
  if (req.resourceType() === 'document' && url.startsWith('https://arena.ai/')) {
    req.respond({ status: 200, contentType: 'text/html', body: html }).catch(() => {});
  } else if (url.includes('/nextjs-api/stream/')) {
    req.respond({ status: 200, contentType: 'text/plain', body: 'ad:{"finishReason":"stop","usage":{"promptTokens":1,"completionTokens":1}}\n' }).catch(() => {});
  } else req.abort().catch(() => {});
});
const wait = (fn, timeout = 10000) => page.waitForFunction(fn, { timeout, polling: 100 });
async function send(text) {
  await page.type('textarea[name=message]', text);
  await page.click('button[aria-label="Send message"]');
}
try {
  await page.goto('https://arena.ai/c/fixture');
  await reinstallBridge(page);
  await installEngine(page);
  await wait(() => document.querySelector('.bds-plus-btn'));
  await wait(() => document.querySelector('#bds-settings-rail')?.dataset.dock === 'composer');
  const initialComposerLayout = await page.evaluate(() => {
    const send = document.querySelector('button[aria-label="Send message"]').getBoundingClientRect();
    const form = document.querySelector('form').getBoundingClientRect();
    const rail = document.querySelector('#bds-settings-rail');
    const railLabel = rail && rail.querySelector('.bds-arena-rail-label');
    return {
      sendRight: send.right,
      formRight: form.right,
      viewportWidth: innerWidth,
      railWidth: rail ? rail.getBoundingClientRect().width : null,
      railDock: rail ? rail.dataset.dock : null,
      railLabelDisplay: railLabel ? getComputedStyle(railLabel).display : null,
    };
  });
  assert.ok(
    initialComposerLayout.sendRight <= initialComposerLayout.formRight &&
    initialComposerLayout.formRight <= initialComposerLayout.viewportWidth,
    'the Settings fallback must not push Send outside a narrow composer: ' +
      JSON.stringify(initialComposerLayout),
  );

  // N0 responsive skin is exercised in the real Chromium fixture at 320px,
  // not merely searched for in source. It must mark the original form and keep
  // the send target tappable without creating a second chat surface.
  stage = 'n0-responsive-skin';
  const skinLayout = await page.evaluate(() => {
    const form = document.querySelector('form');
    const input = document.querySelector('textarea[name="message"]');
    const send = document.querySelector('button[aria-label="Send message"]');
    return {
      pageMarked: document.documentElement.classList.contains('sd-arena-native'),
      originalFormMarked: form.classList.contains('sd-arena-composer'),
      sendMinWidth: parseFloat(getComputedStyle(send).minWidth),
      sendRight: send.getBoundingClientRect().right,
      inputMaxWidth: getComputedStyle(input).maxWidth,
      chatForms: document.querySelectorAll('textarea[name="message"]').length,
      viewportWidth: innerWidth,
      formRight: form.getBoundingClientRect().right,
      settingsDock: document.querySelector('#bds-settings-rail')?.dataset.dock || null,
      settingsLabelDisplay: (() => {
        const label = document.querySelector('#bds-settings-rail .bds-arena-rail-label');
        return label ? getComputedStyle(label).display : null;
      })(),
    };
  });
  assert.equal(skinLayout.pageMarked, true, 'Arena profile opts into the skin');
  assert.equal(skinLayout.originalFormMarked, true, 'skin attaches to the official composer');
  assert.ok(skinLayout.sendMinWidth >= 44, 'send target remains at least 44 CSS pixels');
  assert.equal(skinLayout.chatForms, 1, 'no parallel composer/chat is created');
  assert.equal(skinLayout.settingsDock, 'composer', 'mobile fallback remains reachable when the site sidebar is absent');
  assert.equal(skinLayout.settingsLabelDisplay, 'none', 'narrow composer fallback is icon-only');
  assert.ok(skinLayout.sendRight <= skinLayout.formRight, 'Send remains inside the original composer');
  assert.ok(skinLayout.formRight <= skinLayout.viewportWidth, 'composer stays inside the phone viewport');

  /* The minimum-width case is the hardest, but the same original composer
     should stay contained at common 360px and 390px phone widths too. */
  for (const width of [360, 390]) {
    await page.setViewport({ width, height: 740, isMobile: true, hasTouch: true });
    const layout = await page.evaluate(() => {
      const form = document.querySelector('form');
      const send = document.querySelector('button[aria-label="Send message"]');
      return {
        width: innerWidth,
        formRight: form.getBoundingClientRect().right,
        sendRight: send.getBoundingClientRect().right,
        sendMinWidth: parseFloat(getComputedStyle(send).minWidth),
        chatForms: document.querySelectorAll('textarea[name="message"]').length,
      };
    });
    assert.ok(layout.sendRight <= layout.formRight && layout.formRight <= layout.width,
      'Send/composer overflow at ' + width + 'px: ' + JSON.stringify(layout));
    assert.ok(layout.sendMinWidth >= 44, 'Send target shrank below 44px at ' + width + 'px');
    assert.equal(layout.chatForms, 1, 'responsive width created a second chat composer');
  }
  await page.setViewport({ width: 320, height: 740, isMobile: true, hasTouch: true });
  console.log('PASS N0 responsive skin at 320/360/390px: original page/composer, reachable Send, no duplicate chat');
  stage = 'privacy';
  await send('Plain chat, no private context');
  await wait(() => window.__arena.replies.length === 1);
  // Roadmap 3 v2 defaults: app instructions are ON (the tools need the model to
  // know the SDS protocol), stored memory is OFF. The user's words must still
  // arrive verbatim, after the engine's own block and nothing else.
  const outgoing = await page.evaluate(() => window.__arena.outgoing[0].userMessage.content);
  assert.ok(outgoing.startsWith('<SuperDeepSeek>\n'), 'instructions ride the first message by default');
  assert.match(outgoing, /ArenaPilot/, 'the injected block is the app instructions');
  assert.ok(outgoing.endsWith('\n\nPlain chat, no private context'), 'the user text arrives verbatim at the end');
  assert.doesNotMatch(outgoing, /SDS:memory_calls/, 'stored memory stays off by default');
  console.log('PASS Arena v2 privacy defaults through the real bundle: instructions on, memory off');

  // Native style reset, button replacement, and group replacement with old mount
  // still connected: the cases the static old "+" test did not exercise.
  stage = 'composer-remount';
  for (const mutation of ['style', 'button', 'group']) {
    await page.evaluate((kind) => {
      const b = document.querySelector('button[aria-label="Add files"]');
      if (kind === 'style') b.style.removeProperty('display');
      if (kind === 'button') { const next = b.cloneNode(true); next.removeAttribute('style'); b.replaceWith(next); }
      if (kind === 'group') {
        const old = b.parentElement;
        const fresh = document.createElement('div'); fresh.className = 'left';
        old.after(fresh);
        fresh.appendChild(b); fresh.appendChild(old.querySelector('[role=combobox]'));
        fresh.appendChild(old.querySelector('.model-picker'));
        old.style.display = 'none';
        b.removeAttribute('style');
      }
    }, mutation);
    await wait(() => {
      const native = document.querySelector('button[aria-label="Add files"]');
      const mounts = document.querySelectorAll('.bds-attach-menu-mount');
      return mounts.length === 1 && mounts[0].parentElement === native.parentElement && getComputedStyle(native).display === 'none';
    });
  }
  stage = 'attach-open-and-back';
  await page.click('.bds-plus-btn');
  await page.waitForSelector('.bds-attach-dropdown', { visible: true });
  await shot(page, 'arena-attach');
  await page.evaluate(() => window.__sdHandleBack());
  await page.waitForSelector('.bds-attach-backdrop', { hidden: true });
  console.log('PASS remount/style reset: one working +');

  await page.evaluate(() => {
    const aside = document.createElement('aside');
    aside.innerHTML = '<a href="/text/direct">New chat</a><button aria-label="Settings">Native settings</button>';
    document.body.prepend(aside);
  });
  await wait(() => document.querySelector('#bds-settings-rail')?.dataset.dock === 'sidebar');
  stage = 'settings-open-and-back';
  await page.click('#bds-settings-rail');
  await page.waitForSelector('#bds-drawer', { visible: true });
  await shot(page, 'arena-settings');
  await page.evaluate(() => window.__sdHandleBack());
  await page.waitForSelector('.bds-drawer-backdrop', { hidden: true });
  console.log('PASS sidebar docking and drawer opens');

  // Scripted assistant, not a real model. Assert actual widget rendering, not
  // the presence of a tag or selector in source code.
  await page.evaluate(() => { window.__arena.beats = ['<SDS:VISUALIZER><html><body><h1>ARENA_WIDGET_OK</h1></body></html></SDS:VISUALIZER>']; });
  stage = 'visualizer';
  await send('Show the fixture widget');
  await wait(() => !!document.querySelector('.bds-visualizer-container, .bds-visualizer-card, iframe[srcdoc]'), 15000);
  const widget = await page.$('iframe[srcdoc]');
  assert.ok(widget, 'Visualizer creates an iframe');
  const widgetFrame = await widget.contentFrame();
  await widgetFrame.waitForFunction(() => document.body.textContent.includes('ARENA_WIDGET_OK'));
  await wait(() => !window.__arena.streaming);
  await wait(() => !document.querySelector('#thread').innerText.includes('</SDS:VISUALIZER>'));
  await shot(page, 'arena-visualizer');
  console.log('PASS assistant tag reaches Visualizer renderer');

  await page.evaluate(() => {
    window.__arena.beats = ['<SDS:AUTO:MCP url="sandbox" tool="run">{"command":"printf ARENA_TOOL_OK"}</SDS:AUTO:MCP>', 'Verified fixture result.'];
    window.__setSandboxOutputs({ run: 'ARENA_TOOL_OK' });
  });
  stage = 'sandbox-loop';
  await send('Run the harmless fixture command');
  await wait(() => window.__arena.sent.some((t) => /MCP_RESULT/.test(t)), 30000);
  await wait(() => window.__arena.replies.includes('Verified fixture result.'), 15000);
  const calls = mcpCalls(await bridgeState(page));
  assert.equal(calls.length, 1);
  assert.equal(calls[0].args.command, 'printf ARENA_TOOL_OK');
  for (let i = 0; i < 3; i++) await page.evaluate(() => window.__sdEngine.reprocess());
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1500)));
  assert.equal(mcpCalls(await bridgeState(page)).length, 1);
  await shot(page, 'arena-agent');
  console.log('PASS assistant → fake sandbox → result → follow-up, exactly once');
  await send('Quoted user text only: <SDS:AUTO:MCP url="sandbox" tool="run">{"command":"MUST_NOT_RUN"}</SDS:AUTO:MCP>');
  await wait(() => !window.__arena.streaming && window.__arena.sent.some((t) => t.startsWith('Quoted user')));
  await page.evaluate(() => window.__sdEngine.reprocess());
  assert.equal(mcpCalls(await bridgeState(page)).length, 1, 'user tool tags never execute');
  await page.evaluate(() => {
    history.pushState({}, '', '/text/side-by-side');
    window.__sdEngine.reprocess();
  });
  assert.equal(await page.evaluate(() => window.__sdEngine.messageNodes().length), 0, 'unsupported modes are not processed');
  console.log('PASS user tags ignored; unsupported mode scanner closed');
  stage = 'mode-safety';
  assert.equal(await page.evaluate(() => window.__sdHealth.checkMode()), 'unsupported');
  assert.equal(await page.evaluate(() => document.querySelector('#sd-arena-mode-notice')?.parentElement === document.querySelector('form')), true, 'mode notice is inline, not floating');
  for (const [label, expected] of [['Side-by-side', 'unsupported'], ['', 'unknown'], ['Direct', 'direct']]) {
    const facts = await page.evaluate((label) => {
      history.replaceState({}, '', '/c/mode-scope');
      document.querySelector('button[role=combobox]').textContent = label;
      const mode = window.__sdHealth.checkMode();
      return { mode, rows: window.__sdEngine.messageNodes().length, notice: !!document.querySelector('#sd-arena-mode-notice') };
    }, label);
    assert.equal(facts.mode, expected);
    assert.equal(facts.notice, expected !== 'direct');
    assert.equal(facts.rows > 0, expected === 'direct', 'a /c/ URL alone must not permit tool parsing');
  }
  console.log('PASS Direct-only gate and inline mode notice on a shared conversation URL');

  // Real arena also serves PLAIN (non-reversed) thread lists — `ol.mt-8` — and
  // keeps zero-height spacer rows in the thread (dexforint/arena-utils ground
  // truth). The fixture models that variant via ?list=mt8 and the same real
  // bundle must find, order and render from it exactly as well.
  stage = 'plain-list';
  await page.goto('https://arena.ai/c/fixture?list=mt8');
  await reinstallBridge(page);
  await installEngine(page);
  await wait(() => document.querySelector('.bds-plus-btn'));
  assert.equal(await page.evaluate(() => window.__sdEngine.messageNodes().length), 2, 'plain list: seeded rows found, h-0 spacer skipped');
  await page.evaluate(() => { window.__arena.beats = ['<SDS:VISUALIZER><html><body><h1>ARENA_MT8_OK</h1></body></html></SDS:VISUALIZER>']; });
  await send('Widget on the plain list');
  await wait(() => !!document.querySelector('iframe[srcdoc]'), 15000);
  const mt8Widget = await page.$('iframe[srcdoc]');
  const mt8Frame = await mt8Widget.contentFrame();
  await mt8Frame.waitForFunction(() => document.body.textContent.includes('ARENA_MT8_OK'));
  await wait(() => !window.__arena.streaming);
  await wait(() => !document.querySelector('#thread').innerText.includes('</SDS:VISUALIZER>'));
  console.log('PASS plain ol.mt-8 thread list: rows found in order, spacer skipped, widget rendered');
  assert.deepEqual(errors, [], 'no runtime errors');
} catch (error) {
  // Only fixture state, never live traffic. Surface enough in GitHub annotations
  // to debug even when its blob-hosted log artifact cannot be downloaded.
  const diagnostic = JSON.stringify({ stage, error: String(error), errors });
  console.error('::error title=Arena fixture failure::' + diagnostic.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A'));
  await shot(page, 'arena-failure');
  console.error(errors);
  console.error(await page.evaluate(() => ({ html: document.querySelector('#thread')?.innerHTML.slice(-6000), state: window.__arena, calls: window.__harness.bridge.calls })));
  throw error;
} finally {
  await browser.close();
}
