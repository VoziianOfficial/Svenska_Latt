#!/usr/bin/env python3
"""Build escaped, static photo credits and a private visual review gallery from saved evidence.
Requires Pillow. Does not fetch, replace or transform any existing photographs.
Run with the Python environment used for photo verification.
"""
import hashlib, html, json, re
from collections import Counter
from pathlib import Path
from urllib.parse import unquote, urlsplit
from html.parser import HTMLParser
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
def read(p):return json.loads((ROOT/p).read_text())
def save(p,x):(ROOT/p).write_text(json.dumps(x,ensure_ascii=False,indent=2)+'\n')
class Plain(HTMLParser):
 def __init__(self):super().__init__();self.parts=[]
 def handle_data(self,x):self.parts.append(x)
def clean(x):
 p=Plain();p.feed(str(x or ''));return re.sub(r'\s+',' ',html.unescape(' '.join(p.parts))).strip()
def e(x):return html.escape(str(x or ''),quote=True)
def link(url,label):
 if urlsplit(url or '').scheme not in ('https','http'):return e(label)
 return f'<a href="{e(url)}" rel="noreferrer">{e(label)}</a>'
def mapping():
 s=(ROOT/'flashcard-media.js').read_text();return dict(re.findall(r'"([^"\\]+)"\s*:\s*"([^"\\]+)"',re.search(r'const photos\s*=\s*Object.freeze\(\{(.*?)\}\);',s,re.S)[1]))
STYLE='''body{font:16px/1.65 system-ui,sans-serif;margin:0;background:linear-gradient(145deg,#f4f2ff,#ecf9ff);color:#292444}main{max-width:1040px;margin:4vh auto;padding:clamp(18px,4vw,42px);background:white;border-radius:25px;box-shadow:0 20px 60px #302b781a}a{color:#4a39ba;overflow-wrap:anywhere}h1{line-height:1.2}article{border-top:1px solid #ded6ff;padding:22px 0;display:flow-root;scroll-margin-top:20px}article img{width:144px;height:144px;object-fit:cover;float:left;margin:0 20px 14px 0;border-radius:14px}p{margin:6px 0;overflow-wrap:anywhere}small{color:#5c5d76}.notice{padding:15px;background:#fff5df;border-radius:12px}details{margin:10px 0}summary{cursor:pointer}input{padding:12px;width:min(90%,500px);font:inherit;border:1px solid #aaa;border-radius:10px}@media(max-width:650px){main{margin:10px}article img{width:110px;height:110px}}'''
def page(title,content,lang='ru'):
 return f'''<!doctype html><html lang="{lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{e(title)} | Svenska Lätt</title><link rel="icon" href="./favicon.svg"><style>{STYLE}</style></head><body><main><a href="./index.html#home">← Svenska Lätt</a><h1>{e(title)}</h1><p><label>Поиск / Search <input id="photo-search" type="search" placeholder="Слово, автор, лицензия"></label></p><p id="search-count" aria-live="polite"></p>{content}<script>const search=document.getElementById('photo-search');search.addEventListener('input',()=>{{const query=search.value.toLocaleLowerCase();let count=0;document.querySelectorAll('article').forEach(row=>{{row.hidden=!row.textContent.toLocaleLowerCase().includes(query);if(!row.hidden)count++;}});document.getElementById('search-count').textContent=String(count);}});</script></main></body></html>\n'''
