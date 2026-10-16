/* Svenska Lätt v11: accessible speech-speed controls, compact flashcards and calendar. */
'use strict';
(() => {
 const SPEEDS={verySlow:.56,slow:.76,normal:1};
 const KEY='svenska-latt-speech-speed';
 const VOICE_KEY='svenska-latt-swedish-voice';
 let selectedVoice=''; try{selectedVoice=localStorage.getItem(VOICE_KEY)||'';}catch(_){}
 let saved='slow';
 try{let s=localStorage.getItem(KEY);if(Object.hasOwn(SPEEDS,s)) saved=s;}catch(_){}
 const words={
  ru:{lab:'Скорость',verySlow:'Очень медленно',slow:'Медленно',normal:'Обычно',stop:'Остановить',voice:'Диктор',auto:'Автоматически'},
  en:{lab:'Playback speed',verySlow:'Very slow',slow:'Slow',normal:'Normal',stop:'Stop',voice:'Voice',auto:'Automatic'},
  sv:{lab:'Uppspelningshastighet',verySlow:'Mycket långsamt',slow:'Långsamt',normal:'Normal',stop:'Stoppa',voice:'Röst',auto:'Automatiskt'},
  uk:{lab:'Швидкість',verySlow:'Дуже повільно',slow:'Повільно',normal:'Звичайна',stop:'Зупинити',voice:'Голос',auto:'Автоматично'}
 };
 const lang=()=>{const s=typeof state==='object'?state?.settings?.language:null;return words[s]?s:(words[document.documentElement.lang]?document.documentElement.lang:'ru');};
 let currentAudio=0;
 function splitSpeech(text){
   let parts=String(text).replace(/\s+/g,' ').trim().match(/[^.!?;]+[.!?;]?/gu)||[String(text)];
   let chunks=[];let buffer='';
   for(let sentence of parts){
     sentence=sentence.trim();
     if(!sentence)continue;
     if(sentence.length>170){
       if(buffer){chunks.push(buffer);buffer='';}
       let bits=sentence.match(/.{1,145}(?:\s|$)|.{1,145}/gu)||[];
       chunks.push(...bits.map(x=>x.trim()).filter(Boolean)); continue;
     }
     if((buffer+' '+sentence).trim().length>170){chunks.push(buffer);buffer=sentence;}
     else buffer=(buffer+' '+sentence).trim();
   }
   if(buffer)chunks.push(buffer);
   return chunks;
 }
 function swedishVoices(){
   if(!('speechSynthesis' in window))return [];
   return speechSynthesis.getVoices().filter(v=>(v.lang||'').toLowerCase().startsWith('sv'));
 }
 function preferredVoice(){
   const all=swedishVoices();
   // A user-selected voice stays selected across lessons and sessions.
   const chosen=all.find(v=>v.voiceURI===selectedVoice);
   if(chosen)return chosen;
   all.sort((a,b)=>{
     const rank=v=>/premium|enhanced|natural|neural|siri/i.test(v.name)?3:/google|microsoft/i.test(v.name)?2:1;
     return rank(b)-rank(a);
   });return all[0]||null;
 }
 function play(text){
   if(!('speechSynthesis' in window)){if(typeof toast==='function')toast('⚠️');return;}
   const t=String(text||'').trim();if(!t)return;
   const token=++currentAudio;const queue=splitSpeech(t);
   const synth=window.speechSynthesis;synth.cancel();
   const v=preferredVoice();
   if(!v && synth.getVoices().length){if(typeof toast==='function')toast(typeof pT==='function'?pT('audioError'):'Swedish voice unavailable');return;}
   let i=0;
   const next=()=>{
     if(token!==currentAudio || i>=queue.length)return;
     const utterance=new SpeechSynthesisUtterance(queue[i++]);
     utterance.lang='sv-SE';utterance.rate=SPEEDS[saved];utterance.pitch=.97;
     if(v)utterance.voice=v;
     utterance.onend=next;
     utterance.onerror=(e)=>{if(token!==currentAudio || e.error==='canceled'||e.error==='interrupted')return;if(typeof toast==='function')toast(typeof pT==='function'?pT('audioError'):'Audio error');};
     synth.speak(utterance);
   };
   next();
 }
 // Keep all previously wired pronunciation buttons intact.
 if(typeof speak==='function')speak=play;
 const stop=()=>{currentAudio++;if('speechSynthesis' in window)speechSynthesis.cancel()};
 function audioUI(){
   const d=words[lang()]||words.ru;
   const voices=swedishVoices();
   const voiceUI=voices.length>1?`<label>${d.voice}<select class="speech-voice-select" aria-label="${d.voice}"><option value="">${d.auto}</option>${voices.map(v=>{
    const uri=String(v.voiceURI).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
    const name=String(v.name).replace(/&/g,'&amp;').replace(/</g,'&lt;');
    return `<option value="${uri}" ${selectedVoice===v.voiceURI?'selected':''}>${name}</option>`;
   }).join('')}</select></label>`:'';
   return `<div class="speech-speed"><label>${d.lab}<select class="speech-speed-select" aria-label="${d.lab}">
    ${Object.keys(SPEEDS).map(k=>`<option value="${k}" ${saved===k?'selected':''}>${d[k]}</option>`).join('')}
   </select></label>${voiceUI}<button type="button" class="speech-stop" data-speech-stop aria-label="${d.stop}" title="${d.stop}">■</button></div>`;
 }
 function addSpeedControllers(){
   const buttons=[...document.querySelectorAll('#page button[data-action="speak"]')];
   const long=buttons.filter(el=>(el.dataset.text||'').length>=55);
   if(long.length){
     for(let btn of long){
       if(btn.nextElementSibling?.classList?.contains('speech-speed'))continue;
       btn.insertAdjacentHTML('afterend',audioUI());
     }
   }
 }
 document.addEventListener('change',e=>{
   if(e.target.matches('.speech-voice-select')){
     const newValue=e.target.value;
     if(newValue && !swedishVoices().some(v=>v.voiceURI===newValue))return;
     selectedVoice=newValue;
     try{localStorage.setItem(VOICE_KEY,selectedVoice)}catch(_){}
     document.querySelectorAll('.speech-voice-select').forEach(x=>x.value=selectedVoice);
     stop(); return;
   }
   if(!e.target.matches('.speech-speed-select'))return;
   if(!Object.hasOwn(SPEEDS,e.target.value))return;
   saved=e.target.value;try{localStorage.setItem(KEY,saved)}catch(_){}
   document.querySelectorAll('.speech-speed-select').forEach(x=>x.value=saved);
   stop();
 });
 if('speechSynthesis' in window) speechSynthesis.addEventListener?.('voiceschanged',()=>{
   document.querySelectorAll('.speech-speed').forEach(x=>x.outerHTML=audioUI());
 });
 document.addEventListener('click',e=>{
   if(e.target.closest('[data-speech-stop]')){e.preventDefault();stop()}
 });
 function flashDesign(){
   const card=document.querySelector('#page .flash-card');if(!card)return;
   const row=card.closest('.flash-layout')?.querySelector('.split:has(#flash-kind)');if(row)row.classList.add('flash-compact-filters');
   const active=typeof flash!=='undefined'&&typeof getWord==='function'?getWord(flash.ids[flash.index]):null;
   const url=active&&typeof window.svFlashPhotoForWord==='function'?window.svFlashPhotoForWord(active):null;
   // The card starts with a neutral background while its exact image loads.
   card.style.removeProperty('--flash-photo');
   card.classList.remove('has-word-photo');
   if(!url)return;
   const photo=new Image();
   photo.onload=()=>{
     if(!card.isConnected)return;
     card.style.setProperty('--flash-photo',`url(${JSON.stringify(url)})`);
     card.classList.add('has-word-photo');
   };
   photo.src=url;
 }
 function updateDays(){
   // Continuous rolling calendar: past days + upcoming dates, never marking future visits.
   const dict={ru:['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],sv:['Sön','Mån','Tis','Ons','Tor','Fre','Lör'],uk:['Нд','Пн','Вт','Ср','Чт','Пт','Сб']};
   const labs=dict[lang()]||dict.ru;
   document.querySelectorAll('#page .daily-bar').forEach(grid=>{
     const month=grid.classList.contains('calendar-month');
     const n=month?28:14;
     const past=month?20:7;
     const today=new Date();today.setHours(12,0,0,0);
     const frag=document.createDocumentFragment();
     for(let i=0;i<n;i++){
       const shift=i-past;
       const d=new Date(today);d.setDate(today.getDate()+shift);
       const key=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
       const count=shift<=0?(state?.activity?.[key]||0):0;
       const col=document.createElement('div');col.className='day-col';
       const square=document.createElement('div');square.className='day-square'+(count?' done':'')+(shift>0?' upcoming':'')+(shift===0?' today':'');
       square.title=key+(count?' · '+count:'');square.innerHTML='<strong>'+labs[d.getDay()]+'</strong><span>'+d.getDate()+'</span>';
       col.appendChild(square);frag.appendChild(col);
     }
     grid.replaceChildren(frag);
   });
 }
 function polishSpeakButtons(){
   const icon='<svg class="speak-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
   document.querySelectorAll('#page button[data-action="speak"]').forEach(btn=>{
     if(btn.querySelector('.speak-icon'))return;
     if(btn.classList.contains('number-item')){
       const badge=btn.querySelector('span');
       if(badge){badge.classList.add('speak-badge');badge.innerHTML=icon;}
       return;
     }
     const label=btn.closest('.example-item')?'':btn.textContent.replace(/[🔊▶️]/gu,'').trim();
     btn.innerHTML=icon;
     if(label){const text=document.createElement('span');text.textContent=label;btn.appendChild(text);}
     else{
       btn.classList.add('speak-icon-only');
       if(!btn.hasAttribute('aria-label'))btn.setAttribute('aria-label',typeof t==='function'?t('speak'):'Listen');
       btn.title=btn.getAttribute('aria-label');
     }
     btn.type='button';
   });
 }
 function polish(){flashDesign();polishSpeakButtons();addSpeedControllers();updateDays();}
 if(typeof render==='function'){
   const previous=render;
   render=function(){previous();polish();};
 }
 // Existing DOM has already rendered during application startup.
 polish();
})();
