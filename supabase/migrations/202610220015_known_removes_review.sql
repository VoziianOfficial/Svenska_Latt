-- Migration 015: learning a word closes its manual review entry.
-- Preserve word history, XP, study time and review receipts.
begin;

set local lock_timeout = '10s';

do $$
begin
  if to_regclass('public.sl_words') is null
     or to_regclass('public.sl_review_queue') is null then
    raise exception '015 requires existing word and review tables';
  end if;
end $$;

create function sl_private.close_manual_review_on_learn()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.sl_review_queue
     set active = false,
         version = gen_random_uuid(),
         change_order = default
   where user_id = new.user_id
     and word_id = new.word_id
     and active = true;

  return new;
end $$;

revoke all on function sl_private.close_manual_review_on_learn()
from public, anon, authenticated;

create trigger sl_words_close_review_on_known
after update of is_known on public.sl_words
for each row
when (new.is_known = true and old.is_known = false)
execute function sl_private.close_manual_review_on_learn();

-- Reconcile words already learned but still in manual reviews.
update public.sl_review_queue q
   set active = false,
       version = gen_random_uuid(),
       change_order = default
  from public.sl_words w
 where q.user_id = w.user_id
   and q.word_id = w.word_id
   and q.active = true
   and w.is_known = true;

commit;
