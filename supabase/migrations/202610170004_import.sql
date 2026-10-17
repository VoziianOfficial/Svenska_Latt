-- Immutable source snapshots; no browser data is ever deleted by an RPC.
begin;
create function public.sl_import_progress(p_import_id uuid, p_expected_revision bigint,
  p_source_id uuid, p_state jsonb, p_mode text default 'empty_only') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  a public.sl_accounts; previous public.sl_imports; hash text; empty_account boolean;
  key text; item jsonb; id text; r jsonb; n bigint; answers bigint; good bigint; points bigint;
  activity jsonb; interval_value integer; ease_value numeric; rep_value integer; due_value numeric;
  is_archived boolean:=false;
  existing_words text[];
begin
  a:=sl_private.lock_account();
  if p_import_id is null or p_source_id is null or p_expected_revision is null or p_mode is null
    or p_mode not in ('empty_only','independent','archive_only') then raise exception 'invalid_import_parameters'; end if;
  if p_state is null or jsonb_typeof(p_state)<>'object' or octet_length(p_state::text)>2097152 then raise exception 'invalid_snapshot'; end if;
  hash:=md5(p_state::text); -- Deduplication only, NOT an authentication primitive.
  select * into previous from public.sl_imports where user_id=a.user_id
    and (import_id=p_import_id or source_id=p_source_id or snapshot_hash=hash) limit 1;
  if found then
    if previous.snapshot<>p_state then raise exception 'import_identity_reused_with_different_snapshot'; end if;
    if previous.mode='archive_only' and p_mode<>'archive_only' then
      if previous.import_id<>p_import_id or previous.source_id<>p_source_id then raise exception 'resolve_using_original_import_and_source_ids'; end if;
      is_archived:=true;
    else
      if previous.mode<>p_mode then raise exception 'import_already_applied_with_different_mode'; end if;
      return jsonb_build_object('duplicate',true,'applied_revision',previous.applied_revision,'progress',public.sl_get_progress());
    end if;
  end if;
  if a.revision<>p_expected_revision then raise exception 'revision_conflict' using errcode='40001'; end if;
  if p_mode='archive_only' then
    insert into public.sl_imports(user_id,import_id,source_id,snapshot_hash,snapshot,mode,applied_revision)
      values(a.user_id,p_import_id,p_source_id,hash,p_state,p_mode,a.revision+1);
    update public.sl_accounts set revision=revision+1,updated_at=now() where user_id=a.user_id;
    return jsonb_build_object('duplicate',false,'archived_only',true,'progress',public.sl_get_progress());
  end if;

  empty_account:=a.xp=0 and a.answered=0 and a.correct=0 and a.legacy_activity='{}'::jsonb
    and not exists(select 1 from public.sl_words where user_id=a.user_id)
    and not exists(select 1 from public.sl_lessons where user_id=a.user_id)
    and not exists(select 1 from public.sl_content where user_id=a.user_id)
    and not exists(select 1 from public.sl_sessions where user_id=a.user_id)
    and not exists(select 1 from public.sl_imports where user_id=a.user_id and mode<>'archive_only');
  if p_mode='empty_only' and not empty_account then raise exception 'nonempty_account_requires_explicit_merge_or_archive'; end if;
  select coalesce(array_agg(word_id),array[]::text[]) into existing_words from public.sl_words where user_id=a.user_id;
  -- 'independent' is a user's explicit declaration that baseline counters do not
  -- overlap ANY existing baseline or post-cutover event. Never choose it silently.
  for key in select unnest(array['known','favorites','completed','videos','booksRead']) loop
    if jsonb_typeof(coalesce(p_state->key,'[]'))<>'array' then raise exception 'invalid_import_list: %',key; end if;
    if jsonb_array_length(coalesce(p_state->key,'[]'))>15000 then raise exception 'import_list_too_large'; end if;
    for item in select v from jsonb_array_elements(coalesce(p_state->key,'[]')) v loop
      if jsonb_typeof(item)<>'string' then raise exception 'import_id_must_be_string'; end if;
      id:=item#>>'{}';
      perform sl_private.require_id(case key when 'known' then 'word' when 'favorites' then 'word'
        when 'completed' then 'lesson' when 'videos' then 'video' else 'book' end,id);
      if key in ('known','favorites') then
        insert into public.sl_words(user_id,word_id,is_known,is_favorite)
          values(a.user_id,id,key='known',key='favorites')
          on conflict(user_id,word_id) do update set is_known=sl_words.is_known or excluded.is_known;
        -- Existing false favorite is an explicit cloud intent; do not resurrect it.
      elsif key='completed' then
        insert into public.sl_lessons(user_id,lesson_id,completed) values(a.user_id,id,true)
          on conflict(user_id,lesson_id) do update set completed=true;
      else
        insert into public.sl_content(user_id,content_type,content_id,is_completed)
          values(a.user_id,case key when 'videos' then 'video' else 'book' end,id,true)
          on conflict(user_id,content_type,content_id) do update
            set is_completed=case when excluded.content_type='book' then true else sl_content.is_completed end;
      end if;
    end loop;
  end loop;
  -- Include words in both lists; preserve ALL pre-import favorite intents.
  update public.sl_words w set is_favorite=true where w.user_id=a.user_id
    and coalesce(p_state->'favorites','[]') ? w.word_id
    and not (w.word_id=any(existing_words));

  if jsonb_typeof(coalesce(p_state->'reviews','{}'))<>'object' then raise exception 'invalid_reviews'; end if;
  for id,r in select k,v from jsonb_each(coalesce(p_state->'reviews','{}')) kv(k,v) loop
    perform sl_private.require_id('word',id);
    if jsonb_typeof(r)<>'object' then raise exception 'invalid_review'; end if;
    foreach key in array array['due','interval','ease','rep'] loop
      if jsonb_typeof(r->key) is distinct from 'number' then raise exception 'review_number_required: %',key; end if;
    end loop;
    due_value:=(r->>'due')::numeric; interval_value:=(r->>'interval')::integer;
    ease_value:=(r->>'ease')::numeric; rep_value:=(r->>'rep')::integer;
    if due_value not between 0 and 4102444800000 or due_value<>trunc(due_value)
      or interval_value not between 0 and 365000 or interval_value::numeric<>(r->>'interval')::numeric
      or ease_value not between 1.3 and 3 or rep_value not between 0 and 100000 or rep_value::numeric<>(r->>'rep')::numeric
      then raise exception 'invalid_review_range'; end if;
    insert into public.sl_words(user_id,word_id) values(a.user_id,id) on conflict do nothing;
    -- Without historical timestamps, a cloud schedule wins; raw guest schedule
    -- is retained in sl_imports.snapshot for an explicit future resolution.
    update public.sl_words set due_at=to_timestamp(due_value::double precision/1000),
      interval_days=interval_value,ease=ease_value,repetitions=rep_value
      where user_id=a.user_id and word_id=id and due_at is null;
  end loop;
  foreach key in array array['answered','correct','xp'] loop
    item:=coalesce(p_state->key,'0');
    if jsonb_typeof(item)<>'number' or item::text!~'^[0-9]+$' or item::numeric>1000000000 then raise exception 'invalid_counter: %',key; end if;
  end loop;
  answers:=coalesce((p_state->>'answered')::bigint,0); good:=coalesce((p_state->>'correct')::bigint,0); points:=coalesce((p_state->>'xp')::bigint,0);
  if good>answers then raise exception 'correct_exceeds_answered'; end if;
  activity:=a.legacy_activity;
  if jsonb_typeof(coalesce(p_state->'activity','{}'))<>'object' then raise exception 'invalid_activity'; end if;
  for key,item in select k,v from jsonb_each(coalesce(p_state->'activity','{}')) kv(k,v) loop
    if key!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or key::date::text<>key
      or jsonb_typeof(item)<>'number' or item::text!~'^[0-9]+$' or item::numeric>10000 then raise exception 'invalid_activity_day'; end if;
    n:=coalesce((activity->>key)::bigint,0)+item::text::bigint;
    activity:=jsonb_set(activity,array[key],to_jsonb(n),true);
  end loop;
  if p_state ? 'settings' and jsonb_typeof(p_state->'settings')<>'object' then raise exception 'invalid_settings'; end if;
  if p_state ? 'profile' and jsonb_typeof(p_state->'profile')<>'object' then raise exception 'invalid_profile'; end if;
  update public.sl_accounts set xp=xp+points,answered=answered+answers,correct=correct+good,legacy_activity=activity,
    display_name=case when display_name='' then coalesce(p_state->'profile'->>'name','') else display_name end,
    language=case when empty_account then coalesce(p_state->'settings'->>'language',language) else language end,
    sfi_level=case when empty_account then coalesce(p_state->'settings'->>'level',sfi_level) else sfi_level end,
    revision=revision+1,updated_at=now() where user_id=a.user_id;
  if is_archived then
    update public.sl_imports set mode=p_mode,applied_revision=a.revision+1 where user_id=a.user_id and import_id=p_import_id;
  else
    insert into public.sl_imports(user_id,import_id,source_id,snapshot_hash,snapshot,mode,applied_revision)
      values(a.user_id,p_import_id,p_source_id,hash,p_state,p_mode,a.revision+1);
  end if;
  return jsonb_build_object('duplicate',false,'archived_only',false,'progress',public.sl_get_progress());
end $$;
revoke all on function public.sl_import_progress(uuid,bigint,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.sl_import_progress(uuid,bigint,uuid,jsonb,text) to authenticated;
commit;
