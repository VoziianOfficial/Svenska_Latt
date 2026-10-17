-- READ ONLY. Run manually in a NEW Supabase project's SQL Editor after approval.
-- Does not install schemas, create users, run RPCs, or change migration history.
begin read only;
select current_user as migration_role, version() as postgres_version;
select
  to_regclass('auth.users') is not null as auth_users_present,
  to_regprocedure('auth.uid()') is not null as auth_uid_present,
  to_regclass('storage.buckets') is not null as storage_buckets_present,
  to_regclass('storage.objects') is not null as storage_objects_present,
  to_regclass('public.learning_progress') is null as no_legacy_progress,
  not exists(select 1 from pg_namespace where nspname='sl_private') as no_private_schema;
select rolname from pg_roles where rolname in ('postgres','anon','authenticated','service_role') order by rolname;
select table_name,column_name,data_type from information_schema.columns
  where (table_schema='auth' and table_name='users' and column_name='id')
    or (table_schema='storage' and table_name='buckets' and column_name in ('id','name','public','file_size_limit','allowed_mime_types'))
    or (table_schema='storage' and table_name='objects' and column_name in ('bucket_id','name'))
  order by table_name,column_name;
-- These result sets must be EMPTY before the five migrations in a new project.
select n.nspname,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and left(c.relname,3)='sl_';
select n.nspname,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and left(p.proname,3)='sl_';
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets where id='avatars';
-- Other policies can combine with ours using OR; inspect them rather than delete.
select policyname,roles,cmd,qual,with_check from pg_policies
  where schemaname='storage' and tablename='objects' order by policyname;
commit;
