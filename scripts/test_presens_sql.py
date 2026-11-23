#!/usr/bin/env python3
"""Disposable PostgreSQL only. No connection arguments or TCP listener.

Reconstructs a SOURCE fixture of 021, never calls that a live baseline, and never
executes migration files 018–021. If baseline/candidate 022 is missing, tests the
archived fixture and reports 022 acceptance as PENDING, not passed.
"""
from concurrent.futures import ThreadPoolExecutor
import json
import hashlib
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from uuid import uuid4
from presens_contract import ROOT, body, installed_021_source, md5
from check_supabase_manifest import current_manifest,read_manifest

def Q(s):return "'"+str(s).replace("'","''")+"'"
def main():
 if len(sys.argv)>1:raise SystemExit('No external connection arguments accepted')
 for name in ['initdb','pg_ctl','psql']:
  if not shutil.which(name):raise SystemExit('Missing local dependency: '+name)
 work=Path(tempfile.mkdtemp(prefix='sl-presens-sql-',dir='/private/tmp'));data=work/'data';sock=work/'socket';sock.mkdir(mode=0o700)
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
 base=['psql','-X','-qAt','-h',str(sock),'-p','55482','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 report=dict(date='2026-11-23',localOnly=True,tcpListener=False,productionConnected=False,productionSqlExecuted=False,migrations018Through021Executed=False,sourceFixtureIsProductionBaseline=False,cases=[],workDirectory=str(work))
 started=False
 def sql(s,check=True):
  r=subprocess.run(base,input=s,text=True,capture_output=True,env=env)
  if check and r.returncode:raise RuntimeError(r.stderr[-2500:])
  return r
 def val(s):return sql(s).stdout.strip().splitlines()[-1]
 def obj(s):return json.loads(val(s))
 def check(label,condition):
  report['cases'].append(dict(name=label,passed=bool(condition)))
  if not condition:raise AssertionError(label)
  print('PASS:',label,flush=True)
 def auth(user,s):return "set role authenticated;select set_config('request.jwt.claim.sub',"+Q(user)+",false);"+s
 def progress(user):return obj(auth(user,'select public.sl_get_progress();'))
 def event(user,typ,payload,eid=None,rev=None,ok=True):
  rev=progress(user)['revision'] if rev is None else rev;eid=eid or str(uuid4())
  request=dict(type=typ,occurred_at='2026-11-23T12:00:00Z',timezone='Europe/Stockholm',data=payload)
  command=auth(user,'select public.sl_apply_event('+Q(eid)+','+str(rev)+','+Q(json.dumps(request))+'::jsonb);')
  r=sql(command,ok)
  return (json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode==0 else r),dict(command=command,eventId=eid,request=request)
 def bank(lesson='lesson-4'):return obj('select sl_private.quiz_catalog()->'+Q('lesson:'+lesson)+';')
 def start(user,lesson='lesson-4',version=None,questions=None):
  b=bank(lesson);qs=questions or b.get('start_questions') or [dict(question_id='q'+str(i)) for i in range(b['count'])]
  sid=str(uuid4());_,receipt=event(user,'session_start',dict(session_id=sid,mode='lesson',context_id=lesson,content_version=version or progress(user)['content_version'],questions=qs))
  return sid,qs,receipt
 def finish(user,score,lesson='lesson-4'):
  sid,qs,receipt=start(user,lesson);b=bank(lesson)
  for i,q in enumerate(qs):event(user,'answer',dict(session_id=sid,question_index=i,response=b['questions'][q['question_id']]['answer'] if i<score else '__incorrect__'))
  result,receipt=event(user,'session_finish',dict(session_id=sid));return result,receipt
 def functions():return obj("select jsonb_object_agg(v.name,jsonb_build_object('md5',md5(p.prosrc),'acl',p.proacl::text,'owner',p.proowner,'securityDefiner',p.prosecdef,'config',p.proconfig)) from (values ('manifest','sl_private.manifest()'),('catalog','sl_private.quiz_catalog()'),('reader','public.sl_get_progress()'),('writer','public.sl_apply_event(uuid,bigint,jsonb)')) v(name,sig) left join pg_proc p on p.oid=to_regprocedure(v.sig);")
 def state():
  tables=obj("select jsonb_agg(jsonb_build_array(table_schema,table_name) order by table_schema,table_name) from information_schema.tables where table_schema in ('public','auth','storage') and table_type='BASE TABLE';")
  rows={}
  for schema,name in tables:
   assert re.fullmatch('[a-z_0-9]+',schema+name)
   rows[schema+'.'+name]=obj("select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') from "+schema+'.'+name+' t;')
  backups=obj("select coalesce(jsonb_object_agg(p.proname,jsonb_build_object('md5',md5(p.prosrc),'acl',p.proacl::text,'owner',p.proowner,'config',p.proconfig)),'{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='sl_private' and p.proname like '%before_%';")
  return dict(rows=rows,functions=functions(),backups=backups)
 def rejected(label,source,error):
  before=state();r=sql(source,False)
  check(label,r.returncode!=0 and error in r.stderr and state()==before)
 try:
  subprocess.run(['initdb','-D',str(data),'-A','trust','--no-locale','--encoding=UTF8','-U','postgres'],env=env,check=True,stdout=(work/'initdb.log').open('w'),stderr=subprocess.STDOUT)
  subprocess.run(['pg_ctl','-D',str(data),'-l',str(work/'postgres.log'),'-o',f"-k {sock} -p 55482 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],env=env,check=True,capture_output=True);started=True
  sql((ROOT/'supabase/tests/bootstrap_local.sql').read_text())
  for p in sorted((ROOT/'supabase/migrations').glob('*.sql')):
   if p.name<'202611160018':sql(p.read_text())
  s20=(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql').read_text()
  def frozen(name,value):sql('create function sl_private.'+name+"() returns jsonb language sql immutable security invoker set search_path='' as "+Q('select '+Q(json.dumps(value))+'::jsonb')+';revoke all on function sl_private.'+name+'() from public,anon,authenticated;')
  frozen('quiz_catalog_before_020',obj('select sl_private.quiz_catalog();'))
  sql("create or replace function sl_private.quiz_catalog() returns jsonb language sql immutable security invoker set search_path='' as $fixture$"+body(s20,'sl_private.quiz_catalog()','$function$')+'$fixture$;')
  frozen('quiz_catalog_before_021',obj('select sl_private.quiz_catalog();'))
  frozen('manifest_before_021',read_manifest(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql'))
  src=installed_021_source()
  for name in ['manifest','catalog']:
   sig='sl_private.'+('quiz_catalog' if name=='catalog' else 'manifest')+'()'
   sql('create or replace function '+sig+" returns jsonb language sql immutable security invoker set search_path='' as $fixture$"+src[name]+'$fixture$;')
  for name,sig in [('reader','public.sl_get_progress()'),('writer','public.sl_apply_event(p_event_id uuid,p_expected_revision bigint,p_event jsonb)')]:
   sql('create or replace function '+sig+" returns jsonb language plpgsql security definer set search_path='' as $fixture$"+src[name]+'$fixture$;')
  check('021 source fixture reproduces four archived MD5; not a live baseline',{k:v['md5'] for k,v in functions().items()}=={k:md5(v) for k,v in src.items()})
  current21=read_manifest(ROOT/'supabase/migrations/202611220021_pronouns.sql')
  check('021 fixture version remains static-57b40b608d91091d',obj('select sl_private.manifest();')==current21)
  observed_path=ROOT/'supabase/baselines/021_installed_for_022.json'
  observed=json.loads(observed_path.read_text()) if observed_path.exists() else None
  if observed:
   check('021 fixture matches actual user-provided baseline MD5, full manifest and four banks',
    observed['function_md5']=={k:v['md5'] for k,v in functions().items()}
    and observed['manifest']==obj('select sl_private.manifest();')
    and all(observed['quiz_catalog'][key]==dict(count=b['count'],reward=b['reward'],start_questions=b.get('start_questions'),questions=b['questions']) for key in observed['quiz_catalog'] for b in [bank(key.removeprefix('lesson:'))]))
   report.update(baselineVerified=True,baselineSha256=hashlib.sha256(observed_path.read_bytes()).hexdigest())
  users=[str(uuid4()) for _ in range(5)];old,fresh,unfinished,offline,other=users
  for i,user in enumerate(users):sql('insert into auth.users(id,email) values('+Q(user)+','+Q('fixture-'+str(i)+'@example.invalid')+');');progress(user)
  result,oldreceipt=finish(old,11)
  check('Historical lesson-4 earns exactly its original 35 XP',result['quiz_result']['xp']==35)
  old4=progress(old)['state']['quizResults']['lesson:lesson-4']
  for lid,n in [('lesson-1',20),('lesson-2',20),('lesson-3',24)]:finish(old,n,lid)
  oldprogress=progress(old);pending_sid,pending_qs,pending_receipt=start(unfinished)
  event(unfinished,'answer',dict(session_id=pending_sid,question_index=0,response=bank()['questions']['q0']['answer']))
  pending_start=val('select request::text from public.sl_events where event_id='+Q(pending_receipt['eventId'])+';')
  other_pending={}
  for lid in ['lesson-1','lesson-2','lesson-3']:
   sid,qs,receipt=start(unfinished,lid)
   event(unfinished,'answer',dict(session_id=sid,question_index=0,response=bank(lid)['questions'][qs[0]['question_id']]['answer']))
   other_pending[lid]=(sid,qs,receipt,val('select request::text from public.sl_events where event_id='+Q(receipt['eventId'])+';'))
  before=progress(old)['state'];duplicate=obj(oldreceipt['command'])
  check('Acknowledged historical receipt is idempotent',duplicate['duplicate'] and progress(old)['state']==before)
  migration=ROOT/'supabase/migrations/202611230022_presens.sql'
  if not migration.exists():
   report.update(status='022_PENDING_ACTUAL_BASELINE',fixtureChecksPassed=True,migration022Tested=False,releaseReady=False)
   print('PENDING: actual installed-021 baseline and generated 022 required for migration acceptance.',flush=True)
   return
  contract=json.loads((ROOT/'reports/presens/release-contract.json').read_text())
  assert contract.get('installedBaselineVerified') and (ROOT/'supabase/baselines/021_installed_for_022.json').is_file()
  candidate=migration.read_text();before=state();defs={}
  assert candidate.rstrip().endswith('commit;')
  signatures={'manifest':'sl_private.manifest()','catalog':'sl_private.quiz_catalog()','reader':'public.sl_get_progress()','writer':'public.sl_apply_event(uuid,bigint,jsonb)'}
  for name,sig in signatures.items():
   definition=sql('select pg_get_functiondef('+Q(sig)+'::regprocedure);').stdout.strip();defs[name]=definition
   delimiter=re.search(r'AS (\$[^$]*\$)',definition)[1]
   sql(definition.replace(delimiter,delimiter+'\n-- intentional local drift\n',1))
   rejected('MD5 guard and atomic rollback: '+name,candidate,'installed functions differ')
   sql(definition)
  assert state()==before
  # Exercise state predicates independently of the earlier MD5 predicate by
  # changing only a temporary test copy's expected manifest MD5.
  for label,replacement,expected_error in [
   ('wrong content_version',src['manifest'].replace(current21['version'],'static-deliberately-wrong'),'installed content_version differs'),
   ('wrong full manifest',src['manifest'].replace('"lesson-4": 11','"lesson-4": 12'),'installed manifest differs')]:
   assert replacement!=src['manifest']
   sql("create or replace function sl_private.manifest() returns jsonb language sql immutable security invoker set search_path='' as $drift$"+replacement+'$drift$;')
   rejected(label+' production guard',candidate,'installed functions differ')
   rejected(label+' explicit state predicate',candidate.replace(observed['function_md5']['manifest'],md5(replacement),1),expected_error)
   sql(defs['manifest'])
  # Drift of a backing function leaves the four observed MD5 unchanged.
  prior=sql("select pg_get_functiondef('sl_private.quiz_catalog_before_021()'::regprocedure);").stdout.strip()
  frozen_drift=obj('select sl_private.quiz_catalog_before_021();');frozen_drift['lesson:lesson-2']['reward']=999
  sql("create or replace function sl_private.quiz_catalog_before_021() returns jsonb language sql immutable security invoker set search_path='' as "+Q('select '+Q(json.dumps(frozen_drift))+'::jsonb')+';')
  rejected('Observed bank-state guard catches backing-function drift',candidate,'installed lesson banks differ')
  sql(prior)
  replay_manifest=sql("select pg_get_functiondef('sl_private.manifest_before_021()'::regprocedure);").stdout.strip()
  sql("create or replace function sl_private.manifest_before_021() returns jsonb language sql immutable as $$select '{}'::jsonb$$;")
  rejected('Frozen replay manifest drift fails closed',candidate,'frozen 020 replay manifest differs')
  sql(replay_manifest)
  sql("create function sl_private.manifest_before_022() returns jsonb language sql immutable as $$select '{}'::jsonb$$;")
  rejected('Existing 022 backup is never overwritten',candidate,'backup already exists')
  sql('drop function sl_private.manifest_before_022();')
  sql('insert into public.sl_lessons(user_id,lesson_id,completed,best_percent) values('+Q(other)+",'lesson-4',true,100);")
  rejected('Completed legacy lesson without reward reservation aborts',candidate,'historical lesson reward reservation missing')
  sql('delete from public.sl_lessons where user_id='+Q(other)+';')
  assert state()==before
  rejected('Failure after every function change rolls back all data/functions',candidate.rsplit('commit;',1)[0]+"do $$begin raise exception 'forced local rollback';end$$;commit;",'forced local rollback')
  b=json.loads(candidate.split('$presens_bank$')[1]);b['questions']['q0']['answer']='changed'
  rejected('Historical answer corruption is rejected',candidate.replace(candidate.split('$presens_bank$')[1],json.dumps(b),1),'historical answer changed')
  changed=candidate.replace("select jsonb_set(sl_private.quiz_catalog_before_022(),'{lesson:lesson-4}',", "select jsonb_set(jsonb_set(sl_private.quiz_catalog_before_022(),'{lesson:lesson-1,reward}','999'::jsonb),'{lesson:lesson-4}',",1)
  rejected('An unrelated lesson bank change is rejected',changed,'unrelated quiz changed')
  audit_source=(ROOT/'supabase/checks/022_presens_data_audit.sql').read_text()
  audit_before=sql(audit_source).stdout
  sql(candidate);after=state()
  audit_after=sql(audit_source).stdout
  check('Read-only history/XP audit is executable and identical before/after',audit_before==audit_after)
  (ROOT/'reports/presens/sql-data-audit.json').write_text(json.dumps(dict(localOnly=True,before=audit_before.splitlines(),after=audit_after.splitlines(),beforeSha256=hashlib.sha256(audit_before.encode()).hexdigest(),afterSha256=hashlib.sha256(audit_after.encode()).hexdigest(),identical=audit_before==audit_after),indent=2)+'\n')
  check('022 rewrites no user/session/event/XP/result rows',before['rows']==after['rows'])
  check('All four post-022 MD5 match generated contract',{k:v['md5'] for k,v in functions().items()}==contract['expectedPostMD5'])
  check('Reader/writer ACL, owner, definer and configuration retained',all(before['functions'][n][k]==after['functions'][n][k] for n in ['reader','writer'] for k in ['acl','owner','securityDefiner','config']))
  check('Manifest matches candidate client exactly',obj('select sl_private.manifest();')==current_manifest())
  check('Trusted catalog matches client exactly',obj('select sl_private.quiz_catalog();')==json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True)))
  check('Reader retains lesson capabilities and advertises both replay generations',all(cap in progress(fresh)['capabilities'] for cap in ['alphabet_final_v1','greetings_final_v1','pronouns_final_v1','presens_final_v1',*['event_replay:'+version for version in contract['replayVersions']]]))
  rejected('Reapplication fails atomically',candidate,'installed functions differ')
  before_replay=state();duplicate=obj(oldreceipt['command'])
  check('Acknowledged 021 finish receipt survives 022 without data or XP changes',duplicate['duplicate'] and state()==before_replay)
  result,_=event(old,'session_finish',dict(session_id=str(uuid4())),eid=oldreceipt['eventId'],ok=False)
  check('An acknowledged UUID cannot be reused for changed JSON',result.returncode!=0 and 'event_id_reused_with_different_body' in result.stderr and state()==before_replay)
  for n,xp in [(19,0),(20,35),(24,35)]:
   result,receipt=finish(fresh,n)
   check(f'{n}/24 threshold, separate result and lifetime XP',result['quiz_result']['passed']==(n>=20) and progress(fresh)['state']['xp']==xp and progress(fresh)['state']['quizResults']['assessment:presens-final-v1']['correct']==n)
   with ThreadPoolExecutor(max_workers=2) as pool:retries=list(pool.map(lambda _:obj(receipt['command']),range(2)))
   check(f'{n}/24 concurrent receipt retries add no XP',all(r['duplicate'] for r in retries) and progress(fresh)['state']['xp']==xp)
  result,_=finish(old,24)
  check('Previously rewarded lesson-4 gets no second XP',result['quiz_result']['xp']==0 and progress(old)['state']['xp']==oldprogress['state']['xp'])
  check('Historical 11/11 result and lessons 1–3 remain intact',progress(old)['state']['quizResults']['lesson:lesson-4']==old4 and all(progress(old)['state']['quizResults'][k]==r for k,r in oldprogress['state']['quizResults'].items()))
  for i,q in enumerate(pending_qs[1:],1):event(unfinished,'answer',dict(session_id=pending_sid,question_index=i,response=bank()['questions'][q['question_id']]['answer']))
  result,_=event(unfinished,'session_finish',dict(session_id=pending_sid))
  check('Unfinished 021 session completes without new-bank projection',result['quiz_result']['xp']==35 and 'assessment:presens-final-v1' not in progress(unfinished)['state']['quizResults'])
  check('Historical acknowledged start UUID/JSON preserved',pending_start==val('select request::text from public.sl_events where event_id='+Q(pending_receipt['eventId'])+';'))
  for lid,(sid,qs,receipt,request_before) in other_pending.items():
   for i,q in enumerate(qs[1:],1):event(unfinished,'answer',dict(session_id=sid,question_index=i,response=bank(lid)['questions'][q['question_id']]['answer']))
   result,_=event(unfinished,'session_finish',dict(session_id=sid))
   check('Unfinished 021 '+lid+' survives and finishes once',result['quiz_result']['xp']==35 and request_before==val('select request::text from public.sl_events where event_id='+Q(receipt['eventId'])+';'))
  legacy=[dict(question_id='q'+str(i)) for i in range(11)]
  for version in contract['replayVersions']:
   sid,qs,receipt=start(offline,version=version,questions=legacy)
   check('Unacknowledged historical start replays unchanged '+version,obj('select request from public.sl_events where event_id='+Q(receipt['eventId'])+';')==receipt['request'])
   for i,q in enumerate(qs):event(offline,'answer',dict(session_id=sid,question_index=i,response=bank()['questions'][q['question_id']]['answer']))
   event(offline,'session_finish',dict(session_id=sid))
  check('020/021 offline replay shares one 35-XP reward',progress(offline)['state']['xp']==35)
  result,_=finish(offline,24)
  check('A new-bank pass after offline historical replay adds no XP',result['quiz_result']['xp']==0 and progress(offline)['state']['xp']==35)
  active=bank()['start_questions']
  for label,version,qs,error in [
   ('unknown version','static-unknown',active,'unsupported_content_version'),
   ('new bank with 021 version',current21['version'],active,'context_question_count_mismatch'),
   ('legacy bank with 022 version',contract['preparedVersion'],legacy,'context_question_count_mismatch'),
   ('mixed archive/new IDs',contract['preparedVersion'],[{'question_id':'q0'}]+active[1:],'quiz_bank_count_mismatch'),
   ('duplicate IDs',contract['preparedVersion'],[active[0]]+active[:-1],'quiz_bank_count_mismatch')]:
   before=state();result,_=event(other,'session_start',dict(session_id=str(uuid4()),mode='lesson',context_id='lesson-4',content_version=version,questions=qs),ok=False)
   check('Start rejects atomically: '+label,result.returncode!=0 and error in result.stderr and state()==before)
  sid,qs,_=start(other);before=state()
  result,_=event(other,'answer',dict(session_id=sid,question_index=0,response='o0',correct=True),ok=False)
  check('Forged client correctness is rejected',result.returncode!=0 and 'trusted_response_required' in result.stderr and state()==before)
  result,_=event(other,'session_finish',dict(session_id=sid),ok=False)
  check('Incomplete attempts cannot finish or reserve XP',result.returncode!=0 and 'session_incomplete' in result.stderr and state()==before)
  result,_=event(fresh,'session_finish',dict(session_id=sid),ok=False)
  check('Other account cannot claim session or XP',result.returncode!=0 and state()==before)
  for i,q in enumerate(qs):event(other,'answer',dict(session_id=sid,question_index=i,response=bank()['questions'][q['question_id']]['answer']))
  rev=progress(other)['revision'];eid=str(uuid4())
  _,receipt=event(other,'session_finish',dict(session_id=sid),eid=eid,rev=rev)
  # Receipt deduplication is tested with two simultaneous lost-ACK retries.
  with ThreadPoolExecutor(max_workers=2) as pool:retries=list(pool.map(lambda _:obj(receipt['command']),range(2)))
  check('Concurrent lost-ACK finishes never duplicate the reward',all(r['duplicate'] for r in retries) and progress(other)['state']['xp']==35)
  for race_kind in ['same-first-event','two-passing-attempts']:
   actor=str(uuid4());sql('insert into auth.users(id,email) values('+Q(actor)+','+Q(race_kind+'@example.invalid')+');');progress(actor)
   sessions=[]
   for _ in range(1 if race_kind=='same-first-event' else 2):
    sid,qs,_=start(actor)
    for i,q in enumerate(qs):event(actor,'answer',dict(session_id=sid,question_index=i,response=bank()['questions'][q['question_id']]['answer']))
    sessions.append(sid)
   rev=progress(actor)['revision']
   def finish_command(sid,eid):
    request=dict(type='session_finish',occurred_at='2026-11-23T12:00:00Z',timezone='Europe/Stockholm',data=dict(session_id=sid))
    return auth(actor,'select public.sl_apply_event('+Q(eid)+','+str(rev)+','+Q(json.dumps(request))+'::jsonb);')
   if race_kind=='same-first-event':
    command=finish_command(sessions[0],str(uuid4()))
    with ThreadPoolExecutor(max_workers=2) as pool:replies=list(pool.map(lambda _:obj(command),range(2)))
    check('Two simultaneous first finishes commit one reward and one duplicate',sorted(r['duplicate'] for r in replies)==[False,True] and progress(actor)['state']['xp']==35)
   else:
    commands=[finish_command(sid,str(uuid4())) for sid in sessions]
    with ThreadPoolExecutor(max_workers=2) as pool:replies=list(pool.map(lambda command:sql(command,False),commands))
    check('Concurrent passing attempts serialize by account revision',sorted(r.returncode==0 for r in replies)==[False,True] and 'revision_conflict' in next(r.stderr for r in replies if r.returncode))
    for command,result in zip(commands,replies):
     if result.returncode:
      retry=command.replace(','+str(rev)+',',','+str(progress(actor)['revision'])+',',1)
      check('Rebased second passing attempt earns no additional XP',obj(retry)['quiz_result']['xp']==0 and progress(actor)['state']['xp']==35)
  check('Answer catalog remains inaccessible to application roles',sql(auth(fresh,'select sl_private.quiz_catalog();'),False).returncode!=0 and sql('set role anon;select sl_private.quiz_catalog();',False).returncode!=0)
  for name in ['022_presens_postflight.sql','022_presens_fingerprints.sql']:
   r=sql((ROOT/'supabase/checks'/name).read_text())
   check(name+' reports no false checks',not re.search(r'(^|\|)f(\||$)',r.stdout,re.M))
  report.update(status='PASS',migration022Tested=True,releaseReady=False,fixtureChecksPassed=True,assertions=len(report['cases']))
 except Exception as error:
  report.update(status='FAIL',migration022Tested=False,error=str(error),assertions=len(report['cases']))
  raise
 finally:
  if started:report['clusterStopped']=subprocess.run(['pg_ctl','-D',str(data),'-m','fast','-w','stop'],env=env,capture_output=True).returncode==0
  (ROOT/'reports/presens/sql-tests.json').write_text(json.dumps(report,indent=2)+'\n')
  print('Report: reports/presens/sql-tests.json',flush=True)
if __name__=='__main__':main()
