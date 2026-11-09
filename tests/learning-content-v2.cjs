const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const lessons=JSON.parse(read('lessons.json')),baseline=JSON.parse(read('reports/learning-content-baseline-v2.json'));
const validate=require('../scripts/validate_learning_content.cjs');
const sha=data=>crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
assert.equal(validate(lessons).pilots[0].questions,20);
for(const l of lessons){
 const old=baseline.modules[l.level].find(x=>x.id===l.id);assert(old,'Unplanned new lesson ID');
 assert.equal(sha(l.questions),old.questionsSha256,l.id+': legacy question content/order changed');
 if(l.id!=='lesson-4')assert.equal(sha(l),old.lessonSha256,l.id+': unrelated lesson changed');
}
// The validator must reject bad data rather than merely counting the happy path.
function rejects(mutate,pattern){const copy=structuredClone(lessons);mutate(copy[3].learningV2,copy);assert.throws(()=>validate(copy),pattern)}
rejects(v=>v.questions.pop(),/fewer than 20/);
rejects(v=>v.questions[1].id=v.questions[0].id,/Duplicate question/);
rejects(v=>v.questions[0].answerId='missing',/invalid answer/);
rejects(v=>delete v.questions[0].prompt.uk,/missing uk/);
rejects(v=>delete v.questions[0].options[0].feedback.en,/missing en/);
rejects(v=>v.introduction={},/missing ru/);
rejects(v=>v.structures[0].meaning={sv:'bara svenska'},/missing ru/);
rejects(v=>v.vocabulary[0].meaning={sv:'bara svenska'},/missing ru/);
rejects(v=>delete v.cheatSheet[0].meaning.uk,/missing uk/);
rejects(v=>v.questions[0].options[1].text=v.questions[0].options[0].text,/duplicate localized/);
rejects(v=>v.questions[0].prompt.en=v.questions[0].prompt.ru,/Cyrillic/);
rejects(v=>v.questions[0].context=lessons[3].examples[0].sv,/repeats theory/);
rejects(v=>v.prerequisites.push('missing'),/broken lesson link/);
rejects(v=>v.questions[0].ruleRefs.push(999),/Broken rule link/);
rejects(v=>v.ruleSources[0]=['invented'],/Unknown rule source/);
rejects((v,ls)=>ls.push(structuredClone(ls[0])),/Duplicate\/missing lesson/);

