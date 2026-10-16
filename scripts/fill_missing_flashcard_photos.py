#!/usr/bin/env python3
"""Svenska Lätt: download *missing* word photos from Wikimedia Commons.

Existing image files are NEVER deleted, altered, renamed, or overwritten.
Only flashcard-media.js' image registry and the importer metadata are updated.
Requires: python3 -m pip install requests pillow

Example (from project root):
    python3 scripts/fill_missing_flashcard_photos.py --audit
    python3 scripts/fill_missing_flashcard_photos.py --limit 20
    python3 scripts/fill_missing_flashcard_photos.py --all

This is an automatic stock-photo importer, not a human visual verifier.
Abstract words and low-information photos can need manual review.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import io
import json
import os
import random
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote, unquote

try:
    import requests
    from PIL import Image, ImageOps, ImageFile
except ImportError:
    print('Missing dependencies. Run: python3 -m pip install requests pillow', file=sys.stderr)
    sys.exit(2)

Image.MAX_IMAGE_PIXELS = 35_000_000
ImageFile.LOAD_TRUNCATED_IMAGES = False

API = 'https://commons.wikimedia.org/w/api.php'
USER_AGENT = 'SvenskaLattPhotoImporter/1.0 (https://github.com/VoziianOfficial/Svenska_Latt_Atelier_v12; educational project)'
SEARCH_LIMIT = 12
ALLOWED_MIME = {'image/jpeg', 'image/png', 'image/webp'}
BLOCKED_TERMS = set('''drawing illustration vector sketch icon emoji cartoon artwork abstract
 diagram chart graph map flag logo symbol screenshot scan document poster banner certificate
 painting sculpture graffiti heraldry stamp clipart ai-generated ai-generated-image synthetic
 3d-render render'''.split())
STOP_WORDS = set('''a an the to in on for at from by with of and or is are was were
 how why photo photograph realistic person people someone something closeup close up
 swedish words word concept daily life common everyday using showing display picture
 individual items example scene'''.split())

# Concrete visual scenes for common words that stock search misunderstands.
# The English translations in words.json are used for all other 900+ entries.
SCENES = {
    'kanske': 'person considering two choices',
    'ofta': 'person daily routine',
    'ibland': 'person occasional walk',
    'aldrig': 'no entry closed door',
    'alltid': 'sunrise every morning',
    'nu': 'person checking wristwatch',
    'sedan': 'walking away from house',
    'snart': 'waiting person clock',
    'tidigt': 'early morning sunrise',
    'sent': 'late night clock',
    'jag': 'person pointing to themselves',
    'du': 'person pointing at friend',
    'han': 'adult man portrait',
    'hon': 'adult woman portrait',
    'vi': 'group of friends together',
    'ni': 'group of people conversation',
    'de': 'group of people walking',
    'det': 'object on wooden table',
    'den': 'single object on table',
    'vem': 'person questioning friend',
    'vad': 'person asking question',
    'var': 'person looking for directions',
    'vart': 'person looking at direction sign',
    'varifrån': 'traveler with suitcase map',
    'varför': 'curious person thinking',
    'hur': 'person learning instructions',
    'vilken': 'person choosing products',
    'vilket': 'person choosing two objects',
    'vilka': 'person choosing between objects',
    'och': 'two friends holding hands',
    'eller': 'person choosing between two items',
    'men': 'different two objects contrast',
    'också': 'two people joining group',
    'en': 'single apple on table',
    'ett': 'single apple on table',
    'för att': 'person studying for exam',
    'på': 'book on table',
    'under': 'cat under table',
    'över': 'airplane flying over city',
    'bakom': 'person behind tree',
    'framför': 'person standing in front of house',
    'mellan': 'person between two trees',
    'bredvid': 'cup beside book',
    'i': 'object inside box',
    'utan': 'empty cup on table',
    'med': 'friends walking together',
    'här': 'person standing by house',
    'där': 'person pointing at distant landmark',
    'uppe': 'person upstairs staircase',
    'nere': 'person downstairs staircase',
    'inne': 'person inside room',
    'ute': 'person standing outdoors',
    'mycket': 'large pile of apples',
    'lite': 'few apples on table',
    'flera': 'several apples on table',
    'alla': 'group of people together',
    'ingen': 'empty room chairs',
    'ett hundra': 'hundred coins arranged',
}
NUMBER_QUERIES = {
    'noll': 'empty basket', 'en': 'one red apple', 'ett': 'one red apple',
    'två': 'two red apples', 'tre': 'three red apples', 'fyra': 'four red apples',
    'fem': 'five red apples', 'sex': 'six red apples', 'sju': 'seven red apples',
    'åtta': 'eight red apples', 'nio': 'nine red apples', 'tio': 'ten red apples',
    'elva': 'eleven apples', 'tolv': 'twelve apples',
}
MONTHS = {
    'januari':'winter snow landscape', 'februari':'winter snowy trees',
    'mars':'early spring melting snow', 'april':'spring flowering trees',
    'maj':'spring flower meadow', 'juni':'summer green meadow',
    'juli':'summer sunny beach', 'augusti':'summer wheat harvest',
    'september':'early autumn park', 'oktober':'autumn orange leaves',
    'november':'late autumn fog', 'december':'winter snowy Christmas lights',
}
COLORS = {
    'röd':'red apple on white background', 'blå':'blue sky clear day',
    'grön':'bright green leaf', 'gul':'yellow sunflower',
    'vit':'white flower', 'svart':'black cat', 'brun':'brown horse',
    'rosa':'pink flower', 'lila':'purple lavender flowers',
    'orange':'orange fruit', 'grå':'gray stone', 'beige':'beige sand',
    'ljus':'bright sunlit window', 'mörk':'dark night sky',
    'randig':'striped shirt', 'prickig':'polka dot dress',
}

WEEKDAYS = {
    'måndag':'weekday office Monday', 'tisdag':'weekday busy office',
    'onsdag':'midweek classroom', 'torsdag':'weekday office desk',
    'fredag':'people relaxing after work', 'lördag':'weekend picnic outdoors',
    'söndag':'relaxing Sunday breakfast',
}
CATEGORY_HINTS = {
    'Глаголы':'person doing action', 'Тело':'human body',
    'Животные':'wildlife animal', 'Еда':'food', 'Еда и напитки':'food',
    'Одежда':'clothing', 'Дом':'home', 'Дом и комнаты':'room',
    'Погода':'weather', 'Здоровье':'healthcare', 'Транспорт':'transport',
    'Досуг':'leisure', 'Досуг и спорт':'sport', 'Работа':'work',
    'Учёба':'school', 'Школа и SFI':'classroom', 'Город и места':'city',
    'Семья':'family', 'Магазин':'shopping', 'Магазин и покупки':'shopping',
    'Чувства':'facial expression', 'Общение и чувства':'facial expression',
}


def now():
    return datetime.now(timezone.utc).isoformat(timespec='seconds')


def tidy(raw):
    raw = re.sub(r'<[^>]*>', ' ', str(raw or ''))
    return re.sub(r'\s+', ' ', html.unescape(raw)).strip()[:700]


def path_name(word_id):
    return unicodedata.normalize('NFC', word_id) + '.webp'


def canonical(name):
    name = re.sub(r'#U([0-9a-fA-F]{4,6})', lambda m: chr(int(m.group(1), 16)), name)
    return unicodedata.normalize('NFC', name)


def photos_on_disk(folder):
    return {canonical(f.name): f for f in folder.glob('*.webp') if f.is_file()}


def url_for(file):
    return './assets/flashcards/' + quote(file.name, safe='-_.()')


def read_mapping(source):
    code = source.read_text(encoding='utf-8')
    match = re.search(r'const photos\s*=\s*Object\.freeze\(\{(?P<inside>.*?)\}\);', code, re.S)
    if not match:
        raise RuntimeError('Cannot identify photos mapping in flashcard-media.js. No changes were made.')
    pattern = r'"([^"\\]+)"\s*:\s*"([^"\\]+)"'
    data = dict(re.findall(pattern, match.group('inside')))
    return code, match, data


def save_mapping(source, changes):
    """Append or repair *only* the photo URLs; never rewrite other app logic."""
    if not changes:
        return
    code, obj, original = read_mapping(source)
    inside = obj.group('inside')
    incoming = []
    for word_id, target in changes.items():
        if word_id in original:
            old_url = original[word_id]
            if old_url == target:
                continue
            key = json.dumps(word_id, ensure_ascii=False)
            before = json.dumps(old_url, ensure_ascii=False)
            after = json.dumps(target, ensure_ascii=False)
            needle = re.compile(r'('+re.escape(key)+r'\s*:\s*)'+re.escape(before))
            inside, n = needle.subn(lambda m: m.group(1)+after, inside, count=1)
            if n != 1:
                raise RuntimeError('Could not update photo URL for ' + word_id)
        else:
            incoming.append('  '+json.dumps(word_id, ensure_ascii=False)+': '+json.dumps(target, ensure_ascii=False))
    if incoming:
        text = inside.rstrip()
        if text and not text.rstrip().endswith(','):
            text += ','
        inside = text + '\n' + ',\n'.join(incoming) + '\n'
    start, end = obj.span('inside')
    revised = code[:start]+inside+code[end:]
    # Guard against typos or accidentally removing any existing word mappings.
    if len(read_mapping_text(revised)) < len(original):
        raise RuntimeError('Registry safety check failed; original left unchanged')
    if revised != code:
        safe_write(source, revised)


def read_mapping_text(code):
    m = re.search(r'const photos\s*=\s*Object\.freeze\(\{(.*?)\}\);', code, re.S)
    return dict(re.findall(r'"([^"\\]+)"\s*:\s*"([^"\\]+)"', m.group(1))) if m else {}


def safe_write(path, content):
    tmp = path.with_name('.'+path.name+'.tmp')
    with tmp.open('w', encoding='utf-8') as file:
        file.write(content)
        file.flush()
        os.fsync(file.fileno())
    os.replace(tmp, path)


def save_json(path, data):
    safe_write(path, json.dumps(data, ensure_ascii=False, indent=2) + '\n')


def load_json(path, default):
    if not path.exists():
        return default
    return json.loads(path.read_text(encoding='utf-8'))


def get_license(raw):
    x = tidy(raw).lower().replace('creative commons', 'cc')
    if 'public domain' in x or x == 'pd' or x.startswith('cc0') or x == 'pdm':
        return True
    # Exclude noncommercial, non-derivative and unknown licenses.
    if 'nc' in x or 'nd' in x or 'noncommercial' in x or 'no derivatives' in x:
        return False
    if re.match(r'^cc\s+by(?:-sa)?(?:\s|$)', x):
        return True
    return False


def search_queries(w):
    sw = w['word'].lower().strip()
    cat = w.get('category', '')
    en = re.split(r'\s*/\s*|\s*;\s*', w.get('en', '').strip())[0]
    # Category-specific overrides take precedence over ambiguous English translations.
    if cat in ('Числа', 'Счёт и количество') and sw in NUMBER_QUERIES:
        query = NUMBER_QUERIES[sw]
    elif sw in SCENES:
        query = SCENES[sw]
    elif sw in MONTHS:
        query = MONTHS[sw]
    elif sw in WEEKDAYS:
        query = WEEKDAYS[sw]
    elif sw in COLORS and cat in ('Цвета','Цвета и формы'):
        query = COLORS[sw]
    else:
        query = en or sw
        if w['type']=='verb':
            query = ('person '+query if not query.startswith(('person ', 'people ', 'woman ', 'man ')) else query)
        if cat in ('Местоимения','Связки','Предлоги','Вопросы'):
            query = query+' '+CATEGORY_HINTS.get(cat,'person')
        elif cat in CATEGORY_HINTS and len(query.split()) == 1:
            query = query+' '+CATEGORY_HINTS[cat]
    query = re.sub(r'\s+', ' ', query).strip()
    variants = [query]
    if en and en.casefold() != query.casefold():
        variants.append(en)
    return list(dict.fromkeys(x for x in variants if x))[:2]


def description_relevance(page, info, query):
    title = tidy(page.get('title','')).lower()
    meta = info.get('extmetadata', {})
    description = tidy(meta.get('ImageDescription', {}).get('value','')).lower()
    labels = tidy(meta.get('ObjectName', {}).get('value','')).lower()
    text = ' '.join((title, description, labels))[:2800]
    if any(re.search(r'\b'+re.escape(term)+r'\b',title) for term in BLOCKED_TERMS):
        return -999
    if (title.endswith('.svg') or title.endswith('.gif') or title.endswith('.pdf')):
        return -999
    # Automatic matching can only be approximate; demand at least one useful keyword.
    tokens = [x for x in re.findall(r'[a-z]{3,}', query.lower()) if x not in STOP_WORDS]
    if not tokens:
        return 0
    matches = [x for x in set(tokens) if x in text]
    if not matches:
        return -999
    return len(matches)*5 + sum(3 for x in matches if x in title)


class RetryLater(RuntimeError):
    pass


class CommonsClient:
    def __init__(self, delay=2.5, pause_limit=900):
        self.session = requests.Session()
        self.session.headers.update({'User-Agent': USER_AGENT, 'Accept': 'application/json, image/*;q=0.8'})
        self.delay = max(delay, 1.0)
        self.pause_limit = pause_limit
        self.last_request = 0
        self.consecutive_throttles = 0

    def _wait(self):
        sleep_for = self.delay - (time.monotonic()-self.last_request)
        if sleep_for > 0:
            time.sleep(sleep_for)

    def get(self, url, *, params=None, timeout=35):
        for attempt in range(5):
            self._wait()
            self.last_request = time.monotonic()
            try:
                res = self.session.get(url, params=params, timeout=timeout, allow_redirects=True)
            except requests.RequestException as exc:
                wait = min(6*2**attempt, 90)
                print(f'    Connection issue: {exc.__class__.__name__}; waiting {wait}s', flush=True)
                time.sleep(wait)
                continue
            if res.status_code in (401, 403):
                raise RetryLater(f'Commons denied access (HTTP {res.status_code}). Check network and retry later.')
            if res.status_code in (429, 502, 503, 504):
                self.consecutive_throttles += 1
                raw = res.headers.get('Retry-After', '')
                try: seconds = int(raw)
                except ValueError: seconds = int(min(25*(2**attempt), 900))
                seconds = max(10, seconds) + random.randint(0, 6)
                print(f'    HTTP {res.status_code}: waiting {seconds}s, preserving progress', flush=True)
                if seconds > self.pause_limit or self.consecutive_throttles >= 5:
                    raise RetryLater('Service is rate-limiting. Run the same command later to resume.')
                time.sleep(seconds)
                continue
            res.raise_for_status()
            self.consecutive_throttles = 0
            return res
        raise RetryLater('Remote server temporarily unavailable. Retry later.')

    def candidates(self, query):
        params = {'action':'query','generator':'search','gsrsearch':query,
                  'gsrnamespace':6,'gsrlimit':SEARCH_LIMIT, 'prop':'imageinfo',
                  'iiprop':'url|size|mime|extmetadata', 'iiurlwidth':1000, 'format':'json',
                  'formatversion':2}
        data = self.get(API, params=params).json()
        if 'error' in data:
            raise RetryLater('Commons returned an API error: '+str(data['error'])[:200])
        pages = data.get('query',{}).get('pages',[])
        found = []
        for page in pages:
            infos = page.get('imageinfo',[])
            if not infos: continue
            info = infos[0]
            meta = info.get('extmetadata',{})
            license_name = tidy(meta.get('LicenseShortName',{}).get('value',''))
            if not get_license(license_name): continue
            if info.get('mime') not in ALLOWED_MIME: continue
            if info.get('width',0) < 640 or info.get('height',0)<480: continue
            imgurl = info.get('thumburl') or info.get('url')
            if not imgurl: continue
            score = description_relevance(page,info,query)
            if score < 0: continue
            found.append({'pageid':page['pageid'], 'url':imgurl, 'source':info.get('descriptionurl',''),
                          'author':tidy(meta.get('Artist',{}).get('value','')),
                          'license':license_name,
                          'license_url':tidy(meta.get('LicenseUrl',{}).get('value','')),
                          'score':score, 'title':page['title'], 'search_query':query})
        return sorted(found, key=lambda item:item['score'], reverse=True)


def dhash(image):
    reduced = ImageOps.grayscale(image).resize((9,8), Image.Resampling.BILINEAR)
    pixels = list(reduced.getdata())
    value = 0
    for y in range(8):
        for x in range(8):
            value = (value << 1) | (pixels[y*9+x] > pixels[y*9+x+1])
    return value


def crop_and_encode(raw, max_bytes=150_000):
    with Image.open(io.BytesIO(raw)) as original:
        if original.width < 640 or original.height < 480:
            raise ValueError('photo too small')
        if original.width*original.height > 35_000_000:
            raise ValueError('photo too large')
        img = ImageOps.exif_transpose(original).convert('RGB')
        photo_hash = dhash(img)
        thumb = ImageOps.fit(img,(640,640),Image.Resampling.LANCZOS,centering=(0.5,0.5))
        blob = None
        for quality in (82,77,72,66,60):
            buff=io.BytesIO()
            thumb.save(buff,'WEBP',quality=quality,method=5)
            blob=buff.getvalue()
            if len(blob)<=max_bytes: break
        return blob, photo_hash


def load_existing_hashes(credits):
    used_ids=set()
    used_hashes=set()
    for row in credits.values():
        if not isinstance(row,dict): continue
        if row.get('pageid') is not None:
            used_ids.add(str(row['pageid']))
        if row.get('dhash'):
            used_hashes.add(int(row['dhash'],16))
    return used_ids,used_hashes


def main():
    parser=argparse.ArgumentParser(description=__doc__,formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--root',type=Path,default=Path(__file__).resolve().parents[1],help='Svenska Lätt project folder')
    parser.add_argument('--audit',action='store_true',help='Print counts; no internet or changes')
    group=parser.add_mutually_exclusive_group()
    group.add_argument('--all',action='store_true',help='Attempt all missing photos (may take hours)')
    group.add_argument('--limit',type=int,default=20,help='Attempt at most this many missing words (default: 20)')
    parser.add_argument('--delay',type=float,default=2.5,help='Minimum seconds between HTTP requests (default: 2.5)')
    parser.add_argument('--max-pause',type=int,default=900,help='Max single rate-limit pause, seconds')
    args=parser.parse_args()
    root=args.root.expanduser().resolve()
    folder=root/'assets/flashcards'
    word_file=root/'words.json'
    mapping_file=root/'flashcard-media.js'
    if not folder.is_dir() or not word_file.is_file() or not mapping_file.is_file():
        parser.error('Project not found. Put this script in YOUR_PROJECT/scripts/ or use --root /full/path/to/project')
    words=json.loads(word_file.read_text(encoding='utf-8'))
    _,_,mapping=read_mapping(mapping_file)
    already=photos_on_disk(folder)
    credits_file=folder/'photo-credits-imported.json'
    state_file=folder/'photo-import-progress.json'
    credits=load_json(credits_file,{})
    progress=load_json(state_file,{})
    if not isinstance(credits,dict):
        raise RuntimeError('Invalid credit file. Aborting to preserve data.')
    if not isinstance(progress,dict):
        raise RuntimeError('Invalid progress file. Aborting to preserve data.')
    corrections={}
    missing=[]
    preserved_ids=set()
    for word in words:
        key=word['id']
        mapped=mapping.get(key)
        if mapped:
            local = unquote(mapped.removeprefix('./assets/flashcards/'))
            # A literal file must exist. Merely having an equivalent encoded
            # filename isn't enough: URLs containing Swedish letters may point
            # to a *different* file than 'w-hejd#U00e5.webp'.
            if (folder/local).is_file():
                preserved_ids.add(key)
                continue
            found = already.get(canonical(Path(local).name))
            if found:
                preserved_ids.add(key)
                corrections[key] = url_for(found)
                continue
        on_disk=already.get(path_name(key))
        if on_disk:
            preserved_ids.add(key)
            if not mapped or mapped != url_for(on_disk):
                corrections[key]=url_for(on_disk)
        else:
            missing.append(word)
    print(f'Words: {len(words)} | Already have local photos: {len(preserved_ids)} | Missing: {len(missing)}')
    if args.audit:
        print('Unmapped or broken existing URLs to repair:',len(corrections))
        print('First missing words:', ', '.join(f"{w['word']} ({w['id']})" for w in missing[:12]))
        print('Audit mode: no files were changed.')
        return
    if corrections:
        save_mapping(mapping_file, corrections)
        mapping.update(corrections)
        print('Linked existing, untouched image files:',len(corrections))
    used_ids, used_hashes=load_existing_hashes(credits)
    client=CommonsClient(args.delay,args.max_pause)
    # Put never-attempted words first, so restarting a batch cannot loop
    # forever on the same 20 words that Commons cannot illustrate.
    missing.sort(key=lambda w:(w['id'] in progress, progress.get(w['id'],{}).get('updated','')))
    todo=missing if args.all else missing[:max(0,args.limit)]
    complete=0
    not_found=0
    failed=[]
    for idx,w in enumerate(todo,1):
        key, term=w['id'],w['word']
        print(f'[{idx}/{len(todo)}] {term} ({key}) ...',flush=True)
        current_file=folder/path_name(key)
        if current_file.exists():
            # Never overwrite an existing filename.
            save_mapping(mapping_file, {key:url_for(current_file)})
            continue
        chosen=None
        blob=None
        photo_hash=None
        try:
            for query in search_queries(w):
                candidates=client.candidates(query)
                for photo in candidates:
                    if str(photo['pageid']) in used_ids:
                        continue
                    try:
                        response=client.get(photo['url'],timeout=55)
                        if len(response.content)>12_000_000:
                            continue
                        encoded,candidate_hash=crop_and_encode(response.content)
                    except RetryLater:
                        raise
                    except (requests.RequestException, OSError, ValueError) as err:
                        print('    Rejected candidate:',type(err).__name__,flush=True)
                        continue
                    if any((candidate_hash ^ h).bit_count() <= 5 for h in used_hashes):
                        continue
                    chosen,blob,photo_hash=photo,encoded,candidate_hash
                    break
                if chosen:break
            if not chosen:
                not_found+=1
                failed.append(term)
                progress[key]={'status':'not-found','updated':now(),'queries':search_queries(w)}
                save_json(state_file, progress)
                print('    Not found; will try again next run.',flush=True)
                continue
            # 'xb': fail if file already exists (strict NO OVERWRITE).
            with current_file.open('xb') as out:
                out.write(blob)
            # Only modify photo registry, after the image was safely saved.
            save_mapping(mapping_file,{key:url_for(current_file)})
            mapping[key]=url_for(current_file)
            credits[key]={'word':term, 'translation':w.get('en',''), 'photo_file':str(current_file.relative_to(root)),
                          'source':chosen['source'], 'author':chosen['author'],
                          'license':chosen['license'], 'license_url':chosen['license_url'],
                          'search_query':chosen['search_query'],'commons_title':chosen['title'],
                          'pageid':chosen['pageid'], 'dhash':f'{photo_hash:016x}',
                          'saved_at':now()}
            save_json(credits_file, credits)
            progress[key]={'status':'downloaded', 'updated':now()}
            save_json(state_file, progress)
            used_ids.add(str(chosen['pageid']))
            used_hashes.add(photo_hash)
            complete+=1
            print(f'    SAVED: {current_file.name} ({len(blob)//1024} KB) {chosen["license"]}',flush=True)
        except RetryLater as err:
            print('\nPAUSED:',err,flush=True)
            print('Existing files and all successful downloads are safe. Rerun the same command.',flush=True)
            break
        except KeyboardInterrupt:
            print('\nStopped by user. Successfully downloaded photos are preserved.',flush=True)
            break
        except Exception as err:
            progress[key]={'status':'error','updated':now(),'reason':str(err)[:250]}
            save_json(state_file,progress)
            print('    ERROR:',str(err)[:200],flush=True)
            failed.append(term)
    _,_,new_map=read_mapping(mapping_file)
    available=photos_on_disk(folder)
    verified=sum(1 for w in words if (url_file_for(w['id'],new_map,available)))
    print(f'\nDone for this run. Newly downloaded: {complete} | No suitable candidate: {not_found}')
    print(f'Currently connected local photos: {verified}/{len(words)} | Without: {len(words)-verified}')
    if failed:
        print('Still unresolved in this batch:',', '.join(failed[:40]))
    print('Sources and licenses:', credits_file)
    print('To continue, run this same command again. Automatic matching needs visual review.')


def url_file_for(key, mapping, available):
    url=mapping.get(key,'')
    if not url:
        return False
    from urllib.parse import unquote
    base=unquote(url.rsplit('/',1)[-1])
    return canonical(base) in available

if __name__=='__main__':
    main()
