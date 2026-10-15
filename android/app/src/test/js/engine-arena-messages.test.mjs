// Arena message scanning — the contract of dexforint/arena-utils, the Chrome
// extension verified working on arena.ai today (2026-10). The previous scanner
// knew only two list selectors, always reversed its result and had never heard
// of arena's zero-height spacer rows; on the real site that combination yields
// zero or misclassified rows, which is exactly "raw SDS code in the chat, no
// widgets, no sandbox". These tests run the REAL scanner functions against
// fake pages shaped like the live DOM ground truth:
//
//   - four list selectors, first match in SELECTOR order wins;
//   - rows with class h-0 or without .prose are not messages;
//   - a user row wears justify-end or a direct .group/.self-end child —
//     user content is prose too, so prose alone never means assistant;
//   - order follows the page's computed flex-direction, never the selector name.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const content = fs.readFileSync(new URL('../../main/bds-assets/bds/content.js', import.meta.url), 'utf8');
const SCANNER = content.slice(
  content.indexOf('function sdsArenaDirect('),
  content.indexOf('function sdsArenaObserveMessages('),
);

// ── a small selector engine: compounds, descendant chains, ':scope > .x' ────

function classes(node) { return String(node.getAttribute('class') || '').split(/\s+/).filter(Boolean); }

