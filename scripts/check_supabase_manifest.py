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
TARGET = ROOT / 'supabase/migrations/202610170002_manifest.sql'


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
        'lessons': {l['id']: len(l['questions']) for l in lessons},
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
    match = re.search(r'select \$manifest\$(.*?)\$manifest\$::jsonb', TARGET.read_text(), re.S)
    if not match or json.loads(match[1]) != current_manifest():
        raise SystemExit('FAIL: SQL manifest differs from static content; prepare a NEW migration')
    print('PASS: frozen manifest matches 1006 words, 50 lessons, 12 books and video/topic IDs')
