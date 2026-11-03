# Подготовка выпуска ClimbPass на VPS

Статус: локальная проверка принята пользователем; Google OAuth client создан; серверные настройки ClimbPass **ещё не установлены и не проверены**. К VPS пользователь подключается самостоятельно. Настоящий документ — проектный порядок подготовки, не реестр фактических настроек сервера.

## Основные источники и границы

Использовать подключённый проект [VPS](/Users/maximshipachev/Developer/VPS/README.md). В нём прочитаны регламент добавления проекта, PROJECTS, HTTPS, backup, release policy, deploy, контракт Bellboy и точные исходники соответствующих инструментов. Документы этой папки не изменяются без разрешения пользователя.

Владельцы общих правил:

- [NEW_PROJECT_GUIDE](/Users/maximshipachev/Developer/VPS/NEW_PROJECT_GUIDE.md) — порядок размещения и минимальные необходимые отступления.
- [PROJECTS](/Users/maximshipachev/Developer/VPS/PROJECTS.md) — адреса, службы, том, runtime, порты и права; сведения имеют собственные даты проверки и требуют адресного подтверждения перед изменением.
- [HTTPS](/Users/maximshipachev/Developer/VPS/HTTPS_VPS_GUIDE.md) — существующий wildcard, без нового сертификата для ClimbPass.
- [BACKUP_COVERAGE](/Users/maximshipachev/Developer/VPS/BACKUP_COVERAGE.md) — общий site-backup, его расписание, конфиги, locks, проверка S3.
- [RELEASE_POLICY](/Users/maximshipachev/Developer/VPS/RELEASE_POLICY.md) — текущий + два предыдущих успешных релиза, защита используемых файлов и согласование с backup.
- [GITHUB_ACTIONS_VPS_AUTODEPLOY_GUIDE](/Users/maximshipachev/Developer/VPS/GITHUB_ACTIONS_VPS_AUTODEPLOY_GUIDE.md) — exact SHA, отдельные build/runtime/deploy, root-owned trigger и закреплённые SSH host keys.

Прежние примеры самостоятельного SQL-backup/таймеров, /srv/climbpass/shared/.env, sudo-команд административной сессии и выполнения root-деплоя непосредственно из application checkout заменены этой схемой. Не запускать старые примеры из истории обсуждения.

## Выбор для ClimbPass

| Область | Проектное решение, пока не установленное |
| --- | --- |
| Домен | https://climb-pass.app.shipachev.com |
| Repository / branch | Shipachev/climbing-pass, master, полный зафиксированный SHA |
| HTTP | Существующий внешний NGINX, точный server_name и proxy всех UI/API/OAuth-путей; общий статический apps-auto не подходит Node-серверу |
| TLS | Действующий wildcard по владельцу HTTPS; новый Certbot/сертификат не создаётся |
| БД | Существующий MySQL 8.4, отдельная схема/учётная запись climbpass, без изменения глобального MySQL |
| Runtime | Отдельный непривилегированный production-процесс. Сначала проверить наличие совместимого host Node >=22.12; глобальный runtime не устанавливать/не обновлять без оценки. Если host Node отсутствует — проверить существующую контейнерную схему, не копировать исключения Wally автоматически |
| Пользователи | climbpass runtime, climbpass-build сборка, climbpass-deploy ограниченный CI-доступ; все имена перед созданием проверить |
| Размещение | /srv/repos/climbpass checkout; /srv/climbpass/releases/SHA; /srv/climbpass/current; /etc/climbpass/climbpass.env root:root 600 через systemd EnvironmentFile. Точные пути — кандидаты до аудита |
| Порт | 127.0.0.1:9083 — кандидат, свободность пока не подтверждена |
| Backup | Штатный site-backup: MySQL dump отдельной схемы и files-снимок только активного релиза + project config/keys/units. Новых S3-ключей и таймеров нет |
| Deploy | Та же модель, что у подтверждённого Bellboy: root-owned конфиг/entrypoint, build от отдельного пользователя, exact SHA из Git, project-lock → common backup lock, readiness → success ledger → безопасная очистка |
| Уведомления | Новая рассылка Bellboy пока не включается: рабочие события отдельно не поручены. Контракт не является разрешением отправлять тестовые сообщения |

Это штатные варианты существующего регламента, а не требование унификации UI/ORM с Wally. Нужное отличие — Node/MySQL вместо Python/SQLite Bellboy; TLS, доступ, locks, backup и release policy сохраняются.

## Подготовленные файлы проекта

`server/vps/` содержит **кандидатные**, ещё не установленные service, NGINX config, sudoers, deploy config, restricted SSH wrapper/trigger, backup-snapshot helper, site-backup config и drop-in. Wrapper/trigger и snapshot адаптированы из точных Bellboy-исходников подключённого проекта; MySQL дамп не подменяется SQLite или tar живой БД. Общие серверные инструменты не меняются.

