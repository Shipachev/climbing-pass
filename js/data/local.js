import { emptyState, changes, guardsFor, apply, flatten, equal } from './graph.js';
import { clone, validate, today } from '../domain/model.js';
const request = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
export function initialRecord() {
  return {
    generation: 0,
    initialized: false,
    state: emptyState(),
    confirmed: emptyState(),
    revisions: {},
    localRevisions: {},
    cursor: 0,
    outbox: [],
    conflicts: [],
    imports: [],
  };
}
export async function openLocal(userId, onBlocked = () => {}) {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw Error('Неверный аккаунт');
  const req = indexedDB.open(`climbpass-user-${userId}`, 1);
  req.onupgradeneeded = () => {
    req.result.createObjectStore('records');
  };
  req.onblocked = onBlocked;
  const db = await request(req);
  db.onversionchange = () => {
    db.close();
    onBlocked();
  };
  const read = async () => {
    const tx = db.transaction('records', 'readonly');
    return (await request(tx.objectStore('records').get('root'))) || initialRecord();
  };
  const write = (record) =>
    new Promise((resolve, reject) => {
      const tx = db.transaction('records', 'readwrite');
      const store = tx.objectStore('records');
      const req = store.get('root');
      req.onsuccess = () => {
        if ((req.result?.generation || 0) !== record.generation) {
          tx.abort();
          return;
        }
        store.put({ ...record, generation: record.generation + 1 }, 'root');
      };
      tx.oncomplete = () => resolve({ ...record, generation: record.generation + 1 });
      tx.onabort = () =>
        reject(tx.error || Error('Данные изменены в другой вкладке. Повторите действие.'));
      tx.onerror = () => {};
    });
  return { read, write, close: () => db.close() };
}
export function enqueue(record, next, options = {}) {
  validate(next);
  if (record.conflicts.length)
    throw Error('Сначала разрешите конфликт или сохраните аварийную копию');
  const patch = changes(record.state, next, record.localRevisions);
  if (!patch.length) return record;
  const operation = {
    id: crypto.randomUUID(),
    protocolVersion: 1,
    mode: options.mode || 'edit',
    day: today(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    createdAt: new Date().toISOString(),
    changes: patch,
    guards: guardsFor(record.state, patch, record.localRevisions),
    ...options,
  };
  const updated = apply(flatten(record.state), record.localRevisions, operation);
  const imports = ['attach', 'restore', 'join'].includes(operation.mode)
    ? [
        ...record.imports,
        {
          id: operation.id,
          sourceHash: operation.sourceHash,
          localCompletedAt: operation.createdAt,
          serverCursor: null,
          idMap:
            operation.idMap ||
            Object.fromEntries(
              ['passes', 'visits', 'programs', 'versions'].flatMap((k) =>
                next[k].map((x) => [`${k}/${x.id}`, x.id]),
              ),
            ),
        },
      ]
    : record.imports;
  return {
    ...record,
    state: clone(next),
    localRevisions: updated.revisions,
    outbox: [...record.outbox, operation],
    imports,
  };
}
export function rebase(record, snapshot, acknowledged = []) {
  if (snapshot.cursor < record.cursor)
    snapshot = { state: record.confirmed, revisions: record.revisions, cursor: record.cursor };
  const confirmed = validate(snapshot.state),
    confirmedUnits = flatten(confirmed);
  let units = confirmedUnits,
    revs = { ...snapshot.revisions },
    state = clone(confirmed);
  const outbox = record.outbox.filter((op) => !acknowledged.includes(op.id)),
    conflicts = [];
  for (const op of outbox) {
    try {
      const result = apply(units, revs, op);
      units = result.units;
      revs = result.revisions;
      state = result.state;
    } catch (err) {
      conflicts.push({ operation: clone(op), reason: err.message, key: err.key || null });
      break;
    }
  }
  // Keep the full local branch when replay fails, including dependent edits.
  return {
    ...record,
    confirmed: clone(confirmed),
    initialized: true,
    revisions: snapshot.revisions,
    cursor: snapshot.cursor,
    localRevisions: revs,
    state: conflicts.length ? record.state : state,
    outbox,
    conflicts,
    imports: record.imports.map((item) =>
      acknowledged.includes(item.id) ? { ...item, serverCursor: snapshot.cursor } : item,
    ),
  };
}
export function canLogout(record) {
  return !record.outbox.length && !record.conflicts.length;
}
