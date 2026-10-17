-- Portable SQL assertions: run with psql -X -v ON_ERROR_STOP=1.
-- Also usable on a disposable local Supabase database; no pgTAP required.
begin;
create schema sl_test;
grant usage on schema sl_test to authenticated,anon;
create function sl_test.ok(value boolean, message text) returns void
language plpgsql security invoker as $$ begin
  if value is distinct from true then raise exception 'FAIL: %',message; end if;
  raise notice 'PASS: %',message;
end $$;
create function sl_test.fails(statement text, expected_state text, expected_message text default '') returns void
language plpgsql security invoker as $$ begin
  begin
    execute statement;
  exception when others then
    if sqlstate<>expected_state or position(expected_message in sqlerrm)=0 then
      raise exception 'FAIL: expected % / %, got % / %',expected_state,expected_message,sqlstate,sqlerrm;
    end if;
    raise notice 'PASS: rejected % / %',expected_state,expected_message;
    return;
  end;
  raise exception 'FAIL: statement unexpectedly succeeded: %',statement;
end $$;
create function sl_test.event(kind text, data jsonb) returns jsonb language sql immutable as $$
  select jsonb_build_object('type',kind,'data',data,'occurred_at','2026-10-16T10:00:00Z','timezone','Europe/Stockholm')
$$;
create function sl_test.apply(kind text, data jsonb) returns jsonb
language plpgsql security invoker as $$ declare r bigint; begin
  r:=(public.sl_get_progress()->>'revision')::bigint;
  return public.sl_apply_event(gen_random_uuid(),r,sl_test.event(kind,data));
end $$;
grant execute on all functions in schema sl_test to anon,authenticated;

insert into auth.users(id,email) values
  ('10000000-0000-0000-0000-000000000001','sl-test-a@example.invalid'),
  ('10000000-0000-0000-0000-000000000002','sl-test-b@example.invalid');

select sl_test.ok(not exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname like 'sl\_%' escape '\' and c.relkind='r' and not c.relrowsecurity),'RLS on all seven tables');
select sl_test.ok((select count(*)=7 from information_schema.tables where table_schema='public' and table_name like 'sl\_%' escape '\'),'seven application tables');
select sl_test.ok(not has_schema_privilege('authenticated','sl_private','USAGE'),'private helpers inaccessible');
select sl_test.ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','sl_private') and (n.nspname='sl_private' or p.proname like 'sl_%')
  and has_function_privilege('anon',p.oid,'EXECUTE')),'anon has no application function EXECUTE');
select sl_test.ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='sl_private' and has_function_privilege('authenticated',p.oid,'EXECUTE')),'authenticated cannot execute private helpers');
select sl_test.ok(not exists(select 1 from information_schema.tables t where t.table_schema='public' and t.table_name like 'sl\_%' escape '\'
  and (has_table_privilege('authenticated','public.'||t.table_name,'INSERT')
    or has_table_privilege('authenticated','public.'||t.table_name,'UPDATE')
    or has_table_privilege('authenticated','public.'||t.table_name,'DELETE')
    or has_table_privilege('anon','public.'||t.table_name,'SELECT'))),'no direct application DML or anonymous reads');
select sl_test.ok(not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname like 'sl_%' and p.prosecdef and not coalesce('search_path=""'=any(p.proconfig),false)),'definer search_path is empty');
select sl_test.ok(not exists(select 1 from information_schema.tables where table_schema='public' and table_name='learning_progress'),'legacy table untouched/not created');
select sl_test.ok((select not public from storage.buckets where id='avatars'),'private bucket');

