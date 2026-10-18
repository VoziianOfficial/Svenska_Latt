// Optional DOM integration suite: SL_UX_DOM_MODULE=/path/to/linkedom node --test tests/word-progress-dom.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const domModule=process.env.SL_UX_DOM_MODULE;
const root=path.resolve(__dirname,'..');
function ui({cloud=false,capable=true,scope=''}={}){
 const {parseHTML}=require(domModule),{document,HTMLElement}=parseHTML('<html><body><div id="search-results"></div><input id="global-search"><button id="close-modal"></button><div id="modal-backdrop"></div><button id="profile-top"></button><button id="sidebar-profile"></button><span id="top-xp"></span><span id="top-streak"></span><main id="page"></main></body></html>');
 let focused=null;
 Object.defineProperty(document,'activeElement',{get:()=>focused});
 HTMLElement.prototype.focus=function(options){focused=this;this.focusOptions=options};
 HTMLElement.prototype.getBoundingClientRect=function(){return {height:900,top:100,left:0}};
 const data=new Map(),pending=[],calls=[],notices=[];
 let release;
 const ctx={document,console,Date,Math,URL,Response,setTimeout,clearTimeout,Image:function(){},navigator:{onLine:true},location:{hash:'',hostname:'localhost',pathname:'/'},localStorage:{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)},matchMedia:()=>({matches:true})};
 const handlers={};ctx.window=ctx;let hashValue='';Object.defineProperty(ctx.location,'hash',{get:()=>hashValue,set:value=>hashValue=value?(value.startsWith('#')?value:'#'+value):''});ctx.addEventListener=(type,fn)=>{handlers[type]=fn};
 ctx.SVProgress={status:()=>({status:'ready',receivedAt:'2026-10-18T12:00:00Z'}),writeEnabled:cloud,writeStatus:()=>({ready:cloud}),activity:()=>({pending}),supports:()=>capable,enqueue:async(type,id,value)=>{calls.push({type,id,value});pending.push({type,wordId:id});await new Promise(r=>release=r);return true}};
 vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'flashcard-media.js'),'utf8'),ctx);vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\nboot\(\);/g,''),ctx);
 const run=code=>vm.runInContext(code,ctx);
 ctx.words=JSON.parse(fs.readFileSync(path.join(root,'words.json'),'utf8')).slice(0,12);
 ctx.notices=notices;
 run(`toast=message=>notices.push(message);WORDS=words;state=defaultState();route='dictionary';routeParam=${JSON.stringify(scope)};user=${cloud?"{id:'test-account'}":'null'};render=()=>{throw Error('full page replacement forbidden')};`);
 const page=document.querySelector('#page');
 function mount(){page.innerHTML=run('renderDictionary()');run('renderProgressUX()')}
 mount();
 return {ctx,run,page,document,handlers,pending,calls,notices,mount,ack(){pending.length=0;release?.()},data};
}
const domTest=(name,fn)=>test(name,{skip:!domModule&&'Set SL_UX_DOM_MODULE to run DOM integration tests'},fn);
domTest('favorite waits for ACK, blocks double click and preserves search, nodes and focus',async()=>{
 const h=ui({cloud:true});h.run("dictFilter.text='arbeta';dictFilter.kind='verb';dictFilter.group='1';dictFilter.category='Глаголы';dictFilter.limit=84");h.mount();
 const search=h.document.querySelector('#dict-search'),row=h.page.querySelector('[data-word-link]'),star=row.querySelector('[data-action="favorite"]'),id=star.dataset.id;
 star.focus();const before=h.run('JSON.stringify(dictFilter)');
 const saving=h.run(`setWordFavorite(${JSON.stringify(id)})`);await h.run(`setWordFavorite(${JSON.stringify(id)})`);
 assert.equal(h.calls.length,1);assert.equal(star.textContent,'☆');assert.equal(star.getAttribute('aria-busy'),'true');assert.equal(h.document.activeElement,star);
 h.run('refreshWordUI()');assert.equal(h.document.querySelector('#dict-search'),search);assert.equal(h.page.querySelector('[data-word-link]'),row);assert.equal(h.run('JSON.stringify(dictFilter)'),before);
 h.ctx.savedId=id;h.run('state.favorites=[savedId];refreshWordUI(true)');h.ack();await saving;
 assert.equal(star.textContent,'★');assert.equal(star.getAttribute('aria-busy'),'false');assert.equal(h.document.activeElement,star);assert.equal(h.page.querySelector('[data-word-link]'),row);
});
domTest('favorite removal retains other cards and moves focus without scrolling',async()=>{
 const h=ui({scope:'favorites'});h.run('state.favorites=WORDS.slice(0,3).map(w=>w.id)');h.mount();
 const rows=[...h.page.querySelectorAll('[data-word-link]')],star=rows[1].querySelector('[data-action="favorite"]');star.focus();
 await h.run(`setWordFavorite(${JSON.stringify(star.dataset.id)})`);
 assert.equal(rows[1].isConnected,false);assert.equal(h.page.querySelectorAll('[data-word-link]').length,2);assert.equal(h.page.querySelector('[data-word-link]'),rows[0]);assert.equal(h.document.activeElement,rows[2]);assert.equal(rows[2].focusOptions.preventScroll,true);assert.equal(h.page.style.minHeight,'900px');
});
domTest('last favorite produces empty state while preserving search and document height',async()=>{
 const h=ui({scope:'favorites'});h.run('state.favorites=[WORDS[0].id]');h.mount();const search=h.document.querySelector('#dict-search');
 await h.run('setWordFavorite(WORDS[0].id)');assert.ok(h.page.querySelector('.empty-state'));assert.equal(h.page.querySelector('.words-grid'),null);assert.equal(h.document.querySelector('#dict-search'),search);assert.equal(h.page.style.minHeight,'900px');
});
domTest('one learning toggle preserves history, favorite and XP without a confirmation panel',async()=>{
 const h=ui({scope:'learned'});h.run('state.known=[WORDS[0].id];state.xp=8;state.favorites=[WORDS[0].id];state.reviews[WORDS[0].id]={due:123,rep:2}');h.mount();
 const row=h.page.querySelector('[data-word-link]'),btn=row.querySelector('[data-action="mark-known"]');btn.focus();assert.equal(btn.textContent,'✓ Знаю');
 await h.run("action({dataset:{action:'mark-known',id:WORDS[0].id}})");
 assert.equal(row.isConnected,false);assert.equal(h.page.querySelector('.known-confirm'),null);assert.equal(h.run('state.xp'),8);assert.equal(h.run('state.favorites.length'),1);assert.equal(h.run('state.reviews[WORDS[0].id].due'),123);assert.deepEqual(h.notices,['Отметка снята']);
 await h.run('learnWord(WORDS[0].id)');assert.equal(h.run('state.xp'),8);assert.equal(h.page.querySelector('[data-action="mark-known"]').textContent,'✓ Знаю');
});
domTest('server without migration shows selected read-only state with no panel, event or toast',async()=>{
 const h=ui({cloud:true,capable:false,scope:'learned'});h.run('state.known=[WORDS[0].id]');h.mount();const btn=h.page.querySelector('[data-action="mark-known"]');
 assert.equal(btn.textContent,'✓ Знаю');assert.equal(btn.disabled,true);assert.equal(btn.getAttribute('aria-pressed'),'true');
 await h.run("action({dataset:{action:'mark-known',id:WORDS[0].id}})");assert.equal(h.page.querySelector('.known-confirm'),null);assert.doesNotMatch(h.page.textContent,/обновления сервиса|Вернуть в изучение/);assert.equal(h.calls.length,0);assert.equal(h.run('state.known.length'),1);assert.deepEqual(h.notices,[]);
});
domTest('word and topic keep their content while favorite changes',async()=>{
 for(const route of ['word','topic','flashcards']){
  const h=ui();h.run(`route=${JSON.stringify(route)};routeParam=WORDS[0].id;flash.ids=[WORDS[0].id];flash.index=0`);
  h.page.innerHTML=route==='word'?h.run('renderWord()'):route==='topic'?h.run('wordEntry(WORDS[0])'):'<div class="flash-control-row"></div>';
  h.run('renderProgressUX()');const content=h.page.firstElementChild,star=h.page.querySelector('[data-action="favorite"]');star.focus();await h.run('setWordFavorite(WORDS[0].id)');assert.equal(h.page.firstElementChild,content);assert.equal(star.getAttribute('aria-pressed'),'true');assert.equal(h.document.activeElement,star);
 }
});
domTest('offline favorite remains unchanged and focused across repeated progress notifications',async()=>{
 const h=ui({cloud:true});h.ctx.navigator.onLine=false;
 const row=h.page.querySelector('[data-word-link]'),star=row.querySelector('[data-action="favorite"]');star.focus();
 const saving=h.run('setWordFavorite(WORDS[0].id)');h.run('refreshWordUI();refreshWordUI()');
 assert.equal(star.textContent,'☆');assert.equal(h.document.activeElement,star);assert.match(h.page.querySelector('.save-status').textContent,/подключении к интернету/);assert.equal(h.calls.length,1);
 assert.doesNotMatch(h.page.querySelector('.save-status').textContent,/RPC|IndexedDB|ревизи|очеред/);h.ack();await saving;assert.equal(star.textContent,'☆');
});
domTest('a newer snapshot cancels a retiring card instead of removing the restored favorite',async()=>{
 const h=ui({scope:'favorites'});h.run('state.favorites=WORDS.slice(0,3).map(w=>w.id)');h.mount();h.ctx.matchMedia=()=>({matches:false});
 const row=h.page.querySelector('[data-word-link]'),palette=row.getAttribute('style');let finish;
 row.animate=()=>({finished:new Promise(r=>finish=r)});row.getAnimations=()=>[{cancel(){finish()}}];
 h.run('state.favorites=state.favorites.slice(1);refreshWordUI()');assert.equal(row.dataset.retiring,'true');
 h.run('state.favorites=WORDS.slice(0,3).map(w=>w.id);refreshWordUI()');await Promise.resolve();
 assert.equal(row.isConnected,true);assert.equal(row.dataset.retiring,undefined);assert.equal(row.getAttribute('style'),palette);assert.equal(h.page.querySelectorAll('[data-word-link]').length,3);
});
domTest('authenticated read-only mode cannot report a local unmark or favorite as saved',async()=>{
 const h=ui({scope:'learned'});h.run("user={id:'read-only-account'};state.known=[WORDS[0].id]");h.mount();
 assert.equal(h.page.querySelector('[data-action="mark-known"]').disabled,true);assert.equal(h.page.querySelector('[data-action="favorite"]').getAttribute('aria-disabled'),'true');
 await h.run('unlearnWord(WORDS[0].id)');assert.deepEqual(h.notices,[]);await h.run('setWordFavorite(WORDS[0].id)');await h.run('learnWord(WORDS[1].id)');
 assert.equal(h.run('state.known.length'),1);assert.equal(h.run('state.favorites.length'),0);assert.equal(h.data.size,0);assert.equal(h.calls.length,0);
});
domTest('cloud unmark waits for a confirmed snapshot and excludes fast repeated clicks',async()=>{
 const h=ui({cloud:true,scope:'learned'});h.run('state.known=WORDS.slice(0,3).map(w=>w.id);state.xp=24');h.mount();
 const rows=[...h.page.querySelectorAll('[data-word-link]')],btn=rows[1].querySelector('[data-action="mark-known"]'),search=h.document.querySelector('#dict-search');btn.focus();
 h.ctx.targetId=btn.dataset.id;const saving=h.run("action({dataset:{action:'mark-known',id:targetId}})");await h.run("action({dataset:{action:'mark-known',id:targetId}})");
 assert.equal(h.calls.length,1);assert.equal(h.calls[0].type,'unmark_known');assert.equal(btn.textContent,'✓ Знаю');assert.equal(btn.getAttribute('aria-busy'),'true');assert.equal(h.document.activeElement,btn);assert.equal(rows[1].isConnected,true);assert.deepEqual(h.notices,[]);
 h.run('state.known=state.known.filter(id=>id!==targetId);refreshWordUI(true)');h.ack();await saving;
 assert.equal(rows[1].isConnected,false);assert.equal(rows[0].isConnected,true);assert.equal(rows[2].isConnected,true);assert.equal(h.document.activeElement,rows[2]);assert.equal(h.document.querySelector('#dict-search'),search);assert.equal(h.run('state.xp'),24);
});
domTest('all learned words are visible together with photos, names, translations and detail links',()=>{
 const h=ui({scope:'learned'});h.ctx.moreWords=JSON.parse(fs.readFileSync(path.join(root,'words.json'),'utf8')).slice(0,70);h.run('WORDS=moreWords;state.known=WORDS.map(w=>w.id)');h.mount();
 const rows=[...h.page.querySelectorAll('[data-word-link]')];assert.equal(rows.length,70);assert.equal(h.page.querySelector('[data-action="dict-more"]'),null);assert.equal(h.page.querySelector('[data-action="show-learned"]').classList.contains('active'),true);
 for(const row of rows){assert.ok(row.querySelector('.word-info strong').textContent);assert.ok(row.querySelector('.word-info small').textContent);assert.ok(row.querySelector('img.word-list-photo').getAttribute('src').startsWith('./assets/flashcards/'));assert.equal(row.querySelector('[data-action="mark-known"]').textContent,'✓ Знаю');assert.ok(row.querySelector('[data-nav="word"]'))}
});
domTest('learned counter opens the dictionary list and restores its filters, scroll and focus on return',async()=>{
 const h=ui();h.ctx.scrolled=[];h.ctx.scrollTo=options=>{h.ctx.scrolled.push(options.top);h.ctx.scrollY=options.top};h.run('render=()=>{document.querySelector("#page").innerHTML=route==="dictionary"?renderDictionary():route==="word"?renderWord():"<div class=\\"flash-control-row\\"></div>";renderProgressUX()};state.known=WORDS.map(w=>w.id);route="flashcards";flash.ids=WORDS.map(w=>w.id)');h.run('render()');
 const counter=h.page.querySelector('[data-action="show-learned"]');assert.ok(counter);assert.equal(h.page.querySelector('[data-action="flash-scope"][data-scope="known"]'),null);
 await h.run("action({dataset:{action:'show-learned'}})");assert.equal(h.run("route+'|'+routeParam"),'dictionary|learned');assert.equal(h.page.querySelectorAll('[data-word-link]').length,12);
 h.run("dictFilter.text='ar';dictFilter.kind='verb';dictFilter.group='1';dictFilter.category='Глаголы'");h.run('render()');h.ctx.scrollY=340;const row=h.page.querySelector('[data-word-link]');row.focus();h.ctx.targetId=row.dataset.wordLink;
 h.run("navigate('word',targetId)");const back=h.page.querySelector('.back-link');assert.equal(back.dataset.param,'learned');assert.equal(h.ctx.scrolled.at(-1),0);
 await h.run("action({dataset:{nav:'dictionary',param:'learned'}})");assert.equal(h.ctx.scrolled.at(-1),340);assert.equal(h.run('dictFilter.text'),'ar');assert.equal(h.run('dictFilter.group'),'1');assert.equal(h.run('dictFilter.category'),'Глаголы');assert.equal(h.document.activeElement.dataset.wordLink,h.ctx.targetId);assert.equal(h.document.activeElement.focusOptions.preventScroll,true);
 const before=h.page.querySelector('#dict-search');await h.run("action({dataset:{action:'show-learned'}})");assert.equal(h.page.querySelector('#dict-search'),before);assert.equal(h.ctx.scrolled.at(-1),340);
});
domTest('manual reviews unavailable before migration cannot mutate progress or open an exercise',async()=>{
 const h=ui({cloud:true,capable:false});h.run("route='word';routeParam=WORDS[0].id;state.known=[WORDS[0].id]");h.page.innerHTML=h.run('renderWord()');h.run('renderProgressUX()');
 const review=h.page.querySelector('[data-action="mark-review"]');assert.equal(review.hidden,false);assert.equal(review.textContent,' Повторить');
 await h.run("action({dataset:{action:'mark-review',id:WORDS[0].id}})");assert.equal(h.run('route'),'word');assert.equal(h.calls.length,0);assert.equal(h.run('state.known.length'),1);assert.equal(h.notices.length,1);
 assert.doesNotMatch(h.run('renderWordReview()'),/word-recall/);
});
domTest('offline supported toggle keeps the selected label, focus and filters while awaiting the server',async()=>{
 const h=ui({cloud:true});h.ctx.navigator.onLine=false;h.run('state.known=[WORDS[0].id]');h.mount();const btn=h.page.querySelector('[data-action="mark-known"]');btn.focus();const search=h.page.querySelector('#dict-search');
 const saving=h.run('unlearnWord(WORDS[0].id)');h.run('refreshWordUI();refreshWordUI()');assert.equal(btn.textContent,'✓ Знаю');assert.equal(btn.getAttribute('aria-pressed'),'true');assert.equal(h.document.activeElement,btn);assert.equal(h.page.querySelector('#dict-search'),search);assert.equal(h.calls.length,1);assert.deepEqual(h.notices,[]);h.ack();await saving;
});
domTest('programmatic hash navigation renders once; browser Back restores the learned collection',()=>{
 const h=ui({scope:'learned'});h.ctx.renderCount=0;h.ctx.scrollTo=options=>h.ctx.scrollY=options.top;h.run('state.known=WORDS.map(w=>w.id);render=()=>{renderCount++;document.querySelector("#page").innerHTML=route==="dictionary"?renderDictionary():renderWord();renderProgressUX()};bindEvents()');h.mount();h.ctx.scrollY=275;
 h.run("navigate('word',WORDS[0].id)");assert.equal(h.ctx.renderCount,1);h.handlers.hashchange();assert.equal(h.ctx.renderCount,1,'native hashchange must not replace a freshly rendered page');
 h.ctx.location.hash='#dictionary/learned';h.handlers.hashchange();assert.equal(h.run("route+'|'+routeParam"),'dictionary|learned');assert.equal(h.ctx.scrollY,275);assert.equal(h.ctx.renderCount,2);
});
domTest('supported repeated practice leaves the selected learning toggle intact',()=>{
 const h=ui({cloud:true});h.run('route="word";routeParam=WORDS[0].id;state.known=[WORDS[0].id]');h.page.innerHTML=h.run('renderWord()');h.run('renderProgressUX()');
 const known=h.page.querySelector('[data-action="mark-known"]'),review=h.page.querySelector('[data-action="mark-review"]');assert.equal(known.textContent,'✓ Знаю');assert.equal(review.hidden,false);assert.equal(review.disabled,false);assert.equal(review.textContent.includes(' Повторить'),true);assert.equal(h.calls.length,0);
});

