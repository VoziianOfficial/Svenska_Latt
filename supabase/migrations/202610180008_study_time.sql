-- REVIEW ONLY. No production activation. Independent of pending migration 007.
-- Requires 001-006; PostgreSQL 14+. No XP/progress events or revisions are changed.
begin;

create table public.sl_study_preferences (
  user_id uuid primary key references public.sl_accounts(user_id) on delete cascade,
  enabled boolean not null default false,
  timezone text not null default 'Europe/Stockholm',
  generation bigint not null default 0 check (generation >= 0),
  updated_at timestamptz not null default now()
);
create table public.sl_study_leases (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  id uuid not null,
  generation bigint not null,
  timezone text not null,
  start_ms bigint not null,
  end_ms bigint not null,
  cursor_ms bigint not null,
  closed boolean not null default false,
  primary key(user_id,id),
  check (start_ms <= cursor_ms and cursor_ms <= end_ms)
);
create index sl_study_lease_live on public.sl_study_leases(user_id,end_ms) where not closed;
create table public.sl_study_periods (
  user_id uuid not null,
  lease_id uuid not null,
  start_ms bigint not null,
  end_ms bigint not null,
  primary key(user_id,lease_id,start_ms),
  foreign key(user_id,lease_id) references public.sl_study_leases(user_id,id) on delete cascade,
  check (end_ms > start_ms and end_ms-start_ms <= 30000)
);
create table public.sl_study_days (
  user_id uuid not null references public.sl_accounts(user_id) on delete cascade,
  day date not null,
  milliseconds bigint not null check (milliseconds > 0),
  primary key(user_id,day)
);
create table public.sl_study_receipts (
  user_id uuid not null,
  id uuid not null,
  lease_id uuid not null,
  request jsonb not null,
  response jsonb not null,
  received_at timestamptz not null default now(),
  primary key(user_id,id),
  foreign key(user_id,lease_id) references public.sl_study_leases(user_id,id) on delete cascade
);

