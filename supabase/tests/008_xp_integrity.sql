-- Disposable local cluster ONLY. Never run these fixtures in Supabase.
create function public.test_xp_ok(v boolean,msg text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FAIL: %',msg;end if;raise notice 'PASS: %',msg;end $$;
create function public.test_xp_body(kind text,d jsonb) returns jsonb language sql as $$
 select jsonb_build_object('type',kind,'data',d,'timezone','Europe/Stockholm','occurred_at','2026-10-16T10:00:00Z')
$$;
create function public.test_xp_event(kind text,d jsonb,eid uuid default gen_random_uuid()) returns jsonb language plpgsql as $$
declare rev bigint;
begin
 select revision into rev from public.sl_accounts where user_id=auth.uid();
 return public.sl_apply_event(eid,coalesce(rev,0),public.test_xp_body(kind,d));
end $$;
insert into auth.users(id,email) values
 ('97000000-0000-0000-0000-000000000001','xp-history@example.invalid'),
 ('97000000-0000-0000-0000-000000000002','xp-events@example.invalid'),
 ('97000000-0000-0000-0000-000000000003','xp-quizzes@example.invalid'),
 ('97000000-0000-0000-0000-000000000004','xp-races@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000001',false);
select public.sl_get_progress();
-- Reproduce the import bypass before 012 using distinct hashes/UUIDs.
select public.sl_import_progress('97100000-0000-0000-0000-000000000001',0,'97200000-0000-0000-0000-000000000001',
 '{"xp":900,"known":["v-arbeta"],"completed":["lesson-40"],"profile":{"name":"Preserved name"}}','independent');
select public.sl_import_progress('97100000-0000-0000-0000-000000000002',1,'97200000-0000-0000-0000-000000000002','{"xp":901}','independent');
select public.test_xp_ok((public.sl_get_progress()->'state'->>'xp')::bigint=1801,'pre-012 independent import can repeatedly add client XP');
select public.test_xp_event('video_set','{"content_id":"v1","value":true}','97300000-0000-0000-0000-000000000001');
select public.test_xp_event('video_set','{"content_id":"v1","value":false}');
select public.test_xp_event('video_set','{"content_id":"v1","value":true}');
select public.test_xp_event('flash_grade','{"word_id":"v-prata","correct":false}');
select public.test_xp_event('flash_grade','{"word_id":"v-prata","correct":false}');
select public.test_xp_ok((public.sl_get_progress()->'state'->>'xp')::bigint=1815,'pre-012 video toggle and wrong flash both reproduce XP farming');
reset role;
-- Exact row preservation of every public sl_* table; only quiz reservations may change.
create temp table xp_preserved(table_name text primary key,data jsonb);
do $$ declare t record;v jsonb;begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'sl_%' loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',t.tablename) into v;
  insert into xp_preserved values(t.tablename,v);
 end loop;
end $$;
\ir ../migrations/202610180012_xp_integrity.sql

do $$ declare t record;v jsonb;begin
 for t in select * from xp_preserved where table_name<>'sl_quiz_results' loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',t.table_name) into v;
  perform public.test_xp_ok(t.data=v,'012 preserves all rows exactly: '||t.table_name);
 end loop;
 -- Existing rewarded rows stay byte-for-byte identical.
 perform public.test_xp_ok(not exists(
  select 1 from jsonb_array_elements((select data from xp_preserved where table_name='sl_quiz_results')) old
  where not exists(select 1 from public.sl_quiz_results r where to_jsonb(r)=old)),
  '012 preserves existing quiz results and best scores');
 perform public.test_xp_ok(exists(select 1 from public.sl_quiz_results where user_id='97000000-0000-0000-0000-000000000001'
  and quiz_id='lesson:lesson-40' and rewarded and legacy_reward),'post-010 imported completed lesson reserved with no new XP');
end $$;
-- Definition and ACL checks: no new table or definer entry point exposing raw counters.
select public.test_xp_ok(has_function_privilege('authenticated','public.sl_apply_event(uuid,bigint,jsonb)','execute')
 and has_function_privilege('authenticated','public.sl_import_progress(uuid,bigint,uuid,jsonb,text)','execute'),'authenticated may use reviewed public entry points');
select public.test_xp_ok(not has_function_privilege('anon','public.sl_apply_event(uuid,bigint,jsonb)','execute')
 and not has_function_privilege('anon','public.sl_import_progress(uuid,bigint,uuid,jsonb,text)','execute'),'anonymous execution denied');
select public.test_xp_ok(not has_function_privilege('authenticated','sl_private.import_progress_legacy(uuid,bigint,uuid,jsonb,text)','execute')
 and not has_function_privilege('anon','sl_private.import_progress_legacy(uuid,bigint,uuid,jsonb,text)','execute')
 and not has_schema_privilege('authenticated','sl_private','usage'),'legacy import and private schema inaccessible');
select public.test_xp_ok((select bool_and(prosecdef and proconfig @> array['search_path=""']) from pg_proc
 where oid in ('public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure,'public.sl_import_progress(uuid,bigint,uuid,jsonb,text)'::regprocedure)),
 'public writers retain SECURITY DEFINER and empty search_path');
select public.test_xp_ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname like 'sl_%' and c.relkind='r' and (not c.relrowsecurity
 or has_table_privilege('authenticated',c.oid,'insert,update,delete'))),'RLS enabled and direct client mutations denied on every sl table');
set role anon;
do $$ begin
 begin perform public.sl_apply_event(gen_random_uuid(),0,'{}');raise exception 'unexpected access';exception when insufficient_privilege then null;end;
 begin perform public.sl_import_progress(gen_random_uuid(),0,gen_random_uuid(),'{}','independent');raise exception 'unexpected access';exception when insufficient_privilege then null;end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000002',false);
do $$ declare i int;before jsonb;r jsonb;eid uuid:=gen_random_uuid();rev bigint;body jsonb;begin
 before:=public.sl_get_progress();
 for i in 1..20 loop
  perform public.test_xp_event('video_set','{"content_id":"v1","value":true}');
  perform public.test_xp_event('video_set','{"content_id":"v1","value":false}');
  perform public.test_xp_event('flash_grade','{"word_id":"v-arbeta","correct":false}');
 end loop;
 perform public.test_xp_ok(public.sl_get_progress()->'state'->'xp'=before->'state'->'xp','20 video toggles and wrong flash grades give zero XP');
 perform public.test_xp_ok(exists(select 1 from public.sl_words where user_id=auth.uid() and word_id='v-arbeta' and last_reviewed_at is not null and due_at is not null),'wrong flash still updates SRS');
 perform public.test_xp_event('flash_grade','{"word_id":"v-arbeta","correct":true}');
 for i in 1..10 loop
  perform public.test_xp_event('unmark_known','{"word_id":"v-arbeta"}');
  perform public.test_xp_event('mark_known','{"word_id":"v-arbeta"}');
  perform public.test_xp_event('flash_grade','{"word_id":"v-arbeta","correct":true}');
  perform public.test_xp_event('flash_grade','{"word_id":"v-arbeta","correct":false}');
  perform public.test_xp_event('review_grade','{"word_id":"v-arbeta","correct":true}');
 end loop;
 perform public.test_xp_ok((public.sl_get_progress()->'state'->>'xp')::int=8,'flash first knowledge and repeated unmark/relearn award 8 XP once');
 for i in 1..10 loop perform public.test_xp_event('book_read','{"content_id":"book-1"}');end loop;
 perform public.test_xp_ok((public.sl_get_progress()->'state'->>'xp')::int=28,'book read awards 20 once, independent of book quiz');
 for i in 1..5 loop
  perform public.test_xp_event('favorite_set','{"word_id":"v-arbeta","value":true}');
  perform public.test_xp_event('favorite_set','{"word_id":"v-arbeta","value":false}');
  perform public.test_xp_event('mark_review','{"word_id":"v-arbeta"}');
  perform public.test_xp_event('profile_update','{"name":"Still no bonus"}');
  perform public.test_xp_event('settings_update','{"level":"B"}');
 end loop;
 perform public.test_xp_ok((public.sl_get_progress()->'state'->>'xp')::int=28,'favorites, SRS, profile and settings give zero XP');
 select revision into rev from public.sl_accounts where user_id=auth.uid();
 body:=public.test_xp_body('mark_known','{"word_id":"v-prata"}');
 r:=public.sl_apply_event(eid,rev,body);before:=public.sl_get_progress();
 r:=public.sl_apply_event(eid,rev,body);
 perform public.test_xp_ok(r->>'duplicate'='true' and public.sl_get_progress()=before,'same UUID lost ACK returns receipt without any mutation');
 begin perform public.sl_apply_event(eid,rev,jsonb_set(body,'{data,word_id}','"v-arbeta"'));raise exception 'expected rejection';exception when sqlstate '22023' then null;end;
 begin perform public.sl_apply_event(gen_random_uuid(),rev,body);raise exception 'expected rejection';exception when sqlstate '40001' then null;end;
 perform public.test_xp_ok(public.sl_get_progress()=before,'UUID body mismatch and stale revision have no side effects');
 for i in 1..3 loop
  begin perform public.sl_import_progress(gen_random_uuid(),(before->>'revision')::bigint,gen_random_uuid(),jsonb_build_object('xp',1000000000,'nonce',i),'independent');raise exception 'expected rejection';exception when insufficient_privilege then null;end;
 end loop;
 perform public.test_xp_ok(public.sl_get_progress()=before,'different UUID/hash imports cannot add XP');
 r:=public.sl_import_progress('97100000-0000-0000-0000-000000000003',(before->>'revision')::bigint,'97200000-0000-0000-0000-000000000003','{"xp":999999}','archive_only');
 perform public.test_xp_ok(r->'progress'->'state'=before->'state','archive-only snapshot remains available without applying counters');
 before:=public.sl_get_progress();
 r:=public.sl_import_progress('97100000-0000-0000-0000-000000000003',0,'97200000-0000-0000-0000-000000000003','{"xp":999999}','archive_only');
 perform public.test_xp_ok(r->>'duplicate'='true' and public.sl_get_progress()=before,'archive lost ACK does not add a revision or XP');
 begin perform public.sl_import_progress('97100000-0000-0000-0000-000000000003',(before->>'revision')::bigint,'97200000-0000-0000-0000-000000000003','{"xp":999999}','independent');raise exception 'expected rejection';exception when insufficient_privilege then null;end;
 perform public.test_xp_ok(public.sl_get_progress()=before,'an archive cannot be promoted to mint counters');
 begin perform public.test_xp_event('mark_known','{"word_id":"v-prata","user_id":"97000000-0000-0000-0000-000000000001"}');raise exception 'expected rejection';exception when sqlstate '22023' then null;end;
 perform public.test_xp_ok(public.sl_get_progress()=before,'event cannot supply a different owner');

 perform public.test_xp_ok((select count(*) from public.sl_accounts where user_id<>'97000000-0000-0000-0000-000000000002')=0,'RLS hides other accounts');
 begin update public.sl_accounts set xp=999999 where user_id=auth.uid();raise exception 'expected rejection';exception when insufficient_privilege then null;end;
end $$;
-- New empty accounts also cannot inject their first unverified XP baseline.
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000004',false);
do $$ declare before jsonb;begin
 before:=public.sl_get_progress();
 begin perform public.sl_import_progress(gen_random_uuid(),0,gen_random_uuid(),'{"xp":1000000000}','empty_only');raise exception 'expected rejection';exception when insufficient_privilege then null;end;
 perform public.test_xp_ok(public.sl_get_progress()=before,'fresh-account empty_only cannot manufacture XP');
end $$;
-- Simulate relogin/account switch using new JWT subject on same connection.
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000001',false);
do $$ declare before jsonb;r jsonb;sid uuid;begin
 before:=public.sl_get_progress();
 perform public.test_xp_ok(before->'state'->>'xp'='1815','old XP including historical overpayments is retained');
 r:=public.sl_import_progress('97100000-0000-0000-0000-000000000001',0,'97200000-0000-0000-0000-000000000001',
  '{"xp":900,"known":["v-arbeta"],"completed":["lesson-40"],"profile":{"name":"Preserved name"}}','independent');
 perform public.test_xp_ok(r->>'duplicate'='true' and public.sl_get_progress()=before,'historical import lost ACK preserved without new credit');
 r:=public.sl_apply_event('97300000-0000-0000-0000-000000000001',2,public.test_xp_body('video_set','{"content_id":"v1","value":true}'));
 perform public.test_xp_ok(r->>'duplicate'='true' and public.sl_get_progress()=before,'historical video event replay keeps original receipt and XP');
 perform public.test_xp_event('unmark_known','{"word_id":"v-arbeta"}');
 perform public.test_xp_event('flash_grade','{"word_id":"v-arbeta","correct":true}');
 perform public.test_xp_ok(public.sl_get_progress()->'state'->'xp'=before->'state'->'xp','imported known word never rewarded again after account switch');
 sid:=public.test_quiz_prepare('lesson:lesson-40',200);
 r:=public.test_xp_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_xp_ok(r->'quiz_result'->>'xp'='0','late imported completed lesson cannot be rewarded again');
end $$;
reset role;
create function public.test_xp_quiz_ids() returns text[] language sql security definer set search_path='' as $$
 select array_agg(id order by id) from jsonb_object_keys(sl_private.quiz_catalog()) id
$$;
set role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000003',false);
do $$ declare id text;sid uuid;r jsonb;before_xp bigint;expected int;v text;begin
 perform public.sl_get_progress();
 sid:=public.test_quiz_prepare('lesson:lesson-5',7);r:=public.test_xp_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_xp_ok(r->'quiz_result'->>'xp'='0' and r->'quiz_result'->>'passed'='false','012 retains 70 percent failure');
 sid:=public.test_quiz_prepare('lesson:lesson-5',8);r:=public.test_xp_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_xp_ok(r->'quiz_result'->>'xp'='35' and r->'quiz_result'->>'passed'='true','012 retains exact 80 percent first reward');
 -- Catalog keys are supplied by a test-only definer, never exposed in production.
 for id in select unnest(public.test_xp_quiz_ids()) loop
  before_xp:=(public.sl_get_progress()->'state'->>'xp')::bigint;
  expected:=case when exists(select 1 from public.sl_quiz_results where user_id=auth.uid() and quiz_id=id and rewarded) then 0 when id like 'video:%' then 12 else 35 end;
  sid:=public.test_quiz_prepare(id,200);
  perform public.test_xp_ok((public.sl_get_progress()->'state'->>'xp')::bigint=before_xp,'012 answers give zero XP: '||id);
  r:=public.test_xp_event('session_finish',jsonb_build_object('session_id',sid));
  perform public.test_xp_ok((r->'quiz_result'->>'xp')::int=expected,'012 first trusted finish: '||id);
  sid:=public.test_quiz_prepare(id,200);r:=public.test_xp_event('session_finish',jsonb_build_object('session_id',sid));
  perform public.test_xp_ok(r->'quiz_result'->>'xp'='0' and (public.sl_get_progress()->'state'->>'xp')::bigint=before_xp+expected,'012 repeated quiz gives zero: '||id);
 end loop;
 before_xp:=(public.sl_get_progress()->'state'->>'xp')::bigint;
 sid:=public.test_quiz_prepare('lesson:lesson-5',7);r:=public.test_xp_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_xp_ok(r->'progress'->'state'->'quizResults'->'lesson:lesson-5'->>'correct'='10','lower retry never reduces best score');
 sid:=gen_random_uuid();v:=public.sl_get_progress()->>'content_version';
 perform public.test_xp_event('session_start',jsonb_build_object('session_id',sid,'mode','translation','content_version',v,'questions','[{}]'::jsonb));
 perform public.test_xp_event('answer',jsonb_build_object('session_id',sid,'question_index',0,'correct',true));
 r:=public.test_xp_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_xp_ok(r->'quiz_result'->>'xp'='0' and (public.sl_get_progress()->'state'->>'xp')::bigint=before_xp,'random practice still gives zero XP');
 perform public.test_xp_ok(public.sl_get_progress()->'capabilities' ? 'quiz_rewards_v1','quiz_rewards_v1 capability unchanged');
end $$;
reset role;
