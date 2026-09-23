/** DOCX parsing with mammoth — lazy loaded (via intake.parseFile). DOCX has no pages. */

import { segmentClauses } from './segmenter.js';
import { IntakeError, checkTextLength, type ParsedDocument } from './intake.js';

type MammothModule = typeof import('mammoth');

let mammothLib: MammothModule | null = null;

async function loadMammoth(): Promise<MammothModule> {
  if (mammothLib) return mammothLib;
  mammothLib = await import('mammoth');
  return mammothLib;
}

export async function parseDocx(file: File): Promise<ParsedDocument> {
  const mammoth = await loadMammoth();
  let rawText: string;
  try {
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    rawText = result.value.trim();
  } catch {
    throw new IntakeError('PARSE_FAILED');
  }
  if (!rawText) throw new IntakeError('EMPTY_TEXT');
  checkTextLength(rawText);
  // Same segmenter as PDF and paste, so clause rules (merging, splitting, headings) match.
  return { clauses: segmentClauses(rawText), rawText, pageCount: 0 };
}
