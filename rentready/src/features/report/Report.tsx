/**
 * Report — evidence beside every claim (UX_FLOW §5–6). Verdicts, states and rule text all come
 * from src/core; this file only presents them. In local mode (no AI read) it says so plainly
 * and never implies that something was compared or checked when it wasn't.
 */

import { useEffect, useId, useMemo, useState } from 'react';
import { AskPanel } from '../ask/AskPanel';
import { useApp } from '../../state/AppProvider';
import { t, type UiKey } from '../../i18n';
import { Tabs } from '../../components/Tabs';
import { Badge, type BadgeTone } from '../../components/Badge';
import { Mark } from '../../components/Mark';
import { Button } from '../../components/Button';
import { clauseName } from './clauseName';
import type {
  AnalysisResult,
  Clause,
  GapRow,
  MatchRow,
  RuleHit,
  Severity,
  VerifiedQuote,
} from '../../core/types';

const SEVERITY_ORDER: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, INFO: 2 };
const SEVERITY_TONE: Record<Severity, BadgeTone> = { HIGH: 'high', MEDIUM: 'medium', INFO: 'info' };
const VERDICT_TONE: Record<MatchRow['verdict'], BadgeTone> = {
  matches: 'matches',
  differs: 'differs',
  not_covered: 'notcovered',
  unclear: 'unclear',
};
const GAP_TONE: Record<GapRow['state'], BadgeTone> = {
  present: 'present',
  absent: 'absent',
  unclear: 'unclear',
};

