const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const lessons=JSON.parse(read('lessons.json'));
const context={window:{addEventListener(){}},document:{addEventListener(){},querySelector(){return null}},localStorage:{getItem(){return null},setItem(){}},location:{hash:'',hostname:'github.io',pathname:'/'},navigator:{},Image:function(){},Date,Math,console,setTimeout,clearTimeout,URL,Response};
vm.createContext(context);
vm.runInContext(read('locale-content.js'),context);
vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),context);
const run=source=>vm.runInContext(source,context);
run(`LESSONS=${JSON.stringify(lessons)};WORDS=${read('words.json')};BOOKS=${read('books.json')};state=defaultState();save=()=>{}`);
const occurrences=(text,needle)=>text.split(needle).length-1;
const sourceSnapshot=JSON.stringify(lessons);
let checkedRules=0,checkedExamples=0,checkedReadingLines=0;

for(const source of lessons){
 run(`var lesson=LESSONS.find(item=>item.id==='${source.id}');route='lesson';routeParam=lesson.id`);
 const structure=[];
 for(const language of ['ru','en','sv','uk']){
  run(`state.settings.language='${language}'`);
  const localized=run('locLessonContent4(lesson)');
  const html=run('renderLesson()');
  assert.equal(localized.rules.length,source.rules.length,`${source.id}: rules lost in ${language}`);
  assert.equal((localized.goals||[]).length,(source.goals||[]).length,`${source.id}: goals changed in ${language}`);
  assert.equal(localized.description.length>0,true);
  if(language!=='ru'){
   const data=run(`content4().lessonDetails['${source.id}']['${language}']`);
   assert.equal(localized.description,data.description,'Description replaced with generic text');
   assert.equal(JSON.stringify(localized.rules),JSON.stringify(data.rules),'Rules replaced with summary');
   if(source.goals)assert.equal(JSON.stringify(localized.goals),JSON.stringify(data.goals));
   assert.equal(localized.reading.title,data.readingTitle);
   assert.equal(localized.reading.tip,data.readingTip);
  }
  for(const rule of localized.rules){
   assert(html.includes(run(`esc(${JSON.stringify(rule)})`)),`${source.id}: missing explanation in ${language}`);
   assert(!rule.includes('Study the pattern')&&!rule.includes('Studera mönstret'),'Generic lesson summary returned');
  }
  assert(html.includes(run(`esc(${JSON.stringify(localized.description)})`)),'Full description missing');
  for(const goal of localized.goals||[])assert(html.includes(run(`esc(${JSON.stringify(goal)})`)),'Goal missing');
  for(const example of source.examples){
   assert(html.includes(run(`esc(${JSON.stringify(example.sv)})`)),'Swedish example lost');
   assert(html.includes(run(`'<p>'+esc(quizSourceText(${JSON.stringify(example.ru)}))+'</p>'`)),'Example translation hidden');
  }
  for(const line of source.reading.lines){
   const translated=run(`quizSourceText(${JSON.stringify(line.ru)})`);
   assert(html.includes(run(`'<small>'+esc(${JSON.stringify(translated)})+'</small>'`)),'Reading translation hidden');
   assert(html.includes(run(`'data-text="'+esc(${JSON.stringify(line.sv)})+'"'`)),'Reading audio lost');
  }
  assert(html.includes(run(`esc(${JSON.stringify(localized.reading.title)})`)),'Reading title missing');
  assert(html.includes(run(`esc(${JSON.stringify(localized.reading.tip)})`)),'Reading tip missing');
  const goals=html.match(/<section class="content-panel lesson-goals">([\s\S]*?)<\/section>/)[1];
  structure.push(JSON.stringify([
   occurrences(html,'class="rule-chapter"'),occurrences(goals,'<li>'),
   occurrences(html,'class="example-item"'),occurrences(html,'class="reading-line"'),
   occurrences(html,'<small>'),occurrences(html,'data-action="speak"')
  ]));
  if(language==='en'||language==='sv')assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(html.replace(/<[^>]*>/g,'')),`${source.id}: untranslated content in ${language}`);
 }
 assert(structure.every(value=>value===structure[0]),`${source.id}: visible content differs between languages`);
 checkedRules+=source.rules.length;checkedExamples+=source.examples.length;checkedReadingLines+=source.reading.lines.length;
}

for(const language of ['ru','en','sv','uk']){
 run(`state.settings.language='${language}'`);
 const rulesHtml=run('renderRules()');
 assert.equal(occurrences(rulesHtml,'<li>'),checkedRules,'Rules reference lost explanations');
 for(const source of lessons)for(const rule of run(`locRules4(LESSONS.find(item=>item.id==='${source.id}'))`)){
  assert(rulesHtml.includes(run(`esc(${JSON.stringify(rule)})`)),'Rules reference uses different explanations');
 }
 for(const level of ['A','B','C','D']){
  const cards=run(`routeParam='${level}';renderLessons()`);
  for(const source of lessons.filter(lesson=>lesson.level===level)){
   assert(cards.includes(run(`esc(locLessonContent4(LESSONS.find(item=>item.id==='${source.id}')).description)`)),'Lesson card summary differs from lesson');
  }
 }
}

// Switching the language on an already opened lesson preserves the route and every rule.
run("route='lesson';routeParam='lesson-50';render=()=>{renderedLesson=renderLesson()}");
for(const language of ['en','sv','uk','ru']){
 run(`changeLanguage('${language}')`);
 assert.equal(run('route'),'lesson');assert.equal(run('routeParam'),'lesson-50');
 assert.equal(occurrences(run('renderedLesson'),'class="rule-chapter"'),lessons[49].rules.length);
}
assert.equal(run('JSON.stringify(LESSONS)'),sourceSnapshot,'Localization mutated the source lessons');
console.log(`PASS: ${lessons.length} lessons A–D, ${checkedRules} full rules, ${checkedExamples} examples, ${checkedReadingLines} reading lines; equal content in all 4 languages and rules reference`);
