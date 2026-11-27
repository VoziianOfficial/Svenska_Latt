"""Offline 024 contract, source reproducibility and immutable published-data checks."""
import hashlib,json,re,shutil,subprocess,sys,tempfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from check_supabase_manifest import current_manifest,read_manifest,latest_manifest_path
from noun_tables_contract import MIGRATION,PUBLISHED,VERSION_023,CATALOG_SHA256_023


def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def original(path):return subprocess.check_output(['git','show','HEAD:'+path],cwd=ROOT)

contract=json.loads((ROOT/'reports/noun-tables/release-contract.json').read_text())
assert latest_manifest_path()==MIGRATION
assert read_manifest(MIGRATION)==current_manifest()
assert sha(MIGRATION)==contract['migrationSha256'] and sha(PUBLISHED)==contract['published023Sha256']
assert hashlib.sha256(subprocess.check_output(['node','scripts/quiz_catalog.cjs'],cwd=ROOT)).hexdigest()==CATALOG_SHA256_023
assert "version:'"+current_manifest()['version']+"'" in (ROOT/'app.js').read_text()
lessons=json.loads((ROOT/'lessons.json').read_text());old=json.loads(original('lessons.json'))
for a,b in zip(lessons,old):
 assert a['id']==b['id'] and a['questions']==b['questions']
 if a['id']!='lesson-5':assert a==b
 else:
  assert {k:v for k,v in a.items() if k!='nounsChapter'}=={k:v for k,v in b.items() if k!='nounsChapter'}
  for key in ['questions','writing','dialogues','reading','finalTest']:assert a['nounsChapter'][key]==b['nounsChapter'][key]
for p in (ROOT/'supabase/migrations').glob('*.sql'):
 if p.name<MIGRATION.name:assert p.read_bytes()==original(p.relative_to(ROOT).as_posix()),'Applied migration changed: '+p.name
for name in ['supabase-progress.js','supabase-auth.js','supabase-client.js','supabase-rpc.js','words.json','books.json']:
 assert (ROOT/name).read_bytes()==original(name),name+' changed'
s=MIGRATION.read_text();assert s.lstrip().startswith('-- 024:') and s.rstrip().endswith('commit;')
assert not re.search(r'\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+table|truncate|create\s+or\s+replace\s+function\s+sl_private\.quiz_catalog)\b',re.sub(r'--[^\n]*','',s),re.I)
# Every table row and source annotation regenerate exactly; no runtime writes by the check.
with tempfile.TemporaryDirectory(prefix='sl-noun-content-',dir='/private/tmp') as d:
 copy=Path(d);(copy/'scripts').mkdir();shutil.copy2(ROOT/'lessons.json',copy/'lessons.json')
 for p in (ROOT/'scripts').glob('*.py'):shutil.copy2(p,copy/'scripts'/p.name)
 subprocess.run([sys.executable,'scripts/build_nouns_content.py'],cwd=copy,check=True,capture_output=True)
 assert (copy/'lessons.json').read_bytes()==(ROOT/'lessons.json').read_bytes(),'Content generator drift'
files=['app.js','sw.js','locale-content.js','words.json','lessons.json','books.json',
 *[p.relative_to(ROOT).as_posix() for p in (ROOT/'scripts').glob('*.py')], 'scripts/quiz_catalog.cjs',
 *[p.relative_to(ROOT).as_posix() for p in (ROOT/'supabase/migrations').glob('*.sql') if p.name<MIGRATION.name],
 'supabase/checks/023_nouns_fingerprints.sql','supabase/checks/023_nouns_postflight.sql']
cases=[]
for case in ['exact','existing-candidate','changed-quiz','changed-count','wrong-client-version','modified-023']:
 with tempfile.TemporaryDirectory(prefix='sl-noun-024-generator-',dir='/private/tmp') as d:
  copy=Path(d)
  for name in files:
   dest=copy/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/name,dest)
  if case=='existing-candidate':(copy/MIGRATION.relative_to(ROOT)).write_text('existing candidate; preserve')
  if case in ('changed-quiz','changed-count'):
   data=json.loads((copy/'lessons.json').read_text())
   if case=='changed-quiz':data[4]['nounsChapter']['finalTest']['questions'][0]['answerId']='o3'
   else:data[4]['nounsChapter']['finalTest']['questions'].pop()
   (copy/'lessons.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
  if case=='wrong-client-version':(copy/'app.js').write_text((copy/'app.js').read_text().replace(current_manifest()['version'],'static-wrong'))
  if case=='modified-023':
   p=copy/PUBLISHED.relative_to(ROOT);p.write_text(p.read_text().replace("select $manifest$","select $manifest$ ",1))
  before={name:(copy/name).read_bytes() for name in ['app.js','sw.js']}
  r=subprocess.run([sys.executable,'scripts/build_noun_tables_release.py'],cwd=copy,capture_output=True,text=True)
  if case=='exact':
   assert not r.returncode,r.stderr
   for name in [MIGRATION.relative_to(ROOT).as_posix(),'supabase/checks/024_noun_tables_preflight.sql','supabase/checks/024_noun_tables_postflight.sql','reports/noun-tables/release-contract.json','app.js','sw.js']:
    assert (copy/name).read_bytes()==(ROOT/name).read_bytes(),name+' not reproducible'
  else:
   assert r.returncode,case+' accepted'
   assert before=={name:(copy/name).read_bytes() for name in before}
   if case=='existing-candidate':assert (copy/MIGRATION.relative_to(ROOT)).read_text()=='existing candidate; preserve'
   else:assert not (copy/MIGRATION.relative_to(ROOT)).exists()
  cases.append(dict(name=case,passed=True))
report=dict(localOnly=True,status='PASS',candidateReproducedByteForByte=True,contentReproducedByteForByte=True,publishedMigrationsUnchanged=True,quizCatalogUnchanged=True,authAndQueueRuntimeUnchanged=True,cases=cases)
(ROOT/'reports/noun-tables/generator-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print('PASS: 024/content reproduced byte for byte; six generator cases, published migrations, all quiz banks, other lessons and queue runtime unchanged')
