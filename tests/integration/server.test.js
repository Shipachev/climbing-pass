import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../../server/db.js';
import { push, pull } from '../../server/service.js';
import { session, csrf } from '../../server/auth.js';
import { migrate, clone, today } from '../../js/store.js';
import { addPass, addVisit } from '../../js/passes.js';
import { start, mark } from '../../js/workouts.js';
import { changes, guardsFor } from '../../js/data/graph.js';
import { account, cleanup, assertTestDatabase } from './helpers.js';
assertTestDatabase();
after(() => pool.end());
const op = (before, after, revisions = {}) => ({
  protocolVersion: 1,
  id: crypto.randomUUID(),
  mode: 'edit',
  day: today(),
  timezone: 'Asia/Novokuznetsk',
  changes: changes(before, after, revisions),
  guards: guardsFor(before, changes(before, after, revisions), revisions),
});
test('MySQL: сериализация последнего прохода, дедупликация, разные владельцы и отзыв доступа', async () => {
  const state = migrate([]),
    pass = addPass(state, today(), '2099-01-01', 1),
    a = await account(state),
    b = await account();
  try {
    const one = clone(state),
      two = clone(state);
    addVisit(one, pass.id);
    addVisit(two, pass.id);
    const first = op(state, one),
      second = op(state, two);
    const results = await Promise.allSettled([push(a.id, first), push(a.id, second)]);
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1);
    const accepted = results[0].status === 'fulfilled' ? first : second;
    assert.equal((await pull(a.id)).state.visits.length, 1);
    assert.equal((await pull(b.id)).state.visits.length, 0);
    const repeat = await push(a.id, accepted);
    assert.equal(repeat.cursor, 1);
    assert.equal((await pull(a.id)).cursor, 1);
    await assert.rejects(() => push(a.id, { ...accepted, day: '2026-01-01' }), /другим содержимым/);
    await assert.rejects(() => push(b.id, accepted));
    const request = { headers: { cookie: `cp_session=${a.token}` } };
    assert.equal((await session(request)).user.id, a.id);
    process.env.APP_ORIGIN = 'http://localhost:4173';
    assert.throws(
      () =>
        csrf(
          { headers: { origin: 'https://evil.test', 'x-csrf-token': a.csrf } },
          { csrf: a.csrf },
        ),
      /не подтверждён/,
    );
    await pool.execute('UPDATE allowed_users SET enabled=FALSE WHERE email=?', [a.email]);
    await assert.rejects(() => session(request), /Войдите/);
  } finally {
    await cleanup(a);
    await cleanup(b);
  }
});
test('MySQL: независимые этапы, атомарная ошибка, долгий офлайн и повтор импорта', async () => {
  const state = migrate([]),
    p = addPass(state, today(), '2099-01-01', 8),
    v = addVisit(state, p.id);
  start(state, v.id, state.programs[0].id);
  const a = await account(state);
  try {
    const ids = Object.keys(v.workout.marks),
      one = clone(state),
      two = clone(state);
    mark(one, v.id, ids[0], 'done');
    mark(two, v.id, ids[1], 'skipped');
    await push(a.id, op(state, one));
    await push(a.id, op(state, two));
    const merged = await pull(a.id);
    assert.equal(merged.cursor, 2);
    assert.equal(merged.state.visits[0].workout.marks[ids[0]].status, 'done');
    assert.equal(merged.state.visits[0].workout.marks[ids[1]].status, 'skipped');
    await assert.rejects(() => push(a.id, op(state, one)));
    assert.equal((await pull(a.id)).cursor, 2);
    const replacement = migrate([]),
      restore = {
        ...op(merged.state, replacement, merged.revisions),
        mode: 'restore',
        expectedCursor: merged.cursor,
        sourceHash: 'a'.repeat(64),
      };
    const result = await push(a.id, restore);
    assert.equal(result.state.visits.length, 0);
    assert.equal((await push(a.id, restore)).cursor, result.cursor);
    assert.equal(
      (await pool.execute('SELECT import_id FROM imports WHERE user_id=?', [a.id]))[0].length,
      1,
    );
  } finally {
    await cleanup(a);
  }
});
test('серверный перенос legacy: preview, применение и повтор без дублей', async () => {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const run = promisify(execFile);
  const user = await account(migrate([]));
  try {
    const args = ['scripts/import-production-history.js', 'tests/fixtures/legacy.json', user.email];
    const preview = await run(process.execPath, args, { env: process.env });
    assert.match(preview.stdout, /Preview only/);
    assert.equal((await pull(user.id)).state.visits.length, 0);
    await run(process.execPath, [...args, '--apply'], { env: process.env });
    const imported = await pull(user.id);
    assert.equal(imported.state.passes.length, 2);
    assert.equal(imported.state.visits.length, 3);
    assert.equal(imported.state.programs.length, 2);
    const repeat = await run(process.execPath, [...args, '--apply'], { env: process.env });
    assert.match(repeat.stdout, /already imported/);
    assert.equal((await pull(user.id)).cursor, imported.cursor);
  } finally {
    await cleanup(user);
  }
});
