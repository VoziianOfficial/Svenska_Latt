// SL_UX_DOM_MODULE=/path/to/linkedom node --test tests/study-time-dom.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const domModule=process.env.SL_UX_DOM_MODULE;
const source=fs.readFileSync(require('node:path').join(__dirname,'../study-time.js'),'utf8');
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const settle=async()=>{for(let i=0;i<35;i++)await Promise.resolve()};
function shared(){
 const rows=new Map(),locks=new Set(),data=new Map([['sv-study-time-dev-v1','enabled'],['sv-language','ru'],['sv-cloud-events-v1','untouched']]);let seq=0;
 const db={createObjectStore(){},transaction(){
  const tx={objectStore(){return Object.fromEntries(['getAll','add','put','delete'].map(method=>[method,value=>{
   const req={};queueMicrotask(()=>{
    if(method==='getAll')req.result=clone([...rows.values()]);
    if(method==='add'){const row=clone(value);row.sequence=++seq;rows.set(seq,row);req.result=seq}
    if(method==='put')rows.set(value.sequence,clone(value));if(method==='delete')rows.delete(value);
    req.onsuccess?.();queueMicrotask(()=>tx.oncomplete?.());
   });return req;
  }]))}};return tx;
 }};
 return {rows,data,locks,db,leases:new Map(),receipts:new Map(),totals:new Map(),indexedDB:{open(){const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req}},
  navigator:{onLine:true,locks:{async request(name,options,fn){if(locks.has(name))return fn(null);locks.add(name);try{return await fn({name})}finally{locks.delete(name)}}}}};
}
function ui({resources=shared(),host='localhost',user='account-a',enabled=true,route='flashcards'}={}){
 const {parseHTML}=require(domModule),{document,Event}=parseHTML('<html><body><main id="page"><section class="profile-identity"></section><button id="learn">Learn</button></main></body></html>');
 const browserHandlers={},authListeners=[],calls=[],session=new Map();let time=0,visible=true,focus=true,identity={user:user?{id:user}:null,identityRevision:1},timer;
 Object.defineProperty(document,'visibilityState',{get:()=>visible?'visible':'hidden'});document.hasFocus=()=>focus;
 const snapshot={version:1,enabled,generation:1,timezone:'Europe/Stockholm',today:'2026-10-18',month:'2026-10-01',totals:{today:0,week:0,month:0,all:0},days:{}};
 const leases=resources.leases,receipts=resources.receipts;let lostAck=false,offline=false;
 const base=1792324800000;
 const ctx={document,Event,console,Date,Intl,JSON,Math,performance:{now:()=>time},crypto,route,locale4:()=> 'ru',
  location:{hostname:host,protocol:'http:'},navigator:resources.navigator,indexedDB:resources.indexedDB,
  localStorage:{getItem:k=>resources.data.get(k)||null,setItem:(k,v)=>resources.data.set(k,v),removeItem:k=>resources.data.delete(k)},
  sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
  MutationObserver:class{observe(){}},setTimeout,clearTimeout,setInterval:fn=>timer=fn,addEventListener:(name,fn)=>browserHandlers[name]=fn,
  SVAuth:{getState:()=>identity,subscribe:fn=>authListeners.push(fn)},
  SVRpc:{
   async studyStatus(args){calls.push(['status',clone(args)]);return clone(snapshot)},
   async studySettings(args){calls.push(['settings',clone(args)]);if(offline)throw Error('offline');snapshot.enabled=args.enabled;snapshot.timezone=args.timezone;snapshot.generation++;return clone(snapshot)},
   async studyOpen(args){calls.push(['open',clone(args)]);const grant={available:true,id:args.leaseId,server_ms:base+time,end_ms:base+time+90000,cursor_ms:base+time,generation:snapshot.generation,timezone:snapshot.timezone};leases.set(args.leaseId,grant);return clone(grant)},
   async studyCommit(args){calls.push(['commit',clone(args)]);if(offline)throw Error('offline');
    if(receipts.has(args.id)){assert.equal(JSON.stringify(args),JSON.stringify(receipts.get(args.id).args));return clone(receipts.get(args.id).result)}
    const grant=leases.get(args.leaseId);assert.ok(grant,'lease must exist');
    for(const [lo,hi] of args.segments){assert.ok(hi<=grant.end_ms);assert.ok(lo>=grant.cursor_ms);resources.totals.set(user,(resources.totals.get(user)||0)+hi-lo);grant.cursor_ms=hi}
    grant.end_ms=base+time+90000;
    const result={...grant,closed:args.close};receipts.set(args.id,{args:clone(args),result});
    if(lostAck){lostAck=false;throw Error('ACK lost')};return clone(result);
   }
  }};
 ctx.window=ctx;vm.createContext(ctx);
 // Test-only access to drive the real asynchronous loop without waiting minutes.
 vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.__study={tick,drain,refresh,settings,paint,get:()=>c};})();'),ctx);
 return {ctx,document,resources,calls,snapshot,receipts,session,get total(){return resources.totals.get(user)||0},
  async ready(){await settle()},async tick(ms=1000){time+=ms;await ctx.__study.tick();await settle()},
  async input(){const e=new Event('pointerdown',{bubbles:true});Object.defineProperty(e,'isTrusted',{value:true});document.getElementById('learn').dispatchEvent(e);await settle()},
  async visibility(value){visible=value;document.dispatchEvent(new Event('visibilitychange'));await settle()},
  async auth(userId){identity={user:userId?{id:userId}:null,identityRevision:identity.identityRevision+1};authListeners.forEach(fn=>fn());await settle()},
  loseAck(){lostAck=true},offline(value){offline=value;resources.navigator.onLine=!value},
  async renew(){const c=ctx.__study.get();if(c){c.renew=true;await ctx.__study.tick();await settle()}},
  setRoute(value){ctx.route=value},read:code=>vm.runInContext(code,ctx),setFocus(value){focus=value;browserHandlers[value?'focus':'blur']?.()}
 };
}
const domTest=(name,fn)=>test(name,{skip:!domModule&&'Set SL_UX_DOM_MODULE for DOM integration'},fn);
domTest('production and guest make no study RPC or queue writes',async()=>{
 for(const args of [{host:'example.com'},{user:null}]){const h=ui(args);await h.ready();await h.tick();assert.equal(h.calls.length,0);assert.equal(h.resources.rows.size,0)}
});
domTest('consent off prevents lease acquisition; opt in requires a subsequent learning action',async()=>{
 const h=ui({enabled:false});await h.ready();await h.tick();assert.equal(h.calls.filter(c=>c[0]==='open').length,0);
 await h.ctx.__study.settings(true,'Europe/Stockholm');await h.tick(11000);assert.equal(h.calls.filter(c=>c[0]==='open').length,0);
 await h.input();await h.tick(11000);assert.equal(h.calls.filter(c=>c[0]==='open').length,1);
});
domTest('5 second checkpoints survive lost ACK and replay with the same UUID exactly once',async()=>{
 const h=ui();await h.ready();await h.tick();
 for(let i=0;i<5;i++)await h.tick();assert.equal(h.resources.rows.size,1);
 h.loseAck();await h.ctx.__study.drain(h.ctx.__study.get());const counted=h.total;assert.ok(counted>0);assert.equal(h.resources.rows.size,1);
 await h.ctx.__study.drain(h.ctx.__study.get());assert.equal(h.total,counted);assert.equal(h.resources.rows.size,0);
 assert.equal(h.resources.data.get('sv-language'),'ru');assert.equal(h.resources.data.get('sv-cloud-events-v1'),'untouched');
});
domTest('offline is bounded by grant; records persist across reload and remain scoped to owner',async()=>{
 const h=ui();await h.ready();await h.tick();h.offline(true);
 for(let i=0;i<100;i++)await h.tick();
 assert.equal(h.ctx.__study.get().lease,null);const rows=[...h.resources.rows.values()];assert.ok(rows.length>0);
 const duration=rows.flatMap(r=>r.segments).reduce((n,[lo,hi])=>n+hi-lo,0);assert.ok(duration<=90000&&duration>0);
 await h.auth('account-b');await h.tick();assert.equal(h.resources.rows.size,rows.length,'A records are not sent by B');
 assert.ok([...h.resources.rows.values()].every(r=>r.userId==='account-a'));
 const reloaded=ui({resources:h.resources,user:'account-a'});reloaded.offline(false);await reloaded.ready();
 assert.equal(reloaded.resources.rows.size,rows.length,'reload does not delete durable records');
 await reloaded.tick();for(let i=0;i<20;i++)await settle();assert.equal(reloaded.resources.rows.size,0,'same owner replays durable batches after reload');assert.equal(reloaded.total,duration);
});
domTest('two tabs share one browser lease; hiding releases ownership',async()=>{
 const resources=shared(),a=ui({resources}),b=ui({resources});await a.ready();await b.ready();
 await a.tick();await b.tick();assert.equal(a.calls.filter(c=>c[0]==='open').length+b.calls.filter(c=>c[0]==='open').length,1);
 await a.visibility(false);await settle();assert.equal(a.ctx.__study.get().lease,null);
 await b.tick(11000);assert.equal(b.calls.filter(c=>c[0]==='open').length,1);
});
domTest('account switch while lease response is in flight cannot publish into next account',async()=>{
 const h=ui();await h.ready();let release;h.ctx.SVRpc.studyOpen=()=>new Promise(r=>release=r);
 await h.tick();await h.auth('account-b');release({available:true,id:'old',server_ms:0,end_ms:90000,generation:1,cursor_ms:0});await settle();
 assert.equal(h.ctx.__study.get().userId,'account-b');assert.equal(h.ctx.__study.get().lease,null);
});
domTest('profile has exact empty days, seven bars, 42 calendar slots and accessible date detail',async()=>{
 const h=ui({route:'profile'});await h.ready();h.ctx.__study.paint();
 assert.equal(h.document.querySelectorAll('.study-bar').length,7);
 assert.equal(h.document.querySelectorAll('.study-day,.study-day-blank').length,42);
 assert.equal(h.document.querySelectorAll('.study-tone-0').length,31);
 assert.match(h.document.querySelector('[data-study-day="2026-10-18"]').getAttribute('title'),/Занятий не было · 0 с/);
 assert.equal(h.document.querySelectorAll('.study-totals strong').length,4);
 assert.equal(h.document.querySelector('[data-study-enabled]').hasAttribute('checked'),true);
});
domTest('failed offline opt out stops local tracking immediately and keeps the switch off',async()=>{
 const h=ui();await h.ready();await h.tick();h.offline(true);
 await h.ctx.__study.settings(false,'Europe/Stockholm');await settle();
 assert.equal(h.resources.data.get('sv-study-paused:account-a'),'yes');
 assert.equal(h.ctx.__study.get().lease,null);
 const opens=h.calls.filter(c=>c[0]==='open').length;
 await h.tick(11000);assert.equal(h.calls.filter(c=>c[0]==='open').length,opens);
 h.setRoute('profile');h.ctx.__study.paint();assert.equal(h.document.querySelector('[data-study-enabled]').hasAttribute('checked'),false);
 assert.match(h.document.querySelector('.study-message').textContent,/Не удалось сохранить/);
});
domTest('menu of practice modes does not count as an active exercise',async()=>{
 const h=ui({route:'practice'});await h.ready();await h.tick();assert.equal(h.calls.filter(c=>c[0]==='open').length,0);
 h.ctx.quiz={active:true,finished:false};await h.input();await h.tick(11000);assert.equal(h.calls.filter(c=>c[0]==='open').length,1);
});
domTest('slow network requests do not block ongoing durable time checkpoints',async()=>{
 const h=ui();await h.ready();await h.tick();
 const original=h.ctx.SVRpc.studyCommit;let release;
 h.ctx.SVRpc.studyCommit=async args=>{await new Promise(r=>release=r);return original(args)};
 for(let i=0;i<20;i++)await h.tick();const count=h.resources.rows.size;
 for(let i=0;i<5;i++)await h.tick();assert.ok(h.resources.rows.size>count,'5 second local checkpoint continues while network is pending');
 h.ctx.SVRpc.studyCommit=original;release();for(let i=0;i<20;i++)await settle();
});
