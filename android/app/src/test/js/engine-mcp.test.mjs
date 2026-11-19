// MCP tool calls in content.js: every call in one reply is answered with ONE
// message (so results never interleave with the next reply), and the chat
// renders every result card of such a combined message.
// Run: npm run test:engine
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = fs.readFileSync(path.join(here, '../../main/bds-assets/bds/content.js'), 'utf8');

function slice(from, to) {
  const a = CONTENT.indexOf(from);
  const b = CONTENT.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `engine code moved: ${from}`);
  return CONTENT.slice(a, b);
}

const MCP = slice('function sdMcpServer(ref)', 'function sdQuiet(f)');
const url = 'https://tools.example/mcp';

function setup({ results = {}, inlineMax = 8000 } = {}) {
  const sent = [];
  const calls = [];
  const ctx = {
    console: { log() {}, error() {}, warn() {} }, setTimeout, Promise, JSON, Math, Object, Array, String, Number, Error, Blob, File, Set,
    B: { mcpServers: [{ name: 'fixture', serverUrl: url, enabled: true }], settings: { mcpInlineMaxChars: inlineMax } },
    vb: new Set(),
    tCe: (e) => e,
    location: { href: 'https://arena.ai/c/test', pathname: '/c/test' },
    sdsIsArena: () => true, sdsArenaDirect: () => true,
    sdsArenaCapability: (name) => ctx.sdsArenaDirect() && (name !== 'mcp' || ['chat', 'search', 'webdev'].includes(ctx.__sdSite.arenaModality())),
    __sdSite: { arenaModality: () => 'chat' },
    dt() {},
    q_e: (r) => r.text,
    nc: async (text, label) => { sent.push({ kind: 'text', text, label }); return true; },
    ml: async (file, text) => { sent.push({ kind: 'file', text, name: file.name, body: await file.text() }); return true; },
    chrome: {
      runtime: {
        lastError: null,
        sendMessage(msg, cb) {
          if (msg.type === 'bds-mcp-authorize') return cb({ok:true, approval:'once'});
          assert.equal(msg.approval, 'once'); calls.push(msg.toolName);
          const r = results[msg.toolName];
          setTimeout(() => (r instanceof Error ? cb({ ok: false, error: r.message }) : cb({ ok: true, result: { text: r ?? 'ok:' + msg.toolName } })), 1);
        },
      },
    },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(MCP + ';window.nCe=nCe;window.sdMcpBlocks=sdMcpBlocks;', ctx);
  return { ctx, sent, calls };
}

const blocks = (text) => [...text.matchAll(/\[APH:AUTO_MCP_(RESULT|ERROR)\]\n(.*)\n/g)].map((m) => ({ kind: m[1], ...JSON.parse(m[2]) }));

test('one call → one quiet configured MCP result, same format as before', async () => {
  const { ctx, sent } = setup();
  await ctx.nCe(url, 'run', { command: 'ls' });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'text');
  assert.equal(sent[0].label, 'Tool result');
  assert.match(sent[0].text, /^<ArenaPilot>\n\[APH:AUTO\] MCP Result for run @ https:\/\/tools\.example\/mcp\n\[APH:AUTO_MCP_RESULT\]\n/);
  assert.match(sent[0].text, /\n\[\/APH:AUTO_MCP_RESULT\]\n<\/ArenaPilot>$/);
  assert.equal(blocks(sent[0].text)[0].content, 'ok:run');
});

test('several calls in one reply → run in order, answered by ONE message', async () => {
  const { ctx, sent, calls } = setup({ results: { read_file: new Error('no such file') } });
  const p = [
    ctx.nCe(url, 'write_file', { path: 'a', content: '1' }),
    ctx.nCe(url, 'read_file', { path: 'b' }),
    ctx.nCe(url, 'run', { command: 'node a' }),
  ];
  await Promise.all(p);
  assert.deepEqual(calls, ['write_file', 'read_file', 'run']);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].label, 'Tool results');
  const b = blocks(sent[0].text);
  assert.deepEqual(b.map((x) => [x.kind, x.toolName]), [['RESULT', 'write_file'], ['ERROR', 'read_file'], ['RESULT', 'run']]);
  assert.equal(b[1].error, 'no such file');
  assert.equal((sent[0].text.match(/<ArenaPilot>/g) || []).length, 1);
});

