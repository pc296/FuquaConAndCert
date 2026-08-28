import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { looksLikePdf } from '../../app/ui/pdf-import.js';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the stylesheet has balanced braces', () => {
  // A rewrite once truncated the last @font-face before its closing brace. The
  // page loaded, fetched the stylesheet, and rendered completely unstyled because
  // the unterminated rule swallowed everything after it. Nothing threw and no
  // request failed, so only a screenshot revealed it (LESSONS 2026-08-28).
  const css = read('../../app/styles/main.css');
  const opens = (css.match(/\{/g) ?? []).length;
  const closes = (css.match(/\}/g) ?? []).length;
  assert.equal(opens, closes, `unbalanced braces: ${opens} open, ${closes} close`);
});

test('every @font-face block is closed and points at a file that exists', () => {
  const css = read('../../app/styles/main.css');
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  assert.equal(blocks.length, 5, `expected 5 closed @font-face blocks, found ${blocks.length}`);
  for (const block of blocks) {
    const file = block.match(/url\('\.\.\/fonts\/([^']+)'\)/)?.[1];
    assert.ok(file, `@font-face with no parseable url: ${block.slice(0, 60)}`);
    assert.ok(existsSync(new URL(`../../app/fonts/${file}`, import.meta.url)),
      `@font-face references a missing file: ${file}`);
  }
});

test('the vendored pdf.js build and its licence are present', () => {
  for (const file of ['pdf.min.mjs', 'pdf.worker.min.mjs', 'LICENSE.txt', 'VERSION.txt']) {
    assert.ok(existsSync(new URL(`../../app/vendor/pdfjs/${file}`, import.meta.url)),
      `missing vendored file: ${file}`);
  }
});

test('pdf.js is imported dynamically, never at module load', () => {
  // The vendored library is 1.7 MB. A static import would put that on every page
  // load for everyone, including the majority who never import a transcript.
  const source = read('../../app/ui/pdf-import.js');
  assert.ok(!/^import .*pdfjs/m.test(source), 'pdf.js must not be statically imported');
  assert.match(source, /import\(PDFJS_URL\)/, 'expected a dynamic import of pdf.js');

  const main = read('../../app/ui/main.js');
  assert.ok(!/vendor\/pdfjs/.test(main), 'main.js must reach pdf.js only through pdf-import.js');
});

test('looksLikePdf accepts PDFs by type or extension and rejects others', () => {
  assert.equal(looksLikePdf({ type: 'application/pdf', name: 'x' }), true);
  assert.equal(looksLikePdf({ type: '', name: 'transcript.PDF' }), true);
  assert.equal(looksLikePdf({ type: 'application/json', name: 'plan.json' }), false);
  assert.equal(looksLikePdf(null), false);
  assert.equal(looksLikePdf(undefined), false);
});

test('the interface says Pathway Map, not Skill Map', () => {
  const html = read('../../index.html');
  assert.match(html, /Pathway Map/);
  assert.ok(!/Skill Map/i.test(html), 'the old name is still in index.html');
});
