-- READ ONLY. After all five migrations, before creating test users.
begin read only;
with expected(name) as (values ('sl_accounts'),('sl_words'),('sl_sessions'),('sl_lessons'),('sl_content'),('sl_events'),('sl_imports'))
select e.name,c.relrowsecurity as rls_enabled,
  has_table_privilege('authenticated',c.oid,'SELECT') as member_select,
  has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE') as member_any_write,
  has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE') as anon_any_access
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name) order by e.name;
select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies
  where schemaname='public' and left(tablename,3)='sl_' order by tablename,policyname;
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as security_definer,pg_get_userbyid(p.proowner) as owner,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as member_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='sl_private' or (n.nspname='public' and left(p.proname,3)='sl_') order by n.nspname,p.proname;
select has_schema_privilege('authenticated','sl_private','USAGE') as member_private_usage,
  has_schema_privilege('anon','sl_private','USAGE') as anon_private_usage,
  to_regclass('public.learning_progress') is null as legacy_absent;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars';
select relrowsecurity as storage_rls_enabled from pg_class where oid='storage.objects'::regclass;
select policyname,roles,cmd,qual,with_check from pg_policies
  where schemaname='storage' and tablename='objects' order by policyname;
-- All cross-user references must include user_id; accounts FK targets auth.users PK.
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
  from pg_constraint where connamespace='public'::regnamespace
  and conrelid in (select oid from pg_class where relnamespace='public'::regnamespace and left(relname,3)='sl_')
  and contype='f' order by conrelid::regclass::text,conname;
commit;
