const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=name=>fs.readFileSync(require('node:path').resolve(__dirname,'..',name),'utf8');
const ctx={window:{addEventListener(){}},document:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){throw Error('No progress writes')}},location:{},console,setTimeout,clearTimeout,URL};
vm.createContext(ctx);vm.runInContext(read('locale-content.js'),ctx);vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`WORDS=${read('words.json')};LESSONS=${read('lessons.json')};BOOKS=${read('books.json')};state=defaultState();state.xp=742;state.known=['one','two'];state.completed=['lesson-1'];`);
for(const language of ['ru','uk','en','sv']){
 run(`state.settings.language='${language}'`);const before=run('JSON.stringify(state)'),html=run('renderHome()');
 assert.equal((html.match(/class="home-hero-slide(?: is-active)?"/g)||[]).length,5);
 assert.equal((html.match(/class="stat-card home-stat-inline"/g)||[]).length,4);
 assert(html.includes('data-action="show-learned"'));assert(html.includes('data-param="lesson-2"'));
 assert(!html.includes(run("t('heroDescription')")));assert(html.includes('742 XP'));assert(html.includes('242/500 XP'));
 assert(!html.includes('hero-picture'));assert(!html.includes('hero-orbit'));assert(!html.includes('hero-illustration'));
 const hero=html.slice(0,html.indexOf('</section>'));assert.equal((hero.match(/<button /g)||[]).length,2);
 for(const path of [...html.matchAll(/(?:src|href)="\.\/([^"#]+)(?:#[^"]*)?"/g)].map(m=>m[1]))assert(fs.existsSync(require('node:path').resolve(__dirname,'..',path)),path);
 assert.equal(before,run('JSON.stringify(state)'));
}
run("user={id:'pending'};window.SVProgress={status:()=>({receivedAt:null})}");assert.equal((run('renderHome()').match(/class="stat-value">—/g)||[]).length,4);
function target(extra={}){const events={};return {...extra,events,addEventListener(type,fn){(events[type]??=new Set()).add(fn)},removeEventListener(type,fn){events[type]?.delete(fn)},emit(type,event={}){for(const fn of [...events[type]||[]])fn(event)}}}
let id=0;const timers=new Map(),setTimer=(fn,ms)=>{timers.set(++id,{fn,ms});return id},clearTimer=i=>timers.delete(i);
const doc=target({hidden:false}),motion=target({matches:false});
function hero(){const slides=Array.from({length:5},(_,i)=>{const classes=new Set(i===0?['is-active']:[]);return target({complete:true,naturalWidth:1600,style:{},classList:{add:c=>classes.add(c),remove:c=>classes.delete(c),contains:c=>classes.has(c)}})});return target({slides,isConnected:true,querySelectorAll:()=>slides,contains:el=>el==='inside'})}
const c={window:{matchMedia:()=>motion},document:doc,setTimeout:setTimer,clearTimeout:clearTimer};vm.createContext(c);
const source=read('atelier.js');vm.runInContext(source.slice(source.indexOf('let homeSlideshow=null;'),source.indexOf('function enhanceHome(){')),c);
const setup=h=>{c.hero=h;vm.runInContext('enhanceHomeSlideshow(hero)',c)},tick=ms=>{const entry=[...timers].find(([,v])=>v.ms===ms);assert(entry,`Missing ${ms}ms timer`);timers.delete(entry[0]);entry[1].fn()};
let h=hero();setup(h);assert.equal(timers.size,1);setup(h);assert.equal(timers.size,1,'No duplicate timers');
for(let i=1;i<=5;i++){tick(7500);assert(h.slides[i%5].classList.contains('is-active'));tick(1850);assert.equal(h.slides.filter(s=>s.classList.contains('is-active')).length,1)}
h.emit('pointerenter',{pointerType:'mouse'});assert.equal(timers.size,0);h.emit('pointerleave');assert.equal(timers.size,1);
h.emit('focusin');assert.equal(timers.size,0);h.emit('focusout',{relatedTarget:'inside'});assert.equal(timers.size,0);h.emit('focusout',{relatedTarget:null});assert.equal(timers.size,1);
doc.hidden=true;doc.emit('visibilitychange');assert.equal(timers.size,0);doc.hidden=false;doc.emit('visibilitychange');assert.equal(timers.size,1);
motion.matches=true;motion.emit('change');assert.equal(timers.size,0);motion.matches=false;motion.emit('change');assert.equal(timers.size,1);
h.slides[1].naturalWidth=0;tick(7500);assert(h.slides[2].classList.contains('is-active'),'Skip failed image');tick(1850);
const old=h;h=hero();setup(h);assert.equal(timers.size,1);assert(Object.values(old.events).every(e=>e.size===0),'Release old hero listeners');
motion.matches=true;const failed=hero();failed.slides[0].naturalWidth=0;setup(failed);assert(failed.slides[1].classList.contains('is-active'),'Reduced motion still reveals a loaded fallback');assert.equal(timers.size,0);
setup(null);assert.equal(timers.size,0);assert(Object.values(doc.events).every(e=>e.size===0));assert(Object.values(motion.events).every(e=>e.size===0));
console.log('PASS: four locales, original metric/CTA bindings, asset paths, pending placeholders, no state writes; five-slide loop, pauses, reduced motion, image failure, rerender and cleanup.');
