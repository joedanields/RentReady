/**
 * Document intake: the one entry point from "user picked a file / pasted text" to clauses.
 * Guards run before any parser touches the bytes (SECURITY.md §3: malicious or huge files):
 * size first, then magic bytes that must agree with the extension, then page and character caps.
 * Failures are typed `IntakeError`s so the UI can show a specific, fixable message.
 */

import type { Clause } from '../types.js';
import { LIMITS } from '../limits.js';
import { segmentClauses } from './segmenter.js';

export type IntakeErrorCode =
  | 'INVALID_FILE'
  | 'TOO_LARGE'
  | 'TOO_MANY_PAGES'
  | 'TOO_MANY_CHARS'
  | 'SCANNED_PDF'
  | 'EMPTY_TEXT'
  | 'PARSE_FAILED';

export class IntakeError extends Error {
  constructor(
    readonly code: IntakeErrorCode,
    readonly detail: Readonly<Record<string, number>> = {}
  ) {
    super(code);
    this.name = 'IntakeError';
  }
}

export interface ParsedDocument {
  clauses: Clause[];
  rawText: string;
  /** Real pages for PDFs; 0 when the source has no pages (DOCX, pasted text). */
  pageCount: number;
}

export type FileKind = 'pdf' | 'docx';

const MB = 1024 * 1024;

/** Rejects files over the size cap before anything reads them. */
export function checkFileSize(size: number): void {
  if (size > LIMITS.MAX_FILE_SIZE) {
    throw new IntakeError('TOO_LARGE', { mb: Math.ceil((size / MB) * 10) / 10 });
  }
}

/**
 * Decides what a file really is from its first bytes, not its name: `%PDF` for PDF, `PK\x03\x04`
 * (a zip) for DOCX. The extension must agree too, so a renamed .exe, a plain .zip, or a PDF
 * renamed .docx are all refused before a parser sees them.
 */
export function detectFileKind(name: string, head: Uint8Array): FileKind | null {
  const lower = name.toLowerCase();
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46;
  const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  if (isPdf && lower.endsWith('.pdf')) return 'pdf';
  if (isZip && lower.endsWith('.docx')) return 'docx';
  return null;
}

/** Character cap shared by every path (PDF, DOCX, paste). */
export function checkTextLength(text: string): void {
  if (text.length > LIMITS.MAX_CHARS) {
    throw new IntakeError('TOO_MANY_CHARS', { chars: text.length, max: LIMITS.MAX_CHARS });
  }
}

/** Pasted text → clauses. No pages, so clauses carry `page: null`. */
export function parsePastedText(text: string): ParsedDocument {
  const trimmed = text.trim();
  if (!trimmed) throw new IntakeError('EMPTY_TEXT');
  checkTextLength(trimmed);
  const clauses = segmentClauses(trimmed);
  if (clauses.length === 0) throw new IntakeError('EMPTY_TEXT');
  return { clauses, rawText: trimmed, pageCount: 0 };
}

/**
 * Parses a user-chosen file. The heavy parsers are dynamic imports, so pdf.js and mammoth are
 * only downloaded once someone actually picks a file of that type.
 */
export async function parseFile(file: File): Promise<ParsedDocument> {
  checkFileSize(file.size);
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer());
  const kind = detectFileKind(file.name, head);
  if (kind === null) throw new IntakeError('INVALID_FILE');
  if (kind === 'pdf') {
    const { parsePdf } = await import('./pdfParser.js');
    return parsePdf(file);
  }
  const { parseDocx } = await import('./docxParser.js');
  return parseDocx(file);
}
