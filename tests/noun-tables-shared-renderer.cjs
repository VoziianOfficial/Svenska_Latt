/* Compare the shared renderer with published main for lessons 3/4 in all locales. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),read=n=>fs.readFileSync(path.join(root,n),'utf8');
function environment(renderer){const window={addEventListener(){}},document={addEventListener(){},querySelector(){return null},querySelectorAll(){return []}};
const scope={window,document,console,location:{hash:'',hostname:'127.0.0.1',pathname:'/'},navigator:{},URL,Response,Date,Math,setTimeout,clearTimeout,localStorage:{getItem(){return null},setItem(){},removeItem(){}},sessionStorage:{getItem(){return null},setItem(){},removeItem(){}}};
vm.createContext(scope);for(const name of ['locale-content.js','alphabet-lesson.js','greetings-lesson.js','pronouns-lesson.js','app.js'])vm.runInContext((name==='pronouns-lesson.js'?renderer:read(name)).replace(/\nboot\(\);/g,''),scope);
vm.runInContext(`LESSONS=${read('lessons.json')};WORDS=${read('words.json')};BOOKS=${read('books.json')};state=defaultState()`,scope);return scope;}
const old=environment(cp.execFileSync('git',['show','HEAD:pronouns-lesson.js'],{cwd:root,encoding:'utf8'})),current=environment(read('pronouns-lesson.js'));
for(const lesson of [3,4])for(const lang of ['ru','uk','en','sv']){const expression=`state=defaultState();state.settings.language='${lang}';route='lesson';routeParam='lesson-${lesson}';renderLesson()`;assert.equal(vm.runInContext(expression,current),vm.runInContext(expression,old),`Lesson ${lesson}/${lang} renderer changed`);}
console.log('PASS: lessons 3/4 produce byte-identical HTML to published renderer in RU/UK/EN/SV');
