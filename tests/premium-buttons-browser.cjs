/* Real browser acceptance for the semantic button system. Uses an isolated
   Chrome debug session and a local server; no account or Supabase writes.
   SL_BROWSER_PORT=9224 SL_BUTTONS_URL=http://127.0.0.1:8766/ node tests/premium-buttons-browser.cjs */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const port=process.env.SL_BROWSER_PORT||9224,base=process.env.SL_BUTTONS_URL||'http://127.0.0.1:8766/';
const output=path.resolve(__dirname,'../reports/buttons');fs.mkdirSync(output,{recursive:true});
(async()=>{
 const target=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 const ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject});
 let sequence=0;const pending=new Map(),errors=[],localFailures=[];
 ws.onmessage=event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}
  else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
  else if(m.method==='Network.responseReceived'&&m.params.response.url.startsWith(base)&&m.params.response.status>=400)localFailures.push(m.params.response.url);
 };
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++sequence,{resolve,reject});ws.send(JSON.stringify({id:sequence,method,params}))});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const frame=()=>run('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
 const click=selector=>run(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing control: '+${JSON.stringify(selector)});e.click()})()`);
 const shot=async name=>{await frame();const s=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(output,name+'.png'),Buffer.from(s.data,'base64'))};
 const checks=[];
 try {
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  // Prevent Chrome's own install promotion from opening a native dialog.
  await send('Page.addScriptToEvaluateOnNewDocument',{source:`window.addEventListener('beforeinstallprompt',e=>{if(e.isTrusted){e.preventDefault();e.stopImmediatePropagation()}},true)`});
  await send('Page.navigate',{url:base});
  await run(`new Promise((resolve,reject)=>{let n=0;const timer=setInterval(()=>{if(document.querySelector('.hero')){clearInterval(timer);resolve(true)}else if(++n>250){clearInterval(timer);reject(Error('Boot timeout'))}},80)})`);
  await run(`document.querySelector('[data-consent="rejected"]')?.click();document.fonts.ready`);
  const routes=[['home',''],['lessons','A'],['lesson','lesson-1'],['dictionary',''],['word','v-arbeta'],['flashcards',''],['practice',''],['videos',''],['books',''],['book','book-1'],['profile',''],['alphabet',''],['numbers',''],['cheats',''],['reviews',''],['topics',''],['topic','Семья'],['rules','']];
  const layoutFailures=[];let combinations=0;
  for(const width of [1440,1024,768,390,320]) {
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
   for(const lang of ['ru','uk','en','sv']) {
    await run(`changeLanguage('${lang}')`);
    for(const [route,param] of routes) {
     await run(`navigate(${JSON.stringify(route)},${JSON.stringify(param)})`);await frame();
     const result=await run(`(()=>{
      const selectors='.btn,.pill,.circle-btn,.sound-btn,.slider-arrow,.speech-stop,.pwa-install,.hamburger,.quiz-option,.quiz-word,.learning-v2-option,.back-link,.reference-feature-footer button,.mode-card,button.custom-select';
      const bad=[];for(const e of document.querySelectorAll(selectors)){
       if(!e.getClientRects().length||e.closest('.sidebar:not(.open)')&&innerWidth<=1080)continue;
       const r=e.getBoundingClientRect(),scroller=e.closest('.action-grid,.course-tiles,.premium-topics');
       if(r.height<43.5)bad.push({reason:'target height',class:e.className,height:r.height});
       if(!scroller&&(r.left<-.5||r.right>innerWidth+.5))bad.push({reason:'horizontal overflow',class:e.className,left:r.left,right:r.right});
       if(!e.disabled&&getComputedStyle(e).backgroundColor===getComputedStyle(e).color)bad.push({reason:'text contrast',class:e.className});
       if(getComputedStyle(e).backgroundImage.includes('gradient'))bad.push({reason:'control gradient',class:e.className});
       if(e.matches('.circle-btn,.slider-arrow,button.speak-icon-only')&&r.width<43.5)bad.push({reason:'icon target width',class:e.className,width:r.width});
       if(e.scrollWidth>e.clientWidth+2)bad.push({reason:'clipped text',class:e.className,scroll:e.scrollWidth,client:e.clientWidth});
      }
      const pwas=[...document.querySelectorAll('[data-pwa-install]')].filter(e=>e.getClientRects().length);
      if(pwas.length!==1)bad.push({reason:'PWA visibility',count:pwas.length});
      if(document.documentElement.scrollWidth>innerWidth)bad.push({reason:'page overflow'});
      return {bad,buttons:document.querySelectorAll(selectors).length};
     })()`);
     if(result.bad.length)layoutFailures.push({width,lang,route,...result});combinations++;
    }
   }
  }
  fs.writeFileSync(path.join(output,'layout-audit.json'),JSON.stringify({combinations,failures:layoutFailures},null,2)+'\n');
  assert.equal(layoutFailures.length,0,'Layout failures: '+JSON.stringify(layoutFailures.slice(0,8).map(x=>({...x,bad:x.bad.slice(0,3)}))));
  checks.push(`${combinations} route/width/language layouts; 44px targets, text containment, one PWA action, no page/control overflow`);

  // Exercise the actual mobile drawer, navigation and level tabs.
  await send('Emulation.setDeviceMetricsOverride',{width:390,height:1000,deviceScaleFactor:1,mobile:false});
  await run(`navigate('home')`);await click('#menu-toggle');assert(await run(`document.querySelector('#app').classList.contains('nav-open')`));
  await click('#sidebar-nav [data-nav="lessons"]');assert.equal(await run('route'),'lessons');assert(await run(`!document.querySelector('#app').classList.contains('nav-open')`));
  await click('[data-action="level"][data-level="B"]');assert.equal(await run('selectedLevel'),'B');
  await click('#bottom-menu-open');assert(await run(`document.querySelector('#app').classList.contains('nav-open')`));await click('#drawer-close');
  assert(await run(`!document.querySelector('#app').classList.contains('nav-open')`));checks.push('Mobile hamburger, sidebar destination, bottom menu, close and SFI tabs');

  // Exercise real event delegation, without altering question data or scoring.
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await run(`changeLanguage('ru');navigate('home')`);await click('.hero .btn.white');
  assert.equal(await run('route'),'lesson');await click('.back-link');assert.equal(await run('route'),'lessons');
  await click('.lesson-foot .btn');assert.equal(await run('route'),'lesson');
  await click('[data-action="lesson-test"]');
  await run(`new Promise(resolve=>{const timer=setInterval(()=>{if(quiz.active){clearInterval(timer);resolve()}},10)})`);
  const lessonQuestions=await run('quiz.questions.length');assert(lessonQuestions>0);
  for(let i=0;i<lessonQuestions;i++){
   const kind=await run('quiz.questions[quiz.index].type');
   if(kind==='choice')await run(`(()=>{const q=quiz.questions[quiz.index];[...document.querySelectorAll('.quiz-option')].find(e=>e.dataset.choice===q.answer).click()})()`);
   else if(kind==='type'||kind==='listen')await run(`(()=>{const input=document.querySelector('#quiz-text-input');input.value=quiz.questions[quiz.index].answer;input.dispatchEvent(new Event('input',{bubbles:true}));input.form.requestSubmit()})()`);
   else await run('submitAnswer(quiz.questions[quiz.index].answer)');
   assert(await run('quiz.answered'),'answer not submitted');await click('[data-action="quiz-next"]');
  }
  assert(await run('quiz.finished'));checks.push(`Lesson start, ${lessonQuestions} answers, next/finish and return navigation`);
  await run(`resetQuiz();navigate('practice')`);await click('[data-mode="writeWord"]');
  await run(`new Promise(resolve=>{const timer=setInterval(()=>{if(document.querySelector('#quiz-input-form')){clearInterval(timer);resolve()}},10)})`);
  await run(`(()=>{const input=document.querySelector('#quiz-text-input');input.value=quiz.questions[quiz.index].answer;input.dispatchEvent(new Event('input',{bubbles:true}));input.form.requestSubmit()})()`);
  assert(await run('quiz.answered&&quiz.latest'));await click('[data-action="stop-quiz"]');checks.push('Written answer uses the existing form submit and correct feedback');

  await run(`navigate('word','v-arbeta')`);const favorite=await run(`state.favorites.includes('v-arbeta')`);
  await click('[data-action="favorite"]');assert.notEqual(await run(`state.favorites.includes('v-arbeta')`),favorite);
  await click('[data-action="favorite"]');assert.equal(await run(`state.favorites.includes('v-arbeta')`),favorite);
  const learned=await run(`state.known.includes('v-arbeta')`);await click('[data-action="mark-known"]');assert.notEqual(await run(`state.known.includes('v-arbeta')`),learned);if(learned)await click('[data-action="mark-known"]');checks.push('Favorite toggle and learned action with existing guest progress');
  await run(`navigate('flashcards')`);const index=await run('flash.index');await click('[data-action="flash-next"]');assert.notEqual(await run('flash.index'),index);await click('[data-action="flash-prev"]');assert.equal(await run('flash.index'),index);
  await click('.flash-card');assert(await run('flash.flipped'));checks.push('Flashcard next, previous and flip');

  // Existing speech API is replaced only in this isolated test page.
  await run(`window.__speechCalls=0;window.__speak=speak;speak=()=>window.__speechCalls++;navigate('word','v-arbeta')`);await click('[data-action="speak"]');assert.equal(await run('window.__speechCalls'),1);await run('speak=window.__speak');checks.push('Audio button reaches the existing pronunciation handler (speech output not audited)');
  await run(`navigate('videos')`);
  assert(await run(`(()=>{const a=document.querySelector('a.video-watch-link');return !!a&&a.target==='_blank'&&a.href.startsWith('https://')&&a.querySelector('svg')})()`));
  await click('[data-action="video-quiz"]');assert(await run('quiz.active'));await click('[data-action="stop-quiz"]');checks.push('Video external destination and video quiz start');
  await run(`navigate('profile')`);await click('[data-action="activity-month"][data-step="-1"]');assert(await run(`!!document.querySelector('[data-action="activity-current"]')`));await click('[data-action="activity-current"]');checks.push('Calendar previous month and current-month reset');

  // Mock the auth transport only. Production UI and submit locks remain real.
  await run(`window.__auth=window.SVAuth;window.__authCalls=0;window.SVAuth={...window.__auth,signIn:()=>{window.__authCalls++;return new Promise((resolve,reject)=>window.__releaseAuth=()=>reject(Error('isolated UI test')))}};openAuth('login');document.querySelector('#auth-email').value='buttons@example.invalid';document.querySelector('#auth-pass').value='test-only';document.querySelector('#auth-form').requestSubmit()`);
  assert(await run(`document.querySelector('#auth-submit').disabled&&document.querySelector('#auth-form').getAttribute('aria-busy')==='true'`));
  await run(`document.querySelector('#auth-form').requestSubmit()`);assert.equal(await run('window.__authCalls'),1);
  await run('window.__releaseAuth();new Promise(resolve=>setTimeout(resolve,0))');assert(await run(`!document.querySelector('#auth-submit').disabled`));
  await click('.auth-link');assert.equal(await run(`document.querySelector('#auth-form').dataset.mode`),'register');await click('#close-modal');assert(await run(`document.querySelector('#modal-backdrop').classList.contains('hidden')`));await run('window.SVAuth=window.__auth');checks.push('Login/register modal, pending lock, error recovery, switch and close; auth transport mocked, no live account');

  await run(`navigate('home')`);
  await run(`document.querySelectorAll('[data-pwa-install]')[0].click()`);assert(await run(`document.querySelector('#pwa-install-dialog').open`));await click('.pwa-dialog-close');assert(await run(`!document.querySelector('#pwa-install-dialog').open`));
  await run(`window.__promptCalls=0;window.__choice=new Promise(r=>window.__chooseInstall=r);const e=new Event('beforeinstallprompt',{cancelable:true});e.prompt=()=>{window.__promptCalls++;return Promise.resolve()};e.userChoice=window.__choice;window.dispatchEvent(e);document.querySelector('[data-pwa-install]').click();document.querySelector('[data-pwa-install]').click()`);
  assert.equal(await run('window.__promptCalls'),1);assert(await run(`[...document.querySelectorAll('[data-pwa-install]')].every(e=>e.disabled)`));
  await run(`window.__chooseInstall({outcome:'dismissed'});new Promise(r=>setTimeout(r,0))`);checks.push('PWA instructions and close, native-prompt event contract, repeated-click lock; actual OS install not performed');

  // Real key focus, hover and press, stable busy dimensions, reduced motion.
  await run(`navigate('home');document.activeElement?.blur()`);
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9});
  assert(await run(`parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3`));
  await run(`document.querySelector('.hero .btn.white').focus()`);const rect=await run(`document.querySelector('.hero .btn.white').getBoundingClientRect().toJSON()`);
  const normal=await run(`getComputedStyle(document.querySelector('.hero .btn.white')).backgroundColor`);
  await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+20,y:rect.y+20});await run('new Promise(r=>setTimeout(r,180))');const hover=await run(`getComputedStyle(document.querySelector('.hero .btn.white')).backgroundColor`);assert.notEqual(hover,normal);
  await send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:rect.x+20,y:rect.y+20});await run('new Promise(r=>setTimeout(r,180))');const active=await run(`getComputedStyle(document.querySelector('.hero .btn.white')).backgroundColor`);assert.notEqual(active,hover);
  // Move off the button before release to avoid navigation.
  await send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:1,y:1});
  await run(`navigate('home');const b=document.querySelector('.hero .btn.white');window.__before=b.getBoundingClientRect().toJSON();b.setAttribute('aria-busy','true');window.__blocked=0;b.addEventListener('click',()=>window.__blocked++);b.click()`);
  assert.equal(await run('window.__blocked'),0);assert.equal(await run(`document.querySelector('.hero .btn.white').getBoundingClientRect().width`),await run('window.__before.width'));
  await run(`document.querySelector('.hero .btn.white').removeAttribute('aria-busy')`);
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});assert.equal(await run(`getComputedStyle(document.querySelector('.hero .btn.white')).transitionDuration`),'0s');await send('Emulation.setEmulatedMedia',{features:[]});checks.push('Keyboard focus ring, desktop hover/active, unchanged busy width, busy click guard and reduced motion');

  for(const width of [1440,390]){
   await send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
   for(const [route,param] of [['home',''],['lessons','A'],['word','v-arbeta'],['flashcards',''],['practice',''],['profile','']]){
    await run(`resetQuiz();changeLanguage('ru');navigate('${route}','${param}')`);await run('new Promise(r=>setTimeout(r,200))');await frame();
    await run(`Promise.all([...document.querySelectorAll('.lesson-photo')].slice(0,3).map(e=>e.decode().catch(()=>{})))`);
    await shot(`${route}-${width}`);
   }
   await run(`navigate('practice');startQuiz('translation')`);await frame();await shot(`quiz-${width}`);await run('resetQuiz()');
   await run(`navigate('profile');openAuth('login')`);await shot(`auth-${width}`);await click('#close-modal');
   await run(`document.querySelector('[data-pwa-install]:not([hidden])').click()`);await shot(`pwa-${width}`);await click('.pwa-dialog-close');
   // Render the existing destructive confirmation without invoking its submit.
   await run(`window.__designUser=user;window.__designCloud=cloudAccount;user={id:'button-design-test'};cloudAccount=()=>true;openAccountDeletion()`);
   assert.equal(await run(`getComputedStyle(document.querySelector('#delete-account-submit')).backgroundColor`),'rgb(145, 67, 67)');
   assert(await run(`document.querySelector('#delete-account-submit').disabled`));await shot(`danger-${width}`);
   await click('[data-action="cancel-delete-account"]');await run(`user=window.__designUser;cloudAccount=window.__designCloud`);
  
  }
  assert.equal(errors.length,0,JSON.stringify(errors));assert.equal(localFailures.length,0,JSON.stringify(localFailures));
  const report={date:'2026-11-09',browser:(await send('Browser.getVersion')).product,combinations,widths:[1440,1024,768,390,320],languages:['ru','uk','en','sv'],checks,exceptions:errors,localFailures,limits:['Live Supabase login/signup and account deletion were not performed. Auth transport was mocked.','Audio dispatch was tested; Swedish speech quality requires a device with a Swedish voice.','PWA instructions and synthetic prompt lifecycle were tested; actual OS installation was not performed.']};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log('PASS: '+combinations+' layouts and '+checks.length+' functional/state groups. Screenshots and results: reports/buttons/');
 } finally {ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(()=>{})}
})().catch(error=>{console.error(error);process.exitCode=1});
