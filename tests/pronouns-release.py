"""Static 021 contract verification; never connects to Supabase or executes SQL."""
import hashlib,json,re,subprocess,sys,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from check_supabase_manifest import current_manifest,read_manifest,latest_manifest_path
p=latest_manifest_path();assert p.name=='202611220021_pronouns.sql';sql=p.read_text();current=current_manifest();assert read_manifest(p)==current
base=read_manifest(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql');expected=json.loads(json.dumps(base));expected['lessons']['lesson-3']=24;expected['version']=current['version'];assert current==expected
assert "version:'"+current['version']+"'" in (ROOT/'app.js').read_text()
bank=json.loads(sql.split('$pronouns_bank$')[1]);catalog=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True));assert bank==catalog['lesson:lesson-3'];assert bank['count']==24 and bank['reward']==35 and len(bank['questions'])==35
legacy=json.loads((ROOT/'supabase/migrations/202610180010_quiz_rewards.sql').read_text().split('$quizbank$')[1])['lesson:lesson-3'];assert len(legacy['questions'])==11
for q,a in legacy['questions'].items():assert bank['questions'][q]==a
assert [q['question_id'] for q in bank['start_questions']]==[f'pronouns-final-v1-q{i:02}' for i in range(1,25)]
for n,tag in [(1,'alphabet'),(2,'greetings')]:assert catalog['lesson:lesson-'+str(n)]==json.loads((ROOT/'supabase/migrations/202611160020_greetings_introduction.sql').read_text().split('$'+tag+'_bank$')[1])
s20=(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql').read_text();s14=(ROOT/'supabase/migrations/202610190014_video_progress.sql').read_text();s12=(ROOT/'supabase/migrations/202610180012_xp_integrity.sql').read_text()
def body(s,name,d):return re.search(r'create or replace function '+re.escape(name)+r'.*?as '+re.escape(d)+r'(.*?)'+re.escape(d)+r';',s,re.S|re.I)[1]
def literal(s,name,d):return re.search(name+r' constant text := '+re.escape(d)+r'(.*?)'+re.escape(d),s,re.S)[1]
reader=body(s14,'public.sl_get_progress()','$$').replace(literal(s20,'caps14','$old$'),literal(s20,'caps20','$new$')).replace(literal(s20,'old_return','$old$'),literal(s20,'return14','$new$'))
writer=body(s12,'public.sl_apply_event','$$').replace(literal(s14,'old_clause','$old$'),literal(s14,'new_clause','$new$'))
base_writer=writer
for value in [reader,writer,body(s20,'sl_private.quiz_catalog()','$function$'),body(s20,'sl_private.manifest()','$function$')]:assert hashlib.md5(value.encode()).hexdigest() in sql
for anchor in ['caps','return']:
 old=literal(sql,'old_'+anchor,'$old$');new=literal(sql,'new_'+anchor,'$new$');assert reader.count(old)==1;reader=reader.replace(old,new)
observed=json.loads((ROOT/'supabase/baselines/020_installed_20261122.json').read_text())
assert observed['content_version']=='static-1aa3eb8422e2930a'
assert observed['function_md5']==dict(manifest='23f966adf86b8986dea5e8e194bad3d7',catalog='d76527fc03b194aa9a32f7a564e39138',reader='5748e3372fac0764e9a14d8879aea361',writer='67e980064af15b0073227139518b42ac')
for i in range(4):
 old=literal(sql,'old_'+str(i),'$old$');new=literal(sql,'new_'+str(i),'$new$');assert writer.count(old)==1;writer=writer.replace(old,new)
assert 'sl_private.manifest_before_021()' in writer and 'sl_private.quiz_catalog_before_021()->qid' in writer
# Everything after session creation (grading, ownership, receipts and XP) is byte-identical.
assert writer.split("  elsif typ in ('answer','session_finish','session_abandon') then",1)[1]==base_writer.split("  elsif typ in ('answer','session_finish','session_abandon') then",1)[1]
post=json.loads((ROOT/'reports/pronouns/release-contract.json').read_text())
assert post['installedFingerprintsVerified'] and post['expectedBaseMD5']==observed['function_md5']
assert post['expectedPostMD5']['writer']==hashlib.md5(writer.encode()).hexdigest()
assert post['expectedPostMD5']['reader']==hashlib.md5(reader.encode()).hexdigest()
assert 'event_replay:'+observed['content_version'] in reader
for tag,count in [('alphabet',20),('greetings',20),('pronouns',24)]:
 assert reader.count('assessment:'+tag+'-final-v1')==1
 assert "'"+tag+"_final_v1'" in reader
assert reader.count('s.user_id=a.user_id')==3 and reader.count("s.status='completed' and s.trusted_quiz")==3
assert reader.count('s.questions @>')==reader.count('::jsonb @> s.questions')==3
stripped=re.sub(r'--[^\n]*','',sql);assert not re.search(r'\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+table|truncate)\b',stripped,re.I)
assert set(re.findall(r'create or replace function ([\w.]+)',stripped,re.I))=={'sl_private.quiz_catalog','sl_private.manifest'}
assert 'historical lesson reward reservation missing' in sql and "installed manifest differs from 020" in sql and sql.strip().endswith('commit;')
# Frozen migrations must remain byte-identical to this checkout's original files.
for file in sorted((ROOT/'supabase/migrations').glob('*.sql')):
 if file.name>='202611220021':continue
 original=subprocess.check_output(['git','show','HEAD:'+file.relative_to(ROOT).as_posix()],cwd=ROOT);assert original==file.read_bytes(),file.name+' rewritten'
runpy.run_path(str(ROOT/'tests/greetings-release.py'),run_name='__main__')
print('PASS: independent 021; exact 020 function/manifest guards; 24 active/11 archived; unchanged lesson-1/2, reward ledger, scoring/receipt logic and historical SQL; SQL NOT executed')
