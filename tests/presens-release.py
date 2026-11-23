"""Local release safeguards. Never reads credentials or connects to a database."""
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import shutil

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from check_supabase_manifest import current_manifest,read_manifest
from presens_contract import installed_021_source,md5,body,literal
lessons=json.loads((ROOT/'lessons.json').read_text());v=lessons[3]['learningV2']
catalog=json.loads(subprocess.check_output(['node','scripts/quiz_catalog.cjs'],cwd=ROOT,text=True))
for p in (ROOT/'supabase/migrations').glob('*.sql'):
 if p.name<'202611230022':assert p.read_bytes()==subprocess.check_output(['git','show','HEAD:'+p.relative_to(ROOT).as_posix()],cwd=ROOT),p.name+' rewritten'
old=read_manifest(ROOT/'supabase/migrations/202611220021_pronouns.sql');draft=current_manifest()
expected=json.loads(json.dumps(old));expected['lessons']['lesson-4']=24;expected['version']=draft['version'];assert draft==expected
for n,tag,migration in [(1,'alphabet','202611160020_greetings_introduction.sql'),(2,'greetings','202611160020_greetings_introduction.sql'),(3,'pronouns','202611220021_pronouns.sql')]:
 archived=json.loads((ROOT/'supabase/migrations'/migration).read_text().split('$'+tag+'_bank$')[1]);assert catalog['lesson:lesson-'+str(n)]==archived
legacy=json.loads((ROOT/'supabase/migrations/202610180010_quiz_rewards.sql').read_text().split('$quizbank$')[1])['lesson:lesson-4']
bank=catalog['lesson:lesson-4'];assert bank['count']==24 and bank['reward']==35 and len(bank['questions'])==35
for q,answer in legacy['questions'].items():assert bank['questions'][q]==answer
assert [q['question_id'] for q in bank['start_questions']]==[f'presens-final-v1-q{i:02}' for i in range(1,25)]
for name in ['022_presens_preflight.sql','022_presens_postflight.sql','022_presens_data_audit.sql']:
 text=(ROOT/'supabase/checks'/name).read_text();assert 'read only' in text.lower()
 assert not re.search(r'\b(create|insert|update|delete|alter|drop|truncate)\b',re.sub(r'--[^\n]*','',text),re.I)
baseline=ROOT/'supabase/baselines/021_installed_for_022.json';migration=ROOT/'supabase/migrations/202611230022_presens.sql'
if not baseline.exists():
 assert not migration.exists(),'Migration must not be generated before observed baseline'
 targets=[ROOT/'app.js',ROOT/'sw.js',*sorted((ROOT/'supabase/migrations').glob('*.sql'))]
 before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in targets}
 r=subprocess.run([sys.executable,'scripts/build_presens_release.py'],cwd=ROOT,capture_output=True,text=True)
 assert r.returncode and 'BASELINE REQUIRED' in r.stderr and not migration.exists()
 assert before=={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in targets},'Blocked generator changed runtime/SQL'
 check=subprocess.run([sys.executable,'scripts/check_supabase_manifest.py'],cwd=ROOT,capture_output=True,text=True)
 assert check.returncode and 'NOT RELEASE READY' in check.stderr
 assert "version:'static-57b40b608d91091d'" in (ROOT/'app.js').read_text()
 (ROOT/'reports/presens/release-status.json').write_text(json.dumps(dict(date='2026-11-23',status='awaiting-actual-installed-021-baseline',releaseReady=False,baselineObserved=False,clientPublished=False,productionSqlExecuted=False,sql022Generated=False,clientVersionHeld=old['version'],draftContentVersion=draft['version'],source021MD5ForComparisonOnly={k:md5(value) for k,value in installed_021_source().items()},contract='Existing assessment projection and lesson:lesson-4 reward key; no new result format'),indent=2)+'\n')
 print('PASS: 24 active + 11 archived; immutable 018–021 and lesson-1/2/3 banks; read-only SQL checks; missing actual baseline blocks generation and publication. 022 acceptance PENDING.')
