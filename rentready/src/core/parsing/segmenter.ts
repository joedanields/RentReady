/** Clause segmenter — pure functions, 100% tested */

import type { Clause } from '../types.js';

const CLAUSE_START_PATTERNS: RegExp[] = [
  /^\s*\d+(\.\d+){0,3}[.)]?\s+\S/, // 1.  1.1.1  2) followed by text
  /^(Clause|Article|Section|Schedule|Annexure|Annex)\s+\d+/i,
  /^\(?[a-z]\)\s/, // (a)  a)
  /^\(?[ivx]{1,4}\)\s/i, // (i) (iv)
  /^[A-Z][A-Z\s]{2,7}$/, // ALL-CAPS heading <= 8 words
];

const SCHEDULE_PATTERNS: RegExp[] = [
  /^schedule\s+[a-z0-9]/i,
  /^annexure\s+[a-z0-9]/i,
  /^annex\s+[a-z0-9]/i,
];

/** Check if a line starts a new clause */
export function isClauseStart(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (SCHEDULE_PATTERNS.some(p => p.test(trimmed))) return true;
  return CLAUSE_START_PATTERNS.some(p => p.test(trimmed));
}

/** Extract a compact label from a clause-start line, or null */
export function extractLabel(line: string): string | null {
  const trimmed = line.trim();

  const num = trimmed.match(/^(\d+(?:\.\d+){0,3})[.)]?\s/);
  if (num) return num[1]!;

  const named = trimmed.match(
    /^(?:Clause|Article|Section|Schedule|Annexure|Annex)\s+(\d+(?:\.\d+)?)/i
  );
  if (named) return named[1]!;

  const letter = trimmed.match(/^\(?([a-z])\)\s/);
  if (letter) return letter[1]!;

  const roman = trimmed.match(/^\(?([ivx]{1,4})\)\s/i);
  if (roman) return roman[1]!.toLowerCase();

  return null;
}

const isAllCapsHeading = (line: string): boolean =>
  /^[A-Z][A-Z\s]{2,7}$/.test(line.trim()) && line.trim().split(/\s+/).length <= 8;

/** Split text at sentence boundaries near maxLen */
function splitAtSentences(text: string, maxLen: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const parts: string[] = [];
  let current = '';

  for (const s of sentences) {
    if (current.length + s.length > maxLen && current.length > 0) {
      parts.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts.length > 0 ? parts : [text];
}

/**
 * Segment raw agreement text into clauses.
 * `pageTexts` (optional) allows page tracking.
 */
export function segmentClauses(rawText: string, pageTexts: string[] = []): Clause[] {
  const lines: Array<{ text: string; page: number | null }> = [];

  if (pageTexts.length > 0) {
    pageTexts.forEach((pt, i) => {
      pt.split('\n').forEach(l => lines.push({ text: l, page: i + 1 }));
    });
  } else {
    rawText.split(/\r?\n/).forEach(l => lines.push({ text: l, page: null }));
  }

  interface RawClauseData {
    label: string | null;
    heading: string | null;
    text: string;
    page: number | null;
  }

  const rawClauses: RawClauseData[] = [];
  let current: RawClauseData | null = null;

  const pushLine = (
    line: string,
    page: number | null,
    prev: RawClauseData | null
  ): RawClauseData | null => {
    const trimmed = line.trim();
    if (isClauseStart(trimmed) && prev && prev.text.trim()) {
      rawClauses.push(prev);
      return isAllCapsHeading(trimmed)
        ? { label: null, heading: trimmed, text: trimmed, page }
        : { label: extractLabel(trimmed), heading: null, text: trimmed, page };
    }
    if (prev) {
      return { ...prev, text: prev.text + '\n' + trimmed };
    }
    return isAllCapsHeading(trimmed)
      ? { label: null, heading: trimmed, text: trimmed, page }
      : { label: extractLabel(trimmed), heading: null, text: trimmed, page };
  };

  for (const { text, page } of lines) {
    if (!text.trim()) continue;
    current = pushLine(text, page, current);
  }
  if (current && current.text.trim()) rawClauses.push(current);

  // Merge/split to sane lengths, assign stable ids
  const clauses: Clause[] = [];
  let buffer = '';
  let bufferMeta: { label: string | null; heading: string | null; page: number | null } = {
    label: null,
    heading: null,
    page: null,
  };
  let order = 0;

  const emit = () => {
    const text = buffer.trim();
    if (text.length < 20) return;
    const parts = text.length > 2000 ? splitAtSentences(text, 2000) : [text];
    for (const part of parts) {
      clauses.push({
        id: `c${String(++order).padStart(3, '0')}`,
        label: bufferMeta.label,
        heading: bufferMeta.heading,
        text: part,
        page: bufferMeta.page,
        pageEnd: bufferMeta.page,
        order,
      });
    }
  };

  for (const rc of rawClauses) {
    const metaChanged = bufferMeta.label !== rc.label || bufferMeta.heading !== rc.heading;
    if (metaChanged && buffer.trim()) {
      emit();
      buffer = '';
    }
    buffer += (buffer ? '\n\n' : '') + rc.text;
    if (rc.label || rc.heading) {
      bufferMeta = { label: rc.label, heading: rc.heading, page: rc.page };
    } else if (!bufferMeta.label && !bufferMeta.heading) {
      bufferMeta = { label: null, heading: null, page: rc.page };
    }
    if (buffer.length >= 200) emit();
  }
  if (buffer.trim()) emit();

  // Assign pageEnd across pages
  return clauses.map((c, i) => {
    if (i + 1 < clauses.length && clauses[i + 1]!.page !== null && c.page !== null) {
      return { ...c, pageEnd: clauses[i + 1]!.page };
    }
    return c;
  });
}

/** Serialise clauses for the AI prompt with <agreement> delimiters (safe escaping) */
export function serialiseClauses(clauses: Clause[]): string {
  return clauses
    .map(c => {
      const meta = [
        c.id,
        c.label ? `label=${c.label}` : null,
        c.page !== null ? `page=${c.page}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
      return `[[${meta}]] ${sanitizeClauseText(c.text)}`;
    })
    .join('\n');
}

function sanitizeClauseText(text: string): string {
  return text
    .replace(/</g, '[')
    .replace(/>/g, ']')
    .replace(/\[\[/g, '[')
    .replace(/\]\]/g, ']')
    .replace(/<\/agreement>/gi, '')
    .trim();
}
