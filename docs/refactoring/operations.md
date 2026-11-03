# Эксплуатация ClimbPass

Production введён в эксплуатацию 03.11.2026. Публичный адрес: https://climb-pass.app.shipachev.com/. Результаты проверок собраны в [приёмке](acceptance.md).

## Размещение и доступ

| Компонент | Настройка |
| --- | --- |
| Backend | Node.js >=22.12, MySQL 8, systemd-служба `climbpass` |
| Внутренний адрес | `127.0.0.1:9083` |
| Публичный доступ | NGINX, HTTPS с действующим wildcard-сертификатом |
| Runtime / build / deploy | `climbpass` / `climbpass-build` / `climbpass-deploy` |
| Репозиторий сборки | `/srv/repos/climbpass` |
| Релизы и активная ссылка | `/srv/climbpass/releases/<SHA>`, `/srv/climbpass/current` |
| Реестр успешных релизов | `/srv/climbpass/successful-releases.json` |
| Runtime env | `/etc/climbpass/climbpass.env`, root:root, `0600` |
| Конфигурация публикации | `/etc/climbpass/deploy.json`, root:root, `0600` |
| NGINX | `/etc/nginx/sites-available/climbpass.conf` и ссылка в `sites-enabled` |

Runtime не изменяет код релиза. Сборка выполняется отдельным непривилегированным пользователем без production env. Секреты читает systemd manager и передаёт только нужному процессу. База и отдельный DB-user ограничены схемой `climbpass`.

Общие правила VPS, TLS, backup и release policy принадлежат подключённой документации VPS. Они не дублируются здесь и не изменяются вместе с кодом приложения.

## Локальная настройка и Google-вход

Подготовить MySQL-базу и `.env` по [.env.example](../../.env.example). `APP_ORIGIN` задаётся без завершающего `/`. OAuth-клиент Google имеет тип Web application; redirect URI — `<APP_ORIGIN>/auth/callback`. Для production это `https://climb-pass.app.shipachev.com/auth/callback`. Client ID и secret хранятся в env, а не в Git или GitHub Actions.

После установки зависимостей выполнить миграции и разрешить нужный email:

```sh
npm run migrate
node --env-file=.env scripts/allow-user.js user@example.com enable
npm run dev
```

Для отзыва доступа использовать `disable`. Если OAuth-приложение Google находится в режиме тестирования, аккаунту также нужен доступ в списке Google Test users. Allowlist приложения проверяется отдельно при входе и API-запросах.

Production-администрирование с env выполняется через systemd с `User=climbpass`, `Group=climbpass`, `EnvironmentFile=/etc/climbpass/climbpass.env` и рабочим каталогом активного релиза. Не запускать Node от root и не передавать закрытый env build/deploy-пользователям.

## Публикация

Workflow [.github/workflows/deploy.yml](../../.github/workflows/deploy.yml) запускается для `master` и pull request. Задание `check` выполняет проверки кода, Python-тесты инструментов публикации, модульные тесты, миграции в тестовой MySQL, интеграционные и браузерные сценарии. Публикация выполняется после успешных проверок только при push в `master`.

В GitHub настроены:

| Тип | Имя | Назначение |
| --- | --- | --- |
| Repository secret | `CLIMBPASS_DEPLOY_KEY` | Отдельный приватный ключ Actions → VPS |
| Repository variable | `CLIMBPASS_SSH_KNOWN_HOSTS` | Проверенный Ed25519 host key VPS |
| Repository variable | `CLIMBPASS_SERVER_DEPLOY_ENABLED` | `true` включает публикацию |
| Environment | `production` | Окружение задания deploy |

Входящий ключ разрешает только `deploy <полный SHA>` через forced command. Sudo допускает только фиксированный root-owned trigger. Trigger запускает ограниченное по времени systemd-задание; publisher требует актуальный tip ветки. Отдельный read-only ключ build-пользователя используется в направлении VPS → GitHub. Проверка host keys обязательна в обоих направлениях.

Root-owned инструменты находятся в `/usr/local/sbin/`: `climbpass-deploy`, `climbpass-deploy-trigger`, `climbpass-deploy-ssh`, `climbpass-backup-snapshot`. Их исходники — в [server/vps](../../server/vps/); административное обновление из проверенного коммита выполняется отдельно, а не application hook. Sudoers — `/etc/sudoers.d/climbpass-deploy`, входящий публичный ключ — `/srv/climbpass/deploy-home/.ssh/authorized_keys`.

