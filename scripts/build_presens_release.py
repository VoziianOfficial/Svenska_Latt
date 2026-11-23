"""Generate ONLY candidate 022, after a supplied actual installed-021 baseline.

No DB/network/SQL execution. No rewriting 018–021. With no observed baseline this
exits before creating migration SQL or changing the client version. Archived
source fingerprints are a comparison target, never an observed DB baseline.
"""
from pathlib import Path
import json
import re
import subprocess
from check_supabase_manifest import current_manifest, read_manifest
from presens_contract import ROOT, installed_021_source, md5

BASELINE=ROOT/'supabase/baselines/021_installed_for_022.json'
VERSION_021='static-57b40b608d91091d'

def main():
 if not BASELINE.is_file():
  raise SystemExit('BASELINE REQUIRED: run 022_presens_preflight.sql manually; save the actual JSON as supabase/baselines/021_installed_for_022.json. No SQL generated, no client version changed.')
 observed=json.loads(BASELINE.read_text())
 source=installed_021_source()
 fingerprints={name:md5(value) for name,value in source.items()}
 old=read_manifest(ROOT/'supabase/migrations/202611220021_pronouns.sql')
 assert observed['content_version']==VERSION_021==old['version'], 'Installed content_version differs: review the actual DB, do not bypass guards'
 assert observed['function_md5']==fingerprints, 'Observed MD5 differs from archived 021: independently review actual definitions before preparing 022'
 assert observed['manifest']==old, 'Installed full manifest differs'
 assert observed['backups']==dict(manifest_before_021=True,catalog_before_021=True,manifest_before_022=False,catalog_before_022=False), 'Backup state differs; never reapply 021/022'
 manifest=current_manifest()
 expected=json.loads(json.dumps(old));expected['lessons']['lesson-4']=24;expected['version']=manifest['version']
 assert manifest==expected,'Unexpected content identity/count change'
 catalog=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True))
 for i in range(1,5):
  key='lesson:lesson-'+str(i);bank=catalog[key]
  if i==4:
   legacy=next(l for l in json.loads((ROOT/'lessons.json').read_text()) if l['id']=='lesson-4')['questions']
   bank=dict(count=len(legacy),reward=35,questions={'q'+str(n):dict(answer=q['answer']) for n,q in enumerate(legacy)})
  assert observed['quiz_catalog'][key]==dict(count=bank['count'],reward=bank['reward'],start_questions=bank.get('start_questions'),questions=bank['questions']), 'Observed catalog differs: '+key
 bank=catalog['lesson:lesson-4'];assert bank['count']==24 and bank['reward']==35 and len(bank['questions'])==35
 active=json.dumps(bank['start_questions'],separators=(',',':'))
 # Only the version selector is extended. Trusted scoring, receipts, session
 # ownership, legacy results and the lifetime reward key remain byte-identical.
 writer=source['writer']
 writer_patches=[
  ("    elsif d->>'content_version' is distinct from input_manifest->>'version' then",f"    elsif d->>'content_version'='{VERSION_021}' then\n      input_manifest:=sl_private.manifest_before_022();\n    elsif d->>'content_version' is distinct from input_manifest->>'version' then"),
  ("then sl_private.quiz_catalog_before_021()->qid else sl_private.quiz_catalog()->qid end;",f"then sl_private.quiz_catalog_before_021()->qid\n      when d->>'content_version'='{VERSION_021}' then sl_private.quiz_catalog_before_022()->qid\n      else sl_private.quiz_catalog()->qid end;")]
 for a,b in writer_patches:assert writer.count(a)==1;writer=writer.replace(a,b)
 reader=source['reader']
 caps_old="'pronouns_final_v1'";caps_new=f"'pronouns_final_v1','presens_final_v1','event_replay:{VERSION_021}'"
 addition=f"""  result:=coalesce((select jsonb_set(result,'{{state,quizResults,assessment:presens-final-v1}}',
      jsonb_build_object('correct',best.correct,'total',24,
        'rewarded',coalesce((result #>> '{{state,quizResults,lesson:lesson-4,rewarded}}')::boolean,false)))
    from (select s.correct from public.sl_sessions s
      where s.user_id=a.user_id and s.quiz_id='lesson:lesson-4'
        and s.status='completed' and s.trusted_quiz
        and s.questions @> $final_questions${active}$final_questions$::jsonb
        and $final_questions${active}$final_questions$::jsonb @> s.questions
      order by s.correct desc,s.started_at desc limit 1) best),result);
  return result;"""
 reader_patches=[(caps_old,caps_new),('  return result;',addition)]
 for a,b in reader_patches:assert reader.count(a)==1;reader=reader.replace(a,b)
 def patch_function(signature,pairs,tag):
  out='do $'+tag+'$\ndeclare definition text;\n'
  for i,(a,b) in enumerate(pairs):out+=f'  old_{i} constant text := $old${a}$old$;\n  new_{i} constant text := $new${b}$new$;\n'
  out+=f"begin\n  definition:=pg_get_functiondef('{signature}'::regprocedure);\n"
  for i in range(len(pairs)):out+=f"  if (length(definition)-length(replace(definition,old_{i},'')))<>length(old_{i}) then raise exception '022: {tag} anchor {i} differs'; end if;\n  definition:=replace(definition,old_{i},new_{i});\n"
  return out+'  execute definition;\nend $'+tag+'$;\n'
 guards='\n    or '.join(f"(select md5(prosrc) from pg_proc where oid='{sig}'::regprocedure) is distinct from '{fingerprints[name]}'" for name,sig in [('manifest','sl_private.manifest()'),('catalog','sl_private.quiz_catalog()'),('reader','public.sl_get_progress()'),('writer','public.sl_apply_event(uuid,bigint,jsonb)')])
 sql=f"""-- PREPARED ONLY after comparing actual installed 021 preflight JSON.
-- Manual 022 only: do not replay 018–021; do not publish the client first.
-- No user rows, sessions, events, UUIDs, rewards or XP are rewritten.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
do $prerequisites$
begin
  if {guards} then
    raise exception '022: installed functions differ from observed 021; obtain new read-only baseline';
  end if;
  if sl_private.manifest()->>'version' is distinct from '{VERSION_021}' then
    raise exception '022: installed content_version differs';
  end if;
  if sl_private.manifest() is distinct from $base_manifest${json.dumps(old,ensure_ascii=False,separators=(',',':'))}$base_manifest$::jsonb then
    raise exception '022: installed manifest differs';
  end if;
  if (select jsonb_object_agg(k,jsonb_build_object('count',b->'count','reward',b->'reward',
      'start_questions',b->'start_questions','questions',b->'questions'))
    from jsonb_each(sl_private.quiz_catalog()) e(k,b)
    where k in ('lesson:lesson-1','lesson:lesson-2','lesson:lesson-3','lesson:lesson-4'))
    is distinct from $observed_banks${json.dumps(observed['quiz_catalog'],ensure_ascii=False,separators=(',',':'))}$observed_banks$::jsonb then
    raise exception '022: installed lesson banks differ from observed preflight';
  end if;
  if to_regprocedure('sl_private.manifest_before_021()') is null
    or to_regprocedure('sl_private.quiz_catalog_before_021()') is null then
    raise exception '022: required 020 replay backups are missing';
  end if;
  if sl_private.manifest_before_021() is distinct from $manifest_020${json.dumps(read_manifest(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql'),ensure_ascii=False,separators=(',',':'))}$manifest_020$::jsonb then
    raise exception '022: frozen 020 replay manifest differs; obtain a new baseline';
  end if;
  if exists(select 1 from public.sl_lessons l
    left join public.sl_quiz_results r on r.user_id=l.user_id and r.quiz_id='lesson:lesson-4'
    where l.lesson_id='lesson-4' and l.completed and not coalesce(r.rewarded,false))
    or exists(select 1 from public.sl_sessions s
    join public.sl_events e on e.user_id=s.user_id and e.session_id=s.id and e.xp_delta>0
    left join public.sl_quiz_results r on r.user_id=s.user_id and r.quiz_id='lesson:lesson-4'
    where s.quiz_id='lesson:lesson-4' and not coalesce(r.rewarded,false)) then
    raise exception '022: historical lesson reward reservation missing; review without changing XP';
  end if;
end $prerequisites$;
do $preserve$
declare bank jsonb; frozen_manifest jsonb;
begin
  if to_regprocedure('sl_private.quiz_catalog_before_022()') is not null
    or to_regprocedure('sl_private.manifest_before_022()') is not null then
    raise exception '022: backup already exists; never reapply';
  end if;
  bank:=sl_private.quiz_catalog();frozen_manifest:=sl_private.manifest();
  execute 'create function sl_private.quiz_catalog_before_022() returns jsonb language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select '||quote_literal(bank::text)||'::jsonb');
  execute 'create function sl_private.manifest_before_022() returns jsonb language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select '||quote_literal(frozen_manifest::text)||'::jsonb');
end $preserve$;
revoke all on function sl_private.quiz_catalog_before_022() from public,anon,authenticated;
revoke all on function sl_private.manifest_before_022() from public,anon,authenticated;
create or replace function sl_private.quiz_catalog() returns jsonb
language sql immutable security invoker set search_path='' as $function$
select jsonb_set(sl_private.quiz_catalog_before_022(),'{{lesson:lesson-4}}',
  (sl_private.quiz_catalog_before_022()->'lesson:lesson-4') || $presens_bank${json.dumps(bank,ensure_ascii=False,indent=2)}$presens_bank$::jsonb);
$function$;
revoke all on function sl_private.quiz_catalog() from public,anon,authenticated;
do $bank_guard$
declare item record; q record; current_bank jsonb;
begin
  current_bank:=sl_private.quiz_catalog();
  for item in select * from jsonb_each(sl_private.quiz_catalog_before_022()) loop
    if item.key<>'lesson:lesson-4' then
      if current_bank->item.key is distinct from item.value then raise exception '022: unrelated quiz changed'; end if;
    else
      if current_bank->item.key->'reward' is distinct from item.value->'reward' then raise exception '022: reward changed'; end if;
      for q in select * from jsonb_each(item.value->'questions') loop
        if current_bank->item.key->'questions'->q.key is distinct from q.value then raise exception '022: historical answer changed'; end if;
      end loop;
      if jsonb_array_length(current_bank->item.key->'start_questions')<>24 then raise exception '022: invalid active count'; end if;
    end if;
  end loop;
end $bank_guard$;
{patch_function('public.sl_get_progress()',reader_patches,'reader_upgrade')}
{patch_function('public.sl_apply_event(uuid,bigint,jsonb)',writer_patches,'writer_upgrade')}
create or replace function sl_private.manifest() returns jsonb
language sql immutable security invoker set search_path='' as $function$
select $manifest${json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)}$manifest$::jsonb;
$function$;
commit;
"""
 from presens_contract import body
 post=dict(manifest=md5(body(sql,'sl_private.manifest()','$function$')),catalog=md5(body(sql,'sl_private.quiz_catalog()','$function$')),reader=md5(reader),writer=md5(writer))
 path=ROOT/'supabase/migrations/202611230022_presens.sql'
 assert not path.exists(),'022 already exists: inspect it; never silently overwrite a candidate'
 path.write_text(sql)
 contract=dict(status='prepared-not-applied',installedBaselineVerified=True,baseline=str(BASELINE.relative_to(ROOT)),expectedBaseVersion=VERSION_021,expectedBaseMD5=fingerprints,preparedVersion=manifest['version'],expectedPostMD5=post,replayVersions=[read_manifest(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql')['version'],VERSION_021],activeQuestions=24,archivedQuestions=11,reward=35,productionSqlExecuted=False,published=False)
 (ROOT/'reports/presens/release-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
 (ROOT/'reports/presens/release-status.json').write_text(json.dumps({**contract,'releaseReady':False,'baselineObserved':True,'sql022Generated':True,'clientPublished':False},indent=2)+'\n')
 checks='\n'.join(f"select md5(prosrc)='{value}' as {name}_md5_ok from pg_proc where oid='{sig}'::regprocedure;" for (name,value),sig in zip(post.items(),['sl_private.manifest()','sl_private.quiz_catalog()','public.sl_get_progress()','public.sl_apply_event(uuid,bigint,jsonb)']))
 (ROOT/'supabase/checks/022_presens_fingerprints.sql').write_text("-- READ ONLY, generated from baseline-verified candidate 022.\nbegin transaction read only;\nselect sl_private.manifest()->>'version'='"+manifest['version']+"' as content_version_ok;\n"+checks+'\ncommit;\n')
 p=ROOT/'app.js';p.write_text(re.sub(r"version:'static-[a-f0-9]+'","version:'"+manifest['version']+"'",p.read_text()))
 p=ROOT/'sw.js';p.write_text(re.sub(r"const RELEASE\s*=\s*'[^']+';","const RELEASE = '2026-11-23-presens-022';",p.read_text(),count=1))
 print('PREPARED LOCALLY:',path.name,manifest['version'],'SQL not executed; server/client release requires manual postflight.')

if __name__=='__main__':main()
