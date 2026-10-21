-- Disposable local cluster only; invoked after the 012/013 upgrade tests.
-- A real pre-upgrade session has already answered legacy q0. Its rows and UUIDs
-- must survive; its finish event is intentionally delivered only after 014.
insert into auth.users(id,email) values('98000000-0000-0000-0000-000000000003','video-legacy@example.invalid');
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000003',false);
select public.test_quiz_prepare('video:ur-hitta1',-1);
select set_config('request.jwt.claim.sub','',false);
-- Durable offline starts, authored with the old question identity. These are
-- deliberately first delivered after 014, with their original UUID and body.
create temp table video_queued_starts as select gen_random_uuid() eid,gen_random_uuid() sid,cid
 from unnest(array['ur-hitta2','v1','v2','v4']) cid;
create temp table video_preserved(table_name text,data jsonb);
do $$ declare t record;v jsonb;begin
 for t in select tablename from pg_tables where schemaname='public' and tablename like 'sl_%' loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',t.tablename) into v;
  insert into video_preserved values(t.tablename,v);
 end loop;
end $$;
\ir ../migrations/202610190014_video_progress.sql
-- Reapplying is safe and does not alter data or API signatures.
\ir ../migrations/202610190014_video_progress.sql
do $$ declare t record;v jsonb;begin
 for t in select * from video_preserved loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',t.table_name) into v;
  perform public.test_xp_ok(t.data=v,'014 preserves every row: '||t.table_name);
 end loop;
end $$;
do $$ declare definition text;begin
 definition:=pg_get_functiondef('public.test_quiz_prepare(text,integer)'::regprocedure);
 execute replace(definition, ' perform public.test_quiz_event(''session_start''',
  ' questions:=coalesce(bank->''start_questions'',questions); perform public.test_quiz_event(''session_start''');
end $$;
select public.test_xp_ok(not has_function_privilege('anon','public.sl_get_progress()','execute') and has_function_privilege('authenticated','public.sl_get_progress()','execute'),'014 snapshot restricted to authenticated');
insert into auth.users(id,email) values('98000000-0000-0000-0000-000000000001','video-tests@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000001',false);
do $$ declare r jsonb;cid text;sid uuid;eid uuid;body jsonb;rev bigint;begin
 r:=public.sl_get_progress();
 perform public.test_xp_ok(r->'capabilities' ? 'video_set_v1' and r->'capabilities' ? 'video_quizzes_v3','014 advertises reviewed reversible zero-XP video contract');
end $$;
reset role;
create function public.test_all_video_progress() returns void language plpgsql security definer set search_path='' as $$
declare r jsonb;cid text;sid uuid;eid uuid;body jsonb;rev bigint;before_xp bigint;n integer;begin
 for cid in select jsonb_array_elements_text(sl_private.manifest()->'videos') loop
  r:=public.sl_get_progress();before_xp:=(r->'state'->>'xp')::bigint;
  r:=public.test_quiz_event('video_set',jsonb_build_object('content_id',cid,'value',true));
  perform public.test_xp_ok(r->'progress'->'state'->'videos' ? cid and (r->'progress'->'state'->>'xp')::bigint=before_xp,'watched, zero XP: '||cid);
  if sl_private.quiz_catalog() ? ('video:'||cid) then
   n:=(sl_private.quiz_catalog()->('video:'||cid)->>'count')::integer;
   sid:=public.test_quiz_prepare('video:'||cid,n);
   r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
   perform public.test_xp_ok(r->'quiz_result'->>'xp'='12' and r->'quiz_result'->>'passed'='true','video quiz gives 12 XP once: '||cid);
   before_xp:=before_xp+12;
   n:=(sl_private.quiz_catalog()->('video:'||cid)->>'count')::integer;
   sid:=public.test_quiz_prepare('video:'||cid,n);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
   perform public.test_xp_ok(r->'quiz_result'->>'xp'='0','repeat quiz gives zero XP: '||cid);
  end if;
  r:=public.sl_get_progress();rev:=(r->>'revision')::bigint;eid:=gen_random_uuid();
  body:=jsonb_build_object('type','video_set','occurred_at','2026-10-16T10:00:00Z','timezone','Europe/Stockholm','data',jsonb_build_object('content_id',cid,'value',false));
  r:=public.sl_apply_event(eid,rev,body);
  perform public.test_xp_ok(not (r->'progress'->'state'->'videos' ? cid) and (r->'progress'->'state'->>'xp')::bigint=before_xp,'undo viewed preserves XP: '||cid);
  r:=public.sl_apply_event(eid,rev,body);
  perform public.test_xp_ok(r->>'duplicate'='true' and (r->'progress'->'state'->>'xp')::bigint=before_xp,'lost ACK replays same receipt: '||cid);
  if sl_private.quiz_catalog() ? ('video:'||cid) then
   perform public.test_xp_ok(r->'progress'->'state'->'quizResults'->('video:'||cid)->>'correct'=n::text,'undo viewing preserves passed quiz: '||cid);
  end if;
 end loop;
