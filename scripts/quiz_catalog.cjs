// Build the trusted, reviewable bank from the same static content as the UI.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
function catalog(){
 const context={window:{addEventListener(){}},document:{addEventListener(){}},localStorage:{getItem(){return null}},location:{},console};
 vm.createContext(context);vm.runInContext(read('locale-content.js'),context);
 vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),context);
 vm.runInContext(`WORDS=${read('words.json')};LESSONS=${read('lessons.json')};BOOKS=${read('books.json')};state=defaultState()`,context);
 return JSON.parse(vm.runInContext(`JSON.stringify(Object.fromEntries([
 ...LESSONS.map(l=>['lesson:'+l.id,{count:l.questions.length,reward:35,questions:Object.fromEntries(l.questions.map((q,i)=>['q'+i,{answer:q.answer}]))}]),
 ...BOOKS.map(l=>['book:'+l.id,{count:l.questions.length,reward:35,questions:Object.fromEntries(l.questions.map((q,i)=>['q'+i,{answer:q.answer}]))}]),
 ...topicNames3().map(id=>{const words=topicWordsPlus(id);return ['topic:'+id,{count:Math.min(20,words.length),reward:35,questions:Object.fromEntries(words.map(w=>[w.id,{answer:w.ru,word_id:w.id}]))}]}),
 ...MORE_VIDEOS.filter(v=>v.question).map(v=>['video:'+v.id,{count:v.questions.length,reward:12,...(VIDEO_QUIZ_BANK[v.id].legacyQuestions?{start_questions:v.questions.map(q=>({question_id:q.id}))}:{}),questions:{...VIDEO_QUIZ_BANK[v.id].legacyQuestions,...Object.fromEntries(v.questions.map(q=>[q.id,{answer:q.answer}]))}}])
 ]))`,context));
}
module.exports=catalog;
if(require.main===module)process.stdout.write(JSON.stringify(catalog(),null,2)+'\n');
