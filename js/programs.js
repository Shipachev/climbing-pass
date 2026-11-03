import { uid, now, clone, validateContent } from './domain/model.js';
export const latest = (s, id) =>
  s.versions.find((v) => v.id === s.programs.find((p) => p.id === id)?.currentVersionId);
export function draft(s, id) {
  let d = s.drafts.find((d) => d.programId === id);
  if (!d) {
    const v = latest(s, id);
    if (!v) throw Error('Программа не найдена');
    d = { programId: id, baseVersionId: v.id, updatedAt: now(), content: clone(v.content) };
    s.drafts.push(d);
  }
  return d;
}
export function publish(s, id, content) {
  validateContent(content);
  const p = s.programs.find((p) => p.id === id);
  if (!p) throw Error('Программа не найдена');
  const v = {
    id: uid(),
    programId: id,
    number: latest(s, id).number + 1,
    savedAt: now(),
    content: clone(content),
  };
  s.versions.push(v);
  p.currentVersionId = v.id;
  s.drafts = s.drafts.filter((d) => d.programId !== id);
  return v;
}
