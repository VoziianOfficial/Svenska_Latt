const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const lessons = JSON.parse(fs.readFileSync(path.join(root, 'lessons.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'assets/lesson-covers/manifest.json'), 'utf8'));
const code = fs.readFileSync(path.join(root, 'atelier.js'), 'utf8');
const declaration = code.match(/const LESSON_COVERS = Object\.freeze\((\{[\s\S]*?\})\);/)[0];
const mapping = vm.runInNewContext(declaration + '\nLESSON_COVERS');
assert.deepEqual(Object.keys(mapping).sort(), lessons.map(l => l.id).sort());
assert.equal(new Set(Object.values(mapping)).size, lessons.length, 'each topic has its own photograph');
assert.equal(manifest.count, lessons.length);
assert.equal(manifest.images.length, lessons.length);
let total = 0;
for (const lesson of lessons) {
  const entry = manifest.images.find(item => item.id === lesson.id);
  assert(entry, lesson.id);
  assert.equal(entry.title, lesson.title);
  assert.equal(entry.level, lesson.level);
  assert.equal(mapping[lesson.id], './assets/lesson-covers/' + entry.file);
  assert.equal(entry.width, 768); assert.equal(entry.height, 512);
  const data = fs.readFileSync(path.join(root, mapping[lesson.id]));
  assert.equal(data.subarray(0, 4).toString(), 'RIFF');
  assert.equal(data.subarray(8, 12).toString(), 'WEBP');
  assert.equal(data.length, entry.bytes);
  assert.equal(crypto.createHash('sha256').update(data).digest('hex'), entry.sha256);
  assert(data.length <= 90 * 1024, 'individual image size budget');
  total += data.length;
}
assert.equal(total, manifest.bytes);
assert(total <= 3 * 1024 * 1024, 'complete cover set size budget');

// A reordered list and an unrelated route must not change the topic/image match.
function card(id) {
  const cover = { photo: null, querySelector() { return this.photo; }, prepend(photo) { this.photo = photo; } };
  const open = { dataset: { param: id }, querySelector() { return {}; } };
  return { cover, querySelector(selector) { return selector.includes('data-nav') ? open : cover; } };
}
const cards = [card('lesson-50'), card('lesson-1'), card('lesson-35')];
const start = code.indexOf('function enhanceLessons()');
const end = code.indexOf('function enhanceModes()', start);
const context = { document: { querySelectorAll: () => cards },
  image: (src, className) => ({ src, className }), routeParam: 'B', selectedLevel: 'D' };
vm.runInNewContext(declaration + '\n' + code.slice(start, end) + '\nenhanceLessons(); enhanceLessons();', context);
for (const [index, id] of ['lesson-50', 'lesson-1', 'lesson-35'].entries()) {
  assert.equal(cards[index].cover.photo.src, mapping[id]);
  assert.equal(cards[index].cover.photo.width, 768);
  assert.equal(cards[index].cover.photo.height, 512);
}
console.log(`PASS: ${lessons.length} distinct topic covers, stable IDs under reorder, WebP hashes/dimensions, ${(total / 1024 / 1024).toFixed(2)} MiB total`);
