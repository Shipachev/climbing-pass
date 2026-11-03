const defaults = { id: () => crypto.randomUUID(), clock: () => new Date() };
let dependencies = defaults;
// Dependency boundary: tests and alternative runtimes supply a calendar/clock
// without coupling domain operations to browser storage or a transport.
export function configureRuntime(overrides = {}) {
  dependencies = { ...defaults, ...overrides };
  return () => {
    dependencies = defaults;
  };
}
export const uid = () => dependencies.id();
export const now = () => dependencies.clock().toISOString();
export const today = () => {
  if (dependencies.calendar) return dependencies.calendar();
  const d = dependencies.clock();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
