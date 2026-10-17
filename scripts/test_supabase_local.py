#!/usr/bin/env python3
"""Run Stage 1 SQL ONLY in a freshly created, disposable PostgreSQL cluster.

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
        for path in migrations:
            run_file(path)
        result = run_file(ROOT / 'supabase/tests/001_contract.sql')
        assertions = result.stderr.count('PASS:')

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

        # Ensure applying the new plan to legacy data stops BEFORE creating tables.
        sql('create database legacy_guard_test;')
        legacy_base = [x if x != 'postgres' or i != base.index('-d')+1 else 'legacy_guard_test' for i, x in enumerate(base)]
        subprocess.run(legacy_base + ['-c', 'create table public.learning_progress(user_id uuid,state jsonb);'], env=env, check=True, capture_output=True)
        guard = subprocess.run(legacy_base + ['-f', str(migrations[0])], env=env, text=True, capture_output=True)
        assert guard.returncode and 'Legacy learning_progress exists' in guard.stderr
        print('PASS: legacy installation guard prevents accidental mixed schemas', flush=True)
        (work / 'summary.json').write_text(json.dumps({'sql_assertions': assertions, 'concurrency_scenarios': 3,
            'legacy_guard': True, 'migrations': len(migrations), 'http_api_tested': False}, indent=2))
        print(f'PASS: {assertions} SQL assertions, 3 concurrency scenarios, legacy guard; no remote connection', flush=True)
    finally:
        if started:
            subprocess.run(['pg_ctl', '-D', str(data), '-m', 'immediate', '-w', 'stop'],
                           env=env, check=True, capture_output=True)
        print(f'Test cluster stopped. Logs retained at {work}', flush=True)


if __name__ == '__main__':
    main()
