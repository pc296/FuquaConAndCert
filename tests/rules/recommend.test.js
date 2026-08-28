import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recommend, rankPathways } from '../../app/rules/recommend.js';
import { evaluatePathway, STATUS } from '../../app/rules/evaluate.js';
import { catalog, pathway, plan } from './helpers.js';

test('an empty plan needs exactly the number of courses the source requires', () => {
  const cases = [
    ['management', 6],
    ['strategy', 6],
    ['marketing', 6],
    ['finance-corporate', 6],
    ['finance-dual', 10],
    ['leadership-ethics', 6],
    ['entrepreneurship-innovation', 6],
    ['cert-finance', 10],
  ];
  for (const [id, expected] of cases) {
    const advice = recommend(pathway(id), [], catalog);
    assert.equal(advice.complete, true, `${id} should be reachable`);
    assert.equal(advice.courses.length, expected, `${id} needed ${advice.courses.length}`);
  }
});

test('the recommendation actually completes the pathway when followed', () => {
  for (const p of catalog.pathways) {
    const advice = recommend(p, [], catalog);
    if (!advice.complete) continue;
    const built = advice.courses.map((c) => ({ courseId: c.courseId }));
    const result = evaluatePathway(p, built, catalog);
    assert.equal(result.status, STATUS.COMPLETE, `${p.id} did not complete when its own advice was followed`);
  }
});

test('courses already taken reduce what is left', () => {
  const taken = plan(['MANAGEMT 738', 'MANAGEMT 744', 'MANAGEMT 745']);
  const advice = recommend(pathway('management'), taken, catalog);
  assert.equal(advice.courses.length, 3);
});

test('a complete pathway needs nothing', () => {
  const done = plan([
    'MANAGEMT 738', 'MANAGEMT 744', 'MANAGEMT 745', 'MANAGEMT 746',
    'DECISION 611', 'OPERATNS 823',
  ]);
  const advice = recommend(pathway('management'), done, catalog);
  assert.equal(advice.complete, true);
  assert.deepEqual(advice.courses, []);
});

test('leadership and ethics advice respects the outside-Management constraint', () => {
  const advice = recommend(pathway('leadership-ethics'), [], catalog);
  const outside = advice.courses.filter(
    (c) => catalog.courses.get(c.courseId).area !== 'MANAGEMT',
  ).length;
  assert.ok(outside >= 2, `advice included only ${outside} courses outside Management`);
});

test('energy finance advice satisfies the credit group, not just the course groups', () => {
  const advice = recommend(pathway('energy-finance'), [], catalog);
  const built = advice.courses.map((c) => ({ courseId: c.courseId }));
  const result = evaluatePathway(pathway('energy-finance'), built, catalog);
  assert.equal(result.groups.find((g) => g.id === 'energy-content').satisfied, true);
  assert.ok(result.totals.credits >= 18);
});

test('ties prefer a course that also advances a declared pathway', () => {
  const advice = recommend(pathway('management'), [], catalog, { declared: ['strategy'] });
  const overlapping = advice.courses.filter((c) => c.alsoCountsToward.length > 0);
  assert.ok(overlapping.length > 0, 'expected at least one course shared with Strategy');
});

test('ranking puts the closest pathways first', () => {
  const taken = plan(['FINANCE 646', 'FINANCE 647', 'ACCOUNTG 597', 'DECISION 611']);
  const ranked = rankPathways(catalog, taken);
  assert.ok(ranked[0].remaining <= ranked[ranked.length - 1].remaining);
  const corporate = ranked.find((r) => r.pathwayId === 'finance-corporate');
  assert.equal(corporate.remaining, 2, 'Finance (Corporate) should be 2 courses away');
});
