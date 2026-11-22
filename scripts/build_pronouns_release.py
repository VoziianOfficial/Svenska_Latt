"""Prepare 021 for the exact 020 contract. No network, SQL execution or publication.

The user's verified read-only 020 report is pinned in supabase/baselines.
Generation refuses to proceed if the reconstructed source differs from that report.
Installation rechecks the same values atomically; unknown state aborts.
Never regenerate 018/019/020 with current lessons.json.
"""
from pathlib import Path
import hashlib,json,re,subprocess
from check_supabase_manifest import current_manifest,read_manifest
ROOT=Path(__file__).resolve().parents[1]
def body(s,name,delim):return re.search(r'create or replace function '+re.escape(name)+r'.*?as '+re.escape(delim)+r'(.*?)'+re.escape(delim)+r';',s,re.S|re.I)[1]
def literal(s,name,delim):return re.search(name+r' constant text := '+re.escape(delim)+r'(.*?)'+re.escape(delim),s,re.S)[1]
def md5(s):return hashlib.md5(s.encode()).hexdigest()
s20=(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql').read_text();s14=(ROOT/'supabase/migrations/202610190014_video_progress.sql').read_text();s12=(ROOT/'supabase/migrations/202610180012_xp_integrity.sql').read_text()
reader14=body(s14,'public.sl_get_progress()','$$');cap20=literal(s20,'caps20','$new$');oldcap=literal(s20,'caps14','$old$');oldret=literal(s20,'old_return','$old$');ret20=literal(s20,'return14','$new$')
assert reader14.count(oldcap)==reader14.count(oldret)==1
reader20=reader14.replace(oldcap,cap20).replace(oldret,ret20)
writer=body(s12,'public.sl_apply_event','$$');a=literal(s14,'old_clause','$old$');b=literal(s14,'new_clause','$new$');assert writer.count(a)==1;writer=writer.replace(a,b)
base_manifest=read_manifest(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql');manifest=current_manifest()
catalog=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True));bank=catalog['lesson:lesson-3'];final=json.loads((ROOT/'lessons.json').read_text())[2]['pronounsChapter']['finalTest']
assert bank['count']==24 and bank['reward']==35 and len(bank['questions'])==35 and len(bank['start_questions'])==24
expected=json.loads(json.dumps(base_manifest));expected['lessons']['lesson-3']=24;expected['version']=manifest['version'];assert manifest==expected
start=json.dumps(bank['start_questions'],separators=(',',':'));cap21=cap20.replace("'greetings_final_v1'","'greetings_final_v1','pronouns_final_v1','event_replay:"+base_manifest['version']+"'")
addition=f"""  result:=coalesce((select jsonb_set(result,'{{state,quizResults,assessment:pronouns-final-v1}}',
      jsonb_build_object('correct',best.correct,'total',24,
        'rewarded',coalesce((result #>> '{{state,quizResults,lesson:lesson-3,rewarded}}')::boolean,false)))
    from (select s.correct from public.sl_sessions s
      where s.user_id=a.user_id and s.quiz_id='lesson:lesson-3'
        and s.status='completed' and s.trusted_quiz
        and s.questions @> $final_questions${start}$final_questions$::jsonb
        and $final_questions${start}$final_questions$::jsonb @> s.questions
      order by s.correct desc,s.started_at desc limit 1) best),result);
  return result;"""
