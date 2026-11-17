"""Prepare (never execute) the reviewed lesson-1 bank + reader + manifest proposal."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
from check_supabase_manifest import current_manifest
ROOT=Path(__file__).resolve().parents[1]
source14=(ROOT/'supabase/migrations/202610190014_video_progress.sql').read_text()
source12=(ROOT/'supabase/migrations/202610180012_xp_integrity.sql').read_text()
def body(source,name,delimiter):
    return re.search(r'create or replace function '+re.escape(name)+r'.*?as '+re.escape(delimiter)+r'(.*?)'+re.escape(delimiter)+r';',source,re.S|re.I)[1]
old_catalog=body(source14,'sl_private.quiz_catalog()','$function$')
old_reader=body(source14,'public.sl_get_progress()','$$')
writer=body(source12,'public.sl_apply_event','$$')
old_clause=re.search(r'old_clause constant text := \$old\$(.*?)\$old\$',source14,re.S)[1]
new_clause=re.search(r'new_clause constant text := \$new\$(.*?)\$new\$',source14,re.S)[1]
assert writer.count(old_clause)==1
writer=writer.replace(old_clause,new_clause)
md5=lambda s:hashlib.md5(s.encode()).hexdigest()
if any(l.get('greetingsChapter') for l in json.loads((ROOT/'lessons.json').read_text())):
    raise SystemExit('019 is archived. Use scripts/build_greetings_release.py for cumulative 020; never rewrite 019.')
lesson=json.loads((ROOT/'lessons.json').read_text())[0]
final=lesson['pronunciationChapter']['finalTest']
assert final['id']=='alphabet-final-v1' and len(final['questions'])==20
catalog=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True))
bank=catalog['lesson:lesson-1']
assert len(bank['questions'])==33 and bank['reward']==35
manifest=current_manifest();assert manifest['lessons']['lesson-1']==20
sql="""-- REVIEW PROPOSAL ONLY. Never applied by this generator.
-- Atomic bank + read-model capability + manifest release; see ALPHABET_FINAL_TEST_RELEASE.md.
-- No user tables, historical sessions, events, scores, revisions, rewards or Auth are rewritten.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';