do $$ declare t text; begin
  foreach t in array array['sl_study_preferences','sl_study_leases','sl_study_periods','sl_study_days','sl_study_receipts'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public, anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy own_read on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
  end loop;
end $$;

-- Split at civil midnights in the lease's validated IANA zone (including DST).
create function sl_private.study_add(u uuid,lo bigint,hi bigint,tz text) returns void
language plpgsql security invoker set search_path='' as $$
declare d date; edge bigint; stop_ms bigint;
begin
  while lo < hi loop
    d := (to_timestamp(lo/1000.0) at time zone tz)::date;
    edge := floor(extract(epoch from ((d+1)::timestamp at time zone tz))*1000)::bigint;
    stop_ms := least(hi,edge);
    if stop_ms <= lo then raise exception 'invalid_day_boundary'; end if;
    insert into public.sl_study_days(user_id,day,milliseconds) values(u,d,stop_ms-lo)
      on conflict(user_id,day) do update set milliseconds=sl_study_days.milliseconds+excluded.milliseconds;
    lo := stop_ms;
  end loop;
end $$;

-- Pure read: no account creation and no relation to sl_get_progress capabilities.
create function public.sl_study_status(p_month date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); pref public.sl_study_preferences; tz text; account_tz text; today date; mon date; week_day date;
begin
  if u is null then raise exception 'authentication_required' using errcode='28000'; end if;
  if exists(select 1 from public.sl_accounts where user_id=u and deletion_requested_at is not null)
    then raise exception 'account_deletion_pending'; end if;
  -- The shared account lock serializes this multi-query snapshot with every writer.
  select timezone into account_tz from public.sl_accounts where user_id=u for share;
  select * into pref from public.sl_study_preferences where user_id=u;
  tz:=coalesce(pref.timezone,account_tz,'Europe/Stockholm');
  if not exists(select 1 from pg_catalog.pg_timezone_names where name=tz) then tz:='Europe/Stockholm'; end if;
  today:=(clock_timestamp() at time zone tz)::date;
  mon:=date_trunc('month',coalesce(p_month,today))::date;
  if mon < date '2000-01-01' or mon > date '2200-12-01' then raise exception 'invalid_month'; end if;
  week_day:=today-(extract(isodow from today)::integer-1);
  return jsonb_build_object('version',1,'enabled',coalesce(pref.enabled,false),'generation',coalesce(pref.generation,0),
    'timezone',tz,'today',today,'month',mon,
    'totals',jsonb_build_object(
      'today',coalesce((select milliseconds from public.sl_study_days where user_id=u and day=today),0),
      'week',coalesce((select sum(milliseconds) from public.sl_study_days where user_id=u and day between week_day and today),0),
      'month',coalesce((select sum(milliseconds) from public.sl_study_days where user_id=u and day between date_trunc('month',today)::date and today),0),
      'all',coalesce((select sum(milliseconds) from public.sl_study_days where user_id=u),0)),
    'days',coalesce((select jsonb_object_agg(day::text,milliseconds) from public.sl_study_days
      where user_id=u and (day between mon and (mon+interval '1 month - 1 day')::date or day between today-6 and today)),'{}'::jsonb));
end $$;

-- Compare-and-set protects consent from a delayed settings request on another device.
create function public.sl_study_settings(p_enabled boolean,p_timezone text,p_generation bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.sl_accounts; pref public.sl_study_preferences; ms bigint;
begin
  a:=sl_private.lock_account();
  perform sl_private.check_timezone(p_timezone);
  if p_enabled is null or p_generation is null then raise exception 'settings_required'; end if;
  insert into public.sl_study_preferences(user_id) values(a.user_id) on conflict do nothing;
  select * into strict pref from public.sl_study_preferences where user_id=a.user_id;
  if pref.generation<>p_generation then raise exception 'study_settings_conflict' using errcode='40001'; end if;
  if pref.enabled is distinct from p_enabled or pref.timezone is distinct from p_timezone then
    ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
    update public.sl_study_leases set end_ms=greatest(cursor_ms,least(end_ms,ms)),closed=true where user_id=a.user_id and not closed;
    update public.sl_study_preferences set enabled=p_enabled,timezone=p_timezone,generation=generation+1,updated_at=clock_timestamp() where user_id=a.user_id;
  end if;
  return public.sl_study_status();
end $$;

-- One live account-wide lease, across browsers and devices. Caller cannot set its dates.
create function public.sl_study_open(p_lease_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.sl_accounts; pref public.sl_study_preferences; lease public.sl_study_leases; ms bigint;
begin
  a:=sl_private.lock_account();
  ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  select * into pref from public.sl_study_preferences where user_id=a.user_id;
  if pref.enabled is distinct from true then raise exception 'study_consent_required' using errcode='42501'; end if;
  if p_lease_id is null then raise exception 'lease_id_required'; end if;
  select * into lease from public.sl_study_leases where user_id=a.user_id and id=p_lease_id;
  if found then
    if lease.closed or lease.end_ms<=ms or lease.generation<>pref.generation then
      return jsonb_build_object('available',false,'expired',true,'server_ms',ms);
    end if;
  else
    if exists(select 1 from public.sl_study_leases where user_id=a.user_id and not closed and end_ms>ms) then
      return jsonb_build_object('available',false,'expired',false,'server_ms',ms);
    end if;
    insert into public.sl_study_leases(user_id,id,generation,timezone,start_ms,end_ms,cursor_ms)
      values(a.user_id,p_lease_id,pref.generation,pref.timezone,ms,ms+90000,ms) returning * into lease;
  end if;
  return jsonb_build_object('available',true,'id',lease.id,'server_ms',ms,'end_ms',lease.end_ms,
    'cursor_ms',lease.cursor_ms,'generation',lease.generation,'timezone',lease.timezone);
end $$;

-- Immutable UUID receipt. Empty batches renew/release; bounded periods are never client totals.
create function public.sl_study_commit(p_id uuid,p_lease_id uuid,p_segments jsonb,p_close boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.sl_accounts; pref public.sl_study_preferences; lease public.sl_study_leases;
  receipt public.sl_study_receipts; body jsonb; result jsonb; ms bigint; seg jsonb; lo bigint; hi bigint; cursor_value bigint;
begin
  a:=sl_private.lock_account();
  ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  if p_id is null or p_lease_id is null or p_close is null or p_segments is null
    or jsonb_typeof(p_segments)<>'array' or octet_length(p_segments::text)>32768
    then raise exception 'invalid_study_batch' using errcode='22023'; end if;
  if jsonb_array_length(p_segments)>24 then raise exception 'study_batch_too_large' using errcode='22023'; end if;
  body:=jsonb_build_object('lease',p_lease_id,'segments',p_segments,'close',p_close);
  select * into receipt from public.sl_study_receipts where user_id=a.user_id and id=p_id;
  if found then
    if receipt.request is distinct from body then raise exception 'study_id_reused' using errcode='22023'; end if;
    return receipt.response;
  end if;
  select * into pref from public.sl_study_preferences where user_id=a.user_id;
  select * into lease from public.sl_study_leases where user_id=a.user_id and id=p_lease_id;
  if not found then raise exception 'own_study_lease_required' using errcode='42501'; end if;
  if pref.enabled is distinct from true or pref.generation<>lease.generation
    then raise exception 'study_consent_changed' using errcode='42501'; end if;
  if ms > lease.end_ms+86400000 then raise exception 'study_batch_expired' using errcode='22023'; end if;
  cursor_value:=lease.cursor_ms;
  for seg in select value from jsonb_array_elements(p_segments) loop
    if jsonb_typeof(seg)<>'array' or jsonb_array_length(seg)<>2 then raise exception 'invalid_study_segment' using errcode='22023'; end if;
    if jsonb_typeof(seg->0)<>'number' or jsonb_typeof(seg->1)<>'number'
      or (seg->>0)!~'^[0-9]{1,15}$' or (seg->>1)!~'^[0-9]{1,15}$'
      then raise exception 'integer_study_times_required' using errcode='22023'; end if;
    lo:=(seg->>0)::bigint; hi:=(seg->>1)::bigint;
    if lo<cursor_value or hi<=lo or hi-lo>30000 or hi>lease.end_ms or hi>ms then
      raise exception 'study_segment_outside_grant' using errcode='22023';
    end if;
    insert into public.sl_study_periods(user_id,lease_id,start_ms,end_ms) values(a.user_id,p_lease_id,lo,hi);
    perform sl_private.study_add(a.user_id,lo,hi,lease.timezone);
    cursor_value:=hi;
  end loop;
  update public.sl_study_leases set cursor_ms=cursor_value,
    end_ms=case when p_close then greatest(cursor_value,least(end_ms,ms))
      when not closed and end_ms>ms then ms+90000 else end_ms end,
    closed=closed or p_close where user_id=a.user_id and id=p_lease_id returning * into lease;
  result:=jsonb_build_object('id',p_lease_id,'server_ms',ms,'end_ms',lease.end_ms,'cursor_ms',lease.cursor_ms,'closed',lease.closed);
  insert into public.sl_study_receipts(user_id,id,lease_id,request,response) values(a.user_id,p_id,p_lease_id,body,result);
  return result;
end $$;

revoke all on function sl_private.study_add(uuid,bigint,bigint,text) from public,anon,authenticated;
revoke all on function public.sl_study_status(date) from public,anon,authenticated;
revoke all on function public.sl_study_settings(boolean,text,bigint) from public,anon,authenticated;
revoke all on function public.sl_study_open(uuid) from public,anon,authenticated;
revoke all on function public.sl_study_commit(uuid,uuid,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.sl_study_status(date) to authenticated;
grant execute on function public.sl_study_settings(boolean,text,bigint) to authenticated;
grant execute on function public.sl_study_open(uuid) to authenticated;
grant execute on function public.sl_study_commit(uuid,uuid,jsonb,boolean) to authenticated;
commit;
