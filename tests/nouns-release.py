"""Offline 023 release contract, preservation and reproducible generator checks."""
import hashlib,json,re,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from check_supabase_manifest import current_manifest,read_manifest,latest_manifest_path
from nouns_contract import BASELINE,MIGRATION,observed_baseline
from presens_contract import literal,md5

def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
# The active content-only release has its own contract; keep 023 checks available for its frozen checkout.
if latest_manifest_path().name=='202611270024_noun_tables.sql':
 import runpy
 runpy.run_path(str(ROOT/'tests/noun-tables-release.py'),run_name='__main__')
 raise SystemExit(0)

observed=observed_baseline();contract=json.loads((ROOT/'reports/nouns/release-contract.json').read_text())
lessons=json.loads((ROOT/'lessons.json').read_text());old=json.loads(subprocess.check_output(['git','show','HEAD:lessons.json'],cwd=ROOT))
assert len(lessons)==len(old)==50
for a,b in zip(lessons,old):
 assert a['id']==b['id'] and a['questions']==b['questions']
 if a['id']!='lesson-5':assert a==b,a['id']
 else:assert {k:v for k,v in a.items() if k!='nounsChapter'}==b
for p in (ROOT/'supabase/migrations').glob('*.sql'):
 if p.name<MIGRATION.name:
  assert p.read_bytes()==subprocess.check_output(['git','show','HEAD:'+p.relative_to(ROOT).as_posix()],cwd=ROOT),'Published migration changed: '+p.name
for name in ['supabase-progress.js','supabase-auth.js','supabase-client.js','supabase-rpc.js','manifest.webmanifest','favicon.svg']:
 assert (ROOT/name).read_bytes()==subprocess.check_output(['git','show','HEAD:'+name],cwd=ROOT),name
catalog=json.loads(subprocess.check_output(['node','scripts/quiz_catalog.cjs'],cwd=ROOT))
b=catalog['lesson:lesson-5'];f=lessons[4]['nounsChapter']['finalTest']
assert b['count']==24 and b['reward']==35 and len(b['questions'])==34
assert b['start_questions']==[dict(question_id=f'nouns-final-v1-q{i:02}') for i in range(1,25)]
for k,v in observed['quiz_catalog']['lesson:lesson-5']['questions'].items():assert b['questions'][k]==v
for n in range(1,5):assert catalog['lesson:lesson-'+str(n)]==observed['quiz_catalog']['lesson:lesson-'+str(n)]
for name in ['023_nouns_preflight.sql','023_nouns_data_audit.sql','023_nouns_postflight.sql','023_nouns_fingerprints.sql']:
 s=(ROOT/'supabase/checks'/name).read_text();assert 'read only' in s.lower()
 assert not re.search(r'\b(create|insert|update|delete|alter|drop|truncate)\b',re.sub(r'--[^\n]*','',s),re.I)
version=current_manifest()['version'];assert "version:'"+version+"'" in (ROOT/'app.js').read_text()
assert latest_manifest_path()==MIGRATION and read_manifest(MIGRATION)==current_manifest()
expected=json.loads(json.dumps(observed['manifest']));expected['lessons']['lesson-5']=24;expected['version']=version
assert current_manifest()==expected and contract['preparedVersion']==version
s=MIGRATION.read_text();assert sha(MIGRATION)==contract['migrationSha256']
assert json.loads(s.split('$observed_banks$')[1])==observed['quiz_catalog']
assert json.loads(s.split('$nouns_bank$')[1])==b
writer=observed['functions']['writer']['source'];part=s.split('do $writer_upgrade$')[1].split('end $writer_upgrade$')[0]
for i in range(2):
 a,c=literal(part,'old_'+str(i),'$old$'),literal(part,'new_'+str(i),'$new$');assert writer.count(a)==1;writer=writer.replace(a,c)
boundary="  elsif typ in ('answer','session_finish','session_abandon') then"
assert writer.split(boundary)[1]==observed['functions']['writer']['source'].split(boundary)[1]
assert md5(writer)==contract['expectedPostMD5']['writer']
assert not re.search(r'\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+table|truncate)\b',re.sub(r'--[^\n]*','',s),re.I)
r=subprocess.run([sys.executable,'scripts/check_supabase_manifest.py'],cwd=ROOT,capture_output=True,text=True);assert r.returncode==0,r.stderr
# Reproduce in disposable copies; never remove/overwrite the reviewed candidate.
files=['app.js','sw.js','locale-content.js','words.json','lessons.json','books.json',
 'scripts/build_nouns_release.py','scripts/nouns_contract.py','scripts/check_supabase_manifest.py','scripts/presens_contract.py','scripts/quiz_catalog.cjs',
 *[p.relative_to(ROOT).as_posix() for p in (ROOT/'supabase/migrations').glob('*.sql') if p.name<MIGRATION.name]]
