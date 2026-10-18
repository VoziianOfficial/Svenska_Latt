const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8').replace(/\nboot\(\);/g,'');
function page(fetch){
 let timeout,html='',reloads=0,retry;
 const controller=new AbortController();
 const context={window:{addEventListener(){}},document:{addEventListener(){},querySelector(selector){return selector==='#page'?{set innerHTML(value){html=value}}:{addEventListener(_,fn){retry=fn}}}},
  location:{reload(){reloads++}},navigator:{},fetch,AbortController:class {constructor(){return controller}},
  setTimeout(fn){timeout=fn;return 1},clearTimeout(){},console:{error(){}},
  localStorage:{getItem(){return null},setItem(){throw Error('No storage writes on failure')}}};
 vm.createContext(context);vm.runInContext(source,context);
 return {run:code=>vm.runInContext(code,context),expire:()=>timeout(),controller,get html(){return html},retry:()=>retry(),get reloads(){return reloads}};
}
test('hung fetch and hung JSON body settle, abort and offer a safe reload',async()=>{
 for(const fetch of [()=>new Promise(()=>{}),async()=>({ok:true,json:()=>new Promise(()=>{})})]){
  const h=page(fetch),pending=h.run('boot()');await Promise.resolve();h.expire();await pending;
  assert(h.controller.signal.aborted);assert.match(h.html,/boot-retry/);assert.doesNotMatch(h.html,/TIMEOUT|<pre>|Supabase/);
  h.retry();assert.equal(h.reloads,1);
 }
});
test('missing, malformed and empty learning content show a safe error without clearing progress',async()=>{
 for(const response of [{ok:false},{ok:true,json:async()=>{throw Error('private diagnostic')}},{ok:true,json:async()=>[]}]){
  const h=page(async()=>response);await h.run('boot()');
  assert.match(h.html,/boot-retry/);assert.doesNotMatch(h.html,/private diagnostic|INVALID_|<pre>/);
 }
});
