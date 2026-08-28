/**
 * Fuqua ConCert entry point. Wires catalog, rules, storage, and the DOM together.
 * No requirement logic lives here (ARCHITECTURE.md boundaries).
 */

import { buildCatalog, evaluateAll, checkCombination, STATUS } from '../rules/index.js';
import * as store from '../storage/plan.js';
import { parsePaste } from './parse-paste.js';
import { renderMap } from './map.js';

const QUARTERS = [
  'Year 1 · Fall 1', 'Year 1 · Fall 2', 'Year 1 · Spring 1', 'Year 1 · Spring 2',
  'Year 2 · Fall 1', 'Year 2 · Fall 2', 'Year 2 · Spring 1', 'Year 2 · Spring 2',
];
const GRADES = [
  ['', 'no grade'], ['4', 'A'], ['3.7', 'A-'], ['3.3', 'B+'], ['3', 'B'],
  ['2.7', 'B-'], ['2.3', 'C+'], ['2', 'C'],
];

const $ = (id) => document.getElementById(id);
const state = { selected: null, blocked: new Set(), pending: null };

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
  QUARTERS.forEach((label, i) => {
    const option = document.createElement('option');
    option.value = String(i + 1);
    option.textContent = label.replace('Year ', 'Y').replace(' · ', ' ');
    select.appendChild(option);
  });
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
  $('paste-btn').addEventListener('click', showConfirm);
  $('export-btn').addEventListener('click', exportPlan);
  $('import-btn').addEventListener('click', () => $('import-file').click());
  $('import-file').addEventListener('change', importPlan);
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
  if (addCourse(course.id, Number($('quarter-select').value))) {
    setStatus(`Added ${course.code}.`);
    input.value = '';
    persist();
  }
}

/* ---------- paste and confirm (ADR-0012) ---------- */

function showConfirm() {
  const text = $('paste-box').value;
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
    setStatus(`${added} course${added === 1 ? '' : 's'} added. Set their quarters below.`);
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

async function importPlan(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    plan = store.fromFile(await file.text());
    setStatus(`Imported ${plan.entries.length} courses.`);
    persist();
  } catch (error) {
    setStatus(`That file could not be read as a Fuqua ConCert plan (${error.message}).`);
  }
  event.target.value = '';
}

/* ---------- render ---------- */

function render() {
  const results = evaluateAll(catalog, plan.entries);
  results.sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
  renderQuarters();
  renderCapBar(results);
  renderMap($('map'), layout, results, state, (id) => { state.selected = id; render(); });
  renderDetail(results);

  const done = results.filter((r) => r.status === STATUS.COMPLETE).length;
  const going = results.filter((r) => r.status === STATUS.IN_PROGRESS).length;
  $('map-summary').textContent =
    `${plan.entries.length} courses · ${done} complete · ${going} in progress`;
}

function renderQuarters() {
  const host = $('quarters');
  host.replaceChildren();
  QUARTERS.forEach((label, index) => {
    const quarter = index + 1;
    const section = document.createElement('div');
    section.className = 'quarter';
    const heading = document.createElement('h3');
    const entries = plan.entries.filter((e) => e.quarter === quarter);
    const credits = entries.reduce((s, e) => s + (catalog.courses.get(e.courseId)?.credits ?? 0), 0);
    heading.textContent = credits > 0 ? `${label} — ${credits} credits` : label;
    section.appendChild(heading);

    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-quarter';
      empty.textContent = 'nothing planned';
      section.appendChild(empty);
    }
    for (const entry of entries) section.appendChild(renderChip(entry));
    host.appendChild(section);
  });
}

function renderChip(entry) {
  const course = catalog.courses.get(entry.courseId);
  const chip = document.createElement('div');
  chip.className = 'chip';

  const code = document.createElement('span');
  code.className = 'code';
  code.textContent = course?.code ?? entry.courseId;
  const title = document.createElement('span');
  title.className = 'title grow';
  title.textContent = course?.title ?? 'unknown course';
  title.title = course?.title ?? '';

  const quarter = document.createElement('select');
  quarter.setAttribute('aria-label', 'Quarter');
  QUARTERS.forEach((label, i) => {
    const option = document.createElement('option');
    option.value = String(i + 1);
    option.textContent = `Q${i + 1}`;
    option.selected = entry.quarter === i + 1;
    quarter.appendChild(option);
  });
  quarter.addEventListener('change', () => { entry.quarter = Number(quarter.value); persist(); });

  const grade = document.createElement('select');
  grade.setAttribute('aria-label', 'Grade');
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

  const remove = document.createElement('button');
  remove.className = 'drop';
  remove.textContent = '×';
  remove.title = `Remove ${course?.code ?? ''}`;
  remove.addEventListener('click', () => {
    plan.entries.splice(plan.entries.indexOf(entry), 1);
    persist();
  });

  chip.append(code, title, quarter, grade, remove);
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
        <span class="muted">${group.have} of ${group.min} ${unit}</span>
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

  const source = document.createElement('p');
  source.className = 'muted';
  source.textContent = `Source: ${result.source}`;
  host.appendChild(source);
}

function flag(text, ok = false) {
  const div = document.createElement('div');
  div.className = `flag${ok ? ' ok' : ''}`;
  div.textContent = text;
  return div;
}

function setStatus(message) { $('add-status').textContent = message; }

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

init().catch((error) => {
  setStatus(`Fuqua ConCert could not start: ${error.message}`);
  console.error(error);
});