async function withManualQueue(){
 const h=ui({cloud:true});let entries=[],revision=0,changeHold=null;
 const crypto=require('node:crypto');h.ctx.crypto={randomUUID:crypto.randomUUID};h.ctx.setInterval=()=>{};
 h.ctx.SVAuth={getState:()=>({user:{id:'test-account'},identityRevision:1}),subscribe(){}};
 const grades=[];
 h.ctx.SVRpc={reviewList:async()=>({revision,entries:structuredClone(entries)}),reviewChange:async body=>{
  if(changeHold){await changeHold;changeHold=null}
  let row=entries.find(e=>e.word_id===body.wordId);if(!row){row={word_id:body.wordId};entries.push(row)}
  row.active=['add','again'].includes(body.action);row.version=body.requestId;revision++;
  if(['remember','again'].includes(body.action))grades.push(body.action);
  return {duplicate:false,conflict:false,queue:{revision,entries:structuredClone(entries)}};
 }};
 vm.runInContext(fs.readFileSync(path.join(root,'manual-reviews.js'),'utf8'),h.ctx);
 h.run('SVManualReviews.initialize(manualQueueChanged)');await new Promise(r=>setImmediate(r));
 return {...h,grades,hold(promise){changeHold=promise}};
}
domTest('manual add preserves dictionary search, filters, focus and nodes; ACK exposes word in common list',async()=>{
 const h=await withManualQueue();h.run("dictFilter.text='ar';dictFilter.kind='verb';dictFilter.limit=84");h.mount();
 const search=h.page.querySelector('#dict-search'),row=h.page.querySelector('[data-word-link]'),btn=row.querySelector('[data-action="mark-review"]');btn.focus();
 const before=h.run('JSON.stringify(state)'),filters=h.run('JSON.stringify(dictFilter)');h.ctx.targetId=btn.dataset.id;let release;h.hold(new Promise(r=>release=r));
 const first=h.run("action({dataset:{action:'mark-review',id:targetId}})");await h.run("action({dataset:{action:'mark-review',id:targetId}})");
 assert.equal(btn.textContent,' Повторить');assert.equal(btn.disabled,true);assert.equal(h.run('manualReviewIds().length'),0);
 release();await first;assert.equal(btn.textContent,' Повторить');assert.equal(btn.classList.contains('is-queued'),true);assert.equal(btn.getAttribute('aria-pressed'),'true');assert.equal(h.run('route'),'dictionary');assert.equal(h.run('JSON.stringify(state)'),before);assert.equal(h.run('JSON.stringify(dictFilter)'),filters);assert.equal(h.page.querySelector('#dict-search'),search);assert.equal(h.page.querySelector('[data-word-link]'),row);assert.equal(h.document.activeElement,btn);
 h.run("route='reviews'");h.page.innerHTML=h.run('renderReviews()');assert.equal(h.page.querySelectorAll('[data-review-id]').length,1);assert.match(h.page.querySelector('[data-review-count]').textContent,/1/);assert.ok(h.page.querySelector('.word-info small').textContent);assert.ok(h.page.querySelector('img.word-list-photo'));assert.ok(h.page.querySelector('[data-nav="word-review"]'));
});
domTest('recall requires reveal; remember removes word from the list after ACK, again keeps it',async()=>{
 const h=await withManualQueue();await h.run('addManualReview(WORDS[0].id)');const before=h.run('JSON.stringify(state)');
 h.run("route='word-review';routeParam=WORDS[0].id");h.page.innerHTML=h.run('renderWordReview()');
 assert.equal(h.page.querySelector('.recall-translation'),null);await h.run('gradeWordReview(true)');assert.equal(h.grades.length,0);
 h.run('reviewExercise.revealed=true');h.page.innerHTML=h.run('renderWordReview()');let release;h.hold(new Promise(r=>release=r));const first=h.run('gradeWordReview(true)');await h.run('gradeWordReview(true)');
 assert.equal(h.run('manualReviewIds().length'),1);release();await first;assert.equal(h.run('manualReviewIds().length'),0);assert.match(h.page.textContent,/Слово убрано/);assert.deepEqual(h.grades,['remember']);
 h.run("route='reviews'");h.page.innerHTML=h.run('renderReviews()');assert.ok(h.page.querySelector('.empty-state'));assert.match(h.page.querySelector('[data-review-count]').textContent,/0/);
 await h.run('addManualReview(WORDS[0].id)');h.run("route='word-review';routeParam=WORDS[0].id;reviewExercise=null");h.page.innerHTML=h.run('renderWordReview()');h.run('reviewExercise.revealed=true');await h.run('gradeWordReview(false)');assert.equal(h.run('manualReviewIds().length'),1);assert.match(h.page.textContent,/остаётся/);assert.deepEqual(h.grades,['remember','again']);assert.equal(h.run('JSON.stringify(state)'),before);
});
domTest('manual removal preserves other list rows and document height without navigating',async()=>{
 const h=await withManualQueue();await h.run('addManualReview(WORDS[0].id);addManualReview(WORDS[1].id)');await new Promise(r=>setImmediate(r));
 h.run("route='reviews'");h.page.innerHTML=h.run('renderReviews()');const rows=[...h.page.querySelectorAll('[data-review-id]')];rows[0].querySelector('[data-action="remove-review"]').focus();
 await h.run("action({dataset:{action:'remove-review',id:WORDS[0].id}})");assert.equal(rows[0].isConnected,false);assert.equal(rows[1].isConnected,true);assert.equal(h.page.style.minHeight,'900px');assert.equal(h.run('route'),'reviews');assert.equal(h.grades.length,0);assert.equal(h.document.activeElement,rows[1].querySelector('button'));
});
domTest('flashcard review control receives the same confirmed queue state without an automatic exercise',async()=>{
 const h=await withManualQueue();h.run("route='flashcards';flash.ids=[WORDS[0].id];flash.index=0");h.page.innerHTML='<button data-action="flash-grade" data-value="0" disabled>Повторить</button>';h.run('manualQueueChanged()');
 const btn=h.page.querySelector('button');assert.equal(btn.disabled,false);assert.equal(btn.textContent,' Повторить');await h.run("action({dataset:{action:'flash-grade',value:'0'}})");assert.equal(btn.textContent,' Повторить');assert.equal(btn.classList.contains('is-queued'),true);assert.equal(btn.disabled,true);assert.equal(h.run('route'),'flashcards');assert.equal(h.grades.length,0);
});

