import { uid, today, date } from './domain/model.js';
export const visitsFor = (s, id) => s.visits.filter((v) => v.passId === id);
export const finished = (s, p) => p.end < today() || visitsFor(s, p.id).length >= p.total;
export const active = (s) => s.passes.find((p) => p.status === 'active');
export function archive(s) {
  for (const p of s.passes) if (p.status === 'active' && finished(s, p)) p.status = 'archived';
}
export function addPass(s, start, end, total) {
  if (active(s)) throw Error('Уже есть действующий абонемент');
  if (!date(start) || !date(end) || end < start || end < today() || ![1, 4, 8].includes(total))
    throw Error('Проверьте даты и количество посещений');
  const p = { id: uid(), start, end, total, status: 'active' };
  s.passes.push(p);
  return p;
}
export function addVisit(s, passId) {
  if (s.visits.some((v) => v.workout?.status === 'active'))
    throw Error('Сначала завершите текущую тренировку');
  const p = s.passes.find((p) => p.id === passId);
  if (!p || p.status !== 'active' || finished(s, p) || p.start > today())
    throw Error('Абонемент недоступен для посещения');
  const v = { id: uid(), passId, date: today() };
  s.visits.push(v);
  archive(s);
  return v;
}
export function deleteVisit(s, id) {
  const v = s.visits.find((v) => v.id === id);
  if (!v) throw Error('Посещение не найдено');
  const p = s.passes.find((p) => p.id === v.passId);
  if (p.status === 'archived' && active(s))
    throw Error('Нельзя удалить посещение завершённого абонемента, пока есть действующий');
  s.visits = s.visits.filter((v) => v.id !== id);
  if (!active(s) && !finished(s, p)) p.status = 'active';
}

export function newestVisits(visits) {
  return visits
    .map((visit, index) => ({ visit, index }))
    .sort(
      (a, b) =>
        b.visit.date.localeCompare(a.visit.date) ||
        (b.visit.workout?.startedAt || '').localeCompare(a.visit.workout?.startedAt || '') ||
        b.index - a.index,
    )
    .map(({ visit }) => visit);
}
