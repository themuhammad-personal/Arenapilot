/**
 * Super DeepSeek — Layer 2 scenario runner.
 *
 * Usage: npm run test:harness            (all scenarios)
 *        node tools/harness/run.mjs agent-once keep-going
 *
 * Exit code is 0 when nothing FAILS (skipped scenarios are reported but do
 * not fail the run — this is the CI "report job" mode), 1 on any failure.
 */
import { scenarioResult, totals } from './report.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {
  ARTIFACTS, bridgeState, installEngine, launchBrowser, mcpCalls, openSession,
  reinstallBridge, setBeats, setSandboxOutputs, shot,
} from './harness.mjs';

const results = [];

async function until(fn, ms, step = 150) {
  const end = Date.now() + ms;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await new Promise((r) => setTimeout(r, step));
  }
}

function makeScenario(name, run) {
  return { name, run };
}

function check(failures, cond, message) {
  if (!cond) failures.push(message);
}

/** The engine keys its command composer off the site's textarea first. */
async function focusComposer(page) {
  await page.evaluate(() => {
    window.composerEl = function () {
      return document.querySelector('textarea#chat-input, [contenteditable="true"], [contenteditable=""]');
    };
    const el = window.composerEl();
    if (!el) throw new Error('composer not found');
    el.focus();
    if (el.click) el.click();
  });
}

// ─────────────────────────────────────────────────────────────────────────────

const agentOnce = makeScenario('agent-once', async (browser) => {
  const failures = [];
  const notes = [];
  const { page, consoleErrors } = await openSession(browser);
  await setSandboxOutputs(page, { 'run:ls': 'hello.py  main.py', write_file: 'wrote hello.py' });
  await setBeats(page, [
    'I will list the files first.\n<SDS:AUTO:MCP url="sandbox" tool="run">{"command":"ls -la"}</SDS:AUTO:MCP>',
    'Now I will write the script.\n<SDS:AUTO:MCP url="sandbox" tool="write_file">{"path":"hello.py","content":"print(1)"}</SDS:AUTO:MCP>',
    'All done — hello.py is written.',
  ]);
  await page.evaluate(() => window.__sdEngine.markLive());
  await page.evaluate(() => window.__fixtureSend('Please list the files and write hello.py'));

  const done = await until(() => page.evaluate(() =>
    window.__fixtureState().threadText.includes('All done') && !window.__fixtureState().streaming), 90000);
  check(failures, done, 'the agent chain never reached the final reply in 90 s');
  await shot(page, 'agent-once-final');

  const state = await bridgeState(page);
  const tools = mcpCalls(state).map((c) => c.tool);
  check(failures, tools.filter((t) => t === 'run').length === 1, `run must execute exactly once (got ${tools})`);
  check(failures, tools.filter((t) => t === 'write_file').length === 1, `write_file must execute exactly once (got ${tools})`);
  check(failures, tools.length === 2, `only the two scripted tools may run (got ${tools})`);

  const sends = await page.evaluate(() => window.__fixtureState().sends);
  check(failures, sends.length >= 3, `the quiet tool-result sends never happened (sends=${sends.length})`);
  // Quiet sends: engine auto messages (all but the user's first) must go out
  // under the quiet path with the composer hidden — never "typed" visibly.
  const quietViolations = sends.filter((s, i) => i > 0 && !(s.quiet && s.autoClass));
  check(failures, quietViolations.length === 0,
    `automatic messages must go out quietly with the composer hidden (${JSON.stringify(quietViolations.slice(0, 2))})`);

  const mutations = state.events.filter((e) => e.type === 'bds:mutation-applied');
  check(failures, mutations.length >= 1, 'injected.js did not wrap the prompt (no bds:mutation-applied)');
  check(failures, mutations.some((m) => /SuperDeepSeek/.test(String(m.detail))),
    'automatic prompts must be wrapped in <SuperDeepSeek>');
  const errors = consoleErrors.filter((e) => !/favicon|net::ERR/.test(e));
  if (errors.length) notes.push('console errors: ' + errors.slice(0, 3).join(' | '));
  await page.close();
  return { failures, notes };
});

