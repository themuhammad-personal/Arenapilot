import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../../main/bds-assets/bds/', import.meta.url);
const site = fs.readFileSync(new URL('sd-site.js', dir), 'utf8');
const bundle = fs.readFileSync(new URL('content.js', dir), 'utf8');
const gate = bundle.slice(bundle.indexOf('function sdsArenaDirect(){'), bundle.indexOf('\nfunction sdsArenaMessages()'));

function load(pathname = '/c/conversation', label = 'Direct', host = 'arena.ai') {
  const control = { textContent: label };
  const form = { querySelector: () => control };
  const ctx = vm.createContext({ window: {}, location: { host, pathname }, document: { querySelector: () => ({ closest: () => form }) } });
  vm.runInContext(site, ctx);
  vm.runInContext(gate, ctx);
  return { ctx, control, mode: () => ctx.window.__sdSite.arenaMode(), gate: () => vm.runInContext('sdsArenaDirect()', ctx) };
}

test('a shared conversation URL is not enough to permit Arena tool scanning', () => {
  for (const label of ['', 'Model name', 'Unknown new mode']) {
    const p = load('/c/conversation', label);
    assert.equal(p.mode(), 'unknown');
    assert.equal(p.gate(), false);
  }
  const p = load();
  assert.equal(p.gate(), true);
  p.control.textContent = 'Side-by-side';
  assert.equal(p.mode(), 'unsupported');
  assert.equal(p.gate(), false);
  p.control.textContent = 'Direct Chat';
  assert.equal(p.gate(), true);
});

test('unsupported route overrides a stale Direct control; non-chat routes fail closed', () => {
  for (const route of ['/text/battle', '/text/side-by-side', '/text/arena', '/text/agent', '/leaderboard', '/c/id/extra']) {
    assert.equal(load(route).gate(), false, route);
  }
  assert.equal(load('/text/direct', '').gate(), true, 'explicit Direct home route is authoritative before hydration');
  assert.equal(load('/text/direct', 'Battle').gate(), false, 'a mode transition cannot temporarily permit Battle tags');
});

test('missing profile or failing mode detector never falls back to accepting all /c/ chats', () => {
  const p = load();
  p.ctx.window.__sdSite = undefined;
  assert.equal(p.gate(), false);
  p.ctx.window.__sdSite = { arenaMode() { throw new Error('detached DOM'); } };
  assert.equal(p.gate(), false);
  assert.equal(load('/chat/s/id', 'Direct', 'chat.deepseek.com').mode(), null);
});
