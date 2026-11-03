# ClimbPass 3

PWA для абонементов, посещений скалодрома и тренировок. Google-вход по разрешённому email, серверная история, локальная копия IndexedDB и очередь для работы без сети. Один проход расходуется при регистрации посещения; тренировка принадлежит посещению и хранит неизменяемый снимок программы.

## Запуск

Нужны Node.js >=22.12 и MySQL 8. Установить зависимости `npm ci`, подготовить `.env` по `.env.example`, настроить Google OAuth и allowlist согласно [руководству эксплуатации](docs/refactoring/operations.md).

```sh
npm run migrate
node --env-file=.env scripts/allow-user.js user@example.com enable
npm run dev
```

Адрес: http://localhost:4173. Origin должен совпадать с APP_ORIGIN и OAuth redirect URI. Первый вход требует сети. Новый аккаунт получает исходные программы автоматически. Прежняя история из history.json переносится серверной процедурой при обновлении production; пользовательских операций с JSON нет.

## Проверки

```sh
npm run check
npm run build
npm test
```

Для интеграции/E2E задайте DATABASE_URL отдельной БД с именем, заканчивающимся `_test`, APP_ORIGIN=http://localhost:4173; выполните миграции в ней. `npm run test:integration` проверяет реальные транзакции БД. `npx playwright install chromium` и `npm run test:e2e` проверяют два устройства, офлайн, редактор, перенос и ширины 320–1280px. Реальный Google-вход отдельно проверяется с OAuth credentials; тестовые аккаунты создаются только напрямую тестами в специальной БД, обхода входа в приложении нет.

## Документация

- [Инструкция пользователя](docs/user-guide.md)
- [Техническое руководство](docs/implementation.md)
- [Архитектура и решения](docs/refactoring/architecture.md)
- [Настройка, выпуск, резервирование и откат](docs/refactoring/operations.md)
- [Карта экранов и адаптация дизайн-системы](docs/refactoring/screens.md)
- [Отчёт проверок и открытые пункты приёмки](docs/refactoring/acceptance.md)
- [Проверка добавленного history.json](docs/refactoring/history-validation.md)
- [ТЗ рефакторинга](docs/refactoring-specification.md)

## Статус

Реализация подготовлена в рабочем дереве. Production не переключён, OAuth credentials и серверная конфигурация не добавлены. Детальный статус проверенных сценариев и ограничений находится в отчёте. Workflow запускает проверки; production job требует явного включения после подготовки сервера.
