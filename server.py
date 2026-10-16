#!/usr/bin/env python3
"""Svenska Lätt: dependency-free local web server, per-user SQLite persistence."""
from __future__ import annotations
import base64, datetime, hashlib, hmac, json, mimetypes, os, re, secrets, sqlite3, sys, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from http.cookies import SimpleCookie
from pathlib import Path
from urllib.parse import urlparse
from zoneinfo import ZoneInfo
ROOT=Path(__file__).resolve().parent
DB=Path(os.environ.get('SVENSKA_DB',str(ROOT/'svenska.sqlite3')))
HOST=os.environ.get('HOST','127.0.0.1')
PORT=int(os.environ.get('PORT','8765'))
LOCK=threading.RLock()
STOCKHOLM=ZoneInfo('Europe/Stockholm')
DEFAULT={'known':[],'favorites':[],'reviews':{},'completed':[],'activity':{},'answered':0,'correct':0,'xp':0,'settings':{'language':'ru','level':'A'},'videos':[],'booksRead':[]}
def conn():
 c=sqlite3.connect(DB,timeout=15)
 c.row_factory=sqlite3.Row
 return c
def init_db():
 DB.parent.mkdir(parents=True,exist_ok=True)
 with conn() as c:
  c.execute('PRAGMA journal_mode=WAL')
  c.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL, state TEXT NOT NULL, created TEXT NOT NULL)')
  c.execute('CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL, expires INTEGER NOT NULL, FOREIGN KEY(user_id) REFERENCES users(id))')
  c.execute('CREATE TABLE IF NOT EXISTS failed_auth (ip TEXT PRIMARY KEY, tries INTEGER NOT NULL, reset INTEGER NOT NULL)')
def hash_password(pw,salt):return hashlib.pbkdf2_hmac('sha256',pw.encode('utf-8'),bytes.fromhex(salt),350000).hex()
def auth_cookies(handler):
 c=SimpleCookie()
 try:c.load(handler.headers.get('Cookie',''))
 except:return None
 token=c.get('svsession')
 return token.value if token else None
def current_user(h):
 t=auth_cookies(h)
 if not t:return None
 with conn() as c:
  r=c.execute('SELECT users.id,users.email,users.name,users.state FROM sessions JOIN users ON users.id=sessions.user_id WHERE token_hash=? AND expires>?',(hashlib.sha256(t.encode()).hexdigest(),int(time.time()))).fetchone()
 return dict(r) if r else None
def clean_state(s):
 if not isinstance(s,dict):raise ValueError('Invalid state')
 out=DEFAULT.copy()
 for key in ['known','favorites','completed','videos','booksRead']:
  v=s.get(key,[])
  if not isinstance(v,list):raise ValueError('Invalid list')
  out[key]=list(dict.fromkeys(str(x)[:100] for x in v if isinstance(x,str)))[:15000]
 reviews=s.get('reviews',{})
 if not isinstance(reviews,dict):raise ValueError('Invalid reviews')
 out['reviews']={}
 for k,v in list(reviews.items())[:12000]:
  if not isinstance(k,str) or not isinstance(v,dict):continue
  out['reviews'][k[:100]]={'due':max(0,min(int(v.get('due',0)),4102444800000)),'interval':max(0,min(int(v.get('interval',0)),365)),'ease':max(1.3,min(float(v.get('ease',2.5)),3)),'rep':max(0,min(int(v.get('rep',0)),10000))}
 dates=s.get('activity',{})
 if not isinstance(dates,dict):raise ValueError('Invalid dates')
 out['activity']={k:max(0,min(int(v),10000)) for k,v in list(dates.items())[:2000] if isinstance(k,str) and re.fullmatch(r'\d{4}-\d\d-\d\d',k)}
 for k in ('answered','correct','xp'):out[k]=max(0,min(int(s.get(k,0)),1000000000))
 settings=s.get('settings',{})
 if not isinstance(settings,dict):settings={}
 out['settings']={'language':settings.get('language') if settings.get('language') in ('ru','en','sv','uk') else 'ru','level':settings.get('level') if settings.get('level') in ('A','B','C','D') else 'A'}
 return out
