const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'learning-polish.js'),'utf8');
function setup(id){
 const styles=new Map([['--flash-photo','old unrelated image']]);
 const classes=new Set(['has-word-photo']);
 const card={isConnected:true,closest:()=>null,style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},classList:{add:k=>classes.add(k),remove:k=>classes.delete(k)}};
 const pending=[];
 const ctx={window:{},localStorage:{getItem:()=>null},document:{documentElement:{lang:'ru'},addEventListener(){},querySelector:()=>card,querySelectorAll:()=>[]},flash:{ids:[id],index:0},getWord:id=>({id}),Image:function(){pending.push(this)}};
 vm.createContext(ctx);
 vm.runInContext(fs.readFileSync(path.join(root,'flashcard-media.js'),'utf8'),ctx);
 vm.runInContext(source,ctx);
 return {ctx,styles,classes,card,pending};
}
const known=setup('v-arbeta');
assert(!known.styles.has('--flash-photo'),'old photograph must be cleared before loading');
assert(!known.classes.has('has-word-photo'));
assert.equal(known.pending.length,1);
assert(fs.existsSync(path.resolve(root,known.pending[0].src)));
known.pending[0].onload();
assert(known.classes.has('has-word-photo'));
assert(known.styles.get('--flash-photo').includes('work.webp'));
for(const id of ['__unmapped-cat','__unmapped-dog','unknown']){
 const unknown=setup(id);
 assert.equal(unknown.pending.length,0,'unmapped word must not load a category photograph');
 assert(!unknown.styles.has('--flash-photo'));
 assert(!unknown.classes.has('has-word-photo'));
}
const stale=setup('v-arbeta');stale.card.isConnected=false;
stale.pending[0].onload();assert(!stale.styles.has('--flash-photo'),'late image must not decorate a removed card');
const registry={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'flashcard-media.js'),'utf8'),registry);
const words=JSON.parse(fs.readFileSync(path.join(root,'words.json'),'utf8'));
const statusPath=path.join(root,'assets/flashcards/generation-status.json');
const receipts=fs.existsSync(statusPath)?JSON.parse(fs.readFileSync(statusPath,'utf8')):{};
// Preserve these existing mappings despite historical 'generated' status.
const preservedGenerated=new Set(['w-en','w-tre','w-fyra','w-fem','w-sex','w-sju','w-åtta','w-nio','w-tio']);
let covered=0;
for(const word of words){
 const url=registry.window.svFlashPhotoForWord(word);
 if(url){
  assert(url.startsWith('./assets/flashcards/'),'flashcards must use bundled images');
  assert(fs.statSync(path.resolve(root,decodeURIComponent(url))).size>1000,'missing or empty image: '+word.id);
  covered++;
 }
 // Keep the existing nine photos; newly generated unreviewed assets stay excluded.
 if(receipts[word.id]?.status==='generated'){
  if(preservedGenerated.has(word.id))assert.equal(decodeURIComponent(url).normalize('NFC'),`./assets/flashcards/${word.id}.webp`);
  else assert.equal(url,null,'new unreviewed image must not be published');
 }
 if(receipts[word.id]?.status==='reviewed')assert.equal(decodeURIComponent(url).normalize('NFC'),decodeURIComponent(receipts[word.id].path).normalize('NFC'));
}
assert.equal(covered,991,'preserve the existing photo coverage');
console.log('PASS: exact images, neutral fallback, loading state and late responses');
