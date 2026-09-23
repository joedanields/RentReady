import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { AppProvider } from './state/AppProvider';
import { t } from './i18n';
import { expectNoAxeViolations } from '../tests/axe';

function renderApp() {
  return render(
    <AppProvider>
      <App />
    </AppProvider>
  );
}

describe('App shell', () => {
  it('puts the skip link first and points it at main', async () => {
    renderApp();
    const user = userEvent.setup();
    await user.tab();
    const skip = screen.getByRole('link', { name: t('skipLink') });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute('href', '#main');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('has banner, main and contentinfo landmarks and a single h1', () => {
    renderApp();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows the not-legal-advice line and consistent help links in the footer', () => {
    renderApp();
    const footer = within(screen.getByRole('contentinfo'));
    expect(footer.getByText(t('infoNotLegalAdvice'))).toBeInTheDocument();
    for (const key of ['howThisWorks', 'privacy', 'disclaimer'] as const) {
      expect(footer.getByRole('button', { name: t(key) })).toBeInTheDocument();
    }
  });

  it('keeps the footer disclaimer when navigating to another screen', async () => {
    renderApp();
    const user = userEvent.setup();
    await user.click(within(screen.getByRole('contentinfo')).getByRole('button', { name: t('privacy') }));
    expect(within(screen.getByRole('contentinfo')).getByText(t('infoNotLegalAdvice'))).toBeInTheDocument();
  });

  it('keeps key entry out of the header (it lives on Upload and Settings)', () => {
    renderApp();
    const header = screen.getByRole('banner');
    expect(header.querySelector('input')).toBeNull();
    // With no key set there is nothing to forget, so the header control is absent too.
    expect(within(header).queryByRole('button', { name: t('forgetKey') })).toBeNull();
  });

  it('has no axe violations on Home', async () => {
    const { container } = renderApp();
    await expectNoAxeViolations(container);
  });
});
