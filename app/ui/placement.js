/**
 * Where a course sits in the program timeline.
 *
 * Placement is display metadata only. Evaluation never reads it (ADR-0030), which
 * is what makes renumbering the terms safe and what lets Pre-Fuqua coursework count
 * toward pathways exactly like any other course.
 *
 * Terms are string ids rather than integers (ADR-0035). A backup that says
 * "y1-fall-2" is readable; one that says "2" is not, and the integers could not
 * accommodate the summer and winter terms without renumbering everything.
 *
 * The program shape, from Fuqua's published calendar: each year runs Summer,
 * Fall 1, Fall 2, an optional Winter workshop, Spring 1, Spring 2. Fall and Spring
 * are 6-week terms; Summer is the August orientation block and Winter is the
 * optional January workshop.
 */

export const PRE_FUQUA = 'pre-fuqua';

/** Ordered. The plan column renders in this sequence. */
export const TERMS = [
  { id: PRE_FUQUA, year: 0, season: 'Pre-Fuqua', part: 0,
    label: 'Pre-Fuqua Dual Degree Coursework', short: 'Pre-Fuqua', always: true },

  { id: 'y1-summer', year: 1, season: 'Summer', part: 0, label: 'Summer', short: 'Summer', always: true },
  { id: 'y1-fall-1', year: 1, season: 'Fall', part: 1, label: 'Fall 1', short: 'Fall 1', always: true },
  { id: 'y1-fall-2', year: 1, season: 'Fall', part: 2, label: 'Fall 2', short: 'Fall 2', always: true },
  { id: 'y1-winter', year: 1, season: 'Winter', part: 0, label: 'Winter workshop', short: 'Winter', always: false },
  { id: 'y1-spring-1', year: 1, season: 'Spring', part: 1, label: 'Spring 1', short: 'Spring 1', always: true },
  { id: 'y1-spring-2', year: 1, season: 'Spring', part: 2, label: 'Spring 2', short: 'Spring 2', always: true },

  { id: 'y2-summer', year: 2, season: 'Summer', part: 0, label: 'Summer', short: 'Summer', always: false },
  { id: 'y2-fall-1', year: 2, season: 'Fall', part: 1, label: 'Fall 1', short: 'Fall 1', always: true },
  { id: 'y2-fall-2', year: 2, season: 'Fall', part: 2, label: 'Fall 2', short: 'Fall 2', always: true },
  { id: 'y2-winter', year: 2, season: 'Winter', part: 0, label: 'Winter workshop', short: 'Winter', always: false },
  { id: 'y2-spring-1', year: 2, season: 'Spring', part: 1, label: 'Spring 1', short: 'Spring 1', always: true },
  { id: 'y2-spring-2', year: 2, season: 'Spring', part: 2, label: 'Spring 2', short: 'Spring 2', always: true },
];

const BY_ID = new Map(TERMS.map((t) => [t.id, t]));
export const termById = (id) => BY_ID.get(id) ?? null;
export const isTermId = (id) => BY_ID.has(id);

/** Terms grouped for rendering: one entry per year, each holding its semesters. */
export function termGroups() {
  const years = [];
  for (const term of TERMS) {
    if (term.id === PRE_FUQUA) continue;
    let year = years.find((y) => y.year === term.year);
    if (!year) {
      year = { year: term.year, label: `Year ${term.year}`, semesters: [] };
      years.push(year);
    }
    let semester = year.semesters.find((s) => s.season === term.season);
    if (!semester) {
      semester = { season: term.season, terms: [] };
      year.semesters.push(semester);
    }
    semester.terms.push(term);
  }
  return years;
}

/**
 * Non-Fuqua Duke courses run on the university semester calendar and span both
 * 6-week terms, so they are placed by semester and stored at its first term.
 * Summer and Winter are single blocks with nothing to span.
 */
const SEMESTER_STARTS = TERMS.filter((t) => t.part === 1);

export const spansSemester = (isFuqua, termId) => {
  const term = termById(termId);
  return !isFuqua && !!term && term.part > 0;
};

export function semesterOf(termId) {
  const term = termById(termId);
  if (!term || term.part === 0) return null;
  return SEMESTER_STARTS.find((s) => s.year === term.year && s.season === term.season) ?? null;
}

