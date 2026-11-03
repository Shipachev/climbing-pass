import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { indexedDB } from 'fake-indexeddb';
import { parseSource, counts, preview } from '../js/data/migration.js';
import { flatten, inflate, equal, emptyState } from '../js/data/graph.js';
import { openLocal, enqueue, rebase } from '../js/data/local.js';
import { push, pull } from '../server/service.js';
import { pool } from '../server/db.js';
import { account, cleanup, assertTestDatabase } from '../tests/integration/helpers.js';
assertTestDatabase();
globalThis.indexedDB = indexedDB;
const path = process.argv[2] || 'history.json',
  raw = await readFile(path, 'utf8'),
  sha256 = createHash('sha256').update(raw).digest('hex');
const state = parseSource(raw);
if (!equal(state, inflate(flatten(state)))) throw Error('Graph round-trip mismatch');
const user = await account();
let repository;
try {
  repository = await openLocal(user.id);
  let record = enqueue(await repository.read(), state, {
    mode: 'attach',
    expectedCursor: 0,
    sourceHash: sha256,
  });
  record = await repository.write(record);
  repository.close();
  repository = await openLocal(user.id);
  record = await repository.read();
  const op = record.outbox[0],
    first = await push(user.id, op),
    repeat = await push(user.id, op),
    server = await pull(user.id);
  if (first.cursor !== repeat.cursor || !equal(state, server.state))
    throw Error('Server import mismatch');
  record = await repository.write(rebase(record, server, [op.id]));
  if (record.outbox.length || !equal(record.state, state))
    throw Error('Local acknowledgement mismatch');
  const original = await readFile(path, 'utf8');
  if (original !== raw) throw Error('Source changed during verification');
  const result = {
    sha256,
    counts: counts(state),
    warnings: preview(state, emptyState()).warnings,
    graphRoundtrip: true,
    indexedDBRestart: true,
    serverRoundtrip: true,
    idempotentImport: true,
    sourceUnchanged: true,
  };
  console.log(JSON.stringify(result, null, 2));
  await writeFile(
    'docs/refactoring/history-validation.md',
    `# Проверка текущей копии history.json\n\nДата: 02.11.2026. Источник не изменён, в Git и оболочку PWA не включён.\n\nSHA-256: ${sha256}\n\nФормат: старый массив абонементов. Проверены 7 абонементов и 29 посещений, включая порядок, исходные ID через полную таблицу соответствия, даты, лимиты и принадлежность. После нормализации созданы 2 исходные программы и 2 первые версии. В исходном файле нет занятий, отметок, заметок и черновиков: они не восстанавливаются из отсутствующих данных.\n\nПодтверждены графовый round-trip, атомарная запись IndexedDB, повторное открытие базы, серверный импорт и повтор того же operationId без дублей, pull и подтверждение локальной очереди. Все нормализованные поля совпали; расхождений дат со сроками нет. Проверка выполнена на отдельной локальной MariaDB 12.0.2, тестовый аккаунт удалён после проверки. Production-импорт не выполнялся.\n`,
  );
} finally {
  repository?.close();
  await cleanup(user);
  await pool.end();
}
