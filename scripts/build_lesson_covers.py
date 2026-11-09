"""Optimize generated lesson photographs; never call an image-generation API.

Usage: python3 scripts/build_lesson_covers.py /path/to/private-sources.json
The private JSON is a list of {"id": "lesson-1", "path": "/path/to/original.png"}.
Original PNGs stay outside the repository. Only compact WebP files are published.
"""
import hashlib
import json
from pathlib import Path
import sys

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / 'assets' / 'lesson-covers'
SIZE = (768, 512)
MAX_BYTES = 90 * 1024


def optimize(source, target):
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        if abs(image.width / image.height - 1.5) > 0.001:
            raise ValueError(f'Expected a 3:2 photograph, refusing to crop: {source}')
        if image.width < SIZE[0] or image.height < SIZE[1]:
            raise ValueError(f'Refusing to upscale a small photograph: {source}')
        image = image.resize(SIZE, Image.Resampling.LANCZOS)
        image.info.clear()
        for quality in (80, 78, 76):
            image.save(target, 'WEBP', quality=quality, method=6)
            if target.stat().st_size <= MAX_BYTES:
                break
        else:
            raise ValueError(f'Image exceeds the size budget: {target}')
    with Image.open(target) as check:
        assert check.size == SIZE and check.format == 'WEBP'
    data = target.read_bytes()
    return {'width': SIZE[0], 'height': SIZE[1], 'quality': quality,
            'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def build(sources_path):
    sources = json.loads(Path(sources_path).read_text())
    lookup = {item['id']: Path(item['path']) for item in sources}
    lessons = json.loads((ROOT / 'lessons.json').read_text())
    expected = {lesson['id'] for lesson in lessons}
    if set(lookup) != expected or len(sources) != len(expected):
        raise ValueError(f'Expected one generated original for every lesson; missing: {sorted(expected - set(lookup))}')
    plan = json.loads((DIRECTORY / 'prompts.json').read_text())
    jobs = {item['id']: item for item in plan['images']}
    assert set(jobs) == expected
    entries = []
    for lesson in lessons:
        job = jobs[lesson['id']]
        target = DIRECTORY / job['file']
        details = optimize(lookup[lesson['id']], target)
        entries.append({'id': lesson['id'], 'level': lesson['level'],
                        'title': lesson['title'], 'file': job['file'], **details})
    total = sum(item['bytes'] for item in entries)
    if total > 3 * 1024 * 1024:
        raise ValueError(f'Cover set exceeds its 3 MiB budget: {total}')
    manifest = {'generator': 'built-in image_gen', 'format': 'WebP',
                'width': SIZE[0], 'height': SIZE[1], 'count': len(entries),
                'bytes': total, 'images': entries}
    (DIRECTORY / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'count': len(entries), 'bytes': total,
                      'largest_bytes': max(item['bytes'] for item in entries)}, indent=2))


if __name__ == '__main__':
    build(sys.argv[1])