function matchCompound(node, sel) {
  const m = /^([a-zA-Z][\w-]*|\*)?((?:[.#][\w-]+|\[[^\]]+\])*)$/.exec(sel);
  if (!m) return false;
  if (m[1] && m[1] !== '*' && node.tagName !== m[1].toUpperCase()) return false;
  const tokens = (m[2] || '').match(/[.#][\w-]+|\[[^\]]+\]/g) || [];
  return tokens.every((t) => {
    if (t[0] === '.') return classes(node).includes(t.slice(1));
    if (t[0] === '#') return node.getAttribute('id') === t.slice(1);
    const a = /^\[([^=~^$*]+)(?:=(["']?)([^"'\]]*)\2)?\]$/.exec(t);
    if (!a) return false;
    const v = node.getAttribute(a[1]);
    return a[2] === undefined ? v !== null : v === a[3];
  });
}

function matchSelector(node, selector, scope) {
  return String(selector).split(',').some((alt) => {
    alt = alt.trim();
    const scoped = /^:scope\s*>\s*(.+)$/.exec(alt);
    if (scoped) {
      // `:scope > x` inside querySelector(root): a DIRECT child of the root
      // (element.matches() can never satisfy it — an element is not its own parent).
      return !!scope && node.parentElement === scope && matchSelector(node, scoped[1].trim(), scope);
    }
    const parts = alt.split(/\s+/).filter(Boolean);
    return matchChain(node, parts);
  });
}
function matchChain(node, parts) {
  if (!matchCompound(node, parts[parts.length - 1])) return false;
  if (parts.length === 1) return true;
  for (let p = node.parentElement; p; p = p.parentElement) if (matchChain(p, parts.slice(0, -1))) return true;
  return false;
}

function descendants(root) { const out = []; (function walk(n) { n.children.forEach((c) => { out.push(c); walk(c); }); })(root); return out; }

function el(tag, attrs = {}, kids = []) {
  const node = {
    nodeType: 1, tagName: tag.toUpperCase(), children: [], parentElement: null,
    get className() { return node.getAttribute('class') || ''; },
    get classList() { const c = classes(node); return { contains: (x) => c.includes(x) }; },
    getAttribute: (n) => Object.prototype.hasOwnProperty.call(attrs, n) ? attrs[n] : null,
    matches: (sel) => matchSelector(node, sel),
    closest(sel) { for (let n = node; n; n = n.parentElement) if (matchSelector(n, sel)) return n; return null; },
    querySelector(sel) { return descendants(node).find((d) => matchSelector(d, sel, node)) || null; },
    querySelectorAll(sel) { return descendants(node).filter((d) => matchSelector(d, sel, node)); },
  };
  kids.forEach((k) => { k.parentElement = node; node.children.push(k); });
  return node;
}
const prose = (text) => el('div', { class: 'prose' }, [el('p', {}, [], text)]);
const row = (cls, kids) => el('li', cls ? { class: cls } : {}, kids);

/** A fake page + vm running the real scanner. `dir` maps list nodes to their
 *  computed flex-direction, exactly what getComputedStyle reports live. */
function page({ tree, dir = new Map(), mode = 'direct', containers } = {}) {
  const htmlRoot = tree;
  const computed = dir;
  const ctx = vm.createContext({
    window: { __sdSite: { arenaMode: () => mode } },
    document: {
      body: htmlRoot,
      querySelector: (sel) => descendants(htmlRoot).find((d) => matchSelector(d, sel)) || null,
      querySelectorAll: (sel) => descendants(htmlRoot).filter((d) => matchSelector(d, sel)),
    },
    getComputedStyle: (n) => ({ flexDirection: computed.get(n) || 'column' }),
    Ki: { getConfig: (k) => (k === 'selectors.message.containers' ? containers : undefined) },
  });
  vm.runInContext(SCANNER, ctx);
  return ctx;
}

test('reversed list: h-0 and prose-less rows skipped, order flipped to oldest-first', () => {
  const newest = row('assistant', [prose('newest answer')]);
  const user = row('justify-end', [prose('hi')]);
  const older = row('assistant', [prose('older answer')]);
  const spacer = row('h-0', []);
  const streaming = row('assistant', [el('div', { class: 'spinner' })]);
  const list = el('ol', { class: 'flex-col-reverse' }, [newest, user, older, spacer, streaming]);
  const ctx = page({ tree: el('html', {}, [el('body', {}, [el('main', {}, [list])])]), dir: new Map([[list, 'column-reverse']]) });
  const rows = ctx.sdsArenaMessages();
  assert.equal(rows.length, 3, 'h-0 spacer and prose-less streaming row are not messages');
  assert.ok(rows.length === 3 && rows[0] === older && rows[1] === user && rows[2] === newest, 'reversed DOM comes back oldest-first');
  assert.equal(ctx.sdsArenaRole(older), 'assistant');
  assert.equal(ctx.sdsArenaRole(user), 'user', 'user rows are prose too — prose alone must not mean assistant');
  assert.equal(ctx.sdsArenaRole(newest), 'assistant');
});

test('plain ol.mt-8 list: found by the fourth selector, DOM order kept as-is', () => {
  const user = row('justify-end', [prose('hi')]);
  const answer = row('assistant', [prose('answer')]);
  const list = el('ol', { class: 'mt-8' }, [user, answer, row('h-0', [])]);
  const ctx = page({ tree: el('html', {}, [el('body', {}, [el('main', {}, [list])])]), dir: new Map([[list, 'column']]) });
  const rows = ctx.sdsArenaMessages();
  assert.ok(rows.length === 2 && rows[0] === user && rows[1] === answer, 'plain lists are NOT reversed');
  assert.equal(rows[rows.length - 1], answer, 'the newest row is still last for the last-assistant lookup');
});

test('selector order wins over document order, and main-scoped lists take precedence', () => {
  // An ol.mt-8 appears FIRST in the document, but a flex-col-reverse exists —
  // the engine must use the reversed list because its selector ranks earlier.
  const plainUser = row('justify-end', [prose('decoy')]);
  const plainList = el('ol', { class: 'mt-8' }, [plainUser]);
  const revUser = row('justify-end', [prose('real')]);
  const revAnswer = row('assistant', [prose('real answer')]);
  const revList = el('ol', { class: 'flex-col-reverse' }, [revAnswer, revUser]); // newest-first DOM
  const main = el('main', {}, [plainList, revList]);
  const ctx = page({ tree: el('html', {}, [el('body', {}, [main])]), dir: new Map([[revList, 'column-reverse'], [plainList, 'column']]) });
  const rows = ctx.sdsArenaMessages();
  assert.ok(rows.length === 2 && rows[0] === revUser && rows[1] === revAnswer, 'the flex-col-reverse list wins over an earlier-in-document mt-8');
});

test('user rows without justify-end: direct .group / .self-end children mark the user', () => {
  const groupUser = row('', [el('div', { class: 'group max-w-[80%]' }, [prose('group user')])]);
  const selfEndUser = row('', [el('div', { class: 'self-end' }, [prose('self-end user')])]);
  const nestedGroup = row('', [el('div', { class: 'wrap' }, [el('div', { class: 'group' }, [prose('nested group is not a user marker')])])]);
  const answer = row('assistant', [prose('answer')]);
  const list = el('ol', { class: 'mt-8' }, [groupUser, selfEndUser, nestedGroup, answer]);
  const ctx = page({ tree: el('html', {}, [el('body', {}, [el('main', {}, [list])])]), dir: new Map([[list, 'column']]) });
  const rows = ctx.sdsArenaMessages();
  assert.equal(rows.length, 4);
  assert.equal(ctx.sdsArenaRole(groupUser), 'user');
  assert.equal(ctx.sdsArenaRole(selfEndUser), 'user');
  assert.equal(ctx.sdsArenaRole(nestedGroup), 'assistant', 'a .group that is not a DIRECT child is not a user marker (arena-utils: `:scope > .group`)');
  assert.equal(ctx.sdsArenaRole(answer), 'assistant');
});

test('engine-owned rows inside #bds-root never enter the message list', () => {
  const answer = row('assistant', [prose('answer')]);
  const ours = row('', [prose('widget text')]);
  const mount = el('div', { id: 'bds-root' }, [ours]);
  const list = el('ol', { class: 'mt-8' }, [answer, mount]);
  const ctx = page({ tree: el('html', {}, [el('body', {}, [el('main', {}, [list])])]), dir: new Map([[list, 'column']]) });
  const rows = ctx.sdsArenaMessages();
  assert.ok(rows.length === 1 && rows[0] === answer, 'a row mounted under our own root is dropped even though it has prose');
});

test('non-direct modes scan nothing, whatever the DOM looks like', () => {
  const user = row('justify-end', [prose('hi')]);
  const answer = row('assistant', [prose('answer')]);
  const list = el('ol', { class: 'flex-col-reverse' }, [answer, user]);
  const ctx = page({ tree: el('html', {}, [el('body', {}, [el('main', {}, [list])])]), dir: new Map([[list, 'column-reverse']]), mode: 'side-by-side' });
  assert.equal(ctx.sdsArenaMessages().length, 0, 'side-by-side and battle modes are not scanned');
});

test('the profile containers list is honoured when present', () => {
  const profiled = row('assistant', [prose('profiled')]);
  const profiledUser = row('justify-end', [prose('hi')]);
  const good = el('ol', { class: 'only-this' }, [profiledUser, profiled]);
  const other = el('ol', { class: 'mt-8' }, [row('assistant', [prose('ignored')])]);
  const ctx = page({
    tree: el('html', {}, [el('body', {}, [el('main', {}, [good, other])])]),
    dir: new Map([[good, 'column']]),
    containers: ['ol.only-this'],
  });
  const got = ctx.sdsArenaMessages();
  assert.ok(got.length === 2 && got[0] === profiledUser && got[1] === profiled, 'scanning uses the shipped profile selectors');
});

test('sdsArenaRole agrees with row classification for every row type (W_ only ever receives rows)', () => {
  const user = row('justify-end', [prose('hi')]);
  const answer = row('assistant', [prose('answer')]);
  const list = el('ol', { class: 'mt-8' }, [user, answer]);
  const ctx = page({ tree: el('html', {}, [el('body', {}, [el('main', {}, [list])])]), dir: new Map([[list, 'column']]) });
  assert.equal(ctx.sdsArenaRole(user), 'user');
  assert.equal(ctx.sdsArenaRole(answer), 'assistant');
  assert.equal(ctx.sdsArenaRole(row('h-0', [])), 'unknown', 'spacers are not classified');
  assert.equal(ctx.sdsArenaRole(el('p')), 'unknown', 'a detached node without structure is unknown');
});
