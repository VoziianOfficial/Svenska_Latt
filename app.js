'use strict';
let BOOKS=[];
const $=(q,root=document)=>root.querySelector(q), $$=(q,root=document)=>Array.from(root.querySelectorAll(q));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const languages=['ru','en','sv','uk'];
const DICT={
ru:{menu:'МЕНЮ',learning:'УЧЁБА',smallSteps:'Каждый день — маленькая победа!',home:'Главная',lessons:'Уроки A–D',dictionary:'Словарь',flashcards:'Карточки',practice:'Тренировки',reviews:'Повторение',videos:'Шведские видео',profile:'Мой кабинет',days:'дней',search:'Найти слово, тему, урок...',welcome:'Hej! Давай учить шведский ✨',heroDescription:'Простые правила, яркие карточки, настоящая практика и твой прогресс каждый день.',startLearning:'Начать учиться',learnWords:'Учить слова',yourStats:'Твои достижения',dayStreak:'Дней подряд',knownWords:'Выучено слов',lessonCount:'Пройдено уроков',accuracy:'Точность',yourWorkout:'Выбирай, что учить сегодня',allCourses:'Курсы по уровням SFI',seeAll:'Смотреть все',words:'Слова',quiz:'Квизы',shortVideo:'Короткие видео',smartReview:'Умное повторение',learnByLevel:'Курсы по уровням',courseExplain:'От первых слов до уверенной речи на шведском.',wordCount:'Словарь шведского',wordExplain:'Ищи шведские и русские слова, изучай четыре формы и слушай произношение.',all:'Все',verbs:'Глаголы',nouns:'Существительные',other:'Другие слова',allThemes:'Все темы',allGroups:'Все группы',searchWords:'Поиск по словам и переводам...',more:'Показать ещё',noResults:'Ничего не найдено',open:'Открыть',known:'Знаю',repeat:'Повторить',flip:'Перевернуть',clickToFlip:'Нажми на карточку, чтобы перевернуть',front:'Лицевая сторона',back:'Обратная сторона',next:'Дальше',prev:'Назад',pronounce:'Прослушать',allCards:'Все карточки',reviewNow:'Повторить сегодня',noDue:'Пока нет карточек к повторению. Изучай новые слова, и они появятся здесь по расписанию.',train:'Тренировки',chooseMode:'Выбери режим',mixed:'Смешанный',translation:'Перевод',verbForms:'Формы глаголов',articles:'En или ett',listening:'Аудирование',sentences:'Собери предложение',writeWord:'Напиши по-шведски',fixMistake:'Исправь ошибку',startQuiz:'Начать тренировку',check:'Проверить',continue:'Дальше',correct:'Правильно!',incorrect:'Почти! Верный ответ:',finished:'Тренировка завершена!',again:'Ещё раз',backTo:'Все уроки',examples:'Примеры и произношение',rules:'Объяснение по шагам',testKnowledge:'Проверь себя',complete:'Пройдено',finishLesson:'Пройти тест урока',level:'Уровень',levelA:'Основы языка',levelB:'Формы и времена',levelC:'Грамматика и речь',levelD:'Уверенное общение',dayPractice:'Дни занятий',practiceActivity:'Активность по месяцам',favorites:'Избранное',profileTitle:'Личный кабинет',guest:'Гость',guestMode:'Гостевой режим: прогресс хранится только на этом устройстве.',accountExplain:'Зарегистрируйся, чтобы сохранить результаты в своём аккаунте и открыть их с другого устройства.',register:'Регистрация',login:'Войти',logout:'Выйти',name:'Имя',email:'Электронная почта',password:'Пароль (минимум 8 символов)',haveAccount:'Уже есть аккаунт? Войти',newAccount:'Создать аккаунт',settings:'Настройки',interfaceLang:'Язык интерфейса',sfiLevel:'Мой уровень SFI',savedAccount:'Прогресс сохраняется на сервере',savedGuest:'Прогресс сохраняется в этом браузере',videosIntro:'Короткие фильмы, грамматика и настоящие шведские диалоги от UR Play и SVT.',watch:'Смотреть видео ↗',watched:'Просмотрено',markWatched:'Отметить просмотр',vidNote:'Видео откроется на сайте правообладателя. Доступность и субтитры могут зависеть от страны и сервиса.',listenPrompt:'Прослушай слово и напиши его по-шведски',writeAnswer:'Напиши ответ на шведском...',arrangePrompt:'Составь правильное предложение',tapOrder:'Нажимай на слова в правильном порядке',reset:'Сбросить',noAudio:'На этом устройстве недоступен шведский синтез речи. Можно читать текст и выполнять другие задания.',pleaseLogin:'Войди или зарегистрируйся для сохранения на сервере',daily:'Твоя активность',fromRussian:'Перевод на русский',dailyGoal:'Хороший день для учёбы!',myLevel:'Мой уровень',remembered:'Отмечено как изученное',view:'Подробнее',quizTip:'Каждый ответ влияет на повторение и статистику.',practiceDone:'Урок завершён!',guestNotice:'Для синхронизации между телефоном и компьютером нужен аккаунт.',showAll:'Все слова',onlyFav:'Избранные',speak:'Слушать',lesson:'Урок',wordsLearned:'Выучено',today:'сегодня',total:'всего',step:'вопрос',of:'из',good:'Верно',bad:'Неверно',saveError:'Не удалось сохранить. Повторим попытку при следующем действии.',back:'Назад'},
en:{menu:'MENU',learning:'LEARNING',smallSteps:'One small win every day!',home:'Home',lessons:'Lessons A–D',dictionary:'Dictionary',flashcards:'Flashcards',practice:'Practice',reviews:'Reviews',videos:'Swedish videos',profile:'My account',days:'days',search:'Search words, topics, lessons...',welcome:'Hej! Let’s learn Swedish ✨',heroDescription:'Simple rules, colorful cards, real practice and daily progress.',startLearning:'Start learning',learnWords:'Learn words',yourStats:'Your achievements',dayStreak:'Day streak',knownWords:'Words learned',lessonCount:'Lessons done',accuracy:'Accuracy',yourWorkout:'What will you practice today?',allCourses:'SFI course levels',seeAll:'See all',words:'Words',quiz:'Quizzes',shortVideo:'Short videos',smartReview:'Smart review',learnByLevel:'Courses by level',courseExplain:'From your first words to confident conversation.',wordCount:'Swedish dictionary',wordExplain:'Search Swedish and Russian words, learn forms and listen.',all:'All',verbs:'Verbs',nouns:'Nouns',other:'Other words',allThemes:'All topics',allGroups:'All groups',searchWords:'Search words or translations...',more:'Load more',noResults:'No results',open:'Open',known:'I know it',repeat:'Review',flip:'Flip',clickToFlip:'Tap the card to flip',front:'Front',back:'Back',next:'Next',prev:'Previous',pronounce:'Listen',allCards:'All cards',reviewNow:'Review today',noDue:'No reviews due yet. Learn some new words to schedule them.',train:'Practice',chooseMode:'Choose a mode',mixed:'Mixed',translation:'Translation',verbForms:'Verb forms',articles:'En or ett',listening:'Listening',sentences:'Build a sentence',writeWord:'Write in Swedish',fixMistake:'Fix the mistake',startQuiz:'Start quiz',check:'Check',continue:'Continue',correct:'Correct!',incorrect:'Almost! Correct answer:',finished:'Practice complete!',again:'Try again',backTo:'All lessons',examples:'Examples & pronunciation',rules:'Step-by-step explanations',testKnowledge:'Test yourself',complete:'Completed',finishLesson:'Take lesson quiz',level:'Level',levelA:'Language basics',levelB:'Forms and tenses',levelC:'Grammar and speaking',levelD:'Confident communication',dayPractice:'Study days',practiceActivity:'Monthly activity',favorites:'Favorites',profileTitle:'My account',guest:'Guest',guestMode:'Guest mode: your progress is stored on this device only.',accountExplain:'Create an account to sync your progress across devices.',register:'Register',login:'Log in',logout:'Log out',name:'Name',email:'Email',password:'Password (8+ characters)',haveAccount:'Have an account? Log in',newAccount:'Create an account',settings:'Settings',interfaceLang:'Interface language',sfiLevel:'My SFI level',savedAccount:'Progress saved on server',savedGuest:'Progress saved in this browser',videosIntro:'Short films, grammar and real Swedish dialogues from UR Play and SVT.',watch:'Watch video ↗',watched:'Watched',markWatched:'Mark watched',vidNote:'Videos open on the provider’s website. Availability and subtitles may vary.',listenPrompt:'Listen and type the word in Swedish',writeAnswer:'Type in Swedish...',arrangePrompt:'Build the correct sentence',tapOrder:'Tap words in the right order',reset:'Reset',noAudio:'Swedish text-to-speech is unavailable on this device.',pleaseLogin:'Sign in to sync results',daily:'Your activity',fromRussian:'Russian translation',dailyGoal:'A great day to study!',myLevel:'My level',remembered:'Marked as learned',view:'Details',quizTip:'Every answer updates your reviews and statistics.',practiceDone:'Lesson completed!',guestNotice:'Sign in to sync phone and computer.',showAll:'All words',onlyFav:'Favorites',speak:'Listen',lesson:'Lesson',wordsLearned:'Learned',today:'today',total:'total',step:'question',of:'of',good:'Correct',bad:'Incorrect',saveError:'Could not save. We’ll retry next time.',back:'Back'},
sv:{menu:'MENY',learning:'LÄR DIG',smallSteps:'Ett litet steg varje dag!',home:'Hem',lessons:'Lektioner A–D',dictionary:'Ordbok',flashcards:'Ord-kort',practice:'Övningar',reviews:'Repetition',videos:'Svenska videor',profile:'Mitt konto',days:'dagar',search:'Sök ord, teman, lektioner...',welcome:'Hej! Nu lär vi oss svenska ✨',heroDescription:'Enkla regler, fina kort, roliga övningar och framsteg varje dag.',startLearning:'Börja lära dig',learnWords:'Träna ord',yourStats:'Dina resultat',dayStreak:'Dagar i rad',knownWords:'Lärda ord',lessonCount:'Klara lektioner',accuracy:'Rätt svar',yourWorkout:'Vad vill du öva i dag?',allCourses:'SFI-kurser',seeAll:'Visa alla',words:'Ord',quiz:'Quiz',shortVideo:'Korta videor',smartReview:'Repetera smart',learnByLevel:'Kurser per nivå',courseExplain:'Från första orden till säkra samtal.',wordCount:'Svensk ordbok',wordExplain:'Sök svenska och ryska ord, studera former och lyssna.',all:'Alla',verbs:'Verb',nouns:'Substantiv',other:'Andra ord',allThemes:'Alla teman',allGroups:'Alla grupper',searchWords:'Sök efter ord eller översättning...',more:'Visa fler',noResults:'Inga resultat',open:'Öppna',known:'Jag kan det',repeat:'Repetera',flip:'Vänd',clickToFlip:'Tryck på kortet för att vända',front:'Framsida',back:'Baksida',next:'Nästa',prev:'Föregående',pronounce:'Lyssna',allCards:'Alla kort',reviewNow:'Repetera i dag',noDue:'Inga repetitioner just nu. Lär dig nya ord först.',train:'Övningar',chooseMode:'Välj övning',mixed:'Blandat',translation:'Översättning',verbForms:'Verbformer',articles:'En eller ett',listening:'Lyssna',sentences:'Bygg en mening',writeWord:'Skriv på svenska',fixMistake:'Rätta felet',startQuiz:'Starta quiz',check:'Kontrollera',continue:'Fortsätt',correct:'Rätt!',incorrect:'Nästan! Rätt svar:',finished:'Övningen är klar!',again:'Försök igen',backTo:'Alla lektioner',examples:'Exempel och uttal',rules:'Förklaring steg för steg',testKnowledge:'Testa dig',complete:'Klart',finishLesson:'Gör lektionens quiz',level:'Nivå',levelA:'Grunder',levelB:'Former och tempus',levelC:'Grammatik och tal',levelD:'Säker kommunikation',dayPractice:'Studiedagar',practiceActivity:'Aktivitet per månad',favorites:'Favoriter',profileTitle:'Mitt konto',guest:'Gäst',guestMode:'Gästläge: framstegen sparas bara på den här enheten.',accountExplain:'Skapa ett konto för att synkronisera framstegen.',register:'Registrera',login:'Logga in',logout:'Logga ut',name:'Namn',email:'E-post',password:'Lösenord (minst 8 tecken)',haveAccount:'Har du ett konto? Logga in',newAccount:'Skapa konto',settings:'Inställningar',interfaceLang:'Gränssnittsspråk',sfiLevel:'Min SFI-nivå',savedAccount:'Framsteg sparas på servern',savedGuest:'Framsteg sparas i webbläsaren',videosIntro:'Kortfilmer, grammatik och dialoger från UR Play och SVT.',watch:'Titta på video ↗',watched:'Sett',markWatched:'Markera som sedd',vidNote:'Videor öppnas hos leverantören. Tillgängligheten kan variera.',listenPrompt:'Lyssna och skriv ordet på svenska',writeAnswer:'Skriv på svenska...',arrangePrompt:'Sätt ihop meningen',tapOrder:'Tryck på orden i rätt ordning',reset:'Börja om',noAudio:'Svensk talsyntes finns inte på enheten.',pleaseLogin:'Logga in för att synkronisera',daily:'Din aktivitet',fromRussian:'Rysk översättning',dailyGoal:'En bra dag att lära sig!',myLevel:'Min nivå',remembered:'Markerat som inlärt',view:'Detaljer',quizTip:'Varje svar uppdaterar dina repetitioner och resultat.',practiceDone:'Lektionen är klar!',guestNotice:'Logga in för synkronisering mellan enheter.',showAll:'Alla ord',onlyFav:'Favoriter',speak:'Lyssna',lesson:'Lektion',wordsLearned:'Inlärda',today:'i dag',total:'totalt',step:'fråga',of:'av',good:'Rätt',bad:'Fel',saveError:'Kunde inte spara. Försök igen senare.',back:'Tillbaka'},
uk:{menu:'МЕНЮ',learning:'НАВЧАННЯ',smallSteps:'Щодня — маленька перемога!',home:'Головна',lessons:'Уроки A–D',dictionary:'Словник',flashcards:'Картки',practice:'Тренування',reviews:'Повторення',videos:'Шведські відео',profile:'Мій кабінет',days:'днів',search:'Знайти слово, тему, урок...',welcome:'Hej! Вивчаймо шведську ✨',heroDescription:'Прості правила, яскраві картки, справжня практика та щоденний прогрес.',startLearning:'Почати навчання',learnWords:'Вивчати слова',yourStats:'Твої досягнення',dayStreak:'Днів поспіль',knownWords:'Вивчено слів',lessonCount:'Пройдено уроків',accuracy:'Точність',yourWorkout:'Що вивчатимемо сьогодні?',allCourses:'Курси за рівнями SFI',seeAll:'Усі',words:'Слова',quiz:'Тести',shortVideo:'Короткі відео',smartReview:'Розумне повторення',learnByLevel:'Курси за рівнями',courseExplain:'Від перших слів до впевненого спілкування.',wordCount:'Шведський словник',wordExplain:'Шукай слова, вивчай форми та слухай вимову.',all:'Усі',verbs:'Дієслова',nouns:'Іменники',other:'Інші слова',allThemes:'Усі теми',allGroups:'Усі групи',searchWords:'Пошук слів та перекладів...',more:'Показати ще',noResults:'Нічого не знайдено',open:'Відкрити',known:'Знаю',repeat:'Повторити',flip:'Перевернути',clickToFlip:'Натисни картку, щоб перевернути',front:'Лицьовий бік',back:'Зворотний бік',next:'Далі',prev:'Назад',pronounce:'Прослухати',allCards:'Усі картки',reviewNow:'Повторити сьогодні',noDue:'Наразі немає слів для повторення. Вивчай нові слова.',train:'Тренування',chooseMode:'Обери режим',mixed:'Змішаний',translation:'Переклад',verbForms:'Форми дієслів',articles:'En або ett',listening:'Аудіювання',sentences:'Склади речення',writeWord:'Напиши шведською',fixMistake:'Виправ помилку',startQuiz:'Почати тест',check:'Перевірити',continue:'Далі',correct:'Правильно!',incorrect:'Майже! Правильна відповідь:',finished:'Тренування завершено!',again:'Ще раз',backTo:'Усі уроки',examples:'Приклади та вимова',rules:'Пояснення крок за кроком',testKnowledge:'Перевір себе',complete:'Пройдено',finishLesson:'Пройти тест уроку',level:'Рівень',levelA:'Основи мови',levelB:'Форми та часи',levelC:'Граматика й мовлення',levelD:'Впевнене спілкування',dayPractice:'Дні занять',practiceActivity:'Активність за місяцями',favorites:'Обране',profileTitle:'Особистий кабінет',guest:'Гість',guestMode:'Гостьовий режим: прогрес зберігається лише на цьому пристрої.',accountExplain:'Зареєструйся, щоб синхронізувати прогрес між пристроями.',register:'Реєстрація',login:'Увійти',logout:'Вийти',name:'Ім’я',email:'Електронна пошта',password:'Пароль (мінімум 8 символів)',haveAccount:'Є акаунт? Увійти',newAccount:'Створити акаунт',settings:'Налаштування',interfaceLang:'Мова інтерфейсу',sfiLevel:'Мій рівень SFI',savedAccount:'Прогрес зберігається на сервері',savedGuest:'Прогрес у цьому браузері',videosIntro:'Короткі фільми, граматика та живі діалоги з UR Play і SVT.',watch:'Дивитися відео ↗',watched:'Переглянуто',markWatched:'Позначити перегляд',vidNote:'Відео відкриються на сайті правовласника. Доступність залежить від країни.',listenPrompt:'Послухай і напиши слово шведською',writeAnswer:'Напиши шведською...',arrangePrompt:'Склади правильне речення',tapOrder:'Натискай слова у правильному порядку',reset:'Скинути',noAudio:'На цьому пристрої немає шведського синтезу мовлення.',pleaseLogin:'Увійди для синхронізації',daily:'Твоя активність',fromRussian:'Переклад російською',dailyGoal:'Чудовий день для навчання!',myLevel:'Мій рівень',remembered:'Позначено як вивчене',view:'Докладніше',quizTip:'Кожна відповідь оновлює повторення та статистику.',practiceDone:'Урок завершено!',guestNotice:'Увійди, щоб синхронізувати телефон і комп’ютер.',showAll:'Усі слова',onlyFav:'Обрані',speak:'Слухати',lesson:'Урок',wordsLearned:'Вивчено',today:'сьогодні',total:'усього',step:'питання',of:'із',good:'Правильно',bad:'Неправильно',saveError:'Не вдалося зберегти. Спробуємо пізніше.',back:'Назад'}
};
// Complete localized navigation labels; avoid English placeholders in other languages.
Object.assign(DICT.ru,{searchLabel:'Поиск',alphabet:'Алфавит',topics:'Словарные модули',books:'Мини-книги',rulesHub:'Все правила'});
Object.assign(DICT.en,{searchLabel:'Search',alphabet:'Alphabet',topics:'Vocabulary modules',books:'Mini books',rulesHub:'Grammar rules'});
Object.assign(DICT.sv,{searchLabel:'Sök',alphabet:'Alfabetet',topics:'Ordteman',books:'Korta böcker',rulesHub:'Grammatikregler'});
Object.assign(DICT.uk,{searchLabel:'Пошук',alphabet:'Абетка',topics:'Словникові модулі',books:'Мінікниги',rulesHub:'Усі правила'});
// Auth and cloud state share an identity; guest learning remains local.
let WORDS=[],LESSONS=[],user=null,state={},route='home',routeParam='',toastTimer=null;
let selectedLevel='A',dictFilter={text:'',kind:'all',group:'all',category:'all',fav:false,limit:42},flashFilter={kind:'all',group:'all',category:'all'},flash={ids:[],index:0,flipped:false};
let quiz={active:false,finished:false,mode:'mixed',lesson:null,questions:[],index:0,score:0,answered:false,selected:[],latest:null};
const D=()=>DICT[state.settings?.language||'ru']||DICT.ru;
const t=k=>['savedAccount','accountExplain','guestNotice'].includes(k)?authText(k==='savedAccount'?'local':'guest'):(D()[k]||DICT.ru[k]||k);
const DAY=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const defaultState=()=>({known:[],learnedOnce:[],favorites:[],reviews:{},completed:[],quizResults:{},activity:{},answered:0,correct:0,xp:0,settings:{language:localStorage.getItem('sv-language')||'ru',level:'A'},videos:[],booksRead:[],profile:{name:"",avatar:""}});
function sanitize(s){let v=defaultState();if(s&&typeof s==='object')for(const k of Object.keys(v))if(k in s)v[k]=s[k];v.settings=v.settings||{language:'ru',level:'A'};v.profile=(v.profile&&typeof v.profile==='object')?v.profile:{name:'',avatar:''};v.learnedOnce=[...new Set([...(Array.isArray(v.learnedOnce)?v.learnedOnce:[]),...v.known])];return v}
function localStateKey(){return user?'sv-account-local-v1-'+user.id:'sv-guest-v2'}
function readLocalState(){try{return sanitize(JSON.parse(localStorage.getItem(localStateKey())||'{}'))}catch{return defaultState()}}
function cloudAccount(){return !!user}
function accountDataReady(){return !user||window.SVProgress?.status?.().receivedAt!=null}
function save(){if(cloudAccount())return;localStorage.setItem(localStateKey(),JSON.stringify(state))}
function applyAuthState(auth){
 const next=auth.user?{id:auth.user.id,email:auth.user.email,name:auth.user.user_metadata?.display_name||''}:null;
 if((user?.id||null)===(next?.id||null)){user=next;refreshProfileSettings();return}
 user=next;quizBusy=false;profileEmailEditing=false;profileEmailDraft='';profileEmailMessage='';profileLevelMessage='';cloudReadError=false;dictionaryViews.clear();lastDictionaryScope='';reviewExercise=null;state=cloudAccount()?defaultState():readLocalState();
 // Restore only exercises belonging to the selected identity.
 quiz={active:false,finished:false,mode:'mixed',lesson:null,questions:[],index:0,score:0,answered:false,selected:[],latest:null};
 restoreQuizSession();
 flash={ids:[],index:0,flipped:false};
 render();
}
const shuffle=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const k=Math.floor(Math.random()*(i+1));[b[i],b[k]]=[b[k],b[i]]}return b};
function pic(w,large=false){const ch=String(w?.word||'S').slice(0,1).toUpperCase();return `<span class="photo-word"><span class="word-fallback">${esc(ch)}</span></span>`}
const draw=(emoji,cls='')=>`<span class="${cls}" aria-hidden="true">${esc(emoji||'✨')}</span>`;
const getWord=id=>WORDS.find(w=>w.id===id);
const todayActive=()=>!!state.activity[DAY()];
function streak(){const dates=new Set(Object.keys(state.activity||{}).filter(x=>state.activity[x]>0));let d=new Date();if(!dates.has(DAY()))d.setDate(d.getDate()-1);let n=0;for(let i=0;i<5000;i++){const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;if(!dates.has(key))break;n++;d.setDate(d.getDate()-1)}return n}
// Record study activity only; profile edits and settings must not mark a study day.
function touch(){state.activity[DAY()]=(state.activity[DAY()]||0)+1}
function mutate(fn){if(cloudAccount()){return}fn();save();headerStats()}
function headerStats(){$('#top-streak').textContent=streak();$('#top-xp').textContent=accountDataReady()?(state.xp||0):'—'}
function toast(msg){let el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2700)}
function speak(text){if(!('speechSynthesis' in window)){toast(t('noAudio'));return}speechSynthesis.cancel();const utt=new SpeechSynthesisUtterance(String(text));utt.lang='sv-SE';utt.rate=.84;utt.pitch=1;const voices=speechSynthesis.getVoices(),voice=voices.find(v=>v.lang.toLowerCase()==='sv-se')||voices.find(v=>v.lang.toLowerCase().startsWith('sv'));if(voice)utt.voice=voice;speechSynthesis.speak(utt)}
function markReview(id,ok){if(!getWord(id))return;const was=state.reviews[id]||{interval:0,ease:2.5,rep:0,due:0};if(ok){was.rep+=1;was.interval=was.rep===1?1:was.rep===2?3:Math.max(1,Math.round(was.interval*was.ease));was.ease=Math.min(3,was.ease+.08)}else{was.rep=0;was.interval=0;was.ease=Math.max(1.3,was.ease-.18)}was.due=Date.now()+(ok?was.interval*86400000:600000);state.reviews[id]=was}
function dueIds(){return Object.entries(state.reviews).filter(([id,v])=>getWord(id)&&v.due<=Date.now()).map(([id])=>id)}
// Collection views belong to the current account and survive a trip to word details.
const dictionaryViews=new Map();
let lastDictionaryScope='';
function dictionaryViewKey(scope){return ownerKey()+':'+scope}
function rememberDictionaryView(){
 if(route!=='dictionary')return;
 const focused=document.activeElement?.closest?.('[data-word-link]');
 dictionaryViews.set(dictionaryViewKey(routeParam),{filter:{...dictFilter},top:window.scrollY||0,focusId:focused?.dataset.wordLink,minHeight:$('#page')?.style?.minHeight||''});
 lastDictionaryScope=routeParam;
}
function restoreDictionaryView(scope){
 const saved=dictionaryViews.get(dictionaryViewKey(scope));
 if(saved)dictFilter={...saved.filter};else resetDictionaryFilters();
 lastDictionaryScope=scope;
 return saved;
}
function restoreDictionaryPosition(saved){
 const target=route+'|'+routeParam,owner=ownerKey();
 const restore=()=>{
  if(target!==route+'|'+routeParam||owner!==ownerKey())return;
  if(saved?.minHeight&&$('#page'))$('#page').style.minHeight=saved.minHeight;
  if(saved?.focusId){const row=[...document.querySelectorAll('[data-word-link]')].find(el=>el.dataset.wordLink===saved.focusId);row?.focus({preventScroll:true})}
  window.scrollTo?.({top:saved?.top||0,behavior:'instant'});
 };
 if(window.requestAnimationFrame)window.requestAnimationFrame(restore);else restore();
}
function navigate(next,param=''){
 if(next==='dictionary'&&next===route&&param===routeParam)return;
 rememberDictionaryView();if(next==='word-review')reviewExercise=null;
 const saved=next==='dictionary'?restoreDictionaryView(param):null;
 route=next;routeParam=param;location.hash=next+(param?'/'+encodeURIComponent(param):'');render();restoreDictionaryPosition(saved);
}
function hydrateLocation(){
 rememberDictionaryView();
 const parts=decodeURIComponent(location.hash.slice(1)).split('/');
 route=['home','lessons','lesson','dictionary','word','word-review','flashcards','practice','reviews','videos','profile','topics','topic','rules','alphabet','books','book','cheats','numbers'].includes(parts[0])?parts[0]:'home';
 routeParam=parts.slice(1).join('/')||'';
 if(route==='dictionary')restoreDictionaryView(routeParam);
}
const NAV=[['home','🏠'],['lessons','📚'],['dictionary','🔎'],['flashcards','🃏'],['practice','🧠'],['reviews','🔁'],['videos','🎬'],['profile','👤']];
function renderNav(){const mk=([key,ico])=>`<button type="button" class="nav-link ${route===key||key==='lessons'&&route==='lesson'||key==='dictionary'&&route==='word'?'active':''}" data-nav="${key}"><span class="nav-glyph">${ico}</span>${esc(t(key))}</button>`;$('#sidebar-nav').innerHTML=NAV.slice(0,5).map(mk).join('');$('#sidebar-learn').innerHTML=NAV.slice(5).map(mk).join('');$('#mobile-nav').innerHTML=[NAV[0],NAV[1],NAV[3],NAV[4],NAV[7]].map(([key,ico])=>`<button class="${route===key||key==='lessons'&&route==='lesson'?'active':''}" data-nav="${key}" aria-label="${esc(t(key))}"><span class="i">${ico}</span><span>${esc(t(key))}</span></button>`).join('');const name=user?.name||t('guest');$('#sidebar-profile').innerHTML=`<span class="small-avatar">${esc(name[0]?.toUpperCase()||'👤')}</span><span style="min-width:0"><strong>${esc(name)}</strong><small>${user?'● Online':t('login')+' →'}</small></span>`;$('#profile-top').textContent=name[0]?.toUpperCase()||'👤'}
function renderShell(){renderNav();$$('[data-i18n]').forEach(el=>el.textContent=t(el.dataset.i18n));$('#global-search').placeholder=t('search');$('#lang-select').value=state.settings.language;document.documentElement.lang=state.settings.language;headerStats();renderCookieConsent()}
function render(){renderShell();const page=$('#page');const pages={home:renderHome,lessons:renderLessons,lesson:renderLesson,dictionary:renderDictionary,word:renderWord,'word-review':renderWordReview,flashcards:renderFlashcards,practice:renderPractice,reviews:renderReviews,videos:renderVideos,profile:renderProfile};page.innerHTML=(pages[route]||renderHome)();}
function title(title,sub,extra=''){return `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>${extra}</div>`}
const levelName=l=>t('level'+l);
const countComplete=l=>LESSONS.filter(x=>x.level===l&&state.completed.includes(x.id)).length;
function stat(icon,value,label,color){if(!accountDataReady())value='—';const collection=label===t('knownWords'),tag=collection?'button':'div';return `<${tag} class="stat-card" ${collection?'type="button" data-action="show-learned"':''}><span class="stat-icon ${color}">${icon}</span><div><div class="stat-value">${value}</div><div class="stat-label">${esc(label)}</div></div></${tag}>`}
function courseTile(l){let len=LESSONS.filter(x=>x.level===l).length,done=countComplete(l);return `<button type="button" data-level="${l}" class="course-tile" data-action="course"><div class="letter">${l}</div><h3>${esc(levelName(l))}</h3><p>${done}/${len} ${esc(t('lessonCount'))}</p><div class="mini-progress"><i style="width:${100*done/len}%"></i></div></button>`}
function activityStrip(){let out=[];const days={ru:['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],sv:['Sön','Mån','Tis','Ons','Tor','Fre','Lör'],uk:['Нд','Пн','Вт','Ср','Чт','Пт','Сб']}[locale4()]||[];for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;out.push(`<div class="day-col"><div class="day-square ${state.activity[k]?'done':''}" title="${k}"><strong>${esc(days[d.getDay()])}</strong><span>${d.getDate()}</span></div></div>`)}return `<div class="daily-bar">${out.join('')}</div>`}
function renderHome(){let next=LESSONS.find(l=>!state.completed.includes(l.id)&&l.level===state.settings.level)||LESSONS[0];return `<section class="hero"><div class="hero-copy"><span class="eyebrow">🇸🇪 SFI A · B · C · D</span><h1>${esc(t('welcome'))}</h1><p>${esc(t('heroDescription'))}</p><div class="split" style="justify-content:flex-start"><button class="btn white" data-nav="lesson" data-param="${next.id}">${esc(t('startLearning'))} →</button><button class="btn" style="background:#ffffff2b" data-nav="flashcards">🃏 ${esc(t('learnWords'))}</button></div></div><div class="hero-picture"><div class="hero-illustration">📚</div><span class="hero-orbit orbit-a">🇸🇪</span><span class="hero-orbit orbit-b">💬</span><span class="hero-orbit orbit-c">⭐</span></div></section>
<section class="stats-grid">${stat('🔥',streak(),t('dayStreak'),'orange')}${stat('🧠',state.known.length,t('knownWords'),'purple')}${stat('🎓',state.completed.length,t('lessonCount'),'mint')}${stat('🎯',state.answered?Math.round(state.correct/state.answered*100)+'%':'0%',t('accuracy'),'pink')}</section>
<div class="section-head"><div><h2>${esc(t('yourWorkout'))}</h2><p>${esc(t('dailyGoal'))}</p></div></div><div class="action-grid"><button data-nav="flashcards" class="action-card pastel-lavender"><span class="corner">↗</span><span class="action-emoji">🃏</span><h3>${esc(t('flashcards'))}</h3><p>${esc(t('learnWords'))}</p></button><button data-nav="practice" class="action-card pastel-peach"><span class="corner">↗</span><span class="action-emoji">🧩</span><h3>${esc(t('train'))}</h3><p>${esc(t('quizTip'))}</p></button><button data-nav="reviews" class="action-card pastel-mint"><span class="corner">↗</span><span class="action-emoji">🔁</span><h3>${esc(t('smartReview'))}</h3><p>${dueIds().length} ${esc(t('words'))} · ${esc(t('today'))}</p></button></div>
<div class="section-head"><h2>${esc(t('allCourses'))}</h2><button class="link-btn" data-nav="lessons">${esc(t('seeAll'))} →</button></div><div class="course-tiles">${'ABCD'.split('').map(courseTile).join('')}</div>
<div class="section-head"><h2>${esc(t('dayPractice'))}</h2><button class="link-btn" data-nav="profile">${esc(t('seeAll'))} →</button></div><div class="content-panel">${activityStrip()}<p class="info-scope">${esc(user?t('savedAccount'):t('guestNotice'))}</p></div>`}
function renderLessons(){const selected=routeParam&&'ABCD'.includes(routeParam)?routeParam:selectedLevel;selectedLevel=selected;return title(t('learnByLevel'),t('courseExplain'))+`<div class="tabs">${'ABCD'.split('').map(l=>`<button class="pill ${selected===l?'active':''}" data-action="level" data-level="${l}">${t('level')} ${l} · ${esc(levelName(l))}</button>`).join('')}</div><div class="lessons-grid">${LESSONS.filter(l=>l.level===selected).map((l,i)=>`<article class="lesson-card"><div class="lesson-cover ${l.level.toLowerCase()}"><span>${esc(l.emoji)}</span><small>${esc(t('lesson'))} ${i+1}</small></div><div class="lesson-body"><h3>${esc(l.title)}</h3><p>${esc(l.description)}</p><div class="lesson-foot"><span data-quiz-status="lesson:${esc(l.id)}" class="${quizPassed('lesson:'+l.id)?'done-chip':'chip'}">${quizStatus('lesson:'+l.id)}</span><button class="btn small" data-nav="lesson" data-param="${l.id}">${esc(t('open'))} →</button></div></div></article>`).join('')}</div>`}
function renderLesson(){const l=LESSONS.find(l=>l.id===routeParam);if(!l)return renderLessons();return `<button class="back-link" data-nav="lessons" data-param="${l.level}">← ${esc(t('backTo'))}</button><div class="lesson-hero"><div class="lesson-hero-art">${esc(l.emoji)}</div><div><span class="eyebrow">SFI ${l.level} · ${esc(t('lesson'))} ${LESSONS.indexOf(l)+1}</span><h1>${esc(l.title)}</h1><p>${esc(l.description)}</p></div></div>
<section class="content-panel"><h2 class="panel-heading">📚 ${esc(t('rules'))}</h2><ol class="rule-list">${l.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ol></section><section class="content-panel"><h2 class="panel-heading">🔊 ${esc(t('examples'))}</h2><div class="example-grid">${l.examples.map(e=>`<div class="example-item"><b>${esc(e.sv)}</b><p>${esc(e.ru)}</p><button data-action="speak" data-text="${esc(e.sv)}">🔊 ${esc(t('pronounce'))}</button></div>`).join('')}</div></section><div class="horizontal-card"><div><h3>✨ ${esc(t('testKnowledge'))}</h3>${quizStatusChip('lesson:'+l.id)}<p style="margin:0;color:var(--muted)">${l.questions.length} + ${Math.min(4,WORDS.length)} ${esc(t('step'))}</p></div><button class="btn" data-action="lesson-test" data-id="${l.id}">${state.completed.includes(l.id)?t('again'):t('finishLesson')} →</button></div>`}
function wordLabel(w){return w.type==='noun'?`${w.article} ${w.word}`:w.type==='verb'?w.inf:w.word}
function wordEntry(w){return `<div class="word-row"><span class="word-visual" aria-hidden="true">${pic(w)}</span><div class="word-info"><strong title="${esc(wordLabel(w))}">${esc(wordLabel(w))}</strong><small title="${esc(w.ru)}">${esc(w.ru)}</small></div><div class="word-actions"><button class="circle-btn ${state.favorites.includes(w.id)?'selected':''}" aria-label="Favorite ${esc(w.word)}" title="${esc(t('favorites'))}" data-action="favorite" data-id="${esc(w.id)}">${state.favorites.includes(w.id)?'★':'☆'}</button><button class="circle-btn" data-action="speak" data-text="${esc(w.word)}" aria-label="Speak ${esc(w.word)}" title="${esc(t('speak'))}">🔊</button><button class="circle-btn" data-nav="word" data-param="${esc(w.id)}" title="${esc(t('view'))}">↗</button></div></div>`}
function availableCategories(){return [...new Set(WORDS.map(w=>w.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'))}
function filteredWords(){let q=dictFilter.text.trim().toLocaleLowerCase();return WORDS.filter(w=>(!q||[w.word,w.ru,w.inf,w.pre,w.past,w.sup,w.article,w.category,w.example].some(x=>String(x||'').toLocaleLowerCase().includes(q)))&&(dictFilter.kind==='all'||w.type===dictFilter.kind)&&(dictFilter.group==='all'||w.group===dictFilter.group)&&(dictFilter.category==='all'||w.category===dictFilter.category)&&(routeParam!=='learned'||state.known.includes(w.id))&&(routeParam!=='favorites'||state.favorites.includes(w.id)))}
function renderDictionary(){let rows=filteredWords(),part=rows.slice(0,dictFilter.limit);let cats=availableCategories();return title(t('wordCount'),`${t('wordExplain')} · ${WORDS.length} ${t('words')}`)+`<div class="dict-shortcuts"><button class="pill" data-nav="alphabet">🔤 ${esc(t('alphabetHub'))} · 29</button><button class="pill" data-nav="topics">🗂️ ${esc(t('topics'))}</button><button class="pill" data-nav="rules">📜 ${esc(t('rulesHub'))}</button></div><div class="filters-bar"><input class="search-input" id="dict-search" value="${esc(dictFilter.text)}" autocomplete="off" placeholder="${esc(t('searchWords'))}" aria-label="${esc(t('searchWords'))}"><select class="form-select" id="dict-kind" aria-label="Word type">${[['all',t('all')],['verb',t('verbs')],['noun',t('nouns')],['other',t('other')]].map(([v,n])=>`<option value="${v}" ${dictFilter.kind===v?'selected':''}>${esc(n)}</option>`).join('')}</select><select class="form-select" id="dict-group" aria-label="Verb group">${[['all',t('allGroups')],['1','1'],['2A','2A'],['2B','2B'],['3','3'],['4','4']].map(([v,n])=>`<option value="${v}" ${dictFilter.group===v?'selected':''}>${esc(n)}</option>`).join('')}</select></div>
<div class="split"><div class="filter-pills" style="margin:0 0 17px"><button class="pill ${routeParam===''?'active':''}" data-action="toggle-fav" data-fav="false">${esc(t('showAll'))}</button><button class="pill ${routeParam==='favorites'?'active':''}" data-action="toggle-fav" data-fav="true">⭐ ${esc(t('onlyFav'))}</button></div><select id="dict-category" class="form-select" aria-label="Category" style="margin-bottom:17px"><option value="all">${esc(t('allThemes'))}</option>${cats.map(c=>`<option value="${esc(c)}" ${dictFilter.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><p class="vocab-counter">${part.length} / ${rows.length} ${esc(t('words'))}</p>${part.length?`<div class="words-grid">${part.map(wordEntry).join('')}</div>`:`<div class="empty-state"><div class="big">🔎</div><h3>${esc(t('noResults'))}</h3></div>`}${rows.length>dictFilter.limit?`<div class="list-footer"><button class="btn secondary" data-action="dict-more">${esc(t('more'))} ↓</button></div>`:''}<div class="notice" style="margin-top:22px">📚 ${state.settings.language==='ru'?'Слова сгруппированы по частям речи и темам. Полные формы приводятся только для слов, проверенных в учебной базе; остальные слова можно изучать по переводу и озвучке.':'Words are grouped by type and topic. Full inflection tables appear only for validated entries.'}</div>`}
function renderWord(){const w=getWord(routeParam);if(!w)return renderDictionary();const forms=w.type==='verb'?[['Infinitiv',w.inf],['Presens',w.pre],['Preteritum',w.past],['Supinum',w.sup],['Grupp',w.group]]:w.type==='noun'?[['Article',w.article],['Obestämd singular',w.word],['Bestämd singular',w.def],['Obestämd plural',w.plural],['Bestämd plural',w.pluralDef]]:[];return `<button class="back-link" data-nav="dictionary">← ${esc(t('dictionary'))}</button><section class="content-panel"><div class="word-detail"><div class="visual">${pic(w,true)}</div><div><span class="chip">${esc(w.category)}</span><h2 style="margin:12px 0 4px">${esc(wordLabel(w))}</h2><p>${esc(w.ru)}</p><div style="display:flex;gap:8px;margin-top:15px;flex-wrap:wrap"><button class="btn secondary small" data-action="speak" data-text="${esc(w.word)}">🔊 ${esc(t('speak'))}</button><button class="btn ghost small" data-action="favorite" data-id="${esc(w.id)}">${state.favorites.includes(w.id)?'★':'☆'} ${esc(t('favorites'))}</button></div></div></div>${forms.length?`<h3 style="margin-top:28px">${w.type==='verb'?'4 former av verbet':'4 former av substantivet'}</h3><div class="word-forms">${forms.map(([label,value])=>`<div><small>${esc(label)}</small><b>${esc(value)}</b></div>`).join('')}</div>`:''}${w.example?`<div class="notice" style="margin-top:22px"><b>${esc(w.example)}</b><br>${esc(w.exampleRu||'')} <button class="circle-btn" style="display:inline-grid" data-action="speak" data-text="${esc(w.example)}">🔊</button></div>`:''}<div class="split" style="margin-top:24px"><button class="btn" data-action="mark-known" data-id="${esc(w.id)}">${state.known.includes(w.id)?'✓ '+esc(t('known')):esc(t('known'))}</button><button class="btn secondary" data-action="mark-review" data-id="${esc(w.id)}">${studioIcon('repeat','review-button-icon')} ${esc(t('repeat'))}</button></div></section>`}
function createFlashDeck(){let all=WORDS.filter(w=>(flashFilter.scope!=='known'||state.known.includes(w.id))&&(flashFilter.kind==='all'||flashFilter.kind===w.type)&&(flashFilter.group==='all'||w.group===flashFilter.group)&&(flashFilter.category==='all'||w.category===flashFilter.category));flash.ids=shuffle(all.map(w=>w.id));flash.index=0;flash.flipped=false}
function legacyrenderFlashcards4(){if(!flash.ids.length)createFlashDeck();const w=getWord(flash.ids[flash.index]);if(!w)return `<div class="empty-state"><div class="big">🃏</div><h3>${esc(t('noResults'))}</h3><button class="btn" data-action="flash-reset">${esc(t('all'))}</button></div>`;let form=w.type==='verb'?[['Infinitiv',w.inf],['Presens',w.pre],['Preteritum',w.past],['Supinum',w.sup]]:w.type==='noun'?[['Article',w.article],['Bestämd',w.def],['Plural',w.plural],['Plural bestämd',w.pluralDef]]:[];return title(t('flashcards'),`${WORDS.length} ${t('words')} · ${t('clickToFlip')}`)+`<div class="flash-layout"><div class="split" style="margin-bottom:15px"><select id="flash-kind" class="form-select" aria-label="Cards type"><option value="all" ${flashFilter.kind==='all'?'selected':''}>${esc(t('allCards'))}</option><option value="verb" ${flashFilter.kind==='verb'?'selected':''}>${esc(t('verbs'))}</option><option value="noun" ${flashFilter.kind==='noun'?'selected':''}>${esc(t('nouns'))}</option><option value="other" ${flashFilter.kind==='other'?'selected':''}>${esc(t('other'))}</option></select><select id="flash-group" class="form-select" aria-label="Group"><option value="all">${esc(t('allGroups'))}</option>${['1','2A','2B','3','4'].map(g=>`<option ${flashFilter.group===g?'selected':''}>${g}</option>`).join('')}</select></div>
<div class="flash-counter">${flash.index+1} ${esc(t('of'))} ${flash.ids.length} · ${esc(w.category)}</div><button type="button" class="flash-card ${flash.flipped?'flipped':''}" data-action="flash-flip" aria-label="${esc(t('flip'))}" aria-pressed="${flash.flipped}"><div class="flash-inner"><div class="flash-side front"><div class="flash-emoji">${pic(w,true)}</div><h2>${esc(wordLabel(w))}</h2><p>🇸🇪 ${esc(t('front'))} · 🔄 ${esc(t('flip'))}</p><span style="font-size:32px;margin-top:15px">↻</span></div><div class="flash-side back"><div class="flash-emoji">${pic(w,true)}</div><h2 style="font-size:28px">${esc(w.ru)}</h2><p>${esc(wordLabel(w))}</p>${form.length?`<div class="flash-table">${form.map(([k,v])=>`<div><small>${esc(k)}</small><strong>${esc(v)}</strong></div>`).join('')}</div>`:''}<p style="font-size:12px">${esc(w.example||t('back'))}</p></div></div></button><div class="flash-control-row"><button class="btn ghost small" data-action="flash-prev">← ${esc(t('prev'))}</button><button class="btn secondary small" data-action="speak" data-text="${esc(w.word)}">🔊 ${esc(t('pronounce'))}</button><button class="btn ghost small" data-action="flash-next">${esc(t('next'))} →</button></div><div class="flash-buttons"><button class="btn pink" data-action="flash-grade" data-value="0">${studioIcon('repeat','review-button-icon')} ${esc(t('repeat'))}</button><button class="btn" data-action="flash-grade" data-value="1">✓ ${esc(t('known'))}</button></div><p class="flash-card-caption">${esc(t('clickToFlip'))}</p></div>`}
function reviewDeck(){return dueIds().map(getWord).filter(Boolean)}
function legacyrenderReviews4(){const due=reviewDeck();return title(t('smartReview'),`${due.length} ${t('words')} · ${t('today')}`)+(due.length?`<div class="horizontal-card"><div><h2>🔁 ${due.length} ${esc(t('words'))}</h2><p style="color:var(--muted)">${esc(state.settings.language==='ru'?'Повторяй сегодня слова, которые пора освежить в памяти. Верные ответы увеличивают интервал до следующего повторения.':t('smartReview'))}</p><button class="btn" data-action="start-review">${esc(t('reviewNow'))} →</button></div><div class="art">📆</div></div><div class="words-grid">${due.slice(0,12).map(wordEntry).join('')}</div>`:`<div class="empty-state"><div class="big">🌸</div><h3>${esc(t('noDue'))}</h3><button class="btn" data-nav="flashcards">${esc(t('learnWords'))} →</button></div>`)+`<section class="content-panel" style="margin-top:20px"><h3>🗓️ ${esc(t('dayPractice'))}</h3>${activityStrip()}</section>`}
const SENTENCES=[['Jag arbetar i dag.','Я работаю сегодня.'],['Hon köper en bok.','Она покупает книгу.'],['Vi bor i Sverige.','Мы живём в Швеции.'],['Jag kan inte simma.','Я не умею плавать.'],['I morgon ska jag fiska.','Завтра я собираюсь рыбачить.'],['Det är en stor bil.','Это большая машина.'],['Jag vill lära mig svenska.','Я хочу выучить шведский.'],['Var bor du?','Где ты живёшь?'],['Hon har köpt mat.','Она купила еду.'],['På fredag är jag ledig.','В пятницу я свободна.'],['Jag tycker om att läsa.','Я люблю читать.'],['Boken ligger på bordet.','Книга лежит на столе.']];
function choice(question,answer,wrong,wordId=null,why=''){const options=shuffle([...new Set([answer,...wrong])]);return {type:'choice',question,answer,options,wordId,why}}
function getQuestion(mode){const verb=()=>shuffle(WORDS.filter(w=>w.type==='verb'))[0],noun=()=>shuffle(WORDS.filter(w=>w.type==='noun'))[0],any=()=>shuffle(WORDS)[0];if(mode==='mixed')mode=shuffle(['translation','verbForms','articles','sentences','writeWord','fixMistake',...('speechSynthesis' in window?['listening']:[])])[0];
 if(mode==='translation'){let w=any();let wrong=shuffle(WORDS.filter(x=>x.id!==w.id&&x.ru!==w.ru)).slice(0,3).map(x=>x.ru);return choice(`${t('fromRussian')}: ${w.word}`,w.ru,wrong,w.id,w.example||'')}
 if(mode==='verbForms'){const w=verb(),target=shuffle([['Presens','pre'],['Preteritum','past'],['Supinum','sup']])[0];let wrong=shuffle(WORDS.filter(x=>x.type==='verb'&&x.id!==w.id)).slice(0,3).map(x=>x[target[1]]);return choice(`${target[0]}: ${w.inf} → ?`,w[target[1]],wrong,w.id,`${w.inf} → ${w.pre} → ${w.past} → ${w.sup} · ${w.group}`)}
 if(mode==='articles'){let w=noun();let wrong=w.article==='en'?'ett':'en';return choice(`${w.word} · ${w.ru}`,w.article,[wrong],w.id,`${w.article} ${w.word} → ${w.def}`)}
 if(mode==='listening'){let w=shuffle(WORDS.filter(x=>x.word&&!x.word.includes(' ')))[0];return {type:'listen',question:t('listenPrompt'),answer:w.word,wordId:w.id,why:w.ru,speak:w.word}}
 if(mode==='writeWord'){let w=any();return {type:'type',question:`${w.ru} → 🇸🇪`,answer:w.word,wordId:w.id,why:w.example||w.category}}
 if(mode==='fixMistake'){let examples=[['Jag kan simmar.','Jag kan simma.','Jag kan simmade.','Jag simma kan.','После kan используется инфинитив simma.'],['I dag jag jobbar.','I dag jobbar jag.','I dag jobbade jag.','Jag i dag jobbar.','В главном предложении глагол стоит на второй позиции.'],['Jag har köpte.','Jag har köpt.','Jag är köpt.','Jag har köpa.','После har нужен supinum köpt.'],['Ett stor hus.','Ett stort hus.','En stora hus.','Ett stora hus.','С ett-словом прилагательное обычно получает -t.'],['Jag hjälper hon.','Jag hjälper henne.','Jag hjälper hennes.','Jag hjälp hon.','Объектная форма от hon — henne.'],['Hon inte kan prata.','Hon kan inte prata.','Hon kan prata inte.','Hon kunna inte prata.','В главном предложении inte ставят после личного глагола.']];let a=shuffle(examples)[0];return choice(`❌ ${a[0]} · ${t('fixMistake')}`,a[1],[a[2],a[3]],null,a[4])}
 if(mode==='sentences'){let s=shuffle(SENTENCES)[0];let tokens=s[0].replace(/[.!?]+$/g,'').split(' '),punct=s[0].slice(-1);return {type:'arrange',question:`${t('arrangePrompt')}: ${s[1]}`,answer:s[0],tokens:shuffle(tokens).map((v,i)=>({id:String(i),v})),punct,wordId:null,why:s[1]}}
 return getQuestion('translation')}
function startQuiz(mode='mixed',lesson=null,forReview=false){
 if(cloudAccount())return;let questions=[];if(lesson){let l=LESSONS.find(l=>l.id===lesson);if(!l)return;questions=l.questions.map(x=>choice(x.question,x.answer,x.options.filter(y=>y!==x.answer),null,x.why));while(questions.length<6)questions.push(getQuestion(shuffle(['translation','articles','verbForms'])[0]));}
 else if(forReview){const list=shuffle(reviewDeck()).slice(0,14);questions=list.map(w=>w.type==='verb'?choice(`${w.inf} → Preteritum`,w.past,shuffle(WORDS.filter(x=>x.type==='verb'&&x.id!==w.id)).slice(0,3).map(x=>x.past),w.id,w.ru):w.type==='noun'?choice(`${w.word} · en/ett`,w.article,[w.article==='en'?'ett':'en'],w.id,w.ru):choice(`${t('fromRussian')}: ${w.word}`,w.ru,shuffle(WORDS.filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ru),w.id,''));}
 else{questions=Array.from({length:10},()=>getQuestion(mode))}
 quiz={active:true,finished:false,mode,lesson,questions,index:0,score:0,answered:false,selected:[],latest:null};navigate('practice')}
function renderPractice(){if(quiz.active){if(quiz.finished)return renderQuizFinish();return renderQuiz()}return title(t('train'),t('chooseMode'))+`<div class="practice-modes">${[['mixed','🎲'],['translation','🌍'],['verbForms','⚡'],['articles','🧩'],['listening','🎧'],['sentences','🧱'],['writeWord','✍️'],['fixMistake','🛠️']].map(([m,e])=>`<button class="mode-card" data-action="start-mode" data-mode="${m}"><span class="e">${e}</span><b>${esc(t(m))}</b><small>${m==='mixed'?'10':m==='listening'?'10':'10'} ${esc(t('step'))} · 0 XP</small></button>`).join('')}</div><div class="notice" style="margin-top:24px">🧠 ${esc(t('quizTip'))}</div>`}
function renderQuiz(){let q=quiz.questions[quiz.index];if(!q)return renderQuizFinish();let pct=quiz.index/quiz.questions.length*100;let feedback=quiz.answered?`<div class="quiz-feedback ${quiz.latest?'success':'failure'}">${quiz.latest?'✅ '+t('correct'):'🔎 '+t('incorrect')+' '+esc(q.answer)}<div style="margin-top:5px">${esc(q.why||'')}</div></div>`:'';let answerUi='';if(q.type==='choice')answerUi=`<div class="quiz-options">${q.options.map((o,i)=>`<button class="quiz-option ${quiz.answered?(o===q.answer?'correct':quiz.selected===o?'wrong':''):''}" data-action="quiz-choice" data-choice="${esc(o)}" ${quiz.answered?'disabled':''}>${String.fromCharCode(65+i)}. ${esc(o)}</button>`).join('')}</div>`;
 else if(q.type==='listen'||q.type==='type')answerUi=`<div style="display:grid;gap:13px">${q.type==='listen'?`<button class="btn secondary" style="width:fit-content" data-action="speak" data-text="${esc(q.speak)}">🔊 ${esc(t('pronounce'))} ▶</button>`:''}<form id="quiz-input-form" class="quiz-text-answer"><input id="quiz-text-input" autocomplete="off" spellcheck="false" value="${esc(typeof quiz.selected==='string'?quiz.selected:'')}" placeholder="${esc(t('writeAnswer'))}" ${quiz.answered?'disabled':''} aria-label="${esc(t('writeAnswer'))}"><button class="btn" type="submit" ${quiz.answered?'disabled':''}>${esc(t('check'))}</button></form></div>`;
 else if(q.type==='arrange'){let selection=Array.isArray(quiz.selected)?quiz.selected:[];answerUi=`<div class="built-sentence">${selection.length?selection.map((a,i)=>`<button class="quiz-word" data-action="remove-token" data-index="${i}" ${quiz.answered?'disabled':''}>${esc(a.v)} ×</button>`).join(''):`<span class="small-muted">${esc(t('tapOrder'))}</span>`}</div><div class="quiz-words">${q.tokens.filter(x=>!selection.some(y=>y.id===x.id)).map(x=>`<button class="quiz-word" data-action="add-token" data-id="${x.id}" ${quiz.answered?'disabled':''}>${esc(x.v)}</button>`).join('')}</div><div class="split" style="margin-top:19px"><button class="btn ghost small" data-action="reset-tokens" ${quiz.answered?'disabled':''}>↺ ${esc(t('reset'))}</button><button class="btn" data-action="check-tokens" ${quiz.answered?'disabled':''}>${esc(t('check'))}</button></div>`}
 return `<button class="back-link" data-action="stop-quiz">← ${esc(t('back'))}</button><section class="quiz-card"><div class="split"><div class="quiz-count">${t('step')} ${quiz.index+1} ${t('of')} ${quiz.questions.length}</div><span class="chip">🏆 ${quiz.score} ${esc(t('correct'))}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><h2 class="quiz-prompt">${esc(q.question)}</h2>${answerUi}${feedback}${quiz.answered?`<button style="margin-top:18px" class="btn wide" data-action="quiz-next">${quiz.index===quiz.questions.length-1?t('finished'):t('continue')} →</button>`:''}</section>`}
function normalize(str){return String(str||'').trim().toLocaleLowerCase('sv').replace(/[\s\t\n]+/g,' ').replace(/[.!?。]+$/,'').normalize('NFC')}
let quizBusy=false;
function quizStorage(){return sessionStorage}
function activeQuizKey(){return cloudAccount()?localStateKey()+':cloud-quiz-v1':quizSessionKey()}
function quizEvent(type,data){return {id:crypto.randomUUID(),event:{type,occurred_at:new Date().toISOString(),timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,data:{session_id:quiz.cloud.id,...data}}}}
async function sendQuizEvent(key){
 const current=quiz,owner=user?.id,intent=current.cloud?.events[key];
 if(!intent||current.cloud.owner!==owner)return false;
 persistQuizSession();
 let timer;
 try{
  const ok=await Promise.race([window.SVProgress.enqueueSession(intent.id,intent.event),new Promise(resolve=>{timer=setTimeout(()=>resolve(false),8000)})]);
  if(ok?.quizResult&&quiz===current)quiz.result=ok.quizResult;
  return !!ok&&quiz===current&&user?.id===owner;
 }finally{clearTimeout(timer)}
}
function quizLoading(value){
 quizBusy=value;
 document.querySelectorAll?.('#page .quiz-card button,#page .quiz-card input,#page [data-action="quiz-retry"],#page [data-action="stop-quiz"]').forEach(el=>{
  if(value){if(el.dataset.quizWasDisabled===undefined)el.dataset.quizWasDisabled=String(el.disabled);el.disabled=true}
  else if(el.dataset.quizWasDisabled!==undefined){el.disabled=el.dataset.quizWasDisabled==='true';delete el.dataset.quizWasDisabled}
  el.setAttribute('aria-busy',String(value));
 });
 const card=document.querySelector('.quiz-card'),status=card?.querySelector('[data-quiz-busy]');
 if(value&&!status)card?.insertAdjacentHTML('beforeend',`<p class="micro-note" data-quiz-busy role="status">${esc(txt4('Сохраняем…','Saving…','Sparar…','Зберігаємо…'))}</p>`);
 if(!value)status?.remove();
}
async function submitAnswer(answer){
 if(!quiz.active||quiz.finished||quiz.answered||quizBusy||!String(answer).trim())return;
 const current=quiz,q=quiz.questions[quiz.index],correct=normalize(answer)===normalize(q.answer);
 if(quiz.cloud){
  const key='answer-'+quiz.index;
  // Preserve the first submitted answer and timestamp if queue storage fails.
  if(!quiz.cloud.events[key])quiz.cloud.events[key]={...quizEvent('answer',{question_index:quiz.index,...(q.questionId?{response:q.serverOptions[q.options.indexOf(answer)]}:{correct})}),answer,correct,choiceIndex:q.type==='choice'?q.options.indexOf(answer):null};
  quizLoading(true);
  let ok=false;try{ok=await sendQuizEvent('start')&&await sendQuizEvent(key)}finally{if(quiz===current)quizLoading(false)}
  if(!ok){if(quiz===current)toast(t('saveError'));return}
  const stored=quiz.cloud.events[key];answer=Number.isInteger(stored.choiceIndex)?q.options[stored.choiceIndex]:stored.answer;
 }
 const intent=quiz.cloud?.events['answer-'+quiz.index];
 const checked=intent?(intent.correct??intent.event.data.correct??correct):correct;
 quiz.answered=true;quiz.selected=answer;quiz.latest=checked;if(checked)quiz.score++;
 if(!checked)(quiz.mistakes??=[]).push({index:quiz.index,answer});
 quiz.answerCount=(quiz.answerCount||0)+1;
 if(!quiz.cloud)mutate(()=>{state.answered++;if(checked)state.correct++;touch();if(q.wordId)markReview(q.wordId,checked)});
 render();
}
async function finishQuiz(){
 if(quizBusy||quiz.finished||!quiz.answered||quiz.index!==quiz.questions.length-1)return;
 const current=quiz;
 if(quiz.cloud){
  quiz.cloud.events.finish??=quizEvent('session_finish',{});
  quizLoading(true);let ok=false;try{ok=await sendQuizEvent('finish')}finally{if(quiz===current)quizLoading(false)}
  if(!ok){if(quiz===current)toast(t('saveError'));return}
  if(Number.isInteger(quiz.result?.correct))quiz.score=quiz.result.correct;
 }else{
  if(quiz.answerCount!==quiz.questions.length)return;
  mutate(()=>{
   const id=quizIdentity(),old=state.quizResults[id],n=quiz.questions.length,passed=quiz.score*5>=n*4;
   const best=!old||quiz.score*old.total>old.correct*n;
   // Existing lesson completion is evidence of a historical bonus, never a new reward.
   const rewarded=!!old?.rewarded||(!['book','topic','video'].includes(quiz.mode)&&state.completed.includes(quiz.lesson));
   const xp=passed&&!rewarded?quizReward():0;
   quiz.result={xp,already_rewarded:rewarded,new_best:best};
   state.quizResults[id]={...(best?{correct:quiz.score,total:n}:old),rewarded:rewarded||xp>0};
   state.xp+=xp;
   if(passed&&quiz.lesson&&!['book','topic','video'].includes(quiz.mode)&&!state.completed.includes(quiz.lesson))state.completed.push(quiz.lesson);
  });
 }
 quiz.finished=true;quiz.active=true;render();
}
function quizSaveLabel(){
 if(!quiz.cloud)return '';
 const activity=window.SVProgress?.activity(),writer=window.SVProgress?.writeStatus(),pending=!writer?.ready||activity?.pending?.some(e=>e.sessionId===quiz.cloud.id);
 return `<p class="micro-note" role="status">${esc(activity?.error||writer?.error?t('saveError'):pending?txt4('Результат ожидает синхронизации','Result awaiting sync','Resultatet väntar på synkronisering','Результат очікує синхронізації'):t('savedAccount'))}</p>`;
}
function renderQuizFinish(){
 const passed=quiz.score*5>=quiz.questions.length*4;
 const mistakes=(quiz.mistakes||[]).map(m=>{const q=quiz.questions[m.index];return `<div class="quiz-feedback failure"><b>${esc(q.question)}</b><p>${esc(m.answer)} → <strong>${esc(q.answer)}</strong></p><small>${esc(q.why||'')}</small></div>`}).join('');
 return `<section class="quiz-card quiz-finished"><div class="big">${passed?'🏆':'💪'}</div><h1>${esc(t('finished'))}</h1><div class="score">${quiz.score} / ${quiz.questions.length}</div><p>${esc(t('accuracy'))}: ${Math.floor(quiz.score*100/quiz.questions.length)}%</p>${quizSaveLabel()}${quizResultLabel()}${quiz.lesson&&passed&&!['book','topic','video'].includes(quiz.mode)?`<p class="badge-verified">✓ ${esc(t('practiceDone'))}</p>`:''}<div class="split" style="justify-content:center;margin-top:25px"><button class="btn secondary" data-action="quiz-retry">↻ ${esc(t('again'))}</button><button class="btn" data-action="quiz-lessons">${esc(t('next'))} →</button></div>${mistakes?`<details style="text-align:left;margin-top:20px;overflow-wrap:anywhere"><summary>${esc(t('bad'))} · ${quiz.mistakes.length}</summary>${mistakes}</details>`:''}</section>`;
}
async function leaveQuiz(destination=null){
 if(quizBusy)return;
 const current=quiz,origin=quiz.origin;
 if(quiz.cloud&&!quiz.finished){
  quiz.cloud.events.abandon??=quizEvent('session_abandon',{});
  quizLoading(true);let ok=false;try{ok=await sendQuizEvent('start')&&await sendQuizEvent('abandon')}finally{if(quiz===current)quizLoading(false)}
  if(!ok){if(quiz===current)toast(t('saveError'));return}
 }
 const key=activeQuizKey();try{quizStorage().removeItem(key)}catch(_){}
 resetQuiz();if(destination)navigate(destination);else if(origin)navigate(origin.route,origin.param);
}
const VIDEOS=[
 {id:'v1',"name":"Hitta hem — Den första lögnen","level":"B–C","duration":"7 min","emoji":"🎬","description":"Den första lögnen","url":"https://urplay.se/program/217858-hitta-hem-den-forsta-lognen"},
 {id:'v2',"name":"Hitta hem — Ett djärvt förslag","level":"B–C","duration":"6 min","emoji":"🎬","description":"Ett djärvt förslag","url":"https://urplay.se/program/217842-hitta-hem-ett-djarvt-forslag"},
 {id:'v3',name:'Välkommen till oss — Bussen',level:'C–D',duration:'6 min',emoji:'🚌',description:'Диалог и правила поведения в автобусе. Серия коротких фильмов.',url:'https://urplay.se/serie/244804-valkommen-till-oss'},
 {id:'v4',"name":"Hitta hem — Martinas hemlighet","level":"B–C","duration":"6 min","emoji":"🎬","description":"Martinas hemlighet","url":"https://urplay.se/program/217854-hitta-hem-martinas-hemlighet"},
 {id:'v5',name:'Kortfilm på svenska',level:'B–D',duration:'5–20 min',emoji:'🍿',description:'Подборка настоящих шведских короткометражек — выбирай по настроению.',url:'https://urplay.se/bladdra/kortfilm/svenska'},
 {id:'v6',name:'SFI — filmer och övningar',level:'A–D',duration:'varierar',emoji:'🇸🇪',description:'Раздел UR Play с обучающими фильмами и упражнениями для SFI.',url:'https://urplay.se/amne/sfi-svenska-for-invandrare'},
 {id:'v7',name:'SVT Play — korta klipp',level:'B–D',duration:'1–5 min',emoji:'🎬',description:'Короткие эпизоды на живом шведском языке. Для тренировки слуха.',url:'https://www.svtplay.se/klipp'},
 {id:'v8',name:'Svenska som andraspråk',level:'A–D',duration:'varierar',emoji:'🎧',description:'Обучающие серии по грамматике, чтению и восприятию шведской речи.',url:'https://urplay.se/amne/svenska-som-andrasprak'}
];
function renderVideos(){return title(t('videos'),t('videosIntro'))+`<div class="notice">🎬 ${esc(t('vidNote'))}</div><div class="video-grid">${VIDEOS.map(v=>`<article class="video-card"><div class="video-art">${esc(v.emoji)}</div><div class="video-body"><small>🇸🇪 SFI ${esc(v.level)} · ${esc(v.duration)}</small><h3>${esc(v.name)}</h3><p>${esc(v.description)}</p><a class="vid-link" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(t('watch'))}</a><div style="margin-top:16px"><button class="btn small ${state.videos.includes(v.id)?'secondary':'ghost'}" data-action="watched" data-id="${v.id}">${state.videos.includes(v.id)?'✓ '+t('watched'):'○ '+t('markWatched')}</button></div></div></article>`).join('')}</div>`}
let activityMonth=null;
function heatmap(){
 const today=new Date();today.setHours(0,0,0,0);
 const month=activityMonth||new Date(today.getFullYear(),today.getMonth(),1);
 const year=month.getFullYear(),index=month.getMonth();
 const current=year===today.getFullYear()&&index===today.getMonth();
 const labels={ru:['Вс','Пн','Вт','Ср','Чт','Пт','Сб'],en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],sv:['Sön','Mån','Tis','Ons','Tor','Fre','Lör'],uk:['Нд','Пн','Вт','Ср','Чт','Пт','Сб']}[locale4()];
 const monthLabel=new Intl.DateTimeFormat(locale4(),{month:'long',year:'numeric'}).format(month);
 const prev=txt4('Предыдущий месяц','Previous month','Föregående månad','Попередній місяць');
 const next=txt4('Следующий месяц','Next month','Nästa månad','Наступний місяць');
 const reset=txt4('Текущий месяц','Current month','Aktuell månad','Поточний місяць');
 const out=[];
 for(let i=0;i<month.getDay();i++)out.push('<div class="calendar-empty" aria-hidden="true"></div>');
 const days=new Date(year,index+1,0).getDate();
 for(let day=1;day<=days;day++){
   const d=new Date(year,index,day),future=d>today;
   const key=`${year}-${String(index+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
   const count=future?0:(state.activity?.[key]||0);
   out.push(`<div class="day-col"><div data-study-date="${key}" tabindex="0" role="button" class="day-square${count?' done':''}${future?' upcoming':''}${d.getTime()===today.getTime()?' today':''}" title="${key} · ${count}"${d.getTime()===today.getTime()?' aria-current="date"':''}><strong>${esc(labels[d.getDay()])}</strong><span>${day}</span></div></div>`);
 }
 return `<div class="activity-calendar" data-calendar-month="${year}-${String(index+1).padStart(2,'0')}-01"><div class="calendar-controls"><button type="button" class="btn secondary calendar-arrow" data-action="activity-month" data-step="-1" aria-label="${esc(prev)}"><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 6-6 6 6 6"/></svg></button><span class="calendar-label" aria-live="polite">${esc(monthLabel)}</span><button type="button" class="btn secondary calendar-arrow" data-action="activity-month" data-step="1" aria-label="${esc(next)}"${current?' disabled':''}><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></button></div><div class="daily-bar calendar-month" data-activity-month>${out.join('')}</div>${current?'':`<button type="button" class="btn secondary small calendar-reset" data-action="activity-current">${esc(reset)}</button>`}</div>`;
}

function renderProfile(){const display=user?.name||t('guest');return title(t('profileTitle'),user?t('savedAccount'):t('guestMode'))+`<div class="profile-banner"><div class="big-avatar">${user?'👩‍🎓':'🌻'}</div><div><h2>${esc(display)}</h2><p>${esc(user?.email||t('guestMode'))}</p><span class="chip">🇸🇪 SFI ${esc(state.settings.level)} · ⭐ ${state.xp||0} XP</span></div></div><section class="stats-grid">${stat('🔥',streak(),t('dayStreak'),'orange')}${stat('📖',state.completed.length,t('lessonCount'),'purple')}${stat('🧠',state.known.length,t('knownWords'),'mint')}${stat('🎯',state.answered?Math.round(100*state.correct/state.answered)+'%':'0%',t('accuracy'),'pink')}</section>
<div class="profile-grid"><section class="content-panel"><h3>🗓 ${esc(t('practiceActivity'))}</h3><p class="micro-note">${Object.keys(state.activity).length} ${esc(t('dayPractice'))} · ${state.answered} ${esc(t('step'))}</p>${heatmap()}</section><section class="content-panel"><h3>⚙️ ${esc(t('settings'))}</h3><div class="settings-row"><div><b>${esc(t('interfaceLang'))}</b></div><select id="profile-lang" class="form-select"><option value="ru" ${state.settings.language==='ru'?'selected':''}>Русский</option><option value="en" ${state.settings.language==='en'?'selected':''}>English</option><option value="sv" ${state.settings.language==='sv'?'selected':''}>Svenska</option><option value="uk" ${state.settings.language==='uk'?'selected':''}>Українська</option></select></div><div class="settings-row"><div><b>${esc(t('sfiLevel'))}</b></div><select id="profile-level" class="form-select">${'ABCD'.split('').map(l=>`<option ${state.settings.level===l?'selected':''}>${l}</option>`).join('')}</select></div><p class="info-scope">${user?'☁️ '+t('savedAccount'):'📱 '+t('savedGuest')}</p></section></div><section class="content-panel" style="margin-top:20px"><h3>👤 ${esc(user?t('profile'):t('register'))}</h3><p style="font-size:13px;color:var(--muted)">${esc(user?t('savedAccount'):t('accountExplain'))}</p>${user?`<button class="btn ghost" data-action="logout">${esc(t('logout'))} ↗</button>`:`<div class="split" style="justify-content:flex-start"><button class="btn" data-action="auth" data-mode="register">${esc(t('register'))}</button><button class="btn secondary" data-action="auth" data-mode="login">${esc(t('login'))}</button></div>`}</section>`}
function searchNow(value){let q=value.trim().toLocaleLowerCase();const el=$('#search-results');if(!q){el.classList.add('hidden');el.innerHTML='';return}const words=WORDS.filter(w=>[w.word,w.ru,w.inf,w.pre,w.past,w.sup,w.category].some(x=>String(x||'').toLocaleLowerCase().includes(q))).slice(0,9);const lessons=LESSONS.filter(l=>(l.title+' '+l.description+' '+l.rules.join(' ')).toLocaleLowerCase().includes(q)).slice(0,5);el.innerHTML=(lessons.map(l=>`<button class="search-result" data-nav="lesson" data-param="${l.id}"><span class="emo">${esc(l.emoji)}</span><span><strong>${esc(l.title)}</strong><small>📚 SFI ${l.level} · ${esc(t('lesson'))}</small></span></button>`).join('')+words.map(w=>`<button class="search-result" data-nav="word" data-param="${esc(w.id)}"><span class="emo">${esc(w.emoji)}</span><span><strong>${esc(wordLabel(w))}</strong><small>${esc(w.ru)}</small></span></button>`).join(''))||`<div class="serp-empty">${esc(t('noResults'))}</div>`;el.classList.remove('hidden')}
function openAuth(mode='register'){const el=$('#modal-inner');$('#modal-backdrop').classList.remove('hidden');el.innerHTML=`<div style="font-size:47px;text-align:center">${mode==='register'?'🌸':'🇸🇪'}</div><h2 style="text-align:center;margin-top:10px">${esc(t(mode))}</h2><p style="text-align:center;font-size:12px;color:var(--muted)">${esc(t('accountExplain'))}</p><form id="auth-form" data-mode="${mode}">${mode==='register'?`<label class="form-field" for="auth-name">${esc(t('name'))}</label><input id="auth-name" class="form-input" name="name" required minlength="2" maxlength="70" autocomplete="name">`:''}<label class="form-field" for="auth-email">${esc(t('email'))}</label><input id="auth-email" class="form-input" name="email" type="email" required maxlength="254" autocomplete="email"><label class="form-field" for="auth-pass">${esc(t('password'))}</label><input id="auth-pass" class="form-input" name="password" type="password" required minlength="${mode==='register'?8:1}" autocomplete="${mode==='register'?'new-password':'current-password'}"><p class="form-error" id="auth-error" role="alert"></p><p id="auth-status" role="status" aria-live="polite"></p><button class="btn wide" id="auth-submit" type="submit">${esc(t(mode))} →</button></form><div style="margin-top:18px;text-align:center"><button class="auth-link" data-action="auth" data-mode="${mode==='register'?'login':'register'}">${esc(t(mode==='register'?'haveAccount':'newAccount'))}</button></div>`;setTimeout(()=>$('#auth-email')?.focus(),50)}
function closeAuth(){$('#modal-backdrop').classList.add('hidden');$('#modal-inner').innerHTML=''}

let accountDeletionBusy = false;

function openAccountDeletion(){
 if(!user||!cloudAccount()||accountDeletionBusy)return;

 const heading=txt4('Удалить аккаунт?','Delete account?','Radera kontot?','Видалити акаунт?');
 const warning=txt4(
  'Все выученные слова, XP, результаты тестов и учебная история будут удалены без возможности восстановления.',
  'Your learned words, XP, quiz results and learning history will be permanently deleted.',
  'Dina inlärda ord, XP, testresultat och studiehistorik raderas permanent.',
  'Вивчені слова, XP, результати тестів та історія навчання будуть видалені назавжди.'
 );
 const confirm=txt4(
  'Я понимаю, что это действие необратимо.',
  'I understand this cannot be undone.',
  'Jag förstår att detta inte kan ångras.',
  'Я розумію, що цю дію не можна скасувати.'
 );

 $('#modal-backdrop').classList.remove('hidden');
 $('#modal-inner').innerHTML=`
 <div style="text-align:center;font-size:40px" aria-hidden="true">🔒</div>
 <h2 style="text-align:center">${esc(heading)}</h2>
 <p style="line-height:1.6">${esc(warning)}</p>
 <form id="delete-account-form">
  <label class="form-field" for="delete-account-password">
   ${esc(txt4('Подтверди пароль','Confirm password','Bekräfta lösenord','Підтвердь пароль'))}
  </label>
  <input id="delete-account-password" class="form-input"
   type="password" autocomplete="current-password"
   required maxlength="1024">
  <label style="display:flex;gap:10px;align-items:start;margin:18px 0">
   <input type="checkbox" required>
   <span>${esc(confirm)}</span>
  </label>
  <p id="delete-account-status" role="alert" aria-live="polite"></p>
  <div class="split">
   <button type="button" class="btn secondary"
    data-action="cancel-delete-account">
    ${esc(txt4('Отмена','Cancel','Avbryt','Скасувати'))}
   </button>
   <button type="submit" class="btn"
    id="delete-account-submit"
    style="background:#b83b51!important;color:white!important" disabled>
    ${esc(txt4('Удалить навсегда','Delete permanently','Radera permanent','Видалити назавжди'))}
   </button>
  </div>
 </form>`;
 const deletionForm=$('#delete-account-form');
 const updateDeletionButton=()=>{
  const password=deletionForm?.querySelector('#delete-account-password');
  const checkbox=deletionForm?.querySelector('input[type="checkbox"]');
  const button=deletionForm?.querySelector('#delete-account-submit');
  if(button)button.disabled=accountDeletionBusy||!password?.value||!checkbox?.checked;
 };
 deletionForm?.addEventListener('input',updateDeletionButton);
 deletionForm?.addEventListener('change',updateDeletionButton);
 updateDeletionButton();
 $('#delete-account-password')?.focus();
}

async function confirmAccountDeletion(form){
 if(accountDeletionBusy||!user||!cloudAccount())return;
 const ownerId=user.id;
 const input=form.querySelector('#delete-account-password');
 const status=form.querySelector('#delete-account-status');
 const submit=form.querySelector('#delete-account-submit');
 const password=input?.value||'';
 if(!password||!form.querySelector('input[type="checkbox"]')?.checked)return;

 accountDeletionBusy=true;
 submit.disabled=true;
 status.textContent=txt4(
  'Проверяем запрос…','Checking request…',
  'Kontrollerar begäran…','Перевіряємо запит…'
 );

 try{
  const session=await window.SVAuth.getSession();
  if(!session?.access_token||session.user?.id!==ownerId)
   throw Error('AUTH_CONTEXT_CHANGED');

  const client=await window.SVSupabase.getClient();
  const {data,error}=await client.functions.invoke('delete-account',{
   body:{confirmation:'DELETE MY ACCOUNT',password}
  });

  if(error||data?.status!=='deleted'){
   const response=error?.context;
   let code='';
   if(response instanceof Response){
    const payload=await response.clone().json().catch(()=>null);
    code=payload?.error||'';
   }
   status.textContent=code==='deletion_not_enabled'||code==='deletion_test_account_only'
    ?txt4(
      'Удаление пока отключено на время тестирования.',
      'Deletion is temporarily disabled during testing.',
      'Radering är tillfälligt avstängd under testning.',
      'Видалення тимчасово вимкнено під час тестування.'
     )
    :txt4(
      'Не удалось завершить удаление. Обратись в поддержку.',
      'Deletion could not be completed. Contact support.',
      'Raderingen kunde inte slutföras. Kontakta support.',
      'Не вдалося завершити видалення. Звернися до підтримки.'
     );
   return;
  }

  try{await window.SVAuth.signOut()}catch(_){}
  accountDeletionBusy=false;
  closeAuth();
  applyAuthState(window.SVAuth.getState());
  navigate('home');
  toast(txt4(
   'Аккаунт удалён.','Account deleted.',
   'Kontot har raderats.','Акаунт видалено.'
  ));
 }catch(_){
  status.textContent=txt4(
   'Не удалось выполнить запрос. Попробуй позже.',
   'Request failed. Please try again later.',
   'Begäran misslyckades. Försök igen senare.',
   'Не вдалося виконати запит. Спробуй пізніше.'
  );
 }finally{
  if(input)input.value='';
  accountDeletionBusy=false;
  submit.disabled=true;
 }
}

function resetQuiz(){quiz={active:false,finished:false,mode:'mixed',lesson:null,questions:[],index:0,score:0,answered:false,selected:[],latest:null};render()}
function nextFlash(n=1){flash.index=(flash.index+n+flash.ids.length)%flash.ids.length;flash.flipped=false;render()}
async function action(btn){if(btn.dataset.nav){$('#search-results').classList.add('hidden');$('#global-search').value='';navigate(btn.dataset.nav,btn.dataset.param||'');return}
 const name=btn.dataset.action||'';
 if(cloudAccount()&&unsupportedAction(name,btn))return;
 if(name==='auth-retry'){await window.SVAuth?.initialize();applyAuthState(window.SVAuth.getState());if(user)await window.SVProgress?.retry();render();return}
 if(name==='save-retry'){if(window.SVProgress)await window.SVProgress.retry();else location.reload();return}
 if(name==='accept-word-state'){await window.SVProgress.acceptCurrentWordState();return}
 if(name==='review-reveal'){if(reviewExercise){reviewExercise.revealed=true;render()}return}
 if(name==='review-grade'){await gradeWordReview(btn.dataset.value==='1');return}
 if(name==='dict-clear-search'){dictFilter.text='';dictFilter.limit=42;render();$('#dict-search')?.focus({preventScroll:true});return}
 if(name==='dict-reset'){resetDictionaryFilters();render();return}
 if(name==='accept-favorites'){await window.SVProgress.acceptCurrentFavorites();return}
 if(name==='show-learned'||name==='show-favorites'){navigate('dictionary',name==='show-learned'?'learned':'favorites');return}
 if(name==='flash-scope'){if(btn.dataset.scope==='known'){navigate('dictionary','learned');return}flashFilter.scope='all';createFlashDeck();render();return}

 if(name==='activity-month'||name==='activity-current'){
   const now=new Date(),current=new Date(now.getFullYear(),now.getMonth(),1);
   if(name==='activity-current')activityMonth=null;
   else{
     const month=activityMonth||current,step=Number(btn.dataset.step);
     if(step!==-1&&step!==1)return;
     const target=new Date(month.getFullYear(),month.getMonth()+step,1);
     if(target>current)return;
     activityMonth=target;
   }
   render();
   document.querySelector(`[data-action="${name}"]${name==='activity-month'?`[data-step="${btn.dataset.step}"]`:''}:not(:disabled)`)?.focus({preventScroll:true});
   return;
 }
 if(name==='letter-speak'||name==='speak-letter'){speakLetter3(btn.dataset.letter);return}
 if(name==='topic-quiz'){await startQuiz('topic',btn.dataset.topic);return}
 if(name==='book-quiz'){await startQuiz('book',btn.dataset.id);return}
 if(name==='book-read'){
   const id=btn.dataset.id;
   mutate(()=>{
     if(state.booksRead.includes(id)){
       state.booksRead=state.booksRead.filter(bookId=>bookId!==id);
       state.xp=Math.max(0,state.xp-20);
     }else{
       state.booksRead.push(id);state.xp+=20;touch();
     }
   });
   render();
   document.querySelector('[data-action="book-read"]')?.focus({preventScroll:true});
   return;
 }
 if(name==='speak'){speak(btn.dataset.text);return}
 if(name==='auth'){openAuth(btn.dataset.mode);return}
 if(name==='logout'){await logout();return}
 if(name==='delete-account'){openAccountDeletion();return}
 if(name==='cancel-delete-account'){closeAuth();return}
 if(name==='course'){selectedLevel=btn.dataset.level;navigate('lessons',selectedLevel);return}
 if(name==='level'){selectedLevel=btn.dataset.level;navigate('lessons',selectedLevel);return}
 if(name==='dict-more'){dictFilter.limit+=42;render();return}
 if(name==='toggle-fav'){const scope=btn.dataset.fav==='true'?'favorites':'';navigate('dictionary',scope);return}
 if(name==='favorite'){await setWordFavorite(btn.dataset.id);return}
 if(name==='mark-known'){if(state.known.includes(btn.dataset.id)){await unlearnWord(btn.dataset.id);return}await learnWord(btn.dataset.id);return}
 if(name==='mark-review'){await addManualReview(btn.dataset.id);return}
 if(name==='remove-review'){await window.SVManualReviews?.change('remove',btn.dataset.id);return}
 if(name==='retry-manual-reviews'){await window.SVManualReviews?.refresh();return}
 if(name==='flash-reset'){flashFilter={kind:'all',group:'all',category:'all'};createFlashDeck();render();return}
 if(name==='flash-flip'){flash.flipped=!flash.flipped;render();return}
 if(name==='flash-next'){nextFlash(1);return}
 if(name==='flash-prev'){nextFlash(-1);return}
 if(name==='flash-grade'){const id=flash.ids[flash.index];if(btn.dataset.value==='1'){if(state.known.includes(id))await unlearnWord(id);else await learnWord(id);return}await addManualReview(id);return}
 if(name==='start-mode'){await startQuiz(btn.dataset.mode);const q=quiz.questions[0];if(q?.type==='listen')speak(q.speak);return}
 if(name==='lesson-test'){await startQuiz('lesson',btn.dataset.id);return}
 if(name==='start-review'){if(!canReviewWords())return;const id=manualReviewIds()[0];if(id)navigate('word-review',id);return}
 if(name==='quiz-choice'){await submitAnswer(btn.dataset.choice);return}
 if(name==='quiz-next'){if(quizBusy||!quiz.active||!quiz.answered||quiz.finished)return;if(quiz.index>=quiz.questions.length-1)await finishQuiz();else{quiz.index++;quiz.answered=false;quiz.selected=[];quiz.latest=null;render();let q=quiz.questions[quiz.index];if(q?.type==='listen')setTimeout(()=>speak(q.speak),250)}return}
 if(name==='quiz-retry'){if(!quiz.finished||quizBusy)return;await startQuiz(quiz.mode,quiz.lesson,quiz.mode==='review');return}
 if(name==='stop-quiz'){await leaveQuiz();return}
 if(name==='quiz-lessons'){await leaveQuiz('lessons');return}
 if(name==='add-token'){if(quiz.answered||quizBusy)return;const q=quiz.questions[quiz.index],tok=q.tokens.find(x=>x.id===btn.dataset.id);if(tok&&!quiz.selected.some(x=>x.id===tok.id)){quiz.selected.push(tok);render()}return}
 if(name==='remove-token'){if(quiz.answered||quizBusy)return;quiz.selected.splice(Number(btn.dataset.index),1);render();return}
 if(name==='reset-tokens'){if(quiz.answered||quizBusy)return;quiz.selected=[];render();return}
 if(name==='check-tokens'){let q=quiz.questions[quiz.index];if(!quiz.selected.length)return;await submitAnswer(quiz.selected.map(x=>x.v).join(' ') + q.punct);return}
 if(name==='watched'){await toggleVideoWatched(btn.dataset.id);return}}
function changeLanguage(v){
 if(!languages.includes(v))return;
 const question=quiz.active&&!quiz.finished?quiz.questions[quiz.index]:null;
 const selectedIndex=question?.type==='choice'?question.options.indexOf(quiz.selected):-1;
 const draft=document.querySelector('#quiz-text-input');
 if(draft&&!quiz.answered)quiz.selected=draft.value;
 state.settings.language=v;
 if(selectedIndex>=0)quiz.selected=question.options[selectedIndex];
 localStorage.setItem('sv-language',v);save();render();
 const search=document.querySelector('#global-search');
 if(search?.value)searchNow(search.value);
}
function dictTextUpdate(input){const start=input.selectionStart||0;dictFilter.text=input.value;dictFilter.limit=42;render();const el=$('#dict-search');if(el){el.focus();try{el.setSelectionRange(start,start)}catch{}}}
function bindEvents(){document.addEventListener('click',e=>{const b=e.target.closest('button[data-action],button[data-nav]');if(b){e.preventDefault();void action(b).catch(()=>toast(ux('error')));return}const card=e.target.closest('.words-grid [data-word-link]');if(card&&!e.target.closest('a,input,select,textarea,button'))navigate('word',card.dataset.wordLink)});document.addEventListener('keydown',e=>{const card=e.target.closest('.words-grid [data-word-link]');if(card&&e.target===card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();navigate('word',card.dataset.wordLink)}});document.addEventListener('change',e=>{const el=e.target;if(el.id==='lang-select'||el.id==='profile-lang')changeLanguage(el.value);if(el.id==='profile-level')void saveProfileLevel(el);if(el.id==='dict-kind'){dictFilter.kind=el.value;if(el.value!=='verb')dictFilter.group='all';dictFilter.limit=42;render()}if(el.id==='dict-group'){dictFilter.group=el.value;dictFilter.limit=42;render()}if(el.id==='dict-category'){dictFilter.category=el.value;dictFilter.limit=42;render()}if(el.id==='flash-kind'){flashFilter.kind=el.value;if(el.value!=='verb')flashFilter.group='all';createFlashDeck();render()}if(el.id==='flash-group'){flashFilter.group=el.value;createFlashDeck();render()}});
 document.addEventListener('input',e=>{if(e.target.id==='quiz-text-input'&&quiz.active&&!quiz.answered){quiz.selected=e.target.value;persistQuizSession()}if(e.target.id==='dict-search')dictTextUpdate(e.target);if(e.target.id==='global-search')searchNow(e.target.value)});document.addEventListener('submit',e=>{if(e.target.id==='auth-form'){e.preventDefault();authSubmit(e.target)}if(e.target.id==='delete-account-form'){e.preventDefault();void confirmAccountDeletion(e.target)}if(e.target.id==='quiz-input-form'){e.preventDefault();submitAnswer($('#quiz-text-input')?.value||'')}});
 $('#close-modal').addEventListener('click',closeAuth);$('#modal-backdrop').addEventListener('click',e=>{if(e.target.id==='modal-backdrop')closeAuth()});document.addEventListener('click',e=>{if(!e.target.closest('.topbar-left'))$('#search-results').classList.add('hidden')});document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();$('#global-search').focus()}if(e.key==='Escape'){closeAuth();$('#search-results').classList.add('hidden')}if(route==='flashcards'&&!['INPUT','TEXTAREA','SELECT','BUTTON','A'].includes(document.activeElement?.tagName)){if(e.key==='ArrowRight')nextFlash(1);if(e.key==='ArrowLeft')nextFlash(-1);if(e.key===' '){e.preventDefault();flash.flipped=!flash.flipped;render()}}});window.addEventListener('hashchange',()=>{const current=route+(routeParam?'/'+routeParam:'');if(decodeURIComponent(location.hash.slice(1))===current)return;hydrateLocation();render();restoreDictionaryPosition(route==='dictionary'?dictionaryViews.get(dictionaryViewKey(routeParam)):null)});window.addEventListener('pagehide',persistQuizSession)}

async function boot(){
 try{
  [WORDS,LESSONS,BOOKS]=await loadLearningData();
  state=readLocalState();
  restoreQuizSession();
  hydrateLocation();bindEvents();render();
  if(window.SVAuth){
   void window.SVProgress?.initialize({onError:()=>{cloudReadError=true;if(user)refreshWordUI(true)},onActivity:info=>{if(user){if(info.completed&&!info.completed.type.startsWith('session_')&&info.completed.type!=='answer')toast(info.completed.type==='video_set'?videoText('server'):info.completed.type==='unmark_known'?wordUX('returned'):['mark_review','review_grade'].includes(info.completed.type)?wordUX('reviewSaved'):info.completed.type==='mark_known'?txt4('Слово изучено','Word learned','Ordet är inlärt','Слово вивчено'):info.completed.data.value?txt4('Добавлено в избранное','Added to favorites','Tillagt i favoriter','Додано до обраного'):txt4('Удалено из избранного','Removed from favorites','Borttaget från favoriter','Видалено з обраного'));refreshWordUI();if(info.completed?.type==='mark_known')void window.SVManualReviews?.refresh();if(route==='practice'&&quiz.finished)render()}},onSnapshot:(snapshot,userId)=>{
    applyAuthState(window.SVAuth.getState());
    if(user?.id===userId){cloudReadError=false;state=sanitize(snapshot);refreshWordUI(true)}
   },previewCatalog:()=>({
    version:'static-afaa62b7426e09a7',words:WORDS.map(x=>x.id),lessons:LESSONS.map(x=>x.id),
    books:BOOKS.map(x=>x.id),videos:[...VIDEOS,...MORE_VIDEOS].map(x=>x.id)
   })});
   window.SVAuth.subscribe(()=>applyAuthState(window.SVAuth.getState()));
   window.SVManualReviews?.initialize(manualQueueChanged);
   // Restore without delaying guest learning during a network outage.
   void window.SVAuth.initialize().then(auth=>{
    if(auth.user)void window.SVAuth.refreshUser().catch(()=>{});
    applyAuthState(window.SVAuth.getState());
    if(auth.status==='unavailable')renderProgressUX(true);
    if(auth.callbackError){openAuth('login');$('#auth-error').textContent=authText('callback')}
   }).catch(()=>{});
  }
  if('serviceWorker' in navigator && (location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1'))
   navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{});
 }catch(e){
  console.error(e);
  const message={ru:['Не удалось загрузить занятия','Проверь подключение к интернету и обнови страницу.','Попробовать снова'],en:['Could not load the lessons','Check your internet connection and reload the page.','Try again'],sv:['Kunde inte ladda lektionerna','Kontrollera internetanslutningen och ladda om sidan.','Försök igen'],uk:['Не вдалося завантажити заняття','Перевір інтернет-з’єднання та онови сторінку.','Спробувати знову']}[locale4()]||['Could not load the lessons','Check your internet connection and reload the page.','Try again'];
  $('#page').innerHTML=`<div class="empty-state"><div class="big">🛠️</div><h2>${esc(message[0])}</h2><p>${esc(message[1])}</p><button type="button" class="btn" id="boot-retry">${esc(message[2])}</button></div>`;
  $('#boot-retry').addEventListener('click',()=>location.reload());
 }
}
async function loadLearningData(){
 const controller=new AbortController();let timer;
 try{
  return await Promise.race([
   Promise.all(['words','lessons','books'].map(async name=>{
    const response=await fetch(`./${name}.json`,{signal:controller.signal});
    if(!response.ok)throw Error('LEARNING_DATA_UNAVAILABLE');
    const data=await response.json();
    if(!Array.isArray(data)||!data.length)throw Error('INVALID_LEARNING_DATA');
    return data;
   })),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('LEARNING_DATA_TIMEOUT')),12000)})
  ]);
 }finally{clearTimeout(timer);controller.abort()}
}
/* Svenska Lätt 3 — expanded curriculum, word modules, alphabet, readers & quizzes. */
const UI3={
 ru:{topics:'Словарные модули',rulesHub:'Все правила',books:'Мини-книги',alphabetHub:'Алфавит А–Ö',wordsModule:'Слова по темам',accountRank:'Уровень аккаунта',readNow:'Читать',reading:'Чтение',bookQuiz:'Проверь понимание',vocabulary:'Лексика',chooseModule:'Выбери модуль',lessonOverview:'После этого урока ты сможешь',readSample:'Мини-текст',notes:'Шпаргалка',levelNext:'До следующего уровня',quizDuration:'вопросов',formWord:'Вставь слово',daysPractice:'Дни недели',lettersPractice:'Буквы и звуки',monthsPractice:'Месяцы',dialoguePractice:'Диалоги',textPractice:'Читаем текст',chooseVoice:'Шведский голос',topicQuiz:'Тест по теме',listenReading:'Слушать весь текст',readBook:'Прочитано',booksRead:'Прочитано книг',allWords:'Все слова',alphabetPron:'Полный алфавит — 29 букв',howSound:'Название буквы и пример',next100:'100 XP = 1 уровень',learnTopic:'Учить эту тему',sentenceTip:'Слушай, читай и отвечай на вопросы',oneLevel:'Уровень'},
 en:{topics:'Vocabulary modules',rulesHub:'Grammar rules',books:'Short stories',alphabetHub:'Alphabet A–Ö',wordsModule:'Words by topic',accountRank:'Account level',readNow:'Read',reading:'Reading',bookQuiz:'Check understanding',vocabulary:'Vocabulary',chooseModule:'Choose a module',lessonOverview:'In this lesson you will',readSample:'Mini text',notes:'Cheat sheet',levelNext:'To next level',quizDuration:'questions',formWord:'Fill the gap',daysPractice:'Weekdays',lettersPractice:'Letters and sounds',monthsPractice:'Months',dialoguePractice:'Dialogues',textPractice:'Reading quiz',chooseVoice:'Swedish voice',topicQuiz:'Topic quiz',listenReading:'Listen to full story',readBook:'Read',booksRead:'Books read',allWords:'All words',alphabetPron:'Complete alphabet — 29 letters',howSound:'Letter name and example',next100:'100 XP = 1 level',learnTopic:'Learn topic',sentenceTip:'Listen, read and answer questions',oneLevel:'Level'},
 sv:{topics:'Ord efter ämne',rulesHub:'Grammatikregler',books:'Korta berättelser',alphabetHub:'Alfabetet A–Ö',wordsModule:'Tematiska ord',accountRank:'Kontonivå',readNow:'Läs',reading:'Läsning',bookQuiz:'Frågor om texten',vocabulary:'Ordförråd',chooseModule:'Välj ett tema',lessonOverview:'Efter lektionen kan du',readSample:'Kort text',notes:'Sammanfattning',levelNext:'Till nästa nivå',quizDuration:'frågor',formWord:'Fyll i ordet',daysPractice:'Veckodagar',lettersPractice:'Bokstäver och ljud',monthsPractice:'Månader',dialoguePractice:'Dialoger',textPractice:'Läsförståelse',chooseVoice:'Svensk röst',topicQuiz:'Tematest',listenReading:'Lyssna på texten',readBook:'Läst',booksRead:'Lästa berättelser',allWords:'Alla ord',alphabetPron:'Hela alfabetet – 29 bokstäver',howSound:'Bokstavens namn och exempel',next100:'100 XP = 1 nivå',learnTopic:'Lär dig temat',sentenceTip:'Lyssna, läs och svara',oneLevel:'Nivå'},
 uk:{topics:'Словникові модулі',rulesHub:'Усі правила',books:'Короткі оповідання',alphabetHub:'Абетка A–Ö',wordsModule:'Слова за темами',accountRank:'Рівень акаунта',readNow:'Читати',reading:'Читання',bookQuiz:'Перевір розуміння',vocabulary:'Лексика',chooseModule:'Вибери модуль',lessonOverview:'Після цього уроку ти зможеш',readSample:'Мінітекст',notes:'Шпаргалка',levelNext:'До наступного рівня',quizDuration:'запитань',formWord:'Встав слово',daysPractice:'Дні тижня',lettersPractice:'Літери та звуки',monthsPractice:'Місяці',dialoguePractice:'Діалоги',textPractice:'Розуміння тексту',chooseVoice:'Шведський голос',topicQuiz:'Тест за темою',listenReading:'Прослухати весь текст',readBook:'Прочитано',booksRead:'Прочитано книжок',allWords:'Усі слова',alphabetPron:'Уся абетка — 29 літер',howSound:'Назва літери та приклад',next100:'100 XP = 1 рівень',learnTopic:'Вивчати тему',sentenceTip:'Слухай, читай і відповідай',oneLevel:'Рівень'}
};
for(const lng of languages)Object.assign(DICT[lng],UI3[lng]);
const ALPHABET3=[
 ['A','/ɑː/','apa','обезьяна'],['B','/beː/','bil','автомобиль'],['C','/seː/','cykel','велосипед'],['D','/deː/','dag','день'],['E','/eː/','en','один (общий род)'],['F','/ɛf/','fisk','рыба'],['G','/ɡeː/','gul','жёлтый'],['H','/hoː/','hus','дом'],['I','/iː/','is','лёд'],['J','/jiː/','jag','я'],['K','/koː/','katt','кот'],['L','/ɛl/','lampa','лампа'],['M','/ɛm/','mat','еда'],['N','/ɛn/','nej','нет'],['O','/uː/','ost','сыр'],['P','/peː/','pappa','папа'],['Q','/kʉː/','quiz','викторина'],['R','/ær/','röd','красный'],['S','/ɛs/','sol','солнце'],['T','/teː/','tack','спасибо'],['U','/ʉː/','ung','молодой'],['V','/veː/','vän','друг'],['W','/dɵbəlˈveː/','webb','веб'],['X','/ɛks/','xylophon','ксилофон'],['Y','/yː/','yxa','топор'],['Z','/ˈsɛːta/','zebra','зебра'],['Å','/oː/','år','год'],['Ä','/ɛː/','äpple','яблоко'],['Ö','/øː/','öga','глаз']
];
const DAYS3=[['måndag','понедельник'],['tisdag','вторник'],['onsdag','среда'],['torsdag','четверг'],['fredag','пятница'],['lördag','суббота'],['söndag','воскресенье']];
const MONTHS3=[['januari','январь'],['februari','февраль'],['mars','март'],['april','апрель'],['maj','май'],['juni','июнь'],['juli','июль'],['augusti','август'],['september','сентябрь'],['oktober','октябрь'],['november','ноябрь'],['december','декабрь']];
const CLOZE3=[
 ['Jag ___ i Sverige.','bor',['bor','är','har','vill'],'Для «я живу» нужен bor (глагол bo).'],['I dag är det ___.','fredag',['fredag','fem','blå','köpa'],'После det är здесь называем день недели.'],['Hon ___ svenska varje dag.','läser',['läser','läsa','läste','läst'],'Presens для läsa — läser.'],['Jag har ___ en bok.','köpt',['köpt','köpte','köper','köpa'],'После har нужен supinum: köpt.'],['Det är ___ äpple.','ett',['ett','en','den','de'],'Äpple — ett-слово: ett äpple.'],['Jag går ___ skolan.','till',['till','från','under','utan'],'Till обозначает направление «в школу».'],['Min syster ___ tio år.','är',['är','har','går','kan'],'Возраст выражают с är: är tio år.'],['Vi ska ___ mat i kväll.','laga',['laga','lagar','lagade','lagat'],'После ska употребляем infinitiv (без att).'],['Jag vill ___ svenska.','lära mig',['lära mig','lär mig','lärde mig','lärt mig'],'После vill — инфинитив lära; lära sig — возвратный глагол.'],['På måndag ___ jag i skolan.','arbetar',['arbetar','jag arbetar','arbete','arbeta'],'После обстоятельства времени сказуемое на второй позиции.'],['Hon kommer inte ___ dag.','i',['i','på','av','med'],'Устойчивое выражение i dag — сегодня.'],['Vi ___ varit i Malmö.','har',['har','är','ska','kan'],'Perfekt = har + supinum (varit).'],['Jag har ont ___ huvudet.','i',['i','på','till','mot'],'Стандартно: ha ont i huvudet.'],['Han tar ___ till skolan.','bussen',['bussen','bussar','buss','ett buss'],'После tar имеется конкретный автобус, форма bussen.'],['Boken ligger ___ bordet.','på',['på','av','från','om'],'На поверхности — på bordet.'],['Jag ___ inte prata svenska så bra än.','kan',['kan','måste','vill','har'],'Kan обозначает умение: я пока не могу так хорошо говорить.'],['Om det regnar, ___ vi hemma.','stannar',['stannar','vi stannar','stanna','stannat'],'После придаточного Om... в главном глагол занимает вторую позицию.'],['Ett ___ hus.','stort',['stort','stor','stora','store'],'С ett-словом прилагательное обычно получает -t.'],['Jag skriver ___ mejl till min lärare.','ett',['ett','en','den','de'],'Mejl — ett-слово.'],['Kan du ___ mig?','hjälpa',['hjälpa','hjälper','hjälpte','hjälpt'],'После kan — infinitiv.'],['I morgon ___ jag tidigt.','börjar',['börjar','jag börjar','började','börja'],'В главном предложении после I morgon идёт личный глагол.'],['Det är kallt, så jag tar ___ en jacka.','på mig',['på mig','med dig','på henne','mig på'],'Ta på sig — надевать на себя.'],['Jag ___ kaffe varje morgon.','dricker',['dricker','dricka','druckit','drack'],'Presens от dricka — dricker.'],['Hon vill gå ___ biblioteket.','till',['till','från','över','bakom'],'Направление к месту обозначаем till.'],['I går ___ jag hemma.','var',['var','är','vara','varit'],'Preteritum от vara — var.']
];
const DIALOGUES3=[
 ['– Hej! Hur ___ du? – Bra, tack!','mår',['mår','har','kan','äter'],'Hur mår du? — Как ты себя чувствуешь?'],['– Vad ___ du? – Jag heter Sara.','heter',['heter','bor','kommer','gör'],'Vad heter du? — Как тебя зовут?'],['– ___ bor du? – I Karlskrona.','Var',['Var','Vem','När','Hur'],'Var спрашивает о местонахождении.'],['– Vill du ha kaffe? – Ja, ___.','tack',['tack','hej','hej då','inte'],'Ja, tack — да, спасибо.'],['– Vad kostar det? – Det kostar hundra ___.','kronor',['kronor','dagar','bilar','minuter'],'Цена в Швеции выражается в кронах — kronor.'],['– När börjar lektionen? – Klockan ___.','nio',['nio','blå','bok','heter'],'В ответе указывают время после klockan.'],['– Kan du hjälpa mig? – Ja, ___!','självklart',['självklart','aldrig','tyvärr inte','fel'],'Självklart — конечно.'],['– Var är skolan? – Den ligger ___ parken.','bredvid',['bredvid','i morgon','sällan','tack'],'Bredvid — рядом с.'],['– Hur kommer du till jobbet? – Jag ___ bussen.','tar',['tar','är','har','kan'],'Ta bussen — ехать на автобусе.'],['– Hur länge har du bott här? – I två ___.','år',['år','sju','stor','tåg'],'I två år — в течение двух лет.']
];
const accountLevel3=()=>Math.floor((Number(state.xp)||0)/500)+1;
const accountProgress3=()=>Math.round((Number(state.xp)||0)%500);
const topicNames3=()=>[...new Set(WORDS.map(w=>w.category).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));
const topicIcon3=(name)=>({'Тело':'🧍','Здоровье':'🩺','Семья':'👨‍👩‍👧','Школа и SFI':'🏫','Учёба':'📚','Еда и напитки':'🍎','Еда':'🥗','Дни и календарь':'🗓️','Время':'⏰','Дом и комнаты':'🏡','Транспорт':'🚌','Одежда':'🧥','Глаголы':'⚡','Общение и чувства':'💬','Погода':'🌦️','Работа':'💼','Досуг и спорт':'🏃','Числа':'🔢','Животные':'🐈','Природа':'🌳','Техника':'💻','Существительные':'🧩'}[name]||'📘');
const swedishText3=(l)=>l.map(x=>x.sv).join(' ');
function readingWidget3(reading){if(!reading)return '';const lines=reading.lines||[];return `<section class="content-panel reading-panel"><div class="section-head"><div><h2>📖 ${esc(t('readSample'))}</h2><p>${esc(reading.title)}</p></div><button class="btn secondary small" data-action="speak" data-text="${esc(swedishText3(lines))}">🔊 ${esc(t('listenReading'))}</button></div><div class="reading-lines lesson-reading">${lines.map(e=>`<div class="reading-line"><div><strong lang="sv">${esc(e.sv)}</strong><small>${esc(quizSourceText(e.ru))}</small></div><button type="button" class="sound-btn" data-action="speak" data-text="${esc(e.sv)}" aria-label="${esc(t('speak'))}">🔊</button></div>`).join('')}</div><p class="micro-note">${esc(reading.tip||'')}</p></section>`}
function renderLesson(){const l=LESSONS.find(x=>x.id===routeParam);if(!l)return renderLessons();return `<button class="back-link" data-nav="lessons" data-param="${l.level}">← ${esc(t('backTo'))}</button><div class="lesson-hero"><div class="lesson-hero-art">${esc(l.emoji)}</div><div><span class="eyebrow">SFI ${l.level} · ${esc(t('lesson'))} ${LESSONS.indexOf(l)+1}</span><h1>${esc(l.title)}</h1><p>${esc(l.description)}</p><div class="chip">📝 ${l.questions.length} ${esc(t('quizDuration'))}</div></div></div><section class="content-panel"><h2 class="panel-heading">🎯 ${esc(t('lessonOverview'))}</h2><ul class="rule-list">${(l.goals||[]).map(g=>`<li>${esc(g)}</li>`).join('')}</ul></section><section class="content-panel"><h2 class="panel-heading">📚 ${esc(t('rules'))}</h2><div class="rule-chapters">${l.rules.map((r,i)=>`<div class="rule-chapter"><span class="step-num">${i+1}</span><p>${esc(r)}</p></div>`).join('')}</div></section><section class="content-panel"><h2 class="panel-heading">🔊 ${esc(t('examples'))}</h2><div class="example-grid">${l.examples.map(e=>`<div class="example-item"><b lang="sv">${esc(e.sv)}</b><p>${esc(e.ru)}</p><button data-action="speak" data-text="${esc(e.sv)}">🔊 ${esc(t('pronounce'))}</button></div>`).join('')}</div></section>${readingWidget3(l.reading)}<section class="horizontal-card"><div><h3>✨ ${esc(t('testKnowledge'))}</h3>${quizStatusChip('lesson:'+l.id)}<p>${l.questions.length} ${esc(t('quizDuration'))} · ${esc(t('quizTip'))}</p></div><button class="btn" data-action="lesson-test" data-id="${l.id}">${state.completed.includes(l.id)?t('again'):t('finishLesson')} →</button></section>`}
function renderAlphabet(){return title('Å Ä Ö · '+t('alphabetHub'),t('alphabetPron'))+`<section class="content-panel"><div class="notice">🇸🇪 В шведском 29 букв. Звуки отличаются от русских; IPA даёт более точную подсказку, чем русская транскрипция. Для озвучки нужен установленный шведский голос устройства. Нажимай 🔊 у слова-примера и сравнивай звучание.</div><div class="alpha-grid">${ALPHABET3.map(([letter,ipa,word,meaning],i)=>`<article class="alpha-card"><div class="alpha-head"><span class="alpha-letter">${letter}<small>${letter.toLocaleLowerCase('sv-SE')}</small></span><span class="alpha-ipa">${esc(ipa)}</span></div><p><strong>${esc(word)}</strong><small>${esc(meaning)}</small></p><div class="split"><button class="btn ghost small" data-action="speak" data-text="${esc(word)}">🔊 ${esc(word)}</button><button class="btn secondary small" data-action="speak-letter" data-letter="${esc(letter)}">♪ ${esc(letter)}</button></div></article>`).join('')}</div></section><section class="content-panel"><h2>🎧 Частые сочетания букв</h2><div class="rule-chapters">${[['sj, skj, stj','Особый шведский шипящий звук: sjuk, skjorta, stjärna.'],['tj, k перед мягкой гласной','Особый мягкий звук: tjugo, köpa, kyrka.'],['sk перед e, i, y, ä, ö','Часто шипящий звук: sked, skina.'],['ng','Носовой звук: lång, många.'],['j','Обычно «й»: jag, ja, jul.']].map(([a,b])=>`<div class="rule-chapter"><b>${esc(a)}</b><p>${esc(b)}</p></div>`).join('')}</div></section><div class="horizontal-card"><div><h3>🧩 ${esc(t('lettersPractice'))}</h3><p>20 вопросов с буквами и звуками</p></div><button class="btn" data-action="start-mode" data-mode="alphabet">${esc(t('startQuiz'))} →</button></div>`}
function renderTopics(){const cats=topicNames3();return title(t('topics'),`${cats.length} ${esc(t('wordsModule'))} · ${WORDS.length} ${esc(t('words'))}`)+`<section class="topic-intro"><h2>Выбирай слова по жизненной ситуации</h2><p>Тело, здоровье, семья, школа, дом, работа, погода, транспорт и другие темы. У каждого модуля есть список слов, произношение и отдельный тест.</p></section><div class="topic-grid">${cats.map((name,i)=>{const rows=WORDS.filter(w=>w.category===name);return `<button class="topic-card hue-${i%6}" data-nav="topic" data-param="${esc(name)}"><span class="topic-art">${topicIcon3(name)}</span><strong>${esc(name)}</strong><small>${rows.length} ${esc(t('words'))}</small><span class="topic-open">${esc(t('open'))} →</span></button>`}).join('')}</div>`}
const TOPIC_CONTENT3={
'Семья':{tip:'Про членов семьи говорим: min mamma, mitt barn, mina syskon. Слова släkt и familj близки, но släkt — более широкая родня.',lines:[['Jag har två syskon.','У меня двое братьев/сестёр.'],['Min mamma bor i Sverige.','Моя мама живёт в Швеции.'],['Vi äter middag tillsammans.','Мы ужинаем вместе.'],['På söndag träffar vi vår familj.','В воскресенье мы встречаемся с семьёй.']]},
'Тело':{tip:'Чтобы описать боль, используй ha ont i + часть тела: Jag har ont i ryggen.',lines:[['Jag har två händer och två fötter.','У меня две руки (кисти) и две ступни.'],['Jag tvättar händerna före maten.','Я мою руки перед едой.'],['Hon har ont i knät.','У неё болит колено.'],['Mitt hår är långt.','У меня длинные волосы.']]},
'Здоровье':{tip:'Полезные фразы для врача: Jag har feber. Jag behöver en tid. Jag har ont i halsen.',lines:[['Jag är sjuk i dag.','Сегодня я болею.'],['Jag har feber och hosta.','У меня температура и кашель.'],['Jag ringer vårdcentralen.','Я звоню в поликлинику.'],['Jag ska vila och dricka vatten.','Я буду отдыхать и пить воду.']]},
'Школа и SFI':{tip:'I skolan = в школе. Till skolan = в школу. På svenska = по-шведски.',lines:[['Jag läser svenska på SFI.','Я учу шведский на SFI.'],['Läraren skriver på tavlan.','Учитель пишет на доске.'],['Vi har rast klockan tio.','У нас перемена в десять.'],['Efter lektionen gör jag min läxa.','После урока я делаю домашнее задание.']]},
'Учёба':{tip:'Обрати внимание на разницу между läser (читаю/изучаю) и skriver (пишу).',lines:[['Jag läser en bok.','Я читаю книгу.'],['Du skriver en mening.','Ты пишешь предложение.'],['Vi lär oss nya ord.','Мы учим новые слова.'],['Läraren ställer en fråga.','Учитель задаёт вопрос.']]},
'Дни и календарь':{tip:'Названия дней и месяцев по-шведски пишутся с маленькой буквы. På måndag = в понедельник, i måndags = в прошедший понедельник.',lines:[['I dag är det torsdag.','Сегодня четверг.'],['I morgon är det fredag.','Завтра пятница.'],['På lördag är jag ledig.','В субботу я свободна/свободен.'],['På söndag vill jag vila.','В воскресенье я хочу отдохнуть.']]},
'Время':{tip:'Halv tre означает 02:30; это полчаса ДО трёх, а не после.',lines:[['Klockan är åtta.','Сейчас восемь часов.'],['Jag börjar klockan halv nio.','Я начинаю в половине девятого.'],['Bussen kommer snart.','Автобус скоро приедет.'],['På kvällen är jag hemma.','Вечером я дома.']]},
'Еда и напитки':{tip:'Jag är hungrig = я голоден; Jag är törstig = я хочу пить.',lines:[['Jag äter gröt till frukost.','Я ем кашу на завтрак.'],['Vi dricker kaffe på morgonen.','Мы пьём кофе утром.'],['Hon köper mjölk och bröd.','Она покупает молоко и хлеб.'],['Till middag lagar jag fisk.','На ужин я готовлю рыбу.']]},
'Еда':{tip:'Mat = еда; äta = есть; dricka = пить; laga mat = готовить.',lines:[['Jag är hungrig.','Я голоден/голодна.'],['Jag äter ett äpple.','Я ем яблоко.'],['Vi lagar middag.','Мы готовим ужин.'],['Maten är god.','Еда вкусная.']]},
'Дом и комнаты':{tip:'Ligger / står — положения предметов: boken ligger på bordet, lampan står på bordet.',lines:[['Jag bor i en lägenhet.','Я живу в квартире.'],['Köket ligger bredvid vardagsrummet.','Кухня рядом с гостиной.'],['Jag sover i sovrummet.','Я сплю в спальне.'],['Det finns ett fönster i rummet.','В комнате есть окно.']]},
'Дом':{tip:'En stol → stolen, ett bord → bordet. Артикль переходит в окончание определённой формы.',lines:[['Det finns ett bord i köket.','На кухне есть стол.'],['Bordet är stort.','Стол большой.'],['Stolen står vid fönstret.','Стул стоит у окна.']]},
'Транспорт':{tip:'Ta bussen = ехать автобусом. Gå på bussen = сесть в автобус. Gå av bussen = выйти из автобуса.',lines:[['Jag tar bussen till skolan.','Я еду в школу на автобусе.'],['Bussen kommer klockan nio.','Автобус приезжает в девять.'],['Jag köper en biljett.','Я покупаю билет.'],['Jag går av vid nästa hållplats.','Я выхожу на следующей остановке.']]},
'Одежда':{tip:'Prova en jacka = примерять куртку. Ha på sig = носить (на себе). Ta på sig = надевать.',lines:[['I dag har jag en blå jacka.','Сегодня я в синей куртке.'],['Mina skor är svarta.','Мои ботинки чёрные.'],['Jag provar en ny tröja.','Я примеряю новую кофту.'],['Kläderna är bekväma.','Одежда удобная.']]},
'Работа':{tip:'Jag arbetar på ett kontor (работаю в офисе), jag arbetar som lärare (работаю учителем).',lines:[['Jag arbetar fyra dagar i veckan.','Я работаю четыре дня в неделю.'],['Min chef är snäll.','Мой начальник добрый.'],['Vi har ett möte klockan tio.','У нас встреча в десять.'],['På fredag är jag ledig.','В пятницу я свободен/свободна.']]},
'Погода':{tip:'Общее описание погоды обычно начинается с det: Det regnar. Det är kallt.',lines:[['I dag är det molnigt.','Сегодня облачно.'],['Det blåser mycket.','Дует сильный ветер.'],['I morgon blir det soligt.','Завтра будет солнечно.'],['Jag tar med ett paraply.','Я возьму с собой зонт.']]},
'Глаголы':{tip:'Глаголы нужно учить по четырём формам: infinitiv, presens, preteritum, supinum. Группа помогает увидеть закономерность.',lines:[['Jag arbetar i dag.','Я работаю сегодня.'],['I går arbetade jag.','Вчера я работал(а).'],['Jag har arbetat hela veckan.','Я работал(а) всю неделю.'],['I morgon ska jag vila.','Завтра я буду отдыхать.']]},
'Существительные':{tip:'Начинай учить существительные с en или ett; определённая форма присоединяет артикль к слову.',lines:[['Jag har en bok.','У меня есть книга.'],['Boken är ny.','Книга новая.'],['Det finns ett hus.','Есть дом.'],['Huset är stort.','Дом большой.']]},
'Общение и чувства':{tip:'Hur mår du? — Как дела/самочувствие? Jag mår bra — Я чувствую себя хорошо.',lines:[['Jag är glad i dag.','Сегодня я рад(а).'],['Min vän är trött.','Мой друг устал.'],['Hur mår du?','Как ты себя чувствуешь?'],['Tack, jag mår bra!','Спасибо, у меня всё хорошо!']]},
'Досуг и спорт':{tip:'Tycker om att + infinitiv = любить что-то делать: Jag tycker om att fiska.',lines:[['På fritiden gillar jag att läsa.','В свободное время я люблю читать.'],['Vi tränar på gymmet.','Мы тренируемся в спортзале.'],['På lördag ska jag fiska.','В субботу я буду рыбачить.'],['På kvällen lyssnar vi på musik.','Вечером мы слушаем музыку.']]}
};
function renderTopic(){const category=routeParam,rows=WORDS.filter(w=>w.category===category);if(!rows.length)return renderTopics();const examples=rows.slice(0,5);return `<button class="back-link" data-nav="topics">← ${esc(t('topics'))}</button><section class="topic-banner"><div class="topic-art">${topicIcon3(category)}</div><div><span class="eyebrow">🇸🇪 ${esc(t('vocabulary'))}</span><h1>${esc(category)}</h1><p>${rows.length} ${esc(t('words'))} · ${esc(t('pronounce'))} · ${esc(t('topicQuiz'))}</p><div class="split"><button class="btn white" data-action="topic-quiz" data-topic="${esc(category)}">🧠 ${esc(t('topicQuiz'))}</button><button class="btn" data-nav="flashcards">🃏 ${esc(t('flashcards'))}</button></div></div></section><section class="content-panel"><h2>📖 ${esc(t('notes'))}</h2><p>Учи новые слова небольшими порциями: сначала слово и его значение, затем прослушай его, произнеси вслух и проверь себя. Существительные лучше сразу учить с <b>en</b> или <b>ett</b>, если род известен.</p><div class="topic-chips">${examples.map(w=>`<button data-action="speak" data-text="${esc(w.word)}">🔊 ${esc(w.word)}</button>`).join('')}</div></section>${TOPIC_CONTENT3[category]?`<section class="content-panel"><h2>💬 Примеры и мини-текст</h2><div class="notice">💡 ${esc(TOPIC_CONTENT3[category].tip)}</div><div class="reading-lines" style="margin-top:16px">${TOPIC_CONTENT3[category].lines.map(([sv,ru])=>`<div class="reading-line"><div><strong lang="sv">${esc(sv)}</strong><small>${esc(ru)}</small></div><button class="sound-btn" data-action="speak" data-text="${esc(sv)}">🔊</button></div>`).join('')}</div><button class="btn secondary small" style="margin-top:15px" data-action="speak" data-text="${esc(TOPIC_CONTENT3[category].lines.map(x=>x[0]).join(' '))}">🔊 ${esc(t('listenReading'))}</button></section>`:``}<div class="words-grid">${rows.map(wordEntry).join('')}</div><div class="horizontal-card"><div><h3>⭐ ${esc(t('topicQuiz'))}</h3><p>20 ${esc(t('quizDuration'))}</p></div><button class="btn" data-action="topic-quiz" data-topic="${esc(category)}">${esc(t('startQuiz'))} →</button></div>`}
function renderRules(){const groups='ABCD'.split('');return title(t('rulesHub'),`${LESSONS.length} ${esc(t('lessonCount'))} · SFI A–D`)+`<div class="rules-tabs"><button class="pill" data-nav="alphabet">🔤 ${esc(t('alphabetHub'))}</button><button class="pill" data-nav="topics">📚 ${esc(t('vocabulary'))}</button></div>${groups.map(level=>`<section class="content-panel"><h2 class="panel-heading">📘 SFI ${level} · ${esc(levelName(level))}</h2><div class="rules-accordion">${LESSONS.filter(l=>l.level===level).map(l=>`<details class="rule-details"><summary><span>${esc(l.emoji)} ${esc(l.title)}</span><span class="chevron">⌄</span></summary><div class="details-body"><ul>${l.rules.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><div class="example-grid">${l.examples.slice(0,2).map(e=>`<div class="example-item"><b>${esc(e.sv)}</b><p>${esc(e.ru)}</p><button data-action="speak" data-text="${esc(e.sv)}">🔊</button></div>`).join('')}</div><button class="btn small" data-nav="lesson" data-param="${esc(l.id)}">${esc(t('open'))} →</button></div></details>`).join('')}</div></section>`).join('')}`}
function renderBooks(){return title(t('books'),'12 оригинальных историй с понятным языком, озвучкой и вопросами')+`<div class="book-grid">${BOOKS.map((b,i)=>`<article class="book-card hue-${i%6}"><div class="book-cover">${b.photo?`<img class="cover-photo" loading="lazy" src="${esc(b.photo)}" onerror="this.style.display='none'" alt="Тематическая фотография">`:``}<div class="book-cover-decor">✦</div><span>${esc(b.emoji)}</span><small>SFI ${esc(b.level)}</small></div><div class="book-content"><span class="chip">${esc(t('level'))} ${b.level}</span><h3>${esc(b.title)}</h3><p>${esc(b.translation)}</p><div class="split"><button class="btn small" data-nav="book" data-param="${b.id}">${esc(t('readNow'))} →</button>${quizStatusChip('book:'+b.id)}${state.booksRead?.includes(b.id)?'<span class="done-chip">✓</span>':''}</div></div></article>`).join('')}</div>`}
function renderBook(){const b=BOOKS.find(x=>x.id===routeParam);if(!b)return renderBooks();return `<button class="back-link" data-nav="books">← ${esc(t('books'))}</button><section class="book-reader"><div class="reader-picture hue-${(BOOKS.indexOf(b))%6}">${b.photo?`<img class="cover-photo" src="${esc(b.photo)}" onerror="this.style.display='none'" alt="Тематическая фотография">`:``}<span>${esc(b.emoji)}</span><i>🇸🇪 SVENSKA LÄTT</i></div><span class="chip">SFI ${b.level} · ${esc(t('reading'))}</span><h1>${esc(b.title)}</h1><p class="reader-sub">${esc(b.translation)}</p><div class="reader-toolbar"><button class="btn" data-action="speak" data-text="${esc(b.text)}">🔊 ${esc(t('listenReading'))}</button><button class="btn secondary" data-action="book-read" data-id="${b.id}">${state.booksRead?.includes(b.id)?'✓ '+t('readBook'):'✓ '+t('markWatched')}</button></div><p class="reader-sv" lang="sv">${esc(b.text)}</p><details class="reader-translation"><summary>🌍 Перевод текста</summary><p>${esc(b.ru)}</p></details><h2>🧠 ${esc(t('bookQuiz'))}</h2>${quizStatusChip('book:'+b.id)}<div class="question-preview">${b.questions.map((q,i)=>`<p><b>${i+1}.</b> ${esc(q.question)}</p>`).join('')}</div><button class="btn wide" data-action="book-quiz" data-id="${b.id}">${esc(t('startQuiz'))} →</button></section>`}
function speakLetter3(letter){const a=ALPHABET3.find(x=>x[0]===letter);if(!a)return;const names={'W':'dubbel-ve','Z':'säta'};speak(names[letter]||letter.toLowerCase())}
function getMoreQuestion3(mode){
 if(mode==='fillBlank'||mode==='dialogues'){const db=mode==='dialogues'?DIALOGUES3:CLOZE3;const [sentence,answer,options,why]=shuffle(db)[0];return choice(`🧩 ${sentence}`,answer,options.filter(x=>x!==answer),null,why)}
 if(mode==='weekdays'||mode==='months'){const list=mode==='weekdays'?DAYS3:MONTHS3;let k=Math.floor(Math.random()*list.length),row=list[k],target=Math.random()<.5;let answer=target?row[0]:row[1];let others=shuffle(list.filter(x=>x[0]!==row[0])).slice(0,3).map(x=>x[target?0:1]);return choice(`${target?'🇸🇪':'🇷🇺'} ${target?row[1]:row[0]} → ?`,answer,others,null,`Пара: ${row[0]} — ${row[1]}. ${mode==='weekdays'?'В шведском названия дней недели пишутся со строчной буквы.':'Названия месяцев в шведском обычно со строчной буквы.'}`)}
 if(mode==='alphabet'){const [letter,ipa,word,ru]=shuffle(ALPHABET3)[0];const variant=Math.random();if(variant<.5){const wrong=shuffle(ALPHABET3.filter(x=>x[0]!==letter)).slice(0,3).map(x=>x[0]);return choice(`🔤 Какой первой буквой пишется «${word}» (${ru})?`,letter,wrong,null,`${word} начинается на ${letter}. Название буквы: ${ipa}.`)}const wrong=shuffle(ALPHABET3.filter(x=>x[0]!==letter)).slice(0,3).map(x=>x[2]);return choice(`🔤 Выбери слово на букву ${letter}`,word,wrong,null,`Буква ${letter}: ${word} — ${ru}. ${ipa}.`)}
 if(mode==='readText'){const b=shuffle(BOOKS)[0],q=shuffle(b.questions)[0];return choice(`📖 ${b.title}: ${q.question}`,q.answer,q.options.filter(x=>x!==q.answer),null,`${b.text} — ${q.why}`)}
 return null;
}
function legacyGetQuestion4(mode){const b=getMoreQuestion3(mode);if(b)return b;const verb=()=>shuffle(WORDS.filter(w=>w.type==='verb'))[0],noun=()=>shuffle(WORDS.filter(w=>w.type==='noun'))[0],any=()=>shuffle(WORDS)[0];if(mode==='mixed')return getQuestion(shuffle(['translation','verbForms','articles','sentences','writeWord','fixMistake','fillBlank','weekdays','months','alphabet','dialogues','readText',...('speechSynthesis' in window?['listening']:[])])[0]);
 if(mode==='translation'){let w=any();return choice(`${t('fromRussian')}: ${w.word}`,w.ru,shuffle(WORDS.filter(x=>x.id!==w.id&&x.ru!==w.ru)).slice(0,3).map(x=>x.ru),w.id,`🇸🇪 ${w.word} → ${w.ru}. ${w.example||'Повтори слово вслух.'}`)}
 if(mode==='verbForms'){const w=verb(),[target,key]=shuffle([['Presens','pre'],['Preteritum','past'],['Supinum','sup']])[0];return choice(`${target}: ${w.inf} → ?`,w[key],shuffle(WORDS.filter(x=>x.type==='verb'&&x.id!==w.id)).slice(0,3).map(x=>x[key]),w.id,`${w.inf} → ${w.pre} → ${w.past} → ${w.sup} (группа ${w.group}).`)}
 if(mode==='articles'){let w=noun();return choice(`${w.word} · ${w.ru}`,w.article,[w.article==='en'?'ett':'en'],w.id,`${w.article} ${w.word} → ${w.def}. Запоминай существительное вместе с артиклем.`)}
 if(mode==='listening'){let w=shuffle(WORDS.filter(x=>x.word&&!x.word.includes(' ')))[0];return {type:'listen',question:t('listenPrompt'),answer:w.word,wordId:w.id,why:`${w.word} — ${w.ru}`,speak:w.word}}
 if(mode==='writeWord'){let w=any();return {type:'type',question:`${w.ru} → 🇸🇪`,answer:w.word,wordId:w.id,why:`${w.word} — ${w.ru}. ${w.example||''}`}}
 if(mode==='sentences'){let s=shuffle(SENTENCES)[0];let tokens=s[0].replace(/[.!?]+$/g,'').split(' '),punct=s[0].slice(-1);return {type:'arrange',question:`${t('arrangePrompt')}: ${s[1]}`,answer:s[0],tokens:shuffle(tokens).map((v,i)=>({id:String(i),v})),punct,wordId:null,why:`${s[0]} — ${s[1]}`}}
 if(mode==='fixMistake'){const a=shuffle([['Jag kan simmar.','Jag kan simma.','Jag kan simmade.','Jag simma kan.','После kan используется инфинитив.'],['I dag jag jobbar.','I dag jobbar jag.','I dag jobbade jag.','Jag i dag jobbar.','В главном предложении глагол стоит на второй позиции.'],['Jag har köpte.','Jag har köpt.','Jag är köpt.','Jag har köpa.','После har нужен supinum köpt.'],['Ett stor hus.','Ett stort hus.','En stora hus.','Ett stora hus.','С ett-словом прилагательное обычно получает -t.'],['Jag hjälper hon.','Jag hjälper henne.','Jag hjälper hennes.','Jag hjälp hon.','Объектная форма от hon — henne.'],['Hon inte kan prata.','Hon kan inte prata.','Hon kan prata inte.','Hon kunna inte prata.','В главном предложении inte после личного глагола.'],['Jag går till hemma.','Jag går hem.','Jag gå hem.','Jag går hemmat.','Идти домой — gå hem, без till.'],['Jag bor på Sverige.','Jag bor i Sverige.','Jag bor till Sverige.','Jag bor från Sverige.','Для страны употребляется i.'],['Vi ska åker i morgon.','Vi ska åka i morgon.','Vi åka ska i morgon.','Vi ska åkt i morgon.','После ska нужен infinitiv åka.'],['En äpple är rött.','Ett äpple är rött.','Den äpple är rött.','En äpple är röd.','Äpple — ett-слово.'],['Hon har inte kom.','Hon har inte kommit.','Hon har inte komma.','Hon har inte kommer.','Supinum от komma — kommit.']])[0];return choice(`❌ ${a[0]} · ${t('fixMistake')}`,a[1],[a[2],a[3]],null,a[4])}
 return getQuestion('fillBlank');
}
function legacyStartQuiz4(mode='mixed',lesson=null,forReview=false){let questions=[];if(mode==='book'){const b=BOOKS.find(x=>x.id===lesson);if(!b)return;questions=b.questions.map(q=>choice(q.question,q.answer,q.options.filter(x=>x!==q.answer),null,q.why));}
 else if(mode==='topic'){const rows=shuffle(WORDS.filter(w=>w.category===lesson));if(!rows.length)return;questions=Array.from({length:Math.min(20,rows.length)},(_,i)=>{const w=rows[i];let wrong=shuffle(WORDS.filter(x=>x.category===lesson&&x.ru!==w.ru)).slice(0,3).map(x=>x.ru);return choice(`${w.word} → ?`,w.ru,wrong,w.id,`«${w.word}» — «${w.ru}».`)});}
 else if(lesson){const l=LESSONS.find(x=>x.id===lesson);if(!l)return;questions=shuffle(l.questions).slice(0,Math.min(14,l.questions.length)).map(q=>choice(q.question,q.answer,q.options.filter(x=>x!==q.answer),null,q.why));}
 else if(forReview){const list=shuffle(reviewDeck()).slice(0,20);questions=list.map(w=>w.type==='verb'?choice(`${w.inf} → Preteritum`,w.past,shuffle(WORDS.filter(x=>x.type==='verb'&&x.id!==w.id)).slice(0,3).map(x=>x.past),w.id,w.ru):w.type==='noun'?choice(`${w.word} · en/ett`,w.article,[w.article==='en'?'ett':'en'],w.id,w.ru):choice(`${t('fromRussian')}: ${w.word}`,w.ru,shuffle(WORDS.filter(x=>x.id!==w.id)).slice(0,3).map(x=>x.ru),w.id,`${w.word} — ${w.ru}`));}
 else questions=Array.from({length:20},()=>getQuestion(mode));
 if(!questions.length){toast('Пока нет карточек для повторения');return}
 quiz={active:true,finished:false,mode,lesson,questions,index:0,score:0,answered:false,selected:[],latest:null};navigate('practice');}
function renderPractice(){if(quiz.active)return quiz.finished?renderQuizFinish():renderQuiz();const modes=[['mixed','🎲'],['translation','🌍'],['fillBlank','📝'],['weekdays','🗓️'],['alphabet','🔤'],['months','📆'],['dialogues','💬'],['readText','📖'],['verbForms','⚡'],['articles','🧩'],['listening','🎧'],['sentences','🧱'],['writeWord','✍️'],['fixMistake','🛠️']];return title(t('train'),`14 режимов практики · ${t('chooseMode')}`)+`<section class="practice-instructions"><div>🧠</div><div><h3>Практика с объяснением ответа</h3><p>В каждом режиме по 20 вопросов (в чтении и уроках — по материалу). Сначала выбери ответ, затем прочитай правило и нажми «Дальше». Случайные тренировки не начисляют XP; награда за учебный тест выдаётся один раз при результате от 80%.</p></div></section><div class="practice-modes">${modes.map(([m,e])=>`<button class="mode-card" data-action="start-mode" data-mode="${m}"><span class="e">${e}</span><b>${esc(t(m))}</b><small>20 ${esc(t('quizDuration'))} · 0 XP</small>${quizStatusChip('practice:'+m)}</button>`).join('')}</div><div class="notice" style="margin-top:24px">💡 ${esc(t('quizTip'))}</div>`}
function renderProfile(){const level=accountLevel3(),inLevel=accountProgress3(),display=user?.name||t('guest');return title(t('profileTitle'),user?t('savedAccount'):t('guestMode'))+`<div class="profile-banner"><div class="big-avatar">${user?'👩‍🎓':'🌻'}</div><div class="account-main"><h2>${esc(display)}</h2><p>${esc(user?.email||t('guestMode'))}</p><span class="chip">🇸🇪 SFI ${esc(state.settings.level)} · ⭐ ${state.xp||0} XP</span></div></div><section class="rank-panel"><div class="split"><h3>🏆 ${esc(t('accountRank'))} ${level}</h3><span>${inLevel}/500 XP</span></div><div class="progress-track"><div class="progress-fill" style="width:${inLevel/5}%"></div></div><p>${esc(t('next100'))} · ${500-inLevel} XP ${esc(t('levelNext'))}</p></section><section class="stats-grid">${stat('🔥',streak(),t('dayStreak'),'orange')}${stat('📖',state.completed.length,t('lessonCount'),'purple')}${stat('🧠',state.known.length,t('knownWords'),'mint')}${stat('📚',(state.booksRead||[]).length,t('booksRead'),'pink')}</section><div class="profile-grid"><section class="content-panel"><h3>🗓 ${esc(t('practiceActivity'))}</h3><p class="micro-note">${Object.keys(state.activity).length} ${esc(t('dayPractice'))} · ${state.answered} ${esc(t('step'))}</p>${heatmap()}</section><section class="content-panel"><h3>⚙️ ${esc(t('settings'))}</h3><div class="settings-row"><b>${esc(t('interfaceLang'))}</b><select id="profile-lang" class="form-select">${[['ru','Русский'],['en','English'],['sv','Svenska'],['uk','Українська']].map(([lang,name])=>`<option value="${lang}" ${state.settings.language===lang?'selected':''}>${name}</option>`).join('')}</select></div><div class="settings-row"><b>${esc(t('sfiLevel'))}</b><select id="profile-level" class="form-select">${'ABCD'.split('').map(l=>`<option ${state.settings.level===l?'selected':''}>${l}</option>`).join('')}</select></div><p class="info-scope">${user?'☁️ '+t('savedAccount'):'📱 '+t('savedGuest')}</p></section></div><section class="content-panel" style="margin-top:20px"><h3>👤 ${esc(user?t('profile'):t('register'))}</h3><p class="micro-note">${esc(user?t('savedAccount'):t('accountExplain'))}</p>${user?`<button class="btn ghost" data-action="logout">${esc(t('logout'))} ↗</button>`:`<div class="split" style="justify-content:flex-start"><button class="btn" data-action="auth" data-mode="register">${esc(t('register'))}</button><button class="btn secondary" data-action="auth" data-mode="login">${esc(t('login'))}</button></div>`}</section>`}
function renderNav(){const nav=[...NAV.slice(0,2),['topics','🗂️'],['rules','📜'],['alphabet','🔤'],...NAV.slice(2,7),['books','📖'],NAV[7]];const mk=([key,ico])=>`<button type="button" class="nav-link ${route===key||(route==='book'&&key==='books')||(route==='topic'&&key==='topics')||(route==='lesson'&&key==='lessons')||(route==='word'&&key==='dictionary')?'active':''}" data-nav="${key}"><span class="nav-glyph">${ico}</span>${esc(t(key))}</button>`;$('#sidebar-nav').innerHTML=nav.slice(0,6).map(mk).join('');$('#sidebar-learn').innerHTML=nav.slice(6).map(mk).join('');$('#mobile-nav').innerHTML=[['home','🏠'],['lessons','📚'],['topics','🗂️'],['practice','🧠'],['books','📖'],['profile','👤']].map(([key,ico])=>`<button class="${route===key?'active':''}" data-nav="${key}" aria-label="${esc(t(key))}"><span class="i">${ico}</span><span>${esc(t(key))}</span></button>`).join('');const name=user?.name||t('guest');$('#sidebar-profile').innerHTML=`<span class="small-avatar">${esc(name[0]?.toUpperCase()||'👤')}</span><span style="min-width:0"><strong>${esc(name)}</strong><small>🏆 ${esc(t('accountRank'))} ${accountLevel3()}</small></span>`;$('#profile-top').textContent=name[0]?.toUpperCase()||'👤'}
function renderHome(){let next=LESSONS.find(l=>!state.completed.includes(l.id)&&l.level===state.settings.level)||LESSONS[0],xp=accountProgress3();return `<section class="hero"><div class="hero-copy"><span class="eyebrow">🇸🇪 SFI A · B · C · D</span><h1>${esc(t('welcome'))}</h1><p>${esc(t('heroDescription'))}</p><div class="split" style="justify-content:flex-start"><button class="btn white" data-nav="lesson" data-param="${next.id}">${esc(t('startLearning'))} →</button><button class="btn" style="background:#ffffff2b" data-nav="topics">🗂️ ${esc(t('topics'))}</button></div></div><div class="hero-picture"><div class="hero-illustration">📚</div><span class="hero-orbit orbit-a">🇸🇪</span><span class="hero-orbit orbit-b">💬</span><span class="hero-orbit orbit-c">⭐</span></div></section><div class="home-rank"><div class="split"><b>🏆 ${esc(t('accountRank'))} ${accountLevel3()}</b><span>${xp}/500 XP · ⭐ ${state.xp}</span></div><div class="progress-track"><div class="progress-fill" style="width:${xp/5}%"></div></div></div><section class="stats-grid">${stat('🔥',streak(),t('dayStreak'),'orange')}${stat('🧠',state.known.length,t('knownWords'),'purple')}${stat('🎓',state.completed.length,t('lessonCount'),'mint')}${stat('📖',(state.booksRead||[]).length,t('booksRead'),'pink')}</section><div class="section-head"><h2>✨ ${esc(t('yourWorkout'))}</h2></div><div class="action-grid action-grid-4"><button data-nav="topics" class="action-card pastel-lavender"><span class="corner">↗</span><span class="action-emoji">🗂️</span><h3>${esc(t('topics'))}</h3><p>${WORDS.length} ${esc(t('words'))}</p></button><button data-nav="practice" class="action-card pastel-peach"><span class="corner">↗</span><span class="action-emoji">🧩</span><h3>${esc(t('train'))}</h3><p>14 ${esc(t('chooseMode'))}</p></button><button data-nav="books" class="action-card pastel-mint"><span class="corner">↗</span><span class="action-emoji">📖</span><h3>${esc(t('books'))}</h3><p>${BOOKS.length} ${esc(t('reading'))}</p></button><button data-nav="rules" class="action-card pastel-lavender"><span class="corner">↗</span><span class="action-emoji">📜</span><h3>${esc(t('rulesHub'))}</h3><p>${LESSONS.length} ${esc(t('lessonCount'))}</p></button></div><div class="section-head"><h2>${esc(t('allCourses'))}</h2><button class="link-btn" data-nav="lessons">${esc(t('seeAll'))} →</button></div><div class="course-tiles">${'ABCD'.split('').map(courseTile).join('')}</div><div class="section-head"><h2>${esc(t('dayPractice'))}</h2><button class="link-btn" data-nav="profile">${esc(t('seeAll'))} →</button></div><div class="content-panel">${activityStrip()}<p class="info-scope">${esc(user?t('savedAccount'):t('guestNotice'))}</p></div>`}
function legacyRender4(){renderShell();const page=$('#page');const pages={home:renderHome,lessons:renderLessons,lesson:renderLesson,dictionary:renderDictionary,word:renderWord,'word-review':renderWordReview,flashcards:renderFlashcards,practice:renderPractice,reviews:renderReviews,videos:renderVideos,profile:renderProfile,topics:renderTopics,topic:renderTopic,rules:renderRules,alphabet:renderAlphabet,books:renderBooks,book:renderBook};page.innerHTML=(pages[route]||renderHome)()}
function searchNow(value){let q=value.trim().toLocaleLowerCase();const el=$('#search-results');if(!q){el.classList.add('hidden');el.innerHTML='';return}const words=WORDS.filter(w=>[w.word,w.ru,w.inf,w.pre,w.past,w.sup,w.category].some(x=>String(x||'').toLocaleLowerCase().includes(q))).slice(0,7);const lessons=LESSONS.filter(l=>(l.title+' '+l.description+' '+l.rules.join(' ')).toLocaleLowerCase().includes(q)).slice(0,4);const books=BOOKS.filter(b=>(b.title+' '+b.translation+' '+b.text).toLocaleLowerCase().includes(q)).slice(0,3);const topics=topicNames3().filter(x=>x.toLocaleLowerCase().includes(q)).slice(0,4);el.innerHTML=(topics.map(c=>`<button class="search-result" data-nav="topic" data-param="${esc(c)}"><span class="emo">🗂️</span><span><strong>${esc(c)}</strong><small>${esc(t('topics'))}</small></span></button>`).join('')+lessons.map(l=>`<button class="search-result" data-nav="lesson" data-param="${l.id}"><span class="emo">${esc(l.emoji)}</span><span><strong>${esc(l.title)}</strong><small>📚 SFI ${l.level}</small></span></button>`).join('')+books.map(b=>`<button class="search-result" data-nav="book" data-param="${b.id}"><span class="emo">${esc(b.emoji)}</span><span><strong>${esc(b.title)}</strong><small>📖 SFI ${b.level}</small></span></button>`).join('')+words.map(w=>`<button class="search-result" data-nav="word" data-param="${esc(w.id)}"><span class="emo">${esc(w.emoji)}</span><span><strong>${esc(wordLabel(w))}</strong><small>${esc(w.ru)}</small></span></button>`).join(''))||`<div class="serp-empty">${esc(t('noResults'))}</div>`;el.classList.remove('hidden')}
function speak(text){if(!('speechSynthesis' in window)){toast(t('noAudio'));return}const api=window.speechSynthesis;api.cancel();const u=new SpeechSynthesisUtterance(String(text));u.lang='sv-SE';u.rate=.82;u.pitch=1;const vs=api.getVoices(),voice=vs.find(v=>v.lang.toLowerCase()==='sv-se')||vs.find(v=>v.lang.toLowerCase().startsWith('sv'));if(voice)u.voice=voice;else if(vs.length){toast('⚠️ Шведский голос не установлен. Проверь системные голоса sv-SE.');return}u.onerror=()=>toast('Не удалось воспроизвести. Установи шведский голос (sv-SE) в настройках устройства.');api.speak(u)}
function authText(key){if(key==='local'&&cloudAccount())return ux('accountSaved');return (AUTH_TEXT[state.settings?.language]||AUTH_TEXT.ru)[key]}
const AUTH_TEXT={
 ru:{wait:'Подождите…',confirm:'Если регистрация разрешена для этого адреса, письмо отправлено. Проверьте почту и папку «Спам», подтвердите адрес и вернитесь на сайт. Если аккаунт уже существует, войдите.',local:'Прогресс сохраняется в аккаунте.',guest:'Войди, чтобы продолжать обучение на разных устройствах.',invalid:'Неверная почта или пароль.',unconfirmed:'Подтвердите email по ссылке из письма, затем войдите.',exists:'Этот email уже зарегистрирован. Попробуйте войти.',weak:'Пароль не соответствует требованиям. Используйте не менее 8 символов.',email:'Проверьте адрес электронной почты.',rate:'Слишком много попыток. Подождите и попробуйте позже.',offline:'Не удалось подключиться. Проверьте интернет и попробуйте снова.',generic:'Не удалось выполнить действие. Попробуйте позже.',callback:'Не удалось обработать ссылку из письма. Возможно, она истекла или уже использована. Попробуйте войти или зарегистрироваться повторно.'},
 en:{wait:'Please wait…',confirm:'If registration is available for this address, a confirmation email has been sent. Check your inbox and spam folder. If you already have an account, log in.',local:'Progress is saved to your account.',guest:'Sign in to keep learning across devices.',invalid:'Incorrect email or password.',unconfirmed:'Confirm your email using the link before logging in.',exists:'This email is already registered. Try logging in.',weak:'Use a password that meets the requirements, with at least 8 characters.',email:'Check your email address.',rate:'Too many attempts. Please try again later.',offline:'Could not connect. Check your connection and try again.',generic:'Could not complete the request. Try again later.',callback:'The email link could not be processed. It may have expired or already been used. Try logging in or registering again.'}
};
AUTH_TEXT.sv={...AUTH_TEXT.en,wait:'Vänta…',confirm:'Om registrering är möjlig har ett bekräftelsemejl skickats. Kontrollera inkorgen och skräpposten. Logga in om du redan har ett konto.',local:'Framsteg sparas i ditt konto.',guest:'Logga in för att fortsätta på olika enheter.',invalid:'Fel e-post eller lösenord.',unconfirmed:'Bekräfta din e-post via länken innan du loggar in.'};
AUTH_TEXT.uk={...AUTH_TEXT.en,wait:'Зачекайте…',confirm:'Якщо реєстрація доступна, лист надіслано. Перевірте пошту та спам і підтвердьте адресу. Якщо акаунт уже є, увійдіть.',local:'Прогрес зберігається в акаунті.',guest:'Увійди, щоб продовжувати навчання на різних пристроях.',invalid:'Неправильна пошта або пароль.',unconfirmed:'Підтвердьте email за посиланням із листа, потім увійдіть.'};
function authError(err){
 const code=err?.code||'';
 const key=({invalid_credentials:'invalid',email_not_confirmed:'unconfirmed',user_already_exists:'exists',email_exists:'exists',weak_password:'weak',INVALID_SIGNUP_INPUT:'weak',email_address_invalid:'email',validation_failed:'email',over_request_rate_limit:'rate',over_email_send_rate_limit:'rate',AUTH_UNAVAILABLE:'offline'})[code];
 return authText(key||(err?.status===429?'rate':/fetch|network|timeout/i.test(err?.message||'')?'offline':'generic'));
}
let authBusy=false;
async function authSubmit(form){
 if(authBusy)return;
 authBusy=true;
 const mode=form.dataset.mode,payload={email:$('#auth-email',form).value.trim(),password:$('#auth-pass',form).value};
 if(mode==='register')payload.name=$('#auth-name',form).value.trim();
 const btn=$('#auth-submit',form),error=$('#auth-error',form),status=$('#auth-status',form),label=btn.textContent;
 btn.disabled=true;btn.textContent=authText('wait');form.setAttribute('aria-busy','true');error.textContent='';status.textContent=authText('wait');
 try{
  const data=await (mode==='register'?window.SVAuth.signUp(payload):window.SVAuth.signIn(payload));
  if(mode==='register'&&!data.session){
   status.textContent=authText('confirm');$('#auth-pass',form).value='';return;
  }
  applyAuthState(window.SVAuth.getState());closeAuth();toast('✅ '+(user?.name||t('profile')));
 }catch(err){status.textContent='';error.textContent=authError(err)}
 finally{authBusy=false;btn.disabled=false;btn.textContent=label;form.removeAttribute('aria-busy')}
}
async function logout(){
 if(authBusy)return;authBusy=true;
 const buttons=$$('[data-action="logout"]');buttons.forEach(btn=>{btn.disabled=true;btn.textContent=authText('wait')});
 try{await window.SVAuth.signOut();applyAuthState(window.SVAuth.getState());toast('👋');navigate('home')}
 catch(err){toast(authError(err))}
 finally{authBusy=false;buttons.forEach(btn=>{btn.disabled=false;btn.textContent=t('logout')})}
}

/* Svenska Lätt v4: localized navigation, curriculum, topic pages, mobile access. */
const locale4=()=>state.settings?.language||'ru';
const content4=()=>window.SV_LOCALES||{topics:{},lessons:{}};
const locCategory4=n=>locale4()==='ru'?n:(content4().topics[n]?.[locale4()]||n);
const locLesson4=l=>locale4()==='ru'?l.title:(content4().lessons[l.id]?.[locale4()]||l.title);
const locHint4=()=>({ru:'Прочитай пример, послушай произношение и составь своё предложение.',en:'Read each example, listen and make your own sentence.',sv:'Läs exemplet, lyssna och skriv en egen mening.',uk:'Прочитай приклад, послухай і склади власне речення.'})[locale4()];
const locUnknown4=()=>({ru:'',en:'Translation being prepared',sv:'Svenskt uppslagsord',uk:'Переклад готується'})[locale4()];
const locMeaning4=w=>locale4()==='ru'?w.ru:locale4()==='sv'?w.word:(w[locale4()]||locUnknown4());
const locExample4=(sv,ru)=>locale4()==='ru'?ru:((sv||'').split(' ').length<=2?locHint4():locHint4());
const txt4=(ru,en,sv,uk)=>({ru,en,sv,uk})[locale4()];
for(const k of languages){Object.assign(DICT[k],{
  ...(k==='ru'?{aboutTopic:'Сначала изучи слова, затем прочитай примеры и проверь себя.',subsections:'Все разделы',introPractice:'Выбирай формат: после ответа увидишь объяснение. Ошибки помогают повторять нужный материал.',originalLanguage:'Учебный язык',sourceNotes:'Подробные объяснения',audioTip:'Нажми на значок динамика для прослушивания.',videoLink:'Открыть видео',availableLessons:'Уроков',wordTranslation:'Перевод',translationSoon:'Перевод готовится',lessonExample:'Пример',listenRepeat:'Прослушай и повтори',readSwedish:'Читайте на шведском',keyboardSearch:'Поиск по всему сайту',levelSelector:'Выбрать уровень',lessonQuizTip:'Практика закрепляет изученное',doneNotice:'Вы прошли урок!',allTopics:'Все темы'}:{}),
  ...(k==='en'?{aboutTopic:'Learn the words first, then read the examples and test yourself.',subsections:'All sections',introPractice:'Pick a mode. After each answer, review the explanation and try again.',originalLanguage:'Learning language',sourceNotes:'Detailed explanations',audioTip:'Tap the speaker to listen.',videoLink:'Open video',availableLessons:'Lessons',wordTranslation:'Meaning',translationSoon:'Translation in progress',lessonExample:'Example',listenRepeat:'Listen and repeat',readSwedish:'Read in Swedish',keyboardSearch:'Search the entire site',levelSelector:'Select a level',lessonQuizTip:'Practise what you just learned',doneNotice:'Lesson complete!',allTopics:'All topics'}:{}),
  ...(k==='sv'?{aboutTopic:'Lär dig orden först, läs exemplen och testa dig själv.',subsections:'Alla avsnitt',introPractice:'Välj en övning. Läs förklaringen efter varje svar.',originalLanguage:'Studera på',sourceNotes:'Detaljerade förklaringar',audioTip:'Tryck på högtalaren för att lyssna.',videoLink:'Öppna video',availableLessons:'Lektioner',wordTranslation:'Betydelse',translationSoon:'Översättning förbereds',lessonExample:'Exempel',listenRepeat:'Lyssna och upprepa',readSwedish:'Läs på svenska',keyboardSearch:'Sök på hela webbplatsen',levelSelector:'Välj nivå',lessonQuizTip:'Träna på det du har lärt dig',doneNotice:'Lektionen är klar!',allTopics:'Alla teman'}:{}),
  ...(k==='uk'?{aboutTopic:'Спочатку вивчи слова, потім прочитай приклади та перевір себе.',subsections:'Усі розділи',introPractice:'Обери вправу. Після відповіді прочитай пояснення і спробуй ще раз.',originalLanguage:'Мова навчання',sourceNotes:'Докладні пояснення',audioTip:'Натисни динамік, щоб прослухати.',videoLink:'Відкрити відео',availableLessons:'Уроків',wordTranslation:'Значення',translationSoon:'Переклад готується',lessonExample:'Приклад',listenRepeat:'Прослухай і повтори',readSwedish:'Читати шведською',keyboardSearch:'Пошук усім сайтом',levelSelector:'Обрати рівень',lessonQuizTip:'Закріпи вивчене практикою',doneNotice:'Урок завершено!',allTopics:'Усі теми'}:{})
});}
const NAV4=[['home','🏠'],['lessons','📚'],['topics','🗂️'],['dictionary','🔎'],['flashcards','🃏'],['practice','🧠'],['reviews','🔁'],['rules','📜'],['alphabet','🔤'],['books','📖'],['videos','🎬'],['profile','👤']];
const mainRoutes4=[['home','🏠'],['lessons','📚'],['practice','🧠'],['videos','🎬'],['profile','👤']];
function renderNav(){
 const mk=([key,ico])=>`<button type="button" class="nav-link ${(route===key||route==='lesson'&&key==='lessons'||route==='topic'&&key==='topics'||route==='book'&&key==='books'||route==='word'&&key==='dictionary')?'active':''}" data-nav="${key}"><span class="nav-glyph" aria-hidden="true">${ico}</span><span class="nav-text">${esc(t(key))}</span></button>`;
 $('#sidebar-nav').innerHTML=NAV4.slice(0,6).map(mk).join('');$('#sidebar-learn').innerHTML=NAV4.slice(6).map(mk).join('');
 $('#mobile-nav').innerHTML=mainRoutes4.map(([key,ico])=>`<button type="button" class="${route===key?'active':''}" data-nav="${key}" aria-label="${esc(t(key))}"><span class="i">${ico}</span><span>${esc(t(key))}</span></button>`).join('')+`<button type="button" class="mobile-more" id="bottom-menu-open" aria-label="${esc(t('subsections'))}"><span class="i">☰</span><span>${esc(t('subsections'))}</span></button>`;
 const name=user?.name||t('guest');$('#sidebar-profile').innerHTML=`<span class="small-avatar">${esc(name[0]?.toUpperCase()||'👤')}</span><span style="min-width:0"><strong>${esc(name)}</strong><small>🏆 ${esc(t('accountRank'))} ${accountLevel3()}</small></span>`;$('#profile-top').textContent=name[0]?.toUpperCase()||'👤';
}
function wordIcon(w){const source=window.svWordIcons?.[w.id];const fallback=`<span class="word-icon-fallback"${source?' hidden':''}>${esc(w.emoji||'💬')}</span>`;return source?`<img class="word-icon" src="${esc(source)}" width="46" height="46" alt="" loading="lazy" decoding="async" onerror="this.nextElementSibling.hidden=false;this.remove()">${fallback}`:fallback}
function wordRowPalette(w){return [['#fff2d4','#edcf87'],['#e4f1e5','#b6d6bd'],['#fce5dc','#e9bdab'],['#e1eef9','#b6cee4'],['#f6e2ea','#dfb9c9'],['#ece5f6','#cbbce1']][Math.max(0,WORDS.indexOf(w))%6]}
function wordListVisual(w){
 const photo=(route==='reviews'||route==='dictionary'&&routeParam==='learned')?window.svFlashPhotoForWord?.(w):null;
 return photo?`<img class="word-list-photo" src="${esc(photo)}" width="46" height="46" loading="lazy" decoding="async" alt="" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden>${wordIcon(w)}</span>`:wordIcon(w);
}
function wordEntry(w){const [tint,edge]=wordRowPalette(w);return `<div class="word-row" style="--word-tint:${tint};--word-edge:${edge}" data-word-link="${esc(w.id)}" tabindex="0" role="link" aria-label="${esc(t('view'))}: ${esc(wordLabel(w))}"><span class="word-visual" aria-hidden="true">${wordListVisual(w)}</span><div class="word-info"><strong title="${esc(wordLabel(w))}">${esc(wordLabel(w))}</strong><small title="${esc(locMeaning4(w))}">${esc(locMeaning4(w))}</small></div><div class="word-actions"><button class="btn secondary small manual-review-add" data-action="mark-review" data-id="${esc(w.id)}">${studioIcon('repeat','review-button-icon')} ${esc(t('repeat'))}</button><button class="circle-btn word-known-toggle" data-action="mark-known" data-id="${esc(w.id)}" aria-label="${esc(state.known.includes(w.id)?'✓ '+t('known'):t('known'))}" title="${esc(state.known.includes(w.id)?'✓ '+t('known'):t('known'))}">${state.known.includes(w.id)?'✓ ':''}${esc(t('known'))}</button><button class="circle-btn ${state.favorites.includes(w.id)?'selected':''}" aria-label="${esc(t('favorites'))}" data-action="favorite" data-id="${esc(w.id)}">${state.favorites.includes(w.id)?'★':'☆'}</button><button class="circle-btn" data-action="speak" data-text="${esc(w.word)}" aria-label="${esc(t('speak'))}">🔊</button><button class="circle-btn" data-nav="word" data-param="${esc(w.id)}" aria-label="${esc(t('view'))}">↗</button></div></div>`}
function renderLessons(){const selected=routeParam&&'ABCD'.includes(routeParam)?routeParam:selectedLevel;selectedLevel=selected;return title(t('learnByLevel'),t('courseExplain'))+`<div class="level-roadmap" aria-label="SFI levels">${'ABCD'.split('').map((l,i)=>`<button class="roadmap-step ${selected===l?'active':''}" data-action="level" data-level="${l}"><span class="roadmap-icon">${['🌱','🌿','🌻','🏆'][i]}</span><b>SFI ${l}</b><small>${LESSONS.filter(x=>x.level===l).length} ${esc(t('availableLessons'))}</small></button>`).join('')}</div><div class="lessons-grid">${LESSONS.filter(l=>l.level===selected).map((l,i)=>`<article class="lesson-card"><div class="lesson-cover ${l.level.toLowerCase()}"><span>${esc(l.emoji)}</span><small>${esc(t('lesson'))} ${i+1}</small></div><div class="lesson-body"><h3>${esc(locLesson4(l))}</h3><p>${esc(locLessonContent4(l).description)}</p><div class="lesson-foot"><span data-quiz-status="lesson:${esc(l.id)}" class="${quizPassed('lesson:'+l.id)?'done-chip':'chip'}">${quizStatus('lesson:'+l.id)}</span><button class="btn small" data-nav="lesson" data-param="${l.id}">${esc(t('open'))} →</button></div></div></article>`).join('')}</div>`}
function locLessonContent4(lesson){
 if(locale4()==='ru')return lesson;
 const localized=content4().lessonDetails?.[lesson.id]?.[locale4()];
 if(!localized)return lesson;
 return {...lesson,...localized,reading:lesson.reading?{...lesson.reading,title:localized.readingTitle,tip:localized.readingTip}:null};
}
function locRules4(lesson){return locLessonContent4(lesson).rules}
function renderLesson(){const l=LESSONS.find(x=>x.id===routeParam);if(!l)return renderLessons();return `<button class="back-link" data-nav="lessons" data-param="${l.level}">← ${esc(t('backTo'))}</button><div class="lesson-hero"><div class="lesson-hero-art">${esc(l.emoji)}</div><div><span class="eyebrow">SFI ${l.level} · ${esc(t('lesson'))} ${LESSONS.indexOf(l)+1}</span><h1>${esc(locLesson4(l))}</h1><p>${esc(locLessonContent4(l).description)}</p><span class="chip">📝 ${l.questions.length} ${esc(t('quizDuration'))}</span></div></div><section class="content-panel lesson-goals"><h2>🎯 ${esc(t('lessonOverview'))}</h2><ul class="rule-list">${(locLessonContent4(l).goals||[locHint4()]).map(g=>`<li>${esc(g)}</li>`).join('')}</ul></section><div class="study-steps"><span>1 · 📚 ${esc(t('rulesHub'))}</span><span>2 · 🔊 ${esc(t('examples'))}</span><span>3 · 🧠 ${esc(t('startQuiz'))}</span></div><section class="content-panel"><h2 class="panel-heading">📚 ${esc(t('sourceNotes'))}</h2><div class="rule-chapters">${locRules4(l).map((r,i)=>`<div class="rule-chapter"><span class="step-num">${i+1}</span><p>${esc(r)}</p></div>`).join('')}</div></section><section class="content-panel"><h2 class="panel-heading">🔊 ${esc(t('examples'))}</h2><div class="example-grid lesson-examples">${l.examples.map(e=>`<div class="example-item"><b lang="sv">${esc(e.sv)}</b>${e.ru?`<p>${esc(quizSourceText(e.ru))}</p>`:''}<button data-action="speak" data-text="${esc(e.sv)}">🔊 ${esc(t('pronounce'))}</button></div>`).join('')}</div></section>${readingWidget3(locLessonContent4(l).reading)}<section class="horizontal-card"><div><h3>✨ ${esc(t('testKnowledge'))}</h3>${quizStatusChip('lesson:'+l.id)}<p>${l.questions.length} ${esc(t('quizDuration'))} · ${esc(t('lessonQuizTip'))}</p></div><button class="btn" data-action="lesson-test" data-id="${l.id}">${esc(t(state.quizResults['lesson:'+l.id]?'again':'startQuiz'))} →</button></section>`}
function renderTopics(){let cats=topicNames3();return title(t('topics'),t('aboutTopic'))+`<section class="topic-intro"><h2>🗂️ ${esc(t('allTopics'))} · ${cats.length}</h2><p>${esc(t('aboutTopic'))}</p><div class="topic-quick"><button class="btn secondary small" data-nav="rules">📜 ${esc(t('rulesHub'))}</button><button class="btn secondary small" data-nav="practice">🧠 ${esc(t('train'))}</button><button class="btn secondary small" data-nav="videos">🎬 ${esc(t('videos'))}</button></div></section><div class="topic-grid">${cats.map((name,i)=>{const count=WORDS.filter(w=>w.category===name).length;return `<button class="topic-card hue-${i%6}" data-nav="topic" data-param="${esc(name)}"><span class="topic-art">${topicIcon3(name)}</span><strong>${esc(locCategory4(name))}</strong><small>${count} ${esc(t('words'))}</small><span class="topic-open">${esc(t('open'))} →</span></button>`}).join('')}</div>`}
function renderTopic(){let cat=routeParam,rows=WORDS.filter(w=>w.category===cat);if(!rows.length)return renderTopics();const content=TOPIC_CONTENT3[cat];return `<button class="back-link" data-nav="topics">← ${esc(t('topics'))}</button><section class="topic-banner"><div class="topic-art">${topicIcon3(cat)}</div><div><span class="eyebrow">🇸🇪 ${esc(t('vocabulary'))}</span><h1>${esc(locCategory4(cat))}</h1>${quizStatusChip('topic:'+cat)}<p>${rows.length} ${esc(t('words'))}</p><button class="btn white" data-action="topic-quiz" data-topic="${esc(cat)}">🧠 ${esc(t('topicQuiz'))}</button></div></section><section class="content-panel"><h2>📖 ${esc(t('notes'))}</h2><p>${esc(locale4()==='ru'?(content?.tip||'Учи небольшими порциями, читай и проговаривай вслух.'):t('aboutTopic'))}</p><div class="topic-chips">${rows.slice(0,9).map(w=>`<button data-action="speak" data-text="${esc(w.word)}">🔊 ${esc(w.word)}</button>`).join('')}</div></section>${content?`<section class="content-panel"><h2>💬 ${esc(t('examples'))}</h2><div class="reading-lines">${content.lines.map(([sv,ru])=>`<div class="reading-line"><div><strong lang="sv">${esc(sv)}</strong>${locale4()==='ru'?`<small>${esc(ru)}</small>`:''}</div><button class="sound-btn" data-action="speak" data-text="${esc(sv)}">🔊</button></div>`).join('')}</div><button class="btn secondary small" style="margin-top:15px" data-action="speak" data-text="${esc(content.lines.map(x=>x[0]).join(' '))}">🔊 ${esc(t('listenReading'))}</button></section>`:''}<section class="topic-words"><div class="section-head"><h2>📚 ${esc(t('wordsModule'))}</h2></div><div class="words-grid">${rows.map(wordEntry).join('')}</div></section><div class="horizontal-card"><div><h3>⭐ ${esc(t('topicQuiz'))}</h3><p>${Math.min(20,rows.length)} ${esc(t('quizDuration'))}</p></div><button class="btn" data-action="topic-quiz" data-topic="${esc(cat)}">${esc(t('startQuiz'))} →</button></div>`}
function renderRules(){return title(t('rulesHub'),`${LESSONS.length} ${esc(t('availableLessons'))} · SFI A–D`)+`<div class="rules-tabs"><button class="pill" data-nav="alphabet">🔤 ${esc(t('alphabetHub'))}</button><button class="pill" data-nav="topics">📚 ${esc(t('topics'))}</button></div>${'ABCD'.split('').map(level=>`<section class="content-panel"><h2>📗 SFI ${level} · ${esc(levelName(level))}</h2><div class="rules-accordion">${LESSONS.filter(l=>l.level===level).map(l=>`<details class="rule-details"><summary><span class="rule-topic-title"><span class="rule-topic-icon" aria-hidden="true">${esc(l.emoji)}</span><span>${esc(locLesson4(l))}</span></span><span class="chevron">⌄</span></summary><div class="details-body"><ul>${locRules4(l).map(r=>`<li>${esc(r)}</li>`).join('')}</ul><div class="example-grid">${l.examples.slice(0,3).map(e=>`<div class="example-item"><b lang="sv">${esc(e.sv)}</b>${e.ru?`<p>${esc(quizSourceText(e.ru))}</p>`:''}<button data-action="speak" data-text="${esc(e.sv)}">🔊</button></div>`).join('')}</div><button class="btn small" data-nav="lesson" data-param="${l.id}">${esc(t('open'))} →</button></div></details>`).join('')}</div></section>`).join('')}`}
function renderVideos(){const vdesc={en:['Everyday Swedish conversations with family and friends.','A short SFI story about learning independently.','An everyday bus dialogue.','Short explanations of Swedish particle verbs.','A selection of Swedish short films.','SFI videos and learning material.','Short Swedish-language clips.','Swedish as a second language: lessons and practice.'],sv:['Svenska vardagssamtal med familj och vänner.','En kort SFI-berättelse om att lära sig självständigt.','En dialog på bussen.','Kort förklaring av partikelverb.','Ett urval svenska kortfilmer.','SFI-filmer och läromedel.','Korta klipp på svenska.','Svenska som andraspråk: lektioner och övningar.'],uk:['Щоденні розмови шведською із сім’єю та друзями.','Коротка історія про навчання на SFI.','Діалог в автобусі.','Коротке пояснення фразових дієслів.','Добірка шведських короткометражок.','Відео та навчальні матеріали SFI.','Короткі відео шведською.','Шведська як друга мова: уроки та вправи.']};return title(t('videos'),t('videosIntro'))+`<div class="notice">🎬 ${esc(t('vidNote'))}</div><div class="video-grid">${VIDEOS.map((v,i)=>`<article class="video-card"><div class="video-art">${esc(v.emoji)}</div><div class="video-body"><small>🇸🇪 SFI ${esc(v.level)} · ${esc(v.duration)}</small><h3>${esc(v.name)}</h3><p>${esc(locale4()==='ru'?v.description:vdesc[locale4()][i])}</p><a class="vid-link" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer">${esc(t('watch'))}</a><div style="margin-top:16px"><button class="btn small ${state.videos.includes(v.id)?'secondary':'ghost'}" data-action="watched" data-id="${v.id}">${state.videos.includes(v.id)?'✓ '+t('watched'):'○ '+t('markWatched')}</button></div></div></article>`).join('')}</div>`}
function renderBooks(){return title(t('books'),txt4('12 оригинальных историй на шведском с вопросами','12 original Swedish stories with comprehension practice','12 svenska berättelser med läsförståelse','12 оригінальних шведських оповідань із запитаннями'))+`<div class="book-grid">${BOOKS.map((b,i)=>`<article class="book-card hue-${i%6}"><div class="book-cover">${b.photo?`<img class="cover-photo" loading="lazy" src="${esc(b.photo)}" onerror="this.style.display='none'" alt="${esc(b.title)}">`:''}<span>${esc(b.emoji)}</span><small>SFI ${b.level}</small></div><div class="book-content"><span class="chip">SFI ${b.level}</span><h3>${esc(b.title)}</h3>${`<p>${esc(locale4()==='ru'?b.translation:b[locale4()+'_title']||b.title)}</p>`}<div class="split"><button class="btn small" data-nav="book" data-param="${b.id}">${esc(t('readNow'))} →</button>${quizStatusChip('book:'+b.id)}${state.booksRead?.includes(b.id)?'<span class="done-chip">✓</span>':''}</div></div></article>`).join('')}</div>`}
function renderBook(){const b=BOOKS.find(x=>x.id===routeParam);if(!b)return renderBooks();return `<button class="back-link" data-nav="books">← ${esc(t('books'))}</button><section class="book-reader"><div class="reader-picture hue-${BOOKS.indexOf(b)%6}">${b.photo?`<img class="cover-photo" loading="lazy" src="${esc(b.photo)}" onerror="this.style.display='none'" alt="${esc(b.title)}">`:''}<span>${esc(b.emoji)}</span></div><header class="reader-heading"><span class="reader-kicker"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6v15m0-15C9 4 5 4 3 5v14c3-1 6-1 9 2 3-3 6-3 9-2V5c-2-1-6-1-9 1Z"/></svg>SFI ${esc(b.level)}<span class="reader-kicker-dot" aria-hidden="true"></span>${esc(t('reading'))}</span><h1 lang="sv">${esc(b.title)}</h1><p class="reader-sub">${esc(locale4()==='ru'?b.translation:b[locale4()+'_title']||b.title)}</p></header><div class="reader-toolbar"><div class="reader-playback"><button type="button" class="btn reader-listen" data-action="speak" data-text="${esc(b.text)}"><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m11 5-6 4H2v6h3l6 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></svg><span>${esc(t('listenReading'))}</span></button></div><button type="button" class="btn secondary reader-read ${state.booksRead?.includes(b.id)?'is-read':''}" data-action="book-read" data-id="${esc(b.id)}" aria-pressed="${state.booksRead?.includes(b.id)?'true':'false'}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg><span>${esc(t('readBook'))}</span></button></div><p class="reader-sv" lang="sv">${esc(b.text)}</p><details class="reader-translation"><summary>🌍 ${esc(t('translation'))}</summary><p>${esc(locale4()==='ru'?b.ru:b[locale4()+'_text']||b.text)}</p></details><h2>🧠 ${esc(t('bookQuiz'))}</h2>${quizStatusChip('book:'+b.id)}<button class="btn wide" data-action="book-quiz" data-id="${b.id}">${esc(t('startQuiz'))} →</button></section>`}
function renderAlphabet(){return title('Å Ä Ö · '+t('alphabetHub'),t('alphabetPron'))+`<section class="content-panel"><p class="notice">🇸🇪 ${esc(txt4('Шведский алфавит содержит 29 букв. Слушай название и слово-пример.','The Swedish alphabet has 29 letters. Listen to the letter names and example words.','Svenska alfabetet har 29 bokstäver. Lyssna på bokstavsnamn och exempelord.','Шведський алфавіт має 29 літер. Слухай назви та приклади.'))}</p><div class="alpha-grid">${ALPHABET3.map(([letter,ipa,word,ru])=>`<article class="alpha-card"><div class="alpha-head"><span class="alpha-letter">${esc(letter)}</span><span class="alpha-ipa">${esc(ipa)}</span></div><p><strong lang="sv">${esc(word)}</strong>${locale4()==='ru'?`<small>${esc(ru)}</small>`:''}</p><div class="split"><button class="btn secondary small" data-action="letter-speak" data-letter="${esc(letter)}" aria-label="${esc(t('pronounce'))} ${letter}">🔊 ${esc(letter)}</button><button class="btn ghost small" data-action="speak" data-text="${esc(word)}">▶ ${esc(word)}</button></div></article>`).join('')}</div></section>`}
function renderHome(){let next=LESSONS.find(l=>!state.completed.includes(l.id)&&l.level===state.settings.level)||LESSONS[0];const actions=[['lessons','📚','pastel-lavender',t('lessons'),LESSONS.length+' '+t('availableLessons')],['topics','🗂️','pastel-mint',t('topics'),topicNames3().length+' '+t('allThemes')],['dictionary','🔎','pastel-peach',t('dictionary'),WORDS.length+' '+t('words')],['practice','🧠','pastel-lavender',t('train'),'14 '+t('chooseMode')],['reviews','🔁','pastel-peach',t('reviews'),t('smartReview')],['videos','🎬','pastel-mint',t('videos'),VIDEOS.length+' '+t('shortVideo')],['books','📖','pastel-peach',t('books'),BOOKS.length+' '+t('reading')],['rules','📜','pastel-lavender',t('rulesHub'),LESSONS.length+' '+t('lessonCount')],['alphabet','🔤','pastel-mint',t('alphabetHub'),'29 '+t('alphabetPron')]];return `<section class="hero"><div class="hero-copy"><span class="eyebrow">🇸🇪 SFI A · B · C · D</span><h1>${esc(t('welcome'))}</h1><p>${esc(t('heroDescription'))}</p><div class="split"><button class="btn white" data-nav="lesson" data-param="${esc(next.id)}">${esc(t('startLearning'))} →</button><button class="btn" data-nav="topics">🗂️ ${esc(t('topics'))}</button></div></div><div class="hero-picture"><div class="hero-illustration">📚</div><span class="hero-orbit orbit-a">🇸🇪</span><span class="hero-orbit orbit-b">💬</span></div></section><section class="stats-grid">${stat('🏆',accountLevel3(),t('accountRank'),'purple')}${stat('🔥',streak(),t('dayStreak'),'orange')}${stat('🧠',state.known.length,t('knownWords'),'mint')}${stat('🎓',state.completed.length,t('lessonCount'),'pink')}</section><div class="home-rank"><div class="split"><b>⭐ ${state.xp||0} XP</b><span>${accountProgress3()}/500 XP</span></div><div class="progress-track"><div class="progress-fill" style="width:${accountProgress3()/5}%"></div></div></div><div class="section-head"><h2>✨ ${esc(t('yourWorkout'))}</h2></div><div class="action-grid action-grid-4">${actions.map(([key,ico,cl,name,sub])=>`<button class="action-card ${cl}" data-nav="${key}"><span class="corner">↗</span><span class="action-emoji">${studioIcon(STUDIO_ACTION_ICON[key])}</span><h3>${esc(name)}</h3><p>${esc(sub)}</p></button>`).join('')}</div><div class="section-head"><h2>${esc(t('allCourses'))}</h2><button class="link-btn" data-nav="lessons">${esc(t('seeAll'))} →</button></div><div class="course-tiles">${'ABCD'.split('').map(courseTile).join('')}</div><div class="section-head"><h2>${esc(t('dayPractice'))}</h2><button class="link-btn" data-nav="profile">${esc(t('seeAll'))} →</button></div><div class="content-panel">${activityStrip()}<p class="info-scope">${esc(user?t('savedAccount'):t('guestNotice'))}</p></div>`}
function renderPractice(){if(quiz.active)return quiz.finished?renderQuizFinish():renderQuiz();const modes=[['mixed','🎲'],['translation','🌍'],['fillBlank','📝'],['weekdays','🗓️'],['alphabet','🔤'],['months','📆'],['dialogues','💬'],['readText','📖'],['verbForms','⚡'],['articles','🧩'],['listening','🎧'],['sentences','🧱'],['writeWord','✍️'],['fixMistake','🛠️']];return title(t('train'),t('chooseMode'))+`<section class="practice-instructions"><span class="info-illustration">🎯</span><div><h3>${esc(t('lessonQuizTip'))}</h3><p>${esc(t('introPractice'))}</p></div></section><div class="practice-modes">${modes.map(([m,e])=>`<button class="mode-card" data-action="start-mode" data-mode="${m}"><span class="e">${e}</span><b>${esc(t(m))}</b><small>20 ${esc(t('quizDuration'))} · 0 XP</small>${quizStatusChip('practice:'+m)}</button>`).join('')}</div>`}
// Exercise drafts belong to this tab and identity; account events live in the durable queue.
const quizSessionSnapshots=new WeakMap();
function quizSessionKey(){return `${localStateKey()}:quiz-v1`}
function quizQuestionSnapshots(question){
 if(quizSessionSnapshots.has(question))return quizSessionSnapshots.get(question);
 const language=state.settings.language,variants={};
 try{
  for(const lang of languages){state.settings.language=lang;variants[lang]=JSON.parse(JSON.stringify(question))}
 }finally{state.settings.language=language}
 quizSessionSnapshots.set(question,variants);
 return variants;
}
function persistQuizSession(){
 if(cloudAccount()&&(!quiz.cloud||quiz.cloud.owner!==user.id))return;
 try{
  if(!quiz.active){quizStorage().removeItem(activeQuizKey());return}
  const questions=quiz.questions.map(quizQuestionSnapshots);
  quizStorage().setItem(activeQuizKey(),JSON.stringify({version:1,language:locale4(),quiz:{...quiz,questions}}));
 }catch(_){/* Storage may be unavailable or full; the exercise remains usable. */}
}
function validQuizSession(record){
 const saved=record?.quiz;
 if(record?.version!==1||!languages.includes(record.language)||!saved||saved.active!==true)return false;
 if(!Array.isArray(saved.questions)||!saved.questions.length||saved.questions.length>100)return false;
 if(!Number.isInteger(saved.index)||saved.index<0||saved.index>=saved.questions.length)return false;
 if(!Number.isInteger(saved.score)||saved.score<0||saved.score>saved.questions.length)return false;
 if(typeof saved.mode!=='string'||!(saved.lesson===null||typeof saved.lesson==='string'))return false;
 if(typeof saved.finished!=='boolean'||typeof saved.answered!=='boolean')return false;
 if(saved.answered?typeof saved.latest!=='boolean':saved.latest!==null)return false;
 if(!(typeof saved.selected==='string'||Array.isArray(saved.selected)))return false;
 for(const variants of saved.questions){
  for(const lang of languages){
   const q=variants?.[lang];
   if(!q||!['choice','type','listen','arrange'].includes(q.type))return false;
   if(!['question','answer','why'].every(key=>typeof q[key]==='string'))return false;
   if(q.type!==variants[record.language]?.type)return false;
   if(q.type==='choice'&&(!Array.isArray(q.options)||q.options.length>20||!q.options.every(x=>typeof x==='string')||!q.options.includes(q.answer)))return false;
   if(q.type==='listen'&&typeof q.speak!=='string')return false;
   if(q.type==='arrange'&&(!Array.isArray(q.tokens)||q.tokens.length>100||typeof q.punct!=='string'||!q.tokens.every(tok=>typeof tok?.id==='string'&&typeof tok.v==='string')))return false;
  }
 }
 const current=saved.questions[saved.index][record.language];
 if(Array.isArray(saved.selected)){
  if(current.type==='arrange'){
   if(new Set(saved.selected.map(tok=>tok?.id)).size!==saved.selected.length)return false;
   if(!saved.selected.every(tok=>current.tokens.some(item=>item.id===tok?.id&&item.v===tok.v)))return false;
  }else if(saved.selected.length)return false;
 }else if(current.type==='choice'&&!current.options.includes(saved.selected))return false;
 return true;
}
function restoreQuizSession(){
 try{
  const raw=quizStorage().getItem(activeQuizKey());
  if(!raw)return false;
  const record=JSON.parse(raw);
  if(!validQuizSession(record))return false;
  if(cloudAccount()&&record.quiz.cloud?.owner!==user.id)return false;
  const saved=record.quiz;
  const questions=saved.questions.map(variants=>{
   const fields={};
   for(const key of Object.keys(variants[record.language]))fields[key]=()=>variants[locale4()][key];
   const question=localizedQuizQuestion(fields);
   quizSessionSnapshots.set(question,variants);
   return question;
  });
  let selected=saved.selected;
  if(typeof selected==='string'&&questions[saved.index].type==='choice'){
   const index=saved.questions[saved.index][record.language].options.indexOf(selected);
   selected=questions[saved.index].options[index];
  }
  quiz={...saved,answerCount:saved.answerCount??(saved.index+Number(saved.answered)),questions,selected};
  return true;
 }catch(_){return false}
}

// Keep question identity and option order fixed; resolve all display text at render time.
const quizText=(ru,en,sv,uk)=>()=>txt4(ru,en,sv,uk);
const quizValue=value=>typeof value==='function'?value():value;
function localizedQuizQuestion(fields){
 const q={};
 for(const [key,value] of Object.entries(fields))Object.defineProperty(q,key,{enumerable:true,get:()=>quizValue(value)});
 return q;
}
function localizedQuizChoice(question,answer,wrong,wordId=null,why=''){
 const choices=shuffle([answer,...wrong]);
 return localizedQuizQuestion({type:'choice',question,answer,options:()=>choices.map(quizValue),wordId,why});
}
const QUIZ_CLOZE_EXPLANATIONS=[
 ['Для «я живу» нужен bor (глагол bo).','“I live” uses bor, the present tense of bo.','Presens av bo är bor.','«Я живу» — bor, теперішній час від bo.'],
 ['После det är здесь называем день недели.','Here det är is followed by a weekday: fredag.','Här följs det är av en veckodag: fredag.','Після det är тут називаємо день тижня: fredag.'],
 ['Presens для läsa — läser.','The present tense of läsa is läser.','Presens av läsa är läser.','Теперішній час від läsa — läser.'],
 ['После har нужен supinum: köpt.','Use the supine after har: köpt.','Efter har används supinum: köpt.','Після har потрібен супінум: köpt.'],
 ['Äpple — ett-слово: ett äpple.','Äpple takes ett: ett äpple.','Äpple är ett ett-ord: ett äpple.','Äpple — іменник з ett: ett äpple.'],
 ['Till обозначает направление «в школу».','Till marks direction: till skolan means to school.','Till anger riktning: till skolan.','Till позначає напрямок: till skolan — до школи.'],
 ['Возраст выражают с är: är tio år.','Use är for age: är tio år means is ten years old.','Ålder uttrycks med är: är tio år.','Вік виражають з är: är tio år — десять років.'],
 ['После ska употребляем инфинитив без att.','Use an infinitive without att after ska: laga.','Efter ska används infinitiv utan att: laga.','Після ska вживаємо інфінітив без att: laga.'],
 ['После vill — инфинитив lära; lära sig — возвратный глагол.','Use an infinitive after vill. Lära sig is reflexive: jag vill lära mig.','Efter vill används infinitiv. Lära sig är reflexivt: jag vill lära mig.','Після vill — інфінітив. Lära sig — зворотне дієслово: jag vill lära mig.'],
 ['После обстоятельства времени глагол на второй позиции.','After the time expression, the finite verb comes second: På måndag arbetar jag.','Efter tidsuttrycket står det finita verbet på andra plats: På måndag arbetar jag.','Після обставини часу дієслово стоїть на другому місці: På måndag arbetar jag.'],
 ['Устойчивое выражение i dag — сегодня.','I dag is a fixed expression meaning today.','I dag är ett fast tidsuttryck.','Сталий вислів i dag означає сьогодні.'],
 ['Perfekt = har + supinum (varit).','The perfect tense uses har + supine: har varit.','Perfekt bildas med har + supinum: har varit.','Перфект утворюється з har + супінум: har varit.'],
 ['Стандартное выражение: ha ont i huvudet.','The expression for having a headache is ha ont i huvudet.','Uttrycket är ha ont i huvudet.','Сталий вислів: ha ont i huvudet — мати головний біль.'],
 ['В выражении ta bussen используется определённая форма bussen.','Ta bussen means take the bus and uses the definite form bussen.','I uttrycket ta bussen används bestämd form: bussen.','У вислові ta bussen використовується означена форма bussen.'],
 ['На поверхности — på bordet.','Use på for something on a surface: på bordet.','På används för något på en yta: på bordet.','На поверхні — på bordet.'],
 ['Kan обозначает умение: я пока не могу так хорошо говорить.','Kan expresses ability: I cannot speak Swedish very well yet.','Kan uttrycker förmåga: jag kan inte prata svenska så bra än.','Kan позначає вміння: я поки не можу так добре говорити шведською.'],
 ['После придаточного Om… в главном предложении глагол стоит на второй позиции.','After an initial om-clause, the main clause starts with the verb: stannar vi.','Efter en inledande om-bisats kommer huvudsatsens verb före subjektet: stannar vi.','Після підрядного з om головне речення починається з дієслова: stannar vi.'],
 ['С ett-словом прилагательное обычно получает -t: stort.','With an ett-noun, the adjective usually takes -t: stort.','Med ett-ord får adjektivet oftast -t: stort.','З іменником з ett прикметник зазвичай має -t: stort.'],
 ['Mejl — ett-слово: ett mejl.','Mejl takes ett: ett mejl.','Mejl är ett ett-ord: ett mejl.','Mejl — іменник з ett: ett mejl.'],
 ['После kan используется инфинитив: hjälpa.','Use an infinitive after kan: hjälpa.','Efter kan används infinitiv: hjälpa.','Після kan вживаємо інфінітив: hjälpa.'],
 ['После I morgon в главном предложении идёт личный глагол: börjar.','After I morgon, the finite verb comes before the subject: börjar jag.','Efter I morgon står det finita verbet före subjektet: börjar jag.','Після I morgon дієслово стоїть перед підметом: börjar jag.'],
 ['Ta på sig — надевать на себя: jag tar på mig.','Ta på sig means put on clothing: jag tar på mig.','Ta på sig betyder att klä på sig: jag tar på mig.','Ta på sig — одягати на себе: jag tar på mig.'],
 ['Presens от dricka — dricker.','The present tense of dricka is dricker.','Presens av dricka är dricker.','Теперішній час від dricka — dricker.'],
 ['Направление к месту обозначаем till.','Use till for direction towards a place.','Till anger riktning mot en plats.','Напрямок до місця позначаємо till.'],
 ['Preteritum от vara — var.','The past tense of vara is var.','Preteritum av vara är var.','Минулий час від vara — var.']
];
const QUIZ_DIALOGUE_EXPLANATIONS=[
 ['Hur mår du? — Как ты себя чувствуешь?','Hur mår du? means How are you?','Hur mår du? frågar hur någon känner sig.','Hur mår du? — Як ти почуваєшся?'],
 ['Vad heter du? — Как тебя зовут?','Vad heter du? asks for your name.','Vad heter du? frågar efter ditt namn.','Vad heter du? — Як тебе звати?'],
 ['Var спрашивает о местонахождении.','Var asks about location: where?','Var frågar efter en plats.','Var запитує про місце: де?'],
 ['Ja, tack — да, спасибо.','Ja, tack means Yes, please.','Ja, tack är ett artigt sätt att tacka ja.','Ja, tack — так, дякую.'],
 ['Цена в Швеции выражается в кронах — kronor.','Prices in Sweden are expressed in kronor.','Priser i Sverige anges i kronor.','Ціни у Швеції виражають у кронах — kronor.'],
 ['После klockan указывают время: nio.','Klockan is followed by a time: nio, nine o’clock.','Efter klockan anger man en tid: nio.','Після klockan називають час: nio — дев’ята.'],
 ['Självklart — конечно.','Självklart means of course.','Självklart betyder naturligtvis.','Självklart — звісно.'],
 ['Bredvid — рядом с.','Bredvid means next to.','Bredvid betyder vid sidan av.','Bredvid — поруч із.'],
 ['Ta bussen — ехать на автобусе.','Ta bussen means take the bus.','Ta bussen betyder att åka med buss.','Ta bussen — їхати автобусом.'],
 ['I två år — в течение двух лет.','I två år means for two years.','I två år anger hur länge något har pågått.','I två år — протягом двох років.']
];
const QUIZ_SENTENCE_TRANSLATIONS=[
 ['I work today.','Я працюю сьогодні.'],['She buys a book.','Вона купує книгу.'],['We live in Sweden.','Ми живемо у Швеції.'],['I cannot swim.','Я не вмію плавати.'],['Tomorrow I am going fishing.','Завтра я збираюся рибалити.'],['It is a big car.','Це велика машина.'],['I want to learn Swedish.','Я хочу вивчити шведську.'],['Where do you live?','Де ти живеш?'],['She has bought food.','Вона купила їжу.'],['On Friday I am off work.','У п’ятницю я вільна.'],['I like reading.','Я люблю читати.'],['The book is on the table.','Книга лежить на столі.']
];
function quizWordQuestion(w,mode='translation',pool=WORDS){
 const meaning=()=>locMeaning4(w),why=()=>`${w.word} — ${meaning()}`;
 if(mode==='listening'||mode==='writeWord')return localizedQuizQuestion({type:mode==='listening'?'listen':'type',question:()=>mode==='listening'?t('listenPrompt'):`${meaning()} → 🇸🇪`,answer:w.word,wordId:w.id,why,speak:w.word});
 const others=shuffle(pool.filter(x=>x.word!==w.word&&languages.every(lang=>x[lang]!==w[lang]||lang==='sv'))).slice(0,3);
 const q=localizedQuizChoice(`${w.word} → ?`,meaning,others.map(other=>()=>locMeaning4(other)),w.id,why);
 // Bind topic responses to the choices actually selected, not a lookup through
 // unrelated words with the same translated label (for example 'student').
 Object.defineProperty(q,'canonicalOptions',{get:()=>q.options.map(value=>normalize(value)===normalize(meaning())?w.ru:others.find(other=>locMeaning4(other)===value)?.ru||'')});
 return q;
}
function quizSourceText(source){
 return locale4()==='ru'?source:(content4().quiz?.[source]?.[locale4()]||source);
}
function quizBankQuestion(source,prefix='',questionId=null){
 const q=localizedQuizChoice(()=>prefix+quizSourceText(source.question),()=>quizSourceText(source.answer),source.options.filter(x=>x!==source.answer).map(option=>()=>quizSourceText(option)),null,()=>quizSourceText(source.why));
 if(questionId)Object.defineProperties(q,{questionId:{enumerable:true,value:questionId},serverOptions:{enumerable:true,get:()=>q.options.map(value=>normalize(value)===normalize(quizSourceText(source.answer))?source.answer:source.options.find(option=>quizSourceText(option)===value)||'')}});
 return q;
}
function quizBookQuestion(book){
 return quizBankQuestion(shuffle(book.questions)[0],`📖 ${book.title}: `);
}
function getQuestion(mode){
 if(mode==='mixed')mode=shuffle(['translation','fillBlank','weekdays','alphabet','months','dialogues','readText','verbForms','articles','sentences','writeWord','fixMistake',...('speechSynthesis' in window?['listening']:[])])[0];
 if(['translation','writeWord','listening'].includes(mode))return quizWordQuestion(shuffle(WORDS.filter(w=>mode!=='listening'||!w.word.includes(' ')))[0],mode);
 if(mode==='verbForms'){
  const w=shuffle(WORDS.filter(w=>w.type==='verb'&&w.inf&&w.pre&&w.past&&w.sup))[0], [label,key]=shuffle([['Presens','pre'],['Preteritum','past'],['Supinum','sup']])[0];
  const why=()=>txt4(`Формы глагола: ${w.inf} → ${w.pre} → ${w.past} → ${w.sup}. Группа ${w.group}.`,`Verb forms: ${w.inf} → ${w.pre} → ${w.past} → ${w.sup}. Group ${w.group}.`,`Verbformer: ${w.inf} → ${w.pre} → ${w.past} → ${w.sup}. Grupp ${w.group}.`,`Форми дієслова: ${w.inf} → ${w.pre} → ${w.past} → ${w.sup}. Група ${w.group}.`);
  return localizedQuizChoice(`${label}: ${w.inf} → ?`,w[key],shuffle(WORDS.filter(x=>x.type==='verb'&&x[key]&&x[key]!==w[key])).slice(0,3).map(x=>x[key]),w.id,why);
 }
 if(mode==='articles'){
  const w=shuffle(WORDS.filter(w=>w.type==='noun'&&w.article))[0];
  return localizedQuizChoice(()=>`${t('articles')}: ${w.word}`,w.article,[w.article==='en'?'ett':'en'],w.id,()=>`${w.article} ${w.word}${w.def?' → '+w.def:''}. `+txt4('Запоминай существительное вместе с артиклем.','Learn the noun together with its article.','Lär dig substantivet tillsammans med artikeln.','Запам’ятовуй іменник разом з артиклем.'));
 }
 if(mode==='fillBlank'||mode==='dialogues'){
  const bank=mode==='dialogues'?DIALOGUES3:CLOZE3, explanations=mode==='dialogues'?QUIZ_DIALOGUE_EXPLANATIONS:QUIZ_CLOZE_EXPLANATIONS;
  const i=Math.floor(Math.random()*bank.length),[sentence,answer,options]=bank[i];
  return localizedQuizChoice(()=>`${t('formWord')}: ${sentence}`,answer,options.filter(x=>x!==answer),null,quizText(...explanations[i]));
 }
 if(mode==='weekdays'||mode==='months'){
  const rows=mode==='weekdays'?DAYS3:MONTHS3,i=Math.floor(Math.random()*rows.length),current=rows[i][0],answer=rows[(i+1)%rows.length][0];
  return localizedQuizChoice(()=>txt4(`Что идёт после ${current}?`,`What comes after ${current}?`,`Vad kommer efter ${current}?`,`Що йде після ${current}?`),answer,shuffle(rows.filter(x=>x[0]!==answer)).slice(0,3).map(x=>x[0]),null,()=>`${current} → ${answer}. `+txt4('Дни недели и месяцы в шведском пишутся со строчной буквы.','Swedish weekdays and months are written in lowercase.','Veckodagar och månader skrivs med liten bokstav på svenska.','Дні тижня та місяці шведською пишуться з малої літери.'));
 }
 if(mode==='alphabet'){
  const [letter,ipa,word]=shuffle(ALPHABET3)[0];
  return localizedQuizChoice(()=>txt4(`Какая первая буква в слове «${word}»?`,`What is the first letter of “${word}”?`,`Vilken är första bokstaven i ”${word}”?`,`Яка перша літера у слові «${word}»?`),letter,shuffle(ALPHABET3.filter(x=>x[0]!==letter)).slice(0,3).map(x=>x[0]),null,()=>txt4(`${word} начинается на ${letter}. Название буквы: ${ipa}.`,`${word} starts with ${letter}. Letter pronunciation: ${ipa}.`,`${word} börjar med ${letter}. Bokstavens uttal: ${ipa}.`,`${word} починається з ${letter}. Вимова літери: ${ipa}.`));
 }
 if(mode==='sentences'){
  const i=Math.floor(Math.random()*SENTENCES.length),[sentence,ru]=SENTENCES[i],[en,uk]=QUIZ_SENTENCE_TRANSLATIONS[i],meaning=()=>txt4(ru,en,sentence,uk);
  const tokens=shuffle(sentence.replace(/[.!?]+$/g,'').split(' ')).map((v,i)=>({id:String(i),v}));
  return localizedQuizQuestion({type:'arrange',question:()=>`${t('arrangePrompt')}: ${meaning()}`,answer:sentence,tokens,punct:sentence.slice(-1),wordId:null,why:()=>`${sentence} — ${meaning()}`});
 }
 if(mode==='fixMistake'){
  const examples=[
   ['Jag kan simmar.','Jag kan simma.',['Jag kan simmade.','Jag simma kan.'],['После kan используется инфинитив simma.','Use the infinitive simma after kan.','Efter kan används infinitiv: simma.','Після kan вживаємо інфінітив simma.']],
   ['I dag jag jobbar.','I dag jobbar jag.',['I dag jobbade jag.','Jag i dag jobbar.'],['В главном предложении личный глагол стоит на второй позиции.','The finite verb comes second in a main clause.','I en huvudsats står det finita verbet på andra plats.','У головному реченні дієслово стоїть на другому місці.']],
   ['Jag har köpte.','Jag har köpt.',['Jag är köpt.','Jag har köpa.'],['После har нужен супинум köpt.','Use the supine köpt after har.','Efter har används supinum: köpt.','Після har потрібен супінум köpt.']],
   ['Ett stor hus.','Ett stort hus.',['En stora hus.','Ett stora hus.'],QUIZ_CLOZE_EXPLANATIONS[17]],
   ['Jag hjälper hon.','Jag hjälper henne.',['Jag hjälper hennes.','Jag hjälp hon.'],['Объектная форма от hon — henne.','The object form of hon is henne.','Objektsformen av hon är henne.','Об’єктна форма від hon — henne.']],
   ['Hon inte kan prata.','Hon kan inte prata.',['Hon kan prata inte.','Hon kunna inte prata.'],['В главном предложении inte стоит после личного глагола.','In a main clause, inte comes after the finite verb.','I en huvudsats står inte efter det finita verbet.','У головному реченні inte стоїть після дієслова.']],
   ['Jag går till hemma.','Jag går hem.',['Jag gå hem.','Jag går hemmat.'],['Идти домой — gå hem, без till.','Use gå hem for going home, without till.','Det heter gå hem, utan till.','Іти додому — gå hem, без till.']],
   ['Jag bor på Sverige.','Jag bor i Sverige.',['Jag bor till Sverige.','Jag bor från Sverige.'],['Для страны употребляется i: i Sverige.','Use i with a country: i Sverige.','Med länder används i: i Sverige.','З назвою країни вживаємо i: i Sverige.']],
   ['Vi ska åker i morgon.','Vi ska åka i morgon.',['Vi åka ska i morgon.','Vi ska åkt i morgon.'],['После ska нужен инфинитив åka.','Use the infinitive åka after ska.','Efter ska används infinitiv: åka.','Після ska потрібен інфінітив åka.']],
   ['En äpple är rött.','Ett äpple är rött.',['Den äpple är rött.','En äpple är röd.'],QUIZ_CLOZE_EXPLANATIONS[4]],
   ['Hon har inte kom.','Hon har inte kommit.',['Hon har inte komma.','Hon har inte kommer.'],['Супинум от komma — kommit.','The supine of komma is kommit.','Supinum av komma är kommit.','Супінум від komma — kommit.']]
  ];
  const [sentence,answer,wrong,why]=shuffle(examples)[0];
  return localizedQuizChoice(()=>`❌ ${sentence} · ${t('fixMistake')}`,answer,wrong,null,quizText(...why));
 }
 if(mode==='readText')return quizBookQuestion(shuffle(BOOKS)[0]);
 return getQuestion('translation');
}
async function startQuiz(mode='mixed',lesson=null,forReview=false){
 if(quizBusy)return;
 if(cloudAccount()&&(!window.SVProgress?.writeStatus().ready||!window.SVProgress.supports('quiz_rewards_v1'))){toast(t('saveError'));return}
 const origin=quiz.finished&&quiz.origin?quiz.origin:{route, param:routeParam};
 if(quiz.cloud&&!quiz.finished){
  const previous=quiz;quiz.cloud.events.abandon??=quizEvent('session_abandon',{});
  quizLoading(true);let ok=false;try{ok=await sendQuizEvent('start')&&await sendQuizEvent('abandon')}finally{if(quiz===previous)quizLoading(false)}
  if(!ok||quiz!==previous){if(quiz===previous)toast(t('saveError'));return}
 }
 let questions=[];
 if(mode==='video'){
  const v=MORE_VIDEOS.find(x=>x.id===lesson);if(!v?.question)return;
  if(!videoContentAvailable(v)){toast(videoText('expired'));return}
  if(cloudAccount()&&v.requiresVideoBank&&!window.SVProgress?.supports('video_quizzes_v3')){toast(videoText('quizUnavailable'));return}
  questions=v.questions.map(source=>localizedQuizChoice(source.question,source.answer,source.wrong,null,()=>txt4('По материалам UR. Ответ: ','Question based on UR materials. Answer: ','Fråga utifrån UR:s material. Svar: ','За матеріалами UR. Відповідь: ')+source.answer));
 }else if(mode==='book'){
  const book=BOOKS.find(x=>x.id===lesson);if(!book)return;
  questions=book.questions.map((source,i)=>quizBankQuestion(source,'','q'+i));
 }else if(mode==='topic'){
  const words=shuffle(topicWordsPlus(lesson));
  questions=words.slice(0,20).map(w=>{const q=quizWordQuestion(w,'translation',words);Object.defineProperties(q,{questionId:{enumerable:true,value:w.id},serverOptions:{enumerable:true,get:()=>q.canonicalOptions}});return q});
 }else if(lesson){
  const l=LESSONS.find(x=>x.id===lesson);if(!l)return;
  questions=shuffle(l.questions.map((source,i)=>quizBankQuestion(source,'','q'+i)));
 }else if(forReview){
  questions=shuffle(reviewDeck()).slice(0,20).map(w=>{
   if(w.type==='verb')return localizedQuizChoice(`${w.inf} → Preteritum`,w.past,shuffle(WORDS.filter(x=>x.type==='verb'&&x.past&&x.past!==w.past)).slice(0,3).map(x=>x.past),w.id,()=>`${w.inf} → ${w.pre} → ${w.past} → ${w.sup} · ${locMeaning4(w)}`);
   if(w.type==='noun')return localizedQuizChoice(`${w.word} · en/ett`,w.article,[w.article==='en'?'ett':'en'],w.id,()=>`${w.article} ${w.word} — ${locMeaning4(w)}`);
   return quizWordQuestion(w);
  });
 }else questions=Array.from({length:20},()=>getQuestion(mode));
 if(mode==='video')questions.forEach((q,i)=>Object.defineProperties(q,{questionId:{enumerable:true,value:MORE_VIDEOS.find(v=>v.id===lesson).questions[i].id},serverOptions:{enumerable:true,get:()=>q.options.map(value=>normalize(value)===normalize(q.answer)?q.answer:value)}}));
 if(!questions.length){toast(t('noDue'));return}
 quiz={active:true,finished:false,mode,lesson,questions,index:0,score:0,answered:false,selected:[],latest:null,origin,mistakes:[],answerCount:0};
 if(cloudAccount()){
  quiz.cloud={owner:user.id,id:crypto.randomUUID(),events:{},version:window.SVProgress.status().content_version};
  quiz.cloud.events.start=quizEvent('session_start',{mode:lesson&&!['book','topic','video'].includes(mode)?'lesson':mode,...(lesson?{context_id:lesson}:{}),content_version:quiz.cloud.version,questions:questions.map(q=>q.questionId?{question_id:q.questionId}:q.wordId?{word_id:q.wordId}:{})});
 }
 navigate('practice');if(quiz.cloud){
  const current=quiz;quizLoading(true);try{if(!await sendQuizEvent('start')&&quiz===current)toast(t('saveError'))}finally{if(quiz===current){quizLoading(false);render()}}
 }
}
// Overlay support for every navigation category and responsive search.
function drawerToggle4(force){const app=$('#app'),opened=force===undefined?!app.classList.contains('nav-open'):!!force;app.classList.toggle('nav-open',opened);$('#menu-toggle')?.setAttribute('aria-expanded',String(opened));if(opened)$('#drawer-close')?.focus()}
document.addEventListener('click',e=>{if(e.target.closest('#menu-toggle,#bottom-menu-open')){e.preventDefault();drawerToggle4(true)}else if(e.target.closest('#drawer-close,#nav-shade')){e.preventDefault();drawerToggle4(false)}else if(e.target.closest('button[data-nav]'))drawerToggle4(false)},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')drawerToggle4(false)});
const oldRender4=legacyRender4;
function render(){$('#page').style.minHeight='';$('#page').style.overflowAnchor='';persistQuizSession();document.body.dataset.sfiLevel=state.settings.level||"A";oldRender4();const extra=route==='cheats'?renderCheats:route==='numbers'?renderNumbers:null;if(extra)$('#page').innerHTML=extra();if(route==='home'){$('#page').insertAdjacentHTML('beforeend',`<section class="resource-bar"><button class="btn secondary" data-nav="cheats"><span aria-hidden="true">🧾</span><span>${esc(pT('cheats'))}</span></button><button class="btn secondary" data-nav="numbers"><span aria-hidden="true">🔢</span><span>${esc(pT('numbers'))}</span></button></section>`)}if(route==='rules'){$('#page').insertAdjacentHTML('afterbegin',`<section class="resource-bar"><button class="btn secondary small" data-nav="cheats"><span aria-hidden="true">🧾</span><span>${esc(pT('cheats'))}</span></button><button class="btn secondary small" data-nav="numbers"><span aria-hidden="true">🔢</span><span>${esc(pT('numbers'))}</span></button><a href="https://www.skolverket.se/undervisning/komvux/komvux-i-svenska-for-invandrare-sfi/kursplan-for-svenska-for-invandrare-sfi-pa-andra-sprak" target="_blank" rel="noopener noreferrer" class="btn ghost small">Skolverket ↗</a><a href="https://svenska.se/" target="_blank" rel="noopener noreferrer" class="btn ghost small">Svenska Akademien ↗</a></section>`) }const sr=$('#search-results');sr?.setAttribute('aria-label',t('keyboardSearch'));const lang=$('#lang-select');lang?.setAttribute('title',t('interfaceLang'));let foot=document.querySelector('#footer-text');if(foot)foot.textContent=txt4('Учи понемногу, но каждый день.','Learn a little, every day.','Lär dig lite varje dag.','Вчи потроху, але щодня.');const legal=$$('.footer-legal a');if(legal.length>=3){legal[0].textContent=txt4('Конфиденциальность','Privacy','Integritet','Конфіденційність');legal[1].textContent=txt4('Условия использования','Terms of use','Användarvillkor','Умови використання');legal[2].textContent=txt4('Cookie и хранение','Cookies & storage','Kakor och lagring','Cookie та зберігання');}renderProgressUX();}

/* Search and word details: localized labels with robust, bounded suggestions. */
function searchNow(value){const q=String(value||'').trim().toLocaleLowerCase(),el=$('#search-results');if(!el)return;if(!q){el.classList.add('hidden');el.innerHTML='';return}
 const contains=(s)=>String(s||'').toLocaleLowerCase().includes(q);
 const topics=topicNames3().filter(n=>contains(n)||contains(locCategory4(n))).slice(0,5);
 const lessons=LESSONS.filter(l=>[l.title,locLesson4(l),l.description,...l.examples.map(x=>x.sv)].some(contains)).slice(0,6);
 const books=BOOKS.filter(b=>[b.title,b.translation,b.text].some(contains)).slice(0,4);
 const words=WORDS.filter(w=>[w.word,w.ru,w.en,w.uk,w.inf,w.pre,w.past,w.sup,w.category,locCategory4(w.category),w.example].some(contains)).slice(0,8);
 const row=(target,param,icon,name,description)=>`<button type="button" class="search-result" data-nav="${target}" data-param="${esc(param)}"><span class="emo" aria-hidden="true">${icon}</span><span><strong>${esc(name)}</strong><small>${esc(description)}</small></span></button>`;
 el.innerHTML=[...topics.map(x=>row('topic',x,'🗂️',locCategory4(x),t('topics'))),...lessons.map(x=>row('lesson',x.id,x.emoji,locLesson4(x),`SFI ${x.level}`)),...books.map(x=>row('book',x.id,x.emoji,x.title,`SFI ${x.level}`)),...words.map(x=>row('word',x.id,x.emoji,wordLabel(x),locMeaning4(x)))].join('')||`<div class="serp-empty">${esc(t('noResults'))}</div>`;el.classList.remove('hidden');}
function renderDictionary(){let rows=filteredWords(),part=routeParam==='learned'?rows:rows.slice(0,dictFilter.limit),cats=availableCategories();return title(t('wordCount'),`${t('wordExplain')} · ${WORDS.length} ${t('words')}`)+`<div class="dict-shortcuts"><button class="pill" data-nav="alphabet">🔤 ${esc(t('alphabetHub'))}</button><button class="pill" data-nav="topics">🗂️ ${esc(t('topics'))}</button><button class="pill" data-nav="rules">📜 ${esc(t('rulesHub'))}</button></div><div class="filters-bar"><div class="dict-search-field"><input class="search-input" id="dict-search" value="${esc(dictFilter.text)}" autocomplete="off" placeholder="${esc(t('searchWords'))}" aria-label="${esc(t('searchWords'))}"><button type="button" class="dict-search-clear" data-action="dict-clear-search" aria-label="${esc(txt4('Очистить поиск','Clear search','Rensa sökning','Очистити пошук'))}" ${dictFilter.text?'':'hidden'}>×</button></div><select class="form-select" id="dict-kind" aria-label="${esc(t('all'))}">${[['all',t('all')],['verb',t('verbs')],['noun',t('nouns')],['other',t('other')]].map(([v,n])=>`<option value="${v}" ${dictFilter.kind===v?'selected':''}>${esc(n)}</option>`).join('')}</select><select class="form-select" id="dict-group" aria-label="${esc(t('allGroups'))}">${[['all',t('allGroups')],['1','1'],['2A','2A'],['2B','2B'],['3','3'],['4','4']].map(([v,n])=>`<option value="${v}" ${dictFilter.group===v?'selected':''}>${esc(n)}</option>`).join('')}</select></div><div class="dict-split"><div class="filter-pills"><button class="pill ${routeParam===''?'active':''}" data-action="toggle-fav" data-fav="false">${esc(t('showAll'))}</button><button class="pill ${routeParam==='favorites'?'active':''}" data-action="toggle-fav" data-fav="true">⭐ ${esc(t('onlyFav'))}</button><button class="pill ${routeParam==='learned'?'active':''}" data-action="show-learned">${esc(txt4('Изученные','Learned','Inlärda','Вивчені'))}</button></div><select id="dict-category" class="form-select" aria-label="${esc(t('allThemes'))}"><option value="all">${esc(t('allThemes'))}</option>${cats.map(c=>`<option value="${esc(c)}" ${dictFilter.category===c?'selected':''}>${esc(locCategory4(c))}</option>`).join('')}</select></div><p class="vocab-counter" role="status">${esc(dictionaryCounter(part.length,rows.length))}</p>${part.length?`<div class="words-grid">${part.map(wordEntry).join('')}</div>`:`<div class="empty-state"><div class="big">🔎</div><h3>${esc(dictionaryReadFailed()?ux('readError'):dictionaryLoading()?ux('loading'):hasDictionaryFilters()?wordUX('filteredEmpty'):routeParam==='learned'?ux('empty'):t('noResults'))}</h3>${!dictionaryLoading()&&!dictionaryReadFailed()&&hasDictionaryFilters()?`<button type="button" class="dict-empty-reset" data-action="dict-reset">${esc(wordUX('reset'))}</button>`:''}</div>`}${routeParam!=='learned'&&rows.length>dictFilter.limit?`<div class="list-footer"><button class="btn secondary" data-action="dict-more">${esc(t('more'))} ↓</button></div>`:''}`}
function wordSectionHeading(number,id,title,description=''){
 return `<div class="word-section-heading"><span class="word-section-number" aria-hidden="true">${number}</span><div><h2 id="${id}">${esc(title)}</h2>${description?`<p>${esc(description)}</p>`:''}</div></div>`;
}
function renderWord(){
 const w=getWord(routeParam);if(!w)return renderDictionary();
 const isVerb=w.type==='verb',isNoun=w.type==='noun',favorite=state.favorites.includes(w.id);
 const forms=isVerb?[['Infinitiv',w.inf,txt4('Начальная форма','Base form','Grundform','Початкова форма')],['Presens',w.pre,txt4('Настоящее','Present','Nutid','Теперішній час')],['Preteritum',w.past,txt4('Прошедшее','Past','Dåtid','Минулий час')],['Supinum',w.sup,txt4('После har / hade','After har / hade','Efter har / hade','Після har / hade')],['Grupp',w.group,txt4('Группа глагола','Verb group','Verbgrupp','Група дієслова')]]:isNoun?[['Artikel',w.article,txt4('Артикль','Article','Artikel','Артикль')],['Obestämd singular',w.word,txt4('Один предмет','One item','En sak','Один предмет')],['Bestämd singular',w.def,txt4('Этот предмет','The item','Den här saken','Цей предмет')],['Obestämd plural',w.plural,txt4('Несколько предметов','Several items','Flera saker','Кілька предметів')],['Bestämd plural',w.pluralDef,txt4('Эти предметы','The items','De här sakerna','Ці предмети')]]:[];
 const formsTitle=isVerb?t('verbForms'):txt4('Формы существительного','Noun forms','Substantivets former','Форми іменника');
 const examples=w.examples?.length?w.examples:[{sv:w.example||wordLabel(w),ru:w.exampleRu}];
 return `<button class="back-link" data-nav="dictionary" data-param="${esc(lastDictionaryScope)}">← ${esc(t('dictionary'))}</button>
 <article class="content-panel word-panel" aria-labelledby="word-title">
  <header class="word-detail">
   <div class="visual" aria-hidden="true">${pic(w,true)}</div>
   <div class="word-detail-copy"><div class="word-detail-meta"><span class="chip">${esc(isVerb?t('verbs'):isNoun?t('nouns'):t('other'))}</span>${!['Глаголы','Существительные'].includes(w.category)?`<span class="word-topic">${esc(locCategory4(w.category))}</span>`:''}</div><h1 id="word-title" lang="sv">${esc(wordLabel(w))}</h1><p class="word-meaning">${esc(locMeaning4(w))}</p>
    <div class="word-detail-tools"><button type="button" class="btn secondary small" data-action="speak" data-text="${esc(wordLabel(w))}">🔊 ${esc(t('speak'))}</button><button type="button" class="btn ghost small word-favorite ${favorite?'is-favorite':''}" data-action="favorite" data-id="${esc(w.id)}" aria-pressed="${favorite}"><span aria-hidden="true">${favorite?'★':'☆'}</span> ${esc(t('favorites'))}</button></div>
   </div>
  </header>
  ${forms.length?`<section class="word-forms-section" aria-labelledby="word-forms-title">${wordSectionHeading('01','word-forms-title',formsTitle)}<dl class="word-forms">${forms.map(([name,value,hint])=>`<div><dt><span lang="sv">${esc(name)}</span><small>${esc(hint)}</small></dt><dd lang="sv">${esc(value||'—')}</dd></div>`).join('')}</dl></section>`:''}
  ${isVerb?verbTimeline5(w):''}
  <div class="word-examples">${examples.map((example,i)=>`<section class="word-example" aria-labelledby="word-example-title-${i}">${wordSectionHeading(isVerb?'03':isNoun?'02':'01',`word-example-title-${i}`,t('examples'))}<div class="word-example-content"><div><p class="word-example-text" lang="sv">${esc(example.sv)}</p>${locale4()==='ru'&&example.ru?`<p class="word-example-translation">${esc(example.ru)}</p>`:''}</div><button type="button" class="circle-btn" data-action="speak" data-text="${esc(example.sv)}" aria-label="${esc(t('speak'))}: ${esc(example.sv)}">🔊</button></div></section>`).join('')}</div>
  <footer class="word-panel-actions"><button type="button" class="btn" data-action="mark-known" data-id="${esc(w.id)}">${state.known.includes(w.id)?'✓ '+esc(t('known')):esc(t('known'))}</button><button type="button" class="btn secondary" data-action="mark-review" data-id="${esc(w.id)}">${studioIcon('repeat','review-button-icon')} ${esc(t('repeat'))}</button></footer>
 </article>`;
}
const legacyRenderFlashcards4=legacyrenderFlashcards4;
function renderFlashcards(){if(flashFilter.scope==='known'){flash.ids=flash.ids.filter(id=>state.known.includes(id));if(flash.index>=flash.ids.length)flash.index=0}const w=getWord(flash.ids[flash.index]);let page=legacyRenderFlashcards4();if(w&&locale4()!=='ru'){page=page.replaceAll(esc(w.ru),esc(locMeaning4(w)));page=page.replace('· '+esc(w.category)+'</div>','· '+esc(locCategory4(w.category))+'</div>')}return page}
const legacyRenderReviews4=legacyrenderReviews4;
function renderReviews(){return renderManualReviews()}
function filteredWords(){const q=dictFilter.text.trim().toLocaleLowerCase();return WORDS.filter(w=>(!q||[w.word,w.ru,w.en,w.uk,w.inf,w.pre,w.past,w.sup,w.article,w.category,locCategory4(w.category),w.example].some(x=>String(x||'').toLocaleLowerCase().includes(q)))&&(dictFilter.kind==='all'||w.type===dictFilter.kind)&&(dictFilter.group==='all'||w.group===dictFilter.group)&&(dictFilter.category==='all'||w.category===dictFilter.category)&&(routeParam!=='learned'||state.known.includes(w.id))&&(routeParam!=='favorites'||state.favorites.includes(w.id)))}

/* Svenska Lätt — final integrated quality and learning improvements */
const polishLang={
ru:{'personal':'Мой профиль','nameEdit':'Имя в кабинете','saveName':'Сохранить имя','uploadPhoto':'Добавить фотографию','removePhoto':'Удалить фотографию','cheats':'Шпаргалки','cheatIntro':'Простые схемы, сравнения и правила из надёжных источников','numbers':'Числа и счёт','practiceMore':'Дополнительные задания','watchQuiz':'Посмотрел(а)? Пройди мини-тест','topicExtra':'Включены слова из близких тем','levelHint':'Рекомендуется для твоего уровня','source':'Источники и проверка','audioError':'Шведское произношение недоступно. Проверь язык речи на устройстве.','profileSave':'Изменения сохранены','avatarError':'Выбери JPEG, PNG или WebP размером до 6 МБ','guestExplain':'Прогресс сохраняется на устройстве. Облачная регистрация заработает после настройки Supabase.'},
en:{'personal':'My profile','nameEdit':'Display name','saveName':'Save name','uploadPhoto':'Upload photo','removePhoto':'Remove photo','cheats':'Cheat sheets','cheatIntro':'Simple charts and grammar rules with reliable sources','numbers':'Numbers and counting','practiceMore':'More exercises','watchQuiz':'Finished watching? Take a short quiz','topicExtra':'Includes related words from nearby topics','levelHint':'Recommended for your level','source':'Sources and verification','audioError':'Swedish audio is unavailable. Check Swedish speech settings on your device.','profileSave':'Changes saved','avatarError':'Choose a JPEG, PNG or WebP up to 6 MB','guestExplain':'Progress is saved on this device. Cloud accounts will work after Supabase is configured.'},
sv:{'personal':'Min profil','nameEdit':'Visningsnamn','saveName':'Spara namn','uploadPhoto':'Ladda upp bild','removePhoto':'Ta bort bild','cheats':'Snabbguider','cheatIntro':'Enkla tabeller och grammatikregler med tillförlitliga källor','numbers':'Tal och räkning','practiceMore':'Fler övningar','watchQuiz':'Har du tittat? Testa vad du förstod','topicExtra':'Innehåller även ord från närliggande teman','levelHint':'Rekommenderas för din nivå','source':'Källor och kontroll','audioError':'Svenskt tal är inte tillgängligt. Kontrollera talinställningarna.','profileSave':'Ändringarna sparades','avatarError':'Välj JPEG, PNG eller WebP på högst 6 MB','guestExplain':'Framstegen sparas på enheten. Molnkontot fungerar när Supabase har anslutits.'},
uk:{'personal':'Мій профіль','nameEdit':'Ім’я у профілі','saveName':'Зберегти ім’я','uploadPhoto':'Додати фотографію','removePhoto':'Видалити фотографію','cheats':'Шпаргалки','cheatIntro':'Прості схеми й граматичні правила з надійних джерел','numbers':'Числа й лічба','practiceMore':'Додаткові завдання','watchQuiz':'Переглянув(ла)? Пройди короткий тест','topicExtra':'Додано слова з близьких тем','levelHint':'Рекомендовано для твого рівня','source':'Джерела та перевірка','audioError':'Шведське озвучення недоступне. Перевір налаштування мовлення на пристрої.','profileSave':'Зміни збережено','avatarError':'Обери JPEG, PNG або WebP до 6 МБ','guestExplain':'Прогрес зберігається на пристрої. Хмарний акаунт працюватиме після налаштування Supabase.'}}
const pT=k=>polishLang[locale4()]?.[k]||polishLang.ru[k]||k;
const TOPIC_REL={
 'Вопросы':['Общение','Общение и чувства','Местоимения'], 'Связки':['Вопросы','Предлоги','Общение'],'Местоимения':['Вопросы','Общение','Связки'],
 'Общение':['Общение и чувства','Вопросы','Местоимения'],'Чувства':['Общение и чувства','Общение','Семья'],'Общение и чувства':['Чувства','Общение','Семья'],
 'Дом':['Дом и комнаты','Быт и дела','Место'],'Дом и комнаты':['Дом','Быт и дела','Место'],'Быт и дела':['Дом','Дом и комнаты','Магазин'],
 'Магазин':['Магазин и покупки','Еда','Одежда'],'Магазин и покупки':['Магазин','Еда','Одежда'],'Еда':['Еда и напитки','Магазин и покупки'],'Еда и напитки':['Еда','Магазин'],
 'Учёба':['Школа и SFI','Работа'],'Школа и SFI':['Учёба','Работа'],'Дни и календарь':['Время','Числа','Счёт и количество'],
 'Числа':['Счёт и количество','Количество','Дни и календарь'],'Счёт и количество':['Числа','Количество','Время'],'Количество':['Счёт и количество','Числа'],
 'Время':['Дни и календарь','Счёт и количество'],'Место':['Город и места','Путешествия','Дом'],'Город и места':['Место','Транспорт','Путешествия'],
 'Путешествия':['Транспорт','Город и места','Место'],'Транспорт':['Путешествия','Город и места'],'Цвета':['Цвета и формы','Прилагательные','Одежда'],
 'Цвета и формы':['Цвета','Прилагательные'],'Прилагательные':['Цвета и формы','Цвета','Общение и чувства'],'Досуг':['Досуг и спорт','Природа','Общение и чувства'],
 'Досуг и спорт':['Досуг','Природа','Животные'],'Тело':['Здоровье','Одежда'],'Здоровье':['Тело','Быт и дела'],'Одежда':['Тело','Магазин и покупки'],
 'Семья':['Общение и чувства','Чувства'],'Животные':['Природа','Досуг и спорт'],'Природа':['Животные','Погода'],'Работа':['Учёба','Школа и SFI'],
 'Техника':['Работа','Учёба'],'Погода':['Природа','Дни и календарь'],'Глаголы':['Работа','Быт и дела'],'Существительные':['Дом и комнаты','Учёба'],'Общество':['Работа','Общение']};
const TOPIC_EMOJI={'Дом':'🏠','Дом и комнаты':'🛋️','Место':'📍','Местоимения':'🙋','Вопросы':'❓','Учёба':'📝','Школа и SFI':'🎓','Цвета':'🌈','Цвета и формы':'🎨','Время':'⏱️','Дни и календарь':'📅','Числа':'🔢','Количество':'⚖️','Счёт и количество':'🧮','Магазин':'🛒','Магазин и покупки':'🛍️','Еда':'🥣','Еда и напитки':'🍽️','Досуг':'🎲','Досуг и спорт':'🚴','Здоровье':'🩺','Тело':'🫀','Чувства':'💗','Общение':'🗣️','Общение и чувства':'💬','Общество':'🏛️','Работа':'💼','Связки':'🔗','Предлоги':'🧭','Глаголы':'⚡','Существительные':'📦','Прилагательные':'✨','Транспорт':'🚆','Путешествия':'🧳','Животные':'🐾','Природа':'🌲','Погода':'⛅','Город и места':'🏙️','Техника':'💻','Одежда':'👕','Быт и дела':'🧹'};
function topicWordsPlus(cat){const out=WORDS.filter(w=>w.category===cat),have=new Set(out.map(w=>w.id));for(const related of TOPIC_REL[cat]||[]){for(const w of WORDS){if(w.category===related&&!have.has(w.id)){out.push(w);have.add(w.id);if(out.length>=36)break}}if(out.length>=36)break}return out}
function renderTopics(){const cats=topicNames3();return title(t('topics'),`${cats.length} ${esc(t('allTopics'))}`)+`<div class="topic-grid premium-topics">${cats.map((c,i)=>`<button class="topic-card" data-nav="topic" data-param="${esc(c)}"><span class="topic-emoji">${studioIcon(STUDIO_TOPIC_ICON[c])}</span><span class="topic-arrow">↗</span><h3>${esc(locCategory4(c))}</h3><p>${topicWordsPlus(c).length} ${esc(t('words'))}</p>${quizStatusChip('topic:'+c)}</button>`).join('')}</div>`}
function renderTopic(){const cat=routeParam,rows=topicWordsPlus(cat);if(!rows.length)return renderTopics();const content=TOPIC_CONTENT3[cat];return `<button class="back-link" data-nav="topics">← ${esc(t('topics'))}</button><section class="topic-banner"><span class="topic-hero-icon">${TOPIC_EMOJI[cat]||'📚'}</span><div><small>SFI A–D · ${rows.length} ${esc(t('words'))}</small><h1>${esc(locCategory4(cat))}</h1>${quizStatusChip('topic:'+cat)}<p>${esc(pT('topicExtra'))}</p><button class="btn white" data-action="topic-quiz" data-topic="${esc(cat)}">🧠 ${esc(t('topicQuiz'))} →</button></div></section>${content?`<section class="content-panel compact-panel"><h2>💬 ${esc(t('examples'))}</h2><div class="example-grid">${content.lines.map(([sv,ru])=>`<div class="example-item"><strong lang="sv">${esc(sv)}</strong>${locale4()==='ru'?`<p>${esc(ru)}</p>`:''}<button class="sound-btn" data-action="speak" data-text="${esc(sv)}" aria-label="${esc(t('speak'))}">🔊</button></div>`).join('')}</div></section>`:''}<div class="words-grid">${rows.map(wordEntry).join('')}</div><div class="horizontal-card"><div><h3>${esc(t('testKnowledge'))}</h3><p>${esc(t('quizTip'))}</p></div><button class="btn" data-action="topic-quiz" data-topic="${esc(cat)}">${esc(t('startQuiz'))} →</button></div>`}
const NUM0 = "noll ett två tre fyra fem sex sju åtta nio tio elva tolv tretton fjorton femton sexton sjutton arton nitton".split(" ");
const TEN_MAP={20:'tjugo',30:'trettio',40:'fyrtio',50:'femtio',60:'sextio',70:'sjuttio',80:'åttio',90:'nittio'};
const swNum=n=>n<20?NUM0[n]:n===100?'hundra':TEN_MAP[Math.floor(n/10)*10]+(n%10?NUM0[n%10]:'');
function renderNumbers(){const grid=a=>`<div class="number-grid">${a.map(n=>`<button class="number-item" data-action="speak" data-text="${esc(swNum(n))}" aria-label="${n} ${esc(swNum(n))}"><small>${n}</small><strong lang="sv">${esc(swNum(n))}</strong><span>🔊</span></button>`).join('')}</div>`;return title(pT('numbers'),pT('cheatIntro'))+`<section class="content-panel"><h2>0–19</h2>${grid(Array.from({length:20},(_,i)=>i))}</section><section class="content-panel"><h2>20–100</h2><p>${esc(txt4('Десятки образуются не по одному универсальному шаблону. Формы tjugo, trettio, fyrtio и другие лучше выучить отдельно. Чтобы получить 21, добавляем ett без пробела: tjugoett.','Tens have their own spelling. Memorise tjugo, trettio, fyrtio and so on. For 21 join tjugo and ett: tjugoett.','Tiotalen har särskilda stavningar: tjugo, trettio, fyrtio osv. Talet 21 skrivs tjugoett.','Десятки мають окремі форми: tjugo, trettio, fyrtio тощо. Число 21 — tjugoett.'))}</p>${Array.from({length:8},(_,i)=>{const n=(i+2)*10;return `<details class="rule-details" ${i===0?'open':''}><summary>${n}–${n+9} · ${swNum(n)} <span class="chevron">⌄</span></summary>${grid(Array.from({length:10},(_,j)=>n+j))}</details>`}).join('')}${grid([100])}</section><section class="content-panel"><h2>${esc(txt4('Сотни и большие числа','Hundreds and large numbers','Hundratal och stora tal','Сотні й великі числа'))}</h2><div class="number-grid large-number-grid">${[[100,'hundra'],[300,'trehundra'],[1000,'tusen'],[100000,'hundratusen'],[1000000,'en miljon'],[100000000,'hundra miljoner']].map(([n,v])=>`<button class="number-item" data-action="speak" data-text="${esc(v)}"><small>${new Intl.NumberFormat(locale4()).format(n)}</small><strong lang="sv">${v}</strong><span>🔊</span></button>`).join('')}</div><p class="micro-note">${esc(txt4('Важно: en miljon, två miljoner (miljon — существительное). Перед существительным встречаются en и ett в зависимости от рода.','Note: en miljon, två miljoner (miljon is a noun). Use en or ett for one based on noun gender.','Observera: en miljon, två miljoner. Använd en eller ett beroende på substantivet.','Зверни увагу: en miljon, två miljoner. En чи ett залежить від роду іменника.'))}</p></section><div class="horizontal-card"><h3>🧠 ${esc(t('testKnowledge'))}</h3><button class="btn" data-action="start-mode" data-mode="weekdays">${esc(t('startQuiz'))} →</button></div>`}
const CHEAT_SECTIONS=[
{ico:'🕰️',title:['Времена: 6 конструкций','Tenses: 6 constructions','Tempus: sex konstruktioner','Часи: шість конструкцій'],rows:[['Infinitiv','att arbeta','Начальная форма'],['Presens','Jag arbetar.','Сейчас / привычка'],['Preteritum','Jag arbetade i går.','Прошедшее событие'],['Perfekt','Jag har arbetat.','har + supinum'],['Pluskvamperfekt','Jag hade arbetat.','hade + supinum'],['Futurum','Jag ska arbeta.','ska + infinitiv']]},
{ico:'⚡',title:['Группы глаголов','Verb groups','Verbgrupper','Групи дієслів'],rows:[['1','prata · pratar · pratade · pratat','-ar · -ade · -at'],['2A','stänga · stänger · stängde · stängt','-er · -de · -t'],['2B','köpa · köper · köpte · köpt','-er · -te · -t'],['3','bo · bor · bodde · bott','короткие основы; исключения'],['4','skriva · skriver · skrev · skrivit','неправильные / сильные']]},
{ico:'📦',title:['Существительные','Nouns','Substantiv','Іменники'],rows:[['en bil','bilen','определённая форма'],['ett hus','huset','определённая форма'],['en bok','böcker · böckerna','множественное число'],['ett äpple','äpplen · äpplena','множественное число']]},
{ico:'🧩',title:['Прилагательные','Adjectives','Adjektiv','Прикметники'],rows:[['en stor bil','ett stort hus','-t у ett-слов'],['två stora bilar','den stora bilen','-a во множественном и определённом употреблении']]},
{ico:'🔀',title:['Порядок слов','Word order','Ordföljd','Порядок слів'],rows:[['Jag läser en bok.','I dag läser jag en bok.','личный глагол на второй позиции в главном предложении'],['Jag läser inte.','Jag vill inte läsa.','inte после личного глагола в главном предложении'],['… eftersom jag inte har tid','… eftersom jag är sjuk','в придаточном inte обычно перед личным глаголом']]},
{ico:'❓',title:['Вопросы','Questions','Frågor','Запитання'],rows:[['Var bor du?','Jag bor i Malmö.','где?'],['När börjar du?','Jag börjar klockan åtta.','когда?'],['Kan du komma?','Ja, det kan jag.','да/нет: глагол в начале']]},
{ico:'👥',title:['Местоимения','Pronouns','Pronomen','Займенники'],rows:[['jag · mig · min/mitt/mina','du · dig · din/ditt/dina','подлежащее / дополнение / принадлежность'],['han · honom · hans','hon · henne · hennes','различаем формы'],['de · dem · deras','vi · oss · vår/vårt/våra','письменные формы de/dem']]}
];
function renderCheats(){return title('🧠 '+pT('cheats'),pT('cheatIntro'))+`<div class="cheat-grid">${CHEAT_SECTIONS.map(section=>`<section class="cheat-card"><span class="cheat-emoji">${section.ico}</span><h2>${esc(section.title[{ru:0,en:1,sv:2,uk:3}[locale4()]||0])}</h2><div class="cheat-scroll"><table><tbody>${section.rows.map(([a,b,c])=>`<tr><th>${esc(a)}</th><td lang="sv">${esc(b)}</td>${locale4()==='ru'?`<td>${esc(c)}</td>`:''}</tr>`).join('')}</tbody></table></div></section>`).join('')}</div><section class="content-panel"><h2>${esc(pT('source'))}</h2><p>${esc(txt4('Правила — учебные схемы, а не исчерпывающее описание исключений. Если у конкретного слова есть особая форма, проверяй её в словаре Svenska Akademien.','These are learning summaries, not exhaustive rules. Check irregular forms in Svenska Akademien’s dictionaries.','Det här är förenklade översikter. Kontrollera undantag i Svenska Akademiens ordböcker.','Це навчальні схеми, а не всі винятки. Звіряй форми у словниках Svenska Akademien.'))}</p><div class="source-links"><a href="https://svenska.se/" target="_blank" rel="noopener noreferrer">Svenska Akademiens ordböcker ↗</a><a href="https://www.skolverket.se/undervisning/komvux/komvux-i-svenska-for-invandrare-sfi" target="_blank" rel="noopener noreferrer">Skolverket · SFI ↗</a><a href="https://www.isof.se/" target="_blank" rel="noopener noreferrer">Språkrådet / Isof ↗</a></div></section>`}
// Verified episode questions. Source locators use PDF page numbers (one-based).
const VIDEO_QUIZ_BANK={
 "ur-hitta1": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "Vilka två personer följer berättelsen?",
    "answer": "Martina och Jamal",
    "wrong": [
     "Anna och Erik",
     "Lina och Per",
     "Lisa och Ali"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220618-3_Dialogmanus_HH_avsnitt_1.pdf",
    "locator": "2, 5"
   },
   {
    "id": "q1",
    "question": "Från vilken stad kommer Martina?",
    "answer": "Barcelona",
    "wrong": [
     "Madrid",
     "Paris",
     "Rom"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220618-3_Dialogmanus_HH_avsnitt_1.pdf",
    "locator": 2
   },
   {
    "id": "q2",
    "question": "Vad heter läraren på sfi?",
    "answer": "Ylva",
    "wrong": [
     "Fatou",
     "Camilla",
     "Martina"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220618-3_Dialogmanus_HH_avsnitt_1.pdf",
    "locator": 3
   },
   {
    "id": "q3",
    "question": "Varför säger Martina att hon är sen?",
    "answer": "Hon missade bussen.",
    "wrong": [
     "Hon var hos läkaren.",
     "Hon sov hela dagen.",
     "Hon tappade sina nycklar."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220618-3_Dialogmanus_HH_avsnitt_1.pdf",
    "locator": 5
   },
   {
    "id": "q4",
    "question": "Vilken utbildning har Jamal?",
    "answer": "Ingenjör",
    "wrong": [
     "Läkare",
     "Lärare",
     "Kock"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220618-3_Dialogmanus_HH_avsnitt_1.pdf",
    "locator": 5
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "ur-hitta2": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "Var arbetar Jamal?",
    "answer": "På ett äldreboende",
    "wrong": [
     "På en bank",
     "I en affär",
     "På en skola"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220619-3_Dialogmanus_HH_avsnitt_2.pdf",
    "locator": 4
   },
   {
    "id": "q1",
    "question": "Vem ringer Jamal när han inte hittar till jobbet?",
    "answer": "Ylva",
    "wrong": [
     "Martina",
     "Elsa",
     "Rune"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220619-3_Dialogmanus_HH_avsnitt_2.pdf",
    "locator": 2
   },
   {
    "id": "q2",
    "question": "Varför behöver Jamal hjälp i telefonsamtalet?",
    "answer": "Han hittar inte till rätt adress.",
    "wrong": [
     "Han vill köpa mat.",
     "Han vill byta telefon.",
     "Han vill boka en resa."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220619-3_Dialogmanus_HH_avsnitt_2.pdf",
    "locator": 2
   },
   {
    "id": "q3",
    "question": "Vad ska Jamal få innan föreståndaren visar honom runt?",
    "answer": "Arbetskläder",
    "wrong": [
     "En cykel",
     "En dator",
     "En bussbiljett"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220619-3_Dialogmanus_HH_avsnitt_2.pdf",
    "locator": 4
   },
   {
    "id": "q4",
    "question": "Vilka får dela ut medicin på äldreboendet?",
    "answer": "Utbildad personal",
    "wrong": [
     "Alla besökare",
     "Alla som vill",
     "Bara de boende"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220619-3_Dialogmanus_HH_avsnitt_2.pdf",
    "locator": 6
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "ur-hitta3": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "Vem får besök hemma?",
    "answer": "Martina",
    "wrong": [
     "Sara",
     "Ylva",
     "Anna"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220759-2_Dialogmanus_HH_avsnitt_16.pdf",
    "locator": 2
   },
   {
    "id": "q1",
    "question": "I vilken del av staden bor Martina?",
    "answer": "Gamla stan",
    "wrong": [
     "Södermalm",
     "Enskede",
     "Kista"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220759-2_Dialogmanus_HH_avsnitt_16.pdf",
    "locator": 3
   },
   {
    "id": "q2",
    "question": "Vad väljer Jamal att dricka?",
    "answer": "Juice",
    "wrong": [
     "Kaffe",
     "Te",
     "Mjölk"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220759-2_Dialogmanus_HH_avsnitt_16.pdf",
    "locator": 3
   },
   {
    "id": "q3",
    "question": "Vad arbetar Martina som?",
    "answer": "Webbdesigner",
    "wrong": [
     "Sjuksköterska",
     "Taxiförare",
     "Rektor"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220759-2_Dialogmanus_HH_avsnitt_16.pdf",
    "locator": 5
   },
   {
    "id": "q4",
    "question": "Varifrån kommer pengarna som Martina har ärvt?",
    "answer": "Från hennes mamma.",
    "wrong": [
     "Från Jamals pappa.",
     "Från hennes lärare.",
     "Från hennes granne."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220759-2_Dialogmanus_HH_avsnitt_16.pdf",
    "locator": 5
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "ur-hitta4": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "I vilket land utspelar sig berättelsen?",
    "answer": "Sverige",
    "wrong": [
     "Norge",
     "Finland",
     "Danmark"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/224000-224999/224824-2_Manus_Hitt%20hem_ep1_s2.pdf",
    "locator": 5
   },
   {
    "id": "q1",
    "question": "Vad heter Martina och Jamals barn?",
    "answer": "Axel",
    "wrong": [
     "Konrad",
     "Hassan",
     "Magnus"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/224000-224999/224824-2_Manus_Hitt%20hem_ep1_s2.pdf",
    "locator": 3
   },
   {
    "id": "q2",
    "question": "Vad heter Martinas pappa?",
    "answer": "Konrad",
    "wrong": [
     "Göran",
     "Jamal",
     "Hassan"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/224000-224999/224824-2_Manus_Hitt%20hem_ep1_s2.pdf",
    "locator": 3
   },
   {
    "id": "q3",
    "question": "Varför kom Martina från början till Sverige?",
    "answer": "För att hitta sin pappa.",
    "wrong": [
     "För att köpa ett hus.",
     "För att öppna en restaurang.",
     "För att spela fotboll."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/224000-224999/224824-2_Manus_Hitt%20hem_ep1_s2.pdf",
    "locator": 3
   },
   {
    "id": "q4",
    "question": "Varför behöver Martina någon som tar hand om Axel nästa eftermiddag?",
    "answer": "Hon har ett möte med en webbyrå.",
    "wrong": [
     "Hon ska på semester.",
     "Hon ska flytta.",
     "Hon ska springa ett lopp."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/224000-224999/224824-2_Manus_Hitt%20hem_ep1_s2.pdf",
    "locator": 4
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "ur-hitta5": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "Vad hittar Martina?",
    "answer": "En gammal artikel",
    "wrong": [
     "En ny cykel",
     "En katt",
     "En dator"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220677-2_Dialogmanus_HH_avsnitt_8.pdf",
    "locator": 3
   },
   {
    "id": "q1",
    "question": "Vad heter rektorn som Martina kontaktar?",
    "answer": "Göran Hedlund",
    "wrong": [
     "Konrad Svensson",
     "Magnus Nilsson",
     "Jamal Miró"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220677-2_Dialogmanus_HH_avsnitt_8.pdf",
    "locator": 2
   },
   {
    "id": "q2",
    "question": "Vilken skola kontaktar Martina?",
    "answer": "Enskede gårds gymnasium",
    "wrong": [
     "Tekniska högskolan",
     "Stockholms universitet",
     "Bokstavsskolan"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220677-2_Dialogmanus_HH_avsnitt_8.pdf",
    "locator": 2
   },
   {
    "id": "q3",
    "question": "Vilken idrott var Konrad bra på i skolan?",
    "answer": "Löpning",
    "wrong": [
     "Simning",
     "Ishockey",
     "Tennis"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220677-2_Dialogmanus_HH_avsnitt_8.pdf",
    "locator": 4
   },
   {
    "id": "q4",
    "question": "Vilken uppgift om Konrad saknar Martina när hon ringer skolan?",
    "answer": "Hans personnummer",
    "wrong": [
     "Hans förnamn",
     "Hans efternamn",
     "Namnet på hans gamla skola"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220677-2_Dialogmanus_HH_avsnitt_8.pdf",
    "locator": 3
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "ur-hitta6": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "Vems förflutna diskuteras?",
    "answer": "Konrad",
    "wrong": [
     "Jamal",
     "Martina",
     "Ylva"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220679-2_Dialogmanus_HH_avsnitt_10.pdf",
    "locator": 2
   },
   {
    "id": "q1",
    "question": "Vad heter kvinnan som Martina ringer om sin pappa?",
    "answer": "Camilla",
    "wrong": [
     "Ylva",
     "Fatou",
     "Nadima"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220679-2_Dialogmanus_HH_avsnitt_10.pdf",
    "locator": 2
   },
   {
    "id": "q2",
    "question": "Vem pratar Jamal med om sin familj?",
    "answer": "Sin mamma",
    "wrong": [
     "Sin chef",
     "Sin granne",
     "Sin läkare"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220679-2_Dialogmanus_HH_avsnitt_10.pdf",
    "locator": 2
   },
   {
    "id": "q3",
    "question": "Vad tror Jamals mamma att Jamal och Ylva ska göra?",
    "answer": "Gifta sig",
    "wrong": [
     "Byta jobb",
     "Sälja en bil",
     "Flytta till Norge"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220679-2_Dialogmanus_HH_avsnitt_10.pdf",
    "locator": 4
   },
   {
    "id": "q4",
    "question": "Vad berättar Camilla om pengarna som Konrad lånade?",
    "answer": "Han betalade inte tillbaka dem.",
    "wrong": [
     "Han betalade tillbaka direkt.",
     "Han gav dem till Martina.",
     "Han satte in dem på hennes konto."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220679-2_Dialogmanus_HH_avsnitt_10.pdf",
    "locator": 6
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "ur-hitta7": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "Vem får Martina ny information om?",
    "answer": "Sin pappa",
    "wrong": [
     "Sin lärare",
     "Sin granne",
     "Sin chef"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220756-2_Dialogmanus_HH_avsnitt_13.pdf",
    "locator": 2
   },
   {
    "id": "q1",
    "question": "Vilket efternamn har Konrad på Facebook?",
    "answer": "Rosén",
    "wrong": [
     "Hedlund",
     "Miró",
     "Nilsson"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220756-2_Dialogmanus_HH_avsnitt_13.pdf",
    "locator": 2
   },
   {
    "id": "q2",
    "question": "Vem berättar till slut för Martina var hennes pappa är?",
    "answer": "Göran",
    "wrong": [
     "Camilla",
     "Ylva",
     "Fatou"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220756-2_Dialogmanus_HH_avsnitt_13.pdf",
    "locator": 2
   },
   {
    "id": "q3",
    "question": "Vad arbetar Jamal med när Martina möter honom ute?",
    "answer": "Han kör taxi.",
    "wrong": [
     "Han säljer blommor.",
     "Han undervisar.",
     "Han delar ut post."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220756-2_Dialogmanus_HH_avsnitt_13.pdf",
    "locator": 3
   },
   {
    "id": "q4",
    "question": "När säger Jamal att han började köra taxi?",
    "answer": "I går",
    "wrong": [
     "För ett år sedan",
     "Samma morgon",
     "För tio år sedan"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220756-2_Dialogmanus_HH_avsnitt_13.pdf",
    "locator": 5
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "ur-hitta8": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "Vem hittar något på KTH:s webbplats?",
    "answer": "Jamal",
    "wrong": [
     "Ylva",
     "Konrad",
     "Sara"
    ],
    "source": "https://urplay.se/program/217859-hitta-hem-avstangd",
    "locator": "Om programmet"
   },
   {
    "id": "q1",
    "question": "Vilken utbildning frågar Jamal om?",
    "answer": "Kompletterande utbildning för ingenjörer",
    "wrong": [
     "Utbildning för kockar",
     "Utbildning för taxiförare",
     "Utbildning för lärare"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220762-2_Dialogmanus_HH_avsnitt_17.pdf",
    "locator": 2
   },
   {
    "id": "q2",
    "question": "Varför vill rektorn prata med Ylva?",
    "answer": "Han har fått klagomål på henne.",
    "wrong": [
     "Han vill ge henne semester.",
     "Han vill köpa hennes bil.",
     "Han har hittat hennes nycklar."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220762-2_Dialogmanus_HH_avsnitt_17.pdf",
    "locator": 3
   },
   {
    "id": "q3",
    "question": "Vad beslutar rektorn om Ylvas undervisning?",
    "answer": "Hon får inte undervisa medan saken utreds.",
    "wrong": [
     "Hon ska undervisa fler klasser.",
     "Hon ska bli rektor direkt.",
     "Hon ska börja undervisa på KTH."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220762-2_Dialogmanus_HH_avsnitt_17.pdf",
    "locator": 6
   },
   {
    "id": "q4",
    "question": "Hur förklarar Ylva det som såg ut som en kärleksrelation?",
    "answer": "De skulle lura Jamals föräldrar.",
    "wrong": [
     "De skulle gifta sig nästa dag.",
     "De hade aldrig träffats.",
     "De arbetade på samma bank."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220762-2_Dialogmanus_HH_avsnitt_17.pdf",
    "locator": 5
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "ur-hitta9": {
  "sourceType": "script",
  "questions": [
   {
    "id": "q0",
    "question": "Vilka två vänner handlar serien om?",
    "answer": "Martina och Jamal",
    "wrong": [
     "Lars och Anna",
     "Britta och Elsa",
     "Erik och Eva"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220772-2_Dialogmanus_HH_avsnitt_20.pdf",
    "locator": 2
   },
   {
    "id": "q1",
    "question": "Varför tackar Ylva eleverna?",
    "answer": "De hjälpte henne att få tillbaka jobbet.",
    "wrong": [
     "De köpte en bil åt henne.",
     "De betalade hennes hyra.",
     "De byggde en skola."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220772-2_Dialogmanus_HH_avsnitt_20.pdf",
    "locator": 2
   },
   {
    "id": "q2",
    "question": "Vad behöver Fatou göra efter sfi?",
    "answer": "Hitta ett jobb",
    "wrong": [
     "Byta namn",
     "Köpa ett hotell",
     "Sälja sin lägenhet"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220772-2_Dialogmanus_HH_avsnitt_20.pdf",
    "locator": 3
   },
   {
    "id": "q3",
    "question": "Vilka elever får en applåd för att de är klara med sfi?",
    "answer": "Fatou, Martina och Mohammed",
    "wrong": [
     "Ylva, Konrad och Göran",
     "Jamal, Camilla och Nadima",
     "Magnus, Axel och Hassan"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220772-2_Dialogmanus_HH_avsnitt_20.pdf",
    "locator": 2
   },
   {
    "id": "q4",
    "question": "Vad säger Jamal att han berättade för rektorn om Ylva?",
    "answer": "Hon är den bästa lärare han har haft.",
    "wrong": [
     "Hon vill sluta arbeta.",
     "Hon behöver mer semester.",
     "Hon vill sälja skolan."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220772-2_Dialogmanus_HH_avsnitt_20.pdf",
    "locator": 4
   }
  ],
  "fullQuiz": true,
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31"
 },
 "v1": {
  "sourceType": "script",
  "fullQuiz": true,
  "programUrl": "https://urplay.se/program/217858-hitta-hem-den-forsta-lognen",
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31",
  "replaces": "Frukosten",
  "legacyQuestions": {
   "q0": {
    "answer": "Chokladkräm"
   }
  },
  "questions": [
   {
    "id": "r014q0",
    "question": "Vilken myndighet ringer Martina?",
    "answer": "Skatteverket",
    "wrong": [
     "Polisen",
     "Arbetsförmedlingen",
     "Försäkringskassan"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220620-3_Dialogmanus_HH_avsnitt_3.pdf",
    "locator": 4
   },
   {
    "id": "r014q1",
    "question": "Vad heter personen som Martina letar efter?",
    "answer": "Konrad",
    "wrong": [
     "Karzan",
     "Magnus",
     "Jamal"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220620-3_Dialogmanus_HH_avsnitt_3.pdf",
    "locator": 6
   },
   {
    "id": "r014q2",
    "question": "När brukar Jamal prata med sina föräldrar?",
    "answer": "På måndagar klockan tre",
    "wrong": [
     "På fredagar klockan åtta",
     "Varje morgon",
     "På söndagar klockan tolv"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220620-3_Dialogmanus_HH_avsnitt_3.pdf",
    "locator": 2
   },
   {
    "id": "r014q3",
    "question": "Hur mycket betalar Jamal för kläderna tillsammans?",
    "answer": "150 kronor",
    "wrong": [
     "50 kronor",
     "100 kronor",
     "500 kronor"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220620-3_Dialogmanus_HH_avsnitt_3.pdf",
    "locator": 7
   },
   {
    "id": "r014q4",
    "question": "Vad frågar Jamals pappa om?",
    "answer": "Om Jamal har hittat en fru",
    "wrong": [
     "Om Jamal har köpt en bil",
     "Om Martina har ringt",
     "Om Jamal har klarat provet"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220620-3_Dialogmanus_HH_avsnitt_3.pdf",
    "locator": 10
   }
  ]
 },
 "v2": {
  "sourceType": "script",
  "fullQuiz": true,
  "programUrl": "https://urplay.se/program/217842-hitta-hem-ett-djarvt-forslag",
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31",
  "replaces": "Sfi",
  "legacyQuestions": {
   "q0": {
    "answer": "Leen"
   }
  },
  "questions": [
   {
    "id": "r014q0",
    "question": "Varför var Martina inte i skolan?",
    "answer": "Hon sov.",
    "wrong": [
     "Hon arbetade.",
     "Hon reste bort.",
     "Hon var hos läkaren."
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220621-2_Dialogmanus_HH_avsnitt_4.pdf",
    "locator": 5
   },
   {
    "id": "r014q1",
    "question": "Vad gör Martina vid datorn på nätterna?",
    "answer": "Letar efter sin pappa",
    "wrong": [
     "Skriver en bok",
     "Spelar spel",
     "Söker jobb åt Jamal"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220621-2_Dialogmanus_HH_avsnitt_4.pdf",
    "locator": 2
   },
   {
    "id": "r014q2",
    "question": "Vad lovar Jamal Martina att sluta med?",
    "answer": "Att ljuga för sina föräldrar",
    "wrong": [
     "Att gå till skolan",
     "Att ringa Ylva",
     "Att arbeta"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220621-2_Dialogmanus_HH_avsnitt_4.pdf",
    "locator": 6
   },
   {
    "id": "r014q3",
    "question": "Vem ringer Jamal i slutet av avsnittet?",
    "answer": "Ylva",
    "wrong": [
     "Konrad",
     "Martina",
     "Sin chef"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220621-2_Dialogmanus_HH_avsnitt_4.pdf",
    "locator": 10
   },
   {
    "id": "r014q4",
    "question": "Vad ber Jamal Ylva om?",
    "answer": "Att bli hans flickvän",
    "wrong": [
     "Att hitta hans pappa",
     "Att låna honom en bil",
     "Att ge honom ett jobb"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220621-2_Dialogmanus_HH_avsnitt_4.pdf",
    "locator": 10
   }
  ]
 },
 "v4": {
  "sourceType": "script",
  "fullQuiz": true,
  "programUrl": "https://urplay.se/program/217854-hitta-hem-martinas-hemlighet",
  "verifiedOn": "2026-10-19",
  "availableUntil": "2026-12-31",
  "replaces": "Partikelverb",
  "legacyQuestions": {
   "q0": {
    "answer": "Liam"
   }
  },
  "questions": [
   {
    "id": "r014q0",
    "question": "Vem berättade för Martina att hon har en svensk pappa?",
    "answer": "Hennes mamma",
    "wrong": [
     "Jamal",
     "Ylva",
     "Hennes lärare"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220622-2_Dialogmanus_HH_avsnitt_5.pdf",
    "locator": 2
   },
   {
    "id": "r014q1",
    "question": "Vilken stad kommer Martinas pappa från?",
    "answer": "Stockholm",
    "wrong": [
     "Göteborg",
     "Malmö",
     "Uppsala"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220622-2_Dialogmanus_HH_avsnitt_5.pdf",
    "locator": 4
   },
   {
    "id": "r014q2",
    "question": "Var träffades Martinas föräldrar?",
    "answer": "I Barcelona",
    "wrong": [
     "I Stockholm",
     "I Paris",
     "I Oslo"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220622-2_Dialogmanus_HH_avsnitt_5.pdf",
    "locator": 4
   },
   {
    "id": "r014q3",
    "question": "Hur länge träffades Martinas föräldrar?",
    "answer": "En vecka",
    "wrong": [
     "Ett år",
     "En månad",
     "Tio år"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220622-2_Dialogmanus_HH_avsnitt_5.pdf",
    "locator": 4
   },
   {
    "id": "r014q4",
    "question": "Vilket plagg lånar Jamal ut till Ylva?",
    "answer": "Sin träningsjacka",
    "wrong": [
     "Sin vinterkappa",
     "Sin mössa",
     "Sina handskar"
    ],
    "source": "https://www.ur.se/mb/pdf/Programmanus/220000-220999/220622-2_Dialogmanus_HH_avsnitt_5.pdf",
    "locator": 7
   }
  ]
 }
};

const MORE_VIDEOS=[
{id:'ur-alpha',name:'Livet i Bokstavslandet',level:'A–B',duration:'Alfabetet',emoji:'🔤',description:'Letters, easy words and pronunciation.',url:'https://urplay.se/serie/178136-livet-i-bokstavslandet'},
{id:'ur-hitta1',name:'Hitta hem — Hur allt börjar',level:'B–C',duration:'6 min',emoji:'🏡',description:'Meet Martina and Jamal at the start of the story.',url:'https://urplay.se/program/217838-hitta-hem-hur-allt-borjar',answer:'Martina och Jamal',question:'Vilka två personer följer berättelsen?',wrong:['Anna och Erik','Lina och Per','Lisa och Ali']},
{id:'ur-hitta2',name:'Hitta hem — Jamal på äldreboende',level:'B–C',duration:'5 min',emoji:'🏥',description:'Jamal starts work at a care home.',url:'https://urplay.se/program/217845-hitta-hem-jamal-pa-aldreboende',answer:'På ett äldreboende',question:'Var arbetar Jamal?',wrong:['På en bank','I en affär','På en skola']},
{id:'ur-hitta3',name:'Hitta hem — Hemma hos Martina',level:'B–C',duration:'7 min',emoji:'🛋️',description:'Jamal visits Martina at home.',url:'https://urplay.se/program/217837-hitta-hem-hemma-hos-martina',answer:'Martina',question:'Vem får besök hemma?',wrong:['Sara','Ylva','Anna']},
{id:'ur-hitta4',name:'Hitta hem — Familjen',level:'B–D',duration:'9 min',emoji:'👨‍👩‍👧',description:'Martina and Jamal reflect on their lives in Sweden.',url:'https://urplay.se/program/223108-hitta-hem-familjen',answer:'Sverige',question:'I vilket land utspelar sig berättelsen?',wrong:['Norge','Finland','Danmark']},
{id:'ur-hitta5',name:'Hitta hem — Nya ledtrådar',level:'C–D',duration:'6 min',emoji:'🔎',description:'Martina finds an old article and follows new clues.',url:'https://urplay.se/program/217844-hitta-hem-nya-ledtradar',answer:'En gammal artikel',question:'Vad hittar Martina?',wrong:['En ny cykel','En katt','En dator']},
{id:'ur-hitta6',name:'Hitta hem — Flickvännen',level:'C–D',duration:'6 min',emoji:'💌',description:'A former girlfriend reveals news about Konrad.',url:'https://urplay.se/program/217850-hitta-hem-flickvannen',answer:'Konrad',question:'Vems förflutna diskuteras?',wrong:['Jamal','Martina','Ylva']},
{id:'ur-hitta7',name:'Hitta hem — Sommarstugan',level:'C–D',duration:'9 min',emoji:'🌲',description:'Martina learns something new about her father.',url:'https://urplay.se/program/217840-hitta-hem-sommarstugan',answer:'Sin pappa',question:'Vem får Martina ny information om?',wrong:['Sin lärare','Sin granne','Sin chef']},
{id:'ur-hitta8',name:'Hitta hem — Avstängd',level:'C–D',duration:'7 min',emoji:'📚',description:'New clues and difficult news for the characters.',url:'https://urplay.se/program/217859-hitta-hem-avstangd',answer:'Jamal',question:'Vem hittar något på KTH:s webbplats?',wrong:['Ylva','Konrad','Sara']},
{id:'ur-hitta9',name:'Hitta hem — Slutet gott?',level:'C–D',duration:'8 min',emoji:'🏁',description:'The story reaches its conclusion.',url:'https://urplay.se/program/217834-hitta-hem-slutet-gott',answer:'Martina och Jamal',question:'Vilka två vänner handlar serien om?',wrong:['Lars och Anna','Britta och Elsa','Erik och Eva']},
{id:'ur-sfi',name:'UR Play — Svenska för invandrare',level:'A–D',duration:'Olika',emoji:'🎓',description:'More SFI videos and educational collections.',url:'https://urplay.se/amne/sfi-svenska-for-invandrare'},
{id:'ur-sva',name:'UR Play — Svenska som andraspråk',level:'A–D',duration:'Olika',emoji:'🎧',description:'Swedish as a second language video collection.',url:'https://urplay.se/amne/svenska-som-andrasprak'},
{id:'v1',"name":"Hitta hem — Den första lögnen","level":"B–C","duration":"7 min","emoji":"🎬","description":"Den första lögnen","url":"https://urplay.se/program/217858-hitta-hem-den-forsta-lognen","question":"Vilken myndighet ringer Martina?","answer":"Skatteverket","wrong":["Polisen","Arbetsförmedlingen","Försäkringskassan"],"requiresVideoBank":true,"previousTitle":"Frukosten"},
{id:'v2',"name":"Hitta hem — Ett djärvt förslag","level":"B–C","duration":"6 min","emoji":"🎬","description":"Ett djärvt förslag","url":"https://urplay.se/program/217842-hitta-hem-ett-djarvt-forslag","question":"Varför var Martina inte i skolan?","answer":"Hon sov.","wrong":["Hon arbetade.","Hon reste bort.","Hon var hos läkaren."],"requiresVideoBank":true,"previousTitle":"Sfi"},
{id:'v4',"name":"Hitta hem — Martinas hemlighet","level":"B–C","duration":"6 min","emoji":"🎬","description":"Martinas hemlighet","url":"https://urplay.se/program/217854-hitta-hem-martinas-hemlighet","question":"Vem berättade för Martina att hon har en svensk pappa?","answer":"Hennes mamma","wrong":["Jamal","Ylva","Hennes lärare"],"requiresVideoBank":true,"previousTitle":"Partikelverb"}];
for(const v of MORE_VIDEOS)if(VIDEO_QUIZ_BANK[v.id]){v.questions=VIDEO_QUIZ_BANK[v.id].questions;v.requiresVideoBank=true;v.availableUntil??=VIDEO_QUIZ_BANK[v.id].availableUntil||'2026-12-31';v.disabled??=false}

// A range includes intermediate levels; broad collections are not recommendations.
const videoLevelMatch=v=>!!v.question&&(()=>{const levels=v.level.match(/[ABCD]/g)||[],level=state.settings.level;return levels.length===2?level>=levels[0]&&level<=levels[1]:levels.includes(level)})();
const videoSubmissions=new Set();
function videoText(key){const labels={
 watch:['Смотреть видео','Watch video','Titta på video','Дивитися відео'],
 quiz:['Пройти квиз','Take quiz','Gör quiz','Пройти квіз'],
 notWatched:['Не просмотрено','Not watched','Inte sedd','Не переглянуто'],
 notPassed:['Не пройдено','Not passed','Inte godkänd','Не пройдено'],
 passed:['Пройдено','Passed','Godkänd','Пройдено'],
 undo:['Отменить просмотр','Undo watched','Markera som osedd','Скасувати перегляд'],
 pending:['Ожидает сохранения','Waiting to save','Väntar på att sparas','Очікує збереження'],
 server:['Сохранено в аккаунте','Saved to account','Sparat på kontot','Збережено в акаунті'],
 local:['Только на этом устройстве','On this device only','Bara på den här enheten','Лише на цьому пристрої'],
 quizUnavailable:['Новый квиз ждёт обновления сервера','This quiz awaits a server update','Det här quizet väntar på serveruppdatering','Новий квіз очікує оновлення сервера'],
 unavailable:['Сохранение просмотра ждёт обновления сервера','Watch tracking awaits a server update','Visningsstatus väntar på serveruppdatering','Збереження перегляду очікує оновлення сервера'],
 expired:['Видео недоступно. Сохранённые результаты и XP остаются.','Video unavailable. Saved results and XP are retained.','Videon är inte tillgänglig. Sparade resultat och XP finns kvar.','Відео недоступне. Збережені результати та XP залишаються.'],
 loading:['Загрузка прогресса…','Loading progress…','Laddar framsteg…','Завантаження прогресу…'],
 collection:['Подборка: выбери конкретный выпуск для подготовки квиза.','Collection: choose an episode to prepare a quiz.','Samling: välj ett avsnitt för att förbereda ett quiz.','Добірка: обери конкретний випуск для підготовки квізу.'],
 synopsis:['Квиз по материалам UR · успех от 80%','UR source quiz · pass at 80%','Quiz utifrån UR:s material · godkänt från 80 %','Квіз за матеріалами UR · успіх від 80%'],
 conflict:['Просмотр изменён на другом устройстве. Загрузите актуальное состояние и повторите выбор.','Watch status changed on another device. Load the current state and choose again.','Visningsstatus ändrades på en annan enhet. Läs in aktuell status och välj igen.','Перегляд змінено на іншому пристрої. Завантажте актуальний стан і повторіть вибір.'],
 accept:['Загрузить актуальные отметки','Load current watch status','Läs in aktuell visningsstatus','Завантажити актуальні позначки']};return txt4(...labels[key])}
// Inclusive licensed date in Stockholm, independent of the device timezone or DST.
const VIDEO_LOCAL_DATE=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Stockholm',year:'numeric',month:'2-digit',day:'2-digit'});
function videoContentAvailable(v,now=Date.now()){return !v.disabled&&(!v.availableUntil||VIDEO_LOCAL_DATE.format(new Date(now))<=v.availableUntil)}
function videoQuizAvailable(v){return videoContentAvailable(v)&&(!user||!v.requiresVideoBank||window.SVProgress?.supports('video_quizzes_v3'))}
function videoQuizNote(v){
 if(!videoContentAvailable(v))return videoText('expired');
 if(!videoQuizAvailable(v))return videoText('quizUnavailable');
 const n=v.questions.length;
 const count=txt4(n+' вопросов',n+' questions',n+' frågor',n+' запитань');
 return count+' · '+(VIDEO_QUIZ_BANK[v.id].fullQuiz?videoText('synopsis'):txt4('Короткий квиз по описанию UR; содержание проверено частично.','Short UR synopsis quiz; content only partly verified.','Kort quiz om UR:s beskrivning; innehållet är bara delvis verifierat.','Короткий квіз за описом UR; зміст перевірено частково.'));
}
function videoPending(id){return videoSubmissions.has(ownerKey()+':'+id)||(window.SVProgress?.activity?.().pending||[]).some(e=>e.type==='video_set'&&e.contentId===id)}
function videoAvailability(){return !user||cloudAccount()&&window.SVProgress?.writeStatus?.().ready&&window.SVProgress?.supports('video_set_v1')}
function videoDescription(v){const descriptions={
 "v1":["Мартина ищет Конрада, Джамал разговаривает с родителями.", "Martina searches for Konrad; Jamal talks to his parents.", "Martina söker Konrad. Jamal pratar med sina föräldrar.", "Мартіна шукає Конрада, Джамал розмовляє з батьками."],
 "v2":["Мартина просыпает занятия. Джамал просит Ыльву о помощи.", "Martina oversleeps. Jamal asks Ylva for help.", "Martina försover sig. Jamal ber Ylva om hjälp.", "Мартіна просипає заняття. Джамал просить Ільву про допомогу."],
 "v4":["Мартина рассказывает об отце. Ыльва знакомится с родителями Джамала.", "Martina talks about her father. Ylva meets Jamal’s parents.", "Martina berättar om sin pappa. Ylva träffar Jamals föräldrar.", "Мартіна розповідає про батька. Ільва знайомиться з батьками Джамала."],
 'ur-alpha':['Буквы, простые слова и произношение. Серия для детей.','Letters, simple words and pronunciation. A children’s series.','Bokstäver, enkla ord och uttal. En barnserie.','Літери, прості слова й вимова. Дитяча серія.'],
 'ur-hitta1':['Знакомство с Мартиной и Джамалом.','Meet Martina and Jamal.','Lär känna Martina och Jamal.','Знайомство з Мартіною та Джамалом.'],
 'ur-hitta2':['Джамал начинает работу в доме престарелых.','Jamal starts work at a care home.','Jamal börjar arbeta på ett äldreboende.','Джамал починає роботу в будинку для літніх людей.'],
 'ur-hitta3':['Джамал приходит в гости к Мартине.','Jamal visits Martina at home.','Jamal besöker Martina hemma.','Джамал приходить у гості до Мартіни.'],
 'ur-hitta4':['Джамал смотрит в будущее, Мартина размышляет о жизни в Швеции.','Jamal looks ahead; Martina reflects on life in Sweden.','Jamal blickar framåt. Martina funderar över livet i Sverige.','Джамал думає про майбутнє, Мартіна — про життя у Швеції.'],
 'ur-hitta5':['Старая статья приводит Мартину к новым подсказкам.','An old article leads Martina to new clues.','En gammal artikel ger Martina nya ledtrådar.','Стара стаття дає Мартіні нові підказки.'],
 'ur-hitta6':['Бывшая девушка рассказывает о прошлом Конрада.','A former girlfriend talks about Konrad’s past.','En före detta flickvän berättar om Konrads förflutna.','Колишня дівчина розповідає про минуле Конрада.'],
 'ur-hitta7':['Мартина узнаёт новое об отце и отправляется в путь с Джамалом.','Martina learns about her father and travels with Jamal.','Martina får veta mer om sin pappa och reser med Jamal.','Мартіна дізнається про батька й вирушає в дорогу з Джамалом.'],
 'ur-hitta8':['Джамал находит кое-что на сайте KTH. Мартина ищет подсказки в суде.','Jamal finds something on KTH’s website. Martina looks for clues at court.','Jamal hittar något på KTH:s hemsida. Martina söker ledtrådar på tingsrätten.','Джамал знаходить дещо на сайті KTH. Мартіна шукає підказки в суді.'],
 'ur-hitta9':['Найдёт ли Мартина отца? Чем закончится история друзей?','Will Martina find her father? How will the friends’ story end?','Ska Martina hitta sin pappa? Hur slutar vännernas historia?','Чи знайде Мартіна батька? Чим завершиться історія друзів?'],
 'ur-sfi':['Подборка программ и учебных материалов SFI от UR.','UR’s collection of SFI programmes and learning materials.','UR:s samling av program och läromedel för sfi.','Добірка програм і навчальних матеріалів SFI від UR.'],
 'ur-sva':['Программы UR для изучающих шведский как второй язык.','UR programmes for learning Swedish as a second language.','UR-program för svenska som andraspråk.','Програми UR для вивчення шведської як другої мови.']};return txt4(...descriptions[v.id])}
function videoProgressMarkup(v){
 const pending=videoPending(v.id),watched=state.videos.includes(v.id),ready=accountDataReady(),passed=quizPassed('video:'+v.id),r=state.quizResults?.['video:'+v.id];
 const scope=pending?videoText('pending'):!user?videoText('local'):!ready?videoText('loading'):!videoAvailability()?videoText('unavailable'):videoText('server');
 return `<div class="video-status-row"><button type="button" class="video-watch-toggle" data-action="watched" data-id="${esc(v.id)}" aria-pressed="${watched}" aria-busy="${pending}" aria-disabled="${!videoAvailability()||pending}" aria-label="${esc(watched?videoText('undo'):t('markWatched'))} · ${esc(v.name)}"><span aria-hidden="true">${watched?'✓':'○'}</span> ${esc(!ready&&user?videoText('loading'):watched?t('watched'):videoText('notWatched'))}</button><small class="video-completion ${passed?'is-passed':''}" data-video-completion="${esc(v.id)}"><span aria-hidden="true">${passed?'✓':'○'}</span> ${esc(!ready&&user?videoText('loading'):passed?(v.previousTitle&&r?.total===1?txt4('Исторический квиз пройден','Historical quiz passed','Tidigare quiz godkänt','Історичний квіз пройдено'):videoText('passed')):videoText('notPassed'))}${r?.total?' · '+Math.floor(r.correct*100/r.total)+'%':''}</small></div><small class="video-save-scope" role="status">${esc(scope)}</small>`;
}
function refreshVideoUI(){
 if(route!=='videos')return;
 for(const button of document.querySelectorAll('[data-action="video-quiz"]')){const v=MORE_VIDEOS.find(v=>v.id===button.dataset.id);if(!v)continue;button.setAttribute('aria-disabled',String(!videoQuizAvailable(v)));const note=document.getElementById('video-quiz-note-'+v.id);if(note)note.textContent=videoQuizNote(v)}
 for(const el of document.querySelectorAll('[data-video-progress]')){
  const v=MORE_VIDEOS.find(v=>v.id===el.dataset.videoProgress);if(!v)continue;
  // Patch the button in place to preserve keyboard focus during server ACKs.
  const template=document.createElement('template');template.innerHTML=videoProgressMarkup(v);
  const button=el.querySelector('button'),next=template.content.querySelector('button');
  if(button&&next){button.innerHTML=next.innerHTML;for(const attr of ['aria-pressed','aria-busy','aria-disabled','aria-label'])button.setAttribute(attr,next.getAttribute(attr));}
  const status=el.querySelector('[data-video-completion]'),scope=el.querySelector('.video-save-scope');
  if(status)status.outerHTML=template.content.querySelector('[data-video-completion]').outerHTML;
  if(scope)scope.textContent=template.content.querySelector('.video-save-scope').textContent;
 }
}
async function toggleVideoWatched(id){
 if(!MORE_VIDEOS.some(v=>v.id===id)||videoPending(id))return;
 if(!videoAvailability()){toast(videoText('unavailable'));return}
 const key=ownerKey()+':'+id;videoSubmissions.add(key);refreshVideoUI();
 try{if(cloudAccount())await window.SVProgress.enqueue('video_set',id,!state.videos.includes(id));
 else mutate(()=>{state.videos=state.videos.includes(id)?state.videos.filter(x=>x!==id):[...state.videos,id]})}
 finally{videoSubmissions.delete(key);refreshVideoUI()}
}
function renderVideos(){
 const vids=MORE_VIDEOS.filter(v=>v.question).sort((a,b)=>Number(videoLevelMatch(b))-Number(videoLevelMatch(a)));
 const external='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M14 4h6v6m0-6L10 14m0-9H5v14h14v-5"/></svg>';
 return title(t('videos'),t('videosIntro'))+`<div class="notice">${esc(t('vidNote'))}</div><div class="video-grid">${vids.map(v=>{
 const program=v.url.match(/program\/(\d+)/)?.[1],preview=program?`https://assets.ur.se/id/${program}/images/1_xl.jpg`:v.id==='ur-alpha'?'https://assets.ur.se/id/178136/images/1_xl.jpg':'./assets/video-collection.svg';
 return `<article class="video-card video-card-unified" data-video-id="${esc(v.id)}"><div class="video-preview"><img data-video-preview src="${preview}" alt="" width="640" height="360" loading="lazy"><span class="video-provider">UR Play</span></div><div class="video-content"><div class="video-meta"><span class="chip">SFI ${esc(v.level)}</span>${videoLevelMatch(v)?`<span class="mini-recommended">${esc(pT('levelHint'))}</span>`:''}</div><h3 lang="sv">${esc(v.name)}</h3><p class="video-description">${esc(videoDescription(v))}</p>${v.previousTitle?`<small>${esc(txt4('История карточки: ','Card history: ','Kortets historik: ','Історія картки: ')+v.previousTitle)}</small>`:''}${videoContentAvailable(v)?`<a class="btn video-watch-link" data-video-watch="${esc(v.id)}" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(videoText('watch')+' · '+v.name+' · UR Play')}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg><span>${esc(videoText('watch'))}</span>${external}</a>`:`<p role="status">${esc(videoText('expired'))}</p>`}<div class="video-progress" data-video-progress="${esc(v.id)}">${videoProgressMarkup(v)}</div><button type="button" class="btn secondary video-quiz-button" data-action="video-quiz" data-id="${esc(v.id)}" aria-disabled="${!videoQuizAvailable(v)}" aria-describedby="video-quiz-note-${esc(v.id)}">${esc(videoText('quiz'))}</button><small class="video-quiz-note" id="video-quiz-note-${esc(v.id)}">${esc(videoQuizNote(v))}</small></div></article>`}).join('')}</div>`
}
// A tab left open across expiry must also refuse a new external launch.
document.addEventListener('click',event=>{const link=event.target?.closest?.('[data-video-watch]');if(!link)return;const v=MORE_VIDEOS.find(v=>v.id===link.dataset.videoWatch);if(v&&!videoContentAvailable(v)){event.preventDefault();toast(videoText('expired'));if(route==='videos')render()}},true);
function avatarMarkup(kind='small'){const avatar=state.profile?.avatar;const name=state.profile?.name||user?.name||t('guest');return avatar&&/^data:image\/(jpeg|png|webp);base64,/.test(avatar)?`<img class="user-image" src="${esc(avatar)}" alt="${esc(name)}">`:`<img class="user-image" src="./assets/avatars/pippi-cartoon.png" alt="Pippi Långstrump">`}
function renderNav(){const mk=([key,ico])=>`<button type="button" class="nav-link ${route===key||(route==='book'&&key==='books')||(route==='topic'&&key==='topics')?'active':''}" data-nav="${key}"><span class="nav-glyph">${ico}</span><span class="nav-text">${esc(t(key))}</span></button>`;$('#sidebar-nav').innerHTML=NAV4.slice(0,6).map(mk).join('');$('#sidebar-learn').innerHTML=NAV4.slice(6).map(mk).join('')+`<button class="nav-link ${route==='cheats'?'active':''}" data-nav="cheats"><span class="nav-glyph">🧾</span><span class="nav-text">${esc(pT('cheats'))}</span></button><button class="nav-link ${route==='numbers'?'active':''}" data-nav="numbers"><span class="nav-glyph">🔢</span><span class="nav-text">${esc(pT('numbers'))}</span></button>`;$('#mobile-nav').innerHTML=mainRoutes4.map(([key,ico])=>`<button type="button" class="${route===key?'active':''}" data-nav="${key}" aria-label="${esc(t(key))}"><span class="i">${ico}</span><span>${esc(t(key))}</span></button>`).join('')+`<button type="button" class="mobile-more" id="bottom-menu-open" aria-label="${esc(t('subsections'))}"><span class="i">☰</span><span>${esc(t('subsections'))}</span></button>`;const name=state.profile?.name||user?.name||t('guest');$('#sidebar-profile').innerHTML=`<span class="small-avatar">${avatarMarkup()}</span><span class="nav-account-name"><strong>${esc(name)}</strong><small>🏆 ${esc(t('accountRank'))} ${accountLevel3()}</small></span>`;$('#profile-top').innerHTML=avatarMarkup('top')}
function renderProfile(){const name=state.profile?.name||user?.name||t('guest'),xp=accountProgress3();return title(t('profileTitle'),user?'':authText('guest'))+`<div class="profile-identity"><section class="profile-person"><div class="big-avatar">${avatarMarkup('big')}</div><div class="identity-copy"><h2>${esc(name)}</h2><span class="chip">🇸🇪 SFI <span data-profile-level>${accountDataReady()?esc(state.settings.level):'…'}</span></span></div></section><section class="profile-level"><span class="rank-emoji">🏆</span><div><h2>${esc(t('accountRank'))} ${accountDataReady()?accountLevel3():'—'}</h2><p>${accountDataReady()?`${state.xp} XP · ${xp}/500`:'— XP'}</p></div><div class="progress-track"><div class="progress-fill" style="width:${xp/5}%"></div></div></section></div><section class="content-panel profile-collections"><button class="btn secondary" data-nav="reviews" data-review-count>${studioIcon('repeat','collection-icon collection-icon--repeat')}<span>${esc(t('reviews'))} · ${!user?0:manualQueue().ready?manualReviewIds().length:'…'}</span>${studioIcon('arrow','collection-arrow')}</button><button class="btn secondary" data-action="show-learned">${studioIcon('check','collection-icon collection-icon--learned')}<span>${esc(ux('learned'))} · ${state.known.length}</span>${studioIcon('arrow','collection-arrow')}</button><button class="btn secondary" data-action="show-favorites">${studioIcon('star','collection-icon collection-icon--favorite')}<span>${esc(t('favorites'))} · ${state.favorites.length}</span>${studioIcon('arrow','collection-arrow')}</button></section><section class="content-panel profile-edit"><h3>✏️ ${esc(pT('personal'))}</h3><div class="edit-inline"><label for="profile-name-edit">${esc(pT('nameEdit'))}</label><input id="profile-name-edit" type="text" class="form-input" maxlength="70" value="${esc(state.profile?.name||user?.name||'')}"><button class="btn small" data-action="save-profile-name">${esc(pT('saveName'))}</button></div><div class="avatar-actions"><label for="profile-photo-file" class="btn secondary small file-select"><span aria-hidden="true">📷</span><span>${esc(pT('uploadPhoto'))}</span><input id="profile-photo-file" type="file" accept="image/jpeg,image/png,image/webp" hidden></label>${state.profile?.avatar?`<button class="btn ghost small" data-action="remove-photo">${esc(pT('removePhoto'))}</button>`:''}</div></section><section class="stats-grid">${stat('🔥',streak(),t('dayStreak'),'orange')}${stat('🎓',state.completed.length,t('lessonCount'),'purple')}${stat('🧠',state.known.length,t('knownWords'),'mint')}${stat('★',state.favorites.length,t('favorites'),'orange')}${stat('📚',(state.booksRead||[]).length,t('booksRead'),'pink')}</section><div class="profile-grid"><section class="content-panel"><h3>🗓️ ${esc(t('practiceActivity'))}</h3>${heatmap()}</section><div class="profile-settings-column">${profileSettingsMarkup()}${user?`<section class="content-panel auth-teaser account-session"><div class="account-session-heading"><span class="account-session-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/></svg></span><div class="account-session-copy"><h3>${esc(t('profile'))}</h3><p>${esc(txt4('Продолжайте обучение на любом устройстве.','Continue learning on any device.','Fortsätt lära dig på valfri enhet.','Продовжуйте навчання на будь-якому пристрої.'))}</p></div></div><button class="btn ghost small account-signout" data-action="logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4H5v16h5m5-12 4 4-4 4M9 12h10"/></svg>${esc(t('logout'))}</button><button type="button" class="btn ghost small account-delete" data-action="delete-account">${esc(txt4('Удалить аккаунт','Delete account','Radera konto','Видалити акаунт'))}</button></section>`:`<section class="content-panel auth-teaser"><h3>🔐 ${esc(t('register'))}</h3><p>${esc(authText('guest'))}</p><div class="split"><button class="btn small" data-action="auth" data-mode="register">${esc(t('register'))}</button><button class="btn secondary small" data-action="auth" data-mode="login">${esc(t('login'))}</button></div></section>`}</div></div>`}



const SWEDISH_LETTER_NAMES={A:'a',B:'be',C:'se',D:'de',E:'e',F:'eff',G:'ge',H:'hå',I:'i',J:'ji',K:'kå',L:'ell',M:'emm',N:'enn',O:'o',P:'pe',Q:'ku',R:'err',S:'ess',T:'te',U:'u',V:'ve',W:'dubbelve',X:'eks',Y:'y',Z:'säta','Å':'å','Ä':'ä','Ö':'ö'};
let svVoices=[];
if('speechSynthesis' in window){svVoices=speechSynthesis.getVoices();speechSynthesis.addEventListener?.('voiceschanged',()=>{svVoices=speechSynthesis.getVoices()})}
function speak(text){if(!('speechSynthesis' in window)){toast(pT('audioError'));return}try{const api=speechSynthesis;api.cancel();const u=new SpeechSynthesisUtterance(String(text));u.lang='sv-SE';u.rate=.8;u.pitch=1;const voices=api.getVoices();const sv=voices.find(x=>x.lang.toLowerCase()==='sv-se')||voices.find(x=>x.lang.toLowerCase().startsWith('sv'));if(sv)u.voice=sv;else if(voices.length){toast(pT('audioError'));return}u.onerror=()=>toast(pT('audioError'));api.speak(u)}catch(_){toast(pT('audioError'))}}
function speakLetter3(letter){speak(SWEDISH_LETTER_NAMES[letter]||letter)}
function profilePhotoChange(file){if(cloudAccount()||!file)return;if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>6*1024*1024){toast(pT('avatarError'));return}const ownerState=state;const reader=new FileReader();reader.onload=()=>{if(state!==ownerState)return;const img=new Image();img.onload=()=>{if(state!==ownerState)return;const size=240,c=document.createElement('canvas');c.width=size;c.height=size;const ctx=c.getContext('2d');const crop=Math.min(img.width,img.height),x=(img.width-crop)/2,y=(img.height-crop)/2;ctx.drawImage(img,x,y,crop,crop,0,0,size,size);const val=c.toDataURL('image/jpeg',.78);mutate(()=>{state.profile=state.profile||{};state.profile.avatar=val});render();toast(pT('profileSave'))};img.onerror=()=>toast(pT('avatarError'));img.src=reader.result};reader.onerror=()=>toast(pT('avatarError'));reader.readAsDataURL(file)}
document.addEventListener('change',event=>{if(event.target?.id==='profile-photo-file')profilePhotoChange(event.target.files?.[0])});
document.addEventListener('click',event=>{const b=event.target?.closest?.('[data-action="save-profile-name"],[data-action="remove-photo"]');if(!b)return;event.preventDefault();event.stopImmediatePropagation();if(cloudAccount())return;if(b.dataset.action==='save-profile-name'){const value=String(document.getElementById('profile-name-edit')?.value||'').trim().slice(0,70);if(!value)return;mutate(()=>{state.profile=state.profile||{};state.profile.name=value})}else{mutate(()=>{state.profile=state.profile||{};state.profile.avatar=''})}render();toast(pT('profileSave'))},true);


// Start a source-verified episode quiz; persisted older sessions keep their snapshot.
document.addEventListener('click',e=>{const el=e.target?.closest?.('[data-action="video-quiz"]');if(!el)return;e.preventDefault();e.stopImmediatePropagation();const v=MORE_VIDEOS.find(x=>x.id===el.dataset.id);if(!v?.question){toast(videoText('collection'));return}startQuiz('video',v.id)},true);


// A consistent illustrated icon system. Original training icons remain unchanged.
const STUDIO_ICON_PATHS={
 check:'<path d="m6 14 5 5L22 8"/>',
 star:'<path d="m14 3 3.4 7 7.6 1.1-5.5 5.4 1.3 7.5-6.8-3.6L7.2 24l1.3-7.5L3 11.1l7.6-1.1L14 3Z"/>',
 arrow:'<path d="M5 14h18m-7-7 7 7-7 7"/>',
 book:'<path d="M4 5.5c3.8-1.8 6.8-1.3 10 1v13c-3.3-2.2-6.4-2.6-10-1V5.5Zm10 1c3.2-2.3 6.3-2.8 10-1v13c-3.6-1.6-6.7-1.2-10 1"/>',
 school:'<path d="m3 11 11-8 11 8v13H3V11Z"/><path d="M9 24v-9h10v9M5 11h18M13 3v7M14 19h.1"/>',
 shop:'<path d="M5 10h18l-2-7H7l-2 7Zm1 0v14h16V10M11 24v-9h7v9M4 10c1 3 4 3 5 0 1 3 4 3 5 0 1 3 4 3 5 0 1 3 4 3 5 0"/>',
 heart:'<path d="M14 24S3 17 3 9a6 6 0 0 1 11-3 6 6 0 0 1 11 3c0 8-11 15-11 15Z"/>',
 health:'<rect x="4" y="4" width="20" height="20" rx="6"/><path d="M14 8v12M8 14h12"/>',
 family:'<circle cx="8" cy="9" r="3"/><circle cx="20" cy="9" r="3"/><path d="M2 23v-3a6 6 0 0 1 12 0v3M14 23v-3a6 6 0 0 1 12 0v3"/><circle cx="14" cy="15" r="2"/>',
 home:'<path d="m3 13 11-9 11 9v11H3V13ZM10 24v-9h8v9"/>',
 clock:'<circle cx="14" cy="14" r="11"/><path d="M14 7v7l5 3"/>',
 train:'<rect x="5" y="4" width="18" height="18" rx="4"/><path d="M5 11h18M9 25l3-3m7 3-3-3M9 16h2m6 0h2"/>',
 clothes:'<path d="m10 4-3 2-5 7 5 4 3-4v12h12V13l3 4 4-4-5-7-3-2c-2 5-9 5-11 0Z"/>',
 work:'<rect x="3" y="10" width="22" height="15" rx="3"/><path d="M10 10V6h8v4M3 16h22M12 16h4"/>',
 weather:'<circle cx="10" cy="9" r="4"/><path d="M10 2v2M3 9H1m3-5 2 2m15 17H8a6 6 0 1 1 2-11 8 8 0 0 1 14 4 5 5 0 0 1-3 7Z"/>',
 nature:'<path d="m14 3 10 15H4L14 3Zm0 9 8 12H6l8-12ZM14 18v8"/>',
 food:'<path d="M6 3v10m4-10v10M6 8h4M8 13v12M20 3c-5 4-5 12 0 14v8"/>',
 person:'<circle cx="14" cy="8" r="5"/><path d="M4 25c0-7 4-11 10-11s10 4 10 11"/>',
 chat:'<path d="M5 6h18v14H11l-6 5V6Z"/><path d="M9 12h10M9 16h7"/>',
 animal:'<circle cx="9" cy="8" r="2"/><circle cx="19" cy="8" r="2"/><circle cx="5" cy="15" r="2"/><circle cx="23" cy="15" r="2"/><path d="M9 24c-2-2-1-7 5-7s7 5 5 7c-3 2-7 2-10 0Z"/>',
 calendar:'<rect x="4" y="5" width="20" height="20" rx="3"/><path d="M4 12h20M9 2v7M19 2v7M9 17h3m4 0h3m-10 4h3"/>',
 numbers:'<rect x="3" y="3" width="22" height="22" rx="5"/><path d="M9 19V9l-2 2m10-3c6 0 6 6 0 6s-6 5 0 5h4"/>',
 colors:'<circle cx="14" cy="14" r="11"/><circle cx="10" cy="8" r="1"/><circle cx="18" cy="8" r="1"/><circle cx="21" cy="15" r="1"/><circle cx="11" cy="21" r="1"/>',
 travel:'<path d="M4 25 25 4 18 25 14 15 4 11l21-7"/>',
 computer:'<rect x="3" y="4" width="22" height="17" rx="2"/><path d="M10 25h8M14 21v4"/>',
 question:'<path d="M10 10a5 5 0 1 1 8 4c-3 1-4 3-4 5M14 23h.01"/>',
 sport:'<circle cx="14" cy="14" r="11"/><path d="m14 3 4 7-4 5-6-4M3 14l8-3m8-1 6 4m-11 1 1 10m-4-3-7-3"/>',
 note:'<path d="M5 3h19v22H5V3ZM9 10h11M9 15h11M9 20h8"/>',
 grammar:'<path d="M5 5h18M8 5l-3 18M18 5l5 18M8 17h13"/>',
 search:'<circle cx="12" cy="12" r="8"/><path d="m18 18 8 8"/>',
 film:'<rect x="3" y="7" width="22" height="18" rx="3"/><path d="M3 13h22M8 7l4 6M17 7l4 6m-8 4 5 3-5 3Z"/>',
 card:'<rect x="3" y="5" width="22" height="18" rx="4"/><path d="M7 10h14M7 15h11"/>',
 repeat:'<path d="M6 10a9 9 0 0 1 15-4l3 3M24 3v6h-6M22 18a9 9 0 0 1-15 4l-3-3m0 6v-6h6"/>',
 mind:'<path d="M14 24V7a6 6 0 0 0-11 3c-3 3-2 8 2 9a5 5 0 0 0 9 5Zm0 0V7a6 6 0 0 1 11 3c3 3 2 8-2 9a5 5 0 0 1-9 5Z"/>',
 info:'<circle cx="14" cy="14" r="11"/><path d="M14 12v8m0-13h.01"/>'};
function studioIcon(name,cls=''){return `<svg class="studio-icon ${cls}" viewBox="0 0 28 28" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${STUDIO_ICON_PATHS[name]||STUDIO_ICON_PATHS.note}</svg>`;}
const STUDIO_TOPIC_ICON={
 'Дом':'home','Дом и комнаты':'home','Место':'travel','Местоимения':'person','Вопросы':'question','Учёба':'note','Школа и SFI':'school','Цвета':'colors','Цвета и формы':'colors','Время':'clock','Дни и календарь':'calendar','Числа':'numbers','Количество':'numbers','Счёт и количество':'numbers','Магазин':'shop','Магазин и покупки':'shop','Еда':'food','Еда и напитки':'food','Досуг':'sport','Досуг и спорт':'sport','Здоровье':'health','Тело':'person','Чувства':'heart','Общение':'chat','Общение и чувства':'chat','Общество':'family','Работа':'work','Связки':'grammar','Предлоги':'travel','Глаголы':'grammar','Существительные':'book','Прилагательные':'colors','Транспорт':'train','Путешествия':'travel','Животные':'animal','Природа':'nature','Погода':'weather','Город и места':'school','Техника':'computer','Одежда':'clothes','Быт и дела':'home'};
const STUDIO_ACTION_ICON={lessons:'school',topics:'book',dictionary:'search',practice:'mind',reviews:'repeat',videos:'film',books:'book',rules:'grammar',alphabet:'note'};


boot();

function renderCookieConsent(){
 const text={ru:['Мы используем необходимое локальное хранение для работы сайта. Необязательные cookies можно отклонить.','Принять','Отклонить','Настройки конфиденциальности'],en:['We use essential local storage to run this site. You can decline optional cookies.','Accept','Decline','Privacy settings'],sv:['Vi använder nödvändig lokal lagring för webbplatsen. Du kan tacka nej till valfria kakor.','Acceptera','Avvisa','Integritetsinställningar'],uk:['Ми використовуємо необхідне локальне зберігання для роботи сайту. Необов’язкові cookie можна відхилити.','Прийняти','Відхилити','Налаштування приватності']};
 if(localStorage.getItem('sv-cookie-choice'))return;let x=document.getElementById('sv-consent');if(!x){x=document.createElement('aside');x.id='sv-consent';x.className='sv-consent';document.body.appendChild(x)}const lang=state.settings?.language||localStorage.getItem('sv-language')||'ru',t=text[lang]||text.ru;x.lang=lang;x.setAttribute('aria-label',t[3]);x.innerHTML=`<p>🍪 ${t[0]}</p><div><button class="btn small" data-consent="accepted">${t[1]}</button><button class="btn secondary small" data-consent="rejected">${t[2]}</button></div>`;
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-consent]');if(b){localStorage.setItem('sv-cookie-choice',b.dataset.consent);document.getElementById('sv-consent')?.remove()}});
window.addEventListener('load',renderCookieConsent);

function verbTimeline5(w){
 const rows=[['Presens',`Jag ${w.pre} ofta.`,txt4('Сейчас и обычно','Now and regularly','Nu och vanligtvis','Зараз і зазвичай'),'presens'],['Preteritum',`Jag ${w.past} i går.`,txt4('Событие в прошлом','A past event','En händelse i dåtid','Подія в минулому'),'preteritum'],['Perfekt',`Jag har ${w.sup} i dag.`,txt4('Результат к настоящему','A result by now','Resultat fram till nu','Результат до тепер'),'har + supinum'],['Pluskvamperfekt',`Jag hade ${w.sup} före lunch.`,txt4('Раньше другого события','Before another past event','Före en annan dåtidshändelse','Раніше іншої події'),'hade + supinum'],['Futurum (ska)',`Jag ska ${w.inf} i morgon.`,txt4('План или намерение','A plan or intention','En plan eller avsikt','План або намір'),'ska + infinitiv'],['Futurum (kommer att)',`Jag kommer att ${w.inf} i morgon.`,txt4('Ожидаемое будущее','An expected future event','En förväntad framtida händelse','Очікуване майбутнє'),'kommer att + infinitiv']];
 return `<section class="tense-section" aria-labelledby="word-tenses-title">${wordSectionHeading('02','word-tenses-title',txt4('Шесть временных конструкций','Six tense constructions','Sex tidskonstruktioner','Шість часових конструкцій'),txt4('Сравни формы и послушай, как они звучат в предложении.','Compare the forms and listen to them in a sentence.','Jämför formerna och lyssna på dem i en mening.','Порівняй форми та послухай, як вони звучать у реченні.'))}<div class="tense-grid">${rows.map(([name,sentence,hint,formula])=>`<div class="tense-item"><small lang="sv">${esc(name)}</small><span class="tense-hint">${esc(hint)}</span><strong lang="sv">${esc(sentence)}</strong><span class="tense-formula" lang="sv">${esc(formula)}</span><button type="button" class="circle-btn" data-action="speak" data-text="${esc(sentence)}" aria-label="${esc(t('speak'))}: ${esc(sentence)}">🔊</button></div>`).join('')}</div></section>`;
}


// Word progress is rendered exclusively from the active state; pending intents never grant XP.
let cloudReadError=false;
const wordSubmissions=new Set();
const UX={
 ru:{conflict:'Избранное изменилось на другом устройстве. Сохрани текущий список и при необходимости отметь слово заново.',accept:'Использовать текущий список',waiting:'Ожидает сохранения',learned:'Изучено',empty:'Пока нет изученных слов. Отметь первое слово кнопкой «Знаю».',saving:'Сохраняем…',offline:'Сохранится при подключении к интернету',error:'Не удалось сохранить изменения. Попробуй ещё раз.',retry:'Повторить отправку',accountSaved:'Изученные слова и избранное сохраняются в аккаунте.',unavailable:'Сохранение результатов этого занятия пока недоступно в аккаунте.',loading:'Загружаем прогресс…',readError:'Не удалось загрузить прогресс. Попробуй ещё раз.',localOnly:'Эти настройки пока доступны в гостевом режиме.'},
 en:{conflict:'Favorites changed on another device. Keep the current list, then mark the word again if needed.',accept:'Use current list',waiting:'Waiting to save',learned:'Learned',empty:'No learned words yet. Mark your first word with “I know it”.',saving:'Saving…',offline:'Will save when you reconnect',error:'Could not save changes. Please try again.',retry:'Retry saving',accountSaved:'Learned words and favorites are saved to your account.',unavailable:'Saving results for this activity is not yet available in your account.',loading:'Loading progress…',readError:'Could not load progress. Please try again.',localOnly:'These settings are currently available in guest mode.'},
 sv:{conflict:'Favoriter har ändrats på en annan enhet. Behåll den aktuella listan och markera ordet igen vid behov.',accept:'Använd aktuell lista',waiting:'Väntar på att sparas',learned:'Inlärt',empty:'Inga inlärda ord ännu. Markera ditt första ord med ”Jag kan det”.',saving:'Sparar…',offline:'Sparas när du är ansluten igen',error:'Kunde inte spara ändringarna. Försök igen.',retry:'Försök spara igen',accountSaved:'Inlärda ord och favoriter sparas på ditt konto.',unavailable:'Resultat från den här övningen kan ännu inte sparas på kontot.',loading:'Laddar framsteg…',readError:'Kunde inte läsa in framsteg. Försök igen.',localOnly:'Dessa inställningar är tillgängliga i gästläge.'},
 uk:{conflict:'Обране змінилося на іншому пристрої. Збережи поточний список і за потреби познач слово знову.',accept:'Використати поточний список',waiting:'Очікує збереження',learned:'Вивчено',empty:'Ще немає вивчених слів. Познач перше слово кнопкою «Знаю».',saving:'Зберігаємо…',offline:'Збережеться після підключення до інтернету',error:'Не вдалося зберегти зміни. Спробуй ще раз.',retry:'Повторити надсилання',accountSaved:'Вивчені слова й обране зберігаються в акаунті.',unavailable:'Збереження результатів цього заняття поки недоступне в акаунті.',loading:'Завантажуємо прогрес…',readError:'Не вдалося завантажити прогрес. Спробуй ще раз.',localOnly:'Ці налаштування поки доступні в гостьовому режимі.'}
};
function ux(key){return (UX[state.settings.language]||UX.ru)[key]}
function wordPending(id,type){return cloudAccount()&&(window.SVProgress.activity?.().pending||[]).some(e=>e.wordId===id&&e.type===type)}
async function learnWord(id){
 if(user&&!cloudAccount()){toast(ux('unavailable'));return}
 if(!getWord(id)||state.known.includes(id)||knownPending(id)||(cloudAccount()&&!window.SVProgress?.writeStatus().ready))return;
 const key=(user?.id||'guest')+':known:'+id;if(wordSubmissions.has(key))return;
 wordSubmissions.add(key);refreshWordUI();
 try{if(cloudAccount())await window.SVProgress.enqueue('mark_known',id);
 else mutate(()=>{state.learnedOnce=[...new Set([...(state.learnedOnce||[]),...state.known])];state.known.push(id);if(!state.learnedOnce.includes(id)){state.xp+=8;state.learnedOnce.push(id)}touch();markReview(id,true)})}
 finally{wordSubmissions.delete(key);refreshWordUI()}
}
async function setWordFavorite(id){
 if(user&&!cloudAccount()){toast(ux('unavailable'));return}
 if(!getWord(id)||wordPending(id,'favorite_set')||(cloudAccount()&&!window.SVProgress.writeStatus().ready))return;
 const key=(user?.id||'guest')+':favorite:'+id;if(wordSubmissions.has(key))return;
 wordSubmissions.add(key);refreshWordUI();
 try{if(cloudAccount())await window.SVProgress.enqueue('favorite_set',id,!state.favorites.includes(id));
 else mutate(()=>{state.favorites=state.favorites.includes(id)?state.favorites.filter(x=>x!==id):[...state.favorites,id]})}
 finally{wordSubmissions.delete(key);refreshWordUI()}
}
function unsupportedAction(name,btn){return ['book-read','save-profile-name','remove-photo'].includes(name)}
// Progress notifications never replace the page, search controls or surviving cards.
function refreshWordUI(snapshotChanged=false){
 refreshVideoUI();
 const page=$('#page');if(!page?.querySelectorAll)return;
 headerStats();
 if(snapshotChanged){
  for(const chip of page.querySelectorAll('[data-quiz-status]')){
   const id=chip.dataset.quizStatus,label=quizStatus(id);
   if(chip.textContent!==label)chip.textContent=label;
   chip.classList.toggle('done-chip',quizPassed(id));chip.classList.toggle('chip',!quizPassed(id));
  }
  for(const button of page.querySelectorAll('[data-action="lesson-test"]')){
   const label=t(state.quizResults['lesson:'+button.dataset.id]?'again':'startQuiz')+' →';
   if(button.textContent!==label)button.textContent=label;
  }
 }
 if(snapshotChanged&&route==='profile'&&profileLevelBusy){headerStats();const badge=$('[data-profile-level]');if(badge)badge.textContent=state.settings.level;return}
 if(snapshotChanged&&['home','profile','word-review'].includes(route)){const restoreEmailFocus=route==='profile'&&document.activeElement?.id==='profile-new-email';render();if(restoreEmailFocus)$('#profile-new-email')?.focus({preventScroll:true});return}
 if(route==='flashcards'){
  const learned=page.querySelector('[data-action="show-learned"]');if(learned)learned.textContent='✓ '+ux('learned')+' · '+state.known.length;
  if(flashFilter.scope==='known'&&((!flash.ids.length&&state.known.length)||flash.ids.some(id=>!state.known.includes(id)))){
   flash.ids=flash.ids.filter(id=>state.known.includes(id));flash.index=Math.min(flash.index,Math.max(0,flash.ids.length-1));flash.flipped=false;render();return;
  }
 }
 if(route==='dictionary'){
  if(routeParam==='learned'){const heading=page.querySelector('.section-head h2');if(heading)heading.textContent='✓ '+ux('learned')+' · '+(dictionaryReadFailed()?ux('readError'):dictionaryLoading()?ux('loading'):state.known.length)}
  const template=document.createElement('template');template.innerHTML=renderDictionary();
  const next=template.content,grid=page.querySelector('.words-grid'),wanted=next.querySelector('.words-grid');
  if(grid&&wanted){
   const ids=new Set([...wanted.children].map(el=>el.dataset.wordLink));
   for(const row of [...grid.children]){if(!ids.has(row.dataset.wordLink))retireWordRow(row);else if(row.dataset.retiring){delete row.dataset.retiring;row.getAnimations?.().forEach(animation=>animation.cancel())}}
   for(const row of [...wanted.children])if(![...grid.children].some(el=>el.dataset.wordLink===row.dataset.wordLink))grid.appendChild(row);
  }else if(grid){for(const row of [...grid.children])retireWordRow(row)}
  else if(wanted){page.querySelector('.empty-state')?.replaceWith(wanted)}
  for(const selector of ['.vocab-counter','.list-footer']){
   const old=page.querySelector(selector),fresh=next.querySelector(selector);
   if(old&&fresh){if(old.innerHTML!==fresh.innerHTML)old.innerHTML=fresh.innerHTML}
   else if(old)old.remove();else if(fresh)page.appendChild(fresh);
  }
  if(!wanted&&!grid){const empty=next.querySelector('.empty-state'),old=page.querySelector('.empty-state');if(empty){if(old)old.replaceWith(empty);else page.appendChild(empty)}}
 }
 renderProgressUX(true);
}
function retireWordRow(row){
 if(row.dataset.retiring)return;row.dataset.retiring='true';
 const grid=row.parentElement,page=$('#page');page.style.overflowAnchor='none';
 // Keep enough document height until navigation so removing the last row cannot clamp scroll.
 page.style.minHeight=Math.max(page.getBoundingClientRect().height,parseFloat(page.style.minHeight)||0)+'px';
 if(row.contains(document.activeElement)){
  const next=row.nextElementSibling||row.previousElementSibling||$('#dict-search');next?.focus({preventScroll:true});
 }
 const positions=new Map([...grid.children].filter(el=>el!==row).map(el=>[el,el.getBoundingClientRect()]));
 const finish=()=>{
  if(!row.isConnected||!row.dataset.retiring)return;row.remove();
  for(const [el,before] of positions){const after=el.getBoundingClientRect();if(el.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)el.animate([{transform:`translate(${before.left-after.left}px,${before.top-after.top}px)`},{transform:'none'}],{duration:180,easing:'ease-out'})}
  if(!grid.children.length){grid.remove();refreshWordUI()}
 };
 if(row.animate&&!matchMedia('(prefers-reduced-motion: reduce)').matches)row.animate([{opacity:1},{opacity:0}],{duration:140}).finished.then(finish,finish);else finish();
}
function renderProgressUX(update=false){
 refreshVideoUI();
 const page=$('#page');if(!page)return;
 const cloud=cloudAccount(),activity=window.SVProgress?.activity?.()||{pending:[]};
 const ready=!cloud||window.SVProgress?.writeStatus?.().ready===true;
 // One persistent status area avoids a stream of popups, including reconnect retries.
 const authUnavailable=window.SVAuth?.getState?.().status==='unavailable';
 if(!cloud&&!authUnavailable)page.querySelector('.save-status')?.remove();
 if(cloud||authUnavailable){
  const error=activity.error||window.SVProgress?.writeStatus?.().error;
  const videoConflict=activity.pending.some(e=>e.status==='conflict'&&e.type==='video_set');
  const conflict=activity.pending.some(e=>e.status==='conflict'),wordConflict=activity.pending.some(e=>e.status==='conflict'&&!['favorite_set','video_set'].includes(e.type));
  const readStatus=window.SVProgress?.status?.();
  const message=authUnavailable?authText('offline'):conflict?(videoConflict?videoText('conflict'):wordConflict?wordUX('conflict'):ux('conflict')):navigator.onLine===false&&activity.pending.length?ux('offline'):error==='SRS_INTERVAL_LIMIT'?txt4('Не удалось сохранить слово из-за ошибки расписания повторений. Следующие изменения ожидают отправки. Требуется исправление на сервере.','A review schedule error prevented saving the word. Later changes are waiting to send. A server fix is required.','Ett fel i repetitionsschemat hindrade ordet från att sparas. Senare ändringar väntar på att skickas. Servern behöver rättas.','Не вдалося зберегти слово через помилку розкладу повторень. Наступні зміни очікують надсилання. Потрібне виправлення на сервері.'):error==='FEATURE_UNAVAILABLE'?ux('waiting'):error?ux('error'):cloudReadError||!window.SVProgress||readStatus?.status==='error'?ux('readError'):!accountDataReady()?ux('loading'):activity.pending.length?ux('saving'):'';
  const statusHTML=`<div class="save-status ${message?'':'hidden'}" role="status" aria-live="polite">${esc(message)}${conflict?` <button class="link-btn" data-action="${videoConflict?'accept-video-state':wordConflict?'accept-word-state':'accept-favorites'}">${esc(videoConflict?videoText('accept'):wordConflict?wordUX('accept'):ux('accept'))}</button>`:authUnavailable||error||cloudReadError||!window.SVProgress||readStatus?.status==='error'?` <button class="link-btn" data-action="${authUnavailable?'auth-retry':'save-retry'}">${esc(authUnavailable?t('repeat'):ux('retry'))}</button>`:''}</div>`;
  const status=page.querySelector('.save-status');if(!status)page.insertAdjacentHTML('afterbegin',statusHTML);else if(status.outerHTML!==statusHTML)status.outerHTML=statusHTML;
 }
 page.querySelectorAll('[data-action="mark-known"],[data-action="flash-grade"][data-value="1"]').forEach(btn=>{
  const id=btn.dataset.id||flash.ids[flash.index],known=state.known.includes(id);
  const pending=knownPending(id)||wordSubmissions.has(ownerKey()+':known:'+id);
  const available=ready&&(!user||cloud)&&(known?canUnlearnWords():true);
  const label=(known?'✓ ':'')+t('known');
  btn.dataset.id=id;btn.classList.toggle('is-learned',known);
  if(btn.textContent!==label)btn.textContent=label;
  btn.setAttribute('aria-label',label);btn.setAttribute('aria-pressed',String(known));btn.title=label;
  btn.disabled=!available;btn.setAttribute('aria-disabled',String(!available||pending));btn.setAttribute('aria-busy',String(pending));
 });
 if(!page.querySelector('.manual-queue-status')&&['dictionary','word','profile'].includes(route))page.insertAdjacentHTML('beforeend',manualQueueStatus());
 updateManualReviewButtons();
 page.querySelectorAll('[data-action="start-review"]').forEach(btn=>{btn.disabled=!canReviewWords()});
 page.querySelectorAll('[data-action="favorite"]').forEach(btn=>{const selected=state.favorites.includes(btn.dataset.id);btn.classList.toggle('selected',selected);btn.classList.toggle('is-favorite',selected);const star=btn.querySelector('span[aria-hidden]'),label=(selected?'★':'☆')+(btn.classList.contains('circle-btn')?'':' '+t('favorites'));if(star){if(star.textContent!==(selected?'★':'☆'))star.textContent=selected?'★':'☆'}else if(btn.textContent!==label)btn.textContent=label;btn.setAttribute('aria-pressed',String(selected));const pending=wordPending(btn.dataset.id,'favorite_set')||wordSubmissions.has(ownerKey()+':favorite:'+btn.dataset.id);btn.setAttribute('aria-busy',String(pending));btn.setAttribute('aria-disabled',String(!ready||pending||!!user&&!cloud));btn.disabled=false});
 if(update)return;

 if(route==='flashcards'){
  page.insertAdjacentHTML('afterbegin',`<div class="progress-filters"><button class="btn secondary small" data-action="flash-scope" data-scope="all" aria-pressed="${flashFilter.scope!=='known'}">${esc(t('allCards'))}</button><button class="btn secondary small" data-action="show-learned">✓ ${esc(ux('learned'))} · ${state.known.length}</button></div>`);
  const w=getWord(flash.ids[flash.index]);
  if(w)page.querySelector('.flash-control-row')?.insertAdjacentHTML('beforeend',`<button class="btn ghost small" data-action="favorite" data-id="${esc(w.id)}" aria-pressed="${state.favorites.includes(w.id)}" aria-disabled="${!ready||wordPending(w.id,'favorite_set')}">${state.favorites.includes(w.id)?'★':'☆'} ${esc(t('favorites'))}</button>`);
  if(w)page.querySelector('.flash-buttons')?.insertAdjacentHTML('afterbegin',`<button class="btn ghost small" data-nav="word" data-param="${esc(w.id)}">${esc(t('view'))} ↗</button>`);
  if(!w&&flashFilter.scope==='known')page.querySelector('.empty-state h3').textContent=state.known.length?wordUX('filteredEmpty'):ux('empty');
 }
 if(route==='dictionary'&&routeParam==='learned'){
  page.insertAdjacentHTML('afterbegin',`<div class="section-head"><h2>✓ ${esc(ux('learned'))} · ${dictionaryReadFailed()?ux('readError'):dictionaryLoading()?ux('loading'):state.known.length}</h2><button class="link-btn" data-nav="dictionary">${esc(t('showAll'))}</button></div>`);
  if(!state.known.length)page.querySelector('.empty-state')?.replaceChildren(Object.assign(document.createElement('p'),{textContent:ux('empty')}));
 }
 page.querySelectorAll('#dict-group').forEach(el=>{el.disabled=['noun','other'].includes(dictFilter.kind)});
 if(cloud){
  page.querySelectorAll('button[data-action]').forEach(btn=>{if(unsupportedAction(btn.dataset.action,btn)){btn.disabled=true;btn.title=ux('unavailable');}});
  page.querySelectorAll('#profile-name-edit,#profile-photo-file').forEach(el=>{el.disabled=true});
  page.querySelectorAll('.file-select').forEach(el=>{el.title=ux('localOnly');el.setAttribute('aria-disabled','true')});
 }
}
window.addEventListener('online',()=>{if(cloudAccount())refreshWordUI()});
window.addEventListener('offline',()=>{if(cloudAccount())refreshWordUI()});


let reviewExercise=null;
function resetDictionaryFilters(){dictFilter={text:'',kind:'all',group:'all',category:'all',fav:false,limit:42}}
function dictionaryBaseWords(){return WORDS.filter(w=>routeParam==='learned'?state.known.includes(w.id):routeParam==='favorites'?state.favorites.includes(w.id):true)}
function dictionaryNeedsCloud(){return cloudAccount()&&['learned','favorites'].includes(routeParam)}
function dictionaryReadFailed(){return dictionaryNeedsCloud()&&!accountDataReady()&&(cloudReadError||!window.SVProgress||window.SVProgress.status?.().status==='error')}
function dictionaryLoading(){return dictionaryNeedsCloud()&&!accountDataReady()&&!dictionaryReadFailed()}
function hasDictionaryFilters(){return !!dictFilter.text.trim()||dictFilter.kind!=='all'||dictFilter.group!=='all'||dictFilter.category!=='all'}
function dictionaryCounter(shown,total){
 if(dictionaryReadFailed())return ux('readError');
 if(dictionaryLoading())return ux('loading').replace(/[.…]+$/,'');
 return txt4(`Показано ${shown} из ${total}`,`Showing ${shown} of ${total}`,`Visar ${shown} av ${total}`,`Показано ${shown} із ${total}`)+(hasDictionaryFilters()?txt4(` · Всего ${dictionaryBaseWords().length}`,` · Total ${dictionaryBaseWords().length}`,` · Totalt ${dictionaryBaseWords().length}`,` · Усього ${dictionaryBaseWords().length}`):'');
}
const WORD_UX={
 ru:{returned:'Отметка снята',filteredEmpty:'По этим условиям слов нет.',reset:'Очистить фильтры',review:'Повторение слова',recall:'Вспомни перевод, затем проверь себя.',reveal:'Показать перевод',remember:'Вспомнил(а)',again:'Повторить позже',reviewSaved:'Повторение сохранено',done:'Расписание повторений обновлено. Статус слова не изменился.',conflict:'Статус слова изменился на другом устройстве. Используй актуальное состояние и при необходимости измени его снова.',accept:'Использовать актуальное состояние'},
 en:{returned:'Mark removed',filteredEmpty:'No words match these conditions. Clear filters.',reset:'Clear filters',review:'Word review',recall:'Recall the translation, then check yourself.',reveal:'Show translation',remember:'I remembered',again:'Review later',reviewSaved:'Review saved',done:'Review schedule updated. The learned status is unchanged.',conflict:'Word status changed on another device. Use the current state and change it again if needed.',accept:'Use current state'},
 sv:{returned:'Markeringen borttagen',filteredEmpty:'Inga ord matchar filtren. Rensa filter.',reset:'Rensa filter',review:'Repetera ord',recall:'Försök minnas översättningen och kontrollera sedan.',reveal:'Visa översättning',remember:'Jag mindes',again:'Repetera senare',reviewSaved:'Repetition sparad',done:'Repetitionsschemat har uppdaterats. Ordets status är oförändrad.',conflict:'Ordets status har ändrats på en annan enhet. Använd aktuellt läge och ändra igen vid behov.',accept:'Använd aktuellt läge'},
 uk:{returned:'Позначку знято',filteredEmpty:'За цими умовами слів немає.',reset:'Очистити фільтри',review:'Повторення слова',recall:'Згадай переклад, потім перевір себе.',reveal:'Показати переклад',remember:'Згадав(-ла)',again:'Повторити пізніше',reviewSaved:'Повторення збережено',done:'Розклад повторень оновлено. Статус слова не змінився.',conflict:'Статус слова змінився на іншому пристрої. Використай актуальний стан і за потреби зміни його знову.',accept:'Використати актуальний стан'}
};
function wordUX(key){return (WORD_UX[state.settings.language]||WORD_UX.ru)[key]}
const ownerKey=()=>user?.id||'guest';
function knownPending(id){return wordPending(id,'mark_known')||wordPending(id,'unmark_known')}
function canUnlearnWords(){return !user||((!window.SVAuth||window.SVAuth.getState().user?.id===user.id)&&cloudAccount()&&window.SVProgress.writeStatus().ready&&window.SVProgress.supports('unmark_known')&&window.SVProgress.supports('known_reward_once'))}
function canReviewWords(){return !!user&&manualQueue().ready}
async function unlearnWord(id){
 if(!getWord(id)||!state.known.includes(id)||knownPending(id)||!canUnlearnWords())return;
 const key=ownerKey()+':known:'+id;if(wordSubmissions.has(key))return;
 wordSubmissions.add(key);refreshWordUI();
 try{if(cloudAccount())await window.SVProgress.enqueue('unmark_known',id);
 else{mutate(()=>{state.learnedOnce=[...new Set([...(state.learnedOnce||[]),...state.known])];state.known=state.known.filter(x=>x!==id)});toast(wordUX('returned'))}}
 finally{wordSubmissions.delete(key);refreshWordUI()}
}
function renderWordReview(){
 const id=routeParam,w=getWord(id);if(!w)return renderDictionary();
 const row=manualQueue().entries.find(e=>e.word_id===id&&e.active);
 if(!reviewExercise||reviewExercise.owner!==ownerKey()||reviewExercise.id!==id)reviewExercise={owner:ownerKey(),id,version:row?.version,revealed:false,submitted:false};
 const x=reviewExercise,pending=manualQueue().pending.includes(id);
 if(row&&!pending&&!x.submitted&&x.version!==row.version){x.version=row.version;x.revealed=false}
 const back=`<button class="back-link" data-nav="reviews">← ${esc(t('reviews'))}</button>`;
 if(!row&&!x.submitted)return back+title(t('reviews'))+`<p role="status">${esc(manualQueue().ready?queueUX('absent'):ux('loading'))}</p>`+manualQueueStatus();
 return back+title(wordUX('review'),wordUX('recall'))+`<section class="content-panel word-recall"><h2 lang="sv">${esc(wordLabel(w))}</h2><button class="btn secondary small" data-action="speak" data-text="${esc(wordLabel(w))}">${esc(t('speak'))}</button>${x.revealed?`<p class="recall-translation">${esc(locMeaning4(w))}</p><p>${esc(w.example||'')}</p>`:`<button class="btn" data-action="review-reveal">${esc(wordUX('reveal'))}</button>`}${x.revealed&&!x.submitted?`<div class="split"><button class="btn" data-action="review-grade" data-value="1" ${pending?'disabled':''}>${esc(queueUX('remember'))}</button><button class="btn secondary" data-action="review-grade" data-value="0" ${pending?'disabled':''}>${esc(queueUX('again'))}</button></div>`:''}${x.submitted?`<p role="status">${esc(queueUX(x.correct?'done':'kept'))}</p><button class="btn secondary" data-nav="reviews">${esc(t('reviews'))} →</button>`:''}</section>`+manualQueueStatus();
}
async function gradeWordReview(correct){
 const x=reviewExercise;if(!x||x.owner!==ownerKey()||x.id!==routeParam||!x.revealed||x.submitted||!x.version)return;
 await window.SVManualReviews?.change(correct?'remember':'again',x.id,x.version);
}


// Manual repetitions are separate from state.reviews (automatic SRS dates).
function manualQueue(){return window.SVManualReviews?.state()||{ready:false,entries:[],pending:[],error:null}}
function manualReviewIds(){return manualQueue().entries.filter(e=>e.active).map(e=>e.word_id).filter(id=>getWord(id)&&!state.known.includes(id))}
function queueUX(key){const labels={
 add:['Повторить','Review','Repetera','Повторити'],
 addedNotice:['Слово добавлено в повторение','Word added to reviews','Ordet har lagts till i repetition','Слово додано до повторення'],
 removedNotice:['Слово убрано из повторения','Word removed from reviews','Ordet har tagits bort från repetition','Слово прибрано з повторення'],
 added:['✓ В повторении','✓ In reviews','✓ I repetition','✓ У повторенні'],
 remove:['Убрать из повторения','Remove from reviews','Ta bort från repetition','Прибрати з повторення'],
 start:['Начать повторение','Start review','Börja repetera','Почати повторення'],
 remember:['Вспомнила','I remembered','Jag mindes','Згадала'],
 again:['Не вспомнила','I did not remember','Jag mindes inte','Не згадала'],
 done:['Повторение сохранено. Слово убрано из очереди.','Review saved. Word removed from the queue.','Repetition sparad. Ordet har tagits bort från kön.','Повторення збережено. Слово прибрано з черги.'],
 kept:['Ответ сохранён. Слово остаётся для следующей попытки.','Answer saved. The word stays for another attempt.','Svaret sparat. Ordet är kvar till nästa försök.','Відповідь збережено. Слово залишається для наступної спроби.'],
 empty:['Здесь будут слова, которые ты хочешь повторить','Words you want to review will appear here','Här visas orden du vill repetera','Тут будуть слова, які ти хочеш повторити'],
 hint:['Добавляй слова кнопкой «Повторить» в словаре.','Add words from the dictionary to your reviews.','Lägg till ord från ordboken.','Додавай слова кнопкою «У повторення» у словнику.'],
 login:['Войди, чтобы сохранять слова для повторения в аккаунте.','Sign in to save your review queue.','Logga in för att spara dina repetitioner.','Увійди, щоб зберігати слова для повторення в акаунті.'],
 offline:['Нет соединения. Изменение не сохранено — повтори после подключения.','Offline. Change not saved — try again when connected.','Ingen anslutning. Ändringen sparades inte — försök igen när du är ansluten.','Немає зв’язку. Зміну не збережено — повтори після підключення.'],
 retry:['Не удалось подтвердить сохранение. Проверим при подключении.','Save not confirmed. We will check when connected.','Kunde inte bekräfta sparandet. Vi kontrollerar när du är ansluten.','Не вдалося підтвердити збереження. Перевіримо після підключення.'],
 conflict:['Список изменился на другом устройстве. Проверь слово и повтори действие.','Reviews changed on another device. Check the word and try again.','Listan ändrades på en annan enhet. Kontrollera ordet och försök igen.','Список змінився на іншому пристрої. Перевір слово та повтори дію.'],
 unavailable:['Сохранение повторений пока недоступно.','Saving reviews is currently unavailable.','Det går inte att spara repetitioner just nu.','Збереження повторень поки недоступне.'],
 absent:['Слова уже нет в очереди повторения.','This word is no longer in your review queue.','Ordet finns inte längre i repetitionskön.','Слова вже немає в черзі повторення.']
 };return (labels[key]||labels.retry)[Math.max(0,['ru','en','sv','uk'].indexOf(state.settings.language))]}
function manualQueueStatus(){const q=manualQueue();const message=!user?queueUX('login'):q.error?queueUX(q.error):q.pending.length?ux('saving'):!q.ready?ux('loading'):'';return `<div class="manual-queue-status" role="status" aria-live="polite">${esc(message)}${q.error&&user?` <button class="link-btn" data-action="retry-manual-reviews">${esc(ux('retry'))}</button>`:''}</div>`}
function manualReviewRow(w){return `<article class="manual-review-row" data-review-id="${esc(w.id)}"><span class="word-visual">${wordListVisual(w)}</span><div class="word-info"><strong lang="sv">${esc(wordLabel(w))}</strong><small>${esc(locMeaning4(w))}</small></div><div class="manual-review-actions"><button class="btn secondary small" data-nav="word-review" data-param="${esc(w.id)}">${esc(queueUX('start'))}</button><button class="link-btn" data-action="remove-review" data-id="${esc(w.id)}">${esc(queueUX('remove'))}</button></div></article>`}
function manualReviewContent(){const ids=manualReviewIds();return ids.length?`<div class="manual-review-list">${ids.map(getWord).map(manualReviewRow).join('')}</div>`:`<div class="empty-state"><div class="big" aria-hidden="true">🌷</div><h3>${esc(queueUX('empty'))}</h3><p>${esc(queueUX('hint'))}</p><button class="btn" data-nav="dictionary">${esc(t('dictionary'))} →</button></div>`}
function renderManualReviews(){return title(t('reviews'))+`<p data-review-count>${!user?0:manualQueue().ready?manualReviewIds().length:'…'} ${esc(t('words'))}</p>`+manualQueueStatus()+`<section class="manual-queue-content">${manualReviewContent()}</section>`}
function reviewLearnedHint(){return txt4(
 'Сними отметку «Знаю», чтобы добавить слово в повторение.',
 'Remove the learned mark to add this word to reviews.',
 'Ta bort markeringen som inlärt för att repetera ordet.',
 'Зніми позначку «Знаю», щоб додати слово до повторення.'
)}
async function addManualReview(id){
 if(!user){toast(queueUX('login'));return}
 if(state.known.includes(id)){toast(reviewLearnedHint());return}
 if(!manualQueue().ready){toast(queueUX(manualQueue().error||'unavailable'));void window.SVManualReviews?.refresh();return}
 if(manualQueue().pending.includes(id))return;
 if(getWord(id)){const action=manualReviewIds().includes(id)?'remove':'add';const saved=await window.SVManualReviews.change(action,id);if(!saved&&manualQueue().error==='offline')toast(queueUX('offline'))}
}
function updateManualReviewButtons(){
 const q=manualQueue(),ids=new Set(manualReviewIds());
 document.querySelectorAll('[data-action="mark-review"],[data-action="flash-grade"][data-value="0"]').forEach(btn=>{
  const id=btn.dataset.id||flash.ids[flash.index],selected=ids.has(id),pending=q.pending.includes(id),learned=state.known.includes(id);
  btn.hidden=false;
  btn.innerHTML=learned?'✓ '+esc(ux('learned')):studioIcon('repeat','review-button-icon')+' '+esc(t('repeat'));
  btn.classList.toggle('is-queued',selected&&!learned);
  btn.title=learned?reviewLearnedHint():pending?ux('saving'):selected?queueUX('remove'):queueUX('add');
  btn.setAttribute('aria-label',learned?reviewLearnedHint():selected?queueUX('remove'):queueUX('add'));
  btn.disabled=pending||learned;
  btn.setAttribute('aria-disabled',String(pending||learned));
  btn.setAttribute('aria-pressed',String(selected&&!learned));
  btn.setAttribute('aria-busy',String(pending));
 });
 document.querySelectorAll('[data-action="remove-review"]').forEach(btn=>{btn.disabled=q.pending.includes(btn.dataset.id)});
 document.querySelectorAll('[data-review-count]').forEach(el=>{el.textContent=el.dataset.nav==='reviews'?`🔁 ${t('reviews')} · ${!user?0:q.ready?ids.size:'…'} →`:`${!user?0:q.ready?ids.size:'…'} ${t('words')}`});
}
function manualQueueChanged(event){
 if(event?.action==='add'||event?.action==='remove')toast(queueUX(event.action==='add'?'addedNotice':'removedNotice'));
 const page=$('#page');if(!page)return;
 if(event&&reviewExercise?.owner===ownerKey()&&reviewExercise.id===event.wordId&&reviewExercise.version===event.version&&['remember','again'].includes(event.action)){
  reviewExercise.submitted=true;reviewExercise.correct=event.action==='remember';
 }
 if(route==='reviews'){
  const content=page.querySelector('.manual-queue-content');
  if(content){
   const ids=new Set(manualReviewIds()),list=content.querySelector('.manual-review-list');
   page.style.minHeight=Math.max(page.getBoundingClientRect().height,parseFloat(page.style.minHeight)||0)+'px';
   page.style.overflowAnchor='none';
   if(list&&ids.size){
    for(const row of [...list.children])if(!ids.has(row.dataset.reviewId)){
     if(row.contains(document.activeElement))(row.nextElementSibling?.querySelector('button')||row.previousElementSibling?.querySelector('button'))?.focus({preventScroll:true});
     row.remove();
    }
    for(const id of ids)if(![...list.children].some(row=>row.dataset.reviewId===id))list.insertAdjacentHTML('beforeend',manualReviewRow(getWord(id)));
   }else if(!!list!==!!ids.size||!content.children.length)content.innerHTML=manualReviewContent();
  }
 }
 if(route==='word-review'){
  page.style.minHeight=Math.max(page.getBoundingClientRect().height,parseFloat(page.style.minHeight)||0)+'px';page.style.overflowAnchor='none';
  const html=renderWordReview();if(page.innerHTML!==html)page.innerHTML=html;
 }
 const status=page.querySelector('.manual-queue-status');
 if(status){const fresh=document.createElement('template');fresh.innerHTML=manualQueueStatus();if(status.innerHTML!==fresh.content.firstElementChild.innerHTML)status.innerHTML=fresh.content.firstElementChild.innerHTML}
 updateManualReviewButtons();
}

// Compact profile settings keep form state across Auth and progress updates.
let profileEmailEditing=false,profileEmailBusy=false,profileEmailDraft='',profileEmailMessage='',profileLevelBusy=false,profileLevelMessage='';
function settingsText(key){const labels={title:['Настройки профиля','Profile settings','Profilinställningar','Налаштування профілю'],change:['Изменить email','Change email','Ändra e-post','Змінити email'],save:['Сохранить','Save','Spara','Зберегти'],cancel:['Отмена','Cancel','Avbryt','Скасувати'],newEmail:['Новый email','New email','Ny e-post','Новий email'],check:['Проверьте почту для подтверждения нового адреса','Check your email to confirm the new address','Kontrollera din e-post för att bekräfta den nya adressen','Перевірте пошту для підтвердження нової адреси'],secure:['При включённой защите подтвердите ссылки на старом и новом адресе.','If secure email change is enabled, confirm links at both addresses.','Om säkert e-postbyte är aktiverat, bekräfta på båda adresserna.','Якщо захист увімкнено, підтвердьте посилання на обох адресах.'],saved:['Уровень сохранён','Level saved','Nivån sparad','Рівень збережено']};return txt4(...labels[key])}
function profileSettingsError(error){
 const code=error?.code||'',status=error?.status;
 if(['EMAIL_INVALID','email_address_invalid','validation_failed'].includes(code))return txt4('Введите корректный email.','Enter a valid email.','Ange en giltig e-postadress.','Введіть коректний email.');
 if(code==='EMAIL_UNCHANGED')return txt4('Введите другой адрес.','Enter a different address.','Ange en annan adress.','Введіть іншу адресу.');
 if(['email_exists','user_already_exists','email_address_not_authorized'].includes(code))return txt4('Этот адрес уже занят или недоступен. Выберите другой.','This email is in use or unavailable. Choose another.','Adressen används eller är otillgänglig. Välj en annan.','Ця адреса зайнята або недоступна. Оберіть іншу.');
 if(status===429||['over_email_send_rate_limit','over_request_rate_limit'].includes(code))return txt4('Слишком много запросов. Подождите перед повторной отправкой.','Too many requests. Wait before trying again.','För många försök. Vänta och försök igen.','Забагато запитів. Зачекайте перед повторною спробою.');
 if(status===401||status===403||/^PGRST30/.test(code)||/session|jwt|refresh_token|AUTH_/.test(code))return txt4('Сессия истекла. Войдите снова. Прогресс сохранён.','Session expired. Sign in again. Your progress is safe.','Sessionen har gått ut. Logga in igen. Framstegen är sparade.','Сесія завершилась. Увійдіть знову. Прогрес збережено.');
 return txt4('Не удалось сохранить. Проверьте соединение и повторите попытку.','Could not save. Check your connection and retry.','Kunde inte spara. Kontrollera anslutningen och försök igen.','Не вдалося зберегти. Перевірте з’єднання та спробуйте ще раз.');
}
function profileSettingsIcon(kind){
 const paths={settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>',email:'<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',language:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18Z"/>',level:'<path d="M5 19v-4m7 4V9m7 10V4"/>'};
 return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind]}</svg>`;
}
function profileSettingsMarkup(){const auth=window.SVAuth?.getState().user,pending=auth?.new_email;return `<section class="content-panel profile-settings"><h3 class="profile-settings-heading"><span class="settings-heading-icon">${profileSettingsIcon('settings')}</span>${esc(settingsText('title'))}</h3>${user?`<div class="settings-email"><div class="settings-row account-email"><span class="settings-email-icon">${profileSettingsIcon('email')}</span><div class="email-current"><b>${esc(t('email'))}</b><span data-current-email>${esc(auth?.email||'—')}</span></div><button type="button" class="btn secondary small" data-profile-email="edit" ${profileEmailBusy?'disabled':''}>${esc(settingsText('change'))}</button></div><form id="profile-email-form" ${profileEmailEditing?'':'hidden'}><label for="profile-new-email">${esc(settingsText('newEmail'))}</label><input id="profile-new-email" class="form-input" type="email" autocomplete="email" required maxlength="254" value="${esc(profileEmailDraft)}" ${profileEmailBusy?'disabled':''}><div class="email-actions"><button class="btn small" type="submit" ${profileEmailBusy?'disabled':''}>${esc(settingsText('save'))}</button><button class="btn ghost small" type="button" data-profile-email="cancel" ${profileEmailBusy?'disabled':''}>${esc(settingsText('cancel'))}</button></div></form><p class="settings-message" id="profile-email-message" role="status">${esc(profileEmailMessage||(pending?settingsText('check'):''))}</p>${pending||profileEmailMessage===settingsText('check')?`<p class="micro-note">${esc(settingsText('secure'))}</p>`:''}</div>`:''}<div class="settings-row"><label class="settings-label" for="profile-lang"><span class="settings-field-icon">${profileSettingsIcon('language')}</span>${esc(t('interfaceLang'))}</label><select class="form-select" id="profile-lang">${[['ru','Русский'],['en','English'],['sv','Svenska'],['uk','Українська']].map(([k,v])=>`<option value="${k}" ${locale4()===k?'selected':''}>${v}</option>`).join('')}</select></div><div class="settings-row"><label class="settings-label" for="profile-level"><span class="settings-field-icon">${profileSettingsIcon('level')}</span>${esc(t('sfiLevel'))}</label><select class="form-select" id="profile-level" ${profileLevelBusy||!accountDataReady()?'disabled':''}>${!accountDataReady()?'<option value="">…</option>':''}${'ABCD'.split('').map(l=>`<option value="${l}" ${accountDataReady()&&state.settings.level===l?'selected':''}>SFI ${l}</option>`).join('')}</select></div><p class="settings-message" id="profile-level-message" role="status">${esc(profileLevelMessage)}</p></section>`}
function refreshProfileSettings(){
 const auth=window.SVAuth?.getState().user,el=$('[data-current-email]');
 if(!el)return;
 const changed=el.textContent!==(auth?.email||'—');
 el.textContent=auth?.email||'—';
 if(changed&&!profileEmailEditing&&!profileEmailBusy){profileEmailMessage='';const section=$('.profile-settings');if(section)section.outerHTML=profileSettingsMarkup()}
}

async function saveProfileLevel(el){if(profileLevelBusy)return;const level=el.value,id=user?.id;profileLevelBusy=true;el.disabled=true;profileLevelMessage='';try{if(user)await window.SVProgress.updateLevel(level);else{state.settings.level=level;save()}if(user?.id===id){profileLevelMessage=settingsText('saved')}}catch(error){if(user?.id===id){profileLevelMessage=profileSettingsError(error)}}finally{profileLevelBusy=false;if(user?.id===id&&route==='profile'){const badge=$('[data-profile-level]');if(badge)badge.textContent=state.settings.level;const select=$('#profile-level');if(select){select.disabled=!accountDataReady();select.value=state.settings.level}const message=$('#profile-level-message');if(message)message.textContent=profileLevelMessage}}}
document.addEventListener('input',e=>{if(e.target.id==='profile-new-email')profileEmailDraft=e.target.value});
document.addEventListener('click',e=>{const button=e.target.closest('[data-profile-email]');if(!button||profileEmailBusy)return;profileEmailEditing=button.dataset.profileEmail==='edit';profileEmailMessage='';if(!profileEmailEditing)profileEmailDraft='';const section=$('.profile-settings');if(section)section.outerHTML=profileSettingsMarkup();if(profileEmailEditing)$('#profile-new-email')?.focus()});
document.addEventListener('submit',async e=>{if(e.target.id!=='profile-email-form')return;e.preventDefault();if(profileEmailBusy||!e.target.reportValidity())return;const id=user?.id;profileEmailDraft=$('#profile-new-email').value;profileEmailBusy=true;profileEmailMessage='';$('.profile-settings').outerHTML=profileSettingsMarkup();try{await window.SVAuth.changeEmail(profileEmailDraft);if(user?.id===id){profileEmailEditing=false;profileEmailDraft='';profileEmailMessage=settingsText('check')}}catch(error){if(user?.id===id)profileEmailMessage=profileSettingsError(error)}finally{profileEmailBusy=false;if(user?.id===id&&route==='profile')$('.profile-settings').outerHTML=profileSettingsMarkup()}});

function quizIdentity(){return quiz.lesson?`${['book','topic','video'].includes(quiz.mode)?quiz.mode:'lesson'}:${quiz.lesson}`:`practice:${quiz.mode}`}
function quizReward(){return !quiz.lesson?0:quiz.mode==='video'?12:35}
function quizStatus(id){
 const r=state.quizResults?.[id];
 if(!r||!r.total)return txt4('Не пройден','Not passed','Inte godkänd','Не пройдено');
 const pct=Math.floor(r.correct*100/r.total),passed=r.correct*5>=r.total*4;
 return passed?txt4(`✓ Пройден · ${pct}%`,`✓ Passed · ${pct}%`,`✓ Godkänd · ${pct}%`,`✓ Пройдено · ${pct}%`):txt4(`Лучший результат: ${pct}%`,`Best result: ${pct}%`,`Bästa resultat: ${pct}%`,`Найкращий результат: ${pct}%`);
}
function quizStatusChip(id){return `<small class="chip quiz-status" data-quiz-status="${esc(id)}">${esc(quizStatus(id))}</small>`}
function quizResultLabel(){
 const r=quiz.result;
 if(!r)return '';
 const reward=r.xp>0?`+${r.xp} XP`:r.already_rewarded?txt4('Тест уже пройден','Quiz already completed','Testet är redan genomfört','Тест уже пройдено'):'0 XP';
 return `<p class="badge-verified">${esc(reward)}</p>${r.new_best?`<p class="micro-note">${esc(txt4('Новый лучший результат','New best result','Nytt bästa resultat','Новий найкращий результат'))}</p>`:''}${quizStatusChip(quizIdentity())}`;
}

function quizPassed(id){const r=state.quizResults?.[id];return !!r?.total&&r.correct*5>=r.total*4}

document.addEventListener('click',async e=>{if(!e.target.closest('[data-action="accept-video-state"]'))return;await window.SVProgress?.acceptCurrentVideos();refreshVideoUI()});

// Keep a real image fallback when an external thumbnail cannot load offline.
document.addEventListener('error',e=>{const img=e.target;if(img?.matches?.('img[data-video-preview]')&&!img.src.endsWith('/assets/video-collection.svg'))img.src='./assets/video-collection.svg'},true);
