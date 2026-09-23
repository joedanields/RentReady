/** PDF parsing with pdf.js — lazy loaded (via intake.parseFile), page tracking. */

import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import { LIMITS } from '../limits.js';
import { segmentClauses } from './segmenter.js';
import { IntakeError, checkTextLength, type ParsedDocument } from './intake.js';

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsLib: PdfJsModule | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (pdfjsLib) return pdfjsLib;
  const pdfjs = await import('pdfjs-dist');
  // Worker served from our own origin (CSP worker-src 'self').
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  pdfjsLib = pdfjs;
  return pdfjsLib;
}

/** Below this many characters per page on average, the PDF is treated as a scan. */
const SCANNED_CHARS_PER_PAGE = 100;

/** Rebuild lines from text items using hasEOL and y-gaps */
function rebuildLines(items: TextItem[]): string[] {
  const lines: string[] = [];
  let current = '';
  let currentY = 0;
  let started = false;

  const flush = () => {
    const text = current.trim();
    if (text) lines.push(text);
    current = '';
  };

  for (const item of items) {
    const y = item.transform?.[5] ?? 0;
    if (started && current && Math.abs(y - currentY) > 5) flush();
    current +=
      (current && !item.str.startsWith(' ') && !current.endsWith(' ') ? ' ' : '') + item.str;
    if (item.hasEOL) flush();
    started = true;
    currentY = y;
  }
  flush();
  return lines;
}

export async function parsePdf(file: File): Promise<ParsedDocument> {
  const pdfjs = await loadPdfJs();
  const data = new Uint8Array(await file.arrayBuffer());

  let pdf: Awaited<ReturnType<PdfJsModule['getDocument']>['promise']>;
  try {
    pdf = await pdfjs.getDocument({ data }).promise;
  } catch {
    // Damaged, truncated or password-protected: pdf.js' own message isn't user-facing.
    throw new IntakeError('PARSE_FAILED');
  }

  if (pdf.numPages > LIMITS.MAX_PAGES) {
    throw new IntakeError('TOO_MANY_PAGES', { pages: pdf.numPages, max: LIMITS.MAX_PAGES });
  }

  const pageTexts: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter(
      (item): item is TextItem => 'str' in item && typeof item.str === 'string'
    );
    pageTexts.push(rebuildLines(items).join('\n'));
  }

  const totalChars = pageTexts.reduce((n, t) => n + t.length, 0);
  if (totalChars < SCANNED_CHARS_PER_PAGE * pdf.numPages) throw new IntakeError('SCANNED_PDF');
  const rawText = pageTexts.join('\n\n');
  checkTextLength(rawText);

  return { clauses: segmentClauses(rawText, pageTexts), rawText, pageCount: pdf.numPages };
}
