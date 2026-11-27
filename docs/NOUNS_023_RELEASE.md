# Урок 5 «Существительные en / ett»: миграция 023 и безопасный выпуск

27 ноября 2026, Europe/Stockholm. **023 подготовлена на основании присланного фактического read-only baseline после 022. Рабочая Supabase не подключалась и не изменялась. Commit, push, merge и deploy не выполнялись.** Применение и публикация остаются отдельными ручными действиями оператора. Финальный локальный прогон: **105 PostgreSQL-проверок — PASS, 11 сценариев генератора — PASS, 15 наборов регрессий — PASS**. Кластер остановлен. [Полный SQL-отчёт](../reports/nouns/sql-tests.json).

## Версии и происхождение

- Подтверждённая установленная версия 022: `static-18bd9e23b62c3382`.
- Новая `content_version` 023: **`static-bb3e3ddf1c5daf12`**. Она совпадает с текущими lessons.json, manifest SQL и app.js. Версия совпадает с ранее рассчитанным локальным кандидатом: содержание урока после передачи baseline не менялось.
- [Исходный baseline](../supabase/baselines/022_installed_for_023.json) сохранён побайтно из `baseline_022.json`; SHA256: `611905a11c9e07ee3c3ef0d4955a3a16e560284da24c56373d7d7c703b7b51c1`.
- Время наблюдения из JSON: `2026-11-27T20:54:52.080912+00:00` (21:54:52 Stockholm). [Происхождение](../supabase/baselines/022_installed_for_023_provenance.json).
- Все четыре исходника baseline совпадают по MD5 с проверенной 022. В локальном PostgreSQL preflight воспроизводит **весь** baseline, включая определения, свойства, пять банков, checksum всего каталога и пять архивов; различается только время наблюдения.
- Baseline содержит внутренние ответы, но не содержит пользовательские строки. Его передача подтверждает состояние функций; фактическая сохранность production-истории проверяется оператором аудитом до/после. Все тестовые пользователи локального PostgreSQL синтетические.

| Функция | MD5 `prosrc` после 022 | MD5 `prosrc` после 023 |
|---|---|---|
| `sl_private.manifest()` | `0a625c1bfee5c4458e4e6b7a6da161c1` | `497a7d88ae6509e51dd7cd26b22e5e80` |
| `sl_private.quiz_catalog()` | `c2913150b7f6e4451410cfdf300d4bea` | `0025ed48bee7255bd7bac515d94324b9` |
| `public.sl_get_progress()` | `2a54002f56a0230fa2f03a89fab871b9` | `da315179151a87bf3ef65d29853a5cb1` |
| `public.sl_apply_event(uuid,bigint,jsonb)` | `82ffbac7b24326523ca60c888c1538c7` | `716c0abbb2ba64ded03208d48e9ddc95` |

[Release contract](../reports/nouns/release-contract.json) содержит SHA256 миграции и baseline, MD5, версии replay и параметры банка. MD5 кандидата рассчитаны по источникам и проверяются по `pg_proc` после настоящего исполнения SQL в локальном PostgreSQL. Guards дополнительно проверяют MD5 **полных определений**, owner, ACL, `search_path`, SECURITY DEFINER; изменение объявления без изменения `prosrc` также отклоняется.

## Подготовленные файлы

- [202611270023_nouns.sql](../supabase/migrations/202611270023_nouns.sql) — самостоятельная миграция одной транзакцией.
- [023_nouns_preflight.sql](../supabase/checks/023_nouns_preflight.sql) — read-only повторное снятие полного состояния перед применением.
- [023_nouns_data_audit.sql](../supabase/checks/023_nouns_data_audit.sql) — одинаковый read-only аудит до/после.
- [023_nouns_postflight.sql](../supabase/checks/023_nouns_postflight.sql) — точный manifest, банк, история, версии архивов и приватность.
- [023_nouns_fingerprints.sql](../supabase/checks/023_nouns_fingerprints.sql) — контрольные MD5 и свойства четырёх функций и всех прежних архивов.
- [build_nouns_release.py](../scripts/build_nouns_release.py), [nouns_contract.py](../scripts/nouns_contract.py) — воспроизводимый генератор и валидация baseline; без БД и сети. Генератор отказывается перезаписывать существующую 023.
- [test_nouns_sql.py](../scripts/test_nouns_sql.py), [nouns-release.py](../tests/nouns-release.py) — тесты PostgreSQL, сохранности и генератора.

