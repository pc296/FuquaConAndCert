/**
 * Within-pathway course allocation.
 *
 * Across pathways a course counts everywhere it appears (ADR-0018). Within a single
 * pathway it does not: Strategy's third group explicitly accepts surplus from its
 * first group, so letting one course satisfy both would hand out the concentration
 * for four courses instead of six. Allocation assigns each course to at most one
 * group and asks whether every group minimum can be met simultaneously.
 *
 * Exact search with memoization, most-constrained course first, and a node budget.
 * If the budget is exhausted the greedy result is returned with approximate: true,
 * so a caller can tell a proven answer from a probable one.
 */

const NODE_BUDGET = 200000;

/** Credits are stored in half-credit units so demands stay integers. */
const units = (credits) => Math.round(credits * 2);

/**
 * @param {Array<{id: string, type: string, min: number, cap?: number}>} groups
 *   Demand groups. `cap` limits how many units this group may draw from capped
 *   courses (used for the Energy Finance overflow clause).
 * @param {Array<{key: string, credits: number, groups: string[], capped?: string[]}>} items
 *   One entry per planned course that is eligible for at least one group.
 * @returns {{feasible: boolean, assignment: Object<string, string[]>, approximate: boolean}}
 */
export function allocate(groups, items) {
  const demand = new Map();
  for (const g of groups) {
    demand.set(g.id, g.type === 'credits' ? units(g.min) : g.min);
  }
  const capLimit = new Map();
  for (const g of groups) {
    if (typeof g.cap === 'number') capLimit.set(g.id, g.cap);
  }
  const groupType = new Map(groups.map((g) => [g.id, g.type]));

  // Most constrained first: a course eligible for one group has no real choice.
  const ordered = [...items].sort((a, b) => a.groups.length - b.groups.length);

  const best = { filled: -1, assignment: null };
  let nodes = 0;
  const seen = new Set();

  const remainingKey = (i, remaining, caps) =>
    `${i}|${groups.map((g) => remaining.get(g.id)).join(',')}|${groups
      .map((g) => caps.get(g.id) ?? '')
      .join(',')}`;

  const totalRemaining = (remaining) => {
    let sum = 0;
    for (const v of remaining.values()) sum += v;
    return sum;
  };

  /** @returns {boolean} true when every demand reached zero. */
  function search(i, remaining, caps, assignment) {
    if (totalRemaining(remaining) === 0) {
      best.assignment = cloneAssignment(assignment);
      best.filled = Infinity;
      return true;
    }
    if (i >= ordered.length || nodes++ > NODE_BUDGET) {
      const filled = scoreFilled(demand, remaining);
      if (filled > best.filled) {
        best.filled = filled;
        best.assignment = cloneAssignment(assignment);
      }
      return false;
    }
    const key = remainingKey(i, remaining, caps);
    if (seen.has(key)) return false;
    seen.add(key);

    const item = ordered[i];
    // Try the neediest group first; it is the likeliest to matter.
    const candidates = [...item.groups].sort(
      (a, b) => (remaining.get(b) ?? 0) - (remaining.get(a) ?? 0),
    );
    for (const groupId of candidates) {
      const need = remaining.get(groupId) ?? 0;
      if (need === 0) continue;
      const isCapped = item.capped?.includes(groupId);
      const capLeft = caps.get(groupId);
      if (isCapped && typeof capLeft === 'number' && capLeft <= 0) continue;

      const cost = groupType.get(groupId) === 'credits' ? units(item.credits) : 1;
      remaining.set(groupId, Math.max(0, need - cost));
      if (isCapped && typeof capLeft === 'number') caps.set(groupId, capLeft - 1);
      (assignment[groupId] ||= []).push(item.key);

      if (search(i + 1, remaining, caps, assignment)) return true;

      assignment[groupId].pop();
      if (isCapped && typeof capLeft === 'number') caps.set(groupId, capLeft);
      remaining.set(groupId, need);
    }
    // Leaving the course unassigned is a real option: it may be surplus.
    return search(i + 1, remaining, caps, assignment);
  }

  const remaining = new Map(demand);
  const caps = new Map(capLimit);
  const feasible = search(0, remaining, caps, {});
  return {
    feasible,
    assignment: best.assignment ?? {},
    approximate: !feasible && nodes > NODE_BUDGET,
  };
}

function cloneAssignment(assignment) {
  const out = {};
  for (const [k, v] of Object.entries(assignment)) out[k] = [...v];
  return out;
}

function scoreFilled(demand, remaining) {
  let filled = 0;
  for (const [id, want] of demand) filled += want - (remaining.get(id) ?? 0);
  return filled;
}
