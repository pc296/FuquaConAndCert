import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePathway, STATUS } from '../../app/rules/evaluate.js';
import { catalog, pathway, plan } from './helpers.js';

const evalOf = (id, ids, grades) => evaluatePathway(pathway(id), plan(ids, grades), catalog);
const group = (result, id) => result.groups.find((g) => g.id === id);

test('empty plan is not started', () => {
  const r = evalOf('management', []);
  assert.equal(r.status, STATUS.NOT_STARTED);
  assert.equal(r.percent, 0);
});

test('management: required group counts and completes', () => {
  const r = evalOf('management', [
    'MANAGEMT 738', 'MANAGEMT 744', 'MANAGEMT 745', 'MANAGEMT 746',
    'DECISION 611', 'OPERATNS 823',
  ]);
  assert.equal(group(r, 'organizing').have, 4);
  assert.equal(r.status, STATUS.COMPLETE);
});

test('management: one course short stays in progress', () => {
  const r = evalOf('management', [
    'MANAGEMT 738', 'MANAGEMT 744', 'MANAGEMT 745', 'DECISION 611', 'OPERATNS 823',
  ]);
  assert.equal(r.status, STATUS.IN_PROGRESS);
  assert.equal(group(r, 'organizing').satisfied, false);
});

test('decision sciences: credit minimums per category and 18 overall', () => {
  // 6 credits of tools, 9 of applications, 3 more from either. 18 total.
  const r = evalOf('decision-sciences', [
    'DECISION 611', 'DECISION 614',
    'FINANCE 647', 'FINANCE 648', 'MARKETNG 796',
    'OPERATNS 823',
  ]);
  assert.equal(r.totals.credits, 18);
  assert.equal(group(r, 'tools').have, 6);
  assert.equal(r.status, STATUS.COMPLETE);
});

test('decision sciences: 18 credits in the wrong split does not complete', () => {
  // 12 credits of Tools and 6 of Applications. The total is right and the
  // Applications minimum of 9 is not met, so this must not read as complete.
  const r = evalOf('decision-sciences', [
    'DECISION 611', 'DECISION 614', 'DECISION 618',
    'DECISION 894::modern-ai', 'DECISION 894::tech-analytics',
    'FINANCE 647', 'FINANCE 648',
  ]);
  assert.equal(r.totals.credits, 18);
  assert.equal(group(r, 'applications').satisfied, false);
  assert.equal(r.status, STATUS.IN_PROGRESS);
});

test('energy finance: overflow clause lets a third section-1 course count in section 2', () => {
  const withOverflow = evalOf('energy-finance', [
    'FINANCE 646', 'FINANCE 647', 'FINANCE 648',
    'FINANCE 652',
    'ENERGY 588', 'ENERGY 630',
  ]);
  assert.equal(group(withOverflow, 'finance-core').satisfied, true);
  assert.equal(group(withOverflow, 'finance-electives').satisfied, true,
    'the third finance course should fill the second elective slot');
  assert.equal(withOverflow.status, STATUS.COMPLETE);
});

test('energy finance: overflow is capped at one course', () => {
  // Only section-1 courses plus energy content. Two elective slots cannot both
  // be filled by overflow, because the clause allows exactly one.
  const r = evalOf('energy-finance', [
    'FINANCE 646', 'FINANCE 647', 'FINANCE 648',
    'ENERGY 588', 'ENERGY 630',
  ]);
  assert.equal(group(r, 'finance-electives').satisfied, false);
});

test('strategy: surplus advanced courses count toward the additional group', () => {
  const r = evalOf('strategy', [
    'STRATEGY 837', 'STRATEGY 838', 'STRATEGY 839', 'STRATEGY 840',
    'ACCOUNTG 591', 'ACCOUNTG 597',
  ]);
  assert.equal(r.status, STATUS.COMPLETE);
});

test('strategy: four courses cannot satisfy six course-slots', () => {
  const r = evalOf('strategy', [
    'STRATEGY 837', 'STRATEGY 838', 'ACCOUNTG 591', 'ACCOUNTG 597',
  ]);
  assert.equal(r.status, STATUS.IN_PROGRESS);
  assert.equal(group(r, 'additional').satisfied, false);
});

