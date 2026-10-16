#!/usr/bin/env python3
"""Add only the 15 reviewed selections. Never overwrite an existing photo or mapping.
Requires requests and Pillow; source API evidence is stored in reports/commons-evidence.
"""
import hashlib,io,json,re,time
from pathlib import Path
from urllib.parse import quote
import requests
from PIL import Image,ImageOps
from build_photo_audit import clean
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def save(p,x):(ROOT/p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
def main():
 selections=read('reports/photo-selected-sources.json');words={w['id']:w for w in read('words.json')};baseline=read('reports/photo-baseline.json')
 credits_path='assets/flashcards/photo-credits-added.json';credits=read(credits_path) if (ROOT/credits_path).exists() else {}
 session=requests.Session();session.headers['User-Agent']='SvenskaLattReviewedPhotoImport/1.0 (educational project)'
 for key,sel in selections.items():
  assert key not in baseline['mapping'],key
  target=ROOT/'assets/flashcards'/f'{key}.webp'
  if key in credits:
   assert hashlib.sha256(target.read_bytes()).hexdigest()==credits[key]['sha256'];continue
  assert not target.exists(),'Refusing to overwrite '+str(target)
  pg=read('reports/commons-evidence/'+sel['evidence'])['query']['pages'][sel['candidate_index']];info=pg['imageinfo'][0];meta=info['extmetadata'];get=lambda k:clean(meta.get(k,{}).get('value',''))
  license=get('LicenseShortName');assert license.startswith(('CC BY','CC0','Public'))
  url=info.get('thumburl') or info['url'];cache=Path('/tmp/sl-reviewed-originals');cache.mkdir(exist_ok=True);source=cache/f'{key}.image'
  if not source.exists():
   for attempt in range(6):
    r=session.get(url,timeout=45)
    if r.status_code==429:print('Waiting for Wikimedia',key,flush=True);time.sleep(30);continue
    r.raise_for_status();assert len(r.content)<15_000_000;source.write_bytes(r.content);break
   else:raise RuntimeError('Wikimedia unavailable: '+key)
  with Image.open(source) as im:
   im.load();assert im.width>=400 and im.height>=400
   image=ImageOps.fit(ImageOps.exif_transpose(im).convert('RGB'),(640,640),Image.Resampling.LANCZOS)
   output=io.BytesIO();image.save(output,'WEBP',quality=82,method=6)
  with target.open('xb') as f:f.write(output.getvalue())
  author=get('Artist')
  if key=='lex-0395':author='Dave Jackson (photo); Delaware Valley Friends School (copyright); DVFSMarketing (licensing account)'
  if key=='w-snöar':author='Miha Peče'
  if key=='lex-0384':author='Mike Baird'
  credits[key]={'word':words[key]['word'],'translation':words[key].get('en',''),'photo_file':str(target.relative_to(ROOT)),'source':info['descriptionurl'],'author':author,'license':license,'license_url':get('LicenseUrl'),'commons_title':pg['title'],'pageid':pg['pageid'],'saved_at':'2026-10-17','changes':'Downloaded Commons thumbnail; EXIF orientation applied, resized and centre-cropped to 640 × 640, converted to WebP (quality 82). The app additionally crops the photo as a card background.','source_download_url':url,'source_download_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'selection_evidence':sel,'commons_evidence':pg}
  save(credits_path,credits);print(key,license,flush=True)
 code=(ROOT/'flashcard-media.js').read_text();match=re.search(r'const photos\s*=\s*Object.freeze\(\{(.*?)\}\);',code,re.S);inside=match[1].rstrip();current=dict(re.findall(r'"([^"\\]+)"\s*:\s*"([^"\\]+)"',inside))
 for key in selections:
  url='./assets/flashcards/'+quote(key+'.webp',safe='-_.()')
  if key in current:assert current[key]==url;continue
  inside+=(',' if not inside.endswith(',') else '')+'\n  '+json.dumps(key,ensure_ascii=False)+': '+json.dumps(url)
 (ROOT/'flashcard-media.js').write_text(code[:match.start(1)]+inside+'\n'+code[match.end(1):])
 print('Added',len(credits),'reviewed photos')
if __name__=='__main__':main()