## Что меняет 023

Lesson ID остаётся `lesson-5`. Все прежние поля урока и `q0`…`q9` с ответами сохранены. Новый банк: `nouns-final-v1`, версия 1; 24 активных ID `nouns-final-v1-q01`…`q24`, всего 34 исторических и новых ID. [Банк](../reports/nouns/candidate-bank.json), [разбор вариантов](../reports/nouns/option-audit.json).

Миграция сохраняет полный фактический manifest и каталог 022 как `manifest_before_023()` и `quiz_catalog_before_023()`. Они закрыты для PUBLIC, anon и authenticated. Пять прежних архивов остаются побайтно и с прежними свойствами. Меняется только банк урока 5; все остальные lesson/book/topic/video банки проверяются на полное равенство. В manifest меняются версия и активное число вопросов урока 5 с 10 на 24.

Reader добавляет `nouns_final_v1`, `event_replay:static-18bd9e23b62c3382` и проекцию `assessment:nouns-final-v1` для завершённых trusted-сессий с точным набором новых ID. Старый лучший результат `lesson:lesson-5`, предыдущие проекции уроков 1–4 и все остальные поля сохраняются. Прежний 10/10 не превращается в результат нового банка.

Writer расширен двумя ветками выбора manifest/каталога для 022. Существующие replay 020 (`static-1aa3eb8422e2930a`) и 021 (`static-57b40b608d91091d`) сохранены. Вся часть writer от обработки answer/finish/abandon до конца совпадает с baseline побайтно: scoring, ownership, revision, receipts и lifetime ledger не переписаны. UUID, JSON, ответы и `content_version` старых событий не заменяются. При повторе подтверждённого UUID возвращаются сохранённые applied_revision/quiz_result с актуальным snapshot; новый XP не создаётся. Изменённое тело под тем же UUID отклоняется.

Ключ lifetime-награды остаётся **`lesson:lesson-5`, 35 XP**. Порог 80%: 19/24 — без награды, 20/24 — прохождение. Старое награждённое прохождение исключает повторные 35 XP в новом банке; старое прохождение, доставленное из офлайн-очереди, использует тот же ledger. Практика и свободное письмо не добавляют XP-событий. Auth/RPC/IndexedDB/queue runtime не изменялись.

Миграция не содержит DML над пользовательскими таблицами. Перед заменой функций берётся краткий SHARE-lock пяти таблиц: accounts/results/lessons/sessions/events. Это стабилизирует проверку reservations до COMMIT. `lock_timeout=10s`, `statement_timeout=60s`; при блокировке выпуск прекращается, guards не обходятся. Любой guard failure, включая неожиданные default grants новых архивов и ошибку после замены функций, откатывает всю транзакцию. Миграции 001–022 не изменялись и в тесте не переисполнялись 018–022.

## Аудит истории

Один и тот же [data audit](../supabase/checks/023_nouns_data_audit.sql) исполняется непосредственно до/после обновления, **до клиентской публикации и acceptance-тестов**, в окне без учебных записей. Он выдаёт счётчики и детерминированные fingerprints полных строк всех 15 progress-таблиц: accounts, words, sessions, lessons, content, events, imports, quiz_results, study_preferences/leases/periods/days/receipts, review_queue/receipts. Включены события без связанной lesson-сессии и пустые таблицы. Дополнительно выдаются общий XP и подробные агрегаты результатов/завершений/сессий/XP-событий уроков 1–5. ID пользователей и тексты ответов не выводятся.

Два счётчика должны быть нулевыми: завершённый урок 5 без `rewarded` reservation и историческое положительное XP-событие урока 5 без reservation. Оба условия независимо проверяются самой миграцией. При нарушении — остановка и разбор, без автоматической компенсации, сброса прогресса или ремонта ledger.

В локальном тесте сравниваются также **полные строки всех public/auth/storage таблиц**, а не только их hashes. [SQL data audit](../reports/nouns/sql-data-audit.json) сохраняет результаты до/после и SHA256 их вывода. Различия в production могут возникнуть от обычной активности; их нельзя выдавать за доказанную потерю или за допустимую миграцию без разбора.

