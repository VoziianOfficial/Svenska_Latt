const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
function setup(saved={}){
 const storage=new Map(Object.entries(saved)),nodes=new Map(),events={};
 const listen=(name,fn)=>(events[name]??=[]).push(fn);
 const document={
  documentElement:{},addEventListener:listen,
  getElementById:id=>nodes.get(id)||null,
  querySelector:selector=>nodes.get(selector.slice(1))||null,
  querySelectorAll:()=>[],
  createElement:()=>({setAttribute(name,value){this[name]=value},remove(){nodes.delete(this.id)}}),
  body:{appendChild(node){nodes.set(node.id,node)}}
 };
 nodes.set('global-search',{});nodes.set('lang-select',{});
 const ctx={document,window:{addEventListener:listen},localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},location:{hash:'',hostname:'github.io',pathname:'/'},navigator:{},Date,Math,console,setTimeout,clearTimeout,URL,Response};
 vm.createContext(ctx);
 for(const file of ['locale-content.js','app.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8').replace(/\nboot\(\);/g,''),ctx);
 const run=code=>vm.runInContext(code,ctx);
 run('state=readLocalState();renderNav=()=>{};headerStats=()=>{};render=renderShell;');
 return {run,storage,nodes,emit:(name,event)=>events[name]?.forEach(fn=>fn(event))};
}
const translations={ru:['Мы используем','Принять','Отклонить'],en:['We use essential','Accept','Decline'],sv:['Vi använder','Acceptera','Avvisa'],uk:['Ми використовуємо','Прийняти','Відхилити']};
for(const initial of Object.keys(translations)){
 const app=setup({'sv-language':initial});
 app.emit('load');
 assert.equal(app.nodes.get('sv-consent').lang,initial);
 app.run('renderShell()');
 for(const [lang,text] of Object.entries(translations)){
  app.run(`changeLanguage('${lang}')`);
  const banner=app.nodes.get('sv-consent');
  assert.equal(banner.lang,lang);
  for(const part of text)assert.ok(banner.innerHTML.includes(part),`${initial} → ${lang}: ${part}`);
 }
}
// The active profile's language can differ from the last global preference.
const profile=setup({'sv-language':'ru','sv-guest-v2':JSON.stringify({settings:{language:'sv',level:'A'}})});
profile.run('renderShell()');
assert.equal(profile.nodes.get('sv-consent').lang,'sv');
for(const choice of ['accepted','rejected']){
 const app=setup();app.emit('load');
 app.emit('click',{target:{closest:selector=>selector==='[data-consent]'?{dataset:{consent:choice}}:null}});
 assert.equal(app.storage.get('sv-cookie-choice'),choice);
 app.run("changeLanguage('en')");app.emit('load');
 assert.equal(app.nodes.has('sv-consent'),false);
 const reload=setup(Object.fromEntries(app.storage));reload.emit('load');reload.run('renderShell()');
 assert.equal(reload.nodes.has('sv-consent'),false);
}
console.log('Cookie consent: initial locale, live switching in four languages, profile locale and persisted accept/decline passed.');
