import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRE_FUQUA, TERMS, termGroups, placementOptions, normalizeTerm, spansSemester,
  placementLabel, semesterOf, mapCalendarTerm, fromLegacyQuarter, isTermId,
  currentTermFrom, SUGGESTED_CAPACITY, termsAfter,
} from '../../app/ui/placement.js';
import { migrate, emptyPlan, toFile, fromFile } from '../../app/storage/plan.js';
import { evaluatePathway, STATUS } from '../../app/rules/evaluate.js';
import { catalog, pathway } from './helpers.js';

test('both years have the same shape: summer, two fall, winter, two spring', () => {
  assert.equal(TERMS.length, 13, 'pre-Fuqua plus six terms in each of two years');
  const groups = termGroups();
  assert.deepEqual(groups.map((y) => y.year), [1, 2]);
  for (const year of groups) {
    assert.deepEqual(year.semesters.map((s) => s.season), ['Summer', 'Fall', 'Winter', 'Spring']);
    assert.deepEqual(year.semesters.map((s) => s.terms.length), [1, 2, 1, 2]);
  }
});

test('fuqua courses place in any term, non-fuqua only at semester starts', () => {
  assert.equal(placementOptions(true).length, 13);
  // Pre-Fuqua, both summers, both winters, and one start per fall and spring.
  assert.equal(placementOptions(false).length, 9);
  assert.ok(!placementOptions(false).some((o) => o.value.endsWith('-2')));
});

test('a non-fuqua course dropped in the second half snaps to the semester start', () => {
  assert.equal(normalizeTerm(false, 'y1-fall-2'), 'y1-fall-1');
  assert.equal(normalizeTerm(false, 'y2-spring-2'), 'y2-spring-1');
  assert.equal(normalizeTerm(true, 'y1-fall-2'), 'y1-fall-2', 'fuqua courses keep their term');
  assert.equal(normalizeTerm(false, 'y1-summer'), 'y1-summer', 'summer has nothing to span');
  assert.equal(normalizeTerm(true, 'nonsense'), PRE_FUQUA, 'unknown ids fall back, never throw');
});

test('spans and labels follow the course type and the start year', () => {
  assert.equal(spansSemester(false, 'y1-fall-1'), true);
  assert.equal(spansSemester(false, 'y1-summer'), false);
  assert.equal(spansSemester(true, 'y1-fall-1'), false);
  assert.equal(semesterOf('y2-fall-2').id, 'y2-fall-1');
  assert.equal(placementLabel(true, 'y1-fall-2', 2026), 'Fall 2026 · Term 2');
  assert.equal(placementLabel(false, 'y1-spring-1', 2026), 'Spring 2027 · both terms');
  assert.equal(placementLabel(true, 'y2-fall-1', 2026), 'Fall 2027 · Term 1');
  assert.equal(placementLabel(true, 'y1-fall-2'), 'Year 1 Fall · Term 2', 'no start year, no calendar');
});

test('calendar terms map onto program terms, using Pats real transcript shape', () => {
  // His Nicholas record: 2025 Fall and 2026 Spring, both before the Fuqua start.
  assert.equal(mapCalendarTerm({ year: 2025, season: 'Fall' }, 2026).termId, PRE_FUQUA);
  assert.equal(mapCalendarTerm({ year: 2026, season: 'Spring' }, 2026).termId, PRE_FUQUA);
  // His Fuqua record: 2026 Fall Term, which is Year 1.
  const fall = mapCalendarTerm({ year: 2026, season: 'Fall' }, 2026);
  assert.equal(fall.termId, 'y1-fall-1');
  assert.equal(fall.exact, false, 'the 6-week term is not recoverable from a transcript');
  // Later terms.
  assert.equal(mapCalendarTerm({ year: 2027, season: 'Spring' }, 2026).termId, 'y1-spring-1');
  assert.equal(mapCalendarTerm({ year: 2027, season: 'Fall' }, 2026).termId, 'y2-fall-1');
  assert.equal(mapCalendarTerm({ year: 2028, season: 'Spring' }, 2026).termId, 'y2-spring-1');
});

