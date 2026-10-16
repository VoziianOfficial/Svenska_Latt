const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../sw.js'),'utf8');
const origin='https://example.test';
const scope=origin+'/svenska/';
const stores=new Map();
const key=value=>new URL(typeof value==='string'?value:value.url,scope).href;
const caches={
 async open(name){
  if(!stores.has(name))stores.set(name,new Map());
  const rows=stores.get(name);
  return {
   async match(request){return rows.get(key(request))?.clone()},
   async put(request,response){rows.set(key(request),response.clone())},
   async keys(){return [...rows.keys()]},
   async delete(request){return rows.delete(key(request))},
   async addAll(files){for(const file of files){assert.equal(file.cache,'reload','release install must bypass stale HTTP cache');rows.set(key(file),new Response('precache'))}}
  };
 },
 async keys(){return [...stores.keys()]},
 async delete(name){return stores.delete(name)}
};
let online=true,requests=0;
function worker(code){
 const handlers={};
 const ctx={URL,Request,Response,caches,fetch:async(request,options)=>{assert.equal(options.cache,'no-cache','revalidate HTTP content after publication');requests++;if(!online)throw Error('offline');return new Response('network')},
  self:{location:{origin},registration:{scope},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>handlers[name]=fn}};
 vm.runInNewContext(code,ctx);
 return handlers;
}
async function lifecycle(fn){const pending=[];fn({waitUntil:p=>pending.push(p)});await Promise.all(pending)}
async function load(handlers,path,destination='image',method='GET'){
 const pending=[];let response;
 handlers.fetch({request:{url:new URL(path,scope).href,method,destination},waitUntil:p=>pending.push(p),respondWith:p=>response=p});
 const result=await response;await Promise.all(pending);return result;
}
(async()=>{
 const handlers=worker(source);
 await caches.open('svenska-latt-v45-shell');await caches.open('svenska-latt-v23-photos');await caches.open('unrelated-cache');
 await lifecycle(handlers.install);
 const shellName=(await caches.keys()).find(n=>n.includes('prep-1-shell'));
 assert(shellName);
 assert(![...stores.get(shellName).keys()].some(p=>p.includes('/flashcards/')),'do not precache photographs');
 await lifecycle(handlers.activate);
 assert(!stores.has('svenska-latt-v45-shell'));assert(!stores.has('svenska-latt-v23-photos'));assert(stores.has('unrelated-cache'));
 await Promise.all(Array.from({length:205},(_,i)=>load(handlers,`assets/flashcards/photo-${i}.webp`)));
 const photoName=(await caches.keys()).find(n=>n.endsWith('-photos'));
 assert.equal(stores.get(photoName).size,150,'concurrent loads must obey the cap');
 assert(![...stores.get(shellName).keys()].some(p=>p.includes('/flashcards/')));
 const before=requests;await load(handlers,'assets/flashcards/photo-204.webp');assert.equal(requests,before,'cached photograph should work without fetching');
 online=false;
 assert.equal((await load(handlers,'assets/flashcards/photo-204.webp')).status,200);
 assert.equal((await load(handlers,'assets/flashcards/unseen.webp')).status,504);
 assert.equal((await load(handlers,'style.css?v=999','style')).status,200,'versioned URL must find precache');
 assert.equal(await load(handlers,'api/session',''),undefined,'API must bypass caches');
 assert.equal(await load(handlers,'unlisted.webp'),undefined,'arbitrary images must not grow shell cache');
 online=true;await load(handlers,'assets/word-icons/cat.webp?v=1');online=false;
 assert.equal((await load(handlers,'assets/word-icons/cat.webp?v=2')).status,200,'viewed word icons stay available offline');
 assert.equal(await load(handlers,'style.css','style','POST'),undefined);
 online=true;
 const updated=worker(source.replace('2026-10-16-prep-1','test-next-release'));
 await lifecycle(updated.install);await lifecycle(updated.activate);
 assert(!stores.has(photoName));assert(!stores.has(shellName));assert(stores.has('unrelated-cache'));
 await load(updated,'assets/flashcards/photo-204.webp');
 assert.equal(stores.get('svenska-latt-test-next-release-photos').size,1);
 console.log('PASS: bounded local photos, concurrent eviction, no bulk precache, offline versioned shell, cache upgrade and API isolation');
})().catch(error=>{console.error(error);process.exitCode=1});