cases=[]
for case in ['observed','missing','changed-bytes','wrong-md5','wrong-source','wrong-bank','wrong-archive','wrong-permissions','existing-backup','wrong-version','existing-candidate']:
 with tempfile.TemporaryDirectory(prefix='sl-nouns-generator-',dir='/private/tmp') as d:
  copy=Path(d)
  for name in files:
   dest=copy/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,dest)
  for name in ['reports/nouns','supabase/checks','supabase/baselines']:(copy/name).mkdir(parents=True,exist_ok=True)
  provenance=json.loads(BASELINE.with_name('022_installed_for_023_provenance.json').read_text())
  value=json.loads(BASELINE.read_text())
  if case=='wrong-md5':value['function_md5']['writer']='0'*32
  if case=='wrong-source':value['functions']['writer']['source']+='\n-- modified'
  if case=='wrong-bank':value['quiz_catalog']['lesson:lesson-5']['questions']['q0']['answer']='__changed__'
  if case=='wrong-archive':value['archives']['manifest_before_021']['source']+=' '
  if case=='wrong-permissions':value['functions']['catalog']['acl'].append('authenticated=X/postgres')
  if case=='existing-backup':value['backups']['manifest_before_023']=True
  if case=='wrong-version':value['content_version']='static-unverified'
  if case!='missing':
   raw=BASELINE.read_bytes() if case in ['observed','existing-candidate'] else (json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
   if case=='changed-bytes':raw+=b' '
   (copy/BASELINE.relative_to(ROOT)).write_bytes(raw)
   if case!='changed-bytes':provenance['sha256']=hashlib.sha256(raw).hexdigest()
  (copy/BASELINE.with_name('022_installed_for_023_provenance.json').relative_to(ROOT)).write_text(json.dumps(provenance))
  if case=='existing-candidate':(copy/MIGRATION.relative_to(ROOT)).write_text('existing candidate, preserve me')
  before={name:(copy/name).read_bytes() for name in ['app.js','sw.js']}
  r=subprocess.run([sys.executable,'scripts/build_nouns_release.py'],cwd=copy,capture_output=True,text=True)
  if case=='observed':
   assert not r.returncode,r.stderr
   for name in [MIGRATION.relative_to(ROOT).as_posix(),'supabase/checks/023_nouns_postflight.sql','supabase/checks/023_nouns_fingerprints.sql','reports/nouns/release-contract.json','app.js','sw.js']:
    assert (copy/name).read_bytes()==(ROOT/name).read_bytes(),name+' is not reproducible'
  else:
   assert r.returncode,case+' was accepted'
   assert before=={name:(copy/name).read_bytes() for name in before},case+' changed runtime'
   if case=='existing-candidate':assert (copy/MIGRATION.relative_to(ROOT)).read_text()=='existing candidate, preserve me'
   else:assert not (copy/MIGRATION.relative_to(ROOT)).exists(),case+' generated SQL'
  cases.append(dict(name=case,passed=True))
(ROOT/'reports/nouns/generator-verification.json').write_text(json.dumps(dict(localOnly=True,productionConnected=False,sqlExecuted=False,candidateReproducedByteForByte=True,cases=cases),indent=2)+'\n')
report=dict(date='2026-11-27',status='prepared-not-applied',releaseReady=False,baselineObserved=True,
 productionSqlExecuted=False,clientPublished=False,sql023Generated=True,postflight023Generated=True,
 installedVersionReportedByUser=observed['content_version'],contentVersion=version,legacyLesson5IDs=10,
 activeLesson5IDs=24,allLesson5IDs=34,reward=35,otherLessonsUnchanged=True,migrations001Through022Unchanged=True,
 authAndQueueRuntimeUnchanged=True,staticContractAligned=True,productionPostflight='NOT RUN: manual release required')
sql_path=ROOT/'reports/nouns/sql-tests.json';regression_path=ROOT/'reports/nouns/regression-tests.json'
sql_report=json.loads(sql_path.read_text()) if sql_path.exists() else {}
regression=json.loads(regression_path.read_text()) if regression_path.exists() else {}
current_sql=(sql_report.get('status')=='PASS' and sql_report.get('clusterStopped') is True
 and sql_report.get('migrationSha256')==sha(MIGRATION)
 and sql_report.get('baselineSha256')==sha(BASELINE)
 and sql_report.get('testScriptSha256')==sha(ROOT/'scripts/test_nouns_sql.py')
 and sql_report.get('auditScriptSha256')==sha(ROOT/'supabase/checks/023_nouns_data_audit.sql'))
report.update(sql023Acceptance='PASS' if current_sql else 'PENDING CURRENT FINAL SQL RUN',
 sqlAssertions=sql_report.get('assertions') if current_sql else None,
 postgresClusterStopped=sql_report.get('clusterStopped',False),generatorScenarios=len(cases),
 regressionSuites=len(regression.get('cases',[])),regressionStatus=regression.get('status','NOT RUN'),
 localReleaseReady=current_sql and regression.get('status')=='PASS',
 baselineSha256=sha(BASELINE),migrationSha256=sha(MIGRATION))
(ROOT/'reports/nouns/release-status.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: baseline-verified reproducible 023; 24 active + 10 historical IDs; unchanged lessons 1–4, migrations 001–022, Auth/queues and scoring. '+version+'; not applied or published.')
