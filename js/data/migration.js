import { decode } from '../backup.js';
import { validate, clone, migrate } from '../domain/model.js';
import { upgradeStageTypes } from '../stages.js';
export function parseSource(input) {
  const value = typeof input === 'string' ? JSON.parse(input) : input;
  let state;
  if (value && Object.hasOwn(value, 'climb_pass_v2')) {
    if (value.climb_pass_v2 !== null) state = JSON.parse(value.climb_pass_v2);
    else state = migrate(JSON.parse(value.climb_pass || '[]'));
  } else if (value?.schemaVersion === 2) state = value;
  else if (value?.formatVersion === 3) state = value.local?.state;
  else state = decode(JSON.stringify(value)).state;
  return validate(upgradeStageTypes(validate(clone(state))));
}
export const counts = (s) => ({
  passes: s.passes.length,
  visits: s.visits.length,
  programs: s.programs.length,
  versions: s.versions.length,
  drafts: s.drafts.length,
  workouts: s.visits.filter((v) => v.workout).length,
  marks: s.visits.reduce((n, v) => n + Object.keys(v.workout?.marks || {}).length, 0),
});
export function preview(state, current) {
  const warnings = state.visits
    .filter((v) => {
      const p = state.passes.find((p) => p.id === v.passId);
      return v.date < p.start || v.date > p.end;
    })
    .map((v) => `Посещение ${v.id}: дата вне срока абонемента; сохранено без изменения.`);
  const collisions = ['passes', 'visits', 'programs', 'versions'].flatMap((kind) =>
    state[kind]
      .filter((x) => current[kind].some((y) => x.id === y.id))
      .map((x) => `${kind}/${x.id}`),
  );
  return {
    counts: counts(state),
    warnings,
    collisions,
    hasCloudHistory:
      current.passes.length > 0 || current.visits.length > 0 || current.programs.length > 0,
  };
}
export async function rawCopy(storage = localStorage, origin = location.origin) {
  const source = {
    climb_pass: storage.getItem('climb_pass'),
    climb_pass_v2: storage.getItem('climb_pass_v2'),
  };
  const bytes = JSON.stringify(source);
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(bytes));
  return {
    ...source,
    origin,
    capturedAt: new Date().toISOString(),
    sha256: [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join(''),
  };
}
// Imports from another device receive a deterministic namespace. A same-date
// visit is always a separate visit; no heuristic deduplication of personal data.
export function joinHistory(current, incoming, sourceHash) {
  const source = clone(incoming),
    namespace = `import-${sourceHash.slice(0, 16)}-`,
    idMap = {};
  const mapped = (kind, id) => {
    const key = `${kind}/${id}`;
    return idMap[key] || (idMap[key] = namespace + id);
  };
  for (const pass of source.passes) pass.id = mapped('passes', pass.id);
  for (const program of source.programs) {
    program.id = mapped('programs', program.id);
    program.currentVersionId = mapped('versions', program.currentVersionId);
  }
  for (const version of source.versions) {
    version.id = mapped('versions', version.id);
    version.programId = mapped('programs', version.programId);
  }
  for (const draft of source.drafts) {
    draft.programId = mapped('programs', draft.programId);
    draft.baseVersionId = mapped('versions', draft.baseVersionId);
  }
  for (const visit of source.visits) {
    visit.id = mapped('visits', visit.id);
    visit.passId = mapped('passes', visit.passId);
    if (visit.workout) {
      const w = visit.workout;
      w.id = mapped('workouts', w.id);
      w.programId = mapped('programs', w.programId);
      w.versionId = mapped('versions', w.versionId);
    }
  }
  const merged = clone(current);
  for (const kind of ['passes', 'visits', 'programs', 'versions', 'drafts'])
    merged[kind].push(...source[kind]);
  // In particular, two active passes require a separate user decision. Both
  // source graphs stay intact; never silently archive one to make a merge pass.
  return { state: validate(merged), idMap };
}
