"""Reconstruct the published 023 contract offline; never a live DB observation."""
import json
from pathlib import Path
from nouns_contract import ROOT, SIGNATURES, installed_022_source
from presens_contract import body, literal, md5
from check_supabase_manifest import read_manifest

PUBLISHED = ROOT / 'supabase/migrations/202611270023_nouns.sql'
MIGRATION = ROOT / 'supabase/migrations/202611270024_noun_tables.sql'
VERSION_023 = 'static-bb3e3ddf1c5daf12'
CATALOG_SHA256_023 = 'fcdd023a0729b36915a8a8ac936660914357e72398c2f76585b0efcdff6765fe'


def published_properties():
    return json.loads((ROOT / 'supabase/checks/023_nouns_fingerprints.sql').read_text().split('$expected$')[1])


def source_023():
    sources = installed_022_source()
    sql = PUBLISHED.read_text()
    for name in ('reader', 'writer'):
        part = sql.split('do $' + name + '_upgrade$')[1].split('end $' + name + '_upgrade$')[0]
        for i in range(2):
            old, new = literal(part, 'old_' + str(i), '$old$'), literal(part, 'new_' + str(i), '$new$')
            assert sources[name].count(old) == 1
            sources[name] = sources[name].replace(old, new)
    for name in ('manifest', 'catalog'):
        sources[name] = body(sql, SIGNATURES[name], '$function$')
    assert {k: md5(v) for k,v in sources.items()} == {k:v['md5'] for k,v in published_properties().items()}
    assert read_manifest(PUBLISHED)['version'] == VERSION_023
    return sources


def patches():
    anchor = "    elsif d->>'content_version' is distinct from input_manifest->>'version' then"
    return {
        'writer': [(anchor, f"    elsif d->>'content_version'='{VERSION_023}' then\n      input_manifest:=sl_private.manifest_before_024();\n" + anchor)],
        'reader': [("'nouns_final_v1'", f"'nouns_final_v1','event_replay:{VERSION_023}'")]
    }


def sources_024(manifest):
    sources = source_023()
    for name, pairs in patches().items():
        for old,new in pairs:
            assert sources[name].count(old) == 1
            sources[name] = sources[name].replace(old,new)
    sources['manifest'] = '\nselect $manifest$' + json.dumps(manifest,ensure_ascii=False,indent=2,sort_keys=True) + '$manifest$::jsonb;\n'
    return sources
