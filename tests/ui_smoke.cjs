const fs=require('fs'),vm=require('vm'),path=require('path').resolve(__dirname,'..')+'/';
const e=fs.readFileSync(path+'app.js','utf8').replace(/\nboot\(\);/g,'');
const locale=fs.readFileSync(path+'locale-content.js','utf8');
const w=JSON.parse(fs.readFileSync(path+'words.json','utf8')),l=JSON.parse(fs.readFileSync(path+'lessons.json','utf8')),b=JSON.parse(fs.readFileSync(path+'books.json','utf8'));
let ctx={window:{addEventListener(){}},document:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},location:{hash:'',hostname:'github.io',pathname:'/'},navigator:{},Image:function(){},Date,Math,console,setTimeout,clearTimeout,URL,Response};vm.createContext(ctx);
vm.runInContext(locale,ctx);vm.runInContext(e,ctx);vm.runInContext(`WORDS=${JSON.stringify(w)};LESSONS=${JSON.stringify(l)};BOOKS=${JSON.stringify(b)};state=defaultState();`,ctx);
function test(expr){return vm.runInContext(expr,ctx)}
for(let lang of ['ru','en','uk','sv']){
 test(`state.settings.language=${JSON.stringify(lang)}`);
 for(let [route,param] of [['home',''],['lessons',''],['lesson','lesson-1'],['lesson','lesson-39'],['topics',''],['topic','Семья'],['dictionary',''],['word','v-arbeta'],['flashcards',''],['practice',''],['rules',''],['alphabet',''],['videos',''],['books',''],['book','book-1'],['profile','']]){
  let result;
  try{result=test(`route=${JSON.stringify(route)};routeParam=${JSON.stringify(param)};(${({home:'renderHome',lessons:'renderLessons',lesson:'renderLesson',topics:'renderTopics',topic:'renderTopic',dictionary:'renderDictionary',word:'renderWord',flashcards:'renderFlashcards',practice:'renderPractice',rules:'renderRules',alphabet:'renderAlphabet',videos:'renderVideos',books:'renderBooks',book:'renderBook',profile:'renderProfile'})[route]})()`)}catch(ex){console.log('FAIL',lang,route,ex.stack);process.exitCode=1;continue;}
  if(result.length<150)console.log('EMPTY?',lang,route,result.length);
  if(lang==='en'&&route==='home'&&!result.includes('Swedish'))console.log('home en not translated?');
  if(lang!=='ru'&&/[А-Яа-яЁёІіЇїЄєҐґ]/.test(result)&&lang==='en') console.log('RU TEXT IN EN',route,(result.match(/[А-Яа-яЁё]{4,}[^<]{0,50}/g)||[]).slice(0,7));
 }
 for(let mode of ['mixed','translation','fillBlank','weekdays','alphabet','months','dialogues','readText','verbForms','articles','listening','sentences','writeWord','fixMistake']){
  try{let q=test(`getQuestion(${JSON.stringify(mode)})`);if(!q||!q.answer||!q.question)throw new Error('empty');if(q.options&&!q.options.includes(q.answer))throw new Error('Missing correct answer: '+JSON.stringify(q));}catch(ex){console.log('QUESTION FAIL',lang,mode,ex.message);process.exitCode=1;}
 }
 console.log('COMPLETE',lang)
}
console.log('DATA',l.length,'lessons',w.length,'words',b.length,'books')
