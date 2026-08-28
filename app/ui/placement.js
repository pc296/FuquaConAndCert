/**
 * Course placement: where a course sits in the program timeline.
 *
 * Placement is display metadata only. Evaluation never reads it (ADR-0030), which
 * is what makes the Pre-Fuqua rule safe: courses there count toward pathways
 * exactly like any other course, per Pat.
 *
 * Fuqua courses live in 6-week terms (quarters 1-8). Non-Fuqua Duke courses run on
 * the university semester calendar and span two Fuqua terms, so they are placed by
 * semester and stored as the semester's starting quarter (1, 3, 5, 7). Quarter 0 is
 * the Pre-Fuqua Dual Degree Coursework bucket.
 */

export const PRE_FUQUA = 0;

export const TERM_LABELS = {
  1: 'Fall 1', 2: 'Fall 2', 3: 'Spring 1', 4: 'Spring 2',
  5: 'Fall 1', 6: 'Fall 2', 7: 'Spring 1', 8: 'Spring 2',
};

export const SEMESTERS = [
  { start: 1, label: 'Year 1 · Fall', quarters: [1, 2] },
  { start: 3, label: 'Year 1 · Spring', quarters: [3, 4] },
  { start: 5, label: 'Year 2 · Fall', quarters: [5, 6] },
  { start: 7, label: 'Year 2 · Spring', quarters: [7, 8] },
];

export const PRE_FUQUA_LABEL = 'Pre-Fuqua Dual Degree Coursework';

/** Placement choices for a course: terms for Fuqua courses, semesters otherwise. */
export function placementOptions(isFuqua) {
  const options = [{ value: PRE_FUQUA, label: PRE_FUQUA_LABEL }];
  if (isFuqua) {
    for (const s of SEMESTERS) {
      for (const q of s.quarters) {
        options.push({ value: q, label: `${s.label.split(' · ')[0]} ${TERM_LABELS[q]}` });
      }
    }
  } else {
    for (const s of SEMESTERS) {
      options.push({ value: s.start, label: `${s.label} (both terms)` });
    }
  }
  return options;
}

/**
 * Snap a chosen quarter to a legal placement for the course. A non-Fuqua course
 * placed in the second term of a semester is stored at the semester's start; the
 * span to the second term is implied by the course being non-Fuqua.
 */
export function normalizeQuarter(isFuqua, quarter) {
  const q = Number(quarter);
  if (!Number.isInteger(q) || q < 0 || q > 8) return PRE_FUQUA;
  if (q === PRE_FUQUA || isFuqua) return q;
  return q % 2 === 0 ? q - 1 : q;
}

export const spansSemester = (isFuqua, quarter) => !isFuqua && quarter !== PRE_FUQUA;

export function semesterOf(quarter) {
  return SEMESTERS.find((s) => s.quarters.includes(quarter)) ?? null;
}

/** Human label for a stored placement, for the report and chips. */
export function placementLabel(isFuqua, quarter) {
  if (quarter === PRE_FUQUA) return PRE_FUQUA_LABEL;
  const semester = semesterOf(quarter);
  if (!semester) return `Quarter ${quarter}`;
  return isFuqua ? `${semester.label.split(' · ')[0]} ${TERM_LABELS[quarter]}` : `${semester.label} (both terms)`;
}
