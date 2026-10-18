-- DRAFT FOR REVIEW. Apply only after explicit approval; never via the app.
-- Additive upgrade from 006. No history, progress, timestamps or XP is removed.
-- Test only with scripts/test_supabase_local.py in its disposable cluster.
begin;

alter table public.sl_words add column known_rewarded boolean not null default false;
-- Existing known/imported words must never regain their first-knowledge bonus.
-- Historical records are evidence only: no import is executed here.
update public.sl_words w set known_rewarded=true
where w.is_known or w.learned_at is not null
  or exists(select 1 from public.sl_events e where e.user_id=w.user_id
    and e.request->'data'->>'word_id'=w.word_id
    and (e.event_type='mark_known' or
      (e.event_type='flash_grade' and e.request->'data'->>'correct'='true')))
  or exists(select 1 from public.sl_imports i where i.user_id=w.user_id
    and i.mode in ('empty_only','independent') and i.snapshot->'known' ? w.word_id);

alter table public.sl_events drop constraint sl_events_event_type_check;
alter table public.sl_events add constraint sl_events_event_type_check check (event_type in (
  'session_start','answer','session_finish','session_abandon',
  'mark_known','unmark_known','mark_review','review_grade','flash_grade','favorite_set',
  'book_read','video_set','profile_update','settings_update'));

alter table public.sl_events drop constraint sl_events_rules_version_check;
alter table public.sl_events add constraint sl_events_rules_version_check
  check (rules_version in ('current-v1','word-state-v2'));

create or replace function public.sl_get_progress() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a public.sl_accounts; result jsonb;
begin
  a:=sl_private.lock_account();
  -- All writers take this same lock: the multi-query snapshot is coherent.
  select jsonb_build_object(
    'capabilities',jsonb_build_array('unmark_known','review_grade','known_reward_once'),
    'revision',a.revision,'content_version',sl_private.manifest()->>'version',
    'state',jsonb_build_object(
      'known',coalesce((select jsonb_agg(word_id order by word_id) from public.sl_words where user_id=a.user_id and is_known),'[]'),
      'favorites',coalesce((select jsonb_agg(word_id order by word_id) from public.sl_words where user_id=a.user_id and is_favorite),'[]'),
      'reviews',coalesce((select jsonb_object_agg(word_id,jsonb_build_object('due',round(extract(epoch from due_at)*1000),
        'interval',interval_days,'ease',ease,'rep',repetitions)) from public.sl_words where user_id=a.user_id and due_at is not null),'{}'),
      'completed',coalesce((select jsonb_agg(lesson_id order by lesson_id) from public.sl_lessons where user_id=a.user_id and completed),'[]'),
      'videos',coalesce((select jsonb_agg(content_id order by content_id) from public.sl_content where user_id=a.user_id and content_type='video' and is_completed),'[]'),
      'booksRead',coalesce((select jsonb_agg(content_id order by content_id) from public.sl_content where user_id=a.user_id and content_type='book' and is_completed),'[]'),
      'activity',coalesce((select jsonb_object_agg(day_key,n) from (
        select day_key,sum(n) n from (
          select key as day_key,value::bigint n from jsonb_each_text(a.legacy_activity)
          union all select activity_date::text,activity_delta::bigint from public.sl_events
            where user_id=a.user_id and activity_delta>0
        ) raw group by day_key
      ) totals),'{}'),
      'answered',a.answered,'correct',a.correct,'xp',a.xp,
      'settings',jsonb_build_object('language',a.language,'level',a.sfi_level,'speechSpeed',a.speech_speed,'timezone',a.timezone),
      'profile',jsonb_build_object('name',a.display_name,'avatarPath',a.avatar_path)
    )) into result;
  return result;
end $$;

