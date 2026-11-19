// Execute the production project/store helpers, then reboot them from their serialized data.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const src=fs.readFileSync(new URL('../../main/bds-assets/bds/content.js',import.meta.url),'utf8');
function part(a,b){const i=src.indexOf(a),j=src.indexOf(b,i);assert.ok(i>=0&&j>i,a);return src.slice(i,j)}
const code=part('function w_(){','async function I8t(')+part('function fA(','class tut')+part('function QQ(','function Gme(')+part('function oS(','const rxe=');
const turn=()=>new Promise(done=>setImmediate(done));
function boot(store={}){
 let seq=0;const events=[];const c={B:{projects:[],projectFiles:[],settings:{},memories:{},characters:[],skills:[],mcpServers:[],deepResearch:{},deepCode:{}},
 location:{pathname:'/c/alpha'},sdsIsArena:()=>true,sdsArenaDirect:()=>true,sdsArenaCapability:()=>true,Us:()=>`p${++seq}`,TD:async()=>{},st:{projects:'bds_projects',projectFiles:'bds_project_files',memories:'bds_memories'},
 chrome:{storage:{local:{set:async obj=>Object.assign(store,JSON.parse(JSON.stringify(obj)))}}},console,TextEncoder,window:{__sdSite:{arenaModality:()=>'chat'},dispatchEvent:e=>{if(e.detail)events.push(JSON.parse(e.detail))}},CustomEvent,
 sdT:a=>a,T6:s=>s,du:'fixture',BA:{configUpdate:'cfg'},M_e:()=>'',UD:()=>[],m1:async()=>[]};vm.createContext(c);vm.runInContext(code+part('let sdConfigRevision=','function Lme('),c);
 c.B.memories=c.QQ(store.bds_memories);c.B.projects=c.Qme(store.bds_projects);c.B.projectFiles=c.Hme(store.bds_project_files);
 return {c,store,events};
}
test('project CRUD survives reload, chats keep their own project, selected file IDs cannot cross a boundary',async()=>{
 const {c,store}=boot({bds_memories:{preserved:'yes'},history:'do not touch'});const a=await c.Wct('Accounts'),b=await c.Wct('Garden');
 await c.age(a.id,{customInstructions:'Use the ledger'});c.B.projectFiles=[{id:'a',projectId:a.id,name:'ledger',content:'red'},{id:'b',projectId:b.id,name:'rose',content:'pink'}];await c.nF();
 c.Jct(a.id);c.oge('b');c.oge('a');assert.deepEqual(Array.from(c.cge(),x=>x.name),['ledger']);
 c.location.pathname='/c/bravo';assert.equal(c.Ny(),null);c.Jct(b.id);c.oge('b');await turn();
 const again=boot(store).c;assert.equal(again.Ny().customInstructions,'Use the ledger');assert.deepEqual(Array.from(again.cge(),x=>x.name),['ledger']);
 again.location.pathname='/c/bravo';assert.equal(again.Ny().id,b.id);assert.deepEqual(Array.from(again.cge(),x=>x.name),['rose']);
 await again.Vct(b.id);assert.equal(again.Ny(),null);again.location.pathname='/c/alpha';assert.equal(again.Ny().id,a.id);
 again.Zct();assert.equal(again.Ny(),null);await turn();assert.equal(store.history,'do not touch');assert.deepEqual(store.bds_memories,{preserved:'yes'});
});
test('a draft binds only to the conversation ID observed on a first send, never a sidebar destination',async()=>{
 const {c}=boot();const a=await c.Wct('A');c.location.pathname='/text/direct';c.Jct(a.id);
 c.sdNoteNewProjectChat({id:'created',path:'/text/direct'});c.location.pathname='/c/some-history';assert.equal(c.Ny(),null);assert.equal(c.B.projects[0].conversations?.length||0,0);
 c.location.pathname='/text/direct';c.Jct(a.id);c.sdNoteNewProjectChat({id:'right-id',path:'/text/direct'});c.location.pathname='/c/right-id';assert.equal(c.Ny().id,a.id);
 c.location.pathname='/c/other';assert.equal(c.Ny(),null);c.location.pathname='/text/direct';assert.equal(c.Ny(),null);
});
test('conflicting imported memberships do not choose a project by array order',async()=>{
 const {c}=boot({bds_projects:['p1','p2'].map(id=>({id,name:id,conversations:[{id:'alpha',files:[]},{id:'../outside',files:[]}]}))});
 assert.equal(c.Ny(),null);c.Jct('p2');assert.equal(c.Ny().id,'p2');assert.ok(c.B.projects.every(p=>!p.conversations.some(x=>x.id==='../outside')));
});
test('local project changes are visible synchronously and a slow linked directory never writes the previous chat back',async()=>{
 const {c,events}=boot();const a=await c.Wct('First');await c.age(a.id,{customInstructions:'private',linkedDirId:'x'});c.Jct(a.id);
 let release;c.DD=()=>new Promise(r=>release=r);const pending=c.Lr();assert.equal(events.at(-1).activeProject.name,'First');
 c.location.pathname='/c/other';await c.Lr();assert.equal(events.at(-1).activeProject,null);release([{name:'private-file',content:'old project'}]);await pending;
 assert.equal(events.at(-1).contextPath,'/c/other');assert.equal(events.filter(x=>x.contextPath==='/c/other').some(x=>JSON.stringify(x).includes('private')),false);
});


