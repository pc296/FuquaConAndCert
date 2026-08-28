/**
 * Pathway evaluation. Pure: no DOM, no fetch, no storage.
 *
 * Across pathways every course counts everywhere it appears (ADR-0018), so each
 * pathway is evaluated independently against the whole plan. Within a pathway,
 * courses are allocated to at most one group by allocate().
 */

import { allocate } from './allocate.js';

/** @typedef {{courseId: string, quarter?: number, gradePoints?: number, credits?: number}} PlanEntry */

export const STATUS = {
  COMPLETE: 'complete',
  IN_PROGRESS: 'in-progress',
  NOT_STARTED: 'not-started',
};

/**
 * @param {object} pathway - a record from data/catalog/pathways.json
 * @param {PlanEntry[]} plan
 * @param {{courses: Map<string, object>, countedCredits?: object}} catalog
 */
export function evaluatePathway(pathway, plan, catalog) {
  const courseOf = (entry) => catalog.courses.get(entry.courseId);
  const creditsOf = (entry) => {
    const override = catalog.countedCredits?.[pathway.id]?.[entry.courseId];
    if (typeof override === 'number') return override;
    if (typeof entry.credits === 'number') return entry.credits;
    return courseOf(entry)?.credits ?? 0;
  };

  const eligibility = buildEligibility(pathway);

  // Required groups consume their own courses before anything is allocated.
  const consumed = new Set();
  const groupResults = [];
  for (const group of pathway.groups) {
    if (group.type !== 'all') continue;
    const held = [];
    const missing = [];
    for (const courseId of group.courses) {
      const entry = plan.find((e) => e.courseId === courseId && !consumed.has(e));
      if (entry) {
        consumed.add(entry);
        held.push(courseId);
      } else {
        missing.push(courseId);
      }
    }
    groupResults.push({
      id: group.id,
      label: group.label,
      type: 'all',
      min: group.courses.length,
      have: held.length,
      unit: 'courses',
      satisfied: missing.length === 0,
      assigned: held,
      missing,
    });
  }

  // Everything else goes through allocation.
  const demandGroups = pathway.groups
    .filter((g) => g.type !== 'all')
    .map((g) => ({
      id: g.id,
      type: g.type,
      min: g.min,
      cap: g.overflowFrom ? g.overflowFrom.max : undefined,
    }));

  const items = [];
  plan.forEach((entry, index) => {
    if (consumed.has(entry)) return;
    const groups = [];
    const capped = [];
    for (const group of pathway.groups) {
      if (group.type === 'all') continue;
      const elig = eligibility.get(group.id);
      if (elig.direct.has(entry.courseId)) groups.push(group.id);
      else if (elig.overflow.has(entry.courseId)) {
        groups.push(group.id);
        capped.push(group.id);
      }
    }
    if (groups.length > 0) {
      items.push({ key: `${index}:${entry.courseId}`, entry, credits: creditsOf(entry), groups, capped });
    }
  });

  const { assignment, approximate } = allocate(demandGroups, items);
  const itemByKey = new Map(items.map((i) => [i.key, i]));

  for (const group of pathway.groups) {
    if (group.type === 'all') continue;
    const keys = assignment[group.id] ?? [];
    const assigned = keys.map((k) => itemByKey.get(k).entry.courseId);
    const have =
      group.type === 'credits'
        ? keys.reduce((sum, k) => sum + itemByKey.get(k).credits, 0)
        : keys.length;
    groupResults.push({
      id: group.id,
      label: group.label,
      type: group.type,
      min: group.min,
      have: round2(have),
      unit: group.type === 'credits' ? 'credits' : 'courses',
      satisfied: have >= group.min - 1e-9,
      assigned,
      missing: [],
      constraints: checkGroupConstraints(group, assigned, catalog),
    });
  }

  // Pathway totals count every planned course that is eligible anywhere in this
  // pathway, each counted once, whether or not allocation needed it.
  const countable = plan.filter((entry, index) =>
    consumed.has(entry) || items.some((i) => i.key === `${index}:${entry.courseId}`),
  );
  const totalCredits = round2(countable.reduce((sum, e) => sum + creditsOf(e), 0));
  const totalCourses = countable.length;

  const pathwayConstraints = checkPathwayConstraints(pathway, countable, catalog, creditsOf);
  const gpa = evaluateGpa(pathway, countable);
  const intermediate = evaluateIntermediate(pathway, countable, catalog, gpa);

  const totals = {
    credits: totalCredits,
    courses: totalCourses,
    minCredits: pathway.minCredits ?? null,
    minCourses: pathway.minCourses ?? null,
    creditsSatisfied: pathway.minCredits ? totalCredits >= pathway.minCredits - 1e-9 : true,
    coursesSatisfied: pathway.minCourses ? totalCourses >= pathway.minCourses : true,
  };

  const groupsSatisfied = groupResults.every((g) => g.satisfied);
  const groupConstraintsOk = groupResults.every((g) =>
    (g.constraints ?? []).every((c) => c.satisfied),
  );
  const constraintsOk = pathwayConstraints.every((c) => c.satisfied) && groupConstraintsOk;
  const gpaOk = !gpa || gpa.satisfied !== false;

  const complete =
    groupsSatisfied && totals.creditsSatisfied && totals.coursesSatisfied && constraintsOk && gpaOk;

  return {
    pathwayId: pathway.id,
    name: pathway.name,
    shortName: pathway.shortName ?? pathway.name,
    kind: pathway.kind,
    slots: pathway.slots ?? 1,
    status: complete ? STATUS.COMPLETE : totalCourses > 0 ? STATUS.IN_PROGRESS : STATUS.NOT_STARTED,
    percent: progressPercent(groupResults, totals),
    groups: groupResults,
    totals,
    constraints: pathwayConstraints,
    gpa,
    intermediate,
    approximate,
    notes: pathway.notes ?? [],
    source: pathway.source,
  };
}