## Проверки и границы доказательств

[sql-tests.json](../reports/nouns/sql-tests.json) и [лог](../reports/nouns/sql-tests.log) — приёмка фактического файла 023 в изолированном PostgreSQL 14.20. Проверен финальный SQL SHA256 `ceeed3cbc87d265c2c6612708efb0750ae7a7a1e25ac2a8756ed3a609dfd5dd0`. Восстановлены точные присланные определения/архивы 022 поверх схемы 001–017; Auth/Storage представлены локальными SQL-заглушками. Кластер имеет временный каталог, закрытый Unix-сокет, отключённый TCP; переменные PG удаляются, внешние параметры соединения запрещены; кластер останавливается в `finally`.

Проверяются:

- Четыре исходных MD5, полный baseline и свойства; отказ при source/declaration/ACL drift, изменённом каталоге или архиве, уже существующем 023 backup и неверном reservation; атомарный rollback после всех замен.
- Неизменность всех пользовательских строк и аудита, всех прежних архивов, исторических ответов, остальных банков и проекций 1–4.
- Старые активные сессии уроков 1–5; активные 020/021/022 сессии; неизменные подтверждённые квитанции start/answer/finish; защита от повторного UUID с другим JSON.
- Подготовленные **до миграции** офлайн-пакеты start/answers/finish для 020/021/022 с неизменными UUID/JSON/version и повтором каждого события после потери ACK; выбор архивных банков уроков 1–4 для всех трёх версий.
- 19/24, 20/24, повтор 24/24, награждённый исторический пользователь, конкурентные первые finish и две проходящие попытки с revision conflict/retry — без двойного XP.
- Неизвестная версия, новый банк под каждой старой версией, старый банк под 023, смешанные/повторные ID, подделка correctness, незавершённая/чужая сессия; приватность каталогов; все postflight/fingerprint checks.

[Generator verification](../reports/nouns/generator-verification.json) — побайтная воспроизводимость и 11 сценариев, включая отсутствие/изменение baseline, неверные MD5/источники/банк/архив/права/версию и существующий кандидат. [Регрессии](../reports/nouns/regression-tests.json) — 15 прошедших наборов статического контента, уроков 1–5, локализаций, quiz/session/rewards, service worker и Supabase-клиента. RPC-модель остаётся клиентской моделью; её проверки дополняют настоящие PostgreSQL-тесты.

Браузерные скриншоты, офлайн/IndexedDB/TTS-отчёты и [языковой обзор](NOUNS_EN_ETT_LESSON_REVIEW.md) относятся к этапу подготовки главы 23 ноября; в этом этапе их повторно не снимали. Независимая языковая экспертиза специалистом, production Auth/HTTP/Storage, доставка писем и реальный телефон этим SQL-тестом не проверяются. Политики/схема production не экспортированы в baseline; поэтому перед выпуском обязательны свежие preflight, audit и postflight.

## Локальный пакет и повторение

[release-package.json](../reports/nouns/release-package.json) содержит путь, release-key и SHA256 runtime. Пакет собран локально; каждый хеш проверен. В него не входят baseline, SQL, scripts, tests, docs и внутренние отчёты. Он **не опубликован**. В корневом sw.js release ID `2026-11-27-nouns-023`; сборщик выводит digest полного runtime и согласованный sw.js пакета.

Из корня репозитория, без production credentials:

```sh
python3 tests/nouns-release.py
python3 scripts/check_supabase_manifest.py
python3 scripts/test_nouns_sql.py
node scripts/validate_learning_content.cjs
node tests/nouns.cjs
node tests/alphabet-pronunciation.cjs
node tests/alphabet-final-test.cjs
node tests/greetings-introduction.cjs
node tests/pronouns.cjs
node tests/presens.cjs
node tests/learning-content-v2.cjs
node tests/lesson-localization.cjs
node tests/quiz-localization.cjs
node tests/quiz-rewards.cjs
node tests/quiz-session.cjs
node tests/service-worker.cjs
node tests/supabase-preparation.cjs
```

Для PostgreSQL могут потребоваться локальные права на shared memory, которые песочница блокирует. Это не требует внешней БД. Генератор уже выполнен: повторный запуск в рабочем дереве ожидаемо откажет в перезаписи 023; воспроизводимость проверяется во временной копии. Не удалять кандидат для обхода этого барьера и не запускать старые генераторы 018–022.

