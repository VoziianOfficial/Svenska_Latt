/* RPC adapters. Only getProgress is connected to Auth; mutations remain explicit. */
'use strict';
(() => {
 const error=code=>Object.assign(new Error(code),{code});
 const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
 async function call(name,args,expectedUserId){
  if(!uuid(expectedUserId))throw error('EXPECTED_USER_ID_REQUIRED');
  const body=JSON.parse(JSON.stringify(args));
  const session=await window.SVAuth.getSession();
  if(session?.user?.id!==expectedUserId)throw error('AUTH_USER_MISMATCH');
  const revision=window.SVAuth.getState().identityRevision;
  const client=await window.SVSupabase.getClient();
  // Cached session.user is not a server-verified identity. Validate the exact
  // captured JWT before sending even an explicitly requested progress RPC.
  const verified=await client.auth.getUser(session.access_token);
  if(verified.error)throw verified.error;
  if(verified.data.user?.id!==expectedUserId)throw error('AUTH_USER_MISMATCH');
  if(window.SVAuth.getState().identityRevision!==revision)throw error('AUTH_CONTEXT_CHANGED');
  // Bind the request to the captured user's JWT, even if another tab changes
  // the SDK session before fetch. Never expose or persist that JWT ourselves.
  const result=await client.rpc(name,body).setHeader('Authorization',`Bearer ${session.access_token}`).retry(false);
  const current=window.SVAuth.getState();
  if(current.identityRevision!==revision||current.user?.id!==expectedUserId)throw error('AUTH_CONTEXT_CHANGED');
  if(result.error)throw result.error; // Preserve SQLSTATE, especially 40001/23505.
  return result.data;
 }
 function checkMutation(id,revision){
  if(!uuid(id)||!Number.isSafeInteger(revision)||revision<0)throw error('EVENT_ID_AND_REVISION_REQUIRED');
 }
 function getProgress({expectedUserId}={}){return call('sl_get_progress',{},expectedUserId)}
 function applyEvent({expectedUserId,eventId,expectedRevision,event}={}){
  checkMutation(eventId,expectedRevision);
  if(!event||typeof event!=='object'||Array.isArray(event))throw error('EVENT_REQUIRED');
  return call('sl_apply_event',{p_event_id:eventId,p_expected_revision:expectedRevision,p_event:event},expectedUserId);
 }
 function importProgress({expectedUserId,importId,sourceId,expectedRevision,state,mode='empty_only'}={}){
  checkMutation(importId,expectedRevision);
  if(!uuid(sourceId)||!state||typeof state!=='object'||Array.isArray(state)||!['empty_only','independent','archive_only'].includes(mode))throw error('INVALID_IMPORT');
  return call('sl_import_progress',{p_import_id:importId,p_expected_revision:expectedRevision,p_source_id:sourceId,p_state:state,p_mode:mode},expectedUserId);
 }
 function studyStatus({expectedUserId,month=null}={}){return call('sl_study_status',{p_month:month},expectedUserId)}
 function studySettings({expectedUserId,enabled,timezone,generation}={}){return call('sl_study_settings',{p_enabled:enabled,p_timezone:timezone,p_generation:generation},expectedUserId)}
 function studyOpen({expectedUserId,leaseId}={}){return call('sl_study_open',{p_lease_id:leaseId},expectedUserId)}
 function studyCommit({expectedUserId,id,leaseId,segments,close=false}={}){return call('sl_study_commit',{p_id:id,p_lease_id:leaseId,p_segments:segments,p_close:close},expectedUserId)}
 window.SVRpc=Object.freeze({getProgress,applyEvent,importProgress,studyStatus,studySettings,studyOpen,studyCommit});
})();