domTest('account photo and name open the profile once and close the mobile drawer',()=>{
 const h=ui();
 const {parseHTML}=require(domModule);
 const shell=parseHTML(fs.readFileSync(path.join(root,'index.html'),'utf8')).document;
 h.document.body.innerHTML=shell.body.innerHTML;
 h.run("user={name:'Yuliia'};state.profile={name:'Yuliia',avatar:''};window.profileVisits=[];navigate=(key)=>profileVisits.push(key);renderNav();bindEvents()");
 assert.ok(fs.existsSync(path.join(root,'assets/avatars/pippi-cartoon.png')));
 for(const selector of ['#sidebar-profile .user-image','#sidebar-profile strong','#profile-top .user-image']){
  const target=h.document.querySelector(selector);assert.ok(target,selector);
  h.document.querySelector('#app').classList.add('nav-open');
  target.dispatchEvent(new h.document.defaultView.Event('click',{bubbles:true}));
  assert.equal(h.document.querySelector('#app').classList.contains('nav-open'),false);
 }
 assert.equal(h.run('JSON.stringify(profileVisits)'),JSON.stringify(['profile','profile','profile']));
 h.run("state.profile.avatar='data:image/png;base64,aGVsbG8=';renderNav()");
 assert.equal(h.document.querySelector('#sidebar-profile img').getAttribute('src'),'data:image/png;base64,aGVsbG8=');
 assert.equal(h.document.querySelector('#profile-top img').getAttribute('src'),'data:image/png;base64,aGVsbG8=');
});

