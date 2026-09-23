import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseDocx } from './docxParser';
import { IntakeError } from './intake';
import { LIMITS } from '../limits';

vi.mock('mammoth', () => ({ extractRawText: vi.fn() }));

import * as mammoth from 'mammoth';

const extractRawText = vi.mocked(mammoth.extractRawText);

const file = (): File =>
  ({ size: 1000, name: 'agreement.docx', arrayBuffer: async () => new ArrayBuffer(0) }) as File;

// mammoth separates paragraphs with blank lines.
const TEXT = [
  '1. This is the first clause of the leave and licence agreement made today in Pune city.',
  '',
  '2. The tenant shall pay a monthly rent of forty thousand rupees in advance.',
  '',
  'short.',
  '',
  '3. The tenant shall give one month notice before vacating without penalty.',
].join('\n');

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  return p.then(
    () => null,
    (e: unknown) => (e instanceof IntakeError ? e.code : 'not-an-intake-error')
  );
}

beforeEach(() => {
  extractRawText.mockReset();
});

describe('parseDocx', () => {
  it('uses the shared segmenter: numbered clauses, no pages', async () => {
    extractRawText.mockResolvedValue({ value: TEXT } as never);
    const result = await parseDocx(file());
    expect(result.pageCount).toBe(0);
    expect(result.rawText).toBe(TEXT);
    expect(result.clauses.map(c => [c.id, c.label, c.page])).toEqual([
      ['c001', '1', null],
      ['c002', '2', null],
      ['c003', '3', null],
    ]);
    // "short." sits inside clause 2's body rather than becoming a fragment clause.
    expect(result.clauses[1]!.text).toContain('short.');
  });

  it('rejects documents that exceed the character cap', async () => {
    extractRawText.mockResolvedValue({ value: 'x'.repeat(LIMITS.MAX_CHARS + 1) } as never);
    expect(await codeOf(parseDocx(file()))).toBe('TOO_MANY_CHARS');
  });

  it('rejects an empty document', async () => {
    extractRawText.mockResolvedValue({ value: '  \n ' } as never);
    expect(await codeOf(parseDocx(file()))).toBe('EMPTY_TEXT');
  });

  it('turns a corrupt zip into PARSE_FAILED', async () => {
    extractRawText.mockRejectedValue(new Error('End of central directory not found'));
    expect(await codeOf(parseDocx(file()))).toBe('PARSE_FAILED');
  });
});
