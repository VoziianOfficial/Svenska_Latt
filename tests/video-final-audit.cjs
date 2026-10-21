const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const read=n=>fs.readFileSync(require('node:path').resolve(__dirname,'..',n),'utf8');
const c={window:{addEventListener(){}},document:{addEventListener(){}},localStorage:{getItem(){return null}},location:{}};vm.createContext(c);vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),c);
const videos=JSON.parse(vm.runInContext('JSON.stringify(MORE_VIDEOS.filter(v=>v.question))',c));
const sources=JSON.parse(read('reports/VIDEO_QUIZ_SOURCES_2026-10-19.json'));
test('all twelve episode quizzes have traceable distinct Swedish questions; all twelve banks use five verified questions',()=>{
 assert.equal(videos.length,12);assert.equal(videos.reduce((n,v)=>n+v.questions.length,0),60);
 for(const v of videos){assert.equal(v.questions.length,5,v.id);assert.equal(new Set(v.questions.map(q=>q.id)).size,v.questions.length);assert.equal(new Set(v.questions.map(q=>q.question)).size,v.questions.length);
  for(const q of v.questions){assert.equal(new Set([q.answer,...q.wrong]).size,4,v.id+'/'+q.id);assert(q.question.endsWith('?'));assert.match(q.source,/^https:\/\/(www\.ur\.se|urplay\.se)\//);assert(q.locator);assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(q.question));assert.deepEqual(q,sources[v.id].questions.find(source=>source.id===q.id))}
  assert.equal(v.questions[0].answer,v.answer,'q0 must survive '+v.id);assert.equal(v.questions[0].question,v.question);
 }
 assert.equal(sources.v4.fullQuiz,true);assert(videos.every(v=>v.requiresVideoBank));
});
test('014 preserves existing bank at runtime and changes only the exact count check in the 012 writer',()=>{
 const migration=read('supabase/migrations/202610190014_video_progress.sql');
 const writer=read('supabase/migrations/202610180012_xp_integrity.sql');
 const old=migration.split('$old$')[1],replacement=migration.split('$new$')[1];
 assert.equal(writer.split(old).length-1,1);assert.match(replacement,/n=1/);assert.match(replacement,/\[\{"question_id":"q0"\}\]/);
 assert.match(migration,/quiz_catalog_before_014/);assert.match(migration,/set local lock_timeout='10s'/);assert.match(migration,/set local statement_timeout='60s'/);
 assert.doesNotMatch(migration,/\b(?:delete from|truncate|update public\.|insert into public\.|alter table|create policy|drop policy)\b/i);
 assert.match(migration,/revoke all on function sl_private\.quiz_catalog_before_014\(\) from public,anon,authenticated/);
 assert.match(migration,/video_quizzes_v3/);
});

test('topic grading cannot resolve a distractor through an unselected synonym with a different Russian answer',()=>{
 vm.runInContext(read('locale-content.js'),c);vm.runInContext('state=defaultState();state.settings.language="en";WORDS='+read('words.json'),c);
 const result=JSON.parse(vm.runInContext(`JSON.stringify((()=>{
 const pupil=WORDS.find(w=>w.id==='w-elev'),student=WORDS.find(w=>w.en==='student'&&w.ru!=='ученик');
 const q=quizWordQuestion(pupil,'translation',[pupil,student]);
 return {answer:q.answer,options:q.options,responses:q.canonicalOptions,correct:pupil.ru};
 })())`,c));
 for(let i=0;i<result.options.length;i++)assert.equal(result.options[i]===result.answer,result.responses[i]===result.correct);
});

test('licensed videos stop at Stockholm midnight and manual disabling retains all progress',()=>{
 vm.runInContext('state=defaultState();user=null;state.xp=48;state.videos=["v1"];state.quizResults={"video:v1":{correct:1,total:1,rewarded:true}}',c);
 const before=vm.runInContext('JSON.stringify(state)',c);
 for(const v of videos){
  assert.equal(vm.runInContext(`videoContentAvailable(MORE_VIDEOS.find(v=>v.id===${JSON.stringify(v.id)}),Date.parse('2026-12-31T22:59:59.999Z'))`,c),true);
  assert.equal(vm.runInContext(`videoContentAvailable(MORE_VIDEOS.find(v=>v.id===${JSON.stringify(v.id)}),Date.parse('2026-12-31T23:00:00Z'))`,c),false);
 }
 vm.runInContext('MORE_VIDEOS.find(v=>v.id==="v1").disabled=true',c);
 assert.equal(vm.runInContext('videoQuizAvailable(MORE_VIDEOS.find(v=>v.id==="v1"))',c),false);
 assert.match(vm.runInContext('renderVideos()',c),/Исторический квиз пройден/);
 assert.equal(vm.runInContext('JSON.stringify(state)',c),before);
 vm.runInContext('MORE_VIDEOS.find(v=>v.id==="v1").disabled=false',c);
});

test('replacement banks retain q0 for old events and explicitly select only five new IDs',()=>{
 const catalog=require('../scripts/quiz_catalog.cjs')();
 for(const id of ['v1','v2','v4']){
  const bank=catalog['video:'+id];assert.equal(bank.count,5);
  assert.equal(Object.keys(bank.questions).length,6);
  assert.deepEqual(bank.start_questions,sources[id].questions.map(q=>({question_id:q.id})));
  assert(!bank.start_questions.some(q=>q.question_id==='q0'));
 }
});
