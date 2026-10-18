-- XP integrity upgrade. Apply ONLY after 001-011 and explicit installation approval.
-- No XP, events, SRS or learning records are removed or decremented.
begin;
-- Serialize the historical reservation with account writers. Fail atomically
-- instead of waiting indefinitely on a busy installation. Drain old in-flight
-- RPCs in a maintenance window before applying this migration in production.
set local lock_timeout='10s';
lock table public.sl_accounts,public.sl_lessons,public.sl_quiz_results,public.sl_imports
  in share row exclusive mode;

-- Imports applied after 010 may contain completed legacy lessons without a
-- quiz reward reservation. Reserve those achievements without paying XP again.
insert into public.sl_quiz_results(user_id,quiz_id,best_correct,best_total,rewarded,legacy_reward)
select user_id,'lesson:'||lesson_id,
  case when best_percent is not null then floor(best_percent*1000000)::integer end,
  case when best_percent is not null then 100000000 end,true,true
from public.sl_lessons where completed
on conflict(user_id,quiz_id) do update set rewarded=true,legacy_reward=true
where not sl_quiz_results.rewarded;

create or replace function public.sl_apply_event(p_event_id uuid, p_expected_revision bigint, p_event jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
<<event_fn>>
declare
  a public.sl_accounts; old_event public.sl_events; s public.sl_sessions;
  typ text; d jsonb; at_time timestamptz; tz text; day date;
  wid text; cid text; sid uuid; idx integer; ok boolean; value boolean;
  xp integer:=0; activity integer:=0; answers integer:=0; good integer:=0;
  bank jsonb; entry jsonb; qid text; result jsonb; prior public.sl_quiz_results; passed boolean; new_best boolean;
  was boolean; rewarded boolean; q jsonb; n integer; pct numeric; allowed text[];
begin
  a:=sl_private.lock_account();
  if p_event_id is null or p_expected_revision is null or p_expected_revision<0 then raise exception 'event_id_and_revision_required'; end if;
  select * into old_event from public.sl_events where user_id=a.user_id and event_id=p_event_id;
  if found then
    if old_event.request is distinct from p_event then raise exception 'event_id_reused_with_different_body' using errcode='22023'; end if;
    return jsonb_build_object('duplicate',true,'applied_revision',old_event.revision,'progress',public.sl_get_progress(),'quiz_result',old_event.quiz_result);
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
    when 'answer' then array['session_id','question_index','correct','response']
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
      perform sl_private.check_keys(q,array['word_id','question_id']);
      if q ? 'word_id' and q->>'word_id' is not null then perform sl_private.require_id('word',q->>'word_id'); end if;
    end loop;
    qid:=case when d->>'mode' in ('lesson','book','topic','video') then (d->>'mode')||':'||(d->>'context_id') else null end;
    bank:=sl_private.quiz_catalog()->qid;
    if qid is not null then
      if bank is null or n<>(bank->>'count')::integer then raise exception 'quiz_bank_count_mismatch' using errcode='22023'; end if;
      if (select count(distinct v->>'question_id') from jsonb_array_elements(d->'questions') v)<>n
        or exists(select 1 from jsonb_array_elements(d->'questions') v where not (bank->'questions' ? (v->>'question_id')) or v ? 'word_id')
        then raise exception 'quiz_bank_questions_mismatch' using errcode='22023'; end if;
    elsif exists(select 1 from jsonb_array_elements(d->'questions') v where v ? 'question_id') then
      raise exception 'practice_question_id_forbidden' using errcode='22023';
    end if;
    qid:=coalesce(qid,'practice:'||(d->>'mode'));
    insert into public.sl_sessions(user_id,id,mode,context_id,content_version,questions,started_at,quiz_id,trusted_quiz)
      values(a.user_id,sid,d->>'mode',d->>'context_id',d->>'content_version',d->'questions',at_time,qid,bank is not null);
  elsif typ in ('answer','session_finish','session_abandon') then
    sid:=(d->>'session_id')::uuid;
    select * into s from public.sl_sessions where user_id=a.user_id and id=sid;
    if not found or s.status<>'active' then raise exception 'active_own_session_required'; end if;
    if typ='answer' then
      if jsonb_typeof(d->'question_index') is distinct from 'number' then raise exception 'answer_fields_required'; end if;
      idx:=(d->>'question_index')::integer;
      if idx::text <> d->>'question_index' or idx not between 0 and jsonb_array_length(s.questions)-1 then raise exception 'invalid_question_index'; end if;
      if exists(select 1 from public.sl_events where user_id=a.user_id and session_id=sid and question_index=idx and event_type='answer')
        then raise exception 'question_already_answered' using errcode='23505'; end if;
      if s.trusted_quiz then
        if d ? 'correct' or jsonb_typeof(d->'response') is distinct from 'string' or length(d->>'response')>4000 then
          raise exception 'trusted_response_required' using errcode='22023'; end if;
        entry:=sl_private.quiz_catalog()->s.quiz_id->'questions'->(s.questions->idx->>'question_id');
        if entry is null then raise exception 'quiz_bank_unavailable' using errcode='22023'; end if;
        ok:=(d->>'response')=(entry->>'answer');
      elsif ok is null then raise exception 'correct_boolean_required' using errcode='22023'; end if;
      answers:=1; good:=case when ok then 1 else 0 end; xp:=0; activity:=1;
      update public.sl_sessions set answered=answered+1,correct=correct+good where user_id=a.user_id and id=sid;
      wid:=case when s.trusted_quiz then entry->>'word_id' else s.questions->idx->>'word_id' end;
      if wid is not null then perform sl_private.review(a.user_id,wid,ok,at_time); end if;
    else
      if typ='session_finish' and (s.answered<>jsonb_array_length(s.questions) or s.answered<>(select count(*) from public.sl_events where user_id=a.user_id and session_id=sid and event_type='answer')) then raise exception 'session_incomplete'; end if;
      update public.sl_sessions set status=case when typ='session_finish' then 'completed' else 'abandoned' end,
        finished_at=greatest(at_time,s.started_at) where user_id=a.user_id and id=sid;
      if typ='session_finish' then
        n:=jsonb_array_length(s.questions); passed:=s.correct*5>=n*4;
        pct:=100.0*s.correct/n;
        if s.quiz_id is not null then
          insert into public.sl_quiz_results(user_id,quiz_id) values(a.user_id,s.quiz_id) on conflict do nothing;
          select * into strict prior from public.sl_quiz_results where user_id=a.user_id and quiz_id=s.quiz_id;
          new_best:=prior.best_total is null or s.correct::bigint*prior.best_total>prior.best_correct::bigint*n;
          if s.trusted_quiz and passed and not prior.rewarded then
            xp:=(sl_private.quiz_catalog()->s.quiz_id->>'reward')::integer;
            activity:=1;
          end if;
          update public.sl_quiz_results set
            best_correct=case when new_best then s.correct else best_correct end,
            best_total=case when new_best then n else best_total end,
            rewarded=sl_quiz_results.rewarded or event_fn.xp>0,
            reward_session_id=case when event_fn.xp>0 then sid else reward_session_id end,
            updated_at=now() where user_id=a.user_id and quiz_id=s.quiz_id;
          result:=jsonb_build_object('xp',xp,'already_rewarded',prior.rewarded,'new_best',new_best,
            'correct',s.correct,'total',n,'passed',passed,'trusted',s.trusted_quiz);
        end if;
        if s.mode='lesson' then
          insert into public.sl_lessons(user_id,lesson_id) values(a.user_id,s.context_id) on conflict do nothing;
          update public.sl_lessons set completed=completed or passed,
            completed_at=case when not completed and passed then at_time else completed_at end,
            best_percent=greatest(best_percent,pct),last_session_id=sid,updated_at=now()
            where user_id=a.user_id and lesson_id=s.context_id;
        end if;
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
        xp:=case when ok and not rewarded then 8 else 0 end; activity:=1;
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
    -- Viewing is a reversible preference, not proof of a completed quiz.
    -- The separate trusted video quiz still awards 12 XP once.
    if value and not was then
      if typ='book_read' then xp:=20; end if;
      activity:=1;
    end if;
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
    activity_date,timezone,xp_delta,activity_delta,answered_delta,correct_delta,revision,rules_version,quiz_result)
    values(a.user_id,p_event_id,p_event,typ,sid,idx,at_time,day,tz,xp,activity,answers,good,a.revision+1,'quiz-rewards-v1',result);
  return jsonb_build_object('duplicate',false,'applied_revision',a.revision+1,'progress',public.sl_get_progress(),'quiz_result',result);
