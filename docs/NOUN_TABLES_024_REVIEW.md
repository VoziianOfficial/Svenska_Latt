# Урок 5 Svenska Lätt — обзор четырёх форм существительных

27 ноября 2026, Europe/Stockholm. Доработка выполнена локально в ветке `feature/lesson-5-noun-form-tables`, созданной от актуальной `origin/main` (`9b551a0`). Установка и проверка 023 приняты как сообщённое пользователем состояние. Подготовлена отдельная 024; production SQL, commit, push, merge и deploy не выполнялись.

## Таблицы и педагогическая последовательность

Семь таблиц используют один порядок: слово с en/ett и озвучиванием → singular obestämd → singular bestämd → plural obestämd → plural bestämd → перевод. Это classroom, home, living, cafe, gender-map, definite-map и plural-map: 40 строк, 25 разных существительных, 160 ячеек форм.

Заголовки сгруппированы по числу; под ними стоят короткие подписи неопределённой и определённой формы. Легенда, подписи, названия и доступные имена кнопок поддерживают RU, UK, EN, SV. Полные грамматические названия сохранены в данных и доступных заголовках. Одно пояснение в начале обзора оставляет подробное объяснение определённой формы уроку №6.

На большом экране ширина блока ограничена 920 px; уменьшены padding и минимальные ширины. Цветные акценты различают en/ett и окончания. На телефоне каждое слово — карточка с четырьмя формами 2×2, переводом и пятью кнопками озвучивания. На планшете карточки идут по две. На 320 px значок звука при необходимости переносится внутри кнопки длинного слова; сама форма остаётся целой.

Шесть таблиц с пояснениями, речевыми схемами, ошибками, самопроверкой и прилагательными сохранены. Примеры согласования из прежней gender-map сохранены отдельным пояснением рядом с новой таблицей. Общий renderer уроков №3 и №4 выдаёт побайтно прежний HTML в четырёх языках.

