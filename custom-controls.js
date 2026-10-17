/* Styled select menus; original controls retain their values and change handlers. */
'use strict';
(() => {
 const controls=new WeakMap();
 let current=null, serial=0, scheduled=false;
 const optionLabel=option=>option.label||option.textContent;
 function close(){
  if(!current)return;
  current.button.setAttribute('aria-expanded','false');
  current.button.removeAttribute('aria-activedescendant');
  current.menu.remove(); current=null;
 }
 function position(){
  if(!current)return;
  const {button,menu}=current, rect=button.getBoundingClientRect();
  const below=innerHeight-rect.bottom-12, above=rect.top-12;
  const up=below<180&&above>below;
  menu.style.width=Math.min(Math.max(rect.width,200),innerWidth-24)+'px';
  menu.style.maxHeight=Math.max(60,Math.min(300,up?above:below))+'px';
  menu.style.left=Math.max(12,Math.min(rect.left,innerWidth-menu.offsetWidth-12))+'px';
  menu.style.top=(up?rect.top-menu.offsetHeight-6:rect.bottom+6)+'px';
 }
 function highlight(index){
  if(!current)return;
  const {items,button}=current;
  current.index=index;
  items.forEach((item,i)=>item.classList.toggle('is-active',i===index));
  if(items[index]){
   button.setAttribute('aria-activedescendant',items[index].id);
   items[index].scrollIntoView({block:'nearest'});
  }
 }
 function choose(index){
  if(!current)return;
  const {select,button,options}=current;
  const option=options[index];
  if(!option||option.disabled||option.parentElement.disabled)return;
  const changed=select.selectedIndex!==option.index;
  select.selectedIndex=option.index;
  close(); sync(select); button.focus({preventScroll:true});
  if(changed){
   select.dispatchEvent(new Event('input',{bubbles:true}));
   select.dispatchEvent(new Event('change',{bubbles:true}));
  }
 }
 function open(select,button){
  close();
  const menu=document.createElement('div');
  menu.className='select-menu'; menu.id=button.getAttribute('aria-controls');
  menu.setAttribute('role','listbox');
  menu.setAttribute('aria-label',button.getAttribute('aria-label')||button.textContent);
  const options=Array.from(select.options).filter(o=>!o.hidden&& !o.parentElement.hidden);
  const items=options.map((option,index)=>{
   const item=document.createElement('div');
   item.className='select-menu-option'; item.id=menu.id+'-'+index;
   item.setAttribute('role','option');
   item.setAttribute('aria-selected',String(option.selected));
   item.setAttribute('aria-disabled',String(option.disabled||!!option.parentElement.disabled));
   const label=document.createElement('span'); label.textContent=optionLabel(option); item.append(label);
   item.addEventListener('pointermove',()=>highlight(index));
   item.addEventListener('pointerdown',e=>e.preventDefault());
   item.addEventListener('click',()=>choose(index));
   menu.append(item); return item;
  });
  document.body.append(menu);
  current={select,button,menu,options,items,index:-1,search:'',lastTyped:0};
  button.setAttribute('aria-expanded','true');
  position(); highlight(options.findIndex(o=>o.selected));
 }
 function sync(select){
  const control=controls.get(select); if(!control)return;
  const label=Array.from(select.selectedOptions).map(optionLabel).join(', ');
  if(control.label.textContent!==label)control.label.textContent=label;
  if(control.button.disabled!==select.disabled)control.button.disabled=select.disabled;
  if(control.button.hidden!==select.hidden)control.button.hidden=select.hidden;
  const name=select.getAttribute('aria-label')||Array.from(select.labels||[]).map(l=>l.textContent.trim()).join(' ')||select.title;
  if(name&&control.button.getAttribute('aria-label')!==name+': '+label)control.button.setAttribute('aria-label',name+': '+label);
 }
 function enhance(select){
  if(controls.has(select)){sync(select);return;}
  if(select.multiple||select.size>1)return;
  const button=document.createElement('button'), label=document.createElement('span');
  button.type='button'; button.className=select.className+' custom-select';
  button.style.cssText=select.style.cssText;
  button.setAttribute('role','combobox'); button.setAttribute('aria-haspopup','listbox');
  button.setAttribute('aria-expanded','false'); button.setAttribute('aria-controls','select-menu-'+(++serial));
  label.className='custom-select-label'; button.append(label);
  select.classList.add('custom-select-source'); select.setAttribute('aria-hidden','true'); select.tabIndex=-1;
  select.after(button); controls.set(select,{button,label}); sync(select);
  select.addEventListener('change',()=>sync(select));
  button.addEventListener('click',e=>{
   e.preventDefault();
   if(current?.button===button)close();else open(select,button);
  });
  button.addEventListener('keydown',e=>{
   const isOpen=current?.button===button;
   if(e.key==='Tab'){close();return;}
   if(e.key==='Escape'){if(isOpen){e.preventDefault();e.stopPropagation();close();}return;}
   if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
    e.preventDefault();if(!isOpen)open(select,button);
    const eligible=current.options.map((o,i)=>!o.disabled&&!o.parentElement.disabled?i:-1).filter(i=>i>=0);
    const at=eligible.indexOf(current.index);
    const next=e.key==='Home'?eligible[0]:e.key==='End'?eligible.at(-1):eligible[Math.max(0,Math.min(eligible.length-1,at+(e.key==='ArrowDown'?1:-1)))];
    if(next!==undefined)highlight(next);return;
   }
   if((e.key==='Enter'||e.key===' ')&&isOpen){e.preventDefault();choose(current.index);return;}
   if(e.key.length===1&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&e.key!==' '){
    e.preventDefault();if(!isOpen)open(select,button);
    const now=Date.now();current.search=(now-current.lastTyped>700?'':current.search)+e.key.toLocaleLowerCase();current.lastTyped=now;
    const match=current.options.findIndex(o=>!o.disabled&&!o.parentElement.disabled&&optionLabel(o).toLocaleLowerCase().startsWith(current.search));
    if(match>=0)highlight(match);
   }
  });
 }
 function refresh(){
  scheduled=false;
  if(current&&!current.button.isConnected)close();
  document.querySelectorAll('select').forEach(enhance);
 }
 new MutationObserver(records=>{
  if(current&&records.some(r=>r.target===current.select||current.select.contains(r.target)))close();
  if(!scheduled){scheduled=true;requestAnimationFrame(refresh);}
 }).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['disabled','hidden','selected','aria-label']});
 document.addEventListener('pointerdown',e=>{if(current&&!current.button.contains(e.target)&&!current.menu.contains(e.target))close();});
 document.addEventListener('focusin',e=>{if(current&&!current.button.contains(e.target))close();});
 window.addEventListener('resize',close);
 document.addEventListener('scroll',e=>{if(current&&!current.menu.contains(e.target))close();},true);
 document.addEventListener('reset',()=>requestAnimationFrame(refresh));
 refresh();
})();
