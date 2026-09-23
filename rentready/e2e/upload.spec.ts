import { test, expect, expectNoSeriousAxe } from './fixtures';
import { chooseFile, makePdf } from './pdf';

const PAGE_1 = [
  'RENTAL AGREEMENT',
  'This agreement is made at Pune between the Owner and the Tenant named below.',
  '1. Rent',
  'The Tenant shall pay a monthly rent of Rs. 40,000 on or before the fifth day of each month.',
  'Rent is payable by bank transfer to the account notified by the Owner in writing.',
  '2. Deposit',
  'The Tenant shall pay a security deposit of Rs. 1,20,000 at the time of signing.',
];
const PAGE_2 = [
  'The deposit shall be refunded after deductions decided by the Owner.',
  '3. Notice',
  'Either party shall give two months written notice before ending this agreement.',
  '4. Repairs',
  'All repairs of every kind shall be carried out by the Tenant at his own cost.',
];

async function openUpload(page: import('@playwright/test').Page) {
  await page.goto('/#/upload');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add your agreement');
}

test('a real PDF is parsed in the browser with page numbers, under the production CSP', async ({
  page,
  pageErrors,
}) => {
  await openUpload(page);
  await chooseFile(page, 'agreement.pdf', makePdf([PAGE_1, PAGE_2]), 'application/pdf');
  await expect(page.getByRole('status')).toHaveText('Read 5 clauses across 2 pages.');
  await expect(page.getByRole('heading', { name: 'agreement.pdf' })).toBeVisible();
  await expectNoSeriousAxe(page);
  expect(pageErrors).toEqual([]);
});

test('a scanned PDF (no text layer) gets a clear explanation', async ({ page }) => {
  await openUpload(page);
  await chooseFile(page, 'scan.pdf', makePdf([[], []]), 'application/pdf');
  await expect(page.getByRole('alert')).toContainText('looks like a scan');
});

test('an .exe renamed .pdf is rejected with a friendly error', async ({ page }) => {
  await openUpload(page);
  // "MZ" header: a Windows executable wearing a .pdf name.
  const exe = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x20, 0x21];
  await chooseFile(page, 'lease.pdf', exe, 'application/pdf');
  const alert = page.getByRole('alert');
  await expect(alert).toContainText("isn't a PDF or Word (.docx) document");
  await expectNoSeriousAxe(page);
});

test('the sample agreement is read into clauses with pages', async ({ page }) => {
  await openUpload(page);
  await page.getByRole('button', { name: 'Use the sample' }).click();
  await expect(page.getByRole('status')).toHaveText('Read 14 clauses across 2 pages.');
  await expect(page.getByText('Sample data')).toBeVisible();
});