end $$;
set role authenticated;
select public.test_all_video_progress();
reset role;

-- The historical one-question session finishes with the original answer and
-- reward identity. Expanding the quiz must not clear or strand its queue.
set role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000003',false);
do $$ declare sid uuid;r jsonb;begin
 select id into strict sid from public.sl_sessions where user_id=auth.uid() and status='active' and quiz_id='video:ur-hitta1';
 r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_xp_ok(r->'quiz_result'->>'xp'='12','pre-014 active session finishes without losing XP or queue');
 sid:=public.test_quiz_prepare('video:ur-hitta1',5);
 r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_xp_ok(r->'quiz_result'->>'xp'='0','expanded quiz shares historical reward reservation');
end $$;
reset role;
insert into auth.users(id,email) values('98000000-0000-0000-0000-000000000002','video-other@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000002',false);
do $$ declare r jsonb;eid uuid:=gen_random_uuid();body jsonb;rev bigint;sid uuid:=gen_random_uuid();begin
 r:=public.sl_get_progress();
 perform public.test_xp_ok(r->'state'->'videos'='[]'::jsonb and r->'state'->'quizResults'='{}'::jsonb and r->'state'->>'xp'='0','another account cannot read first account progress');
 perform public.test_xp_ok(not exists(select 1 from public.sl_events where user_id<>'98000000-0000-0000-0000-000000000002') and not exists(select 1 from public.sl_quiz_results where user_id<>'98000000-0000-0000-0000-000000000002'),'RLS hides foreign events and quiz results');
 begin update public.sl_accounts set xp=999;raise exception 'expected forbidden DML';exception when insufficient_privilege then null;end;
 begin perform sl_private.quiz_catalog();raise exception 'expected forbidden bank';exception when insufficient_privilege then null;end;
 begin perform sl_private.quiz_catalog_before_014();raise exception 'expected forbidden backup bank';exception when insufficient_privilege then null;end;
 perform public.test_xp_ok(true,'direct XP updates and both private banks denied to authenticated');
 -- Exactly 3/5 is failure; exactly 4/5 is success. Replay returns original receipt.
 sid:=public.test_quiz_prepare('video:ur-hitta2',3);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_xp_ok(r->'quiz_result'->>'passed'='false' and r->'quiz_result'->>'xp'='0','video 3/5 fails with zero XP');
 sid:=public.test_quiz_prepare('video:ur-hitta2',4);
 rev:=(public.sl_get_progress()->>'revision')::bigint;
 body:=jsonb_build_object('type','session_finish','occurred_at','2026-10-16T10:00:00Z','timezone','Europe/Stockholm','data',jsonb_build_object('session_id',sid));
 r:=public.sl_apply_event(eid,rev,body);
 perform public.test_xp_ok(r->'quiz_result'->>'passed'='true' and r->'quiz_result'->>'xp'='12','video 4/5 passes with 12 XP');
 r:=public.sl_apply_event(eid,rev,body);
 perform public.test_xp_ok(r->>'duplicate'='true' and r->'progress'->'state'->>'xp'='12','finish replay preserves receipt and exact XP');
 begin perform public.sl_apply_event(eid,rev,jsonb_set(body,'{data,session_id}',to_jsonb(gen_random_uuid())));raise exception 'expected reused UUID rejection';exception when sqlstate '22023' then null;end;
 begin perform public.sl_apply_event(gen_random_uuid(),rev,body);raise exception 'expected stale revision';exception when sqlstate '40001' then null;end;
 perform public.test_xp_ok(true,'changed-body UUID and stale second-device revision rejected');
 -- A short selection other than the explicitly supported legacy q0 cannot pass.
 begin
  perform public.test_quiz_event('session_start',jsonb_build_object('session_id',gen_random_uuid(),'mode','video','context_id','ur-hitta1','content_version',r->'progress'->>'content_version','questions','[{"question_id":"q1"}]'::jsonb));
  raise exception 'expected legacy subset rejection';
 exception when sqlstate '22023' then null;end;
 perform public.test_xp_ok(true,'one-question compatibility is restricted to exact historical q0');
 -- Replacement banks reject a five-question mixture containing legacy q0.
 begin
  perform public.test_quiz_event('session_start',jsonb_build_object('session_id',gen_random_uuid(),'mode','video','context_id','v1','content_version',r->'progress'->>'content_version','questions','[{"question_id":"q0"},{"question_id":"r014q1"},{"question_id":"r014q2"},{"question_id":"r014q3"},{"question_id":"r014q4"}]'::jsonb));
  raise exception 'expected mixed generation rejection';
 exception when sqlstate '22023' then null;end;
 perform public.test_xp_ok(true,'legacy answers cannot replace questions in a new five-question session');
 -- Neither a missing answer nor a fabricated session from another account works.
 sid:=public.test_quiz_prepare('video:ur-hitta3',-1);
 begin perform public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));raise exception 'expected incomplete rejection';exception when raise_exception then if sqlerrm='expected incomplete rejection' then raise;end if;end;
 begin perform public.test_quiz_event('session_finish',jsonb_build_object('session_id',gen_random_uuid()));raise exception 'expected foreign session rejection';exception when raise_exception then if sqlerrm='expected foreign session rejection' then raise;end if;end;
 perform public.test_xp_ok(true,'incomplete and unowned sessions cannot finish');
