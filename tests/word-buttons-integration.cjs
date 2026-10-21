// DOM + production app/RPC/queue. No SQL or real Supabase writes.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
const domModule=process.env.SL_UX_DOM_MODULE;
const A='a1000000-0000-0000-0000-000000000001',B='a1000000-0000-0000-0000-000000000002';
const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function resources(){
 const data=new Map(),stores=new Map(),tails=new Map();let sequence=0;
 const db={createObjectStore(name){stores.set(name,new Map())},transaction(name){const map=stores.get(name),tx={objectStore(){
  return Object.fromEntries(['get','getAll','put','add'].map(method=>[method,value=>{const req={};setImmediate(()=>{
   if(method==='get')req.result=clone(map.get(value));
   if(method==='getAll')req.result=clone([...map.values()]);
   if(method==='put'){const row=clone(value);map.set(name==='events'?row.sequence:row.userId,row)}
   if(method==='add'){const row={...clone(value),sequence:++sequence};map.set(row.sequence,row);req.result=row.sequence}
   req.onsuccess?.();setImmediate(()=>tx.oncomplete?.());
  });return req}]))}};return tx}};
 return {data,stores,indexedDB:{open(){const req={result:db};setImmediate(()=>{if(!stores.size)req.onupgradeneeded?.();req.onsuccess?.()});return req}},
 locks:{request(name,fn){const task=(tails.get(name)||Promise.resolve()).catch(()=>{}).then(()=>fn({name}));tails.set(name,task);return task}}};
}
function server(){
 const accounts=new Map(),calls=[];let failure=null,hold=null,capIntervals=false;
 const account=id=>{if(!accounts.has(id))accounts.set(id,{revision:0,content_version:'static-afaa62b7426e09a7',capabilities:['unmark_known','review_grade','known_reward_once','quiz_rewards_v1','video_set_v1','video_quizzes_v3'],state:{known:[],favorites:[],completed:[],videos:[],booksRead:[],reviews:{},activity:{},xp:0,answered:0,correct:0,quizResults:{},settings:{language:'ru',level:'A',speechSpeed:'slow',timezone:'Europe/Stockholm'},profile:{name:'Tester',avatarPath:null}},receipts:new Map(),rewarded:new Set()});return accounts.get(id)};
 return {calls,account,set failure(value){failure=value},set hold(value){hold=value},set capIntervals(value){capIntervals=value},async rpc(id,name,args){
  const a=account(id),snapshot=()=>{const {receipts,rewarded,...s}=a;return clone(s)};
  if(name==='sl_get_progress')return {data:snapshot()};
  assert.equal(name,'sl_apply_event');calls.push({id,args:clone(args)});
  if(hold)await hold;if(failure)return {error:{code:failure}};
  const event=args.p_event;if(a.receipts.has(args.p_event_id)){assert.equal(a.receipts.get(args.p_event_id),JSON.stringify(event));return {data:{duplicate:true,applied_revision:a.revision,progress:snapshot()}}}
  if(args.p_expected_revision!==a.revision)return {error:{code:'40001'}};
  const wid=event.data.word_id,s=a.state;
  // Model the 001-011 review helper and its table CHECK, including rollback.
  // capIntervals represents the prepared server patch, not a client fallback.
  if(event.type==='mark_known'&&s.reviews[wid]){
   const review=s.reviews[wid],rep=review.rep+1;
   const next=rep===1?1:rep===2?3:Math.max(1,Math.round(review.interval*review.ease));
   if(!capIntervals&&next>365000)return {error:{code:'23514',message:'new row for relation "sl_words" violates check constraint "sl_words_interval_days_check"',details:'private failing row must never be retained'}};
   s.reviews[wid]={...review,rep,interval:capIntervals?Math.min(365000,next):next,ease:Math.min(3,review.ease+.08)};
  }
  if(event.type==='mark_known'){if(!s.known.includes(wid))s.known.push(wid);if(!a.rewarded.has(wid)){s.xp+=8;a.rewarded.add(wid)}}
  else if(event.type==='unmark_known')s.known=s.known.filter(v=>v!==wid);
  else if(event.type==='favorite_set')s.favorites=event.data.value?[...new Set([...s.favorites,wid])]:s.favorites.filter(v=>v!==wid);
  else if(event.type==='video_set')s.videos=event.data.value?[...new Set([...s.videos,event.data.content_id])]:s.videos.filter(v=>v!==event.data.content_id);
  else throw Error('Unexpected event '+event.type);
  a.revision++;a.receipts.set(args.p_event_id,JSON.stringify(event));return {data:{duplicate:false,applied_revision:a.revision,progress:snapshot()}};
 }};
}
async function page({shared=resources(),backend=server(),owner=A}={}){
 const {parseHTML,HTMLElement}=require(domModule),{document,Event}=parseHTML(read('index.html'));
 const selectPrototype=Object.getPrototypeOf(document.querySelector('select'));
 Object.defineProperty(selectPrototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||''},set(value){for(const option of this.options)option.selected=option.value===String(value)}});
 HTMLElement.prototype.focus=function(){};HTMLElement.prototype.getBoundingClientRect=()=>({height:900,top:0,left:0});
 const listeners=[],notices=[];let identity={user:owner?{id:owner,email:'tester@example.invalid'}:null,identityRevision:1,status:owner?'signed_in':'signed_out'};
 const ctx={document,Event,console,URL,Response,AbortController,Date,Math,Intl,Image:function(){},crypto:require('node:crypto').webcrypto,
  location:{origin:'http://127.0.0.1:8765',hostname:'127.0.0.1',protocol:'http:',pathname:'/',hash:'#dictionary',search:''},history:{replaceState(){}},
  navigator:{onLine:true,locks:shared.locks},indexedDB:shared.indexedDB,
  localStorage:{getItem:k=>shared.data.get(k)??null,setItem:(k,v)=>shared.data.set(k,v)},
  setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);if(ms===15000)timer.unref();return timer},clearTimeout,matchMedia:()=>({matches:true}),scrollTo(){},addEventListener(){},
  fetch:async url=>new Response(read(url.replace('./','')),{headers:{'Content-Type':'application/json'}}),
  SVAuth:{getState:()=>identity,initialize:async()=>identity,getSession:async()=>identity.user?{user:identity.user,access_token:'test-token:'+identity.user.id}:null,refreshUser:async()=>identity.user,subscribe:fn=>listeners.push(fn)},
  SVSupabase:{getClient:async()=>({auth:{getUser:async token=>({data:{user:{id:token.split(':')[1]}}})},rpc(name,args){let uid;const builder={setHeader(_,value){uid=value.split(':')[1];return builder},retry(){return builder},then(ok,bad){return backend.rpc(uid,name,args).then(ok,bad)}};return builder}})}};
 ctx.window=ctx;vm.createContext(ctx);
 for(const file of ['locale-content.js','supabase-rpc.js','supabase-progress.js','app.js'])vm.runInContext(read(file).replace(/\nboot\(\);/g,''),ctx,{filename:file});
 const run=code=>vm.runInContext(code,ctx);ctx.notices=notices;run('toast=message=>notices.push(message)');await run('boot()');
 async function settle(){for(let i=0;i<40;i++)await new Promise(r=>setImmediate(r));await ctx.SVProgressDebug.flush();for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r))}
 await settle();
 return {ctx,run,document,backend,shared,notices,settle,
  async click(selector){const button=document.querySelector(selector);assert(button,selector);button.dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));await settle();return button},
  async identity(id){identity={user:id?{id,email:'tester@example.invalid'}:null,identityRevision:identity.identityRevision+1,status:id?'signed_in':'signed_out'};for(const fn of listeners)fn(identity);await settle()}};
}
const domTest=(name,fn)=>test(name,{skip:!domModule&&'Set SL_UX_DOM_MODULE for DOM integration'},fn);
domTest('real delegated clicks toggle known and favorites through owner RPC, reload and relogin',async()=>{
 const shared=resources(),guest=JSON.stringify({xp:504,known:['v-jobba'],favorites:['v-prata']});shared.data.set('sv-guest-v2',guest);
 const h=await page({shared});const input=h.document.querySelector('#dict-search');input.value='arbeta';input.dispatchEvent(new h.ctx.Event('input',{bubbles:true}));await h.settle();
 const kind=h.document.querySelector('#dict-kind');kind.value='verb';kind.dispatchEvent(new h.ctx.Event('change',{bubbles:true}));await h.settle();
 const search=h.document.querySelector('#dict-search'),row=h.document.querySelector('[data-word-link]');
 const known='[data-action="mark-known"][data-id="v-arbeta"]',star='[data-action="favorite"][data-id="v-arbeta"]';
 for(const [selector,field] of [[known,'known'],[star,'favorites']]){
  const button=await h.click(selector);assert.equal(button.getAttribute('aria-pressed'),'true');assert.deepEqual(h.backend.account(A).state[field],['v-arbeta']);
  assert.equal(h.document.querySelector('#dict-search'),search);assert.equal(h.document.querySelector('[data-word-link]'),row);
  await h.click(selector);assert.equal(button.getAttribute('aria-pressed'),'false');assert.deepEqual(h.backend.account(A).state[field],[]);
  await h.click(selector);
 }
 assert.equal(h.backend.account(A).state.xp,8);assert.equal(shared.data.get('sv-guest-v2'),guest);
 const reloaded=await page({shared:h.shared,backend:h.backend});assert.equal(reloaded.document.querySelector(known).getAttribute('aria-pressed'),'true');assert.equal(reloaded.document.querySelector(star).getAttribute('aria-pressed'),'true');
 await reloaded.identity(B);assert.equal(reloaded.document.querySelector(known).getAttribute('aria-pressed'),'false');
 await reloaded.identity(A);assert.equal(reloaded.document.querySelector(known).getAttribute('aria-pressed'),'true');
});
domTest('guest delegated clicks stay local and do not create cloud events',async()=>{
 const h=await page({owner:null});
 for(const selector of ['[data-action="mark-known"][data-id="v-arbeta"]','[data-action="favorite"][data-id="v-arbeta"]']){await h.click(selector);await h.click(selector)}
 assert.equal(h.backend.calls.length,0);const state=JSON.parse(h.shared.data.get('sv-guest-v2'));assert.deepEqual(state.known,[]);assert.deepEqual(state.favorites,[]);assert.equal(state.xp,8);
});
domTest('server rejection never changes either selected state or pretends to save',async()=>{
 for(const action of ['mark-known','favorite']){
  const h=await page();h.backend.failure='42501';const selector=`[data-action="${action}"][data-id="v-arbeta"]`;await h.click(selector);
  assert.equal(h.document.querySelector(selector).getAttribute('aria-pressed'),'false');
  assert.deepEqual(h.backend.account(A).state.known,[]);assert.deepEqual(h.backend.account(A).state.favorites,[]);
  assert.match(h.document.querySelector('.save-status').textContent,/Не удалось/);
 }
});

