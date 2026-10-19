-- SRS interval cap, recorded after 012; compatible with the 001-011 helper contract.
-- Safe over the manually installed srs_interval_cap.sql: replaces only the helper.
-- Does not rewrite progress or award XP. Installation is a separate operation.
begin;

create or replace function sl_private.review(u uuid, wid text, ok boolean, at_time timestamptz) returns void
language plpgsql security invoker set search_path = '' as $$
declare w public.sl_words; effective_time timestamptz;
begin
  perform sl_private.require_id('word', wid);
  if ok is null then raise exception 'correct_boolean_required'; end if;
  insert into public.sl_words(user_id,word_id) values(u,wid) on conflict do nothing;
  select * into strict w from public.sl_words where user_id=u and word_id=wid;
  -- A delayed second device cannot move the review clock backwards.
  effective_time := greatest(at_time, w.last_reviewed_at);
  if ok then
    w.repetitions := w.repetitions+1;
    w.interval_days := least(365000,case w.repetitions when 1 then 1 when 2 then 3
      else greatest(1,round(w.interval_days*w.ease)::integer) end);
    w.ease := least(3,w.ease+0.08);
  else
    w.repetitions:=0; w.interval_days:=0; w.ease:=greatest(1.3,w.ease-0.18);
  end if;
  update public.sl_words set repetitions=w.repetitions,interval_days=w.interval_days,ease=w.ease,
    due_at=effective_time + case when ok then make_interval(secs=>w.interval_days::double precision*86400) else interval '10 minutes' end,
    last_reviewed_at=effective_time,updated_at=now() where user_id=u and word_id=wid;
end $$;

revoke all on function sl_private.review(uuid,text,boolean,timestamptz) from public,anon,authenticated;
commit;
