# Диагностика локальной выдачи JavaScript и фотографий

Проверено 17 октября 2026 через настоящие HTTP-запросы.
Supabase SQL, ключи, учебные материалы и фотографии не изменялись.
Деплой не выполнялся. localStorage, XP, резервные копии и SQLite-файлы
пользователя не удалялись. Запись прогресса в Supabase не включалась.

## Причины

### JavaScript: устаревший процесс сервера

Порт 8765 занимал Python PID **60454**, запущенный в **21:11:04** по Стокгольму.
`lsof -a -p 60454 -d cwd` подтвердил рабочую папку
`/Users/yuliia/Desktop/Projects/Svenska_Latt`; аргументы процесса — `python3 server.py`.
Это нужный проект, но загруженная в память версия серверного кода была старой.
Файл server.py на диске обновлён позже, в 21:32:28.

`supabase-progress.js` существует, а HTML использует правильный путь
`./supabase-progress.js?v=1`. До перезапуска запрос возвращал **404**, MIME
`application/json` и `{"ok":false,"error":"Not found"}`. Старый обработчик имел
предыдущий список разрешённых статических файлов. Это ошибка доступа к пути,
а не неправильное определение MIME для существующего JavaScript-файла.

После остановки только PID 60454 запущен актуальный server.py из той же папки.
На момент проверки новый процесс — **PID 61571**. Запуск теперь печатает URL,
абсолютную папку проекта и PID; при занятом порте он сообщает об ошибке до
создания базы данных и не пишет ложное сообщение об успешном запуске.

### Фотографии: локальная CSP конфликтовала с Service Worker

Проверены **1003 уникальных URL** из `flashcard-media.js` (1006 привязок к словам):
даже до перезапуска все возвращали 200. Пропавших файлов в этом реестре нет.
Локальные `flashcard-media.js` и `atelier.js` побайтово совпадают с опубликованными.
Дополнительно скачаны `work.webp`, `v-fråga.webp`, `w-åtta.webp` с GitHub Pages:
ответ 200, MIME image/webp, байты совпадают с локальными файлами.

Декоративные фотографии и обложки используют внешний Pexels. В локальных
HTTP-ответах (включая `/sw.js`) `img-src` разрешал Pexels, но `connect-src`
разрешал лишь self и Supabase. Worker в `cachePhoto()` загружает внешние картинки
через `fetch()`, на который действует connect-src его собственной CSP.
На GitHub Pages у ответа `/sw.js` заголовка CSP нет — отсюда разница политик.
Проверенная внешняя фотография главной страницы Pexels отвечает 200, image/jpeg.

В CSP разрешены два уже используемых worker домена фотографий:
`https://images.pexels.com` и `https://upload.wikimedia.org` — в img-src и connect-src.
Произвольные источники не открывались. Правила CSP worker и fetch описаны в
[документации CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy)
и [connect-src](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/connect-src).

## Кеширование

- Runtime JS/CSS, HTML и sw.js локально отдаются с Cache-Control: no-cache.
- Регистрация worker использует updateViaCache: none и явный update().
- Версия кеша worker изменена на `2026-10-17-local-http-fix-1`.
- Обновляется только кеш ресурсов приложения. Команды очистки localStorage,
  пользовательского прогресса или резервных копий не добавлялись.
- Принудительной автоматической перезагрузки посреди занятия нет.

## Реальные HTTP-проверки после перезапуска

| Путь | Статус | MIME | Содержимое |
| --- | --- | --- | --- |
| `/supabase-progress.js?v=1` | 200 | text/javascript | 5708 байт, совпадает с диском |
| `/app.js?v=50` | 200 | text/javascript | совпадает с диском |
| `/sw.js` | 200 | text/javascript | совпадает с диском, исправленная CSP |
| `/assets/flashcards/work.webp` | 200 | image/webp | совпадает с диском |
| `/assets/flashcards/v-prata.webp` | 200 | image/webp | совпадает с диском |
| `/assets/flashcards/v-fr%C3%A5ga.webp` | 200 | image/webp | совпадает с диском |
| `/assets/flashcards/w-%C3%A5tta.webp` | 200 | image/webp | совпадает с диском |
| `/assets/flashcards/w-r%C3%B6d.webp` | 200 | image/webp | совпадает с диском |

Также повторно проверены по HTTP все 1003 уникальные фотографии: 200, image/webp,
побайтовое совпадение с диском. Регрессионные Python-тесты запускают отдельный
настоящий сервер с временной БД и проверяют JS, query-параметры, байты фотографий,
UTF-8/NFD-пути, CSP worker, занятый порт и защиту приватных файлов. Сервер тестов
специально запускается из другой рабочей папки: ROOT берётся из server.py.

Полученный с работающего порта 8765 JavaScript выполнен в Node VM с локальными
браузерными глобальными объектами: `SVProgressDebug.status` определён,
`status()` без авторизации возвращает `idle`. Это проверка HTTP-загрузки и
определения API, **не выполнение страницы в настоящем графическом браузере**.
Подключённого браузера в сессии нет, визуальная проверка не выполнена.

## Как проверить в браузере

Сервер уже перезапущен. Для ручного запуска сначала остановить текущий сервер
(Ctrl+C в его терминале; для отдельного процесса узнать PID через
`lsof -nP -iTCP:8765 -sTCP:LISTEN` и завершить только этот PID), затем:

```sh
cd /Users/yuliia/Desktop/Projects/Svenska_Latt
python3 server.py
```

Открыть **http://127.0.0.1:8765/#profile**, выполнить жёсткое обновление страницы.
Если вкладка давно открыта, в DevTools → Console можно вызвать безопасное обновление
только worker:

```js
await (await navigator.serviceWorker.getRegistration())?.update()
```

После установки новой версии обновить вкладку ещё раз. Не использовать Clear site
data: удаление пользовательских хранилищ для этого исправления не требуется.

Проверить в Console:

```js
typeof SVProgressDebug.status // 'function'
SVProgressDebug.status()
```

Без входа ожидается `idle`; после входа — loading, затем ready или диагностическая
ошибка самого RPC. Ошибка RPC и отсутствие модуля — разные случаи.

В Network проверить `/supabase-progress.js?v=1`: 200 и text/javascript.
Открыть главную страницу, темы, уроки и карточки, проверить изображения и отсутствие
CSP-ошибок загрузки Pexels. Прямые URL для проверки локальных файлов:

- http://127.0.0.1:8765/assets/flashcards/work.webp
- http://127.0.0.1:8765/assets/flashcards/v-fr%C3%A5ga.webp
- http://127.0.0.1:8765/assets/flashcards/w-%C3%A5tta.webp
