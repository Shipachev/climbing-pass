import { clone, validate, date } from '../domain/model.js';
export const emptyState = () => ({
  schemaVersion: 2,
  passes: [],
  visits: [],
  programs: [],
  versions: [],
  drafts: [],
});
export const canonical = (value) => JSON.stringify(normalize(value ?? null));
function normalize(value) {
  return Array.isArray(value)
    ? value.map(normalize)
    : value && typeof value === 'object'
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((k) => [k, normalize(value[k])]),
        )
      : value;
}
export const equal = (a, b) => canonical(a) === canonical(b);
const key = (kind, id) => `${kind}/${id}`;
export function flatten(state) {
  const units = {};
  for (const kind of ['passes', 'programs', 'versions', 'drafts'])
    state[kind].forEach((item, order) => {
      units[key(kind, item.id ?? item.programId)] = { order, item: clone(item) };
    });
  state.visits.forEach(({ workout, ...visit }, order) => {
    units[key('visits', visit.id)] = { order, item: visit };
    if (workout) {
      const { marks, ...body } = workout;
      units[key('workouts', visit.id)] = body;
      for (const [step, mark] of Object.entries(marks))
        units[`marks/${visit.id}/${step}`] = clone(mark);
    }
  });
  return units;
}
export function inflate(units) {
  const state = emptyState();
  for (const [k, v] of Object.entries(units))
    if (
      /^(passes|visits|programs|versions|drafts)\//.test(k) &&
      (!Number.isSafeInteger(v?.order) || v.order < 0)
    )
      throw Error('Неверный порядок записей');
  for (const kind of ['passes', 'visits', 'programs', 'versions', 'drafts']) {
    state[kind] = Object.entries(units)
      .filter(([k]) => k.startsWith(`${kind}/`))
      .sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))
      .map(([, value]) => clone(value.item));
  }
  for (const visit of state.visits) {
    const body = units[key('workouts', visit.id)];
    if (body)
      visit.workout = {
        ...clone(body),
        marks: Object.fromEntries(
          Object.entries(units)
            .filter(([k]) => k.startsWith(`marks/${visit.id}/`))
            .map(([k, v]) => [k.split('/')[2], clone(v)]),
        ),
      };
  }
  // Concurrent appends may share an array position. Resolve those ties by ID;
  // retain their contents and persist the resulting stable server order.
  const rebuilt = flatten(state);
  if (
    Object.keys(rebuilt).length !== Object.keys(units).length ||
    Object.entries(rebuilt).some(([k, v]) => {
      const original = units[k];
      return /^(passes|visits|programs|versions|drafts)\//.test(k)
        ? !original || !equal(v.item, original.item)
        : !equal(v, original);
    })
  )
    throw Error('Нарушены связи графа');
  return validate(state);
}
export function changes(before, after, revisions = {}) {
  const a = flatten(before),
    b = flatten(after);
  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter((k) => !equal(a[k], b[k]))
    .map((k) => ({
      key: k,
      before: a[k] ?? null,
      after: b[k] ?? null,
      revision: revisions[k] ?? null,
    }));
}
export function apply(units, revisions, operation, check = true) {
  const next = clone(units),
    revs = { ...revisions };
  if (
    !Array.isArray(operation.changes) ||
    !operation.changes.length ||
    operation.changes.length > 20000
  )
    throw Error('Неверный набор изменений');
  const seen = new Set();
  for (const change of operation.changes) {
    if (
      !/^(passes|visits|programs|versions|drafts|workouts|marks)\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?$/.test(
        change.key,
      ) ||
      seen.has(change.key)
    )
      throw Error('Неверный адрес изменения');
    seen.add(change.key);
    if (
      check &&
      (!equal(next[change.key], change.before) || (revs[change.key] ?? null) !== change.revision)
    ) {
      const err = Error('Запись изменилась на другом устройстве');
      err.code = 'CONFLICT';
      err.key = change.key;
      throw err;
    }
    if (change.after === null) delete next[change.key];
    else next[change.key] = clone(change.after);
    revs[change.key] = operation.id;
  }
  for (const guard of operation.guards || [])
    if (
      check &&
      (!equal(units[guard.key], guard.value) ||
        (revisions[guard.key] ?? null) !== (guard.revision ?? null))
    ) {
      const err = Error('Состояние занятия изменилось');
      err.code = 'CONFLICT';
      err.key = guard.key;
      throw err;
    }
  return { units: next, revisions: revs, state: inflate(next) };
}
export function guardsFor(before, patch, revisions = {}) {
  const units = flatten(before);
  const guardKeys = new Set(
    patch.filter((c) => c.key.startsWith('marks/')).map((c) => `workouts/${c.key.split('/')[1]}`),
  );
  for (const change of patch)
    if (
      change.key.startsWith('workouts/') &&
      change.before &&
      change.after &&
      !equal(change.before, change.after)
    ) {
      const prefix = `marks/${change.key.split('/')[1]}/`;
      for (const k of Object.keys(units)) if (k.startsWith(prefix)) guardKeys.add(k);
    }
  return [...guardKeys].map((k) => ({
    key: k,
    value: units[k] ?? null,
    revision: revisions[k] ?? null,
  }));
}
// Server-side checks supplement whole-graph structural validation. Imports use a
// separate, explicit cursor-guarded transaction and may contain historical data.
export function validateTransition(before, after, operation) {
  validate(after);
  if (
    !date(operation.day) ||
    typeof operation.timezone !== 'string' ||
    operation.timezone.length > 100
  )
    throw Error('Неверный календарь операции');
  try {
    new Intl.DateTimeFormat('en', { timeZone: operation.timezone });
  } catch {
    throw Error('Неверный часовой пояс');
  }
  if (operation.mode === 'join') {
    for (const [k, v] of Object.entries(flatten(before)))
      if (!equal(flatten(after)[k], v))
        throw Error('Присоединение не может заменять существующие записи');
    return;
  }
  if (operation.mode === 'restore' || operation.mode === 'attach') return;
  if (operation.mode !== 'edit') throw Error('Неверный режим операции');
  for (const old of before.versions)
    if (
      !equal(
        old,
        after.versions.find((v) => v.id === old.id),
      )
    )
      throw Error('Опубликованные версии неизменяемы');
  for (const old of before.programs)
    if (!after.programs.some((p) => p.id === old.id)) throw Error('Удаление программы недоступно');
  for (const old of before.passes)
    if (!after.passes.some((p) => p.id === old.id)) throw Error('Удаление абонемента недоступно');
  for (const pass of after.passes) {
    const old = before.passes.find((p) => p.id === pass.id);
    const count = after.visits.filter((v) => v.passId === pass.id).length;
    if (pass.status === 'active' && (pass.end < operation.day || count >= pass.total))
      throw Error('Завершённый абонемент должен быть в архиве');
    if (
      old?.status === 'active' &&
      pass.status === 'archived' &&
      pass.end >= operation.day &&
      count < pass.total
    )
      throw Error('Нельзя произвольно архивировать доступный абонемент');
    if (
      old?.status === 'archived' &&
      pass.status === 'active' &&
      !before.visits.some((v) => v.passId === pass.id && !after.visits.some((x) => x.id === v.id))
    )
      throw Error('Повторная активация доступна только после удаления посещения');
    if (!old || old.total !== pass.total || old.start !== pass.start || old.end !== pass.end) {
      if (
        ![1, 4, 8].includes(pass.total) ||
        (!old && (pass.end < operation.day || pass.status !== 'active'))
      )
        throw Error('Недопустимый абонемент');
    }
  }
  for (const visit of after.visits) {
    const old = before.visits.find((v) => v.id === visit.id);
    if (!old) {
      if (before.visits.some((v) => v.workout?.status === 'active'))
        throw Error('Сначала завершите текущую тренировку');
      const pass = before.passes.find((p) => p.id === visit.passId);
      if (
        !pass ||
        pass.status !== 'active' ||
        visit.date !== operation.day ||
        pass.start > visit.date ||
        pass.end < visit.date ||
        before.visits.filter((v) => v.passId === pass.id).length >= pass.total
      )
        throw Error('Проход недоступен');
    } else if (old.date !== visit.date || old.passId !== visit.passId)
      throw Error('Дата и абонемент посещения неизменяемы');
    if (!old?.workout && visit.workout) {
      const program = before.programs.find((p) => p.id === visit.workout.programId);
      if (!program || program.archived || program.currentVersionId !== visit.workout.versionId)
        throw Error('Недопустимая версия для нового занятия');
    }
    if (old?.workout) {
      if (!visit.workout) throw Error('Удалять тренировку можно только вместе с посещением');
      for (const k of ['id', 'programId', 'versionId', 'versionNumber', 'content', 'startedAt'])
        if (!equal(old.workout[k], visit.workout[k])) throw Error('Снимок занятия неизменяем');
      const marksChanged = !equal(old.workout.marks, visit.workout.marks);
      if (marksChanged && (old.workout.status !== 'active' || visit.workout.status !== 'active'))
        throw Error('Сначала возобновите занятие');
      for (const section of visit.workout.content.sections)
        for (const step of section.steps) {
          if (
            step.type !== 'training' &&
            old.workout.marks[step.id].note !== visit.workout.marks[step.id].note
          )
            throw Error('Заметка доступна только тренировочным этапам');
        }
    }
  }
  for (const old of before.visits)
    if (!after.visits.some((v) => v.id === old.id)) {
      const pass = before.passes.find((p) => p.id === old.passId);
      if (pass.status === 'archived' && before.passes.some((p) => p.status === 'active'))
        throw Error('Нельзя удалять посещение архивного абонемента при действующем');
    }
}