test('a summer term maps exactly, because it is not split into halves', () => {
  const summer = mapCalendarTerm({ year: 2026, season: 'Summer' }, 2026);
  assert.equal(summer.termId, 'y1-summer');
  assert.equal(summer.exact, true);
});

test('unreadable and out-of-range terms degrade rather than throw', () => {
  assert.equal(mapCalendarTerm({ year: NaN, season: 'Fall' }, 2026).exact, false);
  assert.equal(mapCalendarTerm({ year: 2030, season: 'Fall' }, 2026).exact, false);
});

test('a v0.3.0 backup still imports, with quarters mapped to term ids', () => {
  // Written by the format in use through v0.3.0: integer quarters, no startYear.
  const old = {
    formatVersion: 1,
    app: 'Fuqua ConCert',
    declared: ['energy-finance'],
    entries: [
      { courseId: 'FINANCE 646', quarter: 1 },
      { courseId: 'FINANCE 647', quarter: 2, gradePoints: 3.7 },
      { courseId: 'ENERGY 588', quarter: 5 },
      { courseId: 'ENVIRON 717', quarter: 0 },
    ],
  };
  const plan = migrate(old);
  assert.equal(plan.formatVersion, 2);
  assert.deepEqual(plan.entries.map((e) => e.term),
    ['y1-fall-1', 'y1-fall-2', 'y2-fall-1', PRE_FUQUA]);
  assert.equal(plan.entries[1].gradePoints, 3.7, 'grades survive the migration');
  assert.deepEqual(plan.declared, ['energy-finance']);
  assert.ok(!('quarter' in plan.entries[0]), 'the old field is dropped, not left to rot');
});

test('a format 2 file round-trips unchanged', () => {
  const plan = { ...emptyPlan(), startYear: 2026,
    entries: [{ courseId: 'FINANCE 646', term: 'y1-winter' }] };
  const back = fromFile(toFile(plan));
  assert.equal(back.entries[0].term, 'y1-winter');
  assert.equal(back.startYear, 2026);
});

test('placement still never changes evaluation', () => {
  const courses = ['MANAGEMT 738', 'MANAGEMT 744', 'MANAGEMT 745', 'MANAGEMT 746',
    'DECISION 611', 'OPERATNS 823'];
  const spread = courses.map((courseId, i) => ({ courseId, term: TERMS[i + 1].id }));
  const allPre = courses.map((courseId) => ({ courseId, term: PRE_FUQUA }));
  const a = evaluatePathway(pathway('management'), spread, catalog);
  const b = evaluatePathway(pathway('management'), allPre, catalog);
  assert.equal(a.status, STATUS.COMPLETE);
  assert.equal(b.status, STATUS.COMPLETE);
  assert.equal(a.percent, b.percent);
});

test('every legacy quarter maps to a real term', () => {
  for (let q = 0; q <= 8; q += 1) assert.ok(isTermId(fromLegacyQuarter(q)), `quarter ${q}`);
});

/* --- currentTermFrom -------------------------------------------------------
 * The first version of this walked a ternary chain that tested `month <= 10`
 * before it ever reached Spring, so every month from January through June came
 * back as Fall. It seeds the current-term control, which feeds the remaining
 * capacity, which feeds the feasibility arithmetic — a wrong month is a wrong
 * answer to "does this fit". Hence a case for every month, not a spot check.
 */

const day = (y, m, d) => new Date(y, m - 1, d);

