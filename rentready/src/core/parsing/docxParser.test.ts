import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseDocx, isDocxFile } from './docxParser';
import { LIMITS } from '../limits';

vi.mock('mammoth', () => ({ extractRawText: vi.fn() }));

import * as mammoth from 'mammoth';

const extractRawText = vi.mocked(mammoth.extractRawText);

const file = (overrides: Partial<File> = {}): File =>
  ({
    size: 1000,
    type: '',
    name: 'agreement.docx',
    arrayBuffer: async () => new ArrayBuffer(0),
    ...overrides
  }) as unknown as File;

const TEXT =
  '1. This is the first clause of the leave and licence agreement made today in Pune city.\n' +
  '2. The tenant shall pay a monthly rent of forty thousand rupees in advance.\n' +
  'short.\n' +
  '3. The tenant shall give one month notice before vacating without penalty.';

beforeEach(() => {
  extractRawText.mockReset();
});

describe('parseDocx', () => {
  it('extracts clauses from a raw-text document', async () => {
    extractRawText.mockResolvedValue({ value: TEXT } as never);

    const result = await parseDocx(file());
    expect(result.pageCount).toBe(1);
    expect(result.rawText).toBe(TEXT.trim());
    expect(result.clauses).toHaveLength(3);
    expect(result.clauses.map(c => c.id)).toEqual(['c001', 'c002', 'c003']);
    expect(result.clauses[0]!.text).toContain('first clause');
    expect(result.clauses[1]!.text).toContain('forty thousand rupees');
    expect(result.clauses[1]!.page).toBeNull();
  });

  it('rejects oversized files', async () => {
    await expect(parseDocx(file({ size: LIMITS.MAX_FILE_SIZE + 1 }))).rejects.toThrow('TOO_LARGE');
  });

  it('rejects documents that exceed the character cap', async () => {
    extractRawText.mockResolvedValue({ value: 'x'.repeat(LIMITS.MAX_CHARS + 1) } as never);
    await expect(parseDocx(file())).rejects.toThrow('TOO_MANY_CHARS');
  });

  it('drops blank lines and under-length fragments', async () => {
    extractRawText.mockResolvedValue({ value: TEXT } as never);
    const result = await parseDocx(file());
    expect(result.clauses.every(c => c.text.length >= 20)).toBe(true);
    expect(result.clauses.some(c => c.text === 'short.')).toBe(false);
  });
});

describe('isDocxFile', () => {
  it('accepts the docx mimetype or extension', () => {
    expect(isDocxFile(file({ type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }))).toBe(true);
    expect(isDocxFile(file({ name: 'a.docx' }))).toBe(true);
    expect(isDocxFile(file({ name: 'a.pdf', type: 'application/pdf' }))).toBe(false);
  });
});