const noRerun = makeScenario('no-rerun', async (browser) => {
  const failures = [];
  const { page } = await openSession(browser);
  await setSandboxOutputs(page, { run: 'ok' });
  await setBeats(page, [
    'Running it.\n<SDS:AUTO:MCP url="sandbox" tool="run">{"command":"echo once"}</SDS:AUTO:MCP>',
    'All done — the command finished.',
  ]);
  await page.evaluate(() => window.__sdEngine.markLive());
  await page.evaluate(() => window.__fixtureSend('Run echo once'));
  const done = await until(() => page.evaluate(() =>
    window.__fixtureState().threadText.includes('All done') && !window.__fixtureState().streaming), 60000);
  check(failures, done, 'first run never finished');
  const before = mcpCalls(await bridgeState(page)).length;

  // Reload: the page boots fresh — bridge + engine re-injected over the same
  // conversation (fixture restores it from localStorage), exactly like the app.
  await page.reload({ waitUntil: 'domcontentloaded' });
  await reinitAfterReload(page);
  await page.evaluate(() => window.__sdEngine && window.__sdEngine.reprocess());
  await page.evaluate(() => { const t = document.getElementById('thread'); if (t) t.scrollTop = 0; });
  await new Promise((r) => setTimeout(r, 4000));
  const after = mcpCalls(await bridgeState(page)).length;
  check(failures, after === before, `reload/scroll must never re-run finished tools (before=${before}, after=${after})`);

  await page.evaluate(() => window.__sdEngine.reprocess());
  await new Promise((r) => setTimeout(r, 2500));
  const again = mcpCalls(await bridgeState(page)).length;
  check(failures, again === before, `a second reprocess must not re-run either (${again} != ${before})`);
  await shot(page, 'no-rerun-after-reload');
  await page.close();
  return { failures, notes: [] };
});

async function reinitAfterReload(page) {
  await reinstallBridge(page, { restoreLog: true });
  await installEngine(page);
}

const scrollGuard = makeScenario('scroll-guard', async (browser) => {
  const failures = [];
  const { page } = await openSession(browser);
  const long = 'Line one of a long streaming reply.\n'.repeat(60);
  await setBeats(page, [long, 'done']);
  await page.evaluate(() => window.__sdEngine.markLive());
  await page.evaluate(() => window.__fixtureSend('Write a long reply'));
  await until(() => page.evaluate(() => window.__fixtureState().streaming), 15000);
  await page.evaluate(() => {
    const t = document.getElementById('thread');
    t.scrollTop = 0;
  });
  await new Promise((r) => setTimeout(r, 2500));
  const top = await page.evaluate(() => document.getElementById('thread').scrollTop);
  check(failures, top < 120, `a reader who scrolled up must not be pulled down (scrollTop=${top})`);
  await shot(page, 'scroll-guard-scrolled-up');
  await page.close();
  return { failures, notes: [] };
});

const keepGoing = makeScenario('keep-going', async (browser) => {
  const failures = [];
  const { page } = await openSession(browser);
  await setSandboxOutputs(page, { run: 'tool output' });
  await setBeats(page, [
    'Starting.\n<SDS:AUTO:MCP url="sandbox" tool="run">{"command":"echo go"}</SDS:AUTO:MCP>',
    'Now I will run the tests:',
    'Continuing, one moment:',
    'Almost there:',
    'All done, tests pass.',
  ]);
  await page.evaluate(() => window.__sdEngine.markLive());
  await page.evaluate(() => window.__fixtureSend('Do the task'));
  await until(() => page.evaluate(() => (window.__fixtureState().sends.length >= 4)), 90000);
  await new Promise((r) => setTimeout(r, 2000));
  const sends = await page.evaluate(() => window.__fixtureState().sends);
  const nudges = sends.filter((s) => String(s.composerAtSend + '').includes('Agent continue') || s.beat === 2 || s.beat === 3);
  const autoNudges = sends.filter((s) => s.beat === 2 || s.beat === 3);
  check(failures, autoNudges.length === 2,
    `keep-going must stop after 2 nudges (auto nudge responses: ${autoNudges.length}, sends: ${sends.map((s) => s.beat).join(',')})`);

  const chip = await until(() => page.evaluate(() => {
    const el = document.getElementById('sd-continue-chip');
    return el && !el.hidden ? el.id : null;
  }), 15000);
  check(failures, chip, 'after the budget is spent the Continue task chip should appear');
  await shot(page, 'keep-going-continue-chip');

  if (chip) {
    await page.evaluate(() => {
      const btns = document.querySelectorAll('#sd-continue-chip button');
      for (const b of btns) if (/Continue|চালিয়ে/.test(b.textContent)) { b.click(); return; }
    });
    const finished = await until(() => page.evaluate(() =>
      window.__fixtureState().threadText.includes('All done')), 60000);
    check(failures, finished, 'tapping Continue task should let the agent finish');
  }
  await page.close();
  return { failures, notes: [] };
});

