/* Svenska Lätt Atelier: visual enhancement only. No changes to answers, persistence or authentication. */
'use strict';
(()=>{
const pex=(id,w=620)=>`https://images.pexels.com/photos/${id}/${({159711:'books-bookstore-book-reading-159711.jpeg',34950:'pexels-photo.jpg'})[id]||('pexels-photo-'+id+'.jpeg')}?auto=compress&cs=tinysrgb&w=${w}`;
const PH={
 hero:pex(37021546,1400),
 lessons:pex(5212330), topics:pex(5905555),dictionary:pex(6238048),practice:pex(5428263),reviews:pex(3769021),
 videos:pex(7991579),books:pex(159711),rules:pex(6238297),alphabet:pex(5428010),numbers:pex(4386370),cheats:pex(5905483),
 family:pex(4262425),home:pex(106399),room:pex(1571460),school:pex(5212331),colors:pex(300857),calendar:pex(5940831),
 food:pex(1640774),drink:pex(70497),shop:pex(264507),health:pex(7088484),body:pex(4473868),
 feelings:pex(4262423),communication:pex(3184298),work:pex(3184465),transport:pex(210182),travel:pex(3155666),
 animals:pex(406014),nature:pex(34950),weather:pex(1118873),city:pex(466685),tech:pex(1181244),clothes:pex(7679863),
 sport:pex(3764164),reading:pex(159711), grammar:pex(5905483), questions:pex(5428004), time:pex(277390)
};
const ACTION={lessons:'lessons',topics:'topics',dictionary:'dictionary',practice:'practice',reviews:'reviews',videos:'videos',books:'books',rules:'rules',alphabet:'alphabet'};
const CATEGORY={
 'Дом':'home','Дом и комнаты':'room','Место':'city','Местоимения':'family','Вопросы':'questions',
 'Учёба':'school','Школа и SFI':'school','Цвета':'colors','Цвета и формы':'colors','Время':'time',
 'Дни и календарь':'calendar','Числа':'numbers','Количество':'numbers','Счёт и количество':'numbers',
 'Магазин':'shop','Магазин и покупки':'shop','Еда':'food','Еда и напитки':'drink','Досуг':'sport','Досуг и спорт':'sport',
 'Здоровье':'health','Тело':'body','Чувства':'feelings','Общение':'communication','Общение и чувства':'communication',
 'Общество':'city','Работа':'work','Связки':'grammar','Предлоги':'grammar','Глаголы':'reading','Существительные':'reading',
 'Прилагательные':'colors','Транспорт':'transport','Путешествия':'travel','Животные':'animals','Природа':'nature',
 'Погода':'weather','Город и места':'city','Техника':'tech','Одежда':'clothes','Быт и дела':'room'
};
// Each topic has its own photograph, including topics sharing a vocabulary category.
const TOPIC_PHOTOS={
 'Глаголы':pex(3769021),'Существительные':PH.reading,'Общение':PH.communication,
 'Время':PH.time,'Еда':PH.food,'Числа':PH.numbers,'Цвета':PH.colors,
 'Прилагательные':pex(845451),'Чувства':PH.feelings,'Здоровье':PH.health,
 'Местоимения':pex(5212345),'Вопросы':PH.questions,'Дом':PH.home,
 'Место':pex(6147369),'Предлоги':pex(271618),'Связки':PH.grammar,
 'Количество':pex(4386467),'Магазин':PH.shop,'Одежда':PH.clothes,
 'Погода':PH.weather,'Семья':PH.family,'Транспорт':PH.transport,
 'Тело':PH.body,'Учёба':PH.lessons,'Техника':PH.tech,
 'Досуг':pex(1386604),'Природа':PH.nature,'Животные':PH.animals,
 'Школа и SFI':PH.school,'Дом и комнаты':PH.room,'Еда и напитки':PH.drink,
 'Магазин и покупки':pex(4386431),'Дни и календарь':PH.calendar,'Работа':PH.work,
 'Город и места':PH.city,'Цвета и формы':pex(5303566),'Быт и дела':pex(6238130),
 'Досуг и спорт':PH.sport,'Общение и чувства':pex(7092613),'Общество':pex(7092359),
 'Счёт и количество':pex(5427860),'Путешествия':PH.travel
};
const LEVELS=[pex(5212330),pex(6238130),pex(3184298),pex(7092613)];
const LESSONS=[
  pex(5212330),pex(5428010),pex(5940831),pex(4262425),pex(5212345),pex(1640774),pex(264507),
  pex(7088484),pex(210182),pex(3764164),pex(7679863),pex(3184465),pex(1118873),pex(106399),
  pex(4386467),pex(5303566),pex(3184298),pex(5428004),pex(5905709),pex(1118873),pex(4386370),
  pex(6238297),pex(3155666),pex(1181244),pex(34950),pex(159711),pex(5905483),pex(5212700),
  pex(7088484),pex(5905555),pex(6238048),pex(5427860),pex(5427891),pex(6147369),pex(845451),
  pex(4386431),pex(3769021),pex(5428263),pex(7092359),pex(4386467),pex(6238130),pex(5212695),
  pex(7679863),pex(7092613),pex(271618),pex(5905568),pex(5212331),pex(4262423),pex(1571460),pex(34950)
];
const VIDEOS=[
  pex(845451),pex(1386604),pex(5303566),pex(7092359),pex(6147369),pex(4386467),
  pex(7991579),pex(3184298),pex(5212345),pex(210182),pex(7088484),pex(5905709)
];
const CHEATS=[pex(5905483),pex(5428004),pex(5212695),pex(5427662),pex(5212700),pex(5905568),pex(6238297),pex(5428010),pex(5212345),pex(5905555),pex(5940831),pex(4386370)];
const MODES=[pex(5428263),pex(3769021),pex(4386431),pex(5428010),pex(159711),pex(5905555),pex(7088484),pex(3184298),pex(845451),pex(6238048),pex(5212345),pex(5905483),pex(4386467),pex(5212700)];
const escAttr=s=>String(s||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const hash=s=>[...String(s||'')].reduce((n,c)=>((n*31+c.codePointAt(0))>>>0),17);
const picker={
 'bil':'transport','buss':'transport','tåg':'transport','cykel':'sport','flyg':'travel','flygplan':'travel',
 'hund':'animals','katt':'animals','fågel':'animals','fisk':'animals','häst':'animals','ko':'animals',
 'skola':'school','bok':'reading','lärare':'school','student':'school','penna':'school','läsa':'reading',
 'hus':'home','hem':'home','rum':'room','kök':'room','dörr':'home','fönster':'home','bord':'room',
 'mamma':'family','pappa':'family','barn':'family','familj':'family','vän':'communication',
 'vatten':'drink','kaffe':'drink','te':'drink','bröd':'food','mat':'food','mjölk':'drink',
 'äpple':'food','banan':'food','potatis':'food','köpa':'shop','handla':'shop','pengar':'shop',
 'arbeta':'work','jobba':'work','läkare':'health','sjuk':'health','sjukhus':'health',
 'sol':'weather','regn':'weather','snö':'weather','träd':'nature','blomma':'nature'
};
const photoForWord=w=>{
 const key=String(w?.word||'').toLowerCase().trim();const name=picker[key];
 const cat=CATEGORY[w?.category]||'reading';
 const fallback=PH[cat]||PH.reading;
 if(name)return PH[name]||fallback;
 // A small set of photos per semantic type keeps thumbnails varied, rather than repeating a single book.
 const choices={reading:[PH.reading,PH.school,PH.grammar],room:[PH.room,PH.home],communication:[PH.communication,PH.family],
  school:[PH.school,PH.lessons,PH.reading],food:[PH.food,PH.drink,PH.shop],health:[PH.health,PH.body],
  sport:[PH.sport,PH.nature],city:[PH.city,PH.travel,PH.transport],nature:[PH.nature,PH.weather],
  transport:[PH.transport,PH.travel],grammar:[PH.grammar,PH.questions,PH.reading]};
 const pool=choices[cat]||[fallback];return pool[hash(key)%pool.length];
};
function image(url,cl){const img=document.createElement('img');img.className=cl;img.src=url;img.alt='';img.loading='lazy';img.decoding='async';img.fetchPriority='low';img.referrerPolicy='no-referrer';img.onerror=()=>{img.style.display='none'};return img}
// Defer photographic CSS backgrounds until just before the card is visible.
// This is especially important for screens with 42+ topic cards and 1,006 words.
const backgrounds=new WeakMap();
const photoObserver=('IntersectionObserver' in window)?new IntersectionObserver(entries=>{
 for(const entry of entries){
  if(!entry.isIntersecting)continue;
  const url=backgrounds.get(entry.target);
  if(url)entry.target.style.setProperty('--photo',`url("${url}")`);
  backgrounds.delete(entry.target);photoObserver.unobserve(entry.target);
 }
},{rootMargin:'220px 0px',threshold:0}):null;
function back(el,url){
 if(!el||!url)return;
 if(!photoObserver){el.style.setProperty('--photo',`url("${url}")`);return}
 backgrounds.set(el,url);photoObserver.observe(el);
}
function tile(el,url){if(!el)return;back(el,url);el.style.setProperty('--tone',['#e5f4ff','#eafbf5','#fff3e6','#f4efff','#fcebf2','#eaf7fa'][hash(url)%6]);let d=el.querySelector(':scope > .photo-bg');if(!d){d=document.createElement('span');d.className='photo-bg';el.prepend(d)}back(d,url);if(!el.querySelector(':scope > .tile-fallback')){const f=document.createElement('span');f.className='tile-fallback';f.textContent=(el.querySelector('h3')?.textContent.trim().charAt(0)||'S').toUpperCase();el.appendChild(f)}if(!el.querySelector(':scope > .tile-photo'))el.appendChild(image(url,'tile-photo'))}
function enhanceHome(){const hero=document.querySelector('.hero');if(hero)hero.style.setProperty('--hero-photo',`url("${PH.hero}")`);
 document.querySelectorAll('.action-card').forEach(el=>tile(el,PH[ACTION[el.dataset.nav]]||PH.topics));
 document.querySelectorAll('.course-tile').forEach((el,i)=>tile(el,LEVELS[('ABCD'.indexOf(el.dataset.level)+4)%4]||LEVELS[i%4]));
}
function enhanceTopics(){document.querySelectorAll('.topic-card').forEach(el=>{const key=el.dataset.param||el.querySelector('h3')?.textContent?.trim();tile(el,TOPIC_PHOTOS[key]||PH[CATEGORY[key]]||PH.reading)})}
function enhanceLessons(){document.querySelectorAll('.lesson-card').forEach((el,i)=>{
 const num=el.querySelector('.lesson-cover small')?.textContent||''; const selected=(typeof routeParam==='string'&&/^[ABCD]$/.test(routeParam))?routeParam:(typeof selectedLevel!=='undefined'?selectedLevel:'A');
 const base={'A':0,'B':13,'C':26,'D':39}[selected]||0;const url=LESSONS[(base+i)%LESSONS.length];
 back(el,url);const cover=el.querySelector('.lesson-cover');back(cover,url);
 });}
function enhanceModes(){document.querySelectorAll('.mode-card').forEach((el,i)=>{
 back(el,MODES[i%MODES.length]);if(!el.querySelector(':scope > .tile-photo'))el.appendChild(image(MODES[i%MODES.length],'tile-photo'));
 });}
function enhanceVideos(){document.querySelectorAll('.video-card').forEach((el,i)=>{
 const art=el.querySelector('.video-art');back(art,VIDEOS[i%VIDEOS.length]);
 });}
function enhanceCheats(){document.querySelectorAll('.cheat-card').forEach((el,i)=>{
 const url=CHEATS[i%CHEATS.length];
 if(!el.querySelector(':scope > .tile-fallback')){const f=document.createElement('span');f.className='tile-fallback';f.textContent=(el.querySelector('h3')?.textContent.trim().charAt(0)||'S').toUpperCase();el.appendChild(f)}if(!el.querySelector(':scope > .tile-photo'))el.appendChild(image(url,'tile-photo'));
 });}
function enhanceBooks(){document.querySelectorAll('.book-card').forEach(el=>{
 const button=el.querySelector('[data-nav="book"]');
 if(button&&!el.dataset.visualClick){el.dataset.visualClick='1';el.tabIndex=0;el.setAttribute('role','link');
 el.addEventListener('click',e=>{if(!e.target.closest('a,button,input'))button.click()});
 el.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('a,button')){e.preventDefault();button.click()}})}
 });}
