-- TEST ONLY: disposable cluster created by scripts/test_supabase_local.py.
-- Never run fixtures against Supabase or any database containing real users.
-- Apply 006 over a populated five-migration schema, in the same psql connection.
create temp table sl_upgrade_before (kind text primary key, value jsonb);
create function pg_temp.ok(value boolean, message text) returns void
language plpgsql as $$ begin
  if value is distinct from true then raise exception 'FAIL: %',message; end if;
  raise notice 'PASS: %',message;
end $$;

insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000006','sl-upgrade@example.invalid');
insert into public.sl_accounts(user_id,xp,answered,correct,revision,legacy_activity)
 values('10000000-0000-0000-0000-000000000006',29,2,1,17,'{"2026-10-16":3}');
insert into public.sl_words(user_id,word_id,is_known,is_favorite,due_at)
 values('10000000-0000-0000-0000-000000000006','v-arbeta',true,true,'2026-10-20T10:00:00Z');
insert into public.sl_sessions(user_id,id,mode,content_version,questions,status,answered,correct,started_at,finished_at) values
 ('10000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000061','mixed',
 sl_private.manifest()->>'version','[{}]','active',0,0,'2026-10-16T10:00:00Z',null),
 ('10000000-0000-0000-0000-000000000006','30000000-0000-0000-0000-000000000062','mixed',
 sl_private.manifest()->>'version','[{}]','completed',1,1,'2026-10-15T10:00:00Z','2026-10-15T10:01:00Z');
insert into public.sl_lessons(user_id,lesson_id,completed,best_percent)
 values('10000000-0000-0000-0000-000000000006','lesson-1',true,100);
insert into public.sl_content(user_id,content_type,content_id,is_completed)
 values('10000000-0000-0000-0000-000000000006','book','book-1',true);
insert into public.sl_events(user_id,event_id,request,event_type,occurred_at,activity_date,timezone,
 xp_delta,activity_delta,answered_delta,correct_delta,revision)
 values('10000000-0000-0000-0000-000000000006','60000000-0000-0000-0000-000000000061',
 '{"type":"mark_known","data":{"word_id":"v-arbeta"}}','mark_known','2026-10-16T10:00:00Z','2026-10-16','UTC',8,1,0,0,17);
insert into public.sl_imports(user_id,import_id,source_id,snapshot_hash,snapshot,mode,applied_revision)
 values('10000000-0000-0000-0000-000000000006','40000000-0000-0000-0000-000000000061',
 '50000000-0000-0000-0000-000000000061',md5('{"xp":3}'::jsonb::text),'{"xp":3}','archive_only',16);

insert into sl_upgrade_before values ('manifest',sl_private.manifest());
select pg_temp.ok(sl_private.manifest()->>'version'='static-ce7dd1b7fad07d9d','upgrade starts at original manifest');
-- Capture ownership, ACL, OID, signature and execution settings before replacement.
insert into sl_upgrade_before select 'function',to_jsonb(p)-'prosrc' from pg_proc p
 where p.oid='sl_private.manifest()'::regprocedure;
do $$ declare t text; snapshot jsonb; begin
 foreach t in array array['sl_accounts','sl_words','sl_sessions','sl_lessons','sl_content','sl_events','sl_imports'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',t) into snapshot;
  insert into sl_upgrade_before values(t,snapshot);
 end loop;
end $$;

\ir ../migrations/202610170006_manifest_version.sql

select pg_temp.ok(sl_private.manifest()->>'version'='static-afaa62b7426e09a7','new manifest version');
select pg_temp.ok((sl_private.manifest()-'version')=(select value-'version' from sl_upgrade_before where kind='manifest'),
 'every ID, category and question count preserved');
select pg_temp.ok((select to_jsonb(p)-'prosrc' from pg_proc p where p.oid='sl_private.manifest()'::regprocedure)
 =(select value from sl_upgrade_before where kind='function'),'function OID, owner, ACL, signature and security settings preserved');
select pg_temp.ok(not has_function_privilege('anon','sl_private.manifest()','execute')
 and not has_function_privilege('authenticated','sl_private.manifest()','execute'),'private manifest execution stays denied');
do $$ declare t text; snapshot jsonb; begin
 foreach t in array array['sl_accounts','sl_words','sl_sessions','sl_lessons','sl_content','sl_events','sl_imports'] loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',t) into snapshot;
  perform pg_temp.ok(snapshot=(select value from sl_upgrade_before where kind=t),'all rows unchanged: '||t);
 end loop;
end $$;

-- Subsequent writes here are artificial test actions, rolled back below.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000006',true);
select pg_temp.ok(public.sl_get_progress()->>'content_version'='static-afaa62b7426e09a7','RPC exposes updated manifest');
select pg_temp.ok(public.sl_get_progress()->>'revision'='17','reading existing account preserves revision');
do $$ begin
 begin
  perform public.sl_apply_event('60000000-0000-0000-0000-000000000063',17,jsonb_build_object(
   'type','session_start','occurred_at','2026-10-16T10:00:00Z','timezone','UTC',
   'data',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000063','mode','mixed',
   'content_version','static-ce7dd1b7fad07d9d','questions','[{}]'::jsonb)));
  raise exception 'FAIL: old client unexpectedly accepted';
 exception when sqlstate 'P0001' then
  if position('unsupported_content_version' in sqlerrm)=0 then raise; end if;
  raise notice 'PASS: old version cannot start new sessions';
 end;
end $$;
select public.sl_apply_event('60000000-0000-0000-0000-000000000064',17,jsonb_build_object(
 'type','session_start','occurred_at','2026-10-16T10:00:00Z','timezone','UTC',
 'data',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000064','mode','mixed',
 'content_version','static-afaa62b7426e09a7','questions','[{}]'::jsonb)));
select pg_temp.ok(public.sl_get_progress()->>'revision'='18','new version starts session');
select public.sl_apply_event('60000000-0000-0000-0000-000000000065',18,jsonb_build_object(
 'type','answer','occurred_at','2026-10-16T10:01:00Z','timezone','UTC',
 'data',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000061','question_index',0,'correct',true)));
select public.sl_apply_event('60000000-0000-0000-0000-000000000066',19,jsonb_build_object(
 'type','session_finish','occurred_at','2026-10-16T10:02:00Z','timezone','UTC',
 'data',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000061')));
select pg_temp.ok(exists(select 1 from public.sl_sessions where id='30000000-0000-0000-0000-000000000061'
 and status='completed' and content_version='static-ce7dd1b7fad07d9d'), 'old active session can finish with historical version preserved');
rollback;
