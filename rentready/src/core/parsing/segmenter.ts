/** Clause segmenter — pure functions (ARCHITECTURE.md §5). */

import type { Clause } from '../types.js';

/** Clauses shorter than this are dropped (stray page numbers, lone labels). */
const MIN_CLAUSE_CHARS = 20;
/** Unnumbered paragraphs are merged until at least this long. */
const MERGE_TARGET_CHARS = 200;
/** Longer clauses are split at sentence boundaries so each stays quotable. */
const MAX_CLAUSE_CHARS = 2000;

const NUMBERED_START: RegExp[] = [
  /^\d{1,3}(\.\d{1,3}){0,3}[.)]\s+\S/, // 1.  2)  4.2.  1.1.1)
  /^\d{1,3}(\.\d{1,3}){1,3}\s+\S/, // 4.2 Deposit  1.1.1 Termination
  // A bare number only counts before a capital: "11 months from…" wrapped from the previous
  // line must not start a clause, but "5 SECURITY DEPOSIT" should.
  /^\d{1,2}\s+[A-Z]/,
];

const NAMED_START = /^(Clause|Article|Section|Schedule|Annexure|Annex)\s+\d+/i;
const LETTER_START = /^\(?[a-z]\)\s/; // (a)  a)
const ROMAN_START = /^\(?[ivx]{1,4}\)\s/i; // (i) (iv)
const SCHEDULE_START = /^(schedule|annexure|annex)\s+[a-z0-9]/i;

/** ALL-CAPS heading of at most 8 words, e.g. "TERM", "DISPUTE RESOLUTION". */
export function isAllCapsHeading(line: string): boolean {
  const t = line.trim();
  return (
    /^[A-Z][A-Z0-9\s&,'’/()-]*$/.test(t) &&
    /[A-Z]{2}/.test(t) &&
    t.split(/\s+/).length <= 8 &&
    t.length <= 80
  );
}

/** Check if a line starts a new clause */
export function isClauseStart(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return (
    SCHEDULE_START.test(trimmed) ||
    NAMED_START.test(trimmed) ||
    NUMBERED_START.some(p => p.test(trimmed)) ||
    LETTER_START.test(trimmed) ||
    ROMAN_START.test(trimmed) ||
    isAllCapsHeading(trimmed)
  );
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

/** Split text at sentence boundaries near maxLen */
function splitAtSentences(text: string, maxLen: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [text];
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
  return parts;
}

/** A run of lines that began at a clause start (or a paragraph, when nothing is numbered). */
interface Block {
  label: string | null;
  heading: string | null;
  lines: string[];
  page: number | null;
  pageEnd: number | null;
}

const isMarked = (b: Block): boolean => b.label !== null || b.heading !== null;

function startBlock(line: string, page: number | null): Block {
  const heading = isAllCapsHeading(line) ? line : null;
  return {
    label: heading ? null : extractLabel(line),
    heading,
    lines: [line],
    page,
    pageEnd: page,
  };
}

/** Pass 1: group lines into blocks at clause starts, and at blank lines between plain paragraphs. */
function toBlocks(lines: Array<{ text: string; page: number | null }>): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const { text, page } of lines) {
    const line = text.trim();
    if (!line) {
      // Paragraph fallback: a blank line ends an unnumbered paragraph, but not a numbered
      // clause (its body often has blank lines of its own).
      if (current && !isMarked(current)) {
        blocks.push(current);
        current = null;
      }
      continue;
    }
    if (current && !isClauseStart(line)) {
      current.lines.push(line);
      current.pageEnd = page;
      continue;
    }
    if (current) blocks.push(current);
    current = startBlock(line, page);
  }
  if (current) blocks.push(current);
  return blocks;
}

/**
 * Segment raw agreement text into clauses with stable ids `c001…`.
 * `pageTexts` (one string per page) enables page / pageEnd tracking.
 *
 * Numbered and headed clauses always stand alone, so a clause id maps to exactly one clause of
 * the agreement. Unnumbered paragraphs are merged up to ~200 chars; anything over 2,000 chars is
 * split at sentence boundaries. A heading with no body of its own (e.g. "TERMS" directly above
 * "1. Rent") is carried onto the next clause instead of becoming an empty clause.
 */
export function segmentClauses(rawText: string, pageTexts: string[] = []): Clause[] {
  const lines =
    pageTexts.length > 0
      ? pageTexts.flatMap((pt, i) => pt.split(/\r?\n/).map(text => ({ text, page: i + 1 })))
      : rawText.split(/\r?\n/).map(text => ({ text, page: null }));

  const clauses: Clause[] = [];
  let pending: Block | null = null;
  let carried: Block | null = null;

  const emit = (b: Block) => {
    const text = b.lines.join('\n').trim();
    if (text.length < MIN_CLAUSE_CHARS) return;
    const parts =
      text.length > MAX_CLAUSE_CHARS ? splitAtSentences(text, MAX_CLAUSE_CHARS) : [text];
    for (const part of parts) {
      const order = clauses.length + 1;
      clauses.push({
        id: `c${String(order).padStart(3, '0')}`,
        label: b.label,
        heading: b.heading,
        text: part,
        page: b.page,
        pageEnd: b.pageEnd,
        order,
      });
    }
  };

  const flushPending = () => {
    if (pending) emit(pending);
    pending = null;
  };

  for (const block of toBlocks(lines)) {
    if (block.heading !== null && block.lines.length === 1) {
      // Bare heading: remember it for the next clause.
      flushPending();
      if (carried) emit(carried);
      carried = block;
      continue;
    }
    if (carried) {
      block.heading ??= carried.heading;
      block.lines.unshift(...carried.lines);
      block.page = carried.page;
      carried = null;
    }

    if (isMarked(block)) {
      flushPending();
      emit(block);
      continue;
    }
    // Plain paragraph: merge into the pending run until it is long enough.
    if (pending) {
      pending.lines.push('', ...block.lines);
      pending.pageEnd = block.pageEnd;
    } else {
      pending = block;
    }
    if (pending.lines.join('\n').length >= MERGE_TARGET_CHARS) flushPending();
  }
  flushPending();
  if (carried) emit(carried);
  return clauses;
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
