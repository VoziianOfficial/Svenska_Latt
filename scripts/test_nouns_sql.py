#!/usr/bin/env python3
"""Disposable PostgreSQL only. No connection arguments or TCP listener.

Restores exact function/archive definitions from the user-supplied installed-022
baseline on a synthetic schema and synthetic users. Executes only candidate 023
against that fixture; no production connection and no historical 018–022 replay.
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
from presens_contract import md5
from nouns_contract import ROOT, BASELINE, MIGRATION, VERSION_022, observed_baseline, SIGNATURES
from check_supabase_manifest import current_manifest,read_manifest

def Q(s):return "'"+str(s).replace("'","''")+"'"
def main():
 if len(sys.argv)>1:raise SystemExit('No external connection arguments accepted')
 for name in ['initdb','pg_ctl','psql']:
  if not shutil.which(name):raise SystemExit('Missing local dependency: '+name)
 work=Path(tempfile.mkdtemp(prefix='sl-nouns-sql-',dir='/private/tmp'));data=work/'data';sock=work/'socket';sock.mkdir(mode=0o700)
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
 base=['psql','-X','-qAt','-h',str(sock),'-p','55483','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 report=dict(date='2026-11-27',localOnly=True,tcpListener=False,productionConnected=False,productionSqlExecuted=False,migrations018Through022Executed=False,syntheticUserData=True,baselineDefinitionsRestored=True,cases=[],workDirectory=str(work))
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
  request=dict(type=typ,occurred_at='2026-11-27T12:00:00Z',timezone='Europe/Stockholm',data=payload)
  command=auth(user,'select public.sl_apply_event('+Q(eid)+','+str(rev)+','+Q(json.dumps(request))+'::jsonb);')
  r=sql(command,ok)
  return (json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode==0 else r),dict(command=command,eventId=eid,request=request)
 def bank(lesson='lesson-5'):return obj('select sl_private.quiz_catalog()->'+Q('lesson:'+lesson)+';')
 def start(user,lesson='lesson-5',version=None,questions=None):
  b=bank(lesson);qs=questions or b.get('start_questions') or [dict(question_id='q'+str(i)) for i in range(b['count'])]
  sid=str(uuid4());_,receipt=event(user,'session_start',dict(session_id=sid,mode='lesson',context_id=lesson,content_version=version or progress(user)['content_version'],questions=qs))
  return sid,qs,receipt
 def finish(user,score,lesson='lesson-5'):
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
  backups=obj("select coalesce(jsonb_object_agg(p.proname,jsonb_build_object('md5',md5(p.prosrc),'definitionMD5',md5(pg_get_functiondef(p.oid)),'acl',p.proacl::text,'owner',p.proowner,'config',p.proconfig,'definer',p.prosecdef)),'{}') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='sl_private' and p.proname like '%before_%';")
  return dict(rows=rows,functions=functions(),backups=backups)
 def rejected(label,source,error):
  before=state();r=sql(source,False)
  check(label,r.returncode!=0 and error in r.stderr and state()==before)
 try:
  subprocess.run(['initdb','-D',str(data),'-A','trust','--no-locale','--encoding=UTF8','-U','postgres'],env=env,check=True,stdout=(work/'initdb.log').open('w'),stderr=subprocess.STDOUT)
  subprocess.run(['pg_ctl','-D',str(data),'-l',str(work/'postgres.log'),'-o',f"-k {sock} -p 55483 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],env=env,check=True,capture_output=True);started=True
  sql((ROOT/'supabase/tests/bootstrap_local.sql').read_text())
  for p in sorted((ROOT/'supabase/migrations').glob('*.sql')):
   if p.name<'202611160018':sql(p.read_text())
  observed=observed_baseline();src={k:f['source'] for k,f in observed['functions'].items()}
  for name,function in observed['archives'].items():
   sql(function['definition']);sql('revoke all on function sl_private.'+name+'() from public,anon,authenticated;')
  for name,function in observed['functions'].items():sql(function['definition'])
  current22=observed['manifest']
  check('Exact installed-022 baseline definitions reproduce all four MD5',observed['function_md5']=={k:v['md5'] for k,v in functions().items()})
  pre=json.loads(sql((ROOT/'supabase/checks/023_nouns_preflight.sql').read_text()).stdout)
  check('Read-only preflight reproduces complete baseline except observation timestamp',{k:v for k,v in pre.items() if k!='observed_at'}=={k:v for k,v in observed.items() if k!='observed_at'})
  report.update(baselineVerified=True,baselineSha256=hashlib.sha256(BASELINE.read_bytes()).hexdigest(),postgresVersion=val('select version();'))
  users=[str(uuid4()) for _ in range(5)];old,fresh,unfinished,offline,other=users
  for i,user in enumerate(users):sql('insert into auth.users(id,email) values('+Q(user)+','+Q('fixture-'+str(i)+'@example.invalid')+');');progress(user)
  result,oldreceipt=finish(old,10)
  check('Historical lesson-5 earns exactly its original 35 XP',result['quiz_result']['xp']==35)
  old4=progress(old)['state']['quizResults']['lesson:lesson-5']
  for lid,n in [('lesson-1',20),('lesson-2',20),('lesson-3',24),('lesson-4',24)]:finish(old,n,lid)
  oldprogress=progress(old);pending_sid,pending_qs,pending_receipt=start(unfinished)
  event(unfinished,'answer',dict(session_id=pending_sid,question_index=0,response=bank()['questions'][pending_qs[0]['question_id']]['answer']))
  pending_start=val('select request::text from public.sl_events where event_id='+Q(pending_receipt['eventId'])+';')
  other_pending={}
  for lid in ['lesson-1','lesson-2','lesson-3','lesson-4']:
   sid,qs,receipt=start(unfinished,lid)
   event(unfinished,'answer',dict(session_id=sid,question_index=0,response=bank(lid)['questions'][qs[0]['question_id']]['answer']))
   other_pending[lid]=(sid,qs,receipt,val('select request::text from public.sl_events where event_id='+Q(receipt['eventId'])+';'))
  before=progress(old)['state'];duplicate=obj(oldreceipt['command'])
  check('Acknowledged historical receipt is idempotent',duplicate['duplicate'] and progress(old)['state']==before)
  queued=[];historical_pending=[];confirmed=[]
  for version,archive in [('static-1aa3eb8422e2930a','before_021'),('static-57b40b608d91091d','before_022'),(VERSION_022,None)]:
   historical=obj('select sl_private.quiz_catalog'+('_'+archive if archive else '')+'();')
   b=historical['lesson:lesson-5'];qs=[dict(question_id='q'+str(i)) for i in range(10)]
   sid=str(uuid4());payload=dict(session_id=sid,mode='lesson',context_id='lesson-5',content_version=version,questions=qs)
   requests=[dict(type='session_start',data=payload)]+[dict(type='answer',data=dict(session_id=sid,question_index=i,response=b['questions'][q['question_id']]['answer'])) for i,q in enumerate(qs)]+[dict(type='session_finish',data=dict(session_id=sid))]
   for request in requests:
    request.update(occurred_at='2026-11-27T12:00:00Z',timezone='Europe/Stockholm')
   queued.append((version,[(str(uuid4()),json.dumps(request)) for request in requests]))
   # Existing unfinished sessions and acknowledged receipts of all three versions.
   sid,qs,receipt=start(unfinished,version=version,questions=qs)
   reply,answer_receipt=event(unfinished,'answer',dict(session_id=sid,question_index=0,response=b['questions']['q0']['answer']))
   historical_pending.append((version,sid,qs));confirmed.extend([receipt,answer_receipt])
  confirmed.append(oldreceipt)
  migration=MIGRATION
  if not migration.exists():
   report.update(status='023_PENDING_ACTUAL_BASELINE',fixtureChecksPassed=True,migration023Tested=False,releaseReady=False)
   print('PENDING: actual installed-022 baseline and generated 023 required for migration acceptance.',flush=True)
   return
  contract=json.loads((ROOT/'reports/nouns/release-contract.json').read_text())
  assert contract.get('installedBaselineVerified') and (ROOT/'supabase/baselines/022_installed_for_023.json').is_file()
  candidate=migration.read_text();before=state();defs={}
  assert candidate.rstrip().endswith('commit;')
  signatures={'manifest':'sl_private.manifest()','catalog':'sl_private.quiz_catalog()','reader':'public.sl_get_progress()','writer':'public.sl_apply_event(uuid,bigint,jsonb)'}
  for name,sig in signatures.items():
   definition=sql('select pg_get_functiondef('+Q(sig)+'::regprocedure);').stdout.strip();defs[name]=definition
   delimiter=re.search(r'AS (\$[^$]*\$)',definition)[1]
   sql(definition.replace(delimiter,delimiter+'\n-- intentional local drift\n',1))
   rejected('MD5 guard and atomic rollback: '+name,candidate,'installed functions or properties differ')
   sql(definition)
  assert state()==before
  # Exercise state predicates independently of the earlier MD5 predicate by
  # changing only a temporary test copy's expected manifest MD5.
  for label,replacement,expected_error in [
   ('wrong content_version',src['manifest'].replace(current22['version'],'static-deliberately-wrong'),'installed content_version differs'),
   ('wrong full manifest',src['manifest'].replace('"lesson-5": 10','"lesson-5": 12'),'installed manifest differs')]:
   assert replacement!=src['manifest']
   sql("create or replace function sl_private.manifest() returns jsonb language sql immutable security invoker set search_path='' as $drift$"+replacement+'$drift$;')
   rejected(label+' production guard',candidate,'installed functions or properties differ')
   adjusted=candidate.replace(observed['function_md5']['manifest'],md5(replacement),1).replace(md5(observed['functions']['manifest']['definition']),md5(observed['functions']['manifest']['definition'].replace(src['manifest'],replacement,1)),1)
   rejected(label+' explicit state predicate',adjusted,expected_error)
   sql(defs['manifest'])
  # Drift of a backing function leaves the four observed MD5 unchanged.
  prior=sql("select pg_get_functiondef('sl_private.quiz_catalog_before_022()'::regprocedure);").stdout.strip()
  frozen_drift=obj('select sl_private.quiz_catalog_before_022();');frozen_drift['lesson:lesson-2']['reward']=999
  sql("create or replace function sl_private.quiz_catalog_before_022() returns jsonb language sql immutable security invoker set search_path='' as "+Q('select '+Q(json.dumps(frozen_drift))+'::jsonb')+';')
  rejected('Observed bank-state guard catches backing-function drift',candidate,'installed catalog differs')
  sql(prior)
  replay_manifest=sql("select pg_get_functiondef('sl_private.manifest_before_021()'::regprocedure);").stdout.strip()
  sql("create or replace function sl_private.manifest_before_021() returns jsonb language sql immutable as $$select '{}'::jsonb$$;")
  rejected('Frozen replay manifest drift fails closed',candidate,'replay archives or properties differ')
  sql(replay_manifest)
  for name in observed['archives']:
   signature='sl_private.'+name+'()'
   original=obj('select to_jsonb(pg_get_functiondef('+Q(signature)+'::regprocedure));')
   delimiter=re.search(r'AS (\$[^$]*\$)',original)[1]
   sql(original.replace(delimiter,delimiter+'\n-- archive drift\n',1))
   rejected('Archive source drift fails closed: '+name,candidate,'replay archives or properties differ')
   sql(original)
   sql('grant execute on function '+signature+' to anon;')
   rejected('Archive permission drift fails closed: '+name,candidate,'replay archives or properties differ')
   sql('revoke execute on function '+signature+' from anon;')
  for name,signature in signatures.items():
   sql('grant execute on function '+signature+' to anon;')
   rejected('Function ACL drift fails closed: '+name,candidate,'installed functions or properties differ')
   sql('revoke execute on function '+signature+' from anon;')
  sql('alter function sl_private.manifest() volatile;')
  rejected('Declaration drift with identical source MD5 fails closed',candidate,'installed functions or properties differ')
  sql(defs['manifest'])
  sql("create function sl_private.manifest_before_023() returns jsonb language sql immutable as $$select '{}'::jsonb$$;")
  rejected('Existing 023 backup is never overwritten',candidate,'backup already exists')
  sql('drop function sl_private.manifest_before_023();')
  sql('insert into public.sl_lessons(user_id,lesson_id,completed,best_percent) values('+Q(other)+",'lesson-5',true,100);")
  rejected('Completed legacy lesson without reward reservation aborts',candidate,'historical lesson reward reservation missing')
  sql('delete from public.sl_lessons where user_id='+Q(other)+';')
  sql('update public.sl_lessons set completed=false where user_id='+Q(old)+" and lesson_id='lesson-5';update public.sl_quiz_results set rewarded=false where user_id="+Q(old)+" and quiz_id='lesson:lesson-5';")
  rejected('Historical positive-XP event without reservation aborts independently',candidate,'historical lesson reward reservation missing')
  sql('update public.sl_lessons set completed=true where user_id='+Q(old)+" and lesson_id='lesson-5';update public.sl_quiz_results set rewarded=true where user_id="+Q(old)+" and quiz_id='lesson:lesson-5';")
  assert state()==before
  sql('alter default privileges in schema sl_private grant execute on functions to service_role;')
  rejected('Unexpected default grants on new archives roll back the whole migration',candidate,'new archive properties differ')
  sql('alter default privileges in schema sl_private revoke execute on functions from service_role;')
  rejected('Failure after every function change rolls back all data/functions',candidate.rsplit('commit;',1)[0]+"do $$begin raise exception 'forced local rollback';end$$;commit;",'forced local rollback')
  b=json.loads(candidate.split('$nouns_bank$')[1]);b['questions']['q0']['answer']='changed'
  rejected('Historical answer corruption is rejected',candidate.replace(candidate.split('$nouns_bank$')[1],json.dumps(b),1),'historical answer changed')
  changed=candidate.replace("select jsonb_set(sl_private.quiz_catalog_before_023(),'{lesson:lesson-5}',", "select jsonb_set(jsonb_set(sl_private.quiz_catalog_before_023(),'{lesson:lesson-1,reward}','999'::jsonb),'{lesson:lesson-5}',",1)
  rejected('An unrelated lesson bank change is rejected',changed,'unrelated quiz changed')
  audit_source=(ROOT/'supabase/checks/023_nouns_data_audit.sql').read_text()
  audit_before=sql(audit_source).stdout
  sql(candidate);after=state()
  audit_after=sql(audit_source).stdout
  check('Read-only history/XP audit is executable and identical before/after',audit_before==audit_after)
  (ROOT/'reports/nouns/sql-data-audit.json').write_text(json.dumps(dict(localOnly=True,before=audit_before.splitlines(),after=audit_after.splitlines(),beforeSha256=hashlib.sha256(audit_before.encode()).hexdigest(),afterSha256=hashlib.sha256(audit_after.encode()).hexdigest(),identical=audit_before==audit_after),indent=2)+'\n')
  check('023 rewrites no user/session/event/XP/result rows',before['rows']==after['rows'])
  check('All pre-existing archives remain byte-identical with original properties',all(after['backups'][k]==v for k,v in before['backups'].items()))
  report['expectedPostMD5ObservedInPostgreSQL']={k:v['md5'] for k,v in functions().items()}
  report['migrationSha256']=hashlib.sha256(candidate.encode()).hexdigest()
  check('All four post-023 MD5 match generated contract',{k:v['md5'] for k,v in functions().items()}==contract['expectedPostMD5'])
  check('Reader/writer ACL, owner, definer and configuration retained',all(before['functions'][n][k]==after['functions'][n][k] for n in ['reader','writer'] for k in ['acl','owner','securityDefiner','config']))
  check('Manifest matches candidate client exactly',obj('select sl_private.manifest();')==current_manifest())
  check('Trusted catalog matches client exactly',obj('select sl_private.quiz_catalog();')==json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True)))
  check('Reader retains lesson capabilities and advertises all three replay generations',all(cap in progress(fresh)['capabilities'] for cap in ['alphabet_final_v1','greetings_final_v1','pronouns_final_v1','presens_final_v1','nouns_final_v1',*['event_replay:'+version for version in contract['replayVersions']]]))
  rejected('Reapplication fails atomically',candidate,'backup already exists')
  before_replay=state();duplicate=obj(oldreceipt['command'])
  check('Acknowledged 022 finish receipt survives 023 without data or XP changes',duplicate['duplicate'] and state()==before_replay)
  for receipt in confirmed:
   saved=obj('select to_jsonb(e) from public.sl_events e where event_id='+Q(receipt['eventId'])+';')
   reply=obj(receipt['command'])
   check('Acknowledged '+receipt['request']['type']+' receipt is unchanged',reply['duplicate'] and reply['applied_revision']==saved['revision'] and reply['quiz_result']==saved['quiz_result'] and state()==before_replay)
  result,_=event(old,'session_finish',dict(session_id=str(uuid4())),eid=oldreceipt['eventId'],ok=False)
  check('An acknowledged UUID cannot be reused for changed JSON',result.returncode!=0 and 'event_id_reused_with_different_body' in result.stderr and state()==before_replay)
  for n,xp in [(19,0),(20,35),(24,35)]:
   result,receipt=finish(fresh,n)
   check(f'{n}/24 threshold, separate result and lifetime XP',result['quiz_result']['passed']==(n>=20) and progress(fresh)['state']['xp']==xp and progress(fresh)['state']['quizResults']['assessment:nouns-final-v1']['correct']==n)
   with ThreadPoolExecutor(max_workers=2) as pool:retries=list(pool.map(lambda _:obj(receipt['command']),range(2)))
   check(f'{n}/24 concurrent receipt retries add no XP',all(r['duplicate'] for r in retries) and progress(fresh)['state']['xp']==xp)
  result,_=finish(old,24)
  check('Previously rewarded lesson-5 gets no second XP',result['quiz_result']['xp']==0 and progress(old)['state']['xp']==oldprogress['state']['xp'])
  check('Historical 10/10 result and lessons 1–4 remain intact',progress(old)['state']['quizResults']['lesson:lesson-5']==old4 and all(progress(old)['state']['quizResults'][k]==r for k,r in oldprogress['state']['quizResults'].items()))
  for i,q in enumerate(pending_qs[1:],1):event(unfinished,'answer',dict(session_id=pending_sid,question_index=i,response=bank()['questions'][q['question_id']]['answer']))
  result,_=event(unfinished,'session_finish',dict(session_id=pending_sid))
  check('Unfinished 022 session completes without new-bank projection',result['quiz_result']['xp']==35 and 'assessment:nouns-final-v1' not in progress(unfinished)['state']['quizResults'])
  check('Historical acknowledged start UUID/JSON preserved',pending_start==val('select request::text from public.sl_events where event_id='+Q(pending_receipt['eventId'])+';'))
  for lid,(sid,qs,receipt,request_before) in other_pending.items():
   for i,q in enumerate(qs[1:],1):event(unfinished,'answer',dict(session_id=sid,question_index=i,response=bank(lid)['questions'][q['question_id']]['answer']))
   result,_=event(unfinished,'session_finish',dict(session_id=sid))
   check('Unfinished 022 '+lid+' survives and finishes once',result['quiz_result']['xp']==35 and request_before==val('select request::text from public.sl_events where event_id='+Q(receipt['eventId'])+';'))
  for version,sid,qs in historical_pending:
   for i,q in enumerate(qs[1:],1):event(unfinished,'answer',dict(session_id=sid,question_index=i,response=bank()['questions'][q['question_id']]['answer']))
   result,_=event(unfinished,'session_finish',dict(session_id=sid))
   check('Already active historical session finishes once: '+version,result['quiz_result']['xp']==0 and result['quiz_result']['passed'])
  legacy=[dict(question_id='q'+str(i)) for i in range(10)]
  for version,requests in queued:
   saved_before=list(requests)
   for eid,raw in requests:
    command=auth(offline,'select public.sl_apply_event('+Q(eid)+','+str(progress(offline)['revision'])+','+Q(raw)+'::jsonb);')
    reply=obj(command);stored=obj('select request from public.sl_events where event_id='+Q(eid)+';')
    assert stored==json.loads(raw) and reply['duplicate']==False
    duplicate=obj(command);assert duplicate['duplicate'] and duplicate['quiz_result']==reply['quiz_result']
   check('Pre-upgrade offline start/answers/finish retain UUID, JSON, version and lost-ACK receipts: '+version,requests==saved_before and progress(offline)['state']['xp']==35)
  check('020/021/022 offline replay shares one 35-XP reward',progress(offline)['state']['xp']==35)
  for version,archive in zip(contract['replayVersions'],['before_021','before_022','before_023']):
   historical=obj('select sl_private.quiz_catalog_'+archive+'();')
   for lid in ['lesson-1','lesson-2','lesson-3','lesson-4']:
    b=historical['lesson:'+lid];qs=b.get('start_questions') or [dict(question_id='q'+str(i)) for i in range(b['count'])]
    sid,_,receipt=start(offline,lid,version,qs)
    event(offline,'session_abandon',dict(session_id=sid))
    check('Archived bank selection replays '+lid+' under '+version,obj('select request from public.sl_events where event_id='+Q(receipt['eventId'])+';')==receipt['request'])
  result,_=finish(offline,24)
  check('A new-bank pass after offline historical replay adds no XP',result['quiz_result']['xp']==0 and progress(offline)['state']['xp']==35)
  active=bank()['start_questions']
  for label,version,qs,error in [
   ('unknown version','static-unknown',active,'unsupported_content_version'),
   ('new bank with 022 version',current22['version'],active,'context_question_count_mismatch'),
   ('new bank with 020 version',contract['replayVersions'][0],active,'context_question_count_mismatch'),
   ('new bank with 021 version',contract['replayVersions'][1],active,'context_question_count_mismatch'),
   ('legacy bank with 023 version',contract['preparedVersion'],legacy,'context_question_count_mismatch'),
   ('mixed archive/new IDs',contract['preparedVersion'],[{'question_id':'q0'}]+active[1:],'quiz_bank_count_mismatch'),
   ('duplicate IDs',contract['preparedVersion'],[active[0]]+active[:-1],'quiz_bank_count_mismatch')]:
   before=state();result,_=event(other,'session_start',dict(session_id=str(uuid4()),mode='lesson',context_id='lesson-5',content_version=version,questions=qs),ok=False)
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
    request=dict(type='session_finish',occurred_at='2026-11-27T12:00:00Z',timezone='Europe/Stockholm',data=dict(session_id=sid))
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
  for name in ['023_nouns_postflight.sql','023_nouns_fingerprints.sql']:
   r=sql((ROOT/'supabase/checks'/name).read_text())
   check(name+' reports no false checks',not re.search(r'(^|\|)f(\||$)',r.stdout,re.M))
  report.update(status='PASS',migration023Tested=True,releaseReady=False,fixtureChecksPassed=True,assertions=len(report['cases']),
   testScriptSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
   auditScriptSha256=hashlib.sha256((ROOT/'supabase/checks/023_nouns_data_audit.sql').read_bytes()).hexdigest())
 except Exception as error:
  report.update(status='FAIL',migration023Tested=False,error=str(error),assertions=len(report['cases']))
  raise
 finally:
  if started:report['clusterStopped']=subprocess.run(['pg_ctl','-D',str(data),'-m','fast','-w','stop'],env=env,capture_output=True).returncode==0
  (ROOT/'reports/nouns/sql-tests.json').write_text(json.dumps(report,indent=2)+'\n')
  print('Report: reports/nouns/sql-tests.json',flush=True)
if __name__=='__main__':main()
