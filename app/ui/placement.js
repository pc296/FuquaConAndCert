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

/**
 * Elective capacity per term as Fuqua's published structure implies it: Year 1 is
 * core-heavy and holds few electives, Year 2 is three per term. Offered as a
 * one-click prefill, never applied silently, because the real number depends on
 * exemptions and on the student (ADR-0039).
 */
export const SUGGESTED_CAPACITY = {
  'y1-summer': 0, 'y1-fall-1': 0, 'y1-fall-2': 1, 'y1-winter': 1,
  'y1-spring-1': 2, 'y1-spring-2': 2,
  'y2-summer': 0, 'y2-fall-1': 3, 'y2-fall-2': 3, 'y2-winter': 1,
  'y2-spring-1': 3, 'y2-spring-2': 3,
};

/**
 * Terms from `termId` onward, inclusive, in program order. Pre-Fuqua is never in
 * the result: it is behind you by definition.
 */
export function termsFrom(termId) {
  const index = TERMS.findIndex((t) => t.id === termId);
  if (index < 0) return TERMS.filter((t) => t.id !== PRE_FUQUA);
  return TERMS.slice(index).filter((t) => t.id !== PRE_FUQUA);
}

/**
 * The first term at or after `from` that still has room, given the capacities the
 * student set and what is already placed there.
 *
 * Returns null when no remaining term has declared room. The caller says so
 * rather than stacking another course into a term the student called full —
 * a planner that silently overfills a term is worse than one that admits it.
 */
export function nextOpenTerm(from, capacities, countByTerm) {
  for (const term of termsFrom(from)) {
    const capacity = capacities?.[term.id];
    if (!Number.isInteger(capacity) || capacity <= 0) continue;
    if ((countByTerm?.[term.id] ?? 0) < capacity) return term.id;
  }
  return null;
}

/** Terms from `after` onward, in program order. `after` itself is excluded. */
export function termsAfter(termId) {
  const index = TERMS.findIndex((t) => t.id === termId);
  if (index < 0) return TERMS.filter((t) => t.id !== PRE_FUQUA);
  return TERMS.slice(index + 1);
}

/**
 * Which program term a calendar date falls in, from Fuqua's published calendar.
 *
 * The 6-week terms change over mid-month, so October and January carry a
 * day-of-month split rather than pretending a term boundary lands on the 1st.
 * March through July all sit in or after Spring 2: May, June and July resolve to
 * the term just finished rather than guessing forward into a term that may not
 * exist, since the summer between years is an internship, not coursework.
 *
 * Returns [season, part] naming a term in TERMS.
 */
function seasonPartFor(month, day, programYear) {
  // Year 1 opens with an August orientation block; year 2 goes straight to Fall 1.
  if (month === 8) return programYear === 1 ? ['Summer', 0] : ['Fall', 1];
  if (month === 9) return ['Fall', 1];
  if (month === 10) return day <= 15 ? ['Fall', 1] : ['Fall', 2];
  if (month === 11 || month === 12) return ['Fall', 2];
  if (month === 1) return day <= 10 ? ['Winter', 0] : ['Spring', 1];
  if (month === 2) return ['Spring', 1];
  return ['Spring', 2]; // March through July
}

/** Best guess at the current term from today's date, used only as a default. */
export function currentTermFrom(startYear, today = new Date()) {
  if (!Number.isInteger(startYear)) return null;
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  // The academic year turns over in August, when the entering class arrives.
  const academicYear = month >= 8 ? year : year - 1;
  const programYear = academicYear - startYear + 1;
  if (programYear < 1) return null;
  if (programYear > 2) return 'y2-spring-2';
  const [season, part] = seasonPartFor(month, day, programYear);
  const match = TERMS.find((t) => t.year === programYear && t.season === season
    && (t.part === 0 || t.part === part));
  return match?.id ?? `y${programYear}-fall-1`;
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
