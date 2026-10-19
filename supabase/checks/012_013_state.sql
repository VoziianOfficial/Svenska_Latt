-- READ ONLY. Capture before 012, after 012, and after 013 while writers are paused.
-- Never invokes mutating RPCs. Contains no user identities or raw progress output.
-- Full table scans: for a large project schedule off-peak; timeout aborts safely.
-- Compare all fingerprints exactly, except the documented 012 quiz reservations.
begin isolation level repeatable read read only;
set local statement_timeout='30s';
select current_user, current_database(), version();
select 'sl_accounts' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_accounts t
union all
select 'sl_words' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_words t
union all
select 'sl_sessions' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_sessions t
union all
select 'sl_lessons' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_lessons t
union all
select 'sl_content' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_content t
union all
select 'sl_events' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_events t
union all
select 'sl_imports' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_imports t
union all
select 'sl_quiz_results' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_quiz_results t
union all
select 'sl_review_queue' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_review_queue t
union all
select 'sl_review_receipts' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_review_receipts t
union all
select 'sl_study_preferences' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_study_preferences t
union all
select 'sl_study_leases' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_study_leases t
union all
select 'sl_study_periods' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_study_periods t
union all
select 'sl_study_days' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_study_days t
union all
select 'sl_study_receipts' as table_name, count(*) as rows,
  md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by to_jsonb(t)::text),'')) as fingerprint
from public.sl_study_receipts t
order by table_name;

select count(*) as missing_historical_quiz_reservations
from public.sl_lessons l left join public.sl_quiz_results q
  on q.user_id=l.user_id and q.quiz_id='lesson:'||l.lesson_id
where l.completed and (q.user_id is null or not q.rewarded);
select count(*) filter(where interval_days not between 0 and 365000) as invalid_intervals,
  max(interval_days) as max_interval_days from public.sl_words;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as args,
  pg_get_function_result(p.oid) as result,p.prosecdef,p.proconfig,
  pg_get_userbyid(p.proowner) as owner,
  has_function_privilege('anon',p.oid,'execute') as anon_execute,
  has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
  md5(pg_get_functiondef(p.oid)) as definition_fingerprint
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='public' and left(p.proname,3)='sl_')
  or (n.nspname='sl_private' and p.proname in ('review','import_progress_legacy'))
order by n.nspname,p.proname,args;
select c.relname,c.relrowsecurity,
  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as client_writes,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_access
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind='r' and left(c.relname,3)='sl_'
order by c.relname;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
where schemaname='public' and left(tablename,3)='sl_' order by tablename,policyname;
select has_schema_privilege('anon','sl_private','USAGE') as anon_private_usage,
  has_schema_privilege('authenticated','sl_private','USAGE') as client_private_usage;
commit;
