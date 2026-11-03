import { seeds } from '../seeds.js';
import { stageTypes, upgradeStageTypes } from '../stages.js';
export const KEY = 'climb_pass_v2';
export const clone = (x) => structuredClone(x);
export { uid, now, today } from './runtime.js';
import { uid, now, today } from './runtime.js';
const assert = (ok, msg) => {
  if (!ok) throw Error(msg);
};
const str = (x) => typeof x === 'string';
const id = (x) => str(x) && /^[A-Za-z0-9_-]+$/.test(x);
export const date = (x) =>
  str(x) &&
  /^\d{4}-\d{2}-\d{2}$/.test(x) &&
  !isNaN(Date.parse(x)) &&
  new Date(x).toISOString().slice(0, 10) === x;
const timestamp = (x) => str(x) && /^\d{4}-\d{2}-\d{2}T/.test(x) && !isNaN(Date.parse(x));
function durationText(x) {
  return str(x) && (!x.trim() || !/^[-+]?\d+(\.\d+)?$/.test(x.trim()) || Number(x) > 0);
}
function unique(a) {
  assert(a.every(id) && new Set(a).size === a.length, 'Повторяющиеся или неверные идентификаторы');
}
export function validateContent(c, draft = false) {
  assert(
    c && str(c.title) && str(c.goal) && str(c.notes) && Array.isArray(c.sections),
    'Неверное содержание программы',
  );
  assert(
    c.duration === '' ||
      c.duration === null ||
      (typeof c.duration === 'number' && Number.isFinite(c.duration) && (draft || c.duration > 0)),
    'Продолжительность должна быть положительной',
  );
  unique(c.sections.map((s) => s.id));
  let steps = [];
  for (const s of c.sections) {
    assert(
      str(s.title) &&
        (draft ? str(s.duration) : durationText(s.duration)) &&
        Array.isArray(s.steps),
      'Неверный раздел',
    );
    if (!draft) assert(s.title.trim(), 'Укажите название раздела');
    for (const t of s.steps) {
      assert(
        id(t.id) &&
          str(t.title) &&
          str(t.instructions) &&
          (draft ? str(t.duration) : durationText(t.duration)) &&
          str(t.volume) &&
          typeof t.optional === 'boolean' &&
          (t.type === undefined || Object.hasOwn(stageTypes, t.type)),
        'Неверный этап',
      );
      if (!draft) assert(t.title.trim(), 'Укажите название этапа');
      steps.push(t);
    }
  }
  unique(steps.map((t) => t.id));
  if (!draft)
    assert(c.title.trim() && steps.length, 'Нужны название программы и хотя бы один этап');
  return c;
}
export function validate(s) {
  assert(
    s &&
      s.schemaVersion === 2 &&
      ['passes', 'visits', 'programs', 'versions', 'drafts'].every((k) => Array.isArray(s[k])),
    'Неподдерживаемая схема данных',
  );
  for (const k of ['passes', 'visits', 'programs', 'versions']) unique(s[k].map((x) => x.id));
  assert(
    s.passes.filter((p) => p.status === 'active').length <= 1,
    'Возможно только одно действующее членство',
  );
  for (const p of s.passes)
    assert(
      date(p.start) &&
        date(p.end) &&
        p.end >= p.start &&
        Number.isInteger(p.total) &&
        p.total > 0 &&
        ['active', 'archived'].includes(p.status) &&
        s.visits.filter((v) => v.passId === p.id).length <= p.total,
      'Неверный абонемент',
    );
  for (const v of s.versions) {
    assert(
      s.programs.some((p) => p.id === v.programId) &&
        Number.isInteger(v.number) &&
        v.number > 0 &&
        timestamp(v.savedAt),
      'Неверная версия',
    );
    validateContent(v.content);
  }
  for (const p of s.programs) {
    const vs = s.versions.filter((v) => v.programId === p.id).sort((a, b) => a.number - b.number);
    assert(
      typeof p.archived === 'boolean' &&
        vs.length &&
        vs.every((v, i) => v.number === i + 1) &&
        p.currentVersionId === vs.at(-1).id,
      'Неверная история версий',
    );
  }
  unique(s.drafts.map((d) => d.programId));
  for (const d of s.drafts) {
    assert(
      s.versions.some((v) => v.id === d.baseVersionId && v.programId === d.programId) &&
        timestamp(d.updatedAt),
      'Неверный черновик',
    );
    validateContent(d.content, true);
  }
  const workoutIds = [];
  for (const v of s.visits) {
    assert(
      s.passes.some((p) => p.id === v.passId) && date(v.date),
      'Посещение без абонемента или неверная дата',
    );
    if (v.workout) {
      const w = v.workout;
      workoutIds.push(w.id);
      const ver = s.versions.find((x) => x.id === w.versionId);
      assert(
        ver &&
          ver.programId === w.programId &&
          w.versionNumber === ver.number &&
          JSON.stringify(w.content) === JSON.stringify(ver.content),
        'Неверная связь или снимок тренировки',
      );
      validateContent(w.content);
      assert(
        ['active', 'completed'].includes(w.status) &&
          timestamp(w.startedAt) &&
          (w.status === 'completed'
            ? timestamp(w.completedAt) && w.completedAt >= w.startedAt
            : w.completedAt === null),
        'Неверное состояние тренировки',
      );
      const ids = w.content.sections.flatMap((s) => s.steps.map((t) => t.id));
      assert(
        w.marks &&
          typeof w.marks === 'object' &&
          !Array.isArray(w.marks) &&
          Object.keys(w.marks).length === ids.length &&
          ids.every(
            (id) =>
              w.marks[id] &&
              ['pending', 'done', 'skipped'].includes(w.marks[id].status) &&
              str(w.marks[id].note),
          ),
        'Неверные отметки',
      );
    }
  }
  unique(workoutIds);
  return s;
}
export function migrate(legacy) {
  assert(Array.isArray(legacy), 'Старые данные повреждены');
  const s = { schemaVersion: 2, passes: [], visits: [], programs: [], versions: [], drafts: [] };
  const ids = new Set();
  for (const p of legacy) {
    assert(
      p &&
        Number.isInteger(p.id) &&
        !ids.has(p.id) &&
        date(p.start) &&
        date(p.end) &&
        Array.isArray(p.visits) &&
        p.visits.every(date),
      'Неверный старый абонемент',
    );
    ids.add(p.id);
    const pass = {
      id: `legacy-${p.id}`,
      start: p.start,
      end: p.end,
      total: p.total,
      status: p.status,
    };
    s.passes.push(pass);
    p.visits.forEach((d, i) =>
      s.visits.push({ id: `legacy-${p.id}-visit-${i}`, passId: pass.id, date: d }),
    );
  }
  seeds.forEach((c, i) => {
    const id = `program-${i + 1}`,
      vid = `${id}-v1`;
    s.programs.push({ id, archived: false, currentVersionId: vid });
    s.versions.push({ id: vid, programId: id, number: 1, savedAt: now(), content: clone(c) });
  });
  return validate(s);
}
