// Read-only inventory. Run before content edits and save stdout as audit evidence.
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const lessons = JSON.parse(read('lessons.json'));
const context = {window:{}};
vm.createContext(context);
vm.runInContext(read('locale-content.js'), context);
const locales = context.window.SV_LOCALES;
const norm = s => String(s).normalize('NFC').toLowerCase().replace(/[.!?«»“”]/g, '').replace(/\s+/g, ' ').trim();
const seen = new Map();
const inventory = lessons.map(l => {
  const prompts = new Set();
  const examples = l.examples.map(e => norm(e.sv));
  const duplicatePrompts = [], repeatedExamples = [], invalidKeys = [], crossLessonDuplicates = [];
  l.questions.forEach((q, i) => {
    const key = norm(q.question);
    if(prompts.has(key)) duplicatePrompts.push(i);
    prompts.add(key);
    if(seen.has(key)) crossLessonDuplicates.push({index:i, previous:seen.get(key)});
    else seen.set(key, l.id+':q'+i);
    if(!q.options.includes(q.answer) || new Set(q.options.map(norm)).size!==q.options.length) invalidKeys.push(i);
    if(examples.some(e => norm(q.question).includes(e) || norm(q.answer)===e)) repeatedExamples.push(i);
  });
  return {id:l.id, level:l.level, title:l.title,
    lessonSha256:crypto.createHash('sha256').update(JSON.stringify(l)).digest('hex'),
    questionsSha256:crypto.createHash('sha256').update(JSON.stringify(l.questions)).digest('hex'),
    rules:l.rules.length, examples:l.examples.length,
    readingLines:l.reading?.lines?.length||0, questions:l.questions.length,
    below20:l.questions.length<20, duplicatePrompts, crossLessonDuplicates, repeatedExamples, invalidKeys,
    perOptionFeedback:l.questions.filter(q=>q.optionExplanations).length,
    writingTasks:l.learningV2?.writing?.length||0, sourceLinks:l.learningV2?.sources?.length||0,
    genericGoals:(l.goals||[]).some(g=>g.startsWith('Понять тему')),
    localeCoverage:Object.fromEntries(['en','sv','uk'].map(lang=>[lang,{
      details:!!locales.lessonDetails?.[l.id]?.[lang],
      missingQuizStrings:l.questions.flatMap(q=>[q.question,q.answer,q.why,...q.options]).filter(s=>/[А-Яа-яЁё]/.test(s)&&!locales.quiz?.[s]?.[lang]).length
    }]))};
});
console.log(JSON.stringify({schemaVersion:1, lessonsSha256:crypto.createHash('sha256').update(read('lessons.json')).digest('hex'),
  totals:{lessons:lessons.length, questions:inventory.reduce((s,l)=>s+l.questions,0), below20:inventory.filter(l=>l.below20).length,
    rules:inventory.reduce((s,l)=>s+l.rules,0), examples:inventory.reduce((s,l)=>s+l.examples,0),
    readingLines:inventory.reduce((s,l)=>s+l.readingLines,0), repeatedExamples:inventory.reduce((s,l)=>s+l.repeatedExamples.length,0),
    duplicatePrompts:inventory.reduce((s,l)=>s+l.duplicatePrompts.length,0), invalidKeys:inventory.reduce((s,l)=>s+l.invalidKeys.length,0)},
  modules:Object.fromEntries('ABCD'.split('').map(level=>[level,inventory.filter(l=>l.level===level)]))},null,2));
