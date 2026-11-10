/* Semantic DOM acceptance; does not emulate Safari layout or native iOS UI.
   SL_UX_DOM_MODULE=/tmp/sl-mobile-qa/node_modules/linkedom node --test tests/mobile-interactions.cjs */
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const dom=process.env.SL_UX_DOM_MODULE;
function ui(){
 const {document,Event,HTMLElement,HTMLSelectElement}=require(dom).parseHTML(read('index.html'));
 // linkedom does not implement the browser's writable select.value.
 Object.defineProperty(HTMLSelectElement.prototype,'value',{configurable:true,get(){return this.querySelector('option[selected]')?.value||this.querySelector('option')?.value||''},set(value){for(const option of this.querySelectorAll('option'))option.selected=option.value===value}});
 HTMLElement.prototype.getBoundingClientRect=function(){return {left:0,top:0,right:320,bottom:44,width:320,height:44}};
 HTMLElement.prototype.scrollIntoView=function(){};
 HTMLElement.prototype.focus=function(){};
 HTMLElement.prototype.getClientRects=function(){return [{}]};
 const saved=new Map(),session=new Map(),listeners={};
 const ctx={console,document,Event,HTMLElement,URL,Response,Date,Math,Intl,crypto:require('node:crypto').webcrypto,Image:function(){},
  location:{hash:'',hostname:'localhost',pathname:'/',protocol:'http:'},navigator:{onLine:true},
  setTimeout:(fn,ms)=>{const timer=setTimeout(fn,ms);timer.unref();return timer},clearTimeout,
  requestAnimationFrame:fn=>fn(),cancelAnimationFrame(){},scrollTo(){},matchMedia:()=>({matches:true,addEventListener(){}}),
  localStorage:{getItem:k=>saved.get(k)||null,setItem:(k,v)=>saved.set(k,v)},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},
  addEventListener:(name,fn)=>(listeners[name]??=[]).push(fn)};
 ctx.window=ctx;vm.createContext(ctx);vm.runInContext(read('locale-content.js'),ctx);vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),ctx);
 const run=s=>vm.runInContext(s,ctx);
 for(const [key,file] of [['WORDS','words.json'],['LESSONS','lessons.json'],['BOOKS','books.json']])run(`${key}=${read(file)}`);
 run('state=defaultState();bindEvents();render()');
 const click=async selector=>{const e=document.querySelector(selector);assert(e,selector);e.dispatchEvent(new Event('click',{bubbles:true,cancelable:true}));await new Promise(r=>setImmediate(r));};
 return {ctx,run,click,document,saved};
}
const domTest=(name,fn)=>test(name,{skip:!dom&&'Set SL_UX_DOM_MODULE for semantic DOM checks'},fn);
domTest('actual delegated nested clicks open all SFI levels, every lesson and every topic after rerenders',async()=>{
 const h=ui();
 for(const level of 'ABCD'){
  h.run("navigate('home')");await h.click(`.course-tile[data-level="${level}"] .home-course-level`);
  assert.equal(h.run('route'),'lessons');assert.equal(h.run('selectedLevel'),level);
  const ids=h.run('LESSONS.filter(l=>l.level===selectedLevel).map(l=>l.id)');
  for(const id of ids){h.run(`navigate('lessons','${level}')`);await h.click(`[data-lesson-link="${id}"] h3`);assert.equal(h.run('routeParam'),id);assert.equal(h.run('route'),'lesson')}
 }
 const categories=h.run('topicNames3()');
 for(const category of categories){h.run("navigate('topics')");const button=[...h.document.querySelectorAll('.topic-card')].find(e=>e.dataset.param===category);assert(button,category);button.querySelector('h3').dispatchEvent(new h.ctx.Event('click',{bubbles:true}));await new Promise(r=>setImmediate(r));assert.equal(h.run('route'),'topic');assert.equal(h.run('routeParam'),category)}
});
domTest('home shortcut clones retain delegated actions; mobile menu and profile routes work',async()=>{
 const h=ui();
 for(const route of ['lessons','topics','dictionary','practice','reviews','videos','books','rules','alphabet']){
  h.run("navigate('home')");const card=h.document.querySelector(`.home-action-card[data-nav="${route}"]`);assert(card,route);
  const clone=card.cloneNode(true);clone.dataset.sliderClone='1';card.parentElement.appendChild(clone);
  clone.querySelector('span').dispatchEvent(new h.ctx.Event('click',{bubbles:true}));await new Promise(r=>setImmediate(r));assert.equal(h.run('route'),route);
 }
 for(const route of ['home','lessons','practice','videos','profile']){await h.click(`#mobile-nav [data-nav="${route}"]`);assert.equal(h.run('route'),route)}
 await h.click('#bottom-menu-open');assert(h.document.querySelector('#app').classList.contains('nav-open'));
 await h.click('#drawer-close');assert(!h.document.querySelector('#app').classList.contains('nav-open'));
});
domTest('word details, guest favorite/known persistence, every practice mode, number and reference controls',async()=>{
 const h=ui();h.run("navigate('dictionary')");const id=h.document.querySelector('[data-word-link]').dataset.wordLink;
 await h.click('[data-word-link] .word-info strong');assert.equal(h.run('route'),'word');assert.equal(h.run('routeParam'),id);
 await h.click('[data-action="favorite"]');assert(h.run('state.favorites').includes(id));
 await h.click('[data-action="mark-known"]');assert(h.run('state.known').includes(id));
 assert(JSON.parse(h.saved.get('sv-guest-v2')).known.includes(id));
 h.run('state=readLocalState()');assert(h.run('state.favorites').includes(id));
 for(const mode of ['mixed','translation','fillBlank','weekdays','alphabet','months','dialogues','readText','verbForms','articles','listening','sentences','writeWord','fixMistake']){
  h.run("resetQuiz();navigate('practice')");await h.click(`[data-mode="${mode}"]`);assert.equal(h.run('quiz.mode'),mode);assert(h.run('quiz.active&&quiz.questions.length>0'));
 }
 h.run("resetQuiz();navigate('numbers');window.speechCalls=[];speak=text=>speechCalls.push(text)");await h.click('.number-item');assert.equal(h.ctx.speechCalls.length,1);
 h.run("navigate('cheats')");await h.click('.reference-nav button');assert.equal(h.document.querySelector('.reference-nav button').getAttribute('aria-current'),'location');
});
// Exercise the exact carousel listener code, with no geometry/layout claims.
test('drag cancellation never consumes a fresh mouse, touch, pen or keyboard action',()=>{
 const source=read('atelier.js'),events={},track={dataset:{},children:[],matches:()=>false,previousElementSibling:null,classList:{contains:()=>false},addEventListener:(name,fn)=>events[name]=fn};
 const ctx={track,setTimeout:()=>1,clearTimeout(){},requestAnimationFrame:fn=>fn()};vm.createContext(ctx);
 vm.runInContext(source.slice(source.indexOf('function decorateSlider('),source.indexOf('// Pack reference cards')),ctx);
 vm.runInContext('decorateSlider(track)',ctx);
 for(const pointerType of ['mouse','touch','pen']){
  events.pointerdown({pointerType:'mouse',button:0,clientX:0});events.pointermove({pointerType:'mouse',clientX:30});events.pointerleave();
  events.pointerdown({pointerType,button:0,clientX:30});let blocked=false;events.click({detail:1,preventDefault(){blocked=true},stopImmediatePropagation(){}});assert.equal(blocked,false,pointerType);
 }
 events.pointerdown({pointerType:'mouse',button:0,clientX:0});events.pointermove({pointerType:'mouse',clientX:30});events.pointerup();
 let blocked=false;events.click({detail:0,preventDefault(){blocked=true},stopImmediatePropagation(){}});assert.equal(blocked,false,'keyboard activation');
 events.click({detail:1,preventDefault(){blocked=true},stopImmediatePropagation(){}});assert.equal(blocked,true,'actual completed drag suppresses its click');
});
domTest('guest ignores stale cloud failures and local save retry writes locally without RPC',async()=>{
 const h=ui();let rpc=0;
 h.ctx.SVProgress={activity:()=>({pending:[],error:'PGRST202'}),writeStatus:()=>({ready:false,error:'PGRST202'}),retry:()=>{rpc++}};
 h.run('renderProgressUX(true)');assert.equal(h.document.querySelector('.save-status'),null);
 const original=h.ctx.localStorage.setItem;h.ctx.localStorage.setItem=()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'})};
 h.run('state.xp=88');assert.throws(()=>h.run('save()'));
 assert(h.document.querySelector('.local-save-status'));assert.equal(h.run('state.xp'),88);
 h.ctx.localStorage.setItem=original;await h.click('[data-action="save-retry"]');assert.equal(rpc,0);assert.equal(JSON.parse(h.saved.get('sv-guest-v2')).xp,88);assert.equal(h.document.querySelector('.local-save-status'),null);
});
domTest('unreadable guest bytes survive mutations; read retry restores the repaired stored progress',async()=>{
 const h=ui();h.saved.set('sv-guest-v2','{broken');h.run('state=readLocalState();renderProgressUX(true)');
 assert(h.document.querySelector('.local-save-status'));assert.throws(()=>h.run('save()'));assert.equal(h.saved.get('sv-guest-v2'),'{broken');
 h.saved.set('sv-guest-v2',JSON.stringify({...h.run('defaultState()'),xp:96,completed:['lesson-1']}));
 await h.click('[data-action="local-read-retry"]');assert.equal(h.run('state.xp'),96);assert.equal(h.run('state.completed[0]'),'lesson-1');assert.equal(h.document.querySelector('.local-save-status'),null);
});
domTest('each book cover delegates to its own reading button; video destinations retain their URLs',async()=>{
 const h=ui(),source=read('atelier.js');
 vm.runInContext(source.slice(source.indexOf('function enhanceBooks('),source.indexOf('function enhanceNumbers(')),h.ctx);
 const ids=h.run('BOOKS.map(b=>b.id)');
 for(const id of ids){h.run("navigate('books');enhanceBooks()");const button=h.document.querySelector(`[data-nav="book"][data-param="${id}"]`);button.closest('.book-card').querySelector('.book-cover').dispatchEvent(new h.ctx.Event('click',{bubbles:true}));await new Promise(r=>setImmediate(r));assert.equal(h.run('route'),'book');assert.equal(h.run('routeParam'),id)}
 h.run("navigate('videos')");
 for(const link of h.document.querySelectorAll('a.video-watch-link')){assert(link.getAttribute('href').startsWith('https://'));assert.equal(link.getAttribute('target'),'_blank');assert(link.getAttribute('rel').includes('noopener'))}
 assert(h.document.querySelectorAll('a.video-watch-link').length>0);
});
