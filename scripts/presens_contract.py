"""Reconstruct archived 021 source for comparison, NEVER a production observation."""
from pathlib import Path
import hashlib
import re

ROOT=Path(__file__).resolve().parents[1]
def body(s,name,d):
 return re.search(r'create or replace function '+re.escape(name)+r'.*?as '+re.escape(d)+r'(.*?)'+re.escape(d)+r';',s,re.S|re.I)[1]
def literal(s,name,d):
 return re.search(name+r' constant text := '+re.escape(d)+r'(.*?)'+re.escape(d),s,re.S)[1]
def md5(s):return hashlib.md5(s.encode()).hexdigest()
def installed_021_source():
 s12=(ROOT/'supabase/migrations/202610180012_xp_integrity.sql').read_text()
 s14=(ROOT/'supabase/migrations/202610190014_video_progress.sql').read_text()
 s20=(ROOT/'supabase/migrations/202611160020_greetings_introduction.sql').read_text()
 s21=(ROOT/'supabase/migrations/202611220021_pronouns.sql').read_text()
 reader=body(s14,'public.sl_get_progress()','$$')
 for old,new in [(literal(s20,'caps14','$old$'),literal(s20,'caps20','$new$')),(literal(s20,'old_return','$old$'),literal(s20,'return14','$new$')),(literal(s21,'old_caps','$old$'),literal(s21,'new_caps','$new$')),(literal(s21,'old_return','$old$'),literal(s21,'new_return','$new$'))]:
  assert reader.count(old)==1
  reader=reader.replace(old,new)
 writer=body(s12,'public.sl_apply_event','$$')
 pairs=[(literal(s14,'old_clause','$old$'),literal(s14,'new_clause','$new$'))]+[(literal(s21,'old_'+str(i),'$old$'),literal(s21,'new_'+str(i),'$new$')) for i in range(4)]
 for old,new in pairs:
  assert writer.count(old)==1
  writer=writer.replace(old,new)
 return dict(manifest=body(s21,'sl_private.manifest()','$function$'),catalog=body(s21,'sl_private.quiz_catalog()','$function$'),reader=reader,writer=writer)
