-- READ ONLY. Run manually before considering 021; do not expose user rows.
-- Compare these values with reports/pronouns/release-contract.json.
select p.oid::regprocedure::text as function_name, md5(p.prosrc) as body_md5
from pg_proc p where p.oid in (
 'sl_private.manifest()'::regprocedure,
 'sl_private.quiz_catalog()'::regprocedure,
 'public.sl_get_progress()'::regprocedure,
 'public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure);
select sl_private.manifest()->>'version' as content_version,
 sl_private.manifest()->'lessons'->>'lesson-3' as lesson_3_active_count;
select jsonb_array_length(sl_private.quiz_catalog()->'lesson:lesson-1'->'start_questions') as alphabet_active,
 jsonb_array_length(sl_private.quiz_catalog()->'lesson:lesson-2'->'start_questions') as greetings_active,
 sl_private.quiz_catalog()->'lesson:lesson-3'->>'count' as pronouns_legacy_count,
 sl_private.quiz_catalog()->'lesson:lesson-3'->>'reward' as pronouns_reward;
