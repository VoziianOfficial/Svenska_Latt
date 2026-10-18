-- Local disposable cluster only. Fixtures are deliberately created BEFORE upgrade.
create function public.test_quiz_ok(v boolean,msg text) returns void language plpgsql as $$
begin if v is distinct from true then raise exception 'FAIL: %',msg;end if;raise notice 'PASS: %',msg;end $$;
insert into auth.users(id,email) values('95000000-0000-0000-0000-000000000001','quiz-race@example.invalid'),
 ('95000000-0000-0000-0000-000000000002','quiz-tests@example.invalid');
insert into auth.users(id,email) values('95000000-0000-0000-0000-000000000003','quiz-legacy@example.invalid');
insert into public.sl_accounts(user_id,xp) values('95000000-0000-0000-0000-000000000003',123);
insert into public.sl_lessons(user_id,lesson_id,completed,best_percent) values('95000000-0000-0000-0000-000000000003','lesson-5',true,65);
-- Existing contract suite has populated XP, lessons, words, imports, study time and review queue.
create temp table quiz_preserved as select 'accounts' kind,jsonb_agg(to_jsonb(a) order by user_id) data from public.sl_accounts a
union all select 'words',jsonb_agg(to_jsonb(w) order by user_id,word_id) from public.sl_words w
union all select 'lessons',jsonb_agg(to_jsonb(l) order by user_id,lesson_id) from public.sl_lessons l
union all select 'study',jsonb_agg(to_jsonb(t)) from public.sl_study_days t;
\ir ../migrations/202610180010_quiz_rewards.sql
select public.test_quiz_ok((select data from quiz_preserved where kind='accounts') is not distinct from (select jsonb_agg(to_jsonb(a) order by user_id) from public.sl_accounts a),'migration preserves accounts, XP and revision');
select public.test_quiz_ok((select data from quiz_preserved where kind='words') is not distinct from (select jsonb_agg(to_jsonb(w) order by user_id,word_id) from public.sl_words w),'migration preserves known words, favorites and SRS');
select public.test_quiz_ok((select data from quiz_preserved where kind='lessons') is not distinct from (select jsonb_agg(to_jsonb(l) order by user_id,lesson_id) from public.sl_lessons l),'migration preserves historical lessons including 60 percent');
select public.test_quiz_ok((select data from quiz_preserved where kind='study') is not distinct from (select jsonb_agg(to_jsonb(t)) from public.sl_study_days t),'migration preserves study time');

-- Test-only helpers: never installed by the production migration.
create function public.test_quiz_event(kind text,d jsonb,eid uuid default gen_random_uuid()) returns jsonb
language plpgsql as $$
declare rev bigint;
begin
 select revision into rev from public.sl_accounts where user_id=auth.uid();
 return public.sl_apply_event(eid,coalesce(rev,0),jsonb_build_object('type',kind,'occurred_at','2026-10-16T10:00:00Z','timezone','Europe/Stockholm','data',d));
end $$;
create function public.test_quiz_prepare(qid text,score integer) returns uuid language plpgsql security definer set search_path='' as $$
declare sid uuid:=gen_random_uuid();bank jsonb;questions jsonb;entry record;i integer:=0;
begin
 bank:=sl_private.quiz_catalog()->qid;
 select jsonb_agg(jsonb_build_object('question_id',key) order by key) into questions
 from (select key from jsonb_object_keys(bank->'questions') key order by key limit (bank->>'count')::integer) q;
 perform public.test_quiz_event('session_start',jsonb_build_object('session_id',sid,'mode',split_part(qid,':',1),'context_id',substr(qid,strpos(qid,':')+1),'content_version',sl_private.manifest()->>'version','questions',questions));
 for entry in select value from jsonb_array_elements(questions) loop
  exit when i>=abs(score);
  perform public.test_quiz_event('answer',jsonb_build_object('session_id',sid,'question_index',i,'response',bank->'questions'->(entry.value->>'question_id')->>'answer'));i:=i+1;
 end loop;
 -- Negative score means deliberately unfinished.
 if score>=0 then
  while i<jsonb_array_length(questions) loop
   perform public.test_quiz_event('answer',jsonb_build_object('session_id',sid,'question_index',i,'response','wrong'));i:=i+1;
  end loop;
 end if;
 return sid;
