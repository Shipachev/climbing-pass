import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, clone, today } from '../js/store.js';
import { addPass, addVisit, deleteVisit } from '../js/passes.js';
import { start, mark, finish } from '../js/workouts.js';
import { draft, publish } from '../js/programs.js';
import {
  flatten,
  inflate,
  changes,
  guardsFor,
  apply,
  equal,
  validateTransition,
  emptyState,
} from '../js/data/graph.js';
import { initialRecord, enqueue, rebase, canLogout, openLocal } from '../js/data/local.js';
import { parseSource, preview, rawCopy } from '../js/data/migration.js';
import { indexedDB } from 'fake-indexeddb';
globalThis.indexedDB = indexedDB;
const base = () => {
  const s = migrate([]);
  const p = addPass(s, today(), '2099-12-31', 8),
    v = addVisit(s, p.id);
  start(s, v.id, s.programs[0].id);
  return s;
};
const operation = (before, after, revisions = {}, mode = 'edit') => ({
  id: crypto.randomUUID(),
  protocolVersion: 1,
  mode,
  day: today(),
  timezone: 'Asia/Novokuznetsk',
  changes: changes(before, after, revisions),
  guards: guardsFor(before, changes(before, after, revisions), revisions),
});
function commit(s, op, revisions = {}) {
  const result = apply(flatten(s), revisions, op);
  validateTransition(s, result.state, op);
  return result;
}
test('граф сохраняет порядок, старые ID, снимки и заметки; MySQL порядок ключей не создаёт конфликт', () => {
  const s = base();
  assert.deepEqual(inflate(flatten(s)), s);
  assert.ok(equal({ a: 1, b: 2 }, { b: 2, a: 1 }));
  const next = clone(s);
  mark(next, next.visits[0].id, Object.keys(next.visits[0].workout.marks)[0], 'done');
  const op = operation(s, next);
  const shuffled = Object.fromEntries(Object.entries(flatten(s)).reverse());
  assert.deepEqual(apply(shuffled, {}, op).state, next);
});
test('разные этапы объединяются; одна отметка и заметка сохраняют конфликт', () => {
  const s = base(),
    v = s.visits[0],
    ids = Object.keys(v.workout.marks),
    a = clone(s),
    b = clone(s);
  mark(a, v.id, ids[0], 'done');
  mark(b, v.id, ids[1], 'skipped');
  const one = commit(s, operation(s, a)),
    two = commit(one.state, operation(s, b), one.revisions);
  assert.equal(two.state.visits[0].workout.marks[ids[0]].status, 'done');
  assert.equal(two.state.visits[0].workout.marks[ids[1]].status, 'skipped');
  assert.throws(() => commit(one.state, operation(s, a), one.revisions), /изменилась/);
});
test('завершение, возобновление и удаление блокируют отложенные изменения; нет воскрешения', () => {
  const s = base(),
    v = s.visits[0],
    id = Object.keys(v.workout.marks)[0],
    a = clone(s),
    b = clone(s);
  mark(a, v.id, id, 'done');
  finish(b, v.id);
  const done = commit(s, operation(s, b));
  assert.throws(() => commit(done.state, operation(s, a), done.revisions), /Состояние/);
  const reopened = clone(done.state);
  finish(reopened, v.id, true);
  const resumed = commit(
    done.state,
    operation(done.state, reopened, done.revisions),
    done.revisions,
  );
  assert.throws(() => commit(resumed.state, operation(s, a), resumed.revisions), /Состояние/);
  const deleted = clone(s);
  deleteVisit(deleted, v.id);
  const removal = commit(s, operation(s, deleted));
  assert.throws(() => commit(removal.state, operation(s, a), removal.revisions));
});
test('последний проход, два активных абонемента и две публикации не проходят конкурентно', () => {
  const s = migrate([]),
    p = addPass(s, today(), '2099-12-31', 1),
    a = clone(s),
    b = clone(s);
  addVisit(a, p.id);
  addVisit(b, p.id);
  const one = commit(s, operation(s, a));
  assert.throws(() => commit(one.state, operation(s, b), one.revisions));
  const initial = migrate([]),
    x = clone(initial),
    y = clone(initial);
  addPass(x, today(), '2099-12-31', 8);
  addPass(y, today(), '2099-12-31', 4);
  const first = commit(initial, operation(initial, x));
  assert.throws(() => commit(first.state, operation(initial, y), first.revisions));
  const pa = clone(initial),
    pb = clone(initial);
  publish(pa, pa.programs[0].id, pa.versions[0].content);
  publish(pb, pb.programs[0].id, pb.versions[0].content);
  const published = commit(initial, operation(initial, pa));
  assert.throws(() => commit(published.state, operation(initial, pb), published.revisions));
});
test('два черновика и два запуска одной тренировки конфликтуют', () => {
  const s = base(),
    a = clone(s),
    b = clone(s);
  draft(a, a.programs[0].id).content.title = 'Редакция A';
  draft(b, b.programs[0].id).content.title = 'Редакция B';
  const one = commit(s, operation(s, a));
  assert.throws(() => commit(one.state, operation(s, b), one.revisions));
  finish(s, s.visits[0].id);
  const p = addVisit(s, s.passes[0].id),
    x = clone(s),
    y = clone(s);
  start(x, p.id, x.programs[0].id);
  start(y, p.id, y.programs[1].id);
  const started = commit(s, operation(s, x));
  assert.throws(() => commit(started.state, operation(s, y), started.revisions));
});
test('сервер не разрешает править версии, календарь, удалять абонемент и заметку разминки', () => {
  const s = base(),
    a = clone(s);
  a.versions[1].content.title = 'Подмена';
  assert.throws(() => validateTransition(s, a, operation(s, a)), /неизменяемы/);
  const bad = operation(s, s);
  bad.day = '2026-02-30';
  assert.throws(() => validateTransition(s, s, bad), /календарь/);
  const b = clone(s);
  b.passes = [];
  b.visits = [];
  assert.throws(() => validateTransition(s, b, operation(s, b)), /Удаление/);
  const c = clone(s);
  const step = c.visits[0].workout.content.sections
    .flatMap((s) => s.steps)
    .find((s) => s.type === 'warmup');
  c.visits[0].workout.marks[step.id].note = 'Запрещено';
  assert.throws(() => validateTransition(s, c, operation(s, c)), /Заметка/);
});
test('очередь, атомарный граф и поколение защищают вкладки; аккаунты изолированы', async () => {
  const a = await openLocal('account-a'),
    b = await openLocal('account-b');
  const record = await a.read();
  const next = enqueue(record, base(), { mode: 'attach' });
  await a.write(next);
  assert.equal((await a.read()).outbox.length, 1);
  assert.deepEqual((await b.read()).state, emptyState());
  await assert.rejects(() => a.write(record), /другой вкладке/);
  a.close();
  const reopened = await openLocal('account-a');
  assert.equal((await reopened.read()).outbox[0].id, next.outbox[0].id);
  reopened.close();
  b.close();
});
test('подтверждение удаляет только принятую операцию, конфликт сохраняет локальную ветку', () => {
  const s = base(),
    record = { ...initialRecord(), state: s, confirmed: s };
  const next = clone(s),
    v = s.visits[0],
    id = Object.keys(v.workout.marks)[0];
  mark(next, v.id, id, 'done');
  const queued = enqueue(record, next);
  assert.equal(canLogout(queued), false);
  const op = queued.outbox[0],
    result = commit(s, op),
    acked = rebase(queued, { ...result, cursor: 1 }, [op.id]);
  assert.equal(canLogout(acked), true);
  assert.deepEqual(acked.state, next);
  const other = clone(s);
  mark(other, v.id, id, 'skipped');
  const server = commit(s, operation(s, other));
  const conflict = rebase(queued, { ...server, cursor: 1 });
  assert.equal(conflict.conflicts.length, 1);
  assert.deepEqual(conflict.state, next);
  assert.deepEqual(conflict.confirmed, other);
  assert.equal(conflict.outbox.length, 1);
});
test('перенос принимает все четыре источника; битый v2 не заменяется legacy', async () => {
  const s = base(),
    legacy = [
      {
        id: 5,
        start: '2020-01-01',
        end: '2020-02-01',
        total: 3,
        status: 'archived',
        visits: ['2020-01-02', '2020-01-02'],
      },
    ];
  assert.equal(parseSource(legacy).visits.length, 2);
  assert.deepEqual(parseSource(s), s);
  assert.deepEqual(
    parseSource({ formatVersion: 2, exportedAt: new Date().toISOString(), state: s }),
    s,
  );
  assert.deepEqual(
    parseSource({ climb_pass: JSON.stringify(legacy), climb_pass_v2: JSON.stringify(s) }),
    s,
  );
  assert.throws(() => parseSource({ climb_pass: JSON.stringify(legacy), climb_pass_v2: 'broken' }));
  assert.throws(() => parseSource({ formatVersion: 4, state: s }));
  const raw = await rawCopy(
    { getItem: (k) => (k === 'climb_pass_v2' ? JSON.stringify(s) : null) },
    'https://old.example',
  );
  assert.equal(raw.sha256.length, 64);
  assert.equal(raw.origin, 'https://old.example');
  assert.deepEqual(parseSource(raw), s);
  assert.equal(preview(s, s).collisions.length > 0, true);
});
test('запоздалое подтверждение не откатывает более свежий курсор', () => {
  const state = base(),
    record = { ...initialRecord(), state, confirmed: state, cursor: 5 };
  const result = rebase(record, { state: emptyState(), revisions: {}, cursor: 1 });
  assert.equal(result.cursor, 5);
  assert.deepEqual(result.state, state);
});
test('ошибка локальной записи не оставляет граф без очереди; миграция не активируется частично', async () => {
  const repository = await openLocal('failed-import');
  const original = await repository.read();
  const queued = enqueue(original, base(), { mode: 'attach' });
  // Abort the transaction through a stale generation, just as another tab may
  // invalidate an import between preview and the final local commit.
  await repository.write(original);
  await assert.rejects(() => repository.write(queued));
  const actual = await repository.read();
  assert.deepEqual(actual.state, emptyState());
  assert.equal(actual.outbox.length, 0);
  repository.close();
});
test('присоединение другой истории меняет ID явно и сохраняет посещения одной даты', async () => {
  const { joinHistory } = await import('../js/data/migration.js');
  const current = migrate([
    {
      id: 1,
      start: '2020-01-01',
      end: '2020-02-01',
      total: 2,
      status: 'archived',
      visits: ['2020-01-02'],
    },
  ]);
  const other = clone(current),
    joined = joinHistory(current, other, 'b'.repeat(64));
  assert.equal(joined.state.visits.length, 2);
  assert.equal(joined.state.programs.length, 4);
  assert.equal(joined.idMap['passes/legacy-1'], 'import-' + 'b'.repeat(16) + '-legacy-1');
  const command = operation(current, joined.state, {}, 'join');
  assert.doesNotThrow(() => validateTransition(current, joined.state, command));
  const active = base();
  assert.throws(() => joinHistory(active, active, 'c'.repeat(64)), /одно действующее/);
});
test('независимые посещения не последнего прохода объединяются без схлопывания даты', () => {
  const state = base();
  finish(state, state.visits[0].id);
  const a = clone(state),
    b = clone(state);
  addVisit(a, state.passes[0].id);
  addVisit(b, state.passes[0].id);
  const one = commit(state, operation(state, a)),
    two = commit(one.state, operation(state, b), one.revisions);
  assert.equal(two.state.visits.length, 3);
  assert.equal(new Set(two.state.visits.map((v) => v.id)).size, 3);
});
test('календарь и часы подменяемы; последний день включён, поздняя доставка использует дату действия', async () => {
  const { configureRuntime } = await import('../js/domain/runtime.js');
  const reset = configureRuntime({
    clock: () => new Date('2026-02-28T12:00:00Z'),
    calendar: () => '2026-02-28',
  });
  let state, next, command;
  try {
    state = migrate([]);
    const p = addPass(state, '2026-02-01', '2026-02-28', 4);
    next = clone(state);
    addVisit(next, p.id);
    command = operation(state, next);
    assert.equal(next.visits[0].date, '2026-02-28');
  } finally {
    reset();
  }
  const resetLater = configureRuntime({
    clock: () => new Date('2026-03-02T12:00:00Z'),
    calendar: () => '2026-03-02',
  });
  try {
    assert.doesNotThrow(() => validateTransition(state, next, command));
  } finally {
    resetLater();
  }
});
test('контрольные legacy/v2 фикстуры сохраняют дубли, черновик и снимок', async () => {
  const { readFile } = await import('node:fs/promises');
  const legacy = parseSource(
      await readFile(new URL('./fixtures/legacy.json', import.meta.url), 'utf8'),
    ),
    v2 = parseSource(await readFile(new URL('./fixtures/v2.json', import.meta.url), 'utf8'));
  assert.equal(legacy.visits.length, 3);
  assert.equal(preview(legacy, emptyState()).warnings.length, 1);
  assert.equal(v2.drafts[0].content.title, '');
  assert.equal(v2.visits[0].workout.marks['step-old'].note, 'Историческая заметка');
  assert.deepEqual(inflate(flatten(v2)), v2);
});
test('новое посещение запрещено до завершения текущей тренировки на клиенте и сервере', () => {
  const state = base();
  assert.throws(() => addVisit(state, state.passes[0].id), /Сначала завершите/);
  const forged = clone(state);
  forged.visits.push({ id: 'new-visit-blocked', passId: state.passes[0].id, date: today() });
  assert.throws(
    () => validateTransition(state, forged, operation(state, forged)),
    /Сначала завершите/,
  );
  finish(state, state.visits[0].id);
  assert.doesNotThrow(() => addVisit(state, state.passes[0].id));
});
