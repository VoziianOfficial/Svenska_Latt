# Сохранение урока №3 в отдельной ветке и draft PR

Команды ниже предназначены для самостоятельного выполнения после решения сохранить и отправить изменения. Агент не выполнял `git add`, `commit`, `push`, `merge` или создание PR.

Проверенное состояние: ветка `feature/sfi-a-lesson-3` уже существует и выбрана; HEAD, локальный `main`, `origin/main` и проверенный GitHub `main` указывают на `68fec12abab13adda95ec88e73733c7f647cabc8`. Upstream для feature-ветки ещё не задан; staged-изменений нет. Не создавать эту же ветку через `git switch -c` заново.

## 1. Проверить актуальность и источник публикации

```sh
cd /Users/yuliia/Documents/GitHub/Svenska_Latt
git status --short --branch
git switch feature/sfi-a-lesson-3
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
git diff --check
```

При проверенном состоянии оба SHA — `68fec12abab13adda95ec88e73733c7f647cabc8`. Если удалённый main изменился, сначала разобрать различия и повторно проверить пакет; не делать автоматический `git pull`, reset или rebase поверх несохранённых изменений.

Локальный `gh` сейчас не авторизован. Пользовательский вход и read-only проверка Pages:

```sh
gh auth login --hostname github.com
gh api --method GET repos/VoziianOfficial/Svenska_Latt/pages \
  --jq '{html_url,status,build_type,source}'
```

Продолжать с порядком merge → Pages только после подтверждения источника `main`/`/` либо проверки фактического workflow. Не переключать источник публикации на feature-ветку. Сама ветка и draft PR не должны публиковать новый клиент до готовности Supabase.

## 2. Подготовить индекс только из проверенных файлов урока

[PRONOUNS_021_GIT_FILES.txt](PRONOUNS_021_GIT_FILES.txt) содержит точный перечень текущих файлов этой задачи: клиент, контент, SQL 021, read-only проверки, документация и результаты тестов. Старые миграции и локальные БД/секреты в него не включены.

```sh
git add --pathspec-from-file=docs/PRONOUNS_021_GIT_FILES.txt
git diff --cached --check
git diff --cached --stat
git diff --cached --name-only
git diff --cached --name-only --diff-filter=D
git diff --cached --name-only -- \
  supabase/migrations/202611160018_alphabet_pronunciation_manifest.sql \
  supabase/migrations/202611160019_alphabet_final_test.sql \
  supabase/migrations/202611160020_greetings_introduction.sql
```

Последние две команды должны вывести пустой результат: удалений и изменений миграций 018–020 нет. Просмотреть staged-список перед commit. Если после подготовки списка появились другие файлы, они не добавятся автоматически; сначала проверить их отдельно. Не использовать `git add -A`, чтобы не захватить посторонние изменения.

## 3. Сохранить и отправить feature-ветку

Только после просмотра staged diff и собственного решения выполнить:

```sh
git commit -m "feat(learning): expand SFI A pronouns lesson and prepare migration 021"
git push --set-upstream origin feature/sfi-a-lesson-3
```

Не делать force push. Это отправляет feature-ветку, не main.

## 4. Создать draft PR без merge

```sh
gh pr create \
  --repo VoziianOfficial/Svenska_Latt \
  --base main \
  --head feature/sfi-a-lesson-3 \
  --draft \
  --title "feat(learning): expand SFI A pronouns lesson and prepare migration 021" \
  --body-file docs/PRONOUNS_021_PR_BODY.md
```

Проверить созданный PR, не меняя его статус:

```sh
gh pr view feature/sfi-a-lesson-3 \
  --repo VoziianOfficial/Svenska_Latt \
  --json number,url,isDraft,baseRefName,headRefName,mergeStateStatus
```

Если PR уже существует, использовать `gh pr view`, а не создавать второй. Альтернатива без CLI: [открыть сравнение main и feature-ветки](https://github.com/VoziianOfficial/Svenska_Latt/compare/main...feature/sfi-a-lesson-3), вставить текст из `PRONOUNS_021_PR_BODY.md` и выбрать Create draft pull request.

## 5. Разрешить публикацию клиента только после сервера

До merge PR оператор вручную выполняет preflight → 021 целиком → postflight и сравнение истории/XP по [PRONOUNS_021_RELEASE.md](PRONOUNS_021_RELEASE.md). Ожидаемая новая версия — `static-57b40b608d91091d`.

После успешного server postflight пользователь отдельно принимает решение о merge. В текущем наблюдаемом сценарии обновление main запускает Pages. Не включать auto-merge заранее. Агент не выполняет эти действия и не выдаёт команды для принудительного merge или повторного запуска старых SQL.
