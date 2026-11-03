import { test, expect } from '@playwright/test';
import { pool } from '../../server/db.js';
import { account, cleanup } from '../integration/helpers.js';
import { migrate, today } from '../../js/store.js';
import { addPass, addVisit } from '../../js/passes.js';
import { start } from '../../js/workouts.js';
import { mkdir } from 'node:fs/promises';
let user;
test.beforeEach(async ({ page }) => {
  const state = migrate([]);
  addPass(state, today(), '2099-12-31', 8);
  user = await account(state);
  await page.addLocatorHandler(page.locator('dialog[open]'), async () =>
    page.getByRole('button', { name: 'Подтвердить', exact: true }).click(),
  );
});
test.afterEach(async () => {
  await cleanup(user);
});
test.afterAll(async () => pool.end());
async function login(context) {
  await context.addCookies([
    {
      name: 'cp_session',
      value: user.token,
      url: 'http://localhost:4173',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
test('посещение → занятие → заметка → офлайн-перезапуск → второе устройство', async ({
  page,
  context,
  browser,
}) => {
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await login(context);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await expect(page.locator('.pass-card')).toBeVisible();
  await page.getByRole('button', { name: 'Отметить посещение', exact: true }).click();
  await page.getByRole('button', { name: 'Начать по программе', exact: true }).click();
  await page.locator('.program-card').first().click();
  await page.getByRole('button', { name: 'Начать тренировку', exact: true }).click();
  await expect(page.locator('.stage-card').first()).toBeVisible();
  await page.getByRole('button', { name: 'Выполнено', exact: true }).click();
  await expect(page.locator('.stage-done')).toHaveCount(1);

  // Choose a training stage from the actual snapshot rather than demo IDs.
  const stepId = await page.evaluate(async () => {
    const user = JSON.parse(localStorage.getItem('climbpass-account'));
    const req = indexedDB.open(`climbpass-user-${user.id}`, 1);
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    const get = db.transaction('records').objectStore('records').get('root');
    const record = await new Promise((r) => (get.onsuccess = () => r(get.result)));
    db.close();
    return record.state.visits[0].workout.content.sections
      .flatMap((s) => s.steps)
      .find((t) => t.type === 'training').id;
  });
  await page.locator(`[data-action="expand/${stepId}"]`).click();
  await page.locator(`[data-note="${stepId}"]`).fill('Личная заметка <без HTML>');
  await expect(page.locator('#save-status')).toHaveText('Сохранено на устройстве');
  await page.screenshot({ path: 'docs/refactoring/screenshots/workout-390.png', fullPage: true });
  const visitUrl = page.url();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.waitForTimeout(500);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.stage-card').first()).toBeVisible();
  await page.locator(`[data-action="expand/${stepId}"]`).click();
  await expect(page.locator(`[data-note="${stepId}"]`)).toHaveValue('Личная заметка <без HTML>');
  await page.locator(`[data-note="${stepId}"]`).fill('Записано без сети');
  await page.locator('h1').click();
  await expect(page.locator('#save-status')).toHaveText('Сохранено на устройстве');
  await page.reload();
  await page.locator(`[data-action="expand/${stepId}"]`).click();
  await expect(page.locator(`[data-note="${stepId}"]`)).toHaveValue('Записано без сети');
  await context.setOffline(false);
  await page.locator('.sync-status').click();
  await page.getByRole('button', { name: 'Синхронизировать', exact: true }).click();
  await expect(page.locator('.sync-status')).toHaveText('Синхронизировано');
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await login(second);
  const other = await second.newPage();
  await other.goto(visitUrl);
  await other.locator(`[data-action="expand/${stepId}"]`).click();
  await expect(other.locator(`[data-note="${stepId}"]`)).toHaveValue('Записано без сети');
  await second.close();
  expect(errors).toEqual([]);
});
test('все размеры, шрифты, редактор и история без горизонтального скролла', async ({
  page,
  context,
}) => {
  await login(context);
  await page.goto('/');
  await expect(page.locator('.pass-card')).toBeVisible();
  await mkdir('docs/refactoring/screenshots', { recursive: true });
  for (const width of [320, 360, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    if (width === 390)
      await page.screenshot({ path: 'docs/refactoring/screenshots/home-390.png', fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Программы', exact: true }).click();
  await page.screenshot({ path: 'docs/refactoring/screenshots/programs-390.png', fullPage: true });
  await page.locator('.program-card').first().click();
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await page.locator('[data-field="title"]').fill('Проверенная новая редакция');
  await expect(page.locator('#save-status')).toHaveText('Сохранено на устройстве');
  await page.reload();
  await expect(page.locator('[data-field="title"]')).toHaveValue('Проверенная новая редакция');
  await page.getByRole('button', { name: 'Сохранить новую версию', exact: true }).click();
  await expect(page.locator('h1')).toHaveText('Проверенная новая редакция');
  await page.getByRole('button', { name: 'История', exact: true }).click();
  await page.getByRole('button', { name: 'Идёт', exact: true }).click();
  await expect(page.getByText('Для выбранного фильтра занятий пока нет')).toBeVisible();
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  await page.screenshot({ path: 'docs/refactoring/screenshots/settings-390.png', fullPage: true });
  expect(await page.evaluate(() => document.fonts.check('500 16px Onest'))).toBe(true);
  expect(
    await page.evaluate(() => document.fonts.check('400 24px "Material Symbols Rounded"')),
  ).toBe(true);
});
test('в настройках и старом маршруте переноса нет операций с JSON', async ({ page, context }) => {
  await login(context);
  await page.goto('/#settings');
  await expect(page.getByRole('heading', { name: 'Аккаунт и синхронизация' })).toBeVisible();
  await expect(page.locator('input[type=file],#import-text,#export-json')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /Скачать|Импорт|Перенести|копирования/ }),
  ).toHaveCount(0);
  await page.goto('/#migration');
  await expect(page.getByRole('heading', { name: 'Хранение данных' })).toBeVisible();
  await expect(page.locator('input[type=file],#import-text')).toHaveCount(0);
});
test('ошибка IndexedDB сохраняет поле, блокирует переход и допускает повтор', async ({
  page,
  context,
}) => {
  await login(context);
  page.on('dialog', (d) => d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: 'Программы', exact: true }).click();
  await page.locator('.program-card').first().click();
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await expect(page.locator('[data-field="title"]')).toBeVisible();
  await page.evaluate(() => {
    window.originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function () {
      throw new DOMException('Storage full', 'QuotaExceededError');
    };
  });
  await page.locator('[data-field="title"]').fill('Текст при ошибке записи');
  await expect(page.locator('#save-status')).toHaveText('Ошибка: изменения не сохранены');
  await page.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(page.locator('[data-field="title"]')).toHaveValue('Текст при ошибке записи');
  await page.evaluate(() => (IDBObjectStore.prototype.put = window.originalPut));
  await page.getByRole('button', { name: 'Повторить сохранение', exact: true }).click();
  await expect(page.locator('#save-status')).toHaveText('Сохранено на устройстве');
  await page.reload();
  await expect(page.locator('[data-field="title"]')).toHaveValue('Текст при ошибке записи');
});
test('реальный конфликт двух устройств сохраняет обе заметки и очередь до выбора', async ({
  page,
  context,
  browser,
}) => {
  const [[row]] = await pool.execute('SELECT state FROM users WHERE id=?', [user.id]);
  const state = typeof row.state === 'string' ? JSON.parse(row.state) : row.state;
  const visit = addVisit(state, state.passes[0].id);
  start(state, visit.id, state.programs[0].id);
  const stepId = visit.workout.content.sections
    .flatMap((s) => s.steps)
    .find((t) => t.type === 'training').id;
  await pool.execute('UPDATE users SET state=? WHERE id=?', [JSON.stringify(state), user.id]);
  await login(context);
  await page.goto(`/#visit/${visit.id}`);
  await page.locator(`[data-action="expand/${stepId}"]`).click();
  const second = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await login(second);
  const other = await second.newPage();
  await other.goto(`/#visit/${visit.id}`);
  await other.locator(`[data-action="expand/${stepId}"]`).click();
  await context.setOffline(true);
  await second.setOffline(true);
  await page.locator(`[data-note="${stepId}"]`).fill('Редакция первого устройства');
  await expect(page.locator('#save-status')).toHaveText('Сохранено на устройстве');
  await other.locator(`[data-note="${stepId}"]`).fill('Редакция второго устройства');
  await expect(other.locator('#save-status')).toHaveText('Сохранено на устройстве');
  await context.setOffline(false);
  await page.locator('.sync-status').click();
  await page.getByRole('button', { name: 'Синхронизировать', exact: true }).click();
  await expect(page.locator('.sync-status')).toHaveText('Синхронизировано');
  await second.setOffline(false);
  await expect(other.locator('.sync-status')).toHaveText('Есть конфликт');
  await other.locator('.sync-status').click();
  await expect(other.locator('.conflict-columns').first()).toContainText(
    'Редакция второго устройства',
  );
  await expect(other.locator('.conflict-columns').first()).toContainText(
    'Редакция первого устройства',
  );
  await other.screenshot({
    path: 'docs/refactoring/screenshots/conflicts-390.png',
    fullPage: true,
  });
  await other.getByRole('button', { name: 'Принять серверную историю', exact: true }).click();
  await other.getByRole('button', { name: 'Подтвердить', exact: true }).click();
  await expect(other.getByText('Конфликтов нет.', { exact: true })).toBeVisible();
  await second.close();
});
test('клавиатура, Escape и увеличение текста 200%', async ({ page, context }) => {
  await login(context);
  await page.goto('/');
  await expect(page.locator('.pass-card')).toBeVisible();
  await page.evaluate(() => (document.documentElement.style.fontSize = '32px'));
  for (const name of ['Программы', 'История', 'Настройки', 'Главная']) {
    await page.getByRole('button', { name, exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: 'Настройки', exact: true }).click();
  // Disable the auto-confirm handler for this explicit accessibility check.
  await page.removeLocatorHandler(page.locator('dialog[open]'));
  await page.getByRole('button', { name: 'Выйти из аккаунта', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Tab');
  expect(await page.evaluate(() => document.activeElement.closest('dialog') !== null)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Выйти из аккаунта', exact: true })).toBeFocused();
});
test('медленный сервер не блокирует локальное сохранение следующего изменения', async ({
  page,
  context,
}) => {
  await login(context);
  await page.goto('/');
  await page.getByRole('button', { name: 'Программы', exact: true }).click();
  await page.locator('.program-card').first().click();
  await page.getByRole('button', { name: 'Редактировать', exact: true }).click();
  await expect(page.locator('[data-field="title"]')).toBeVisible();
  await expect(page.locator('.sync-status')).toHaveText('Синхронизировано');
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  let intercepted;
  const started = new Promise((resolve) => (intercepted = resolve));
  await page.route('**/api/sync', async (route) => {
    if (route.request().method() === 'POST') {
      intercepted();
      await gate;
    }
    await route.continue();
  });
  await page.locator('[data-field="title"]').fill('Первая редакция');
  await started;
  await page.locator('[data-field="title"]').fill('Вторая редакция до ответа сервера');
  await expect(page.locator('#save-status')).toHaveText('Сохранено на устройстве');
  const saved = await page.evaluate(async () => {
    const user = JSON.parse(localStorage.getItem('climbpass-account'));
    const open = indexedDB.open(`climbpass-user-${user.id}`, 1);
    const db = await new Promise((r) => (open.onsuccess = () => r(open.result)));
    const get = db.transaction('records').objectStore('records').get('root');
    const record = await new Promise((r) => (get.onsuccess = () => r(get.result)));
    db.close();
    return record.state.drafts[0].content.title;
  });
  expect(saved).toBe('Вторая редакция до ответа сервера');
  release();
  await expect(page.locator('.sync-status')).toHaveText('Синхронизировано');
});
