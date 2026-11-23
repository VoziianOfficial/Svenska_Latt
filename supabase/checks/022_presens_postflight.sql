-- READ ONLY, manual only AFTER candidate 022 was applied and BEFORE client publication.
-- Also run generated 022_presens_fingerprints.sql and compare data_audit before/after.
begin transaction read only;
set local statement_timeout='20s';
select sl_private.manifest()->>'version' as content_version;
with old_bank as (select sl_private.quiz_catalog_before_022() b),
 new_bank as (select sl_private.quiz_catalog() b)
select
 jsonb_array_length(new_bank.b->'lesson:lesson-4'->'start_questions')=24 as active_24,
 (select count(*)=35 from jsonb_object_keys(new_bank.b->'lesson:lesson-4'->'questions')) as total_35,
 new_bank.b->'lesson:lesson-4'->>'reward'='35' as reward_35,
 not exists(select 1 from jsonb_each(old_bank.b) item
  where item.key<>'lesson:lesson-4' and new_bank.b->item.key is distinct from item.value) as all_other_banks_unchanged,
 not exists(select 1 from jsonb_each(old_bank.b->'lesson:lesson-4'->'questions') q
  where new_bank.b->'lesson:lesson-4'->'questions'->q.key is distinct from q.value) as historical_ids_answers_unchanged,
 sl_private.manifest_before_022()->>'version'='static-57b40b608d91091d' as frozen_021_version_ok,
 sl_private.manifest_before_021()->>'version'='static-1aa3eb8422e2930a' as frozen_020_version_ok,
 not has_function_privilege('authenticated','sl_private.quiz_catalog()','execute')
  and not has_function_privilege('anon','sl_private.quiz_catalog()','execute')
  and not has_function_privilege('authenticated','sl_private.quiz_catalog_before_022()','execute')
  and not has_function_privilege('anon','sl_private.quiz_catalog_before_022()','execute') as answer_banks_private
from old_bank,new_bank;
select p.oid::regprocedure::text as function_name,md5(p.prosrc) as body_md5,
 p.prosecdef as security_definer,p.proconfig as configuration,p.proacl as permissions
from pg_proc p where p.oid in ('public.sl_get_progress()'::regprocedure,
 'public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure);
commit;
