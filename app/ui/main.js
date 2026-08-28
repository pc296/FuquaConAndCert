/**
 * Fuqua ConCert entry point. Wires catalog, rules, storage, and the DOM together.
 * No requirement logic lives here (ARCHITECTURE.md boundaries).
 */

import { buildCatalog, evaluateAll, checkCombination, recommend, rankPathways, STATUS } from '../rules/index.js';
import * as store from '../storage/plan.js';
import { parsePaste } from './parse-paste.js';
import { renderMap } from './map.js';
import {
  PRE_FUQUA, PRE_FUQUA_LABEL, SEMESTERS, TERM_LABELS,
  placementOptions, normalizeQuarter, spansSemester, placementLabel,
} from './placement.js';
import { buildReportHtml } from './report.js';
import { extractPdfText, looksLikePdf } from './pdf-import.js';

const GRADES = [
  ['', 'no grade'], ['4', 'A'], ['3.7', 'A-'], ['3.3', 'B+'], ['3', 'B'],
  ['2.7', 'B-'], ['2.3', 'C+'], ['2', 'C'],
];

const $ = (id) => document.getElementById(id);
const state = { selected: null, blocked: new Set(), pending: null, showClosest: false };

let catalog;
let layout;
let plan;

async function init() {
  const [pathways, courses, layoutJson] = await Promise.all([
    fetchJson('data/catalog/pathways.json'),
    fetchJson('data/catalog/courses.json'),
    fetchJson('data/layout/map.json'),
  ]);
  catalog = buildCatalog(pathways, courses);
  layout = layoutJson;
  $('retrieved').textContent = catalog.retrieved;

  const loaded = store.load();
  plan = loaded.plan;
  if (loaded.error) {
    setStatus('Could not read a saved plan in this browser. Import a plan file to restore it.');
  }

  buildQuarterSelect();
  buildCourseList();
  bindControls();
  render();
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Could not load ${path}: ${response.status}`);
  return response.json();
}

function buildQuarterSelect() {
  const select = $('quarter-select');
  for (const option of placementOptions(true)) {
    const el = document.createElement('option');
    el.value = String(option.value);
    el.textContent = option.value === PRE_FUQUA ? 'Pre-Fuqua' : option.label;
    if (option.value === 1) el.selected = true;
    select.appendChild(el);
  }
}

function buildCourseList() {
  const list = $('course-list');
  for (const course of catalog.courseList) {
    const option = document.createElement('option');
    option.value = `${course.code} — ${course.title}`;
    option.dataset.id = course.id;
    list.appendChild(option);
  }
}

function bindControls() {
  $('add-btn').addEventListener('click', addFromSearch);
  $('course-search').addEventListener('keydown', (e) => { if (e.key === 'Enter') addFromSearch(); });
  $('paste-btn').addEventListener('click', () => showConfirm($('paste-box').value));
  $('export-btn').addEventListener('click', exportPlan);
  $('report-btn').addEventListener('click', openReport);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', importFile);
  $('closest-btn').addEventListener('click', () => {
    state.showClosest = !state.showClosest;
    render();
  });
}

/* ---------- plan mutation ---------- */

function persist() {
  const { ok, error } = store.save(plan);
  if (!ok) setStatus(`Could not save to this browser (${error?.name ?? 'error'}). Export your plan to be safe.`);
  render();
}

function addCourse(courseId, quarter) {
  const course = catalog.courses.get(courseId);
  if (!course) return false;
  const taken = plan.entries.filter((e) => e.courseId === courseId).length;
  const limit = course.maxTimes ?? 1;
  if (taken >= limit) {
    setStatus(`${course.code} is already in your plan${limit > 1 ? ` ${limit} times, its maximum` : ''}.`);
    return false;
  }
  plan.entries.push({ courseId, quarter });
  return true;
}

function addFromSearch() {
  const input = $('course-search');
  const value = input.value.trim();
  if (!value) return;
  const option = [...$('course-list').options].find((o) => o.value === value);
  const code = option?.dataset.id ?? value.split('—')[0].trim();
  const course = catalog.courses.get(code) ?? catalog.courseList.find((c) => c.code === code);
  if (!course) { setStatus(`No course matches "${value}".`); return; }
  const placed = normalizeQuarter(course.isFuqua, $('quarter-select').value);
  if (addCourse(course.id, placed)) {
    setStatus(course.isFuqua || placed === PRE_FUQUA
      ? `Added ${course.code}.`
      : `Added ${course.code} as a semester course (${placementLabel(false, placed)}).`);
    input.value = '';
    persist();
  }
}

/* ---------- paste and confirm (ADR-0012) ---------- */

/**
 * One import control for both file types (ADR-0034).
 *
 * Two separate pickers, one labelled "Import" that took only JSON, meant anyone
 * reaching for "import my transcript" hit the backup restore instead. A single
 * control that dispatches on the file it was actually given removes the choice
 * rather than explaining it.
 */
async function importFile(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  if (looksLikePdf(file)) return importTranscriptPdf(file);
  if (/\.json$/i.test(file.name) || file.type === 'application/json') return importPlan(file);
  setImportStatus(
    `${file.name} is neither a PDF transcript nor a Fuqua ConCert backup file, so nothing was read.`,
  );
}

/**
 * Read a transcript PDF and hand its text to the same confirmation screen the
 * paste box uses. Extraction proposes; the student confirms (ADR-0012, ADR-0033).
 */
async function importTranscriptPdf(file) {
  setImportStatus(`Reading ${file.name}. The PDF reader loads on first use, so this may take a moment.`);
  try {
    const { text, pages } = await extractPdfText(file);
    setImportStatus(`Read ${pages} page${pages === 1 ? '' : 's'} of ${file.name}. Check the courses below before adding them.`);
    showConfirm(text);
  } catch (error) {
    // Loudly, with the reason. A silent empty result would read as "no courses".
    setImportStatus(error.message);
  }
}

function showConfirm(text) {
  const { matched, unmatched } = parsePaste(text, catalog.courses);
  const already = new Set(plan.entries.map((e) => e.courseId));
  state.pending = matched.filter((m) => !already.has(m.courseId));
  const area = $('confirm-area');
  area.replaceChildren();

  if (state.pending.length === 0 && unmatched.length === 0) {
    area.innerHTML = '<p class="muted">No course codes found in that text.</p>';
    return;
  }

  const box = document.createElement('div');
  box.className = 'confirm';
  box.innerHTML = `<h3>Check before adding</h3>
    <p class="muted">Nothing enters your plan until you confirm it. Untick anything that is wrong.</p>`;

  const list = document.createElement('ul');
  state.pending.forEach((item, i) => {
    const course = catalog.courses.get(item.courseId);
    const li = document.createElement('li');
    li.innerHTML = `<input type="checkbox" id="pend-${i}" ${item.ambiguous ? '' : 'checked'}>
      <label for="pend-${i}"><strong>${course.code}</strong> ${escapeHtml(course.title)}</label>
      ${item.ambiguous ? '<span class="amb">shared course number, pick the right one</span>' : ''}`;
    list.appendChild(li);
  });
  box.appendChild(list);

  if (unmatched.length > 0) {
    const note = document.createElement('p');
    note.className = 'muted';
    note.textContent = `Not in the catalog, so not offered: ${unmatched.join(', ')}. These may be core courses, or courses that need advising approval.`;
    box.appendChild(note);
  }

  const row = document.createElement('div');
  row.className = 'row';
  const confirm = document.createElement('button');
  confirm.textContent = 'Add selected';
  confirm.addEventListener('click', () => {
    let added = 0;
    state.pending.forEach((item, i) => {
      if ($(`pend-${i}`)?.checked && addCourse(item.courseId, 1)) added += 1;
    });
    $('confirm-area').replaceChildren();
    $('paste-box').value = '';
    setImportStatus('');
    setStatus(`${added} course${added === 1 ? '' : 's'} added. Set their placement below.`);
    persist();
  });
  const cancel = document.createElement('button');
  cancel.className = 'ghost';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => $('confirm-area').replaceChildren());
  row.append(confirm, cancel);
  box.appendChild(row);
  area.appendChild(box);
}

/* ---------- export and import ---------- */

function exportPlan() {
  const blob = new Blob([store.toFile(plan)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `fuqua-concert-plan-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/** Print-styled report in a new window; the print dialog turns it into a PDF. */
function openReport() {
  const results = evaluateAll(catalog, plan.entries);
  results.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  const html = buildReportHtml(catalog, plan, results, checkCombination(plan.declared, catalog));
  const win = window.open('', '_blank');
  if (!win) {
    setStatus('The report window was blocked. Allow pop-ups for this site and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

async function importPlan(file) {
  try {
    plan = store.fromFile(await file.text());
    setImportStatus(`Restored a backup: ${plan.entries.length} courses.`);
    persist();
  } catch (error) {
    setImportStatus(`That file could not be read as a Fuqua ConCert backup (${error.message}).`);
  }
}

/* ---------- render ---------- */

function render() {
  const results = evaluateAll(catalog, plan.entries);
  results.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  renderQuarters();
  renderCapBar(results);
  renderMap($('map'), layout, results, state, (id) => { state.selected = id; render(); });
  renderClosest();
  renderDetail(results);

  const done = results.filter((r) => r.status === STATUS.COMPLETE).length;
  const going = results.filter((r) => r.status === STATUS.IN_PROGRESS).length;
  $('map-summary').textContent =
    `${plan.entries.length} courses · ${done} complete · ${going} in progress`;
}

function renderQuarters() {
  const host = $('quarters');
  host.replaceChildren();

  const held = new Set(plan.entries.map((e) => e.courseId));
  const haveCore = catalog.coreCourses.filter((c) => held.has(c.id)).length;
  const core = document.createElement('p');
  core.className = 'coreline';
  core.textContent = haveCore === catalog.coreCourses.length
    ? `Core curriculum: all ${catalog.coreCourses.length} recorded.`
    : `Core curriculum: ${haveCore} of ${catalog.coreCourses.length} recorded. Core courses count toward no concentration; only the HSM certificate requires them.`;
  host.appendChild(core);

  const isFuquaEntry = (entry) => catalog.courses.get(entry.courseId)?.isFuqua !== false;
  const creditsOf = (entries) =>
    entries.reduce((sum, e) => sum + (catalog.courses.get(e.courseId)?.credits ?? 0), 0);

  // Pre-Fuqua bucket first: dual-degree coursework taken before Fuqua. Placement is
  // display metadata only, so these count toward pathways like any course (ADR-0030).
  const pre = plan.entries.filter((e) => e.quarter === PRE_FUQUA);
  const preSection = document.createElement('div');
  preSection.className = 'quarter prefuqua';
  const preHeading = document.createElement('h3');
  const preCredits = creditsOf(pre);
  preHeading.textContent = preCredits > 0
    ? `${PRE_FUQUA_LABEL} — ${preCredits} credits`
    : PRE_FUQUA_LABEL;
  preSection.appendChild(preHeading);
  if (pre.length === 0) {
    preSection.insertAdjacentHTML('beforeend', '<p class="empty-quarter">nothing recorded</p>');
  }
  for (const entry of pre) preSection.appendChild(renderChip(entry));
  host.appendChild(preSection);

  for (const semester of SEMESTERS) {
    const section = document.createElement('div');
    section.className = 'semester-block';
    const semesterLong = plan.entries.filter(
      (e) => e.quarter === semester.start && !isFuquaEntry(e),
    );
    const termEntries = semester.quarters.map((q) =>
      plan.entries.filter((e) => e.quarter === q && isFuquaEntry(e)),
    );
    const total = creditsOf(semesterLong) + creditsOf(termEntries.flat());

    const heading = document.createElement('h3');
    heading.className = 'semester-heading';
    heading.textContent = total > 0 ? `${semester.label} — ${total} credits` : semester.label;
    section.appendChild(heading);

    if (semesterLong.length > 0) {
      const band = document.createElement('div');
      band.className = 'semester-band';
      band.insertAdjacentHTML('beforeend',
        '<h4>Semester courses</h4><p class="band-note">Run on the Duke semester calendar and span both Fuqua terms.</p>');
      for (const entry of semesterLong) band.appendChild(renderChip(entry));
      section.appendChild(band);
    }

    semester.quarters.forEach((quarter, i) => {
      const sub = document.createElement('div');
      sub.className = 'quarter';
      const entries = termEntries[i];
      const heading3 = document.createElement('h3');
      const credits = creditsOf(entries);
      const coreCount = entries.filter((e) => catalog.courses.get(e.courseId)?.isCore).length;
      const bits = [];
      if (credits > 0) bits.push(`${credits} credits`);
      if (coreCount > 0) bits.push(`${coreCount} core`);
      heading3.textContent = bits.length
        ? `${TERM_LABELS[quarter]} — ${bits.join(', ')}`
        : TERM_LABELS[quarter];
      sub.appendChild(heading3);
      if (entries.length === 0 && semesterLong.length === 0) {
        sub.insertAdjacentHTML('beforeend', '<p class="empty-quarter">nothing planned</p>');
      }
      for (const entry of entries) sub.appendChild(renderChip(entry));
      section.appendChild(sub);
    });
    host.appendChild(section);
  }
}

function renderChip(entry) {
  const course = catalog.courses.get(entry.courseId);
  const isFuqua = course?.isFuqua !== false;
  const chip = document.createElement('div');
  chip.className = course?.isCore ? 'chip core' : isFuqua ? 'chip' : 'chip semester';

  // Row one is the record: what the course is. Row two is the controls. Keeping
  // them on one line starved the title to two pixels wide (LESSONS 2026-08-28).
  const main = document.createElement('div');
  main.className = 'chip-main';

  const code = document.createElement('span');
  code.className = 'code';
  code.textContent = course?.code ?? entry.courseId;
  const title = document.createElement('span');
  title.className = 'title';
  title.textContent = course?.title ?? 'unknown course';
  main.append(code, title);

  if (course?.isCore) {
    const tag = document.createElement('span');
    tag.className = 'coretag';
    tag.textContent = 'CORE';
    tag.title = 'Core courses do not count toward any concentration or certificate.';
    main.append(tag);
  }
  chip.append(main);

  const meta = document.createElement('div');
  meta.className = 'chip-meta';

  const where = document.createElement('select');
  where.setAttribute('aria-label', `Placement for ${course?.code ?? entry.courseId}`);
  for (const option of placementOptions(isFuqua)) {
    const el = document.createElement('option');
    el.value = String(option.value);
    el.textContent = option.value === PRE_FUQUA ? 'Pre-Fuqua'
      : isFuqua ? option.label
      : option.label.replace(' (both terms)', ' · both terms');
    el.selected = entry.quarter === option.value;
    where.appendChild(el);
  }
  where.addEventListener('change', () => {
    entry.quarter = normalizeQuarter(isFuqua, where.value);
    persist();
  });

  const grade = document.createElement('select');
  grade.setAttribute('aria-label', `Grade for ${course?.code ?? entry.courseId}`);
  for (const [value, label] of GRADES) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    option.selected = String(entry.gradePoints ?? '') === value;
    grade.appendChild(option);
  }
  grade.addEventListener('change', () => {
    if (grade.value === '') delete entry.gradePoints;
    else entry.gradePoints = Number(grade.value);
    persist();
  });

  const credits = document.createElement('span');
  credits.className = 'chip-credits';
  credits.textContent = course?.isCore ? 'core'
    : course?.credits ? `${course.credits} cr`
    : '';

  const remove = document.createElement('button');
  remove.className = 'drop';
  remove.textContent = '×';
  remove.title = `Remove ${course?.code ?? ''}`;
  remove.setAttribute('aria-label', `Remove ${course?.code ?? entry.courseId}`);
  remove.addEventListener('click', () => {
    plan.entries.splice(plan.entries.indexOf(entry), 1);
    persist();
  });

  meta.append(where, grade, credits, remove);
  chip.append(meta);
  return chip;
}

function renderCapBar(results) {
  const bar = $('capbar');
  bar.replaceChildren();
  const check = checkCombination(plan.declared, catalog);

  const label = document.createElement('span');
  label.className = 'muted';
  label.textContent = 'Declaring:';
  bar.appendChild(label);

  const declaredNames = plan.declared
    .map((id) => catalog.pathways.find((p) => p.id === id))
    .filter(Boolean);
  if (declaredNames.length === 0) {
    const none = document.createElement('span');
    none.className = 'slot';
    none.textContent = 'nothing yet — click a hexagon, then Declare';
    bar.appendChild(none);
  }
  for (const pathway of declaredNames) {
    const slot = document.createElement('span');
    slot.className = 'slot filled';
    slot.textContent = `${pathway.shortName ?? pathway.name}${(pathway.slots ?? 1) > 1 ? ' (2 slots)' : ''}`;
    bar.appendChild(slot);
  }

  const used = document.createElement('span');
  used.className = 'muted';
  used.textContent = `${check.slotsUsed} of ${check.maxSlots} specialties used`;
  bar.appendChild(used);

  for (const problem of check.problems) {
    const warn = document.createElement('span');
    warn.className = 'problem';
    warn.textContent = problem;
    bar.appendChild(warn);
  }

  // A pathway is shown as blocked when adding it would breach the cap.
  state.blocked = new Set();
  if (check.ok) {
    for (const result of results) {
      if (plan.declared.includes(result.pathwayId)) continue;
      const test = checkCombination([...plan.declared, result.pathwayId], catalog);
      if (!test.ok) state.blocked.add(result.pathwayId);
    }
  }
}

function renderDetail(results) {
  const host = $('detail');
  host.replaceChildren();
  const result = results.find((r) => r.pathwayId === state.selected);
  if (!result) {
    host.innerHTML = '<p class="muted">Select a hexagon to see what it still needs.</p>';
    return;
  }

  const head = document.createElement('div');
  head.className = 'row';
  head.innerHTML = `<div class="grow">
      <span class="kind">${result.kind}${result.slots > 1 ? ' · counts as 2' : ''}</span>
      <h3>${escapeHtml(result.name)}</h3>
    </div>`;

  const declared = plan.declared.includes(result.pathwayId);
  const button = document.createElement('button');
  button.className = declared ? 'ghost' : '';
  button.textContent = declared ? 'Undeclare' : 'Declare';
  button.disabled = !declared && state.blocked.has(result.pathwayId);
  button.addEventListener('click', () => {
    plan.declared = declared
      ? plan.declared.filter((id) => id !== result.pathwayId)
      : [...plan.declared, result.pathwayId];
    persist();
  });
  head.appendChild(button);
  host.appendChild(head);

  const totals = document.createElement('p');
  totals.className = 'muted';
  const bits = [`${result.totals.courses} courses`, `${result.totals.credits} credits counted`];
  if (result.totals.minCourses) bits.push(`needs ${result.totals.minCourses} courses`);
  if (result.totals.minCredits) bits.push(`needs ${result.totals.minCredits} credits`);
  totals.textContent = bits.join(' · ');
  host.appendChild(totals);

  if (state.blocked.has(result.pathwayId)) {
    host.appendChild(flag('Declaring this would exceed the two-specialty limit. Progress is still tracked.'));
  }
  if (result.approximate) {
    host.appendChild(flag('This pathway is large enough that the allocation search hit its budget. The result is a lower bound, not a proof.'));
  }

  for (const group of result.groups) {
    const box = document.createElement('div');
    box.className = `group ${group.satisfied ? 'satisfied' : 'unsatisfied'}`;
    const unit = group.unit === 'credits' ? 'credits' : 'courses';
    box.innerHTML = `<div class="group-head">
        <strong>${escapeHtml(group.label)}</strong>
        <span class="group-count">${group.have} of ${group.min} ${unit}</span>
      </div>
      <div class="progress"><i style="width:${Math.min(100, (group.have / group.min) * 100)}%"></i></div>`;

    if (group.assigned.length > 0) {
      const line = document.createElement('div');
      line.className = 'assigned';
      line.innerHTML = group.assigned
        .map((id) => `<code>${catalog.courses.get(id)?.code ?? id}</code>`)
        .join(', ');
      box.appendChild(line);
    }
    if (group.missing?.length > 0) {
      const line = document.createElement('div');
      line.className = 'assigned';
      line.innerHTML = `Still required: ${group.missing
        .map((id) => `<code>${catalog.courses.get(id)?.code ?? id}</code>`)
        .join(', ')}`;
      box.appendChild(line);
    }
    for (const constraint of group.constraints ?? []) {
      box.appendChild(flag(`${constraint.note || constraint.type} — ${constraint.detail}`, constraint.satisfied));
    }
    box.appendChild(renderGroupOptions(result.pathwayId, group));
    host.appendChild(box);
  }

  for (const constraint of result.constraints) {
    host.appendChild(flag(`${constraint.note || constraint.type} — ${constraint.detail}`, constraint.satisfied));
  }

  if (result.gpa) {
    const g = result.gpa;
    const text = g.value === null
      ? `Needs a ${g.min} GPA across the qualifying courses. Add grades to your courses to track it.`
      : `GPA ${g.value} against a ${g.min} minimum${g.known ? '' : ' (partial: not all qualifying courses graded yet)'}.`;
    host.appendChild(flag(text, g.satisfied === true));
  }

  if (result.intermediate && result.status !== STATUS.COMPLETE) {
    const i = result.intermediate;
    host.appendChild(flag(
      i.satisfied
        ? `${i.label}: yes. ${i.note}`
        : `${i.label}: not yet — ${i.detail}.`,
      i.satisfied));
  }

  if (result.notes.length > 0) {
    const notes = document.createElement('ul');
    notes.className = 'notes';
    for (const note of result.notes) {
      const li = document.createElement('li');
      li.textContent = note;
      notes.appendChild(li);
    }
    host.appendChild(notes);
  }

  host.appendChild(renderNextUp(result));
}

/** The shortest remaining route to a pathway, with one-click adds. */
function renderNextUp(result) {
  const pathway = catalog.pathways.find((p) => p.id === result.pathwayId);
  const advice = recommend(pathway, plan.entries, catalog, { declared: plan.declared });

  const box = document.createElement('div');
  box.className = 'next-up';

  if (advice.complete && advice.courses.length === 0) {
    box.innerHTML = '<div class="done">Complete. Nothing further is needed for this one.</div>';
    return box;
  }
  if (!advice.reachable) {
    box.innerHTML = '<div class="done">No route to completion could be found from the courses this pathway lists. That is a catalog problem, not a planning one; please report it.</div>';
    return box;
  }

  const header = document.createElement('header');
  header.innerHTML = `<strong>Shortest way to finish</strong>
    <span class="muted">${advice.courses.length} more course${advice.courses.length === 1 ? '' : 's'}</span>`;
  box.appendChild(header);

  // Core courses are listed as one line rather than fourteen: they are not a choice.
  const coreNeeded = advice.courses.filter((c) => c.isCore);
  const electives = advice.courses.filter((c) => !c.isCore);
  if (coreNeeded.length > 0) {
    const note = document.createElement('div');
    note.className = 'done';
    note.textContent = `Plus ${coreNeeded.length} core course${coreNeeded.length === 1 ? '' : 's'} you have not recorded yet. Core coursework is required for this certificate but is not a choice, so it is not listed step by step.`;
    box.appendChild(note);
  }

  const list = document.createElement('ol');
  electives.forEach((item, i) => {
    const li = document.createElement('li');
    const step = document.createElement('span');
    step.className = 'step';
    step.textContent = String(i + 1);

    const label = document.createElement('span');
    label.className = 'grow';
    const altCodes = (item.alternatives ?? [])
      .map((id) => catalog.courses.get(id)?.code ?? id);
    const shown = altCodes.slice(0, 4);
    const more = altCodes.length - shown.length;
    label.innerHTML = `<strong>${item.course.code}</strong> ${escapeHtml(item.course.title)}` +
      (shown.length
        ? ` <span class="alt">or ${shown.map(escapeHtml).join(', ')}${more > 0 ? ` +${more} more` : ''}</span>`
        : '') +
      (item.alsoCountsToward.length
        ? ` <span class="also">also counts toward ${item.alsoCountsToward.map(escapeHtml).join(', ')}</span>`
        : '');

    const add = document.createElement('button');
    add.className = 'ghost tiny';
    add.textContent = 'Add';
    add.addEventListener('click', () => {
      if (addCourse(item.courseId, 1)) {
        setStatus(`Added ${item.course.code}. Set its quarter below.`);
        persist();
      }
    });

    li.append(step, label, add);
    list.appendChild(li);
  });
  box.appendChild(list);
  return box;
}

/**
 * The full menu for one requirement group: every listed course with its status,
 * so the shortest way is a suggestion rather than the only visible path.
 */
function renderGroupOptions(pathwayId, group) {
  const pathwayRec = catalog.pathways.find((p) => p.id === pathwayId);
  const groupRec = pathwayRec?.groups.find((g) => g.id === group.id);
  const details = document.createElement('details');
  details.className = 'options';
  if (!groupRec) return details;

  const inPlan = new Set(plan.entries.map((e) => e.courseId));
  const counting = new Set(group.assigned);
  const summary = document.createElement('summary');
  summary.textContent = `All ${groupRec.courses.length} options`;
  details.appendChild(summary);

  const list = document.createElement('ul');
  for (const courseId of groupRec.courses) {
    const course = catalog.courses.get(courseId);
    const li = document.createElement('li');
    const status = counting.has(courseId) ? 'counting'
      : inPlan.has(courseId) ? 'in plan'
      : 'available';
    li.className = `opt ${status.replace(' ', '-')}`;
    const credits = course?.credits ? ` (${course.credits} cr)` : '';
    li.innerHTML = `<span class="opt-status">${status}</span>` +
      `<strong>${escapeHtml(course?.code ?? courseId)}</strong> ` +
      `${escapeHtml(course?.title ?? '')}${credits}`;
    if (status === 'available') {
      const add = document.createElement('button');
      add.className = 'ghost tiny';
      add.textContent = 'Add';
      add.addEventListener('click', () => {
        const placed = normalizeQuarter(course?.isFuqua !== false, 1);
        if (addCourse(courseId, placed)) {
          setStatus(`Added ${course?.code ?? courseId}. Set its placement in the plan.`);
          persist();
        }
      });
      li.appendChild(add);
    }
    list.appendChild(li);
  }
  details.appendChild(list);
  return details;
}

/** Every pathway ranked by how few courses it still needs. */
function renderClosest() {
  const host = $('closest');
  $('closest-btn').textContent = state.showClosest ? 'Hide ranking' : "What's closest";
  if (!state.showClosest) {
    host.hidden = true;
    host.replaceChildren();
    return;
  }
  host.hidden = false;
  const ranked = rankPathways(catalog, plan.entries, plan.declared);
  const max = Math.max(...ranked.map((r) => r.remaining ?? 0), 1);

  const wrap = document.createElement('div');
  wrap.className = 'closest';
  wrap.innerHTML = '<p class="muted">Ranked by how few additional courses each would take from where you are now. Click a row to open it.</p>';
  const table = document.createElement('table');
  for (const row of ranked) {
    const tr = document.createElement('tr');
    if (row.complete) tr.className = 'done';
    const remaining = row.remaining === null ? 'unreachable'
      : row.complete ? 'complete'
      : `${row.remaining} to go`;
    tr.innerHTML = `<td>${escapeHtml(row.name)}${row.kind === 'certificate' ? ' ◆' : ''}</td>
      <td><div class="bar"><i style="width:${row.remaining === null ? 0 : 100 - (row.remaining / max) * 100}%"></i></div></td>
      <td class="n">${remaining}</td>`;
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => { state.selected = row.pathwayId; render(); });
    table.appendChild(tr);
  }
  wrap.appendChild(table);
  host.appendChild(wrap);
}

function flag(text, ok = false) {
  const div = document.createElement('div');
  div.className = `flag${ok ? ' ok' : ''}`;
  div.textContent = text;
  return div;
}

function setStatus(message) { $('add-status').textContent = message; }
function setImportStatus(message) { $('import-status').textContent = message; }

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

init().catch((error) => {
  setStatus(`Fuqua ConCert could not start: ${error.message}`);
  console.error(error);
});
