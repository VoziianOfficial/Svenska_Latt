#!/usr/bin/env python3
"""Verify a built release over local HTTP, including all 1006 word-image responses."""
import hashlib,json,os,re,socket,subprocess,sys,tempfile,time,urllib.request
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from html.parser import HTMLParser
from threading import Thread
from urllib.parse import quote, urljoin, urlparse
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def main():
 release=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT/'deploy'
 words=json.loads((release/'words.json').read_text());code=(release/'flashcard-media.js').read_text();mapping=dict(re.findall(r'"([^"\\]+)"\s*:\s*"([^"\\]+)"',re.search(r'const photos\s*=\s*Object.freeze\(\{(.*?)\}\);',code,re.S)[1]))
 manifest=json.loads((release/'release-manifest.json').read_text())
 for name,digest in manifest['sha256'].items():assert hashlib.sha256((release/name).read_bytes()).hexdigest()==digest,name
 baseline=json.loads((ROOT/'reports/photo-baseline.json').read_text())
 for name,digest in baseline['images'].items():assert hashlib.sha256((release/name).read_bytes()).hexdigest()==digest,name
 assert len(words)==1006 and len(mapping)==1006
 # Emulate Pages project hosting: resolve every built file below a subdirectory.
 # This is an HTTP/path check, not a rendering or service-worker browser test.
 class QuietHandler(SimpleHTTPRequestHandler):
  def log_message(self,*args):pass
 class Links(HTMLParser):
  def __init__(self):super().__init__();self.refs=[]
  def handle_starttag(self,tag,attrs):
   self.refs.extend(value for key,value in attrs if key in {'src','href'} and value)
 with ThreadingHTTPServer(('127.0.0.1',0),partial(QuietHandler,directory=str(release.parent))) as pages:
  worker=Thread(target=pages.serve_forever,daemon=True);worker.start()
  try:
   base=f'http://127.0.0.1:{pages.server_port}/'+quote(release.name)+'/'
   for name,digest in manifest['sha256'].items():
    with urllib.request.urlopen(base+quote(name),timeout=5) as response:
     assert response.status==200 and hashlib.sha256(response.read()).hexdigest()==digest,name
   refs=set()
   for name in manifest['sha256']:
    file=release/name
    if file.suffix not in {'.html','.css','.webmanifest'}:continue
    text=file.read_text()
    if file.suffix=='.html':
     parser=Links();parser.feed(text);links=parser.refs
    elif file.suffix=='.webmanifest':links=[i['src'] for i in json.loads(text).get('icons',[])]
    else:links=re.findall(r'url\([\"\']?([^\"\')]+)',text)
    refs.update(urljoin(base+quote(name),ref) for ref in links if not ref.startswith(('data:','#')))
   for ref in refs:
    if urlparse(ref).netloc!=urlparse(base).netloc:continue
    assert urlparse(ref).path.startswith(urlparse(base).path),ref
    try:
     with urllib.request.urlopen(ref,timeout=5) as response:
      assert response.status==200,ref
      response.read()
    except OSError as exc:raise AssertionError(f'Broken local reference: {ref}') from exc
  finally:pages.shutdown();worker.join()
 print(f'PASS: project subpath HTTP: {len(manifest["sha256"])} exact files and local HTML/CSS links')
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
 result={'status':'PASS','cards_with_http_200_image_webp':len(words),'release_files_hash_verified':len(manifest['sha256']),'existing_asset_hashes_preserved':len(baseline['images']),'attribution_entries':len(words),'browser_visual_check':'not performed by this HTTP verifier','release':manifest['release']}
 (ROOT/'reports/photo-release-validation.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n');print(json.dumps(result,indent=2))
if __name__=='__main__':main()
