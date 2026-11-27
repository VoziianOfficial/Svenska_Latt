-- READ ONLY: run the same file immediately BEFORE and AFTER 023, before client
-- publication or acceptance tests. Compare outputs only during a quiet window;
-- real learning activity can legitimately change counters/fingerprints.
-- No sl_get_progress/sl_apply_event calls, user identifiers or answer text output.
begin transaction isolation level repeatable read read only;
set local statement_timeout = '20s';
set local timezone = 'UTC';

-- All durable progress tables, including events without a lesson/session join.
-- Include empty tables so a disappearing table scope cannot look unchanged.
with row_hashes as (
select 'sl_accounts'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_accounts t
union all
select 'sl_words'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_words t
union all
select 'sl_sessions'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_sessions t
union all
select 'sl_lessons'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_lessons t
union all
select 'sl_content'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_content t
union all
select 'sl_events'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_events t
union all
select 'sl_imports'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_imports t
union all
select 'sl_study_preferences'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_study_preferences t
union all
select 'sl_study_leases'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_study_leases t
union all
select 'sl_study_periods'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_study_periods t
union all
select 'sl_study_days'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_study_days t
union all
select 'sl_study_receipts'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_study_receipts t
union all
select 'sl_review_queue'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_review_queue t
union all
select 'sl_review_receipts'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_review_receipts t
union all
select 'sl_quiz_results'::text as table_name,md5(to_jsonb(t)::text) as row_hash from public.sl_quiz_results t
), scopes(table_name) as (values
('sl_accounts'),('sl_words'),('sl_sessions'),('sl_lessons'),('sl_content'),('sl_events'),('sl_imports'),('sl_study_preferences'),('sl_study_leases'),('sl_study_periods'),('sl_study_days'),('sl_study_receipts'),('sl_review_queue'),('sl_review_receipts'),('sl_quiz_results')
)
select scopes.table_name,count(r.row_hash) as rows,
 md5(coalesce(string_agg(r.row_hash,'' order by r.row_hash),'')) as all_rows_fingerprint
from scopes left join row_hashes r using(table_name)
group by scopes.table_name order by scopes.table_name;

select 'accounts' as scope,
 count(*) as rows,
 coalesce(sum(xp),0) as total_xp,
 md5(coalesce(string_agg(md5(to_jsonb(a)::text),'' order by user_id),'')) as rows_fingerprint
from public.sl_accounts a;

select quiz_id,
 count(*) as rows,
 count(*) filter (where rewarded) as rewarded_rows,
 md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by user_id),'')) as rows_fingerprint
from public.sl_quiz_results r
where quiz_id in ('lesson:lesson-1','lesson:lesson-2','lesson:lesson-3','lesson:lesson-4','lesson:lesson-5')
group by quiz_id order by quiz_id;

select lesson_id,
 count(*) as rows,
 count(*) filter (where completed) as completed_rows,
 md5(coalesce(string_agg(md5(to_jsonb(l)::text),'' order by user_id),'')) as rows_fingerprint
from public.sl_lessons l
where lesson_id in ('lesson-1','lesson-2','lesson-3','lesson-4','lesson-5')
group by lesson_id order by lesson_id;

select quiz_id,
 count(*) as rows,
 count(*) filter (where status='completed') as completed_rows,
 count(*) filter (where status='active') as active_rows,
 md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by user_id,id),'')) as rows_fingerprint
from public.sl_sessions s
where quiz_id in ('lesson:lesson-1','lesson:lesson-2','lesson:lesson-3','lesson:lesson-4','lesson:lesson-5')
group by quiz_id order by quiz_id;

select s.quiz_id,
 count(*) as event_rows,
 coalesce(sum(e.xp_delta),0) as recorded_xp_delta,
 md5(coalesce(string_agg(md5(to_jsonb(e)::text),'' order by e.user_id,e.event_id),'')) as rows_fingerprint
from public.sl_events e
join public.sl_sessions s on s.user_id=e.user_id and s.id=e.session_id
where s.quiz_id in ('lesson:lesson-1','lesson:lesson-2','lesson:lesson-3','lesson:lesson-4','lesson:lesson-5')
group by s.quiz_id order by s.quiz_id;

-- These are precisely the historical-reward conditions to be checked by 023.
select
 (select count(*) from public.sl_lessons l
  left join public.sl_quiz_results r on r.user_id=l.user_id and r.quiz_id='lesson:lesson-5'
  where l.lesson_id='lesson-5' and l.completed and not coalesce(r.rewarded,false))
  as completed_lesson5_without_reserved_reward,
 (select count(*) from public.sl_sessions s
  join public.sl_events e on e.user_id=s.user_id and e.session_id=s.id and e.xp_delta>0
  left join public.sl_quiz_results r on r.user_id=s.user_id and r.quiz_id='lesson:lesson-5'
  where s.quiz_id='lesson:lesson-5' and not coalesce(r.rewarded,false))
  as lesson5_xp_events_without_reserved_reward;

commit;
