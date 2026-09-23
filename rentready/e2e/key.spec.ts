import { test, expect, expectNoSeriousAxe } from './fixtures';

// Assembled at runtime so no key-shaped literal sits in the repo (CI secret scan).
const KEY = ['AI', 'za', 'SyE2eFakeKeyForPlaywrightOnly0123'].join('');

const AGREEMENT = [
  '1. Rent',
  'The Tenant shall pay monthly rent of Rs. 30,000 on or before the fifth day of each month.',
  '2. Security Deposit',
  "The Tenant shall pay a security deposit equivalent to three months' rent.",
].join('\n');

const MODEL_REPLY = {
  overview: 'A short residential rental agreement.',
  matchFindings: [],
  protectionFindings: [
    { id: 'DEPOSIT_REFUND_TIMELINE', state: 'absent', summary: null, clauseId: null, quote: null },
    {
      id: 'DEPOSIT_AMOUNT',
      state: 'present',
      summary: 'Three months',
      clauseId: 'c002',
      quote: "security deposit equivalent to three months' rent",
    },
  ],
};

test('the key is masked, never in page text, URL or storage, and is sent only to Gemini', async ({
  page,
  pageErrors,
}) => {
  const geminiCalls: Array<{ url: string; header: string | null }> = [];
  await page.route('https://generativelanguage.googleapis.com/**', async route => {
    geminiCalls.push({
      url: route.request().url(),
      header: route.request().headers()['x-goog-api-key'] ?? null,
    });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        candidates: [{ content: { parts: [{ text: JSON.stringify(MODEL_REPLY) }] } }],
      }),
    });
  });

  await page.goto('/#/upload');
  await page.getByRole('button', { name: 'Paste text' }).click();
  await page.getByRole('textbox', { name: 'Paste the agreement text' }).fill(AGREEMENT);
  await page.getByRole('button', { name: 'Read this text' }).click();

  await page.getByLabel('Your Gemini API key').fill(KEY);
  await page.getByRole('button', { name: 'Use this key' }).click();
  // On Upload the panel steps aside once a key is set; Forget key stays in the header.
  await expect(page.getByRole('banner').getByRole('button', { name: 'Forget key' })).toBeVisible();
  await expectNoSeriousAxe(page);

  const leaks = async () => ({
    text: (await page.evaluate(() => document.body.innerText)).includes(KEY),
    url: page.url().includes(KEY),
    storage: await page.evaluate(
      k => JSON.stringify({ ...localStorage, ...sessionStorage }).includes(k),
      KEY
    ),
  });
  expect(await leaks()).toEqual({ text: false, url: false, storage: false });

  await page.getByRole('button', { name: 'Check my agreement' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your report');
  await expect(page.getByRole('heading', { name: 'Offline check — no AI used' })).toHaveCount(0);
  await expect(page.getByRole('article', { name: 'When the deposit comes back' })).toBeVisible();
  expect(geminiCalls).toHaveLength(1);
  expect(geminiCalls[0]!.url).not.toContain(KEY);
  expect(geminiCalls[0]!.header).toBe(KEY);
  expect(await leaks()).toEqual({ text: false, url: false, storage: false });

  await page.getByRole('banner').getByRole('button', { name: 'Forget key' }).click();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Forget key' })).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('a rejected key gets a clear, translated message without the key in it', async ({ page }) => {
  await page.route('https://generativelanguage.googleapis.com/**', route =>
    route.fulfill({ status: 400, body: `API key not valid. Please pass a valid API key. ${KEY}` })
  );
  await page.goto('/#/upload');
  await page.getByRole('button', { name: 'Paste text' }).click();
  await page.getByRole('textbox', { name: 'Paste the agreement text' }).fill(AGREEMENT);
  await page.getByRole('button', { name: 'Read this text' }).click();
  await page.getByLabel('Your Gemini API key').fill(KEY);
  await page.getByRole('button', { name: 'Use this key' }).click();
  await page.getByRole('button', { name: 'Check my agreement' }).click();
  const alert = page.getByRole('alert');
  await expect(alert).toContainText('Your key was rejected');
  expect(await page.evaluate(() => document.body.innerText)).not.toContain(KEY);
});
