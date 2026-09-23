import type { Page } from '@playwright/test';
import { test, expect, expectNoSeriousAxe } from './fixtures';

/** Presses Tab until the named control has focus — keyboard only, no clicks. */
async function tabTo(page: Page, name: RegExp) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    const label = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? (el.getAttribute('aria-label') ?? el.innerText ?? el.textContent ?? '') : '';
    });
    if (name.test(label)) return;
  }
  throw new Error(`Could not tab to ${name}`);
}

const heading = (page: Page) => page.getByRole('heading', { level: 1 });

test('the whole interview can be completed with the keyboard alone', async ({
  page,
  pageErrors,
}) => {
  await page.goto('/');
  await tabTo(page, /^Start/);
  await page.keyboard.press('Enter');

  // 1 city — heading gets focus on each new step; Tab to the field, type, Enter.
  await expect(heading(page)).toHaveText('Which city is the place in?');
  await expect(heading(page)).toBeFocused();
  await expectNoSeriousAxe(page);
  await page.keyboard.press('Tab');
  await page.keyboard.type('Pune');
  await page.keyboard.press('Enter');

  // 2 rent, with the live echo
  await expect(heading(page)).toHaveText('What monthly rent did you agree to?');
  await page.keyboard.press('Tab');
  await page.keyboard.type('₹40k');
  await expect(page.getByText('₹40,000', { exact: true })).toBeVisible();
  await page.keyboard.press('Enter');

  // 3 deposit in months
  await page.keyboard.press('Tab');
  await page.keyboard.type('3 months');
  await expect(page.getByText("3 months' rent — about ₹1,20,000")).toBeVisible();
  await page.keyboard.press('Enter');

  // 4 duration: number key picks "11 months"; Enter submits
  await expect(heading(page)).toHaveText('How long is the agreement meant to run?');
  await expectNoSeriousAxe(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('1');
  await expect(page.getByRole('radio', { name: /11 months/ })).toBeChecked();
  await page.keyboard.press('Enter');

  // 5 lock-in: "Yes" then the follow-up months field
  await page.keyboard.press('Tab');
  await page.keyboard.press('2');
  await page.keyboard.press('Tab');
  await page.keyboard.type('6');
  await page.keyboard.press('Enter');

  // 6 notice: arrow keys move within the radio group
  await expect(heading(page)).toHaveText('How much notice did you agree to give before leaving?');
  await page.keyboard.press('Tab');
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('radio', { name: /^1 month/ })).toBeChecked();
  await page.keyboard.press('Enter');

  // 7–9 skip with the keyboard
  for (const title of [
    'Who pays society maintenance?',
    'Who was going to handle repairs?',
    'Was a yearly rent increase mentioned?',
  ]) {
    await expect(heading(page)).toHaveText(title);
    await tabTo(page, /^Skip$/);
    await page.keyboard.press('Enter');
  }

  // 10 extras: Space toggles a checkbox
  await expect(heading(page)).toHaveText('Anything else you were promised?');
  await expectNoSeriousAxe(page);
  await page.keyboard.press('Tab');
  await page.keyboard.press('Space');
  await tabTo(page, /^Next$/);
  await page.keyboard.press('Enter');

  // Summary
  await expect(heading(page)).toHaveText('Your answers');
  await expect(heading(page)).toBeFocused();
  const summary = page.locator('dl');
  await expect(summary).toContainText('Pune');
  await expect(summary).toContainText('₹40,000');
  await expect(summary).toContainText("3 months' rent — about ₹1,20,000");
  await expect(summary).toContainText('Yes, a minimum stay — 6 months');
  await expect(summary).toContainText('Parking included');
  await expectNoSeriousAxe(page);

  await tabTo(page, /^Add your agreement$/);
  await page.keyboard.press('Enter');
  await expect(heading(page)).not.toHaveText('Your answers');
  expect(pageErrors).toEqual([]);
});

test('no horizontal scroll on any interview step at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto('/#/interview');
  for (let i = 0; i < 11; i++) {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow, `step ${i + 1}`).toBeLessThanOrEqual(0);
    if (i < 10) await page.getByRole('button', { name: 'Skip', exact: true }).click();
  }
  await expect(heading(page)).toHaveText('Your answers');
});
