/* Full-page speed wiring, plus a separate muted native-engine duration check. */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.SL_ALPHABET_URL||'http://127.0.0.1:8766/',port=process.env.SL_BROWSER_PORT||9224;
(async()=>{
 const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 const ws=new WebSocket(tab.webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});
 let id=0;const pending=new Map(),errors=[];
 ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}else if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails)};
 const send=(method,params={})=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});ws.send(JSON.stringify({id,method,params}))});
 const run=async expression=>{const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 const frame=()=>run('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
 const pick=async(selector,value)=>{
  await frame();await run(`(()=>{const s=document.querySelector('${selector}');window.__speedLabel=[...s.options].find(o=>o.value==='${value}').textContent;s.parentElement.querySelector('button.custom-select').click();[...document.querySelectorAll('.select-menu-option')].find(o=>o.textContent===window.__speedLabel).click()})()`);
  assert.equal(await run(`document.querySelector('${selector}').value`),value);
 };
 const boot=async()=>{
  await send('Page.navigate',{url:base});
  await run(`new Promise((r,j)=>{let n=0;const t=setInterval(()=>{if(window.SVGreetingsLesson&&document.querySelector('.hero')){clearInterval(t);r()}else if(++n>200){clearInterval(t);j(Error('Boot timeout'))}},30)})`);
  await run(`document.querySelector('[data-consent="rejected"]')?.click();state=defaultState();resetQuiz()`);
 };
 try{
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');await send('Network.setBypassServiceWorker',{bypass:true});await boot();
  // Keep native synthesis available for the duration measurements below.
  await run(`window.__nativeSpeech=window.speechSynthesis;window.__nativeUtterance=window.SpeechSynthesisUtterance;window.__spoken=[];Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{getVoices:()=>[{lang:'sv-SE',name:'Test Swedish'}],cancel(){},speak(u){window.__spoken.push(u)}}});window.SpeechSynthesisUtterance=function(text){this.text=text}`);
  const wiring=[];
  for(const language of ['ru','uk','en','sv'])for(const [lesson,attr] of [['lesson-1','alphabet'],['lesson-2','greet']]){
   await run(`changeLanguage('${language}');navigate('lesson','${lesson}');window.__progressBefore=JSON.stringify(state)`);
   for(const rate of [1,.55]){
    await pick(`[data-${attr}-rate]`,String(rate===1?1:'0.55'));
    const result=await run(`(async()=>{
     const tokens=[...new Set([...document.querySelectorAll('[data-${attr}-audio]')].map(b=>b.dataset.${attr}Audio))];let segments=0;
     for(const token of tokens){window.__spoken=[];const button=[...document.querySelectorAll('[data-${attr}-audio]')].find(b=>b.dataset.${attr}Audio===token);button.click();await Promise.resolve();await Promise.resolve();if(!window.__spoken.length)throw Error('No speech: '+token);let i=0;while(i<window.__spoken.length){if(i>100)throw Error('Endless speech');const u=window.__spoken[i++];if(u.rate!==${rate})throw Error(token+': rate '+u.rate);u.onend?.()}segments+=i}
     return {tokens:tokens.length,segments,progressUnchanged:JSON.stringify(state)===window.__progressBefore};
    })()`);
    assert(result.progressUnchanged);wiring.push({language,lesson,rate,...result});
   }
  }
  // The shared player serves other lessons, books, dictionary and flashcards.
  const shared=[];
  for(const language of ['ru','uk','en','sv']){
   await run(`changeLanguage('${language}');navigate('book',BOOKS[0].id)`);
   for(const [speed,rate] of [['normal',1],['slow',.55],['verySlow',.4]]){
    await pick('.speech-speed-select',speed);
    const result=await run(`(()=>{window.__spoken=[];document.querySelector('[data-action="speak"]').click();let i=0;while(i<window.__spoken.length){if(i>100)throw Error('Endless speech');const u=window.__spoken[i++];if(u.rate!==${rate})throw Error('Shared player rate '+u.rate);u.onend?.()}if(!i)throw Error('No shared speech');return {segments:i,saved:localStorage.getItem('svenska-latt-speech-speed')}})()`);
    assert.equal(result.saved,speed);shared.push({language,speed,rate,...result});
    for(const route of ['dictionary','flashcards']){
     await run(`navigate('${route}')`);await frame();
     const observed=await run(`(()=>{window.__spoken=[];const b=document.querySelector('[data-action="speak"]');if(!b)throw Error('No speak button on ${route}');b.click();return window.__spoken[0]?.rate})()`);
     assert.equal(observed,rate,route);await run(`speechSynthesis.cancel()`);
    }
    await run(`navigate('book',BOOKS[0].id)`);
   }
  }
  // Setting names and persisted user preferences stay compatible after reload.
  await boot();await run(`navigate('book',BOOKS[0].id)`);await frame();assert.equal(await run(`document.querySelector('.speech-speed-select').value`),'verySlow');
  await pick('.speech-speed-select','normal');
  // Native sv-SE voice, original player, muted output, actual onstart/onend events.
  const native=await run(`(async()=>{const api=window.speechSynthesis;let voices=api.getVoices();if(!voices.length){await new Promise(r=>setTimeout(r,1600));voices=api.getVoices()}const voice=voices.find(v=>v.lang.toLowerCase()==='sv-se');window.__nativeVoice=voice;return {voice:voice?{name:voice.name,lang:voice.lang,localService:voice.localService}:null}})()`);
  native.samples=[];
  if(native.voice){
   await run(`window.__engineSpeak=speechSynthesis.speak.bind(speechSynthesis);speechSynthesis.speak=u=>{u.volume=0;u.voice=window.__nativeVoice;u.addEventListener('start',()=>window.__nativeStart=performance.now());u.addEventListener('end',()=>window.__nativeResolve({rate:u.rate,milliseconds:Math.round(performance.now()-window.__nativeStart)}));u.addEventListener('error',e=>window.__nativeResolve({rate:u.rate,error:e.error}));window.__engineSpeak(u)}`);
   for(const speed of ['normal','slow','normal','slow']){
    await pick('.speech-speed-select',speed);
    native.samples.push(await run(`new Promise(resolve=>{const timer=setTimeout(()=>{speechSynthesis.cancel();resolve({error:'timeout'})},25000);window.__nativeResolve=result=>{clearTimeout(timer);resolve(result)};speak('Hej! Jag heter Anna och jag bor i Sverige. Jag talar lite svenska. Hur mår du i dag?')})`));
   }
   assert(native.samples.every(s=>s.milliseconds>0),'Native voice failed: '+JSON.stringify(native));
   // Warm-up can skew the first sample; compare the second complete pair.
   native.slowToNormalRatio=+(native.samples[3].milliseconds/native.samples[2].milliseconds).toFixed(2);
   assert(native.slowToNormalRatio>1.15,'Native slow speech is not measurably slower: '+JSON.stringify(native));
  }
  assert.deepEqual(errors,[]);
  const report={date:'2026-11-17',wiring,shared,native,errors,limits:['Native measurement uses muted speech events, not an acoustic pronunciation review.','No production publishing or SQL execution.']};
  fs.writeFileSync(path.resolve(__dirname,'../reports/greetings-introduction/speech-speed-verification.json'),JSON.stringify(report,null,2)+'\n');
  console.log(`PASS: ${wiring.length} chapter/language/rate paths, all audio tokens and queued segments; shared book/dictionary/flashcards speeds, persistence; native slow/normal duration ratio ${native.slowToNormalRatio??'unavailable (no sv-SE voice)'}`);
 }finally{ws.close();await fetch(`http://127.0.0.1:${port}/json/close/${tab.id}`)}
})().catch(e=>{console.error(e);process.exitCode=1});