const slashCommands = makeScenario('slash-commands', async (browser) => {
  const failures = [];
  const notes = [];
  const { page } = await openSession(browser);
  await focusComposer(page);
  await page.keyboard.type('/');
  const popup = await until(() => page.evaluate(() => {
    const el = document.querySelector('.bds-cmd-autocomplete');
    return el ? true : null;
  }), 5000);
  check(failures, popup, 'typing "/" should mount the command popup');
  const sheet = await page.evaluate(() => !!document.querySelector('.bds-cmd-help-mount'));
  check(failures, sheet, 'the command sheet mount should exist');
  const items = await page.evaluate(() => {
    const el = document.querySelector('.bds-cmd-autocomplete');
    return el ? el.textContent.trim().length : 0;
  });
  if (!items) notes.push('command list stays empty in the fixture — verify against a real-page capture');
  await shot(page, 'slash-popup');

  // Enter runs the slash command through the engine (sdRunCommand path).
  await page.keyboard.press('Backspace');
  await page.keyboard.type('help ');
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 400));
  const ran = await page.evaluate(() => {
    const el = document.querySelector('textarea#chat-input');
    const help = document.querySelector('.bds-cmd-help-mount');
    return (el && el.value.trim() === '') || /help|সাহায্য/i.test((help && help.textContent) || '');
  });
  check(failures, ran, 'Enter on "/help " should execute the command (composer clears or help sheet fills)');
  const handled = await page.evaluate(() => (window.__sdHandleBack ? window.__sdHandleBack() : false));
  check(failures, typeof handled === 'boolean', 'window.__sdHandleBack should exist for the native Back button');
  await page.close();
  return { failures, notes };
});

const settingsPages = makeScenario('settings-pages', async (browser) => {
  const failures = [];
  const notes = [];
  const { page } = await openSession(browser);
  // Discovery: the engine's own settings entry (icon button in #bds-root).
  const opened = await page.evaluate(() => {
    const root = document.getElementById('bds-root');
    if (!root) return null;
    const buttons = Array.from(root.querySelectorAll('button, [role="button"], [aria-label], [title]'));
    const entry = buttons.find((b) => /settings|সেটিংস|preferences/i.test(
      (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + b.textContent));
    if (!entry) return null;
    entry.click();
    return true;
  });
  if (!opened) {
    notes.push('settings entry not discoverable in the fixture — needs a real-page capture pass');
    await page.close();
    return { failures: [], notes, skipped: true };
  }
  await new Promise((r) => setTimeout(r, 600));
  await shot(page, 'settings-overview');
  const overview = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  check(failures, /linux|লিনাক্স/i.test(overview), 'the overview should list the Linux & Agent row');
  const linuxPageOpen = await page.evaluate(() => !!document.getElementById('sd-linux-page'));
  check(failures, !linuxPageOpen, 'the Linux card must only appear on its own page');
  await page.close();
  return { failures, notes };
});

const themes = makeScenario('themes', async (browser) => {
  const failures = [];
  const { page } = await openSession(browser);
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'light' }]);
  await page.evaluate(() => window.AndroidBridge.reportTheme(false));
  await shot(page, 'theme-light');
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]);
  await page.evaluate(() => window.AndroidBridge.reportTheme(true));
  await shot(page, 'theme-dark');
  const ok = await page.evaluate(() => !!window.__sdHandleBack && !!document.getElementById('bds-css'));
  check(failures, ok, 'the engine must stay healthy across theme switches');
  await page.close();
  return { failures, notes: [] };
});

const bidiText = makeScenario('bidi-text', async (browser) => {
  const failures = [];
  const { page } = await openSession(browser);
  // The engine's rule (engine-tags tests): a paragraph is RTL only when it
  // starts in Arabic and is mostly Arabic; mixed runs keep each script's own
  // direction inside an otherwise-LTR paragraph.
  await setBeats(page, ['مرحبا، هذا رد عربي بالكامل تقريبا، ويستمر في الكتابة بالعربية هنا.']);
  await page.evaluate(() => window.__sdEngine.markLive());
  await page.evaluate(() => window.__fixtureSend('مرحبا — হ্যালো — hello, please reply in Arabic'));
  await until(() => page.evaluate(() => window.__fixtureState().threadText.includes('مرحبا، هذا')), 30000);
  await new Promise((r) => setTimeout(r, 800));
  const dirs = await page.evaluate(() => Array.from(document.querySelectorAll('.ds-markdown p')).map((p) => ({
    text: p.textContent.slice(0, 40), dir: p.getAttribute('dir'), computed: getComputedStyle(p).direction,
  })));
  const arabic = dirs.find((d) => /^مرحبا، هذا رد عربي/.test(d.text));
  check(failures, !!arabic, 'the Arabic reply paragraph should render');
  if (arabic) {
    check(failures, arabic.dir === 'rtl' || arabic.computed === 'rtl',
      `an Arabic-leading, mostly-Arabic paragraph should be RTL (got dir=${arabic.dir}, computed=${arabic.computed})`);
  }
  const mixed = dirs.find((d) => /hello|হ্যালো/.test(d.text));
  if (mixed) {
    check(failures, mixed.dir !== 'rtl' && mixed.computed !== 'rtl',
      `a mixed-script paragraph must not become RTL (got dir=${mixed.dir}, computed=${mixed.computed})`);
  }
  await shot(page, 'bidi-mixed');
  await page.close();
  return { failures, notes: [] };
});

