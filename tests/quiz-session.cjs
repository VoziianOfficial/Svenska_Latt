const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const app=read('app.js').replace(/\nboot\(\);/g,'');
const lessons=JSON.parse(read('lessons.json'));
function storage(map=new Map()){
 return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key),map};
}
const localStorage=storage(),sessionStorage=storage();
function page(){
 const events={},nodes={};
 const document={addEventListener(type,fn){(events[type]??=[]).push(fn)},querySelector:selector=>nodes[selector]||null};
 const window={addEventListener(type,fn){(events[type]??=[]).push(fn)}};
 const context={window,document,localStorage,sessionStorage,location:{hash:'#practice',hostname:'github.io',pathname:'/'},navigator:{},Image:function(){},Date,Math,console,setTimeout,clearTimeout,URL,Response};
 vm.createContext(context);
 vm.runInContext(read('locale-content.js'),context);vm.runInContext(app,context);
 const run=source=>vm.runInContext(source,context);
 run(`WORDS=${read('words.json')};LESSONS=${JSON.stringify(lessons)};BOOKS=${read('books.json')};state=readLocalState();render=()=>{persistQuizSession();html=renderPractice()};navigate=target=>{route=target;render()};markReview=()=>{};headerStats=()=>{}`);
 return {run,events,nodes,document};
}
function reload(lang){
 const next=page();
 if(lang)next.run(`state.settings.language='${lang}'`);
 assert.equal(next.run('restoreQuizSession()'),true,'Saved exercise failed to restore');
 next.run('render()');
 return next;
}
const modes=['mixed','translation','fillBlank','weekdays','alphabet','months','dialogues','readText','verbForms','articles','listening','sentences','writeWord','fixMistake'];
for(const mode of modes){
 let current=page();current.run(`startQuiz('${mode}')`);
 const before=current.run('JSON.stringify(quiz)');
 current=reload();
 assert.equal(current.run('JSON.stringify(quiz)'),before,`${mode}: exercise changed on refresh`);
 assert(!current.run('html').includes('practice-modes'),'Refresh returned to mode list');
 for(const language of ['en','sv','uk','ru']){
  current.run(`changeLanguage('${language}')`);
  const snapshot=current.run('JSON.stringify(quiz)');
  current=reload();
  assert.equal(current.run('JSON.stringify(quiz)'),snapshot,`${mode}: translated exercise changed on refresh`);
 }
}

for(const correct of [true,false]){
 let current=page();current.run("startQuiz('translation')");
 current.run(`submitAnswer(${correct?'quiz.questions[0].answer':'quiz.questions[0].options.find(value=>value!==quiz.questions[0].answer)'})`);
 const before=current.run('JSON.stringify([quiz.index,quiz.score,quiz.selected,quiz.latest,quiz.questions,state.xp,state.answered,state.correct])');
 current=reload();
 assert.equal(current.run('JSON.stringify([quiz.index,quiz.score,quiz.selected,quiz.latest,quiz.questions,state.xp,state.answered,state.correct])'),before,'Answer or statistics changed');
 assert(current.run('html').includes(correct?'quiz-feedback success':'quiz-feedback failure'));
 current.run("submitAnswer(quiz.questions[0].answer)");
 assert.equal(current.run('JSON.stringify([quiz.index,quiz.score,quiz.selected,quiz.latest,quiz.questions,state.xp,state.answered,state.correct])'),before,'Restored answer awarded XP twice');
 current.run("action({dataset:{action:'quiz-next'}})");
 current=reload();
 assert.equal(current.run('quiz.index'),1);assert.equal(current.run('quiz.answered'),false);
 const selected=current.run('quiz.selected');assert(Array.isArray(selected)&&selected.length===0,'Previous answer copied to next question');
}

let current=page();current.run("startQuiz('translation');submitAnswer(quiz.questions[0].options.find(value=>value!==quiz.questions[0].answer))");
const wrongIndex=current.run('quiz.questions[0].options.indexOf(quiz.selected)');
current=reload('uk');
assert.equal(current.run('quiz.questions[0].options.indexOf(quiz.selected)'),wrongIndex,'Changed language lost wrong answer identity');