domTest('reproduces the reported 23514 SRS overflow and recovers original queued word/favorite UUIDs after the server patch',async()=>{
 const backend=server(),account=backend.account(A);
 account.state.xp=72;account.rewarded.add('v-arbeta');
 account.state.reviews['v-arbeta']={due:2000000000000,interval:130248,ease:3,rep:12};
 const h=await page({backend});
 const known='[data-action="mark-known"][data-id="v-arbeta"]',star='[data-action="favorite"][data-id="v-arbeta"]';
 await h.click(known);await h.click(star);
 assert.equal(h.ctx.SVProgress.writeStatus().error,'SRS_INTERVAL_LIMIT');
 assert.match(h.document.querySelector('.save-status').textContent,/ошибки расписания повторений/);
 assert.doesNotMatch(h.document.querySelector('.save-status').textContent,/23514|sl_words|private failing row/);
 assert.equal(h.document.querySelector(known).getAttribute('aria-pressed'),'false');
 assert.equal(h.document.querySelector(star).getAttribute('aria-pressed'),'false');
 assert.deepEqual(account.state.known,[]);assert.deepEqual(account.state.favorites,[]);assert.equal(account.state.xp,72);
 assert.equal(account.state.reviews['v-arbeta'].interval,130248,'failed statement rolls back the whole event');
 const rows=[...h.shared.stores.get('events').values()],intents=rows.map(r=>[r.eventId,r.eventJson]);
 assert.equal(rows.length,2);assert(rows.every(r=>r.status==='pending'));
 assert(backend.calls.every(c=>c.args.p_event.type==='mark_known'),'favorites wait behind failed word, rather than faking success');
 assert.equal(Math.round(130248*3),390744,'matches the real failing interval reported by the user');
 backend.capIntervals=true;
 await h.ctx.SVProgress.retry();await h.settle();
 assert.equal(account.state.reviews['v-arbeta'].interval,365000);
 assert.deepEqual(account.state.known,['v-arbeta']);assert.deepEqual(account.state.favorites,['v-arbeta']);assert.equal(account.state.xp,72);
 assert.deepEqual([...h.shared.stores.get('events').values()].map(r=>[r.eventId,r.eventJson]),intents);
 assert([...h.shared.stores.get('events').values()].every(r=>r.status==='applied'));
 assert.equal(h.document.querySelector(known).getAttribute('aria-pressed'),'true');assert.equal(h.document.querySelector(star).getAttribute('aria-pressed'),'true');
 await h.click(known);await h.click(known);await h.click(star);assert.equal(account.state.xp,72);assert.deepEqual(account.state.favorites,[]);
 const reloaded=await page({shared:h.shared,backend});assert.equal(reloaded.document.querySelector(known).getAttribute('aria-pressed'),'true');
});
domTest('newly rendered flashcards and word details keep delegated actions; pending double clicks coalesce',async()=>{
 const h=await page();h.run("navigate('flashcards')");
 for(let i=0;i<3;i++){
  await h.click('[data-action="flash-next"]');
  const id=h.run('flash.ids[flash.index]');await h.click('[data-action="flash-grade"][data-value="1"]');
  assert(h.backend.account(A).state.known.includes(id));
  await h.click('[data-action="favorite"]');assert(h.backend.account(A).state.favorites.includes(id));
 }
 h.run("navigate('word','v-prata')");const star=h.document.querySelector('[data-action="favorite"]'),before=h.backend.calls.length;
 let release;h.backend.hold=new Promise(resolve=>release=resolve);
 const target=star.querySelector('span')||star;target.dispatchEvent(new h.ctx.Event('click',{bubbles:true}));target.dispatchEvent(new h.ctx.Event('click',{bubbles:true}));
 for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));
 assert.equal(star.getAttribute('aria-busy'),'true');assert.equal(h.backend.calls.length,before+1);
 release();h.backend.hold=null;await h.settle();assert.equal(star.getAttribute('aria-busy'),'false');
});

