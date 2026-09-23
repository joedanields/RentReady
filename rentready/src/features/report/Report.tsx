/** Report — the core surface. Judge the verdict; show clause + quote; explain plain-English. */

import { useMemo, useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { Tabs } from '../../components/Tabs';
import { Badge } from '../../components/Badge';
import { Mark } from '../../components/Mark';
import { Button } from '../../components/Button';
import type {
  AnalysisResult,
  MatchRow,
  GapRow,
  RuleHit,
  Clause,
  VerifiedQuote,
  AskResult,
} from '../../core/types';
import { topicLabel, verdictWord } from './labels';

export function Report({
  onNegotiate,
  onMoveIn,
}: {
  onNegotiate: () => void;
  onMoveIn: () => void;
}) {
  const { state } = useApp();
  const analysis = state.analysis.result;
  const [activeTab, setActiveTab] = useState('gaps');

  const differs = (analysis?.matches ?? []).filter(m => m.verdict === 'differs');
  const notCovered = (analysis?.matches ?? []).filter(m => m.verdict === 'not_covered');
  const gaps = (analysis?.gaps ?? []).filter(g => g.state === 'absent');

  const rowsToRaise = useMemo(
    () => [...differs.map(m => `match-${m.key}`), ...gaps.map(g => `gap-${g.id}`)],
    [differs, gaps]
  );

  if (!analysis) {
    return (
      <section className="pt-6 text-center text-muted">
        <p>No analysis yet. Add your agreement first.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="report-title" className="space-y-5 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 id="report-title" className="text-2xl font-semibold">
          {t('tabGaps')}
        </h1>
        <div className="flex gap-2">
          <Button size="sm" onClick={onNegotiate} disabled={rowsToRaise.length === 0}>
            {t('negotiateTitle')} · {rowsToRaise.length}
          </Button>
          <Button size="sm" variant="secondary" onClick={onMoveIn}>
            {t('moveInKit')}
          </Button>
        </div>
      </div>

      {analysis.overview && (
        <p className="rounded-xl border border-border bg-gray-50 p-4 text-sm text-muted">
          {analysis.overview}
        </p>
      )}

      <SummaryRow analysis={analysis} />

      <Tabs
        tabs={[
          { id: 'gaps', label: `${t('tabGaps')} (${rowsToRaise.length})`, controlId: 'panel-gaps' },
          { id: 'details', label: t('tabDetails'), controlId: 'panel-details' },
          { id: 'ask', label: t('tabAsk'), controlId: 'panel-ask' },
        ]}
        activeId={activeTab}
        onChange={setActiveTab}
      >
        {activeTab === 'gaps' && (
          <GapsPanel
            differs={differs}
            gaps={gaps}
            notCovered={notCovered}
            rules={analysis.rules}
            clauses={state.document.clauses}
          />
        )}
        {activeTab === 'details' && (
          <DetailsPanel analysis={analysis} clauses={state.document.clauses} />
        )}
        {activeTab === 'ask' && <AskPanel />}
      </Tabs>
    </section>
  );
}

function SummaryRow({ analysis }: { analysis: AnalysisResult }) {
  const differsCount = analysis.matches.filter(m => m.verdict === 'differs').length;
  const absentGaps = analysis.gaps.filter(g => g.state === 'absent').length;
  return (
    <div aria-label="Summary" className="grid grid-cols-3 gap-2">
      <div className="rounded-xl border border-border p-3 text-center">
        <div className="text-2xl font-semibold text-red-700">{differsCount}</div>
        <div className="text-xs text-muted">{t('sectionDiffers')}</div>
      </div>
      <div className="rounded-xl border border-border p-3 text-center">
        <div className="text-2xl font-semibold text-amber-700">{absentGaps}</div>
        <div className="text-xs text-muted">{t('fullChecklist')}</div>
      </div>
      <div className="rounded-xl border border-border p-3 text-center">
        <div className="text-2xl font-semibold text-amber-700">{analysis.rules.length}</div>
        <div className="text-xs text-muted">{t('sectionRisks')}</div>
      </div>
    </div>
  );
}

function GapsPanel({
  differs,
  gaps,
  notCovered,
  rules,
  clauses,
}: {
  differs: MatchRow[];
  gaps: GapRow[];
  notCovered: MatchRow[];
  rules: RuleHit[];
  clauses: Clause[];
}) {
  return (
    <div className="space-y-6">
      {differs.length > 0 && (
        <section aria-labelledby="differs-heading">
          <h2 id="differs-heading" className="mb-2 font-semibold text-red-700">
            {t('sectionDiffers')}
          </h2>
          <div className="space-y-3">
            {differs.map(row => (
              <MatchCard key={row.key} row={row} />
            ))}
          </div>
        </section>
      )}

      {gaps.length > 0 && (
        <section aria-labelledby="gaps-heading">
          <h2 id="gaps-heading" className="mb-2 font-semibold text-amber-700">
            {t('sectionNotCovered')}
          </h2>
          <div className="space-y-3">
            {gaps.map(gap => (
              <GapCard key={gap.id} gap={gap} />
            ))}
          </div>
        </section>
      )}

      {notCovered.length > 0 && (
        <section aria-labelledby="notcovered-heading">
          <h2 id="notcovered-heading" className="mb-2 font-semibold text-muted">
            {t('sectionRisks')}
          </h2>
          <div className="space-y-3">
            {notCovered.map(row => (
              <MatchCard key={row.key} row={row} subdued />
            ))}
          </div>
        </section>
      )}

      {rules.length > 0 && (
        <section aria-labelledby="rules-heading">
          <h2 id="rules-heading" className="mb-2 font-semibold text-amber-700">
            {t('sectionRisks')}
          </h2>
          <div className="space-y-3">
            {rules.map(rule => (
              <RuleCard key={rule.ruleId} rule={rule} clauses={clauses} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function MatchCard({ row, subdued }: { row: MatchRow; subdued?: boolean }) {
  const tone =
    row.verdict === 'matches'
      ? 'matches'
      : row.verdict === 'differs'
        ? 'differs'
        : row.verdict === 'not_covered'
          ? 'notcovered'
          : 'unclear';

  return (
    <article className={`rounded-xl border border-border p-4 ${subdued ? 'opacity-70' : ''}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-medium">{topicLabel(row.key)}</h3>
        <Badge tone={tone} label={verdictWord(row.verdict)} />
      </div>

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 text-muted">{t('youSaid')}:</dt>
          <dd>{row.agreed}</dd>
        </div>
        {row.written && (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 text-muted">{t('agreementSays')}:</dt>
            <dd>
              {row.evidence ? (
                <Mark text={row.written} highlight={row.evidence.quote} />
              ) : (
                row.written
              )}
            </dd>
          </div>
        )}
      </dl>

      {row.note && <p className="mt-2 text-sm text-muted">{row.note}</p>}
      {row.evidence && <EvidenceRow evidence={row.evidence} />}
      {row.suggestedQuestion && (
        <p className="mt-2 text-sm text-primary">
          {t('askForThis')}: «{row.suggestedQuestion}»
        </p>
      )}
    </article>
  );
}

function EvidenceRow({ evidence }: { evidence: VerifiedQuote }) {
  return (
    <div className="mt-2 rounded-lg bg-gray-50 p-2 text-sm">
      <div className="mb-1 flex items-center gap-2">
        <Badge
          tone={
            evidence.status === 'verified'
              ? 'verified'
              : evidence.status === 'fuzzy'
                ? 'fuzzy'
                : 'unverified'
          }
          label={
            evidence.status === 'verified'
              ? t('verifiedQuoteBadge')
              : evidence.status === 'fuzzy'
                ? t('fuzzyQuoteBadge')
                : t('unverifiedQuoteBadge')
          }
        />
        <span className="text-xs text-muted">{evidence.clauseId}</span>
      </div>
      <blockquote className="border-l-2 border-primary pl-2 text-muted">
        “{evidence.quote}”
      </blockquote>
    </div>
  );
}

function GapCard({ gap }: { gap: GapRow }) {
  const tone = gap.state === 'absent' ? 'absent' : gap.state === 'present' ? 'present' : 'unclear';
  return (
    <article className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-medium">{gap.title}</h3>
        <Badge
          tone={tone}
          label={
            gap.state === 'absent' ? 'Missing' : gap.state === 'present' ? 'Covered' : 'Unclear'
          }
        />
      </div>
      <p className="text-sm text-muted">{gap.whyItMatters}</p>
      {gap.state === 'absent' && gap.requestWording && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm">
          {t('requestWordingLabel')}: “{gap.requestWording}”
        </p>
      )}
      {gap.evidence && <EvidenceRow evidence={gap.evidence} />}
    </article>
  );
}

function RuleCard({ rule, clauses }: { rule: RuleHit; clauses: Clause[] }) {
  const clause = clauses.find(c => c.id === rule.clauseId);
  return (
    <article className="rounded-xl border border-border p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="font-medium">{rule.title}</h3>
        <Badge tone={rule.severity === 'HIGH' ? 'high' : 'medium'} label={rule.severity} />
      </div>
      <p className="text-sm text-muted">{rule.message}</p>
      {rule.basis && <p className="mt-1 text-xs text-muted">{rule.basis}</p>}
      {clause && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-primary">{t('seeOriginal')}</summary>
          <p className="mt-2 rounded-lg bg-gray-50 p-2 text-sm">
            {clause.label ? `[${clause.label}] ` : ''}
            {clause.text}
          </p>
        </details>
      )}
    </article>
  );
}

function DetailsPanel({ analysis, clauses }: { analysis: AnalysisResult; clauses: Clause[] }) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="matches-heading">
        <h2 id="matches-heading" className="mb-2 font-semibold">
          {t('tabDetails')}
        </h2>
        {analysis.matches.length === 0 && (
          <p className="text-sm text-muted">{t('notCoveredLine')}</p>
        )}
        <div className="space-y-3">
          {analysis.matches.map(row => (
            <MatchCard key={row.key} row={row} />
          ))}
        </div>
      </section>

      <section aria-labelledby="full-checklist-heading">
        <h2 id="full-checklist-heading" className="mb-2 font-semibold">
          {t('fullChecklist')}
        </h2>
        <div className="space-y-3">
          {analysis.gaps.map(gap => (
            <GapCard key={gap.id} gap={gap} />
          ))}
        </div>
      </section>

      {clauses.length > 0 && (
        <section aria-labelledby="clauses-heading">
          <h2 id="clauses-heading" className="mb-2 font-semibold">
            {t('fullClauseList')} ({clauses.length})
          </h2>
          <ol className="space-y-2 text-sm">
            {clauses.map(c => (
              <li key={c.id} className="rounded-lg border border-border p-2">
                <span className="text-xs text-muted">
                  {c.id}
                  {c.label ? ` · [${c.label}]` : ''}
                  {c.page ? ` · p.${c.page}` : ''}
                </span>
                <p className="mt-1">{c.text}</p>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function AskPanel() {
  const { state, dispatch } = useApp();
  const { history } = state.qa;
  const [q, setQ] = useState('');
  const [answer, setAnswer] = useState<AskResult | null>(null);

  const ask = () => {
    if (!q.trim()) return;
    const result: AskResult = {
      status: 'not_in_document',
      answer:
        'Demo mode: ask this with your Gemini key, or keep it local. Re-run the analysis with a key to unlock full Ask.',
      citations: [],
      missingInfo: [],
      suggestedQuestions: [],
    };
    dispatch({ type: 'ADD_QA', question: q.trim(), result });
    setAnswer(result);
    setQ('');
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={e => {
          e.preventDefault();
          ask();
        }}
        className="flex gap-2"
      >
        <label htmlFor="ask-question" className="sr-only">
          {t('askQuestionPlaceholder')}
        </label>
        <input
          id="ask-question"
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder={t('askQuestionPlaceholder')}
          className="min-h-[44px] flex-1 rounded-lg border border-border px-3"
        />
        <Button type="submit" disabled={!q.trim()}>
          {t('next')}
        </Button>
      </form>

      {answer && (
        <article className="rounded-xl border border-border p-4">
          <Badge tone="notcovered" label={t('statusNotInDocument')} />
          <p className="mt-2 text-sm">{answer.answer}</p>
        </article>
      )}

      {history.length === 0 && answer === null && (
        <p className="text-sm text-muted">{t('disconnected')}</p>
      )}
    </div>
  );
}
