"""Copy an explicit runtime inventory without deleting or transforming source assets.
Run: python3 scripts/build_deploy.py [new-output-directory]
Existing output directories are refused to avoid accidental loss of local work.
"""
import hashlib
import json
from pathlib import Path
import shutil
import sys
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
RUNTIME = '''.nojekyll LICENSE index.html style.css studio.css atelier.css learning-polish.css
app.js atelier.js learning-polish.js flashcard-media.js word-icons.js locale-content.js
supabase-config.js words.json lessons.json books.json favicon.svg manifest.webmanifest
privacy.html terms.html cookies.html sw.js server.py run.command'''.split()
IMAGE_EXTENSIONS = {'.webp', '.png', '.jpg', '.jpeg', '.svg', '.gif'}
ASSET_METADATA = {'assets/flashcards/photo-credits-imported.json',
                  'assets/word-icons/LICENSE', 'assets/word-icons/README.md',
                  'assets/word-icons/manifest.json', 'assets/avatars/README.md'}

def build(destination):
    destination = destination.resolve()
    if destination.exists():
        raise SystemExit(f'Refusing to overwrite existing directory: {destination}')
    files = [ROOT / name for name in RUNTIME]
    files += [p for p in (ROOT / 'assets').rglob('*') if p.is_file() and
              (p.suffix.lower() in IMAGE_EXTENSIONS or p.relative_to(ROOT).as_posix() in ASSET_METADATA)]
    digest = hashlib.sha256()
    inventory = {}
    for source in sorted(files):
        name = unicodedata.normalize('NFC', source.relative_to(ROOT).as_posix())
        data = source.read_bytes()
        digest.update(name.encode() + b'\0' + data)
        inventory[name] = hashlib.sha256(data).hexdigest()
    release = digest.hexdigest()[:16]
    for source in files:
        name = unicodedata.normalize('NFC', source.relative_to(ROOT).as_posix())
        target = destination / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, target)
    sw = destination / 'sw.js'
    sw.write_text(sw.read_text().replace("const RELEASE='2026-10-16-prep-1';", f"const RELEASE='{release}';"))
    inventory['sw.js'] = hashlib.sha256(sw.read_bytes()).hexdigest()
    print(json.dumps({'directory': str(destination), 'release': release,
                      'files': len(inventory),
                      'bytes': sum(p.stat().st_size for p in destination.rglob('*') if p.is_file()),
                      'sha256': inventory}, ensure_ascii=False, indent=2))

if __name__ == '__main__':
    build(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'deploy')
