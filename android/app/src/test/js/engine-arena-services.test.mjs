// DeepSeek's own services must not be called from an arena.ai page.
//
// The engine ships a status monitor (it polls status.deepseek.com and can show a
// "DeepSeek has an incident" banner) and a pricing loader (it reads DeepSeek's
// pricing docs). Both start at boot, unconditionally. The arena profile meant to
// switch them off with `statusUrl: ''` and an empty pricing URL — but
//
//   * the status URL reader treats an EMPTY string as "use the built-in default":
//     `typeof e == "string" && e.trim() ? e.trim() : axt`, and `axt` is
//     https://status.deepseek.com/...;
//   * the pricing loader never reads the config at all: `LH = {official:
//     "https://api-docs.deepseek.com/..."}` is a constant.
//
// So on arena every page load went to two DeepSeek hosts, and a DeepSeek outage
// could have painted a banner in an arena app. A feature flag could not help
// either: `features.statusMonitor.enabled` and its siblings are never READ by any
// code (only attachMenu.* and fileUpload.imagesEnabled are). The fix is a guard at
// the two start points.
//
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/content.js'), 'utf8');
const times = (needle) => CONTENT.split(needle).length - 1;

function fnSource(name) {
  const start = CONTENT.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `${name} is gone from content.js`);
  const brace = CONTENT.indexOf('{', start);
  let depth = 0;
  for (let i = brace; i < CONTENT.length; i += 1) {
    if (CONTENT[i] === '{') depth += 1;
    else if (CONTENT[i] === '}') { depth -= 1; if (depth === 0) return CONTENT.slice(start, i + 1); }
  }
  throw new Error(`unbalanced braces after ${name}`);
}

/** The real S1e() (status-monitor start), with a spy where it would fetch. */
function startStatusMonitor(siteId) {
  const calls = { fetches: 0, listeners: 0 };
  const ctx = vm.createContext({
    window: { __sdSite: siteId ? { id: siteId } : undefined },
    document: { hidden: false, addEventListener() { calls.listeners += 1; } },
    nf: null,
    cT: false,
    YQ: () => { calls.fetches += 1; return Promise.resolve(); },
    nC() {},
    C1e() {}, // the visibilitychange handler S1e registers
    dt() {},
  });
  vm.runInContext(`${fnSource('sdsIsArena')}\n${fnSource('S1e')}`, ctx);
  vm.runInContext('S1e()', ctx);
  return calls;
}

// ── 1. the status monitor ───────────────────────────────────────────────────

test('on arena the status monitor never starts: no fetch, no visibility listener', () => {
  assert.deepEqual(startStatusMonitor('arena'), { fetches: 0, listeners: 0 });
});

test('on DeepSeek — and with no site profile at all — it starts exactly as before', () => {
  assert.deepEqual(startStatusMonitor('deepseek'), { fetches: 1, listeners: 1 });
  assert.deepEqual(startStatusMonitor(undefined), { fetches: 1, listeners: 1 });
});

test('the guard is the FIRST thing S1e does, and S1e has exactly one caller (the boot chain)', () => {
  assert.ok(fnSource('S1e').startsWith('function S1e(){if(sdsIsArena())return;if(!nf){'));
  assert.equal(times('S1e()'), 2, 'the definition (`function S1e(){`) and one call');
  assert.equal(times('S1e(),hxt()'), 1, 'and that call is in the boot chain');
});

test('the empty-string trap is documented where it bites: b1e() falls back to DeepSeek’s URL', () => {
  // If this ever changes, `statusUrl: ''` would start to mean "off" and the guard could be revisited.
  assert.ok(fnSource('b1e').includes('typeof e=="string"&&e.trim()?e.trim():axt'));
  assert.ok(CONTENT.includes('axt="https://status.deepseek.com/api/widget/v1/summary.json"'));
});

// ── 2. the pricing loader ───────────────────────────────────────────────────

test('the boot-time pricing fetch is skipped on arena, and left alone elsewhere', () => {
  const guarded = '(sdsIsArena()?Promise.resolve(null):ext()).then(l=>{l&&l.models&&(B.embeddedPricing=l,Op())}).catch(()=>{})';
  assert.equal(times(guarded), 1);
  assert.equal(times('ext().then('), 0, 'no unguarded start remains');
  // ext() itself is untouched: DeepSeek still gets its live pricing, then the built-in table
  assert.ok(fnSource('ext').includes('await txt()') && fnSource('ext').includes('await nxt()'));
});

test('the pricing URL is a constant, not config — which is why an empty api.pricing never worked', () => {
  assert.ok(CONTENT.includes('LH={official:"https://api-docs.deepseek.com/quick_start/pricing/",github:""}'));
});

// ── 3. every DeepSeek URL in the bundle is accounted for ────────────────────
//
// A bundle sync can bring in a new DeepSeek call. This fails the moment the set
// of URLs, or how often each appears, changes — so a new one is classified on
// purpose instead of discovered on a user's phone.

const KNOWN = {
  // config defaults (overridden on arena) — PH.api.pricing.officialUrl / the hardcoded LH.official (guarded above)
  'https://api-docs.deepseek.com/quick_start/pricing/': 2,
  // the API playground: a page the user opens, talking to the API with the user's own key — never at boot
  'https://api.deepseek.com': 2,
  'https://api.deepseek.com/beta': 2,
  'https://api.deepseek.com/user/balance': 2,
  // PH.urlPatterns.base (overridden on arena) and the __sdUrl seams' DeepSeek fallbacks (Phase 3)
  'https://chat.deepseek.com/': 5,
  'https://chat.deepseek.com': 1,
  // PH.api.statusUrl and the b1e() fallback (guarded above)
  'https://status.deepseek.com/api/widget/v1/summary.json': 2,
};

test('every DeepSeek URL in content.js is classified, with its count', () => {
  const found = {};
  for (const m of CONTENT.matchAll(/https?:\/\/[A-Za-z0-9.-]*deepseek\.com[A-Za-z0-9_/.\-?=&%]*/g)) found[m[0]] = (found[m[0]] || 0) + 1;
  assert.deepEqual(found, KNOWN,
    'a DeepSeek URL appeared, vanished or changed count in content.js — decide what it does on arena, then update KNOWN');
});