test('leadership and ethics: at least two electives outside Management', () => {
  const allManagement = evalOf('leadership-ethics', [
    'MANAGEMT 747', 'MANAGEMT 749',
    'MANAGEMT 738', 'MANAGEMT 744', 'MANAGEMT 745', 'MANAGEMT 746',
  ]);
  const constraint = group(allManagement, 'electives').constraints[0];
  assert.equal(constraint.satisfied, false);
  assert.equal(allManagement.status, STATUS.IN_PROGRESS);

  const mixed = evalOf('leadership-ethics', [
    'MANAGEMT 747', 'MANAGEMT 749',
    'MANAGEMT 738', 'MANAGEMT 744', 'DECISION 611', 'PHIL 503S',
  ]);
  assert.equal(group(mixed, 'electives').constraints[0].satisfied, true);
  assert.equal(mixed.status, STATUS.COMPLETE);
});

test('social entrepreneurship: only one practicum counts in the core group', () => {
  const twoPracticums = evalOf('social-entrepreneurship', [
    'MANAGEMT 750', 'SOCENT 895', 'MANAGEMT 898',
    'FINANCE 646', 'MANAGEMT 747', 'STRATEGY 838',
  ]);
  const core = group(twoPracticums, 'core');
  assert.equal(core.constraints[0].satisfied, false, 'two practicums should breach the limit');
});

test('social entrepreneurship: non-Fuqua credits are capped at 6', () => {
  const r = evalOf('social-entrepreneurship', [
    'MANAGEMT 750', 'MANAGEMT 762', 'MANAGEMT 898',
    'LAW 541', 'PUBPOL 544S', 'GLHLTH 701',
  ]);
  const cap = r.constraints.find((c) => c.type === 'maxNonFuquaCredits');
  assert.equal(cap.satisfied, false);
  assert.match(cap.detail, /9 non-Fuqua credits/);
});

test('operations management: practicum counts at 3 credits, not 6', () => {
  // The three group minimums sum to exactly 18, so the split has to be exact:
  // 4.5 operations, 7.5 methods, 6 breadth. SOCENT 895 is a 6-credit course that
  // this concentration counts as 3, which is what makes the methods group land on
  // 7.5 rather than 10.5.
  const r = evalOf('operations-management', [
    'OPERATNS 823', 'OPERATNS 894::sustainable-ops',
    'SOCENT 895', 'DECISION 611', 'DECISION 894::modern-ai',
    'ACCOUNTG 591', 'MANAGEMT 738',
  ]);
  assert.equal(group(r, 'methods').have, 7.5, 'SOCENT 895 counts as 3 credits here');
  assert.equal(r.totals.credits, 18);
  assert.equal(r.status, STATUS.COMPLETE);
});

test('operations management: 1.5-credit courses are handled in credit groups', () => {
  const r = evalOf('operations-management', [
    'OPERATNS 894::sustainable-ops', 'OPERATNS 823',
    'DECISION 894::modern-ai', 'DECISION 611', 'DECISION 614',
    'ACCOUNTG 591', 'MANAGEMT 738',
  ]);
  assert.equal(group(r, 'operations').have, 4.5);
  assert.equal(r.status, STATUS.COMPLETE);
});

test('repeatable course counts twice when taken twice', () => {
  const twice = [
    { courseId: 'ENRGYENV 628', quarter: 3 },
    { courseId: 'ENRGYENV 628', quarter: 6 },
  ];
  const r = evaluatePathway(pathway('energy-finance'), twice, catalog);
  assert.equal(group(r, 'energy-content').have, 3);
});

test('hsm certificate: needs an industry context elective and a second HLTHMGMT course', () => {
  const core = catalog.coreCourses.map((c) => c.id);

  const breadthOnly = evalOf('cert-hsm', [
    ...core,
    'HLTHMGMT 710', 'HLTHMGMT 705', 'HLTHMGMT 706',
    'ACCOUNTG 591', 'DECISION 611', 'FINANCE 646', 'MARKETNG 796',
  ]);
  const constraints = group(breadthOnly, 'electives').constraints;
  assert.equal(constraints[0].satisfied, false, 'no industry context elective');
  assert.equal(breadthOnly.status, STATUS.IN_PROGRESS);

  const proper = evalOf('cert-hsm', [
    ...core,
    'HLTHMGMT 710', 'HLTHMGMT 705', 'HLTHMGMT 706',
    'HLTHMGMT 711', 'HLTHMGMT 715', 'DECISION 611', 'MARKETNG 796',
  ]);
  assert.equal(proper.status, STATUS.COMPLETE);
});

