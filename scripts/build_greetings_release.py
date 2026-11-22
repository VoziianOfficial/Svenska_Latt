"""Prepare ONLY: cumulative 020 bank/reader/manifest for reviewed 014 or 019 bases.
Does not connect to Supabase or execute SQL. Earlier proposals remain untouched.
"""
import hashlib,json,re,subprocess
from pathlib import Path
from check_supabase_manifest import current_manifest
ROOT=Path(__file__).resolve().parents[1]
if any(l.get('pronounsChapter') for l in json.loads((ROOT/'lessons.json').read_text())):
    raise SystemExit('020 is archived. Use scripts/build_pronouns_release.py for independent 021; never rewrite installed 020.')
def body(source,name,delim):return re.search(r'create or replace function '+re.escape(name)+r'.*?as '+re.escape(delim)+r'(.*?)'+re.escape(delim)+r';',source,re.S|re.I)[1]
s14=(ROOT/'supabase/migrations/202610190014_video_progress.sql').read_text();s12=(ROOT/'supabase/migrations/202610180012_xp_integrity.sql').read_text();s19=(ROOT/'supabase/migrations/202611160019_alphabet_final_test.sql').read_text()
reader14=body(s14,'public.sl_get_progress()','$$');reader19=reader14
for anchor in ['caps','return']:
 before=re.search(r'old_'+anchor+r' constant text := \$old\$(.*?)\$old\$',s19,re.S)[1];after=re.search(r'new_'+anchor+r' constant text := \$new\$(.*?)\$new\$',s19,re.S)[1];assert reader19.count(before)==1;reader19=reader19.replace(before,after)
