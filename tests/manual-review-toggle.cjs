const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const button={dataset:{id:'v-arbeta'},classList:{values:new Set(),toggle(name,on){on?this.values.add(name):this.values.delete(name)}},setAttribute(name,value){this[name]=value}};
let entries=[],pending=[],hold,offline=false;
const calls=[];
const ctx={console,Date,Math,URL,Response,setTimeout,clearTimeout,Image:function(){},navigator:{},location:{hash:'',hostname:'localhost'},localStorage:{getItem(){return null}},document:{addEventListener(){},querySelectorAll(selector){return selector.startsWith('[data-action="mark-review"]')?[button]:[]}},window:{addEventListener(){}}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('app.js','utf8').replace(/\nboot\(\);/g,''),ctx);
const run=code=>vm.runInContext(code,ctx);
ctx.window.SVManualReviews={state:()=>({ready:true,entries,pending,error:offline?'offline':null}),async change(action,id){
 calls.push(action);pending=[id];run('updateManualReviewButtons()');
 if(hold)await hold;
 if(!offline)entries=[{word_id:id,active:action==='add',version:'version'}];
 pending=[];run('updateManualReviewButtons()');return !offline;
}};
run("WORDS=[{id:'v-arbeta',word:'arbeta'}];user={id:'account'};state=defaultState();toast=()=>{};");
(async()=>{
 await run("action({dataset:{action:'mark-review',id:'v-arbeta'}})");
 assert.deepEqual(calls,['add']);assert(button.classList.values.has('is-queued'));assert.equal(button.disabled,false);assert.equal(button['aria-pressed'],'true');assert.match(button.title,/Убрать/);
 let release;hold=new Promise(resolve=>release=resolve);
 const removal=run("action({dataset:{action:'mark-review',id:'v-arbeta'}})");
 await run("action({dataset:{action:'mark-review',id:'v-arbeta'}})");
 assert.deepEqual(calls,['add','remove']);assert.equal(button.disabled,true);assert(button.classList.values.has('is-queued'),'Keep confirmed state until ACK');
 release();await removal;hold=null;
 assert(!button.classList.values.has('is-queued'));assert.equal(button['aria-pressed'],'false');assert.equal(button.disabled,false);
 await run("addManualReview('v-arbeta')");offline=true;await run("addManualReview('v-arbeta')");
 assert(button.classList.values.has('is-queued'),'Failed removal must retain confirmed state');assert.equal(button.disabled,false);
 console.log('PASS: review button toggles add/remove, stays clickable when selected, blocks duplicate requests and retains state on failure');
})().catch(error=>{console.error(error);process.exitCode=1});
