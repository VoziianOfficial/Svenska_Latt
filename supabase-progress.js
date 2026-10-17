/* Validated cloud progress and opt-in stage-one event queue; RPC only. */
'use strict';
(() => {
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
  const snapshot=JSON.parse(JSON.stringify({revision:value.revision,content_version:value.content_version,state:s}));
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
  if(!auth.user){context=null;return Promise.resolve(summary())}
  if(!context||context.userId!==auth.user.id||context.identityRevision!==auth.identityRevision){
   context={userId:auth.user.id,identityRevision:auth.identityRevision,status:'idle',attempts:0,snapshot:null,error:null,receivedAt:null,pending:null};
  }
  const c=context;
  if(c.pending)return c.pending;
  if(c.status==='ready'||(c.status==='error'&&!retry))return Promise.resolve(summary());
  c.status='loading';c.error=null;c.attempts++;
  // Defer the read so pending is assigned before any Auth events it triggers.
  c.pending=Promise.resolve().then(()=>window.SVRpc.getProgress({expectedUserId:c.userId})).then(value=>{
   if(!current(c))return;
   c.snapshot=validate(value);c.receivedAt=new Date().toISOString();c.status='ready';
  }).catch(error=>{
   if(!current(c))return;
   c.snapshot=null;c.status='error';c.error=diagnostic(error);
   try{onError?.(c.error.message)}catch(_){}
  }).finally(()=>{c.pending=null}).then(async()=>{if(current(c))await prepareWriter();return summary()});
  return c.pending;
 }
 function initialize(options={}){
  if(typeof options.onSnapshot==='function')onSnapshot=options.onSnapshot;
  if(typeof options.previewCatalog==='function')previewCatalog=options.previewCatalog;
  if(typeof options.onError==='function')onError=options.onError;
  if(!started){
   started=true;
   window.SVAuth.subscribe(()=>{void sync()});
   initializing=window.SVAuth.initialize().then(()=>sync());
  }
  return initializing;
 }
 // Stage-one writer shares this module's validated cloud snapshot and Auth context.
 // The loopback-only flag is read once per page load. No production write switch.
 const writeEnabled=['127.0.0.1','localhost','[::1]'].includes(location.hostname)&&
  ['http:','https:'].includes(location.protocol)&&(()=>{try{return localStorage.getItem('sv-cloud-write-dev-v1')==='enabled'}catch(_){return false}})();
 let writerReady=null,writeError=null,dbPromise=null,draining=null,onSnapshot=null,retryTimer=null;
 const fail=code=>Object.assign(new Error(code),{code});
 function notify(code){
  writeError=code;
  const messages={LOCAL_PROGRESS_CONFLICT:'В аккаунте есть несовместимые или несинхронизированные локальные данные. Облачная запись остановлена; данные сохранены.',
   FAVORITE_CONFLICT:'Избранное изменилось на другом устройстве. Старое действие не применено. Откройте кабинет для проверки конфликта.',
   CONTENT_VERSION_MISMATCH:'Версии учебных материалов не совпадают. Облачная запись остановлена.'};
  try{onError?.(messages[code]||`Облачное сохранение приостановлено (${code}). Очередь сохранена.`)}catch(_){}
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
 function publish(c){
  requireCurrent(c);
  writerReady=c;writeError=null;
  onSnapshot?.(JSON.parse(JSON.stringify(c.snapshot.state)),c.userId);
 }
 async function fresh(c){
  const result=await window.SVRpc.getProgress({expectedUserId:c.userId});requireCurrent(c);
  c.snapshot=validate(result);c.status='ready';c.receivedAt=new Date().toISOString();
  await compatible(c);requireCurrent(c);publish(c);
 }
 async function prepareWriter(){
  const c=context;
  if(!writeEnabled||!c||!current(c)||c.status!=='ready')return;
  try{await lock(c,async()=>{await compatible(c);requireCurrent(c);publish(c)})}
  catch(e){if(current(c)){writerReady=null;notify(e.code||'WRITE_PRECHECK_FAILED')}return}
  void flush();
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
    if(row.status==='conflict')throw fail('FAVORITE_CONFLICT');
    if(row.status==='blocked')throw fail('EVENT_REJECTED');
    if(row.contentVersion!==c.snapshot.content_version)throw fail('CONTENT_VERSION_MISMATCH');
    for(let attempt=0;attempt<2;attempt++){
     requireCurrent(c);await compatible(c);
     try{
      const result=await window.SVRpc.applyEvent({expectedUserId:c.userId,eventId:row.eventId,
       expectedRevision:row.expectedRevision,event:JSON.parse(row.eventJson)});
      requireCurrent(c);
      const snapshot=validate(result?.progress);
      if(typeof result.duplicate!=='boolean'||!count(result.applied_revision)||
       result.applied_revision===0||result.applied_revision>snapshot.revision)throw fail('INVALID_PROGRESS_RESPONSE');
      if(snapshot.content_version!==row.contentVersion)throw fail('CONTENT_VERSION_MISMATCH');
      // Record ACK before publishing; a crash before this commit retries the same UUID.
      row.status='applied';row.appliedRevision=result.applied_revision;await put(row);
      requireCurrent(c);c.snapshot=snapshot;await compatible(c);publish(c);break;
     }catch(e){
      requireCurrent(c);
      if(e.code==='40001'){
       await fresh(c);
       if(JSON.parse(row.eventJson).type==='favorite_set'){
        row.status='conflict';await put(row);throw fail('FAVORITE_CONFLICT');
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
   if(context!==c){void flush()}
   if(current(c)&&writerReady===c&&!retryTimer&&!['FAVORITE_CONFLICT','EVENT_REJECTED','CONTENT_VERSION_MISMATCH','LOCAL_PROGRESS_CONFLICT'].includes(writeError)){retryTimer=setTimeout(()=>{retryTimer=null;void flush()},15000)}
  });
  return draining;
 }
 async function enqueue(type,wordId,value){
  const c=context;
  try{
   if(!writeEnabled||!c||writerReady!==c)throw fail('CLOUD_NOT_READY');
   await lock(c,async()=>{
    await compatible(c);requireCurrent(c);
    if(!previewCatalog?.().words.includes(wordId)||!['favorite_set','mark_known'].includes(type)||
     (type==='favorite_set'&&typeof value!=='boolean'))throw fail('INVALID_EVENT');
    const pending=(await rows()).filter(r=>r.userId===c.userId&&!['applied','cancelled'].includes(r.status));
    if(pending.some(r=>r.status==='conflict'||r.status==='blocked'))throw fail('QUEUE_REQUIRES_REVIEW');
    const event={type,occurred_at:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,
     data:type==='favorite_set'?{word_id:wordId,value}:{word_id:wordId}};
    await storage('events','readwrite',s=>s.add({userId:c.userId,eventId:crypto.randomUUID(),eventJson:JSON.stringify(event),
     contentVersion:c.snapshot.content_version,expectedRevision:Math.max(c.snapshot.revision,...pending.map(r=>r.expectedRevision+1)),status:'pending'}));
    requireCurrent(c);
   });
   try{onError?.('Действие сохранено в очереди. Ожидаем подтверждение Supabase.')}catch(_){}
   void flush();return true;
  }catch(e){if(c&&current(c))notify(e.code||'QUEUE_STORAGE_FAILED');return false}
 }
 async function queueStatus(){
  const c=context;if(!c||!current(c))return {enabled:writeEnabled,ready:false,error:null,events:[]};
  const events=writeEnabled?(await rows()).filter(r=>r.userId===c.userId).map(r=>({eventId:r.eventId,type:JSON.parse(r.eventJson).type,
   wordId:JSON.parse(r.eventJson).data.word_id,status:r.status,expectedRevision:r.expectedRevision,appliedRevision:r.appliedRevision})):[];
  requireCurrent(c);return {enabled:writeEnabled,ready:writerReady===c,error:writeError,events};
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
 async function wakeWriter(){
  if(!writeEnabled)return;
  const c=context;if(!c||!current(c))return;
  if(c.status==='error')await sync({retry:true});
  else if(writerReady!==c)await prepareWriter();
  await flush();
 }
 if(writeEnabled){
  window.addEventListener('online',wakeWriter);
  window.addEventListener('focus',wakeWriter);
 }

 window.SVProgress=Object.freeze({initialize,writeEnabled,enqueue,writeStatus:()=>({ready:!!context&&current(context)&&writerReady===context,error:writeError})});
 // Local development summary only; no tokens, identities or raw state.
 if(['127.0.0.1','localhost','[::1]'].includes(location.hostname)&&['http:','https:'].includes(location.protocol)){
  window.SVProgressDebug=Object.freeze({status:summary,retry:async()=>{const result=await sync({retry:true});if(writeEnabled)await prepareWriter();return result},preview,queue:queueStatus,flush,acknowledgeConflict});
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
