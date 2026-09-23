/**
 * Ask — grounded Q&A (AI_PIPELINE §5). Every answer is verified in code: an "answered" status
 * without a verified citation arrives here already downgraded to "not in your agreement".
 * Citation chips take the user to the clause itself.
 */

import { useId, useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t, type UiKey } from '../../i18n';
import { Button } from '../../components/Button';
import { Badge, type BadgeTone } from '../../components/Badge';
import { LIMITS } from '../../core/limits';
import type { AskResult } from '../../core/types';
import { runAsk, getDefaultModel } from '../analyse/engine';
import { aiErrorMessage } from '../analyse/aiError';
import { clauseName } from '../report/clauseName';

const STATUS: Record<AskResult['status'], [BadgeTone, UiKey]> = {
  answered: ['matches', 'statusAnswered'],
  not_in_document: ['notcovered', 'statusNotInDocument'],
  needs_professional: ['differs', 'statusNeedsProfessional'],
};

/** Suggestions drawn from this user's situation; the sample gets its recorded questions. */
function suggestions(isSample: boolean, hasLockIn: boolean): UiKey[] {
  if (isSample) return ['askSuggest.leave', 'askSuggest.pet', 'askSuggest.water'];
  return [
    ...(hasLockIn ? (['askSuggest.leave'] as UiKey[]) : []),
    'askSuggest.notice',
    'askSuggest.deposit',
    'askSuggest.repairs',
    'askSuggest.pet',
  ];
}

export function AskPanel({ onShowClause }: { onShowClause: (clauseId: string) => void }) {
  const { state, dispatch } = useApp();
  const id = useId();
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doc = state.document;
  const isSample = doc.fileType === 'sample';
  const hasLockIn = (state.analysis.result?.rules ?? []).some(
    r => r.ruleId === 'IN-RENT-LOCKIN-LONG'
  );
  const canAsk = Boolean(state.key.key) || (state.demo && isSample);

  const ask = async (q: string) => {
    const text = q.trim().slice(0, LIMITS.MAX_QUESTION_CHARS);
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runAsk({
        question: text,
        clauses: doc.clauses,
        apiKey: state.key.key,
        model: getDefaultModel(),
        preferences: state.preferences,
        city: state.interview.answers.city,
        budgetUsed: state.budget.used,
        budgetLimit: state.budget.limit,
        demo: state.demo,
        isSample,
      });
      dispatch({ type: 'ADD_QA', question: text, result });
      if (state.key.key) dispatch({ type: 'INCREMENT_BUDGET' });
      setQuestion('');
    } catch (e) {
      const code = (e as { code?: string }).code;
      setError(code === 'NO_KEY' ? t('askNeedsKey') : aiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const history = [...state.qa.history].reverse();

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">{t('askTitle')}</h2>
      {!canAsk && <p className="text-sm text-muted">{t('askNeedsKey')}</p>}

      <div>
        <h3 className="mb-2 text-sm font-medium">{t('suggestedQuestions')}</h3>
        <ul className="flex flex-wrap gap-2">
          {suggestions(isSample, hasLockIn).map(key => (
            <li key={key}>
              <Button
                variant="secondary"
                size="sm"
                disabled={busy}
                onClick={() => void ask(t(key))}
              >
                {t(key)}
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <form
        onSubmit={e => {
          e.preventDefault();
          void ask(question);
        }}
        className="space-y-2"
      >
        <label htmlFor={`${id}-q`} className="block font-medium">
          {t('askLabel')}
        </label>
        <p id={`${id}-hint`} className="text-sm text-muted">
          {t('askHint')}
        </p>
        <textarea
          id={`${id}-q`}
          rows={2}
          maxLength={LIMITS.MAX_QUESTION_CHARS}
          value={question}
          aria-describedby={`${id}-hint ${id}-count`}
          onChange={e => setQuestion(e.target.value)}
          placeholder={t('askQuestionPlaceholder')}
          className="w-full rounded-lg border border-border bg-surface p-3"
        />
        <div className="flex items-center justify-between gap-2">
          <span id={`${id}-count`} className="text-xs text-muted">
            {t('askCharCount', { n: question.length, max: LIMITS.MAX_QUESTION_CHARS })}
          </span>
          <Button type="submit" disabled={!question.trim() || busy}>
            {t('askSubmit')}
          </Button>
        </div>
      </form>

      <p aria-live="polite" className={busy ? 'text-sm font-medium' : 'sr-only'}>
        {busy ? t('askThinking') : ''}
      </p>
      {error && (
        <p role="alert" className="rounded-lg border border-notcovered/40 bg-amber-50 p-3 text-sm">
          {error}
        </p>
      )}

      {history.length > 0 && (
        <section aria-labelledby={`${id}-history`} className="space-y-3">
          <h3 id={`${id}-history`} className="font-semibold">
            {t('askHistory')}
          </h3>
          {history.map(({ question: q, result }, i) => (
            <AnswerCard
              key={`${history.length - i}`}
              question={q}
              result={result}
              onShowClause={onShowClause}
            />
          ))}
        </section>
      )}
    </div>
  );
}

function AnswerCard({
  question,
  result,
  onShowClause,
}: {
  question: string;
  result: AskResult;
  onShowClause: (clauseId: string) => void;
}) {
  const { state } = useApp();
  const headingId = useId();
  const [tone, label] = STATUS[result.status];
  return (
    <article aria-labelledby={headingId} className="rounded-xl border border-border p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h4 id={headingId} className="font-medium">
          {question}
        </h4>
        <Badge tone={tone} label={t(label)} />
      </div>
      <p className="text-sm">{result.answer}</p>
      {result.status === 'needs_professional' && (
        <p className="mt-2 text-sm font-medium">{t('escalationLine')}</p>
      )}
      {result.citations.length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted">{t('askCitations')}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {result.citations.map(c => {
              const clause = state.document.clauses.find(x => x.id === c.clauseId);
              return (
                <li key={`${c.clauseId}-${c.quote}`}>
                  <button
                    type="button"
                    onClick={() => onShowClause(c.clauseId)}
                    className="min-h-[44px] rounded-full border border-primary px-3 text-sm text-primary hover:bg-green-50"
                  >
                    {clause ? clauseName(clause) : c.clauseId}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {result.missingInfo.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-medium">{t('askMissing')}</p>
          <ul className="ml-5 list-disc">
            {result.missingInfo.map(m => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
      {result.suggestedQuestions.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-medium">{t('askFollowUps')}</p>
          <ul className="ml-5 list-disc">
            {result.suggestedQuestions.map(m => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}