/** Placement choices: every term for Fuqua courses, semesters only for the rest. */
export function placementOptions(isFuqua, startYear = null) {
  const usable = isFuqua ? TERMS : TERMS.filter((t) => t.id === PRE_FUQUA || t.part !== 2);
  return usable.map((term) => ({
    value: term.id,
    label: placementLabel(isFuqua, term.id, startYear),
    short: term.id === PRE_FUQUA ? 'Pre-Fuqua' : `Y${term.year} ${term.short}`,
  }));
}

/**
 * Snap a chosen term to a legal placement. A non-Fuqua course put in the second
 * half of a semester moves to the semester start, because it spans both halves.
 * Anything unrecognised falls back to the Pre-Fuqua bucket rather than throwing,
 * since placement is cosmetic and losing a course would not be.
 */
export function normalizeTerm(isFuqua, termId) {
  if (!isTermId(termId)) return PRE_FUQUA;
  if (isFuqua || termId === PRE_FUQUA) return termId;
  const term = termById(termId);
  return term.part === 2 ? semesterOf(termId).id : termId;
}

/** Calendar year a term falls in, given the program start year. Fall anchors a year. */
export function calendarYearOf(termId, startYear) {
  const term = termById(termId);
  if (!term || term.id === PRE_FUQUA || startYear == null) return null;
  const academicYear = startYear + (term.year - 1);
  return term.season === 'Spring' || term.season === 'Winter' ? academicYear + 1 : academicYear;
}

export function placementLabel(isFuqua, termId, startYear = null) {
  const term = termById(termId);
  if (!term) return 'Unplaced';
  if (term.id === PRE_FUQUA) return term.label;
  const year = calendarYearOf(termId, startYear);
  const stamp = year ? `${term.season} ${year}` : `Year ${term.year} ${term.season}`;
  if (!isFuqua && term.part > 0) return `${stamp} · both terms`;
  return term.part > 0 ? `${stamp} · Term ${term.part}` : stamp;
}

/**
 * Map a calendar term read off a transcript onto a program term.
 *
 * Duke's registrar records semesters, not Fuqua's 6-week terms, so a Fall course
 * can only be resolved to the semester. It lands in the first half and the
 * confirmation screen asks the student which half it belongs to (ADR-0036).
 *
 * @param {{year: number, season: string}} calendar
 * @param {number} startYear - the calendar year the program's Year 1 Fall begins
 * @returns {{termId: string, exact: boolean, reason: string}}
 */
export function mapCalendarTerm(calendar, startYear) {
  const season = String(calendar.season ?? '').trim();
  const year = Number(calendar.year);
  if (!Number.isInteger(year) || !season) {
    return { termId: PRE_FUQUA, exact: false, reason: 'unreadable term heading' };
  }

  // Fall and Summer open an academic year; Spring and Winter close the one before.
  const academicYear = season === 'Spring' || season === 'Winter' ? year - 1 : year;
  const offset = academicYear - startYear;

  if (offset < 0) {
    return { termId: PRE_FUQUA, exact: true, reason: 'before the program started' };
  }
  if (offset > 1) {
    return { termId: 'y2-spring-2', exact: false, reason: 'after the two-year program' };
  }

  const programYear = offset + 1;
  const candidates = TERMS.filter((t) => t.year === programYear && t.season === season);
  if (candidates.length === 0) {
    return { termId: PRE_FUQUA, exact: false, reason: `no ${season} term in year ${programYear}` };
  }
  const term = candidates[0];
  return {
    termId: term.id,
    // A 6-week term is a guess; a Summer or Winter block is the whole term.
    exact: term.part === 0,
    reason: term.part === 0 ? 'single term' : 'transcript records the semester, not the 6-week term',
  };
}

/** Migration from the integer quarters used up to v0.3.0 (ADR-0035). */
const LEGACY = {
  0: PRE_FUQUA,
  1: 'y1-fall-1', 2: 'y1-fall-2', 3: 'y1-spring-1', 4: 'y1-spring-2',
  5: 'y2-fall-1', 6: 'y2-fall-2', 7: 'y2-spring-1', 8: 'y2-spring-2',
};

export function fromLegacyQuarter(quarter) {
  return LEGACY[Number(quarter)] ?? PRE_FUQUA;
}