const events={},nodes={};
const context={window:{addEventListener(){}},document:{addEventListener(type,fn){(events[type]??=[]).push(fn)},querySelector:s=>nodes[s]||null},localStorage:{getItem(){return null},setItem(){throw Error('Practice must not persist progress')}},location:{},console,setTimeout,clearTimeout,URL};
vm.createContext(context);vm.runInContext(read('locale-content.js'),context);vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),context);
const run=s=>vm.runInContext(s,context);
run(`LESSONS=${JSON.stringify(lessons)};state=defaultState();route='lesson';routeParam='lesson-4';`);
const v=lessons[3].learningV2;
const originalState=run('JSON.stringify(state)');
const originalData=run('JSON.stringify(LESSONS)');
let branches=0;
for(const lang of ['ru','en','sv','uk']){
 run(`state.settings.language='${lang}';learningV2Drafts.clear()`);
 const snapshot=run('JSON.stringify(state)');
 const html=run('renderLesson()');
 assert.equal((html.match(/data-learning-v2-form /g)||[]).length,20);
 assert.equal((html.match(/<textarea /g)||[]).length,2);
 assert(html.includes('data-action="lesson-test" data-id="lesson-4"'),'Legacy scored test inaccessible');
 assert(html.includes('data-learning-v2-summary role="status"'));
 if(['en','sv'].includes(lang))assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(html.replace(/<[^>]*>/g,'')));
 for(const q of v.questions){
  assert(html.includes(run(`esc(${JSON.stringify(q.prompt[lang])})`)),q.id+': prompt missing');
  const check=answer=>JSON.parse(run(`JSON.stringify(learningV2Check('lesson-4',${JSON.stringify(q.id)},${JSON.stringify(answer)}))`));
  assert.equal(check(''),null);assert.equal(check('  '),null);
  if(q.type==='choice'){
   assert.equal(check('invented-option'),null);
   for(const o of q.options){
    const result=check(o.id);assert.equal(result.correct,o.id===q.answerId);branches++;
    const feedback=run(`learningV2Feedback(LESSONS[3].learningV2.questions.find(q=>q.id==='${q.id}'),learningV2Drafts.get(learningV2Key('lesson-4','${q.id}')))`);
    for(const option of q.options)assert(feedback.includes(run(`esc(${JSON.stringify(option.feedback[lang])})`)),'Option feedback missing');
    assert(feedback.includes(result.correct?'success':'failure'));
   }
  }else{
   assert(check('  '+q.answer.toUpperCase()+'. ').correct,'Normalisation rejected intended answer');
   assert(!check(q.answer+'r').correct,'Wrong form accepted');
   if(q.answer.includes('ä'))assert(!check(q.answer.replace('ä','a')).correct,'Swedish diacritics lost');
   assert(!check('anything').correct);branches+=3;
  }
 }
 assert.equal(run('JSON.stringify(state)'),snapshot,'Practice changed user state');
 const cheat=run('renderCheats()');assert(cheat.includes(v.cheatSheet[0].present));
 assert(cheat.includes(run(`esc(${JSON.stringify(v.cheatSheet[0].meaning[lang])})`)));
 // In-memory drafts survive both rerendering and interface language changes.
 run(`learningV2Drafts.set(learningV2Key('lesson-4','presens-a-v2-w01'),{value:'Jag bor här. <script>alert(1)</script>'})`);
 const written=run('renderLearningV2(LESSONS[3])');assert(written.includes('&lt;script&gt;'));assert(!written.includes('<script>alert'));
}
run("state.settings.language='ru'");assert.equal(run('JSON.stringify(state)'),originalState);
assert.equal(run('JSON.stringify(LESSONS)'),originalData,'Practice mutated content');
assert.equal(run("learningV2Check('missing','missing','x')"),null);
run("user={id:'other-account'}");
assert(!run('renderLearningV2(LESSONS[3])').includes('&lt;script&gt;'),'Writing draft leaked into another account');
run('user=null');

// Exercise the actual delegated submit handler using a minimal form boundary.
const q=v.questions[0],output={innerHTML:''},summary={textContent:''};nodes['[data-learning-v2-summary]']=summary;
const input={value:q.answerId};
const form={dataset:{lesson:'lesson-4',task:q.id},matches:s=>s==='[data-learning-v2-form]',reportValidity:()=>true,querySelector:s=>s==='[data-learning-v2-feedback]'?output:input};
const handler=events.submit.find(fn=>String(fn).includes('learningV2Check'));
assert(handler,'Submit handler not bound');let prevented=0;
handler({target:form,preventDefault(){prevented++}});
assert.equal(prevented,1);assert(output.innerHTML.includes('success'));assert(summary.textContent.includes('20 / 20'));
const draftHandler=events.input.find(fn=>String(fn).includes('learningV2Key'));
draftHandler({target:{name:'answer',value:'o2',closest:()=>form,matches:()=>false}});
assert.equal(output.innerHTML,'','Editing must invalidate stale feedback');
assert(summary.textContent.includes('19 / 20'),'Summary retained a stale checked answer');
input.value='o2';handler({target:form,preventDefault(){}});assert(output.innerHTML.includes('failure'));
form.reportValidity=()=>false;const oldOutput=output.innerHTML;handler({target:form,preventDefault(){}});assert.equal(output.innerHTML,oldOutput);
assert.equal(run('JSON.stringify(state)'),originalState);
console.log(`PASS: 50 legacy lessons preserved, 20 tasks × 4 locales, ${branches} answer branches, invalid/empty answers, validator negative cases, delegated submit/edit, escaped writing drafts, no progress or XP writes`);
