import type { Page } from '@playwright/test';
import { test, expect, expectNoSeriousAxe } from './fixtures';

async function demoReport(page: Page) {
  await page.goto('/?demo=1#/upload');
  await page.getByRole('button', { name: 'Use the sample' }).click();
  await page.getByRole('button', { name: 'Check my agreement' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your report');
}

test('negotiation pack: pick items, edit, and download a .md that cites clause numbers', async ({
  page,
}) => {
  // Keep a handle on the Blob the page downloads, to read its contents in the browser.
  await page.addInitScript(() => {
    const original = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj: Blob | MediaSource) => {
      (window as unknown as { lastBlob: Blob }).lastBlob = obj as Blob;
      return original(obj);
    };
  });
  await demoReport(page);
  await page.getByRole('button', { name: /things to raise/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Build a message');

  const message = page.getByLabel('Your message');
  await expect(message).toHaveValue(/^Hi,\nThank you for sharing the agreement\./);
  await expect(message).toHaveValue(/\(Clause 5\)/); // the deposit clause, as printed
  await expect(message).not.toHaveValue(/c0\d\d/); // never an internal id

  await page.getByRole('radio', { name: 'Email' }).check();
  await expect(message).toHaveValue(/^Dear \[Owner\/Broker\],/);
  await message.fill('My own words.\n1. Two months deposit please.');
  await expect(
    page.getByText('a starting point to discuss, not legal drafting', { exact: false })
  ).toBeVisible();
  await expectNoSeriousAxe(page);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download .md' }).click(),
  ]);
  expect(download.suggestedFilename()).toBe('rentready-message.md');
  const md = await page.evaluate(() => (window as unknown as { lastBlob: Blob }).lastBlob.text());
  expect(md).toContain('My own words.');
  expect(md).toContain('Clause 5');
  expect(md).toContain('not legal drafting');
  expect(md).not.toMatch(/AIza/);
});

test('move-in kit: tick items, and it prints without the app chrome', async ({ page }) => {
  await demoReport(page);
  await page.getByRole('button', { name: 'Move-in kit' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Move-in kit');

  const first = page.getByRole('checkbox').first();
  await first.check();
  await expect(page.getByText(/^1 of \d+ checked$/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Timeline' })).toBeVisible();
  // The sample agreement asks for two months' notice (the demo user said one month): the
  // timeline follows the agreement.
  await expect(page.getByText(/60-day notice/)).toBeVisible();
  await expectNoSeriousAxe(page);

  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('banner')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Print' })).toBeHidden();
  await expect(page.getByRole('heading', { name: 'Inspection checklist' })).toBeVisible();
});
