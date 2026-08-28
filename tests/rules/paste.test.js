import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePaste } from '../../app/ui/parse-paste.js';
import { catalog } from './helpers.js';

test('pulls course codes out of transcript-like text', () => {
  const text = `
    Fall 1 2026
    FINANCE 646  Corporate Finance        3.0   A-
    ACCOUNTG 597 Financial Statement Analysis 3.0 B+
    Spring 2 2027
    STRATEGY 838 Entrepreneurial Strategy 3.0
  `;
  const { matched } = parsePaste(text, catalog.courses);
  const ids = matched.map((m) => m.courseId);
  assert.ok(ids.includes('FINANCE 646'));
  assert.ok(ids.includes('ACCOUNTG 597'));
  assert.ok(ids.includes('STRATEGY 838'));
});

test('reports codes it does not recognize instead of dropping them', () => {
  const { unmatched } = parsePaste('FINANCE 646 and BOGUS 999', catalog.courses);
  assert.deepEqual(unmatched, ['BOGUS 999']);
});

test('a shared course number offers every course that uses it', () => {
  const { matched } = parsePaste('DECISION 894', catalog.courses);
  assert.equal(matched.length, 2);
  assert.ok(matched.every((m) => m.ambiguous));
});

test('does not double-count a code that appears twice', () => {
  const { matched } = parsePaste('FINANCE 646 ... FINANCE 646', catalog.courses);
  assert.equal(matched.filter((m) => m.courseId === 'FINANCE 646').length, 1);
});
