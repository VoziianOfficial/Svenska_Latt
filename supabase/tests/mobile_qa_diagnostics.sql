-- Manual support diagnostics. READ ONLY. Not a migration; not executed by Codex.
-- Run as project owner in Supabase SQL Editor. Contains no user/event payloads.
begin read only;

select current_timestamp as checked_at,
       to_regclass('supabase_migrations.schema_migrations') as migration_history;

-- Required public RPC contracts and EXECUTE privileges. NULL = function absent.
with required(signature) as (values
 ('public.sl_get_progress()'),
 ('public.sl_apply_event(uuid,bigint,jsonb)'),
 ('public.sl_review_list()'),
 ('public.sl_review_change(uuid,text,text,uuid)'),
 ('public.sl_study_status(date)')
)
select signature, to_regprocedure(signature) is not null as present,
       has_function_privilege('authenticated',to_regprocedure(signature),'EXECUTE') as authenticated_execute,
       has_function_privilege('anon',to_regprocedure(signature),'EXECUTE') as anon_execute
from required;

-- RLS must stay enabled; do not grant guests access to account tables.
select c.relname,c.relrowsecurity,c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname like 'sl\_%' escape '\' and c.relkind='r'
order by c.relname;

select schemaname,tablename,policyname,roles,cmd
from pg_policies where schemaname='public' and tablename like 'sl\_%' escape '\'
order by tablename,policyname;

-- Frontend expects static-1750f0ad07cce4c4. A mismatch blocks writes safely.
select sl_private.manifest()->>'version' as content_version;

-- Inspect SRS limit without reading any account rows.
select conname,pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid=to_regclass('public.sl_words') and contype='c';

-- Function fingerprints for comparing with the reviewed migrations.
select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) as arguments,
       md5(pg_get_functiondef(p.oid)) as definition_md5,p.prosecdef as security_definer
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','sl_private') and
      (p.proname like 'sl\_%' escape '\' or p.proname='manifest')
order by n.nspname,p.proname,arguments;

rollback;
-- If migration_history above exists, separately inspect version/name (no SQL bodies):
-- select version,name from supabase_migrations.schema_migrations order by version;