/** Expand each group's eligible course set, including cross-group clauses. */
function buildEligibility(pathway) {
  const byId = new Map(pathway.groups.map((g) => [g.id, g]));
  const map = new Map();
  for (const group of pathway.groups) {
    if (group.type === 'all') continue;
    const direct = new Set(group.courses);
    if (group.includesGroup) {
      for (const c of byId.get(group.includesGroup)?.courses ?? []) direct.add(c);
    }
    const overflow = new Set();
    if (group.overflowFrom) {
      for (const c of byId.get(group.overflowFrom.group)?.courses ?? []) {
        if (!direct.has(c)) overflow.add(c);
      }
    }
    map.set(group.id, { direct, overflow });
  }
  return map;
}

function checkGroupConstraints(group, assignedIds, catalog) {
  return (group.constraints ?? []).map((constraint) => {
    const courses = assignedIds.map((id) => catalog.courses.get(id)).filter(Boolean);
    switch (constraint.type) {
      case 'minOutsideArea': {
        const have = courses.filter((c) => c.area !== constraint.area).length;
        return result(constraint, have >= constraint.n,
          `${have} of ${constraint.n} courses outside ${constraint.area}`);
      }
      case 'maxPracticum': {
        const have = courses.filter((c) => c.isPracticum).length;
        return result(constraint, have <= constraint.n,
          `${have} practicum course${have === 1 ? '' : 's'}, limit ${constraint.n}`);
      }
      case 'minFromSubset': {
        const subset = new Set(constraint.subset);
        const have = assignedIds.filter((id) => subset.has(id)).length;
        return result(constraint, have >= constraint.n,
          `${have} of ${constraint.n} ${constraint.label ?? 'required subset'}`);
      }
      case 'minFromArea': {
        const have = courses.filter((c) => c.area === constraint.area).length;
        return result(constraint, have >= constraint.n,
          `${have} of ${constraint.n} ${constraint.area} courses`);
      }
      default:
        return result(constraint, true, 'not evaluated');
    }
  });
}

function checkPathwayConstraints(pathway, countable, catalog, creditsOf) {
  return (pathway.constraints ?? []).map((constraint) => {
    if (constraint.type === 'maxNonFuquaCredits') {
      const have = round2(
        countable
          .filter((e) => catalog.courses.get(e.courseId)?.isFuqua === false)
          .reduce((sum, e) => sum + creditsOf(e), 0),
      );
      return result(constraint, have <= constraint.n,
        `${have} non-Fuqua credits, limit ${constraint.n}`);
    }
    return result(constraint, true, 'not evaluated');
  });
}

function evaluateGpa(pathway, countable) {
  if (!pathway.gpa) return null;
  const graded = countable.filter((e) => typeof e.gradePoints === 'number');
  if (graded.length === 0) {
    return { min: pathway.gpa.min, value: null, satisfied: null, known: false, note: pathway.gpa.note };
  }
  // "We compute your GPA over the highest qualifying grades" when extra courses are taken.
  const needed = pathway.minCourses ?? graded.length;
  const best = [...graded].sort((a, b) => b.gradePoints - a.gradePoints).slice(0, needed);
  const value = round2(best.reduce((s, e) => s + e.gradePoints, 0) / best.length);
  return {
    min: pathway.gpa.min,
    value,
    satisfied: value >= pathway.gpa.min - 1e-9,
    known: graded.length >= needed,
    gradedCount: graded.length,
    note: pathway.gpa.note,
  };
}

/**
 * Some certificates have a named partial state worth showing before completion.
 * The Finance Certificate lets a student write "Qualifying for a Certificate of
 * Academic Excellence in Finance" on a resume once they have 3 finance electives,
 * 1 non-finance elective, and a qualifying GPA.
 */
function evaluateIntermediate(pathway, countable, catalog, gpa) {
  const rule = pathway.intermediate;
  if (!rule) return null;
  const areaOf = (entry) => catalog.courses.get(entry.courseId)?.area;
  const inArea = countable.filter((e) => areaOf(e) === rule.area).length;
  const outsideArea = countable.filter((e) => areaOf(e) && areaOf(e) !== rule.area).length;
  const countsMet = inArea >= rule.minFinanceElectives && outsideArea >= rule.minNonFinanceElectives;
  // An unknown GPA does not block the claim; a known failing one does.
  const gpaBlocks = gpa?.satisfied === false;
  return {
    label: rule.label,
    satisfied: countsMet && !gpaBlocks,
    detail: `${inArea} of ${rule.minFinanceElectives} ${rule.area} electives, ` +
      `${outsideArea} of ${rule.minNonFinanceElectives} outside ${rule.area}` +
      (gpaBlocks ? ', but the GPA is below the threshold' : ''),
    note: rule.note,
  };
}

function progressPercent(groups, totals) {
  const parts = groups.map((g) => Math.min(1, g.min === 0 ? 1 : g.have / g.min));
  if (totals.minCredits) parts.push(Math.min(1, totals.credits / totals.minCredits));
  if (totals.minCourses) parts.push(Math.min(1, totals.courses / totals.minCourses));
  if (parts.length === 0) return 0;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

const result = (constraint, satisfied, detail) => ({
  type: constraint.type,
  note: constraint.note ?? constraint.label ?? '',
  satisfied,
  detail,
});

const round2 = (n) => Math.round(n * 100) / 100;

/** Evaluate every pathway in the catalog against one plan. */
export function evaluateAll(catalog, plan) {
  return catalog.pathways.map((p) => evaluatePathway(p, plan, catalog));
}
