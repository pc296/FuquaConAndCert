/**
 * Find course codes in a blob of text.
 *
 * Deliberately permissive about surrounding text and deliberately strict about
 * what counts as a match: everything it finds is shown on a confirmation screen
 * before it enters the plan (ADR-0012). It proposes, the student confirms.
 *
 * Codes resolve through the catalog's code index, so a course listed under an
 * alternate subject prefix on a transcript still matches (ADR-0037). Matching is
 * exact-code only. Nothing is matched by title similarity, because this catalog
 * genuinely contains different courses sharing a number.
 */

const CODE_RE = /\b([A-Z][A-Z&]{2,9})\s*[- ]?\s*(\d{3}[A-Za-z]?(?:[.-]\d{1,2})?)\b/g;

/**
 * @param {string} text
 * @param {object} catalog - built by buildCatalog; uses catalog.codeIndex
 * @returns {{matched: Array<object>, unmatched: Array<{code: string, suggestion: object|null}>}}
 */
export function parsePaste(text, catalog) {
  const index = catalog.codeIndex;
  const matched = [];
  const unmatched = [];
  const seen = new Set();

  for (const match of String(text).matchAll(CODE_RE)) {
    const code = `${match[1]} ${match[2]}`;
    if (seen.has(code)) continue;
    seen.add(code);

    const candidates = index.get(code);
    if (!candidates) {
      unmatched.push({ code, suggestion: suggestFor(code, catalog, titleAfter(text, match)) });
      continue;
    }
    // A shared special-topics number maps to several courses. Offer each and let
    // the student pick on the confirmation screen rather than guessing.
    for (const course of candidates) {
      matched.push({
        courseId: course.id,
        title: course.title,
        raw: code,
        viaAlias: course.code !== code,
        ambiguous: candidates.length > 1,
      });
    }
  }
  return { matched, unmatched };
}

/** The rest of the line a code was found on, which on a transcript is its title. */
function titleAfter(text, match) {
  const rest = text.slice((match.index ?? 0) + match[0].length);
  const line = rest.split(/[\r\n]/)[0] ?? '';
  // Trim the trailing numeric columns a transcript carries: units, grade, basis.
  return line.replace(/\s{2,}[\d.]+.*$/, '').trim();
}

const STOP = new Set(['and', 'the', 'of', 'for', 'in', 'to', 'a', 'an', '1', 'i']);

const tokens = (t) => new Set(
  String(t).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w)),
);

/** Fraction of the smaller title's words that appear in the larger. */
function titleOverlap(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  if (x.size === 0 || y.size === 0) return 0;
  let shared = 0;
  for (const w of x) if (y.has(w)) shared += 1;
  return shared / Math.min(x.size, y.size);
}

/**
 * When a code misses, look for the same number under a different subject prefix.
 *
 * This is how cross-listings get discovered rather than waiting for someone to
 * notice their transcript did not match. It only ever proposes; adding an alias
 * stays a reviewed catalog edit.
 *
 * A shared number is not evidence on its own. This catalog has ENVIRON 710
 * (Applied Statistical Modeling) and HLTHMGMT 710 (Health Institutions), which are
 * unrelated, and every FCCP practicum is numbered 895. So a suggestion also
 * requires the observed title to overlap the candidate's. Without a title to
 * compare, nothing is suggested: a wrong course in a plan is worse than no hint.
 */
export function suggestFor(code, catalog, observedTitle = '') {
  const [, area, number] = /^([A-Z][A-Z&]{2,9})\s+(.+)$/.exec(code) ?? [];
  if (!number || !observedTitle) return null;
  const sameNumber = catalog.courseList.filter(
    (c) => c.code.endsWith(` ${number}`) && !c.code.startsWith(`${area} `),
  );
  if (sameNumber.length !== 1) return null;

  const candidate = sameNumber[0];
  if (titleOverlap(observedTitle, candidate.title) < 0.6) return null;
  return { courseId: candidate.id, code: candidate.code, title: candidate.title };
}
