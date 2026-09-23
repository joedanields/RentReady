import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePdf, isPdfFile, sniffMagicBytes } from './pdfParser';
import { LIMITS } from '../limits';
import type { TextItem } from 'pdfjs-dist/types/src/display/api.js';

vi.mock('pdfjs-dist', () => ({ getDocument: vi.fn(), GlobalWorkerOptions: {} }));
vi.mock('pdfjs-dist/build/pdf.worker.mjs?url', () => ({ default: 'blob://mock-worker' }));

import * as pdfjs from 'pdfjs-dist';

const getDocument = vi.mocked(pdfjs.getDocument);

const item = (str: string, hasEOL: boolean, y: number): TextItem => ({
  str,
  hasEOL,
  transform: [1, 0, 0, 1, 10, y],
  width: 1,
  height: 1,
  fontName: 'font',
  dir: 'ltr'
});

const LONG_A = 'The tenant agrees to pay a monthly rent of forty thousand rupees in advance within the first week of every month without fail and without any deductions.';
const LONG_B = 'The tenant shall give one month written notice before vacating the premises at the end of the term without incurring any penalty whatsoever.';

const file = (overrides: Partial<File> = {}): File =>
  ({
    size: 1000,
    type: '',
    name: 'agreement.pdf',
    arrayBuffer: async () => new ArrayBuffer(0),
    ...overrides
  }) as unknown as File;

function pdfWithPages(itemsByPage: TextItem[][], numPages = itemsByPage.length) {
  getDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages,
      getPage: vi.fn(async (i: number) => ({
        getTextContent: async () => ({ items: itemsByPage[i - 1] ?? [] })
      }))
    })
  } as never);
}

beforeEach(() => {
  getDocument.mockReset();
});

describe('parsePdf', () => {
  it('segments a single-page PDF into clauses', async () => {
    pdfWithPages([[item('1.', true, 40), item(LONG_A, true, 40), item('2.', true, 90), item(LONG_B, true, 90)]]);

    const result = await parsePdf(file());
    expect(result.pageCount).toBe(1);
    expect(result.rawText).toContain('--- PAGE 1 ---');
    expect(result.clauses.length).toBeGreaterThanOrEqual(1);
    expect(result.clauses[0]!.text.length).toBeGreaterThan(20);
  });

  it('tracks page numbers across multiple pages', async () => {
    pdfWithPages([
      [item('1.', true, 40), item(LONG_A, true, 40)],
      [item('2.', true, 40), item(LONG_B, true, 40)]
    ]);

    const result = await parsePdf(file());
    expect(result.pageCount).toBe(2);
    expect(result.rawText).toContain('--- PAGE 2 ---');
  });

  it('rejects oversized files', async () => {
    await expect(parsePdf(file({ size: LIMITS.MAX_FILE_SIZE + 1 }))).rejects.toThrow('TOO_LARGE');
  });

  it('rejects PDFs with too many pages', async () => {
    pdfWithPages([[item('x', true, 1)]], LIMITS.MAX_PAGES + 1);
    await expect(parsePdf(file())).rejects.toThrow('TOO_MANY_PAGES');
  });

  it('rejects scanned PDFs with no extractable text', async () => {
    pdfWithPages([[]]);
    await expect(parsePdf(file())).rejects.toThrow('SCANNED_PDF');
  });

  it('rejects documents that exceed the character cap', async () => {
    pdfWithPages([[item('x'.repeat(LIMITS.MAX_CHARS + 1), true, 1)]]);
    await expect(parsePdf(file())).rejects.toThrow('TOO_MANY_CHARS');
  });
});

describe('isPdfFile', () => {
  it('accepts the pdf mimetype or extension', () => {
    expect(isPdfFile(file({ type: 'application/pdf' }))).toBe(true);
    expect(isPdfFile(file({ name: 'a.pdf' }))).toBe(true);
    expect(isPdfFile(file({ name: 'a.docx' }))).toBe(false);
  });
});

describe('sniffMagicBytes', () => {
  it('detects pdf, zip and unknown signatures', () => {
    expect(sniffMagicBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe('pdf');
    expect(sniffMagicBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBe('zip');
    expect(sniffMagicBytes(new Uint8Array([0x00, 0x01, 0x02, 0x03]))).toBe('unknown');
  });

  it('returns unknown for short buffers', () => {
    expect(sniffMagicBytes(new Uint8Array([0x25]))).toBe('unknown');
    expect(sniffMagicBytes(new Uint8Array(0))).toBe('unknown');
  });
});