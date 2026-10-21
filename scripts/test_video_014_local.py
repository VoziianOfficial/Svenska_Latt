#!/usr/bin/env python3
"""Focused 001-014 audit in a NEW disposable local cluster; no remote connection option."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import os
import shutil
import subprocess
import tempfile
import uuid

ROOT = Path(__file__).resolve().parents[1]


def main():
    for tool in ('initdb', 'pg_ctl', 'psql'):
        if not shutil.which(tool):
            raise SystemExit('Missing local dependency: ' + tool)
    env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
    work = Path(tempfile.mkdtemp(prefix='sl-video-014-', dir='/private/tmp'))
    data, socket = work / 'data', work / 'socket'
    socket.mkdir(mode=0o700)
    print('Disposable cluster: ' + str(work), flush=True)
    subprocess.run(['initdb', '-D', str(data), '-A', 'trust', '--no-locale', '--encoding=UTF8', '-U', 'postgres'],
                   env=env, check=True, stdout=(work / 'initdb.log').open('w'), stderr=subprocess.STDOUT)
    base = ['psql', '-X', '-h', str(socket), '-p', '55441', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=verbose']
    def query(text, check=True):
        result = subprocess.run(base + ['-At', '-c', text], env=env, text=True, capture_output=True)
        if check and result.returncode:
            raise RuntimeError(result.stderr)
        return result
    def file(path):
        result = subprocess.run(base + ['-f', str(ROOT / path)], env=env, text=True, capture_output=True)
        (work / (Path(path).name + '.log')).write_text(result.stdout + result.stderr)
        if result.returncode:
            raise RuntimeError(path + '\n' + result.stderr[-6000:])
        return result
    started = False
    try:
        subprocess.run(['pg_ctl', '-D', str(data), '-l', str(work / 'postgres.log'), '-o',
                        f"-k {socket} -p 55441 -c listen_addresses='' -c unix_socket_permissions=0700", '-w', 'start'],
                       env=env, check=True, capture_output=True)
        started = True
        file('supabase/tests/bootstrap_local.sql')
        for migration in sorted((ROOT / 'supabase/migrations').glob('*.sql')):
            if migration.name >= '202610190014':
                continue
            file(migration.relative_to(ROOT))
        # Only test helpers are extracted; never part of the production migration.
        helpers = (ROOT / 'supabase/tests/007_quiz_rewards.sql').read_text()
        helpers = helpers[helpers.index('create function public.test_quiz_event'):helpers.index('-- The test-only preparation helper')]
        query(helpers)
        query("create function public.test_xp_ok(v boolean,msg text) returns void language plpgsql as $$ begin if v is distinct from true then raise exception 'FAIL: %',msg;end if;raise notice 'PASS: %',msg;end $$;")
        result = file('supabase/tests/010_video_progress.sql')
        checks = result.stderr.count('PASS:')
        verified_before = file('supabase/checks/014_verification.sql').stdout
        # Unknown manual patches must fail atomically, leaving rows and ACL intact.
        for signature, marker in (
            ('public.sl_apply_event(uuid,bigint,jsonb)', 'Viewing is a reversible preference'),
            ('public.sl_get_progress()', 'All writers take this same lock')):
            definition = query(f"select pg_get_functiondef('{signature}'::regprocedure);").stdout
            assert marker in definition
            query(definition.replace(marker, marker + ' AUDIT-PROBE', 1))
            try:
                rejected = subprocess.run(base + ['-f', str(ROOT / 'supabase/migrations/202610190014_video_progress.sql')],
                                          env=env, text=True, capture_output=True)
                assert rejected.returncode and 'unknown ' in rejected.stderr and 'review required' in rejected.stderr
            finally:
                query(definition)
            checks += 1
        assert file('supabase/checks/014_verification.sql').stdout == verified_before
        checks += 1
        # Two complete five-question sessions compete for the same account reward.
        owner = '98000000-0000-0000-0000-000000000004'
        query(f"insert into auth.users(id,email) values('{owner}','video-race@example.invalid');")
        def auth(sql):
            return f"set role authenticated;select set_config('request.jwt.claim.sub','{owner}',false);" + sql
        sessions = [query(auth("select public.test_quiz_prepare('video:ur-hitta4',4);")).stdout.strip().splitlines()[-1] for _ in range(2)]
        def snapshot():
            return json.loads(query(auth('select public.sl_get_progress();')).stdout.strip().splitlines()[-1])
        revision = snapshot()['revision']
        events = [json.dumps({'type': 'session_finish', 'occurred_at': '2026-10-19T10:00:00Z', 'timezone': 'Europe/Stockholm', 'data': {'session_id': session}}) for session in sessions]
        ids = [str(uuid.uuid4()) for _ in sessions]
        def finish(i, rev):
            return auth(f"select public.sl_apply_event('{ids[i]}',{rev},'{events[i]}'::jsonb);")
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda i: query(finish(i, revision), False), range(2)))
        assert sorted(r.returncode for r in results) == [0, 1]
        failed = next(i for i, r in enumerate(results) if r.returncode)
        assert '40001' in results[failed].stderr
        retry = json.loads(query(finish(failed, snapshot()['revision'])).stdout.strip().splitlines()[-1])
        assert retry['quiz_result']['xp'] == 0
        assert snapshot()['state']['xp'] == 12
        replay = json.loads(query(finish(failed, revision)).stdout.strip().splitlines()[-1])
        assert replay['duplicate'] and snapshot()['state']['xp'] == 12
        checks += 3
        print(f'PASS: {checks} focused SQL checks; two-device 4/5 finishes, conflict retry and lost ACK pay exactly 12 XP', flush=True)
        summary = {'sql_checks': checks, 'migration': '202610190014_video_progress.sql', 'remote_connections': 0,
                   'concurrent_video_finish': True, 'verification_sql_valid': True}
        (work / 'summary.json').write_text(json.dumps(summary, indent=2))
    finally:
        if started:
            subprocess.run(['pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop'], env=env, check=True, capture_output=True)
        print('Stopped; retained logs: ' + str(work), flush=True)


if __name__ == '__main__':
    main()
