const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const langs=['ru','uk','en','sv'];
const normalize=s=>String(s).normalize('NFC').toLowerCase().replace(/[.!?«»“”]/g,'').replace(/\s+/g,' ').trim();
function validate(lessons){
 const ids=new Set(),questionIds=new Set(),modules=new Set(),summary=[];
 for(const l of lessons){
  assert(l.id&&!ids.has(l.id),'Duplicate/missing lesson ID: '+l.id);ids.add(l.id);
  assert('ABCD'.includes(l.level)&&l.level.length===1,'Invalid level '+l.id);
  for(const key of ['title','description'])assert(typeof l[key]==='string'&&l[key].trim(),l.id+': '+key);
  for(const key of ['rules','examples','questions'])assert(Array.isArray(l[key])&&l[key].length,l.id+': '+key);
  const oldPrompts=new Set();
  for(const q of l.questions){
   assert(q.question&&q.why&&q.options?.length>=2,l.id+': incomplete legacy question');
   assert.equal(q.options.filter(o=>o===q.answer).length,1,l.id+': invalid legacy answer');
   assert.equal(new Set(q.options.map(normalize)).size,q.options.length,l.id+': repeated legacy options');
   assert(!oldPrompts.has(normalize(q.question)),l.id+': duplicate legacy question');oldPrompts.add(normalize(q.question));
  }
 }
 function localized(value,label){
  assert(value&&typeof value==='object',label+': localized object required');
  for(const lang of langs){
   assert(typeof value[lang]==='string'&&value[lang].trim(),label+': missing '+lang);
   if(lang==='en'||lang==='sv')assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(value[lang]),label+': Cyrillic in '+lang);
  }
 }
 function validateTranslations(value,label){
  if(!value||typeof value!=='object')return;
  const keys=Object.keys(value);
  if(langs.some(lang=>lang!=='sv'&&Object.hasOwn(value,lang))||(keys.length&&keys.every(key=>langs.includes(key)))){localized(value,label);return}
  for(const [key,child] of Object.entries(value))validateTranslations(child,label+'.'+key);
 }
 for(const l of lessons){
  const v=l.learningV2;if(!v)continue;
  assert.equal(v.schemaVersion,1);assert.equal(v.lessonId,l.id);assert.equal(v.level,l.level);
  assert(v.id&&!modules.has(v.id),'Duplicate module ID');modules.add(v.id);
  assert(l.goals?.length,l.id+': missing goals');
  assert.equal(v.assessment,'formative-no-xp');
  for(const lang of langs){
   const loc=v.locales?.[lang];assert(loc?.description&&loc.goals?.length&&loc.rules?.length,l.id+': incomplete locale '+lang);
   assert.equal(loc.rules.length,l.rules.length);assert.equal(loc.goals.length,l.goals.length);
   if(lang==='en'||lang==='sv')assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(JSON.stringify(loc)),'Cyrillic in '+lang);
  }
  assert.deepEqual(v.locales.ru.rules,l.rules);assert.deepEqual(v.locales.ru.goals,l.goals);
  assert.equal(v.locales.ru.description,l.description);
  // Locales are parallel lesson objects, while every other localized leaf has 4 strings.
  const {locales,...translatedContent}=v;validateTranslations(translatedContent,v.id);
  for(const field of ['introduction','structures','comparison','mistakes','cheatSheet','vocabulary','writing','rubric','sources','ruleSources'])assert(v[field]&&(!Array.isArray(v[field])||v[field].length),v.id+': missing '+field);
  localized(v.introduction,v.id+': introduction');
  for(const s of v.structures){assert(s.pattern&&s.example);localized(s.meaning,v.id+': structure meaning')}
  for(const c of v.comparison){assert(c.pair);localized(c.explanation,v.id+': comparison')}
  for(const m of v.mistakes){assert(m.wrong&&m.correct);localized(m.why,v.id+': mistake')}
  for(const r of v.cheatSheet){assert(r.inf&&r.present);localized(r.meaning,v.id+': form meaning')}
  for(const w of v.vocabulary){assert(w.sv);localized(w.meaning,v.id+': vocabulary meaning')}
  for(const r of v.rubric)localized(r,v.id+': rubric');
  for(const id of v.prerequisites)assert(ids.has(id),v.id+': broken lesson link '+id);
  const sourceIds=new Set(v.sources.map(s=>s.id));assert.equal(sourceIds.size,v.sources.length);
  for(const s of v.sources)assert(s.title&&new URL(s.url).protocol==='https:',v.id+': invalid source');
  for(const [group,members]of Object.entries(v.sourceGroups||{})){
   assert(!sourceIds.has(group));for(const id of members)assert(sourceIds.has(id),'Unknown source '+id);sourceIds.add(group);
  }
  assert.equal(v.ruleSources.length,l.rules.length);
  for(const refs of v.ruleSources){assert(refs.length);for(const id of refs)assert(sourceIds.has(id),'Unknown rule source '+id)}
  assert.equal(v.goalSources?.length,l.goals.length,'Missing goal sources');
  for(const refs of v.goalSources){assert(refs.length);for(const id of refs)assert(sourceIds.has(id),'Unknown goal source '+id)}
  assert(v.questions.length>=20,v.id+': fewer than 20 tasks');
  const teaching=[...l.examples.map(e=>e.sv),...(l.reading?.lines||[]).map(e=>e.sv),...v.structures.map(s=>s.example),...v.mistakes.map(m=>m.correct)].map(normalize).filter(s=>s.split(' ').length>=3);
  const prompts=Object.fromEntries(langs.map(lang=>[lang,new Set()]));
  for(const q of v.questions){
   assert(q.id&&!questionIds.has(q.id),'Duplicate question ID');questionIds.add(q.id);
   assert(['choice','cloze'].includes(q.type),'Unknown task type');assert(q.skill);
   assert(q.ruleRefs?.length);for(const i of q.ruleRefs)assert(Number.isInteger(i)&&i>=0&&i<l.rules.length,'Broken rule link');
   localized(q.prompt,q.id);
   for(const lang of langs){const key=normalize(q.prompt[lang]);assert(!prompts[lang].has(key),q.id+': duplicate prompt');prompts[lang].add(key)}
   const text=[q.context||'',...langs.map(lang=>q.prompt[lang])];
   if(q.type==='choice'){
    assert(q.options?.length>=3&&q.options.length<=5,q.id+': invalid options');
    assert.equal(new Set(q.options.map(o=>o.id)).size,q.options.length);
    assert.equal(q.options.filter(o=>o.id===q.answerId).length,1,q.id+': invalid answer');
    for(const lang of langs){
     const values=q.options.map(o=>normalize(typeof o.text==='string'?o.text:o.text[lang]));
     assert.equal(new Set(values).size,values.length,q.id+': duplicate localized options');
     const answer=q.options.find(o=>o.id===q.answerId);text.push(typeof answer.text==='string'?answer.text:answer.text[lang]);
    }
    for(const o of q.options){assert(o.id&&o.text);localized(o.feedback,q.id+': feedback')}
   }else{
    assert(typeof q.answer==='string'&&q.answer.trim()&&!/\s/.test(q.answer),q.id+': cloze requires one word');
    localized(q.feedback,q.id+': feedback');text.push(q.answer);
   }
   for(const example of teaching)for(const tested of text)assert(!normalize(tested).includes(example),q.id+': repeats theory example '+example);
  }
  assert(new Set(v.questions.map(q=>q.skill)).size>=4,'Insufficient skill variety');
  for(const w of v.writing){assert(w.id&&!questionIds.has(w.id));questionIds.add(w.id);assert(w.model);localized(w.prompt,w.id);localized(w.translation,w.id)}
  assert(v.rubric.length>=5);assert(v.review?.date&&v.review.independentLanguageReview,'Missing review status');
  summary.push({lesson:l.id,module:v.id,questions:v.questions.length,choice:v.questions.filter(q=>q.type==='choice').length,cloze:v.questions.filter(q=>q.type==='cloze').length,writing:v.writing.length,locales:4});
 }
 return {status:'PASS',lessons:lessons.length,legacyQuestions:lessons.reduce((s,l)=>s+l.questions.length,0),legacyBelow20:lessons.filter(l=>l.questions.length<20).length,pilots:summary,scope:'Structural checks, not independent linguistic certification'};
}
module.exports=validate;
if(require.main===module)console.log(JSON.stringify(validate(JSON.parse(fs.readFileSync(path.join(root,'lessons.json'),'utf8'))),null,2));
