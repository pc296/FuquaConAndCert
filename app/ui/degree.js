/**
 * The degree view: what a whole combination costs, whether it fits in the terms
 * you have left, and which courses buy it.
 *
 * This is the answer to the question the Pathway Map cannot ask. The map shows
 * eighteen pathways one at a time; a student choosing between them needs to know
 * that Management and DEI together cost seven courses rather than twelve, and
 * that seven fits in the room they actually have. Both halves of that sentence
 * come from here (ADR-0038).
 *
 * No requirement logic lives in this file. Cost comes from `plan-ahead.js`, the
 * legality of a combination from `cap.js`, so the numbers here can never disagree
 * with the numbers on the map (ARCHITECTURE.md boundaries, ADR-0027).
 */

import { combinationCost, feasibility } from '../rules/plan-ahead.js';
import { checkCombination } from '../rules/index.js';
import {
  PRE_FUQUA, TERMS, termsFrom, SUGGESTED_CAPACITY, placementLabel,
} from './placement.js';

const LETTERS = ['A', 'B', 'C'];
export const MAX_SCENARIOS = 3;

/**
 * Courses already placed, per term. Free capacity is the capacity the student set
 * minus what is already there, because a course sitting in Y2 Fall 1 both counts
 * toward the pathways and occupies one of that term's seats. Counting it on one
 * side and not the other is how a planner tells a student something fits when it
 * does not.
 */
export function countByTerm(entries) {
  const counts = {};
  for (const entry of entries) {
    const term = entry.term ?? PRE_FUQUA;
    if (term === PRE_FUQUA) continue;
    counts[term] = (counts[term] ?? 0) + 1;
  }
  return counts;
}

/** Terms from the current one onward, each with the seats still free in it. */
export function remainingTerms(plan) {
  const counts = countByTerm(plan.entries);
  return termsFrom(plan.currentTerm ?? TERMS[1].id).map((term) => {
    const set = plan.capacities?.[term.id];
    const capacity = Number.isInteger(set) ? Math.max(0, set - (counts[term.id] ?? 0)) : null;
    return { id: term.id, term, set, capacity, used: counts[term.id] ?? 0 };
  });
}

/**
 * Cost is a few hundred milliseconds for three scenarios, and `render()` runs on
 * every change that touches the plan. Memoised on the plan contents and the
 * pathways asked about, so re-rendering for an unrelated reason is free and any
 * real change invalidates it.
 */
const cache = new Map();
function costOf(pathwayIds, entries, catalog) {
  const key = `${pathwayIds.join('|')}::${entries.map((e) => e.courseId).sort().join(',')}`;
  if (!cache.has(key)) {
    if (cache.size > 24) cache.clear();
    cache.set(key, combinationCost(pathwayIds, entries, catalog));
  }
  return cache.get(key);
}

/**
 * @param {HTMLElement} host
 * @param {object} ctx - { catalog, plan, state, actions: { persist, rerender, addPlanned } }
 */
export function renderDegree(host, ctx) {
  host.replaceChildren();
  const { plan } = ctx;

  host.appendChild(renderWhereYouAre(ctx));
  if (ctx.state.showCapacity) host.appendChild(renderCapacityEditor(ctx));

  const grid = document.createElement('div');
  grid.className = 'scenario-grid';
  plan.scenarios.forEach((scenario, i) => grid.appendChild(renderScenario(scenario, i, ctx)));

  if (plan.scenarios.length < MAX_SCENARIOS) {
    const add = document.createElement('button');
    add.className = 'ghost add-scenario';
    add.textContent = plan.scenarios.length === 0
      ? 'Compare a combination' : 'Compare another';
    add.addEventListener('click', () => {
      plan.scenarios.push({ name: '', pathwayIds: [] });
      ctx.actions.persist();
    });
    grid.appendChild(add);
  }
  host.appendChild(grid);
}

/* ---------- where you are ---------- */

function renderWhereYouAre(ctx) {
  const { plan } = ctx;
  const remaining = remainingTerms(plan);
  const withCapacity = remaining.filter((t) => Number.isInteger(t.set));
  const short = remaining.length - withCapacity.length;
  const seats = remaining.reduce((n, t) => n + (t.capacity ?? 0), 0);

  const box = document.createElement('div');
  box.className = 'where';

  const now = plan.currentTerm
    ? placementLabel(true, plan.currentTerm, plan.startYear)
    : null;

  const line = document.createElement('p');
  line.className = 'where-line';
  line.textContent = now
    ? `From ${now} onward: ${remaining.length} term${remaining.length === 1 ? '' : 's'} left.`
    : `Whole program: ${remaining.length} terms. Set the term you are in now, next to the program start year, to plan from today instead.`;
  box.appendChild(line);

  const seatLine = document.createElement('p');
  seatLine.className = 'muted';
  seatLine.textContent = withCapacity.length === 0
    ? 'No elective capacity set, so nothing below can say whether a combination fits. Set it per term to get an answer.'
    : `${seats} elective seat${seats === 1 ? '' : 's'} free across ${withCapacity.length} of those terms`
      + (short > 0
        ? `; ${short === 1 ? '1 term has' : `${short} terms have`} no capacity set and count`
          + `${short === 1 ? 's' : ''} for nothing.`
        : '.');
  box.appendChild(seatLine);

  const button = document.createElement('button');
  button.className = 'ghost tiny';
  button.textContent = ctx.state.showCapacity ? 'Done with capacity' : 'Set term capacity';
  button.addEventListener('click', () => {
    ctx.state.showCapacity = !ctx.state.showCapacity;
    ctx.actions.rerender();
  });
  box.appendChild(button);
  return box;
}

