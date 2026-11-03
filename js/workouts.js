import { uid, now, clone } from './domain/model.js';
import { stageType } from './stages.js';
import { latest } from './programs.js';
export function start(s, visitId, programId) {
  const v = s.visits.find((v) => v.id === visitId);
  if (!v) throw Error('Сначала зарегистрируйте посещение');
  if (v.workout) return v.workout;
  const p = s.programs.find((p) => p.id === programId);
  if (!p || p.archived) throw Error('Программа недоступна');
  const ver = latest(s, programId);
  v.workout = {
    id: uid(),
    programId,
    versionId: ver.id,
    versionNumber: ver.number,
    content: clone(ver.content),
    status: 'active',
    startedAt: now(),
    completedAt: null,
    marks: Object.fromEntries(
      ver.content.sections.flatMap((s) =>
        s.steps.map((t) => [t.id, { status: 'pending', note: '' }]),
      ),
    ),
  };
  return v.workout;
}
export const progress = (w) => {
  const a = Object.values(w.marks);
  return {
    total: a.length,
    done: a.filter((m) => m.status === 'done').length,
    skipped: a.filter((m) => m.status === 'skipped').length,
    pending: a.filter((m) => m.status === 'pending').length,
  };
};
export function mark(s, id, step, status, note) {
  const w = s.visits.find((v) => v.id === id)?.workout;
  if (!w || w.status !== 'active' || !w.marks[step])
    throw Error('Занятие недоступно для изменений');
  if (status !== undefined) w.marks[step].status = status;
  if (note !== undefined) {
    const section = w.content.sections.find((s) => s.steps.some((t) => t.id === step));
    const stage = section.steps.find((t) => t.id === step);
    if (stageType(stage, section) !== 'training')
      throw Error('Личные заметки доступны только для этапов типа «Тренировка»');
    w.marks[step].note = note;
  }
}
export function finish(s, id, reopen = false) {
  const w = s.visits.find((v) => v.id === id)?.workout;
  if (!w) throw Error('Тренировка не найдена');
  w.status = reopen ? 'active' : 'completed';
  w.completedAt = reopen ? null : now();
}

// Use stable stage IDs across program versions. Never borrow notes from a later
// visit, a different program, or an older session when the last session is blank.
export function previousWorkout(state, visitId) {
  const current = state.visits.find((v) => v.id === visitId);
  if (!current?.workout) return null;
  const ordered = state.visits
    .map((visit, index) => ({ visit, index }))
    .filter(({ visit }) => visit.workout?.programId === current.workout.programId)
    .sort(
      (a, b) =>
        a.visit.date.localeCompare(b.visit.date) ||
        a.visit.workout.startedAt.localeCompare(b.visit.workout.startedAt) ||
        a.index - b.index,
    );
  const index = ordered.findIndex(({ visit }) => visit.id === visitId);
  return index > 0 ? ordered[index - 1].visit : null;
}

export function lastCompletedAt(state, programId) {
  let latest = null;
  for (const { workout } of state.visits) {
    if (workout?.programId !== programId || workout.status !== 'completed' || !workout.completedAt)
      continue;
    if (latest === null || Date.parse(workout.completedAt) > Date.parse(latest))
      latest = workout.completedAt;
  }
  return latest;
}
