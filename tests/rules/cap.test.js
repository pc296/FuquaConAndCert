import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCombination } from '../../app/rules/cap.js';
import { catalog } from './helpers.js';

test('two concentrations is allowed', () => {
  const r = checkCombination(['strategy', 'marketing'], catalog);
  assert.equal(r.ok, true);
  assert.equal(r.slotsUsed, 2);
});

test('one concentration and one certificate is allowed', () => {
  assert.equal(checkCombination(['strategy', 'cert-hsm'], catalog).ok, true);
});

test('three concentrations is not allowed', () => {
  const r = checkCombination(['strategy', 'marketing', 'management'], catalog);
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /3 specialties/);
});

test('dual finance fills the allowance on its own', () => {
  assert.equal(checkCombination(['finance-dual'], catalog).ok, true);
  const withMore = checkCombination(['finance-dual', 'marketing'], catalog);
  assert.equal(withMore.ok, false);
  assert.match(withMore.problems[0], /counts as 2 specialties/);
});

test('two certificates is rejected under the current rule', () => {
  const r = checkCombination(['cert-finance', 'cert-hsm'], catalog);
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /2 certificates/);
});

test('an empty selection is allowed', () => {
  assert.equal(checkCombination([], catalog).ok, true);
});