create or replace function public.sl_apply_event(p_event_id uuid, p_expected_revision bigint, p_event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<event_fn>>
declare
  a public.sl_accounts; old_event public.sl_events; s public.sl_sessions;
  typ text; d jsonb; at_time timestamptz; tz text; day date;
  wid text; cid text; sid uuid; idx integer; ok boolean; value boolean;
  xp integer:=0; activity integer:=0; answers integer:=0; good integer:=0;
  was boolean; rewarded boolean; q jsonb; n integer; pct numeric; allowed text[];
begin
  a:=sl_private.lock_account();
  if p_event_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'event_id_and_revision_required'; end if;
  select * into old_event from public.sl_events where user_id=a.user_id and event_id=p_event_id;
  if found then
    if old_event.request is distinct from p_event then raise exception 'event_id_reused_with_different_body' using errcode='22023'; end if;
    return jsonb_build_object('duplicate',true,'applied_revision',old_event.revision,'progress',public.sl_get_progress());
  end if;
  if a.revision<>p_expected_revision then raise exception 'revision_conflict: expected %, actual %',p_expected_revision,a.revision using errcode='40001'; end if;
  if p_event is null or octet_length(p_event::text)>65536 then raise exception 'invalid_event'; end if;
  perform sl_private.check_keys(p_event,array['type','occurred_at','timezone','data']);
  typ:=p_event->>'type'; d:=p_event->'data'; tz:=p_event->>'timezone';
  perform sl_private.check_timezone(tz);
  if (p_event->>'occurred_at') is null or (p_event->>'occurred_at') !~ '(Z|[+-][0-9]{2}:[0-9]{2})$'
    then raise exception 'event_time_requires_explicit_offset'; end if;
  at_time:=(p_event->>'occurred_at')::timestamptz;
  if at_time is null or not isfinite(at_time) or at_time<'2000-01-01'::timestamptz or at_time>now()+interval '5 minutes'
    then raise exception 'invalid_event_time'; end if;
  day:=(at_time at time zone tz)::date;
  allowed:=case typ
    when 'session_start' then array['session_id','mode','context_id','content_version','questions']
    when 'answer' then array['session_id','question_index','correct']
    when 'session_finish' then array['session_id']
    when 'session_abandon' then array['session_id']
    when 'mark_known' then array['word_id']
    when 'unmark_known' then array['word_id']
    when 'review_grade' then array['word_id','correct']
    when 'mark_review' then array['word_id']
    when 'flash_grade' then array['word_id','correct']
    when 'favorite_set' then array['word_id','value']
    when 'book_read' then array['content_id']
    when 'video_set' then array['content_id','value']
    when 'profile_update' then array['name','avatar_path']
    when 'settings_update' then array['language','level','speech_speed','timezone']
    else null end;
  if allowed is null then raise exception 'unknown_event_type'; end if;
  perform sl_private.check_keys(d,allowed);
  if d is null then raise exception 'data_required'; end if;
  if d ? 'correct' and jsonb_typeof(d->'correct')<>'boolean' then raise exception 'correct_boolean_required'; end if;
  if d ? 'value' and jsonb_typeof(d->'value')<>'boolean' then raise exception 'value_boolean_required'; end if;
  ok:=(d->>'correct')::boolean; value:=(d->>'value')::boolean;
  wid:=d->>'word_id'; cid:=d->>'content_id';

  if typ='session_start' then
    sid:=(d->>'session_id')::uuid;
    if d->>'content_version' is distinct from sl_private.manifest()->>'version' then raise exception 'unsupported_content_version'; end if;
    if jsonb_typeof(d->'questions') is distinct from 'array' then raise exception 'questions_array_required'; end if;
    n:=jsonb_array_length(d->'questions');
    if n not between 1 and 200 then raise exception 'invalid_question_count'; end if;
    if d->>'mode' in ('lesson','book','topic','video') then
      perform sl_private.require_id(d->>'mode',d->>'context_id');
      if d->>'mode' in ('lesson','book') and n <> (sl_private.manifest()->case when d->>'mode'='lesson' then 'lessons' else 'books' end->>(d->>'context_id'))::integer
        then raise exception 'context_question_count_mismatch'; end if;
    elsif d->>'context_id' is not null then raise exception 'unexpected_context_id'; end if;
    for q in select v from jsonb_array_elements(d->'questions') v loop
      perform sl_private.check_keys(q,array['word_id']);
      if q ? 'word_id' and q->>'word_id' is not null then perform sl_private.require_id('word',q->>'word_id'); end if;
    end loop;
    insert into public.sl_sessions(user_id,id,mode,context_id,content_version,questions,started_at)
      values(a.user_id,sid,d->>'mode',d->>'context_id',d->>'content_version',d->'questions',at_time);
  elsif typ in ('answer','session_finish','session_abandon') then
    sid:=(d->>'session_id')::uuid;
    select * into s from public.sl_sessions where user_id=a.user_id and id=sid;
    if not found or s.status<>'active' then raise exception 'active_own_session_required'; end if;
    if typ='answer' then
      if jsonb_typeof(d->'question_index') is distinct from 'number' or ok is null then raise exception 'answer_fields_required'; end if;
      idx:=(d->>'question_index')::integer;
      if idx::text <> d->>'question_index' or idx not between 0 and jsonb_array_length(s.questions)-1 then raise exception 'invalid_question_index'; end if;
      if exists(select 1 from public.sl_events where user_id=a.user_id and session_id=sid and question_index=idx and event_type='answer')
        then raise exception 'question_already_answered' using errcode='23505'; end if;
      answers:=1; good:=case when ok then 1 else 0 end; xp:=case when ok then 12 else 3 end; activity:=1;
      update public.sl_sessions set answered=answered+1,correct=correct+good where user_id=a.user_id and id=sid;
      wid:=s.questions->idx->>'word_id';
      if wid is not null then perform sl_private.review(a.user_id,wid,ok,at_time); end if;
    else
      if typ='session_finish' and s.answered<>jsonb_array_length(s.questions) then raise exception 'session_incomplete'; end if;
      update public.sl_sessions set status=case when typ='session_finish' then 'completed' else 'abandoned' end,
        finished_at=greatest(at_time,s.started_at) where user_id=a.user_id and id=sid;
      if typ='session_finish' and s.mode='lesson' then
        pct:=100.0*s.correct/jsonb_array_length(s.questions);
        insert into public.sl_lessons(user_id,lesson_id) values(a.user_id,s.context_id) on conflict do nothing;
        select completed into was from public.sl_lessons where user_id=a.user_id and lesson_id=s.context_id;
        if pct>=60 and not was then xp:=35; activity:=1; end if;
        update public.sl_lessons set completed=completed or pct>=60,
          completed_at=case when not completed and pct>=60 then at_time else completed_at end,
          best_percent=greatest(best_percent,pct),last_session_id=sid,updated_at=now()
          where user_id=a.user_id and lesson_id=s.context_id;
      end if;
    end if;
  elsif typ in ('mark_known','unmark_known','mark_review','review_grade','flash_grade','favorite_set') then
    perform sl_private.require_id('word',wid);
    insert into public.sl_words(user_id,word_id) values(a.user_id,wid) on conflict do nothing;
    select is_known, known_rewarded or is_known or learned_at is not null into was,rewarded
      from public.sl_words where user_id=a.user_id and word_id=wid;
    if typ='favorite_set' then
      if value is null then raise exception 'value_required'; end if;
      update public.sl_words set is_favorite=value,updated_at=now() where user_id=a.user_id and word_id=wid;
    elsif typ='unmark_known' then
      -- Keep timestamps, SRS, favorites and all historical events/statistics.
      update public.sl_words set is_known=false,known_rewarded=rewarded,updated_at=now()
        where user_id=a.user_id and word_id=wid;
    else
      if typ='mark_known' then ok:=true; if not rewarded then xp:=8; end if; if not was then activity:=1; end if;
      elsif typ='mark_review' then ok:=false; activity:=1;
      elsif typ='review_grade' then
        if ok is null then raise exception 'correct_required'; end if; activity:=1;
      else if ok is null then raise exception 'correct_required'; end if;
        -- Positive flash grades cannot bypass the once-per-word knowledge reward.
        xp:=case when ok then case when not rewarded then 8 else 0 end else 2 end; activity:=1;
      end if;
      if typ='mark_known' or (typ='flash_grade' and ok) then
        update public.sl_words set known_rewarded=true where user_id=a.user_id and word_id=wid;
      end if;
      perform sl_private.review(a.user_id,wid,ok,at_time);
      if (typ='mark_known' or (typ='flash_grade' and ok)) and not was then
        update public.sl_words set is_known=true,known_rewarded=true,learned_at=coalesce(learned_at,at_time) where user_id=a.user_id and word_id=wid;
      end if;
    end if;
  elsif typ in ('book_read','video_set') then
    perform sl_private.require_id(case when typ='book_read' then 'book' else 'video' end,cid);
    insert into public.sl_content(user_id,content_type,content_id)
      values(a.user_id,case when typ='book_read' then 'book' else 'video' end,cid) on conflict do nothing;
    select is_completed into was from public.sl_content where user_id=a.user_id
      and content_type=case when typ='book_read' then 'book' else 'video' end and content_id=cid;
    if typ='book_read' then value:=true; end if;
    if value is null then raise exception 'value_required'; end if;
    if value and not was then xp:=case when typ='book_read' then 20 else 5 end; activity:=1; end if;
    update public.sl_content set is_completed=value,completed_at=case when value and not was then at_time else completed_at end,
      updated_at=now() where user_id=a.user_id and content_type=case when typ='book_read' then 'book' else 'video' end and content_id=cid;
  elsif typ='profile_update' then
    if d='{}'::jsonb then raise exception 'empty_patch'; end if;
    if d ? 'name' and (jsonb_typeof(d->'name') is distinct from 'string' or length(btrim(d->>'name')) not between 1 and 70) then raise exception 'invalid_name'; end if;
    if d ? 'avatar_path' and d->>'avatar_path' is not null then
      if not exists(select 1 from storage.objects where bucket_id='avatars' and name=d->>'avatar_path'
        and split_part(name,'/',1)=a.user_id::text) then raise exception 'own_uploaded_avatar_required'; end if;
    end if;
    update public.sl_accounts set display_name=case when d ? 'name' then btrim(d->>'name') else display_name end,
      avatar_path=case when d ? 'avatar_path' then d->>'avatar_path' else avatar_path end where user_id=a.user_id;
    activity:=1;
  elsif typ='settings_update' then
    if d='{}'::jsonb then raise exception 'empty_patch'; end if;
    if exists(select 1 from jsonb_each(d) kv where jsonb_typeof(kv.value)<>'string') then raise exception 'settings_strings_required'; end if;
    if d ? 'timezone' then perform sl_private.check_timezone(d->>'timezone'); end if;
    update public.sl_accounts set language=coalesce(d->>'language',language),sfi_level=coalesce(d->>'level',sfi_level),
      speech_speed=coalesce(d->>'speech_speed',speech_speed),timezone=coalesce(d->>'timezone',timezone) where user_id=a.user_id;
  end if;

  update public.sl_accounts set xp=sl_accounts.xp+event_fn.xp,answered=sl_accounts.answered+answers,
    correct=sl_accounts.correct+good,revision=revision+1,updated_at=now() where user_id=a.user_id;
  insert into public.sl_events(user_id,event_id,request,event_type,session_id,question_index,occurred_at,
    activity_date,timezone,xp_delta,activity_delta,answered_delta,correct_delta,revision,rules_version)
    values(a.user_id,p_event_id,p_event,typ,sid,idx,at_time,day,tz,xp,activity,answers,good,a.revision+1,'word-state-v2');
  return jsonb_build_object('duplicate',false,'applied_revision',a.revision+1,'progress',public.sl_get_progress());
end $$;

-- CREATE OR REPLACE retains function identity. Reassert the existing ACL.
revoke all on function public.sl_get_progress() from public, anon, authenticated;
revoke all on function public.sl_apply_event(uuid,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.sl_get_progress() to authenticated;
grant execute on function public.sl_apply_event(uuid,bigint,jsonb) to authenticated;
-- Table grants, RLS policies, account locking and UUID receipts are unchanged.
commit;
