"""Read-only release contract. Parses proposals as text/JSON; NEVER executes SQL."""
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from check_supabase_manifest import current_manifest,read_manifest,latest_manifest_path
proposal=ROOT/'supabase/migrations/202611160019_alphabet_final_test.sql'
sql=proposal.read_text();old=read_manifest(ROOT/'supabase/migrations/202611160018_alphabet_pronunciation_manifest.sql');new=read_manifest(proposal)
current=current_manifest(); archived_current=json.loads(json.dumps(current));archived_current['lessons']['lesson-2']=11;archived_current['lessons']['lesson-3']=11;archived_current['version']=new['version'];assert new==archived_current;assert new['version']!=old['version']
expected=json.loads(json.dumps(old));expected['lessons']['lesson-1']=20;expected['version']=new['version'];assert expected==new
assert "version:'"+current['version']+"'" in (ROOT/'app.js').read_text()
bank=json.loads(sql.split('$alphabet_bank$')[1]);assert bank['count']==20 and bank['reward']==35
assert len(bank['questions'])==33 and len(bank['start_questions'])==20
old_bank=json.loads((ROOT/'supabase/migrations/202610180010_quiz_rewards.sql').read_text().split('$quizbank$')[1])['lesson:lesson-1']
for key,value in old_bank['questions'].items():assert bank['questions'][key]==value
assert set(q['question_id'] for q in bank['start_questions'])=={f'alphabet-final-v1-q{i:02}' for i in range(1,21)}
assert not any(q['question_id'].startswith('q') for q in bank['start_questions'])
catalog=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True));assert catalog['lesson:lesson-1']==bank
# Verify exact reviewed installed bodies and exact reader transformation anchors.
s14=(ROOT/'supabase/migrations/202610190014_video_progress.sql').read_text();s12=(ROOT/'supabase/migrations/202610180012_xp_integrity.sql').read_text()
def body(source,name,delim):return re.search(r'create or replace function '+re.escape(name)+r'.*?as '+re.escape(delim)+r'(.*?)'+re.escape(delim)+r';',source,re.S|re.I)[1]
reader=body(s14,'public.sl_get_progress()','$$');old_catalog=body(s14,'sl_private.quiz_catalog()','$function$');writer=body(s12,'public.sl_apply_event','$$')
a=re.search(r'old_clause constant text := \$old\$(.*?)\$old\$',s14,re.S)[1];b=re.search(r'new_clause constant text := \$new\$(.*?)\$new\$',s14,re.S)[1];assert writer.count(a)==1;writer=writer.replace(a,b)
for source in [reader,old_catalog,writer]:assert hashlib.md5(source.encode()).hexdigest() in sql
upgrade=sql.split('do $reader_upgrade$')[1].split('end $reader_upgrade$')[0]
for anchor in ['caps','return']:
 before=re.search(r'old_'+anchor+r' constant text := \$old\$(.*?)\$old\$',upgrade,re.S)[1];after=re.search(r'new_'+anchor+r' constant text := \$new\$(.*?)\$new\$',upgrade,re.S)[1]
 assert reader.count(before)==1;reader=reader.replace(before,after)
assert "'alphabet_final_v1'" in reader and "assessment:alphabet-final-v1" in reader
assert "s.user_id=a.user_id" in reader and "s.status='completed' and s.trusted_quiz" in reader
assert "s.questions @>" in reader and "::jsonb @> s.questions" in reader
assert "best.correct" in reader and "best.correct desc" not in reader # Uses s.correct in the ordered subquery.
assert 'order by s.correct desc,s.started_at desc' in reader
assert 'result:=coalesce(' in reader and '),result);' in reader # No new result preserves the old snapshot.
# The proposal never touches the event writer or user rows. Its only direct replacements
# are the private catalog and manifest; the reader upgrade preserves existing ACL/owner.
stripped=re.sub(r'--[^\n]*','',sql)
assert not re.search(r'\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+table|truncate)\b',stripped,re.I)
assert set(re.findall(r'create or replace function ([\w.]+)',stripped,re.I))=={'sl_private.quiz_catalog','sl_private.manifest'}
assert 'execute definition;' in sql and 'public.sl_get_progress()' in sql
assert "historical lesson reward reservation missing" in sql
assert "revoke all on function sl_private.quiz_catalog_before_019() from public,anon,authenticated" in sql
assert sql.strip().endswith('commit;')
print('PASS: prepared 019 bank/reader/manifest; 20 active + 13 unchanged archived IDs; 35-XP ledger retained; exact source guards, scoped read-only final result, no user DML; SQL NOT executed')
