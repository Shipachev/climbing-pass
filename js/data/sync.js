import { rebase } from './local.js';
export async function api(path, options = {}) {
  const response = await fetch(path, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  const body = await response.json();
  if (!response.ok) {
    const err = Error(body.error || 'Ошибка сервера');
    err.status = response.status;
    err.code = body.code;
    err.snapshot = body.snapshot;
    err.key = body.key;
    throw err;
  }
  return body;
}
export class Sync {
  constructor(repository, user, onChange = () => {}, transport = api) {
    this.transport = transport;
    this.repository = repository;
    this.user = user;
    this.onChange = onChange;
    this.status = 'Сохранено на устройстве';
    this.attempt = 0;
    this.poll = setInterval(() => {
      if (!document.hidden) this.run();
    }, 30000);
  }
  async locked(fn) {
    return navigator.locks.request(`climbpass-${this.user.id}`, fn);
  }
  run() {
    if (this.stopped) return Promise.resolve();
    if (this.pending) return this.pending;
    this.pending = this.perform().finally(() => {
      this.pending = null;
    });
    return this.pending;
  }
  async perform() {
    clearTimeout(this.timer);
    this.timer = null;
    if (this.running) return;
    if (!navigator.onLine) {
      this.status = 'Нет сети';
      await this.onChange();
      return;
    }
    this.running = true;
    this.status = 'Синхронизация';
    await this.onChange();
    try {
      await navigator.locks.request(`climbpass-sync-${this.user.id}`, async () => {
        const session = await this.transport('/api/session');
        if (session.user.id !== this.user.id) {
          const err = Error('Сменился аккаунт. Войдите повторно');
          err.status = 401;
          throw err;
        }
        this.csrf = session.csrf;
        let record = await this.repository.read();
        if (record.conflicts.length) {
          this.status = 'Есть конфликт';
          return;
        }
        // Push first: an accepted operation lost in transit must be deduplicated
        // before pulling its own changes, otherwise it appears as a false conflict.
        while (record.outbox.length) {
          const op = record.outbox[0];
          try {
            const result = await this.transport('/api/sync', {
              method: 'POST',
              headers: { 'X-CSRF-Token': this.csrf },
              body: JSON.stringify(op),
            });
            record = await this.locked(async () =>
              this.repository.write(rebase(await this.repository.read(), result, [op.id])),
            );
          } catch (err) {
            if (err.status === 409 && err.snapshot) {
              record = await this.locked(async () =>
                this.repository.write({
                  ...rebase(await this.repository.read(), err.snapshot),
                  conflicts: [{ operation: op, reason: err.message, key: err.key || null }],
                }),
              );
              this.status = 'Есть конфликт';
              return;
            }
            throw err;
          }
          if (record.conflicts.length) {
            this.status = 'Есть конфликт';
            return;
          }
        }
        const pulled = await this.transport(`/api/sync?cursor=${record.cursor}`);
        if (pulled.cursor >= record.cursor)
          record = await this.locked(async () =>
            this.repository.write(rebase(await this.repository.read(), pulled)),
          );
        this.status = record.conflicts.length
          ? 'Есть конфликт'
          : record.outbox.length
            ? 'Сохранено на устройстве · ожидает отправки'
            : 'Синхронизировано';
        this.attempt = 0;
        this.error = null;
      });
    } catch (err) {
      this.status =
        err.status === 401 || err.status === 403 ? 'Нужно войти' : 'Ошибка синхронизации';
      this.error = err.message;
      if (![401, 403].includes(err.status))
        this.timer = setTimeout(() => this.run(), Math.min(60000, 1000 * 2 ** this.attempt++));
    } finally {
      this.running = false;
      await this.onChange();
      const record = await this.repository.read();
      if (
        record.outbox.length &&
        !record.conflicts.length &&
        !this.timer &&
        ['Синхронизировано', 'Сохранено на устройстве · ожидает отправки'].includes(this.status)
      )
        this.timer = setTimeout(() => this.run(), 250);
    }
  }
  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.poll);
  }
}