test('a big single remote result is attached as a file; in a batch it is truncated inline', async () => {
  const big = 'x'.repeat(50);
  let { ctx, sent } = setup({ results: { run: big }, inlineMax: 10 });
  await ctx.nCe(url, 'run', { command: 'cat' });
  assert.equal(sent[0].kind, 'file');
  assert.equal(sent[0].body, big);
  assert.match(blocks(sent[0].text)[0].content, /full content in attached file/);

  ({ ctx, sent } = setup({ results: { run: big }, inlineMax: 10 }));
  await Promise.all([ctx.nCe(url, 'run', { command: 'cat' }), ctx.nCe(url, 'status', {})]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'text');
  assert.match(blocks(sent[0].text)[0].content, /^x{10}\n\n\.\.\.\[truncated/);
});

test('Stop drops tool results; an identical external call is not repeated', async () => {
  let { ctx, sent } = setup();
  ctx.__sdAgentStopped = true;
  await ctx.nCe(url, 'run', { command: 'ls' });
  assert.equal(sent.length, 0);

  ({ ctx, sent } = setup());
  await ctx.nCe(url, 'search', { q: 1 });
  await ctx.nCe(url, 'search', { q: 1 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].kind, 'text');
});

test('later batches wait for the earlier one', async () => {
  const { ctx, sent } = setup();
  const a = ctx.nCe(url, 'run', { command: '1' });
  await new Promise((r) => setTimeout(r, 0));
  const b = ctx.nCe(url, 'run', { command: '2' });
  await Promise.all([a, b]);
  assert.equal(sent.length, 2);
  assert.deepEqual(sent.map((s) => blocks(s.text)[0].args.command), ['1', '2']);
});

test('renderer parses every result and error card of a combined message', () => {
  const { ctx } = setup();
  const msg = [
    '<ArenaPilot>',
    '[APH:AUTO] MCP Result for run @ sandbox://linux', '[APH:AUTO_MCP_RESULT]',
    JSON.stringify({ serverName: url, toolName: 'run', args: { command: 'ls' }, content: 'a\nb' }),
    '[/APH:AUTO_MCP_RESULT]', '',
    '[APH:AUTO] MCP call failed for read_file @ sandbox://linux', '[APH:AUTO_MCP_ERROR]',
    JSON.stringify({ serverName: url, toolName: 'read_file', args: {}, error: 'nope' }),
    '[/APH:AUTO_MCP_ERROR]',
    '</ArenaPilot>',
  ].join('\n');
  const b = JSON.parse(JSON.stringify(ctx.sdMcpBlocks(msg)));
  assert.deepEqual(b.map((x) => [x.name, x.attrs.toolName, x.content]), [
    ['auto:mcp_result', 'run', 'a\nb'],
    ['auto:mcp_error', 'read_file', 'nope'],
  ]);
  assert.equal(b[0].attrs.args, '{"command":"ls"}');
  assert.equal(ctx.sdMcpBlocks('hello').length, 0);
});

test('old local references, unconfigured URLs and disabled endpoints never reach the bridge', async () => {
  const {ctx, sent, calls} = setup();
  for (const ref of ['sandbox', 'sandbox://linux', 'https://other.example/mcp']) await ctx.nCe(ref, 'run', {});
  ctx.B.mcpServers[0].enabled = false;
  await ctx.nCe('fixture', 'run', {});
  assert.deepEqual(calls, []); assert.deepEqual(sent, []);
});

test('a pending result and remaining batch calls stay in their originating Direct chat', async () => {
  for (const navigate of [c=>c.sdsArenaDirect=()=>false, c=>c.location.pathname='/c/another', c=>c.__sdSite.arenaModality=()=>'image']) {
    const {ctx, sent, calls} = setup();
    ctx.chrome.runtime.sendMessage = (m, cb) => { if(m.type==='bds-mcp-authorize')return cb({ok:true,approval:'once'}); calls.push(m.toolName); navigate(ctx); cb({ok:true,result:{text:'first chat'}}); };
    await Promise.all([ctx.nCe('fixture','first',{}), ctx.nCe('fixture','second',{})]);
    assert.deepEqual(calls, ['first']); assert.deepEqual(sent, []);
  }
});


test('Stop then resume cannot deliver the old response or start its sibling, but new work runs', async () => {
  const {ctx, sent, calls} = setup();
  let started, finish;
  const waiting = new Promise(r => { started = r; });
  ctx.chrome.runtime.sendMessage = (m, cb) => {
    if (m.type === 'bds-mcp-authorize') return cb({ok:true, approval:'once'});
    calls.push(m.toolName);
    if (m.toolName === 'slow') { finish = cb; started(); }
    else cb({ok:true, result:{text:'new task'}});
  };
  const old = Promise.all([ctx.nCe('fixture','slow',{}), ctx.nCe('fixture','obsolete',{})]);
  await waiting;
  ctx.__sdAgentStopped = true; ctx.__sdAgentStopEpoch = 1;
  ctx.__sdAgentStopped = false;
  const next = ctx.nCe('fixture','current',{});
  finish({ok:true,result:{text:'old task'}});
  await Promise.all([old, next]);
  assert.deepEqual(calls, ['slow','current']);
  assert.deepEqual(sent.map(x => blocks(x.text)[0].toolName), ['current']);
});

test('two Direct conversations may independently use the same server, tool and arguments', async () => {
  const {ctx, sent, calls} = setup();
  for (const thread of ['/c/one','/c/two']) {
    ctx.location.pathname = thread;
    await ctx.nCe('fixture','lookup',{q:'same'});
    await ctx.nCe('fixture','lookup',{q:'same'});
  }
  assert.deepEqual(calls, ['lookup','lookup']);
  assert.equal(sent.length, 2);
});


test('denial cancels the batch without calling, prompting again, or posting a fake result', async () => {
  const {ctx,sent}=setup(); const ops=[];
  ctx.chrome.runtime.sendMessage=(p,cb)=>{ops.push(p.type);cb({ok:false,code:'permission',error:'Denied'});};
  await Promise.all([ctx.nCe('fixture','lookup',{}),ctx.nCe('fixture','second',{})]);
  await ctx.nCe('fixture','lookup',{});
  assert.deepEqual(ops,['bds-mcp-authorize']); assert.deepEqual(sent,[]);
});
test('navigation while the native permission dialog is open cannot authorize a call in the next chat',async()=>{
  const {ctx,sent}=setup();const ops=[];
  ctx.chrome.runtime.sendMessage=(p,cb)=>{ops.push(p.type);ctx.location.pathname='/c/new';cb({ok:true,approval:'bound'});};
  await ctx.nCe('fixture','lookup',{}); assert.deepEqual(ops,['bds-mcp-authorize']);assert.deepEqual(sent,[]);
});

function discovery() {
  const callbacks=[],status={textContent:''};
  const row={id:'s',name:'calendar',enabled:true,serverUrl:url,apiKey:'fixture-not-a-message'};
  const ctx=vm.createContext({B:{mcpServers:[row],mcpToolSchemas:[]},sdT:s=>s,document:{getElementById:()=>status},
    chrome:{runtime:{sendMessage:(message,cb)=>callbacks.push({message,cb})}}});
  vm.runInContext(slice('const nmt=','function amt(')+slice('const sdMcpStates=', 'function Pme('),ctx);
  const settle=()=>new Promise(resolve=>setImmediate(resolve));
  const answer=(index,name)=>callbacks[index].cb({ok:true,tools:[{name,inputSchema:{type:'object'}}]});
  return {ctx,row,status,callbacks,settle,answer};
}
test('disconnection wins over discovery already in flight, including the visible status',async()=>{
  const {ctx,row,status,callbacks,settle,answer}=discovery();const first=ctx.m1();await settle();
  assert.equal(status.textContent,'calendar: Connecting…');assert.equal(callbacks[0].message.apiKey,undefined);
  row.enabled=false;await ctx.m1();answer(0,'lookup');await first;
  assert.equal(ctx.B.mcpToolSchemas.length,0);assert.equal(status.textContent,'calendar: Disconnected');
});
test('failed discovery advertises no tools; recovery and a rename invalidate stale names',async()=>{
  const {ctx,row,status,callbacks,settle,answer}=discovery();let list=ctx.m1();await settle();callbacks[0].cb({ok:false,code:'authentication'});
  await list;assert.match(status.textContent,/Unavailable \(authentication\)/);assert.equal(ctx.B.mcpToolSchemas.length,0);
  list=ctx.m1();await settle();answer(1,'today');await list;assert.match(status.textContent,/Connected · 1/);
  assert.equal(ctx.B.mcpToolSchemas[0].serverName,'calendar');await ctx.m1();assert.equal(callbacks.length,2);
  row.name='schedule';list=ctx.m1();await settle();answer(2,'week');await list;assert.equal(ctx.B.mcpToolSchemas[0].serverName,'schedule');
});
