"""023 contract derived from the user-supplied installed-022 snapshot, offline only."""
import hashlib
import json
from pathlib import Path
from presens_contract import body, installed_021_source, literal, md5

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / 'supabase/baselines/022_installed_for_023.json'
MIGRATION = ROOT / 'supabase/migrations/202611270023_nouns.sql'
VERSION_022 = 'static-18bd9e23b62c3382'
SIGNATURES = dict(manifest='sl_private.manifest()', catalog='sl_private.quiz_catalog()',
                  reader='public.sl_get_progress()', writer='public.sl_apply_event(uuid,bigint,jsonb)')


def installed_022_source():
    """Independent source comparison; never presented as a production observation."""
    source = installed_021_source()
    sql = (ROOT / 'supabase/migrations/202611230022_presens.sql').read_text()
    for name in ('reader', 'writer'):
        part = sql.split('do $' + name + '_upgrade$')[1].split('end $' + name + '_upgrade$')[0]
        for i in range(2):
            old, new = literal(part, 'old_' + str(i), '$old$'), literal(part, 'new_' + str(i), '$new$')
            assert source[name].count(old) == 1
            source[name] = source[name].replace(old, new)
    for name in ('manifest', 'catalog'):
        source[name] = body(sql, SIGNATURES[name], '$function$')
    return source


def observed_baseline():
    raw = BASELINE.read_bytes()
    observed = json.loads(raw)
    provenance = json.loads(BASELINE.with_name('022_installed_for_023_provenance.json').read_text())
    assert hashlib.sha256(raw).hexdigest() == provenance['sha256'], 'Baseline bytes changed'
    assert observed['content_version'] == observed['manifest']['version'] == VERSION_022
    expected = {k: md5(v) for k, v in installed_022_source().items()}
    assert observed['function_md5'] == expected, 'Installed definitions differ from reviewed 022'
    for name, function in observed['functions'].items():
        assert md5(function['source']) == function['md5'] == expected[name]
        assert function['source'] in function['definition']
        assert function['signature'] == SIGNATURES[name]
        assert function['owner'] == 'postgres' and function['config'] == ['search_path=""']
        assert function['security_definer'] == (name in ('reader', 'writer'))
        assert function['acl'] == ['postgres=X/postgres'] + (['authenticated=X/postgres'] if name in ('reader', 'writer') else [])
    assert observed['backups'] == dict(catalog_before_021=True, catalog_before_022=True,
        catalog_before_023=False, manifest_before_021=True, manifest_before_022=True, manifest_before_023=False)
    assert set(observed['archives']) == {'quiz_catalog_before_020', 'quiz_catalog_before_021',
        'quiz_catalog_before_022', 'manifest_before_021', 'manifest_before_022'}
    for function in observed['archives'].values():
        assert md5(function['source']) == function['md5'] and function['source'] in function['definition']
        assert function['owner'] == 'postgres' and function['acl'] == ['postgres=X/postgres']
        assert function['config'] == ['search_path=""'] and not function['security_definer']
    return observed


def properties(functions):
    return {name: {**{k: f[k] for k in ('md5', 'owner', 'acl', 'config', 'security_definer')},
                   'definition_md5': md5(f['definition'])}
            for name, f in functions.items()}


def functions_query():
    values = ','.join("('%s','%s')" % (name, sig) for name, sig in SIGNATURES.items())
    return """select jsonb_object_agg(v.name,jsonb_build_object(
      'md5',md5(p.prosrc),'definition_md5',md5(pg_get_functiondef(p.oid)),
      'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,
      'config',p.proconfig,'security_definer',p.prosecdef))
      from (values %s) v(name,sig) left join pg_proc p on p.oid=to_regprocedure(v.sig)""" % values


def archives_query():
    return """select coalesce(jsonb_object_agg(p.proname,jsonb_build_object(
      'md5',md5(p.prosrc),'definition_md5',md5(pg_get_functiondef(p.oid)),
      'owner',pg_get_userbyid(p.proowner),'acl',p.proacl,
      'config',p.proconfig,'security_definer',p.prosecdef)),'{}'::jsonb)
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='sl_private' and p.proname ~ '^(manifest|quiz_catalog)_before_0(18|19|20|21|22)$'"""
