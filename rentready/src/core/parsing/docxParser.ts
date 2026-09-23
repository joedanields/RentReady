/** DOCX parsing with mammoth — lazy loaded */

import type { Clause } from '../types.js';
import { LIMITS } from '../limits.js';
import { isClauseStart, extractLabel } from './segmenter.js';

type MammothModule = typeof import('mammoth');

let mammothLib: MammothModule | null = null;

async function loadMammoth(): Promise<MammothModule> {
  if (mammothLib) return mammothLib;
  mammothLib = await import('mammoth');
  return mammothLib;
}

export async function parseDocx(
  file: File
): Promise<{ clauses: Clause[]; rawText: string; pageCount: number }> {
  if (file.size > LIMITS.MAX_FILE_SIZE) throw new Error('TOO_LARGE');

  const mammoth = await loadMammoth();
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });

  const rawText = result.value.trim();
  if (rawText.length > LIMITS.MAX_CHARS) throw new Error('TOO_MANY_CHARS');

  // DOCX has no real pages — treat each blank-line-separated block as a line
  const lines = rawText
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  const clauses: Clause[] = [];
  let order = 0;
  let current = '';
  let label: string | null = null;
  let heading: string | null = null;

  const flush = () => {
    const text = current.trim();
    if (text.length >= 20) {
      clauses.push({
        id: `c${String(++order).padStart(3, '0')}`,
        label,
        heading,
        text,
        page: null,
        pageEnd: null,
        order,
      });
    }
    current = '';
    label = null;
    heading = null;
  };

  for (const line of lines) {
    if (isClauseStart(line) && current.trim()) {
      flush();
      label = extractLabel(line);
      const isHeading = /^[A-Z][A-Z\s]{2,7}$/.test(line) && line.split(/\s+/).length <= 8;
      if (isHeading && !label) heading = line;
      current = line;
    } else {
      current += (current ? '\n' : '') + line;
    }
  }
  flush();

  return {
    clauses,
    rawText,
    pageCount: 1,
  };
}

export function isDocxFile(file: File): boolean {
  return (
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.toLowerCase().endsWith('.docx')
  );
}
