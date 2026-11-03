import { test } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, validate, clone, write, load, KEY, today } from '../js/store.js';
import { addPass, addVisit, deleteVisit, active, visitsFor, newestVisits } from '../js/passes.js';
import { start, mark, finish, progress, previousWorkout, lastCompletedAt } from '../js/workouts.js';
import { draft, publish, latest } from '../js/programs.js';
import { encode, decode } from '../js/backup.js';
const legacy = [
  {
    id: 4,
    start: '2026-01-01',
    end: '2026-12-31',
    total: 8,
    status: 'active',
    visits: ['2026-05-01', '2026-05-01'],
  },
];
const storage = () => {
  const data = new Map();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) };
};
test('миграция сохраняет дубли, принадлежность и старый ключ, повторная загрузка не дублирует', () => {
  const st = storage();
  st.setItem('climb_pass', JSON.stringify(legacy));
  const s = load(st);
  assert.equal(s.visits.length, 2);
  assert.notEqual(s.visits[0].id, s.visits[1].id);
  assert.equal(st.getItem('climb_pass'), JSON.stringify(legacy));
  assert.deepEqual(load(st), s);
  assert.ok(st.getItem(KEY));
});
test('посещение обязательно, повторный запуск не списывает проход, дубли независимы', () => {
  const s = migrate(legacy);
  assert.throws(() => start(s, 'missing', 'program-1'));
  const w = start(s, s.visits[0].id, 'program-1');
  assert.equal(start(s, s.visits[0].id, 'program-2'), w);
  start(s, s.visits[1].id, 'program-1');
  mark(s, s.visits[0].id, 's7', 'done', 'заметка');
  assert.equal(s.visits[1].workout.marks.s7.status, 'pending');
  assert.equal(s.visits.length, 2);
  validate(s);
});
test('завершение, пропуски и возобновление сохраняют отметки', () => {
  const s = migrate(legacy),
    id = s.visits[0].id;
  start(s, id, 'program-1');
  mark(s, id, 's7', 'done', 'текст');
  mark(s, id, 's2', 'skipped');
  finish(s, id);
  assert.deepEqual(progress(s.visits[0].workout), { total: 9, done: 1, skipped: 1, pending: 7 });
  assert.throws(() => mark(s, id, 's7', 'pending'));
  finish(s, id, true);
  assert.equal(s.visits[0].workout.completedAt, null);
  assert.equal(s.visits[0].workout.marks.s7.note, 'текст');
  validate(s);
});
test('черновик, версии, восстановление и снимки независимы', () => {
  const s = migrate(legacy);
  const w = start(s, s.visits[0].id, 'program-1'),
    old = clone(w.content);
  draft(s, 'program-1').content.title = 'Изменено';
  assert.deepEqual(latest(s, 'program-1').content, old);
  const v = publish(s, 'program-1', draft(s, 'program-1').content);
  assert.equal(v.number, 2);
  assert.deepEqual(w.content, old);
  assert.equal(start(s, s.visits[1].id, 'program-1').content.title, 'Изменено');
  publish(s, 'program-1', s.versions[0].content);
  assert.equal(latest(s, 'program-1').number, 3);
  assert.equal(s.versions.filter((v) => v.programId === 'program-1').length, 3);
  validate(s);
});
test('архив не мешает продолжению; удаление охраняет историю', () => {
  const s = migrate(legacy),
    id = s.visits[0].id;
  start(s, id, 'program-1');
  s.programs[0].archived = true;
  assert.throws(() => start(s, s.visits[1].id, 'program-1'));
  s.passes[0].status = 'archived';
  mark(s, id, 's7', 'done');
  const p = addPass(s, today(), '2099-12-31', 4);
  assert.throws(() => deleteVisit(s, id));
  p.status = 'archived';
  deleteVisit(s, id);
  assert.equal(s.visits.length, 1);
  validate(s);
});
test('абонемент на одно посещение; тренировка не меняет счётчик', () => {
  const s = migrate([]);
  const p = addPass(s, today(), today(), 1);
  const v = addVisit(s, p.id);
  assert.equal(active(s), undefined);
  assert.equal(p.status, 'archived');
  start(s, v.id, 'program-1');
  assert.equal(visitsFor(s, p.id).length, 1);
  assert.throws(() => addVisit(s, p.id));
  deleteVisit(s, v.id);
  assert.equal(p.status, 'active');
  validate(s);
});
test('полная копия восстанавливает занятие, заметки и черновик', () => {
  const s = migrate(legacy);
  start(s, s.visits[0].id, 'program-1');
  mark(s, s.visits[0].id, 's7', 'skipped', '<script>test</script>');
  draft(s, 'program-2').content.goal = 'Черновик';
  assert.deepEqual(decode(encode(s)).state, s);
  assert.equal(decode(JSON.stringify(legacy)).legacy, true);
});
test('повреждённые связи, ID, состояния, даты и новая схема отклоняются', () => {
  const s = migrate(legacy);
  for (const corrupt of [
    (x) => x.visits.push(clone(x.visits[0])),
    (x) => (x.visits[0].passId = 'missing'),
    (x) => (x.visits[0].date = '2026-02-30'),
    (x) => (x.programs[0].currentVersionId = 'missing'),
    (x) => (x.schemaVersion = 3),
    (x) => (x.versions[0].content.duration = -1),
  ]) {
    const c = clone(s);
    corrupt(c);
    assert.throws(() => validate(c));
  }
  assert.throws(() => decode('{"formatVersion":99}'));
  const st = storage();
  write(s, st);
  const original = st.getItem(KEY);
  assert.throws(() => write({ ...s, schemaVersion: 3 }, st));
  assert.equal(st.getItem(KEY), original);
});
test('ошибка хранения не меняет исходную копию; повреждённая миграция ничего не пишет', () => {
  const s = migrate(legacy);
  assert.throws(() =>
    write(s, {
      setItem() {
        throw Error('QuotaExceeded');
      },
      getItem() {
        return null;
      },
    }),
  );
  const st = storage();
  st.setItem('climb_pass', 'broken');
  assert.throws(() => load(st));
  assert.equal(st.getItem(KEY), null);
  assert.equal(st.getItem('climb_pass'), 'broken');
});
test('незавершённый черновик сохраняется, публикация невалидной длительности запрещена', () => {
  const s = migrate(legacy);
  const d = draft(s, 'program-1');
  d.content.duration = -1;
  d.content.sections[0].steps[0].duration = '0';
  validate(s);
  assert.throws(() => publish(s, 'program-1', d.content));
  assert.equal(latest(s, 'program-1').number, 1);
  assert.deepEqual(decode(encode(s)).state, s);
});
test('типы этапов исходных программ и запрет новых заметок для разминки/заминки', () => {
  const s = migrate(legacy),
    id = s.visits[0].id,
    w = start(s, id, 'program-1');
  assert.equal(w.content.sections[0].steps[0].type, 'warmup');
  assert.equal(w.content.sections[1].steps[0].type, 'training');
  assert.equal(w.content.sections[2].steps[0].type, 'cooldown');
  assert.throws(() => mark(s, id, 's1', undefined, 'разминка'));
  assert.throws(() => mark(s, id, 's9', undefined, 'заминка'));
  mark(s, id, 's7', undefined, 'основная часть');
  mark(s, id, 's1', 'done');
  assert.equal(w.marks.s7.note, 'основная часть');
  assert.equal(w.marks.s1.status, 'done');
  validate(s);
});
test('старые версии, снимки и черновики получают типы без потери прежних заметок', () => {
  const s = migrate(legacy),
    id = s.visits[0].id,
    w = start(s, id, 'program-1');
  draft(s, 'program-1');
  for (const c of [
    ...s.versions.map((v) => v.content),
    ...s.drafts.map((d) => d.content),
    w.content,
  ])
    for (const section of c.sections) for (const t of section.steps) delete t.type;
  w.marks.s1.note = 'Старая заметка';
  const st = storage();
  st.setItem(KEY, JSON.stringify(s));
  const upgraded = load(st);
  assert.equal(upgraded.visits[0].workout.marks.s1.note, 'Старая заметка');
  assert.equal(upgraded.drafts[0].content.sections[0].steps[0].type, 'warmup');
  assert.equal(upgraded.visits[0].workout.content.sections[2].steps[0].type, 'cooldown');
  assert.deepEqual(load(st), upgraded);
  assert.deepEqual(decode(encode(s)).state, upgraded);
  validate(upgraded);
});
test('редактирование типа публикуется новой версией, прежний снимок сохраняется', () => {
  const s = migrate(legacy),
    w = start(s, s.visits[0].id, 'program-1');
  const d = draft(s, 'program-1');
  d.content.sections[1].steps[0].type = 'cooldown';
  publish(s, 'program-1', d.content);
  assert.equal(w.content.sections[1].steps[0].type, 'training');
  assert.equal(start(s, s.visits[1].id, 'program-1').content.sections[1].steps[0].type, 'cooldown');
  const invalid = clone(s);
  invalid.versions[0].content.sections[0].steps[0].type = 'bad';
  assert.throws(() => validate(invalid));
});
test('допустимы только новые абонементы на 1, 4 или 8 посещений', () => {
  for (const total of [1, 4, 8]) {
    const s = migrate([]);
    assert.equal(addPass(s, today(), '2099-12-31', total).total, total);
  }
  for (const total of [0, 2, 3, 6, 9, 1.5, '8'])
    assert.throws(() => addPass(migrate([]), today(), '2099-12-31', total));
});
test('предыдущая тренировка: та же программа, стабильные этапы, отдельные посещения одной даты', () => {
  const s = migrate(legacy),
    first = s.visits[0],
    second = s.visits[1];
  start(s, first.id, 'program-1');
  mark(s, first.id, 's7', undefined, 'Контроль таза');
  const d = draft(s, 'program-1');
  d.content.sections[1].steps[0].title = 'Новое название';
  publish(s, 'program-1', d.content);
  start(s, second.id, 'program-1');
  assert.equal(previousWorkout(s, second.id).id, first.id);
  assert.equal(previousWorkout(s, second.id).workout.marks.s7.note, 'Контроль таза');
  assert.equal(previousWorkout(s, first.id), null);
  assert.equal(previousWorkout(s, 'missing'), null);
  assert.equal(second.workout.marks.s7.note, '');
  validate(s);
});
test('предыдущая тренировка не подменяется чужой программой, будущим посещением или старой непустой заметкой', () => {
  const s = migrate(legacy),
    first = s.visits[0],
    second = s.visits[1];
  first.date = '2026-05-01';
  second.date = '2026-05-03';
  start(s, first.id, 'program-1');
  mark(s, first.id, 's7', undefined, 'Старая запись');
  start(s, second.id, 'program-1');
  const last = { id: 'third', passId: first.passId, date: '2026-05-04' };
  s.visits.push(last);
  start(s, last.id, 'program-1');
  assert.equal(previousWorkout(s, last.id).id, second.id);
  assert.equal(previousWorkout(s, last.id).workout.marks.s7.note, '');
  assert.equal(previousWorkout(s, second.id).id, first.id);
  const other = { id: 'other', passId: first.passId, date: '2026-05-02' };
  s.visits.push(other);
  start(s, other.id, 'program-2');
  assert.equal(previousWorkout(s, other.id), null);
  assert.equal(previousWorkout(s, second.id).id, first.id);
  s.passes[0].status = 'archived';
  assert.equal(previousWorkout(s, second.id).id, first.id);
  validate(s);
});
test('история: новые даты и занятия сверху, совпадения упорядочены стабильно', () => {
  const visits = [
    { id: 'old', date: '2026-10-30', workout: { startedAt: '2026-10-30T14:00:00Z' } },
    { id: 'morning', date: '2026-10-31', workout: { startedAt: '2026-10-31T06:00:00Z' } },
    { id: 'evening-first', date: '2026-10-31', workout: { startedAt: '2026-10-31T12:00:00Z' } },
    { id: 'evening-last', date: '2026-10-31', workout: { startedAt: '2026-10-31T12:00:00Z' } },
  ];
  assert.deepEqual(
    newestVisits(visits).map((v) => v.id),
    ['evening-last', 'evening-first', 'morning', 'old'],
  );
  assert.equal(visits[0].id, 'old');
});
test('дата последнего завершения по программе учитывает все версии и архив, исключает возобновлённые занятия', () => {
  const s = migrate(legacy),
    first = s.visits[0],
    second = s.visits[1];
  assert.equal(lastCompletedAt(s, 'program-1'), null);
  const w1 = start(s, first.id, 'program-1');
  finish(s, first.id);
  w1.startedAt = '2026-05-01T08:00:00Z';
  w1.completedAt = '2026-05-01T09:00:00Z';
  const d = draft(s, 'program-1');
  d.content.title = 'Обновлена';
  publish(s, 'program-1', d.content);
  const w2 = start(s, second.id, 'program-1');
  finish(s, second.id);
  w2.startedAt = '2026-05-01T08:30:00Z';
  w2.completedAt = '2026-05-01T11:00:00+01:00';
  s.passes[0].status = 'archived';
  assert.equal(lastCompletedAt(s, 'program-1'), w2.completedAt);
  assert.equal(lastCompletedAt(s, 'program-2'), null);
  finish(s, second.id, true);
  assert.equal(lastCompletedAt(s, 'program-1'), w1.completedAt);
  finish(s, first.id, true);
  assert.equal(lastCompletedAt(s, 'program-1'), null);
  validate(s);
});