writer=body(s12,'public.sl_apply_event','$$');before=re.search(r'old_clause constant text := \$old\$(.*?)\$old\$',s14,re.S)[1];after=re.search(r'new_clause constant text := \$new\$(.*?)\$new\$',s14,re.S)[1];assert writer.count(before)==1;writer=writer.replace(before,after)
md5=lambda s:hashlib.md5(s.encode()).hexdigest()
catalog=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],text=True));banks={k:catalog[k] for k in ['lesson:lesson-1','lesson:lesson-2']};manifest=current_manifest()
assert [b['count'] for b in banks.values()]==[20,20] and all(b['reward']==35 for b in banks.values())
assert [len(b['questions']) for b in banks.values()]==[33,31]
def derived(lesson,bank):
 f=json.loads((ROOT/'lessons.json').read_text())[int(lesson[-1])-1];f=(f.get('pronunciationChapter') or f['greetingsChapter'])['finalTest'];start=json.dumps(bank['start_questions'],separators=(',',':'))
 return f"""  result:=coalesce((select jsonb_set(result,'{{state,quizResults,{f['resultKey']}}}',
      jsonb_build_object('correct',best.correct,'total',20,
        'rewarded',coalesce((result #>> '{{state,quizResults,lesson:{lesson},rewarded}}')::boolean,false)))
    from (select s.correct from public.sl_sessions s
      where s.user_id=a.user_id and s.quiz_id='lesson:{lesson}'
        and s.status='completed' and s.trusted_quiz
        and s.questions @> $final_questions${start}$final_questions$::jsonb
        and $final_questions${start}$final_questions$::jsonb @> s.questions
      order by s.correct desc,s.started_at desc limit 1) best),result);
"""
alphabet=derived('lesson-1',banks['lesson:lesson-1']);greetings=derived('lesson-2',banks['lesson:lesson-2'])
cap14="'video_quizzes_v3'),";cap19="'video_quizzes_v3','alphabet_final_v1'),";cap20="'video_quizzes_v3','alphabet_final_v1','greetings_final_v1'),"
newreturn14=alphabet+greetings+'  return result;';newreturn19=greetings+'  return result;'
sql=f"""-- REVIEW PROPOSAL ONLY. Generated without connecting to or executing SQL.
-- Cumulative release for pending lesson-1 + lesson-2; known 014 or 019 bases only.
-- See docs/GREETINGS_INTRODUCTION_REVIEW.md. No historical user rows are changed.
begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
do $prerequisites$
begin
  if (select md5(prosrc) from pg_proc where oid='sl_private.quiz_catalog()'::regprocedure) not in
      ('{md5(body(s14,'sl_private.quiz_catalog()','$function$'))}','{md5(body(s19,'sl_private.quiz_catalog()','$function$'))}')
    or (select md5(prosrc) from pg_proc where oid='public.sl_get_progress()'::regprocedure) not in
      ('{md5(reader14)}','{md5(reader19)}')
    or (select md5(prosrc) from pg_proc where oid='public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure) is distinct from '{md5(writer)}' then
    raise exception '020: unknown installed bank/reader/writer; review required';
  end if;
  if exists(select 1 from public.sl_lessons l
      left join public.sl_quiz_results r on r.user_id=l.user_id and r.quiz_id='lesson:'||l.lesson_id
      where l.lesson_id in ('lesson-1','lesson-2') and l.completed and not coalesce(r.rewarded,false))
    or exists(select 1 from public.sl_sessions s
      join public.sl_events e on e.user_id=s.user_id and e.session_id=s.id and e.xp_delta>0
      left join public.sl_quiz_results r on r.user_id=s.user_id and r.quiz_id=s.quiz_id
      where s.quiz_id in ('lesson:lesson-1','lesson:lesson-2') and not coalesce(r.rewarded,false)) then
    raise exception '020: historical lesson reward reservation missing; review before release';
  end if;
end $prerequisites$;
do $preserve$
declare bank jsonb;
begin
  if to_regprocedure('sl_private.quiz_catalog_before_020()') is not null then
    raise exception '020: backup already exists; do not overwrite it';
  end if;
  bank:=sl_private.quiz_catalog();
  execute 'create function sl_private.quiz_catalog_before_020() returns jsonb '
    || 'language sql immutable security invoker set search_path='''''
    || ' as ' || quote_literal('select ' || quote_literal(bank::text) || '::jsonb');
end $preserve$;
revoke all on function sl_private.quiz_catalog_before_020() from public,anon,authenticated;
create or replace function sl_private.quiz_catalog() returns jsonb
language sql immutable security invoker set search_path='' as $function$
select jsonb_set(jsonb_set(sl_private.quiz_catalog_before_020(),'{{lesson:lesson-1}}',
  (sl_private.quiz_catalog_before_020()->'lesson:lesson-1') || $alphabet_bank${json.dumps(banks['lesson:lesson-1'],ensure_ascii=False,indent=2)}$alphabet_bank$::jsonb),
  '{{lesson:lesson-2}}',(sl_private.quiz_catalog_before_020()->'lesson:lesson-2') || $greetings_bank${json.dumps(banks['lesson:lesson-2'],ensure_ascii=False,indent=2)}$greetings_bank$::jsonb);
$function$;
revoke all on function sl_private.quiz_catalog() from public,anon,authenticated;
do $bank_guard$
declare item record; q record; current_bank jsonb;
begin
  current_bank:=sl_private.quiz_catalog();
  for item in select * from jsonb_each(sl_private.quiz_catalog_before_020()) loop
    if item.key not in ('lesson:lesson-1','lesson:lesson-2') then
      if current_bank->item.key is distinct from item.value then raise exception '020: unrelated quiz changed'; end if;
    else
      if current_bank->item.key->'reward' is distinct from item.value->'reward' then raise exception '020: reward changed'; end if;
      for q in select * from jsonb_each(item.value->'questions') loop
        if current_bank->item.key->'questions'->q.key is distinct from q.value then raise exception '020: historical answer changed'; end if;
      end loop;
      if jsonb_array_length(current_bank->item.key->'start_questions')<>20 then raise exception '020: invalid active count'; end if;
    end if;
  end loop;
end $bank_guard$;
-- Derived results only; lesson reward keys stay unchanged. Event writer is untouched.
do $reader_upgrade$
declare definition text; original text;
  caps14 constant text := $old${cap14}$old$;
  caps19 constant text := $old${cap19}$old$;
  caps20 constant text := $new${cap20}$new$;
  old_return constant text := $old$  return result;$old$;
  return14 constant text := $new${newreturn14}$new$;
  return19 constant text := $new${newreturn19}$new$;
  caps text; replacement text;
begin
  definition:=pg_get_functiondef('public.sl_get_progress()'::regprocedure);
  select prosrc into original from pg_proc where oid='public.sl_get_progress()'::regprocedure;
  if md5(original)='{md5(reader14)}' then caps:=caps14; replacement:=return14;
  elsif md5(original)='{md5(reader19)}' then caps:=caps19; replacement:=return19;
  else raise exception '020: reader base differs; review required'; end if;
  if (length(definition)-length(replace(definition,caps,'')))<>length(caps)
     or (length(definition)-length(replace(definition,old_return,'')))<>length(old_return) then
    raise exception '020: reader anchors differ; review required';
  end if;
  definition:=replace(replace(definition,caps,caps20),old_return,replacement);
  execute definition;
end $reader_upgrade$;
-- Bank + read capability + manifest must ship together, with the matching client.
create or replace function sl_private.manifest() returns jsonb
language sql immutable security invoker set search_path='' as $function$
select $manifest${json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True)}$manifest$::jsonb;
$function$;
commit;
"""
(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql').write_text(sql)
p=ROOT/'app.js';p.write_text(re.sub(r"version:'static-[a-f0-9]+'","version:'"+manifest['version']+"'",p.read_text()))
print('PREPARED ONLY:',manifest['version'],'; lesson-2 active 20 + archived 11; prior lesson-1 retained; no SQL executed')
