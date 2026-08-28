/**
 * The academic specialty cap.
 *
 * A student may earn at most two specialties. The Dual Finance concentration
 * carries slots: 2 and fills the allowance alone (ADR-0017). Per Pat, two
 * certificates is not an allowed combination, which the Fuqua program page
 * contradicts; the rule lives in the catalog so it is one edit to change
 * (ADR-0021).
 */

/**
 * @param {string[]} declaredIds
 * @param {object} catalog
 * @returns {{ok: boolean, slotsUsed: number, maxSlots: number, problems: string[]}}
 */
export function checkCombination(declaredIds, catalog) {
  const rule = catalog.combinationRule ?? { maxSlots: 2, maxCertificates: 1 };
  const declared = declaredIds
    .map((id) => catalog.pathways.find((p) => p.id === id))
    .filter(Boolean);

  const slotsUsed = declared.reduce((sum, p) => sum + (p.slots ?? 1), 0);
  const certificates = declared.filter((p) => p.kind === 'certificate').length;
  const problems = [];

  if (slotsUsed > rule.maxSlots) {
    const dual = declared.find((p) => (p.slots ?? 1) > 1);
    problems.push(
      dual
        ? `${dual.name} counts as ${dual.slots} specialties and fills the allowance on its own.`
        : `That is ${slotsUsed} specialties. The maximum is ${rule.maxSlots}.`,
    );
  }
  if (typeof rule.maxCertificates === 'number' && certificates > rule.maxCertificates) {
    problems.push(
      `${certificates} certificates selected. The maximum is ${rule.maxCertificates}.`,
    );
  }

  return { ok: problems.length === 0, slotsUsed, maxSlots: rule.maxSlots, problems };
}