-- Fail closed on unreviewed installed functions; do not replace a custom writer/reader.
do $prerequisites$
begin
  if (select md5(prosrc) from pg_proc where oid='sl_private.quiz_catalog()'::regprocedure) is distinct from '@CATALOG_MD5@'
    or (select md5(prosrc) from pg_proc where oid='public.sl_get_progress()'::regprocedure) is distinct from '@READER_MD5@'
    or (select md5(prosrc) from pg_proc where oid='public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure) is distinct from '@WRITER_MD5@' then
    raise exception '019: unknown installed bank/reader/writer; independent review required';
  end if;
  if position('start_questions' in pg_get_functiondef('public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure))=0 then
    raise exception '019 requires the generation-aware 014 writer';
  end if;
  if exists(select 1 from public.sl_lessons l
      left join public.sl_quiz_results r on r.user_id=l.user_id and r.quiz_id='lesson:lesson-1'
      where l.lesson_id='lesson-1' and l.completed and not coalesce(r.rewarded,false))
    or exists(select 1 from public.sl_sessions s
      join public.sl_events e on e.user_id=s.user_id and e.session_id=s.id and e.xp_delta>0
      left join public.sl_quiz_results r on r.user_id=s.user_id and r.quiz_id='lesson:lesson-1'
      where s.quiz_id='lesson:lesson-1' and not coalesce(r.rewarded,false)) then
    raise exception '019: historical lesson reward reservation missing; review before release';
  end if;
end $prerequisites$;

-- Freeze the installed catalog privately; all other contexts remain exactly as installed.
do $preserve$
declare bank jsonb;
begin
  if to_regprocedure('sl_private.quiz_catalog_before_019()') is not null then
    raise exception '019: backup already exists; do not overwrite it';
  end if;
  bank:=sl_private.quiz_catalog();
  execute 'create function sl_private.quiz_catalog_before_019() returns jsonb '
    || 'language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select ' || quote_literal(bank::text) || '::jsonb');
end $preserve$;
revoke all on function sl_private.quiz_catalog_before_019() from public,anon,authenticated;

create or replace function sl_private.quiz_catalog() returns jsonb
language sql immutable security invoker set search_path='' as $function$
select jsonb_set(sl_private.quiz_catalog_before_019(),'{lesson:lesson-1}',
  (sl_private.quiz_catalog_before_019()->'lesson:lesson-1') || $alphabet_bank$@BANK@$alphabet_bank$::jsonb);
$function$;
revoke all on function sl_private.quiz_catalog() from public,anon,authenticated;

-- Preserve every old answer, every other context, and the existing reward identity.
do $bank_guard$
declare item record; q record; current_bank jsonb;
begin
  current_bank:=sl_private.quiz_catalog();
  for item in select * from jsonb_each(sl_private.quiz_catalog_before_019()) loop
    if item.key<>'lesson:lesson-1' then
      if current_bank->item.key is distinct from item.value then raise exception '019: unrelated quiz changed'; end if;
    else
      if current_bank->item.key->'reward' is distinct from item.value->'reward' then raise exception '019: reward changed'; end if;
      for q in select * from jsonb_each(item.value->'questions') loop
        if current_bank->item.key->'questions'->q.key is distinct from q.value then raise exception '019: historical answer changed'; end if;
      end loop;
    end if;
  end loop;
  if jsonb_array_length(current_bank->'lesson:lesson-1'->'start_questions')<>20 then raise exception '019: invalid active count'; end if;
end $bank_guard$;

-- Read-only per-bank result derived from immutable completed sessions.
-- The reward ledger stays lesson:lesson-1, and the old aggregate is not overwritten.
-- CREATE OR REPLACE through pg_get_functiondef preserves the existing signature,
-- SECURITY DEFINER/search_path, owner and ACL. The event writer is NOT changed.
do $reader_upgrade$
declare definition text;
  old_caps constant text := $old$'video_quizzes_v3'),$old$;
  new_caps constant text := $new$'video_quizzes_v3','alphabet_final_v1'),$new$;
  old_return constant text := $old$  return result;$old$;
  new_return constant text := $new$  result:=coalesce((select jsonb_set(result,'{state,quizResults,assessment:alphabet-final-v1}',
      jsonb_build_object('correct',best.correct,'total',20,
        'rewarded',coalesce((result #>> '{state,quizResults,lesson:lesson-1,rewarded}')::boolean,false)))
    from (select s.correct from public.sl_sessions s
      where s.user_id=a.user_id and s.quiz_id='lesson:lesson-1'
        and s.status='completed' and s.trusted_quiz
        and s.questions @> $final_questions$@START@$final_questions$::jsonb
        and $final_questions$@START@$final_questions$::jsonb @> s.questions
      order by s.correct desc,s.started_at desc limit 1) best),result);
  return result;$new$;
begin
  definition:=pg_get_functiondef('public.sl_get_progress()'::regprocedure);
  if (length(definition)-length(replace(definition,old_caps,'')))<>length(old_caps)
     or (length(definition)-length(replace(definition,old_return,'')))<>length(old_return) then
    raise exception '019: reader anchors differ; review required';
  end if;
  definition:=replace(replace(definition,old_caps,new_caps),old_return,new_return);
  execute definition;
end $reader_upgrade$;

-- Must be committed with the bank and capability: publishing only one side is unsafe.
create or replace function sl_private.manifest() returns jsonb
language sql immutable security invoker set search_path = '' as $function$
select $manifest$@MANIFEST@$manifest$::jsonb;
$function$;
commit;
"""
for marker,value in {'CATALOG_MD5':md5(old_catalog),'READER_MD5':md5(old_reader),'WRITER_MD5':md5(writer),'BANK':json.dumps(bank,ensure_ascii=False,indent=2),'START':json.dumps(bank['start_questions'],ensure_ascii=False,separators=(',',':')),'MANIFEST':json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)}.items():sql=sql.replace('@'+marker+'@',value)
assert not re.search(r'@[A-Z_]+@',sql)
(ROOT/'supabase/migrations/202611160019_alphabet_final_test.sql').write_text(sql)
app=ROOT/'app.js';app.write_text(re.sub(r"version:'static-[0-9a-f]+'", "version:'"+manifest['version']+"'",app.read_text()))
print('PREPARED ONLY:',manifest['version'],'; 20 active + 13 archived IDs; reward unchanged')