assert reader20.count('  return result;')==1
fingerprints={name:md5(value) for name,value in [('manifest',body(s20,'sl_private.manifest()','$function$')),('catalog',body(s20,'sl_private.quiz_catalog()','$function$')),('reader',reader20),('writer',writer)]}
observed=json.loads((ROOT/'supabase/baselines/020_installed_20261122.json').read_text())
assert observed['content_version']==base_manifest['version'], 'Installed 020 version differs from archived source'
assert observed['function_md5']==fingerprints, 'Installed 020 MD5 differs from reconstructed source; independent review required'
# Only these exact anchors of the fingerprinted 020 writer may change.
writer_patches=[
 ('  bank jsonb; entry jsonb;', '  input_manifest jsonb; bank jsonb; entry jsonb;'),
 ("    if d->>'content_version' is distinct from sl_private.manifest()->>'version' then raise exception 'unsupported_content_version'; end if;",
  "    input_manifest:=sl_private.manifest();\n    if d->>'content_version'="+"'"+base_manifest['version']+"'"+" then\n      input_manifest:=sl_private.manifest_before_021();\n    elsif d->>'content_version' is distinct from input_manifest->>'version' then\n      raise exception 'unsupported_content_version';\n    end if;"),
 ("(sl_private.manifest()->case when d->>'mode'='lesson' then 'lessons' else 'books' end->>(d->>'context_id'))::integer",
  "(input_manifest->case when d->>'mode'='lesson' then 'lessons' else 'books' end->>(d->>'context_id'))::integer"),
 ("    bank:=sl_private.quiz_catalog()->qid;",
  "    bank:=case when d->>'content_version'="+"'"+base_manifest['version']+"'"+"\n      then sl_private.quiz_catalog_before_021()->qid else sl_private.quiz_catalog()->qid end;")
]
writer21=writer
for old,new in writer_patches:
 assert writer21.count(old)==1, 'Unknown 020 writer anchor'
 writer21=writer21.replace(old,new)
writer_upgrade="""do $writer_upgrade$
declare definition text;
"""
for i,(old,new) in enumerate(writer_patches):
 writer_upgrade+=f"  old_{i} constant text := $old${old}$old$;\n  new_{i} constant text := $new${new}$new$;\n"
writer_upgrade+="""begin
  definition:=pg_get_functiondef('public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure);
"""
for i in range(len(writer_patches)):
 writer_upgrade+=f"  if (length(definition)-length(replace(definition,old_{i},'')))<>length(old_{i}) then raise exception '021: writer anchor {i} differs'; end if;\n  definition:=replace(definition,old_{i},new_{i});\n"