Publisher проверяет репозиторий и полный SHA, делает штатный SQL-backup, собирает неизменяемый релиз, выполняет миграции, атомарно переключает `current` и перезапускает только ClimbPass. Успех записывается после проверки точной content-version локально и через публичный HTTPS. При ошибке готовности после переключения возвращается прежний код. Повтор уже активного успешного SHA проверяет готовность без сборки, backup и перезапуска.

## Проверка и откат

На VPS под root:

```sh
systemctl status climbpass --no-pager
journalctl -u climbpass -n 100 --no-pager
curl --fail --silent --show-error http://127.0.0.1:9083/health
curl --fail --silent --show-error https://climb-pass.app.shipachev.com/health
```

Ответ `/health` должен содержать `ok: true` и версию выбранного релиза из `dist/release.json`. Версия содержит Git SHA и хеш ресурсов; один HTTP 200 не подтверждает нужный код.

Для ручного отката выбрать полный SHA из реестра успешных релизов и выполнить под root:

```sh
/usr/local/sbin/climbpass-deploy --rollback <полный-SHA>
```

Возврат к сохранённому новому релизу выполняется такой же командой с его SHA. Кодовый откат не откатывает БД: миграции должны сохранять совместимость с удерживаемыми версиями. Publisher удерживает последние три различных успешных релиза, когда они накоплены; неизвестные/неуспешные каталоги не удаляет автоматически. Перед удалением успешного старого релиза проверяет живые ссылки и процессы.

## Резервирование и восстановление

Используется штатный `site-backup`, его расписание, доступ к хранилищу и retention. Project config: `/etc/site-backup/sites/climb-pass.app.shipachev.com.json`. SQL и файлы — отдельные наборы, а не единая атомарная точка времени.

На VPS под root для адресной копии:

```sh
/usr/local/sbin/site-backup databases --site climb-pass.app.shipachev.com
/usr/local/sbin/climbpass-backup-snapshot
/usr/local/sbin/site-backup files --site climb-pass.app.shipachev.com
```

Файловый snapshot содержит активный релиз с зависимостями. Project backup включает настройки приложения, NGINX, systemd, инструменты публикации, SSH-доступ, sudoers, реестр успешных релизов и защищённый исходник перенесённой истории. Фактический состав задаёт серверный project config; шаблон в репозитории не заменяет установленный файл.

Drop-in `50-climbpass-snapshot.conf` добавляет подготовку снимка перед общим файловым заданием. Ручной `site-backup files` не запускает helper сам, поэтому сначала нужен snapshot. Он берёт project lock, затем общий backup lock. Не вызывать helper или `site-backup` под уже удерживаемыми теми же locks.

[verify-backup.py](../../server/vps/verify-backup.py) проверяет выбранные SQL/files наборы, manifest, размеры и SHA-256, восстанавливает код и данные в изолированный контекст. Требуются `--database-set`, `--files-set`, `--commit`; при наличии перенесённой истории также `--owner-email`. Проверка не запускает приложение, OAuth или фоновые службы и не изменяет production-БД. Временные DB/user удаляются после успеха; скачанные артефакты могут содержать секреты и остаются закрытыми. Восстановление всего VPS/ОС/TLS этим инструментом не проверяется.

## Перенос прежней истории

Однократный перенос завершён и принят. Пользовательских операций с JSON нет. Импорт не включён в запуск приложения или каждый deploy.

[scripts/import-production-history.js](../../scripts/import-production-history.js) остаётся административным инструментом: сначала preview, затем отдельный `--apply` после свежего SQL-backup и проверки владельца. Он сохраняет ID, даты, порядок, дубли посещений и существующие программы; отказывается автоматически заменять непустую историю. Исходный файл не публикуется в Git или `dist`. Повторный перенос не требуется для обычного обновления.

## Обслуживание после перехода

Старый статический сайт и временные restore/import artifacts не нужны работающему backend. Их удаление, а также исключение переходных файлов из последующих backup выполняются отдельно после проверки точных путей и действующего состава копий. Завершение приёмки не означает, что эти серверные файлы уже удалены.
