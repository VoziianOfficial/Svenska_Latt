/* Auth session is intentionally separate from app.js user/state and guest data. */
'use strict';
(() => {
 let initializing=null,client=null,session=null,subscription=null,identityRevision=0;
 let status='idle',lastEvent=null,callbackError=null;
 // Capture and scrub credentials before app.js reads the hash router.
 const callback=(() => {
  const url=new URL(location.origin+location.pathname+(location.search||'')+(location.hash||''));
  const hash=new URLSearchParams(url.hash.slice(1));
  const keys=['access_token','refresh_token','expires_in','expires_at','token_type','type','provider_token','provider_refresh_token','error','error_code','error_description'];
  const isHash=keys.some(key=>hash.has(key));
  const code=url.searchParams.get('code');
  const queryError=url.searchParams.get('error')||url.searchParams.get('error_code');
  if(!isHash&&!code&&!queryError)return null;
  const value={access_token:hash.get('access_token'),refresh_token:hash.get('refresh_token'),code,
   error:hash.get('error')||hash.get('error_code')||queryError};
  for(const key of [...keys,'code','sb_flow_id'])url.searchParams.delete(key);
  if(isHash)url.hash='profile';
  else if(!url.hash)url.hash='profile';
  history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  return value;
 })();
 const listeners=new Set();
 const error=code=>Object.assign(new Error(code),{code});
 function snapshot(){return Object.freeze({status,event:lastEvent,user:session?.user||null,identityRevision,callbackError})}
 function update(next,event){
  if((session?.user?.id||null)!==(next?.user?.id||null))identityRevision++;
  session=next||null;status=session?'signed_in':'signed_out';lastEvent=event;
  // Supabase's callback stays synchronous. Observers run outside its auth lock.
  const value=snapshot();setTimeout(()=>{for(const listener of listeners){try{listener(value)}catch(_){}}},0);
 }
 async function initialize(){
  if(initializing)return initializing;
  initializing=(async()=>{
   if(!window.SVSupabase?.configuration().configured){status='unconfigured';return snapshot()}
   status='initializing';
   try{
    client=await window.SVSupabase.getClient();
    let receivedEvent=false;
    if(!subscription){
     const result=client.auth.onAuthStateChange((event,next)=>{receivedEvent=true;update(next,event)});
     subscription=result.data.subscription;
    }
    if(callback&&!callback.processed){
     callback.processed=true;
     try{
      if(callback.error)throw error('AUTH_CALLBACK_FAILED');
      let result;
      if(callback.code)result=await client.auth.exchangeCodeForSession(callback.code);
      else if(callback.access_token&&callback.refresh_token)result=await client.auth.setSession({access_token:callback.access_token,refresh_token:callback.refresh_token});
      else throw error('AUTH_CALLBACK_FAILED');
      if(result.error)throw result.error;
      callbackError=null;update(result.data.session,'EMAIL_CONFIRMED');receivedEvent=true;
     }catch(_){callbackError='AUTH_CALLBACK_FAILED'}
     finally{callback.access_token=null;callback.refresh_token=null;callback.code=null}
    }
    const result=await client.auth.getSession();
    if(result.error)throw result.error;
    if(!receivedEvent)update(result.data.session,'INITIAL_SESSION');
   }catch(_){if(callback)callbackError='AUTH_CALLBACK_FAILED';status='unavailable';initializing=null}
   return snapshot();
  })();
  // If initialization failed synchronously, allow a later explicit retry.
  const result=await initializing;
  if(result.status==='unavailable'||result.status==='unconfigured')initializing=null;
  return result;
 }
 async function ready(){
  await initialize();
  if(!client||status==='unavailable'||status==='unconfigured')throw error('AUTH_UNAVAILABLE');
  return client;
 }
 async function getSession(){
  const active=await ready();const revision=identityRevision;
  const result=await active.auth.getSession();
  if(result.error)throw result.error;
  if(revision!==identityRevision)return session;
  update(result.data.session,'SESSION_READ');return result.data.session;
 }
 async function signUp({email,password,name=''}){
  const active=await ready();
  if(typeof email!=='string'||typeof password!=='string'||password.length<8||typeof name!=='string'||name.trim().length>70)throw error('INVALID_SIGNUP_INPUT');
  const result=await active.auth.signUp({email:email.trim(),password,
   options:{data:{display_name:name.trim()},emailRedirectTo:location.origin+location.pathname}});
  if(result.error)throw result.error;
  if(result.data.session)update(result.data.session,'SIGNED_IN');
  // A missing session normally means email confirmation is required, not failure.
  return result.data;
 }
 async function signIn({email,password}){
  const active=await ready();
  if(typeof email!=='string'||typeof password!=='string')throw error('INVALID_SIGNIN_INPUT');
  const result=await active.auth.signInWithPassword({email:email.trim(),password});
  if(result.error)throw result.error;
  update(result.data.session,'SIGNED_IN');return result.data;
 }
 async function signOut(){
  const active=await ready();
  const result=await active.auth.signOut({scope:'local'});
  if(result.error)throw result.error;
  update(null,'SIGNED_OUT');
 }
 function subscribe(listener){
  if(typeof listener!=='function')throw error('LISTENER_REQUIRED');
  listeners.add(listener);return ()=>listeners.delete(listener);
 }
 window.SVAuth=Object.freeze({initialize,getSession,signUp,signIn,signOut,subscribe,getState:snapshot});
})();
