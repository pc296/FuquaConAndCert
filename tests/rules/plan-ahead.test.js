import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jointRemaining, combinationCost, feasibility } from '../../app/rules/plan-ahead.js';
import { recommend } from '../../app/rules/recommend.js';
import { evaluatePathway, STATUS } from '../../app/rules/evaluate.js';
import { catalog, pathway, plan } from './helpers.js';

const PAIRS = [
  ['energy-finance', 'strategy'],
  ['finance-corporate', 'financial-analysis'],
  ['management', 'dei'],
  ['energy-environment', 'social-entrepreneurship'],
  ['marketing', 'strategy'],
];

test('following the joint advice completes every pathway in the combination', () => {
  // The property that matters: the number shown must be achievable.
  for (const ids of PAIRS) {
    const advice = jointRemaining(ids, [], catalog);
    assert.equal(advice.complete, true, `${ids.join(' + ')} was not reachable`);
    const built = advice.courses.map((c) => ({ courseId: c.courseId }));
    for (const id of ids) {
      const result = evaluatePathway(pathway(id), built, catalog);
      assert.equal(result.status, STATUS.COMPLETE,
        `${id} incomplete after following the advice for ${ids.join(' + ')}`);
    }
  }
});

test('a combination never costs more than doing each separately', () => {
  for (const ids of PAIRS) {
    const cost = combinationCost(ids, [], catalog);
    assert.ok(cost.joint <= cost.sumIfSeparate,
      `${ids.join(' + ')}: joint ${cost.joint} exceeded the separate sum ${cost.sumIfSeparate}`);
    assert.equal(cost.shared, cost.sumIfSeparate - cost.joint);
  }
});

test('overlapping pathways are strictly cheaper together, which is the whole point', () => {
  // Management and DEI share five courses; a student reading two lists would plan
  // twelve courses for what takes seven.
  const cost = combinationCost(['management', 'dei'], [], catalog);
  assert.equal(cost.sumIfSeparate, 12);
  assert.ok(cost.joint < cost.sumIfSeparate, 'expected a saving');
  assert.ok(cost.shared >= 4, `expected real overlap, got ${cost.shared}`);
});

test('one pathway alone costs what the single-pathway recommender says', () => {
  for (const id of ['strategy', 'marketing', 'cert-finance']) {
    const alone = recommend(pathway(id), [], catalog).courses.length;
    assert.equal(jointRemaining([id], [], catalog).courses.length, alone, id);
  }
});

test('courses already taken reduce the joint cost', () => {
  const taken = plan(['MANAGEMT 738', 'MANAGEMT 745', 'MANAGEMT 746', 'MANAGEMT 747']);
  const before = combinationCost(['management', 'dei'], [], catalog).joint;
  const after = combinationCost(['management', 'dei'], taken, catalog).joint;
  assert.ok(after < before, `expected fewer than ${before} remaining, got ${after}`);
});

test('a finished combination needs nothing', () => {
  const advice = jointRemaining(['management'], [], catalog);
  const done = advice.courses.map((c) => ({ courseId: c.courseId }));
  const again = jointRemaining(['management'], done, catalog);
  assert.deepEqual(again.courses, []);
  assert.equal(again.complete, true);
});

test('each recommended course reports which targets it serves', () => {
  const advice = jointRemaining(['management', 'dei'], [], catalog);
  assert.ok(advice.courses.every((c) => c.servesCount >= 1));
  assert.ok(advice.courses.some((c) => c.servesCount === 2),
    'at least one course should serve both pathways');
});

test('an empty combination is trivially complete', () => {
  const advice = jointRemaining([], [], catalog);
  assert.deepEqual(advice.courses, []);
  assert.equal(advice.complete, true);
});

test('feasibility counts only terms with a capacity set', () => {
  const cost = { joint: 6, reachable: true };
  const fits = feasibility(cost, [
    { id: 'y2-fall-1', capacity: 3 },
    { id: 'y2-fall-2', capacity: 3 },
  ]);
  assert.equal(fits.slots, 6);
  assert.equal(fits.fits, true);
  assert.equal(fits.spare, 0);
  assert.equal(fits.known, true);
});

test('a term with no capacity contributes nothing and is named', () => {
  // Guessing a number here would produce a confident verdict from invented data.
  const fits = feasibility({ joint: 6, reachable: true }, [
    { id: 'y2-fall-1', capacity: 3 },
    { id: 'y2-fall-2', capacity: null },
  ]);
  assert.equal(fits.slots, 3);
  assert.equal(fits.fits, false);
  assert.equal(fits.known, false);
  assert.deepEqual(fits.termsWithoutCapacity, ['y2-fall-2']);
});

test('an unreachable combination never reports as fitting', () => {
  const fits = feasibility({ joint: 2, reachable: false }, [{ id: 'y2-fall-1', capacity: 9 }]);
  assert.equal(fits.fits, false);
});