test('hsm certificate: the core requirement blocks completion until the core is recorded', () => {
  const electivesOnly = evalOf('cert-hsm', [
    'HLTHMGMT 710', 'HLTHMGMT 705', 'HLTHMGMT 706',
    'HLTHMGMT 711', 'HLTHMGMT 715', 'DECISION 611', 'MARKETNG 796',
  ]);
  const coreRule = electivesOnly.constraints.find((c) => c.type === 'requiresCore');
  assert.equal(coreRule.satisfied, false);
  assert.match(coreRule.detail, /0 of 14 core courses recorded/);
  assert.equal(electivesOnly.status, STATUS.IN_PROGRESS);
});

test('core courses never count toward a concentration', () => {
  const coreOnly = catalog.coreCourses.map((c) => c.id);
  for (const p of catalog.pathways) {
    const r = evaluatePathway(p, plan(coreOnly), catalog);
    assert.equal(r.totals.courses, 0, `${p.id} counted a core course`);
    assert.equal(r.totals.credits, 0, `${p.id} counted core credits`);
  }
});

test('finance certificate: GPA below 3.75 blocks completion', () => {
  const courses = [
    'FINANCE 646', 'FINANCE 647',
    'ACCOUNTG 592', 'ACCOUNTG 597',
    'DECISION 611', 'DECISION 614',
    'FINANCE 651', 'FINANCE 654',
    'FINANCE 648', 'FINANCE 653',
  ];
  const low = Object.fromEntries(courses.map((c) => [c, 3.3]));
  const lowResult = evalOf('cert-finance', courses, low);
  assert.equal(lowResult.gpa.value, 3.3);
  assert.equal(lowResult.gpa.satisfied, false);
  assert.equal(lowResult.status, STATUS.IN_PROGRESS);

  const high = Object.fromEntries(courses.map((c) => [c, 3.9]));
  const highResult = evalOf('cert-finance', courses, high);
  assert.equal(highResult.gpa.satisfied, true);
  assert.equal(highResult.status, STATUS.COMPLETE);
});

test('finance certificate: GPA is unknown, not failed, when no grades are entered', () => {
  const r = evalOf('cert-finance', ['FINANCE 646', 'FINANCE 647']);
  assert.equal(r.gpa.known, false);
  assert.equal(r.gpa.value, null);
});

test('a course counts toward every pathway it appears on at once', () => {
  const shared = plan(['FINANCE 646']);
  const hits = catalog.pathways
    .map((p) => evaluatePathway(p, shared, catalog))
    .filter((r) => r.totals.courses > 0);
  assert.ok(hits.length >= 3, `FINANCE 646 should count on several pathways, got ${hits.length}`);
});

test('every pathway in the catalog evaluates without throwing', () => {
  const big = plan(catalog.courseList.slice(0, 40).map((c) => c.id));
  for (const p of catalog.pathways) {
    const r = evaluatePathway(p, big, catalog);
    assert.equal(typeof r.percent, 'number');
    assert.ok(r.percent >= 0 && r.percent <= 100, `${p.id} percent ${r.percent}`);
  }
});

test('finance certificate: the intermediate qualification is reported before completion', () => {
  const notYet = evalOf('cert-finance', ['FINANCE 646', 'FINANCE 647', 'FINANCE 648']);
  assert.equal(notYet.intermediate.satisfied, false);
  assert.match(notYet.intermediate.detail, /0 of 1 outside FINANCE/);

  const qualifying = evalOf('cert-finance', [
    'FINANCE 646', 'FINANCE 647', 'FINANCE 648', 'ACCOUNTG 597',
  ]);
  assert.equal(qualifying.intermediate.satisfied, true);
  assert.equal(qualifying.status, STATUS.IN_PROGRESS, 'qualifying is not the same as earned');
});

test('finance certificate: a failing GPA blocks the intermediate claim', () => {
  const courses = ['FINANCE 646', 'FINANCE 647', 'FINANCE 648', 'ACCOUNTG 597'];
  const grades = Object.fromEntries(courses.map((c) => [c, 2.0]));
  const r = evalOf('cert-finance', courses, grades);
  assert.equal(r.intermediate.satisfied, false);
  assert.match(r.intermediate.detail, /GPA is below the threshold/);
});

test('pathways without an intermediate state report null rather than a default', () => {
  assert.equal(evalOf('strategy', ['STRATEGY 837']).intermediate, null);
});
