"""Run with: python3 -m unittest discover -s tests -v"""
import http.cookiejar
import json
import os
import pathlib
import socket
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from urllib.parse import quote
import re
import unicodedata

ROOT=pathlib.Path(__file__).resolve().parents[1]

class ServerTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory()
  sock=socket.socket();sock.bind(('127.0.0.1',0));cls.port=sock.getsockname()[1];sock.close()
  cls.url=f'http://127.0.0.1:{cls.port}'
  env={**os.environ,'PORT':str(cls.port),'HOST':'127.0.0.1','SVENSKA_DB':str(pathlib.Path(cls.temp.name)/'test.sqlite3')}
  cls.proc=subprocess.Popen(['python3',str(ROOT/'server.py')],cwd=cls.temp.name,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
  for _ in range(60):
   try:urllib.request.urlopen(cls.url+'/api/health',timeout=.3);break
   except Exception:time.sleep(.1)
  else:raise RuntimeError('Server did not start')
 @classmethod
 def tearDownClass(cls):
  cls.proc.terminate();cls.proc.wait(timeout=5);cls.temp.cleanup()
 def client(self):
  return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
 def get(self,op,path):return json.load(op.open(self.url+path,timeout=5))
 def post(self,op,path,body):return json.load(op.open(urllib.request.Request(self.url+path,json.dumps(body).encode(),{'Content-Type':'application/json'},method='POST'),timeout=5))
 def test_accounts_and_persistence(self):
  a,b=self.client(),self.client()
  self.assertIsNone(self.get(a,'/api/session')['user'])
  ua=self.post(a,'/api/register',{'name':'Anna','email':'anna@example.com','password':'secretpassword'})
  ub=self.post(b,'/api/register',{'name':'Boris','email':'boris@example.com','password':'secretpassword'})
  self.assertNotEqual(ua['user']['id'],ub['user']['id'])
  state=ua['state'];state['known']=['v-köpa'];state['completed']=['lesson-1'];state['xp']=120;state['activity']={'2026-10-12':3};state['booksRead']=['book-1']
  self.assertTrue(self.post(a,'/api/state',{'state':state})['ok'])
  self.assertEqual(self.get(a,'/api/session')['state']['xp'],120)
  self.assertEqual(self.get(a,'/api/session')['state']['booksRead'],['book-1'])
  self.assertEqual(self.get(b,'/api/session')['state']['xp'],0)
  self.post(a,'/api/logout',{})
  self.assertIsNone(self.get(a,'/api/session')['user'])
  self.assertEqual(self.post(a,'/api/login',{'email':'anna@example.com','password':'secretpassword'})['state']['known'],['v-köpa'])
 def test_weak_password_and_guest_storage(self):
  x=self.client()
  with self.assertRaises(urllib.error.HTTPError) as err:
   self.post(x,'/api/register',{'name':'Test','email':'test@example.com','password':'123'})
  self.assertEqual(err.exception.code,400)
  err.exception.close()
  with self.assertRaises(urllib.error.HTTPError) as err:
   self.post(x,'/api/state',{'state':{'known':[]}})
  self.assertEqual(err.exception.code,401)
  err.exception.close()
 def test_all_static_resources_and_photo_urls(self):
  paths=['/','/sw.js','/style.css?v=43','/studio.css','/atelier.css','/learning-polish.css','/atelier.js','/learning-polish.js','/custom-controls.js','/flashcard-media.js','/locale-content.js','/word-icons.js','/privacy.html','/terms.html','/cookies.html','/photo-credits.html','/assets/avatars/pippi-cartoon.png','/assets/flashcards/photo-credits-imported.json','/assets/flashcards/photo-credits-added.json']
  urls=re.findall(r'"[^"\n]+": "(\./assets/flashcards/[^"\n]+)"',(ROOT/'flashcard-media.js').read_text())
  paths += ['/'+url.removeprefix('./') for url in urls]
  paths += ['/'+quote(str(p.relative_to(ROOT))) for p in (ROOT/'assets/word-icons').glob('*.webp')]
  paths += ['/'+quote(unicodedata.normalize('NFD','assets/flashcards/w-åtta.webp'))]
  for path in paths:
   with self.subTest(path=path):
    with urllib.request.urlopen(self.url+path,timeout=5) as response:
     self.assertEqual(response.status,200)
     self.assertGreater(len(response.read()),0)
     self.assertNotIn('application/octet-stream',response.headers['Content-Type'])
  for path in ['/','/index.html','/sw.js','/app.js?v=50','/style.css?v=43']:
   with urllib.request.urlopen(self.url+path) as response:self.assertEqual(response.headers['Cache-Control'],'no-cache')
 def test_private_files_and_traversal(self):
  for path in ['/server.py','/.git/config','/SUPABASE_SETUP.sql','/assets/flashcards/../../server.py','/assets/flashcards/%2e%2e/%2e%2e/server.py','/assets/%252e%252e/server.py','/assets/%00.webp','/assets/flashcards/..%5c..%5cserver.py']:
   with self.subTest(path=path):
    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(self.url+path)
    self.assertEqual(error.exception.code,404)
    error.exception.close()
  with tempfile.TemporaryDirectory() as temp:
   secret=pathlib.Path(temp)/'outside.webp';secret.write_text('private')
   link=ROOT/'assets/flashcards/test-outside-link.webp'
   try:
    link.symlink_to(secret)
    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(self.url+'/assets/flashcards/test-outside-link.webp')
    self.assertEqual(error.exception.code,404)
    error.exception.close()
   finally:link.unlink(missing_ok=True)
 def test_busy_port_does_not_claim_start_or_create_database(self):
  unused_db=pathlib.Path(self.temp.name)/'must-not-create.sqlite3'
  env={**os.environ,'PORT':str(self.port),'HOST':'127.0.0.1','SVENSKA_DB':str(unused_db)}
  result=subprocess.run(['python3',str(ROOT/'server.py')],cwd=self.temp.name,env=env,capture_output=True,text=True,timeout=10)
  self.assertNotEqual(result.returncode,0)
  self.assertIn('Cannot start',result.stderr)
  self.assertNotIn('running at',result.stdout)
  self.assertFalse(unused_db.exists())

 def test_static_data(self):
  x=self.client()
  self.assertGreaterEqual(len(self.get(x,'/words.json')),1000)
  self.assertEqual(len(self.get(x,'/lessons.json')),50)
  self.assertEqual(len(self.get(x,'/books.json')),12)
  self.assertTrue(all('why' in q for l in self.get(x,'/lessons.json') for q in l['questions']))
  self.assertTrue(self.get(x,'/api/health')['ok'])

 def test_versioned_javascript_bytes_and_mime(self):
  # Fetch the exact URL reported by the browser, not a VM or mocked fetch.
  for name in ['supabase-progress.js','supabase-rpc.js','supabase-auth.js','supabase-client.js','app.js','study-time.js']:
   with self.subTest(name=name):
    with urllib.request.urlopen(self.url+'/'+name+'?v=2026-10-18-word-state-2') as response:
     self.assertEqual(response.status,200)
     self.assertEqual(response.headers.get_content_type(),'text/javascript')
     self.assertEqual(response.read(),(ROOT/name).read_bytes())
     self.assertEqual(response.headers['Cache-Control'],'no-cache')
     self.assertEqual(response.headers['X-Content-Type-Options'],'nosniff')
  with urllib.request.urlopen(self.url+'/') as response:
   self.assertIn('./supabase-progress.js?v=2026-10-18-word-state-2',response.read().decode())

 def test_http_progress_module_exposes_local_debug_status(self):
  # Execute bytes fetched from the real HTTP server in a JS global context.
  # This verifies module loading/API availability, not a graphical browser.
  with urllib.request.urlopen(self.url+'/supabase-progress.js?v=1') as response:
   source=response.read().decode('utf-8')
  script="""const vm=require('node:vm'),assert=require('node:assert/strict');
const source=require('node:fs').readFileSync(0,'utf8');
const scope={window:{},document:{},location:{hostname:'127.0.0.1',protocol:'http:'}};
vm.runInNewContext(source,scope,{filename:'supabase-progress.js from HTTP'});
for(const method of ['status','queue','diagnostics'])assert.equal(typeof scope.window.SVProgressDebug[method],'function');
assert.equal(scope.window.SVProgressDebug.moduleVersion,'2026-10-18-word-state-2');
assert.equal(scope.window.SVProgressDebug.status().status,'idle');
"""
  result=subprocess.run(['node','-e',script],input=source,text=True,capture_output=True,timeout=10)
  self.assertEqual(result.returncode,0,result.stderr)

 def test_photo_bytes_mime_and_unicode_paths(self):
  # Include the encoded Swedish filenames used by the live flashcard registry.
  for filename in ['work.webp','v-prata.webp','v-fråga.webp','w-åtta.webp','w-röd.webp']:
   for spelling in [filename,unicodedata.normalize('NFD',filename)]:
    with self.subTest(filename=spelling):
     with urllib.request.urlopen(self.url+'/assets/flashcards/'+quote(spelling)+'?v=http-test') as response:
      self.assertEqual(response.status,200)
      self.assertEqual(response.headers.get_content_type(),'image/webp')
      self.assertEqual(response.read(),(ROOT/'assets/flashcards'/filename).read_bytes())

 def test_supabase_modules_and_csp(self):
  for name in ['supabase-client.js','supabase-auth.js','supabase-rpc.js','supabase-progress.js']:
   with self.subTest(name=name):
    with urllib.request.urlopen(self.url+'/'+name) as response:
     self.assertEqual(response.status,200)
     self.assertIn('javascript',response.headers['Content-Type'])
     csp=response.headers['Content-Security-Policy']
     self.assertIn("script-src 'self' https://cdn.jsdelivr.net",csp)
     self.assertIn("connect-src 'self' https://*.supabase.co wss://*.supabase.co",csp)

 def test_worker_csp_allows_existing_external_photo_fetches(self):
  # Worker fetch() uses its script response's connect-src, not just img-src.
  for path in ['/','/sw.js']:
   with self.subTest(path=path):
    with urllib.request.urlopen(self.url+path) as response:
     csp={parts[0]:parts[1:] for directive in response.headers['Content-Security-Policy'].split(';') if (parts:=directive.split())}
     for origin in ['https://images.pexels.com','https://upload.wikimedia.org']:
      self.assertIn(origin,csp['connect-src'])
      self.assertIn(origin,csp['img-src'])
     self.assertNotIn('*',csp['connect-src'])

if __name__=='__main__':unittest.main()
