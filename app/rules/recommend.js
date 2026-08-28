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

// Bound on search depth. No pathway needs more than ten elective courses, so 14
// leaves room; a pathway that also requires the core needs the core on top of that,
// which is why the bound is derived rather than constant. HSM needs 21.
const MAX_ELECTIVE_STEPS = 14;

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

  const requiresCore = (pathway.constraints ?? []).some((c) => c.type === 'requiresCore');
  const maxSteps = MAX_ELECTIVE_STEPS + (requiresCore ? catalog.coreCourses.length : 0);

  const picked = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const candidates = candidateIds(pathway, current, catalog);

    // Score every useful candidate, then pick. Keeping the whole scored list is
    // what makes alternatives honest: a course tied with the pick by the same
    // oracle IS equivalent for this step, not merely similar-looking.
    const scored = [];
    for (const courseId of candidates) {
      const trial = [...current, { courseId }];
      const trialResult = evaluatePathway(pathway, trial, catalog);
      const gain = trialResult.percent - result.percent;
      const groupsGained = countSatisfied(trialResult) - countSatisfied(result);
      const constraintGain = constraintProgress(trialResult) - constraintProgress(result);
      if (gain <= 0 && groupsGained <= 0 && constraintGain <= 0) continue;

      const elsewhere = others.filter((other) => appearsIn(other, courseId)).length;
      scored.push({ courseId, score: [groupsGained, constraintGain, gain, elsewhere], result: trialResult });
    }

    if (scored.length === 0) {
      return { complete: false, courses: picked, reachable: false };
    }

    let best = scored[0];
    for (const candidate of scored.slice(1)) {
      if (better(candidate.score, best.score) ||
          (equal(candidate.score, best.score) && candidate.courseId < best.courseId)) {
        best = candidate;
      }
    }
    const alternatives = scored
      .filter((c) => c !== best && equal(c.score, best.score))
      .map((c) => c.courseId)
      .sort();

    picked.push({
      courseId: best.courseId,
      course: catalog.courses.get(best.courseId),
      isCore: catalog.courses.get(best.courseId)?.isCore === true,
      alternatives,
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

/**
 * Courses this pathway lists that the plan can still take.
 *
 * Core courses are in no group, so they are normally not candidates. A pathway
 * that requires the core (the HSM certificate) is the exception: without them it
 * would be unreachable by any sequence of courses, which is how this surfaced.
 */
function candidateIds(pathway, plan, catalog) {
  const counts = new Map();
  for (const entry of plan) {
    counts.set(entry.courseId, (counts.get(entry.courseId) ?? 0) + 1);
  }
  const ids = new Set();
  if ((pathway.constraints ?? []).some((c) => c.type === 'requiresCore')) {
    for (const course of catalog.coreCourses) {
      if (!counts.has(course.id)) ids.add(course.id);
    }
  }
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

/** Total progress across pathway-level constraints, so partial movement is visible. */
const constraintProgress = (result) =>
  result.constraints.reduce((sum, c) => sum + (c.progress ?? 0), 0);

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
