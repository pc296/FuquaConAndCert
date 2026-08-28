/**
 * Plan persistence. localStorage as the working store, with a versioned JSON file
 * as the backup and sharing format (ADR-0011).
 *
 * A failed read never loses the plan: it returns an empty plan and reports the
 * error so the UI can offer an import instead of silently starting over.
 */

const KEY = 'fuqua-concert.plan.v1';
export const PLAN_FORMAT_VERSION = 1;

export const emptyPlan = () => ({
  formatVersion: PLAN_FORMAT_VERSION,
  app: 'Fuqua ConCert',
  updated: null,
  declared: [],
  entries: [],
});

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { plan: emptyPlan(), error: null };
    return { plan: migrate(JSON.parse(raw)), error: null };
  } catch (error) {
    return { plan: emptyPlan(), error };
  }
}

export function save(plan) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...plan, updated: new Date().toISOString() }));
    return { ok: true, error: null };
  } catch (error) {
    return { ok: false, error };
  }
}

/** Accept older plan files rather than discarding a student's multi-year plan. */
export function migrate(data) {
  const base = emptyPlan();
  if (!data || typeof data !== 'object') return base;
  return {
    ...base,
    ...data,
    formatVersion: PLAN_FORMAT_VERSION,
    declared: Array.isArray(data.declared) ? data.declared : [],
    entries: Array.isArray(data.entries) ? data.entries.filter(isEntry) : [],
  };
}

const isEntry = (e) => e && typeof e.courseId === 'string';

export function toFile(plan) {
  return JSON.stringify({ ...plan, exported: new Date().toISOString() }, null, 2);
}

export function fromFile(text) {
  return migrate(JSON.parse(text));
}
