import { test, expect, expectNoSeriousAxe } from './fixtures';

const AGREEMENT = [
  '1. Rent',
  'The Tenant shall pay monthly rent of Rs. 30,000 on or before the fifth day of each month.',
  '2. Security Deposit',
  "The Tenant shall pay a security deposit equivalent to three months' rent, refundable after deductions as determined by the Owner.",
  '3. Lock-in',
  'The Tenant shall not vacate the premises before the expiry of six (6) months, failing which the deposit shall be forfeited.',
  '4. Repairs',
  'The Tenant shall be responsible for all repairs including structural repairs.',
].join('\n');

test('with the network off, pasted text still produces a useful local report', async ({
  page,
  context,
}) => {
  await page.goto('/#/upload');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add your agreement');

  const requests: string[] = [];
  page.on('request', r => {
    if (!r.url().startsWith('data:')) requests.push(r.url());
  });
  await context.setOffline(true);

  await page.getByRole('button', { name: 'Paste text' }).click();
  await page.getByRole('textbox', { name: 'Paste the agreement text' }).fill(AGREEMENT);
  await page.getByRole('button', { name: 'Read this text' }).click();
  await expect(page.getByRole('status')).toHaveText('Read 4 clauses.');
  await page.getByRole('button', { name: 'Check my agreement' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your report');
  await expect(page.getByRole('heading', { name: 'Offline check — no AI used' })).toBeVisible();
  for (const title of [
    'Deposit larger than the common norm',
    'No deadline for returning the deposit',
    'Deductions decided only by the owner',
    'Long minimum stay',
    'All repairs pushed to the renter',
  ]) {
    await expect(page.getByRole('article', { name: title })).toBeVisible();
  }
  await expectNoSeriousAxe(page);
  expect(requests).toEqual([]);
});

test('demo journey: sample agreement → report with verified evidence', async ({
  page,
  pageErrors,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'See a demo' }).click();
  await page.getByRole('button', { name: 'Use the sample' }).click();
  await page.getByRole('button', { name: 'Check my agreement' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your report');
  const deposit = page.getByRole('article', { name: 'Security deposit' });
  await expect(deposit.getByText("Doesn't match", { exact: true })).toBeVisible();
  await expect(deposit.getByText('Verified quote')).toBeVisible();
  await deposit.getByText(/See original/).click();
  await expect(deposit.locator('mark')).toContainText('Rs. 1,20,000/-');
  await expect(page.getByRole('article', { name: 'When the deposit comes back' })).toBeVisible();
  await expectNoSeriousAxe(page);
  expect(pageErrors).toEqual([]);
});

test('the report reflows at 320 px without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/?demo=1#/upload');
  await page.getByRole('button', { name: 'Use the sample' }).click();
  await page.getByRole('button', { name: 'Check my agreement' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your report');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
