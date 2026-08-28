/**
 * Plan persistence. localStorage as the working store, with a versioned JSON file
 * as the backup and sharing format (ADR-0011).
 *
 * A failed read never loses the plan: it returns an empty plan and reports the
 * error so the UI can offer an import instead of silently starting over.
 *
 * Format 2 replaced integer `quarter` with string `term` ids to make room for the
 * summer and winter terms (ADR-0035). Format 1 files still import: `migrate` maps
 * the old integers, which is why the version field has been there since the first
 * release. Breaking a multi-year plan silently is the failure this guards against.
 */

import { PRE_FUQUA, isTermId, fromLegacyQuarter, normalizeTerm } from '../ui/placement.js';

const KEY = 'fuqua-concert.plan.v1';
export const PLAN_FORMAT_VERSION = 2;

export const emptyPlan = () => ({
  formatVersion: PLAN_FORMAT_VERSION,
  app: 'Fuqua ConCert',
  updated: null,
  /** Calendar year the program's Year 1 Fall begins. Null until set or inferred. */
  startYear: null,
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

/** Accept plans written by any released format rather than discarding them. */
export function migrate(data) {
  const base = emptyPlan();
  if (!data || typeof data !== 'object') return base;

  const entries = (Array.isArray(data.entries) ? data.entries : [])
    .filter((e) => e && typeof e.courseId === 'string')
    .map((e) => {
      const { quarter, ...rest } = e;
      // Format 1 stored an integer quarter; format 2 stores a term id. A file may
      // legitimately carry either, so prefer the new field and fall back.
      const term = isTermId(e.term) ? e.term : fromLegacyQuarter(quarter);
      return { ...rest, term };
    });

  return {
    ...base,
    ...data,
    formatVersion: PLAN_FORMAT_VERSION,
    startYear: Number.isInteger(data.startYear) ? data.startYear : null,
    declared: Array.isArray(data.declared) ? data.declared : [],
    entries,
  };
}

/** Re-snap every entry after a catalog change, since Fuqua status drives placement. */
export function normalizeEntries(plan, isFuquaOf) {
  for (const entry of plan.entries) {
    entry.term = normalizeTerm(isFuquaOf(entry.courseId), entry.term ?? PRE_FUQUA);
  }
  return plan;
}

export function toFile(plan) {
  return JSON.stringify({ ...plan, exported: new Date().toISOString() }, null, 2);
}

export function fromFile(text) {
  return migrate(JSON.parse(text));
}