domTest('a rejected click action reports an error without an unhandled rejection or local success',async()=>{
 const h=await page();h.run("setWordFavorite=async()=>{throw Error('simulated action failure')}");
 await h.click('[data-action="favorite"][data-id="v-arbeta"]');
 assert.match(h.notices.at(-1),/Не удалось сохранить/);
 assert.equal(h.document.querySelector('[data-action="favorite"][data-id="v-arbeta"]').getAttribute('aria-pressed'),'false');
 assert.deepEqual(h.backend.account(A).state.favorites,[]);assert.equal(h.backend.calls.length,0);
});

// Video actions use the production app, RPC identity binding and durable queue.
const watched='[data-action="watched"][data-id="ur-hitta1"]';
async function videos(h){h.run("navigate('videos')");await h.settle();return h}
domTest('every video card exposes the same elements in all four languages and verified episode quizzes',async()=>{
 const h=await videos(await page());
 for(const lang of ['ru','uk','en','sv']){
  h.run(`state.settings.language='${lang}';render()`);
  const cards=[...h.document.querySelectorAll('[data-video-id]')];assert.equal(cards.length,12);assert.equal(h.run('MORE_VIDEOS.filter(v=>v.question).length'),12);assert(!h.document.querySelector('[data-video-id="ur-alpha"]'));
  for(const c of cards){for(const selector of ['.video-preview img','.video-meta .chip','h3','.video-description','.video-watch-link','[data-action="watched"]','[data-video-completion]','[data-action="video-quiz"]','.video-save-scope','.video-quiz-note'])assert.equal(c.querySelectorAll(selector).length,1,c.dataset.videoId+selector);
   assert(!c.textContent.includes('↗'));assert(c.querySelector('[data-action="watched"]').getAttribute('aria-label'));
  }
 }
 h.run("state.settings.level='C'");assert.equal(h.run("videoLevelMatch(MORE_VIDEOS.find(v=>v.id==='ur-hitta4'))"),true,'B–D includes C');
 assert.equal(h.run("videoLevelMatch(MORE_VIDEOS.find(v=>v.id==='ur-sfi'))"),false,'broad collection is not a recommendation');
});
domTest('watched and undo sync across isolated devices, reload and relogin, independently of quiz and XP',async()=>{
 const backend=server(),h=await videos(await page({backend}));
 await h.click(watched);assert.equal(h.document.querySelector(watched).getAttribute('aria-pressed'),'true');assert.equal(h.run('state.xp'),0);assert.equal(h.run("quizPassed('video:ur-hitta1')"),false);
 const phone=await videos(await page({backend}));assert.equal(phone.document.querySelector(watched).getAttribute('aria-pressed'),'true');
 await phone.click(watched);await h.ctx.SVProgress.refresh();await h.settle();assert.equal(h.document.querySelector(watched).getAttribute('aria-pressed'),'false');
 await h.click(watched);const reloaded=await videos(await page({shared:h.shared,backend}));assert.equal(reloaded.document.querySelector(watched).getAttribute('aria-pressed'),'true');
 await reloaded.identity(B);reloaded.run("navigate('videos')");assert.equal(reloaded.document.querySelector(watched).getAttribute('aria-pressed'),'false');
 await reloaded.identity(A);reloaded.run("navigate('videos')");assert.equal(reloaded.document.querySelector(watched).getAttribute('aria-pressed'),'true');assert.equal(backend.account(A).state.xp,0);
});
domTest('offline intent is pending until ACK, survives reload and retries the same UUID',async()=>{
 const h=await videos(await page());h.backend.failure='NETWORK_ERROR';h.ctx.navigator.onLine=false;
 const button=h.document.querySelector(watched);await h.click(watched);await h.click(watched);
 assert.equal(button.getAttribute('aria-pressed'),'false');assert.equal(button.getAttribute('aria-busy'),'true');
 assert.match(button.closest('[data-video-progress]').textContent,/Ожидает сохранения/);
 const rows=[...h.shared.stores.get('events').values()];assert.equal(rows.length,1);const uuid=rows[0].eventId;
 const reloaded=await videos(await page({shared:h.shared,backend:h.backend}));assert.equal(reloaded.document.querySelector(watched).getAttribute('aria-busy'),'true');
 h.backend.failure=null;await reloaded.ctx.SVProgress.retry();await reloaded.settle();assert.equal(reloaded.document.querySelector(watched).getAttribute('aria-pressed'),'true');
 assert(h.backend.calls.every(c=>c.args.p_event_id===uuid));assert.equal(h.backend.account(A).state.xp,0);
});
domTest('old server stays gated; denied write never becomes local success',async()=>{
 const backend=server();backend.account(A).capabilities=backend.account(A).capabilities.filter(v=>v!=='video_set_v1');
 const h=await videos(await page({backend}));await h.click(watched);assert.equal(backend.calls.length,0);assert.match(h.document.querySelector(watched).closest('[data-video-progress]').textContent,/обновления сервера/);
 backend.account(A).capabilities.push('video_set_v1');await h.ctx.SVProgress.refresh();backend.failure='42501';await h.click(watched);
 assert.equal(h.document.querySelector(watched).getAttribute('aria-pressed'),'false');assert.equal(h.run('state.videos.length'),0);assert.equal(h.run('state.xp'),0);
 assert.equal(h.shared.data.get('sv-account-local-v1-'+A),undefined);
});
domTest('stale second-device watch intent requires explicit conflict recovery, no silent overwrite',async()=>{
 const backend=server(),mac=await videos(await page({backend})),phone=await videos(await page({backend}));
 await mac.click(watched);await phone.click(watched);assert.equal(phone.ctx.SVProgress.activity().pending[0].status,'conflict');
 assert.equal(phone.ctx.SVProgress.writeStatus().error,'VIDEO_STATE_CONFLICT');assert.match(phone.document.querySelector('.save-status').textContent,/другом устройстве/);
 await phone.click('[data-action="accept-video-state"]');assert.equal(phone.ctx.SVProgress.activity().pending.length,0);
 assert.equal(phone.document.querySelector(watched).getAttribute('aria-pressed'),'true');await phone.click(watched);assert.equal(backend.account(A).state.videos.length,0);
});
domTest('guest video toggles persist locally with zero XP and do not call cloud',async()=>{
 const h=await videos(await page({owner:null}));await h.click(watched);assert.equal(h.run('state.xp'),0);assert.match(h.document.querySelector(watched).closest('[data-video-progress]').textContent,/Только на этом устройстве/);
 const reload=await videos(await page({owner:null,shared:h.shared}));assert.equal(reload.document.querySelector(watched).getAttribute('aria-pressed'),'true');await reload.click(watched);assert.equal(reload.run('state.xp'),0);assert.equal(h.backend.calls.length,0);
});

