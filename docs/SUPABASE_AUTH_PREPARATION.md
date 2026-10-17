# Supabase: подготовка клиента и Auth

Дата: 17 октября 2026. Ветка: `integration/supabase-auth-preparation`.
Пять существующих SQL-миграций не изменены и не запускались. По сообщению владельца
они уже применены в Supabase. Реальных Auth/RPC-запросов в проект при разработке
не выполнялось; URL/ключ в конфигурации остаются пустыми.

## Реализовано

- `supabase-client.js`: один клиент, загрузка браузерного UMD SDK **2.118.0** с
  jsDelivr, таймаут загрузки 8 секунд, повторная явная попытка после ошибки.
  Нет npm, package.json, новых зависимостей или системы сборки.
- `supabase-config.js`: подписанные поля Project URL и публичного publishable key.
  Нужен HTTPS URL вида `https://<ref>.supabase.co` без пути. Принимается только ключ
  `sb_publishable_...`; secret/service_role и старые JWT-ключи не принимаются.
- `supabase-auth.js`: единый `window.SVAuth` с initialize/getSession/signUp/signIn/
  signOut/subscribe/getState. Сессия восстанавливается SDK, обновления отслеживаются
  через onAuthStateChange. SDK-callback синхронный, наблюдатели вызываются позже,
  вне блокировки Auth. Выход имеет scope=local: не завершает занятия на телефоне.
- `supabase-rpc.js`: `window.SVRpc.getProgress/applyEvent/importProgress`, только
  существующие sl_get_progress/sl_apply_event/sl_import_progress. Нет `.from()`,
  прямого UPDATE/UPSERT, автоматических RPC, импортов, ретраев или начисления XP.
- Запрос RPC требует expectedUserId. JWT взят из текущей сессии, проверен через
  Auth getUser и закреплён в Authorization конкретного запроса. Кешированный
  session.user не используется как серверное доказательство личности. Ответ
  отбрасывается, если аккаунт за время запроса сменился. SQLSTATE, включая 40001 и
  23505, возвращается вызывающему коду без автоматического разрешения конфликта.
- Идентификатор события/импорта и ревизию задаёт вызывающий код. При сетевом сбое
  модуль не генерирует новый ID и не отправляет запрос повторно.

## Что включено в приложении сейчас

Обучение остаётся локальным. `app.js` рендерит гостевой интерфейс, затем инициирует
Auth в фоне, не ожидая сеть для уроков. Сессия `SVAuth` не присваивается старой
переменной `user` и не заменяет `state`. При заданной облачной конфигурации app.js
не пытается одновременно восстановить Python-аккаунт.

**Существующие формы личного кабинета ещё не подключены к SVAuth.** Пока не готова
безопасная очередь/разделение прогресса, интерфейс не должен показывать облачный
аккаунт и обещать сохранение на сервере. В существующем информационном диалоге
обновлён только текст, без изменения оформления. API регистрации/входа/выхода готовы
для последующего подключения форм. Локальный Python-вход при пустой облачной
конфигурации и его сохранение сохранены.

Старые обращения frontend к learning_progress и смешанная ветка cloudClient удалены:
заполнение конфига больше не может включить старый JSON-upsert или неявный импорт.
SUPABASE_SETUP.sql сохранён без изменений, но не используется.

## Сохранность браузерных данных

Новые модули не вызывают localStorage.setItem/removeItem/clear. Регистрация,
вход, выход, восстановление и явный RPC не перезаписывают sv-guest-v2 или
sv-cloud-backup-<userId>. Существующая запись гостевого прогресса при обычном
обучении продолжает работать как раньше — она не перенаправлена в Supabase.

Сам Supabase SDK обслуживает СВОИ записи авторизации, обычно
`sb-<project-ref>-auth-token`, включая запись сессии и удаление её при signOut.
Это необходимо для восстановления входа и не затрагивает ключи учебного прогресса.
Мы не копируем/чистим старые Auth-записи вручную и не сохраняем токены в отчётах.

detectSessionInUrl=false: этот этап восстанавливает уже сохранённую сессию,
но не потребляет токены из fragment и не запускает незавершённый email/recovery
callback поверх hash-router. Письмо подтверждения может подтвердить адрес, после
чего нужен явный вход. Автоматический вход по ссылке/recovery — отдельная работа.

## API модулей (примеры для следующей интеграции, не автоматический запуск)

```js
await SVAuth.initialize();
const current = await SVAuth.getSession();
const unsubscribe = SVAuth.subscribe(({ status, user, event }) => {
  // Здесь только обработка Auth; не присваивать guest state облачному аккаунту.
});

await SVAuth.signUp({ email, password, name }); // session может быть null: ждём email
await SVAuth.signIn({ email, password });
await SVAuth.signOut(); // только текущее устройство; guest/backups не удаляет
unsubscribe();
```

RPC вызываются только после отдельного решения вызывающего слоя:

```js
const session = await SVAuth.getSession();
const expectedUserId = session.user.id;
const snapshot = await SVRpc.getProgress({ expectedUserId });

await SVRpc.applyEvent({
  expectedUserId,
  eventId, // постоянный UUID уже сохранённого локально действия
  expectedRevision: snapshot.revision,
  event   // исходное тело, включая type/data/occurred_at/timezone
});

await SVRpc.importProgress({
  expectedUserId, importId, sourceId, expectedRevision,
  state: preservedLocalSnapshot,
  mode: 'archive_only' // empty_only/independent — только по правилам переноса
});
```