Все четыре формы заданы явно в генераторе, а не вычисляются правилом окончания. Сверка использует словарные формы и стандартные модели определённого plural. В частности, [SAOL/SO приводит fönstren](https://svenska.se/?q=F%C3%B6nstret), [KTH — lärarna](https://folkets-lexikon.csc.kth.se/folkets/service?word=l%C3%A4rare), [ISOF — äpplen и äpplena](https://frageladan.isof.se/faqs/28944). Общая грамматическая основа — [Svenska Akademiens grammatik, том 2](https://svenska.se/SAG_Volym_2.pdf). Независимая проверка лингвистом в этот прогон не входила.

| Слово | Singular obestämd | Singular bestämd | Plural obestämd | Plural bestämd | Словарь |
| --- | --- | --- | --- | --- | --- |
| en bok | bok | boken | böcker | böckerna | [статья](https://svenska.se/?q=bok) |
| en penna | penna | pennan | pennor | pennorna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=penna) |
| en stol | stol | stolen | stolar | stolarna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=stol) |
| ett bord | bord | bordet | bord | borden | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=bord) |
| ett fönster | fönster | fönstret | fönster | fönstren | [статья](https://svenska.se/?q=f%C3%B6nster) |
| en lampa | lampa | lampan | lampor | lamporna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=lampa) |
| en soffa | soffa | soffan | soffor | sofforna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=soffa) |
| en lägenhet | lägenhet | lägenheten | lägenheter | lägenheterna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=l%C3%A4genhet) |
| ett rum | rum | rummet | rum | rummen | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=rum) |
| ett kök | kök | köket | kök | köken | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=k%C3%B6k) |
| ett hus | hus | huset | hus | husen | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=hus) |
| en lärare | lärare | läraren | lärare | lärarna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=l%C3%A4rare) |
| en granne | granne | grannen | grannar | grannarna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=granne) |
| en katt | katt | katten | katter | katterna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=katt) |
| ett barn | barn | barnet | barn | barnen | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=barn) |
| ett djur | djur | djuret | djur | djuren | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=djur) |
| ett syskon | syskon | syskonet | syskon | syskonen | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=syskon) |
| en kopp | kopp | koppen | koppar | kopparna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=kopp) |
| en smörgås | smörgås | smörgåsen | smörgåsar | smörgåsarna | [статья](https://svenska.se/?q=sm%C3%B6rg%C3%A5s) |
| en bulle | bulle | bullen | bullar | bullarna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=bulle) |
| ett glas | glas | glaset | glas | glasen | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=glas) |
| ett äpple | äpple | äpplet | äpplen | äpplena | [статья](https://frageladan.isof.se/faqs/28944) |
| ett ägg | ägg | ägget | ägg | äggen | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=%C3%A4gg) |
| en bil | bil | bilen | bilar | bilarna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=bil) |
| en sko | sko | skon | skor | skorna | [статья](https://folkets-lexikon.csc.kth.se/folkets/service?word=sko) |

## Сохранность и миграция 024

Уроки, их ID, исторические вопросы, действующий тест из 24 вопросов, 40 упражнений, 4 письменных задания, диалоги и чтение сохранены. Для форм используется существующий TTS: тот же голос sv-SE, темпы 1 и 0.55, остановка, повторное нажатие и обновление состояния кнопок. HTML-подсветка в произносимый текст не попадает.

`lessons.json` меняет `content_version`: `static-bb3e3ddf1c5daf12` → `static-349bdcbccac30b33`. Новый manifest, клиентская версия и service worker согласованы локально.

024 сохраняет старый manifest в приватной `manifest_before_024()`, обновляет manifest и добавляет replay версии 023 в reader/writer. Quiz catalog не заменяется: его значения, определения и прежние архивы остаются прежними. Старые replay-ветви и обработчики answer/finish сохраняются. Действующие 24 и исторические 10 вопросов урока №5 остаются в том же банке, с прежними ID и наградой.

Миграция выполняется одной транзакцией, проверяет определения, MD5, owner, ACL и настройки функций, исходный manifest и архивы; повторное применение запрещено. Она не содержит DML над пользовательскими таблицами. Проверки намеренно отклоняют дрейф определений и прав, существующую резервную функцию и неожиданные default grants.

[024 SQL](../supabase/migrations/202611270024_noun_tables.sql), [read-only preflight](../supabase/checks/024_noun_tables_preflight.sql), [read-only postflight](../supabase/checks/024_noun_tables_postflight.sql), контракт (локальный файл: `reports/noun-tables/release-contract.json`). SHA256 023 проверен относительно Git и не изменён. Новое подключение к production для получения baseline не выполнялось: исходные ожидаемые определения восстановлены из опубликованных исходников 023, соответствие проверяется guards при будущем применении.

После отдельного разрешения оператора последовательность релиза: read-only preflight 024 и аудит данных → вся транзакция 024 один раз → postflight и сравнение аудита → согласованная публикация клиента. Прежний read-only `023_nouns_data_audit.sql` можно использовать для сравнения пользовательских данных до и после; сама миграция 023 не нужна. Архив текущего quiz catalog при 024 не создаётся, поскольку банк не изменяется; будущие изменения банка должны явно учитывать replay обеих версий 023 и 024.

## Проверки

| Проверка | Результат и доказательство |
| --- | --- |
| Таблицы на 390 / 768 / 1440 px и дополнительно 320 px, RU / UK / EN / SV | 16 компоновок; 7 таблиц и 160 ячеек форм в каждой; без переполнения и обрезанных кнопок. Отчёт (локальный файл: `reports/noun-tables/table-browser.json`) |
| Весь урок и все состояния итогового теста | 20 компоновок главы и 480 состояний теста; упражнения, письмо, обратная связь, смена языка, reload, возврат к правилу, результаты 20/24 и 24/24. Отчёт (локальный файл: `reports/noun-tables/browser-verification.json`) |
| Проверки контента и логики | 408 ветвей практики, 384 ветви теста, пороги 19/20/24, исторические результаты, прежняя пожизненная награда; 2864 TTS-сегмента. Отчёт (локальный файл: `reports/noun-tables/content-check.json`) |
| Кнопки звука новых таблиц | 1600 проверок команд во всех языках и обоих темпах, остановка и повторный запуск. Отчёт (локальный файл: `reports/noun-tables/table-browser.json`) |
| Нативный TTS | Локальный голос sv-SE «Алва», обе скорости и böckerna / fönstren / lärarna / äpplena; тёплый замер медленного темпа в 1.31 раза дольше обычного. Громкость нулевая; акустическое качество на слух не оценивалось. Отчёт (локальный файл: `reports/noun-tables/native-audio.json`) |
| Локальный PostgreSQL | 59 проверок; fixture восстановлен из определений после 023, сама 023 не исполнялась. Проверены неизменность строк, каталога и архивов, частично отвеченные сессии, duplicate receipts, replay 020–023, пороги и награда. Кластер остановлен. Отчёт (локальный файл: `reports/noun-tables/sql-tests.json`) |
| Реальная офлайн-очередь браузера | IndexedDB / Web Locks; 020–023, потерянный ACK, неизменность UUID / JSON / contentVersion, сохранность строк другого аккаунта и неизвестной версии. RPC подставной, production не используется. Отчёт (локальный файл: `reports/noun-tables/queue-browser.json`) |
| Реальный service worker без сети | Обновлённый кэш, загрузка главы, 24 вопроса, 35 XP один раз в гостевом fixture. Отчёт (локальный файл: `reports/noun-tables/offline-browser.json`) |
| Общий renderer | Побайтное равенство HTML уроков №3 / №4 прежнему renderer в RU / UK / EN / SV. Лог (локальный файл: `reports/noun-tables/shared-renderer.log`) |
| Регрессии | 15 наборов: pronouns, presens, greetings, alphabet, локализации, quiz/session/rewards, progress/RPC models, service worker, controls, study time, SRS и PWA. Отчёт (локальный файл: `reports/noun-tables/regression-tests.json`) |
| Локальный HTTP-сервер | 11 тестов, включая загрузку JS/CSS урока и защиту приватных файлов. Лог (локальный файл: `reports/noun-tables/server-tests.log`) |
| Генераторы и manifest | Контент и 024 воспроизводятся побайтно; 6 сценариев генератора, сохранность опубликованных миграций и банков. Отчёт (локальный файл: `reports/noun-tables/generator-verification.json`) |

Во время проверки локального сервера исправлен его список публичных ресурсов: ранее renderer, CSS урока и PWA-ресурсы возвращали 404. В серверном тесте актуализировано устаревшее ожидание версии неизменённого модуля progress. Проверки очереди выполняются на отдельном локальном статическом origin, поскольку основной сервер правильно запрещает iframe своим CSP.

Основные команды проверки:

```sh
python3 scripts/build_nouns_content.py
python3 scripts/check_supabase_manifest.py
python3 tests/noun-tables-release.py
python3 tests/learning-content-manifest-v2.py
node tests/nouns.cjs
node tests/noun-tables-shared-renderer.cjs
node tests/noun-tables-browser.cjs
node tests/nouns-browser.cjs
node tests/nouns-audio-native.cjs
node tests/nouns-offline-browser.cjs
node tests/nouns-queue-browser.cjs
python3 scripts/test_nouns_sql.py
python3 -m unittest discover -s tests -p test_server.py -v
```

Браузерные тесты используют отдельный Chrome с временным профилем и CDP на 127.0.0.1:9224; основной preview — 127.0.0.1:8766. Тест очереди по умолчанию использует статический тестовый сервер 127.0.0.1:8767. SQL runner принимает только одноразовый локальный кластер, без внешних аргументов подключения, и в текущем checkout направляет проверку на 024.

## Снимки

| Размер | Таблица classroom RU | Дополнительный язык |
| --- | --- | --- |
| 390 px | карточки (локальный файл: `reports/noun-tables/classroom-ru-390.png`) | UK (локальный файл: `reports/noun-tables/classroom-uk-390.png`) |
| 768 px | карточки по две (локальный файл: `reports/noun-tables/classroom-ru-768.png`) | SV (локальный файл: `reports/noun-tables/classroom-sv-768.png`) |
| 1440 px | таблица (локальный файл: `reports/noun-tables/classroom-ru-1440.png`) | EN (локальный файл: `reports/noun-tables/classroom-en-1440.png`) |
| 320 px | дополнительная узкая компоновка (локальный файл: `reports/noun-tables/classroom-ru-320.png`) | UK (локальный файл: `reports/noun-tables/classroom-uk-320.png`) |

В `reports/noun-tables/` также сохранены снимки living и plural-map и полный набор снимков упражнений, письма, результата и разделов главы.

## Изменённые файлы

- [app.js](../app.js)
- [docs/NOUN_TABLES_024_REVIEW.md](../docs/NOUN_TABLES_024_REVIEW.md)
- [lessons.json](../lessons.json)
- [pronouns-lesson.css](../pronouns-lesson.css)
- [pronouns-lesson.js](../pronouns-lesson.js)
- [scripts/build_noun_tables_release.py](../scripts/build_noun_tables_release.py)
- [scripts/build_nouns_content.py](../scripts/build_nouns_content.py)
- [scripts/check_supabase_manifest.py](../scripts/check_supabase_manifest.py)
- [scripts/noun_tables_contract.py](../scripts/noun_tables_contract.py)
- [scripts/nouns_tables.py](../scripts/nouns_tables.py)
- [scripts/nouns_theory.py](../scripts/nouns_theory.py)
- [scripts/test_noun_tables_sql.py](../scripts/test_noun_tables_sql.py)
- [scripts/test_nouns_sql.py](../scripts/test_nouns_sql.py)
- [server.py](../server.py)
- [supabase/checks/024_noun_tables_postflight.sql](../supabase/checks/024_noun_tables_postflight.sql)
- [supabase/checks/024_noun_tables_preflight.sql](../supabase/checks/024_noun_tables_preflight.sql)
- [supabase/migrations/202611270024_noun_tables.sql](../supabase/migrations/202611270024_noun_tables.sql)
- [sw.js](../sw.js)
- [tests/learning-content-manifest-v2.py](../tests/learning-content-manifest-v2.py)
- [tests/noun-tables-browser.cjs](../tests/noun-tables-browser.cjs)
- [tests/noun-tables-release.py](../tests/noun-tables-release.py)
- [tests/noun-tables-shared-renderer.cjs](../tests/noun-tables-shared-renderer.cjs)
- [tests/nouns-audio-native.cjs](../tests/nouns-audio-native.cjs)
- [tests/nouns-browser.cjs](../tests/nouns-browser.cjs)
- [tests/nouns-offline-browser.cjs](../tests/nouns-offline-browser.cjs)
- [tests/nouns-queue-browser.cjs](../tests/nouns-queue-browser.cjs)
- [tests/nouns-release.py](../tests/nouns-release.py)
- [tests/nouns.cjs](../tests/nouns.cjs)
- [tests/test_server.py](../tests/test_server.py)

Дополнительно создана папка `reports/noun-tables/` с JSON, логами и PNG-доказательствами. Имеющиеся до начала задачи `reports/nouns/` и два файла baseline 022 не относятся к новой доработке и не должны случайно попасть в будущий commit вместе с ней.

## Предлагаемый стандарт для урока 6

Использовать тот же порядок шести колонок, группировку заголовков, мобильную сетку 2×2 и TTS каждой формы. В уроке №6 раскрыть выбор определённой формы на коротких контекстных парах, используя знакомые существительные и те же визуальные акценты. Урок №6 в этой доработке не изменён.
