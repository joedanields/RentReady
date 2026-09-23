import { test, expect, expectNoSeriousAxe } from './fixtures';

test.describe('dark theme', () => {
  test.use({ colorScheme: 'dark' });

  test('follows the OS setting and keeps contrast on home, report and settings', async ({
    page,
    pageErrors,
  }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expectNoSeriousAxe(page);

    await page.getByRole('button', { name: 'See a demo' }).click();
    await page.getByRole('button', { name: 'Use the sample' }).click();
    await page.getByRole('button', { name: 'Check my agreement' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your report');
    await page
      .getByRole('article', { name: 'Security deposit' })
      .getByText(/See original/)
      .click();
    await expectNoSeriousAxe(page);

    await page.goto('/#/settings');
    await expectNoSeriousAxe(page);
    expect(pageErrors).toEqual([]);
  });
});

test('theme choice applies immediately and survives a reload', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Dark' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('radio', { name: 'Light' }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('"Clear everything" asks first, can be cancelled, then wipes and returns home', async ({
  page,
}) => {
  await page.goto('/#/settings');
  await page.getByRole('radio', { name: 'Simple' }).check();

  await page.getByRole('button', { name: 'Clear everything' }).click();
  const dialog = page.getByRole('dialog', { name: 'Clear everything?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('radio', { name: 'Simple' })).toBeChecked();

  await page.getByRole('button', { name: 'Clear everything' }).click();
  await dialog.getByRole('button', { name: 'Clear everything' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    "Know what you're signing before you get the keys."
  );
  const stored = await page.evaluate(() => JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain('rentready:demo');
});
