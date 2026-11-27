-- READ ONLY. Run manually on the installed database after successful 022 postflight.
-- Share the single baseline JSON with the developer. This does not authorize 023.
-- No account rows, tokens or personal data are returned. Definitions contain private answer banks.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '20s';
with signatures(name, signature) as (values
 ('manifest','sl_private.manifest()'),
 ('catalog','sl_private.quiz_catalog()'),
 ('reader','public.sl_get_progress()'),
 ('writer','public.sl_apply_event(uuid,bigint,jsonb)')
), functions as (
 select s.name, s.signature, p.oid, p.prosrc, p.proacl, p.proconfig, p.prosecdef,
        pg_get_userbyid(p.proowner) as owner
 from signatures s left join pg_proc p on p.oid=to_regprocedure(s.signature)
), archives as (
 select p.oid,p.proname,p.prosrc,p.proacl,p.proconfig,p.prosecdef,
        pg_get_userbyid(p.proowner) as owner
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='sl_private'
 and p.proname ~ '^(manifest|quiz_catalog)_before_0(18|19|20|21|22|23)$'
)
select jsonb_pretty(jsonb_build_object(
 'observed_at',transaction_timestamp(),
 'content_version',sl_private.manifest()->>'version',
 'manifest',sl_private.manifest(),
 'catalog_value_md5',md5(sl_private.quiz_catalog()::text),
 'function_md5',(select jsonb_object_agg(name,md5(prosrc)) from functions),
 'functions',(select jsonb_object_agg(name,jsonb_build_object(
   'signature',signature,'definition',pg_get_functiondef(oid),'source',prosrc,
   'md5',md5(prosrc),'owner',owner,'acl',proacl,'config',proconfig,
   'security_definer',prosecdef)) from functions),
 'quiz_catalog',(select jsonb_object_agg(k,b) from jsonb_each(sl_private.quiz_catalog()) e(k,b)
   where k in ('lesson:lesson-1','lesson:lesson-2','lesson:lesson-3','lesson:lesson-4','lesson:lesson-5')),
 'archives',(select coalesce(jsonb_object_agg(proname,jsonb_build_object(
   'definition',pg_get_functiondef(oid),'source',prosrc,'md5',md5(prosrc),
   'owner',owner,'acl',proacl,'config',proconfig,'security_definer',prosecdef)), '{}') from archives),
 'backups',jsonb_build_object(
   'manifest_before_021',to_regprocedure('sl_private.manifest_before_021()') is not null,
   'catalog_before_021',to_regprocedure('sl_private.quiz_catalog_before_021()') is not null,
   'manifest_before_022',to_regprocedure('sl_private.manifest_before_022()') is not null,
   'catalog_before_022',to_regprocedure('sl_private.quiz_catalog_before_022()') is not null,
   'manifest_before_023',to_regprocedure('sl_private.manifest_before_023()') is not null,
   'catalog_before_023',to_regprocedure('sl_private.quiz_catalog_before_023()') is not null)
)) as baseline;
commit;