set local role anon;
select sl_test.fails('select public.sl_get_progress()','42501');
select sl_test.fails('select * from public.sl_accounts','42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select sl_test.fails('select public.sl_get_progress()','28000','authentication_required');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='0','empty account initializes');
select sl_test.fails($q$insert into public.sl_accounts(user_id) values('10000000-0000-0000-0000-000000000002')$q$,'42501');
select sl_test.fails('update public.sl_accounts set xp=999','42501');
select sl_test.fails('delete from public.sl_accounts','42501');
select sl_test.fails($q$select public.sl_apply_event(gen_random_uuid(),0,sl_test.event('mark_known','{"word_id":"not-a-word"}'))$q$,'22023','unknown_content_id');
select sl_test.fails($q$select public.sl_apply_event(gen_random_uuid(),0,sl_test.event('mark_known','{"word_id":"v-arbeta","xp":999}'))$q$,'22023','invalid_object_keys');

select public.sl_apply_event('20000000-0000-0000-0000-000000000001',0,sl_test.event('mark_known','{"word_id":"v-arbeta"}'));
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='8','first known +8 XP');
select sl_test.ok(public.sl_apply_event('20000000-0000-0000-0000-000000000001',0,sl_test.event('mark_known','{"word_id":"v-arbeta"}'))->>'duplicate'='true','retry before revision check');
select sl_test.ok(public.sl_get_progress()->>'revision'='1' and public.sl_get_progress()->'state'->>'xp'='8','retry changes neither revision nor XP');
select sl_test.fails($q$select public.sl_apply_event('20000000-0000-0000-0000-000000000001',1,sl_test.event('mark_known','{"word_id":"v-prata"}'))$q$,'22023','event_id_reused');
select sl_test.fails($q$select public.sl_apply_event(gen_random_uuid(),0,sl_test.event('favorite_set','{"word_id":"v-arbeta","value":true}'))$q$,'40001','revision_conflict');
select sl_test.ok(not (select is_favorite from public.sl_words where word_id='v-arbeta'),'stale write has no side effects');
select sl_test.apply('mark_known','{"word_id":"v-arbeta"}');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='8' and
  (select interval_days=3 and repetitions=2 and ease=2.66 from public.sl_words where word_id='v-arbeta'),'known repeated: no reward; second review 3 days');
select sl_test.apply('flash_grade','{"word_id":"v-arbeta","correct":true}');
select sl_test.ok((select interval_days=8 and repetitions=3 and ease=2.74 from public.sl_words where word_id='v-arbeta'),'third interval uses OLD ease and JS rounding');
select sl_test.apply('mark_review','{"word_id":"v-arbeta"}');
select sl_test.ok((select interval_days=0 and repetitions=0 and ease=2.56 and is_known
  and due_at=last_reviewed_at+interval '10 minutes' from public.sl_words where word_id='v-arbeta'),'failure: ten minutes, retains learned flag');
select sl_test.apply('flash_grade','{"word_id":"v-prata","correct":false}');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='18','flash +8/+2 without answer counters');
select sl_test.ok(public.sl_get_progress()->'state'->>'answered'='0','cards do not increment quiz answers');
select sl_test.apply('book_read','{"content_id":"book-1"}');
select sl_test.apply('book_read','{"content_id":"book-1"}');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='38','book +20 only once, even different UUID');
select sl_test.apply('video_set','{"content_id":"ur-alpha","value":true}');
select sl_test.apply('video_set','{"content_id":"ur-alpha","value":true}');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='43','setting watched twice adds +5 once');
select sl_test.apply('video_set','{"content_id":"ur-alpha","value":false}');
select sl_test.apply('video_set','{"content_id":"ur-alpha","value":true}');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='48','intentional unwatch/rewatch preserves existing +5 rule');
select sl_test.apply('settings_update','{"language":"uk","level":"C","speech_speed":"normal","timezone":"Europe/Stockholm"}');
select sl_test.apply('profile_update','{"name":"Test A"}');
select sl_test.fails($q$select sl_test.apply('settings_update','{"timezone":"Invalid/Zone"}')$q$,'22023','invalid_timezone');
select sl_test.fails($q$select sl_test.apply('profile_update','{"avatar_path":"10000000-0000-0000-0000-000000000002/photo.jpg"}')$q$,'P0001','own_uploaded_avatar');

-- Lesson has 13 questions; count/score come from the stored session and answers.
select sl_test.apply('session_start',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000001',
  'mode','lesson','context_id','lesson-1','content_version',public.sl_get_progress()->>'content_version',
  'questions',(select jsonb_agg('{}'::jsonb) from generate_series(1,13))));
select sl_test.fails($q$select sl_test.apply('session_finish','{"session_id":"30000000-0000-0000-0000-000000000001"}')$q$,'P0001','session_incomplete');
select sl_test.apply('answer','{"session_id":"30000000-0000-0000-0000-000000000001","question_index":0,"correct":true}');
select sl_test.fails($q$select sl_test.apply('answer','{"session_id":"30000000-0000-0000-0000-000000000001","question_index":0,"correct":true}')$q$,'23505','question_already_answered');
do $$ begin
  for i in 1..12 loop
    perform sl_test.apply('answer',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000001','question_index',i,'correct',i<8));
  end loop;
end $$;
select sl_test.apply('session_finish','{"session_id":"30000000-0000-0000-0000-000000000001"}');
select sl_test.ok((select completed and best_percent>=60 from public.sl_lessons where lesson_id='lesson-1'),'lesson passes at >=60 percent');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='194' and public.sl_get_progress()->'state'->>'answered'='13'
  and public.sl_get_progress()->'state'->>'correct'='8','answers +12/+3 and first lesson +35');
