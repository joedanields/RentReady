/**
 * Builds a small, valid PDF in memory (Helvetica text, one content stream per page) so the E2E
 * suite exercises real pdf.js parsing without committing a binary fixture. ASCII text only, so
 * string length equals byte length when computing xref offsets.
 */
import type { Page } from '@playwright/test';

export function makePdf(pages: string[][]): number[] {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`;
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';

  const escape = (s: string) => s.replace(/[\\()]/g, m => `\\${m}`);
  pages.forEach((lines, i) => {
    const pageId = 4 + i * 2;
    const contentId = pageId + 1;
    const stream = [
      'BT',
      '/F1 10 Tf',
      '14 TL',
      '50 800 Td',
      ...lines.map(l => `(${escape(l)}) Tj T*`),
      'ET',
    ].join('\n');
    objects[pageId] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
      `/Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objects[contentId] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
  });

  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 1; i < objects.length; i++) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  out += offsets
    .slice(1)
    .map(o => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('');
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Array.from(out, ch => ch.charCodeAt(0));
}

/** Attaches bytes to the hidden file input exactly as a user's file pick would. */
export async function chooseFile(page: Page, name: string, bytes: number[], type: string) {
  await page.getByTestId('file-input').evaluate(
    (input, file) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(file.bytes)], file.name, { type: file.type }));
      (input as HTMLInputElement).files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    },
    { name, bytes, type }
  );
}
