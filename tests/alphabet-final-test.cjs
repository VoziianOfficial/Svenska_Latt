const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),lessons=JSON.parse(read('lessons.json')),c=lessons[0].pronunciationChapter,f=c.finalTest;
assert.equal(f.questions.length,20);assert.equal(c.questions.length+c.dictation.length+c.writing.length,35);
const distribution={};for(const q of f.questions)distribution[q.category]=(distribution[q.category]||0)+1;
assert.deepEqual(distribution,{alphabet:3,kgs:5,combinations:4,quantity:3,reading:3,writing:2});
assert(f.questions.every((q,i)=>q.difficulty>=(f.questions[i-1]?.difficulty||0)));
assert.equal(new Set(f.questions.map(q=>q.id)).size,20);assert.equal(f.reading.text.split(/[.!?]+/).filter(s=>s.trim()).length,6);
assert(!c.reading.lines.some(l=>f.reading.text.includes(l.sv)));
const refs=new Set([...c.sections.flatMap(s=>s.rules.map(r=>r.id)),'reading']),sources=new Set(c.sources.map(s=>s.id));
const dictionary=JSON.parse(read('reports/alphabet-pronunciation/final-dictionary-checks.json'));
for(const q of f.questions){
 assert(q.ruleRefs.length&&q.ruleRefs.every(r=>refs.has(r)));assert(q.sources.length&&q.sources.every(s=>sources.has(s)));
 assert.equal(q.options.filter(o=>o.id===q.answerId).length,1);assert.equal(q.options.length,4);
 for(const word of q.novelWords){assert(!c.words[word],q.id+': recycled theory example '+word);assert(dictionary[word]?.status.startsWith('checked'),word+': unconfirmed pronunciation')}
 for(const lang of ['ru','en','sv','uk']){assert(q.prompt[lang]);assert.equal(new Set(q.options.map(o=>o.text[lang])).size,4);for(const o of q.options){assert(o.text[lang]&&o.feedback[lang].length>20);assert(!/^(wrong|incorrect|неправильно)[.!]?$/i.test(o.feedback[lang]))}}
}
const local=new Map(),session=new Map(),events={};
function page(){
 const nodes={};const window={addEventListener(){}},document={addEventListener(type,fn){(events[type]??=[]).push(fn)},querySelector:s=>nodes[s]||null,querySelectorAll:()=>[]};
 const ctx={window,document,console,location:{hash:'#lesson/lesson-1',hostname:'github.io',pathname:'/'},navigator:{},Date,Math,URL,Response,setTimeout,clearTimeout,localStorage:{getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)},sessionStorage:{getItem:k=>session.get(k)||null,setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)}};
 vm.createContext(ctx);vm.runInContext(read('locale-content.js'),ctx);vm.runInContext(read('alphabet-lesson.js'),ctx);vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),ctx);
 const run=s=>vm.runInContext(s,ctx);run(`WORDS=${read('words.json')};LESSONS=${JSON.stringify(lessons)};BOOKS=${read('books.json')};state=readLocalState();route='lesson';routeParam='lesson-1';toast=()=>{};headerStats=()=>{};markReview=()=>{};render=()=>persistQuizSession();navigate=(r,p='')=>{route=r;routeParam=p;render()}`);
 return {run,ctx};
}
(async()=>{
 let p=page(),run=p.run;run('state=defaultState()');let branches=0;
 for(const lang of ['ru','uk','en','sv']){
  run(`state.settings.language='${lang}'`);await run("startQuiz('lesson','lesson-1')");assert.equal(run('quiz.bank'),f.id);
  assert.deepEqual(JSON.parse(run('JSON.stringify(quiz.questions.map(q=>q.questionId))')),f.questions.map(q=>q.id));
  for(let i=0;i<20;i++){
   run(`quiz.index=${i};quiz.answered=true`);assert.equal(run('quiz.questions[quiz.index].reviewRules.length'),f.questions[i].ruleRefs.length);
   const canonical=JSON.parse(run('JSON.stringify(quiz.questions[quiz.index].serverOptions)'));
   for(let j=0;j<4;j++){
    run(`quiz.selected=quiz.questions[quiz.index].options[${j}];quiz.latest=quiz.selected===quiz.questions[quiz.index].answer`);
    assert.equal(run('quiz.latest'),canonical[j]===f.questions[i].answerId);
    const html=run('renderQuiz()');assert(html.includes('data-alphabet-review-rule='));if(i===19)assert(html.includes({ru:'Завершить тест',uk:'Завершити тест',en:'Finish test',sv:'Avsluta testet'}[lang]));assert(html.includes(run('esc(quiz.questions[quiz.index].answerDetails['+j+'].feedback)')));
    for(const d of run('quiz.questions[quiz.index].answerDetails'))assert(html.includes(run('esc('+JSON.stringify(d.feedback)+')')));
    if(['en','sv'].includes(lang))assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(html.replace(/<[^>]*>/g,'')),lang+' untranslated feedback');branches++;
   }
  }
 }
 // Each choice stays bound to one canonical ID across language changes and reload.
 run("state=defaultState();resetQuiz()");await run("startQuiz('lesson','lesson-1')");
 await run('submitAnswer(quiz.questions[0].options.find(o=>o!==quiz.questions[0].answer))');
 const selected=run('quiz.questions[0].options.indexOf(quiz.selected)'),ids=run('JSON.stringify(quiz.questions.map(q=>q.serverOptions))');
 for(const lang of ['en','sv','uk','ru']){run(`changeLanguage('${lang}')`);assert.equal(run('quiz.questions[0].options.indexOf(quiz.selected)'),selected);assert.equal(run('JSON.stringify(quiz.questions.map(q=>q.serverOptions))'),ids)}
 p=page();run=p.run;assert(run('restoreQuizSession()'));assert(run('quiz.answered'));assert.equal(run('quiz.questions[0].options.indexOf(quiz.selected)'),selected);assert.equal(run('quiz.questions[0].reviewRules.length'),1);
 async function complete(correct){run('resetQuiz()');await run("startQuiz('lesson','lesson-1')");for(let i=0;i<20;i++){await run(i<correct?'submitAnswer(quiz.questions[quiz.index].answer)':"submitAnswer(quiz.questions[quiz.index].options.find(o=>o!==quiz.questions[quiz.index].answer))");if(i<19)await run("action({dataset:{action:'quiz-next'}})")}await run('finishQuiz()');assert(run('quiz.finished'));assert.equal(run('quiz.score'),correct)}
 run('state=defaultState()');await complete(15);assert.equal(run('state.xp'),0);assert.equal(run("quizPassed('assessment:alphabet-final-v1')"),false);
 await complete(16);for(const [lang,title] of Object.entries({ru:'Итоговый тест завершён!',en:'Final test completed!',sv:'Sluttestet är klart!',uk:'Підсумковий тест завершено!'})){run(`changeLanguage('${lang}')`);assert(run('renderQuizFinish()').includes(title))}run("changeLanguage('ru')");assert.equal(run('state.xp'),35);assert(run("quizPassed('assessment:alphabet-final-v1')"));await complete(20);assert.equal(run('state.xp'),35);await complete(16);assert.equal(run("state.quizResults['assessment:alphabet-final-v1'].correct"),20);
 // A paid historical 13/13 remains distinct from an unsuccessful new-bank attempt.
 run("state=defaultState();state.xp=135;state.completed=['lesson-1'];state.quizResults['lesson:lesson-1']={correct:13,total:13,rewarded:true}");await complete(15);
 assert.equal(run('state.xp'),135);assert.equal(run("state.quizResults['lesson:lesson-1'].total"),13);assert.equal(run("quizPassed('assessment:alphabet-final-v1')"),false);assert(run('quizResultLabel()').includes('Награда урока уже получена'));assert(!run('quizResultLabel()').includes('Тест уже пройден'));
 await complete(20);assert.equal(run('state.xp'),135);assert.equal(run("state.quizResults['lesson:lesson-1'].total"),13);
 // Archive session snapshots remain restorable with their q0..q12 IDs.
 run("resetQuiz();quiz={active:true,finished:false,mode:'lesson',lesson:'lesson-1',questions:LESSONS[0].questions.map((q,i)=>quizBankQuestion(q,'','q'+i)),index:0,score:0,answered:false,selected:[],latest:null,answerCount:0,mistakes:[]};persistQuizSession()");
 p=page();run=p.run;assert(run('restoreQuizSession()'));assert.equal(run('quiz.questions.length'),13);assert.equal(run('quiz.questions[0].questionId'),'q0');assert.equal(run('quiz.bank'),undefined);
 console.log('PASS: final 20 + formative 35; 3/5/4/3/3/2 distribution; '+branches+' option/locale branches; canonical IDs, all explanations/rule links, 15/16/20 thresholds, retries/history/XP and archived 13-question restore');
})().catch(e=>{console.error(e);process.exitCode=1});