test('memory proposals remain outside both stores until approval; no stale approval or revisit replay',async()=>{
 const {c,store}=boot({bds_memories:{timezone:{value:'UTC',importance:'always'}}});const a=await c.Wct('One');c.Jct(a.id);await turn();
 const msg=[{key:'লেজার',value:'লাল',importance:'called'}];c.nxe(msg,'m1');const id=vm.runInContext('[...sdMemPending.keys()][0]',c);
 assert.ok(id);assert.ok(!JSON.stringify(store).includes('লাল'));assert.ok(!c.sdVisibleMemories(c.Ny()).some(m=>m.key==='লেজার'));
 c.location.pathname='/c/no-project';assert.equal(await c.sdDecideMemory(id,true),false);c.location.pathname='/c/alpha';assert.equal(await c.sdDecideMemory(id,true),true);
 assert.equal(store.bds_projects[0].memories['লেজার'].value,'লাল');assert.equal(store.bds_memories.timezone.value,'UTC');assert.ok(!store.bds_memories['লেজার']);
 c.nxe(msg,'m1');assert.equal(vm.runInContext('sdMemPending.size',c),0);c.nxe([{key:'region',value:'west'}],'m2');const second=vm.runInContext('[...sdMemPending.keys()][0]',c);
 assert.equal(await c.sdDecideMemory(second,false),true);assert.ok(!JSON.stringify(store).includes('west'));c.nxe([{key:'region',value:'west'}],'m2');assert.equal(vm.runInContext('sdMemPending.size',c),0);
 const after=boot(store).c;assert.equal(after.Ny().memories['লেজার'].value,'লাল');after.location.pathname='/c/other';assert.ok(!after.sdVisibleMemories(after.Ny()).some(m=>m.key==='লেজার'));
});
test('memory CRUD, privacy switch, and overwrite conflicts preserve unrelated records',async()=>{
 const {c,store}=boot();const a=await c.Wct('A');c.Jct(a.id);await turn();
 await c.sdWriteMemory(null,'language','French','always',null);await c.sdWriteMemory(a.id,'language','Bangla','called',null);
 assert.deepEqual(Array.from(c.sdVisibleMemories(c.Ny()),m=>m.value),['Bangla']);assert.equal(await c.sdWriteMemory(a.id,'language','overwrite','called',null),false);
 c.nxe([{key:'language',value:'proposed'}],'turn');const id=vm.runInContext('[...sdMemPending.keys()][0]',c);
 const old=JSON.stringify(c.sdMemBag(a.id).language);await c.sdWriteMemory(a.id,'language','German','called',old);assert.equal(await c.sdDecideMemory(id,true),false);
 c.B.settings.disableMemory=true;assert.equal(c.sdVisibleMemories(c.Ny()).length,0);c.nxe([{key:'blocked',value:'no'}],'never');assert.ok(!JSON.stringify(store).includes('blocked'));
 assert.equal(await c.sdWriteMemory(a.id,'language',null,'called',JSON.stringify(c.sdMemBag(a.id).language)),true);assert.equal(store.bds_memories.language.value,'French');
 assert.equal(await c.sdWriteMemory(null,'__proto__','not a key','called',null),false);
});
