#!/usr/bin/env python3
"""Verify a built release over local HTTP, including all 1006 word-image responses."""
import hashlib,json,os,re,socket,subprocess,sys,tempfile,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 release=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'deploy'
 words=json.loads((release/'words.json').read_text());code=(release/'flashcard-media.js').read_text();mapping=dict(re.findall(r'"([^"\\]+)"\s*:\s*"([^"\\]+)"',re.search(r'const photos\s*=\s*Object.freeze\(\{(.*?)\}\);',code,re.S)[1]))
 manifest=json.loads((ROOT/'reports/deploy-manifest.json').read_text())
 for name,digest in manifest['sha256'].items():assert hashlib.sha256((release/name).read_bytes()).hexdigest()==digest,name
 baseline=json.loads((ROOT/'reports/photo-baseline.json').read_text())
 for name,digest in baseline['images'].items():assert hashlib.sha256((release/name).read_bytes()).hexdigest()==digest,name
 assert len(words)==1006 and len(mapping)==1006
 sock=socket.socket();sock.bind(('127.0.0.1',0));port=sock.getsockname()[1];sock.close()
 with tempfile.TemporaryDirectory(prefix='svenska-photo-check-') as temp:
  env={**os.environ,'PORT':str(port),'HOST':'127.0.0.1','SVENSKA_DB':str(Path(temp)/'check.sqlite3')}
  with open(Path(temp)/'server.log','w') as log:
   server=subprocess.Popen([sys.executable,str(release/'server.py')],env=env,stdout=log,stderr=log)
   try:
    base=f'http://127.0.0.1:{port}/'
    for _ in range(100):
     try:
      urllib.request.urlopen(base+'api/health',timeout=1).close();break
     except OSError:time.sleep(.05)
    for w in words:
     with urllib.request.urlopen(base+mapping[w['id']].removeprefix('./'),timeout=5) as response:
      body=response.read();assert response.status==200 and response.headers['Content-Type'].startswith('image/webp'),w['id'];assert len(body)>1000,w['id']
    with urllib.request.urlopen(base+'photo-credits.html') as response:
     assert response.status==200 and response.headers['Content-Type'].startswith('text/html')
     page=response.read().decode()
     for w in words:assert 'id="'+w['id']+'"' in page,w['id']
    for p in ['assets/flashcards/photo-credits-imported.json','assets/flashcards/photo-credits-added.json']:
     with urllib.request.urlopen(base+p) as response:assert response.status==200;json.load(response)
   finally:server.terminate();server.wait(timeout=10)
 result={'status':'PASS','cards_with_http_200_image_webp':len(words),'release_files_hash_verified':len(manifest['sha256']),'existing_asset_hashes_preserved':len(baseline['images']),'attribution_entries':len(words),'browser_visual_check':'unavailable: browser runtime returned no connected browsers','release':manifest['release']}
 (ROOT/'reports/photo-release-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':main()