test('every month of a 2026 start maps to the term the calendar actually names', () => {
  const expected = [
    [day(2026, 8, 20), 'y1-summer', 'August is orientation'],
    [day(2026, 9, 15), 'y1-fall-1'],
    [day(2026, 10, 10), 'y1-fall-1', 'Fall 1 runs to mid-October'],
    [day(2026, 10, 25), 'y1-fall-2', 'Fall 2 opens late October'],
    [day(2026, 11, 5), 'y1-fall-2'],
    [day(2026, 12, 10), 'y1-fall-2'],
    [day(2027, 1, 5), 'y1-winter', 'the January workshop'],
    [day(2027, 1, 20), 'y1-spring-1'],
    [day(2027, 2, 10), 'y1-spring-1'],
    [day(2027, 3, 15), 'y1-spring-2', 'March is Spring, not Fall'],
    [day(2027, 4, 1), 'y1-spring-2'],
    [day(2027, 5, 20), 'y1-spring-2'],
    [day(2027, 6, 15), 'y1-spring-2', 'the internship summer looks back, not forward'],
    [day(2027, 7, 4), 'y1-spring-2'],
    [day(2027, 8, 25), 'y2-fall-1', 'year two has no orientation block'],
    [day(2027, 12, 1), 'y2-fall-2'],
    [day(2028, 3, 1), 'y2-spring-2'],
  ];
  for (const [when, want, why] of expected) {
    assert.equal(currentTermFrom(2026, when), want,
      `${when.toDateString()}${why ? ` — ${why}` : ''}`);
  }
});

test('no month of the program answers Fall unless it is autumn', () => {
  // The defect this guards against made January through June read as Fall.
  // Asserted as a shape rather than exact ids so the guard survives a change to
  // where the 6-week boundaries fall. August is left out on purpose: it is
  // orientation in year one and Fall 1 in year two.
  const seasonIn = (month, calendarYear) => {
    const id = currentTermFrom(2026, day(calendarYear, month, 15));
    return id ? TERMS.find((t) => t.id === id).season : null;
  };
  for (let month = 1; month <= 7; month += 1) {
    assert.notEqual(seasonIn(month, 2027), 'Fall', `month ${month} is not autumn`);
  }
  for (let month = 9; month <= 12; month += 1) {
    assert.equal(seasonIn(month, 2026), 'Fall', `month ${month} is autumn`);
  }
});

test('dates outside the two program years are honest about it', () => {
  assert.equal(currentTermFrom(2026, day(2025, 9, 1)), null, 'before matriculation');
  assert.equal(currentTermFrom(2026, day(2026, 7, 1)), null, 'the summer before day one');
  assert.equal(currentTermFrom(2026, day(2030, 9, 1)), 'y2-spring-2', 'graduated: clamp to the end');
  assert.equal(currentTermFrom(null, day(2027, 1, 1)), null, 'no start year, no guess');
  assert.equal(currentTermFrom('2026', day(2027, 1, 1)), null, 'a string is not a start year');
});

test('every term with suggested capacity is a real term, and vice versa', () => {
  const planned = TERMS.filter((t) => t.id !== PRE_FUQUA).map((t) => t.id);
  assert.deepEqual(Object.keys(SUGGESTED_CAPACITY).sort(), [...planned].sort());
  for (const [id, n] of Object.entries(SUGGESTED_CAPACITY)) {
    assert.ok(Number.isInteger(n) && n >= 0, `${id} has a usable capacity`);
  }
});

test('termsAfter returns the terms still ahead, in program order', () => {
  assert.deepEqual(termsAfter('y2-spring-1').map((t) => t.id), ['y2-spring-2']);
  assert.deepEqual(termsAfter('y2-spring-2'), []);
  const fromFall1 = termsAfter('y1-fall-1').map((t) => t.id);
  assert.equal(fromFall1[0], 'y1-fall-2');
  assert.equal(fromFall1.length, 10);
  assert.ok(!termsAfter('y1-fall-1').some((t) => t.id === PRE_FUQUA),
    'Pre-Fuqua is never ahead of you');
  assert.equal(termsAfter('nonsense').length, 12, 'an unknown term means everything is ahead');
});
