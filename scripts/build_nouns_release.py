"""Prepare 023 from the actual installed-022 JSON. No DB/network/SQL execution.

Never modifies migrations 001–022, never overwrites an existing candidate.
"""
import hashlib
import json
import re
import subprocess
from check_supabase_manifest import current_manifest, read_manifest
from nouns_contract import (ROOT, BASELINE, MIGRATION, VERSION_022, SIGNATURES,
                            observed_baseline, properties, functions_query, archives_query)
from presens_contract import body, md5


def J(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def patch_function(signature, patches, tag):
    sql = 'do $' + tag + '$\ndeclare definition text;\n'
    for i, (old, new) in enumerate(patches):
        sql += f'  old_{i} constant text := $old${old}$old$;\n  new_{i} constant text := $new${new}$new$;\n'
    sql += f"begin\n  definition:=pg_get_functiondef('{signature}'::regprocedure);\n"
    for i in range(len(patches)):
        sql += f"  if (length(definition)-length(replace(definition,old_{i},'')))<>length(old_{i}) then raise exception '023: {tag} anchor {i} differs'; end if;\n  definition:=replace(definition,old_{i},new_{i});\n"
    return sql + '  execute definition;\nend $' + tag + '$;\n'


def main():
    assert not MIGRATION.exists(), '023 already exists; inspect it, never overwrite a candidate'
    observed = observed_baseline()
    previous = read_manifest(ROOT / 'supabase/migrations/202611230022_presens.sql')
    assert previous == observed['manifest']
    manifest = current_manifest()
    expected = json.loads(J(previous)); expected['lessons']['lesson-5'] = 24; expected['version'] = manifest['version']
    assert manifest == expected, 'Unreviewed manifest changes'
    catalog = json.loads(subprocess.check_output(['node', str(ROOT / 'scripts/quiz_catalog.cjs')], text=True))
    bank = catalog['lesson:lesson-5']
    assert bank['count'] == len(bank['start_questions']) == 24 and bank['reward'] == 35
    assert len(bank['questions']) == 34
    for key, old in observed['quiz_catalog'].items():
        if key != 'lesson:lesson-5':
            assert catalog[key] == old, key
        else:
            assert old['count'] == 10 and old['reward'] == bank['reward']
            assert all(bank['questions'][key] == value for key, value in old['questions'].items())
    active = J(bank['start_questions'])
    writer_patches = [
        ("    elsif d->>'content_version' is distinct from input_manifest->>'version' then",
         f"    elsif d->>'content_version'='{VERSION_022}' then\n      input_manifest:=sl_private.manifest_before_023();\n    elsif d->>'content_version' is distinct from input_manifest->>'version' then"),
        ("then sl_private.quiz_catalog_before_022()->qid\n      else sl_private.quiz_catalog()->qid end;",
         f"then sl_private.quiz_catalog_before_022()->qid\n      when d->>'content_version'='{VERSION_022}' then sl_private.quiz_catalog_before_023()->qid\n      else sl_private.quiz_catalog()->qid end;")]
    addition = f"""  result:=coalesce((select jsonb_set(result,'{{state,quizResults,assessment:nouns-final-v1}}',
      jsonb_build_object('correct',best.correct,'total',24,
        'rewarded',coalesce((result #>> '{{state,quizResults,lesson:lesson-5,rewarded}}')::boolean,false)))
    from (select s.correct from public.sl_sessions s
      where s.user_id=a.user_id and s.quiz_id='lesson:lesson-5'
        and s.status='completed' and s.trusted_quiz
        and s.questions @> $final_questions${active}$final_questions$::jsonb
        and $final_questions${active}$final_questions$::jsonb @> s.questions
      order by s.correct desc,s.started_at desc limit 1) best),result);
  return result;"""
    reader_patches = [("'presens_final_v1'", f"'presens_final_v1','nouns_final_v1','event_replay:{VERSION_022}'"),
                      ('  return result;', addition)]
    sources = {k: f['source'] for k, f in observed['functions'].items()}
    for name, patches in [('reader', reader_patches), ('writer', writer_patches)]:
        for old, new in patches:
            assert sources[name].count(old) == 1, (name, old)
            sources[name] = sources[name].replace(old, new)
    catalog_body = f"""
select jsonb_set(sl_private.quiz_catalog_before_023(),'{{lesson:lesson-5}}',
  (sl_private.quiz_catalog_before_023()->'lesson:lesson-5') || $nouns_bank${json.dumps(bank, ensure_ascii=False, indent=2)}$nouns_bank$::jsonb);
"""
    manifest_body = '\nselect $manifest$' + json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + '$manifest$::jsonb;\n'
    sources.update(catalog=catalog_body, manifest=manifest_body)
    post = {k: md5(v) for k, v in sources.items()}
    post_properties = properties(observed['functions'])
    for name in post_properties:
        post_properties[name]['md5'] = post[name]
        post_properties[name]['definition_md5'] = md5(observed['functions'][name]['definition'].replace(
            observed['functions'][name]['source'], sources[name], 1))
    banks_sql = "select jsonb_object_agg(k,b) from jsonb_each(sl_private.quiz_catalog()) e(k,b) where k in ('lesson:lesson-1','lesson:lesson-2','lesson:lesson-3','lesson:lesson-4','lesson:lesson-5')"
    sql = f"""-- 023, prepared against the user-supplied installed-022 baseline.
-- Baseline SHA256: {hashlib.sha256(BASELINE.read_bytes()).hexdigest()}
-- Manual release only, one complete transaction; never replay migrations 018–022.
-- No DML on user data. Historical IDs, receipts, sessions and lifetime XP stay intact.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
-- Short write barrier makes the reservation guards stable until COMMIT.
lock table public.sl_accounts,public.sl_quiz_results,public.sl_lessons,
  public.sl_sessions,public.sl_events in share mode;
do $prerequisites$
begin
  if current_user <> 'postgres' then raise exception '023: run as observed function owner postgres'; end if;
  if to_regprocedure('sl_private.manifest_before_023()') is not null
    or to_regprocedure('sl_private.quiz_catalog_before_023()') is not null then
    raise exception '023: backup already exists; never reapply';
  end if;
  if ({functions_query()}) is distinct from $expected_functions${J(properties(observed['functions']))}$expected_functions$::jsonb then
    raise exception '023: installed functions or properties differ from observed 022';
  end if;
  if sl_private.manifest()->>'version' is distinct from '{VERSION_022}' then
    raise exception '023: installed content_version differs';
  end if;
  if sl_private.manifest() is distinct from $base_manifest${J(previous)}$base_manifest$::jsonb then
    raise exception '023: installed manifest differs';
  end if;
  if md5(sl_private.quiz_catalog()::text) is distinct from '{observed['catalog_value_md5']}'
    or ({banks_sql}) is distinct from $observed_banks${J(observed['quiz_catalog'])}$observed_banks$::jsonb then
    raise exception '023: installed catalog differs from observed 022';
  end if;
  if ({archives_query()}) is distinct from $expected_archives${J(properties(observed['archives']))}$expected_archives$::jsonb then
    raise exception '023: replay archives or properties differ from observed 022';
  end if;
  if exists(select 1 from public.sl_lessons l
    left join public.sl_quiz_results r on r.user_id=l.user_id and r.quiz_id='lesson:lesson-5'
    where l.lesson_id='lesson-5' and l.completed and not coalesce(r.rewarded,false))
    or exists(select 1 from public.sl_sessions s
    join public.sl_events e on e.user_id=s.user_id and e.session_id=s.id and e.xp_delta>0
    left join public.sl_quiz_results r on r.user_id=s.user_id and r.quiz_id='lesson:lesson-5'
    where s.quiz_id='lesson:lesson-5' and not coalesce(r.rewarded,false)) then
    raise exception '023: historical lesson reward reservation missing; review without changing XP';
  end if;
end $prerequisites$;
do $preserve$
declare bank jsonb; frozen_manifest jsonb;
begin
  bank:=sl_private.quiz_catalog();frozen_manifest:=sl_private.manifest();
  execute 'create function sl_private.quiz_catalog_before_023() returns jsonb language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select '||quote_literal(bank::text)||'::jsonb');
  execute 'create function sl_private.manifest_before_023() returns jsonb language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select '||quote_literal(frozen_manifest::text)||'::jsonb');
end $preserve$;
revoke all on function sl_private.quiz_catalog_before_023() from public,anon,authenticated;
revoke all on function sl_private.manifest_before_023() from public,anon,authenticated;
create or replace function sl_private.quiz_catalog() returns jsonb
language sql immutable security invoker set search_path='' as $function${catalog_body}$function$;
do $bank_guard$
declare item record; q record; current_bank jsonb; old_bank jsonb;
begin
  current_bank:=sl_private.quiz_catalog();old_bank:=sl_private.quiz_catalog_before_023();
  if (select count(*) from jsonb_object_keys(current_bank)) <> (select count(*) from jsonb_object_keys(old_bank)) then
    raise exception '023: catalog keys changed';
  end if;
  for item in select * from jsonb_each(old_bank) loop
    if item.key<>'lesson:lesson-5' then
      if current_bank->item.key is distinct from item.value then raise exception '023: unrelated quiz changed'; end if;
    else
      if current_bank->item.key->'reward' is distinct from item.value->'reward' then raise exception '023: reward changed'; end if;
      for q in select * from jsonb_each(item.value->'questions') loop
        if current_bank->item.key->'questions'->q.key is distinct from q.value then raise exception '023: historical answer changed'; end if;
      end loop;
      if current_bank->item.key is distinct from $expected_bank${J(bank)}$expected_bank$::jsonb then
        raise exception '023: new bank differs from reviewed 24+10 IDs';
      end if;
    end if;
  end loop;
end $bank_guard$;
{patch_function(SIGNATURES['reader'], reader_patches, 'reader_upgrade')}
{patch_function(SIGNATURES['writer'], writer_patches, 'writer_upgrade')}
create or replace function sl_private.manifest() returns jsonb
language sql immutable security invoker set search_path='' as $function${manifest_body}$function$;
do $final_guard$
begin
  if ({functions_query()}) is distinct from $post_functions${J(post_properties)}$post_functions$::jsonb then
    raise exception '023: final function fingerprint or properties differ';
  end if;
  if ({archives_query()}) is distinct from $old_archives${J(properties(observed['archives']))}$old_archives$::jsonb then
    raise exception '023: prior archives changed';
  end if;
  if not (select count(*)=2 and bool_and(pg_get_userbyid(p.proowner)='postgres'
      and not p.prosecdef and p.provolatile='i' and p.proconfig=array['search_path=""']::text[]
      and p.proacl::text='{{postgres=X/postgres}}')
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='sl_private' and p.proname in ('manifest_before_023','quiz_catalog_before_023')) then
    raise exception '023: new archive properties differ; check default privileges';
  end if;
end $final_guard$;
commit;
"""
    MIGRATION.write_text(sql)
    # PostgreSQL acceptance verifies these computed source MD5 against pg_proc.
    contract = dict(status='prepared-not-applied', installedBaselineVerified=True,
        baseline=str(BASELINE.relative_to(ROOT)), baselineSha256=hashlib.sha256(BASELINE.read_bytes()).hexdigest(),
        expectedBaseVersion=VERSION_022, expectedBaseMD5=observed['function_md5'],
        preparedVersion=manifest['version'], expectedPostMD5=post,
        replayVersions=['static-1aa3eb8422e2930a', 'static-57b40b608d91091d', VERSION_022],
        activeQuestions=24, archivedQuestions=10, reward=35,
        productionSqlExecuted=False, published=False, migrationSha256=hashlib.sha256(sql.encode()).hexdigest())
    (ROOT / 'reports/nouns/release-contract.json').write_text(json.dumps(contract, indent=2) + '\n')
    fingerprints = f"""-- READ ONLY. Expected post-023 sources and properties, verified in isolated PostgreSQL.
begin transaction read only;
set local statement_timeout='20s';
select sl_private.manifest()->>'version'='{manifest['version']}' as content_version_ok;
select ({functions_query()}) = $expected${J(post_properties)}$expected$::jsonb as all_functions_md5_owner_acl_config_definer_ok;
select ({archives_query()}) = $expected${J(properties(observed['archives']))}$expected$::jsonb as all_prior_archives_unchanged;
commit;
"""
    (ROOT / 'supabase/checks/023_nouns_fingerprints.sql').write_text(fingerprints)
    postflight = f"""-- READ ONLY. Run after the whole 023 transaction, before publishing the client.
-- Run fingerprints and compare data_audit before/after in the same quiet window.
begin transaction isolation level repeatable read read only;
set local statement_timeout='20s';
select sl_private.manifest()->>'version' as content_version;
select sl_private.manifest()=$expected${J(manifest)}$expected$::jsonb as full_manifest_ok;
with old_bank as (select sl_private.quiz_catalog_before_023() b),
 new_bank as (select sl_private.quiz_catalog() b)
select
 new_bank.b->'lesson:lesson-5'=$expected_bank${J(bank)}$expected_bank$::jsonb as exact_24_active_34_total_reward_35_ok,
 new_bank.b - 'lesson:lesson-5' = old_bank.b - 'lesson:lesson-5' as all_other_banks_unchanged,
 not exists(select 1 from jsonb_each(old_bank.b->'lesson:lesson-5'->'questions') q
   where new_bank.b->'lesson:lesson-5'->'questions'->q.key is distinct from q.value) as historical_questions_unchanged,
 md5(old_bank.b::text)='{observed['catalog_value_md5']}' as frozen_022_catalog_ok,
 sl_private.manifest_before_023()=$base${J(previous)}$base$::jsonb as frozen_022_manifest_ok,
 sl_private.manifest_before_022()->>'version'='static-57b40b608d91091d' as frozen_021_version_ok,
 sl_private.manifest_before_021()->>'version'='static-1aa3eb8422e2930a' as frozen_020_version_ok
from old_bank,new_bank;
select count(*)=9 and bool_and(
 pg_get_userbyid(p.proowner)='postgres' and not p.prosecdef
 and p.proconfig=array['search_path=""']::text[]
 and p.proacl::text='{{postgres=X/postgres}}'
 and not has_function_privilege('authenticated',p.oid,'execute')
 and not has_function_privilege('anon',p.oid,'execute')) as all_catalog_manifest_archives_private
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='sl_private' and (p.proname in ('manifest','quiz_catalog')
 or p.proname ~ '^(manifest|quiz_catalog)_before_0(18|19|20|21|22|23)$');
commit;
"""
    (ROOT / 'supabase/checks/023_nouns_postflight.sql').write_text(postflight)
    path = ROOT / 'sw.js'
    path.write_text(re.sub(r"const RELEASE\s*=\s*'[^']+';", "const RELEASE = '2026-11-27-nouns-023';", path.read_text(), count=1))
    assert f"version:'{manifest['version']}'" in (ROOT / 'app.js').read_text()
    print('PREPARED ONLY:', MIGRATION.name, manifest['version'])


if __name__ == '__main__':
    main()
