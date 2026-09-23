import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../../state/AppProvider';
import { Interview } from './Interview';
import { ui } from '../../i18n/en';
import { expectNoAxeViolations } from '../../../tests/axe';

function setup() {
  const onDone = vi.fn();
  const onBack = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <AppProvider>
      <Interview onDone={onDone} onBack={onBack} />
    </AppProvider>
  );
  return { user, onDone, onBack, ...utils };
}

const heading = () => screen.getByRole('heading', { level: 1 });
const next = () => screen.getByRole('button', { name: ui.next });
const skip = () => screen.getByRole('button', { name: ui.skip });

/** Skips forward until the given question is on screen. */
async function skipTo(user: ReturnType<typeof userEvent.setup>, label: string) {
  while (heading().textContent !== label) await user.click(skip());
}

/** The summary's answer text for a question. */
function summaryValue(question: string): string {
  const term = screen.getByText(question, { selector: 'dt' });
  return term.nextElementSibling?.querySelector('span')?.textContent ?? '';
}

describe('Interview', () => {
  it('starts on question 1 of 10 with the heading focused', () => {
    setup();
    expect(heading()).toHaveTextContent(ui['q.city.label']);
    expect(heading()).toHaveFocus();
    expect(screen.getByText('Question 1 of 10')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('advances with Enter and echoes the normalised rent live', async () => {
    const { user } = setup();
    await user.click(skip());
    const rent = screen.getByRole('textbox', { name: ui['q.monthlyRent.label'] });
    await user.type(rent, '₹40k');
    expect(screen.getByText('₹40,000')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(heading()).toHaveTextContent(ui['q.deposit.label']);
  });

  it('relates the deposit to the rent in the echo', async () => {
    const { user } = setup();
    await user.click(skip());
    await user.type(screen.getByRole('textbox'), '40000{Enter}');
    await user.type(screen.getByRole('textbox'), 'two months');
    expect(screen.getByText("2 months' rent — about ₹80,000")).toBeInTheDocument();
  });

  it('keeps unreadable money on screen with a linked error and focus on the field', async () => {
    const { user } = setup();
    await user.click(skip());
    const rent = screen.getByRole('textbox');
    await user.type(rent, 'lots{Enter}');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(ui.errMoney);
    expect(rent).toHaveAttribute('aria-invalid', 'true');
    expect(rent.getAttribute('aria-describedby')).toContain(alert.id);
    expect(rent).toHaveFocus();
    expect(heading()).toHaveTextContent(ui['q.monthlyRent.label']);
  });

  it('goes Back one question and lets an earlier answer be edited', async () => {
    const { user, onBack } = setup();
    await user.click(skip());
    await user.type(screen.getByRole('textbox'), '40000{Enter}');
    await user.click(screen.getByRole('button', { name: ui.back }));
    const rent = screen.getByRole('textbox');
    expect(rent).toHaveValue('40000');
    // Regression: the field used to be locked to the stored answer.
    await user.clear(rent);
    await user.type(rent, '45000');
    expect(rent).toHaveValue('45000');
    await user.click(screen.getByRole('button', { name: ui.back }));
    await user.click(screen.getByRole('button', { name: ui.back }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('uses real radios: number keys pick an option, Next stores it', async () => {
    const { user } = setup();
    await skipTo(user, ui['q.maintenance.label']);
    const group = screen.getByRole('group', { name: ui['q.maintenance.label'] });
    const radios = within(group).getAllByRole('radio');
    expect(radios).toHaveLength(4);
    await user.click(radios[0]!);
    await user.keyboard('2');
    expect(within(group).getByRole('radio', { name: /The owner/ })).toBeChecked();
    await user.click(next());
    await skipTo(user, ui['summaryTitle']);
    expect(summaryValue(ui['q.maintenance.label'])).toBe(ui['opt.maintenance.owner']);
  });

  it('asks how many months for a lock-in, and validates it', async () => {
    const { user } = setup();
    await skipTo(user, ui['q.lockIn.label']);
    await user.click(screen.getByRole('radio', { name: /Yes, a minimum stay/ }));
    const months = screen.getByRole('textbox', { name: ui['followUp.lockIn'] });
    await user.click(next());
    expect(screen.getByRole('alert')).toHaveTextContent(ui.errLockInMonths);
    expect(months).toHaveFocus();
    await user.type(months, '6');
    expect(screen.queryByRole('alert')).toBeNull();
    await user.click(next());
    await skipTo(user, ui['summaryTitle']);
    expect(summaryValue(ui['q.lockIn.label'])).toBe('Yes, a minimum stay — 6 months');
  });

  it('treats "Not sure" as a skip, and Skip clears an earlier answer', async () => {
    const { user } = setup();
    await skipTo(user, ui['q.noticePeriod.label']);
    await user.click(screen.getByRole('radio', { name: /Not sure/ }));
    await user.click(next());
    await user.click(screen.getByRole('radio', { name: /^Me/ }));
    await user.click(next());
    await user.click(screen.getByRole('button', { name: ui.back }));
    await user.click(skip());
    await skipTo(user, ui['summaryTitle']);
    expect(summaryValue(ui['q.noticePeriod.label'])).toBe(ui.summaryNotAnswered);
    expect(summaryValue(ui['q.maintenance.label'])).toBe(ui.summaryNotAnswered);
  });

  it('collects extras from checkboxes and a custom item added with Enter', async () => {
    const { user } = setup();
    await skipTo(user, ui['q.extras.label']);
    await user.click(screen.getByRole('checkbox', { name: 'Pets allowed' }));
    await user.type(
      screen.getByRole('textbox', { name: ui.extrasCustomLabel }),
      'New mattress{Enter}'
    );
    expect(heading()).toHaveTextContent(ui['q.extras.label']);
    expect(screen.getByRole('checkbox', { name: 'New mattress' })).toBeChecked();
    await user.click(next());
    expect(heading()).toHaveTextContent(ui.summaryTitle);
    expect(summaryValue(ui['q.extras.label'])).toBe('Pets allowed, New mattress');
  });

  it('edits one answer from the summary and comes straight back', async () => {
    const { user, onDone } = setup();
    await skipTo(user, ui['summaryTitle']);
    expect(screen.getByText(ui.summaryAllSkipped)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: `Edit: ${ui['q.city.label']}` }));
    await user.type(screen.getByRole('textbox'), 'Pune');
    await user.click(screen.getByRole('button', { name: ui.saveAndReturn }));
    expect(heading()).toHaveTextContent(ui.summaryTitle);
    expect(heading()).toHaveFocus();
    expect(summaryValue(ui['q.city.label'])).toBe('Pune');
    await user.click(screen.getByRole('button', { name: ui.addAgreement }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('offers "Skip all, just analyse" on the first screen only', async () => {
    const { user, onDone } = setup();
    await user.click(screen.getByRole('button', { name: ui.skipAll }));
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('hides "Skip all" after the first question', async () => {
    const { user } = setup();
    await user.click(skip());
    expect(screen.queryByRole('button', { name: ui.skipAll })).toBeNull();
  });

  it('has no axe violations on any step or the summary', async () => {
    const { user, container } = setup();
    for (let i = 0; i < 10; i++) {
      await expectNoAxeViolations(container);
      await user.click(skip());
    }
    expect(heading()).toHaveTextContent(ui.summaryTitle);
    await expectNoAxeViolations(container);
  });
});
