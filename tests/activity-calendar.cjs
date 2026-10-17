const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const ctx={window:{addEventListener(){}},document:{addEventListener(){},querySelector(){return null}},localStorage:{getItem(){return null}},location:{hash:'',hostname:'github.io',pathname:'/'},navigator:{},Date,Math,console,setTimeout,clearTimeout,URL,Response};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root,'locale-content.js'),'utf8'),ctx);
vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8').replace(/\nboot\(\);/g,''),ctx);
const run=code=>vm.runInContext(code,ctx);
run('state=defaultState();render=()=>{};');
const count=(html,cls)=>(html.match(new RegExp(`class="${cls}"`,'g'))||[]).length;
(async()=>{
  // Calendar alignment and month length, including leap years and all weekdays.
  for(const year of [2023,2024])for(let month=0;month<12;month++){
    run(`activityMonth=new Date(${year},${month},1)`);
    const html=run('heatmap()');
    assert.equal(count(html,'day-col'),new Date(year,month+1,0).getDate());
    assert.equal(count(html,'calendar-empty'),new Date(year,month,1).getDay());
  }
  run('activityMonth=new Date(2024,1,1);state.activity={"2024-02-29":7}');
  assert.match(run('heatmap()'),/day-square done" title="2024-02-29 · 7"/);
  const saved=run('JSON.stringify(state)');
  run('activityMonth=new Date(2024,0,1)');
  await run('action({dataset:{action:"activity-month",step:"-1"}})');
  assert.equal(run('activityMonth.getFullYear()'),2023);
  assert.equal(run('activityMonth.getMonth()'),11);
  await run('action({dataset:{action:"activity-month",step:"1"}})');
  assert.equal(run('activityMonth.getFullYear()'),2024);
  assert.equal(run('activityMonth.getMonth()'),0);
  await run('action({dataset:{action:"activity-current"}})');
  assert.equal(run('activityMonth'),null);
  assert.match(run('heatmap()'),/data-step="1"[^>]* disabled/);
  await run('action({dataset:{action:"activity-month",step:"1"}})');
  assert.equal(run('activityMonth'),null);
  assert.equal(run('JSON.stringify(state)'),saved,'Browsing must preserve study activity');
  for(const lang of ['ru','en','sv','uk']){
    run(`state.settings.language=${JSON.stringify(lang)}`);
    assert.ok(!run('heatmap()').includes('undefined'));
  }
  assert.ok(fs.readFileSync(path.join(root,'learning-polish.js'),'utf8').includes('.daily-bar:not([data-activity-month])'),'Rolling dashboard must not overwrite monthly history');
  console.log('Activity calendar: month lengths, leap day, alignment, navigation, current month, locales and preserved progress passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
