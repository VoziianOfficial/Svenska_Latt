#!/usr/bin/env python3
"""Prepared real-HTTP acceptance tests. OFF unless --run is explicitly supplied.

Run ONLY after separate approval, on a new disposable Supabase test project with
the five migrations and two NEW confirmed test users. Writes fixtures; no cleanup
of accounts or SQL. Needs no SDK, DB password, service_role or secret key.
Passwords/tokens stay in memory, never in command arguments or saved reports.
"""
import argparse
import base64
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from getpass import getpass
import json
import re
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import HTTPRedirectHandler, Request, build_opener
from uuid import uuid4

TABLES = ('sl_accounts', 'sl_words', 'sl_sessions', 'sl_lessons', 'sl_content', 'sl_events', 'sl_imports')
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


class API:
    def __init__(self, url, key, token=None, uid=None):
        self.url, self.key, self.token, self.uid = url, key, token, uid

    def call(self, method, path, body=None, mime='application/json'):
        headers = {'apikey': self.key, 'Content-Type': mime}
        if self.token:
            headers['Authorization'] = 'Bearer ' + self.token
        raw = body if isinstance(body, bytes) else (json.dumps(body).encode() if body is not None else None)
        request = Request(self.url + path, data=raw, headers=headers, method=method)
        try:
            with build_opener(NoRedirect).open(request, timeout=30) as response:
                status, raw = response.status, response.read()
        except HTTPError as exc:
            status, raw = exc.code, exc.read()
        try:
            data = json.loads(raw)
        except (ValueError, UnicodeDecodeError):
            data = raw
        return status, data

    def rpc(self, name, body=None):
        return self.call('POST', '/rest/v1/rpc/' + name, body or {})

    def progress(self):
        status, data = self.rpc('sl_get_progress')
        require(status == 200 and isinstance(data, dict) and 'revision' in data, 'get_progress via real JWT')
        return data


def require(value, label):
    if not value:
        # Deliberately omit HTTP bodies, email addresses, tokens and URLs.
        raise RuntimeError('FAIL: ' + label)


def passed(label):
    print('PASS: ' + label, flush=True)


def error_code(result, code):
    status, data = result
    return status >= 400 and isinstance(data, dict) and data.get('code') == code


def storage_denied(result):
    status, data = result
    # Storage sometimes wraps a 403/404 in an HTTP 400. Never accept 5xx as PASS.
    wrapped = str(data.get('statusCode', '')) if isinstance(data, dict) else ''
    code = data.get('code') if isinstance(data, dict) else None
    return status in (403, 404) or (status == 400 and
        (wrapped in ('403', '404') or code in ('AccessDenied', 'NoSuchKey', 'NoSuchBucket')))


def event(kind, payload):
    return {'type': kind, 'data': payload,
            'occurred_at': datetime.now(timezone.utc).isoformat(), 'timezone': 'Europe/Stockholm'}


def request_event(client, eid, revision, body):
    return client.rpc('sl_apply_event', {'p_event_id': eid, 'p_expected_revision': revision, 'p_event': body})


def apply(client, kind, payload):
    body, eid = event(kind, payload), str(uuid4())
    result = request_event(client, eid, client.progress()['revision'], body)
    require(result[0] == 200, 'apply ' + kind)
    return result[1]


def login(url, key, label):
    email = input(f'Test user {label} email (local terminal only): ').strip()
    password = getpass(f'Test user {label} password (hidden): ')
    return login_credentials(url, key, email, password)


def login_credentials(url, key, email, password):
    api = API(url, key)
    status, data = api.call('POST', '/auth/v1/token?grant_type=password', {'email': email, 'password': password})
    require(status == 200 and isinstance(data, dict) and data.get('access_token'), 'confirmed test-user login')
    client = API(url, key, data['access_token'], data['user']['id'])
    status, verified = client.call('GET', '/auth/v1/user')
    require(status == 200 and verified.get('id') == client.uid, 'Auth validates user token')
    return client, email, password


