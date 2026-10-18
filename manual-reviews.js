/* Account-only manual queue. No localStorage/IndexedDB writes, no optimistic ACKs.
   Uncertain requests retain their UUID in memory until reconciled or identity changes. */
'use strict';
(() => {
 let context=null,listener=()=>{},started=false;
 const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
 const auth=()=>window.SVAuth?.getState();
 const current=c=>context===c&&auth()?.user?.id===c.userId&&auth()?.identityRevision===c.identityRevision;
 function emit(event){listener(event)}
 function validate(value){
  if(!value||!Number.isSafeInteger(value.revision)||value.revision<0||!Array.isArray(value.entries))throw Error('INVALID_QUEUE');
  const seen=new Set();
  const entries=value.entries.map(e=>{
   if(!e||typeof e.word_id!=='string'||!e.word_id.length||e.word_id.length>100||!uuid(e.version)||typeof e.active!=='boolean'||seen.has(e.word_id))throw Error('INVALID_QUEUE');
   seen.add(e.word_id);return {word_id:e.word_id,version:e.version,active:e.active};
  });
  return {entries,revision:value.revision};
 }
 function accept(c,queue){if(queue.revision>=c.revision){c.entries=queue.entries;c.revision=queue.revision}}
 function state(){
  const c=context;if(!c||!current(c))return {ready:false,entries:[],pending:[],error:null};
  return {ready:c.ready,entries:c.entries.map(e=>({...e})),pending:[...c.pending.keys()],error:c.error};
 }
 async function send(c,request){
  if(!current(c)||request.sending||navigator.onLine===false)return false;
  request.sending=true;
  try{
   const result=await window.SVRpc.reviewChange({expectedUserId:c.userId,...request.body});
   if(!current(c))return false;
   if(typeof result?.conflict!=='boolean'||typeof result.duplicate!=='boolean')throw Error('INVALID_QUEUE');
   const queue=validate(result.queue);
   c.serial++;accept(c,queue);c.ready=true;c.pending.delete(request.body.wordId);c.error=result.conflict?'conflict':null;
   emit(result.conflict?null:request.body);return !result.conflict;
  }catch(e){
   if(current(c)){
    if(['22023','23505','P0001','42501','42883','PGRST202'].includes(e.code))c.pending.delete(request.body.wordId);
    c.error=['42883','PGRST202'].includes(e.code)?'unavailable':'retry';emit();
   }
   return false;
  }finally{request.sending=false}
 }
 async function refresh(){
  const c=context;if(!c||!current(c)||c.loading||navigator.onLine===false)return;
  c.loading=true;const serial=++c.serial;
  try{
   const queue=validate(await window.SVRpc.reviewList({expectedUserId:c.userId}));
   if(current(c)&&serial===c.serial){accept(c,queue);c.ready=true;if(c.error!=='conflict')c.error=null;emit()}
  }catch(e){if(current(c)){c.error=['42883','PGRST202'].includes(e.code)?'unavailable':'retry';emit()}}
  finally{c.loading=false}
  if(current(c))for(const request of c.pending.values())await send(c,request);
 }
 async function change(action,wordId,expectedVersion){
  const c=context;
  if(!c||!current(c)||!c.ready||!['add','remove','remember','again'].includes(action))return false;
  if(c.pending.has(wordId))return false;
  if(navigator.onLine===false){c.error='offline';emit();return false}
  const row=c.entries.find(e=>e.word_id===wordId);
  if(action==='add'&&row?.active)return true;
  const request={body:{requestId:crypto.randomUUID(),wordId,action,version:expectedVersion===undefined?(row?.version??null):expectedVersion},sending:false};
  c.serial++;c.pending.set(wordId,request);c.error=null;emit();return send(c,request);
 }
 function identity(){
  const a=auth();
  if(!a?.user){context=null;emit();return}
  if(context?.userId===a.user.id&&context.identityRevision===a.identityRevision)return;
  context={userId:a.user.id,identityRevision:a.identityRevision,entries:[],revision:0,pending:new Map(),ready:false,error:null,serial:0,loading:false};
  emit();void refresh();
 }
 function initialize(onChange){
  listener=onChange||listener;
  if(started)return;started=true;
  window.SVAuth?.subscribe(identity);identity();
  window.addEventListener('online',()=>void refresh());
  window.addEventListener('focus',()=>void refresh());
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
  window.setInterval(()=>{if(!document.hidden)void refresh()},15000);
 }
 window.SVManualReviews=Object.freeze({initialize,state,refresh,change});
})();