def main():
 words=read('words.json');m=mapping();baseline=read('reports/photo-baseline.json');original=read('assets/flashcards/photo-credits-imported.json');added=read('assets/flashcards/photo-credits-added.json');credits=original|added
 evidence={}
 for f in (ROOT/'reports/commons-evidence').glob('batch-*.json'):
  for p in json.loads(f.read_text()).get('query',{}).get('pages',[]):evidence[str(p['pageid'])]=p
 for c in added.values():evidence[str(c['pageid'])]=c['commons_evidence']
 recovered={'lex-0361':('ocrho','missing-author-wikitext.json; I take this photo myself, user:ocrho'),'w-träd':('Jake N.','missing-author-wikitext.json; explicit Credit: Jake N.'),'lex-0192':('Stany Dederen','Commons Credit: Photo by Stany Dederen'),'lex-0226':('Rama','Commons Attribution: Photograph by Rama'),'lex-0342':('Mikko Hongisto','missing-author-wikitext.json; Photo taken by User:Emhoo|Mikko Hongisto'),'lex-0416':('Derek Jensen (Tysto)','missing-author-wikitext.json; Photo by Derek Jensen')}
 notes=read('reports/photo-review/visual-notes.json');records=[];visual=[];blocks=[];issues=[]
 for idx,w in enumerate(words,1):
  key=w['id'];url=m.get(key);assert url,key
  p=ROOT/unquote(url);assert p.is_file(),key
  with Image.open(p) as im:im.load();size=im.size
  r={'id':key,'word':w['word'],'translation':w.get('en',''),'mapped_url':url,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'dimensions':size,'technical_status':'decoded','visual_status':'manual-review' if key in notes else 'no-obvious-mismatch-at-contact-sheet-scale','visual_notes':notes.get(key,[])}
  c=credits.get(key)
  if c:
   pg=evidence.get(str(c['pageid']),{});info=pg.get('imageinfo',[{}])[0];raw=info.get('extmetadata',{});meta={k:clean(v.get('value','')) for k,v in raw.items()}
   author=(c.get('author','') if key in added else meta.get('Artist') or c.get('author',''));author_evidence='Commons Artist / original import'
   if not author and key in recovered:author,author_evidence=recovered[key]
   lic=meta.get('LicenseShortName') or c.get('license','');lic_url=meta.get('LicenseUrl') or c.get('license_url','')
   if lic_url.startswith('//'):lic_url='https:'+lic_url
   reasons=[]
   if not pg or not info:reasons.append('Нет актуальных метаданных источника')
   if not author:reasons.append('Достоверный автор не установлен')
   if lic!=c.get('license'):reasons.append('Лицензия источника отличается от импортного реестра')
   if not lic_url and lic.lower() not in ('public domain','cc0'):reasons.append('Нет ссылки на условия лицензии')
   r.update({'provenance':'downloaded','source':info.get('descriptionurl') or c.get('source',''),'title':pg.get('title') or c.get('commons_title',''),'author':author or None,'author_evidence':author_evidence if author else None,'license':lic,'license_url':lic_url,'original_license':c.get('license'),'source_checked_on':'2026-10-17','source_metadata_confirmed':bool(info),'notices':{k:meta[k] for k in ['Artist','Attribution','Credit','Copyrighted','Copyright','UsageTerms','Permission','Restrictions','License','ImageDescription'] if meta.get(k)},'issues':reasons,'changes':c.get('changes') or 'Локальная копия WebP. Импортёр предусматривает изменение размера и квадратное кадрирование; точная история старой копии не зафиксирована. В приложении используется дополнительное кадрирование фоном.'})
   if 'Wellcome' in r['title']:r['notices']['Credit line']='Barts Health NHS Trust Archive' if key=='w-lugn' else 'Wellcome Images'
   if 'BY-SA' in lic.upper():r['adaptation_license']=lic
   if reasons:issues.append({'id':key,'word':w['word'],'issues':reasons})
   parts=[f'<p><strong>Автор:</strong> {e(author or "Не установлен — сведения не выдумываются")}</p>',f'<p>{link(r["source"],r["title"])}</p>',f'<p><strong>Лицензия:</strong> {link(lic_url,lic)}. '+('Адаптация распространяется по этой же лицензии; сохраняйте атрибуцию и ссылку на лицензию.' if 'BY-SA' in lic.upper() else 'Для CC BY сохраняйте атрибуцию, лицензию и сведения об изменениях.' if 'BY' in lic.upper() else 'Статус указан источником Commons; смотрите основания на странице файла.')+'</p>',f'<p><small>{e(r["changes"])}</small></p>']
   if r['notices']:parts.append('<details><summary>Сведения и уведомления источника</summary>'+''.join(f'<p><strong>{e(k)}:</strong> {e(v)}</p>' for k,v in r['notices'].items())+'</details>')
   if reasons:parts.append('<p class="notice">Требуется проверка: '+e('; '.join(reasons))+'</p>')
  else:
   r.update({'provenance':'historical-generated','author':None,'license':None,'issues':['Историческая AI-генерация: внешняя лицензия и автор-фотограф не заявляются.'],'source':'assets/flashcards/generation-status.json / README.md'})
   parts=['<p>Локальное изображение из исторического набора AI-генерации проекта (generation-status.json и README). Для work.webp происхождение описано в README. Автор-фотограф и внешняя лицензия не установлены и не приписываются.</p>']
  blocks.append(f'<article id="{e(key)}"><a href="{e(url)}"><img src="{e(url)}" alt="{e(w["word"])}" loading="lazy" width="144" height="144"></a><h2>{e(w["word"])}</h2><small>{e(key)}</small>'+''.join(parts)+'</article>')
  records.append(r)
  visual.append({'index':idx,'id':key,'word':w['word'],'translation':w.get('en',''),'image':url,'status':r['visual_status'],'reasons':r['visual_notes'],'source_title':r.get('title','')})
 for name,digest in baseline['images'].items():assert hashlib.sha256((ROOT/name).read_bytes()).hexdigest()==digest,'Existing image changed: '+name
 for key,url in baseline['mapping'].items():assert m[key]==url,'Existing mapping changed: '+key
 summary={'cards':len(words),'working_images':len(records),'added':len(added),'existing_image_files_preserved':len(baseline['images']),'existing_mappings_preserved':len(baseline['mapping']),'visually_reviewed':len(visual),'flagged_for_manual_review':sum(bool(r['reasons']) for r in visual),'downloaded_records':len(credits),'source_metadata_checked':sum(r['provenance']=='downloaded' and r.get('source_metadata_confirmed',False) for r in records),'license_counts':dict(Counter(r.get('license') for r in records if r['provenance']=='downloaded')),'missing_authors':[r['id'] for r in records if r['provenance']=='downloaded' and not r['author']],'license_issues':issues,'historical_generated_bindings':len(words)-len(credits)}
 save('reports/photo-license-audit.json',{'summary':summary,'records':records});save('reports/photo-semantic-review.json',{'scope':'Визуальный просмотр всех карточек на контактных листах; миниатюры не гарантируют проверку мелких деталей. Метаданные использованы как дополнительный контекст. Отмечены явные и возможные несоответствия; замены не выполнялись.','summary':summary,'records':visual});save('reports/missing-photos.json',[])
 intro=f'<p>Источники изображений / Bildkällor / Photo credits. Проверка: 17 октября 2026. {len(credits)} скачанных фото, {len(words)-len(credits)} исторических привязок к AI-изображениям.</p><p>Для каждого скачанного файла ниже сохранены название работы, доступный автор, источник, версия лицензии и сведения об обработке. Неустановленный автор указан явно. Объекты, люди и организации на фото не подразумевают одобрения Svenska Lätt.</p><p>CC BY требует атрибуции, ссылки на лицензию и указания изменений. CC BY-SA дополнительно требует той же лицензии для адаптированной фотографии. Эти условия относятся к изображениям, а не ко всему приложению. Версия и юрисдикция указаны у каждого файла. '+link('https://creativecommons.org/licenses/by/4.0/','Условия CC BY')+' · '+link('https://creativecommons.org/licenses/by-sa/4.0/','Условия CC BY-SA')+' · '+link('https://creativecommons.org/publicdomain/zero/1.0/','CC0')+'</p><p class="notice">У '+str(len(summary['missing_authors']))+' скачанных файлов автор пока не установлен. Один прежний источник Commons не возвращается по сохранённому ID; его лицензия не переподтверждена. Исторические AI-изображения отмечены отдельно; страница не подтверждает очистку всех прав для запуска.</p>'
 (ROOT/'photo-credits.html').write_text(page('Фото и лицензии · Photo credits',intro+''.join(blocks)))
 review=[]
 for r in visual:
  if not r['reasons']:continue
  review.append(f'<article id="{e(r["id"])}"><a href="../{e(r["image"])}"><img src="../{e(r["image"])}" alt="{e(r["word"])}" loading="lazy" width="144" height="144"></a><h2>{e(r["word"])} — {e(r["translation"])}</h2><small>{e(r["id"])}</small><p>{e("; ".join(r["reasons"]))}</p><p><small>{e(r["source_title"])}</small></p><a href="../photo-credits.html#{e(r["id"])}">Источник и лицензия</a></article>')
 (ROOT/'reports/photo-review.html').write_text(page('Фотографии для ручного просмотра',f'<p>Просмотрено {len(visual)} карточек; отмечено {len(review)}. Существующие изображения и привязки сохранены. Это список сомнений, а не список автоматически подтверждённых ошибок. Отсутствие отметки означает отсутствие очевидной проблемы на контактном листе.</p>'+''.join(review)).replace('href="./index.html#home"','href="../index.html#home"').replace('href="./favicon.svg"','href="../favicon.svg"'))
 print(json.dumps({k:v for k,v in summary.items() if k not in ('license_counts','license_issues')},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
