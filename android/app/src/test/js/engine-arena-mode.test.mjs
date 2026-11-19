import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const dir = new URL('../../main/bds-assets/bds/', import.meta.url);
const site = fs.readFileSync(new URL('sd-site.js', dir), 'utf8');
const bundle = fs.readFileSync(new URL('content.js', dir), 'utf8');
const gate = bundle.slice(bundle.indexOf('function sdsArenaCapability(name){'), bundle.indexOf('\nfunction sdsArenaMessages()'));

function load(pathname = '/c/conversation', label = 'Direct', host = 'arena.ai') {
  const control = { textContent: label };
  const form = { querySelector: () => control };
  const ctx = vm.createContext({ window: {}, location: { host, pathname }, document: { querySelector: () => ({ closest: () => form }) } });
  vm.runInContext(site, ctx);
  vm.runInContext(gate, ctx);
  return { ctx, control, mode: () => ctx.window.__sdSite.arenaMode(), gate: () => vm.runInContext('sdsArenaDirect()', ctx), capability: (name) => ctx.window.__sdSite.arenaCapabilities()[name] };
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

test('unknown routes and unsupported modes receive no Arena shared-engine capabilities; Agent gets context only', () => {
  const keys = ['sharedUi','promptContext','assistantScanning','mcp','continuity','memories','projects','personasSkills'];
  for (const route of ['/text/battle','/text/side-by-side','/c/conversation']) {
    const p = load(route, route === '/c/conversation' ? '' : 'Direct');
    assert.deepEqual(JSON.parse(JSON.stringify(p.ctx.window.__sdSite.arenaCapabilities())),
      Object.fromEntries(keys.map((key) => [key, false])), route);
  }
  for (const route of ['/agent','/text/agent','/code/agent']) {
    const caps = JSON.parse(JSON.stringify(load(route, 'Agent').ctx.window.__sdSite.arenaCapabilities()));
    assert.equal(caps.agentContext, true, route);
    for (const key of ['sharedUi','assistantScanning','mcp','continuity','memories']) assert.equal(caps[key], false, `${route} ${key}`);
  }
  const direct = load('/text/direct');
  assert.equal(direct.capability('sharedUi'), true);
  assert.equal(direct.capability('memories'), true);
  direct.ctx.location = null; // arenaMode() now throws while reading the route
  assert.equal(direct.capability('mcp'), false, 'resolver exceptions fail closed');
});

test('missing profile or failing mode detector never falls back to accepting all /c/ chats', () => {
  const p = load();
  p.ctx.window.__sdSite = undefined;
  assert.equal(p.gate(), false);
  p.ctx.window.__sdSite = { arenaMode() { throw new Error('detached DOM'); } };
  assert.equal(p.gate(), false);
  assert.equal(load('/chat/s/id', 'Direct', 'chat.deepseek.com').mode(), null);
});