select sl_test.ok(public.sl_get_progress()->'state'->'activity'->>'2026-10-16'='22','activity preserves touch including profile edit');
-- Repeat a passed lesson: answer XP continues, lesson bonus does not repeat.
select sl_test.apply('session_start',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000002',
  'mode','lesson','context_id','lesson-1','content_version',public.sl_get_progress()->>'content_version',
  'questions',(select jsonb_agg('{}'::jsonb) from generate_series(1,13))));
do $$ begin
  for i in 0..12 loop
    perform sl_test.apply('answer',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000002','question_index',i,'correct',true));
  end loop;
end $$;
select sl_test.apply('session_finish','{"session_id":"30000000-0000-0000-0000-000000000002"}');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='350','passed lesson repeat gives answer XP but no second +35');
select sl_test.fails($q$select sl_test.apply('session_finish','{"session_id":"30000000-0000-0000-0000-000000000002"}')$q$,'P0001','active_own_session_required');

-- Exactly 60% passes, 50% fails. lesson-5 has ten static questions.
do $$ declare sid uuid; begin
  for correct_answers in 5..6 loop
    sid:=gen_random_uuid();
    perform sl_test.apply('session_start',jsonb_build_object('session_id',sid,'mode','lesson','context_id','lesson-5',
      'content_version',public.sl_get_progress()->>'content_version','questions',(select jsonb_agg('{}'::jsonb) from generate_series(1,10))));
    for i in 0..9 loop
      perform sl_test.apply('answer',jsonb_build_object('session_id',sid,'question_index',i,'correct',i<correct_answers));
    end loop;
    perform sl_test.apply('session_finish',jsonb_build_object('session_id',sid));
    perform sl_test.ok((select completed=(correct_answers=6) from public.sl_lessons where lesson_id='lesson-5'),'lesson threshold '||correct_answers||'/10');
  end loop;
end $$;

select sl_test.apply('session_start',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000003',
  'mode','translation','content_version',public.sl_get_progress()->>'content_version','questions','[{"word_id":"v-prata"}]'::jsonb));
select sl_test.apply('answer','{"session_id":"30000000-0000-0000-0000-000000000003","question_index":0,"correct":true}');
select sl_test.ok((select repetitions=1 and interval_days=1 and not is_known from public.sl_words where word_id='v-prata'),'quiz answer updates SRS without marking known');

-- Seed a second user via RPC and prove isolation for every table with actual rows.
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select public.sl_get_progress();
select sl_test.ok((select count(*)=0 from public.sl_accounts where user_id='10000000-0000-0000-0000-000000000001'),'cannot read another account');
select sl_test.ok((select count(*)=0 from public.sl_words),'cannot read other words');
select sl_test.ok((select count(*)=0 from public.sl_sessions),'cannot read other sessions');
select sl_test.ok((select count(*)=0 from public.sl_lessons),'cannot read other lessons');
select sl_test.ok((select count(*)=0 from public.sl_content),'cannot read other books/videos');
select sl_test.ok((select count(*)=0 from public.sl_events),'cannot read other events');
select sl_test.fails($q$select sl_test.apply('answer','{"session_id":"30000000-0000-0000-0000-000000000001","question_index":1,"correct":true}')$q$,'P0001','active_own_session_required');

select public.sl_import_progress('40000000-0000-0000-0000-000000000001',0,'50000000-0000-0000-0000-000000000001',
  '{"known":["v-arbeta"],"favorites":["v-arbeta"],"reviews":{"v-arbeta":{"due":1792144800000,"interval":3,"ease":2.66,"rep":2}},"completed":["lesson-1"],"booksRead":["book-1"],"videos":["v1"],"activity":{"2026-10-15":4},"answered":10,"correct":7,"xp":123,"settings":{"language":"en","level":"B"},"profile":{"name":"Imported","avatar":"data:image/jpeg;base64,ORIGINAL"}}');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='123' and public.sl_get_progress()->'state'->>'correct'='7','import preserves counters without reward recalculation');
select sl_test.ok((select is_known and is_favorite and interval_days=3 and last_reviewed_at is null from public.sl_words where word_id='v-arbeta'),'import overlap known/favorite and unknown historical time');
select sl_test.ok((select snapshot->'profile'->>'avatar'='data:image/jpeg;base64,ORIGINAL' from public.sl_imports),'raw avatar snapshot retained');
select sl_test.ok(public.sl_get_progress()->'state'->'profile'->>'avatarPath' is null,'base64 not used as active Storage path');
select sl_test.ok((select count(*)=1 from public.sl_imports),'owner can read import');
select public.sl_import_progress('40000000-0000-0000-0000-000000000001',0,'50000000-0000-0000-0000-000000000001',
  (select snapshot from public.sl_imports));
