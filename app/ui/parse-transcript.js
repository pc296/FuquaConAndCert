/**
 * Read a transcript's structure, not just its course codes (ADR-0036).
 *
 * A Duke transcript is organised into school records ("Beginning of Fuqua School of
 * Business Record") and term headings ("2026 Fall Term"). Reading only the codes
 * throws that away and every course lands in one term, which is what happened
 * before this module existed.
 *
 * One thing no parser can recover: Duke's registrar records semesters, not Fuqua's
 * 6-week terms. A transcript says "2026 Fall Term" whether a course ran in Fall 1 or
 * Fall 2. Courses are placed in the semester and marked `exact: false`, and the
 * confirmation screen asks the student to sort them.
 */

import { parsePaste } from './parse-paste.js';
import { PRE_FUQUA, mapCalendarTerm, normalizeTerm } from './placement.js';

/** "2026 Fall Term", "Fall 2026", "2026 Spring". */
const TERM_HEADING = new RegExp(
  String.raw`(?:^|\s)(?:(\d{4})\s+(Fall|Spring|Summer|Winter)|(Fall|Spring|Summer|Winter)\s+(\d{4}))(?:\s+Term)?(?=\s|$)`,
  'gi',
);

const SCHOOL_HEADING = /Beginning of (.+?) Record/gi;

/** Term headings in document order, each with the character offset it starts at. */
export function findTermHeadings(text) {
  const found = [];
  for (const m of String(text).matchAll(TERM_HEADING)) {
    const year = Number(m[1] ?? m[4]);
    const season = (m[2] ?? m[3] ?? '').replace(/^./, (c) => c.toUpperCase());
    if (!Number.isInteger(year) || year < 1900 || year > 2100) continue;
    found.push({ index: m.index ?? 0, year, season, heading: m[0].trim() });
  }
  return found;
}

export function findSchoolRecords(text) {
  return [...String(text).matchAll(SCHOOL_HEADING)]
    .map((m) => ({ index: m.index ?? 0, school: m[1].trim() }));
}

/**
 * The calendar year the program's Year 1 Fall begins, inferred from the transcript.
 *
 * The earliest term inside the Fuqua record is Year 1. Everything before it is
 * prior coursework. Returns null when there is no Fuqua record to anchor on, in
 * which case the student sets the start year themselves.
 */
export function inferStartYear(text) {
  const schools = findSchoolRecords(text);
  const terms = findTermHeadings(text);
  if (terms.length === 0) return null;

  const fuqua = schools.find((s) => /fuqua/i.test(s.school));
  if (!fuqua) return null;

  // Terms belonging to the Fuqua record: those after its heading and before the
  // next school's heading.
  const next = schools
    .filter((s) => s.index > fuqua.index)
    .reduce((min, s) => Math.min(min, s.index), Infinity);
  const inFuqua = terms.filter((t) => t.index > fuqua.index && t.index < next);
  if (inFuqua.length === 0) return null;

  const academicYears = inFuqua.map((t) =>
    t.season === 'Spring' || t.season === 'Winter' ? t.year - 1 : t.year);
  return Math.min(...academicYears);
}

/**
 * @param {string} text
 * @param {object} catalog
 * @param {{startYear: number|null}} options
 * @returns {{matched: Array<object>, unmatched: Array<object>, startYear: number|null,
 *            usedHeadings: boolean, blocks: Array<object>}}
 */
export function parseTranscript(text, catalog, options = {}) {
  const source = String(text);
  const startYear = options.startYear ?? inferStartYear(source);
  const headings = findTermHeadings(source);

  // With no headings this is a plain paste, not a transcript. Fall back to reading
  // codes and leave placement to the student rather than inventing a term.
  if (headings.length === 0 || startYear == null) {
    const { matched, unmatched } = parsePaste(source, catalog);
    return {
      matched: matched.map((m) => ({ ...m, termId: null, exact: false, heading: null })),
      unmatched,
      startYear,
      usedHeadings: false,
      blocks: [],
    };
  }

  const blocks = headings.map((heading, i) => ({
    ...heading,
    text: source.slice(heading.index, headings[i + 1]?.index ?? source.length),
  }));

  const matched = [];
  const unmatched = [];
  const claimed = new Set();

  for (const block of blocks) {
    const placement = mapCalendarTerm({ year: block.year, season: block.season }, startYear);
    const parsed = parsePaste(block.text, catalog);

    for (const hit of parsed.matched) {
      // A course listed in two terms is a repeat, not a duplicate; key on both.
      const key = `${hit.courseId}@${placement.termId}`;
      if (claimed.has(key)) continue;
      claimed.add(key);
      const isFuqua = catalog.courses.get(hit.courseId)?.isFuqua !== false;
      matched.push({
        ...hit,
        termId: normalizeTerm(isFuqua, placement.termId),
        exact: placement.exact,
        reason: placement.reason,
        heading: block.heading,
      });
    }
    for (const miss of parsed.unmatched) {
      if (!unmatched.some((u) => u.code === miss.code)) unmatched.push({ ...miss, heading: block.heading });
    }
  }

  // Codes above the first term heading, for example a program summary block.
  const preamble = source.slice(0, headings[0].index);
  for (const hit of parsePaste(preamble, catalog).matched) {
    if (matched.some((m) => m.courseId === hit.courseId)) continue;
    matched.push({ ...hit, termId: PRE_FUQUA, exact: false, heading: null,
      reason: 'found above the first term heading' });
  }

  return { matched, unmatched, startYear, usedHeadings: true, blocks };
}