// Real input events save drafts immediately, before refresh or navigation.
current=page();current.run("startQuiz('writeWord')");
for(const id of ['#close-modal','#modal-backdrop','#profile-top','#sidebar-profile'])current.nodes[id]={addEventListener(){}};
current.run('bindEvents()');
for(const listener of current.events.input||[])listener({target:{id:'quiz-text-input',value:'arb'}});
current=reload();assert.equal(current.run('quiz.selected'),'arb');assert(current.run('html').includes('value="arb"'));
current=page();current.run("startQuiz('sentences');action({dataset:{action:'add-token',id:quiz.questions[0].tokens[0].id}})");
const selectedTokens=current.run('JSON.stringify(quiz.selected)');
current=reload();assert.equal(current.run('JSON.stringify(quiz.selected)'),selectedTokens);
current.run("action({dataset:{action:'remove-token',index:'0'}})");
current=reload();assert.equal(current.run('quiz.selected.length'),0);

for(const [mode,id] of [['mixed','lesson-1'],['mixed','lesson-50'],['book','book-1'],['topic','Семья']]){
 current=page();current.run(`startQuiz('${mode}',${JSON.stringify(id)})`);
 const before=current.run('JSON.stringify(quiz)');current=reload();assert.equal(current.run('JSON.stringify(quiz)'),before);
}
current=page();current.run("reviewDeck=()=>WORDS.slice(0,5);startQuiz('review',null,true)");
const review=current.run('JSON.stringify(quiz)');current=reload();assert.equal(current.run('JSON.stringify(quiz)'),review);

// Completed results survive refresh; explicitly leaving the exercise clears them.
current=page();current.run("startQuiz('translation');quiz.index=quiz.questions.length-1;submitAnswer(quiz.questions[quiz.index].answer);finishQuiz()");
current=reload();assert.equal(current.run('quiz.finished'),true);assert(current.run('html').includes('quiz-finished'));
current.run('resetQuiz()');assert.equal(current.run('restoreQuizSession()'),false);

// Exercises are isolated by account and tab; restoring never imports another identity's attempt.
current=page();current.run("startQuiz('articles');applyAuthState({user:{id:'account-a'}})");
assert.equal(current.run('quiz.active'),false);
current.run("startQuiz('months')");
current=page();current.run("applyAuthState({user:{id:'account-a'}})");assert.equal(current.run('quiz.mode'),'months');assert.equal(current.run('quiz.active'),true);
current.run("applyAuthState({user:{id:'account-b'}})");assert.equal(current.run('quiz.active'),false);
current.run("applyAuthState({user:null})");assert.equal(current.run('quiz.mode'),'articles');

for(const invalid of ['{',JSON.stringify({version:99}),JSON.stringify({version:1,language:'ru',quiz:{active:true,questions:[],index:0,score:0}})]){
 sessionStorage.setItem('sv-guest-v2:quiz-v1',invalid);
 current=page();assert.equal(current.run('restoreQuizSession()'),false);
}
current=page();current.run("startQuiz('articles')");
let record=JSON.parse(sessionStorage.getItem('sv-guest-v2:quiz-v1'));record.quiz.index=999;
sessionStorage.setItem('sv-guest-v2:quiz-v1',JSON.stringify(record));current=page();assert.equal(current.run('restoreQuizSession()'),false);
// Storage restrictions must not prevent studying.
current=page();current.run("sessionStorage.setItem=()=>{throw Error('Quota')};sessionStorage.getItem=()=>{throw Error('Unavailable')};startQuiz('translation')");
assert.equal(current.run('quiz.active'),true);assert.equal(current.run('restoreQuizSession()'),false);
// Exercise the actual boot path, including restoring state before the first page render.
(async()=>{
 sessionStorage.setItem=(key,value)=>sessionStorage.map.set(key,String(value));
 sessionStorage.getItem=key=>sessionStorage.map.get(key)??null;
 const original=page();original.run("startQuiz('sentences')");
 const before=original.run('JSON.stringify(quiz)');
 const fresh=page();
 fresh.run("bindEvents=()=>{};fetch=async url=>({ok:true,json:async()=>url.endsWith('words.json')?WORDS:url.endsWith('lessons.json')?LESSONS:BOOKS})");
 await fresh.run('boot()');
 assert.equal(fresh.run('route'),'practice');
 assert.equal(fresh.run('JSON.stringify(quiz)'),before,'Boot did not restore the ongoing exercise');
 assert(fresh.run('html').includes('built-sentence'),'Boot rendered mode list instead of the exercise');
 console.log('PASS: boot/refresh preserves 14 modes, 4 languages, answers, drafts, tokens, question order, results and XP; account isolation, clearing and invalid/unavailable storage');
})().catch(error=>{console.error(error);process.exitCode=1});
