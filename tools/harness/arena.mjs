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
  await wait(() => document.querySelector('#bds-settings-rail')?.dataset.dock === 'sheet');
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

  await wait(() => {
    const native = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
    const trigger = document.querySelector('.bds-plus-btn');
    if (!native || !trigger) return false;
    const nr = native.getBoundingClientRect();
    const tr = trigger.getBoundingClientRect();
    return getComputedStyle(native).display !== 'none' &&
      getComputedStyle(native).pointerEvents !== 'none' && native.style.getPropertyValue('pointer-events') === '' &&
      getComputedStyle(trigger).display !== 'none' &&
      getComputedStyle(trigger).opacity === '0' &&
      Math.abs(nr.left - tr.left) <= 1 && Math.abs(nr.top - tr.top) <= 1 &&
      Math.abs(nr.width - tr.width) <= 1 && Math.abs(nr.height - tr.height) <= 1;
  });
  // N0 responsive skin is exercised in Chromium at 320px, not merely searched
  // for in source. It preserves Arena's original visible attach button and
  // routes its tap to the existing engine sheet without another visible plus.
  stage = 'n0-responsive-skin';
  const skinLayout = await page.evaluate(() => {
    const form = document.querySelector('form');
    const input = document.querySelector('textarea[name="message"]');
    const send = document.querySelector('button[aria-label="Send message"]');
    return {
      pageMarked: !!(window.__sdSite && window.__sdSite.id === 'arena'),
      originalFormMarked: !form.classList.contains('sd-arena-composer'),
      sendMinWidth: parseFloat(getComputedStyle(send).minWidth),
      sendRect: (() => { const r = send.getBoundingClientRect(); return { width: r.width, height: r.height, right: r.right }; })(),
      sendInlineWidth: send.style.width,
      sendRight: send.getBoundingClientRect().right,
      inputMaxWidth: getComputedStyle(input).maxWidth,
      chatForms: document.querySelectorAll('textarea[name="message"]').length,
      viewportWidth: innerWidth,
      formRight: form.getBoundingClientRect().right,
      settingsDock: document.querySelector('#bds-settings-rail')?.dataset.dock || null,
      settingsRailDisplay: (() => {
        const rail = document.querySelector('#bds-settings-rail');
        return rail ? getComputedStyle(rail).display : 'missing';
      })(),
      originalPlus: (() => {
        const b = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
        const r = b ? b.getBoundingClientRect() : null;
        const cs = b ? getComputedStyle(b) : null;
        return { found: !!b, display: cs && cs.display, visibility: cs && cs.visibility,
          pointerEvents: cs && cs.pointerEvents, width: r && r.width, height: r && r.height,
          left: r && r.left, top: r && r.top, parentClass: b && b.parentElement ? String(b.parentElement.className || '') : null };
      })(),
      originalPlusVisible: (() => {
        const b = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
        return !!b && getComputedStyle(b).display !== 'none' &&
          b.getBoundingClientRect().width >= 24 && b.getBoundingClientRect().height >= 24;
      })(),
      enginePlusOverlay: (() => {
        const native = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
        const b = document.querySelector('.bds-plus-btn');
        if (!native || !b) return false;
        const nr = native.getBoundingClientRect(); const r = b.getBoundingClientRect();
        return getComputedStyle(b).display !== 'none' && getComputedStyle(b).opacity === '0' &&
          getComputedStyle(native).pointerEvents !== 'none' && native.style.getPropertyValue('pointer-events') === '' &&
          Math.abs(nr.left - r.left) <= 1 && Math.abs(nr.top - r.top) <= 1 &&
          Math.abs(nr.width - r.width) <= 1 && Math.abs(nr.height - r.height) <= 1;
      })(),
    };
  });
  assert.equal(skinLayout.pageMarked, true, 'Arena profile opts into native-preservation mode');
  assert.equal(skinLayout.originalFormMarked, true, 'the native composer has no engine-owned marker class');
  assert.ok(skinLayout.sendRect.width > 0 && skinLayout.sendRect.height > 0,
    'the native Send control remains visible without injected size overrides');
  assert.equal(skinLayout.sendRect.width, 32, 'the fixture’s original 32px Send width is preserved');
  assert.equal(skinLayout.sendInlineWidth, '32px', 'the native Send inline width is left untouched');
  assert.equal(skinLayout.sendRect.height, 36, 'the fixture’s native button height is preserved');
  assert.equal(skinLayout.chatForms, 1, 'no parallel composer/chat is created');
  assert.equal(skinLayout.settingsDock, 'sheet',
    'the Settings source rail is marked for the Add to chat sheet, never the sidebar');
  assert.equal(skinLayout.settingsRailDisplay, 'none',
    'the legacy Settings source rail stays hidden while the visible card lives in Add to chat');
  assert.equal(skinLayout.originalPlusVisible, true, 'Arena keeps its own visible Add files icon/control: ' + JSON.stringify(skinLayout.originalPlus));
  assert.equal(skinLayout.enginePlusOverlay, true, 'a transparent working target exactly overlays the original Arena icon');
  assert.ok(skinLayout.sendRight <= skinLayout.formRight, 'Send remains inside the original composer');
  assert.ok(skinLayout.formRight <= skinLayout.viewportWidth, 'composer stays inside the phone viewport');
  await shot(page, 'arena-responsive-320');

  /* At 360px and 390px, verify fit without imposing new minimum sizes on Arena controls. */
  for (const width of [360, 390]) {
    await page.setViewport({ width, height: 740, isMobile: true, hasTouch: true });
    const layout = await page.evaluate(() => {
      const form = document.querySelector('form');
      const send = document.querySelector('button[aria-label="Send message"]');
      const r = send.getBoundingClientRect();
      return {
        width: innerWidth,
        formRight: form.getBoundingClientRect().right,
        sendRight: r.right,
        sendWidth: r.width,
        sendHeight: r.height,
        sendInlineWidth: send.style.width,
        chatForms: document.querySelectorAll('textarea[name="message"]').length,
      };
    });
    assert.ok(layout.sendRight <= layout.formRight && layout.formRight <= layout.width,
      'Send/composer overflow at ' + width + 'px: ' + JSON.stringify(layout));
    assert.equal(layout.sendWidth, 32, 'Arena’s original Send width changes at ' + width + 'px: ' + JSON.stringify(layout));
    assert.equal(layout.sendHeight, 36, 'Arena’s original button height changes at ' + width + 'px: ' + JSON.stringify(layout));
    assert.equal(layout.sendInlineWidth, '32px', 'the original Send inline width is preserved at ' + width + 'px');
    assert.equal(layout.chatForms, 1, 'responsive width created a second chat composer');
    await shot(page, 'arena-responsive-' + width);
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

  // Native style reset, button replacement, and group replacement while the engine
  // mount stays isolated under #bds-root: the cases a static Plus test misses.
  for (const mutation of ['style', 'button', 'group']) {
    stage = 'composer-remount-' + mutation;
    await page.evaluate((kind) => {
      const b = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
      if (!b) throw new Error('native Add files control missing before ' + kind);
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
    try {
      await wait(() => {
        const native = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
        const mounts = document.querySelectorAll('.bds-attach-menu-mount');
        const trigger = document.querySelector('.bds-plus-btn');
        if (!native || !trigger || mounts.length !== 1 ||
            !mounts[0].parentElement || mounts[0].parentElement.id !== 'bds-root') return false;
        const nr = native.getBoundingClientRect(); const tr = trigger.getBoundingClientRect();
        return getComputedStyle(native).display !== 'none' && getComputedStyle(native).pointerEvents !== 'none' &&
          native.style.getPropertyValue('pointer-events') === '' &&
          getComputedStyle(trigger).display !== 'none' && getComputedStyle(trigger).opacity === '0' &&
          nr.width > 0 && nr.height > 0 && tr.width > 0 && tr.height > 0;
      });
    } catch (error) {
      const diagnostic = await page.evaluate(() => {
        const native = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
        const trigger = document.querySelector('.bds-plus-btn');
        const mounts = [...document.querySelectorAll('.bds-attach-menu-mount')];
        const rect = (el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          const c = getComputedStyle(el);
          return {x:r.x,y:r.y,w:r.width,h:r.height,display:c.display,opacity:c.opacity,pointerEvents:c.pointerEvents,inlinePointer:el.style.getPropertyValue('pointer-events'),parent:el.parentElement && el.parentElement.id || el.parentElement && el.parentElement.className || null};
        };
        return {native:rect(native),trigger:rect(trigger),mountCount:mounts.length,mountParents:mounts.map(m=>m.parentElement && ({id:m.parentElement.id,className:m.parentElement.className})),pageErrors:[]};
      });
      throw new Error(String(error && error.message || error) + ' mutation=' + mutation + ' diagnostic=' + JSON.stringify(diagnostic));
    }
  }
  stage = 'attach-open-and-back';
  const nativePlusSelector = 'form button[aria-label="Add files"]:not(.bds-plus-btn)';
  try {
    await wait(() => {
      const native = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
      const trigger = document.querySelector('#bds-root .bds-plus-btn') ||
        document.querySelector('.bds-attach-menu-mount .bds-plus-btn');
      return !!(native && trigger &&
        document.querySelectorAll('.bds-attach-menu-mount').length === 1);
    });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const form = document.querySelector('textarea[name="message"]')?.closest('form');
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect(); const c = getComputedStyle(el);
        return { x:r.x, y:r.y, w:r.width, h:r.height, display:c.display,
          visibility:c.visibility, opacity:c.opacity, pointerEvents:c.pointerEvents };
      };
      const controls = form ? Array.from(form.querySelectorAll('button')).map((b) => ({
        aria:b.getAttribute('aria-label'), title:b.title, className:String(b.className || ''),
        rect:rect(b), engine:!!b.closest('#bds-root')
      })) : [];
      const trigger = document.querySelector('#bds-root .bds-plus-btn') ||
        document.querySelector('.bds-attach-menu-mount .bds-plus-btn');
      return { site:window.__sdSite && window.__sdSite.id, form:rect(form),
        nativeCount:form ? form.querySelectorAll('button[aria-label="Add files"],button[aria-label="Attach files"]').length : 0,
        native:rect(form && form.querySelector('button[aria-label="Add files"],button[aria-label="Attach files"]')),
        trigger:rect(trigger), mountCount:document.querySelectorAll('.bds-attach-menu-mount').length,
        wrapperCount:document.querySelectorAll('.bds-attach-wrapper').length,
        root:!!document.querySelector('#bds-root'), controls };
    });
    throw new Error('native Plus target never became ready: ' +
      String(error && error.message || error) + ' diagnostic=' + JSON.stringify(diagnostic));
  }
  const attachLayout = await page.evaluate((selector) => {
    const native = document.querySelector(selector);
    const trigger = document.querySelector('#bds-root .bds-plus-btn') ||
      document.querySelector('.bds-attach-menu-mount .bds-plus-btn');
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return { x:r.x, y:r.y, width:r.width, height:r.height, display:cs.display,
        opacity:cs.opacity, pointerEvents:cs.pointerEvents };
    };
    const n = rect(native), t = rect(trigger);
    const aligned = !!(n && t && Math.abs(n.x-t.x)<1 && Math.abs(n.y-t.y)<1 &&
      Math.abs(n.width-t.width)<1 && Math.abs(n.height-t.height)<1);
    return { native:n, trigger:t, aligned, bound:!!(native && native.__sdArenaSheetBound),
      mountCount:document.querySelectorAll('.bds-attach-menu-mount').length };
  }, nativePlusSelector);
  if (!attachLayout.native || attachLayout.native.width < 24 || attachLayout.native.height < 24 ||
      attachLayout.native.display === 'none' || attachLayout.native.pointerEvents === 'none' ||
      !attachLayout.trigger || attachLayout.trigger.display === 'none' ||
      attachLayout.trigger.pointerEvents !== 'none' || attachLayout.trigger.opacity !== '0' ||
      attachLayout.mountCount !== 1) {
    throw new Error('native Plus or non-blocking engine action is not ready: ' + JSON.stringify(attachLayout));
  }
  const attachTap = { x: attachLayout.native.x + attachLayout.native.width / 2,
    y: attachLayout.native.y + attachLayout.native.height / 2 };
  await page.mouse.click(attachTap.x, attachTap.y);
  try {
    await page.waitForSelector('.bds-attach-dropdown', { visible: true, timeout: 2500 });
  } catch (error) {
    const directTriggerCheck = await page.evaluate(() => {
      const trigger = document.querySelector('#bds-root .bds-plus-btn') ||
        document.querySelector('.bds-attach-menu-mount .bds-plus-btn');
      if (trigger && !trigger.disabled) trigger.click();
      return !!document.querySelector('.bds-attach-dropdown');
    });
    throw new Error('native Plus pointer tap did not open attachment sheet: ' +
      String(error && error.message || error) + ' layout=' + JSON.stringify(attachLayout) +
      ' engineTriggerOpenedSheet=' + directTriggerCheck);
  }
  await shot(page, 'arena-attach');
  await page.evaluate(() => window.__sdHandleBack());
  await page.waitForSelector('.bds-attach-backdrop', { hidden: true });
  console.log('PASS remount/style reset: original Arena + remains visible and opens the one engine sheet');

  stage = 'settings-attach-card';
  await page.evaluate(() => {
    const trigger = document.querySelector('form button[aria-label="Add files"]:not(.bds-plus-btn)');
    if (!trigger || trigger.disabled) throw new Error('native Arena Plus trigger missing before Settings-card test');
    trigger.click();
  });
  await page.waitForSelector('.bds-attach-dropdown', { visible: true });
  await wait(() => !!document.querySelector('#sd-arena-settings-item'));
  await page.waitForFunction(() => {
    const item = document.querySelector('#sd-arena-settings-item');
    const list = item && item.parentElement;
    return !!(list && /^\d+px$/.test(list.style.maxHeight) &&
      getComputedStyle(list).overflowY === 'auto');
  }, { timeout: 5000 });
  const settingsCardLayout = await page.evaluate(() => {
    const sheet = document.querySelector('.bds-attach-dropdown');
    const item = sheet && sheet.querySelector('#sd-arena-settings-item');
    const all = sheet ? Array.from(sheet.querySelectorAll('.bds-attach-item')) : [];
    const otherItems = all.filter((node) => node !== item);
    const lastExisting = otherItems[otherItems.length - 1] || null;
    const rail = document.querySelector('#bds-settings-rail');
    return {
      count: sheet ? sheet.querySelectorAll('#sd-arena-settings-item').length : 0,
      totalItemCount: all.length,
      lastCard: !!item && all[all.length - 1] === item,
      sameList: !!item && !!lastExisting && item.parentElement === lastExisting.parentElement,
      lastExistingTitle: lastExisting && lastExisting.querySelector('.bds-item-title')
        ? lastExisting.querySelector('.bds-item-title').textContent : '',
      title: item && item.querySelector('.bds-item-title') ? item.querySelector('.bds-item-title').textContent : '',
      description: item && item.querySelector('.bds-item-desc') ? item.querySelector('.bds-item-desc').textContent : '',
      list: (() => {
        const list = item && item.parentElement;
        if (!list) return null;
        const icon = item.querySelector('.bds-item-icon-box svg');
        const center = icon && icon.querySelector('circle');
        const outer = icon && icon.querySelector('path');
        return {
          overflowY: getComputedStyle(list).overflowY,
          maxHeight: list.style.maxHeight,
          clientHeight: list.clientHeight,
          scrollHeight: list.scrollHeight,
          scrollTop: list.scrollTop,
          settingsHeight: item.getBoundingClientRect().height,
          iconWidth: icon && icon.getAttribute('width'),
          iconHeight: icon && icon.getAttribute('height'),
          iconHasCenter: !!center && center.getAttribute('r') === '3',
          iconHasGearOutline: !!outer && /M12\.22 2h-.44/.test(outer.getAttribute('d') || ''),
        };
      })(),
      hasGear: !!(item && item.querySelector('.bds-item-icon-box svg')),
      railDisplay: rail ? getComputedStyle(rail).display : 'missing',
      legacySidebarRows: document.querySelectorAll('[data-bds-arena-settings-entry="true"]').length,
      drawerOpen: !!document.querySelector('#bds-drawer.bds-open'),
    };
  });
  assert.equal(settingsCardLayout.count, 1,
    'Settings appears exactly once in the existing Add to chat sheet');
  assert.equal(settingsCardLayout.lastCard, true,
    'Settings is the bottom-most tool card: ' + JSON.stringify(settingsCardLayout));
  assert.equal(settingsCardLayout.sameList, true,
    'Settings reuses the More tools card list rather than a separate overlay');
  assert.match(settingsCardLayout.title, /Settings|সেটিংস/);
  assert.match(settingsCardLayout.description, /preferences|পছন্দ/);
  assert.equal(settingsCardLayout.hasGear, true, 'Settings card has its own gear icon');
  assert.equal(settingsCardLayout.list.overflowY, 'auto',
    'the existing More tools card list has its own vertical scroll');
  assert.match(settingsCardLayout.list.maxHeight, /^\d+px$/,
    'the list scroll height is measured from the available sheet viewport');
  assert.ok(settingsCardLayout.list.scrollHeight > settingsCardLayout.list.clientHeight,
    'the Settings card is reachable by scrolling the list rather than being lost below the sheet');
  assert.equal(settingsCardLayout.list.iconWidth, '18');
  assert.equal(settingsCardLayout.list.iconHeight, '18');
  assert.equal(settingsCardLayout.list.iconHasCenter, true, 'gear icon has a clean center ring');
  assert.equal(settingsCardLayout.list.iconHasGearOutline, true, 'gear icon uses the standard settings outline');
  assert.equal(settingsCardLayout.railDisplay, 'none',
    'the old engine source rail remains hidden and cannot disturb the sidebar');
  assert.equal(settingsCardLayout.legacySidebarRows, 0,
    'the old cloned Settings row is not rendered in Arena navigation');
  await shot(page, 'arena-settings-card');

  stage = 'settings-card-scroll-reachability';
  const scrolledSettingsCard = await page.evaluate(() => {
    const item = document.querySelector('#sd-arena-settings-item');
    const list = item && item.parentElement;
    if (!list || !item) return { hasList: !!list, fullyVisible: false };
    list.scrollTop = list.scrollHeight;
    const lr = list.getBoundingClientRect();
    const ir = item.getBoundingClientRect();
    return {
      hasList: true,
      scrollTop: list.scrollTop,
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
      fullyVisible: ir.top >= lr.top - 1 && ir.bottom <= lr.bottom + 1,
      itemRect: [ir.left, ir.top, ir.right, ir.bottom],
      listRect: [lr.left, lr.top, lr.right, lr.bottom],
    };
  });
  assert.ok(scrolledSettingsCard.scrollTop > 0,
    'scrolling the list reaches Settings: ' + JSON.stringify(scrolledSettingsCard));
  assert.equal(scrolledSettingsCard.fullyVisible, true,
    'the entire Settings card, including its description and gear, fits inside the list viewport');
  await shot(page, 'arena-settings-card-scrolled');

  stage = 'settings-sheet-card-open';
  await page.click('#sd-arena-settings-item');
  await page.waitForSelector('#bds-drawer.bds-open', { visible: true, timeout: 8000 });
  await wait(() => {
    const sheet = document.querySelector('.bds-attach-dropdown');
    return !sheet || getComputedStyle(sheet).display === 'none';
  });
  const openedFromSettingsCard = await page.evaluate(() => ({
    drawerOpen: !!document.querySelector('#bds-drawer.bds-open'),
    sheetVisible: (() => {
      const sheet = document.querySelector('.bds-attach-dropdown');
      return !!(sheet && getComputedStyle(sheet).display !== 'none' &&
        getComputedStyle(sheet).visibility !== 'hidden');
    })(),
    sidebarRows: document.querySelectorAll('[data-bds-arena-settings-entry="true"]').length,
  }));
  assert.equal(openedFromSettingsCard.drawerOpen, true, 'the existing Settings drawer opens from the card');
  assert.equal(openedFromSettingsCard.sheetVisible, false, 'the Add to chat sheet closes before Settings opens');
  assert.equal(openedFromSettingsCard.sidebarRows, 0, 'opening Settings never restores a sidebar row');
  await shot(page, 'arena-settings-open');
  await page.evaluate(() => window.__sdHandleBack());
  await page.waitForSelector('.bds-drawer-backdrop', { hidden: true });
  console.log('PASS Settings card is last in Add to chat, opens the existing drawer, and leaves the sidebar untouched');

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
