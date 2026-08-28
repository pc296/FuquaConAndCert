export { evaluatePathway, evaluateAll, STATUS } from './evaluate.js';
export { checkCombination } from './cap.js';
export { allocate } from './allocate.js';
export { recommend, rankPathways } from './recommend.js';

/** Build the shape evaluate() expects from the two catalog files. */
export function buildCatalog(pathwaysJson, coursesJson) {
  return {
    pathways: pathwaysJson.pathways,
    combinationRule: pathwaysJson.combinationRule,
    retrieved: pathwaysJson.retrieved,
    countedCredits: coursesJson.countedCredits ?? {},
    courses: new Map(coursesJson.courses.map((c) => [c.id, c])),
    courseList: coursesJson.courses,
    coreCourses: coursesJson.courses.filter((c) => c.isCore),
  };
}
