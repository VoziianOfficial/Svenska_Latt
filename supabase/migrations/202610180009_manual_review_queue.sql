-- REVIEW ONLY. Requires 007; compatible with pending 008. Never run by the app.
begin;
create table public.sl_review_queue (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  word_id text not null,
  active boolean not null default true,
  version uuid not null,
  change_order bigint generated always as identity,
  added_at timestamptz not null default now(),
  primary key(user_id,word_id)
);
-- Tombstones prevent delayed adds/removes from resurrecting/deleting newer intentions.
create table public.sl_review_receipts (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  request_id uuid not null,
  request jsonb not null,
  conflict boolean not null,
  primary key(user_id,request_id)
);
do $$ declare t text; begin
  foreach t in array array['sl_review_queue','sl_review_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  end loop;
end $$;
create function public.sl_review_list() returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.sl_accounts;
begin
  a:=sl_private.lock_account();
  return jsonb_build_object('revision',coalesce((select max(change_order) from public.sl_review_queue where user_id=a.user_id),0),'entries',coalesce((select jsonb_agg(jsonb_build_object(
    'word_id',word_id,'active',active,'version',version) order by added_at,word_id)
    from public.sl_review_queue where user_id=a.user_id),'[]'::jsonb));
end $$;
create function public.sl_review_change(p_request_id uuid,p_word_id text,p_action text,p_version uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.sl_accounts; w public.sl_review_queue; r public.sl_review_receipts;
  body jsonb; conflict boolean:=false;
begin
  a:=sl_private.lock_account();
  if p_request_id is null or p_action is null or p_action not in ('add','remove','remember','again') then raise exception 'invalid_review_request'; end if;
  perform sl_private.require_id('word',p_word_id);
  body:=jsonb_build_object('word_id',p_word_id,'action',p_action,'version',p_version);
  select * into r from public.sl_review_receipts where user_id=a.user_id and request_id=p_request_id;
  if found then
    if r.request is distinct from body then raise exception 'request_id_reused' using errcode='22023'; end if;
    return jsonb_build_object('duplicate',true,'conflict',r.conflict,'queue',public.sl_review_list());
  end if;
  select * into w from public.sl_review_queue where user_id=a.user_id and word_id=p_word_id;
  -- Adding an already active word is harmless, including simultaneous device taps.
  if p_action='add' and coalesce(w.active,false) then null;
  elsif w.version is distinct from p_version or (p_action<>'add' and not coalesce(w.active,false)) then conflict:=true;
  else
    if p_action in ('remember','again') then
      -- Existing 007 semantics, including activity and history; no XP or known changes.
      -- Account lock and transaction make SRS + queue completion atomic.
      perform public.sl_apply_event(p_request_id,a.revision,jsonb_build_object(
        'type','review_grade','occurred_at',to_char(clock_timestamp() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
        'timezone',a.timezone,'data',jsonb_build_object('word_id',p_word_id,'correct',p_action='remember')));
    end if;
    insert into public.sl_review_queue(user_id,word_id,active,version)
      values(a.user_id,p_word_id,p_action in ('add','again'),p_request_id)
      on conflict(user_id,word_id) do update set active=excluded.active,version=excluded.version,change_order=default,
        added_at=case when p_action='add' then now() else sl_review_queue.added_at end;
  end if;
  insert into public.sl_review_receipts values(a.user_id,p_request_id,body,conflict);
  return jsonb_build_object('duplicate',false,'conflict',conflict,'queue',public.sl_review_list());
end $$;
revoke all on function public.sl_review_list() from public,anon,authenticated;
revoke all on function public.sl_review_change(uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.sl_review_list() to authenticated;
grant execute on function public.sl_review_change(uuid,text,text,uuid) to authenticated;
commit;