end $$;
select set_config('request.jwt.claim.sub','',false);
do $$ begin
 begin perform public.sl_get_progress();raise exception 'expected missing identity rejection';exception when sqlstate '28000' then null;end;
 perform public.test_xp_ok(true,'RPC requires a verified account identity');
end $$;
reset role;
set role anon;
do $$ begin
 begin perform public.sl_get_progress();raise exception 'expected anon denial';exception when insufficient_privilege then null;end;
 begin perform public.sl_apply_event(gen_random_uuid(),0,'{}');raise exception 'expected anon writer denial';exception when insufficient_privilege then null;end;
end $$;
reset role;
select public.test_xp_ok(true,'anonymous snapshot and event execution denied after 014');

reset role;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000003',false);
do $$ declare q record;body jsonb;r jsonb;rev bigint;begin
 for q in select * from video_queued_starts loop
  body:=jsonb_build_object('type','session_start','occurred_at','2026-10-18T10:00:00Z','timezone','Europe/Stockholm','data',jsonb_build_object('session_id',q.sid,'mode','video','context_id',q.cid,'content_version',sl_private.manifest()->>'version','questions','[{"question_id":"q0"}]'::jsonb));
  rev:=(public.sl_get_progress()->>'revision')::bigint;
  perform public.sl_apply_event(q.eid,rev,body);
  r:=public.sl_apply_event(q.eid,rev,body);
  perform public.test_xp_ok(r->>'duplicate'='true','queued legacy start preserves UUID/body: '||q.cid);
  perform public.test_quiz_event('answer',jsonb_build_object('session_id',q.sid,'question_index',0,'response',sl_private.quiz_catalog()->('video:'||q.cid)->'questions'->'q0'->>'answer'));
  r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',q.sid));
  perform public.test_xp_ok(r->'quiz_result'->>'passed'='true','queued legacy answer and finish survive: '||q.cid);
  r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',public.test_quiz_prepare('video:'||q.cid,5)));
  perform public.test_xp_ok(r->'quiz_result'->>'xp'='0','new five questions share old reward key: '||q.cid);
 end loop;
end $$;
