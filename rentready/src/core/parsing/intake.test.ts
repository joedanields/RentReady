import { describe, it, expect, vi } from 'vitest';
import {
  IntakeError,
  checkFileSize,
  checkTextLength,
  detectFileKind,
  parseFile,
  parsePastedText,
} from './intake';
import { LIMITS } from '../limits';

vi.mock('./pdfParser.js', () => ({
  parsePdf: vi.fn(async () => ({ clauses: [], rawText: 'pdf', pageCount: 1 })),
}));
vi.mock('./docxParser.js', () => ({
  parseDocx: vi.fn(async () => ({ clauses: [], rawText: 'docx', pageCount: 0 })),
}));

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]; // %PDF-1.7
const ZIP = [0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]; // MZ

const bytes = (b: number[]) => new Uint8Array(b);
const fileOf = (name: string, head: number[]): File =>
  new File([new Uint8Array(head)], name, { type: 'application/octet-stream' });

function thrown(fn: () => unknown): IntakeError {
  try {
    fn();
  } catch (e) {
    return e as IntakeError;
  }
  throw new Error('expected a throw');
}

describe('detectFileKind', () => {
  it('trusts magic bytes, and requires the extension to agree', () => {
    expect(detectFileKind('lease.pdf', bytes(PDF))).toBe('pdf');
    expect(detectFileKind('LEASE.PDF', bytes(PDF))).toBe('pdf');
    expect(detectFileKind('lease.docx', bytes(ZIP))).toBe('docx');
  });

  it('refuses renamed executables, plain zips and mismatched types', () => {
    expect(detectFileKind('lease.pdf', bytes(EXE))).toBeNull();
    expect(detectFileKind('lease.docx', bytes(EXE))).toBeNull();
    expect(detectFileKind('lease.zip', bytes(ZIP))).toBeNull();
    expect(detectFileKind('lease.docx', bytes(PDF))).toBeNull();
    expect(detectFileKind('lease.pdf', bytes(ZIP))).toBeNull();
    expect(detectFileKind('lease.pdf', bytes([]))).toBeNull();
  });
});

describe('size and length caps', () => {
  it('reports the size in MB when a file is too large', () => {
    expect(() => checkFileSize(LIMITS.MAX_FILE_SIZE)).not.toThrow();
    const err = thrown(() => checkFileSize(14 * 1024 * 1024));
    expect(err).toBeInstanceOf(IntakeError);
    expect(err.code).toBe('TOO_LARGE');
    expect(err.detail).toEqual({ mb: 14 });
  });

  it('reports the character count when text is too long', () => {
    expect(() => checkTextLength('x'.repeat(LIMITS.MAX_CHARS))).not.toThrow();
    const err = thrown(() => checkTextLength('x'.repeat(LIMITS.MAX_CHARS + 5)));
    expect(err.code).toBe('TOO_MANY_CHARS');
    expect(err.detail).toEqual({ chars: LIMITS.MAX_CHARS + 5, max: LIMITS.MAX_CHARS });
  });
});

describe('parsePastedText', () => {
  it('segments pasted text without pages', () => {
    const doc = parsePastedText(
      '  1. The monthly rent is forty thousand rupees.\n2. The deposit is two months of rent.  '
    );
    expect(doc.pageCount).toBe(0);
    expect(doc.clauses.map(c => c.label)).toEqual(['1', '2']);
    expect(doc.rawText.startsWith('1.')).toBe(true);
  });

  it('rejects empty or fragment-only text', () => {
    expect(thrown(() => parsePastedText('   ')).code).toBe('EMPTY_TEXT');
    expect(thrown(() => parsePastedText('too short')).code).toBe('EMPTY_TEXT');
  });

  it('rejects text over the cap', () => {
    expect(thrown(() => parsePastedText('a'.repeat(LIMITS.MAX_CHARS + 1))).code).toBe(
      'TOO_MANY_CHARS'
    );
  });
});

describe('parseFile', () => {
  it('routes by real file type', async () => {
    expect((await parseFile(fileOf('a.pdf', PDF))).rawText).toBe('pdf');
    expect((await parseFile(fileOf('a.docx', ZIP))).rawText).toBe('docx');
  });

  it('refuses an .exe renamed .pdf before any parser runs', async () => {
    await expect(parseFile(fileOf('lease.pdf', EXE))).rejects.toMatchObject({
      code: 'INVALID_FILE',
    });
  });

  it('refuses oversize files before reading them', async () => {
    const huge = {
      name: 'a.pdf',
      size: LIMITS.MAX_FILE_SIZE + 1,
      slice: vi.fn(),
    } as unknown as File;
    await expect(parseFile(huge)).rejects.toMatchObject({ code: 'TOO_LARGE' });
    expect(huge.slice).not.toHaveBeenCalled();
  });
});
