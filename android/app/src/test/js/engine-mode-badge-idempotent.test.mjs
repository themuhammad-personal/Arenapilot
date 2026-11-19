// Regression: the mode-badge sync runs from a childList/subtree MutationObserver
// on the very list it edits. Assigning textContent replaces the text node, which
// is itself a childList mutation, so an unconditional write re-triggered the
// observer forever and froze the page (the Chromium Arena harness timed out on
// "Runtime.callFunctionOn"). The sync must write only when the text changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const content = fs.readFileSync(new URL('../../main/bds-assets/bds/content.js', import.meta.url), 'utf8');
const src = content.slice(content.indexOf('function sdSyncModeBadges('), content.indexOf('function sdPersonaPanel('));

test('syncing mode badges is idempotent: no DOM write when the badge already shows the text', () => {
  let writes = 0, text = '', attached = false;
  const badge = { get textContent() { return text; }, set textContent(v) { writes++; text = v; }, className: '', remove() { attached = false; } };
  const column = { appendChild() { attached = true; } };
  const row = { querySelector: (sel) => (sel === '.sd-item-modes' ? (attached ? badge : null) : column) };
  const ctx = vm.createContext({
    document: { createElement: () => badge },
    sdFormatModesBadge: (modes) => (Array.isArray(modes) && modes.length ? modes.join('/') : ''),
  });
  vm.runInContext(src, ctx);
  const list = { querySelectorAll: () => [row] };
  const items = [{ modes: ['webdev'] }];
  for (let i = 0; i < 5; i++) ctx.sdSyncModeBadges(list, items, 0);
  assert.equal(text, 'webdev');
  assert.equal(writes, 1, 'a repeated sync must not touch the DOM again');
  items[0].modes = ['chat', 'webdev'];
  ctx.sdSyncModeBadges(list, items, 0);
  ctx.sdSyncModeBadges(list, items, 0);
  assert.equal(text, 'chat/webdev');
  assert.equal(writes, 2);
});
