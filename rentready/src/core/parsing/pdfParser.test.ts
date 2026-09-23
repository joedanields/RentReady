import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parsePdf } from './pdfParser';
import { IntakeError } from './intake';
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
  dir: 'ltr',
});

const LONG_A =
  'The tenant agrees to pay a monthly rent of forty thousand rupees in advance within the first week of every month without fail and without any deductions.';
const LONG_B =
  'The tenant shall give one month written notice before vacating the premises at the end of the term without incurring any penalty whatsoever.';

const file = (): File =>
  ({ size: 1000, name: 'agreement.pdf', arrayBuffer: async () => new ArrayBuffer(0) }) as File;

function pdfWithPages(itemsByPage: TextItem[][], numPages = itemsByPage.length) {
  getDocument.mockReturnValue({
    promise: Promise.resolve({
      numPages,
      getPage: vi.fn(async (i: number) => ({
        getTextContent: async () => ({ items: itemsByPage[i - 1] ?? [] }),
      })),
    }),
  } as never);
}

async function expectIntakeError(p: Promise<unknown>, code: string) {
  const err = await p.then(
    () => null,
    (e: unknown) => e
  );
  expect(err).toBeInstanceOf(IntakeError);
  expect((err as IntakeError).code).toBe(code);
  return err as IntakeError;
}

beforeEach(() => {
  getDocument.mockReset();
});

describe('parsePdf', () => {
  it('rebuilds lines from text items and segments them into clauses', async () => {
    pdfWithPages([
      [
        item('1.', false, 700),
        item(' Rent', true, 700),
        item(LONG_A, true, 680),
        item('2. Notice', true, 640),
        item(LONG_B, true, 620),
      ],
    ]);
    const result = await parsePdf(file());
    expect(result.pageCount).toBe(1);
    expect(result.clauses.map(c => c.label)).toEqual(['1', '2']);
    expect(result.clauses[0]!.text.startsWith('1. Rent')).toBe(true);
  });

  it('starts a new line when the y position jumps even without an end-of-line flag', async () => {
    pdfWithPages([
      [item('1. Rent', false, 700), item(LONG_A, false, 680), item(LONG_B, true, 600)],
    ]);
    const result = await parsePdf(file());
    expect(result.rawText.split('\n')).toEqual(['1. Rent', LONG_A, LONG_B]);
  });

  it('records the page each clause starts and ends on', async () => {
    pdfWithPages([
      [item('1. Rent', true, 700), item(LONG_A, true, 680)],
      [item(LONG_B, true, 700)],
      [item('2. Notice', true, 700), item(LONG_B, true, 680)],
    ]);
    const result = await parsePdf(file());
    expect(result.pageCount).toBe(3);
    expect(result.clauses.map(c => [c.label, c.page, c.pageEnd])).toEqual([
      ['1', 1, 2],
      ['2', 3, 3],
    ]);
  });

  it('turns damaged or password-protected PDFs into PARSE_FAILED', async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new Error('PasswordException')),
    } as never);
    await expectIntakeError(parsePdf(file()), 'PARSE_FAILED');
  });

  it('rejects PDFs with too many pages, saying how many', async () => {
    pdfWithPages([[item('x', true, 1)]], LIMITS.MAX_PAGES + 1);
    const err = await expectIntakeError(parsePdf(file()), 'TOO_MANY_PAGES');
    expect(err.detail).toEqual({ pages: LIMITS.MAX_PAGES + 1, max: LIMITS.MAX_PAGES });
  });

  it('rejects scanned PDFs with little or no extractable text', async () => {
    pdfWithPages([[], [item('Page 2', true, 1)]]);
    await expectIntakeError(parsePdf(file()), 'SCANNED_PDF');
  });

  it('rejects documents that exceed the character cap', async () => {
    pdfWithPages([[item('x'.repeat(LIMITS.MAX_CHARS + 1), true, 1)]]);
    await expectIntakeError(parsePdf(file()), 'TOO_MANY_CHARS');
  });
});
