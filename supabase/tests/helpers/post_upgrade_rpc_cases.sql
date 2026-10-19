-- TEST ONLY. Both ordered 012 -> 013 paths, after the shared SRS assertions.
begin;
create function pg_temp.rpc_ok(value boolean,msg text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',msg;end if;raise notice 'PASS: %',msg;end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000001',true);
create temp table rpc_before as select public.sl_get_progress() progress,public.sl_review_list() queue;
select pg_temp.rpc_ok((public.sl_apply_event('99100000-0000-0000-0000-000000000001',0,
  '{"type":"mark_known","occurred_at":"2026-10-16T10:00:00Z","timezone":"UTC","data":{"word_id":"v-arbeta"}}')->>'duplicate')::boolean,
  'pre-012 event UUID replay still returns original receipt after 013');
select pg_temp.rpc_ok((public.sl_review_change('99100000-0000-0000-0000-000000000003','v-arbeta','add')->>'duplicate')::boolean,
  'pre-012 manual queue receipt survives both migrations');
select pg_temp.rpc_ok(public.sl_get_progress()=(select progress from rpc_before)
  and public.sl_review_list()=(select queue from rpc_before),'historical event/queue ACK replay leaves all progress unchanged');
select public.sl_review_change('99200000-0000-0000-0000-000000000001','v-arbeta','remember','99100000-0000-0000-0000-000000000003');
select pg_temp.rpc_ok((select interval_days=365000 and repetitions=6 and is_known and is_favorite from public.sl_words where word_id='v-arbeta')
  and public.sl_get_progress()->'state'->>'xp'='8','pre-upgrade queued word grades at cap with historical XP and flags preserved');
select public.test_xp_event('profile_update','{"name":"After upgrade"}');
select public.test_xp_event('settings_update','{"language":"sv","level":"C","timezone":"Europe/Stockholm","speech_speed":"normal"}');
select pg_temp.rpc_ok(public.sl_get_progress()->'state'->'profile'->>'name'='After upgrade'
  and public.sl_get_progress()->'state'->'settings'->>'level'='C'
  and public.sl_get_progress()->'state'->>'xp'='8','profile/settings RPC events retain contract and do not award XP');
create temp table rpc_before_study as select public.sl_get_progress() progress;
select public.sl_study_settings(true,'Europe/Stockholm',0);
create temp table rpc_lease as select public.sl_study_open('99300000-0000-0000-0000-000000000001') value;
select pg_sleep(0.04);
select public.sl_study_commit('99300000-0000-0000-0000-000000000002','99300000-0000-0000-0000-000000000001',
  (select jsonb_build_array(jsonb_build_array((value->>'cursor_ms')::bigint,(value->>'cursor_ms')::bigint+10)) from rpc_lease));
select public.sl_study_commit('99300000-0000-0000-0000-000000000002','99300000-0000-0000-0000-000000000001',
  (select jsonb_build_array(jsonb_build_array((value->>'cursor_ms')::bigint,(value->>'cursor_ms')::bigint+10)) from rpc_lease));
select pg_temp.rpc_ok((public.sl_study_status()->'totals'->>'all')::bigint=10
  and public.sl_get_progress()=(select progress from rpc_before_study),'study open/commit/replay/status preserves progress and counts time once after 013');
select pg_temp.rpc_ok(public.sl_avatar_access(auth.uid()::text||'/avatar.webp')
  and not public.sl_avatar_access('00000000-0000-0000-0000-000000000001/avatar.webp'),'avatar helper retains account isolation');
select pg_temp.rpc_ok(public.sl_request_account_deletion((public.sl_get_progress()->>'revision')::bigint)->>'status'='pending_storage_cleanup',
  'deletion request RPC signature/status retained (disposable fixture, rolled back)');
rollback;
