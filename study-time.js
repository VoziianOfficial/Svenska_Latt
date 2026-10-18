/* Account study time: user preferences, server leases and durable interval receipts. */
'use strict';
(() => {
 const IDLE=90000,READ_IDLE=300000,AUDIO_LIMIT=1200000,MAX_GAP=2500;
 const learning=new Set(['lesson','book','word','word-review','dictionary','flashcards','practice','reviews','topic','rules','cheats','numbers','alphabet']);
 const reading=new Set(['lesson','book','rules','cheats']);
 const integer=n=>Number.isSafeInteger(n)&&n>=0;
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function activeUntil({route,lastInput,audioUntil=0}){return Math.max(lastInput+(reading.has(route)?READ_IDLE:IDLE),audioUntil)}
 function period({previous,now,visible,focused,route,lastInput,audioUntil=0,start,end}){
  if(!visible||!focused||!learning.has(route)||now-previous>MAX_GAP||now<=previous)return null;
  const lo=Math.max(previous,start),hi=Math.min(now,end,activeUntil({route,lastInput,audioUntil}));
  return hi>lo?[Math.floor(lo),Math.floor(hi)]:null;
 }
 const addDays=(day,n)=>{const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
 function validate(s){
  if(!s||s.version!==1||typeof s.enabled!=='boolean'||!integer(s.generation)||typeof s.timezone!=='string'||
    !/^\d{4}-\d\d-\d\d$/.test(s.today)||!/^\d{4}-\d\d-01$/.test(s.month)||!s.totals||!s.days||Array.isArray(s.days))throw Error('INVALID_STUDY_STATUS');
  new Intl.DateTimeFormat('en',{timeZone:s.timezone});
  for(const k of ['today','week','month','all'])if(!integer(s.totals[k]))throw Error('INVALID_STUDY_TOTAL');
  for(const [day,n] of Object.entries(s.days))if(!/^\d{4}-\d\d-\d\d$/.test(day)||!integer(n))throw Error('INVALID_STUDY_DAY');
  return JSON.parse(JSON.stringify(s));
 }
 const core={period,activeUntil,addDays,validate,IDLE,READ_IDLE,AUDIO_LIMIT};
 // The same deterministic policy runs in node tests, without browser side effects.
 if(typeof module!=='undefined'&&module.exports){module.exports=core;return}
 let c=null,dbPromise=null,running=false,month=null;
 const browserZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone;
 const uuid=()=>crypto.randomUUID();
 const now=()=>performance.now();
 async function request(promise){
  let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('STUDY_RPC_TIMEOUT')),8000)})])}finally{clearTimeout(timer)}
 }
 function current(x){const a=window.SVAuth?.getState();return c===x&&a?.user?.id===x.userId&&a.identityRevision===x.revision}
 const paused=x=>{try{return localStorage.getItem('sv-study-paused:'+x.userId)==='yes'}catch(_){return true}};
 const routeNow=()=>{
  if(typeof route!=='string')return '';
  if(route==='practice'&&(typeof quiz==='undefined'||!quiz.active||quiz.finished))return '';
  return route;
 };
 function visible(){return document.visibilityState==='visible'&&document.hasFocus()}
 function database(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   const r=indexedDB.open('sv-study-time-v1',1);
   r.onupgradeneeded=()=>{r.result.createObjectStore('batches',{keyPath:'sequence',autoIncrement:true})};
   r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('STUDY_STORAGE_UNAVAILABLE'));
  }).catch(e=>{dbPromise=null;throw e});
  return dbPromise;
 }
 async function store(mode,fn){
  const db=await database();return new Promise((resolve,reject)=>{
   const tx=db.transaction('batches',mode),req=fn(tx.objectStore('batches'));let value;
   req.onsuccess=()=>{value=req.result};tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(Error('STUDY_STORAGE_FAILED'));
  });
 }
 async function enqueue(x,close=false){
  if(!current(x)||!x.lease)return;
  const segments=x.segments.splice(0,24);
  if(!segments.length&&!close&&!x.renew)return;
  const row={userId:x.userId,id:uuid(),leaseId:x.lease.id,segments,close,status:'pending',created:Date.now()};
  try{await store('readwrite',s=>s.add(row));x.renew=false;x.persisted=now()}
  catch(e){x.segments.unshift(...segments);throw e}
 }
 async function drain(x,wait=false){
  if(!current(x)||navigator.onLine===false)return;
  await navigator.locks.request('sv-study-send:'+x.userId,wait?{}:{ifAvailable:true},async lock=>{
   if(!lock||!current(x))return;
   const rows=await store('readonly',s=>s.getAll());
   for(const row of rows.filter(r=>r.userId===x.userId&&r.status==='pending')){
    if(!current(x))return;
    try{
     const response=await request(window.SVRpc.studyCommit({expectedUserId:x.userId,...row}));
     if(!current(x))return;
     if(x.lease?.id===row.leaseId&&integer(response.end_ms)&&integer(response.server_ms)&&!response.closed){
      x.lease.end_ms=response.end_ms; // Keep original monotonic anchor: replayed receipts must not reset time.
     }
     await store('readwrite',s=>s.delete(row.sequence));x.writeError=false;
    }catch(e){
     if(!current(x))return;
     x.writeError=true;
     if(['22023','42501'].includes(e.code)){
      // Preserve rejected records for review. Never reinterpret/reassign them to a new session/account.
      row.status='rejected';await store('readwrite',s=>s.put(row));
      if(x.lease?.id===row.leaseId){x.stopRequested=true;void refresh(x)}
      continue;
     }
     break; // Unknown result/network error: retry the identical UUID and body, in order.
    }
   }
   if(current(x)&&routeNow()==='profile')void refresh(x);
  });
 }
 function releaseLock(x){x.release?.();x.release=null}
 async function stop(x){
  if(!x.lease){releaseLock(x);return}
  try{await enqueue(x,true);void drain(x).catch(()=>{})}catch(_){/* Previous 5-second checkpoints remain durable. */}
  if(!current(x))return;
  try{sessionStorage.removeItem('sv-study-lease:'+x.userId)}catch(_){}
  x.lease=null;x.segments=[];if(!visible()||!learning.has(routeNow()))x.audioUntil=0;x.stopRequested=false;releaseLock(x);
 }
 async function acquire(x){
  if(x.acquiring||!navigator.locks?.request||navigator.onLine===false)return;
  x.acquiring=true;
  // Browser-wide exclusivity; the server additionally enforces exclusivity across devices.
  void navigator.locks.request('sv-study-owner:'+x.userId,{ifAvailable:true},async lock=>{
   if(!lock||!current(x)||!visible())return;
   let release;const held=new Promise(r=>release=r);x.release=release;
   try{
    await database();await drain(x);
    if(!current(x)||!visible()||!x.snapshot?.enabled||paused(x)||x.saving){releaseLock(x);return}
    let id;try{id=sessionStorage.getItem('sv-study-lease:'+x.userId)}catch(_){}
    id=id||uuid();
    const grant=await request(window.SVRpc.studyOpen({expectedUserId:x.userId,leaseId:id}));
    if(!current(x)||!visible()){releaseLock(x);return}
    if(!grant.available){
     if(grant.expired)try{sessionStorage.removeItem('sv-study-lease:'+x.userId)}catch(_){}
     releaseLock(x);return;
    }
    if(!integer(grant.server_ms)||!integer(grant.end_ms)||grant.end_ms<=grant.server_ms||grant.end_ms>grant.server_ms+90000||grant.generation!==x.snapshot.generation)throw Error('INVALID_STUDY_GRANT');
    x.writeError=false;x.lease=grant;x.anchor={server:grant.server_ms,local:now()};x.previous=now();x.persisted=now();x.sent=now();
    try{sessionStorage.setItem('sv-study-lease:'+x.userId,id)}catch(_){}
    await held;
   }catch(_){if(current(x))x.writeError=true;releaseLock(x)}
  }).catch(()=>{}).finally(()=>{x.acquiring=false});
 }
 async function refresh(x){
  if(!x||!current(x)||x.refreshing)return;
  x.refreshing=true;const requestedMonth=month;
  try{const s=validate(await request(window.SVRpc.studyStatus({expectedUserId:x.userId,month:requestedMonth})));if(current(x)){x.snapshot=s;x.state='ready';x.readError=false;paint()}}
  catch(_){if(current(x)){x.state=x.snapshot?'ready':'unavailable';x.readError=true;paint()}}
  finally{x.refreshing=false}
  if(current(x)&&month!==requestedMonth){void refresh(x);return}
  if(current(x)&&x.snapshot&&x.snapshot.timezone!==browserZone()&&!x.saving&&!x.saveError)await settings(x.snapshot.enabled,browserZone(),true);
 }
 async function tick(){
  if(running)return;running=true;
  try{
   const x=c;if(!x||!current(x))return;
   const p=now(),r=routeNow();
   if(r!==x.route){x.route=r;x.previous=p;x.audioUntil=0;x.lastInput=p}
   const eligible=visible()&&learning.has(r)&&p<activeUntil({route:r,lastInput:x.lastInput,audioUntil:x.audioUntil})&&x.snapshot?.enabled&&!paused(x)&&!x.saving&&x.state==='ready';
   if(!x.lease){
    if(p-x.sent>20000){x.sent=p;void drain(x).catch(()=>{});await refresh(x)}
    if(eligible&&p-x.attempt>10000){x.attempt=p;await acquire(x)}
    return;
   }
   const stamp=t=>Math.floor(x.anchor.server+(t-x.anchor.local));
   const seg=period({previous:stamp(x.previous),now:stamp(p),visible:visible(),focused:document.hasFocus(),route:r,
    lastInput:stamp(x.lastInput),audioUntil:x.audioUntil?stamp(x.audioUntil):0,start:x.lease.cursor_ms,end:x.lease.end_ms});
   x.previous=p;
   if(seg&&!x.stopRequested){
    const last=x.segments.at(-1);
    if(last&&last[1]===seg[0]&&seg[1]-last[0]<=30000)last[1]=seg[1];else x.segments.push(seg);
    x.lease.cursor_ms=seg[1];
   }
   if(!eligible||x.stopRequested||stamp(p)>=x.lease.end_ms){await stop(x);return}
   if(p-x.persisted>=5000)await enqueue(x);
   if(p-x.sent>=20000){x.sent=p;x.renew=true;await enqueue(x);void drain(x).catch(()=>{});void refresh(x)}
  }catch(_){if(c){c.writeError=true;c.stopRequested=true;releaseLock(c)}}finally{running=false}
 }
 function authChanged(){
  const a=window.SVAuth?.getState();
  if(c&&a?.user?.id===c.userId&&a.identityRevision===c.revision)return;
  if(c){releaseLock(c);c.segments=[];c.audioUntil=0}
  c=null;month=null;
  if(a?.user){const p=now();c={userId:a.user.id,revision:a.identityRevision,state:'loading',snapshot:null,lease:null,segments:[],lastInput:p,previous:p,audioUntil:0,route:routeNow(),attempt:-Infinity,sent:p};void refresh(c)}
  paint();
 }
 // Trusted input only, inside the learning surface. Pointer movement alone is not learning.
 function input(e){
  if(!e.isTrusted||!c||!current(c)||!e.target?.closest?.('#page')||!visible()||!learning.has(routeNow()))return;
  c.lastInput=now();
 }
 for(const event of ['pointerdown','keydown','input','wheel','touchmove'])document.addEventListener(event,input,{capture:true,passive:true});
 function pause(){if(c){c.previous=now();c.audioUntil=0;c.stopRequested=true;void tick()}}
 document.addEventListener('visibilitychange',()=>{if(!visible())pause();else if(c){c.previous=now();c.lastInput=now();c.stopRequested=false;void refresh(c)}});
 window.addEventListener('blur',pause);
 window.addEventListener('focus',()=>{if(c){c.previous=now();c.lastInput=now();c.stopRequested=false}});
 window.addEventListener('pagehide',pause);
 window.addEventListener('storage',e=>{if(c&&e.key==='sv-study-paused:'+c.userId){if(paused(c))pause();paintKey='';paint()}});
 window.addEventListener('online',()=>{if(c){void drain(c).catch(()=>{});void refresh(c)}});
 // Actual speech/media start/end hooks. Hidden tabs always pause, even during playback.
 function audio(active){
  if(!c||!current(c))return;
  c.audioUntil=active&&visible()&&learning.has(routeNow())?now()+AUDIO_LIMIT:0;
 }
 document.addEventListener('playing',e=>{if(e.target.closest?.('#page')&&e.target.matches?.('audio,video'))audio(true)},true);
 for(const event of ['pause','ended','error'])document.addEventListener(event,e=>{if(e.target.matches?.('audio,video'))audio(false)},true);
 const words={
  ru:{title:'Время со шведским',today:'Сегодня',week:'Эта неделя',month:'Этот месяц',all:'За всё время',seven:'Последние 7 дней',retry:'Попробовать снова',track:'Учитывать учебное время',hint:'Только во время занятий. Можно выключить в любой момент.',unavailable:'Учёт времени пока недоступен.',loading:'Загружаем время занятий…',zone:'Часовой пояс',save:'Сохранить',empty:'Нет записанного времени',study:'Обучение',hour:'ч',minute:'мин',second:'с',prev:'Предыдущий месяц',next:'Следующий месяц',error:'Не удалось сохранить. Попробуй ещё раз.'},
  en:{title:'Time with Swedish',today:'Today',week:'This week',month:'This month',all:'All time',seven:'Last 7 days',retry:'Try again',track:'Track study time',hint:'Only while studying. Turn it off whenever you like.',unavailable:'Study time is not available yet.',loading:'Loading study time…',zone:'Time zone',save:'Save',empty:'No recorded time',study:'Study',hour:'h',minute:'min',second:'s',prev:'Previous month',next:'Next month',error:'Could not save. Please try again.'},
  sv:{title:'Tid med svenska',today:'Idag',week:'Denna vecka',month:'Denna månad',all:'Totalt',seven:'Senaste 7 dagarna',retry:'Försök igen',track:'Registrera studietid',hint:'Bara under studier. Stäng av när du vill.',unavailable:'Studietid är inte tillgänglig ännu.',loading:'Laddar studietid…',zone:'Tidszon',save:'Spara',empty:'Ingen registrerad tid',study:'Studier',hour:'tim',minute:'min',second:'s',prev:'Föregående månad',next:'Nästa månad',error:'Kunde inte spara. Försök igen.'},
  uk:{title:'Час зі шведською',today:'Сьогодні',week:'Цей тиждень',month:'Цей місяць',all:'Усього',seven:'Останні 7 днів',retry:'Спробувати знову',track:'Враховувати навчальний час',hint:'Лише під час навчання. Можна вимкнути будь-коли.',unavailable:'Облік часу поки недоступний.',loading:'Завантажуємо час занять…',zone:'Часовий пояс',save:'Зберегти',empty:'Немає записаного часу',study:'Навчання',hour:'год',minute:'хв',second:'с',prev:'Попередній місяць',next:'Наступний місяць',error:'Не вдалося зберегти. Спробуй ще раз.'}
 };
 const lang=()=>typeof locale4==='function'?locale4():'ru';
 const dictionary=()=>words[lang()]||words.ru;
 function secondsLabel(n){
  const language=lang(),form=new Intl.PluralRules(language).select(n);
  const units={ru:{one:'секунда',few:'секунды',many:'секунд',other:'секунды'},uk:{one:'секунда',few:'секунди',many:'секунд',other:'секунди'},en:{one:'second',other:'seconds'},sv:{one:'sekund',other:'sekunder'}};
  const labels=units[language]||units.ru;
  return labels[form]||labels.other;
 }
 function duration(ms,exact=false){
  const d=dictionary(),n=Math.floor(ms/1000),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
  if(!exact){
   if(h)return `${h} ${d.hour}`+(m?` ${m} ${d.minute}`:'');
   if(m)return `${m} ${d.minute}`;
   return `0 ${d.minute}`;
  }
  return [h?`${h} ${d.hour}`:'',m?`${m} ${d.minute}`:'',`${s} ${secondsLabel(s)}`].filter(Boolean).join(' ');
 }
 const dateFormat=(day,options)=>new Intl.DateTimeFormat(lang(),{...options,timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 function dayText(day){
  const s=c?.snapshot,d=dictionary();
  const loaded=s&&s.month.slice(0,7)===day.slice(0,7)&&month===s.month&&!c.readError;
  return loaded?(s.days[day]?d.study+': '+duration(s.days[day]):d.empty):(c?.readError?d.unavailable:d.loading);
 }
 function periodText(key,s){
  if(!s)return '';
  if(key==='all')return ({ru:'С начала обучения',en:'Since you started',sv:'Sedan starten',uk:'Від початку навчання'})[lang()]||'Since you started';
  const end=s.today;
  const start=key==='today'?end:key==='month'?end.slice(0,8)+'01':addDays(end,-((new Date(end+'T12:00:00Z').getUTCDay()+6)%7));
  const format=day=>dateFormat(day,{day:'numeric',month:'short'});
  return start===end?format(end):format(start)+' – '+format(end);
 }
 function panel(){
  const d=dictionary(),s=c&&current(c)?c.snapshot:null;
  return `<div id="study-time-panel" class="study-summary">
   <div class="study-totals" role="group" aria-label="${d.title}">${['today','week','month','all'].map(key=>`<div class="study-stat study-stat--${key}"><small>${d[key]}</small><strong title="${s?escape(duration(s.totals[key],true)):''}">${s?escape(duration(s.totals[key])):'—'}</strong><span class="study-stat-period">${escape(periodText(key,s))}</span></div>`).join('')}</div>
   <label class="study-toggle"><input type="checkbox" data-study-enabled ${s?.enabled&&!paused(c)?'checked':''} ${s&&!c?.saving?'':'disabled'}><span>${d.track}</span></label>
   <p class="study-message" role="status">${c?.saveError||c?.writeError?d.error:c?.readError?d.unavailable:!s?d.loading:!s.enabled||paused(c)?({ru:'Учёт выключен. Включите его перед занятиями.',en:'Tracking is off. Turn it on before studying.',sv:'Tidsregistrering är avstängd. Slå på den innan du studerar.',uk:'Облік вимкнено. Увімкніть його перед заняттями.'})[lang()]:d.hint}${c?.readError||c?.saveError||c?.writeError?' <button type="button" class="link-btn" data-study-retry aria-label="${d.retry}">↻</button>':''}</p></div>`;
 }
 let paintKey='';
 function paint(){
  const page=document.getElementById('page');if(!page)return;
  const calendar=page.querySelector('.activity-calendar');
  const old=page.querySelector('#study-time-panel');
  if(routeNow()!=='profile'||!window.SVAuth?.getState().user||!calendar){if(old)old.remove();hideTip();paintKey='';return}
  const desired=calendar.dataset.calendarMonth;
  if(desired&&desired!==month){month=desired;void refresh(c)}
  const key=JSON.stringify([lang(),c?.state,c?.snapshot,c?.saving,c?.saveError,c?.readError,c?.writeError,month]);
  if(!old||paintKey!==key){
   const focusToggle=document.activeElement?.hasAttribute?.('data-study-enabled');
   if(old)old.outerHTML=panel();else calendar.insertAdjacentHTML('afterend',panel());
   if(focusToggle)page.querySelector('[data-study-enabled]')?.focus({preventScroll:true});
   paintKey=key;
  }
  for(const day of calendar.querySelectorAll('[data-study-date]')){
   if(day.hasAttribute('title')){day.dataset.activityLabel=day.getAttribute('title');day.removeAttribute('title')}
   const label=dateFormat(day.dataset.studyDate,{day:'numeric',month:'long'})+' · '+dayText(day.dataset.studyDate)+' · '+(day.dataset.activityLabel||'');
   if(day.getAttribute('aria-label')!==label)day.setAttribute('aria-label',label);
  }
  if(tipDay?.isConnected)showTip(tipDay);else hideTip();
 }
 let tip=null,tipDay=null;
 function hideTip(){if(tip)tip.hidden=true;tipDay?.removeAttribute('aria-describedby');tipDay=null}
 function showTip(day){
  if(!c||routeNow()!=='profile')return;
  if(!tip){tip=document.createElement('div');tip.id='study-day-tip';tip.className='study-tooltip';tip.setAttribute('role','tooltip');document.body.append(tip)}
  if(tipDay!==day)tipDay?.removeAttribute('aria-describedby');tipDay=day;tip.hidden=false;
  tip.innerHTML=`<strong>${escape(dateFormat(day.dataset.studyDate,{day:'numeric',month:'long'}))}</strong><span>${escape(dayText(day.dataset.studyDate))}</span>`;
  day.setAttribute('aria-describedby',tip.id);
  const rect=day.getBoundingClientRect(),box=tip.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(window.innerWidth-box.width-8,rect.left+rect.width/2-box.width/2))+'px';
  tip.style.top=Math.max(8,rect.top>box.height+12?rect.top-box.height-8:Math.min(window.innerHeight-box.height-8,rect.bottom+8))+'px';
 }
 async function settings(enabled,timezone,automatic=false){
  const x=c;if(!x||!current(x)||x.state!=='ready'||x.saving)return;
  x.saving=true;x.saveError=false;
  if(!enabled)try{localStorage.setItem('sv-study-paused:'+x.userId,'yes')}catch(_){}
  paint();
  try{
   new Intl.DateTimeFormat('en',{timeZone:timezone});
   if(x.lease)await stop(x);
   await drain(x,true);
   const s=validate(await request(window.SVRpc.studySettings({expectedUserId:x.userId,enabled,timezone,generation:x.snapshot.generation})));
   if(current(x)){x.snapshot=s;if(!automatic)x.lastInput=-Infinity;if(enabled&&!automatic)try{localStorage.removeItem('sv-study-paused:'+x.userId)}catch(_){}}
  }catch(_){if(current(x)){x.saveError=true;await refresh(x)}}
  finally{if(current(x)){x.saving=false;paint();if(month&&x.snapshot?.month!==month)void refresh(x)}}
 }
 document.addEventListener('change',e=>{if(e.target.matches?.('[data-study-enabled]')&&c)void settings(e.target.checked,browserZone())});
 document.addEventListener('pointerover',e=>{const day=e.target.closest?.('[data-study-date]');if(day)showTip(day)});
 document.addEventListener('pointerout',e=>{if(e.pointerType!=='touch'&&e.target.closest?.('[data-study-date]')&&!e.relatedTarget?.closest?.('[data-study-date]'))hideTip()});
 document.addEventListener('focusin',e=>{const day=e.target.closest?.('[data-study-date]');if(day)showTip(day);else hideTip()});
 document.addEventListener('click',e=>{
  const day=e.target.closest?.('[data-study-date]');if(day){showTip(day);return}
  hideTip();if(e.target.closest?.('[data-study-retry]')&&c){c.saveError=false;void drain(c).catch(()=>{});void refresh(c)}
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hideTip();if((e.key==='Enter'||e.key===' ')&&e.target.matches?.('[data-study-date]')){e.preventDefault();showTip(e.target)}});
 window.addEventListener('scroll',hideTip,true);window.addEventListener('resize',hideTip);
 new MutationObserver(()=>{paint()}).observe(document.getElementById('page'),{childList:true,subtree:true});
 window.SVStudy=Object.freeze({audio,refresh:()=>c?refresh(c):Promise.resolve(),preparedOnly:false});
 window.SVAuth?.subscribe(authChanged);authChanged();setInterval(()=>{void tick()},1000);
})();
