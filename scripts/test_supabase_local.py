#!/usr/bin/env python3
"""Run migration contracts ONLY in a freshly created, disposable PostgreSQL cluster.

No connection string argument, no TCP listener, no Supabase credentials/CLI.
Auth/Storage schema stubs are explicitly test-only. Does not test HTTP APIs.
Requires initdb, pg_ctl, psql in PATH (Homebrew PostgreSQL works).
"""
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]
USER = '10000000-0000-0000-0000-000000000003'


def main():
    for name in ('initdb', 'pg_ctl', 'psql'):
        if not shutil.which(name):
            raise SystemExit(f'Missing local test dependency: {name}')
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    # Keep logs, even on failure. Never reuse an existing cluster.
    work = Path(tempfile.mkdtemp(prefix='sl-sql-tests-', dir='/private/tmp' if Path('/private/tmp').exists() else None))
    data, sock = work / 'data', work / 'socket'
    sock.mkdir(mode=0o700)
    print(f'Isolated cluster and logs: {work}', flush=True)
    subprocess.run(['initdb', '-D', str(data), '-A', 'trust', '--no-locale',
                    '--encoding=UTF8', '-U', 'postgres'], env=env, check=True,
                   stdout=(work / 'initdb.log').open('w'), stderr=subprocess.STDOUT)
    base = ['psql', '-X', '-h', str(sock), '-p', '55439', '-U', 'postgres', '-d', 'postgres',
            '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']

    def sql(text, check=True):
        result = subprocess.run(base + ['-At', '-c', text], env=env, text=True, capture_output=True)
        if check and result.returncode:
            raise RuntimeError(result.stderr)
        return result

    def run_file(path):
        result = subprocess.run(base + ['-f', str(path)], env=env, text=True, capture_output=True)
        (work / (path.name + '.log')).write_text(result.stdout + result.stderr)
        if result.returncode:
            raise RuntimeError(f'{path.name}:\n{result.stderr[-6000:]}')
        print(f'PASS: {path.relative_to(ROOT)}', flush=True)
        return result

    def authenticated(statement):
        return (f"set role authenticated; select set_config('request.jwt.claim.sub','{USER}',false); "
                + statement)

    def event(kind, payload):
        return json.dumps({'type': kind, 'occurred_at': '2026-10-16T10:00:00Z',
                           'timezone': 'Europe/Stockholm', 'data': payload}, ensure_ascii=False)

    def apply(eid, rev, body):
        return authenticated(f"select public.sl_apply_event('{eid}',{rev},'{body}'::jsonb);")

    started = False
    try:
        subprocess.run(['pg_ctl', '-D', str(data), '-l', str(work / 'postgres.log'), '-o',
                        f"-k {sock} -p 55439 -c listen_addresses='' -c unix_socket_permissions=0700", '-w', 'start'],
                       env=env, check=True, capture_output=True, text=True)
        started = True
        run_file(ROOT / 'supabase/tests/bootstrap_local.sql')
        migrations = sorted((ROOT / 'supabase/migrations').glob('*.sql'))
        upgrade_assertions = 0
        for path in migrations:
            if path.name in ('202610180007_word_state.sql', '202610180008_study_time.sql', '202610180009_manual_review_queue.sql', '202610180011_study_time_default.sql', '202610180010_quiz_rewards.sql', '202610180012_xp_integrity.sql', '202610180013_srs_interval_cap.sql', '202610190014_video_progress.sql'):
                continue  # Old contract assertions run against the original six migrations.
            if path.name == '202610170006_manifest_version.sql':
                # The test applies 006 itself over fixtures in the five-migration
                # schema, captures all seven tables + function ACL, then checks
                # old/new clients and an unfinished historical session.
                upgrade = run_file(ROOT / 'supabase/tests/002_manifest_upgrade.sql')
                upgrade_assertions += upgrade.stderr.count('PASS:')
            else:
                run_file(path)
        result = run_file(ROOT / 'supabase/tests/001_contract.sql')
        study_upgrade = run_file(ROOT / 'supabase/tests/004_study_time.sql')
        upgrade_assertions += study_upgrade.stderr.count('PASS:')
        word_upgrade = run_file(ROOT / 'supabase/tests/003_word_state_upgrade.sql')
        review_upgrade = run_file(ROOT / 'supabase/tests/005_manual_review_queue.sql')
        upgrade_assertions += review_upgrade.stderr.count('PASS:')
        defaults_upgrade = run_file(ROOT / 'supabase/tests/006_study_time_default.sql')
        upgrade_assertions += defaults_upgrade.stderr.count('PASS:')
        assertions = result.stderr.count('PASS:') + upgrade_assertions + word_upgrade.stderr.count('PASS:')

        sql(f"insert into auth.users(id,email) values('{USER}','sl-concurrency@example.invalid');")
        body = event('mark_known', {'word_id': 'v-arbeta'})
        same = apply('60000000-0000-0000-0000-000000000001', 0, body)
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: sql(same, check=False), range(2)))
        assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
        assert '"duplicate": true' in ''.join(r.stdout for r in results)
        check = json.loads(sql(authenticated('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        assert check['state']['xp'] == 8 and check['revision'] == 1, check
        print('PASS: two connections retrying same UUID commit one reward', flush=True)

        bodies = [event('profile_update', {'name': 'Device A'}), event('profile_update', {'name': 'Device B'})]
        commands = [apply(f'60000000-0000-0000-0000-00000000000{i+2}', 1, b) for i, b in enumerate(bodies)]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda q: sql(q, check=False), commands))
        assert sorted(r.returncode for r in results) == [0, 1], [r.stderr for r in results]
        assert '40001' in ''.join(r.stderr for r in results)
        check = json.loads(sql(authenticated('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        assert check['revision'] == 2 and check['state']['profile']['name'] in ('Device A', 'Device B')
        print('PASS: simultaneous profile updates conflict; stale intent is not applied', flush=True)

        bodies = [event('mark_known', {'word_id': 'v-prata'}), event('mark_known', {'word_id': 'v-studera'})]
        commands = [apply(f'60000000-0000-0000-0000-00000000000{i+4}', 2, b) for i, b in enumerate(bodies)]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda q: sql(q, check=False), commands))
        assert sorted(r.returncode for r in results) == [0, 1], [r.stderr for r in results]
        failed = next(i for i, r in enumerate(results) if r.returncode)
        assert '40001' in results[failed].stderr
        sql(apply(f'60000000-0000-0000-0000-00000000000{failed+4}', 3, bodies[failed]))
        check = json.loads(sql(authenticated('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        assert check['revision'] == 4 and check['state']['xp'] == 24 and len(check['state']['known']) == 3, check
        print('PASS: explicit append-event rebase keeps both devices and exact XP', flush=True)

        # Account-wide study exclusivity and idempotence, with actual parallel connections.
        before_study = check
        sql(authenticated("select public.sl_study_settings(true,'Europe/Stockholm',0);"))
        lease_ids = [f'92000000-0000-0000-0000-00000000000{i}' for i in (1, 2)]
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda lid: sql(authenticated(f"select public.sl_study_open('{lid}');")), lease_ids))
        grants = [json.loads(r.stdout.strip().splitlines()[-1]) for r in results]
        assert sum(g['available'] for g in grants) == 1, grants
        lease = next(g for g in grants if g['available'])
        print('PASS: two devices claim concurrently; only one account-wide study lease', flush=True)
        sql('select pg_sleep(0.04);')
        segments = json.dumps([[lease['cursor_ms'], lease['cursor_ms'] + 10]])
        def study_commit(eid):
            return authenticated(f"select public.sl_study_commit('{eid}','{lease['id']}','{segments}');")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda i: sql(study_commit(f'93000000-0000-0000-0000-00000000000{i}'),check=False), (1, 2)))
        assert sorted(r.returncode for r in results) == [0, 1], [r.stderr for r in results]
        assert '22023' in ''.join(r.stderr for r in results)
        segments = json.dumps([[lease['cursor_ms'] + 10, lease['cursor_ms'] + 20]])
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: sql(study_commit('93000000-0000-0000-0000-000000000003')), range(2)))
        assert all(r.returncode == 0 for r in results)
        study = json.loads(sql(authenticated('select public.sl_study_status();')).stdout.strip().splitlines()[-1])
        assert study['totals']['all'] == 20, study
        after_study = json.loads(sql(authenticated('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        assert before_study == after_study, (before_study, after_study)
        print('PASS: overlapping parallel periods rejected, same UUID is idempotent, XP/progress unchanged', flush=True)

        # Manual queue: real competing connections, including simultaneous grading.
        def queue_change(request_id, action, version=None):
            expected = 'null' if version is None else f"'{version}'"
            command = authenticated(f"select public.sl_review_change('{request_id}','v-arbeta','{action}',{expected});")
            return json.loads(sql(command).stdout.strip().splitlines()[-1])
        add_id = '94000000-0000-0000-0000-000000000001'
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda _: queue_change(add_id, 'add'), range(2)))
        assert sum(r['duplicate'] for r in responses) == 1
        assert all(len(r['queue']['entries']) == 1 for r in responses)
        print('PASS: concurrent queue UUID retries produce one durable entry', flush=True)
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda i: queue_change(f'94000000-0000-0000-0000-00000000000{i}', 'add'), (2, 3)))
        assert all(not r['conflict'] and len(r['queue']['entries']) == 1 for r in responses)
        print('PASS: simultaneous adds with different UUIDs cannot duplicate a word', flush=True)
        before_grade = json.loads(sql(authenticated('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        with ThreadPoolExecutor(max_workers=2) as pool:
            responses = list(pool.map(lambda i: queue_change(f'94000000-0000-0000-0000-00000000000{i}', 'remember', add_id), (4, 5)))
        assert sum(r['conflict'] for r in responses) == 1
        assert all(not r['queue']['entries'][0]['active'] for r in responses)
        after_grade = json.loads(sql(authenticated('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        assert after_grade['revision'] == before_grade['revision'] + 1
        assert after_grade['state']['xp'] == before_grade['state']['xp']
        assert after_grade['state']['known'] == before_grade['state']['known']
        print('PASS: two devices grading same queue version commit exactly one SRS event', flush=True)

        # Upgrade only after the original-contract tests, preserving their historical expectations.
        quiz = run_file(ROOT / 'supabase/tests/007_quiz_rewards.sql')
        assertions += quiz.stderr.count('PASS:')
        # Two fully answered attempts, real concurrent finish requests, same account.
        quiz_user = '95000000-0000-0000-0000-000000000001'
        def quiz_sql(statement):
            return (f"set role authenticated; select set_config('request.jwt.claim.sub','{quiz_user}',false); " + statement)
        # Preparation helper is installed only in the disposable test database.
        sessions = [sql(quiz_sql("select public.test_quiz_prepare('lesson:lesson-8',10);")).stdout.strip().splitlines()[-1] for _ in range(2)]
        rev = json.loads(sql(quiz_sql('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])['revision']
        finish_bodies = [event('session_finish', {'session_id': sid}) for sid in sessions]
        finish_ids = ['95000000-0000-0000-0000-000000000010','95000000-0000-0000-0000-000000000011']
        def finish(i, revision):
            body = finish_bodies[i].replace("'", "''")
            return quiz_sql(f"select public.sl_apply_event('{finish_ids[i]}',{revision},'{body}'::jsonb);")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda i: sql(finish(i, rev), check=False), range(2)))
        assert sorted(r.returncode for r in results) == [0, 1], [r.stderr for r in results]
        failed = next(i for i, r in enumerate(results) if r.returncode)
        assert '40001' in results[failed].stderr
        sql(finish(failed, rev+1))
        check = json.loads(sql(quiz_sql('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        assert check['state']['xp'] == 35, check
        # Same UUID and original expected revision recovers the original reward receipt.
        receipt = json.loads(sql(finish(0, rev)).stdout.strip().splitlines()[-1])
        assert receipt['duplicate'] is True
        assert sql(f"select sum(xp_delta) from public.sl_events where user_id='{quiz_user}' and event_type='session_finish';").stdout.strip() == '35'
        print('PASS: simultaneous quiz finishes on two devices: conflict, safe retry, exactly one 35 XP reward', flush=True)

        srs = run_file(ROOT / 'supabase/tests/009_srs_interval_cap.sql')
        assertions += srs.stderr.count('PASS:')
        integrity = run_file(ROOT / 'supabase/tests/008_xp_integrity.sql')
        assertions += integrity.stderr.count('PASS:')
        srs_after_012 = run_file(ROOT / 'supabase/tests/helpers/srs_boundary_cases.sql')
        assertions += srs_after_012.stderr.count('PASS:')
        integrity_races = 0
        integrity_user = '97000000-0000-0000-0000-000000000004'
        def integrity_sql(statement):
            return (f"set role authenticated; select set_config('request.jwt.claim.sub','{integrity_user}',false); " + statement)
        def integrity_progress():
            return json.loads(sql(integrity_sql('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        def integrity_race(kind, payload, same_id=False, second_kind=None, second_payload=None):
            nonlocal integrity_races
            revision = integrity_progress()['revision']
            body = event(kind, payload).replace("'", "''")
            second_body = event(second_kind or kind, second_payload or payload).replace("'", "''")
            ids = [str(uuid.uuid4()), str(uuid.uuid4())]
            if same_id:
                ids[1] = ids[0]
            def command(i, rev):
                return integrity_sql(f"select public.sl_apply_event('{ids[i]}',{rev},'{[body,second_body][i]}'::jsonb);")
            with ThreadPoolExecutor(max_workers=2) as pool:
                results = list(pool.map(lambda i: sql(command(i, revision), check=False), (0, 1)))
            if same_id:
                assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
                assert sum(json.loads(r.stdout.strip().splitlines()[-1])['duplicate'] for r in results) == 1
            else:
                assert sorted(r.returncode for r in results) == [0, 1], [r.stderr for r in results]
                assert '40001' in ''.join(r.stderr for r in results)
                failed = next(i for i, r in enumerate(results) if r.returncode)
                sql(command(failed, revision+1))
            integrity_races += 1
        integrity_race('mark_known', {'word_id': 'v-arbeta'}, same_id=True)
        assert integrity_progress()['state']['xp'] == 8
        integrity_race('unmark_known', {'word_id': 'v-arbeta'})
        integrity_race('flash_grade', {'word_id': 'v-arbeta', 'correct': True})
        assert integrity_progress()['state']['xp'] == 8
        integrity_race('flash_grade', {'word_id': 'v-prata', 'correct': False})
        assert integrity_progress()['state']['xp'] == 8
        integrity_race('video_set', {'content_id': 'v1', 'value': True})
        integrity_race('video_set', {'content_id': 'v1', 'value': False})
        integrity_race('video_set', {'content_id': 'v1', 'value': True})
        assert integrity_progress()['state']['xp'] == 8
        integrity_race('book_read', {'content_id': 'book-1'})
        assert integrity_progress()['state']['xp'] == 28
        # Different event types share the same once-per-word entitlement.
        integrity_race('mark_known', {'word_id': 'v-studera'}, second_kind='flash_grade', second_payload={'word_id': 'v-studera', 'correct': True})
        integrity_race('flash_grade', {'word_id': 'v-studera', 'correct': True})
        assert integrity_progress()['state']['xp'] == 36
        print(f'PASS: {integrity_races} post-012 concurrent UUID/revision/word/video/book scenarios', flush=True)
        # Exercise the full quiz concurrency test again with 012 installed.
        post012_sessions = [sql(quiz_sql("select public.test_quiz_prepare('lesson:lesson-9',200);")).stdout.strip().splitlines()[-1] for _ in range(2)]
        before012 = json.loads(sql(quiz_sql('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        bodies012 = [event('session_finish', {'session_id': sid}).replace("'", "''") for sid in post012_sessions]
        ids012 = [str(uuid.uuid4()), str(uuid.uuid4())]
        def finish012(i, revision):
            return quiz_sql(f"select public.sl_apply_event('{ids012[i]}',{revision},'{bodies012[i]}'::jsonb);")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda i: sql(finish012(i, before012['revision']), check=False), (0, 1)))
        assert sorted(r.returncode for r in results) == [0, 1], [r.stderr for r in results]
        failed = next(i for i, r in enumerate(results) if r.returncode)
        sql(finish012(failed, before012['revision']+1))
        after012 = json.loads(sql(quiz_sql('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        assert after012['state']['xp'] == before012['state']['xp'] + 35
        replay012 = json.loads(sql(finish012(0, before012['revision'])).stdout.strip().splitlines()[-1])
        assert replay012['duplicate'] is True
        integrity_races += 1
        print('PASS: post-012 concurrent quiz finishes and lost ACK still pay exactly one reward', flush=True)

        # Exercise BOTH exact ordered upgrade paths in separate fresh databases.
        ordered_scenarios = {}
        public_rpc_catalog = """select coalesce(jsonb_agg(jsonb_build_object(
            'name',p.proname,'args',pg_get_function_identity_arguments(p.oid),
            'result',pg_get_function_result(p.oid),'definer',p.prosecdef,
            'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),
            'anon',has_function_privilege('anon',p.oid,'execute'),
            'authenticated',has_function_privilege('authenticated',p.oid,'execute'))
            order by p.proname,pg_get_function_identity_arguments(p.oid)),'[]'::jsonb)
            from pg_proc p join pg_namespace n on n.oid=p.pronamespace
            where n.nspname='public' and left(p.proname,3)='sl_'"""
        for db_name, manual_patch in (('clean_install_test', False), ('manual_patch_upgrade_test', True)):
            sql(f'create database {db_name};')
            ordered_base = [x if i != base.index('-d')+1 else db_name for i, x in enumerate(base)]

            def ordered_sql(statement):
                r = subprocess.run(ordered_base + ['-At', '-c', statement], env=env, text=True, capture_output=True)
                assert r.returncode == 0, r.stderr[-6000:]
                return r.stdout.strip()

            def ordered_file(path, extra_args=()):
                r = subprocess.run(ordered_base + list(extra_args) + ['-f', str(ROOT / path)],
                                   env=env, text=True, capture_output=True)
                (work / (db_name + '-' + Path(path).name + '.log')).write_text(r.stdout + r.stderr)
                assert r.returncode == 0, r.stderr[-6000:]
                return r.stderr.count('PASS:')

            bootstrap = (ROOT / 'supabase/tests/bootstrap_local.sql').read_text()
            bootstrap = '\n'.join(line for line in bootstrap.splitlines() if not line.startswith('create role '))
            ordered_sql(bootstrap)
            for path in migrations:
                if path.name >= '202610180012':
                    continue
                ordered_file(path.relative_to(ROOT))
            for signature in ('public.test_quiz_event(text,jsonb,uuid)', 'public.test_quiz_prepare(text,integer)'):
                ordered_sql(sql(f"select pg_get_functiondef('{signature}'::regprocedure);").stdout)
            ordered_file('supabase/tests/helpers/upgrade_queue_fixture.sql')
            before_rpc = ordered_sql(public_rpc_catalog)
            review_definition = None
            if manual_patch:
                ordered_file('supabase/patches/srs_interval_cap.sql')
                review_definition = ordered_sql("select pg_get_functiondef('sl_private.review(uuid,text,boolean,timestamptz)'::regprocedure)")
                assertions += ordered_file('supabase/tests/helpers/srs_boundary_cases.sql')
            # 008 captures ALL current rows, installs exactly 012, checks preservation
            # and runs the XP/import/UUID/RLS/113-quiz assertions.
            count = ordered_file('supabase/tests/008_xp_integrity.sql')
            assert ordered_sql(public_rpc_catalog) == before_rpc, '012 changed a public RPC contract'
            if manual_patch:
                assert ordered_sql("select pg_get_functiondef('sl_private.review(uuid,text,boolean,timestamptz)'::regprocedure)") == review_definition
                count += ordered_file('supabase/tests/helpers/srs_boundary_cases.sql')
            # Skip the optional patch in 009: these are exact 012 -> 013 paths.
            count += ordered_file('supabase/tests/009_srs_interval_cap.sql', ('-v', 'srs_skip_manual_patch=true'))
            assert ordered_sql(public_rpc_catalog) == before_rpc, '013 changed a public RPC contract'
            count += ordered_file('supabase/tests/helpers/post_upgrade_rpc_cases.sql')
            assertions += count
            ordered_scenarios[db_name] = {'manual_patch_before_012': manual_patch,
                'sql_assertions': count, 'public_rpc_contracts_preserved': True,
                'srs_preserved_through_012': manual_patch}
            label = '001-011 -> manual patch -> 012 -> 013 -> 013' if manual_patch else '001-011 -> 012 -> 013 -> 013'
            print(f'PASS: {label}; populated queue/events preserved; public RPC signatures/ACL unchanged', flush=True)

        video = run_file(ROOT / 'supabase/tests/010_video_progress.sql')
        assertions += video.stderr.count('PASS:')

        # Ensure applying the new plan to legacy data stops BEFORE creating tables.
        sql('create database legacy_guard_test;')
        legacy_base = [x if x != 'postgres' or i != base.index('-d')+1 else 'legacy_guard_test' for i, x in enumerate(base)]
        subprocess.run(legacy_base + ['-c', 'create table public.learning_progress(user_id uuid,state jsonb);'], env=env, check=True, capture_output=True)
        guard = subprocess.run(legacy_base + ['-f', str(migrations[0])], env=env, text=True, capture_output=True)
        assert guard.returncode and 'Legacy learning_progress exists' in guard.stderr
        print('PASS: legacy installation guard prevents accidental mixed schemas', flush=True)
        (work / 'summary.json').write_text(json.dumps({'sql_assertions': assertions, 'concurrency_scenarios': 10 + integrity_races,
            'legacy_guard': True, 'migrations': len(migrations), 'http_api_tested': False,
            'ordered_scenarios': ordered_scenarios}, indent=2))
        print(f'PASS: {assertions} SQL assertions, {10 + integrity_races} concurrency scenarios, legacy guard; no remote connection', flush=True)
    finally:
        if started:
            subprocess.run(['pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop'],
                           env=env, check=True, capture_output=True)
        print(f'Test cluster stopped. Logs retained at {work}', flush=True)


if __name__ == '__main__':
    main()
