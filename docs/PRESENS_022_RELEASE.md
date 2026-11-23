# Безопасный выпуск Presens и миграции 022

23 ноября 2026, Europe/Stockholm. **Техническая подготовка завершена на основании фактического read-only baseline пользователя. Миграция и клиент проверены локально; рабочая Supabase и публикация не изменялись.** Commit, push, merge и deploy не выполнялись.

## Зафиксированный контракт

- Установленная 021: `static-57b40b608d91091d`.
- Подготовленные сервер и клиент 022: `static-18bd9e23b62c3382`.
- SQL: [202611230022_presens.sql](../supabase/migrations/202611230022_presens.sql).
- Фактический baseline: [021_installed_for_022.json](../supabase/baselines/021_installed_for_022.json).
- Происхождение и SHA256 присланного отчёта: [provenance](../supabase/baselines/021_installed_for_022_provenance.json).
- Ожидаемые значения: [release-contract.json](../reports/presens/release-contract.json).
- Состояние подготовки: [release-status.json](../reports/presens/release-status.json).
- Контрольные суммы SQL, проверок и клиентского пакета: [release-package.json](../reports/presens/release-package.json).

Присланный SQL Editor JSON декодирован без замены значений. Проверены версия, четыре MD5, полный manifest, банки уроков 1–4 и наличие архивов `before_021` при отсутствии `before_022`. Сохранены SHA256 исходного вложения и декодированного файла. Агент к production не подключался.

| Функция | Фактически наблюдалось до 022 | Ожидается после 022 |
|---|---|---|
| manifest | `8175977d178067352ad8b0df697de019` | `0a625c1bfee5c4458e4e6b7a6da161c1` |
| quiz_catalog | `0108ee37590e52b64c3cce928aacb7ef` | `c2913150b7f6e4451410cfdf300d4bea` |
| sl_get_progress | `b54fea7e908720a36177e2a6f91d03d6` | `2a54002f56a0230fa2f03a89fab871b9` |
| sl_apply_event | `04a117be1ffcdae4e71fafd405f38534` | `82ffbac7b24326523ca60c888c1538c7` |

MD5 после 022 подтверждены исполнением кандидата в изолированном PostgreSQL, а не наблюдением рабочей БД. Присланный baseline не содержит пользовательских таблиц: production-аудит XP и истории до/после ещё предстоит оператору.

| Банк | До: активных / всех ID | После: активных / всех ID | Награда |
|---|---|---|---|
| lesson-1 | 20 / 33 | 20 / 33 | 35 XP |
| lesson-2 | 20 / 31 | 20 / 31 | 35 XP |
| lesson-3 | 24 / 35 | 24 / 35 | 35 XP |
| lesson-4 | 11 / 11 | 24 / 35 | 35 XP один раз |

## Совместимость и защита данных

Lesson ID остаётся `lesson-4`. Исторические `q0`…`q10` и ответы сохранены. Новый банк `presens-final-v1`, версия 1, использует ID `presens-final-v1-q01`…`q24`. Порог 80% — 20 из 24.

Ключ награды общий: `lesson:lesson-4`. Старое прохождение резервирует lifetime-награду: новый тест не начислит её повторно. Логика оценки, владельцев, квитанций, revision и XP после старта сессии побайтно сохранена. Reader добавляет `assessment:presens-final-v1` по существующему шаблону 021 с полями `correct`, `total`, `rewarded`; нового формата результатов, таблиц или событий нет. Сохранены проекции результатов уроков 1–3.

Миграция не содержит DML к пользовательским таблицам. Сессии, ответы, события, UUID, JSON, награды, XP и результаты остаются на месте. Агрегат лучшего результата при будущих попытках продолжает улучшаться по прежнему контракту; исторические серверные сессии не удаляются.

Writer принимает неизменные старты из двух подтверждённых поколений по замороженным manifest/catalog:

- 020: `static-1aa3eb8422e2930a`, сохранённый архив `before_021`;
- 021: `static-57b40b608d91091d`, новый архив `before_022`.

Reader сохраняет capabilities уроков 1–3, добавляет `presens_final_v1` и объявляет replay обеих версий. Подтверждённые события возвращают прежнюю квитанцию при повторе UUID. Неподтверждённые события отправляются с исходными UUID, JSON и content_version. Нельзя очищать очередь или переписывать её под новую версию. Неизвестные версии, смешанные/повторные ID и новый банк под старой версией отклоняются.

Защиты внутри транзакции 022 проверяют четыре наблюдённых MD5, версию и полный manifest, наблюдённые банки 1–4, архивный manifest 020, отсутствие архивов 022 и reservation исторических наград. После замены каталога проверяются неизменность остальных банков, исторических ответов и награды. Reader/writer сохраняют owner, ACL, SECURITY DEFINER и search_path. Архивные ответы недоступны anon/authenticated.

