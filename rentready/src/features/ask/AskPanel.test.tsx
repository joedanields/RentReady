import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProvider } from '../../state/AppProvider';
import { INITIAL_STATE } from '../../state/reducer';
import { Report } from '../report/Report';
import { ui } from '../../i18n/en';
import { analyseDocument } from '../../core/analysis';
import { parseSampleAgreement } from '../analyse/engine';
import { SAMPLE_ANALYSIS_RESPONSE, SAMPLE_DEMO_INTERVIEW_INPUT } from '../../sample/sampleData';
import type { AppState } from '../../core/types';
import { fakeKey } from '../../../tests/fakeKey';
import { expectNoAxeViolations } from '../../../tests/axe';

const sample = parseSampleAgreement();

function state({ demo = true, key = null as string | null, sampleDoc = true } = {}): AppState {
  return {
    ...structuredClone(INITIAL_STATE),
    demo,
    key: { ...INITIAL_STATE.key, key },
    document: {
      ...INITIAL_STATE.document,
      fileName: sampleDoc ? 'Sample agreement' : 'mine.pdf',
      fileType: sampleDoc ? 'sample' : 'pdf',
      clauses: sample.clauses,
      pageCount: 2,
    },
    analysis: {
      ...INITIAL_STATE.analysis,
      result: analyseDocument({
        answers: SAMPLE_DEMO_INTERVIEW_INPUT,
        clauses: sample.clauses,
        modelResponse: SAMPLE_ANALYSIS_RESPONSE,
      }),
    },
  };
}

async function openAsk(initial: AppState) {
  const user = userEvent.setup();
  const utils = render(
    <AppProvider initial={initial}>
      <Report onNegotiate={vi.fn()} onMoveIn={vi.fn()} onAddAgreement={vi.fn()} />
    </AppProvider>
  );
  await user.click(screen.getByRole('tab', { name: ui.tabAsk }));
  return { user, ...utils };
}

afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe('Ask (demo sample)', () => {
  it('answers a suggested question with a verified citation that jumps to the clause', async () => {
    const { user, container } = await openAsk(state());
    await user.click(screen.getByRole('button', { name: ui['askSuggest.leave'] }));
    const card = await screen.findByRole('article', { name: ui['askSuggest.leave'] });
    expect(within(card).getByText(ui.statusAnswered)).toBeInTheDocument();
    await expectNoAxeViolations(container);

    await user.click(within(card).getByRole('button', { name: 'Clause 3 · page 1' }));
    expect(screen.getByRole('tab', { name: ui.tabDetails })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(document.activeElement?.id).toBe('clause-c004');
  });

  it('says plainly when the agreement does not cover something', async () => {
    const { user } = await openAsk(state());
    await user.click(screen.getByRole('button', { name: ui['askSuggest.pet'] }));
    const card = await screen.findByRole('article', { name: ui['askSuggest.pet'] });
    expect(within(card).getByText(ui.statusNotInDocument)).toBeInTheDocument();
    expect(within(card).getByText(ui.askFollowUps)).toBeInTheDocument();
  });

  it('flags lawyer territory', async () => {
    const { user } = await openAsk(state());
    await user.click(screen.getByRole('button', { name: ui['askSuggest.water'] }));
    const card = await screen.findByRole('article', { name: ui['askSuggest.water'] });
    expect(within(card).getByText(ui.statusNeedsProfessional)).toBeInTheDocument();
    expect(within(card).getByText(ui.escalationLine)).toBeInTheDocument();
  });

  it('does not invent an answer to an unrecorded question without a key', async () => {
    const { user } = await openAsk(state());
    await user.type(screen.getByLabelText(ui.askLabel), 'Is parking included?');
    await user.click(screen.getByRole('button', { name: ui.askSubmit }));
    expect(await screen.findByRole('alert')).toHaveTextContent(ui.askNeedsKey);
    expect(screen.queryByRole('article', { name: 'Is parking included?' })).toBeNull();
  });
});

describe('Ask (live)', () => {
  it('downgrades an "answered" reply whose citation does not verify', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              candidates: [
                {
                  content: {
                    parts: [
                      {
                        text: JSON.stringify({
                          status: 'answered',
                          answer: 'Yes, parking is included.',
                          citations: [
                            { clauseId: 'c002', quote: 'one covered parking slot is included' },
                          ],
                          missingInfo: [],
                          suggestedQuestions: [],
                        }),
                      },
                    ],
                  },
                },
              ],
            })
          )
      )
    );
    const { user } = await openAsk(state({ demo: false, key: fakeKey(), sampleDoc: false }));
    await user.type(screen.getByLabelText(ui.askLabel), 'Is parking included?');
    await user.click(screen.getByRole('button', { name: ui.askSubmit }));
    const card = await screen.findByRole('article', { name: 'Is parking included?' });
    expect(within(card).getByText(ui.statusNotInDocument)).toBeInTheDocument();
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('explains that asking needs a key when there is none', async () => {
    await openAsk(state({ demo: false, sampleDoc: false }));
    expect(screen.getByText(ui.askNeedsKey)).toBeInTheDocument();
  });
});
