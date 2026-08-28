import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PRE_FUQUA, placementOptions, normalizeQuarter, spansSemester, placementLabel, semesterOf,
} from '../../app/ui/placement.js';
import { evaluatePathway, STATUS } from '../../app/rules/evaluate.js';
import { catalog, pathway } from './helpers.js';

test('fuqua courses place by term, non-fuqua by semester, both offer pre-fuqua', () => {
  const fuqua = placementOptions(true).map((o) => o.value);
  const nonFuqua = placementOptions(false).map((o) => o.value);
  assert.deepEqual(fuqua, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(nonFuqua, [0, 1, 3, 5, 7]);
});

test('a non-fuqua course placed in a second term snaps to the semester start', () => {
  assert.equal(normalizeQuarter(false, 2), 1);
  assert.equal(normalizeQuarter(false, 4), 3);
  assert.equal(normalizeQuarter(false, 8), 7);
  assert.equal(normalizeQuarter(false, 7), 7);
  assert.equal(normalizeQuarter(true, 4), 4, 'fuqua courses keep their term');
  assert.equal(normalizeQuarter(false, 0), PRE_FUQUA);
  assert.equal(normalizeQuarter(true, 99), PRE_FUQUA, 'out-of-range input falls back safely');
});

test('span and labels follow the course type', () => {
  assert.equal(spansSemester(false, 3), true);
  assert.equal(spansSemester(false, PRE_FUQUA), false);
  assert.equal(spansSemester(true, 3), false);
  assert.equal(placementLabel(false, 5), 'Year 2 · Fall (both terms)');
  assert.equal(placementLabel(true, 5), 'Year 2 Fall 1');
  assert.equal(semesterOf(6).start, 5);
});

test('placement never changes evaluation: pre-fuqua courses count fully', () => {
  // Same courses, one plan placed normally and one entirely pre-Fuqua (ADR-0030).
  const courses = ['MANAGEMT 738', 'MANAGEMT 744', 'MANAGEMT 745', 'MANAGEMT 746',
    'DECISION 611', 'OPERATNS 823'];
  const normal = courses.map((courseId, i) => ({ courseId, quarter: (i % 8) + 1 }));
  const preFuqua = courses.map((courseId) => ({ courseId, quarter: PRE_FUQUA }));
  const a = evaluatePathway(pathway('management'), normal, catalog);
  const b = evaluatePathway(pathway('management'), preFuqua, catalog);
  assert.equal(a.status, STATUS.COMPLETE);
  assert.equal(b.status, STATUS.COMPLETE);
  assert.equal(a.percent, b.percent);
});