## Выполненные локальные проверки

[sql-tests.json](../reports/presens/sql-tests.json): **62 проверки PostgreSQL, все пройдены, кластер остановлен**:

- Fixture 021 соответствует фактическому baseline: четыре MD5, полный manifest, банки 1–4.
- Полный откат при изменённых MD5, неверной версии/manifest, подмене архивного каталога или manifest replay, существующем архиве 022, отсутствии reservation старой награды, повреждении исторического ответа/чужого банка и принудительном сбое после всех замен.
- Неизменность всех строк public/Auth/Storage при миграции; сохранение свойств функций; совпадение manifest/catalog с клиентом.
- Старые 11/11, результаты уроков 1–3, незавершённые сессии всех четырёх уроков, подтверждённая квитанция 021, старты 020/021 с исходными UUID/JSON.
- 19/24 без награды; 20/24 с 35 XP; повторный 24/24 без дополнительных XP; старый награждённый пользователь без второй награды.
- Потеря ACK, два одновременных первых finish и две конкурентные успешные попытки с revision conflict: lifetime XP остаётся 35.
- Запрет подмены тела существующего UUID, поддельного `correct`, незавершённого finish и завершения чужой сессии; закрытые права ответов.
- Read-only postflight, fingerprints и аудит исполняются. [Аудит истории/XP](../reports/presens/sql-data-audit.json) до/после идентичен.

Тест создаёт новый кластер `/private/tmp/sl-presens-sql-*`, приватный Unix-сокет, отключает TCP и удаляет PG-переменные из окружения дочерних процессов. Внешний адрес передать нельзя. Пустая схема строится из 001–017, состояние 021 — из определений функций. **Файлы миграций 018–021 не исполняются**, рабочая БД не используется.

Браузерные отчёты подтверждают настоящие IndexedDB/Web Locks с моделью RPC для replay 020/021, неизменность очередей, потерю ACK, изоляцию владельцев и остановку неизвестной версии. Проверен настоящий кэш `2026-11-23-presens-022` с app.js версии `static-18bd9e23b62c3382`, загрузка без сети и гостевой тест. Модель RPC не является production-проверкой; серверный контракт отдельно проверен PostgreSQL-тестами.

Клиентские тесты Presens, пилота, уроков 1–3, quiz rewards/session, локализации, service worker и 111 проверок Supabase progress проходят. [Обзор содержания](PRESENS_LESSON_REVIEW.md) сохраняет отметку: независимая языковая рецензия специалистом и акустическая оценка не проводились.

## Повторная проверка пакета

Из корня репозитория, без подключения к БД:

```sh
python3 tests/presens-release.py
python3 scripts/check_supabase_manifest.py
node scripts/validate_learning_content.cjs
node tests/presens.cjs
node tests/learning-content-v2.cjs
node tests/pronouns.cjs
node tests/quiz-rewards.cjs
node tests/quiz-session.cjs
node tests/service-worker.cjs
node tests/supabase-preparation.cjs
python3 scripts/test_presens_sql.py
```

Генератор `scripts/build_presens_release.py` уже выполнен. Он проверяет фактический baseline, не исполняет SQL и отказывается перезаписывать существующую 022. Не запускать его повторно в рабочем дереве ради выпуска и не удалять кандидат для обхода защиты. SQL, fingerprints, версия клиента и service worker побайтно воспроизведены в отдельной временной копии. Старые миграции 018–021 и их генераторы не запускать.

Локальный пакет собран и проверен: 1925 файлов, 94 257 819 байт; SHA256 файлов совпали с inventory. Он не опубликован. Точное временное расположение, release ID и SHA256 — в [release-package.json](../reports/presens/release-package.json). Baseline, SQL и внутренние отчёты не входят в пакет сайта.

Для новой сборки выбрать отсутствующую папку:

```sh
python3 scripts/build_deploy.py /private/tmp/svenska-presens-022-release
```

Сборщик не перезаписывает существующую папку, проверяет совпадение manifest/клиента/SQL и вычисляет release-key кэша по runtime. Корневой `sw.js` имеет ID `2026-11-23-presens-022`; в собранном пакете он заменён вычисленным digest. Логика PWA не менялась. Публиковать нужно один полный согласованный runtime.

## Ручной выпуск после отдельного разрешения

