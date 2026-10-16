const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const words = JSON.parse(read('words.json'));
const manifest = JSON.parse(read('assets/word-icons/manifest.json'));
const context = {
 window: {addEventListener() {}}, document: {addEventListener() {}},
 localStorage: {getItem() {return null;}, setItem() {}},
 location: {hash: '', hostname: 'github.io', pathname: '/'}, navigator: {},
 Image: function() {}, Date, Math, console, setTimeout, clearTimeout, URL, Response
};
vm.createContext(context);
vm.runInContext(read('locale-content.js'), context);
vm.runInContext(read('word-icons.js'), context);
vm.runInContext(read('app.js').replace(/\nboot\(\);/g, ''), context);
vm.runInContext(`state=defaultState(); WORDS=${JSON.stringify(words)};`, context);
assert.equal(Object.keys(manifest).length, words.length);
for (const word of words) {
 const file = manifest[word.id];
 assert.ok(file?.startsWith('./assets/word-icons/'), word.id);
 const bytes = fs.readFileSync(path.join(root, file));
 assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', file);
 assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', file);
 const html = vm.runInContext(`wordEntry(${JSON.stringify(word)})`, context);
 assert.ok(html.includes(`src="${file}"`), `Missing local icon: ${word.id}`);
 assert.ok(html.includes('data-word-link='), `Missing card interaction: ${word.id}`);
 assert.ok(!html.includes('photo-word') && !html.includes('https://'), `Unexpected photograph: ${word.id}`);
}
assert.match(manifest['v-betala'], /credit-card/);
assert.match(manifest['v-handla'], /shopping-cart/);
assert.match(manifest['n-katt'], /cat/);
assert.match(manifest['n-hund'], /dog/);
vm.runInContext('window.svWordIcons=undefined;', context);
const fallback = vm.runInContext(`wordIcon(${JSON.stringify(words[0])})`, context);
assert.ok(fallback.includes(words[0].emoji) && !fallback.includes('<img'));
assert.ok(read('index.html').indexOf('./word-icons.js') < read('index.html').indexOf('./app.js'));
assert.ok(!read('atelier.js').includes('function enhanceWords'));
console.log(`PASS: ${words.length} word icons, local WebP assets, exact semantic mappings, card rendering and fallback`);