select sl_test.ok(public.sl_get_progress()->>'revision'='1' and public.sl_get_progress()->'state'->>'xp'='123','retry import does not add XP');
select sl_test.fails($q$select public.sl_import_progress(gen_random_uuid(),1,gen_random_uuid(),'{"xp":10}')$q$,'P0001','nonempty_account');
select sl_test.fails($q$select public.sl_import_progress(gen_random_uuid(),1,gen_random_uuid(),'{"known":["unknown"]}','independent')$q$,'22023','unknown_content_id');
select sl_test.ok(public.sl_get_progress()->>'revision'='1','failed import fully rolled back');

-- An uncertain snapshot is archived with no counters, then explicitly resolved.
select public.sl_import_progress('40000000-0000-0000-0000-000000000002',1,'50000000-0000-0000-0000-000000000002','{"xp":10,"activity":{"2026-10-15":2}}','archive_only');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='123','archive-only does not change statistics');
select public.sl_import_progress('40000000-0000-0000-0000-000000000002',2,'50000000-0000-0000-0000-000000000002','{"xp":10,"activity":{"2026-10-15":2}}','independent');
select sl_test.ok(public.sl_get_progress()->'state'->>'xp'='133' and public.sl_get_progress()->'state'->'activity'->>'2026-10-15'='6','explicit independent import adds baseline once');
select sl_test.fails('update public.sl_imports set snapshot=''{}''','42501');

-- Avatar policy and pending-deletion freeze. Storage API itself is separate QA.
insert into storage.objects(bucket_id,name,owner_id) values('avatars','10000000-0000-0000-0000-000000000002/avatar.jpg','10000000-0000-0000-0000-000000000002');
select sl_test.apply('profile_update','{"avatar_path":"10000000-0000-0000-0000-000000000002/avatar.jpg"}');
-- Populate every B table before deletion, including a valid session FK.
select sl_test.apply('session_start',jsonb_build_object('session_id','30000000-0000-0000-0000-000000000004',
  'mode','translation','content_version',public.sl_get_progress()->>'content_version','questions','[{}]'::jsonb));
select sl_test.fails($q$insert into storage.objects(bucket_id,name) values('avatars','10000000-0000-0000-0000-000000000001/evil.jpg')$q$,'42501');
select sl_test.fails($q$insert into storage.objects(bucket_id,name) values('avatars','10000000-0000-0000-0000-000000000002/../evil.jpg')$q$,'42501');
select sl_test.fails($q$insert into storage.objects(bucket_id,name) values('avatars','10000000-0000-0000-0000-000000000002/evil.svg')$q$,'42501');
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select sl_test.ok((select count(*)=0 from public.sl_imports),'cannot read other import snapshot');
select sl_test.ok((select count(*)=0 from storage.objects),'cannot read other avatar');
update storage.objects set name='10000000-0000-0000-0000-000000000001/stolen.jpg' where bucket_id='avatars';
delete from storage.objects where bucket_id='avatars';
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select sl_test.ok((select count(*)=1 from storage.objects),'foreign UPDATE/DELETE affect zero rows');
select public.sl_request_account_deletion((public.sl_get_progress()->>'revision')::bigint);
select public.sl_request_account_deletion(0);
select sl_test.fails('select public.sl_get_progress()','P0001','account_deletion_pending');
select sl_test.fails($q$insert into storage.objects(bucket_id,name) values('avatars','10000000-0000-0000-0000-000000000002/new.jpg')$q$,'42501');
reset role;
select sl_test.fails($q$insert into public.sl_events(user_id,event_id,request,event_type,session_id,question_index,
  occurred_at,activity_date,timezone,xp_delta,activity_delta,answered_delta,correct_delta,revision)
  values('10000000-0000-0000-0000-000000000001',gen_random_uuid(),'{}','answer',
  '30000000-0000-0000-0000-000000000004',0,now(),current_date,'UTC',0,0,0,0,1000)$q$,'23503');
-- Emulates successful service-side Storage API cleanup, NOT production SQL advice.
delete from storage.objects where name like '10000000-0000-0000-0000-000000000002/%';
delete from auth.users where id='10000000-0000-0000-0000-000000000002';
do $$ declare t text; n bigint; begin
  foreach t in array array['sl_accounts','sl_words','sl_sessions','sl_lessons','sl_content','sl_events','sl_imports'] loop
    execute format('select count(*) from public.%I where user_id=$1',t) into n using '10000000-0000-0000-0000-000000000002'::uuid;
    perform sl_test.ok(n=0,'account cascade: '||t);
  end loop;
end $$;
select sl_test.ok(exists(select 1 from public.sl_accounts where user_id='10000000-0000-0000-0000-000000000001'),'deleting B preserves A');
rollback;