1. Проверить фактический механизм хостинга и источник публикации. Если merge автоматически запускает Pages, не выполнять его до server postflight. Согласовать короткое окно обновления. Сохранить резервную копию БД и определения функций; на онлайн-устройствах дождаться подтверждения текущих событий. Очереди и хранилища не очищать.
2. Повторить [preflight](../supabase/checks/022_presens_preflight.sql) непосредственно перед применением. Сравнить весь JSON с baseline: версию, четыре MD5, manifest, банки, флаги архивов. Любое отличие — остановка и разбор без отключения guards.
3. Выполнить [data audit](../supabase/checks/022_presens_data_audit.sql), сохранить результат. Оба счётчика lesson-4 без reservation должны быть нулевыми. Иначе остановиться; не компенсировать XP и не исправлять историю автоматически.
4. После отдельного разрешения вручную применить **только полный файл 022 одной транзакцией `BEGIN`…`COMMIT`**. Не использовать массовый `supabase db push`, не переисполнять 018–021 и не запускать отдельные внутренние блоки.
5. До публикации выполнить **оба** read-only файла: [postflight](../supabase/checks/022_presens_postflight.sql) и [fingerprints](../supabase/checks/022_presens_fingerprints.sql). Все контрольные булевы поля должны быть true; версия и MD5 — из столбца «после 022». Проверить 24/35 ID lesson-4, 35 XP, неизменность других банков/архивных ответов, права каталогов и свойства RPC.
6. Повторить data audit. В спокойном окне без параллельных учебных записей агрегаты XP и fingerprints строк должны совпасть побайтно с аудитом до обновления. Обычная учебная активность меняет их и требует отдельного разбора. До успешного сравнения клиент не публиковать.
7. После успешного server postflight и отдельного разрешения публиковать runtime. Сверить опубликованные app.js, lessons.json, общий renderer и service worker с пакетом. Старые вкладки должны загрузить новую версию; затем проверить read-only snapshot: content_version `static-18bd9e23b62c3382`, capability `presens_final_v1` и обе replay-capabilities.
8. На специально выбранном тестовом аккаунте проверить старые результаты 1–4, возобновление попытки, новый тест и повтор без XP. Проверить отправку очереди 020/021 обновлённым клиентом и гостевой офлайн-режим. Не подменять историю обычных пользователей.

Этапы 2–3 можно выполнить в SQL Editor либо следующими **ручными** командами, если оператор уже настроил правильный `DATABASE_URL`. Агент их к production не запускал:

```sh
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/022_presens_preflight.sql > /private/tmp/presens-022-preflight.txt
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/022_presens_data_audit.sql > /private/tmp/presens-022-data-before.txt
```

Этап 4 изменяет рабочую БД и требует отдельного разрешения:

```sh
psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/migrations/202611230022_presens.sql
```

Этапы 5–6, вручную и read-only:

```sh
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/022_presens_postflight.sql > /private/tmp/presens-022-postflight.txt
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/022_presens_fingerprints.sql > /private/tmp/presens-022-fingerprints.txt
PGOPTIONS='-c default_transaction_read_only=on' psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f supabase/checks/022_presens_data_audit.sql > /private/tmp/presens-022-data-after.txt
diff -u /private/tmp/presens-022-data-before.txt /private/tmp/presens-022-data-after.txt
```

Сервер обновляется первым, клиент — после postflight. До этого новый клиент публиковать нельзя. Старые вкладки во время переключения могут требовать обновления; без окна выпуска и обновления вкладок обещать бесшовное переключение нельзя. Строгую проверку manifest не обходить ради старого клиента. Неизвестная версия очереди намеренно останавливается с сохранением событий; известные 020/021 отправляются обновлённым клиентом по advertised replay capabilities.

Если транзакция падает, при необходимости выполнить ручной `ROLLBACK` и повторить preflight: функции и данные должны остаться исходными. После успешного COMMIT не откатывать сервер запуском 021 или восстановлением отдельных функций. Остановить публикацию и подготовить проверенное исправление с совместимостью всех уже созданных сессий.

## Браузерные тесты

Использовать отдельный временный профиль Chrome с DevTools и локальный HTTP-сервер. Тесты принимают только localhost/127.0.0.1 и не используют production Auth/RPC:

```sh
SL_ALPHABET_URL=http://127.0.0.1:8772/ SL_BROWSER_PORT=9334 node tests/presens-browser.cjs
SL_ALPHABET_URL=http://127.0.0.1:8772/ SL_BROWSER_PORT=9334 node tests/presens-offline-browser.cjs
SL_ALPHABET_URL=http://127.0.0.1:8772/ SL_BROWSER_PORT=9334 node tests/presens-queue-browser.cjs
SL_ALPHABET_URL=http://127.0.0.1:8772/ SL_BROWSER_PORT=9334 node tests/presens-audio-native.cjs
```
