#!/usr/bin/env python3
"""Read-only check: the frozen SQL ID manifest matches the static curriculum.

Never rewrite an applied migration. A future content release needs a NEW migration
replacing sl_private.manifest(), then an updated check target.
"""
import hashlib
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BASELINE = ROOT / 'supabase/migrations/202610170002_manifest.sql'


def read_manifest(path):
    match = re.search(r'select \$manifest\$(.*?)\$manifest\$::jsonb', path.read_text(), re.S)
    if not match:
        raise ValueError(f'No frozen manifest literal in {path.name}')
    return json.loads(match[1])


def latest_manifest_path():
    # Only definitions of this exact function count, not filenames or references.
    definitions = [path for path in sorted((ROOT / 'supabase/migrations').glob('*.sql'))
                   if re.search(r'\bcreate\s+(?:or\s+replace\s+)?function\s+sl_private\.manifest\s*\(\s*\)',
                                path.read_text(), re.I)]
    if not definitions:
        raise ValueError('No manifest migration found')
    return definitions[-1]


def current_manifest():
    words, lessons, books = [json.loads((ROOT / (name + '.json')).read_text())
                             for name in ('words', 'lessons', 'books')]
    app = (ROOT / 'app.js').read_text()
    videos = []
    for name in ('VIDEOS', 'MORE_VIDEOS'):
        block = app.split('const ' + name + '=[', 1)[1].split('];', 1)[0]
        videos.extend(re.findall(r"\bid:'([^']+)'", block))
    manifest = {
        'words': sorted(w['id'] for w in words),
        'lessons': {l['id']: len((l.get('pronunciationChapter') or l.get('greetingsChapter') or l.get('pronounsChapter') or l.get('nounsChapter') or l.get('learningV2') or {}).get('finalTest', {}).get('questions', l['questions'])) for l in lessons},
        'books': {b['id']: len(b['questions']) for b in books},
        'videos': sorted(set(videos)),
        'topics': sorted(set(w['category'] for w in words)),
    }
    content = b''.join((ROOT / (n + '.json')).read_bytes()
                       for n in ('words', 'lessons', 'books'))
    content += json.dumps(manifest, ensure_ascii=False, sort_keys=True).encode()
    manifest['version'] = 'static-' + hashlib.sha256(content).hexdigest()[:16]
    return manifest


if __name__ == '__main__':
    target = latest_manifest_path()
    current = current_manifest()
    frozen = read_manifest(target)
    if frozen != current:
        if any(l.get('nounsChapter') for l in json.loads((ROOT/'lessons.json').read_text())) and target.name == '202611230022_presens.sql':
            raise SystemExit('NOT RELEASE READY: lesson-5 is local; obtain the installed 022 read-only baseline before generating 023. Do not publish this client.')
        if (target.name == '202611220021_pronouns.sql' and
            not (ROOT/'supabase/baselines/021_installed_for_022.json').exists()):
            raise SystemExit('NOT RELEASE READY: lesson-4 is local; obtain the installed 021 read-only baseline before generating 022. Do not publish this client.')
        raise SystemExit('FAIL: SQL manifest differs from static content; prepare a NEW migration')
    # Preserve baseline identities/counts except the reviewed versioned lesson-1 bank.
    # Further changes require a compatibility review and an intentional guard update.
    baseline = read_manifest(BASELINE)
    # Reviewed transition 019: active lesson-1 bank is 20; archived q0..q12 stay in quiz_catalog.
    baseline['lessons']['lesson-1'] = 20
    baseline['lessons']['lesson-2'] = 20
    baseline['lessons']['lesson-3'] = 24
    if target.name in ('202611230022_presens.sql', '202611270023_nouns.sql', '202611270024_noun_tables.sql'):
        baseline['lessons']['lesson-4'] = 24
    if target.name in ('202611270023_nouns.sql', '202611270024_noun_tables.sql'):
        baseline['lessons']['lesson-5'] = 24
    if {k: v for k, v in current.items() if k != 'version'} != {k: v for k, v in baseline.items() if k != 'version'}:
        raise SystemExit('FAIL: IDs/categories/question counts changed since migration 002')
    counts = ('13/11/11/11/10 → 20/20/24/24/24' if target.name in ('202611270023_nouns.sql', '202611270024_noun_tables.sql') else
              '13/11/11/11 → 20/20/24/24' if baseline['lessons']['lesson-4'] == 24 else '13/11/11 → 20/20/24')
    print(f'PASS: {target.name}: {current["version"]}; all IDs/categories retained; reviewed active lesson counts {counts}')
