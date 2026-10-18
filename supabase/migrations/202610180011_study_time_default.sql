-- Enable study time for accounts without a saved preference. Preserve manual opt-outs.
begin;
alter table public.sl_study_preferences alter column enabled set default true;

create or replace function public.sl_study_status(p_month date default null) returns jsonb
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
  return jsonb_build_object('version',1,'enabled',coalesce(pref.enabled,true),'generation',coalesce(pref.generation,0),
    'timezone',tz,'today',today,'month',mon,
    'totals',jsonb_build_object(
      'today',coalesce((select milliseconds from public.sl_study_days where user_id=u and day=today),0),
      'week',coalesce((select sum(milliseconds) from public.sl_study_days where user_id=u and day between week_day and today),0),
      'month',coalesce((select sum(milliseconds) from public.sl_study_days where user_id=u and day between date_trunc('month',today)::date and today),0),
      'all',coalesce((select sum(milliseconds) from public.sl_study_days where user_id=u),0)),
    'days',coalesce((select jsonb_object_agg(day::text,milliseconds) from public.sl_study_days
      where user_id=u and (day between mon and (mon+interval '1 month - 1 day')::date or day between today-6 and today)),'{}'::jsonb));
end $$;

create or replace function public.sl_study_open(p_lease_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.sl_accounts; pref public.sl_study_preferences; lease public.sl_study_leases; ms bigint;
begin
  a:=sl_private.lock_account();
  ms:=floor(extract(epoch from clock_timestamp())*1000)::bigint;
  insert into public.sl_study_preferences(user_id,timezone) values(a.user_id,a.timezone) on conflict do nothing;
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

commit;
