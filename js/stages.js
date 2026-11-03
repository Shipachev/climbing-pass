export const stageTypes = { warmup: 'Разминка', training: 'Тренировка', cooldown: 'Заминка' };
// Backward compatibility for copies and snapshots saved before stage types existed.
export function stageType(step, section) {
  if (step.type !== undefined) return step.type;
  if (/размин|warm/i.test(`${section.id} ${section.title}`)) return 'warmup';
  if (/замин|заверш|end|cool/i.test(`${section.id} ${section.title}`)) return 'cooldown';
  return 'training';
}
export function addStageTypes(content) {
  for (const section of content.sections) {
    for (const step of section.steps) step.type = stageType(step, section);
  }
  return content;
}
export function upgradeStageTypes(state) {
  for (const version of state.versions) addStageTypes(version.content);
  for (const draft of state.drafts) addStageTypes(draft.content);
  for (const visit of state.visits) if (visit.workout) addStageTypes(visit.workout.content);
  return state;
}
