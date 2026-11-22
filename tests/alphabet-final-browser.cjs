/* Isolated Chrome + local server only. Real DOM clicks, guest storage, no SQL/Auth. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SL_ALPHABET_URL||'http://127.0.0.1:8766/',port=process.env.SL_BROWSER_PORT||9224;
const output=path.resolve(__dirname,'../reports/alphabet-pronunciation');
(async()=>{
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let n=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}))});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const frame=()=>run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const click=selector=>run(`document.querySelector(${JSON.stringify(selector)}).click()`);
 const settle=()=>run('new Promise(r=>setTimeout(r,350))');
 const shot=async name=>{await frame();await settle();const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(s.data,'base64'))};
 const waitQuiz=()=>run(`new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('.quiz-card')){clearInterval(t);r()}else if(++n>200){clearInterval(t);j(Error('Quiz timeout'))}},30)})`);
 try{
  await send('Page.enable');await send('Runtime.enable');await send('Page.navigate',{url:base});
  await run(`new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(document.querySelector('.hero')){clearInterval(t);r()}else if(++n>200){clearInterval(t);j(Error('Boot timeout'))}},50)})`);
  await run(`document.querySelector('[data-consent="rejected"]')?.click();resetQuiz();state=defaultState();navigate('lesson','lesson-1')`);
  assert(await run(`document.querySelector('.alphabet-lesson').lastElementChild.classList.contains('alphabet-final-test')`));
  let layouts=0;const failures=[];
  for(const width of [1440,1024,768,390,320]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
   await settle();
   for(const lang of ['ru','en','sv','uk']){
    await run(`resetQuiz();changeLanguage('${lang}');startQuiz('lesson','lesson-1')`);
    for(let i=0;i<20;i++){
     await run(`quiz.index=${i};quiz.answered=true;quiz.selected=quiz.questions[${i}].options.find(o=>o!==quiz.questions[${i}].answer);quiz.latest=false;render();document.querySelectorAll('.quiz-card details').forEach(d=>d.open=true)`);await frame();
     const bad=await run(`(()=>{const bad=[];if(document.documentElement.scrollWidth>innerWidth)bad.push('page overflow');for(const e of document.querySelectorAll('.quiz-card button,.quiz-card .alphabet-final-reading')){const r=e.getBoundingClientRect();if(e.getClientRects().length&&(r.left<-.5||r.right>innerWidth+.5))bad.push('overflow: '+e.textContent);if(e.matches('button')&&e.getClientRects().length&&(r.height<43.5||e.scrollWidth>e.clientWidth+2))bad.push('target/text: '+e.textContent)}return bad})()`);
     if(bad.length)failures.push({width,lang,index:i,bad});layouts++;
    }
   }
  }
  fs.writeFileSync(path.join(output,'final-layout-audit.json'),JSON.stringify({layouts,failures},null,2)+'\n');assert.deepEqual(failures,[]);
  // A historical pass is visible only as history, not as a new final-test pass.
  await run(`resetQuiz();state=defaultState();state.xp=135;state.completed=['lesson-1'];state.quizResults['lesson:lesson-1']={correct:13,total:13,rewarded:true};changeLanguage('ru');navigate('lesson','lesson-1')`);
  assert(!(await run(`document.querySelector('[data-alphabet-final-status] [data-quiz-status]').classList.contains('done-chip')`)));
  await click('[data-alphabet-final-launch]');await waitQuiz();assert.equal(await run('quiz.questions.length'),20);
  const wrong=[3,7,10,14];
  for(let i=0;i<20;i++){
   await run(`(()=>{const q=quiz.questions[quiz.index];[...document.querySelectorAll('.quiz-option')].find(b=>b.dataset.choice===${wrong.includes(i)?'q.options.find(o=>o!==q.answer)':'q.answer'}).click()})()`);
   assert(await run('quiz.answered'));
   if(i===3){
    await run(`document.querySelector('.alphabet-final-rule-links details').open=true`);await click('[data-alphabet-review-rule]');assert.equal(await run('route'),'lesson');assert.equal(await run('quiz.index'),3);assert(await run(`document.querySelector('#alphabet-kgs').open`));await frame();assert(await run(`(()=>{const e=document.activeElement,r=e.getBoundingClientRect();return e.id.startsWith('alphabet-rule-')&&r.top>=0&&r.top<innerHeight})()`));
    await click('.alphabet-final-launch[data-nav="practice"]');assert.equal(await run('route'),'practice');assert.equal(await run('quiz.index'),3);
   }
   if(i===7){
    await run(`changeLanguage('uk');persistQuizSession()`);const before=await run('JSON.stringify([quiz.index,quiz.score,quiz.selected])');
    await send('Page.reload',{ignoreCache:true});await waitQuiz();assert.equal(await run('JSON.stringify([quiz.index,quiz.score,quiz.selected])'),before);await run(`changeLanguage('ru')`);
   }
   await click('[data-action="quiz-next"]');
  }
  assert(await run('quiz.finished'));assert.equal(await run('quiz.score'),16);assert.equal(await run('state.xp'),135);assert.equal(await run(`state.quizResults['lesson:lesson-1'].total`),13);assert.equal(await run(`state.quizResults['assessment:alphabet-final-v1'].correct`),16);
  for(const width of [1440,390]){await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await run('window.scrollTo(0,0)');await shot('final-result-'+width)}
  await click('[data-action="quiz-retry"]');assert.equal(await run('quiz.index'),0);
  for(let i=0;i<20;i++){await run(`(()=>{const q=quiz.questions[quiz.index];[...document.querySelectorAll('.quiz-option')].find(b=>b.dataset.choice===q.answer).click()})()`);await click('[data-action="quiz-next"]')}
  assert(await run('quiz.finished'));assert.equal(await run('quiz.score'),20);assert.equal(await run('state.xp'),135);
  for(const width of [1440,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
   await run(`resetQuiz();navigate('lesson','lesson-1');document.querySelectorAll('.alphabet-section').forEach(d=>d.open=false)`);await frame();
   await run(`document.querySelector('#alphabet-final-test').scrollIntoView({block:'start',behavior:'instant'})`);await shot('final-panel-'+width);
   await run(`startQuiz('lesson','lesson-1');quiz.index=17;render();window.scrollTo(0,0)`);await shot('final-reading-'+width);
  }
  assert.deepEqual(errors,[]);const report={date:'2026-11-16',passed:true,layouts,questions:20,formativeTasks:35,realCompletedAttempts:[{score:16,total:20,xpBefore:135,xpAfter:135},{score:20,total:20,xpBefore:135,xpAfter:135}],checks:['All 20 questions and full feedback at 5 widths × 4 locales','Final test follows all learning sections','Historical result is separate from final result','Real delegated answer/next/finish/retry clicks','Rule review and return preserve attempt','Locale switch and page reload preserve selected answer/index/score','Historical XP and 13/13 retained; no repeated reward'],limits:['Guest browser flow; account/queue paths use separate RPC-model tests','SQL proposal not applied']};fs.writeFileSync(path.join(output,'final-verification.json'),JSON.stringify(report,null,2)+'\n');console.log('PASS: '+layouts+' layouts, two complete real 20-question attempts, review/return, locale/reload, separate results and XP; 6 screenshots');
 }finally{ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`)}
})().catch(e=>{console.error(e);process.exitCode=1});