const sheetsDrag = makeScenario('sheets-drag', async (browser) => {
  const failures = [];
  const notes = [];
  const { page } = await openSession(browser);
  // Open whatever sheet exists: the help sheet via /help in the composer.
  await focusComposer(page);
  await page.keyboard.type('/help');
  await page.keyboard.press('Enter');
  await new Promise((r) => setTimeout(r, 800));
  const sheetOpen = await page.evaluate(() => {
    const sheets = Array.from(document.querySelectorAll('.bds-sheet, [class*="sheet"], [role="dialog"]'));
    return sheets.some((s) => s.getBoundingClientRect().height > 100);
  });
  if (!sheetOpen) {
    notes.push('no sheet opened for /help in the fixture — needs a real-page capture pass');
    await page.close();
    return { failures: [], notes, skipped: true };
  }
  await shot(page, 'sheet-open');
  // Touch drag down 220 px from the top of the sheet.
  const box = await page.evaluate(() => {
    const sheets = Array.from(document.querySelectorAll('.bds-sheet, [class*="sheet"], [role="dialog"]'));
    const s = sheets.find((x) => x.getBoundingClientRect().height > 100);
    const r = s.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + 20 };
  });
  await page.touchscreen.touchStart(box.x, box.y);
  for (let i = 1; i <= 5; i++) await page.touchscreen.touchMove(box.x, box.y + i * 44);
  await page.touchscreen.touchEnd();
  await new Promise((r) => setTimeout(r, 700));
  const closed = await page.evaluate(() => {
    const sheets = Array.from(document.querySelectorAll('.bds-sheet, [class*="sheet"], [role="dialog"]'));
    return !sheets.some((s) => s.getBoundingClientRect().height > 100);
  });
  check(failures, closed, 'dragging a sheet down should close it');
  await shot(page, 'sheet-after-drag');
  await page.close();
  return { failures, notes };
});

// ── runner ───────────────────────────────────────────────────────────────────

const ALL = {
  'agent-once': agentOnce,
  'no-rerun': noRerun,
  'scroll-guard': scrollGuard,
  'keep-going': keepGoing,
  'slash-commands': slashCommands,
  'settings-pages': settingsPages,
  themes,
  'bidi-text': bidiText,
  'sheets-drag': sheetsDrag,
};

const requested = process.argv.slice(2);
const names = requested.length ? requested : Object.keys(ALL);

const browser = await launchBrowser().catch((e) => {
  // Even a launch crash must leave a report behind for the CI artifact.
  fs.mkdirSync(ARTIFACTS, { recursive: true });
  fs.writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify([{
    name: 'browser-launch', pass: false, skipped: false,
    failures: [String(e && e.message || e)], notes: [], ms: 0,
  }], null, 2));
  console.error('browser launch failed:', e && e.message || e);
  process.exit(1);
});
for (const name of names) {
  const scenario = ALL[name];
  if (!scenario) { results.push(scenarioResult(name, { failures: ['unknown scenario'] })); console.error('unknown scenario', name); continue; }
  const started = Date.now();
  let outcome;
  try {
    outcome = await scenario.run(browser);
  } catch (e) {
    outcome = { failures: ['scenario crashed: ' + (e && e.message)], notes: [], skipped: false };
  }
  const result = scenarioResult(name, outcome, Date.now() - started);
  results.push(result);
  const mark = result.skipped ? 'SKIP' : result.pass ? 'PASS' : 'FAIL';
  console.log(`${mark} ${name} (${Date.now() - started} ms)` +
    (outcome.failures.length ? '\n  - ' + outcome.failures.join('\n  - ') : '') +
    (outcome.notes.length ? '\n  note: ' + outcome.notes.join('; ') : ''));
}
await browser.close().catch(() => {});

fs.mkdirSync(ARTIFACTS, { recursive: true });
fs.writeFileSync(path.join(ARTIFACTS, 'report.json'), JSON.stringify(results, null, 2));
const { passed, skipped, failed } = totals(results);
console.log(`\n${passed} passed, ${skipped} skipped, ${failed} failed`);
process.exit(failed ? 1 : 0);