export function Report({
  onNegotiate,
  onMoveIn,
  onAddAgreement,
}: {
  onNegotiate: () => void;
  onMoveIn: () => void;
  onAddAgreement: () => void;
}) {
  const { state } = useApp();
  const analysis = state.analysis.result;
  const [activeTab, setActiveTab] = useState('gaps');
  // Set by a citation chip in Ask: open Details and move focus to that clause.
  const [focusClause, setFocusClause] = useState<string | null>(null);

  if (!analysis) {
    return (
      <section aria-labelledby="report-title" className="space-y-4 pt-2">
        <h1 id="report-title" className="text-2xl font-semibold">
          {t('reportTitle')}
        </h1>
        <p className="text-muted">{t('reportEmpty')}</p>
        <Button onClick={onAddAgreement}>{t('addAgreement')}</Button>
      </section>
    );
  }

  const clauses = state.document.clauses;
  const local = analysis.mode === 'local';
  const differs = analysis.matches.filter(m => m.verdict === 'differs');
  const notCoveredMatches = analysis.matches.filter(m => m.verdict === 'not_covered');
  const absentGaps = analysis.gaps.filter(g => g.state === 'absent');
  const rules = [...analysis.rules].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
  );
  const toRaise = differs.length + notCoveredMatches.length + absentGaps.length;

  return (
    <section aria-labelledby="report-title" className="space-y-5 pt-2 pb-24">
      <div>
        <h1 id="report-title" className="text-2xl font-semibold">
          {t('reportTitle')}
        </h1>
        {state.document.fileName && (
          <p className="text-sm text-muted">
            {t('reportFor', { name: state.document.fileName })}
            {state.document.fileType === 'sample' && (
              <Badge tone="info" label={t('demoSampleBadge')} className="ml-2" />
            )}
          </p>
        )}
      </div>

      {analysis.fallback && (
        <p role="alert" className="rounded-lg border border-notcovered/40 bg-amber-50 p-3 text-sm">
          {t('reportFallback')}
        </p>
      )}

      {local && (
        <div className="rounded-xl border border-border bg-gray-50 p-4">
          <h2 className="font-semibold">{t('localModeTitle')}</h2>
          <p className="mt-1 text-sm text-muted">{t('localModeBody')}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={onAddAgreement}>
            {t('addKeyCta')}
          </Button>
        </div>
      )}

      {analysis.overview && <p className="text-muted">{analysis.overview}</p>}

      <dl aria-label={t('reportCounts')} className="grid grid-cols-3 gap-2">
        <Count value={local ? '—' : differs.length} label={t('countDiffers')} />
        <Count
          value={local ? '—' : notCoveredMatches.length + absentGaps.length}
          label={t('countNotCovered')}
        />
        <Count value={rules.length} label={t('countRisks')} />
      </dl>

      <Tabs
        label={t('reportTabsLabel')}
        idPrefix="report"
        tabs={[
          { id: 'gaps', label: t('tabGaps'), controlId: 'report-panel' },
          { id: 'details', label: t('tabDetails'), controlId: 'report-panel' },
          { id: 'ask', label: t('tabAsk'), controlId: 'report-panel' },
        ]}
        activeId={activeTab}
        onChange={setActiveTab}
      >
        {activeTab === 'gaps' ? (
          <div className="space-y-4">
            <ReportSection
              title={t('sectionDiffers')}
              empty={local ? t('sectionDiffersLocal') : t('sectionDiffersEmpty')}
            >
              {differs.map(row => (
                <MatchCard key={row.key} row={row} clauses={clauses} />
              ))}
            </ReportSection>
            <ReportSection
              title={t('sectionNotCovered')}
              empty={local ? t('sectionNotCoveredLocal') : t('sectionNotCoveredEmpty')}
            >
              {notCoveredMatches.map(row => (
                <MatchCard key={row.key} row={row} clauses={clauses} />
              ))}
              {absentGaps.map(gap => (
                <GapCard key={gap.id} gap={gap} clauses={clauses} local={local} />
              ))}
            </ReportSection>
            <ReportSection title={t('sectionRisks')} empty={t('sectionRisksEmpty')}>
              {rules.map(rule => (
                <RuleCard
                  key={rule.ruleId}
                  rule={rule}
                  clauses={clauses}
                  city={state.interview.answers.city}
                />
              ))}
            </ReportSection>
          </div>
        ) : activeTab === 'ask' ? (
          <AskPanel
            onShowClause={clauseId => {
              setFocusClause(clauseId);
              setActiveTab('details');
            }}
          />
        ) : (
          <DetailsPanel
            analysis={analysis}
            clauses={clauses}
            local={local}
            focusClause={focusClause}
            onFocused={() => setFocusClause(null)}
          />
        )}
      </Tabs>

      <div className="fixed inset-x-0 bottom-0 border-t border-border bg-surface/95 p-3 print:hidden">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
          <Button variant="secondary" onClick={onMoveIn}>
            {t('moveInKit')}
          </Button>
          <Button onClick={onNegotiate} disabled={toRaise === 0}>
            {t('thingsToRaiseCta', { n: toRaise })} → {t('buildMessage')}
          </Button>
        </div>
      </div>
    </section>
  );
}