Новая упаковка — только в отсутствующую папку, без публикации:

```sh
python3 scripts/build_deploy.py /private/tmp/svenska-nouns-023-new-package
```

## Ручной выпуск после отдельного разрешения

1. Проверить целевой Supabase project и источник публикации. Сохранить резервную копию БД/функций. Назначить короткое окно без учебных записей; по возможности дождаться ACK текущих онлайн-устройств. Офлайн-очереди, localStorage и IndexedDB сохранять. Если merge запускает автоматический deploy, не выполнять его до server postflight.
2. Снять свежий **read-only preflight**. Сравнить весь JSON с сохранённым baseline, исключая только `observed_at`: четыре функции/MD5/owner/ACL/config/definer, полный manifest, checksum каталога, банки 1–5, все архивы и флаги. При отличии остановиться; guards не отключать.
3. Выполнить **data audit до**, сохранить вывод в защищённом месте. Оба счётчика отсутствующих reservation должны быть нулевыми.
4. Только после отдельного разрешения на production SQL вручную выполнить **полный файл 023 одной транзакцией BEGIN…COMMIT от postgres**. Не запускать `supabase db push`, не переисполнять 018–022 и не выполнять отдельные внутренние блоки.
5. До публикации выполнить **оба read-only файла postflight и fingerprints**. Все boolean checks — `true`; версия и четыре MD5 — из таблицы после 023. Проверить 24 активных/34 всего, reward 35, исторические ответы и все остальные банки, приватность новых архивов и неизменность старых.
6. Повторить **тот же data audit**. В спокойном окне вывод должен совпасть побайтно с «до», включая XP и fingerprints всех таблиц. До успешного сравнения клиент не публиковать. При расхождении остановиться и установить причину.
7. После успешных серверных проверок и отдельного разрешения на публикацию выпустить полный согласованный runtime. Сверить опубликованные app.js/lessons.json/renderer/sw.js с package inventory. Проверить snapshot нового клиента: `content_version=static-bb3e3ddf1c5daf12`, capability `nouns_final_v1` и все три `event_replay:*`.
8. На специально выбранном тестовом аккаунте проверить старые результаты 1–5, возобновление старой попытки, новый результат и повтор без XP; очередь 020/021/022 обновлённым клиентом, потерю ACK и гостевой офлайн. Историю обычных пользователей не подменять.

Следующие команды — **шаблоны для ручного запуска оператором**. Агент их к рабочей Supabase не выполнял. `DATABASE_URL` заранее настраивается оператором для проверенного проекта и не записывается в репозиторий.

Read-only этапы 2–3:

```sh
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/023_nouns_preflight.sql > /private/tmp/nouns-023-preflight.txt
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/023_nouns_data_audit.sql > /private/tmp/nouns-023-data-before.txt
```

Изменяющий production этап 4, только после отдельного разрешения:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/202611270023_nouns.sql
```

Read-only этапы 5–6:

```sh
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/023_nouns_postflight.sql > /private/tmp/nouns-023-postflight.txt
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/023_nouns_fingerprints.sql > /private/tmp/nouns-023-fingerprints.txt
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/023_nouns_data_audit.sql > /private/tmp/nouns-023-data-after.txt
diff -u /private/tmp/nouns-023-data-before.txt /private/tmp/nouns-023-data-after.txt
```

Сервер обновляется первым; клиент публикуется после postflight и аудита. Старые вкладки могут требовать обновления; бесшовное переключение без обновления вкладок не обещается. Новый клиент отправляет известные старые события по объявленным replay capabilities. Неизвестная версия должна остановить очередь с сохранением исходных событий; нельзя переписывать их версию или UUID ради обхода проверки manifest.

При ошибке до COMMIT выполнить ручной ROLLBACK при необходимости, сохранить ошибку и повторить preflight/audit: функции и история должны остаться исходными. После успешного COMMIT не восстанавливать отдельные функции и не запускать старые миграции: уже могли появиться новые сессии/события 023. Остановить дальнейшую публикацию и подготовить отдельно проверенное исправление с совместимостью всех существующих поколений. Даже полный restore БД требует отдельного согласованного плана, чтобы не потерять новые события.
