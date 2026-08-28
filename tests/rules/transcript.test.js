import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseTranscript, inferStartYear, findTermHeadings, findSchoolRecords,
} from '../../app/ui/parse-transcript.js';
import { PRE_FUQUA } from '../../app/ui/placement.js';
import { catalog } from './helpers.js';

const TRANSCRIPT = readFileSync(
  new URL('../fixtures/transcript-shape.txt', import.meta.url), 'utf8');

const placed = (result) => Object.fromEntries(result.matched.map((m) => [m.courseId, m.termId]));

test('term headings and school records are found in document order', () => {
  const terms = findTermHeadings(TRANSCRIPT);
  assert.deepEqual(terms.map((t) => `${t.year} ${t.season}`),
    ['2026 Fall', '2027 Spring', '2025 Fall', '2026 Spring']);
  const schools = findSchoolRecords(TRANSCRIPT);
  assert.equal(schools.length, 2);
  assert.match(schools[0].school, /Fuqua/);
  assert.match(schools[1].school, /Nicholas/);
});

test('the start year is inferred from the earliest term in the Fuqua record', () => {
  // 2025 Fall is earlier but belongs to the Nicholas record, so it must not win.
  assert.equal(inferStartYear(TRANSCRIPT), 2026);
});

test('courses land in the term their heading names, not all in one term', () => {
  // This is the defect that prompted the work: every course went to Fall 1.
  const result = parseTranscript(TRANSCRIPT, catalog);
  const where = placed(result);
  assert.equal(where['ACCOUNTG 590'], 'y1-fall-1');
  assert.equal(where['FINANCE 645'], 'y1-fall-1');
  assert.equal(where['FINANCE 646'], 'y1-spring-1', 'a spring course must not land in fall');
  assert.equal(where['STRATEGY 838'], 'y1-spring-1');
  assert.ok(new Set(Object.values(where)).size > 1, 'placements must actually differ');
});

test('coursework before the program start goes to the Pre-Fuqua bucket', () => {
  const where = placed(parseTranscript(TRANSCRIPT, catalog));
  assert.equal(where['ENERGY 520'], PRE_FUQUA);
  assert.equal(where['ENERGY 711'], PRE_FUQUA);
  assert.equal(where['ENERGY 635'], PRE_FUQUA);
});

test('cross-listed transcript spellings resolve to the catalog course', () => {
  // The transcript says ENVIRON; the concentration document says ENERGY.
  const result = parseTranscript(TRANSCRIPT, catalog);
  const ids = result.matched.map((m) => m.courseId);
  assert.ok(ids.includes('ENERGY 635'), 'ENVIRON 635 should resolve');
  assert.ok(ids.includes('ENERGY 711'), 'ENVIRON 711 should resolve');
  assert.ok(!ids.includes('ENVIRON 635'));
});

test('6-week terms are marked inexact, single blocks are not', () => {
  const result = parseTranscript(TRANSCRIPT, catalog);
  const fall = result.matched.find((m) => m.courseId === 'ACCOUNTG 590');
  assert.equal(fall.exact, false, 'a transcript cannot say Fall 1 versus Fall 2');
  assert.match(fall.reason, /6-week/);
  const pre = result.matched.find((m) => m.courseId === 'ENERGY 520');
  assert.equal(pre.exact, true, 'before the program is a definite answer');
});

test('a course Fuqua does not list is reported, with a suggestion where one exists', () => {
  const result = parseTranscript(TRANSCRIPT, catalog);
  const codes = result.unmatched.map((u) => u.code);
  assert.ok(codes.includes('ENVIRON 559'), 'a genuine non-catalog course is reported');
});

test('plain pasted text with no headings leaves placement to the student', () => {
  const result = parseTranscript('FINANCE 646 and STRATEGY 838', catalog);
  assert.equal(result.usedHeadings, false);
  assert.ok(result.matched.every((m) => m.termId === null),
    'nothing is invented when the text says nothing about terms');
  assert.equal(result.matched.length, 2);
});

test('an explicit start year overrides inference', () => {
  // A student who started a year later: the same 2026 Fall block is then prior work.
  const result = parseTranscript(TRANSCRIPT, catalog, { startYear: 2027 });
  assert.equal(placed(result)['ACCOUNTG 590'], PRE_FUQUA);
});

test('non-Fuqua courses snap to the semester start, since they span both terms', () => {
  const result = parseTranscript(TRANSCRIPT, catalog, { startYear: 2025 });
  const where = placed(result);
  // With a 2025 start, the Nicholas 2025 Fall block is Year 1 Fall.
  assert.equal(where['ENERGY 520'], 'y1-fall-1');
  assert.equal(where['ENERGY 711'], 'y1-fall-1');
});