def run():
    url = input('Disposable Supabase test Project URL: ').strip().rstrip('/')
    match = re.fullmatch(r'https://([a-z0-9-]+)\.supabase\.co', url)
    require(match is not None, 'official HTTPS project URL required')
    key = getpass('PUBLIC sb_publishable_ key (hidden to keep terminal clean): ').strip()
    require(key.startswith('sb_publishable_') and len(key) > 20, 'only publishable key accepted; no secrets/legacy JWT keys')
    print('This will WRITE test fixtures via Auth, PostgREST and Storage. Use new test users only.')
    require(input('Type RUN TESTS ' + match[1] + ' to confirm this project: ') == 'RUN TESTS ' + match[1], 'project confirmation')
    a, email_a, password_a = login(url, key, 'A')
    b, _, _ = login(url, key, 'B')
    a2, _, _ = login_credentials(url, key, email_a, password_a)
    del email_a, password_a
    require(a.uid != b.uid and a.uid == a2.uid, 'two users plus second device session for A')
    anon = API(url, key)
    for client in (a, b):
        snapshot = client.progress()
        require(snapshot['revision'] == 0 and snapshot['state']['xp'] == 0, 'fresh disposable user')
        for table in TABLES[1:]:
            status, rows = client.call('GET', f'/rest/v1/{table}?select=user_id&limit=1')
            require(status == 200 and rows == [], 'fresh fixture tables')
    passed('Auth login: A, B and second session A2')

    require(error_code(anon.rpc('sl_get_progress'), '42501'), 'anonymous RPC denied')
    require(error_code(anon.call('GET', '/rest/v1/sl_accounts?select=user_id'), '42501'), 'anonymous table denied')
    passed('anonymous access denied with public key')

    eid, body = str(uuid4()), event('mark_known', {'word_id': 'v-arbeta'})
    first = request_event(a, eid, 0, body)
    duplicate = request_event(a2, eid, 0, body)
    require(first[0] == 200 and duplicate[0] == 200 and duplicate[1]['duplicate'], 'same event retry')
    require(a.progress()['state']['xp'] == 8 and a.progress()['revision'] == 1, 'one XP reward and revision')
    changed = event('mark_known', {'word_id': 'v-prata'})
    require(error_code(request_event(a, eid, 1, changed), '22023'), 'same UUID different body rejected')
    passed('RPC idempotency across A/A2: XP=8 once')

    rev = a.progress()['revision']
    commands = [(a, str(uuid4()), event('profile_update', {'name': 'Stage2 device A'})),
                (a2, str(uuid4()), event('profile_update', {'name': 'Stage2 device A2'}))]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda item: request_event(item[0], item[1], rev, item[2]), commands))
    require(sum(r[0] == 200 for r in results) == 1 and sum(error_code(r, '40001') for r in results) == 1,
            'one concurrent intent accepted; one revision conflict')
    require(a.progress()['revision'] == rev + 1 and a.progress()['state']['xp'] == 8, 'conflict has no extra effects')
    passed('two real sessions: stale profile update rejected')

    rev = a.progress()['revision']
    commands = [(a, str(uuid4()), event('mark_known', {'word_id': 'v-prata'})),
                (a2, str(uuid4()), event('mark_known', {'word_id': 'v-studera'}))]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda item: request_event(item[0], item[1], rev, item[2]), commands))
    require(sum(r[0] == 200 for r in results) == 1 and sum(error_code(r, '40001') for r in results) == 1, 'learning conflict')
    failed = next(i for i, result in enumerate(results) if error_code(result, '40001'))
    client, retry_id, retry_body = commands[failed]
    require(request_event(client, retry_id, client.progress()['revision'], retry_body)[0] == 200, 'explicit learning rebase')
    require(a.progress()['state']['xp'] == 24 and len(a.progress()['state']['known']) == 3, 'both devices retained with exact XP')
    passed('learning rebase preserves both devices without duplicate XP')

    sid = str(uuid4())
    apply(a, 'session_start', {'session_id': sid, 'mode': 'lesson', 'context_id': 'lesson-1',
          'content_version': a.progress()['content_version'], 'questions': [{} for _ in range(13)]})
    for idx in range(13):
        apply(a, 'answer', {'session_id': sid, 'question_index': idx, 'correct': True})
    duplicate_answer = request_event(a, str(uuid4()), a.progress()['revision'],
                                    event('answer', {'session_id': sid, 'question_index': 0, 'correct': True}))
    require(error_code(duplicate_answer, '23505'), 'second UUID cannot answer same question again')
    apply(a, 'session_finish', {'session_id': sid})
    apply(a, 'book_read', {'content_id': 'book-1'})
    require(a.progress()['state']['xp'] == 235, 'answers +156, lesson +35, book +20')
    imported = a.rpc('sl_import_progress', {'p_import_id': str(uuid4()), 'p_expected_revision': a.progress()['revision'],
                     'p_source_id': str(uuid4()), 'p_state': {'stage2_test': str(uuid4())}, 'p_mode': 'archive_only'})
    require(imported[0] == 200 and a.progress()['state']['xp'] == 235, 'archive does not award XP')
    apply(b, 'mark_known', {'word_id': 'v-jobba'})
    for table in TABLES:
        query = f'/rest/v1/{table}?select=user_id&user_id=eq.{a.uid}'
        own_status, own = a.call('GET', query)
        foreign_status, foreign = b.call('GET', query)
        require(own_status == 200 and isinstance(own, list) and len(own) > 0, 'populated owner rows ' + table)
        require(foreign_status == 200 and foreign == [], 'foreign rows hidden ' + table)
    own_b = b.progress()
    require(own_b['state']['xp'] == 8 and a.progress()['state']['xp'] == 235, 'users have independent counters')
    require(error_code(b.call('POST', '/rest/v1/sl_words', {'user_id': b.uid, 'word_id': 'v-prata'}), '42501'), 'direct INSERT denied')
    require(error_code(b.call('PATCH', f'/rest/v1/sl_accounts?user_id=eq.{a.uid}', {'xp': 999}), '42501'), 'direct UPDATE denied')
    require(error_code(b.call('DELETE', f'/rest/v1/sl_accounts?user_id=eq.{a.uid}'), '42501'), 'direct DELETE denied')
    require(a.progress()['state']['xp'] == 235, 'foreign mutation attempts changed nothing')
    passed('real JWT RLS: populated rows hidden in all seven tables; direct writes denied')

    path = a.uid + '/sl-stage2-' + uuid4().hex + '.png'
    object_url = '/storage/v1/object/avatars/' + quote(path, safe='/')
    require(a.call('POST', object_url, PNG, 'image/png')[0] in (200, 201), 'owner avatar upload')
    require(a.call('GET', '/storage/v1/object/authenticated/avatars/' + quote(path, safe='/'))[0] == 200, 'owner avatar read')
    require(a.call('PUT', object_url, PNG, 'image/png')[0] == 200, 'owner avatar update')
    require(storage_denied(b.call('PUT', object_url, PNG, 'image/png')), 'foreign avatar update denied')
    require(storage_denied(b.call('GET', '/storage/v1/object/authenticated/avatars/' + quote(path, safe='/'))), 'foreign avatar read denied')
    require(storage_denied(anon.call('GET', '/storage/v1/object/public/avatars/' + quote(path, safe='/'))), 'private bucket has no public URL')
    foreign_path = a.uid + '/sl-stage2-foreign-' + uuid4().hex + '.png'
    require(storage_denied(b.call('POST', '/storage/v1/object/avatars/' + quote(foreign_path, safe='/'), PNG, 'image/png')), 'foreign-folder upload denied')
    require(storage_denied(b.call('POST', '/storage/v1/object/sign/avatars/' + quote(path, safe='/'), {'expiresIn': 60})), 'foreign signed URL denied')
    sign_status, sign_data = a.call('POST', '/storage/v1/object/sign/avatars/' + quote(path, safe='/'), {'expiresIn': 60})
    require(sign_status == 200 and isinstance(sign_data, dict) and sign_data.get('signedURL'), 'owner signed URL')
    signed = sign_data['signedURL']
    require(signed.startswith('/object/sign/') or signed.startswith('/storage/v1/object/sign/'), 'signed URL stays on approved origin')
    signed_path = signed if signed.startswith('/storage/v1/') else '/storage/v1' + signed
    require(anon.call('GET', signed_path)[0] == 200, 'signed URL acts as time-limited capability')
    # The URL is never printed. Anyone with it can read until expiry: expected.
    forbidden_mime = a.call('POST', '/storage/v1/object/avatars/' + a.uid + '/sl-stage2-' + uuid4().hex + '.png', b'<svg/>', 'image/svg+xml')
    require(400 <= forbidden_mime[0] < 500 and (forbidden_mime[0] == 415 or
            (isinstance(forbidden_mime[1], dict) and (str(forbidden_mime[1].get('statusCode')) == '415'
             or forbidden_mime[1].get('code') == 'InvalidMimeType'))), 'MIME rejected by real Storage')
    oversized = a.call('POST', '/storage/v1/object/avatars/' + a.uid + '/sl-stage2-' + uuid4().hex + '.png', PNG + b'0' * 1048576, 'image/png')
    require(oversized[0] < 500 and (oversized[0] == 413 or
            (isinstance(oversized[1], dict) and str(oversized[1].get('statusCode')) == '413')), 'size limit enforced by real Storage')
    # A foreign bulk delete may succeed with []; verify the original still exists.
    foreign_delete = b.call('DELETE', '/storage/v1/object/avatars', {'prefixes': [path]})
    require((foreign_delete[0] == 200 and foreign_delete[1] == []) or storage_denied(foreign_delete), 'foreign delete denied or empty result')
    require(a.call('GET', '/storage/v1/object/authenticated/avatars/' + quote(path, safe='/'))[0] == 200, 'foreign DELETE did not remove avatar')
    require(a.call('DELETE', '/storage/v1/object/avatars', {'prefixes': [path]})[0] == 200, 'owner removes own fixture')
    require(storage_denied(a.call('GET', '/storage/v1/object/authenticated/avatars/' + quote(path, safe='/'))), 'removed avatar unavailable')
    passed('Storage: owner-only CRUD/signing, private bucket, real MIME and size limits')
    print('DONE: test fixtures retained in DB. No account deletion, migrations or Auth configuration performed.')
    print('Use the manual cleanup and email/recovery checklist in docs/SUPABASE_STAGE2.md.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--run', action='store_true', help='AFTER APPROVAL ONLY: prompt for test project and run HTTP writes')
    args = parser.parse_args()
    if not args.run:
        print('NOT RUN. No network requests. Read docs/SUPABASE_STAGE2.md; approval required before --run.')
        return
    try:
        run()
    except RuntimeError as exc:
        # All RuntimeError messages are our fixed assertion labels, never bodies.
        print(str(exc), file=sys.stderr)
        print('STOP. Fixtures may remain. Do not rerun on the same users without review.', file=sys.stderr)
        raise SystemExit(1)
    except (URLError, ValueError, KeyError, AttributeError, KeyboardInterrupt):
        # Never dump exception/request bodies: login responses contain secrets.
        print('STOP: acceptance test failed or interrupted. No automatic retries/rollback. Check the last PASS and project logs; do not share tokens.', file=sys.stderr)
        raise SystemExit(1)


if __name__ == '__main__':
    main()
