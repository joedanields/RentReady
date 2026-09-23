/**
 * Axe helper for component tests. vitest-axe 0.1 augments the legacy `Vi` namespace, which
 * Vitest 2 no longer reads, so we call `axe()` directly and assert on the violation list —
 * this also gives readable failures (rule id + target) without a custom matcher.
 */
import { axe } from 'vitest-axe';
import { expect } from 'vitest';

export async function expectNoAxeViolations(container: Element): Promise<void> {
  const results = await axe(container, {
    // jsdom has no layout engine, so colour contrast is checked in Playwright instead.
    rules: { 'color-contrast': { enabled: false } },
  });
  const summary = results.violations.map(v => ({
    id: v.id,
    impact: v.impact,
    targets: v.nodes.map(n => n.target.join(' ')),
  }));
  expect(summary).toEqual([]);
}