end $$;

revoke all on function public.sl_apply_event(uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.sl_apply_event(uuid,bigint,jsonb) to authenticated;

-- Keep the reviewed legacy import implementation for archive-only requests.
-- It must no longer be callable directly by clients: it trusts baseline XP.
alter function public.sl_import_progress(uuid,bigint,uuid,jsonb,text) set schema sl_private;
alter function sl_private.sl_import_progress(uuid,bigint,uuid,jsonb,text) rename to import_progress_legacy;
revoke all on function sl_private.import_progress_legacy(uuid,bigint,uuid,jsonb,text) from public,anon,authenticated;

create function public.sl_import_progress(p_import_id uuid,p_expected_revision bigint,
  p_source_id uuid,p_state jsonb,p_mode text default 'empty_only') returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.sl_accounts; previous public.sl_imports;
begin
  a:=sl_private.lock_account();
  if p_import_id is null or p_source_id is null or p_expected_revision is null or p_mode is null
    or p_mode not in ('empty_only','independent','archive_only') then
    raise exception 'invalid_import_parameters' using errcode='22023';
  end if;
  if p_state is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>2097152 then
    raise exception 'invalid_snapshot' using errcode='22023';
  end if;
  if p_mode='archive_only' then
    return sl_private.import_progress_legacy(p_import_id,p_expected_revision,p_source_id,p_state,p_mode);
  end if;
  -- Lost ACK of a historical applied import is safe to acknowledge. Never
  -- promote an archive or apply a new unverified baseline, even on a new account.
  select * into previous from public.sl_imports where user_id=a.user_id
    and (import_id=p_import_id or source_id=p_source_id or snapshot_hash=md5(p_state::text)) limit 1;
  if found and previous.mode=p_mode and previous.snapshot=p_state then
    return jsonb_build_object('duplicate',true,'applied_revision',previous.applied_revision,'progress',public.sl_get_progress());
  end if;
  raise exception 'client_progress_import_disabled_use_archive_only' using errcode='42501';
end $$;
revoke all on function public.sl_import_progress(uuid,bigint,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.sl_import_progress(uuid,bigint,uuid,jsonb,text) to authenticated;
commit;
