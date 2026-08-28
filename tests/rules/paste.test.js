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
  const { matched } = parsePaste(text, catalog);
  const ids = matched.map((m) => m.courseId);
  assert.ok(ids.includes('FINANCE 646'));
  assert.ok(ids.includes('ACCOUNTG 597'));
  assert.ok(ids.includes('STRATEGY 838'));
});

test('reports codes it does not recognize instead of dropping them', () => {
  const { unmatched } = parsePaste('FINANCE 646 and BOGUS 999', catalog);
  assert.deepEqual(unmatched.map((u) => u.code), ['BOGUS 999']);
});

test('a shared course number offers every course that uses it', () => {
  const { matched } = parsePaste('DECISION 894', catalog);
  assert.equal(matched.length, 2);
  assert.ok(matched.every((m) => m.ambiguous));
});

test('does not double-count a code that appears twice', () => {
  const { matched } = parsePaste('FINANCE 646 ... FINANCE 646', catalog);
  assert.equal(matched.filter((m) => m.courseId === 'FINANCE 646').length, 1);
});

test('a transcript spelling under another prefix still matches its course', () => {
  // Duke records these as ENVIRON; the Energy & Environment document lists ENERGY.
  const { matched, unmatched } = parsePaste('ENVIRON 635 and ENVIRON 711', catalog);
  assert.deepEqual(matched.map((m) => m.courseId).sort(), ['ENERGY 635', 'ENERGY 711']);
  assert.ok(matched.every((m) => m.viaAlias), 'both matched through an alias');
  assert.deepEqual(unmatched, []);
});

test('no suggestion when a number is genuinely ambiguous', () => {
  // 895 is every FCCP practicum; suggesting one would be worse than suggesting none.
  const { unmatched } = parsePaste('BOGUS 895 Fuqua Client Consulting Practicum', catalog);
  assert.equal(unmatched[0].suggestion, null);
});

test('a shared number alone is not enough to suggest a course', () => {
  // Pat's transcript has ENVIRON 710, Applied Statistical Modeling. The catalog has
  // HLTHMGMT 710, Health Institutions. Same number, unrelated course. Suggesting it
  // would put the wrong course in front of a student as a plausible match.
  const { unmatched } = parsePaste('ENVIRON 710 APP STATISTICAL MODELG ENV MGT', catalog);
  assert.equal(unmatched[0].code, 'ENVIRON 710');
  assert.equal(unmatched[0].suggestion, null, 'unrelated titles must not be proposed');
});

test('a shared number with an agreeing title is suggested', () => {
  const { unmatched } = parsePaste('ENVIRON 588 INTRO TO SOLAR PROJECT DEVELOPMENT', catalog);
  assert.equal(unmatched[0].suggestion?.code, 'ENERGY 588');
});

test('a code with no title alongside it gets no suggestion', () => {
  const { unmatched } = parsePaste('ENVIRON 588', catalog);
  assert.equal(unmatched[0].suggestion, null, 'no evidence, no proposal');
});