domTest('new episode quizzes wait for the reviewed bank on accounts and existing expanded quizzes',async()=>{
 const backend=server();backend.account(A).capabilities=backend.account(A).capabilities.filter(v=>v!=='video_quizzes_v3');
 const h=await videos(await page({backend}));
 const selector='[data-action="video-quiz"][data-id="v1"]';assert.equal(h.document.querySelector(selector).getAttribute('aria-disabled'),'true');
 await h.click(selector);assert.equal(h.run('quiz.active'),false);assert.equal(backend.calls.length,0);
 assert.equal(h.document.querySelector('[data-action="video-quiz"][data-id="ur-hitta1"]').getAttribute('aria-disabled'),'true');
 backend.account(A).capabilities.push('video_quizzes_v3');await h.ctx.SVProgress.refresh();await h.settle();assert.equal(h.document.querySelector(selector).getAttribute('aria-disabled'),'false');
});

domTest('all twelve cards toggle watched and undo through production queue without XP or quiz changes',async()=>{
 const h=await videos(await page());
 const ids=JSON.parse(h.run('JSON.stringify(MORE_VIDEOS.filter(v=>v.question).map(v=>v.id))'));
 for(const id of ids){const selector='[data-action="watched"][data-id="'+id+'"]';await h.click(selector);assert.equal(h.document.querySelector(selector).getAttribute('aria-pressed'),'true',id);await h.click(selector);assert.equal(h.document.querySelector(selector).getAttribute('aria-pressed'),'false',id)}
 assert.equal(h.backend.calls.length,24);assert.equal(h.run('state.xp'),0);assert.equal(h.run('Object.keys(state.quizResults).length'),0);
});

domTest('expired or disabled videos retain history and block new quizzes and watch links',async()=>{
 const backend=server();backend.account(A).state.xp=12;backend.account(A).state.videos=['v1'];backend.account(A).state.quizResults={'video:v1':{correct:1,total:1,rewarded:true}};
 const h=await videos(await page({backend})),before=h.run('JSON.stringify(state)');
 h.run("MORE_VIDEOS.filter(v=>v.question).forEach(v=>v.availableUntil='2020-12-31');render()");
 assert.equal(h.document.querySelectorAll('[data-video-id]').length,12);
 assert.equal(h.document.querySelectorAll('.video-watch-link').length,0);
 assert.equal(h.document.querySelectorAll('[data-action="video-quiz"][aria-disabled="true"]').length,12);
 await h.click('[data-action="video-quiz"][data-id="v1"]');assert.equal(h.run('quiz.active'),false);
 assert.equal(h.run('JSON.stringify(state)'),before);assert.equal(backend.calls.length,0);
 assert.match(h.document.querySelector('[data-video-id="v1"]').textContent,/Исторический квиз пройден/);
});
