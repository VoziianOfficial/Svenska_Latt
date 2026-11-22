#!/usr/bin/env python3
"""Execute 021 acceptance tests ONLY in a new disposable local PostgreSQL cluster.

No external connection arguments, SDK, Supabase CLI, credentials or TCP listener.
018/019/020 migration files are NEVER executed: a test fixture reconstructs the
reported 020 function bodies and verifies all four MD5 before executing 021.
Logs/data remain under /private/tmp; the cluster is stopped even on failure.
"""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from uuid import uuid4

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from check_supabase_manifest import read_manifest,current_manifest


def body(s,name,d):
    return re.search(r'create or replace function '+re.escape(name)+r'.*?as '+re.escape(d)+r'(.*?)'+re.escape(d)+r';',s,re.S|re.I)[1]


def literal(s,name,d):
    return re.search(name+r' constant text := '+re.escape(d)+r'(.*?)'+re.escape(d),s,re.S)[1]


def quote(s):
    return "'"+str(s).replace("'","''")+"'"


def main():
    if len(sys.argv)>1:
        raise SystemExit('No connection arguments accepted. This runner only creates its own local cluster.')
    for name in ['initdb','pg_ctl','psql']:
        if not shutil.which(name):
            raise SystemExit('Missing local dependency: '+name)
    work=Path(tempfile.mkdtemp(prefix='sl-pronouns-sql-',dir='/private/tmp'))
    data,sock=work/'data',work/'socket'
    sock.mkdir(mode=0o700)
    env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
    base=['psql','-X','-qAt','-h',str(sock),'-p','55481','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
    cases=[]
    started=False
    report=dict(date='2026-11-22',localOnly=True,tcpListener=False,productionConnected=False,
                productionSqlExecuted=False,migrations018019020Executed=False,workDirectory=str(work),cases=cases)
    observed=json.loads((ROOT/'supabase/baselines/020_installed_20261122.json').read_text())
    migration=(ROOT/'supabase/migrations/202611220021_pronouns.sql').read_text()
    new_version=current_manifest()['version']
    fixtures={}

    def sql(text,check=True):
        r=subprocess.run(base,input=text,text=True,capture_output=True,env=env)
        if check and r.returncode:
            raise RuntimeError(r.stderr[-5000:])
        return r

    def scalar(text):
        return sql(text).stdout.strip().splitlines()[-1]

    def obj(text):
        return json.loads(scalar(text))

    def run_file(path):
        r=sql(path.read_text(),False)
        (work/(path.name+'.log')).write_text(r.stdout+r.stderr)
        if r.returncode:
            raise RuntimeError(path.name+': '+r.stderr[-5000:])
        return r

    def check(label,condition,detail=None):
        cases.append(dict(name=label,passed=bool(condition),**({'detail':detail} if detail is not None else {})))
        if not condition:
            raise AssertionError(label+': '+str(detail))
        print('PASS: '+label,flush=True)

    def functions():
        return obj("""select jsonb_object_agg(v.name,jsonb_build_object('md5',md5(p.prosrc),
          'acl',p.proacl::text,'owner',p.proowner,'securityDefiner',p.prosecdef,'config',p.proconfig))
          from (values ('manifest','sl_private.manifest()'),('catalog','sl_private.quiz_catalog()'),
            ('reader','public.sl_get_progress()'),('writer','public.sl_apply_event(uuid,bigint,jsonb)')) v(name,sig)
          left join pg_proc p on p.oid=to_regprocedure(v.sig);""")

    def state():
        # All app/Auth/Storage rows, sorted independently of physical row order.
        tables=obj("select coalesce(jsonb_agg(jsonb_build_array(table_schema,table_name) order by table_schema,table_name),'[]') from information_schema.tables where table_schema in ('public','auth','storage') and table_type='BASE TABLE';")
        parts=[]
        for schema,name in tables:
            assert re.fullmatch('[a-z_0-9]+',schema+name)
            parts.append("select "+quote(schema+'.'+name)+" name,coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') rows from "+schema+'.'+name+' t')
        rows=obj('select jsonb_object_agg(name,rows) from ('+' union all '.join(parts)+') all_rows;')
        return dict(rows=rows,functions=functions(),backup=obj("select jsonb_build_object('catalog',to_regprocedure('sl_private.quiz_catalog_before_021()') is not null,'manifest',to_regprocedure('sl_private.manifest_before_021()') is not null);"))

    def auth(user,statement):
        return "set role authenticated;select set_config('request.jwt.claim.sub',"+quote(user)+",false);"+statement

    def progress(user):
        return obj(auth(user,'select public.sl_get_progress();'))

    def event(user,typ,payload,eid=None,rev=None,check_result=True):
        eid=eid or str(uuid4())
        if rev is None:
            rev=int(scalar('select revision from public.sl_accounts where user_id='+quote(user)+';'))
        request=dict(type=typ,occurred_at='2026-11-20T10:00:00Z',timezone='Europe/Stockholm',data=payload)
        command=auth(user,'select public.sl_apply_event('+quote(eid)+','+str(rev)+','+quote(json.dumps(request,ensure_ascii=False))+'::jsonb);')
        r=sql(command,check_result)
        return (json.loads(r.stdout.strip().splitlines()[-1]) if r.returncode==0 else r),dict(id=eid,revision=rev,request=request,command=command)

    def replay(receipt):
        return obj(receipt['command'])

    def bank(lesson):
        return obj('select sl_private.quiz_catalog()->'+quote('lesson:'+lesson)+';')

    def prepare(user,lesson,score,finish=False):
        b=bank(lesson)
        qs=b.get('start_questions') or [{'question_id':key} for key in sorted(b['questions'])[:b['count']]]
        sid=str(uuid4())
        start,receipt=event(user,'session_start',dict(session_id=sid,mode='lesson',context_id=lesson,content_version=progress(user)['content_version'],questions=qs))
        for i,q in enumerate(qs):
            event(user,'answer',dict(session_id=sid,question_index=i,response=b['questions'][q['question_id']]['answer'] if i<score else '__incorrect__'))
        if finish:
            result,finished=event(user,'session_finish',dict(session_id=sid))
            return sid,receipt,result,finished
        return sid,receipt

    def failed_migration(label,source,expected_error):
        before=state()
        r=sql(source,False)
        check(label+' raises expected error',r.returncode!=0 and expected_error in r.stderr,r.stderr[-500:] if r.returncode==0 or expected_error not in r.stderr else None)
        check(label+' rolls back all functions, backup and user rows',state()==before)
        (work/('failure-'+str(len(cases))+'.log')).write_text(r.stdout+r.stderr)

    try:
        subprocess.run(['initdb','-D',str(data),'-A','trust','--no-locale','--encoding=UTF8','-U','postgres'],env=env,check=True,stdout=(work/'initdb.log').open('w'),stderr=subprocess.STDOUT)
        subprocess.run(['pg_ctl','-D',str(data),'-l',str(work/'postgres.log'),'-o',f"-k {sock} -p 55481 -c listen_addresses='' -c unix_socket_permissions=0700",'-w','start'],env=env,check=True,capture_output=True,text=True)
        started=True
        run_file(ROOT/'supabase/tests/bootstrap_local.sql')
        # Establish empty disposable schema through 017 only; never execute 018–020.
        loaded=[]
        for p in sorted((ROOT/'supabase/migrations').glob('*.sql')):
            if p.name>='202611160018':
                continue
            run_file(p)
            loaded.append(p.name)
        report['bootstrapMigrations']=loaded
        s20=(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql').read_text()
        s14=(ROOT/'supabase/migrations/202610190014_video_progress.sql').read_text()
        reader14=body(s14,'public.sl_get_progress()','$$')
        reader20=reader14.replace(literal(s20,'caps14','$old$'),literal(s20,'caps20','$new$')).replace(literal(s20,'old_return','$old$'),literal(s20,'return14','$new$'))
        # Freeze the actual 014 catalog as the 020 backing fixture. This contains
        # archived answers and all unrelated contexts from the real schema.
        frozen=scalar('select sl_private.quiz_catalog();')
        sql("create function sl_private.quiz_catalog_before_020() returns jsonb language sql immutable security invoker set search_path='' as "+quote('select '+quote(frozen)+'::jsonb')+";revoke all on function sl_private.quiz_catalog_before_020() from public,anon,authenticated;")
        sql("create or replace function sl_private.quiz_catalog() returns jsonb language sql immutable security invoker set search_path='' as $fixture$"+body(s20,'sl_private.quiz_catalog()','$function$')+'$fixture$;')
        olddef=sql("select pg_get_functiondef('public.sl_get_progress()'::regprocedure);").stdout.strip()
        assert olddef.count(reader14)==1
        sql(olddef.replace(reader14,reader20))
        sql("create or replace function sl_private.manifest() returns jsonb language sql immutable security invoker set search_path='' as $fixture$"+body(s20,'sl_private.manifest()','$function$')+'$fixture$;')
        fingerprints={key:value['md5'] for key,value in functions().items()}
        check('Reconstructed 020 matches all four production-report MD5',fingerprints==observed['function_md5'],fingerprints)
        check('Reconstructed 020 content_version matches report',scalar("select sl_private.manifest()->>'version';")==observed['content_version'])
        report['verified020']=dict(contentVersion=observed['content_version'],functionMD5=fingerprints,source=observed['source'])
        for name,sig in [('manifest','sl_private.manifest()'),('catalog','sl_private.quiz_catalog()'),('reader','public.sl_get_progress()'),('writer','public.sl_apply_event(uuid,bigint,jsonb)')]:
            fixtures[name]=sql('select pg_get_functiondef('+quote(sig)+'::regprocedure);').stdout.strip()
        users=[str('a0210000-0000-4000-8000-'+str(i).zfill(12)) for i in range(1,6)]
        for i,user in enumerate(users):
            sql('insert into auth.users(id,email) values('+quote(user)+','+quote('pronouns-'+str(i)+'@example.invalid')+');')
            progress(user)
        old,unfinished,fresh,other,invalid=users
        # Real old server events, not fabricated completed-session rows.
        old_finishes=[]
        for lesson,n in [('lesson-1',20),('lesson-2',20),('lesson-3',11)]:
            _,_,result,finish=prepare(old,lesson,n,True)
            check('020 '+lesson+' fixture awards its original 35 XP',result['quiz_result']['xp']==35)
            old_finishes.append(finish)
        event(old,'mark_known',dict(word_id='v-arbeta'))
        event(old,'favorite_set',dict(word_id='v-arbeta',value=True))
        old_progress=progress(old)
        for lesson,n in [('lesson-1',20),('lesson-2',20),('lesson-3',11)]:
            qs=bank(lesson).get('start_questions') or [{'question_id':'q'+str(i)} for i in range(n)]
            sid=str(uuid4())
            _,receipt=event(unfinished,'session_start',dict(session_id=sid,mode='lesson',context_id=lesson,content_version=observed['content_version'],questions=qs))
            answer=bank(lesson)['questions'][qs[0]['question_id']]['answer']
            event(unfinished,'answer',dict(session_id=sid,question_index=0,response=answer))
            fixtures[lesson]=dict(id=sid,start=receipt,questions=qs)
        pre_catalog=obj('select sl_private.quiz_catalog();')
        before_upgrade=state()
        # An independently wrong body in each relevant installed function must fail closed.
        for name in ['manifest','catalog','reader','writer']:
            definition=fixtures[name]
            m=re.search(r'AS (\$[^$]*\$)',definition)
            delimiter=m[1]
            changed=definition.replace(delimiter,delimiter+'\n-- deliberate local MD5 drift\n',1)
            sql(changed)
            failed_migration('MD5 drift: '+name,migration,'installed functions differ from reviewed 020')
            sql(definition)
        # Explicit version/full-manifest guards are tested separately, after allowing
        # only the test copy's MD5 guard to recognize the intentionally drifted body.
        original_body=body(s20,'sl_private.manifest()','$function$')
        for label,new_body,error in [
            ('wrong content_version',original_body.replace(observed['content_version'],'static-deliberately-wrong'),'installed content_version differs'),
            ('wrong full manifest',original_body.replace('"lesson-3": 11','"lesson-3": 12'),'installed manifest differs')]:
            sql("create or replace function sl_private.manifest() returns jsonb language sql immutable security invoker set search_path='' as $drift$"+new_body+'$drift$;')
            # Actual 021 rejects it at MD5 before any writes.
            failed_migration(label+' actual guard',migration,'installed functions differ')
            test_copy=migration.replace(observed['function_md5']['manifest'],hashlib.md5(new_body.encode()).hexdigest(),1)
            failed_migration(label+' explicit predicate',test_copy,error)
            sql(fixtures['manifest'])
        sql('insert into public.sl_lessons(user_id,lesson_id,completed,best_percent) values('+quote(invalid)+",'lesson-3',true,100);")
        failed_migration('Missing historical reward reservation',migration,'historical lesson reward reservation missing')
        sql('delete from public.sl_lessons where user_id='+quote(invalid)+';')
        sql("create function sl_private.quiz_catalog_before_021() returns jsonb language sql immutable as $$select '{}'::jsonb$$;")
        failed_migration('Existing backup / accidental reapply',migration,'backup already exists')
        sql('drop function sl_private.quiz_catalog_before_021();')
        new_bank=json.loads(migration.split('$pronouns_bank$')[1])
        bad_bank=json.loads(json.dumps(new_bank));bad_bank['questions']['q0']['answer']='__changed_historical_answer__'
        changed=migration.replace(migration.split('$pronouns_bank$')[1],json.dumps(bad_bank,ensure_ascii=False,indent=2),1)
        failed_migration('Historical answer modified in candidate',changed,'historical answer changed')
        changed=migration.replace("select jsonb_set(sl_private.quiz_catalog_before_021(),'{lesson:lesson-3}',", "select jsonb_set(jsonb_set(sl_private.quiz_catalog_before_021(),'{lesson:lesson-1,reward}','999'::jsonb),'{lesson:lesson-3}',",1)
        failed_migration('Unrelated bank modified in candidate',changed,'unrelated quiz changed')
        changed=migration.rsplit('commit;',1)[0]+"do $$begin raise exception 'forced failure after manifest update';end$$;\ncommit;\n"
        failed_migration('Failure after catalog, reader and manifest replacement',changed,'forced failure after manifest update')
        check('All negative tests restore exact original 020 and all fixture rows',state()==before_upgrade)
        run_file(ROOT/'supabase/migrations/202611220021_pronouns.sql')
        after_upgrade=state()
        check('Successful 021 changes no user/Auth/Storage rows',after_upgrade['rows']==before_upgrade['rows'])
        post=json.loads((ROOT/'reports/pronouns/release-contract.json').read_text())
        check('Post-021 bodies match generated fingerprints',{k:v['md5'] for k,v in functions().items()}==post['expectedPostMD5'])
        for name in ['reader','writer']:
            a,b=before_upgrade['functions'][name],after_upgrade['functions'][name]
            check(name+' keeps ACL, owner, SECURITY DEFINER and search_path',all(a[k]==b[k] for k in ['acl','owner','securityDefiner','config']))
        check('Frozen 020 manifest and catalog match exact pre-upgrade values',obj('select sl_private.manifest_before_021();')==read_manifest(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql') and obj('select sl_private.quiz_catalog_before_021();')==pre_catalog)
        before_suffix=body((ROOT/'supabase/migrations/202610180012_xp_integrity.sql').read_text(),'public.sl_apply_event','$$').split("  elsif typ in ('answer','session_finish','session_abandon') then",1)[1]
        after_suffix=sql("select prosrc from pg_proc where oid='public.sl_apply_event(uuid,bigint,jsonb)'::regprocedure;").stdout.strip().split("  elsif typ in ('answer','session_finish','session_abandon') then",1)[1]
        check('Writer grading, receipt, ownership and XP logic remains byte-identical',before_suffix.strip()==after_suffix.strip())
        check('New manifest exactly matches static client',obj('select sl_private.manifest();')==current_manifest())
        check('Reader advertises both the new bank and verified-020 replay',all(c in progress(fresh)['capabilities'] for c in ['pronouns_final_v1','event_replay:'+observed['content_version']]))
        post_catalog=obj('select sl_private.quiz_catalog();')
        expected_catalog=json.loads(subprocess.check_output(['node',str(ROOT/'scripts/quiz_catalog.cjs')],cwd=ROOT,text=True))
        check('Entire server catalog equals the client-generated trusted bank',post_catalog==expected_catalog)
        check('Every other bank, including lesson-1/2, is unchanged',all(v==post_catalog[k] for k,v in pre_catalog.items() if k!='lesson:lesson-3'))
        check('Every historical lesson-3 ID and answer is unchanged',all(v==post_catalog['lesson:lesson-3']['questions'][k] for k,v in pre_catalog['lesson:lesson-3']['questions'].items()))
        check('Lesson-3 has 24 active and 11 archived questions',len(post_catalog['lesson:lesson-3']['start_questions'])==24 and len(post_catalog['lesson:lesson-3']['questions'])==35)
        check('Old XP, completions, SRS/favorites and all derived results are unchanged',progress(old)=={**old_progress,'content_version':new_version,'capabilities':progress(old)['capabilities']})
        failed_migration('A second real 021 application',migration,'installed functions differ from reviewed 020')
        postflight=run_file(ROOT/'supabase/checks/021_pronouns_postflight.sql')
        check('Manual read-only postflight reports all checks true',not re.search(r'(^|\|)f(\||$)',postflight.stdout,re.M))
        # Replaying any already acknowledged event returns the original receipt,
        # even after a content version change and with its old expected revision.
        old_state=progress(old)['state']
        for receipt in old_finishes:
            result=replay(receipt)
            check('Old finish receipt remains idempotent '+receipt['id'][-6:],result['duplicate'] and result['quiz_result']['xp']==35 and result['progress']['state']==old_state)
        for lesson in ['lesson-1','lesson-2','lesson-3']:
            f=fixtures[lesson]
            before=obj('select to_jsonb(s) from public.sl_sessions s where id='+quote(f['id'])+';')
            original_event=scalar('select request::text from public.sl_events where event_id='+quote(f['start']['id'])+';')
            result=replay(f['start'])
            check('Historical '+lesson+' start ACK replay keeps the same session',result['duplicate'] and obj('select to_jsonb(s) from public.sl_sessions s where id='+quote(f['id'])+';')==before)
            for i,q in enumerate(f['questions'][1:],1):
                event(unfinished,'answer',dict(session_id=f['id'],question_index=i,response=post_catalog['lesson:'+lesson]['questions'][q['question_id']]['answer']))
            result,receipt=event(unfinished,'session_finish',dict(session_id=f['id']))
            check('Historical '+lesson+' attempt finishes under 021 and awards once',result['quiz_result']['xp']==35 and scalar('select content_version from public.sl_sessions where id='+quote(f['id'])+';')==observed['content_version'])
            check('Historical '+lesson+' start request is never rewritten',scalar('select request::text from public.sl_events where event_id='+quote(f['start']['id'])+';')==original_event)
            again=replay(receipt)
            check('Historical '+lesson+' finish retry adds no XP',again['duplicate'] and again['progress']['state']['xp']==progress(unfinished)['state']['xp'])
        check('An old 11-question session does not create a new-bank result','assessment:pronouns-final-v1' not in progress(unfinished)['state']['quizResults'])
        # Boundary scores, canonical answer IDs and the lifetime reward ledger.
        for target,xp in [(19,0),(20,35),(24,35)]:
            sid,_,result,receipt=prepare(fresh,'lesson-3',target,True)
            check(str(target)+'/24 threshold and lifetime XP',result['quiz_result']['passed']==(target>=20) and result['progress']['state']['xp']==xp)
            check(str(target)+'/24 gets a separate versioned result',result['progress']['state']['quizResults']['assessment:pronouns-final-v1']['correct']==target and result['progress']['state']['quizResults']['assessment:pronouns-final-v1']['total']==24)
            with ThreadPoolExecutor(max_workers=2) as pool:
                replies=list(pool.map(lambda _:replay(receipt),range(2)))
            check(str(target)+'/24 concurrent lost-ACK retries reuse one receipt',all(r['duplicate'] for r in replies) and progress(fresh)['state']['xp']==xp)
        old_xp=progress(old)['state']['xp'];old_aggregate=progress(old)['state']['quizResults']['lesson:lesson-3']
        _,_,result,_=prepare(old,'lesson-3',24,True)
        check('New perfect pass never rewards an already rewarded old user',result['quiz_result']['xp']==0 and progress(old)['state']['xp']==old_xp)
        check('Historical 11/11 aggregate is preserved beside new 24/24',progress(old)['state']['quizResults']['lesson:lesson-3']==old_aggregate and progress(old)['state']['quizResults']['assessment:pronouns-final-v1']['correct']==24)
        for lesson in ['lesson-1','lesson-2']:
            check(lesson+' historical result is unchanged after new lesson-3',progress(old)['state']['quizResults']['lesson:'+lesson]==old_progress['state']['quizResults']['lesson:'+lesson] and progress(old)['state']['quizResults']['assessment:'+('alphabet' if lesson=='lesson-1' else 'greetings')+'-final-v1']==old_progress['state']['quizResults']['assessment:'+('alphabet' if lesson=='lesson-1' else 'greetings')+'-final-v1'])
        # A previously unacknowledged 020 request is accepted unchanged against
        # the frozen old bank; it cannot masquerade as a new 24-question attempt.
        offline_user=str(uuid4())
        sql('insert into auth.users(id,email) values('+quote(offline_user)+",'queued-020@example.invalid');")
        progress(offline_user)
        qs=fixtures['lesson-3']['questions'];queued_sid=str(uuid4())
        queued_payload=dict(session_id=queued_sid,mode='lesson',context_id='lesson-3',content_version=observed['content_version'],questions=qs)
        queued_result,queued_receipt=event(offline_user,'session_start',queued_payload)
        check('Previously unacknowledged 020 start replays its 11-question bank unchanged',queued_result['progress']['state']['xp']==0 and scalar('select content_version from public.sl_sessions where id='+quote(queued_sid)+';')==observed['content_version'])
        request_before=obj('select request from public.sl_events where event_id='+quote(queued_receipt['id'])+';')
        check('Accepted old request JSON equals original payload',request_before==queued_receipt['request'])
        for i,q in enumerate(qs):event(offline_user,'answer',dict(session_id=queued_sid,question_index=i,response=post_catalog['lesson:lesson-3']['questions'][q['question_id']]['answer']))
        queued_finish,queued_finish_receipt=event(offline_user,'session_finish',dict(session_id=queued_sid))
        check('Unacknowledged old-bank replay finishes and awards only its lifetime 35 XP',queued_finish['quiz_result']['xp']==35 and 'assessment:pronouns-final-v1' not in queued_finish['progress']['state']['quizResults'])
        check('Old queued finish lost ACK is deduplicated',replay(queued_finish_receipt)['duplicate'] and progress(offline_user)['state']['xp']==35)
        _,_,new_after_old,_=prepare(offline_user,'lesson-3',24,True)
        check('New 24-question pass after replayed 11-question pass awards no extra XP',new_after_old['quiz_result']['xp']==0 and progress(offline_user)['state']['xp']==35)
        # Reject mixed banks, stale unacknowledged starts and spoofed answer flags.
        active=post_catalog['lesson:lesson-3']['start_questions']
        for label,version,qs,error in [
            ('Unknown content version','static-unknown',active,'unsupported_content_version'),
            ('New bank forged under old 020 version',observed['content_version'],active,'context_question_count_mismatch'),
            ('11 old IDs in a new-version start',new_version,fixtures['lesson-3']['questions'],'context_question_count_mismatch'),
            ('Mixed archive and new IDs',new_version,[{'question_id':'q0'}]+active[1:],'quiz_bank_count_mismatch'),
            ('Duplicate question IDs',new_version,[active[0]]+active[:-1],'quiz_bank_count_mismatch')]:
            before=state()
            r,_=event(other,'session_start',dict(session_id=str(uuid4()),mode='lesson',context_id='lesson-3',content_version=version,questions=qs),check_result=False)
            check(label+' rejects atomically',r.returncode!=0 and error in r.stderr and state()==before)
        unfilled=str(uuid4())
        event(other,'session_start',dict(session_id=unfilled,mode='lesson',context_id='lesson-3',content_version=new_version,questions=active))
        before=state()
        r,_=event(other,'answer',dict(session_id=unfilled,question_index=0,response='o0',correct=True),check_result=False)
        check('Spoofed correct:true is rejected before the first answer',r.returncode!=0 and 'trusted_response_required' in r.stderr and state()==before)
        r,_=event(other,'session_finish',dict(session_id=unfilled),check_result=False)
        check('An incomplete attempt cannot finish or reserve XP',r.returncode!=0 and 'session_incomplete' in r.stderr and state()==before)
        sid,_=prepare(other,'lesson-3',0,False)
        # prepare creates a fully answered incorrect attempt; duplicate answer and
        # forged correct:true must both fail without modifying records.
        before=state()
        r,_=event(other,'answer',dict(session_id=sid,question_index=0,response='o0',correct=True),check_result=False)
        check('A client boolean cannot bypass trusted scoring',r.returncode!=0 and state()==before)
        r,_=event(other,'answer',dict(session_id=sid,question_index=0,response='o0'),check_result=False)
        check('A repeated answer with another UUID changes nothing',r.returncode!=0 and 'question_already_answered' in r.stderr and state()==before)
        before=state()
        r,_=event(invalid,'session_finish',dict(session_id=sid),check_result=False)
        check('Another account cannot finish a session or claim XP',r.returncode!=0 and 'active_own_session_required' in r.stderr and state()==before)
        race_sid,_=prepare(invalid,'lesson-3',20,False)
        race_rev=int(scalar('select revision from public.sl_accounts where user_id='+quote(invalid)+';'))
        race_event=dict(type='session_finish',occurred_at='2026-11-20T10:00:00Z',timezone='Europe/Stockholm',data=dict(session_id=race_sid))
        race_id=str(uuid4())
        race_command=auth(invalid,'select public.sl_apply_event('+quote(race_id)+','+str(race_rev)+','+quote(json.dumps(race_event))+'::jsonb);')
        with ThreadPoolExecutor(max_workers=2) as pool:
            race_results=list(pool.map(lambda _:obj(race_command),range(2)))
        check('Two concurrent first finishes commit exactly one 35-XP reward',sorted(r['duplicate'] for r in race_results)==[False,True] and progress(invalid)['state']['xp']==35)
        check('Answer catalog is inaccessible to authenticated clients',sql(auth(fresh,'select sl_private.quiz_catalog();'),False).returncode!=0)
        report.update(passed=True,assertions=len(cases),newContentVersion=new_version,
                      expectedPostMD5=post['expectedPostMD5'],sql021ExecutedOnlyInDisposableCluster=True,
                      queueBoundary='Acknowledged and unacknowledged verified 020 requests replay unchanged against the frozen 020 bank. Unknown versions and mixed generations fail closed; IndexedDB bytes/UUIDs tested separately.')
    except Exception as error:
        report.update(passed=False,error=str(error),assertions=len(cases))
        raise
    finally:
        if started:
            stopped=subprocess.run(['pg_ctl','-D',str(data),'-m','fast','-w','stop'],env=env,capture_output=True,text=True)
            report['clusterStopped']=stopped.returncode==0
        target=ROOT/'reports/pronouns/sql-tests.json'
        target.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print('Report: '+str(target),flush=True)
    print('PASS: '+str(len(cases))+' real PostgreSQL assertions; no production connection; 018/019/020 migration files never executed',flush=True)


if __name__=='__main__':
    main()