/* ---------- capacity ---------- */

function renderCapacityEditor(ctx) {
  const { plan } = ctx;
  const box = document.createElement('div');
  box.className = 'capacity';
  box.insertAdjacentHTML('beforeend',
    '<h3>Elective seats per term</h3>'
    + '<p class="band-note">How many electives you can take in each term. Year 1 is'
    + ' mostly core, so most of the room is in Year 2. Blank means unknown, and an'
    + ' unknown term is never counted as capacity.</p>');

  const grid = document.createElement('div');
  grid.className = 'capacity-grid';
  for (const term of TERMS) {
    if (term.id === PRE_FUQUA) continue;
    const cell = document.createElement('label');
    cell.className = 'capacity-cell';
    const name = document.createElement('span');
    name.className = 'capacity-term';
    name.textContent = `Y${term.year} ${term.short}`;

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.max = '12';
    input.step = '1';
    input.inputMode = 'numeric';
    input.value = Number.isInteger(plan.capacities[term.id])
      ? String(plan.capacities[term.id]) : '';
    input.placeholder = '—';
    input.setAttribute('aria-label', `Elective seats in Year ${term.year} ${term.short}`);
    input.addEventListener('change', () => {
      const n = Number(input.value);
      if (input.value === '' || !Number.isFinite(n)) delete plan.capacities[term.id];
      else plan.capacities[term.id] = Math.max(0, Math.min(12, Math.round(n)));
      ctx.actions.persist();
    });

    cell.append(name, input);
    grid.appendChild(cell);
  }
  box.appendChild(grid);

  const row = document.createElement('div');
  row.className = 'row';
  const fill = document.createElement('button');
  fill.className = 'ghost tiny';
  fill.textContent = "Use Fuqua's typical load";
  fill.title = 'Fills every term with the usual number of electives. Change anything that is wrong for you.';
  fill.addEventListener('click', () => {
    Object.assign(plan.capacities, SUGGESTED_CAPACITY);
    ctx.actions.persist();
  });
  const clear = document.createElement('button');
  clear.className = 'ghost tiny';
  clear.textContent = 'Clear all';
  clear.addEventListener('click', () => {
    plan.capacities = {};
    ctx.actions.persist();
  });
  row.append(fill, clear);
  box.appendChild(row);
  return box;
}

/* ---------- one scenario ---------- */

function renderScenario(scenario, index, ctx) {
  const { catalog, plan } = ctx;
  const card = document.createElement('article');
  card.className = 'scenario';

  const head = document.createElement('header');
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = `Scenario ${LETTERS[index] ?? index + 1}`;
  const drop = document.createElement('button');
  drop.className = 'drop';
  drop.textContent = '×';
  drop.setAttribute('aria-label', `Remove scenario ${LETTERS[index] ?? index + 1}`);
  drop.addEventListener('click', () => {
    plan.scenarios.splice(index, 1);
    ctx.actions.persist();
  });
  head.append(label, drop);
  card.appendChild(head);

  const picks = document.createElement('div');
  picks.className = 'scenario-picks';
  for (const slot of [0, 1]) picks.appendChild(pathwaySelect(scenario, slot, ctx));
  card.appendChild(picks);

  const chosen = scenario.pathwayIds.filter(Boolean);
  if (chosen.length === 0) {
    card.insertAdjacentHTML('beforeend',
      '<p class="muted scenario-empty">Pick one or two specialties to see what they cost together.</p>');
    return card;
  }

  const legality = checkCombination(chosen, catalog);
  if (!legality.ok) {
    for (const problem of legality.problems) card.appendChild(flag(problem, false, 'bad'));
  }

  const cost = costOf(chosen, plan.entries, catalog);
  card.appendChild(renderCost(cost, chosen));
  card.appendChild(renderVerdict(cost, ctx));
  card.appendChild(renderRoute(cost, ctx));
  return card;
}

