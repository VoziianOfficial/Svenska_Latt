const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const events={},targets=new Map();let selected=[],buttons=[],reduced=false;
const page={querySelectorAll:selector=>selector==='.reference-nav button'?buttons:selected.filter(c=>c.classList.contains('reference-arrival'))};
const document={addEventListener(type,fn){(events[type]??=[]).push(fn)},getElementById:id=>targets.get(id),querySelector:()=>targets.get('top')};
const ctx={window:{addEventListener(){},matchMedia:()=>({matches:reduced})},document,localStorage:{getItem(){return null},setItem(){throw Error('Reference must not write progress')}},location:{},console,setTimeout,clearTimeout,URL};
vm.createContext(ctx);vm.runInContext(read('locale-content.js'),ctx);vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),ctx);
const run=s=>vm.runInContext(s,ctx),lessons=JSON.parse(read('lessons.json'));
run(`LESSONS=${JSON.stringify(lessons)};state=defaultState();`);
for(const lang of ['ru','en','sv','uk']){
 run(`state.settings.language='${lang}'`);
 const before=run('JSON.stringify(state)'),html=run('renderCheats()');
 assert.equal((html.match(/class="reference-icon"/g)||[]).length,9);
 assert(!html.includes('reference-number'));
 const links=[...html.matchAll(/data-cheat-target="(cheat-[^"]+)"/g)].map(m=>m[1]);
 assert.equal(links.length,9);assert.equal(new Set(links).size,9);
 for(const id of links)assert(html.includes(`id="${id}"`),'Broken destination '+id);
 assert(html.includes('dricker'));assert(html.includes('Pluskvamperfekt'));assert(html.includes('vår/vårt/våra'));
 assert(html.includes('Jag kan simma.'));assert(html.includes('Jag vill läsa.'));assert(html.includes('Jag måste arbeta.'));
 assert(html.includes('kan + infinitiv'));assert(html.includes('data-cheat-target="cheat-topic-7"'));
 assert.equal(before,run('JSON.stringify(state)'));
}
function classes(){const set=new Set();return {add:name=>set.add(name),remove:name=>set.delete(name),contains:name=>set.has(name)}}
function card(){return {classList:classes(),offsetWidth:420,scrollIntoView(options){this.scrolled=options}}}
function target(id,holder){const el={attrs:{},closest:()=>holder,setAttribute(k,v){this.attrs[k]=v},focus(options){this.focused=options},scrollIntoView(options){this.scrolled=options}};targets.set(id,el);return el}
function button(id,nav=true){return {attrs:{},dataset:{cheatTarget:id},closest:selector=>selector==='[data-cheat-target]'?null:selector==='.reference-page'?page:nav?{}:null,removeAttribute(k){delete this.attrs[k]},setAttribute(k,v){this.attrs[k]=v}}}
const a=card(),b=card(),ta=target('cheat-topic-0',a),tb=target('cheat-topic-1',b),top=target('top',null),ba=button('cheat-topic-0'),bb=button('cheat-topic-1'),back=button('reference-top',false);
selected=[a,b];buttons=[ba,bb];
const click=events.click.find(fn=>String(fn).includes('data-cheat-target'));assert(click);
const fire=button=>click({target:{closest:()=>button}});
fire(ba);assert(a.classList.contains('reference-arrival'));assert.equal(ba.attrs['aria-current'],'location');assert.equal(a.scrolled.behavior,'smooth');assert.equal(ta.attrs.tabindex,'-1');assert(ta.focused.preventScroll);
reduced=true;fire(bb);assert(!a.classList.contains('reference-arrival'));assert(b.classList.contains('reference-arrival'));assert.equal(ba.attrs['aria-current'],undefined);assert.equal(b.scrolled.behavior,'instant');
fire(bb);assert(b.classList.contains('reference-arrival'),'Repeated navigation must highlight again');
fire(back);assert(!b.classList.contains('reference-arrival'));assert.equal(bb.attrs['aria-current'],undefined);assert.equal(top.scrolled.block,'start');

// Run the real resize/layout controller with varying natural card heights.
let columns=2,currentGrid,frameId=0;const frames=new Map(),observers=[];
const style=()=>({removeProperty(name){delete this[{'grid-row':'gridRow','grid-column':'gridColumn'}[name]||name]}});
const makeGrid=heights=>({dataset:{},isConnected:true,children:heights.map(height=>({style:style(),offsetHeight:height}))});
const visuals={window:{addEventListener(){}},document:{querySelector:selector=>selector==='.reference-sections'?currentGrid:null},
 getComputedStyle:()=>({gridTemplateColumns:columns===2?'420px 420px':'360px'}),
 requestAnimationFrame(fn){frames.set(++frameId,fn);return frameId},cancelAnimationFrame(id){frames.delete(id)},
 ResizeObserver:class{constructor(fn){this.fn=fn;this.nodes=[];observers.push(this)}observe(el){this.nodes.push(el)}disconnect(){this.disconnected=true}},console};
const flush=()=>{const pending=[...frames.values()];frames.clear();pending.forEach(fn=>fn())};
vm.runInNewContext(read('atelier.js').replace(/\}\)\(\);\s*$/, 'window.testReferenceLayout=enhanceReference;})();'),visuals);
const start=visuals.window.testReferenceLayout;currentGrid=makeGrid([330,280,200,180,270,170,210]);start();
function packed(grid){
 assert.equal(grid.dataset.masonry,'true');
 const bottoms=[0,0];
 for(const c of grid.children){
  const col=Number(c.style.gridColumn)-1,[row,span]=c.style.gridRow.split(' / span ').map(Number);
  assert.equal(row-1,bottoms[col],'Unexpected gap or overlap');assert.equal(span,c.offsetHeight,'Card height must follow content');
  assert.equal(bottoms[col],Math.min(...bottoms),'Card must fill the shorter column');bottoms[col]+=span+14;
 }
}
packed(currentGrid);assert.equal(observers[0].nodes.length,7);
currentGrid.children[1].offsetHeight=410;observers[0].fn();observers[0].fn();assert.equal(frames.size,1,'Resize updates should be batched');flush();packed(currentGrid);
columns=1;observers[0].fn();flush();assert.equal(currentGrid.dataset.masonry,undefined);assert(currentGrid.children.every(c=>!c.style.gridRow&&!c.style.gridColumn),'Mobile must return to source order');
columns=2;observers[0].fn();flush();packed(currentGrid);
const old=currentGrid;currentGrid=makeGrid([100,150]);start();assert(observers[0].disconnected,'Route/language changes must release old observers');packed(currentGrid);
currentGrid=null;start();assert(observers[1].disconnected,'Leaving the page must release observers');
console.log('PASS: 4 locales, 9 icon headings and destinations, repeatable highlight/focus, reduced motion, back to top, dense packing, resize batching, mobile reset and observer cleanup');