else:
 contract=json.loads((ROOT/'reports/presens/release-contract.json').read_text());sql=migration.read_text()
 observed=json.loads(baseline.read_text());provenance=json.loads((ROOT/'supabase/baselines/021_installed_for_022_provenance.json').read_text())
 assert provenance['decodedBaselineSha256']==hashlib.sha256(baseline.read_bytes()).hexdigest()
 assert observed['function_md5']=={k:md5(value) for k,value in installed_021_source().items()}==contract['expectedBaseMD5']
 assert observed['manifest']==old and json.loads(sql.split('$observed_banks$')[1])==observed['quiz_catalog']
 for signature in ['sl_private.manifest()','sl_private.quiz_catalog()','public.sl_get_progress()','public.sl_apply_event(uuid,bigint,jsonb)']:assert signature in sql
 for value in observed['function_md5'].values():assert value in sql
 assert contract['installedBaselineVerified'] and read_manifest(migration)==draft
 assert contract['preparedVersion']==draft['version'] and json.loads(sql.split('$presens_bank$')[1])==bank
 src=installed_021_source();writer=src['writer'];part=sql.split('do $writer_upgrade$')[1].split('end $writer_upgrade$')[0]
 for i in range(2):
  a,b=literal(part,'old_'+str(i),'$old$'),literal(part,'new_'+str(i),'$new$');assert writer.count(a)==1;writer=writer.replace(a,b)
 boundary="  elsif typ in ('answer','session_finish','session_abandon') then"
 assert writer.split(boundary)[1]==src['writer'].split(boundary)[1]
 assert md5(writer)==contract['expectedPostMD5']['writer']
 assert "version:'"+draft['version']+"'" in (ROOT/'app.js').read_text()
 assert not re.search(r'\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+table|truncate)\b',re.sub(r'--[^\n]*','',sql),re.I)
 # Exercise the actual generator with the observed baseline in isolated copies.
 # Never remove or overwrite the reviewed candidate in the working tree.
 files=['app.js','sw.js','locale-content.js','words.json','lessons.json','books.json',
  'scripts/build_presens_release.py','scripts/check_supabase_manifest.py','scripts/presens_contract.py','scripts/quiz_catalog.cjs',
  'supabase/migrations/202610180012_xp_integrity.sql','supabase/migrations/202610190014_video_progress.sql',
  'supabase/migrations/202611160020_greetings_introduction.sql','supabase/migrations/202611220021_pronouns.sql']
 cases=[]
 for case in ['observed','missing','wrong-md5','wrong-bank','existing-backup','wrong-version']:
  copy=Path(tempfile.mkdtemp(prefix='sl-presens-generator-',dir='/private/tmp'))
  for name in files:
   destination=copy/name;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,destination)
  (copy/'reports/presens').mkdir(parents=True);(copy/'supabase/checks').mkdir(parents=True);(copy/'supabase/baselines').mkdir(parents=True)
  value=json.loads(baseline.read_text())
  if case=='wrong-md5':value['function_md5']['writer']='0'*32
  if case=='wrong-bank':value['quiz_catalog']['lesson:lesson-4']['questions']['q0']['answer']='__changed__'
  if case=='existing-backup':value['backups']['manifest_before_022']=True
  if case=='wrong-version':value['content_version']='static-unverified'
  if case!='missing':(copy/baseline.relative_to(ROOT)).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
  before={name:(copy/name).read_bytes() for name in ['app.js','sw.js']}
  result=subprocess.run([sys.executable,'scripts/build_presens_release.py'],cwd=copy,text=True,capture_output=True)
  if case=='observed':
   assert result.returncode==0,result.stderr
   for name in ['supabase/migrations/202611230022_presens.sql','supabase/checks/022_presens_fingerprints.sql','app.js','sw.js']:assert (copy/name).read_bytes()==(ROOT/name).read_bytes(),name+' is not reproducible'
  else:
   assert result.returncode!=0 and not (copy/migration.relative_to(ROOT)).exists(),case+' was accepted'
   assert before=={name:(copy/name).read_bytes() for name in before},case+' changed runtime'
  cases.append(dict(name=case,passed=True))
 (ROOT/'reports/presens/generator-verification.json').write_text(json.dumps(dict(localOnly=True,productionConnected=False,sqlExecuted=False,candidateReproducedByteForByte=True,cases=cases),indent=2)+'\n')
 print('PASS: baseline-verified candidate agrees with client; unchanged scoring/reward/receipt logic. Not applied or published.')
