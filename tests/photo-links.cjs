/* Check URL decoding and exact filesystem spelling, including on forgiving macOS disks. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const registry={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'flashcard-media.js'),'utf8'),registry);
// Include new unstaged files; check exact on-disk spelling for Linux hosting.
const tracked=new Set(fs.readdirSync(path.join(root,'assets/flashcards')).map(name=>'assets/flashcards/'+name));
const words=JSON.parse(fs.readFileSync(path.join(root,'words.json')));
const missing=JSON.parse(fs.readFileSync(path.join(root,'reports/missing-photos.json')));
let photos=0,unicode=0;
for(const word of words){
 const url=registry.window.svFlashPhotoForWord(word);
 if(!url){assert(missing.some(row=>row.id===word.id),`Undocumented missing photo: ${word.id}`);continue;}
 const relative=decodeURIComponent(url).replace(/^\.\//,'');
 assert.equal(relative,relative.normalize('NFC'),`Non-NFC URL: ${word.id}`);
 assert(tracked.has(relative),`Exact filename absent on disk: ${relative}`);
 assert.equal(url,'./'+relative.split('/').map(encodeURIComponent).join('/'),`Noncanonical URL: ${url}`);
 assert(fs.statSync(path.join(root,relative)).size>1000,relative);
 if(/[^\x00-\x7f]/.test(relative))unicode++;
 photos++;
}
assert.equal(photos+missing.length,words.length);
assert.equal(missing.length,0);
assert.equal(photos,1006);
console.log(`PASS: ${photos} photo links, ${unicode} Swedish filenames, ${missing.length} documented gaps`);

// Decorative topic/lesson photos must also resolve to bundled files when local.
const atelier=fs.readFileSync(path.join(root,'atelier.js'),'utf8');
const decorations=[...atelier.matchAll(/['"](\.\/assets\/flashcards\/[^'"\n]+)['"]/g)].map(match=>match[1]);
for(const url of decorations){
 const relative=decodeURIComponent(url).replace(/^\.\//,'');
 assert(tracked.has(relative),`Missing decorative photograph: ${url}`);
 assert(fs.statSync(path.join(root,relative)).size>1000,relative);
}
console.log(`PASS: ${decorations.length} local decorative photo references`);
