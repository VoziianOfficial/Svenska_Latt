-- Disposable PostgreSQL ONLY. Also proves 008 works before pending 007.
create function pg_temp.study_ok(value boolean,message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',message; end if; raise notice 'PASS: %',message; end $$;
create function pg_temp.study_fails(query text,code text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=code then raise notice 'PASS: rejected with %',code;return;end if;
    raise;
  end;
  raise exception 'FAIL: query unexpectedly succeeded: %',query;
end $$;
create temp table study_before as select jsonb_agg(to_jsonb(a)) body from public.sl_accounts a;
create temp table study_events_before as select jsonb_agg(to_jsonb(e)) body from public.sl_events e;
\ir ../migrations/202610180008_study_time.sql
select pg_temp.study_ok((select body from study_before) is not distinct from (select jsonb_agg(to_jsonb(a)) from public.sl_accounts a),'008 preserves all account fields, XP and revisions');
select pg_temp.study_ok((select body from study_events_before) is not distinct from (select jsonb_agg(to_jsonb(e)) from public.sl_events e),'008 preserves historical events');
insert into auth.users(id,email) values('81000000-0000-0000-0000-000000000001','study-a@example.invalid'),('81000000-0000-0000-0000-000000000002','study-b@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',false);
select pg_temp.study_ok(public.sl_study_status()->>'enabled'='false','default is explicit opt out');
select pg_temp.study_ok((public.sl_study_status()->'totals'->>'all')::bigint=0,'empty history has zero time');
select pg_temp.study_fails($q$select public.sl_study_open(gen_random_uuid())$q$,'42501');
select pg_temp.study_fails($q$select public.sl_study_settings(true,'Fake/Zone',0)$q$,'22023');
select public.sl_study_settings(true,'Europe/Stockholm',0);
select pg_temp.study_fails($q$select public.sl_study_settings(false,'UTC',0)$q$,'40001');
select pg_temp.study_ok((public.sl_study_open('82000000-0000-0000-0000-000000000001')->>'available')::boolean,'first device claims lease');
select pg_temp.study_ok(not (public.sl_study_open('82000000-0000-0000-0000-000000000002')->>'available')::boolean,'second device cannot claim concurrently');
select pg_temp.study_ok((public.sl_study_open('82000000-0000-0000-0000-000000000001')->>'available')::boolean,'lost claim response is retryable');
select pg_sleep(.02);
create temp table study_batch as select jsonb_build_array(jsonb_build_array(start_ms,start_ms+10)) segments from public.sl_study_leases where user_id=auth.uid();
select public.sl_study_commit('83000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001',(select segments from study_batch));
select public.sl_study_commit('83000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001',(select segments from study_batch));
select pg_temp.study_ok((public.sl_study_status()->'totals'->>'all')::bigint=10,'identical UUID retry counts once');
select pg_temp.study_fails($q$select public.sl_study_commit('83000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000001','[]')$q$,'22023');
select pg_temp.study_fails($q$select public.sl_study_commit(gen_random_uuid(),'82000000-0000-0000-0000-000000000001',(select segments from study_batch))$q$,'22023');
select pg_temp.study_fails($q$select public.sl_study_commit(gen_random_uuid(),'82000000-0000-0000-0000-000000000001',(select jsonb_build_array(jsonb_build_array(cursor_ms,cursor_ms+60000)) from public.sl_study_leases where user_id=auth.uid()))$q$,'22023');
select pg_temp.study_fails($q$select public.sl_study_commit(gen_random_uuid(),'82000000-0000-0000-0000-000000000001',(select jsonb_build_array(jsonb_build_array(end_ms-1000,end_ms)) from public.sl_study_leases where user_id=auth.uid()))$q$,'22023');
select pg_temp.study_fails($q$select public.sl_study_commit(gen_random_uuid(),'82000000-0000-0000-0000-000000000001','[[1.2,2]]')$q$,'22023');
select pg_temp.study_fails($q$insert into public.sl_study_days values(auth.uid(),current_date,999999)$q$,'42501');
select pg_temp.study_fails($q$update public.sl_study_preferences set enabled=false$q$,'42501');
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000002',false);
select pg_temp.study_ok((select count(*)=0 from public.sl_study_periods),'RLS hides A periods from B');
select pg_temp.study_ok((select count(*)=0 from public.sl_study_days),'RLS hides A totals from B');
select pg_temp.study_ok((select count(*)=0 from public.sl_study_receipts),'RLS hides A queue receipts from B');
select public.sl_study_settings(true,'UTC',0);
select pg_temp.study_fails($q$select public.sl_study_commit(gen_random_uuid(),'82000000-0000-0000-0000-000000000001','[]')$q$,'42501');
select set_config('request.jwt.claim.sub','81000000-0000-0000-0000-000000000001',false);
select public.sl_study_commit(gen_random_uuid(),'82000000-0000-0000-0000-000000000001','[]',true);
select pg_temp.study_ok((public.sl_study_open('82000000-0000-0000-0000-000000000002')->>'available')::boolean,'release lets another device claim');
select public.sl_study_settings(false,'Europe/Stockholm',1);
select pg_temp.study_fails($q$select public.sl_study_commit(gen_random_uuid(),'82000000-0000-0000-0000-000000000002','[]')$q$,'42501');
select pg_temp.study_ok((public.sl_study_status()->'totals'->>'all')::bigint=10,'disabling preserves history');
select public.sl_study_settings(true,'Europe/Stockholm',2);
reset role;
-- Historical server grants simulate offline delivery and exact DST/midnight boundaries.
insert into public.sl_study_leases(user_id,id,generation,timezone,start_ms,end_ms,cursor_ms,closed)
select '81000000-0000-0000-0000-000000000001','82000000-0000-0000-0000-000000000003',3,'Europe/Stockholm',
  floor(extract(epoch from clock_timestamp())*1000)::bigint-60000,
  floor(extract(epoch from clock_timestamp())*1000)::bigint-1000,
  floor(extract(epoch from clock_timestamp())*1000)::bigint-60000,false;
set role authenticated;
select public.sl_study_commit(gen_random_uuid(),'82000000-0000-0000-0000-000000000003',
 (select jsonb_build_array(jsonb_build_array(start_ms,start_ms+20000)) from public.sl_study_leases where id='82000000-0000-0000-0000-000000000003'));
select pg_temp.study_ok((public.sl_study_status()->'totals'->>'all')::bigint=20010,'offline batch in expired server grant accepted');
select pg_temp.study_ok((select end_ms < floor(extract(epoch from clock_timestamp())*1000) from public.sl_study_leases where id='82000000-0000-0000-0000-000000000003'),'late replay cannot renew an expired grant');
reset role;
-- Helper tests use B, whose history is empty; no wall-clock waiting or forged RPC clock.
select sl_private.study_add('81000000-0000-0000-0000-000000000002',
 (extract(epoch from timestamptz '2026-10-17 21:59:50+00')*1000)::bigint,
 (extract(epoch from timestamptz '2026-10-17 22:00:10+00')*1000)::bigint,'Europe/Stockholm');
select pg_temp.study_ok((select milliseconds=10000 from public.sl_study_days where user_id='81000000-0000-0000-0000-000000000002' and day='2026-10-17'),'Stockholm midnight first day exact 10 sec');
select pg_temp.study_ok((select milliseconds=10000 from public.sl_study_days where user_id='81000000-0000-0000-0000-000000000002' and day='2026-10-18'),'Stockholm midnight next day exact 10 sec');
select sl_private.study_add('81000000-0000-0000-0000-000000000002',
 (extract(epoch from timestamptz '2026-03-28 23:00+00')*1000)::bigint,
 (extract(epoch from timestamptz '2026-03-29 22:00+00')*1000)::bigint,'Europe/Stockholm');
select pg_temp.study_ok((select milliseconds=23*3600000 from public.sl_study_days where user_id='81000000-0000-0000-0000-000000000002' and day='2026-03-29'),'spring DST civil day is 23 hours');
select sl_private.study_add('81000000-0000-0000-0000-000000000002',
 (extract(epoch from timestamptz '2026-10-24 22:00+00')*1000)::bigint,
 (extract(epoch from timestamptz '2026-10-25 23:00+00')*1000)::bigint,'Europe/Stockholm');
select pg_temp.study_ok((select milliseconds=25*3600000 from public.sl_study_days where user_id='81000000-0000-0000-0000-000000000002' and day='2026-10-25'),'autumn DST civil day is 25 hours');
select pg_temp.study_ok(not has_function_privilege('anon','public.sl_study_status(date)','execute'),'anonymous RPC denied');
select pg_temp.study_ok(not has_function_privilege('authenticated','sl_private.study_add(uuid,bigint,bigint,text)','execute'),'aggregation helper is private');
select pg_temp.study_ok((select xp=0 and revision=0 from public.sl_accounts where user_id='81000000-0000-0000-0000-000000000001'),'time and consent never award XP or mutate progress revision');