domTest('profile shows account XP, keeps email in settings and reports failed reads without a false zero',()=>{
 const h=ui({cloud:true});
 h.ctx.SVProgress.status=()=>({status:'ready',receivedAt:'2026-10-18T12:00:00Z'});
 h.ctx.SVManualReviews={state:()=>({ready:true,entries:[],pending:[],error:null})};
 h.run("user={id:'test-account',name:'Yuliia',email:'profile@example.test'};state.xp=1280;state.settings.level='C';route='profile'");
 for(const language of ['ru','en','sv','uk']){
  h.run(`state.settings.language=${JSON.stringify(language)}`);
  h.page.innerHTML=h.run('renderProfile()');h.run('renderProgressUX()');
  assert.match(h.page.querySelector('.profile-level').textContent,/1280 XP/);
  assert.equal(h.page.querySelector('.profile-person').textContent.includes('profile@example.test'),false);
  assert.match(h.page.querySelector('.account-email').textContent,/profile@example.test/);
  assert.equal(h.page.querySelectorAll('.save-status:not(.hidden)').length,0);
  assert.doesNotMatch(h.page.textContent,/синхронизац.*выключена|синхронізацію вимкнено|Cloud sync is currently off|Molnsynkronisering är avstängd/);
 }
 h.ctx.SVProgress.status=()=>({status:'error',receivedAt:null,errorCode:'PGRST202'});
 h.run("state.settings.language='ru';state.xp=0");
 h.page.innerHTML=h.run('renderProfile()');h.run('renderProgressUX()');
 assert.match(h.page.querySelector('.profile-level').textContent,/— XP/);
 assert.doesNotMatch(h.page.querySelector('.profile-level').textContent,/0 XP/);
 const status=h.page.querySelector('.save-status');
 assert.match(status.textContent,/Не удалось загрузить прогресс/);
 assert.ok(status.querySelector('[data-action="save-retry"]'));
 assert.doesNotMatch(status.textContent,/Supabase|RPC|PGRST|IndexedDB|localStorage/);
});

domTest('failed Auth restoration shows a compact connection notice instead of silently remaining a guest',()=>{
 const h=ui();h.ctx.SVAuth={getState:()=>({status:'unavailable'})};
 h.run("route='profile'");h.page.innerHTML=h.run('renderProfile()');h.run('renderProgressUX()');
 const status=h.page.querySelector('.save-status');
 assert.match(status.textContent,/Не удалось подключиться/);
 assert.ok(status.querySelector('[data-action="auth-retry"]'));
 assert.doesNotMatch(status.textContent,/Supabase|RPC|JWT|SDK|localStorage/);
 h.ctx.SVAuth.getState=()=>({status:'signed_out'});h.run('renderProgressUX(true)');
 assert.equal(h.page.querySelector('.save-status'),null);
});
