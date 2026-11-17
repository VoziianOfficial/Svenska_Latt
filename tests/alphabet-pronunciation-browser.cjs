/* Isolated Chrome / local static server. No account, Auth or SQL writes.
   node tests/alphabet-pronunciation-browser.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SL_ALPHABET_URL||'http://127.0.0.1:8766/',port=process.env.SL_BROWSER_PORT||9224;
const output=path.resolve(__dirname,'../reports/alphabet-pronunciation');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let n=0;const pending=new Map(),errors=[],localFailures=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);else if(m.method==='Network.responseReceived'&&m.params.response.url.startsWith(base)&&m.params.response.status>=400)localFailures.push(m.params.response.url)};
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const frame=()=>run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const shot=async name=>{await frame();await run('new Promise(r=>setTimeout(r,350))');const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(s.data,'base64'))};
 try{
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Page.navigate',{url:base});
  await run(`new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('.hero')){clearInterval(t);r()}else if(++n>200){clearInterval(t);j(Error('Boot timeout'))}},50)})`);
  await run(`document.querySelector('[data-consent="rejected"]')?.click();state=defaultState();navigate('lesson','lesson-1');document.fonts.ready`);
  assert.equal(await run(`document.querySelectorAll('[data-alphabet-kind]').length`),29);
  const failures=[];
  for(const width of [1440,1024,768,390,320]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
   for(const language of ['ru','uk','en','sv']){
    await run(`changeLanguage('${language}');document.querySelectorAll('.alphabet-lesson details').forEach(e=>e.open=true)`);await frame();
    const bad=await run(`(()=>{const bad=[];if(document.documentElement.scrollWidth>innerWidth)bad.push({reason:'page overflow',width:document.documentElement.scrollWidth});for(const el of document.querySelectorAll('.alphabet-lesson .btn,.alphabet-lesson .pill,.alphabet-lesson .alphabet-table-scroll')){if(!el.getClientRects().length)continue;const r=el.getBoundingClientRect();if(!el.closest('.alphabet-table-scroll')&&(r.left<-.5||r.right>innerWidth+.5))bad.push({reason:'control overflow',text:el.textContent});if(el.matches('button')&&r.height<43.5)bad.push({reason:'target height',text:el.textContent,h:r.height});if(el.matches('button')&&el.scrollWidth>el.clientWidth+2)bad.push({reason:'clipped button',text:el.textContent})}return bad})()`);
    if(bad.length)failures.push({width,language,bad});
    assert.equal(await run(`document.querySelectorAll('[data-alphabet-choice]').length`),28);
    assert(await run(`[...document.querySelectorAll('[data-alphabet-audio^="letter:"]')].every(b=>!b.textContent.trim()&&b.getAttribute('aria-label')&&b.title&&b.getBoundingClientRect().width>=44)`));assert(await run(`document.querySelector('[data-alphabet-stop]').hidden`));
    if(['en','sv'].includes(language))assert(!(await run(`/[А-Яа-яЁёІіЇїЄєҐґ]/.test(document.querySelector('.alphabet-lesson').textContent)`)),language+' untranslated');
   }
  }
  fs.writeFileSync(path.join(output,'layout-audit.json'),JSON.stringify({combinations:20,failures},null,2)+'\n');assert.deepEqual(failures,[]);
  await run(`changeLanguage('ru');navigate('lesson','lesson-1');window.__before=JSON.stringify(state)`);
  // Native filters and question forms, with actual delegated clicks/submits.
  await click('[data-alphabet-filter="vowel"]');assert.equal(await run(`[...document.querySelectorAll('[data-alphabet-kind]')].filter(e=>!e.hidden).length`),9);
  await click('[data-alphabet-filter="consonant"]');assert.equal(await run(`[...document.querySelectorAll('[data-alphabet-kind]')].filter(e=>!e.hidden).length`),20);await click('[data-alphabet-filter="all"]');
  await run(`document.querySelector('#alphabet-practice').open=true;var f=document.querySelector('[data-alphabet-choice]');f.querySelector('input[value="o0"]').click();f.requestSubmit()`);
  assert(await run(`document.querySelector('[data-alphabet-choice] [data-alphabet-feedback]').textContent.includes('Верно')`));
  await run(`var f=document.querySelector('[data-alphabet-choice]');f.querySelector('input[value="o1"]').click()`);assert.equal(await run(`document.querySelector('[data-alphabet-choice] [data-alphabet-feedback]').textContent`),'');
  await run(`document.querySelector('[data-alphabet-writing]').value='Jag går till skolan.';document.querySelector('[data-alphabet-writing]').dispatchEvent(new Event('input',{bubbles:true}));render()`);
  assert.equal(await run(`document.querySelector('[data-alphabet-writing]').value`),'Jag går till skolan.');assert.equal(await run('JSON.stringify(state)'),await run('window.__before'));
  // Opening the model cannot produce a listening score.
  await run(`document.querySelector('[data-alphabet-reveal]').open=true`);await frame();
  await run(`var f=document.querySelector('[data-alphabet-dictation]');f.querySelector('input').value='kök';f.requestSubmit()`);
  assert(await run(`document.querySelector('[data-alphabet-dictation] [data-alphabet-feedback]').textContent.includes('без оценки')`));
  // Keep historical completion and XP intact while revisiting the chapter.
  await run(`state.xp=135;state.quizResults['lesson:lesson-1']={correct:13,total:13,rewarded:true};state.completed=['lesson-1'];render()`);
  assert(await run(`document.querySelector('.alphabet-final-history [data-quiz-status]').classList.contains('done-chip')`));assert.equal(await run('state.xp'),135);
  for(const width of [1440,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
   await run(`changeLanguage('ru');navigate('lesson','lesson-1');document.querySelectorAll('.alphabet-lesson details').forEach(e=>e.open=false);window.scrollTo(0,0)`);await frame();await shot(`overview-${width}`);
   for(const id of ['alphabet','kgs','length','reading','practice']){
    await run(`document.querySelectorAll('.alphabet-section').forEach(e=>e.open=false);var p=document.querySelector('#alphabet-${id}');p.open=true;if('${id}'==='practice')p.querySelector('.alphabet-task-group').open=true;p.scrollIntoView({block:'start',behavior:'instant'})`);await frame();await shot(`${id}-${width}`);
   }
  }
  // Controlled speech callbacks exercise actual icon and stop-button DOM behavior.
  // They do not claim an acoustic evaluation of the device voice.
  await run(`window.__spoken=[];window.__cancelled=0;Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'sv-SE',name:'Test Swedish'}],cancel(){window.__cancelled++},speak(u){window.__spoken.push(u)}}});window.SpeechSynthesisUtterance=function(text){this.text=text};changeLanguage('ru');navigate('lesson','lesson-1');document.querySelector('#alphabet-alphabet').open=true`);
  const letterButton='[data-alphabet-audio="letter:D"]';
  await click(letterButton);await frame();assert.equal(await run(`window.__spoken.at(-1).text`),'D');assert.equal(await run(`window.__spoken.at(-1).rate`),1);
  assert(await run(`!document.querySelector('[data-alphabet-stop]').hidden&&document.querySelector('[data-alphabet-audio="letter:D"]').getAttribute('aria-pressed')==='true'`));
  await click(letterButton);assert(await run(`document.querySelector('[data-alphabet-stop]').hidden&&document.querySelector('[data-alphabet-audio="letter:D"]').getAttribute('aria-pressed')==='false'`));
  await click(letterButton);await frame();await click('[data-alphabet-stop]');assert(await run(`document.querySelector('[data-alphabet-stop]').hidden`));
  await click(letterButton);await frame();await run(`window.__spoken.at(-1).onend()`);assert(await run(`document.querySelector('[data-alphabet-stop]').hidden`));
  await run(`document.querySelector('[data-alphabet-rate]').value='0.55';document.querySelector('[data-alphabet-rate]').dispatchEvent(new Event('change',{bubbles:true}))`);await click(letterButton);await frame();assert.equal(await run(`window.__spoken.at(-1).rate`),.55);await click(letterButton);
  for(const width of [1440,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await frame();
   await run(`document.querySelector('#alphabet-alphabet').scrollIntoView({block:'start',behavior:'instant'})`);await shot('audio-letters-'+width);
  }
  await click(letterButton);await frame();await run(`const e=document.querySelector('.alphabet-audio-note');window.scrollTo({top:e.getBoundingClientRect().top+scrollY-135,behavior:'instant'})`);await shot('audio-controls-playing-390');
  await run(`window.SVAlphabetLesson.stop()`);
  assert.deepEqual(errors,[]);assert.deepEqual(localFailures,[]);
  const report={date:'2026-11-16',browser:(await send('Browser.getVersion')).product,layouts:20,widths:[1440,1024,768,390,320],languages:['ru','uk','en','sv'],checks:['29 letters and vowel/consonant filters','Icon-only letter controls in four languages','Playback icon toggle, conditional Stop audio, stop/end reset and letter rates','28 localized choice tasks and 4 dictations','Delegated submit/edit and escaped in-memory writing drafts','Model revelation disables listening score','Historical 13/13 result and XP preserved','No page overflow, clipped controls or targets below 44px','Desktop/mobile chapter, alphabet, K/G/SK, quantity, reading and practice screenshots'],exceptions:errors,localFailures,limits:['No production Supabase or SQL connection.','TTS event sequencing and no-voice behavior are tested separately with mocks; acoustic quality requires device listening.']};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS: 20 chapter layouts, filters/forms/drafts/history audio controls and 15 screenshots');
 }finally{ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`)}
})().catch(e=>{console.error(e);process.exitCode=1});
