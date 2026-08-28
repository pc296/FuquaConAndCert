/**
 * Transcript PDF import (ADR-0033).
 *
 * Reads the text layer of a PDF and returns it as plain text for parse-paste.js
 * to interpret. This is deterministic text extraction, not OCR and not a model:
 * a text-based PDF already carries its characters as data, and this reads them.
 * That distinction is why it does not conflict with ADR-0012, which ruled out
 * pixel-reading and AI in the input path.
 *
 * pdf.js is 1.7 MB and is imported dynamically, so nothing downloads until a
 * user actually picks a PDF.
 *
 * Everything it finds still goes through the confirmation screen. Extraction
 * proposes; the student confirms.
 */

const PDFJS_URL = new URL('../vendor/pdfjs/pdf.min.mjs', import.meta.url).href;
const WORKER_URL = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;

let pdfjsPromise = null;

/** Load pdf.js once, on first use. */
function loadPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import(PDFJS_URL).then((lib) => {
      lib.GlobalWorkerOptions.workerSrc = WORKER_URL;
      return lib;
    });
  }
  return pdfjsPromise;
}

/**
 * A scanned transcript has pages but no text layer. Extraction cannot recover it
 * and OCR is deliberately out of scope, so this threshold decides when to tell
 * the user plainly rather than hand back an empty result that looks like "no
 * courses found".
 */
const MIN_CHARS_PER_PAGE = 40;

/**
 * @param {File|Blob} file
 * @returns {Promise<{text: string, pages: number, chars: number}>}
 * @throws {Error} when the file is not a readable PDF, or carries no text layer.
 */
export async function extractPdfText(file) {
  const pdfjs = await loadPdfjs();

  let doc;
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  } catch (cause) {
    throw new Error(
      `That file could not be opened as a PDF (${cause?.message ?? 'unknown error'}). ` +
      'If it is password protected, remove the protection or copy the text and paste it instead.',
    );
  }

  const pages = [];
  try {
    for (let n = 1; n <= doc.numPages; n += 1) {
      const page = await doc.getPage(n);
      const content = await page.getTextContent();
      // Join items with spaces and end each page with a newline. Course codes and
      // titles sit in separate text items, so the spaces matter for the parser.
      pages.push(content.items.map((item) => item.str ?? '').join(' '));
    }
  } finally {
    await doc.destroy?.();
  }

  const text = pages.join('\n');
  const chars = text.replace(/\s/g, '').length;

  if (chars < MIN_CHARS_PER_PAGE * doc.numPages) {
    throw new Error(
      `This PDF has ${doc.numPages} page${doc.numPages === 1 ? '' : 's'} but almost no ` +
      'selectable text, which usually means it is a scan or an image. Reading scanned ' +
      'documents needs OCR, which this tool deliberately does not do because misread ' +
      'course codes look correct. Try an unofficial transcript downloaded from DukeHub, ' +
      'or paste the text instead.',
    );
  }

  return { text, pages: doc.numPages, chars };
}

/** True for anything worth trying to read as a PDF. */
export const looksLikePdf = (file) =>
  file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name ?? '');
