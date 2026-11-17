const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const lessons=JSON.parse(read('lessons.json')),lesson=lessons.find(l=>l.id==='lesson-1'),c=lesson.pronunciationChapter;
const baseline=JSON.parse(read('reports/learning-content-baseline-v2.json'));
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
for(const l of lessons){const old=baseline.modules[l.level].find(x=>x.id===l.id);assert.equal(sha(l.questions),old.questionsSha256,l.id+': historical bank changed');if(!['lesson-1','lesson-2','lesson-4'].includes(l.id))assert.equal(sha(l),old.lessonSha256,l.id+': unrelated content changed')}
assert.equal(c.letters.map(l=>l.upper).join(''),'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ');
assert.equal(new Set(c.letters.map(l=>l.lower)).size,29);assert.equal(c.letters.filter(l=>l.kind==='vowel').length,9);
assert.equal(lesson.questions.length,13);assert.equal(c.questions.length,28);assert.equal(c.dictation.length,4);assert.equal(c.writing.length,3);
assert.equal(c.reading.lines.length,9);assert.deepEqual(lesson.reading.lines,c.reading.lines);
assert(c.reading.lines.every(l=>l.sv.length>20&&/[.!?]$/.test(l.sv)));
const sourceIds=new Set(c.sources.map(s=>s.id)),rules=c.sections.flatMap(s=>s.rules),ruleIds=new Set(rules.map(r=>r.id));
assert.equal(rules.length,33);assert.equal(ruleIds.size,33);
function localized(value,label){assert(value&&typeof value==='object',label);for(const lang of c.locales){assert.equal(typeof value[lang],'string',label+' '+lang);assert(value[lang].trim());if(['en','sv'].includes(lang))assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(value[lang]),label+': mixed language')}}
for(const a of c.letters){assert.equal(a.lower,a.upper.toLocaleLowerCase('sv-SE'));assert(a.name&&/^\[.+\]$/.test(a.nameIPA)&&a.sounds);assert(c.words[a.example]);localized(a.note,a.upper);assert(a.sources.every(id=>sourceIds.has(id)||id.startsWith('dictionary:')))}
for(const v of c.vowels){assert(v.long&&v.short&&v.examples.length);assert(v.sources.every(id=>sourceIds.has(id)))}
for(const r of rules){localized(r.title,r.id);localized(r.text,r.id);assert(r.sources.length&&r.sources.every(id=>sourceIds.has(id)));for(const w of r.examples)assert(c.words[w],w)}
for(const w of Object.values(c.words))localized(w.meaning,w.sv);
for(const row of c.cheatSheet)localized(row.text,row.label);
for(const line of c.reading.lines)for(const lang of ['sv','en','uk','ru'])assert(typeof line[lang]==='string'&&line[lang]);
const ids=new Set();for(const q of c.questions){assert(!ids.has(q.id));ids.add(q.id);localized(q.prompt,q.id);assert.equal(q.options.filter(o=>o.id===q.answerId).length,1);assert(q.ruleRefs.every(r=>ruleIds.has(r)||r==='reading'));for(const o of q.options){localized(o.text,q.id);localized(o.feedback,q.id)}for(const lang of c.locales)assert.equal(new Set(q.options.map(o=>o.text[lang])).size,q.options.length)}
const dictionary=JSON.parse(read('reports/alphabet-pronunciation/dictionary-checks.json'));
for(const w of new Set([...c.letters.map(l=>l.example),...rules.flatMap(r=>r.examples),...c.comparisons.flatMap(p=>[p.left,p.right]),...c.dictation.map(q=>q.answer)]))assert(dictionary[w]?.status.startsWith('checked'),'Unconfirmed example: '+w);
const events={},nodes={},spoken=[];let voices=[],cancelled=0;
const document={addEventListener(type,fn){(events[type]??=[]).push(fn)},querySelector:s=>s==='.alphabet-lesson'?{}:nodes[s]||null,querySelectorAll:()=>[]};
const window={addEventListener(type,fn){(events['window:'+type]??=[]).push(fn)},speechSynthesis:{cancel(){cancelled++},getVoices:()=>voices,speak(u){spoken.push(u)},addEventListener(){},removeEventListener(){}}};
const ctx={window,document,console,speechSynthesis:window.speechSynthesis,localStorage:{getItem(){return null},setItem(){throw Error('Formative content must not write storage')}},location:{},setTimeout,clearTimeout,URL,SpeechSynthesisUtterance:function(text){this.text=text}};
vm.createContext(ctx);vm.runInContext(read('locale-content.js'),ctx);vm.runInContext(read('alphabet-lesson.js'),ctx);vm.runInContext(read('app.js').replace(/\nboot\(\);/g,''),ctx);
const run=s=>vm.runInContext(s,ctx);
run(`LESSONS=${JSON.stringify(lessons)};state=defaultState();route='lesson';routeParam='lesson-1'`);
let branches=0;
for(const lang of ['ru','en','sv','uk']){
 run(`state.settings.language='${lang}'`);const stateBefore=run('JSON.stringify(state)'),dataBefore=run('JSON.stringify(LESSONS)');
 const html=run('renderLesson()');assert(html.includes('data-alphabet-lesson="alphabet-pronunciation-v1"'));assert.equal((html.match(/data-alphabet-kind=/g)||[]).length,29);assert.equal((html.match(/data-alphabet-choice=/g)||[]).length,28);assert.equal((html.match(/data-alphabet-dictation=/g)||[]).length,4);assert.equal((html.match(/<textarea /g)||[]).length,3);
 assert(html.includes('data-action="lesson-test" data-id="lesson-1"'));
 for(const a of c.letters){const button=html.match(new RegExp('<button[^>]*data-alphabet-audio="letter:'+a.upper+'"[^>]*>.*?</button>'))?.[0];assert(button,a.upper);assert(button.includes('alphabet-audio-icon'));assert(!button.includes('<span>'));assert(button.includes('aria-label=')&&button.includes('title='))}
 assert(/data-alphabet-stop hidden/.test(html),'Idle stop control should be hidden');
 assert(!html.includes('🇷🇺'));if(['en','sv'].includes(lang))assert(!/[А-Яа-яЁёІіЇїЄєҐґ]/.test(html.replace(/<[^>]*>/g,'')),lang+': Cyrillic leak');
 for(const r of rules)assert(html.includes(run(`esc(${JSON.stringify(r.text[lang])})`)));
 for(const line of c.reading.lines){assert(html.includes(run(`window.SVAlphabetLesson.highlight(${JSON.stringify(line.sv)})`)));if(lang!=='sv')assert(html.includes(run(`esc(${JSON.stringify(line[lang])})`)))}
 for(const q of c.questions){assert.equal(run(`window.SVAlphabetLesson.check('${q.id}','bogus')`),null);for(const o of q.options){const answer=run(`window.SVAlphabetLesson.check('${q.id}','${o.id}')`);assert.equal(answer.correct,o.id===q.answerId);branches++}}
 assert.equal(run(`window.SVAlphabetLesson.checkDictation('${c.dictation[0].id}','kök')`),null,'Unheard dictation graded');
 assert.equal(run('JSON.stringify(state)'),stateBefore);assert.equal(run('JSON.stringify(LESSONS)'),dataBefore);
}
assert(run("window.SVAlphabetLesson.summary(LESSONS[0].pronunciationChapter)").includes('28 / 32'));
// Actual delegated form submission and answer editing invalidate stale feedback.
const q=c.questions[0],out={innerHTML:'',textContent:''},form={dataset:{alphabetChoice:q.id},matches:()=>true,reportValidity:()=>true,querySelector:s=>s==='[data-alphabet-feedback]'?out:{value:q.answerId}};
const submit=events.submit.find(fn=>String(fn).includes('checkDictation'));let prevented=0;submit({target:form,preventDefault(){prevented++}});assert(prevented);assert(out.innerHTML.includes('success'));
const edit=events.input.find(fn=>String(fn).includes('alphabetChoice'));edit({target:{matches:()=>false,closest:()=>form,value:'o1'}});assert.equal(out.textContent,'');assert(run('window.SVAlphabetLesson.summary(LESSONS[0].pronunciationChapter)').includes('27 / 32'));
// Writing is escaped and account-scoped, and never saved into progress storage.
const write=events.input.find(fn=>String(fn).includes('alphabetWriting'));
write({target:{matches:()=>true,dataset:{alphabetWriting:c.writing[0].id},value:'<script>alert(1)</script>'}});
assert(run('renderLesson()').includes('&lt;script&gt;'));run("user={id:'other'}");assert(!run('renderLesson()').includes('&lt;script&gt;'));run('user=null');
(async()=>{
 const status={textContent:''};nodes['.alphabet-lesson [data-alphabet-audio-status]']=status;
 const stop={hidden:true},playIcon={hidden:false},stopIcon={hidden:true},attrs={},button={dataset:{alphabetAudio:'letter:D',alphabetAudioLabel:'Listen: D'},setAttribute(k,v){attrs[k]=v},querySelector:s=>s==='.alphabet-audio-play'?playIcon:stopIcon};
 document.querySelectorAll=s=>s==='.alphabet-lesson [data-alphabet-stop]'?[stop]:s==='.alphabet-lesson [data-alphabet-audio]'?[button]:[];

 const before=spoken.length;await run("window.SVAlphabetLesson.play('word:kök')");assert.equal(spoken.length,before);assert(status.textContent.includes('sv-SE'));
 voices=[{lang:'en-US',name:'English'}];await run("window.SVAlphabetLesson.play('word:kök')");assert.equal(spoken.length,before,'Foreign voice substituted');
 // A navigation during asynchronous voice discovery cancels the pending request.
 voices=[];const delayed=run("window.SVAlphabetLesson.play('word:kök')");
 events['window:hashchange'].find(fn=>String(fn).includes('audioPending'))();
 voices=[{lang:'sv-SE',name:'Swedish'}];await delayed;assert.equal(spoken.length,before,'Pending audio survived navigation');
 voices=[{lang:'sv-SE',name:'Swedish'}];await run("window.SVAlphabetLesson.play('reading')");let n=0;while(spoken[n]){const u=spoken[n++];assert.equal(u.lang,'sv-SE');assert.equal(u.voice.lang,'sv-SE');u.onend()}
 assert.deepEqual(spoken.map(u=>u.text),c.reading.lines.map(l=>l.sv),'Full-text playback lost or duplicated a sentence');
 // Every letter is isolated: no Swedish introductory phrase or word-name homographs.
 for(const a of c.letters){spoken.length=0;await run(`window.SVAlphabetLesson.play('letter:${a.upper}')`);assert.equal(spoken[0].text,a.upper==='W'?'dubbel-ve':a.upper);assert.equal(spoken[0].rate,1);assert.equal(stop.hidden,false);spoken[0].onend();assert.equal(stop.hidden,true)}
 const audioClick=events.click.find(fn=>String(fn).includes('activeToken'));
 const clickTarget={closest:s=>s==='.alphabet-lesson'?{}:s==='[data-alphabet-audio]'?button:null};
 spoken.length=0;audioClick({target:clickTarget});await Promise.resolve();assert.equal(spoken[0].text,'D');assert.equal(attrs['aria-pressed'],'true');assert.equal(playIcon.hidden,true);assert.equal(stopIcon.hidden,false);assert.equal(stop.hidden,false);
 audioClick({target:clickTarget});assert.equal(attrs['aria-pressed'],'false');assert.equal(stop.hidden,true);assert.equal(playIcon.hidden,false);assert.equal(stopIcon.hidden,true);spoken[0].onend();assert.equal(status.textContent,run('window.SVAlphabetLesson.labels().stopped'));
 spoken.length=0;await run("window.SVAlphabetLesson.play('letter:D')");spoken[0].onerror({error:'interrupted'});assert.equal(stop.hidden,true);assert.equal(attrs['aria-pressed'],'false');
 spoken.length=0;await run("window.SVAlphabetLesson.play('letter:D')");spoken[0].onerror({error:'synthesis-failed'});assert.equal(stop.hidden,true);assert.equal(status.textContent,run('window.SVAlphabetLesson.labels().failed'));

 spoken.length=0;await run(`window.SVAlphabetLesson.play('dictation:${c.dictation[0].id}')`);assert.equal(run(`window.SVAlphabetLesson.checkDictation('${c.dictation[0].id}','kök')`),null);spoken[0].onend();assert(run(`window.SVAlphabetLesson.checkDictation('${c.dictation[0].id}',' KÖK. ')`).correct);assert(!run(`window.SVAlphabetLesson.checkDictation('${c.dictation[0].id}','kok')`).correct);
 spoken.length=0;await run("window.SVAlphabetLesson.play('reading')");run('window.SVAlphabetLesson.stop()');spoken[0].onend();assert.equal(spoken.length,1,'Cancelled reading continued');
 assert(cancelled>0);
 console.log(`PASS: 29 letters, 33 sourced rules, 28 tasks × 4 locales / ${branches} branches, 9-sentence TTS contract, 29 isolated letter names, icon/stop states, strict sv-SE fallback, dictation gating, escaped account-scoped drafts, unchanged historical banks/XP/storage`);
})().catch(e=>{console.error(e);process.exitCode=1});