function Count({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="flex flex-col-reverse rounded-xl border border-border p-3 text-center">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}

/** A collapsible, open-by-default report section that says so when it is empty. */
function ReportSection({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  const items = children.flat().filter(Boolean);
  return (
    <details open className="group rounded-xl">
      <summary className="flex min-h-[44px] cursor-pointer items-center gap-2">
        <h2 className="text-lg font-semibold">
          {title} <span className="text-muted">({items.length})</span>
        </h2>
      </summary>
      <div className="mt-2 space-y-3">
        {items.length > 0 ? items : <p className="text-sm text-muted">{empty}</p>}
      </div>
    </details>
  );
}

/** "See original": the clause text with the quote highlighted, as a labelled region. */
function OriginalText({ clause, evidence }: { clause: Clause; evidence?: VerifiedQuote | null }) {
  const name = clauseName(clause);
  return (
    <details className="mt-2">
      <summary className="min-h-[44px] cursor-pointer py-2 text-sm font-medium text-primary">
        {t('seeOriginal')} · {name}
      </summary>
      <section
        aria-label={t('originalTextLabel', { clause: name })}
        className="max-h-72 overflow-y-auto whitespace-pre-line rounded-lg bg-gray-50 p-3 text-sm"
      >
        {evidence && evidence.status !== 'unverified' ? (
          <Mark
            text={clause.text}
            highlight={evidence.quote}
            start={evidence.start}
            end={evidence.end}
          />
        ) : (
          clause.text
        )}
      </section>
    </details>
  );
}

function EvidenceBadge({ evidence }: { evidence: VerifiedQuote }) {
  const [tone, key]: [BadgeTone, UiKey] =
    evidence.status === 'verified'
      ? ['verified', 'verifiedQuoteBadge']
      : evidence.status === 'fuzzy'
        ? ['fuzzy', 'fuzzyQuoteBadge']
        : ['unverified', 'unverifiedQuoteBadge'];
  return <Badge tone={tone} label={t(key)} />;
}

function MatchCard({ row, clauses }: { row: MatchRow; clauses: Clause[] }) {
  const headingId = useId();
  const clause = row.evidence ? clauses.find(c => c.id === row.evidence?.clauseId) : undefined;
  return (
    <article aria-labelledby={headingId} className="rounded-xl border border-border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-medium">
          {t(`topic.${row.key}`)}
        </h3>
        <Badge tone={VERDICT_TONE[row.verdict]} label={t(`verdict.${row.verdict}`)} />
      </div>
      <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
        <dt className="text-muted">{t('youSaid')}</dt>
        <dd className="break-words">{row.agreed}</dd>
        {row.written && (
          <>
            <dt className="text-muted">{t('agreementSays')}</dt>
            <dd className="break-words">{row.written}</dd>
          </>
        )}
      </dl>
      {row.note && <p className="mt-2 text-sm">{row.note}</p>}
      {row.evidence && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <EvidenceBadge evidence={row.evidence} />
        </div>
      )}
      {clause && <OriginalText clause={clause} evidence={row.evidence} />}
      {row.suggestedQuestion && (
        <p className="mt-2 text-sm">
          <span className="font-medium">{t('questionsToAsk')}: </span>
          {row.suggestedQuestion}
        </p>
      )}
    </article>
  );
}

function GapCard({ gap, clauses, local }: { gap: GapRow; clauses: Clause[]; local: boolean }) {
  const headingId = useId();
  const clause = gap.evidence ? clauses.find(c => c.id === gap.evidence?.clauseId) : undefined;
  const stateLabel = local ? t('gapState.unchecked') : t(`gapState.${gap.state}`);
  return (
    <article aria-labelledby={headingId} className="rounded-xl border border-border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-medium">
          {gap.title}
        </h3>
        <Badge tone={local ? 'unclear' : GAP_TONE[gap.state]} label={stateLabel} />
      </div>
      <p className="text-sm text-muted">
        <span className="font-medium">{t('whyItMatters')}: </span>
        {gap.whyItMatters}
      </p>
      {gap.state === 'absent' && gap.requestWording && (
        <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm">
          {t('requestWordingLabel')}: “{gap.requestWording}”
        </p>
      )}
      {gap.evidence && (
        <div className="mt-2">
          <EvidenceBadge evidence={gap.evidence} />
        </div>
      )}
      {clause && <OriginalText clause={clause} evidence={gap.evidence} />}
    </article>
  );
}

function RuleCard({
  rule,
  clauses,
  city,
}: {
  rule: RuleHit;
  clauses: Clause[];
  city: string | null;
}) {
  const headingId = useId();
  const clause = clauses.find(c => c.id === rule.clauseId);
  return (
    <article aria-labelledby={headingId} className="rounded-xl border border-border p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 id={headingId} className="font-medium">
          {rule.title}
        </h3>
        <Badge
          tone={SEVERITY_TONE[rule.severity]}
          label={t('severityLabel', { level: t(`severity.${rule.severity}`) })}
        />
      </div>
      <p className="text-sm">{rule.message}</p>
      {clause && <OriginalText clause={clause} />}
      {rule.questions.length > 0 && (
        <div className="mt-2 text-sm">
          <p className="font-medium">{t('questionsToAsk')}</p>
          <ul className="ml-5 list-disc">
            {rule.questions.map(q => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-2 text-xs text-muted">
        {city ? t('stateVaries', { city }) : t('stateVariesUnknown')}{' '}
        {t('lastReviewed', { date: rule.lastReviewed })}
      </p>
      <p className="mt-1 text-xs text-muted">{t('basisLabel', { basis: rule.basis })}</p>
    </article>
  );
}

function DetailsPanel({
  analysis,
  clauses,
  local,
  focusClause = null,
  onFocused,
}: {
  analysis: AnalysisResult;
  clauses: Clause[];
  local: boolean;
  focusClause?: string | null;
  onFocused?: () => void;
}) {
  const [query, setQuery] = useState('');
  const searchId = useId();

  useEffect(() => {
    if (!focusClause) return;
    const el = document.getElementById(`clause-${focusClause}`);
    el?.scrollIntoView?.({ block: 'start' });
    el?.focus();
    onFocused?.();
  }, [focusClause, onFocused]);

  // Which findings cite each clause, so the full list shows why a clause matters.
  const findings = useMemo(() => {
    const byClause = new Map<string, string[]>();
    const add = (id: string | null | undefined, label: string) => {
      if (!id) return;
      byClause.set(id, [...(byClause.get(id) ?? []), label]);
    };
    for (const m of analysis.matches) add(m.evidence?.clauseId, t(`topic.${m.key}`));
    for (const g of analysis.gaps) add(g.evidence?.clauseId, g.title);
    for (const r of analysis.rules) add(r.clauseId, r.title);
    return byClause;
  }, [analysis]);

  const q = query.trim().toLowerCase();
  const shown = q ? clauses.filter(c => c.text.toLowerCase().includes(q)) : clauses;

  return (
    <div className="space-y-6">
      {analysis.matches.length > 0 && (
        <section aria-labelledby="details-matches">
          <h2 id="details-matches" className="mb-2 text-lg font-semibold">
            {t('youSaid')}
          </h2>
          <div className="space-y-3">
            {analysis.matches.map(row => (
              <MatchCard key={row.key} row={row} clauses={clauses} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="details-checklist">
        <h2 id="details-checklist" className="mb-2 text-lg font-semibold">
          {t('fullChecklist')}
        </h2>
        {local && <p className="mb-2 text-sm text-muted">{t('sectionNotCoveredLocal')}</p>}
        <div className="space-y-3">
          {analysis.gaps.map(gap => (
            <GapCard key={gap.id} gap={gap} clauses={clauses} local={local} />
          ))}
        </div>
      </section>

      <section aria-labelledby="details-clauses">
        <h2 id="details-clauses" className="mb-2 text-lg font-semibold">
          {t('fullClauseList')}
        </h2>
        <label htmlFor={searchId} className="text-sm font-medium">
          {t('searchClauses')}
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="mt-1 mb-2 min-h-[44px] w-full rounded-lg border border-border bg-surface px-3"
        />
        <p role="status" className="mb-2 text-sm text-muted">
          {t('clausesShown', { shown: shown.length, total: clauses.length })}
        </p>
        <ol className="space-y-2 text-sm">
          {shown.map(c => {
            const cited = findings.get(c.id);
            return (
              <li
                key={c.id}
                id={`clause-${c.id}`}
                tabIndex={-1}
                className="scroll-mt-24 rounded-lg border border-border p-3"
              >
                <p className="text-xs font-medium text-muted">{clauseName(c)}</p>
                <p className="mt-1 whitespace-pre-line break-words">{c.text}</p>
                {cited && (
                  <p className="mt-1 text-xs text-primary">
                    {t('findingsForClause', { items: cited.join(', ') })}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
