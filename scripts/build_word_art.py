"""Prepare reviewed imagegen atlases as small transparent vocabulary cutouts.

Generation itself uses the built-in image_gen tool, never an API credential.
Original generated PNGs are preserved. This script only extracts the declared
grid cells, trims transparent margins, resizes, and writes local WebP assets.
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'assets' / 'word-art'


def prepare(image, target):
    if '--resume' in sys.argv and target.exists():
        try:
            with Image.open(target) as existing:
                existing.load()
                if existing.size == (224, 224) and existing.mode == 'RGBA':
                    return
        except OSError:
            pass
    image = image.convert('RGBA')
    # The generator can leave almost invisible alpha=1 exporter noise outside
    # objects. Clear only those pixels; retain the real transparent edges.
    alpha = image.getchannel('A').point(lambda value: 0 if value <= 3 else value)
    image.putalpha(alpha)
    bounds = alpha.point(lambda value: 255 if value > 12 else 0).getbbox()
    if not bounds:
        raise ValueError(f'Empty generated illustration: {target.name}')
    image = ImageOps.contain(image.crop(bounds), (200, 200), Image.Resampling.LANCZOS)
    canvas = Image.new('RGBA', (224, 224))
    canvas.alpha_composite(image, ((224-image.width)//2, (224-image.height)//2))
    canvas.save(target, 'WEBP', quality=90, method=1)


def main():
    plan = json.loads((DEST / 'generation-plan.json').read_text())
    sources = json.loads((DEST / 'generation-sources.json').read_text())
    manifest = {}
    illustrations = {}
    for sheet in plan['sheets']:
        image = Image.open(sources[sheet['id']]).convert('RGBA')
        width, height = image.size
        for index, icon in enumerate(sheet['icons']):
            col, row = index % sheet['columns'], index // sheet['columns']
            bounds = (round(col*width/sheet['columns']), round(row*height/sheet['rows']),
                      round((col+1)*width/sheet['columns']), round((row+1)*height/sheet['rows']))
            name = icon['slug'] + '-v1.webp'
            prepare(image.crop(bounds), DEST / name)
            file = './assets/word-art/' + name
            illustrations[icon['slug']] = {'file': file, 'source_atlas': sheet['id'], 'cell': index}
            for word in icon['words']:
                manifest[word] = file
    # A dedicated broom image is also used; semantic overrides from the last
    # atlas (vacuum, eraser, table, furniture) take precedence over old aliases.
    for icon in plan['individuals']:
        name = icon['slug'] + '-v1.webp'
        prepare(Image.open(icon['source']), DEST / name)
        file = './assets/word-art/' + name
        illustrations[icon['slug']] = {'file': file, 'source': icon['source']}
        overrides = {word for sheet in plan['sheets'][15:] for entry in sheet['icons'] for word in entry['words']}
        for word in icon['words']:
            if word not in overrides:
                manifest[word] = file
    words = json.loads((ROOT / 'words.json').read_text())
    assert set(manifest) == {word['id'] for word in words}, 'Every vocabulary ID needs an illustration'
    manifest = {word['id']: manifest[word['id']] for word in words}
    (DEST / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n')
    (DEST / 'illustrations.json').write_text(json.dumps(illustrations, ensure_ascii=False, indent=2)+'\n')
    (ROOT / 'word-icons.js').write_text(
        '/* Realistic transparent vocabulary cutouts, generated with imagegen. See assets/word-art/README.md. */\n'
        'window.svWordIcons = Object.freeze('+json.dumps(manifest, ensure_ascii=False, indent=2)+');\n')
    print(f'Prepared {len(illustrations)} transparent cutouts for {len(manifest)} vocabulary entries')


if __name__ == '__main__':
    main()
