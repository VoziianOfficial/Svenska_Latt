/* Check URL decoding and exact Git spelling, including on forgiving macOS disks. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const registry={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root,'flashcard-media.js'),'utf8'),registry);
const tracked=new Set(execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0'));
const words=JSON.parse(fs.readFileSync(path.join(root,'words.json')));
const missing=JSON.parse(fs.readFileSync(path.join(root,'reports/missing-photos.json')));
let photos=0,unicode=0;
for(const word of words){
 const url=registry.window.svFlashPhotoForWord(word);
 if(!url){assert(missing.some(row=>row.id===word.id),`Undocumented missing photo: ${word.id}`);continue;}
 const relative=decodeURIComponent(url).replace(/^\.\//,'');
 assert.equal(relative,relative.normalize('NFC'),`Non-NFC URL: ${word.id}`);
 assert(tracked.has(relative),`Exact filename absent in Git: ${relative}`);
 assert.equal(url,'./'+relative.split('/').map(encodeURIComponent).join('/'),`Noncanonical URL: ${url}`);
 assert(fs.statSync(path.join(root,relative)).size>1000,relative);
 if(/[^\x00-\x7f]/.test(relative))unicode++;
 photos++;
}
assert.equal(photos+missing.length,words.length);
assert.equal(missing.length,15);
console.log(`PASS: ${photos} photo links, ${unicode} Swedish filenames, ${missing.length} documented gaps`);
