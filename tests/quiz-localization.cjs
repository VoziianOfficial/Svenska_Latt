const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const words=JSON.parse(read('words.json')),lessons=JSON.parse(read('lessons.json')),books=JSON.parse(read('books.json'));
const nodes={},listeners={};
const context={window:{addEventListener(){}},document:{addEventListener(type,fn){(listeners[type]??=[]).push(fn)},querySelector:selector=>nodes[selector]||null},localStorage:{getItem(){return null},setItem(){}},location:{hash:'',hostname:'github.io',pathname:'/'},navigator:{},Image:function(){},Date,Math,console,setTimeout,clearTimeout,URL,Response};
vm.createContext(context);
vm.runInContext(read('locale-content.js'),context);
vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),context);
const run=source=>vm.runInContext(source,context);
run(`WORDS=${JSON.stringify(words)};LESSONS=${JSON.stringify(lessons)};BOOKS=${JSON.stringify(books)};state=defaultState();render=()=>{};save=()=>{};navigate=()=>{};mutate=fn=>fn();touch=()=>{};markReview=()=>{}`);
const languages=['ru','en','sv','uk'];
const switchTo=lang=>run(`changeLanguage('${lang}')`);
const setQuiz=()=>run(`quiz={active:true,finished:false,questions:[question],index:0,score:0,answered:false,selected:[],latest:null}`);
const plain=html=>html.replace(/<[^>]*>/g,'');

// Every original lesson/book question keeps its content, answer and option order across switches.
for(const source of [...lessons,...books].flatMap(item=>item.questions)){
 run(`state.settings.language='ru';var question=quizBankQuestion(${JSON.stringify(source)})`);
 setQuiz();
 assert.equal(run('question.question'),source.question);
 assert.equal(run('question.why'),source.why);
 run('var optionIndex=question.options.findIndex(option=>option!==question.answer);submitAnswer(question.options[optionIndex])');
 const before=run('JSON.stringify([quiz.index,quiz.score,quiz.latest,state.xp,state.answered])');
 const ruOptions=run('JSON.stringify(question.options)');
 for(const lang of ['en','sv','uk','ru']){
  switchTo(lang);
  assert.equal(run('question.options.indexOf(quiz.selected)'),run('optionIndex'),'Wrong answer highlight moved');
  assert.equal(run('JSON.stringify([quiz.index,quiz.score,quiz.latest,state.xp,state.answered])'),before,'Switch changed progress');
  const html=plain(run('renderQuiz()'));
  if(lang==='en'||lang==='sv')assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(html),`${lang}: untranslated quiz: ${source.question}`);
  for(const field of ['question','answer','why'])assert(run(`question.${field}`).length>0,`Empty ${lang} ${field}`);
 }
 assert.equal(run('JSON.stringify(question.options)'),ruOptions,'Switch reordered choices');
}

const modes=['mixed','translation','fillBlank','weekdays','alphabet','months','dialogues','readText','verbForms','articles','listening','sentences','writeWord','fixMistake'];
for(const initial of languages)for(const mode of modes)for(let sample=0;sample<12;sample++){
 run(`state.settings.language='${initial}';question=getQuestion('${mode}')`);
 setQuiz();
 const type=run('question.type'),tokenIds=run('JSON.stringify(question.tokens||[])');
 if(type==='choice')run('submitAnswer(question.answer)');
 for(const lang of languages){
  switchTo(lang);
  assert.equal(run('question.type'),type,'Switch changed exercise type');
  assert.equal(run('JSON.stringify(question.tokens||[])'),tokenIds,'Switch changed sentence tokens');
  if(type==='choice')assert.equal(run('quiz.selected'),run('question.answer'),'Correct answer highlight lost');
  if(lang==='en'||lang==='sv')assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(plain(run('renderQuiz()'))),`${mode}: untranslated ${lang} exercise`);
 }
}

run("question=getQuestion('writeWord')");setQuiz();
nodes['#quiz-text-input']={value:'Jag skri'};
switchTo('en');
assert.equal(run('quiz.selected'),'Jag skri','Unsubmitted text lost');
assert(run('renderQuiz()').includes('value="Jag skri"'));
delete nodes['#quiz-text-input'];
run("question=getQuestion('sentences')");setQuiz();
run('quiz.selected=question.tokens.slice(0,2)');
const selected=run('JSON.stringify(quiz.selected)');switchTo('uk');
assert.equal(run('JSON.stringify(quiz.selected)'),selected,'Sentence selection lost');

for(const lang of languages){
 switchTo(lang);
 for(const lesson of lessons){
  run(`startQuiz('mixed','${lesson.id}')`);
  assert.equal(run('quiz.questions.length'),Math.min(14,lesson.questions.length),'Lesson questions removed');
 }
 for(const book of books){
  run(`startQuiz('book','${book.id}')`);
  assert.equal(run('quiz.questions.length'),book.questions.length,'Book questions removed');
 }
 run("startQuiz('topic','Семья')");assert(run('quiz.questions.length')>0);
 run("reviewDeck=()=>WORDS.slice(0,20);startQuiz('review',null,true)");assert.equal(run('quiz.questions.length'),20);
}

// Video feedback uses the same live localization as practice and lesson feedback.
run(`MORE_VIDEOS.push({id:'localization-test',question:'Vad säger hon?',answer:'Hej',wrong:['Tack']})`);
const event={target:{closest:()=>({dataset:{id:'localization-test'}})},preventDefault(){},stopImmediatePropagation(){}};
switchTo('ru');
for(const fn of listeners.click)if(String(fn).includes('video-quiz'))fn(event);
const videoRu=run('quiz.questions[0].why');switchTo('en');
assert.notEqual(run('quiz.questions[0].why'),videoRu);
assert(run('quiz.questions[0].why').startsWith('Question based on'));
console.log('PASS: 595 original questions, 14 modes, 4 languages, correct/incorrect feedback, option identity, drafts, sentence tokens, lesson/book/topic/review/video entry points');