end $$;
-- The test-only preparation helper reads the private bank as its owner.
-- Authenticated clients retain no direct access to the answer catalog.
select public.test_quiz_ok(not has_function_privilege('authenticated','sl_private.quiz_catalog()','execute'),'answer catalog has no client execution privilege');
set role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000002',false);
select public.sl_get_progress();
do $$ declare sid uuid; r jsonb; eid uuid; body jsonb;rev bigint; before jsonb;begin
 sid:=public.test_quiz_prepare('lesson:lesson-5',7);
 perform public.test_quiz_ok((public.sl_get_progress()->'state'->>'xp')::int=0,'7/10 answers award zero XP');
 r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(r->'quiz_result'->>'passed'='false' and r->'quiz_result'->>'xp'='0','7/10 is not passed, zero XP');
 sid:=public.test_quiz_prepare('lesson:lesson-5',8);
 eid:=gen_random_uuid();select revision into rev from public.sl_accounts where user_id=auth.uid();
 body:=jsonb_build_object('type','session_finish','occurred_at','2026-10-16T10:00:00Z','timezone','Europe/Stockholm','data',jsonb_build_object('session_id',sid));
 r:=public.sl_apply_event(eid,rev,body);
 perform public.test_quiz_ok(r->'quiz_result'->>'passed'='true' and r->'quiz_result'->>'xp'='35','8/10 passes, 35 XP once');
 r:=public.sl_apply_event(eid,rev,body);
 perform public.test_quiz_ok(r->>'duplicate'='true' and r->'quiz_result'->>'xp'='35' and r->'progress'->'state'->>'xp'='35','lost response replay returns original receipt without adding XP');
 begin perform public.sl_apply_event(eid,rev,jsonb_set(body,'{data,extra}','true'));raise exception 'expected failure';exception when sqlstate '22023' then null;end;
 begin perform public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));raise exception 'expected failure';exception when raise_exception then if sqlerrm='expected failure' then raise;end if;end;
 perform public.test_quiz_ok((public.sl_get_progress()->'state'->>'xp')::int=35,'double finish, different UUID cannot add XP');
 sid:=public.test_quiz_prepare('lesson:lesson-5',10);
 r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(r->'quiz_result'->>'xp'='0' and r->'quiz_result'->>'new_best'='true' and r->'progress'->'state'->'quizResults'->'lesson:lesson-5'->>'correct'='10','10/10 improves best without repeat XP');
 sid:=public.test_quiz_prepare('lesson:lesson-6',6);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(r->'quiz_result'->>'xp'='0','6/10 does not reserve new reward');
 sid:=public.test_quiz_prepare('lesson:lesson-6',9);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(r->'quiz_result'->>'xp'='35','6/10 then 9/10 receives reward once');
 sid:=public.test_quiz_prepare('lesson:lesson-7',-5);before:=public.sl_get_progress();
 begin perform public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));raise exception 'expected failure';exception when raise_exception then if sqlerrm='expected failure' then raise;end if;end;
 perform public.test_quiz_event('session_abandon',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(before->'state'->'xp'=public.sl_get_progress()->'state'->'xp','unfinished/abandoned quiz gives zero XP');
 -- A boolean assertion cannot bypass server grading.
 sid:=public.test_quiz_prepare('lesson:lesson-7',-1);
 begin perform public.test_quiz_event('answer',jsonb_build_object('session_id',sid,'question_index',1,'correct',true));raise exception 'expected failure';exception when sqlstate '22023' then null;end;
 r:=public.test_quiz_event('answer',jsonb_build_object('session_id',sid,'question_index',1,'response','wrong'));
 perform public.test_quiz_ok((select correct=1 from public.sl_sessions where user_id=auth.uid() and id=sid),'server checks response; client correct flag rejected');
 before:=public.sl_get_progress();
 begin perform public.test_quiz_event('answer',jsonb_build_object('session_id',sid,'question_index',1,'response','wrong'));raise exception 'expected failure';exception when unique_violation then null;end;
 perform public.test_quiz_ok(before=public.sl_get_progress(),'repeated answer with different UUID has no effects');
 perform public.test_quiz_ok((select count(*) from public.sl_quiz_results where user_id<>'95000000-0000-0000-0000-000000000002')=0,'RLS isolates quiz results');
end $$;
reset role;
-- Historical XP evidence must reserve the corresponding quiz without changing its best score.
select public.test_quiz_ok(not exists(select 1 from public.sl_sessions s join public.sl_events e on e.user_id=s.user_id and e.session_id=s.id
 where s.quiz_id is not null and e.xp_delta>0 and e.rules_version<>'quiz-rewards-v1'
 and not exists(select 1 from public.sl_quiz_results r where r.user_id=s.user_id and r.quiz_id=s.quiz_id and rewarded)),'all historical quiz XP is reserved without new credits');

set role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000003',false);
do $$ declare sid uuid;r jsonb;begin
 r:=public.sl_get_progress();
 perform public.test_quiz_ok(r->'state'->'completed' ? 'lesson-5' and r->'state'->'quizResults'->'lesson:lesson-5'->>'correct'='65000000','imported 65 percent achievement retained but not 80 percent pass');
 sid:=public.test_quiz_prepare('lesson:lesson-5',10);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(r->'quiz_result'->>'xp'='0' and r->'quiz_result'->>'already_rewarded'='true' and r->'progress'->'state'->>'xp'='123','legacy completion reserves bonus, improves score and keeps existing XP');
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000002',false);
do $$ declare sid uuid;r jsonb;id text;before_xp bigint;qs jsonb;v text;i int;begin
 foreach id in array array['book:book-1','topic:Быт и дела','video:ur-hitta1'] loop
  before_xp:=(public.sl_get_progress()->'state'->>'xp')::bigint;
  sid:=public.test_quiz_prepare(id,200);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
  perform public.test_quiz_ok((r->'quiz_result'->>'xp')::int=case when id like 'video:%' then 12 else 35 end,'trusted first reward: '||id);
  sid:=public.test_quiz_prepare(id,200);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
  perform public.test_quiz_ok(r->'quiz_result'->>'xp'='0' and (r->'progress'->'state'->>'xp')::bigint=before_xp+case when id like 'video:%' then 12 else 35 end,'no repeat reward: '||id);
 end loop;
 -- 8/11 is below 80; 9/11 is above it. No rounded threshold.
 sid:=public.test_quiz_prepare('lesson:lesson-2',8);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(r->'quiz_result'->>'passed'='false' and r->'quiz_result'->>'xp'='0','8/11 fails exact threshold');
 sid:=public.test_quiz_prepare('lesson:lesson-2',9);r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(r->'quiz_result'->>'passed'='true' and r->'quiz_result'->>'xp'='35','9/11 passes exact threshold');
 v:=public.sl_get_progress()->>'content_version';
 before_xp:=(public.sl_get_progress()->'state'->>'xp')::bigint;
 select jsonb_agg('{}'::jsonb) into qs from generate_series(1,10);
 sid:=gen_random_uuid();perform public.test_quiz_event('session_start',jsonb_build_object('session_id',sid,'mode','translation','content_version',v,'questions',qs));
 for i in 0..9 loop perform public.test_quiz_event('answer',jsonb_build_object('session_id',sid,'question_index',i,'correct',true));end loop;
 r:=public.test_quiz_event('session_finish',jsonb_build_object('session_id',sid));
 perform public.test_quiz_ok(r->'quiz_result'->>'xp'='0' and (r->'progress'->'state'->>'xp')::bigint=before_xp and r->'progress'->'state'->'quizResults'->'practice:translation'->>'correct'='10','random practice retains best/statistics but no XP');
 select jsonb_agg(jsonb_build_object('question_id','q0')) into qs from generate_series(1,10);
 begin perform public.test_quiz_event('session_start',jsonb_build_object('session_id',gen_random_uuid(),'mode','lesson','context_id','lesson-5','content_version',v,'questions',qs));raise exception 'expected failure';exception when sqlstate '22023' then null;end;
 perform public.test_quiz_ok(true,'duplicate question IDs cannot substitute for the whole test');
end $$;
reset role;