Root-owned publisher `/usr/local/sbin/climbpass-deploy` подготовлен в server/vps/climbpass-deploy под подтверждённый host Node; ещё требуется установить его из проверенного commit и проверить ручную публикацию/rollback на VPS. Подготовленные wrappers не являются готовым установленным деплоем. `scripts/deploy.sh` теперь лишь административный вызов этого фиксированного entrypoint. Старый упрощённый скрипт, выполнявший npm от вызывающего root и не учитывавший общий backup lock/retention, больше не используется.

`server/production.env.example` содержит домен и кандидатный порт. Реальный секрет не хранится в Git. Production unit принимает env через systemd manager; для миграции/серверного импорта также использовать отдельное systemd-задание с User=climbpass и EnvironmentFile, а не запуск Node от root или раскрытие root-only env build-пользователю.

`site-backup.json.example` требует существования каждого указанного пути до включения в общее расписание. TLS уже относится к vps-common. Snapshot берёт project-lock, затем common backup lock, фиксирует current target и копирует только его; node_modules пока **не исключается**, поскольку восстановление зависимостей в целевом VPS-контексте ещё не подтверждено. Внешние symlink в активном коде вызывают отказ до определения их покрытия. MySQL/files остаются раздельными наборами общего backup, не заявляются единым атомарным снимком.

Drop-in добавляет ExecStartPre существующей файловой службы: его отказ блокирует общее files-задание. Поэтому установить только после адресной успешной проверки helper. Ручной `site-backup files --site ...` сам helper не запускает: `scripts/backup.sh files` выполняет оба шага. Схема и ограничения соответствуют владельцу backup, без своего S3-клиента.

## Первый серверный этап: только чтение

Следующий блок выполняется **на VPS от root, без sudo**. Он не меняет сервер, не выводит env/ключи/пароли и не запускает деплой:

```bash
whoami
hostname
findmnt /srv
df -h /srv
free -h
command -v node || true
node --version 2>/dev/null || true
command -v npm || true
npm --version 2>/dev/null || true
mysql --version
ss -ltnp
getent passwd climbpass climbpass-build climbpass-deploy || true
ls -ld /srv/repos/climbpass /srv/climbpass /etc/climbpass /srv/www/app.shipachev.com/climb-pass /srv/www/app.shipachev.com/climb-pass/public 2>/dev/null || true
ls -l /usr/local/bin/climb-pass-deploy /usr/local/sbin/climbpass-deploy /etc/nginx/sites-enabled/*climb* 2>/dev/null || true
systemctl show site-backup-files.service -p FragmentPath -p DropInPaths -p ExecStartPre -p ExecStart
systemctl is-active nginx mysql site-backup-files.timer site-backup-databases.timer
```

По результату зафиксировать реальное прежнее расположение ClimbPass, источник старого статического кода, установленный runtime/порт, действующий SSH-механизм и будущие точные пути. Не создавать пользователей/каталоги или устанавливать Node только по этому шаблону. Старый сайт/историю не перемещать и не очищать до отдельного адресного перехода.

## Последующие этапы после проверки фактов

1. Завершить root-owned publisher под подтверждённый runtime, с раздельными правами сборки/runtime, обоими locks и success ledger только после локальной + публичной readiness. Удержание активного и двух успешных rollback-релизов обязательно; кандидатов с живыми refs/cwd/exe/fd/maps/units не удалять. Миграции additive: rollback кода не откатывает БД.
2. Подготовить отдельную MySQL-схему/права, проектный env, точный systemd unit и NGINX конфиг. Использовать имеющийся wildcard. Сначала nginx -t/локальная готовность/Host/SNI, затем переключение публичного traffic. Не менять TLS renewal/firewall соседних приложений.
3. Проверить адресный backup и его обратное чтение/manifest/hash/состав tar, восстановление в изолированный контекст без production-таймеров. Только затем включить проектный config/drop-in в существующее расписание.
4. Проверить ручную публикацию, ошибку до переключения, реальный rollback и возврат. Только после этого добавить CLIMBPASS_DEPLOY_KEY (CI→VPS), отдельный read-only key VPS→GitHub и закреплённый host key в CLIMBPASS_SSH_KNOWN_HOSTS. Runtime env в Actions не переносить. Проверенный текущий host key из документации повторно сверить на VPS.
5. Workflow передаёт `deploy <full SHA>` через ограниченного пользователя; произвольный shell не разрешается. `CLIMBPASS_SERVER_DEPLOY_ENABLED` пока остаётся выключенной. Проверить совпадение публичной content-version с выбранным релизом — HTTP 200 и зелёный Actions не заменяют этого.

