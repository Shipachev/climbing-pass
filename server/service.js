import { createHash } from 'node:crypto';
import {
  flatten,
  apply,
  validateTransition,
  emptyState,
  equal,
  guardsFor,
} from '../js/data/graph.js';
import { counts } from '../js/data/migration.js';
import { json, transaction } from './db.js';
export const digest = (value) =>
  createHash('sha256')
    .update(typeof value === 'string' ? value : JSON.stringify(value))
    .digest('hex');
const snapshot = (row) => ({
  state: json(row.state),
  revisions: json(row.revisions),
  cursor: Number(row.sync_cursor),
});
export async function pull(userId) {
  return transaction(async (db) => {
    const [[row]] = await db.execute('SELECT state,revisions,sync_cursor FROM users WHERE id=?', [
      userId,
    ]);
    return snapshot(row);
  });
}
export async function push(userId, operation) {
  if (
    operation.protocolVersion !== 1 ||
    typeof operation.id !== 'string' ||
    !/^[A-Za-z0-9_-]{1,64}$/.test(operation.id)
  )
    throw Object.assign(Error('Неподдерживаемый протокол'), { status: 400 });
  return transaction(async (db) => {
    const [[row]] = await db.execute(
      'SELECT state,revisions,sync_cursor FROM users WHERE id=? FOR UPDATE',
      [userId],
    );
    const current = snapshot(row),
      hash = digest(operation);
    const [[previous]] = await db.execute(
      'SELECT digest,result FROM operations WHERE user_id=? AND operation_id=?',
      [userId, operation.id],
    );
    if (previous) {
      if (previous.digest !== hash)
        throw Object.assign(Error('ID операции повторён с другим содержимым'), {
          status: 409,
          snapshot: current,
        });
      return json(previous.result);
    }
    try {
      if (['attach', 'restore', 'join'].includes(operation.mode)) {
        if (
          !Number.isInteger(operation.expectedCursor) ||
          operation.expectedCursor !== current.cursor
        )
          throw Error('Облачная история изменилась. Повторите предварительную проверку');
        if (operation.mode === 'attach' && !equal(current.state, emptyState()))
          throw Error(
            'Облачная история уже существует. Выберите восстановление с заменой или сохраните оба набора',
          );
        if (operation.mode === 'join') {
          const [[existing]] = await db.execute(
            'SELECT import_id FROM imports WHERE user_id=? AND source_hash=? LIMIT 1',
            [userId, operation.sourceHash || ''],
          );
          if (existing) throw Error('Этот источник уже переносился. Новый набор не добавлен');
        }
        if (!/^[a-f0-9]{64}$/.test(operation.sourceHash || ''))
          throw Error('Нет контрольной суммы источника');
      }
      const suppliedGuards = new Set((operation.guards || []).map((g) => g.key));
      for (const guard of guardsFor(current.state, operation.changes || [], current.revisions))
        if (!suppliedGuards.has(guard.key)) throw Error('Отсутствует проверка ревизии занятия');
      const result = apply(flatten(current.state), current.revisions, operation);
      validateTransition(current.state, result.state, operation);
      const next = { state: result.state, revisions: result.revisions, cursor: current.cursor + 1 };
      await db.execute('UPDATE users SET state=?,revisions=?,sync_cursor=? WHERE id=?', [
        JSON.stringify(next.state),
        JSON.stringify(next.revisions),
        next.cursor,
        userId,
      ]);
      await db.execute(
        'INSERT INTO operations(user_id,operation_id,digest,result) VALUES (?,?,?,?)',
        [userId, operation.id, hash, JSON.stringify(next)],
      );
      await db.execute(
        'INSERT INTO changes(user_id,sync_cursor,operation_id,snapshot) VALUES (?,?,?,?)',
        [userId, next.cursor, operation.id, JSON.stringify(next)],
      );
      if (['attach', 'restore', 'join'].includes(operation.mode))
        await db.execute(
          'INSERT INTO imports(user_id,import_id,source_hash,result) VALUES (?,?,?,?)',
          [
            userId,
            operation.id,
            operation.sourceHash,
            JSON.stringify({ counts: counts(next.state), cursor: next.cursor }),
          ],
        );
      return next;
    } catch (err) {
      if (err.status) throw err;
      throw Object.assign(Error(err.message), {
        status: 409,
        code: 'CONFLICT',
        key: err.key,
        snapshot: current,
      });
    }
  });
}
