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

test('one import control accepts both transcripts and backups', () => {
  // Two pickers, one of them labelled "Import" and taking only JSON, sent anyone
  // looking for transcript import to the backup restore instead (ADR-0034).
  const html = read('../../index.html');
  const inputs = html.match(/<input type="file"[^>]*>/gs) ?? [];
  assert.equal(inputs.length, 1, `expected exactly one file input, found ${inputs.length}`);
  assert.match(inputs[0], /accept="[^"]*application\/pdf/, 'the import control must accept PDFs');
  assert.match(inputs[0], /accept="[^"]*json/, 'the import control must accept backups too');
  assert.match(html, /id="import-btn">Import transcript</, 'the button must say what it imports');
});

test('every identifier the UI imports actually exists in the module it names', () => {
  // renderGroupOptions kept calling normalizeQuarter after that helper was renamed.
  // Nothing failed until a person clicked Add, because an undefined reference in a
  // click handler is invisible until the click. This walks every named import in
  // app/ui and app/rules and checks the source module exports it.
  const files = [
    'app/ui/main.js', 'app/ui/report.js', 'app/ui/parse-transcript.js',
    'app/ui/parse-paste.js', 'app/ui/map.js', 'app/ui/degree.js',
    'app/storage/plan.js', 'app/rules/index.js', 'app/rules/plan-ahead.js',
  ];
  for (const file of files) {
    const source = read(`../../${file}`);
    const dir = file.slice(0, file.lastIndexOf('/'));
    for (const m of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)) {
      const names = m[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0]).filter(Boolean);
      const target = new URL(`../../${dir}/${m[2]}`, import.meta.url);
      const targetSource = readFileSync(target, 'utf8');
      for (const name of names) {
        const exported = new RegExp(
          `export\\s+(?:async\\s+)?(?:function|const|let|class)\\s+${name}\\b|` +
          `export\\s*\\{[^}]*\\b${name}\\b[^}]*\\}`,
        ).test(targetSource);
        assert.ok(exported, `${file} imports ${name} from ${m[2]}, which does not export it`);
      }
    }
  }
});

test('no call site passes a bare number where a term id belongs', () => {
  // Shortest-way Add passed the integer 1 after terms became strings, so it silently
  // placed courses in the Pre-Fuqua bucket instead of the term it named.
  const source = read('../../app/ui/main.js');
  const calls = [...source.matchAll(/addCourse\(([^)]*)\)/g)].map((m) => m[1]);
  for (const args of calls) {
    assert.ok(!/,\s*\d+\s*$/.test(args),
      `addCourse called with a numeric term: addCourse(${args})`);
  }
});

test('the removed quarter helpers are gone from the UI', () => {
  for (const file of ['app/ui/main.js', 'app/ui/report.js']) {
    const source = read(`../../${file}`);
    assert.ok(!/normalizeQuarter|TERM_LABELS|SEMESTERS\b/.test(source),
      `${file} still references a helper removed in ADR-0035`);
  }
});

test('every element main.js reaches for by id exists in index.html', () => {
  // The degree view is three new controls in two files. A control the script
  // looks up and the markup never declares fails as `null.replaceChildren`, at
  // startup, before anything renders — the same silent-dead-page shape as the
  // TDZ bug and the renamed-helper bug. Cheap to check, so check it.
  const source = read('../../app/ui/main.js');
  const html = read('../../index.html');
  const ids = new Set([...source.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size > 10, `expected many id lookups, found ${ids.size}`);
  for (const id of ids) {
    assert.ok(html.includes(`id="${id}"`), `main.js reads #${id}, which index.html does not declare`);
  }
});

test('the degree panel is wired to the module that fills it', () => {
  const source = read('../../app/ui/main.js');
  assert.match(source, /renderDegree\(\$\('degree'\)/,
    'render() must fill the degree panel, or it stays permanently empty');
});
