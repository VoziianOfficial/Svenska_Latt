-- READ ONLY: run manually in the installed project's SQL Editor.
-- This is observation, not approval to apply a migration. No user rows returned.
begin transaction read only;
select jsonb_pretty(jsonb_build_object(
  'content_version', sl_private.manifest()->>'version',
  'manifest', sl_private.manifest(),
  'function_md5', (select jsonb_object_agg(v.name, md5(p.prosrc))
    from (values
      ('manifest','sl_private.manifest()'),
      ('catalog','sl_private.quiz_catalog()'),
      ('reader','public.sl_get_progress()'),
      ('writer','public.sl_apply_event(uuid,bigint,jsonb)')
    ) v(name,signature) left join pg_proc p on p.oid=to_regprocedure(v.signature)),
  'quiz_catalog', (select jsonb_object_agg(k, jsonb_build_object(
    'count', b->'count', 'reward', b->'reward',
    'start_questions', b->'start_questions',
    'questions', b->'questions'))
    from jsonb_each(sl_private.quiz_catalog()) e(k,b) where k in
      ('lesson:lesson-1','lesson:lesson-2','lesson:lesson-3','lesson:lesson-4')),
  'backups', jsonb_build_object(
    'manifest_before_021', to_regprocedure('sl_private.manifest_before_021()') is not null,
    'catalog_before_021', to_regprocedure('sl_private.quiz_catalog_before_021()') is not null,
    'manifest_before_022', to_regprocedure('sl_private.manifest_before_022()') is not null,
    'catalog_before_022', to_regprocedure('sl_private.quiz_catalog_before_022()') is not null)
)) as baseline;
commit;
