const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
class Target {
  constructor() { this.events = {}; this.hidden = false; this.disabled = false; this.textContent = ''; }
  addEventListener(name, fn) { (this.events[name] ??= []).push(fn); }
  async emit(name, event = {}) { await Promise.all((this.events[name] || []).map(fn => fn(event))); }
  querySelector() { return this.label ??= new Target(); }
  setAttribute(name, value) { this[name] = value; }
  focus() { this.focused = true; }
  getClientRects() { return [{}]; }
}
function setup(nav = {}, standalone = false) {
  const buttons = [new Target(), new Target()];
  const elements = Object.fromEntries(['pwa-install-dialog', 'pwa-install-step-one', 'pwa-install-step-two'].map(id => [id, new Target()]));
  const dialog = elements['pwa-install-dialog'];
  dialog.querySelectorAll = () => [];
  dialog.showModal = () => { dialog.open = true; };
  dialog.close = () => { dialog.open = false; void dialog.emit('close'); };
  const media = Object.assign(new Target(), { matches: standalone });
  const window = Object.assign(new Target(), { matchMedia: () => media });
  let languageChanged;
  const ctx = vm.createContext({ window, navigator: { userAgent: 'Chrome', ...nav }, document: {
    documentElement: {}, querySelectorAll: () => buttons, getElementById: id => elements[id]
  }, MutationObserver: class { constructor(fn) { languageChanged = fn; } observe() {} } });
  const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  vm.runInContext(app.slice(0, app.indexOf('const DAY=')) + "\nstate={settings:{language:'ru'}};", ctx);
  vm.runInContext(fs.readFileSync(path.join(root, 'pwa-install.js'), 'utf8'), ctx);
  return { buttons, dialog, window, media, elements, languageChanged, ctx };
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
for (const field of ['id', 'start_url', 'scope']) assert.equal(manifest[field], './', `preserve ${field}`);
for (const size of [192, 512]) {
  const icon = manifest.icons.find(icon => icon.sizes === `${size}x${size}`);
  assert.equal(icon.src, `./icons/icon-${size}-v2.png`);
  assert.equal(icon.type, 'image/png');
  const png = fs.readFileSync(path.join(root, icon.src));
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  assert(png.equals(fs.readFileSync(path.join(root, `icons/icon-${size}.png`))), 'preserve premium icon bytes');
}
assert(fs.readFileSync(path.join(root, 'index.html'), 'utf8').includes('rel="apple-touch-icon" href="./icons/icon-192-v2.png"'));
(async () => {
  let s = setup();
  assert(s.buttons.every(b => !b.hidden));
  await s.buttons[0].emit('click'); assert(s.dialog.open, 'missing native prompt opens real instructions');
  for (const [lang, label] of Object.entries({ ru: 'Установить приложение', uk: 'Встановити застосунок', en: 'Install app', sv: 'Installera appen' })) {
    vm.runInContext(`state.settings.language=${JSON.stringify(lang)}`, s.ctx); s.languageChanged();
    assert.equal(s.buttons[0].querySelector().textContent, label);
    const dictionary = vm.runInContext(`DICT.${lang}`, s.ctx);
    for (const key of Object.keys(vm.runInContext('DICT.ru', s.ctx)).filter(k => k.startsWith('pwa'))) assert(dictionary[key], `${lang}: ${key}`);
  }
  s.dialog.close(); assert(s.buttons[0].focused, 'focus returns to opener');
  for (const [nav, expected, excluded] of [
    [{ userAgent: 'iPhone' }, 'Safari', 'Chrome'],
    [{ userAgent: 'Android Chrome' }, '⋮', 'Safari'],
    [{ userAgent: 'Macintosh Safari', platform: 'MacIntel', maxTouchPoints: 5 }, 'Safari', 'Dock'],
    [{ userAgent: 'Macintosh Version/18 Safari' }, 'Dock', '⋮']
  ]) {
    s = setup(nav); await s.buttons[0].emit('click');
    const text = s.elements['pwa-install-step-one'].textContent;
    assert(text.includes(expected)); assert(!text.includes(excluded));
  }
  const iphoneSafari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1';
  for (const [userAgent, expected] of [[iphoneSafari, 'IOS'], [iphoneSafari+' Instagram', 'IOSBrowser'], [iphoneSafari.replace('Version/26.0', 'CriOS/141.0'), 'IOSBrowser'], ['iPhone AppleWebKit/605.1.15 Telegram', 'IOSBrowser'], [iphoneSafari.replace('Version/26.0', 'FxiOS/143.0'), 'IOSBrowser']]) {
    s=setup({userAgent});await s.buttons[0].emit('click');assert.equal(s.dialog['data-platform'],expected);
    for(const lang of ['ru','uk','en','sv']) {
      vm.runInContext(`state.settings.language='${lang}'`,s.ctx);s.languageChanged();
      for(const id of ['pwa-install-step-one','pwa-install-step-two'])assert(s.elements[id].textContent.length<160, 'compact localized step');
    }
  }
  for (const outcome of ['accepted', 'dismissed']) {
    s = setup(); let calls = 0, prevented = false, resolve;
    const choice = new Promise(r => resolve = r);
    await s.window.emit('beforeinstallprompt', { preventDefault() { prevented = true; }, prompt() { calls++; return Promise.resolve(); }, userChoice: choice });
    assert(prevented);
    const pending = s.buttons[0].emit('click');
    assert.equal(calls, 1, 'prompt runs synchronously during click');
    assert(s.buttons.every(b => b.disabled));
    await s.buttons[1].emit('click'); assert.equal(calls, 1, 'double click cannot reuse prompt');
    resolve({ outcome }); await pending;
    assert(s.buttons.every(b => !b.hidden && !b.disabled), 'acceptance alone must not imply installation');
    assert(!s.dialog.open, 'dismissal does not open another invitation');
    await s.buttons[0].emit('click'); assert.equal(calls, 1); assert(s.dialog.open);
    await s.window.emit('appinstalled'); assert(s.buttons.every(b => b.hidden)); assert(!s.dialog.open);
  }
  s = setup();
  await s.window.emit('beforeinstallprompt', { preventDefault() {}, prompt() { throw Error('unavailable'); } });
  await s.buttons[0].emit('click'); assert(s.dialog.open); assert(s.buttons.every(b => !b.disabled));
  s = setup({}, true); assert(s.buttons.every(b => b.hidden));
  s = setup({ standalone: true }); assert(s.buttons.every(b => b.hidden));
  s = setup(); s.media.matches = true; await s.media.emit('change'); assert(s.buttons.every(b => b.hidden));
  console.log('PASS: PWA prompt lifecycle, one-shot/user activation, fallback platforms, four existing locales, focus, standalone and confirmed install');
})().catch(error => { console.error(error); process.exitCode = 1; });
