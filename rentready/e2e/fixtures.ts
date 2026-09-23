/** Shared E2E fixtures: fail any test that triggers a CSP violation or an uncaught error. */
import { test as base, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export const test = base.extend<{ pageErrors: string[] }>({
  pageErrors: async ({ page }, provide) => {
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', msg => {
      if (msg.type() === 'error' && /Content Security Policy|Refused to/i.test(msg.text())) {
        errors.push(`csp: ${msg.text()}`);
      }
    });
    await provide(errors);
    expect(errors).toEqual([]);
  },
});

/** Axe scan that fails on serious/critical findings (ACCESSIBILITY.md target). */
export async function expectNoSeriousAxe(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const serious = results.violations
    .filter(v => v.impact === 'serious' || v.impact === 'critical')
    .map(v => ({ id: v.id, targets: v.nodes.map(n => n.target.join(' ')) }));
  expect(serious).toEqual([]);
}

export { expect };
