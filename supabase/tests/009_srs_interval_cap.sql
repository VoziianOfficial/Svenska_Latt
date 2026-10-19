-- TEST ONLY. Disposable database after 001-011 (or after the 012 assertions).
-- Installation/reinstallation must preserve every existing public sl_* row.
create temp table srs_preserved(table_name text primary key, data jsonb);
do $$ declare t record; v jsonb; begin
  for t in select tablename from pg_tables where schemaname='public' and tablename like 'sl_%' loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',t.tablename) into v;
    insert into srs_preserved values(t.tablename,v);
  end loop;
end $$;
-- Set srs_skip_manual_patch=true to test a clean 012 -> 013 installation.
\if :{?srs_skip_manual_patch}
\else
\ir ../patches/srs_interval_cap.sql
\endif
create temp table srs_helper_before as
select pg_get_functiondef(oid) definition, proacl acl from pg_proc
where oid='sl_private.review(uuid,text,boolean,timestamptz)'::regprocedure;
\ir ../migrations/202610180013_srs_interval_cap.sql
-- The first application may replace the original uncapped implementation.
-- Its public contract/ACL must remain unchanged in either installation path.
do $$ begin
  if not exists(select 1 from pg_proc p cross join srs_helper_before b
      where p.oid='sl_private.review(uuid,text,boolean,timestamptz)'::regprocedure
      and p.proacl is not distinct from b.acl) then
    raise exception 'FAIL: first 013 changed helper ACL';
  end if;
end $$;
update srs_helper_before set definition=pg_get_functiondef('sl_private.review(uuid,text,boolean,timestamptz)'::regprocedure);
\ir ../migrations/202610180013_srs_interval_cap.sql

do $$ declare t record; v jsonb; begin
  for t in select * from srs_preserved loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r) order by to_jsonb(r)::text),''[]''::jsonb) from public.%I r',t.table_name) into v;
    if v is distinct from t.data then raise exception 'FAIL: 013 changed rows in %',t.table_name; end if;
  end loop;
  if not exists(select 1 from pg_proc p cross join srs_helper_before b
      where p.oid='sl_private.review(uuid,text,boolean,timestamptz)'::regprocedure
      and pg_get_functiondef(p.oid)=b.definition and p.proacl is not distinct from b.acl) then
    raise exception 'FAIL: repeated 013 changed manual helper definition or ACL';
  end if;
  raise notice 'PASS: 013 -> 013 preserves all rows, helper definition and ACL';
end $$;
\ir helpers/srs_boundary_cases.sql