function enhanceNumbers(){document.querySelectorAll('.number-item strong').forEach(el=>{
 const n=el.textContent.trim().length;if(n>15)el.style.setProperty('font-size','13px','important');else if(n>11)el.style.setProperty('font-size','15px','important');
 });}
function decorateSlider(track){
 if(track.dataset.sliderReady)return;track.dataset.sliderReady='1';
 const circular=track.matches('.action-grid.action-grid-4,.topic-grid.premium-topics,.course-tiles');
 let cycle=0,settleTimer,down=false;
 const jump=left=>track.scrollTo({left,behavior:'instant'});
 const originals=[...track.children];
 const measureCycle=()=>originals.length?originals[0].getBoundingClientRect().left-track.children[0].getBoundingClientRect().left:0;
 const normalize=()=>{
  if(!circular||!cycle||down)return;
  const left=track.scrollLeft;
  if(left<cycle-.5||left>=cycle*2-.5){
   const offset=((left-cycle)%cycle+cycle)%cycle;
   jump(cycle+(cycle-offset<1?0:offset));
  }
 };
 if(circular&&originals.length>1){
  // Keep nth-child colours stable when inserting the surrounding cycles.
  originals.forEach(card=>{
   card.style.setProperty('background',getComputedStyle(card).background,'important');
   const letter=card.querySelector('.letter');
   if(letter)letter.style.setProperty('color',getComputedStyle(letter).color,'important');
  });
  const copy=card=>{
   const clone=card.cloneNode(true);clone.dataset.sliderClone='1';
   clone.setAttribute('aria-hidden','true');clone.setAttribute('tabindex','-1');
   clone.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));
   clone.removeAttribute('id');
   clone.querySelectorAll('button,a,input,select,[tabindex]').forEach(el=>el.setAttribute('tabindex','-1'));
   if(clone.classList.contains('topic-card'))tile(clone,TOPIC_PHOTOS[clone.dataset.param]||PH.reading);
   return clone;
  };
  track.prepend(...originals.map(copy));track.append(...originals.map(copy));
  cycle=measureCycle();jump(cycle);
  track.addEventListener('scroll',()=>{clearTimeout(settleTimer);settleTimer=setTimeout(normalize,160)},{passive:true});
  track.addEventListener('scrollend',normalize);
  new ResizeObserver(()=>{
   const next=measureCycle();if(!next||Math.abs(next-cycle)<.5)return;
   const position=cycle?(track.scrollLeft-cycle)/cycle:0;cycle=next;
   jump(cycle+((position%1+1)%1)*cycle);
  }).observe(track);
 }
 const section=track.previousElementSibling;
 let header=section?.classList?.contains('section-head')?section:null;
 if(!header && track.classList.contains('premium-topics')) { header=document.createElement('div');header.className='section-head topic-slider-head';const label=document.createElement('h2');label.textContent=({en:'Browse all topics',sv:'Bläddra bland ämnen',uk:'Переглянути всі теми',ru:'Листай все темы'})[document.documentElement.lang]||'Листай все темы';header.appendChild(label);track.parentElement.insertBefore(header,track); }
 if(header){const holder=document.createElement('div');holder.className='slider-tools';holder.innerHTML='<span class="slider-hint" aria-hidden="true">‹ ›</span><button class="slider-arrow" type="button" aria-label="Previous cards">‹</button><button class="slider-arrow" type="button" aria-label="Next cards">›</button>';
 header.appendChild(holder);
 const [prev,next]=holder.querySelectorAll('button');
 const update=()=>{prev.disabled=!circular&&track.scrollLeft<5;next.disabled=!circular&&track.scrollLeft+track.clientWidth>=track.scrollWidth-5};
 function shift(dir){const card=track.children[0];if(!card)return;normalize();const step=card.getBoundingClientRect().width+parseFloat(getComputedStyle(track).columnGap||0);track.scrollBy({left:step*dir,behavior:'smooth'})}
 prev.addEventListener('click',()=>shift(-1));next.addEventListener('click',()=>shift(1));track.addEventListener('scroll',update,{passive:true});requestAnimationFrame(update);
 }
 let origin=0,base=0,dragged=false;
 track.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0)return;origin=e.clientX;base=track.scrollLeft;dragged=false;down=true});
 track.addEventListener('pointermove',e=>{if(!down||e.pointerType!=='mouse')return;const delta=e.clientX-origin;if(Math.abs(delta)>5){dragged=true;track.scrollLeft=base-delta}});
 const stop=()=>{down=false;clearTimeout(settleTimer);settleTimer=setTimeout(normalize,160)};track.addEventListener('pointerup',stop);track.addEventListener('pointercancel',stop);track.addEventListener('pointerleave',stop);
 track.addEventListener('click',e=>{if(dragged){e.preventDefault();e.stopImmediatePropagation();dragged=false}},true);
}
function enhance(){enhanceHome();enhanceTopics();enhanceLessons();enhanceModes();enhanceVideos();enhanceCheats();enhanceBooks();enhanceNumbers();
 document.querySelectorAll('.action-grid.action-grid-4,.topic-grid.premium-topics,.course-tiles').forEach(decorateSlider);
}
window.svPhotoForWord=photoForWord;
/* Existing flashcard behaviour stays unchanged; only its old SVG artwork is replaced by real stock photography. */
if(typeof pic==='function'){pic=function(w,large=false){const url=typeof route!=='undefined'&&route==='flashcards'?(window.svFlashPhotoForWord?.(w)||null):photoForWord(w);if(!url)return '';return `<span class="photo-word"><img loading="lazy" src="${escAttr(url)}" alt="" onerror="this.style.display='none'"><span class="word-fallback">${escAttr((w.word||'S')[0].toUpperCase())}</span></span>`;}}
if(typeof render==='function'){
 const sourceRender=render;
 render=function(){sourceRender();enhance()};
}
const syncVisual=()=>{try{enhance()}catch(e){console.warn('Visual decoration:',e)}};
window.addEventListener('load',()=>requestAnimationFrame(syncVisual));
// Pages are decorated after the app render. Avoid observing our own image changes.
})();
