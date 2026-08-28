import { readFileSync } from 'node:fs';
import { buildCatalog } from '../../app/rules/index.js';

const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));

export const catalog = buildCatalog(
  read('../../data/catalog/pathways.json'),
  read('../../data/catalog/courses.json'),
);

export const pathway = (id) => {
  const found = catalog.pathways.find((p) => p.id === id);
  if (!found) throw new Error(`no pathway ${id}`);
  return found;
};

/** Build a plan from course ids, with optional per-course grade points. */
export const plan = (ids, grades = {}) =>
  ids.map((courseId, i) => ({
    courseId,
    quarter: (i % 8) + 1,
    ...(grades[courseId] !== undefined ? { gradePoints: grades[courseId] } : {}),
  }));
