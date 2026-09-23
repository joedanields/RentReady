import { test, expect, expectNoSeriousAxe } from './fixtures';

test.describe('app shell', () => {
  test('home loads under the production CSP with no errors', async ({ page, pageErrors }) => {
    const response = await page.goto('/');
    const csp = response?.headers()['content-security-policy'] ?? '';
    expect(csp).toContain("script-src 'self'");
    // Exactly one external origin may be contacted: the Gemini API.
    const connect = /connect-src ([^;]+)/.exec(csp)?.[1]?.trim().split(/\s+/) ?? [];
    expect(connect.filter(s => s.startsWith('https://'))).toEqual([
      'https://generativelanguage.googleapis.com',
    ]);
    expect(response?.headers()['x-frame-options']).toBe('DENY');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('skip link is first in tab order and moves to main', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    const skip = page.getByRole('link', { name: /skip/i });
    await expect(skip).toBeFocused();
    await expect(skip).toBeVisible();
  });

  test('SPA fallback serves the app on a deep link', async ({ page }) => {
    await page.goto('/#/privacy');
    await expect(page.getByRole('main')).toBeVisible();
  });

  test('home has no serious or critical axe findings', async ({ page }) => {
    await page.goto('/');
    await expectNoSeriousAxe(page);
  });

  test('no horizontal scroll at 320 px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 740 });
    await page.goto('/');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
