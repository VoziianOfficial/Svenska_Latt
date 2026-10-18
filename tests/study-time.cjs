const test=require('node:test'),assert=require('node:assert/strict');
const {period,activeUntil,validate,addDays}=require('../study-time.js');
const base={previous:1000,now:2000,visible:true,focused:true,route:'flashcards',lastInput:1000,start:0,end:90000};
test('study counts only visible, focused learning surfaces',()=>{
 assert.deepEqual(period(base),[1000,2000]);
 for(const change of [{visible:false},{focused:false},{route:'profile'},{route:'home'},{route:'videos'},{route:'books'},{route:'lessons'}])assert.equal(period({...base,...change}),null);
});
test('ordinary idle cuts at 90 seconds and reading at five minutes',()=>{
 assert.deepEqual(period({...base,lastInput:0,previous:89500,now:90500,end:400000}),[89500,90000]);
 assert.equal(period({...base,lastInput:0,previous:90500,now:91500,end:400000}),null);
 assert.deepEqual(period({...base,route:'book',lastInput:0,previous:299500,now:300500,end:400000}),[299500,300000]);
 assert.equal(activeUntil({route:'lesson',lastInput:500}),300500);
});
test('actual audio can extend idle but cannot bypass visibility, end of lease or timer suspension',()=>{
 const audio={...base,lastInput:0,previous:100000,now:101000,audioUntil:150000,end:120000};
 assert.deepEqual(period(audio),[100000,101000]);
 assert.equal(period({...audio,visible:false}),null);
 assert.equal(period({...audio,previous:150001,now:151000,end:200000}),null);
 assert.equal(period({...base,now:10000}),null,'computer sleep/event loop gaps are not backfilled');
 assert.deepEqual(period({...base,end:1500}),[1000,1500]);
 assert.equal(period({...base,start:2000}),null);
});
test('civil date utilities cover leap day and month/year rollovers independent of host zone',()=>{
 assert.equal(addDays('2024-02-28',1),'2024-02-29');assert.equal(addDays('2024-02-29',1),'2024-03-01');assert.equal(addDays('2026-12-31',1),'2027-01-01');
});
test('server status validation rejects fake/negative totals and unknown zones',()=>{
 const s={version:1,enabled:false,generation:0,timezone:'Europe/Stockholm',today:'2026-10-18',month:'2026-10-01',totals:{today:0,week:0,month:0,all:0},days:{}};
 assert.deepEqual(validate(s),s);assert.notEqual(validate(s),s);
 assert.throws(()=>validate({...s,totals:{...s.totals,all:-1}}));assert.throws(()=>validate({...s,timezone:'Invalid/Zone'}));assert.throws(()=>validate({...s,version:2}));
});