## Google и однократный перенос истории

Google client создан пользователем. Callback: `https://climb-pass.app.shipachev.com/auth/callback`, APP_ORIGIN без последнего `/`. Client ID/secret записываются в закрытый серверный env; allowlist настраивается серверным инструментом проекта.

История `history.json` содержит 7 абонементов / 29 посещений и не включается в dist/Git. Перед обновлением сохранить исходный файл и проверенный штатный SQL-backup. После первого входа целевого Google-аккаунта, до создания новых посещений, выполнить `scripts/import-production-history.js` с путём и email: сначала preview, затем отдельный --apply в непривилегированном задании с проектным env. Скрипт сохраняет исходные ID/порядок/дубли, не заменяет программы и отказывается от автоматической замены непустой истории. Стабильный operationId/source hash не даёт повтору создать дубли; данные попадут другим устройствам через sync.

Пользовательского JSON-интерфейса больше нет. В production история ещё не загружена. Не включать этот перенос автоматически в каждый start/deploy.

## Подтверждение первого аудита — 03.11.2026

Источник: предоставленный пользователем вывод root-сессии britt, attachment b363314b-9497-4ee9-8a20-1ba5f5929c33. Общая документация VPS не изменялась.

- /srv действительно смонтирован с /dev/sdb1 (ext4). Свободно 2,1 ГБ, занято 96%; до сборок/трёх релизов/backup требуется оценить текущий состав и пиковое потребление. Это не разрешение удалять файлы.
- /usr/bin/node v22.22.1 и /usr/bin/npm 9.2.0 установлены; выбран штатный host Node + systemd без нового Docker-контейнера и без обновления глобального runtime.
- MySQL client 8.4.11 подтверждён. nginx, mysql и оба backup timer показаны active. Сетевые и dump/grants-проверки проекта ещё впереди.
- В снимке listeners нет 9083. Его можно использовать как кандидатный loopback upstream после повторной проверки непосредственно перед запуском.
- Старый сайт: /srv/www/app.shipachev.com/climb-pass/public, владелец public climb-deploy:climb-deploy. Родитель принадлежит root. Найден /usr/local/bin/climb-pass-deploy, root:root 0755, 506 байт; содержимое пока не получено. Не подменять его до изучения текущего механизма.
- Вывод getent для новых climbpass/climbpass-build/climbpass-deploy пуст, новые проектные каталоги в проверенных путях не показаны: существование/отсутствие перепроверяется перед созданием, без предположений об именах старого deploy-user.
- site-backup-files.service использует штатный site-backup и существующий 50-bellboy-snapshot.conf; его ExecStartPre завершался успешно. Добавление ClimbPass пока не выполнялось.

Следующий адресный этап — read-only обзор верхнего уровня /srv, размер и состав старого public и чтение старого deploy-script. По результату определить точный переход старой статики, запас диска и ручной release pipeline; не чистить соседние проекты, MySQL/binlog или backup на основании одного df.

## Дополнение по второму аудиту — 03.11.2026

Пользователь подтвердил: старый public — обычный каталог 728 КБ с пятью файлами; скрипт /usr/local/bin/climb-pass-deploy берёт flock /home/climb-deploy/deploy.lock, git pull --ff-only из /home/climb-deploy/repo и install пяти статических файлов. Старый deploy-user — climb-deploy, home /home/climb-deploy, shell /bin/bash. Это отдельная существующая схема; её не подменяем новым Node-деплоем до готовности нового upstream и согласованного переключения NGINX.

По предоставленному du основное место занимают /srv/mysql и /srv/www; это не разрешение чистить их. Локальный размер node_modules ClimbPass ~34 МБ, dist ~1 МБ, поэтому предварительная оценка не требует освобождения гигабайтов ради этого приложения. На VPS перед сборкой повторить df и измерить реальный пик; браузерные Chromium binaries на VPS не устанавливаются, E2E остаётся в CI. Независимое обслуживание общего диска не смешивать с выпуском ClimbPass.

Publisher подготовлен по схеме Bellboy: безопасный Git archive, npm ci/check/test от отдельного build-user в очищенном окружении, root-owned code, Node-миграция отдельным systemd transient unit с User=climbpass и закрытым EnvironmentFile. По умолчанию готовность включает точную content-version по loopback и публичному HTTPS; только после неё success ledger и хранение current + двух успешных rollback. Housekeeping не выдаётся за rollback уже работающего релиза. Неудачные/неизвестные каталоги помечаются для административного разбора и не удаляются автоматически; их список нужно проверять после неудачной сборки.

