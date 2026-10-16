"""Register and review built-in image_gen outputs; never calls a generation API."""
import argparse
import fcntl
import hashlib
import json
import tempfile
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets/flashcards'
RECEIPTS = ASSETS / 'generation-status.json'
BASE = {key: './assets/flashcards/work.webp' for key in ['v-arbeta', 'v-jobba', 'n-jobb', 'lex-0220']}

def atomic_text(target, contents):
    staging = target.with_suffix(target.suffix + '.tmp')
    staging.write_text(contents)
    staging.replace(target)

def save(records):
    atomic_text(RECEIPTS, json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    mapping = BASE | {key: row['path'] for key, row in records.items() if row['status'] == 'reviewed'}
    atomic_text(ROOT / 'flashcard-media.js',
        "/* Exact word IDs mapped to locally stored, reviewed AI imagery. */\n'use strict';\n(() => {\n const photos = Object.freeze("
        + json.dumps(mapping, ensure_ascii=False, indent=2)
        + ");\n window.svFlashPhotoForWord = word => photos[word?.id] || null;\n})();\n")

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--register', nargs=2, metavar=('ID', 'SOURCE'))
parser.add_argument('--revision', action='store_true')
parser.add_argument('--approve', nargs='+')
parser.add_argument('--sheet', nargs='+')
parser.add_argument('--sheet-next', action='store_true')
args = parser.parse_args()
lock_path = Path(tempfile.gettempdir()) / ('svenska-flashcards-' + hashlib.sha256(str(ROOT).encode()).hexdigest()[:12] + '.lock')
lock_file = lock_path.open('a')
fcntl.flock(lock_file, fcntl.LOCK_EX)
records = json.loads(RECEIPTS.read_text()) if RECEIPTS.exists() else {}
words = {word['id']: word for word in json.loads((ROOT / 'words.json').read_text())}
if args.register:
    ident, source = args.register
    if ident not in words or ident in BASE:
        raise ValueError('Unknown or already supplied word ID: ' + ident)
    target = ASSETS / (ident + '.webp')
    version = 2
    if args.revision:
        while target.exists():
            target = ASSETS / (ident + '-v' + str(version) + '.webp')
            version += 1
    if target.exists():
        raise FileExistsError(target)
    with Image.open(source) as image:
        image.convert('RGB').resize((768, 768), Image.Resampling.LANCZOS).save(target, quality=85, method=6)
    records[ident] = {'path': './assets/flashcards/' + target.name, 'status': 'generated'}
    save(records)
if args.approve:
    for ident in args.approve:
        if not (ROOT / records[ident]['path']).is_file():
            raise FileNotFoundError(ident)
        records[ident]['status'] = 'reviewed'
    save(records)
if args.sheet_next:
    args.sheet = [ident for ident, row in records.items() if row['status'] == 'generated'][:16]
if args.sheet:
    ids = args.sheet
    columns = 4
    cell = 260
    canvas = Image.new('RGB', (columns * cell, ((len(ids)+columns-1)//columns)*300), 'white')
    draw = ImageDraw.Draw(canvas)
    try:
        font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 16)
    except OSError:
        font = ImageFont.load_default()
    for index, ident in enumerate(ids):
        x, y = (index % columns)*cell, (index//columns)*300
        with Image.open(ROOT / records[ident]['path']) as image:
            canvas.paste(image.resize((256, 256)), (x, y))
        label = words[ident]['word'] + ' — ' + words[ident]['ru']
        draw.text((x+3, y+258), ident, fill='black', font=font)
        draw.text((x+3, y+278), label[:32], fill='black', font=font)
    target = ROOT / 'tmp/flashcard-review.jpg'
    target.parent.mkdir(exist_ok=True)
    canvas.save(target, quality=90)
    print(target)
    print(json.dumps({'sheet_ids': ids}, ensure_ascii=False))
print(json.dumps({'generated': len(records), 'reviewed': sum(row['status']=='reviewed' for row in records.values()), 'covered': len(BASE)+sum(row['status']=='reviewed' for row in records.values()), 'total': len(words)}))
