const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),{randomUUID}=require('node:crypto');
const source=fs.readFileSync(require('node:path').join(__dirname,'../manual-reviews.js'),'utf8');
const tick=()=>new Promise(r=>setImmediate(r));
function server(){
 const accounts=new Map();let lost=false,offline=false,delay=null;
 const account=id=>{if(!accounts.has(id))accounts.set(id,{revision:0,entries:[],receipts:new Map(),grades:[]});return accounts.get(id)};
 return {account,set lost(v){lost=v},set offline(v){offline=v},set delay(v){delay=v},
 async reviewList({expectedUserId}){if(offline)throw Error('offline');const a=account(expectedUserId);return structuredClone({revision:a.revision,entries:a.entries})},
 async reviewChange(body){
  if(offline)throw Error('offline');const a=account(body.expectedUserId),old=a.receipts.get(body.requestId);let conflict=false;
  if(old){assert.deepEqual(old.body,body);conflict=old.conflict}
  else{
   let row=a.entries.find(e=>e.word_id===body.wordId);
   if(body.action==='add'&&row?.active){}
   else if((row?.version??null)!==body.version||body.action!=='add'&&!row?.active)conflict=true;
   else{
    if(!row){row={word_id:body.wordId};a.entries.push(row)}
    row.active=['add','again'].includes(body.action);row.version=body.requestId;a.revision++;
    if(['remember','again'].includes(body.action))a.grades.push(body.action);
   }
   a.receipts.set(body.requestId,{body,conflict});
  }
  const result=structuredClone({duplicate:!!old,conflict,queue:{revision:a.revision,entries:a.entries}});
  if(lost){lost=false;throw Error('lost ACK')}
  if(delay){const hold=delay;delay=null;await hold}
  return result;
 }};
}
async function client(s){
 let identity={user:{id:'account-a'},identityRevision:1},observer;
 const events={},updates=[];
 const ctx={console,crypto:{randomUUID},navigator:{onLine:true},document:{hidden:false,addEventListener(){}},SVRpc:s,
  SVAuth:{getState:()=>identity,subscribe:fn=>observer=fn},addEventListener:(key,fn)=>events[key]=fn,setInterval(){},
  localStorage:{getItem(){throw Error('storage forbidden')},setItem(){throw Error('storage forbidden')}},indexedDB:{open(){throw Error('IDB forbidden')}}};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(source,ctx);const api=ctx.SVManualReviews;
 api.initialize(e=>updates.push(e));await tick();
 return {api,ctx,updates,events,login(id){identity={user:id?{id}:null,identityRevision:identity.identityRevision+1};observer()},active:()=>api.state().entries.filter(e=>e.active)};
}
test('add, duplicate requests, both grades and remove persist independently of SRS',async()=>{
 const s=server(),c=await client(s);
 assert.equal(await c.api.change('add','v-arbeta'),true);assert.equal(c.active().length,1);
 await c.api.change('add','v-arbeta');assert.equal(s.account('account-a').receipts.size,1);assert.equal(s.account('account-a').grades.length,0);
 await c.api.change('again','v-arbeta');assert.equal(c.active().length,1);assert.deepEqual(s.account('account-a').grades,['again']);
 await c.api.change('remember','v-arbeta');assert.equal(c.active().length,0);
 await c.api.change('add','v-arbeta');await c.api.change('remove','v-arbeta');assert.equal(c.active().length,0);assert.equal(s.account('account-a').grades.length,2);
});
test('refresh, fresh page and logout/login restore the account queue without browser storage',async()=>{
 const s=server(),a=await client(s);await a.api.change('add','v-arbeta');const b=await client(s);assert.equal(b.active().length,1);
 a.login(null);assert.equal(a.active().length,0);a.login('account-b');await tick();assert.equal(a.active().length,0);
 a.login('account-a');await tick();assert.equal(a.active().length,1);
 await b.api.change('remember','v-arbeta');await a.api.refresh();assert.equal(a.active().length,0);
});
test('double clicks coalesce; no selected state before server ACK',async()=>{
 const s=server(),c=await client(s);let release;s.delay=new Promise(r=>release=r);
 const first=c.api.change('add','v-arbeta');assert.equal(c.active().length,0);assert.equal(await c.api.change('add','v-arbeta'),false);
 assert.equal(c.api.state().pending.length,1);release();await first;assert.equal(c.active().length,1);assert.equal(s.account('account-a').receipts.size,1);
});
test('offline clicks do not report success or remove server words',async()=>{
 const s=server(),c=await client(s);await c.api.change('add','v-arbeta');c.ctx.navigator.onLine=false;
 for(const action of ['remember','again','remove'])assert.equal(await c.api.change(action,'v-arbeta'),false);
 assert.equal(c.active().length,1);assert.equal(c.api.state().error,'offline');assert.equal(s.account('account-a').grades.length,0);
 assert.equal(await c.api.change('add','v-prata'),false);assert.equal(c.active().length,1);
 c.ctx.navigator.onLine=true;await c.api.refresh();await c.api.change('remember','v-arbeta');assert.equal(c.active().length,0);
});
test('lost ACK retries the same UUID exactly once, even for a grade',async()=>{
 const s=server(),c=await client(s);await c.api.change('add','v-arbeta');s.lost=true;
 assert.equal(await c.api.change('remember','v-arbeta'),false);assert.equal(c.active().length,1);assert.equal(c.api.state().pending.length,1);
 await c.api.refresh();assert.equal(c.active().length,0);assert.equal(c.api.state().pending.length,0);assert.equal(s.account('account-a').grades.length,1);
});
test('stale exercise cannot delete readded word; devices reconcile on refresh',async()=>{
 const s=server(),a=await client(s);await a.api.change('add','v-arbeta');const b=await client(s),version=b.active()[0].version;
 await a.api.change('remove','v-arbeta');await a.api.change('add','v-arbeta');
 assert.equal(await b.api.change('remember','v-arbeta',version),false);assert.equal(b.api.state().error,'conflict');assert.equal(b.active().length,1);assert.equal(s.account('account-a').grades.length,0);
 await b.api.change('again','v-arbeta');assert.equal(b.api.state().error,null);assert.equal(b.active().length,1);
});
test('responses arriving out of order cannot revert a newer server snapshot',async()=>{
 const s=server(),c=await client(s);let release;s.delay=new Promise(r=>release=r);
 const first=c.api.change('add','v-arbeta');await c.api.change('add','v-prata');assert.equal(c.active().length,2);
 release();await first;assert.equal(c.active().length,2);
});
test('late ACK from a previous identity cannot leak queue into another account',async()=>{
 const s=server(),c=await client(s);let release;s.delay=new Promise(r=>release=r);const first=c.api.change('add','v-arbeta');
 c.login('account-b');await tick();release();assert.equal(await first,false);assert.equal(c.active().length,0);
 c.login('account-a');await tick();assert.equal(c.active().length,1);
});
test('invalid or unavailable RPC never marks the queue ready',async()=>{
 const s=server();s.reviewList=async()=>({revision:0,entries:[{word_id:'x',active:true,version:'wrong'}]});const c=await client(s);
 assert.equal(c.api.state().ready,false);assert.equal(await c.api.change('add','x'),false);
 s.reviewList=async()=>{throw {code:'PGRST202'}};await c.api.refresh();assert.equal(c.api.state().error,'unavailable');
});
