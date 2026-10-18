/* Validated account progress and durable event queue; RPC only. */
'use strict';
(() => {
 const moduleVersion='2026-10-18-quiz-sessions-1';
 const scriptUrl=document.currentScript?.src??null;
 let started=false,initializing=null,onError=null,context=null,previewCatalog=null;
 const record=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const count=value=>Number.isSafeInteger(value)&&value>=0;
 const invalid=()=>{throw Object.assign(new Error('INVALID_PROGRESS_RESPONSE'),{code:'INVALID_PROGRESS_RESPONSE'})};
 function validate(value){
  if(!record(value)||!count(value.revision)||typeof value.content_version!=='string'||
   !value.content_version.trim()||value.content_version.length>100||!record(value.state))invalid();
  const s=value.state;
  for(const key of ['known','favorites','completed','videos','booksRead']){
   if(!Array.isArray(s[key])||s[key].some(id=>typeof id!=='string'||!id.length||id.length>100)||new Set(s[key]).size!==s[key].length)invalid();
  }
  for(const key of ['xp','answered','correct'])if(!count(s[key]))invalid();
  if(s.correct>s.answered||!record(s.reviews)||!record(s.activity)||!record(s.settings)||!record(s.profile))invalid();
  for(const [id,r] of Object.entries(s.reviews)){
   if(!id||id.length>100||!record(r)||!count(r.due)||!count(r.interval)||r.interval>365000||!count(r.rep)||
    !Number.isFinite(r.ease)||r.ease<1.3||r.ease>3)invalid();
  }
  for(const [day,n] of Object.entries(s.activity))if(!/^\d{4}-\d\d-\d\d$/.test(day)||!count(n))invalid();
  if(!['ru','en','sv','uk'].includes(s.settings.language)||!['A','B','C','D'].includes(s.settings.level)||
   !['verySlow','slow','normal'].includes(s.settings.speechSpeed)||typeof s.settings.timezone!=='string'||
   !s.settings.timezone.length||s.settings.timezone.length>100||typeof s.profile.name!=='string'||s.profile.name.length>70||
   !(s.profile.avatarPath===null||(typeof s.profile.avatarPath==='string'&&s.profile.avatarPath.length<=180)))invalid();
  // Own immutable copy, with no aliases into RPC results or app.js state.
  const capabilities=value.capabilities??[];
  if(!Array.isArray(capabilities)||capabilities.some(v=>typeof v!=='string'||v.length>100))invalid();
  const snapshot=JSON.parse(JSON.stringify({revision:value.revision,content_version:value.content_version,capabilities,state:s}));
  function freeze(object){for(const v of Object.values(object))if(record(v)||Array.isArray(v))freeze(v);return Object.freeze(object)}
  return freeze(snapshot);
 }
 function diagnostic(error){
  // Never expose raw messages, details, headers, JWTs or user profiles.
  const code=['INVALID_PROGRESS_RESPONSE','AUTH_USER_MISMATCH','AUTH_CONTEXT_CHANGED','AUTH_UNAVAILABLE',
   '42501','42883','PGRST202','PGRST301','PGRST302','PGRST303'].includes(error?.code)?error.code:'RPC_READ_FAILED';
  const reason=code==='INVALID_PROGRESS_RESPONSE'?'Сервер вернул неожиданный формат прогресса.':
   ['42501','42883','PGRST202'].includes(code)?'Проверьте доступность sl_get_progress и права authenticated.':
   code.startsWith('AUTH_')||code.startsWith('PGRST30')?'Не удалось проверить текущую сессию.':
   'Проверьте соединение и доступность Supabase.';
  return {code,message:`Не удалось прочитать облачный прогресс (${code}). ${reason} Локальный прогресс аккаунта сохранён.`};
 }
 function current(c){
  const auth=window.SVAuth.getState();
  return context===c&&auth.user?.id===c.userId&&auth.identityRevision===c.identityRevision;
 }
 function summary(){
  // Clear stale results even before deferred auth observers have run.
  const c=context;
  if(!c||!current(c))return Object.freeze({status:'idle',attempts:0,revision:null,content_version:null,knownWords:null,xp:null,errorCode:null,message:null,receivedAt:null});
  return Object.freeze({status:c.status,attempts:c.attempts,revision:c.snapshot?.revision??null,
   content_version:c.snapshot?.content_version??null,knownWords:c.snapshot?.state.known.length??null,
   xp:c.snapshot?.state.xp??null,errorCode:c.error?.code??null,message:c.error?.message??null,receivedAt:c.receivedAt});
 }
 function sync({retry=false}={}){
  const auth=window.SVAuth.getState();
  if(!auth.user){context=null;activity={pending:[],error:null};return Promise.resolve(summary())}
  if(!context||context.userId!==auth.user.id||context.identityRevision!==auth.identityRevision){
   activity={pending:[],error:null};writeError=null;
   context={userId:auth.user.id,identityRevision:auth.identityRevision,status:'idle',attempts:0,snapshot:null,error:null,receivedAt:null,pending:null};
  }
  const c=context;
  if(c.pending)return c.pending;
  if(c.status==='ready'||(c.status==='error'&&!retry))return Promise.resolve(summary());
  c.status='loading';c.error=null;c.attempts++;
  // Defer the read so pending is assigned before any Auth events it triggers.
  let readTimer;
  c.pending=Promise.race([
   Promise.resolve().then(()=>window.SVRpc.getProgress({expectedUserId:c.userId})),
   new Promise((_,reject)=>{readTimer=setTimeout(()=>reject(Object.assign(new Error('RPC_READ_TIMEOUT'),{code:'RPC_READ_TIMEOUT'})),8000)})
  ]).then(value=>{
   if(!current(c))return;
   c.snapshot=validate(value);c.receivedAt=new Date().toISOString();c.status='ready';
   deliverSnapshot(c);
  }).catch(error=>{
   if(!current(c))return;
   c.snapshot=null;c.status='error';c.error=diagnostic(error);
   try{onError?.(c.error.message)}catch(_){}
  }).finally(()=>{clearTimeout(readTimer);c.pending=null}).then(async()=>{if(current(c))await prepareWriter();return summary()});
  return c.pending;
 }
 function initialize(options={}){
  if(typeof options.onSnapshot==='function')onSnapshot=options.onSnapshot;
  if(typeof options.previewCatalog==='function')previewCatalog=options.previewCatalog;
  if(typeof options.onError==='function')onError=options.onError;
  if(typeof options.onActivity==='function')onActivity=options.onActivity;
  if(!started){
   started=true;
   window.SVAuth.subscribe(()=>{void sync()});
   initializing=window.SVAuth.initialize().then(()=>sync());
  }
  return initializing;
 }
 // HTTPS releases save supported account events. Loopback keeps its explicit
 // development opt-in; neither switch controls reading/rendering account data.
 const loopback=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
 const writeEnabled=(!loopback&&location.protocol==='https:')||(loopback&&
  ['http:','https:'].includes(location.protocol)&&(()=>{try{return localStorage.getItem('sv-cloud-write-dev-v1')==='enabled'}catch(_){return false}})());
 let writerReady=null,writeError=null,dbPromise=null,draining=null,onSnapshot=null,retryTimer=null,onActivity=null;
 let activity={pending:[],error:null};
 async function reportActivity(c,completed=null){
  if(!c||!current(c))return;
  let stored;try{stored=await rows()}catch(_){stored=[]}
  const pending=stored.filter(r=>r.userId===c.userId&&!['applied','cancelled'].includes(r.status)).map(r=>{
   const event=JSON.parse(r.eventJson);return {type:event.type,wordId:event.data.word_id,sessionId:event.data.session_id,status:r.status};
  });
  if(!current(c))return;
  activity={pending,error:writeError};
  try{onActivity?.({...activity,completed})}catch(_){}
 }
 const fail=code=>Object.assign(new Error(code),{code});
 function notify(code){
  writeError=code;
  void reportActivity(context);
 }
 function database(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   const req=indexedDB.open('sv-cloud-events-v1',1);
   req.onupgradeneeded=()=>{
    const db=req.result;
    db.createObjectStore('events',{keyPath:'sequence',autoIncrement:true});
    db.createObjectStore('baselines',{keyPath:'userId'});
   };
   req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(fail('QUEUE_STORAGE_UNAVAILABLE'));
  }).catch(e=>{dbPromise=null;throw e});
  return dbPromise;
 }
 async function storage(store,mode,operation){
  const db=await database();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction(store,mode),req=operation(tx.objectStore(store));let result;
   req.onsuccess=()=>{result=req.result};
   tx.oncomplete=()=>resolve(result);
   tx.onabort=tx.onerror=()=>reject(fail('QUEUE_STORAGE_FAILED'));
  });
 }
 const rows=()=>storage('events','readonly',s=>s.getAll());
 const put=row=>storage('events','readwrite',s=>s.put(row));
 function requireCurrent(c){if(!current(c))throw fail('AUTH_CONTEXT_CHANGED')}
 function lock(c,fn){
  if(!navigator.locks?.request)throw fail('CROSS_TAB_LOCK_UNAVAILABLE');
  return navigator.locks.request('sv-cloud-events:'+c.userId,async()=>{requireCurrent(c);return fn()});
 }
 const learningFields=['known','favorites','reviews','completed','activity','answered','correct','xp','videos','booksRead'];
 function stable(v){return JSON.stringify(v,(_k,x)=>record(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x)}
 async function compatible(c){
  const catalog=previewCatalog?.();
  if(catalog?.version!==c.snapshot?.content_version)throw fail('CONTENT_VERSION_MISMATCH');
  const raw=localStorage.getItem('sv-account-local-v1-'+c.userId);
  const baseline=await storage('baselines','readonly',s=>s.get(c.userId));
  if(baseline){if(baseline.raw!==raw)throw fail('LOCAL_PROGRESS_CONFLICT');return}
  let local;
  try{local=raw===null?{}:JSON.parse(raw)}catch(_){throw fail('LOCAL_PROGRESS_CONFLICT')}
  if(!record(local))throw fail('LOCAL_PROGRESS_CONFLICT');
  const defaults={known:[],favorites:[],reviews:{},completed:[],activity:{},answered:0,correct:0,xp:0,videos:[],booksRead:[]};
  const empty=learningFields.every(k=>stable(local[k]===undefined?defaults[k]:local[k])===stable(defaults[k]));
  const equal=learningFields.every(k=>stable(local[k]===undefined?defaults[k]:local[k])===stable(c.snapshot.state[k]));
  if((!empty&&!equal)|| (local.profile?.avatar)||
   (local.profile?.name&&local.profile.name!==c.snapshot.state.profile.name))throw fail('LOCAL_PROGRESS_CONFLICT');
  // Archive the exact local bytes used for the preflight, without modifying them.
  await storage('baselines','readwrite',s=>s.put({userId:c.userId,raw}));
 }
 function deliverSnapshot(c){
  requireCurrent(c);
  onSnapshot?.(JSON.parse(JSON.stringify(c.snapshot.state)),c.userId);
 }
 function publish(c){
  requireCurrent(c);
  writerReady=c;writeError=null;
  deliverSnapshot(c);
 }
 // A stalled request must release the cross-tab queue lock. A late write can
 // safely be retried because the exact event UUID/body remains in IndexedDB.
 async function boundedRpc(request){
  let timer;
  try{return await Promise.race([request,new Promise((_,reject)=>{timer=setTimeout(()=>reject(fail('RPC_TIMEOUT')),8000)})])}
  finally{clearTimeout(timer)}
 }
 async function fresh(c){
  const result=await boundedRpc(window.SVRpc.getProgress({expectedUserId:c.userId}));requireCurrent(c);
  c.snapshot=validate(result);c.status='ready';c.receivedAt=new Date().toISOString();
  await compatible(c);requireCurrent(c);publish(c);
 }
 async function prepareWriter(){
  const c=context;
  if(!writeEnabled||!c||!current(c)||c.status!=='ready')return;
  try{await lock(c,async()=>{await compatible(c);requireCurrent(c);publish(c)})}
  catch(e){if(current(c)){writerReady=null;notify(e.code||'WRITE_PRECHECK_FAILED')}return}
  void reportActivity(c);void flush();
 }
 async function flush(){
  const c=context;
  if(!writeEnabled||!c||!current(c)||writerReady!==c)return;
  if(draining)return draining;
  draining=lock(c,async()=>{
   await fresh(c);
   const pending=(await rows()).filter(r=>r.userId===c.userId&&!['applied','cancelled'].includes(r.status));
   for(const row of pending){
    requireCurrent(c);
    if(row.status==='conflict')throw fail(JSON.parse(row.eventJson).type==='favorite_set'?'FAVORITE_CONFLICT':'WORD_STATE_CONFLICT');
    if(row.status==='blocked')throw fail('EVENT_REJECTED');
    if(row.contentVersion!==c.snapshot.content_version)throw fail('CONTENT_VERSION_MISMATCH');
    const eventType=JSON.parse(row.eventJson).type;
    if(['unmark_known','review_grade'].includes(eventType)&&!c.snapshot.capabilities.includes(eventType))throw fail('FEATURE_UNAVAILABLE');
    for(let attempt=0;attempt<2;attempt++){
     requireCurrent(c);await compatible(c);
     try{
      const result=await boundedRpc(window.SVRpc.applyEvent({expectedUserId:c.userId,eventId:row.eventId,
       expectedRevision:row.expectedRevision,event:JSON.parse(row.eventJson)}));
      requireCurrent(c);
      const snapshot=validate(result?.progress);
      if(typeof result.duplicate!=='boolean'||!count(result.applied_revision)||
       result.applied_revision===0||result.applied_revision>snapshot.revision)throw fail('INVALID_PROGRESS_RESPONSE');
      if(snapshot.content_version!==row.contentVersion)throw fail('CONTENT_VERSION_MISMATCH');
      // Record ACK before publishing; a crash before this commit retries the same UUID.
      row.status='applied';row.appliedRevision=result.applied_revision;await put(row);
      requireCurrent(c);c.snapshot=snapshot;await compatible(c);publish(c);await reportActivity(c,JSON.parse(row.eventJson));break;
     }catch(e){
      requireCurrent(c);
      if(e.code==='40001'){
       await fresh(c);
       const type=JSON.parse(row.eventJson).type;
       if(type==='favorite_set'||type==='unmark_known'||(type==='mark_known'&&c.snapshot.capabilities.includes('unmark_known'))){
        row.status='conflict';await put(row);throw fail(type==='favorite_set'?'FAVORITE_CONFLICT':'WORD_STATE_CONFLICT');
       }
       row.expectedRevision=c.snapshot.revision;await put(row);
       if(attempt===1)throw fail('REVISION_RETRY_PENDING');
      }else{
       if(['22023','23505','P0001'].includes(e.code)){row.status='blocked';await put(row)}
       throw e;
      }
     }
    }
   }
  }).catch(e=>{if(current(c))notify(e.code||'NETWORK_OR_RPC_ERROR')}).finally(()=>{
   draining=null;
   if(current(c))void reportActivity(c);
   if(context!==c){void flush()}
   if(current(c)&&writerReady===c&&!retryTimer&&!['FEATURE_UNAVAILABLE','FAVORITE_CONFLICT','WORD_STATE_CONFLICT','EVENT_REJECTED','CONTENT_VERSION_MISMATCH','LOCAL_PROGRESS_CONFLICT'].includes(writeError)){retryTimer=setTimeout(()=>{retryTimer=null;void flush()},15000)}
  });
  return draining;
 }
 async function enqueue(type,wordId,value){
  const c=context;
  try{
   if(!writeEnabled||!c||writerReady!==c)throw fail('CLOUD_NOT_READY');
   await lock(c,async()=>{
    await compatible(c);requireCurrent(c);
    if(!previewCatalog?.().words.includes(wordId)||!['favorite_set','mark_known','unmark_known','mark_review','review_grade'].includes(type)||
     (['favorite_set','review_grade'].includes(type)&&typeof value!=='boolean'))throw fail('INVALID_EVENT');
    if(['unmark_known','review_grade'].includes(type)&&!c.snapshot.capabilities.includes(type))throw fail('FEATURE_UNAVAILABLE');
    const pending=(await rows()).filter(r=>r.userId===c.userId&&!['applied','cancelled'].includes(r.status));
    if(pending.some(r=>r.status==='conflict'||r.status==='blocked'))throw fail('QUEUE_REQUIRES_REVIEW');
    const sameWord=pending.filter(r=>JSON.parse(r.eventJson).data.word_id===wordId);
    const knownIntent=['mark_known','unmark_known'].includes(type);
    if(knownIntent&&sameWord.some(r=>['mark_known','unmark_known'].includes(JSON.parse(r.eventJson).type)))return;
    if(type==='mark_known'&&c.snapshot.state.known.includes(wordId))return;
    if(type==='unmark_known'&&!c.snapshot.state.known.includes(wordId))return;
    if(['mark_review','review_grade'].includes(type)&&sameWord.some(r=>['mark_review','review_grade'].includes(JSON.parse(r.eventJson).type)))return;
    if(type==='favorite_set'&&pending.some(r=>{const e=JSON.parse(r.eventJson);return e.type===type&&e.data.word_id===wordId}))return;
    const event={type,occurred_at:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
     data:type==='favorite_set'?{word_id:wordId,value}:type==='review_grade'?{word_id:wordId,correct:value}:{word_id:wordId}};
    await storage('events','readwrite',s=>s.add({userId:c.userId,eventId:crypto.randomUUID(),eventJson:JSON.stringify(event),
     contentVersion:c.snapshot.content_version,expectedRevision:Math.max(c.snapshot.revision,...pending.map(r=>r.expectedRevision+1)),status:'pending'}));
    requireCurrent(c);
   });
   await reportActivity(c);
   void flush();return true;
  }catch(e){if(c&&current(c))notify(e.code||'QUEUE_STORAGE_FAILED');return false}
 }
 // Session events use the same durable, ordered, identity-scoped queue as words.
 // The caller retains the immutable event/UUID before enqueueing, so a crash or
 // lost response can only retry that event, never award a second answer.
 async function enqueueSession(eventId,event){
  const c=context;
  try{
   if(!writeEnabled||!c||writerReady!==c)throw fail('CLOUD_NOT_READY');
   await lock(c,async()=>{
    await compatible(c);requireCurrent(c);
    if(!/^[0-9a-f-]{36}$/i.test(eventId)||!['session_start','answer','session_finish','session_abandon'].includes(event?.type))throw fail('INVALID_EVENT');
    const body=JSON.stringify(event),stored=(await rows()).filter(r=>r.userId===c.userId);
    const existing=stored.find(r=>r.eventId===eventId);
    if(existing){if(existing.eventJson!==body)throw fail('EVENT_ID_REUSED');if(['blocked','conflict','cancelled'].includes(existing.status))throw fail('QUEUE_REQUIRES_REVIEW');return}
    const pending=stored.filter(r=>!['applied','cancelled'].includes(r.status));
    if(pending.some(r=>['conflict','blocked'].includes(r.status)))throw fail('QUEUE_REQUIRES_REVIEW');
    if(event.type==='session_start'&&event.data.content_version!==c.snapshot.content_version)throw fail('CONTENT_VERSION_MISMATCH');
    await storage('events','readwrite',store=>store.add({userId:c.userId,eventId,eventJson:body,
     contentVersion:c.snapshot.content_version,expectedRevision:Math.max(c.snapshot.revision,...pending.map(r=>r.expectedRevision+1)),status:'pending'}));
    requireCurrent(c);
   });
   await reportActivity(c);void flush();return true;
  }catch(e){if(c&&current(c))notify(e.code||'QUEUE_STORAGE_FAILED');return false}
 }
 // Explicit settings changes share the event writer's cross-tab lock, but do
 // not import, overwrite or require a match with device learning progress.
 let pendingSetting=null;
 async function updateLevel(level){
  if(!['A','B','C','D'].includes(level))throw fail('INVALID_LEVEL');
  await sync({retry:true});const c=context;
  if(!c||!current(c)||c.status!=='ready')throw fail('CLOUD_NOT_READY');
  return lock(c,async()=>{
   requireCurrent(c);
   if(!pendingSetting||pendingSetting.userId!==c.userId||pendingSetting.level!==level)
    pendingSetting={userId:c.userId,level,id:crypto.randomUUID(),event:{type:'settings_update',occurred_at:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,data:{level}}};
   const intent=pendingSetting;
   for(let attempt=0;attempt<2;attempt++){
    const latest=validate(await window.SVRpc.getProgress({expectedUserId:c.userId}));requireCurrent(c);
    try{
     const result=await window.SVRpc.applyEvent({expectedUserId:c.userId,eventId:intent.id,expectedRevision:latest.revision,event:intent.event});
     requireCurrent(c);const snapshot=validate(result?.progress);
     if(typeof result.duplicate!=='boolean'||!count(result.applied_revision)||result.applied_revision<1||result.applied_revision>snapshot.revision)throw fail('INVALID_PROGRESS_RESPONSE');
     c.snapshot=snapshot;c.receivedAt=new Date().toISOString();deliverSnapshot(c);pendingSetting=null;
     if(snapshot.state.settings.level!==level)throw fail('SETTINGS_CHANGED_ELSEWHERE');
     return level;
    }catch(e){if(e.code!=='40001'||attempt===1)throw e}
   }
  });
 }
 async function refresh(){
  const c=context;if(!c||!current(c))return;
  await lock(c,async()=>{const snapshot=validate(await window.SVRpc.getProgress({expectedUserId:c.userId}));requireCurrent(c);c.snapshot=snapshot;c.status='ready';c.receivedAt=new Date().toISOString();deliverSnapshot(c)});
 }
 window.addEventListener('focus',()=>{void refresh().catch(()=>{})});
 // Inspection never creates/upgrades a database or starts the writer/RPC.
 async function inspectQueue(){
  if(typeof indexedDB==='undefined')return {status:'unavailable',error:'QUEUE_STORAGE_UNAVAILABLE'};
  if(typeof indexedDB.databases!=='function')return {status:'unsupported',error:'DATABASE_ENUMERATION_UNAVAILABLE'};
  try{
   const databases=await indexedDB.databases();
   const info=databases.find(db=>db.name==='sv-cloud-events-v1');
   if(!info)return {status:'absent',name:'sv-cloud-events-v1',events:[]};
   return await new Promise(resolve=>{
    let finished=false,db;
    const done=value=>{if(finished)return;finished=true;clearTimeout(timer);db?.close();resolve(value)};
    const timer=setTimeout(()=>done({status:'blocked',error:'QUEUE_STORAGE_TIMEOUT'}),2000);
    const req=indexedDB.open(info.name);
    req.onupgradeneeded=()=>{req.transaction.abort();done({status:'absent',events:[]})};
    req.onblocked=()=>done({status:'blocked',error:'QUEUE_STORAGE_BLOCKED'});
    req.onerror=()=>done({status:'error',error:'QUEUE_STORAGE_UNAVAILABLE'});
    req.onsuccess=()=>{
     db=req.result;
     if(finished){db.close();return}
     db.onversionchange=()=>db.close();
     if(!db.objectStoreNames.contains('events')){done({status:'error',error:'QUEUE_SCHEMA_MISMATCH'});return}
     try{
      const tx=db.transaction('events','readonly'),read=tx.objectStore('events').getAll();let events;
      read.onsuccess=()=>{events=read.result};
      tx.oncomplete=()=>done({status:'ready',name:db.name,version:db.version,events});
      tx.onerror=tx.onabort=()=>done({status:'error',error:'QUEUE_STORAGE_FAILED'});
     }catch(_){done({status:'error',error:'QUEUE_STORAGE_FAILED'})}
    };
   });
  }catch(_){return {status:'error',error:'QUEUE_STORAGE_UNAVAILABLE'}}
 }
 async function queueStatus(){
  const c=context,inspection=await inspectQueue();
  const {events:stored=[],...storage}=inspection;
  // Recheck identity after the asynchronous read; never show another account.
  const active=!!c&&current(c);
  const events=active?stored.filter(r=>r.userId===c.userId).map(r=>{
   let event;try{event=JSON.parse(r.eventJson)}catch(_){}
   return {eventId:r.eventId,type:event?.type??null,wordId:event?.data?.word_id??null,
    status:r.status,expectedRevision:r.expectedRevision,appliedRevision:r.appliedRevision};
  }):[];
  return {enabled:writeEnabled,ready:active&&writerReady===c,error:active?writeError:null,storage,events};
 }
 async function diagnostics(){
  let flag;try{flag=localStorage.getItem('sv-cloud-write-dev-v1')}catch(_){flag='unavailable'}
  const loopback=['127.0.0.1','localhost','[::1]'].includes(location.hostname)&&['http:','https:'].includes(location.protocol);
  return {moduleVersion,scriptUrl,loopback,flag,writeEnabled,reloadRequired:(loopback&&flag==='enabled')!==writeEnabled,
   webLocks:typeof navigator.locks?.request==='function',
   serviceWorker:navigator.serviceWorker?.controller?.scriptURL??null,queue:await queueStatus()};
 }
 // Explicit local conflict acknowledgement: retain the old event as cancelled.
 // User must inspect fresh state and click the desired favorite in the UI again.
 async function acknowledgeConflict(eventId){
  const c=context;if(!writeEnabled||!c||writerReady!==c)throw fail('CLOUD_NOT_READY');
  await lock(c,async()=>{
   await fresh(c);
   const row=(await rows()).find(r=>r.userId===c.userId&&r.eventId===eventId&&r.status==='conflict');
   if(!row)throw fail('CONFLICT_NOT_FOUND');row.status='cancelled';await put(row);
  });void flush();
 }
 // Explicit UI recovery keeps receipts, bodies and IDs intact.
 async function retrySaving(){
  const c=context;
  if(c&&current(c)&&writerReady===c){
   try{await lock(c,async()=>{
    await fresh(c);
    for(const row of await rows()){
     requireCurrent(c);
     if(row.userId===c.userId&&row.status==='blocked'&&row.contentVersion===c.snapshot.content_version){row.status='pending';await put(row)}
    }
   })}catch(e){if(current(c))notify(e.code||'NETWORK_OR_RPC_ERROR');return}
  }
  await wakeWriter();
 }
 async function acceptCurrentChanges(kind='favorite'){
  const c=context;if(!c||!current(c)||writerReady!==c)return;
  try{await lock(c,async()=>{
   await fresh(c);
   for(const row of await rows()){
    requireCurrent(c);
    if(row.userId===c.userId&&row.status==='conflict'&&((JSON.parse(row.eventJson).type==='favorite_set')===(kind==='favorite'))){row.status='cancelled';await put(row)}
   }
  });await reportActivity(c);await flush()}
  catch(e){if(current(c))notify(e.code||'NETWORK_OR_RPC_ERROR')}
 }
 async function wakeWriter(){
  const c=context;if(!c||!current(c))return;
  if(c.status==='error')await sync({retry:true});
  else if(writerReady!==c)await prepareWriter();
  await flush();
 }
 window.addEventListener('online',wakeWriter);
 window.addEventListener('focus',wakeWriter);

 window.SVProgress=Object.freeze({initialize,updateLevel,refresh,status:summary,writeEnabled,enqueue,enqueueSession,retry:retrySaving,acceptCurrentFavorites:()=>acceptCurrentChanges('favorite'),acceptCurrentWordState:()=>acceptCurrentChanges('known'),supports:type=>!!context&&current(context)&&context.snapshot?.capabilities.includes(type)===true,activity:()=>context&&current(context)?JSON.parse(JSON.stringify(activity)):{pending:[],error:null},writeStatus:()=>({ready:!!context&&current(context)&&writerReady===context,error:writeError})});
 // Local development summary only; no tokens, identities or raw state.
 if(['127.0.0.1','localhost','[::1]'].includes(location.hostname)&&['http:','https:'].includes(location.protocol)){
  window.SVProgressDebug=Object.freeze({status:summary,retry:async()=>{const result=await sync({retry:true});if(writeEnabled)await prepareWriter();return result},preview,moduleVersion,diagnostics,queue:queueStatus,flush,acknowledgeConflict});
 }
 // Explicit, synchronous local inspection. No RPC, storage write, normalization,
 // guest fallback, import payload or persistent report is produced here.
 function preview({includeGuest=false}={}){
  const c=context;
  if(!c||!current(c)||c.status!=='ready')return {status:'unavailable',reason:'CURRENT_ACCOUNT_CLOUD_SNAPSHOT_REQUIRED'};
  const catalog=previewCatalog?.();
  const lists={known:'words',favorites:'words',completed:'lessons',videos:'videos',booksRead:'books'};
  function inspect(key){
   let raw,s;
   try{raw=localStorage.getItem(key);s=raw===null?null:JSON.parse(raw)}catch(_){return {status:'unreadable',compatible:false,issues:['STORAGE_OR_JSON_ERROR']}}
   if(raw===null)return {status:'absent',compatible:false,issues:['NO_LOCAL_SNAPSHOT']};
   if(!record(s))return {status:'invalid',compatible:false,issues:['STATE_OBJECT_REQUIRED']};
   const issues=[],warnings=[];
   const issue=path=>issues.push(path);
   // Conservative byte bound for PostgreSQL jsonb text (spaces and escaping).
   const bytes=encodeURIComponent(JSON.stringify(s)).replace(/%[0-9A-F]{2}|[^%]/g,'x').length;
   if(bytes*6>2097152)issue('SNAPSHOT_SIZE_REQUIRES_SERVER_CHECK');
   if(!catalog||catalog.version!==c.snapshot.content_version)issue('CONTENT_VERSION_UNVERIFIED_OR_MISMATCH');
   for(const [field,kind] of Object.entries(lists)){
    const ids=s[field]===undefined?[]:s[field];
    if(!Array.isArray(ids)||ids.length>15000){issue(field);continue}
    const allowed=new Set(catalog?.[kind]||[]);
    if(ids.some(id=>typeof id!=='string'||!allowed.has(id)))issue(field+'.unknown_or_invalid_id');
    if(new Set(ids).size!==ids.length)warnings.push(field+'.duplicates');
   }
   for(const field of ['xp','answered','correct'])if(!count(s[field]??0)||(s[field]??0)>1000000000||s[field]===null)issue(field);
   if((s.correct??0)>(s.answered??0))issue('correct_exceeds_answered');
   const reviews=s.reviews===undefined?{}:s.reviews;
   if(!record(reviews))issue('reviews');
   else for(const [id,r] of Object.entries(reviews)){
    if(!catalog?.words.includes(id)||!record(r)||!count(r.due)||r.due>4102444800000||
     !count(r.interval)||r.interval>365000||!count(r.rep)||r.rep>100000||
     !Number.isFinite(r.ease)||r.ease<1.3||r.ease>3)issue('reviews.invalid_entry');
   }
   const activity=s.activity===undefined?{}:s.activity;
   if(!record(activity))issue('activity');
   else for(const [day,n] of Object.entries(activity)){
    const date=new Date(day+'T00:00:00Z');
    if(!/^\d{4}-\d\d-\d\d$/.test(day)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==day||
     day.startsWith('0000')||!count(n)||n>10000)issue('activity.invalid_day_or_count');
   }
   if(s.settings!==undefined){
    if(!record(s.settings))issue('settings');
    else{
     if(s.settings.language!=null&&!['ru','en','sv','uk'].includes(s.settings.language))issue('settings.language');
     if(s.settings.level!=null&&!['A','B','C','D'].includes(s.settings.level))issue('settings.level');
    }
   }
   if(s.profile!==undefined){
    if(!record(s.profile))issue('profile');
    else if(s.profile.name!=null&&(typeof s.profile.name!=='string'||Array.from(s.profile.name).length>70))issue('profile.name');
   }
   warnings.push('RPC_IMPORTS_ONLY_NAME_LANGUAGE_LEVEL; AVATAR_SPEED_TIMEZONE_NOT_APPLIED');
   const fields=new Set([...Object.keys(lists),'reviews','activity','xp','answered','correct','settings','profile']);
   if(Object.keys(s).some(k=>!fields.has(k)))warnings.push('EXTRA_FIELDS_ARCHIVED_ONLY');
   return {status:'present',compatible:issues.length===0,issues:[...new Set(issues)],warnings,summary:metrics(s),differences:diff(s,c.snapshot.state)};
  }
  function metrics(s){
   const result={};
   for(const field of ['xp','answered','correct'])result[field]=count(s[field]??0)?s[field]??0:null;
   for(const field of Object.keys(lists))result[field]=Array.isArray(s[field]??[])?new Set(s[field]??[]).size:null;
   result.accuracy=result.answered?Math.round(100*result.correct/result.answered):0;
   result.reviews=record(s.reviews??{})?Object.keys(s.reviews??{}).length:null;
   result.activeDays=record(s.activity??{})?Object.values(s.activity??{}).filter(n=>typeof n==='number'&&n>0).length:null;
   result.activity=record(s.activity??{})?JSON.parse(JSON.stringify(s.activity??{})):null;
   return result;
  }
  function diff(local,cloud){
   const result={};
   for(const field of Object.keys(lists)){
    if(!Array.isArray(local[field]??[])||(local[field]??[]).some(id=>typeof id!=='string'))continue;
    const a=new Set(local[field]??[]),b=new Set(cloud[field]);
    result[field]={localOnly:[...a].filter(id=>!b.has(id)).sort(),cloudOnly:[...b].filter(id=>!a.has(id)).sort(),shared:[...a].filter(id=>b.has(id)).sort()};
   }
   return result;
  }
  const account=inspect('sv-account-local-v1-'+c.userId);
  const guest=includeGuest===true?inspect('sv-guest-v2'):{status:'excluded'};
  if(!current(c))return {status:'unavailable',reason:'AUTH_CONTEXT_CHANGED'};
  return {status:'preview',readOnly:true,revision:c.snapshot.revision,content_version:c.snapshot.content_version,receivedAt:c.receivedAt,
   cloud:metrics(c.snapshot.state),account,guest,
   cautions:['NO_IMPORT_OR_MERGE_PERFORMED','EMPTY_ONLY_ELIGIBILITY_REQUIRES_SERVER_CHECK',
    'INDEPENDENT_ADDS_COUNTERS_AND_ACTIVITY; REQUIRES_EXPLICIT_NON_OVERLAP_CONFIRMATION',
    'CLOUD_FAVORITE_VIDEO_AND_REVIEW_INTENTS_WIN; SNAPSHOT_CANNOT_PREDICT_ALL_CONFLICTS',
    'COMPATIBILITY_IS_LOCAL_PREFLIGHT_ONLY; SERVER_VALIDATES_FINAL_IMPORT']};
 }
})();
