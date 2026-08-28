/**
 * The Pathway Map. SVG built with plain DOM calls from hand-authored coordinates
 * (ADR-0010). Contains no requirement logic: it renders whatever the rule engine
 * returns.
 */

const NS = 'http://www.w3.org/2000/svg';
const R = 30; // hex radius
const RING = 37;

const el = (name, attrs = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
};

const hexPoints = (cx, cy, r) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');

const arcPath = (cx, cy, r, fraction) => {
  const f = Math.max(0, Math.min(0.9999, fraction));
  const end = -Math.PI / 2 + f * 2 * Math.PI;
  const large = f > 0.5 ? 1 : 0;
  return `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${(cx + r * Math.cos(end)).toFixed(2)} ${(cy + r * Math.sin(end)).toFixed(2)}`;
};

/** Wrap a pathway name onto at most two lines so labels stay legible. */
function labelLines(name) {
  const words = name.split(' ');
  if (words.length < 3) return [name];
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' '), words.slice(mid).join(' ')];
}

export function renderMap(svg, layout, results, state, onSelect) {
  svg.setAttribute('viewBox', layout.viewBox);
  svg.replaceChildren();

  const byId = new Map(results.map((r) => [r.pathwayId, r]));
  const anchors = new Map(layout.anchors.map((a) => [a.id, a]));

  const links = el('g');
  for (const anchor of layout.anchors) {
    links.appendChild(el('line', {
      class: 'link', x1: layout.center.x, y1: layout.center.y, x2: anchor.x, y2: anchor.y,
    }));
  }
  for (const node of layout.nodes) {
    const anchor = anchors.get(node.anchor);
    const result = byId.get(node.id);
    const lit = result && result.status !== 'not-started';
    links.appendChild(el('line', {
      class: `link${lit ? ' lit' : ''}`, x1: anchor.x, y1: anchor.y, x2: node.x, y2: node.y,
    }));
  }
  svg.appendChild(links);

  for (const anchor of layout.anchors) {
    svg.appendChild(el('circle', { class: 'anchor-dot', cx: anchor.x, cy: anchor.y, r: 4 }));
  }

  svg.appendChild(el('circle', { class: 'core', cx: layout.center.x, cy: layout.center.y, r: 38 }));
  const coreLabel = el('text', { class: 'core-label', x: layout.center.x, y: layout.center.y - 2 });
  coreLabel.textContent = 'Daytime';
  svg.appendChild(coreLabel);
  const coreLabel2 = el('text', { class: 'core-label', x: layout.center.x, y: layout.center.y + 14 });
  coreLabel2.textContent = 'MBA Core';
  svg.appendChild(coreLabel2);

  for (const node of layout.nodes) {
    const result = byId.get(node.id);
    if (!result) continue;
    const group = el('g', { tabindex: '0', role: 'button' });
    group.setAttribute('aria-label',
      `${result.name}, ${result.status.replace('-', ' ')}, ${result.percent} percent`);

    const blocked = state.blocked.has(node.id);
    const classes = ['node-hex', blocked ? 'capped' : result.status];
    if (state.selected === node.id) classes.push('selected');
    group.appendChild(el('polygon', { class: classes.join(' '), points: hexPoints(node.x, node.y, R) }));

    group.appendChild(el('path', { class: 'ring-track', d: arcPath(node.x, node.y, RING, 0.9999) }));
    if (result.percent > 0) {
      group.appendChild(el('path', {
        class: `ring-fill${result.status === 'complete' ? ' complete' : ''}`,
        d: arcPath(node.x, node.y, RING, result.percent / 100),
      }));
    }

    const pct = el('text', { class: 'node-pct', x: node.x, y: node.y + 4 });
    pct.textContent = result.status === 'complete' ? '✓' : `${result.percent}%`;
    group.appendChild(pct);

    if (result.kind === 'certificate') {
      const mark = el('text', { class: 'cert-mark', x: node.x, y: node.y - 14 });
      mark.textContent = '◆';
      group.appendChild(mark);
    }

    const lines = labelLines(result.shortName);
    lines.forEach((line, i) => {
      const text = el('text', { class: 'node-label', x: node.x, y: node.y + RING + 14 + i * 12 });
      text.textContent = line;
      group.appendChild(text);
    });

    const select = () => onSelect(node.id);
    group.addEventListener('click', select);
    group.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(); }
    });
    svg.appendChild(group);
  }
}
