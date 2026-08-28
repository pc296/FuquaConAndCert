export { evaluatePathway, evaluateAll, STATUS } from './evaluate.js';
export { checkCombination } from './cap.js';
export { allocate } from './allocate.js';
export { recommend, rankPathways } from './recommend.js';

/**
 * Build the shape evaluate() expects from the two catalog files.
 *
 * Pathway records cite courses exactly as their source document spells them, which
 * is deliberate: the catalog stays checkable against the PDF it came from. Where two
 * documents spell one course differently, the alternate codes live on the course
 * record and are resolved here, so a single course counts on every pathway that
 * lists it under any of its names (ADR-0037).
 */
export function buildCatalog(pathwaysJson, coursesJson) {
  const courses = new Map(coursesJson.courses.map((c) => [c.id, c]));

  /** Alternate code -> canonical id. */
  const canonical = new Map();
  for (const course of coursesJson.courses) {
    for (const alias of course.aliases ?? []) canonical.set(alias, course.id);
  }
  const resolve = (id) => (courses.has(id) ? id : canonical.get(id) ?? id);

  const unresolved = new Set();
  const pathways = pathwaysJson.pathways.map((pathway) => ({
    ...pathway,
    groups: pathway.groups.map((group) => {
      const mapped = group.courses.map((id) => {
        const resolved = resolve(id);
        if (!courses.has(resolved)) unresolved.add(id);
        return resolved;
      });
      return {
        ...group,
        courses: [...new Set(mapped)],
        ...(group.constraints
          ? { constraints: group.constraints.map((c) => (c.subset
              ? { ...c, subset: c.subset.map(resolve) } : c)) }
          : {}),
      };
    }),
  }));

  return {
    pathways,
    combinationRule: pathwaysJson.combinationRule,
    retrieved: pathwaysJson.retrieved,
    countedCredits: coursesJson.countedCredits ?? {},
    courses,
    courseList: coursesJson.courses,
    coreCourses: coursesJson.courses.filter((c) => c.isCore),
    /** Every code a course answers to, canonical and alternate, for import matching. */
    codeIndex: buildCodeIndex(coursesJson.courses),
    unresolved: [...unresolved],
  };
}

function buildCodeIndex(courseList) {
  const index = new Map();
  const add = (code, course) => {
    if (!index.has(code)) index.set(code, []);
    if (!index.get(code).includes(course)) index.get(code).push(course);
  };
  for (const course of courseList) {
    add(course.code, course);
    for (const alias of course.aliases ?? []) add(alias, course);
  }
  return index;
}
