create function pg_temp.study_ok(value boolean,message text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'FAIL: %',message; end if; raise notice 'PASS: %',message; end $$;
create function pg_temp.study_fails(query text,code text) returns void language plpgsql as $$
begin
  begin execute query; exception when others then
    if sqlstate=code then raise notice 'PASS: rejected with %',code;return;end if;
    raise;
  end;
  raise exception 'FAIL: query unexpectedly succeeded: %',query;
end $$;
-- The previous study-time tests ran against 008. Upgrade and test the new defaults.
\ir ../migrations/202610180010_study_time_default.sql
insert into auth.users(id,email) values('83000000-0000-0000-0000-000000000001','study-default@example.invalid');
set role authenticated;
select set_config('request.jwt.claim.sub','83000000-0000-0000-0000-000000000001',false);
select public.sl_get_progress();
select pg_temp.study_ok(public.sl_study_status()->>'enabled'='true','new accounts track study time by default');
select pg_temp.study_ok((public.sl_study_open('83000000-0000-0000-0000-000000000002')->>'available')::boolean,'default-enabled account opens a lease without visiting settings');
select public.sl_study_settings(false,'Europe/Stockholm',0);
select pg_temp.study_ok(public.sl_study_status()->>'enabled'='false','manual opt-out is saved');
select pg_temp.study_fails($q$select public.sl_study_open(gen_random_uuid())$q$,'42501');
reset role;
-- Reapplying the migration must never enable an explicitly disabled account.
\ir ../migrations/202610180010_study_time_default.sql
set role authenticated;
select pg_temp.study_ok(public.sl_study_status()->>'enabled'='false','upgrade preserves an existing manual opt-out');
reset role;
