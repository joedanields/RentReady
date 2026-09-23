/** Negotiate — pick rows, tone, channel; local message; optional AI enhance; copy/export */

import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { Button } from '../../components/Button';
import { buildNegotiationLocal } from '../../core/negotiation/builder';
import { useDemoMode } from '../analyse/demo';
import { getDefaultModel } from '../analyse/engine';
import { generateContent, repairJson } from '../../core/gemini/client';
import { buildNegotiationUserPrompt, buildSystemPreamble } from '../../core/gemini/prompts';
import { NEGOTIATION_SCHEMA } from '../../core/gemini/responseSchemas';
import { redact } from '../../core/gemini/errors';
import { validateModelNegotiation } from '../../core/schemas';

export function Negotiate({ onBack }: { onBack: () => void }) {
  const { state, dispatch } = useApp();
  const demo = useDemoMode();
  const analysis = state.analysis.result;
  const [enhancing, setEnhancing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(() => {
    if (!analysis) return [];
    return [
      ...analysis.matches
        .filter(m => m.verdict === 'differs')
        .map(m => ({ id: `match-${m.key}`, label: mNote(m), selected: true })),
      ...analysis.gaps
        .filter(g => g.state === 'absent')
        .map(g => ({ id: `gap-${g.id}`, label: g.title, selected: true }))
    ];
  }, [analysis]);

  useEffect(() => {
    if (rows.length > 0 && state.negotiation.selectedRows.length === 0) {
      dispatch({ type: 'SET_NEGOTIATION_SELECTION', rows: rows.map(r => r.id) });
    }
  }, [rows, dispatch, state.negotiation.selectedRows.length]);

  const rebuildLocal = () => {
    if (!analysis) return;
    const result = buildNegotiationLocal({
      matches: analysis.matches,
      gaps: analysis.gaps,
      selectedRowIds: state.negotiation.selectedRows,
      tone: state.negotiation.tone,
      channel: state.negotiation.channel
    });
    dispatch({ type: 'SET_NEGOTIATION_RESULT', result });
  };

  useEffect(rebuildLocal, [
    state.negotiation.selectedRows,
    state.negotiation.tone,
    state.negotiation.channel,
    analysis,
    dispatch
  ]);

  if (!analysis) {
    return (
      <section className="pt-6 text-center text-muted">
        <p>Run an analysis first.</p>
        <Button onClick={onBack}>{t('back')}</Button>
      </section>
    );
  }

  const toggle = (id: string) => {
    const next = state.negotiation.selectedRows.includes(id)
      ? state.negotiation.selectedRows.filter(x => x !== id)
      : [...state.negotiation.selectedRows, id];
    dispatch({ type: 'SET_NEGOTIATION_SELECTION', rows: next });
  };

  const enhance = async () => {
    if (enhancing) return;
    const result = buildNegotiationLocal({
      matches: analysis.matches,
      gaps: analysis.gaps,
      selectedRowIds: state.negotiation.selectedRows,
      tone: state.negotiation.tone,
      channel: state.negotiation.channel
    });
    if (demo.active) {
      // Demo: keep local message
      dispatch({ type: 'SET_NEGOTIATION_RESULT', result });
      return;
    }
    if (!state.key.key) {
      setError(t('noKeyYet'));
      return;
    }
    setEnhancing(true);
    setError(null);
    try {
      const items = result.items.filter(i => state.negotiation.selectedRows.includes(i.rowId));
      const { text } = await generateContent({
        model: getDefaultModel(),
        apiKey: state.key.key,
        system: buildSystemPreamble({
          language: state.preferences.language,
          readingLevel: state.preferences.readingLevel,
          city: state.interview.answers.city
        }),
        userPrompt: buildNegotiationUserPrompt(
          items.map(i => ({ rowId: i.rowId, ask: i.ask, reason: i.reason })),
          state.negotiation.tone,
          state.negotiation.channel
        ),
        responseSchema: NEGOTIATION_SCHEMA,
        temperature: 0.4,
        maxOutputTokens: 2048
      });
      const parsed = validateModelNegotiation(JSON.parse(repairJson(text)));
      dispatch({
        type: 'SET_NEGOTIATION_RESULT',
        result: { message: parsed.message, items: parsed.items }
      });
      dispatch({ type: 'INCREMENT_BUDGET' });
    } catch (e) {
      setError(redact(e instanceof Error ? e.message : String(e)));
    } finally {
      setEnhancing(false);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setError(t('errorPrefix'));
    }
  };

  const message = state.negotiation.result?.message ?? '';

  return (
    <section aria-labelledby="negotiate-title" className="space-y-5 pt-2">
      <h1 id="negotiate-title" className="text-2xl font-semibold">
        {t('negotiateTitle')}
      </h1>

      <div className="space-y-2">
        {rows.map(r => {
          const checked = state.negotiation.selectedRows.includes(r.id);
          return (
            <label
              key={r.id}
              className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-border px-3"
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(r.id)}
                className="h-5 w-5"
              />
              <span className="text-sm">{r.label}</span>
            </label>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('tone')}</legend>
          <div className="flex gap-2">
            {(['polite', 'direct'] as const).map(tone => (
              <button
                key={tone}
                type="button"
                aria-pressed={state.negotiation.tone === tone}
                onClick={() => dispatch({ type: 'SET_NEGOTIATION_TONE', tone })}
                className={`min-h-[44px] rounded-lg border px-4 ${
                  state.negotiation.tone === tone ? 'border-primary bg-primary text-white' : 'border-border'
                }`}
              >
                {tone === 'polite' ? t('tonePolite') : t('toneDirect')}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('channel')}</legend>
          <div className="flex gap-2">
            {(['whatsapp', 'email'] as const).map(channel => (
              <button
                key={channel}
                type="button"
                aria-pressed={state.negotiation.channel === channel}
                onClick={() => dispatch({ type: 'SET_NEGOTIATION_CHANNEL', channel })}
                className={`min-h-[44px] rounded-lg border px-4 ${
                  state.negotiation.channel === channel ? 'border-primary bg-primary text-white' : 'border-border'
                }`}
              >
                {channel === 'whatsapp' ? t('channelWhatsApp') : t('channelEmail')}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {message && (
        <section aria-label={t('generatedMessage')} className="space-y-2">
          <h2 className="font-semibold">{t('generatedMessage')}</h2>
          <textarea
            readOnly
            value={message}
            aria-label={t('generatedMessage')}
            className="min-h-[220px] w-full rounded-lg border border-border p-3 text-sm"
          />
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => copy(message)} disabled={copied}>
              {copied ? t('copied') : t('copy')}
            </Button>
            <Button size="sm" variant="secondary" onClick={enhance} disabled={enhancing}>
              {enhancing ? '…' : t('next')}
            </Button>
            <Button size="sm" variant="ghost" onClick={onBack}>
              {t('back')}
            </Button>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
        </section>
      )}
    </section>
  );
}

function mNote(m: import('../../core/types').MatchRow): string {
  return m.note || m.written || m.agreed;
}