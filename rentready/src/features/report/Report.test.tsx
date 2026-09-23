import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../../state/AppProvider';
import { INITIAL_STATE } from '../../state/reducer';
import { Report } from './Report';
import { ui } from '../../i18n/en';
import { analyseDocument } from '../../core/analysis';
import { segmentClauses } from '../../core/parsing/segmenter';
import {
  SAMPLE_ANALYSIS_RESPONSE,
  SAMPLE_DEMO_INTERVIEW_INPUT,
  SAMPLE_PAGES,
} from '../../sample/sampleData';
import type { AppState, InterviewAnswers } from '../../core/types';
import { expectNoAxeViolations } from '../../../tests/axe';

const clauses = segmentClauses(SAMPLE_PAGES.join('\n'), SAMPLE_PAGES);
const answers: InterviewAnswers = { ...SAMPLE_DEMO_INTERVIEW_INPUT, city: 'Pune' };

function stateWith(mode: 'local' | 'ai'): AppState {
  const result = analyseDocument({
    answers,
    clauses,
    ...(mode === 'ai' ? { modelResponse: SAMPLE_ANALYSIS_RESPONSE } : { localOnly: true }),
  });
  return {
    ...structuredClone(INITIAL_STATE),
    interview: { answers, currentStep: 10, completed: true },
    document: {
      ...INITIAL_STATE.document,
      fileName: 'Sample agreement',
      fileType: 'sample',
      clauses,
      pageCount: 2,
    },
    analysis: { ...INITIAL_STATE.analysis, result },
  };
}

function setup(initial: AppState = INITIAL_STATE) {
  const handlers = { onNegotiate: vi.fn(), onMoveIn: vi.fn(), onAddAgreement: vi.fn() };
  const user = userEvent.setup();
  const utils = render(
    <AppProvider initial={initial}>
      <Report {...handlers} />
    </AppProvider>
  );
  return { user, ...handlers, ...utils };
}

const section = (title: string) =>
  screen
    .getByRole('heading', { level: 2, name: new RegExp(`^${title.replace(/'/g, "'")}`) })
    .closest('details') as HTMLElement;

describe('Report', () => {
  it('shows an empty state that leads back to adding an agreement', async () => {
    const { user, onAddAgreement } = setup();
    expect(screen.getByText(ui.reportEmpty)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: ui.addAgreement }));
    expect(onAddAgreement).toHaveBeenCalledOnce();
  });

  describe('offline (no AI read)', () => {
    it('says it is an offline check and claims no comparison it did not make', async () => {
      const { container } = setup(stateWith('local'));
      expect(screen.getByRole('heading', { name: ui.localModeTitle })).toBeInTheDocument();
      expect(
        within(section(ui.sectionDiffers)).getByText(ui.sectionDiffersLocal)
      ).toBeInTheDocument();
      expect(
        within(section(ui.sectionNotCovered)).getByText(ui.sectionNotCoveredLocal)
      ).toBeInTheDocument();
      // No match cards at all: nothing was compared.
      expect(within(section(ui.sectionDiffers)).queryAllByRole('article')).toHaveLength(0);
      expect(within(section(ui.sectionNotCovered)).queryAllByRole('article')).toHaveLength(0);
      await expectNoAxeViolations(container);
    });

    it('lists the sample’s rule findings, most important first, with evidence and context', async () => {
      const { user } = setup(stateWith('local'));
      const risks = within(section(ui.sectionRisks));
      const titles = risks.getAllByRole('heading', { level: 3 }).map(h => h.textContent);
      // The sample's 11 deliberate problems, plus the police-verification note for Pune (a metro).
      expect(titles).toHaveLength(12);
      expect(titles).toContain('Tenant verification');
      expect(titles.slice(0, 2)).toContain('Deposit larger than the common norm');

      const lockIn = risks.getByRole('article', { name: 'Long minimum stay' });
      expect(within(lockIn).getByText('Importance: High')).toBeInTheDocument();
      expect(
        within(lockIn).getByText(/Rules vary by state — confirm for Pune\./)
      ).toBeInTheDocument();
      await user.click(within(lockIn).getByText(/See original · Clause 3 · page 1/));
      expect(
        within(lockIn).getByRole('region', { name: 'Original text, Clause 3 · page 1' })
      ).toHaveTextContent('six (6) months');
    });
  });

  describe('with an AI read (demo sample)', () => {
    it('shows what differs, with a verified, highlighted quote', async () => {
      const { user, container } = setup(stateWith('ai'));
      expect(screen.queryByRole('heading', { name: ui.localModeTitle })).toBeNull();
      const deposit = within(section(ui.sectionDiffers)).getByRole('article', {
        name: ui['topic.deposit'],
      });
      expect(within(deposit).getByText(ui['verdict.differs'])).toBeInTheDocument();
      expect(within(deposit).getByText(ui.verifiedQuoteBadge)).toBeInTheDocument();
      await user.click(within(deposit).getByText(/See original/));
      const mark = within(deposit).getByRole('region').querySelector('mark');
      expect(mark?.textContent).toContain('Rs. 1,20,000/-');
      await expectNoAxeViolations(container);
    });

    it('lists missing protections with wording to ask for', () => {
      setup(stateWith('ai'));
      const refund = within(section(ui.sectionNotCovered)).getByRole('article', {
        name: 'When the deposit comes back',
      });
      expect(within(refund).getByText(ui['gapState.absent'])).toBeInTheDocument();
      expect(within(refund).getByText(/refunded within 15 days/)).toBeInTheDocument();
    });

    it('counts what to raise and hands off to the negotiation screen', async () => {
      const { user, onNegotiate } = setup(stateWith('ai'));
      const cta = screen.getByRole('button', { name: /things to raise/ });
      expect(cta).toBeEnabled();
      await user.click(cta);
      expect(onNegotiate).toHaveBeenCalledOnce();
    });

    it('switches tabs with the arrow keys and searches the clause list', async () => {
      const { user, container } = setup(stateWith('ai'));
      screen.getByRole('tab', { name: ui.tabGaps }).focus();
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('tab', { name: ui.tabDetails })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      expect(
        screen.getByText(`${clauses.length} of ${clauses.length} clauses shown`)
      ).toBeInTheDocument();
      await user.type(screen.getByRole('searchbox', { name: ui.searchClauses }), 'arbitration');
      expect(screen.getByRole('status')).toHaveTextContent(`1 of ${clauses.length} clauses shown`);
      await expectNoAxeViolations(container);
    });
  });
});
