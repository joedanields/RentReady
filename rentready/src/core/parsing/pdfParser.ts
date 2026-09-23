/** PDF parsing with pdf.js — lazy loaded, page tracking */

import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';
import type { Clause } from '../types.js';
import { LIMITS } from '../limits.js';
import { segmentClauses } from './segmenter.js';

type PdfJsModule = typeof import('pdfjs-dist');

let pdfjsLib: PdfJsModule | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (pdfjsLib) return pdfjsLib;
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  pdfjsLib = pdfjs;
  return pdfjsLib;
}

interface PageLine {
  text: string;
  y: number;
}

/** Rebuild lines from text items using hasEOL and y-gaps */
function rebuildLines(items: TextItem[]): PageLine[] {
  const lines: PageLine[] = [];
  let current = '';
  let currentY = 0;
  let started = false;

  const flush = (y: number) => {
    const text = current.trim();
    if (text) lines.push({ text, y });
    current = '';
  };

  for (const item of items) {
    const y = item.transform?.[5] ?? 0;
    if (started && current && Math.abs(y - currentY) > 5) flush(currentY);
    current += (current && !item.str.startsWith(' ') && !current.endsWith(' ') ? ' ' : '') + item.str;
    if (item.hasEOL) flush(y);
    started = true;
    currentY = y;
  }
  flush(currentY);
  return lines;
}

export async function parsePdf(
  file: File
): Promise<{ clauses: Clause[]; rawText: string; pageCount: number }> {
  if (file.size > LIMITS.MAX_FILE_SIZE) throw new Error('TOO_LARGE');

  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;

  if (pdf.numPages > LIMITS.MAX_PAGES) throw new Error('TOO_MANY_PAGES');

  const pageTexts: string[] = [];
  let totalChars = 0;

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const items = content.items.filter(
      (item): item is TextItem => 'str' in item && typeof item.str === 'string'
    );
    const pageText = rebuildLines(items)
      .map(l => l.text)
      .join('\n');
    pageTexts.push(pageText);
    totalChars += pageText.length;
  }

  if (totalChars < 100 * pdf.numPages) throw new Error('SCANNED_PDF');
  if (totalChars > LIMITS.MAX_CHARS) throw new Error('TOO_MANY_CHARS');

  const clauses = segmentClauses(pageTexts.join('\n'), pageTexts);

  return {
    clauses,
    rawText: pageTexts.map((t, i) => `\n--- PAGE ${i + 1} ---\n` + t).join(''),
    pageCount: pdf.numPages
  };
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Magic-byte sniffing for PDF (and DOCX/zip) */
export function sniffMagicBytes(bytes: Uint8Array): 'pdf' | 'zip' | 'unknown' {
  if (bytes.length < 4) return 'unknown';
  if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'zip';
  return 'unknown';
}