# ClimbPass 3

PWA для абонементов, посещений скалодрома и тренировок. Google-вход по разрешённому email, серверная история, локальная копия IndexedDB и очередь для работы без сети. Один проход расходуется при регистрации посещения; тренировка принадлежит посещению и хранит неизменяемый снимок программы.

## Запуск

Нужны Node.js >=22.12 и MySQL 8. Установить зависимости `npm ci`, подготовить `.env` по `.env.example`, настроить Google OAuth и allowlist согласно [руководству эксплуатации](docs/refactoring/operations.md).

```sh
npm run migrate
node --env-file=.env scripts/allow-user.js user@example.com enable
npm run dev
```

Адрес: http://localhost:4173. Origin должен совпадать с APP_ORIGIN и OAuth redirect URI. Первый вход требует сети. Новый аккаунт получает исходные программы автоматически. Пользовательских операций с JSON нет; резервирование и восстановление выполняются на сервере.

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
- [Результаты приёмки](docs/refactoring/acceptance.md)
- [ТЗ рефакторинга](docs/refactoring-specification.md)

## Статус

Рефакторинг и ввод в эксплуатацию завершены 03.11.2026. Приложение доступно по адресу [climb-pass.app.shipachev.com](https://climb-pass.app.shipachev.com/).

Подтверждены Google-вход, перенос истории и её отображение на втором устройстве, резервирование и изолированное восстановление, ручной откат и возврат. Изменения в `master` проходят проверки GitHub Actions и автоматически публикуются. Порядок обслуживания — в [руководстве эксплуатации](docs/refactoring/operations.md), результаты проверок — в [приёмке](docs/refactoring/acceptance.md).
