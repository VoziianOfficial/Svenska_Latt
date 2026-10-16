const fs=require('fs'),vm=require('vm'),path=require('path');const root=path.resolve(__dirname,'..');
const code=fs.readFileSync(root+'/app.js','utf8').replace(/\nboot\(\);/g,'');
const local=fs.readFileSync(root+'/locale-content.js','utf8');const words=JSON.parse(fs.readFileSync(root+'/words.json'));const lessons=JSON.parse(fs.readFileSync(root+'/lessons.json'));const books=JSON.parse(fs.readFileSync(root+'/books.json'));
const fake={window:{addEventListener(){}},document:{addEventListener(){}},localStorage:{getItem(){return null},setItem(){}},location:{hash:'',hostname:'github.io',pathname:'/'},navigator:{},Image:function(){},Date,Math,console,setTimeout,clearTimeout,URL,Response};
vm.createContext(fake);vm.runInContext(local,fake);vm.runInContext(code,fake);vm.runInContext(`WORDS=${JSON.stringify(words)};LESSONS=${JSON.stringify(lessons)};BOOKS=${JSON.stringify(books)};state=defaultState()`,fake);
const run=s=>vm.runInContext(s,fake);function check(condition,message){if(!condition)throw new Error(message)}
const ids=new Set();for(const w of words){check(w.id&&w.word,'bad word');check(!ids.has(w.id),'duplicate '+w.id);ids.add(w.id);check(w.ru&&w.en&&w.uk, 'missing translation '+w.word)}
check(lessons.length===50,'Expected 50 lessons');check(books.length===12,'Expected 12 books');
for(const w of words){
  check(w.examples?.length===3,'Expected three examples: '+w.id);
  check(new Set(w.examples.map(e=>e.sv)).size===3,'Duplicate examples: '+w.id);
  check(w.examples.every(e=>typeof e.sv==='string'&&e.sv.trim().length>5),'Empty example: '+w.id);
  check(w.examples.every(e=>e.sv.length<=35&&!/[\r\n]/.test(e.sv)),'Example too long: '+w.id);
  const detail=run(`routeParam=${JSON.stringify(w.id)};renderWord()`);
  check((detail.match(/class="word-example"/g)||[]).length===3,'Missing example cards: '+w.id);
  for(const example of w.examples){
    check(detail.includes(run(`'data-text="'+esc(${JSON.stringify(example.sv)})+'"'`)),'Missing example audio: '+w.id);
  }
}
check(run('accountLevel3()')===1,'initial rank');run('state.xp=499');check(run('accountLevel3()')===1,'499 XP rank');run('state.xp=500');check(run('accountLevel3()')===2,'500 XP rank');run('state.xp=0');
let cat=run(`topicNames3().map(c=>[c,topicWordsPlus(c).length])`);for(const [name,count] of cat)check(count>=30,`${name}: only ${count} vocabulary items`);
for(const lang of ['ru','en','uk','sv']){
  run(`state.settings.language=${JSON.stringify(lang)}`);
  const routes={home:'renderHome',lessons:'renderLessons',lesson:'renderLesson',topics:'renderTopics',topic:'renderTopic',dictionary:'renderDictionary',word:'renderWord',flashcards:'renderFlashcards',practice:'renderPractice',rules:'renderRules',alphabet:'renderAlphabet',videos:'renderVideos',books:'renderBooks',book:'renderBook',profile:'renderProfile',numbers:'renderNumbers',cheats:'renderCheats'};
  for(const [route,fn] of Object.entries(routes)){
    const param={lesson:'lesson-1',topic:'Предлоги',word:'v-arbeta',book:'book-1'}[route]||'';
    let html=run(`route=${JSON.stringify(route)};routeParam=${JSON.stringify(param)};${fn}()`);
    check(typeof html==='string'&&html.length>190,lang+' '+route+' empty');
    if(route==='numbers')check(html.includes('trettioett')&&html.includes('en miljon')&&html.includes('nittio'),'numbers');
    if(route==='profile')check(html.includes('profile-photo-file')&&html.includes('profile-name-edit'),'edit profile');
    if(route==='topic')check((html.match(/class="word-row"/g)||[]).length>=30,'render topic fewer than 30');
    if(route==='word')check(html.includes('Pluskvamperfekt')&&html.includes('Futurum'),'verb forms');
    if(route==='videos')check((html.match(/class="video-card/g)||[]).length>=10,'few videos');
  }
  for(let mode of ['mixed','translation','fillBlank','weekdays','alphabet','months','dialogues','readText','verbForms','articles','listening','sentences','writeWord','fixMistake']){
    const q=run(`getQuestion(${JSON.stringify(mode)})`);check(q?.answer&&q?.question,lang+' '+mode+' empty');check(!q.options||q.options.includes(q.answer),lang+' '+mode+' options');
  }
}
const html=fs.readFileSync(root+'/index.html','utf8');const css=fs.readFileSync(root+'/style.css','utf8');
check(html.includes('lang-select')&&html.includes('mobile-nav')&&html.includes('global-search'),'nav missing');
check(css.includes('font-size:16px!important')&&css.includes('course-tiles{display:flex')&&css.includes('nav-open'),'responsive css missing');
check(fs.existsSync(root+'/SUPABASE_SETUP.sql')&&fs.existsSync(root+'/supabase-config.js'),'supabase files missing');
for(let legal of ['privacy','terms','cookies'])check(fs.readFileSync(root+`/${legal}.html`,'utf8').includes('ru:'),'legal translations? '+legal);
console.log(JSON.stringify({status:'PASS',words:words.length,lessons:lessons.length,categories:cat.length,minWords:Math.min(...cat.map(x=>x[1])),books:books.length,locales:4,quizModes:14,videoCards:run("(renderVideos().match(/class=\\\"video-card/g)||[]).length")},null,2));
