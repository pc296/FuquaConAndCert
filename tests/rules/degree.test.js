/**
 * The arithmetic behind the Degree Plan's one-line verdict.
 *
 * "Fits, 7 to spare" is the sentence a student will act on, so the two numbers
 * under it get direct tests: seats free per term, and what feasibility does with
 * a term whose capacity was never set.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countByTerm, remainingTerms } from '../../app/ui/degree.js';
import { nextOpenTerm, termsFrom, PRE_FUQUA } from '../../app/ui/placement.js';
import { feasibility, combinationCost } from '../../app/rules/plan-ahead.js';
import { catalog } from './helpers.js';

const planOf = (over = {}) => ({
  startYear: 2026, currentTerm: null, capacities: {}, scenarios: [],
  declared: [], entries: [], ...over,
});

test('courses already placed occupy the seats they sit in', () => {
  const plan = planOf({
    currentTerm: 'y2-fall-1',
    capacities: { 'y2-fall-1': 3, 'y2-fall-2': 3 },
    entries: [
      { courseId: 'A', term: 'y2-fall-1' },
      { courseId: 'B', term: 'y2-fall-1' },
      { courseId: 'C', term: PRE_FUQUA },
      { courseId: 'D', term: 'y1-fall-1' },
    ],
  });
  assert.deepEqual(countByTerm(plan.entries), { 'y2-fall-1': 2, 'y1-fall-1': 1 },
    'Pre-Fuqua holds no seats: it is behind you');

  const remaining = remainingTerms(plan);
  const fall1 = remaining.find((t) => t.id === 'y2-fall-1');
  assert.equal(fall1.set, 3, 'the capacity the student typed is kept as typed');
  assert.equal(fall1.capacity, 1, 'but only one seat is actually free');
  assert.equal(remaining.find((t) => t.id === 'y2-fall-2').capacity, 3);
  assert.ok(!remaining.some((t) => t.id === 'y1-fall-1'),
    'a term behind the current one is not remaining capacity');
});

test('a term over its own capacity contributes zero, never a negative', () => {
  const plan = planOf({
    currentTerm: 'y2-spring-1',
    capacities: { 'y2-spring-1': 1 },
    entries: [
      { courseId: 'A', term: 'y2-spring-1' },
      { courseId: 'B', term: 'y2-spring-1' },
      { courseId: 'C', term: 'y2-spring-1' },
    ],
  });
  const term = remainingTerms(plan).find((t) => t.id === 'y2-spring-1');
  assert.equal(term.capacity, 0, 'an overfull term must not lend seats to the next one');
  assert.equal(term.used, 3);
});

test('with no current term set, the whole program is still ahead', () => {
  const remaining = remainingTerms(planOf());
  assert.equal(remaining.length, 12);
  assert.equal(remaining[0].id, 'y1-summer');
  assert.deepEqual(remaining.map((t) => t.id), termsFrom('y1-summer').map((t) => t.id));
});

test('feasibility counts only the terms whose capacity is known', () => {
  const cost = { joint: 4, reachable: true };
  const verdict = feasibility(cost, [
    { id: 'y2-fall-1', capacity: 3 },
    { id: 'y2-fall-2', capacity: 2 },
    { id: 'y2-winter', capacity: null },
    { id: 'y2-spring-1', capacity: null },
  ]);
  assert.equal(verdict.slots, 5);
  assert.equal(verdict.termsCounted, 2);
  assert.deepEqual(verdict.termsWithoutCapacity, ['y2-winter', 'y2-spring-1']);
  assert.equal(verdict.spare, 1);
  assert.equal(verdict.fits, true);
  assert.equal(verdict.known, false, 'a verdict built on unknowns must say so');
});

test('an unreachable combination never reports as fitting', () => {
  const verdict = feasibility({ joint: 0, reachable: false }, [{ id: 'y2-fall-1', capacity: 9 }]);
  assert.equal(verdict.fits, false, 'plenty of room is not a route');
});

test('nextOpenTerm skips full terms and terms with no capacity set', () => {
  const capacities = { 'y2-fall-1': 2, 'y2-fall-2': 0, 'y2-spring-1': 2 };
  const counts = { 'y2-fall-1': 2 };
  assert.equal(nextOpenTerm('y2-fall-1', capacities, counts), 'y2-spring-1',
    'fall-1 is full, fall-2 has no seats, winter was never set');
  assert.equal(nextOpenTerm('y2-fall-1', capacities, {}), 'y2-fall-1');
  assert.equal(nextOpenTerm('y2-spring-2', capacities, {}), null,
    'nothing ahead means no answer, not a wrong answer');
});

test('the joint number the panel prints is smaller than the sum, and real', () => {
  // The claim the whole panel rests on: two specialties cost less together than
  // apart, because a course counts toward both (ADR-0018). If this ever came out
  // equal to the sum for a pair that shares courses, the panel would be selling
  // a saving that is not there.
  const cost = combinationCost(['management', 'dei'], [], catalog);
  assert.ok(cost.reachable);
  assert.ok(cost.joint < cost.sumIfSeparate,
    `management + dei: joint ${cost.joint} should beat ${cost.sumIfSeparate} separately`);
  assert.equal(cost.shared, cost.sumIfSeparate - cost.joint);
  assert.equal(cost.courses.length, cost.joint, 'the route must list every course it charges for');
  assert.ok(cost.courses.some((c) => c.servesCount > 1),
    'a shared pair must name at least one course that serves both');
});

test('"a route exists" and "you are done" are not the same answer', () => {
  // They were one field. The panel printed "Already complete. Nothing further is
  // needed here." directly above a list of five courses it said you still needed,
  // and suppressed the fit verdict entirely, because `complete` meant "a full
  // route was found" and the UI read it as "finished".
  const midFlight = combinationCost(['management', 'dei'], [], catalog);
  assert.equal(midFlight.reachable, true, 'a route exists from an empty plan');
  assert.equal(midFlight.alreadyComplete, false, 'an empty plan is not a finished one');
  assert.ok(midFlight.courses.length > 0);

  const finished = combinationCost(['management', 'dei'],
    midFlight.courses.map((c) => ({ courseId: c.courseId })), catalog);
  assert.equal(finished.alreadyComplete, true, 'take the whole route and you are done');
  assert.equal(finished.joint, 0);
  assert.equal(finished.courses.length, 0);
});

test('alreadyComplete is never true while the route still charges for courses', () => {
  // The invariant the panel relies on, asserted across a spread of combinations
  // rather than the one pair that happened to be on screen.
  const pairs = [
    ['management', 'dei'], ['energy-finance', 'strategy'], ['marketing'],
    ['finance-corporate', 'operations-management'], ['cert-finance', 'strategy'],
  ];
  for (const pair of pairs) {
    const cost = combinationCost(pair, [], catalog);
    if (cost.alreadyComplete) {
      assert.equal(cost.courses.length, 0, `${pair.join('+')} says done but lists courses`);
    }
    if (cost.courses.length > 0) {
      assert.equal(cost.alreadyComplete, false, `${pair.join('+')} lists courses but says done`);
    }
  }
});

test('the header and the verdict count the same terms', () => {
  // On screen these are two sentences a few pixels apart: "16 seats free across 7
  // of those terms; 3 have no capacity set" above "16 seats across 6 terms. 4 with
  // no capacity set were not counted." Same data, two answers, because a full term
  // was filed as an unknown one.
  const plan = planOf({
    currentTerm: 'y1-fall-2',
    capacities: {
      'y1-fall-2': 1, 'y1-spring-1': 2, 'y1-spring-2': 2,
      'y2-fall-1': 3, 'y2-fall-2': 3, 'y2-spring-1': 3, 'y2-spring-2': 3,
    },
    entries: [{ courseId: 'FINANCE 646', term: 'y1-fall-2' }],
  });
  const remaining = remainingTerms(plan);
  const headerSet = remaining.filter((t) => Number.isInteger(t.set)).length;
  const headerSeats = remaining.reduce((n, t) => n + (t.capacity ?? 0), 0);

  const verdict = feasibility({ joint: 5, reachable: true }, remaining);
  assert.equal(verdict.termsCounted, headerSet,
    'the verdict must count the terms the header says have capacity');
  assert.equal(verdict.slots, headerSeats, 'and the same seats');
  assert.equal(verdict.termsCounted + verdict.termsWithoutCapacity.length, remaining.length,
    'every remaining term is either counted or named as unknown, never both or neither');
  assert.equal(headerSet, 7);
  assert.equal(headerSeats, 16, 'the full Fall 2 term still counts as a known zero');
});
