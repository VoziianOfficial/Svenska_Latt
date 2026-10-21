-- Prepared checks only. This file was NOT run in production.
-- Run as an administrator with ALL application writers paused. Save output before
-- 014, run the exact same file after 014 BEFORE allowing any writer to reconnect.
-- Compare every user_rows row count and fingerprint; all must be identical.
begin read only;
set local timezone='UTC';
set local statement_timeout='60s';

select 'routine' as check_kind,n.nspname,p.proname,p.prosecdef,p.proconfig,p.proacl,
  md5(pg_get_functiondef(p.oid)) as definition_md5
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where p.oid in (to_regprocedure('public.sl_get_progress()'),
  to_regprocedure('public.sl_apply_event(uuid,bigint,jsonb)'),
  to_regprocedure('sl_private.review(uuid,text,boolean,timestamptz)'),
  to_regprocedure('sl_private.quiz_catalog()'),
  to_regprocedure('sl_private.quiz_catalog_before_014()'))
order by n.nspname,p.proname;

select c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and c.relname like 'sl_%'
order by c.relname;

select schemaname,tablename,policyname,roles,cmd,qual,with_check
from pg_policies where schemaname='public' and tablename like 'sl_%'
order by tablename,policyname;

select role_name,
 has_function_privilege(role_name,'public.sl_get_progress()','execute') as snapshot_execute,
 has_function_privilege(role_name,'public.sl_apply_event(uuid,bigint,jsonb)','execute') as writer_execute,
 has_schema_privilege(role_name,'sl_private','usage') as private_schema_usage,
 has_function_privilege(role_name,'sl_private.quiz_catalog()','execute') as bank_execute
from (values ('anon'),('authenticated')) roles(role_name);

select key as quiz_id,value->>'count' as question_count,value->>'reward' as reward,value->'start_questions' as active_question_ids
from jsonb_each(sl_private.quiz_catalog()) where key like 'video:%' order by key;

-- Full-row fingerprints include progress, XP, revisions, timestamps, UUIDs and
-- receipts without returning their contents. This is a full scan; on a large
-- installation plan the maintenance window accordingly. A timeout changes no data.
select 'user_rows' as check_kind,'sl_accounts' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_accounts t
union all
select 'user_rows' as check_kind,'sl_words' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_words t
union all
select 'user_rows' as check_kind,'sl_sessions' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_sessions t
union all
select 'user_rows' as check_kind,'sl_lessons' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_lessons t
union all
select 'user_rows' as check_kind,'sl_content' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_content t
union all
select 'user_rows' as check_kind,'sl_events' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_events t
union all
select 'user_rows' as check_kind,'sl_imports' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_imports t
union all
select 'user_rows' as check_kind,'sl_review_queue' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_review_queue t
union all
select 'user_rows' as check_kind,'sl_review_receipts' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_review_receipts t
union all
select 'user_rows' as check_kind,'sl_study_preferences' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_study_preferences t
union all
select 'user_rows' as check_kind,'sl_study_leases' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_study_leases t
union all
select 'user_rows' as check_kind,'sl_study_periods' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_study_periods t
union all
select 'user_rows' as check_kind,'sl_study_days' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_study_days t
union all
select 'user_rows' as check_kind,'sl_study_receipts' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_study_receipts t
union all
select 'user_rows' as check_kind,'sl_quiz_results' as table_name,count(*) as row_count,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),'')) as fingerprint from public.sl_quiz_results t
order by table_name;
commit;
