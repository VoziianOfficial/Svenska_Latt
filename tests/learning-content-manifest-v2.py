"""Inspect the unapplied manifest proposal without connecting to any database."""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from check_supabase_manifest import current_manifest, read_manifest, latest_manifest_path

proposal = latest_manifest_path()
assert proposal.name == '202611090017_learning_content_manifest.sql'
old = read_manifest(ROOT / 'supabase/migrations/202610170006_manifest_version.sql')
new = read_manifest(proposal)
assert new == current_manifest()
assert old['version'] != new['version']
assert {k: v for k, v in old.items() if k != 'version'} == {k: v for k, v in new.items() if k != 'version'}
assert f"version:'{new['version']}'" in (ROOT / 'app.js').read_text()
sql = re.sub(r'--[^\n]*', '', proposal.read_text()).strip()
expected = r"begin;\s*create or replace function sl_private\.manifest\(\) returns jsonb\s*language sql immutable security invoker set search_path = '' as \$function\$\s*select \$manifest\$.*\$manifest\$::jsonb;\s*\$function\$;\s*commit;"
assert re.fullmatch(expected, sql, re.S), 'Unexpected operation in version-only proposal'
print('PASS: unapplied SQL changes only manifest version; signature, security mode, IDs/counts and client version match; no database connection')
