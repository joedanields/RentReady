/**
 * Negotiation pack (UX_FLOW §8): choose what to raise, tone and channel; an editable message
 * built locally (works offline); optional AI polish; copy, share or download as Markdown.
 * Suggested wording is always labelled as a starting point, not legal drafting.
 */

import { useEffect, useId, useMemo, useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { Button } from '../../components/Button';
import { buildNegotiationLocal } from '../../core/negotiation/builder';
import { getDefaultModel } from '../analyse/engine';
import { aiErrorMessage } from '../analyse/aiError';
import { generateContent, repairJson } from '../../core/gemini/client';
import { buildNegotiationUserPrompt, buildSystemPreamble } from '../../core/gemini/prompts';
import { NEGOTIATION_SCHEMA } from '../../core/gemini/responseSchemas';
import { validateModelNegotiation } from '../../core/schemas';
import { LIMITS } from '../../core/limits';
import type { AnalysisResult, NegotiationResult } from '../../core/types';

interface Raisable {
  id: string;
  label: string;
  high: boolean;
}

/** Everything the report found that is worth raising, HIGH items first. */
export function raisableRows(analysis: AnalysisResult): Raisable[] {
  const rows: Raisable[] = [
    ...analysis.matches
      .filter(m => m.verdict === 'differs' || m.verdict === 'not_covered')
      .map(m => ({
        id: `match-${m.key}`,
        label: `${t(`topic.${m.key}`)} — ${t(`verdict.${m.verdict}`)}`,
        high: m.severity === 'HIGH',
      })),
    ...analysis.gaps
      .filter(g => g.state === 'absent')
      .map(g => ({ id: `gap-${g.id}`, label: g.title, high: false })),
    ...analysis.rules
      .filter(r => r.severity !== 'INFO')
      .map(r => ({ id: `rule-${r.ruleId}`, label: r.title, high: r.severity === 'HIGH' })),
  ];
  return rows.sort((a, b) => Number(b.high) - Number(a.high));
}

/** The pack as Markdown: message, wording per item, disclaimer. Never includes the key. */
export function negotiationMarkdown(message: string, result: NegotiationResult): string {
  const wording = result.items.map(i => `- **${i.ask}**\n  ${i.suggestedWording}`).join('\n');
  return [
    '# RentReady — message to the owner',
    '',
    message,
    '',
    `## ${t('negotiateWordingTitle')}`,
    '',
    wording,
    '',
    `_${t('mdDisclaimer')}_`,
    '',
  ].join('\n');
}

export function Negotiate({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useApp();
  const id = useId();
  const analysis = state.analysis.result;
  const { selectedRows, tone, channel } = state.negotiation;
  const [message, setMessage] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => (analysis ? raisableRows(analysis) : []), [analysis]);

  // Pre-tick HIGH items (or everything, if nothing is HIGH) the first time.
  useEffect(() => {
    if (rows.length > 0 && selectedRows.length === 0) {
      const high = rows.filter(r => r.high).map(r => r.id);
      dispatch({
        type: 'SET_NEGOTIATION_SELECTION',
        rows: high.length ? high : rows.map(r => r.id),
      });
    }
  }, [rows, selectedRows.length, dispatch]);

  const local = useMemo(
    () =>
      analysis
        ? buildNegotiationLocal({
            matches: analysis.matches,
            gaps: analysis.gaps,
            rules: analysis.rules,
            clauses: state.document.clauses,
            selectedRowIds: selectedRows,
            tone,
            channel,
          })
        : null,
    [analysis, state.document.clauses, selectedRows, tone, channel]
  );

  // A new selection, tone or channel redrafts the message (edits are to the current draft).
  useEffect(() => {
    if (local) {
      dispatch({ type: 'SET_NEGOTIATION_RESULT', result: local });
      setMessage(local.message);
    }
  }, [local, dispatch]);

  if (!analysis) {
    return (
      <section aria-labelledby="negotiate-title" className="space-y-4 pt-2">
        <h1 id="negotiate-title" className="text-2xl font-semibold">
          {t('negotiateTitle')}
        </h1>
        <p className="text-muted">{t('negotiateEmpty')}</p>
        <Button onClick={onBack}>{t('back')}</Button>
      </section>
    );
  }

  const result = state.negotiation.result ?? local;
  const toggle = (rowId: string) =>
    dispatch({
      type: 'SET_NEGOTIATION_SELECTION',
      rows: selectedRows.includes(rowId)
        ? selectedRows.filter(x => x !== rowId)
        : [...selectedRows, rowId],
    });

  const polish = async () => {
    if (!state.key.key) {
      setError(t('negotiatePolishNeedsKey'));
      return;
    }
    if (!local || local.items.length === 0 || polishing) return;
    setPolishing(true);
    setError(null);
    try {
      const { text } = await generateContent({
        model: getDefaultModel(),
        apiKey: state.key.key,
        system: buildSystemPreamble({
          language: state.preferences.language,
          readingLevel: state.preferences.readingLevel,
          city: state.interview.answers.city,
        }),
        userPrompt: buildNegotiationUserPrompt(
          local.items.map(i => ({ rowId: i.rowId, ask: i.ask, reason: i.reason })),
          tone,
          channel
        ),
        responseSchema: NEGOTIATION_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: LIMITS.MAX_SMALL_CALL_TOKENS,
      });
      const parsed = validateModelNegotiation(JSON.parse(repairJson(text)));
      // Keep only items that were actually selected; the model cannot add new asks.
      const items = parsed.items.filter(i => selectedRows.includes(i.rowId));
      dispatch({ type: 'SET_NEGOTIATION_RESULT', result: { message: parsed.message, items } });
      setMessage(parsed.message);
      dispatch({ type: 'INCREMENT_BUDGET' });
    } catch (e) {
      setError(
        e instanceof SyntaxError || (e as { name?: string }).name === 'ZodError'
          ? aiErrorMessage({ code: 'MODEL_INVALID_OUTPUT' })
          : aiErrorMessage(e)
      );
    } finally {
      setPolishing(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setStatus(t('copied'));
    } catch {
      setError(t('copyFailed'));
    }
  };

  const share = async () => {
    if (typeof navigator.share !== 'function') {
      setError(t('shareUnavailable'));
      return;
    }
    try {
      await navigator.share({ text: message });
    } catch {
      // The user closed the share sheet; nothing to report.
    }
  };

  const download = () => {
    if (!result) return;
    const blob = new Blob([negotiationMarkdown(message, result)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rentready-message.md';
    a.click();
    URL.revokeObjectURL(url);
    setStatus(t('downloaded'));
  };

  const radio = <T extends string>(
    name: string,
    value: T,
    current: T,
    label: string,
    set: (v: T) => void
  ) => (
    <label
      key={value}
      className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-3 has-[:checked]:border-primary has-[:checked]:bg-green-50"
    >
      <input
        type="radio"
        name={name}
        checked={current === value}
        onChange={() => set(value)}
        className="h-5 w-5 accent-primary"
      />
      {label}
    </label>
  );

  return (
    <section aria-labelledby="negotiate-title" className="space-y-5 pt-2">
      <div>
        <h1 id="negotiate-title" className="text-2xl font-semibold">
          {t('negotiateTitle')}
        </h1>
        <p className="text-muted">{t('negotiateIntro')}</p>
      </div>

      <fieldset className="space-y-2">
        <legend className="mb-1 font-semibold">{t('negotiatePick')}</legend>
        {rows.length === 0 && <p className="text-sm text-muted">{t('negotiateEmpty')}</p>}
        {rows.map(r => (
          <label
            key={r.id}
            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2"
          >
            <input
              type="checkbox"
              checked={selectedRows.includes(r.id)}
              onChange={() => toggle(r.id)}
              className="h-5 w-5 shrink-0 accent-primary"
            />
            <span className="text-sm">{r.label}</span>
          </label>
        ))}
      </fieldset>

      <div className="flex flex-col gap-4 sm:flex-row">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('tone')}</legend>
          <div className="flex gap-2">
            {radio(`${id}-tone`, 'polite', tone, t('tonePolite'), v =>
              dispatch({ type: 'SET_NEGOTIATION_TONE', tone: v })
            )}
            {radio(`${id}-tone`, 'direct', tone, t('toneDirect'), v =>
              dispatch({ type: 'SET_NEGOTIATION_TONE', tone: v })
            )}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('channel')}</legend>
          <div className="flex gap-2">
            {radio(`${id}-channel`, 'whatsapp', channel, t('channelWhatsApp'), v =>
              dispatch({ type: 'SET_NEGOTIATION_CHANNEL', channel: v })
            )}
            {radio(`${id}-channel`, 'email', channel, t('channelEmail'), v =>
              dispatch({ type: 'SET_NEGOTIATION_CHANNEL', channel: v })
            )}
          </div>
        </fieldset>
      </div>

      {message && (
        <div className="space-y-2">
          <label htmlFor={`${id}-message`} className="block font-semibold">
            {t('generatedMessage')}
          </label>
          <p id={`${id}-message-hint`} className="text-sm text-muted">
            {t('editMessage')}
          </p>
          <textarea
            id={`${id}-message`}
            value={message}
            aria-describedby={`${id}-message-hint`}
            onChange={e => setMessage(e.target.value)}
            className="min-h-[220px] w-full rounded-lg border border-border bg-surface p-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void copy()}>{t('copy')}</Button>
            <Button variant="secondary" onClick={() => void share()}>
              {t('share')}
            </Button>
            <Button variant="secondary" onClick={download}>
              {t('downloadMd')}
            </Button>
            <Button variant="ghost" onClick={() => void polish()} disabled={polishing}>
              {polishing ? t('negotiatePolishing') : t('negotiatePolish')}
            </Button>
          </div>
          <p role="status" className="text-sm text-muted">
            {status}
          </p>
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-notcovered/40 bg-amber-50 p-3 text-sm"
            >
              {error}
            </p>
          )}
        </div>
      )}

      {result && result.items.length > 0 && (
        <section aria-labelledby={`${id}-wording`} className="space-y-2">
          <h2 id={`${id}-wording`} className="font-semibold">
            {t('negotiateWordingTitle')}
          </h2>
          <p className="text-sm text-muted">{t('suggestedWordingLabel')}</p>
          <ul className="space-y-2">
            {result.items.map(item => (
              <li key={item.rowId} className="rounded-lg border border-border p-3 text-sm">
                <p className="font-medium">{item.ask}</p>
                <p className="mt-1 rounded bg-gray-50 p-2">“{item.suggestedWording}”</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Button variant="ghost" onClick={onBack}>
        {t('backToReport')}
      </Button>
    </section>
  );
}
