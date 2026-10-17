const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
class Element {
 constructor(tag='div') {this.tagName=tag;this.attrs={};this.children=[];this.events={};this.style={};this.disabled=false;this.hidden=false;this.isConnected=true;this.className='';this.textContent='';this.classList={add:()=>{},toggle:()=>{}};}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k]??null;}
 removeAttribute(k){delete this.attrs[k];}
 append(child){this.children.push(child);child.parentElement=this;}
 after(child){this.replacement=child;}
 remove(){this.isConnected=false;}
 contains(node){return node===this||this.children.some(child=>child.contains(node));}
 addEventListener(type,fn){(this.events[type]??=[]).push(fn);}
 dispatchEvent(event){for(const fn of this.events[event.type]||[])fn(event);return true;}
 fire(type,extra={}){let prevented=false;this.dispatchEvent({type,target:this,preventDefault(){prevented=true;},stopPropagation(){},...extra});return prevented;}
 focus(){document.activeElement=this;}
 scrollIntoView(){}
 getBoundingClientRect(){return {left:20,top:20,bottom:63,width:220};}
 get offsetWidth(){return parseInt(this.style.width)||220;}
 get offsetHeight(){return 180;}
}
const select=new Element('select');select.className='form-select';select.setAttribute('aria-label','Cards type');
select.options=['All cards','Verbs','Nouns','Other'].map((label,index)=>Object.assign(new Element('option'),{label,index,parentElement:select}));
select.selectedIndex=0;
for(const option of select.options)Object.defineProperty(option,'selected',{get:()=>select.selectedIndex===option.index});
Object.defineProperty(select,'selectedOptions',{get:()=>select.options.filter(o=>o.selected)});
const document=new Element('document');document.body=new Element('body');document.querySelectorAll=()=>[select];document.createElement=tag=>new Element(tag);
let observer;
const context={document,window:new Element('window'),innerWidth:800,innerHeight:600,Event:class {constructor(type){this.type=type;}},requestAnimationFrame:fn=>fn(),MutationObserver:class {constructor(fn){observer=fn;}observe(){}}};
vm.runInNewContext(fs.readFileSync(require.resolve('../custom-controls.js'),'utf8'),context);
const button=select.replacement;
assert.equal(button.getAttribute('role'),'combobox');
assert.equal(button.children[0].textContent,'All cards');
let changes=0;select.addEventListener('change',()=>changes++);
button.fire('click');
assert.equal(button.getAttribute('aria-expanded'),'true');
assert.equal(document.body.children.at(-1).children.length,4);
button.fire('keydown',{key:'ArrowDown'});
button.fire('keydown',{key:'Enter'});
assert.equal(select.selectedIndex,1);
assert.equal(changes,1);
assert.equal(button.children[0].textContent,'Verbs');
assert.equal(button.getAttribute('aria-expanded'),'false');
button.fire('click');button.fire('keydown',{key:'Escape'});
assert.equal(changes,1);
assert.equal(button.getAttribute('aria-expanded'),'false');
select.options[2].disabled=true;
button.fire('click');button.fire('keydown',{key:'ArrowDown'});button.fire('keydown',{key:'Enter'});
assert.equal(select.selectedIndex,3,'Keyboard skips disabled options');
button.fire('click');button.fire('keydown',{key:'a'});button.fire('keydown',{key:'Enter'});
assert.equal(select.selectedIndex,0,'Typeahead locates an option');
button.fire('click');document.fire('pointerdown',{target:new Element()});
assert.equal(button.getAttribute('aria-expanded'),'false');
select.disabled=true;observer([{target:select}]);assert.equal(button.disabled,true);
select.disabled=false;select.selectedIndex=2;select.fire('change');
assert.equal(button.children[0].textContent,'Nouns','Native changes sync the label');
button.fire('click');button.isConnected=false;observer([{target:document.body}]);
assert.equal(button.getAttribute('aria-expanded'),'false','Removed controls close their menus');
console.log('PASS: selection events, keyboard, disabled options, typeahead, Escape, outside click and rerender cleanup');
