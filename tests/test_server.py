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
  cls.proc=subprocess.Popen(['python3',str(ROOT/'server.py')],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
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
  paths=['/','/sw.js','/style.css?v=43','/studio.css','/atelier.css','/learning-polish.css','/atelier.js','/learning-polish.js','/flashcard-media.js','/locale-content.js','/word-icons.js','/privacy.html','/terms.html','/cookies.html','/assets/avatars/pippi-cartoon.png','/assets/flashcards/photo-credits-imported.json']
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
  for path in ['/','/index.html','/sw.js']:
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
 def test_static_data(self):
  x=self.client()
  self.assertGreaterEqual(len(self.get(x,'/words.json')),1000)
  self.assertEqual(len(self.get(x,'/lessons.json')),50)
  self.assertEqual(len(self.get(x,'/books.json')),12)
  self.assertTrue(all('why' in q for l in self.get(x,'/lessons.json') for q in l['questions']))
  self.assertTrue(self.get(x,'/api/health')['ok'])

if __name__=='__main__':unittest.main()