Для первой ручной подготовки предусмотрен --local-only (недоступен CI): разрешён без предварительного site-backup только при доказанно пустой схеме climbpass, ещё до регистрации нового проекта в общем files-задании. Он запускает локальный upstream, но пишет только local-ready marker, не успешную production-публикацию. Старая статика продолжает обслуживаться прежним NGINX. После настройки backup/snapshot, проверки восстановления и переключения точного NGINX-конфига тот же SHA проходит обычную публичную readiness и фиксируется как успешный. Повторная попытка поверх неизвестного каталога требует разбора; существующие данные автоматическим bootstrap не заменяются.

server/vps/prepare-users.sh — отдельный root-скрипт только создания новых пользователей/каталогов, после read-only аудита. Отказывается перезаписывать уже существующие имена/пути. Он не запускает службы и не меняет старый сайт, БД, SSH-ключи или NGINX. Административные права runtime/build не выдаются; ограниченные полномочия deploy-user подключаются отдельно позже. Документация VPS остаётся неизменённой.

## Подготовка пользователей подтверждена — 03.11.2026

По выводу пользователя prepare-users.sh успешно создал runtime climbpass (nologin), build/deploy отдельными пользователями, /srv/climbpass, /srv/repos/climbpass и закрытый /etc/climbpass. Имя /srv/repos/climbpass доступно build-user, остальные родители root:root 0755. Runtime/деплой ещё не запускались. Исходные UID/GID динамически назначены ОС; скрипты не закрепляют их численно.

Следующий адресный инструмент — server/vps/prepare-database.py, передаваемый администратором на VPS. Он требует root и mounted /srv, проверяет отсутствие существующих схемы/DB-user/env, интерактивно принимает Client ID и скрытый Client secret, генерирует пароль БД и сохраняет закрытый /etc/climbpass/climbpass.env без печати секретов. Создаёт только climbpass и отдельного climbpass@localhost с необходимыми DML/DDL-правами на climbpass.*. Точная TCP-учётная запись и выбранная схема проверяются отдельно без передачи пароля в argv. Существующие данные, глобальные MySQL-параметры и соседние проекты не меняются.

При частичном сбое env с сгенерированными реквизитами сохраняется, повторное применение/перезапись запрещены до разбора; автоматического DROP/rotation нет. Серверные миграции/allowlist/импорт выполняются позже непривилегированными заданиями. Приватные Client secret и DATABASE_URL не присылать в чат. После успешного создания БД следующий этап — read-only Git key для climbpass-build и подготовка проверенного опубликованного SHA.

## Подготовка БД подтверждена — 03.11.2026

По итоговым сообщениям пользователя prepare-database.py создал схему climbpass и отдельную учётную запись только с правами на climbpass.*, проверил TCP-подключение и сохранил /etc/climbpass/climbpass.env root:root 0600. Секреты в чат не передавались. Миграции, импорт истории, NGINX и запуск служб ещё не выполнялись.

Следующий этап — отдельный Ed25519 read-only deploy key VPS→GitHub от climbpass-build. Закрытый ключ остаётся в /srv/climbpass/build-home/.ssh/id_ed25519 с правами 0600, в GitHub добавляется только .pub в Shipachev/climbing-pass → Settings → Deploy keys, без Allow write access. Этот ключ не используется для Actions→VPS. Существующий ключ не перезаписывать. После добавления ключа закрепить проверенный GitHub host key, проверить доступ и клонировать master от build-user в подготовленный checkout; не использовать StrictHostKeyChecking=no.

Перед первой публикацией требуется отдельный commit локальных изменений и push: текущая локальная рабочая версия ещё не зафиксирована в Git. Получение старого master на VPS само по себе не является получением рефакторинга. Изменение ключей, checkout и публикация не считаются выполненными до подтверждения.

## Доступ VPS→GitHub: ключ добавлен пользователем — 03.11.2026

Пользователь подтвердил добавление отдельного deploy key в репозиторий. Следующий шаг — server/vps/prepare-git.sh: закрепить опубликованный GitHub Ed25519 host key (официальный источник: https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints), включить StrictHostKeyChecking/IdentitiesOnly/BatchMode и выполнить git ls-remote от climbpass-build с очищенным окружением. Это проверка доступа, не публикация. Приватный ключ остаётся на сервере. Кастомный существующий SSH config скрипт не заменяет. Успех проверки и remote SHA ещё не подтверждены выводом.

## Чтение репозитория подтверждено — 03.11.2026

По выводу пользователя prepare-git.sh прошёл: climbpass-build читает refs/heads/master, remote SHA 98a3ed98f21db79b536098a8c4c2e71cab789aa3. Клонирование/сборка/публикация не выполнялись. Этот SHA относится к прежнему master; локально уже есть более новый документационный commit и пока не опубликованный код рефакторинга. Следующий шаг — зафиксировать и отправить проверенный код, затем клонировать master от build-user и сверить полный SHA. До ручной публикации и отката production job остаётся выключенной.
