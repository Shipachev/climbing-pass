// Compatibility facade for legacy callers. New repositories own persistence.
export * from './domain/model.js';
import { validate, migrate, KEY } from './domain/model.js';
import { upgradeStageTypes } from './stages.js';
export function write(s, storage = localStorage) {
  validate(s);
  const json = JSON.stringify(s);
  storage.setItem(KEY, json);
  if (storage.getItem(KEY) !== json) throw Error('Не удалось проверить сохранение');
  return s;
}
export function load(storage = localStorage) {
  const raw = storage.getItem(KEY);
  if (raw !== null) {
    const s = validate(JSON.parse(raw));
    upgradeStageTypes(s);
    if (JSON.stringify(s) !== raw) write(s, storage);
    return s;
  }
  const s = migrate(JSON.parse(storage.getItem('climb_pass') || '[]'));
  write(s, storage);
  return s;
}