function pathwaySelect(scenario, slot, ctx) {
  const { catalog } = ctx;
  const select = document.createElement('select');
  select.setAttribute('aria-label', slot === 0 ? 'First specialty' : 'Second specialty');

  const blank = document.createElement('option');
  blank.value = '';
  blank.textContent = slot === 0 ? 'choose a specialty' : 'and nothing else';
  select.appendChild(blank);

  const sorted = [...catalog.pathways].sort((a, b) => a.name.localeCompare(b.name));
  for (const pathway of sorted) {
    const option = document.createElement('option');
    option.value = pathway.id;
    option.textContent = `${pathway.name}${pathway.kind === 'certificate' ? ' ◆' : ''}`;
    option.selected = scenario.pathwayIds[slot] === pathway.id;
    // The same pathway twice is not a combination.
    option.disabled = scenario.pathwayIds[1 - slot] === pathway.id;
    select.appendChild(option);
  }

  select.addEventListener('change', () => {
    const next = [...scenario.pathwayIds];
    next[slot] = select.value;
    scenario.pathwayIds = next.filter(Boolean);
    scenario.name = scenario.pathwayIds
      .map((id) => catalog.pathways.find((p) => p.id === id))
      .filter(Boolean)
      .map((p) => p.shortName ?? p.name)
      .join(' + ');
    ctx.actions.persist();
  });
  return select;
}

function renderCost(cost, chosen) {
  const box = document.createElement('div');
  box.className = 'cost';

  // `complete` means a route exists, not that you are done: only `alreadyComplete`
  // may print "nothing further is needed".
  if (cost.alreadyComplete) {
    box.innerHTML = '<p class="cost-done">Already complete. Nothing further is needed here.</p>';
    return box;
  }
  if (!cost.reachable) {
    box.innerHTML = '<p class="cost-done">No route to finishing this could be found from the courses these pathways list. That is a catalog problem, not a planning one; please report it.</p>';
    return box;
  }

  const figure = document.createElement('p');
  figure.className = 'cost-figure';
  figure.innerHTML = `<span class="big num">${cost.joint}</span>`
    + `<span class="cost-unit">more course${cost.joint === 1 ? '' : 's'}</span>`;
  box.appendChild(figure);

  const detail = document.createElement('p');
  detail.className = 'muted';
  if (chosen.length < 2) {
    detail.textContent = 'From the courses already in your plan.';
  } else if (cost.shared > 0) {
    detail.textContent = `${cost.sumIfSeparate} if you chased them one at a time. `
      + (cost.shared === 1 ? '1 course counts toward both.'
        : `${cost.shared} courses count toward both.`);
  } else {
    detail.textContent = `${cost.sumIfSeparate} separately: these two share nothing, so the pair costs the full sum.`;
  }
  box.appendChild(detail);
  return box;
}

function renderVerdict(cost, ctx) {
  if (cost.alreadyComplete || !cost.reachable) return document.createDocumentFragment();

  const verdict = feasibility(cost, remainingTerms(ctx.plan));
  if (verdict.termsCounted === 0) {
    return flag('No capacity set for any remaining term, so this cannot be checked against your schedule.',
      false, 'unknown');
  }

  const terms = `${verdict.slots} seat${verdict.slots === 1 ? '' : 's'}`
    + ` across ${verdict.termsCounted} term${verdict.termsCounted === 1 ? '' : 's'}`;
  const missing = verdict.termsWithoutCapacity.length;
  const unset = verdict.known ? ''
    : (missing === 1
      ? ' 1 term with no capacity set was not counted.'
      : ` ${missing} terms with no capacity set were not counted.`);

  if (verdict.fits) {
    return flag(`Fits: ${terms}, ${verdict.spare} to spare.${unset}`, true, 'good');
  }
  return flag(`Short by ${Math.abs(verdict.spare)}: needs ${verdict.required}, you have ${terms}.${unset}`,
    false, 'bad');
}

function renderRoute(cost, ctx) {
  const box = document.createElement('div');
  if (cost.courses.length === 0) return box;
  box.className = 'route';

  // Unordered on purpose: these can be taken in any order, and a numbered list
  // would imply a sequence the planner is not claiming.
  const list = document.createElement('ul');
  for (const item of cost.courses) {
    const li = document.createElement('li');
    const text = document.createElement('span');
    text.className = 'grow';
    const serves = item.servesCount > 1 ? ' <span class="serves">counts twice</span>' : '';
    text.innerHTML = `<strong>${escapeHtml(item.course?.code ?? item.courseId)}</strong> `
      + `${escapeHtml(item.course?.title ?? '')}${serves}`;

    const add = document.createElement('button');
    add.className = 'ghost tiny';
    add.textContent = 'Add';
    // Placement policy lives in one place, in main.js, so every Add button in the
    // app agrees about where an unplaced course lands (LESSONS 2026-08-28).
    add.addEventListener('click', () => ctx.actions.addPlanned(item.courseId));

    li.append(text, add);
    list.appendChild(li);
  }
  box.appendChild(list);
  return box;
}

function flag(text, ok, tone) {
  const div = document.createElement('div');
  div.className = `verdict ${tone ?? (ok ? 'good' : 'bad')}`;
  div.textContent = text;
  return div;
}

const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
