/**
 * Parse course codes out of pasted transcript or schedule text.
 *
 * Deliberately permissive about surrounding text and deliberately strict about
 * what counts as a match: everything it finds is shown on a confirmation screen
 * before it enters the plan (ADR-0012). It proposes, the student confirms.
 */

const CODE_RE = /\b([A-Z][A-Z&]{2,9})\s*[- ]?\s*(\d{3}[A-Za-z]?(?:[.-]\d{1,2})?)\b/g;

/**
 * @param {string} text
 * @param {Map<string, object>} courses - catalog courses keyed by id
 * @returns {{matched: Array<{courseId: string, title: string, raw: string}>, unmatched: string[]}}
 */
export function parsePaste(text, courses) {
  const byCode = new Map();
  for (const course of courses.values()) {
    if (!byCode.has(course.code)) byCode.set(course.code, []);
    byCode.get(course.code).push(course);
  }

  const matched = [];
  const unmatched = [];
  const seen = new Set();

  for (const match of text.matchAll(CODE_RE)) {
    const code = `${match[1]} ${match[2]}`;
    if (seen.has(code)) continue;
    seen.add(code);

    const candidates = byCode.get(code);
    if (!candidates) {
      unmatched.push(code);
      continue;
    }
    // A shared special-topics number maps to several courses. Offer each, and let
    // the student pick on the confirmation screen rather than guessing.
    for (const course of candidates) {
      matched.push({ courseId: course.id, title: course.title, raw: code, ambiguous: candidates.length > 1 });
    }
  }
  return { matched, unmatched };
}
