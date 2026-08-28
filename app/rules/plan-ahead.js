/**
 * Degree-level planning: what a combination of specialties actually costs.
 *
 * The cost of two pathways is not the sum of their separate costs, because a
 * course counts toward every pathway it appears on (ADR-0018). Energy Finance and
 * Strategy each need six courses, but together they need fewer than twelve, and no
 * student can work that out by reading two lists. That number is the point of this
 * module (ADR-0038).
 *
 * Like recommend.js, this calls the evaluator on each candidate rather than
 * reasoning about requirements itself (ADR-0027), so a plan it proposes can never
 * disagree with the progress the rest of the app shows.
 */

import { evaluatePathway, STATUS } from './evaluate.js';
import { recommend } from './recommend.js';

const MAX_STEPS = 40;

/**
 * The smallest set of additional courses that completes every pathway given.
 *
 * @param {string[]} pathwayIds
 * @param {Array<{courseId: string}>} plan
 * @param {object} catalog
 * `complete` means a full route was found — not that you are done. `alreadyComplete`
 * means you are done. Keeping those in one field printed "Already complete" over a
 * list of five courses still needed, so they are two fields now.
 *
 * @returns {{courses, complete, alreadyComplete, reachable, perPathway}}
 */
export function jointRemaining(pathwayIds, plan, catalog) {
  const targets = pathwayIds
    .map((id) => catalog.pathways.find((p) => p.id === id))
    .filter(Boolean);
  if (targets.length === 0) {
    return { courses: [], complete: true, alreadyComplete: true, reachable: true, perPathway: [] };
  }

  let current = [...plan];
  const picked = [];

  const outstanding = () => targets.filter(
    (p) => evaluatePathway(p, current, catalog).status !== STATUS.COMPLETE);

  for (let step = 0; step < MAX_STEPS; step += 1) {
    const open = outstanding();
    if (open.length === 0) break;

    // Candidates are whatever any unfinished pathway would take next. Asking the
    // per-pathway recommender keeps the candidate set small and already sensible.
    const candidates = new Set();
    for (const pathway of open) {
      const advice = recommend(pathway, current, catalog, { declared: pathwayIds });
      for (const item of advice.courses) candidates.add(item.courseId);
    }
    if (candidates.size === 0) {
      return {
        courses: picked, complete: false, alreadyComplete: false, reachable: false,
        perPathway: report(targets, current, catalog),
      };
    }

    let best = null;
    for (const courseId of candidates) {
      const trial = [...current, { courseId }];
      // Score by total progress across every open pathway, so a course serving two
      // beats a course serving one even when both advance the same amount alone.
      let gain = 0;
      let finished = 0;
      for (const pathway of open) {
        const before = evaluatePathway(pathway, current, catalog);
        const after = evaluatePathway(pathway, trial, catalog);
        gain += after.percent - before.percent;
        if (after.status === STATUS.COMPLETE && before.status !== STATUS.COMPLETE) finished += 1;
      }
      const serves = open.filter((p) => appearsIn(p, courseId)).length;
      const score = [finished, serves, gain];
      if (best === null || better(score, best.score)
          || (equal(score, best.score) && courseId < best.courseId)) {
        best = { courseId, score };
      }
    }

    if (best === null || best.score[2] <= 0 && best.score[0] === 0) {
      return {
        courses: picked, complete: false, alreadyComplete: false, reachable: false,
        perPathway: report(targets, current, catalog),
      };
    }

    const course = catalog.courses.get(best.courseId);
    picked.push({
      courseId: best.courseId,
      course,
      servesCount: best.score[1],
      serves: open.filter((p) => appearsIn(p, best.courseId)).map((p) => p.shortName ?? p.name),
    });
    current = [...current, { courseId: best.courseId }];
  }

  const complete = outstanding().length === 0;
  return {
    courses: picked,
    complete,
    alreadyComplete: complete && picked.length === 0,
    reachable: complete,
    perPathway: report(targets, current, catalog),
  };
}

/**
 * What a combination costs, and how much cheaper it is than doing each separately.
 * The saving is the whole argument for showing a joint number at all.
 */
export function combinationCost(pathwayIds, plan, catalog) {
  const joint = jointRemaining(pathwayIds, plan, catalog);
  const separate = pathwayIds.map((id) => {
    const pathway = catalog.pathways.find((p) => p.id === id);
    if (!pathway) return { pathwayId: id, remaining: 0, name: id };
    const advice = recommend(pathway, plan, catalog);
    return {
      pathwayId: id,
      name: pathway.shortName ?? pathway.name,
      remaining: advice.reachable ? advice.courses.length : null,
    };
  });

  const sum = separate.reduce((t, s) => t + (s.remaining ?? 0), 0);
  const jointCount = joint.courses.length;
  return {
    pathwayIds,
    separate,
    joint: jointCount,
    sumIfSeparate: sum,
    shared: Math.max(0, sum - jointCount),
    complete: joint.complete,
    alreadyComplete: joint.alreadyComplete,
    reachable: joint.reachable,
    courses: joint.courses,
  };
}

/**
 * Whether a combination fits in the terms that remain.
 *
 * Capacity is per-term and set by the student (ADR-0039); a term with no capacity
 * set contributes nothing rather than a guessed number, and is reported so the
 * shortfall is never quietly wrong.
 *
 * A term whose capacity is set to zero, or whose seats are all taken, is a known
 * quantity and counts as a counted term. It is only *unknown* capacity that goes
 * in `termsWithoutCapacity`. Lumping the two together made the panel report six
 * counted terms and four unknown ones directly beneath a header that said seven
 * and three, from the same data (LESSONS 2026-08-28).
 */
export function feasibility(cost, remainingTerms) {
  const known = (t) => Number.isInteger(t.capacity);
  const counted = remainingTerms.filter(known);
  const unset = remainingTerms.filter((t) => !known(t));
  const slots = counted.reduce((total, t) => total + t.capacity, 0);
  return {
    slots,
    termsCounted: counted.length,
    termsWithoutCapacity: unset.map((t) => t.id),
    required: cost.joint,
    spare: slots - cost.joint,
    fits: cost.reachable && slots >= cost.joint,
    known: unset.length === 0,
  };
}

const appearsIn = (pathway, courseId) =>
  pathway.groups.some((g) => g.courses.includes(courseId));

function report(targets, plan, catalog) {
  return targets.map((pathway) => {
    const result = evaluatePathway(pathway, plan, catalog);
    return {
      pathwayId: pathway.id,
      name: pathway.shortName ?? pathway.name,
      percent: result.percent,
      complete: result.status === STATUS.COMPLETE,
    };
  });
}

function better(a, b) {
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}
const equal = (a, b) => a.every((v, i) => v === b[i]);