writer_upgrade+="""  execute definition;
end $writer_upgrade$;
"""
sql=f"""-- PREPARED ONLY: independent 021, exact installed 020 contract required.
-- First run supabase/checks/021_pronouns_preflight.sql manually (read-only).
-- See docs/PRONOUNS_LESSON_REVIEW.md. This generator NEVER executes SQL.
-- No historical sessions/events/results/XP/rewards/queue entries are rewritten.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
do $prerequisites$
begin
  if (select md5(prosrc) from pg_proc where oid='sl_private.manifest()'::regprocedure) is distinct from '{fingerprints['manifest']}'
    or (select md5(prosrc) from pg_proc where oid='sl_private.quiz_catalog()'::regprocedure) is distinct from '{fingerprints['catalog']}'
    or (select md5(prosrc) from pg_proc where oid='public.sl_get_progress()'::regprocedure) is distinct from '{fingerprints['reader']}'
    or (select md5(prosrc) from pg_proc where oid='public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure) is distinct from '{fingerprints['writer']}' then
    raise exception '021: installed functions differ from reviewed 020; obtain read-only preflight and review';
  end if;
  if sl_private.manifest()->>'version' is distinct from '{observed['content_version']}' then
    raise exception '021: installed content_version differs from verified 020; do not publish client';
  end if;
  if sl_private.manifest() is distinct from $base_manifest${json.dumps(base_manifest,ensure_ascii=False,separators=(',',':'))}$base_manifest$::jsonb then
    raise exception '021: installed manifest differs from 020; do not publish client';
  end if;
  if exists(select 1 from public.sl_lessons l
      left join public.sl_quiz_results r on r.user_id=l.user_id and r.quiz_id='lesson:lesson-3'
      where l.lesson_id='lesson-3' and l.completed and not coalesce(r.rewarded,false))
    or exists(select 1 from public.sl_sessions s
      join public.sl_events e on e.user_id=s.user_id and e.session_id=s.id and e.xp_delta>0
      left join public.sl_quiz_results r on r.user_id=s.user_id and r.quiz_id='lesson:lesson-3'
      where s.quiz_id='lesson:lesson-3' and not coalesce(r.rewarded,false)) then
    raise exception '021: historical lesson reward reservation missing; review required';
  end if;
end $prerequisites$;
do $preserve$
declare bank jsonb; frozen_manifest jsonb;
begin
  if to_regprocedure('sl_private.quiz_catalog_before_021()') is not null or to_regprocedure('sl_private.manifest_before_021()') is not null then
    raise exception '021: backup already exists; never reapply';
  end if;
  bank:=sl_private.quiz_catalog();
  frozen_manifest:=sl_private.manifest();
  execute 'create function sl_private.quiz_catalog_before_021() returns jsonb '
    || 'language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select ' || quote_literal(bank::text) || '::jsonb');
  execute 'create function sl_private.manifest_before_021() returns jsonb '
    || 'language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select ' || quote_literal(frozen_manifest::text) || '::jsonb');
end $preserve$;
revoke all on function sl_private.quiz_catalog_before_021() from public,anon,authenticated;
revoke all on function sl_private.manifest_before_021() from public,anon,authenticated;
create or replace function sl_private.quiz_catalog() returns jsonb
language sql immutable security invoker set search_path='' as $function$
select jsonb_set(sl_private.quiz_catalog_before_021(),'{{lesson:lesson-3}}',
  (sl_private.quiz_catalog_before_021()->'lesson:lesson-3') || $pronouns_bank${json.dumps(bank,ensure_ascii=False,indent=2)}$pronouns_bank$::jsonb);
$function$;
revoke all on function sl_private.quiz_catalog() from public,anon,authenticated;
do $bank_guard$
declare item record; q record; current_bank jsonb;
begin
  current_bank:=sl_private.quiz_catalog();
  for item in select * from jsonb_each(sl_private.quiz_catalog_before_021()) loop
    if item.key<>'lesson:lesson-3' then
      if current_bank->item.key is distinct from item.value then raise exception '021: unrelated quiz changed'; end if;
    else
      if current_bank->item.key->'reward' is distinct from item.value->'reward' then raise exception '021: reward changed'; end if;
      for q in select * from jsonb_each(item.value->'questions') loop
        if current_bank->item.key->'questions'->q.key is distinct from q.value then raise exception '021: historical answer changed'; end if;
      end loop;
      if jsonb_array_length(current_bank->item.key->'start_questions')<>24 then raise exception '021: invalid active count'; end if;
    end if;
  end loop;
end $bank_guard$;
-- Preserve reader signature, SECURITY DEFINER, owner, search_path and ACL.
-- Existing lesson-1/2 result projections remain intact.
do $reader_upgrade$
declare definition text;
  old_caps constant text := $old${cap20}$old$;
  new_caps constant text := $new${cap21}$new$;
  old_return constant text := $old$  return result;$old$;
  new_return constant text := $new${addition}$new$;
begin
  definition:=pg_get_functiondef('public.sl_get_progress()'::regprocedure);
  if (length(definition)-length(replace(definition,old_caps,'')))<>length(old_caps)
    or (length(definition)-length(replace(definition,old_return,'')))<>length(old_return) then
    raise exception '021: reader anchors differ; review required';
  end if;
  definition:=replace(replace(definition,old_caps,new_caps),old_return,new_return);
  execute definition;
end $reader_upgrade$;
-- Replay the exact verified 020 generation without rewriting queued requests.
-- Reward/scoring/receipt/ownership logic is unchanged; current starts still use 021.
{writer_upgrade}
-- Atomic banks + replay writer + capabilities + manifest; verify before client publication.
create or replace function sl_private.manifest() returns jsonb
language sql immutable security invoker set search_path='' as $function$
select $manifest${json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)}$manifest$::jsonb;
$function$;
commit;
"""
assert not re.search(r'@[A-Z_]+@',sql)
post_reader=reader20.replace(cap20,cap21).replace('  return result;',addition)
post_fingerprints=dict(manifest=md5(body(sql,'sl_private.manifest()','$function$')),catalog=md5(body(sql,'sl_private.quiz_catalog()','$function$')),reader=md5(post_reader),writer=md5(writer21))
(ROOT/'supabase/migrations/202611220021_pronouns.sql').write_text(sql)
preflight="""-- READ ONLY. Run manually before considering 021; do not expose user rows.
-- Compare these values with reports/pronouns/release-contract.json.
select p.oid::regprocedure::text as function_name, md5(p.prosrc) as body_md5
from pg_proc p where p.oid in (
 'sl_private.manifest()'::regprocedure,
 'sl_private.quiz_catalog()'::regprocedure,
 'public.sl_get_progress()'::regprocedure,
 'public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure);
select sl_private.manifest()->>'version' as content_version,
 sl_private.manifest()->'lessons'->>'lesson-3' as lesson_3_active_count;
select jsonb_array_length(sl_private.quiz_catalog()->'lesson:lesson-1'->'start_questions') as alphabet_active,
 jsonb_array_length(sl_private.quiz_catalog()->'lesson:lesson-2'->'start_questions') as greetings_active,
 sl_private.quiz_catalog()->'lesson:lesson-3'->>'count' as pronouns_legacy_count,
 sl_private.quiz_catalog()->'lesson:lesson-3'->>'reward' as pronouns_reward;
"""
(ROOT/'supabase/checks/021_pronouns_preflight.sql').write_text(preflight)
postflight=f"""-- READ ONLY. Run manually after 021 commits and before publishing the client.
-- No user rows, user IDs, answer strings or secrets are returned.
select sl_private.manifest()->>'version' as content_version,
 sl_private.manifest()->>'version' = '{manifest['version']}' as version_ok;
select v.name, md5(p.prosrc) as actual_md5, v.expected_md5,
 md5(p.prosrc) = v.expected_md5 as function_ok
from (values
 ('manifest','sl_private.manifest()','{post_fingerprints['manifest']}'),
 ('catalog','sl_private.quiz_catalog()','{post_fingerprints['catalog']}'),
 ('reader','public.sl_get_progress()','{post_fingerprints['reader']}'),
 ('writer','public.sl_apply_event(uuid,bigint,jsonb)','{post_fingerprints['writer']}')
) v(name,signature,expected_md5)
left join pg_proc p on p.oid=to_regprocedure(v.signature);
with old_bank as (select sl_private.quiz_catalog_before_021() b),
 new_bank as (select sl_private.quiz_catalog() b)
select (select count(*)=24 from jsonb_array_elements(new_bank.b->'lesson:lesson-3'->'start_questions')) as active_24,
 (select count(*)=35 from jsonb_object_keys(new_bank.b->'lesson:lesson-3'->'questions')) as total_35,
 new_bank.b->'lesson:lesson-3'->>'reward'='35' as reward_35,
 not exists(select 1 from jsonb_each(old_bank.b) item
   where item.key<>'lesson:lesson-3' and new_bank.b->item.key is distinct from item.value) as other_banks_unchanged,
 not exists(select 1 from jsonb_each(old_bank.b->'lesson:lesson-3'->'questions') q
   where new_bank.b->'lesson:lesson-3'->'questions'->q.key is distinct from q.value) as archive_unchanged,
 sl_private.manifest_before_021()->>'version'='{base_manifest['version']}' as frozen_020_version_ok,
 not has_function_privilege('authenticated','sl_private.quiz_catalog()','execute')
   and not has_function_privilege('anon','sl_private.quiz_catalog()','execute')
   and not has_function_privilege('authenticated','sl_private.quiz_catalog_before_021()','execute')
   and not has_function_privilege('anon','sl_private.quiz_catalog_before_021()','execute') as answer_bank_private
from old_bank,new_bank;
"""
(ROOT/'supabase/checks/021_pronouns_postflight.sql').write_text(postflight)
(Root:=ROOT/'reports/pronouns').mkdir(exist_ok=True)
(Root/'release-contract.json').write_text(json.dumps(dict(baseMigration='020',declaredInstalledByUser=True,installedFingerprintsVerified=True,verificationSource=observed['source'],baselineReport='supabase/baselines/020_installed_20261122.json',expectedBaseVersion=base_manifest['version'],expectedBaseMD5=fingerprints,preparedVersion=manifest['version'],expectedPostMD5=post_fingerprints,activeQuestions=24,archivedQuestions=11,reward=35,replayFromVersion=base_manifest['version'],replayCapability='event_replay:'+base_manifest['version'],generatorSqlExecuted=False,productionSqlExecuted=False,generatorExecutesSql=False,published=False),indent=2)+'\n')
p=ROOT/'app.js';p.write_text(re.sub(r"version:'static-[a-f0-9]+'","version:'"+manifest['version']+"'",p.read_text()))
print('PREPARED ONLY: 021',manifest['version'],'24 active + 11 archived IDs; exact 020 preflight required; SQL NOT executed')
