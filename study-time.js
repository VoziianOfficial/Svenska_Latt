/* Local preparation only. Explicit account consent + loopback gate + server v1 required. */
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
 const dev=['localhost','127.0.0.1','[::1]'].includes(location.hostname)&&['http:','https:'].includes(location.protocol)&&
  (()=>{try{return localStorage.getItem('sv-study-time-dev-v1')==='enabled'}catch(_){return false}})();
 let c=null,dbPromise=null,running=false,month=null,selection=null;
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
     await store('readwrite',s=>s.delete(row.sequence));
    }catch(e){
     if(!current(x))return;
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
    x.lease=grant;x.anchor={server:grant.server_ms,local:now()};x.previous=now();x.persisted=now();x.sent=now();
    try{sessionStorage.setItem('sv-study-lease:'+x.userId,id)}catch(_){}
    await held;
   }catch(_){releaseLock(x)}
  }).catch(()=>{}).finally(()=>{x.acquiring=false});
 }
 async function refresh(x){
  if(!current(x)||x.refreshing)return;
  x.refreshing=true;
  try{const s=validate(await request(window.SVRpc.studyStatus({expectedUserId:x.userId,month})));if(current(x)){x.snapshot=s;x.state='ready';paint()}}
  catch(_){if(current(x)){x.state=x.snapshot?'ready':'unavailable';paint()}}
  finally{x.refreshing=false}
 }
 async function tick(){
  if(running)return;running=true;
  try{
   const x=c;if(!x||!current(x)||!dev)return;
   const p=now(),r=routeNow();
   if(r!==x.route){x.route=r;x.previous=p;x.audioUntil=0;x.lastInput=p}
   const eligible=visible()&&learning.has(r)&&p<activeUntil({route:r,lastInput:x.lastInput,audioUntil:x.audioUntil})&&x.snapshot?.enabled&&!paused(x)&&!x.saving&&x.state==='ready';
   if(!x.lease){
    if(p-x.sent>20000){x.sent=p;void drain(x).catch(()=>{});if(routeNow()==='profile')await refresh(x)}
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
   if(p-x.sent>=20000){x.sent=p;x.renew=true;await enqueue(x);void drain(x).catch(()=>{})}
  }catch(_){if(c){c.stopRequested=true;releaseLock(c)}}finally{running=false}
 }
 function authChanged(){
  const a=window.SVAuth?.getState();
  if(c&&a?.user?.id===c.userId&&a.identityRevision===c.revision)return;
  if(c){releaseLock(c);c.segments=[];c.audioUntil=0}
  c=null;month=null;selection=null;
  if(a?.user&&dev){const p=now();c={userId:a.user.id,revision:a.identityRevision,state:'loading',snapshot:null,lease:null,segments:[],lastInput:p,previous:p,audioUntil:0,route:routeNow(),attempt:-Infinity,sent:p};void refresh(c)}
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
  ru:{title:'Время со шведским',today:'Сегодня',week:'Эта неделя',month:'Этот месяц',all:'Всего',seven:'Последние 7 дней',track:'Учитывать учебное время',hint:'Только во время занятий. Можно выключить в любой момент.',unavailable:'Учёт времени пока недоступен.',loading:'Загружаем время занятий…',zone:'Часовой пояс',save:'Сохранить',empty:'Занятий не было',hour:'ч',minute:'мин',second:'с',prev:'Предыдущий месяц',next:'Следующий месяц',error:'Не удалось сохранить. Попробуй ещё раз.'},
  en:{title:'Time with Swedish',today:'Today',week:'This week',month:'This month',all:'All time',seven:'Last 7 days',track:'Track study time',hint:'Only while studying. Turn it off whenever you like.',unavailable:'Study time is not available yet.',loading:'Loading study time…',zone:'Time zone',save:'Save',empty:'No study time',hour:'h',minute:'min',second:'s',prev:'Previous month',next:'Next month',error:'Could not save. Please try again.'},
  sv:{title:'Tid med svenska',today:'Idag',week:'Denna vecka',month:'Denna månad',all:'Totalt',seven:'Senaste 7 dagarna',track:'Registrera studietid',hint:'Bara under studier. Stäng av när du vill.',unavailable:'Studietid är inte tillgänglig ännu.',loading:'Laddar studietid…',zone:'Tidszon',save:'Spara',empty:'Ingen studietid',hour:'tim',minute:'min',second:'s',prev:'Föregående månad',next:'Nästa månad',error:'Kunde inte spara. Försök igen.'},
  uk:{title:'Час зі шведською',today:'Сьогодні',week:'Цей тиждень',month:'Цей місяць',all:'Усього',seven:'Останні 7 днів',track:'Враховувати навчальний час',hint:'Лише під час навчання. Можна вимкнути будь-коли.',unavailable:'Облік часу поки недоступний.',loading:'Завантажуємо час занять…',zone:'Часовий пояс',save:'Зберегти',empty:'Занять не було',hour:'год',minute:'хв',second:'с',prev:'Попередній місяць',next:'Наступний місяць',error:'Не вдалося зберегти. Спробуй ще раз.'}
 };
 const lang=()=>typeof locale4==='function'?locale4():'ru';
 const dictionary=()=>words[lang()]||words.ru;
 function duration(ms,exact=false){
  const d=dictionary(),n=Math.floor(ms/1000),h=Math.floor(n/3600),m=Math.floor(n%3600/60),s=n%60;
  if(!exact&&h)return `${h} ${d.hour} ${m} ${d.minute}`;
  if(!exact&&m)return `${m} ${d.minute}`;
  return [h?`${h} ${d.hour}`:'',m?`${m} ${d.minute}`:'',`${s} ${d.second}`].filter(Boolean).join(' ');
 }
 const dateFormat=(day,options)=>new Intl.DateTimeFormat(lang(),{...options,timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));
 function label(day,s){const ms=s.days[day]||0;return dateFormat(day,{day:'numeric',month:'long',year:'numeric'})+' · '+(ms?duration(ms,true):dictionary().empty+' · '+duration(0,true))}
 function panel(){
  const d=dictionary(),s=c&&current(c)?c.snapshot:null;
  const ready=!!s,sel=s&&(selection?.startsWith(s.month.slice(0,7))?selection:s.month===s.today.slice(0,7)+'-01'?s.today:s.month);
  let chart='',calendar='';
  if(s){
   const days=Array.from({length:7},(_,i)=>addDays(s.today,i-6)),max=Math.max(1,...days.map(day=>s.days[day]||0));
   chart=days.map(day=>`<button type="button" class="study-bar" data-study-day="${day}" title="${escape(label(day,s))}" aria-label="${escape(label(day,s))}"><span class="study-bar-track"><span style="height:${100*(s.days[day]||0)/max}%"></span></span><small>${escape(dateFormat(day,{weekday:'short'}))}</small></button>`).join('');
   const first=new Date(s.month+'T12:00:00Z'),offset=(first.getUTCDay()+6)%7;
   const count=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,0)).getUTCDate();
   const headings=Array.from({length:7},(_,i)=>`<span class="study-weekday">${escape(dateFormat(addDays('2026-10-19',i),{weekday:'short'}))}</span>`).join('');
   calendar=headings+Array.from({length:42},(_,i)=>{
    const num=i-offset+1;if(num<1||num>count)return '<span class="study-day-blank" aria-hidden="true"></span>';
    const day=addDays(s.month,num-1),ms=s.days[day]||0,intensity=ms===0?0:ms<300000?1:ms<900000?2:ms<1800000?3:4;
    return `<button type="button" class="study-day study-tone-${intensity}" data-study-day="${day}" title="${escape(label(day,s))}" aria-label="${escape(label(day,s))}" aria-pressed="${day===sel}" ${day===s.today?'aria-current="date"':''}>${num}</button>`;
   }).join('');
  }
  return `<section class="content-panel study-time" id="study-time-panel" aria-labelledby="study-time-title">
   <h3 id="study-time-title">${d.title}</h3>
   <div class="study-totals">${['today','week','month','all'].map(key=>`<div><small>${d[key]}</small><strong title="${s?escape(duration(s.totals[key],true)):''}">${s?duration(s.totals[key]):'—'}</strong></div>`).join('')}</div>
   <div class="study-visuals"><div><h4>${d.seven}</h4><div class="study-chart" aria-label="${d.seven}">${chart}</div></div>
   <div><div class="study-calendar-heading"><button type="button" data-study-month="-1" aria-label="${d.prev}" ${ready?'':'disabled'}>‹</button><strong>${s?escape(dateFormat(s.month,{month:'long',year:'numeric'})):'—'}</strong><button type="button" data-study-month="1" aria-label="${d.next}" ${ready?'':'disabled'}>›</button></div>
   <div class="study-calendar">${calendar}</div><p class="study-day-detail" aria-live="polite">${s?escape(label(sel,s)):'&nbsp;'}</p></div></div>
   <div class="study-preferences"><label class="study-toggle"><input type="checkbox" data-study-enabled ${s?.enabled&&!paused(c)?'checked':''} ${ready&&!c?.saving?'':'disabled'}><b>${d.track}</b></label><p class="micro-note">${d.hint}</p>
   <div class="study-zone"><label for="study-time-zone">${d.zone}</label><input id="study-time-zone" type="text" maxlength="100" value="${escape(s?.timezone||'Europe/Stockholm')}" list="study-time-zones" ${ready&&!c?.saving?'':'disabled'}><datalist id="study-time-zones">${['Europe/Stockholm','Europe/Kyiv','Europe/London','Europe/Berlin','America/New_York','Asia/Tokyo','UTC'].map(z=>`<option value="${z}"></option>`).join('')}</datalist><button type="button" class="btn secondary small" data-study-save ${ready&&!c?.saving?'':'disabled'}>${d.save}</button></div>
   <p class="study-message" role="status">${c?.saveError?d.error:!ready?(c?.state==='loading'?d.loading:d.unavailable):'&nbsp;'}</p></div></section>`;
 }
 let paintKey='';
 function paint(){
  const page=document.getElementById('page');if(!page)return;
  const signed=window.SVAuth?.getState().user;
  const old=page.querySelector('#study-time-panel');
  if(routeNow()!=='profile'||!signed){if(old)old.remove();paintKey='';return}
  const key=JSON.stringify([lang(),c?.state,c?.snapshot,c?.saving,c?.saveError,selection]);
  if(old&&paintKey===key)return;
  // Retain a zone being edited and keyboard focus through server refreshes.
  const focused=document.activeElement,focusId=focused?.id,focusDay=focused?.dataset?.studyDay,focusToggle=focused?.hasAttribute?.('data-study-enabled');
  const zone=old?.querySelector('#study-time-zone'),draft=zone&&focused===zone?zone.value:null;
  if(old)old.outerHTML=panel();else{
   const anchor=page.querySelector('.profile-collections')||page.querySelector('.profile-identity');
   if(anchor)anchor.insertAdjacentHTML('afterend',panel());else page.insertAdjacentHTML('beforeend',panel());
  }
  paintKey=key;
  const replacement=focusToggle?page.querySelector('[data-study-enabled]'):focusId==='study-time-zone'?page.querySelector('#study-time-zone'):focusDay?page.querySelector(`[data-study-day="${focusDay}"]`):null;
  if(replacement){if(draft!==null)replacement.value=draft;replacement.focus({preventScroll:true})}
 }
 async function settings(enabled,timezone){
  const x=c;if(!x||!current(x)||x.state!=='ready'||x.saving)return;
  x.saving=true;x.saveError=false;
  if(!enabled)try{localStorage.setItem('sv-study-paused:'+x.userId,'yes')}catch(_){}
  paint();
  try{
   new Intl.DateTimeFormat('en',{timeZone:timezone});
   if(x.lease)await stop(x);
   await drain(x,true);
   const s=validate(await request(window.SVRpc.studySettings({expectedUserId:x.userId,enabled,timezone,generation:x.snapshot.generation})));
   if(current(x)){x.snapshot=s;month=null;x.lastInput=-Infinity;if(enabled)try{localStorage.removeItem('sv-study-paused:'+x.userId)}catch(_){}}
  }catch(_){if(current(x)){x.saveError=true;await refresh(x)}}
  finally{if(current(x)){x.saving=false;paint()}}
 }
 document.addEventListener('change',e=>{if(e.target.matches?.('[data-study-enabled]')&&c)void settings(e.target.checked,c.snapshot.timezone)});
 document.addEventListener('click',e=>{
  const el=e.target.closest?.('[data-study-month],[data-study-day],[data-study-save]');if(!el||!c?.snapshot)return;
  if(el.hasAttribute('data-study-save')){void settings(c.snapshot.enabled&&!paused(c),document.getElementById('study-time-zone').value.trim());return}
  if(el.dataset.studyMonth){const s=c.snapshot,d=new Date(s.month+'T12:00:00Z');d.setUTCMonth(d.getUTCMonth()+Number(el.dataset.studyMonth));month=d.toISOString().slice(0,10);selection=null;void refresh(c);return}
  selection=el.dataset.studyDay;
  const detail=document.querySelector('.study-day-detail');if(detail)detail.textContent=label(selection,c.snapshot);
  document.querySelectorAll('.study-day').forEach(day=>day.setAttribute('aria-pressed',String(day.dataset.studyDay===selection)));
 });
 document.addEventListener('focusin',e=>{if(e.target.dataset?.studyDay&&c?.snapshot){const out=document.querySelector('.study-day-detail');if(out)out.textContent=label(e.target.dataset.studyDay,c.snapshot)}});
 new MutationObserver(()=>{paint()}).observe(document.getElementById('page'),{childList:true,subtree:true});
 window.SVStudy=Object.freeze({audio,refresh:()=>c?refresh(c):Promise.resolve(),preparedOnly:!dev});
 window.SVAuth?.subscribe(authChanged);authChanged();setInterval(()=>{void tick()},1000);
})();
