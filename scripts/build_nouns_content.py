"""Original lesson-5 chapter. Local content only; no SQL, remote writes or manifest update."""
import json
from pathlib import Path
from nouns_theory import build_theory, T, S, E, L, W
from nouns_tasks import build_tasks
ROOT=Path(__file__).resolve().parents[1]
def main():
 lessons=json.loads((ROOT/'lessons.json').read_text())
 lesson=next(l for l in lessons if l['id']=='lesson-5')
 c=build_theory()
 from nouns_texts import add_texts
 add_texts(c)
 build_tasks(c)
 c.update(schemaVersion=1,id='nouns-en-ett-v1',chapterVersion=1,lessonId='lesson-5',level='A',locales=['ru','uk','en','sv'])
 lesson['nounsChapter']=c
 (ROOT/'lessons.json').write_text(json.dumps(lessons,ensure_ascii=False,indent=2)+'\n')
 print('lesson-5: original questions retained; '+str(sum(len(s['rules']) for s in c['sections']))+' rules, '+str(len(c['tables']))+' tables, '+str(len(c['questions']))+' practice, 24 final')
if __name__=='__main__':main()
