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
 run(`WORDS=${read('words.json')};LESSONS=${JSON.stringify(lessons)};BOOKS=${read('books.json')};state=readLocalState();render=()=>{persistQuizSession();html=renderPractice()};navigate=target=>{route=target;render()};markReview=()=>{};headerStats=()=>{};toast=()=>{}`);
 return {run,events,nodes,document};
}
function reload(lang){
 const next=page();
 if(lang)next.run(`state.settings.language='${lang}'`);
 assert.equal(next.run('restoreQuizSession()'),true,'Saved exercise failed to restore');
 next.run('render()');
 return next;
}

const catalog=require('../scripts/quiz_catalog.cjs')();
const migration=read('supabase/migrations/202610180010_quiz_rewards.sql');
const embedded=JSON.parse(migration.split('$quizbank$')[1]);
assert.deepEqual(embedded,catalog,'Trusted bank drifted from source content');
async function complete(p,mode,id,correct){
 await p.run(`startQuiz(${JSON.stringify(mode)},${JSON.stringify(id)})`);
 const n=p.run('quiz.questions.length'),baseline=p.run('state.xp');
 for(let i=0;i<n;i++){
  await p.run(i<correct?'submitAnswer(quiz.questions[quiz.index].answer)':"submitAnswer(quiz.questions[quiz.index].options.find(v=>v!==quiz.questions[quiz.index].answer))");
  assert.equal(p.run('state.xp'),baseline,'Answers must not award XP');
  await p.run("action({dataset:{action:'quiz-next'}})");
 }
 assert.equal(p.run('quiz.finished'),true);
}
(async()=>{
 let p=page();p.run('state=defaultState()');
 await complete(p,'lesson','lesson-5',7);assert.equal(p.run('state.xp'),0);assert.equal(p.run("quizStatus('lesson:lesson-5')"),'Лучший результат: 70%');
 await complete(p,'lesson','lesson-5',8);assert.equal(p.run('state.xp'),35);assert.equal(p.run('quiz.result.xp'),35);
 assert.equal(p.run("quizStatus('lesson:lesson-5')"),'✓ Пройден · 80%');
 await p.run('finishQuiz()');assert.equal(p.run('state.xp'),35);
 await complete(p,'lesson','lesson-5',10);assert.equal(p.run('state.xp'),35);assert.equal(p.run('quiz.result.new_best'),true);
 assert.match(p.run('renderQuizFinish()'),/Тест уже пройден/);assert(!p.run('renderQuizFinish()').includes('+35 XP'));
 p=reload();assert.equal(p.run('state.xp'),35);assert.equal(p.run("quizStatus('lesson:lesson-5')"),'✓ Пройден · 100%');
 await complete(p,'lesson','lesson-6',6);assert.equal(p.run('state.xp'),35);
 await complete(p,'lesson','lesson-6',9);assert.equal(p.run('state.xp'),70);
 await p.run("startQuiz('lesson','lesson-7');submitAnswer(quiz.questions[0].answer)");assert.equal(p.run('state.xp'),70);
 await p.run('finishQuiz()');assert.equal(p.run('quiz.finished'),false);await p.run('leaveQuiz()');assert.equal(p.run('state.xp'),70);
 await complete(p,'translation',null,20);assert.equal(p.run('state.xp'),70);
 // 79.5% must remain below 80 even when a UI might round it upward.
 p.run("state.quizResults['lesson:fraction']={correct:159,total:200,rewarded:false}");assert.equal(p.run("quizStatus('lesson:fraction')"),'Лучший результат: 79%');
 // Snapshot updates patch compact status nodes without replacing lesson/topic content.
 const classes=new Set(['chip']),chip={dataset:{quizStatus:'lesson:lesson-5'},textContent:'Не пройден',classList:{toggle(name,on){on?classes.add(name):classes.delete(name)}}};
 const button={dataset:{id:'lesson-5'},textContent:'Начать тест →'};
 p.nodes['#page']={querySelectorAll:selector=>selector==='[data-quiz-status]'?[chip]:selector==='[data-action="lesson-test"]'?[button]:[]};
 p.run("route='lessons';renderProgressUX=()=>{};savedRender=render;render=()=>{throw Error('Page must survive snapshot')};refreshWordUI(true);render=savedRender");
 assert.equal(chip.textContent,'✓ Пройден · 100%');assert(classes.has('done-chip'));assert(!classes.has('chip'));assert.match(button.textContent,/ещё|раз|снова/i);
 // Every canonical response remains bound to the same question after localization and refresh.
 for(const lang of ['ru','en','sv','uk']){
  p.run(`state.settings.language='${lang}'`);
  for(const [id,bank] of Object.entries(catalog)){
   const split=id.indexOf(':'),mode=id.slice(0,split),context=id.slice(split+1);
   await p.run(`startQuiz(${JSON.stringify(mode)},${JSON.stringify(context)})`);
   const questions=JSON.parse(p.run('JSON.stringify(quiz.questions)'));
   assert.equal(questions.length,bank.count,id);
   assert.equal(new Set(questions.map(q=>q.questionId)).size,bank.count,id);
   for(const q of questions){
    assert.equal(q.serverOptions[q.options.indexOf(q.answer)],bank.questions[q.questionId].answer,`${lang}: ${id}/${q.questionId}`);
    for(let i=0;i<q.options.length;i++)assert.equal(p.run(`normalize(${JSON.stringify(q.options[i])})===normalize(${JSON.stringify(q.answer)})`),q.serverOptions[i]===bank.questions[q.questionId].answer,`${lang}: ${id}/${q.questionId}: grading mismatch`);
   }
  }
 }
 console.log(`PASS: 70/80/100%, best scores, one-time rewards, retries, refresh, unfinished/random sessions and ${Object.keys(catalog).length} trusted quizzes × 4 languages`);
})().catch(error=>{console.error(error);process.exitCode=1});
