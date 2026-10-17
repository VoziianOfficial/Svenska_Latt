/* Classic browser module: one pinned SDK/client, no learning-data storage. */
'use strict';
(() => {
 const SDK_VERSION='2.118.0';
 const SDK_URL=`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@${SDK_VERSION}/dist/umd/supabase.js`;
 let pending=null,client=null;
 const error=code=>Object.assign(new Error(code),{code});
 function configuration(){
  const conf=window.SV_SUPABASE||{},url=String(conf.url||'').trim().replace(/\/$/,''),key=String(conf.publishableKey||'').trim();
  const requested=Boolean(url||key);
  // Explicitly reject all secret and legacy JWT keys (including service_role).
  const configured=/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)&&/^sb_publishable_[A-Za-z0-9_-]+$/.test(key);
  return Object.freeze({requested,configured,url:configured?url:'',publishableKey:configured?key:''});
 }
 function loadSdk(){
  return new Promise((resolve,reject)=>{
   const node=document.createElement('script');let settled=false;
   const finish=(reason)=>{
    if(settled)return;settled=true;clearTimeout(timer);
    node.onload=null;node.onerror=null;
    if(reason){node.remove();reject(error(reason));return}
    if(!window.supabase?.createClient){node.remove();reject(error('SDK_UNAVAILABLE'));return}
    resolve(window.supabase);
   };
   const timer=setTimeout(()=>finish('SDK_TIMEOUT'),8000);
   node.src=SDK_URL;node.async=true;node.dataset.svSupabaseVersion=SDK_VERSION;
   node.onload=()=>finish();node.onerror=()=>finish('SDK_UNAVAILABLE');
   document.head.appendChild(node);
  });
 }
 async function getClient(){
  if(client)return client;
  if(pending)return pending;
  const conf=configuration();
  if(!conf.configured)throw error(conf.requested?'INVALID_PUBLIC_CONFIGURATION':'SUPABASE_NOT_CONFIGURED');
  pending=loadSdk().then(sdk=>{
   client=sdk.createClient(conf.url,conf.publishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false},
    // A preparation-stage outage must not silently retry progress mutations.
    db:{schema:'public'}
   });
   return client;
  }).catch(reason=>{pending=null;throw reason});
  return pending;
 }
 window.SVSupabase=Object.freeze({configuration,getClient,SDK_VERSION,SDK_URL,cloudProgressEnabled:false});
})();