Даже sl_get_progress лениво создаёт строку аккаунта на сервере; поэтому он НЕ
вызывается автоматически после входа/старта. Если запрос завершился после смены
аккаунта, AUTH_CONTEXT_CHANGED не означает rollback на сервере: исходное действие
могло примениться к исходному владельцу. Следующая очередь должна сверять его
состояние/ID, не переносить его другому пользователю и не создавать новый UUID.

## Упаковка, CSP и Service Worker

Все три модуля подключены defer после конфига и до app.js, включены в RUNTIME
build_deploy.py, whitelist Python-сервера и публичный shell-кеш Service Worker.
SDK загружается только при валидной конфигурации. Ошибка CDN/Auth не блокирует гостя.

Существующая CSP сервера уже разрешает jsdelivr в script-src и HTTPS/WSS Supabase
в connect-src; она не ослаблялась. Service Worker обходит внешние Auth/RPC/SDK
запросы и не складывает приватные ответы в кеш. Приватные аватары ещё не подключены;
для будущего отображения signed URL понадобится отдельно согласовать img-src.

При добавлении следующих модулей обновлять все четыре списка: index.html,
build_deploy.py, server.py и sw.js. У сайта на статическом хостинге нет Python-API;
он продолжит работать как гость до полной интеграции, независимо от готовности Auth.

## Проверки, реально выполненные

- `node --test tests/supabase-preparation.cjs`: **15 PASS**, изолированные SDK-моки:
  пустой/недопустимый конфиг, сбой SDK/сессии, один клиент, pin версии, регистрация с
  подтверждением, вход/выход/refresh-события, отсутствие изменения localStorage и
  автоматических RPC, проверка владельца/JWT, сохранение SQLSTATE, смена аккаунта
  при запросе, загрузка приложения с существующим прогрессом и недоступной сетью.
- `python3 -m unittest discover -s tests -v`: **6 PASS**, настоящий локальный HTTP
  сервер и временная SQLite-база. Проверены сохранённый Python-вход/прогресс,
  доступность новых JS, Content-Type, CSP и закрытость приватных файлов.
  Sandbox изначально запрещал bind; разрешённый локальный повтор прошёл.
- `node tests/quality.cjs`: PASS — 1006 слов, 50 уроков, 12 книг, 4 языка, 14 режимов.
- `node tests/service-worker.cjs`: PASS — офлайн-модули, обход Auth/RPC/SDK,
  прежние ограничения фотокеша и обновление кеша.
- `node tests/flashcard-media.cjs`: PASS.
- `python3 scripts/check_supabase_manifest.py`: PASS, frozen manifest не изменён.
- Синтаксис JavaScript и `git diff --check`: PASS.
- build_deploy.py выполнен только во временную новую папку
  `/private/tmp/sl-auth-package-bbakejus/site`: 1421 файл, новые модули совпадают с
  исходниками, SQL не включён. Это проверка упаковки, не публикация/деплой.
- Контрольные суммы SQL, учебных материалов и фотографий сверены со снимком до
  этапа. Предшествующие изменения index.html сохранены; добавлены только script-теги.

Реальный Supabase Auth/доставка писем/HTTP RPC не тестировались: публичные параметры
не предоставлены, тесты использовали моки. Браузерная проверка реального CDN/сессий
и серверного RLS остаётся необходимой перед включением пользовательского входа.

## Файлы этого этапа

Новые: supabase-client.js, supabase-auth.js, supabase-rpc.js,
tests/supabase-preparation.cjs, docs/SUPABASE_AUTH_PREPARATION.md.

Изменены: app.js, supabase-config.js, index.html, scripts/build_deploy.py,
server.py, sw.js, tests/test_server.py, tests/service-worker.cjs.
SQL, дизайн/CSS, учебные материалы, карточки и фотографии не изменены.

Резервная копия перед работой: `/private/tmp/sl-auth-before-uq1ajlj2/`:
source-backup.tar.gz и sha256.json. Для постоянного хранения копию нужно вынести
из системной временной папки. Commit, push, merge и deploy не выполнялись.

## До безопасной синхронизации остаётся

1. Подключить формы/статус аккаунта к Auth одновременно с отдельным локальным
   пространством прогресса аккаунта: не использовать общий guest state как аккаунт.
2. Ввести устойчивую локальную очередь, UUID, границы импорта, координацию вкладок,
   ревизии и явное разрешение конфликтов. Сохранить исходные локальные снимки.
3. Преобразовать учебные действия в события RPC без двойного XP и без перезаписи
   серверного прогресса локальным JSON. Обработать неопределённый результат сети.
4. Добавить UI предварительного импорта; никакого автоматического independent merge.
5. Реализовать callback/recovery и правильные Redirect URLs, затем аватары/Storage.
6. Проверить два реальных пользователя, два устройства, офлайн, выход с очередью,
   смену аккаунта и реальные RLS/RPC. Только после этого включать облачное обучение.

SDK pin проверен по [официальному пакету](https://registry.npmjs.org/@supabase/supabase-js/2.118.0).
Контракт [Auth](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
и [.retry(false)](https://supabase.com/docs/reference/javascript/retry) сверен с
официальной документацией. Файлы зависимостей/lockfile не добавлялись.
