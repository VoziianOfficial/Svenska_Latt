/* Read cloud progress through SVRpc only. Never applies it to local learning. */
'use strict';
(() => {
 let started=false,initializing=null,onError=null,context=null;
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
  window.SVProgressDebug=Object.freeze({status:summary,retry:()=>sync({retry:true})});
 }
})();
