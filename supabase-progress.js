/* Read cloud progress through SVRpc only. Never applies it to local learning. */
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
  }).finally(()=>{c.pending=null}).then(()=>summary());
  return c.pending;
 }
 function initialize(options={}){
  if(typeof options.previewCatalog==='function')previewCatalog=options.previewCatalog;
  if(typeof options.onError==='function')onError=options.onError;
  if(!started){
   started=true;
   window.SVAuth.subscribe(()=>{void sync()});
   initializing=window.SVAuth.initialize().then(()=>sync());
  }
  return initializing;
 }
 window.SVProgress=Object.freeze({initialize});
 // Local development summary only; no tokens, identities or raw state.
 if(['127.0.0.1','localhost','[::1]'].includes(location.hostname)&&['http:','https:'].includes(location.protocol)){
  window.SVProgressDebug=Object.freeze({status:summary,retry:()=>sync({retry:true}),preview});
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
