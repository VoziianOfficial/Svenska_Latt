"""Prepare separate 024 and read-only checks offline. Never apply SQL or overwrite 023."""
import hashlib
import json
import re
import subprocess
from noun_tables_contract import (ROOT, MIGRATION, PUBLISHED, VERSION_023, CATALOG_SHA256_023,
    source_023, sources_024, patches, published_properties, SIGNATURES)
from check_supabase_manifest import current_manifest, read_manifest
from nouns_contract import functions_query
from presens_contract import md5


def J(value): return json.dumps(value,ensure_ascii=False,separators=(',',':'))


def archive_query():
    return """select coalesce(jsonb_object_agg(p.proname,jsonb_build_object(
      'md5',md5(p.prosrc),'definition_md5',md5(pg_get_functiondef(p.oid)),
      'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,
      'config',p.proconfig,'security_definer',p.prosecdef)),'{}')
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='sl_private' and p.proname ~ '^(manifest|quiz_catalog)_before_[0-9]+$'"""


def main():
    assert not MIGRATION.exists(), '024 already exists; never overwrite a reviewed candidate'
    old=read_manifest(PUBLISHED);new=current_manifest()
    assert old['version']==VERSION_023 and new['version']!=VERSION_023
    assert {k:v for k,v in old.items() if k!='version'}=={k:v for k,v in new.items() if k!='version'}, 'IDs/counts changed'
    catalog=subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')])
    assert hashlib.sha256(catalog).hexdigest()==CATALOG_SHA256_023, 'Quiz catalog changed; 024 only permits table content'
    app=ROOT/'app.js';text=app.read_text()
    assert sum(text.count("version:'"+v+"'") for v in (VERSION_023,new['version']))==1, 'Client version differs'
    before=source_023();after=sources_024(new);props=published_properties()
    expected={k:{f:v for f,v in p.items() if f!='definition_md5'} for k,p in props.items()}
    for k in expected:expected[k]['md5']=md5(after[k])
    # Capture every archive, metadata included, inside the transaction; do not replace any.
    changes=''
    for name,pairs in patches().items():
        a,b=pairs[0]
        changes+=f"""do ${name}_024$
declare definition text;
  old_clause constant text := $old${a}$old$;
  new_clause constant text := $new${b}$new$;
begin
  definition:=pg_get_functiondef('{SIGNATURES[name]}'::regprocedure);
  if (length(definition)-length(replace(definition,old_clause,'')))<>length(old_clause) then
    raise exception '024: {name} anchor differs';
  end if;
  execute replace(definition,old_clause,new_clause);
end ${name}_024$;
"""
    old_archives=json.loads((ROOT/'supabase/checks/023_nouns_fingerprints.sql').read_text().split('$expected$')[3])
    sql=f"""-- 024: noun-table presentation/content only. Prepared offline from published 023.
-- User reports 023 installed and verified; no new live baseline was requested or queried.
-- One transaction; never reapply 023. No user data DML or quiz catalog replacement.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
lock table public.sl_accounts,public.sl_quiz_results,public.sl_lessons,
  public.sl_sessions,public.sl_events in share mode;
do $prerequisites_024$
begin
  if current_user<>'postgres' then raise exception '024: requires function owner postgres'; end if;
  if to_regprocedure('sl_private.manifest_before_024()') is not null then
    raise exception '024: backup already exists; never reapply';
  end if;
  if ({functions_query()}) is distinct from $expected_functions${J(props)}$expected_functions$::jsonb then
    raise exception '024: installed functions or properties differ from published 023';
  end if;
  if sl_private.manifest() is distinct from $old_manifest${J(old)}$old_manifest$::jsonb then
    raise exception '024: installed manifest differs from 023';
  end if;
  if (select jsonb_object_agg(key,value) from jsonb_each(({archive_query()}))
      where key ~ '^(manifest|quiz_catalog)_before_0(18|19|20|21|22)$')
      is distinct from $old_archives${J(old_archives)}$old_archives$::jsonb then
    raise exception '024: older replay archives differ';
  end if;
  if sl_private.manifest_before_023() is distinct from $manifest_022${J(read_manifest(ROOT/'supabase/migrations/202611230022_presens.sql'))}$manifest_022$::jsonb
    or md5(sl_private.quiz_catalog_before_023()::text) is distinct from '{re.search(r"md5\(old_bank.b::text\)='([^']+)'",(ROOT/'supabase/checks/023_nouns_postflight.sql').read_text())[1]}' then
    raise exception '024: frozen 022 values differ';
  end if;
  if not (select count(*)=2 and bool_and(pg_get_userbyid(p.proowner)='postgres'
      and not p.prosecdef and p.provolatile='i' and p.proconfig=array['search_path=""']::text[]
      and p.proacl::text='{{postgres=X/postgres}}')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='sl_private' and p.proname in ('manifest_before_023','quiz_catalog_before_023')) then
    raise exception '024: 023 archive properties differ';
  end if;
end $prerequisites_024$;
create temporary table noun_tables_024_guard on commit drop as
  select ({archive_query()}) as archives,sl_private.quiz_catalog() as catalog;
do $preserve_024$
begin
  execute 'create function sl_private.manifest_before_024() returns jsonb language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select '||quote_literal(sl_private.manifest()::text)||'::jsonb');
end $preserve_024$;
revoke all on function sl_private.manifest_before_024() from public,anon,authenticated;
{changes}
create or replace function sl_private.manifest() returns jsonb
language sql immutable security invoker set search_path='' as $function${after['manifest']}$function$;
do $final_guard_024$
begin
  if (select jsonb_object_agg(key,value-'definition_md5') from jsonb_each(({functions_query()})))
      is distinct from $expected_post${J(expected)}$expected_post$::jsonb then
    raise exception '024: final function sources or properties differ';
  end if;
  if (select archives from noun_tables_024_guard) is distinct from
      (({archive_query()})-'manifest_before_024') then
    raise exception '024: existing archives changed';
  end if;
  if (select catalog from noun_tables_024_guard) is distinct from sl_private.quiz_catalog() then
    raise exception '024: quiz catalog changed';
  end if;
  if sl_private.manifest_before_024() is distinct from $old_manifest${J(old)}$old_manifest$::jsonb
    or not (select pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef
      and p.provolatile='i' and p.proconfig=array['search_path=""']::text[]
      and p.proacl::text='{{postgres=X/postgres}}'
      from pg_proc p where p.oid='sl_private.manifest_before_024()'::regprocedure) then
    raise exception '024: new manifest archive differs';
  end if;
end $final_guard_024$;
commit;
"""
    # Generate all artifacts only after validating all inputs.
    MIGRATION.write_text(sql)
    dest=ROOT/'reports/noun-tables';dest.mkdir(parents=True,exist_ok=True)
    contract=dict(status='prepared-not-applied',baseVersion=VERSION_023,preparedVersion=new['version'],
        expectedBaseMD5={k:md5(v) for k,v in before.items()},expectedPostMD5={k:md5(v) for k,v in after.items()},
        migrationSha256=hashlib.sha256(sql.encode()).hexdigest(),published023Sha256=hashlib.sha256(PUBLISHED.read_bytes()).hexdigest(),
        catalogSha256=CATALOG_SHA256_023,productionConnected=False,productionSqlExecuted=False,
        baseline='published 023 source; installed/verified status supplied by user',
        replayVersions=['static-1aa3eb8422e2930a','static-57b40b608d91091d','static-18bd9e23b62c3382',VERSION_023])
    (dest/'release-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
    (ROOT/'supabase/checks/024_noun_tables_preflight.sql').write_text(f"""-- READ ONLY. Expected published-023 state, before applying 024.
begin transaction isolation level repeatable read read only;
select sl_private.manifest()->>'version' as content_version;
select ({functions_query()})=$expected${J(props)}$expected$::jsonb as functions_and_properties_ok;
select sl_private.manifest()=$expected${J(old)}$expected$::jsonb as manifest_ok;
select to_regprocedure('sl_private.manifest_before_024()') is null as backup_absent;
select ({archive_query()}) as replay_archive_fingerprints;
commit;
""")
    (ROOT/'supabase/checks/024_noun_tables_postflight.sql').write_text(f"""-- READ ONLY. Compare with preflight archive fingerprints (apart from new manifest_before_024).
begin transaction isolation level repeatable read read only;
select sl_private.manifest()->>'version' as content_version;
select sl_private.manifest()=$expected${J(new)}$expected$::jsonb as manifest_ok;
select (select jsonb_object_agg(key,value-'definition_md5') from jsonb_each(({functions_query()})))
  =$expected${J(expected)}$expected$::jsonb as functions_and_properties_ok;
select sl_private.manifest_before_024()=$expected${J(old)}$expected$::jsonb as prior_manifest_ok;
select ({archive_query()}) as replay_archive_fingerprints;
commit;
""")
    app.write_text(text.replace("version:'"+VERSION_023+"'","version:'"+new['version']+"'"))
    sw=ROOT/'sw.js';sw.write_text(re.sub(r"const RELEASE\s*=\s*'[^']+';","const RELEASE = '2026-11-27-noun-tables-024';",sw.read_text(),count=1))
    print('PREPARED ONLY:',MIGRATION.name,new['version'])

if __name__=='__main__':main()
