-- Only unlearned words may enter manual review.
begin;
set local lock_timeout = '10s';

do $guard$
begin
  if to_regclass('public.sl_review_queue') is null
     or to_regclass('public.sl_words') is null
     or to_regprocedure('sl_private.close_manual_review_on_learn()') is null
     or to_regprocedure('public.sl_review_change(uuid,text,text,uuid)') is null then
    raise exception '016 requires migration 015';
  end if;
end
$guard$;

create function sl_private.prevent_review_of_known()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.active and exists (
    select 1 from public.sl_words w
    where w.user_id = new.user_id
      and w.word_id = new.word_id
      and w.is_known = true
  ) then
    raise exception 'learned_word_cannot_be_added_to_reviews'
      using errcode = '22023';
  end if;
  return new;
end $$;

revoke all on function sl_private.prevent_review_of_known()
from public, anon, authenticated;

create trigger sl_review_queue_disallow_known
before insert or update of active on public.sl_review_queue
for each row
execute function sl_private.prevent_review_of_known();

-- Close existing inconsistent entries without deleting history.
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
