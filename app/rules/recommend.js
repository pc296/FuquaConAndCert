/**
 * Shortest remaining path to a pathway.
 *
 * Greedy search that uses evaluatePathway as its oracle rather than reasoning
 * about requirements itself. That costs some speed and buys correctness: the
 * recommendation can never disagree with the progress display, because it is
 * produced by the same function, including allocation and constraints.
 *
 * Greedy is not provably minimal. It is deterministic, and on the current catalog
 * it reaches every pathway in exactly the number of courses the source documents
 * require, which the tests assert.
 */

import { evaluatePathway, STATUS } from './evaluate.js';

const MAX_STEPS = 14;

/**
 * @param {object} pathway
 * @param {Array<{courseId: string}>} plan
 * @param {object} catalog
 * @param {{declared?: string[]}} options - other pathways to prefer advancing on ties
 * @returns {{complete: boolean, courses: object[], reachable: boolean}}
 */
export function recommend(pathway, plan, catalog, options = {}) {
  const declared = (options.declared ?? []).filter((id) => id !== pathway.id);
  const others = declared
    .map((id) => catalog.pathways.find((p) => p.id === id))
    .filter(Boolean);

  let current = [...plan];
  let result = evaluatePathway(pathway, current, catalog);
  if (result.status === STATUS.COMPLETE) {
    return { complete: true, courses: [], reachable: true };
  }

  const picked = [];
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const candidates = candidateIds(pathway, current, catalog);
    let best = null;

    for (const courseId of candidates) {
      const trial = [...current, { courseId }];
      const trialResult = evaluatePathway(pathway, trial, catalog);
      const gain = trialResult.percent - result.percent;
      const groupsGained =
        countSatisfied(trialResult) - countSatisfied(result);
      if (gain <= 0 && groupsGained <= 0) continue;

      const elsewhere = others.filter((other) =>
        appearsIn(other, courseId),
      ).length;

      const score = [groupsGained, gain, elsewhere];
      if (best === null || better(score, best.score) ||
          (equal(score, best.score) && courseId < best.courseId)) {
        best = { courseId, score, result: trialResult };
      }
    }

    if (best === null) {
      return { complete: false, courses: picked, reachable: false };
    }

    picked.push({
      courseId: best.courseId,
      course: catalog.courses.get(best.courseId),
      alsoCountsToward: others
        .filter((other) => appearsIn(other, best.courseId))
        .map((other) => other.shortName ?? other.name),
    });
    current = [...current, { courseId: best.courseId }];
    result = best.result;

    if (result.status === STATUS.COMPLETE) {
      return { complete: true, courses: picked, reachable: true };
    }
  }
  return { complete: false, courses: picked, reachable: false };
}

/** Courses this pathway lists that the plan can still take. */
function candidateIds(pathway, plan, catalog) {
  const counts = new Map();
  for (const entry of plan) {
    counts.set(entry.courseId, (counts.get(entry.courseId) ?? 0) + 1);
  }
  const ids = new Set();
  for (const group of pathway.groups) {
    for (const courseId of group.courses) {
      const limit = catalog.courses.get(courseId)?.maxTimes ?? 1;
      if ((counts.get(courseId) ?? 0) < limit) ids.add(courseId);
    }
  }
  return [...ids].sort();
}

const appearsIn = (pathway, courseId) =>
  pathway.groups.some((g) => g.courses.includes(courseId));

const countSatisfied = (result) => result.groups.filter((g) => g.satisfied).length;

function better(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
}

const equal = (a, b) => a.every((v, i) => v === b[i]);

/** Rank every pathway by how few courses it still needs. */
export function rankPathways(catalog, plan, declared = []) {
  return catalog.pathways
    .map((pathway) => {
      const advice = recommend(pathway, plan, catalog, { declared });
      return {
        pathwayId: pathway.id,
        name: pathway.shortName ?? pathway.name,
        kind: pathway.kind,
        remaining: advice.reachable ? advice.courses.length : null,
        complete: advice.complete && advice.courses.length === 0,
      };
    })
    .sort((a, b) => {
      if (a.remaining === null) return 1;
      if (b.remaining === null) return -1;
      return a.remaining - b.remaining || a.name.localeCompare(b.name);
    });
}
