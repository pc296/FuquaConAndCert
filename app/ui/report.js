/**
 * The printable progress report (ADR-0031).
 *
 * Builds a complete standalone HTML document as a string; the caller opens it in
 * a new window and invokes the browser's print dialog, which is how it becomes a
 * PDF with zero dependencies. Everything is inline so the document survives being
 * saved or printed on its own.
 */

import { STATUS } from '../rules/index.js';
import { PRE_FUQUA, PRE_FUQUA_LABEL, SEMESTERS, TERM_LABELS } from './placement.js';

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const STATUS_LABEL = {
  [STATUS.COMPLETE]: 'Complete',
  [STATUS.IN_PROGRESS]: 'In progress',
  [STATUS.NOT_STARTED]: 'Not started',
};

export function buildReportHtml(catalog, plan, results, capCheck) {
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  const declared = plan.declared
    .map((id) => catalog.pathways.find((p) => p.id === id))
    .filter(Boolean);

  const held = new Set(plan.entries.map((e) => e.courseId));
  const coreHave = catalog.coreCourses.filter((c) => held.has(c.id)).length;

  const active = results
    .filter((r) => r.status !== STATUS.NOT_STARTED)
    .sort((a, b) => b.percent - a.percent);

  const rows = active.map((r) => `
    <tr>
      <td>${esc(r.shortName)}${r.kind === 'certificate' ? ' <span class="cert">◆</span>' : ''}</td>
      <td>${STATUS_LABEL[r.status]}</td>
      <td class="num">${r.percent}%</td>
      <td class="num">${r.totals.courses}</td>
      <td class="num">${r.totals.credits}</td>
    </tr>`).join('');

  const detailBlocks = active
    .filter((r) => plan.declared.includes(r.pathwayId) || r.status === STATUS.COMPLETE)
    .map((r) => {
      const groups = r.groups.map((g) => {
        const codes = g.assigned.map((id) => catalog.courses.get(id)?.code ?? id);
        return `<li><strong>${esc(g.label)}</strong>: ${g.have} of ${g.min} ${g.unit}` +
          `${g.satisfied ? '' : ' — <em>not yet met</em>'}` +
          `${codes.length ? `<br><span class="codes">${codes.map(esc).join(', ')}</span>` : ''}</li>`;
      }).join('');
      return `<section class="pathway">
        <h3>${esc(r.name)} <span class="pct">${r.percent}%</span></h3>
        <ul>${groups}</ul>
      </section>`;
    }).join('');

  const planRows = [];
  const entriesAt = (predicate) => plan.entries.filter(predicate);
  const line = (label, entries) => {
    if (entries.length === 0) return;
    const cells = entries.map((e) => {
      const c = catalog.courses.get(e.courseId);
      const grade = typeof e.gradePoints === 'number' ? ` (${e.gradePoints.toFixed(1)})` : '';
      return `${esc(c?.code ?? e.courseId)}${grade}`;
    }).join(', ');
    planRows.push(`<tr><td class="when">${esc(label)}</td><td>${cells}</td></tr>`);
  };
  line(PRE_FUQUA_LABEL, entriesAt((e) => e.quarter === PRE_FUQUA));
  for (const s of SEMESTERS) {
    line(`${s.label} (semester)`, entriesAt((e) =>
      e.quarter === s.start && catalog.courses.get(e.courseId)?.isFuqua === false));
    for (const q of s.quarters) {
      line(`${s.label.split(' · ')[0]} ${TERM_LABELS[q]}`, entriesAt((e) =>
        e.quarter === q && catalog.courses.get(e.courseId)?.isFuqua !== false));
    }
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Fuqua ConCert Progress Report</title>
<style>
  @page { margin: 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #262626; margin: 0; font-size: 12.5pt; line-height: 1.45; }
  header { border-bottom: 3px solid #012169; padding-bottom: 10px; margin-bottom: 18px; }
  h1 { font-size: 21pt; margin: 0; color: #012169; }
  h2 { font-size: 13pt; color: #012169; border-bottom: 1.5px solid #00539B; padding-bottom: 3px; margin: 22px 0 8px; }
  h3 { font-size: 11.5pt; margin: 14px 0 4px; }
  .meta { color: #666; font-size: 10pt; margin-top: 3px; }
  table { border-collapse: collapse; width: 100%; font-size: 10.5pt; }
  th { text-align: left; border-bottom: 1.5px solid #012169; padding: 4px 8px 4px 0; }
  td { border-bottom: 0.75px solid #ccc; padding: 4px 8px 4px 0; vertical-align: top; }
  td.num { text-align: right; width: 60px; }
  td.when { width: 190px; font-weight: bold; }
  .cert { color: #B8860B; }
  .pct { font-weight: normal; color: #00539B; font-size: 10pt; }
  .codes { color: #444; font-size: 9.5pt; }
  ul { margin: 4px 0 4px 18px; padding: 0; }
  li { margin-bottom: 3px; }
  .pathway { break-inside: avoid; }
  .declared { margin: 4px 0; }
  .disclaimer { margin-top: 26px; padding-top: 8px; border-top: 0.75px solid #999; color: #555; font-size: 9pt; }
  em { color: #C84E00; font-style: normal; font-weight: bold; }
</style>
</head>
<body>
<header>
  <h1>Fuqua ConCert — Progress Report</h1>
  <p class="meta">Generated ${esc(date)} · ${plan.entries.length} courses recorded · requirements retrieved ${esc(catalog.retrieved)}</p>
</header>

<h2>Declared Specialties</h2>
<p class="declared">${declared.length
    ? declared.map((p) => `<strong>${esc(p.shortName ?? p.name)}</strong>${(p.slots ?? 1) > 1 ? ' (counts as 2)' : ''}`).join(' · ')
    : 'None declared yet.'}
  &nbsp;— ${capCheck.slotsUsed} of ${capCheck.maxSlots} specialty slots used${capCheck.ok ? '' : '. <em>Exceeds the allowed combination.</em>'}</p>
<p class="declared">Core curriculum: ${coreHave} of ${catalog.coreCourses.length} courses recorded.</p>

<h2>Progress Across All Pathways</h2>
${active.length ? `<table>
  <tr><th>Pathway</th><th>Status</th><th>Progress</th><th>Courses</th><th>Credits</th></tr>
  ${rows}
</table>` : '<p>No coursework recorded yet.</p>'}

${detailBlocks ? `<h2>Requirement Detail — Declared and Completed</h2>${detailBlocks}` : ''}

<h2>Course Plan</h2>
${planRows.length ? `<table>${planRows.join('')}</table>` : '<p>No courses placed.</p>'}

<p class="disclaimer">Fuqua ConCert is an unofficial planning aid. The Fuqua registrar is the authority
on degree requirements and on what has been earned. Requirements were transcribed from FuquaWorld pages
and may be out of date; confirm anything consequential with academic advising.</p>

<script>window.addEventListener('load', () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;
}
