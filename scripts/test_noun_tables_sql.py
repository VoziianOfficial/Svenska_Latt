"""Local disposable PostgreSQL only. Restore post-023 functions, execute only 024.
No production connection parameters accepted; 023 is never executed/reapplied.
"""
import hashlib,json,os,re,shutil,subprocess,sys,tempfile
from uuid import uuid4
from noun_tables_contract import ROOT,MIGRATION,VERSION_023,SIGNATURES,source_023,published_properties
from nouns_contract import observed_baseline,functions_query
from build_noun_tables_release import archive_query
from check_supabase_manifest import current_manifest


def Q(s):return "'"+str(s).replace("'","''")+"'"

def main():
 if len(sys.argv)>1:raise SystemExit('No external connection arguments accepted')
 work=ROOT/'reports/noun-tables';work.mkdir(parents=True,exist_ok=True)
 temp=__import__('pathlib').Path(tempfile.mkdtemp(prefix='sl-noun-tables-pg-',dir='/private/tmp'));data=temp/'data';sock=temp/'socket';sock.mkdir(mode=0o700)
 env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
 args=['psql','-X','-qAt','-h',str(sock),'-p','55484','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
 report=dict(localOnly=True,tcpListener=False,productionConnected=False,productionSqlExecuted=False,migration023Executed=False,fixture023SourcesRestored=True,cases=[])
 started=False
 def sql(s,check=True):
  r=subprocess.run(args,input=s,text=True,capture_output=True,env=env)
  if check and r.returncode:raise RuntimeError(r.stderr[-4000:])
  return r
 def val(s):return sql(s).stdout.strip().splitlines()[-1]
 def obj(s):return json.loads(val(s))
 def check(name,ok):
  report['cases'].append(dict(name=name,passed=bool(ok)))
  assert ok,name
  print('PASS:',name,flush=True)
 def auth(user,s):return 'set role authenticated;select set_config(\'request.jwt.claim.sub\','+Q(user)+',false);'+s
 def progress(u):return obj(auth(u,'select public.sl_get_progress();'))
 def event(u,typ,payload,eid=None,ok=True):
  request=json.dumps(dict(type=typ,occurred_at='2026-11-27T16:00:00Z',timezone='Europe/Stockholm',data=payload))
  cmd=auth(u,'select public.sl_apply_event('+Q(eid or str(uuid4()))+','+str(progress(u)['revision'])+','+Q(request)+'::jsonb);')
  r=sql(cmd,ok)
  return (json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode==0 else r),cmd
 def new_user():
  u=str(uuid4());sql('insert into auth.users(id,email) values('+Q(u)+','+Q(u+'@example.invalid')+');');progress(u);return u
 def bank(version,lesson):
  suffix={versions[0]:'_before_021',versions[1]:'_before_022',versions[2]:'_before_023'}.get(version,'')
  return obj('select sl_private.quiz_catalog'+suffix+'()->'+Q('lesson:'+lesson)+';')
 def start(u,version,lesson='lesson-5'):
  b=bank(version,lesson);qs=b.get('start_questions') or [dict(question_id='q'+str(i)) for i in range(b['count'])]
  sid=str(uuid4());_,cmd=event(u,'session_start',dict(session_id=sid,mode='lesson',context_id=lesson,content_version=version,questions=qs))
  return sid,qs,b,cmd
 def finish(u,version,lesson='lesson-5',score=None,session=None):
  sid,qs,b,cmd=session or start(u,version,lesson)
  answered=int(val('select answered from public.sl_sessions where user_id='+Q(u)+' and id='+Q(sid)+';'))
  for i,q in enumerate(qs[answered:],answered):event(u,'answer',dict(session_id=sid,question_index=i,response=b['questions'][q['question_id']]['answer'] if score is None or i<score else '__incorrect__'))
  return event(u,'session_finish',dict(session_id=sid))
 def state():
  tables=obj("select jsonb_agg(table_name order by table_name) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';")
  rows={t:obj('select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),\'[]\') from public.'+t+' t;') for t in tables}
  return dict(rows=rows,functions=obj(functions_query()),archives=obj(archive_query()),catalog=obj('select sl_private.quiz_catalog();'))
 def rejected(name,candidate,error):
  before=state();r=sql(candidate,False)
  if error not in r.stderr:print(r.stderr,flush=True)
  check(name,r.returncode!=0 and error in r.stderr and before==state())
 versions=['static-1aa3eb8422e2930a','static-57b40b608d91091d','static-18bd9e23b62c3382',VERSION_023]
 try:
  subprocess.run(['initdb','-D',str(data),'-A','trust','--no-locale','--encoding=UTF8','-U','postgres'],env=env,check=True,stdout=(temp/'initdb.log').open('w'),stderr=subprocess.STDOUT)
  subprocess.run(['pg_ctl','-D',str(data),'-l',str(temp/'postgres.log'),'-o',f"-k {sock} -p 55484 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],env=env,check=True,capture_output=True);started=True
  sql((ROOT/'supabase/tests/bootstrap_local.sql').read_text())
  for p in sorted((ROOT/'supabase/migrations').glob('*.sql')):
   if p.name<'202611160018':sql(p.read_text())
  baseline=observed_baseline()
  for name,f in baseline['archives'].items():
   sql(f['definition']);sql('revoke all on function sl_private.'+name+'() from public,anon,authenticated;')
  for f in baseline['functions'].values():sql(f['definition'])
  # Freeze the existing 022 values as 023 did; not a replay of migration 023.
  for name in ['manifest','quiz_catalog']:
   sql(f"create function sl_private.{name}_before_023() returns jsonb language sql immutable security invoker set search_path='' as "+Q('select '+Q(val('select sl_private.'+name+'()::text;'))+'::jsonb')+';')
   sql('revoke all on function sl_private.'+name+'_before_023() from public,anon,authenticated;')
  for name,source in source_023().items():sql(baseline['functions'][name]['definition'].replace(baseline['functions'][name]['source'],source,1))
  check('Exact post-023 sources, full definitions, owner, ACL and config restored',obj(functions_query())==published_properties())
  prepared=current_manifest()['version'];candidate=MIGRATION.read_text();report.update(contentVersion=prepared,migrationSha256=hashlib.sha256(candidate.encode()).hexdigest())
  old=new_user();fresh=new_user();pending=new_user();queued=new_user()
  historical_receipt=finish(old,VERSION_023)[1];old_progress=progress(old)
  sessions=[(v,start(pending,v)) for v in versions]
  partial_receipts=[]
  for v,(sid,qs,b,cmd) in sessions:
   _,receipt=event(pending,'answer',dict(session_id=sid,question_index=0,response=b['questions'][qs[0]['question_id']]['answer']))
   partial_receipts.append((v,receipt))
  before=state()
  # Fingerprint and permission guards; each rejection must roll back atomically.
  for name,sig in SIGNATURES.items():
   original=val('select to_jsonb(pg_get_functiondef('+Q(sig)+'::regprocedure));');original=json.loads(original)
   delimiter=re.search(r'AS (\$[^$]*\$)',original)[1]
   sql(original.replace(delimiter,delimiter+'\n-- deliberate fixture drift\n',1))
   rejected(name+' source drift fails closed',candidate,'installed functions or properties differ')
   sql(original)
   sql('grant execute on function '+sig+' to anon;');rejected(name+' ACL drift fails closed',candidate,'installed functions or properties differ');sql('revoke execute on function '+sig+' from anon;')
  sql("create function sl_private.manifest_before_024() returns jsonb language sql as $$select '{}'::jsonb$$;")
  rejected('Existing 024 backup preserved',candidate,'backup already exists');sql('drop function sl_private.manifest_before_024();')
  rejected('Failure at final boundary rolls back all functions and user data',candidate.rsplit('commit;',1)[0]+"do $$begin raise exception 'forced local rollback';end$$;commit;",'forced local rollback')
  sql('alter default privileges in schema sl_private grant execute on functions to service_role;')
  rejected('Unexpected default grant rolls back entire migration',candidate,'new manifest archive differs')
  sql('alter default privileges in schema sl_private revoke execute on functions from service_role;')
  check('Read-only preflight executes before 024','f' not in sql((ROOT/'supabase/checks/024_noun_tables_preflight.sql').read_text()).stdout.splitlines()[:4])
  sql(candidate);after=state()
  check('024 changes no progress, XP, events, session or result rows',before['rows']==after['rows'])
  check('Quiz catalog and every historical bank unchanged',before['catalog']==after['catalog'] and before['functions']['catalog']==after['functions']['catalog'])
  check('All existing replay archives and permissions unchanged',all(after['archives'][k]==v for k,v in before['archives'].items()))
  check('Manifest equals new static content',obj('select sl_private.manifest();')==current_manifest())
  check('Postflight checks execute and pass','f' not in sql((ROOT/'supabase/checks/024_noun_tables_postflight.sql').read_text()).stdout.splitlines()[:4])
  contract=json.loads((work/'release-contract.json').read_text())
  check('Source MD5 agrees with prepared contract',{k:v['md5'] for k,v in after['functions'].items()}==contract['expectedPostMD5'])
  check('Reader advertises all four historical replay versions',all('event_replay:'+v in progress(fresh)['capabilities'] for v in versions))
  rejected('024 reapplication rejected atomically',candidate,'backup already exists')
  saved=state();reply=obj(historical_receipt)
  check('Acknowledged 023 receipt replay returns duplicate with no mutations',reply['duplicate'] and saved==state())
  for v,receipt in partial_receipts:
   saved=state();reply=obj(receipt)
   check('Acknowledged '+v+' answer survives unchanged',reply['duplicate'] and saved==state())
  for v,session in sessions:
   saved=state();reply=obj(session[3])
   check('Acknowledged '+v+' start survives unchanged',reply['duplicate'] and saved==state())
   result,_=finish(pending,v,session=session)
   check('Previously started '+v+' session can finish',result['quiz_result']['passed'])
  for v in versions:
   for i in range(1,6):
    result,receipt=finish(queued,v,'lesson-'+str(i))
    saved=state();reply=obj(receipt)
    check('Queued '+v+' lesson-'+str(i)+' replay and receipt retry',result['quiz_result']['passed'] and reply['duplicate'] and saved==state())
  result,_=finish(old,prepared)
  check('Previously rewarded account earns no second XP',result['quiz_result']['xp']==0 and progress(old)['state']['xp']==old_progress['state']['xp'])
  for score,xp in [(19,0),(20,35),(24,35)]:
   result,_=finish(fresh,prepared,score=score)
   check(str(score)+'/24 threshold and lifetime reward',result['quiz_result']['passed']==(score>=20) and progress(fresh)['state']['xp']==xp)
  result,_=event(fresh,'session_start',dict(session_id=str(uuid4()),mode='lesson',context_id='lesson-5',content_version='static-unknown',questions=bank(prepared,'lesson-5')['start_questions']),ok=False)
  check('Unknown content_version remains rejected',result.returncode!=0 and 'content_version' in result.stderr)
  report['status']='PASS'
 finally:
  if started:
   r=subprocess.run(['pg_ctl','-D',str(data),'-m','fast','-w','stop'],env=env,capture_output=True);report['clusterStopped']=r.returncode==0
  (work/'sql-tests.json').write_text(json.dumps(report,indent=2)+'\n')
 print('PASS:',len(report['cases']),'local SQL cases; 023 never executed; cluster stopped')

if __name__=='__main__':main()