class Handler(BaseHTTPRequestHandler):
 server_version='SvenskaLatt/2.0'
 def log_message(self,fmt,*args):sys.stderr.write('%s %s\n'%(self.address_string(),fmt%args))
 def headers_common(self,mime='application/json; charset=utf-8',length=None):
  self.send_header('Content-Type',mime)
  self.send_header('X-Content-Type-Options','nosniff')
  self.send_header('Referrer-Policy','strict-origin-when-cross-origin')
  self.send_header('X-Frame-Options','DENY')
  self.send_header('Content-Security-Policy',"default-src 'self'; img-src 'self' data: https://images.pexels.com; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://*.supabase.co wss://*.supabase.co; media-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
  self.send_header('Cache-Control','no-store' if mime.startswith('application/json') else 'public, max-age=300')
  if length is not None:self.send_header('Content-Length',str(length))
 def send_json(self,payload,status=200,cookie=None):
  b=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode()
  self.send_response(status);self.headers_common(length=len(b))
  if cookie is not None:self.send_header('Set-Cookie',cookie)
  self.end_headers();self.wfile.write(b)
 def error(self,status,msg):self.send_json({'ok':False,'error':msg},status)
 def do_GET(self):
  path=urlparse(self.path).path
  if path=='/api/session':
   user=current_user(self)
   if not user:return self.send_json({'ok':True,'user':None,'state':None})
   return self.send_json({'ok':True,'user':{'id':user['id'],'email':user['email'],'name':user['name']},'state':json.loads(user['state'])})
  if path=='/api/health':return self.send_json({'ok':True,'service':'Svenska Lätt'})
  if path=='/':path='/index.html'
  path=path.lstrip('/')
  if path not in {'index.html','style.css','app.js','words.json','lessons.json','books.json','favicon.svg','manifest.webmanifest','sw.js','supabase-config.js'}:return self.error(404,'Not found')
  f=ROOT/path
  if not f.is_file():return self.error(404,'Not found')
  b=f.read_bytes();mime=mimetypes.guess_type(path)[0] or 'application/octet-stream'
  if path.endswith('.js'):mime='text/javascript'
  if path.endswith('.webmanifest'):mime='application/manifest+json'
  self.send_response(200);self.headers_common(mime+'; charset=utf-8' if mime.startswith('text/') or 'json' in mime else mime,len(b));self.end_headers();self.wfile.write(b)
 def post_json(self):
  if int(self.headers.get('Content-Length','0'))>150000:raise ValueError('Payload too large')
  origin=self.headers.get('Origin')
  if origin:
   o=urlparse(origin); host=self.headers.get('Host','')
   if o.netloc!=host or o.scheme not in {'http','https'}:raise PermissionError('Origin not allowed')
  length=int(self.headers.get('Content-Length','0'))
  if length<=0:raise ValueError('Missing body')
  return json.loads(self.rfile.read(length))
 def set_cookie(self,token,max_age):
  is_secure=self.headers.get('X-Forwarded-Proto','').lower()=='https' or isinstance(self.connection, __import__('ssl').SSLSocket)
  return f'svsession={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age}'+('; Secure' if is_secure else '')
 def block_auth(self):
  ip=self.client_address[0];now=int(time.time())
  with conn() as c:
   r=c.execute('SELECT tries,reset FROM failed_auth WHERE ip=?',(ip,)).fetchone()
   return r is not None and r['reset']>now and r['tries']>=15
 def failed_auth(self):
  ip=self.client_address[0];now=int(time.time())
  with conn() as c:
   r=c.execute('SELECT tries,reset FROM failed_auth WHERE ip=?',(ip,)).fetchone()
   t=1 if not r or r['reset']<now else r['tries']+1
   c.execute('INSERT INTO failed_auth (ip,tries,reset) VALUES (?,?,?) ON CONFLICT(ip) DO UPDATE SET tries=?,reset=?',(ip,t,now+900,t,now+900))
 def do_POST(self):
  path=urlparse(self.path).path
  if path not in {'/api/register','/api/login','/api/logout','/api/state'}:return self.error(404,'Not found')
  try:
   data=self.post_json()
   if not isinstance(data,dict):raise ValueError('Expected object')
   if path in {'/api/register','/api/login'}:
    if self.block_auth():return self.error(429,'Too many attempts; try later')
    email=str(data.get('email','')).strip().lower()
    pw=data.get('password','')
    if not isinstance(pw,str) or len(pw)>128:return self.error(400,'Invalid password')
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254:return self.error(400,'Invalid email')
    with LOCK:
     with conn() as c:
      if path=='/api/register':
       name=str(data.get('name','')).strip()[:80]
       if len(name)<2:return self.error(400,'Name must have 2+ characters')
       if len(pw)<8:return self.error(400,'Password must have 8+ characters')
       salt=secrets.token_hex(16)
       try:
        cursor=c.execute('INSERT INTO users(email,name,salt,password,state,created) VALUES (?,?,?,?,?,?)',(email,name,salt,hash_password(pw,salt),json.dumps(DEFAULT),datetime.datetime.now(datetime.timezone.utc).isoformat()))
       except sqlite3.IntegrityError:return self.error(409,'Email already registered')
       uid=cursor.lastrowid
      else:
       u=c.execute('SELECT id,salt,password FROM users WHERE email=?',(email,)).fetchone()
       salt=u['salt'] if u else '0'*32
       good=hmac.compare_digest(hash_password(pw,salt),u['password'] if u else '0'*64)
       if not good:
        self.failed_auth();return self.error(401,'Invalid email or password')
       uid=u['id']
      token=secrets.token_urlsafe(32)
      c.execute('DELETE FROM sessions WHERE expires<?',(int(time.time()),))
      c.execute('INSERT INTO sessions(token_hash,user_id,expires) VALUES (?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),uid,int(time.time())+30*86400))
    u=current_user_with_id(uid)
    return self.send_json({'ok':True,'user':{'id':u['id'],'name':u['name'],'email':u['email']},'state':json.loads(u['state'])},cookie=self.set_cookie(token,30*86400))
   if path=='/api/logout':
    token=auth_cookies(self)
    if token:
     with conn() as c:c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
    return self.send_json({'ok':True},cookie=self.set_cookie('',0))
   user=current_user(self)
   if not user:return self.error(401,'Please sign in')
   cleaned=clean_state(data.get('state'))
   with conn() as c:c.execute('UPDATE users SET state=? WHERE id=?',(json.dumps(cleaned,ensure_ascii=False,separators=(',',':')),user['id']))
   return self.send_json({'ok':True})
  except PermissionError as e:return self.error(403,str(e))
  except (ValueError,TypeError,KeyError,OverflowError,json.JSONDecodeError) as e:return self.error(400,str(e))
  except Exception as e:
   self.log_message('server error %s',e);return self.error(500,'Server error')
def current_user_with_id(uid):
 with conn() as c:return dict(c.execute('SELECT id,name,email,state FROM users WHERE id=?',(uid,)).fetchone())
if __name__=='__main__':
 init_db();print(f'Svenska Lätt running at http://{HOST}:{PORT}',flush=True)
 try:ThreadingHTTPServer((HOST,PORT),Handler).serve_forever()
 except KeyboardInterrupt:print('Stopped')
