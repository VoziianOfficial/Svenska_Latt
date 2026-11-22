-- READ ONLY. Run manually after 021 commits and before publishing the client.
-- No user rows, user IDs, answer strings or secrets are returned.
select sl_private.manifest()->>'version' as content_version,
 sl_private.manifest()->>'version' = 'static-57b40b608d91091d' as version_ok;
select v.name, md5(p.prosrc) as actual_md5, v.expected_md5,
 md5(p.prosrc) = v.expected_md5 as function_ok
from (values
 ('manifest','sl_private.manifest()','8175977d178067352ad8b0df697de019'),
 ('catalog','sl_private.quiz_catalog()','0108ee37590e52b64c3cce928aacb7ef'),
 ('reader','public.sl_get_progress()','b54fea7e908720a36177e2a6f91d03d6'),
 ('writer','public.sl_apply_event(uuid,bigint,jsonb)','04a117be1ffcdae4e71fafd405f38534')
) v(name,signature,expected_md5)
left join pg_proc p on p.oid=to_regprocedure(v.signature);
with old_bank as (select sl_private.quiz_catalog_before_021() b),
 new_bank as (select sl_private.quiz_catalog() b)
select (select count(*)=24 from jsonb_array_elements(new_bank.b->'lesson:lesson-3'->'start_questions')) as active_24,
 (select count(*)=35 from jsonb_object_keys(new_bank.b->'lesson:lesson-3'->'questions')) as total_35,
 new_bank.b->'lesson:lesson-3'->>'reward'='35' as reward_35,
 not exists(select 1 from jsonb_each(old_bank.b) item
   where item.key<>'lesson:lesson-3' and new_bank.b->item.key is distinct from item.value) as other_banks_unchanged,
 not exists(select 1 from jsonb_each(old_bank.b->'lesson:lesson-3'->'questions') q
   where new_bank.b->'lesson:lesson-3'->'questions'->q.key is distinct from q.value) as archive_unchanged,
 sl_private.manifest_before_021()->>'version'='static-1aa3eb8422e2930a' as frozen_020_version_ok,
 not has_function_privilege('authenticated','sl_private.quiz_catalog()','execute')
   and not has_function_privilege('anon','sl_private.quiz_catalog()','execute')
   and not has_function_privilege('authenticated','sl_private.quiz_catalog_before_021()','execute')
   and not has_function_privilege('anon','sl_private.quiz_catalog_before_021()','execute') as answer_bank_private
from old_bank,new_bank;
