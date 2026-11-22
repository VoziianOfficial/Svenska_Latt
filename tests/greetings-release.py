"""Read-only proposal validation. NEVER executes SQL or contacts Supabase."""
import hashlib,json,re,subprocess,sys,runpy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts'))
from check_supabase_manifest import current_manifest,read_manifest,latest_manifest_path
p=ROOT/'supabase/migrations/202611160020_greetings_introduction.sql';sql=p.read_text();current=current_manifest();archived=json.loads(json.dumps(current));archived['lessons']['lesson-3']=11;archived['version']=read_manifest(p)['version'];assert read_manifest(p)==archived
old=read_manifest(ROOT/'supabase/migrations/202611160019_alphabet_final_test.sql');expected=json.loads(json.dumps(old));expected['lessons']['lesson-2']=20;expected['version']=archived['version'];assert expected==archived
assert "version:'"+current['version']+"'" in (ROOT/'app.js').read_text()
catalog=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True));archive=json.loads((ROOT/'supabase/migrations/202610180010_quiz_rewards.sql').read_text().split('$quizbank$')[1])
for n,tag,total in [(1,'alphabet',33),(2,'greetings',31)]:
 bank=json.loads(sql.split('$'+tag+'_bank$')[1]);assert bank==catalog['lesson:lesson-'+str(n)];assert bank['count']==20 and bank['reward']==35 and len(bank['questions'])==total and len(bank['start_questions'])==20
 for q,answer in archive['lesson:lesson-'+str(n)]['questions'].items():assert bank['questions'][q]==answer
 assert not any(q['question_id'].startswith('q') for q in bank['start_questions'])
s14=(ROOT/'supabase/migrations/202610190014_video_progress.sql').read_text();s12=(ROOT/'supabase/migrations/202610180012_xp_integrity.sql').read_text();s19=(ROOT/'supabase/migrations/202611160019_alphabet_final_test.sql').read_text()
def body(source,name,delim):return re.search(r'create or replace function '+re.escape(name)+r'.*?as '+re.escape(delim)+r'(.*?)'+re.escape(delim)+r';',source,re.S|re.I)[1]
reader14=body(s14,'public.sl_get_progress()','$$');reader19=reader14
for a in ['caps','return']:
 before=re.search(r'old_'+a+r' constant text := \$old\$(.*?)\$old\$',s19,re.S)[1];after=re.search(r'new_'+a+r' constant text := \$new\$(.*?)\$new\$',s19,re.S)[1];assert reader19.count(before)==1;reader19=reader19.replace(before,after)
writer=body(s12,'public.sl_apply_event','$$');a=re.search(r'old_clause constant text := \$old\$(.*?)\$old\$',s14,re.S)[1];b=re.search(r'new_clause constant text := \$new\$(.*?)\$new\$',s14,re.S)[1];assert writer.count(a)==1;writer=writer.replace(a,b)
for text in [reader14,reader19,writer,body(s14,'sl_private.quiz_catalog()','$function$'),body(s19,'sl_private.quiz_catalog()','$function$')]:assert hashlib.md5(text.encode()).hexdigest() in sql
newreaders=[]
for name,reader in [('14',reader14),('19',reader19)]:
 cap=re.search('caps'+name+r' constant text := \$old\$(.*?)\$old\$',sql,re.S)[1];newcap=re.search(r'caps20 constant text := \$new\$(.*?)\$new\$',sql,re.S)[1];oldreturn=re.search(r'old_return constant text := \$old\$(.*?)\$old\$',sql,re.S)[1];replacement=re.search('return'+name+r' constant text := \$new\$(.*?)\$new\$',sql,re.S)[1]
 assert reader.count(cap)==reader.count(oldreturn)==1;upgraded=reader.replace(cap,newcap).replace(oldreturn,replacement);newreaders.append(upgraded)
 for bank in ['alphabet','greetings']:
  assert "'"+bank+"_final_v1'" in upgraded;assert upgraded.count('assessment:'+bank+'-final-v1')==1
 assert upgraded.count('s.user_id=a.user_id')==2 and upgraded.count("s.status='completed' and s.trusted_quiz")==2
 assert upgraded.count('s.questions @>')==2 and upgraded.count('::jsonb @> s.questions')==2
assert newreaders[0]==newreaders[1],'Different read models depending on installed base'
stripped=re.sub(r'--[^\n]*','',sql)
assert not re.search(r'\b(insert\s+into|update\s+public\.|delete\s+from|alter\s+table|drop\s+table|truncate)\b',stripped,re.I)
assert set(re.findall(r'create or replace function ([\w.]+)',stripped,re.I))=={'sl_private.quiz_catalog','sl_private.manifest'}
assert 'historical lesson reward reservation missing' in sql and sql.strip().endswith('commit;')
assert 'revoke all on function sl_private.quiz_catalog_before_020() from public,anon,authenticated' in sql
runpy.run_path(str(ROOT/'tests/alphabet-final-release.py'),run_name='__main__')
print('PASS: prepared cumulative 020 from reviewed 014/019; identical reader, 20+20 active / 13+11 archived, unchanged reward keys, no user DML; SQL NOT executed')
