// SL_UX_DOM_MODULE=/path/to/linkedom node --test tests/study-time-dom.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const domModule=process.env.SL_UX_DOM_MODULE;
const source=fs.readFileSync(require('node:path').join(__dirname,'../study-time.js'),'utf8');
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const settle=async()=>{for(let i=0;i<35;i++)await Promise.resolve()};
function shared(){
 const rows=new Map(),locks=new Set(),waiters=new Map(),data=new Map([['sv-language','ru'],['sv-cloud-events-v1','untouched']]);let seq=0;
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
 return {rows,data,locks,db,preferences:new Map(),leases:new Map(),receipts:new Map(),totals:new Map(),indexedDB:{open(){const req={result:db};queueMicrotask(()=>req.onsuccess?.());return req}},
  navigator:{onLine:true,locks:{async request(name,options,fn){if(locks.has(name)){if(options.ifAvailable)return fn(null);await new Promise(resolve=>{const queue=waiters.get(name)||[];queue.push(resolve);waiters.set(name,queue)})}locks.add(name);try{return await fn({name})}finally{locks.delete(name);waiters.get(name)?.shift()?.()}}}}};
}
function ui({resources=shared(),host='localhost',user='account-a',enabled=true,route='flashcards'}={}){
 const {parseHTML}=require(domModule),{document,Event,HTMLElement}=parseHTML('<html><body><main id="page"><section class="content-panel"><div class="activity-calendar" data-calendar-month="2026-10-01"><div class="day-square done" data-study-date="2026-10-18" title="2026-10-18 · 3" tabindex="0"></div><div class="day-square" data-study-date="2026-10-15" title="2026-10-15 · 0" tabindex="0"></div></div></section><button id="learn">Learn</button></main></body></html>');
 HTMLElement.prototype.getBoundingClientRect=()=>({top:100,bottom:150,left:20,width:150,height:50});
 const browserHandlers={},authListeners=[],calls=[],session=new Map();let time=0,visible=true,focus=true,identity={user:user?{id:user}:null,identityRevision:1},timer;
 Object.defineProperty(document,'visibilityState',{get:()=>visible?'visible':'hidden'});document.hasFocus=()=>focus;
 const newSnapshot=(enabled=true)=>({version:1,enabled,generation:1,timezone:'Europe/Stockholm',today:'2026-10-18',month:'2026-10-01',totals:{today:0,week:0,month:0,all:0},days:{}});
 if(!resources.preferences.has(user))resources.preferences.set(user,newSnapshot(enabled));
 const snapshot=resources.preferences.get(user);
 function serverSnapshot(id){if(!resources.preferences.has(id))resources.preferences.set(id,newSnapshot());return resources.preferences.get(id)}
 function status(args){
  const s=serverSnapshot(args.expectedUserId),total=resources.totals.get(args.expectedUserId)||0;
  return clone({...s,month:args.month||s.month,totals:{today:total,week:total,month:total,all:total},days:{...s.days,...(total?{'2026-10-18':total}:{})}});
 }
 const leases=resources.leases,receipts=resources.receipts;let lostAck=false,offline=false;
 const base=1792324800000;
 let browserTimezone='Europe/Stockholm';
 function DateTimeFormat(locale,options){return new Intl.DateTimeFormat(locale,{timeZone:browserTimezone,...options})}
 const ctx={document,Event,console,Date,Intl:{DateTimeFormat,PluralRules:Intl.PluralRules},innerWidth:390,innerHeight:844,JSON,Math,performance:{now:()=>time},crypto,route,locale4:()=> 'ru',
  location:{hostname:host,protocol:'http:'},navigator:resources.navigator,indexedDB:resources.indexedDB,
  localStorage:{getItem:k=>resources.data.get(k)||null,setItem:(k,v)=>resources.data.set(k,v),removeItem:k=>resources.data.delete(k)},
  sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
  MutationObserver:class{observe(){}},setTimeout,clearTimeout,setInterval:fn=>timer=fn,addEventListener:(name,fn)=>browserHandlers[name]=fn,
  SVAuth:{getState:()=>identity,subscribe:fn=>authListeners.push(fn)},
  SVRpc:{
   async studyStatus(args){calls.push(['status',clone(args)]);if(offline)throw Error('offline');return status(args)},
   async studySettings(args){calls.push(['settings',clone(args)]);if(offline)throw Error('offline');const s=serverSnapshot(args.expectedUserId);
    if(args.generation!==s.generation)throw Object.assign(Error('study_settings_conflict'),{code:'40001'});
    if(s.enabled!==args.enabled||s.timezone!==args.timezone){s.enabled=args.enabled;s.timezone=args.timezone;s.generation++}
    return status(args)},
   async studyOpen(args){calls.push(['open',clone(args)]);const s=serverSnapshot(args.expectedUserId);
    if(!s.enabled)throw Object.assign(Error('study_consent_required'),{code:'42501'});
    const grant={available:true,id:args.leaseId,server_ms:base+time,end_ms:base+time+90000,cursor_ms:base+time,generation:s.generation,timezone:s.timezone};leases.set(args.leaseId,grant);return clone(grant)},
   async studyCommit(args){calls.push(['commit',clone(args)]);if(offline)throw Error('offline');
    if(receipts.has(args.id)){assert.equal(JSON.stringify(args),JSON.stringify(receipts.get(args.id).args));return clone(receipts.get(args.id).result)}
    const grant=leases.get(args.leaseId);assert.ok(grant,'lease must exist');
    for(const [lo,hi] of args.segments){assert.ok(hi<=grant.end_ms);assert.ok(lo>=grant.cursor_ms);resources.totals.set(args.expectedUserId,(resources.totals.get(args.expectedUserId)||0)+hi-lo);grant.cursor_ms=hi}
    grant.end_ms=base+time+90000;
    const result={...grant,closed:args.close};receipts.set(args.id,{args:clone(args),result});
    if(lostAck){lostAck=false;throw Error('ACK lost')};return clone(result);
   }
  }};
 ctx.window=ctx;vm.createContext(ctx);
 // Test-only access to drive the real asynchronous loop without waiting minutes.
 vm.runInContext(source.replace(/\}\)\(\);\s*$/, 'window.__study={tick,drain,refresh,settings,paint,duration,get:()=>c};})();'),ctx);
 return {ctx,document,resources,calls,snapshot,receipts,session,get total(){return resources.totals.get(user)||0},
  async ready(){await settle()},async tick(ms=1000){time+=ms;await ctx.__study.tick();await settle()},
  async input(){const e=new Event('pointerdown',{bubbles:true});Object.defineProperty(e,'isTrusted',{value:true});document.getElementById('learn').dispatchEvent(e);await settle()},
  async visibility(value){visible=value;document.dispatchEvent(new Event('visibilitychange'));await settle()},
  async auth(userId){identity={user:userId?{id:userId}:null,identityRevision:identity.identityRevision+1};authListeners.forEach(fn=>fn());await settle()},
  loseAck(){lostAck=true},offline(value){offline=value;resources.navigator.onLine=!value},
  async reconnect(){offline=false;resources.navigator.onLine=true;browserHandlers.online?.();await settle()},
  async renew(){const c=ctx.__study.get();if(c){c.renew=true;await ctx.__study.tick();await settle()}},
  setTimezone(value){browserTimezone=value},setRoute(value){ctx.route=value},read:code=>vm.runInContext(code,ctx),setFocus(value){focus=value;browserHandlers[value?'focus':'blur']?.()}
 };
}
const domTest=(name,fn)=>test(name,{skip:!domModule&&'Set SL_UX_DOM_MODULE for DOM integration'},fn);
domTest('server default-on tracks without a browser opt-in, while saved opt-out survives reload',async()=>{
 const resources=shared(),h=ui({resources,enabled:true});await h.ready();await h.tick();
 assert.equal(h.calls.filter(c=>c[0]==='open').length,1);
 for(let i=0;i<6;i++)await h.tick();await h.ctx.__study.drain(h.ctx.__study.get());assert.ok(h.total>0);
 await h.ctx.__study.settings(false,'Europe/Stockholm');
 const reloaded=ui({resources,enabled:true});await reloaded.ready();await reloaded.input();
 for(let i=0;i<20;i++)await reloaded.tick();
 assert.equal(reloaded.calls.filter(c=>c[0]==='open').length,0);
 assert.equal(resources.preferences.get('account-a').enabled,false);
 assert.equal(resources.data.has('sv-study-paused:account-a'),false,'acknowledged setting belongs to the account');
});
domTest('guest makes no study RPC or queue writes',async()=>{
 for(const args of [{user:null}]){const h=ui(args);await h.ready();await h.tick();assert.equal(h.calls.length,0);assert.equal(h.resources.rows.size,0)}
});
domTest('saved opt-out prevents lease acquisition; explicit enable requires a subsequent learning action',async()=>{
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
domTest('production profile uses one existing activity calendar, preserves colors, has compact setting and tooltips',async()=>{
 const h=ui({host:'example.com',route:'profile'});await h.ready();h.ctx.__study.paint();
 assert.equal(h.document.querySelectorAll('.activity-calendar').length,1);
 assert.equal(h.document.querySelectorAll('.study-calendar,.study-chart,.study-zone').length,0);
 assert.equal(h.document.querySelectorAll('.study-totals strong').length,4);
 assert.deepEqual(Array.from(h.document.querySelectorAll('.study-totals strong'),el=>el.textContent),['0 мин','0 мин','0 мин','0 мин']);
 assert.equal(h.document.querySelector('[data-study-enabled]').hasAttribute('checked'),true);
 const day=h.document.querySelector('[data-study-date="2026-10-18"]');
 assert.ok(day.classList.contains('done'));
 assert.match(day.getAttribute('aria-label'),/Нет записанного времени.*2026-10-18 · 3/);
 day.dispatchEvent(new h.ctx.Event('click',{bubbles:true}));
 assert.match(h.document.querySelector('[role="tooltip"]').textContent,/18 октябряНет записанного времени/);
 h.document.dispatchEvent(Object.assign(new h.ctx.Event('keydown'),{key:'Escape'}));
 assert.equal(h.document.querySelector('[role="tooltip"]').hidden,true);
 assert.ok(h.calls.some(c=>c[0]==='status'));
});
domTest('failed offline opt out stops local tracking immediately and keeps the switch off',async()=>{
 const h=ui();await h.ready();await h.tick();h.offline(true);
 await h.ctx.__study.settings(false,'Europe/Stockholm');await settle();
 assert.match(h.resources.data.get('sv-study-paused:account-a'),/^yes:/);
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

domTest('real interval batches drive server totals and restore after reload without deleting progress',async()=>{
 const h=ui({host:'example.com'});await h.ready();await h.tick();for(let i=0;i<25;i++)await h.tick();
 assert.ok(h.total>=19000);const recorded=h.total;
 await h.visibility(false);await settle();
 const restored=ui({resources:h.resources,route:'profile'});await restored.ready();
 assert.ok(restored.ctx.__study.get().snapshot.totals.all>=recorded);
 assert.match(restored.document.querySelector('.study-totals strong').textContent,/мин/);
 assert.equal(restored.resources.data.get('sv-cloud-events-v1'),'untouched');
});
domTest('automatic timezone synchronization preserves disabled preference and old daily data',async()=>{
 const h=ui({enabled:false});await h.ready();h.setTimezone('America/New_York');
 await h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 const calls=h.calls.filter(c=>c[0]==='settings');assert.equal(calls.length,1);
 assert.equal(calls[0][1].timezone,'America/New_York');assert.equal(calls[0][1].enabled,false);
 assert.equal(h.calls.filter(c=>c[0]==='open').length,0);
});
domTest('calendar month change fetches matching daily status and retains current totals',async()=>{
 const h=ui({route:'profile'});await h.ready();
 h.document.querySelector('.activity-calendar').dataset.calendarMonth='2026-09-01';h.ctx.__study.paint();await settle();
 assert.equal(h.ctx.__study.get().snapshot.month,'2026-09-01');
 assert.ok(h.calls.some(c=>c[0]==='status'&&c[1].month==='2026-09-01'));
});
domTest('failed status settles into an error and can recover instead of loading forever',async()=>{
 const h=ui({route:'profile'});await h.ready();h.ctx.SVRpc.studyStatus=async()=>{throw Error('network')};
 await h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 assert.match(h.document.querySelector('.study-message').textContent,/недоступен/);
 assert.ok(h.document.querySelector('[data-study-retry]'));
 h.ctx.SVRpc.studyStatus=async()=>clone(h.snapshot);await h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 assert.equal(h.ctx.__study.get().readError,false);
});

domTest('tooltip shows server duration on hover, focus and mobile tap within viewport',async()=>{
 const h=ui({route:'profile'});await h.ready();h.snapshot.days['2026-10-15']=5700000;
 await h.ctx.__study.refresh(h.ctx.__study.get());
 const day=h.document.querySelector('[data-study-date="2026-10-15"]');
 for(const type of ['pointerover','focusin','click']){
  day.dispatchEvent(new h.ctx.Event(type,{bubbles:true}));
  const tip=h.document.querySelector('[role="tooltip"]');assert.equal(tip.hidden,false);
  assert.match(tip.textContent,/15 октябряОбучение: 1 ч 35 мин/);
  assert.ok(parseFloat(tip.style.left)>=8);assert.ok(parseFloat(tip.style.top)>=8);
 }
 assert.ok(day.hasAttribute('aria-describedby'));
});
domTest('idle stops actual commits and trusted input resumes; hidden and blurred tabs add nothing',async()=>{
 const h=ui();await h.ready();await h.tick();for(let i=0;i<110;i++)await h.tick();
 assert.equal(h.ctx.__study.get().lease,null);const idle=h.total;assert.ok(idle>0&&idle<=90000);
 for(let i=0;i<25;i++)await h.tick();assert.equal(h.total,idle);
 await h.input();await h.tick(11000);for(let i=0;i<25;i++)await h.tick();assert.ok(h.total>idle);
 h.setFocus(false);await settle();await h.tick();const blurred=h.total;
 for(let i=0;i<25;i++)await h.tick();assert.equal(h.total,blurred);
 h.setFocus(true);await h.tick(11000);await h.visibility(false);const hidden=h.total;
 for(let i=0;i<25;i++)await h.tick();assert.equal(h.total,hidden);
});
domTest('timezone change commits old lease before changing preferences and preserves historical records',async()=>{
 const h=ui();await h.ready();await h.tick();for(let i=0;i<6;i++)await h.tick();
 h.snapshot.days['2026-09-01']=5700000;h.setTimezone('America/New_York');
 await h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 const settingsIndex=h.calls.findIndex(c=>c[0]==='settings');
 assert.ok(settingsIndex>0);assert.ok(h.calls.slice(0,settingsIndex).some(c=>c[0]==='commit'&&c[1].close));
 assert.equal(h.calls[settingsIndex][1].enabled,true);
 assert.equal(h.snapshot.days['2026-09-01'],5700000);assert.ok(h.total>0);
});

domTest('study minute formatting has exact boundaries and retains milliseconds in the tooltip',async()=>{
 const h=ui({route:'profile'});await h.ready();
 for(const [ms,label] of [[0,'0 мин'],[1,'0 мин'],[59000,'0 мин'],[59999,'0 мин'],[60000,'1 мин'],[3599999,'59 мин'],[3600000,'1 ч'],[3660000,'1 ч 1 мин'],[5700000,'1 ч 35 мин']])assert.equal(h.ctx.__study.duration(ms),label);
 assert.equal(h.ctx.__study.duration(59999,true),'59 секунд');
 assert.equal(h.document.querySelectorAll('.study-stat').length,4);
});
domTest('three minutes of active learning commit real milliseconds and render nonzero totals',async()=>{
 const h=ui();await h.ready();await h.tick();
 for(let second=0;second<185;second++){if(second%30===0)await h.input();await h.tick()}
 h.setRoute('profile');await h.tick();await h.ctx.__study.refresh(h.ctx.__study.get());h.ctx.__study.paint();
 assert.ok(h.total>=180000,`Expected real study time, got ${h.total}`);
 assert.equal(h.document.querySelectorAll('.study-stat strong').length,4);
 for(const value of h.document.querySelectorAll('.study-stat strong'))assert.equal(value.textContent,'3 мин');
 assert.ok(h.calls.filter(call=>call[0]==='commit').length>1);
});
domTest('disabled study tracking explains zero without enabling tracking or changing preferences',async()=>{
 const h=ui({enabled:false,route:'profile'});await h.ready();h.ctx.__study.paint();
 assert.match(h.document.querySelector('.study-message').textContent,/Учёт выключен/);
 assert.equal(h.calls.filter(call=>call[0]==='settings'||call[0]==='open').length,0);
});

domTest('UI opt-out preserves history through reload, sign-in and a device with empty browser storage',async()=>{
 const resources=shared();resources.totals.set('account-a',5700000);
 const h=ui({resources,route:'profile'});h.snapshot.days['2026-09-01']=123456;await h.ready();
 assert.equal(h.document.querySelector('[data-study-enabled]').hasAttribute('checked'),true);
 const before=clone(h.ctx.__study.get().snapshot);
 const toggle=h.document.querySelector('[data-study-enabled]');toggle.checked=false;
 toggle.dispatchEvent(new h.ctx.Event('change',{bubbles:true}));await settle();
 assert.equal(h.snapshot.enabled,false);
 assert.deepEqual(h.ctx.__study.get().snapshot.totals,before.totals);
 assert.deepEqual(h.ctx.__study.get().snapshot.days,before.days);
 assert.equal(h.document.querySelector('[data-study-enabled]').hasAttribute('checked'),false);
 await h.auth(null);await h.auth('account-a');await h.tick();
 assert.equal(h.ctx.__study.get().snapshot.enabled,false);
 const reloaded=ui({resources,route:'profile'});await reloaded.ready();
 const device=ui({resources:{...resources,data:new Map()},route:'profile'});await device.ready();
 for(const view of [h,reloaded,device]){
  assert.equal(view.document.querySelector('[data-study-enabled]').hasAttribute('checked'),false);
  assert.equal(view.ctx.__study.get().snapshot.totals.all,5700000);
  assert.equal(view.ctx.__study.get().snapshot.days['2026-09-01'],123456);
  view.setRoute('flashcards');await view.tick(11000);
  assert.equal(view.calls.filter(call=>call[0]==='open').length,0);
 }
 assert.equal(resources.data.get('sv-cloud-events-v1'),'untouched');
 await h.auth('account-b');assert.equal(h.ctx.__study.get().snapshot.enabled,true,'other account retains default');
 assert.equal(h.ctx.__study.get().snapshot.totals.all,0);
});

domTest('offline opt-out survives reload and reconnect synchronizes the saved account preference',async()=>{
 const h=ui();await h.ready();await h.tick();for(let i=0;i<6;i++)await h.tick();
 h.offline(true);await h.ctx.__study.settings(false,'Europe/Stockholm');await settle();
 const pending=clone([...h.resources.rows.values()]);assert.ok(pending.length>0);
 assert.equal(h.snapshot.enabled,true,'server did not acknowledge the offline write');
 assert.match(h.resources.data.get('sv-study-paused:account-a'),/^yes:/);
 const reloaded=ui({resources:h.resources});reloaded.offline(true);await reloaded.ready();await reloaded.tick();
 assert.equal(reloaded.calls.filter(call=>call[0]==='open').length,0);
 assert.deepEqual([...h.resources.rows.values()],pending,'pending time batches are retained');
 await reloaded.reconnect();for(let i=0;i<5;i++)await settle();
 assert.equal(h.snapshot.enabled,false,'pending opt-out eventually reaches the server');
 assert.equal(h.resources.data.has('sv-study-paused:account-a'),false);
 const otherDevice=ui({resources:{...h.resources,data:new Map()},route:'profile'});await otherDevice.ready();
 assert.equal(otherDevice.ctx.__study.get().snapshot.enabled,false);
});

domTest('legacy local opt-out is synchronized before opening any lease and is account-scoped',async()=>{
 const resources=shared();resources.data.set('sv-study-paused:account-a','yes');
 const h=ui({resources});await h.ready();await h.tick();
 assert.equal(h.snapshot.enabled,false);assert.equal(h.calls.filter(call=>call[0]==='open').length,0);
 assert.ok(h.calls.some(call=>call[0]==='settings'&&call[1].enabled===false));
 assert.equal(resources.data.has('sv-study-paused:account-a'),false);
 await h.auth('account-b');assert.equal(h.ctx.__study.get().snapshot.enabled,true);
 await h.auth('account-a');assert.equal(h.ctx.__study.get().snapshot.enabled,false);
});

domTest('stale status arriving after an opt-out ACK cannot recheck the switch or replace statistics',async()=>{
 const h=ui({route:'profile'});h.resources.totals.set('account-a',60000);await h.ready();
 const original=h.ctx.SVRpc.studyStatus,stale=clone(h.ctx.__study.get().snapshot);let resolve;
 h.ctx.SVRpc.studyStatus=()=>new Promise(r=>resolve=r);
 const read=h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 await h.ctx.__study.settings(false,'Europe/Stockholm');
 resolve({...stale,enabled:true,totals:{today:0,week:0,month:0,all:0}});await read;await settle();
 assert.equal(h.ctx.__study.get().snapshot.enabled,false);
 assert.equal(h.ctx.__study.get().snapshot.totals.all,60000);
 assert.equal(h.document.querySelector('[data-study-enabled]').hasAttribute('checked'),false);
 h.ctx.SVRpc.studyStatus=original;
});

domTest('remote opt-out closes an active lease on refresh and adds no further intervals',async()=>{
 const h=ui();await h.ready();await h.tick();for(let i=0;i<6;i++)await h.tick();
 h.snapshot.enabled=false;h.snapshot.generation++;
 await h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 assert.equal(h.ctx.__study.get().lease,null);
 const total=h.total,opens=h.calls.filter(call=>call[0]==='open').length;
 for(let i=0;i<25;i++)await h.tick();
 assert.equal(h.total,total);assert.equal(h.calls.filter(call=>call[0]==='open').length,opens);
});

domTest('timezone update racing a remote opt-out cannot enable it using an old generation',async()=>{
 const h=ui();await h.ready();h.setTimezone('America/New_York');
 const original=h.ctx.SVRpc.studySettings;let conflict=true;
 h.ctx.SVRpc.studySettings=async args=>{
  if(conflict){conflict=false;h.snapshot.enabled=false;h.snapshot.generation++}
  return original(args);
 };
 await h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 assert.equal(h.snapshot.enabled,false);
 await h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 assert.equal(h.ctx.__study.get().snapshot.enabled,false);
 assert.equal(h.snapshot.enabled,false);
 assert.equal(h.calls.filter(call=>call[0]==='open').length,0);
});

domTest('late lease response after opt-out cannot start tracking',async()=>{
 const h=ui();await h.ready();let resolve;
 h.ctx.SVRpc.studyOpen=()=>new Promise(r=>resolve=r);
 await h.tick();await h.ctx.__study.settings(false,'Europe/Stockholm');
 resolve({available:true,id:'late',server_ms:0,end_ms:90000,generation:1,cursor_ms:0});await settle();
 assert.equal(h.ctx.__study.get().lease,null);
 for(let i=0;i<6;i++)await h.tick();assert.equal(h.total,0);
});

domTest('acknowledged opt-out can be explicitly enabled on another device without a stale browser veto',async()=>{
 const resources=shared(),a=ui({resources,route:'profile'});await a.ready();
 await a.ctx.__study.settings(false,'Europe/Stockholm');
 const b=ui({resources:{...resources,data:new Map()},route:'profile'});await b.ready();
 await b.ctx.__study.settings(true,'Europe/Stockholm');
 await a.ctx.__study.refresh(a.ctx.__study.get());
 assert.equal(a.document.querySelector('[data-study-enabled]').hasAttribute('checked'),true);
 assert.equal(a.snapshot.enabled,true);
 assert.equal(a.calls.filter(call=>call[0]==='settings'&&call[1].enabled).length,0,'no implicit enable');
});

domTest('older enable ACK cannot erase a newer pending opt-out from another tab',async()=>{
 const resources=shared(),a=ui({resources,enabled:false,route:'profile'}),b=ui({resources,route:'profile'});
 await a.ready();await b.ready();const original=a.ctx.SVRpc.studySettings;let resolve;
 a.ctx.SVRpc.studySettings=async args=>{const saved=await original(args);return new Promise(r=>resolve=()=>r(saved))};
 const enabling=a.ctx.__study.settings(true,'Europe/Stockholm');await settle();
 b.offline(true);await b.ctx.__study.settings(false,'Europe/Stockholm');await settle();
 const pending=resources.data.get('sv-study-paused:account-a');assert.match(pending,/^yes:/);
 resolve();await enabling;
 assert.equal(resources.data.get('sv-study-paused:account-a'),pending);
 assert.equal(a.document.querySelector('[data-study-enabled]').hasAttribute('checked'),false);
 a.ctx.SVRpc.studySettings=original;await a.reconnect();await a.ctx.__study.refresh(a.ctx.__study.get());await settle();
 assert.equal(a.snapshot.enabled,false);assert.equal(resources.data.has('sv-study-paused:account-a'),false);
});

domTest('failed status cannot acknowledge a pending opt-out using an old disabled snapshot',async()=>{
 const h=ui({enabled:false});await h.ready();
 h.resources.data.set('sv-study-paused:account-a','yes:pending');h.offline(true);
 await h.ctx.__study.refresh(h.ctx.__study.get());await settle();
 assert.equal(h.resources.data.get('sv-study-paused:account-a'),'yes:pending');
});

domTest('browser storage failure pauses locally without inventing an account opt-out',async()=>{
 const h=ui();await h.ready();h.ctx.localStorage.getItem=()=>{throw Error('blocked')};
 await h.ctx.__study.refresh(h.ctx.__study.get());await h.tick();
 assert.equal(h.snapshot.enabled,true);
 assert.equal(h.calls.filter(call=>call[0]==='settings'||call[0]==='open').length,0);
});
