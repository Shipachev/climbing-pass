import { upgradeStageTypes } from './stages.js';
import { validate, migrate, clone, now } from './store.js';
export const encode = (s) =>
  JSON.stringify({ formatVersion: 2, exportedAt: now(), state: validate(clone(s)) }, null, 2);
export function decode(text) {
  const x = JSON.parse(text);
  if (Array.isArray(x)) return { legacy: true, state: migrate(x) };
  if (x?.formatVersion !== 2 || typeof x.exportedAt !== 'string')
    throw Error('Неподдерживаемая версия резервной копии');
  return { legacy: false, state: validate(upgradeStageTypes(validate(x.state))) };
}
