/**
 * Add agreement — upload a file, paste text, or use the sample. Parsing happens here in the
 * browser; the result is confirmed ("Read 14 clauses across 2 pages.") before anything is checked.
 */

import { useEffect, useId, useRef, useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { Button } from '../../components/Button';
import { KeyPanel } from '../key/KeyPanel';
import { parseFile, parsePastedText, type ParsedDocument } from '../../core/parsing/intake';
import { LIMITS } from '../../core/limits';
import { runAnalysis, parseSampleAgreement, getDefaultModel } from '../analyse/engine';
import { useDemoMode } from '../analyse/demo';
import { redact } from '../../core/gemini/errors';
import type { DocumentState } from '../../core/types';
import { intakeMessage } from './intakeMessage';

const ACCEPT =
  '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

type FileType = NonNullable<DocumentState['fileType']>;

export function Upload({ onAnalysed }: { onAnalysed: () => void }) {
  const { state, dispatch } = useApp();
  const demo = useDemoMode();
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const pasteRef = useRef<HTMLTextAreaElement>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [reading, setReading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const doc = state.document;
  const loaded = doc.clauses.length > 0;

  useEffect(() => {
    if (pasteOpen) pasteRef.current?.focus();
  }, [pasteOpen]);

  const setDoc = (parsed: ParsedDocument, fileName: string, fileType: FileType) => {
    dispatch({ type: 'CLEAR_DOCUMENT' });
    dispatch({
      type: 'SET_DOCUMENT',
      document: {
        fileName,
        fileType,
        clauses: parsed.clauses,
        rawText: parsed.rawText,
        pageCount: parsed.pageCount,
        charCount: parsed.rawText.length,
        error: null,
      },
    });
  };

  const handleFile = async (file: File) => {
    setError(null);
    setReading(true);
    try {
      const parsed = await parseFile(file);
      setDoc(parsed, file.name, file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'docx');
    } catch (e) {
      setError(intakeMessage(e));
    } finally {
      setReading(false);
    }
  };

  const handlePaste = () => {
    setError(null);
    try {
      setDoc(parsePastedText(pasteText), t('pastedDocName'), 'text');
      setPasteOpen(false);
    } catch (e) {
      setError(intakeMessage(e));
    }
  };

  const handleSample = () => {
    setError(null);
    setDoc(parseSampleAgreement(), t('sampleDocName'), 'sample');
    if (!demo.active) demo.use();
  };

  const performAnalysis = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await runAnalysis({
        answers: state.interview.answers,
        clauses: doc.clauses,
        apiKey: state.key.key,
        model: getDefaultModel(),
        preferences: state.preferences,
        budgetUsed: state.budget.used,
        budgetLimit: state.budget.limit,
        demo: demo.active,
        isSample: doc.fileType === 'sample',
        onStage: s => setStage(s),
      });
      dispatch({
        type: 'SET_ANALYSIS',
        analysis: { result, loading: false, error: null, stage: '' },
      });
      // Only a real Gemini call spends the user's quota.
      if (result.mode === 'ai' && !(demo.active && doc.fileType === 'sample')) {
        dispatch({ type: 'INCREMENT_BUDGET' });
      }
      onAnalysed();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      const message = redact(err.message ?? '') || t('errorPrefix');
      dispatch({
        type: 'SET_ANALYSIS',
        analysis: {
          loading: false,
          error: { code: err.code ?? 'UNKNOWN', message, retryable: true },
        },
      });
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const pasteId = `${id}-paste`;
  const pasteHintId = `${id}-paste-hint`;
  const statusText = loaded
    ? doc.pageCount > 0
      ? t('readClauses', { count: doc.clauses.length, pages: doc.pageCount })
      : t('readClausesNoPages', { count: doc.clauses.length })
    : reading
      ? t('readingFile')
      : '';

  return (
    <section aria-labelledby="upload-title" className="space-y-5 pt-2">
      <h1 id="upload-title" className="text-2xl font-semibold">
        {t('addAgreement')}
      </h1>
      <p className="text-muted">{t('uploadIntro')}</p>

      {/* One polite region for parsing progress and the "Read N clauses" confirmation. */}
      <p role="status" className={loaded ? 'sr-only' : 'text-sm font-medium'}>
        {statusText}
      </p>

      {error && (
        <div role="alert" className="rounded-lg border border-differs/40 bg-red-50 p-4 text-ink">
          <p className="font-medium">
            <span aria-hidden="true">⚠ </span>
            {error}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setPasteOpen(true)}>
              {t('pasteInstead')}
            </Button>
            <Button variant="ghost" onClick={handleSample}>
              {t('useSample')}
            </Button>
          </div>
        </div>
      )}

      {!loaded && !busy && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => fileRef.current?.click()}
              aria-describedby={`${id}-accepts`}
              disabled={reading}
            >
              {t('uploadFile')}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              aria-expanded={pasteOpen}
              aria-controls={`${id}-paste-panel`}
              onClick={() => setPasteOpen(open => !open)}
            >
              {t('pasteText')}
            </Button>
            <Button className="flex-1" onClick={handleSample}>
              {t('useSample')}
            </Button>
          </div>
          <p id={`${id}-accepts`} className="text-sm text-muted">
            {t('uploadAccepts')}
          </p>
          {/* Hidden; the Upload button above opens it, so keyboard users get a visible control. */}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            hidden
            data-testid="file-input"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />

          <div id={`${id}-paste-panel`} hidden={!pasteOpen} className="space-y-2">
            <label htmlFor={pasteId} className="font-medium">
              {t('pastePanelLabel')}
            </label>
            <p id={pasteHintId} className="text-sm text-muted">
              {t('pastePanelHint')}
            </p>
            <textarea
              id={pasteId}
              ref={pasteRef}
              rows={8}
              maxLength={LIMITS.MAX_CHARS + 1}
              value={pasteText}
              aria-describedby={pasteHintId}
              onChange={e => setPasteText(e.target.value)}
              placeholder={t('pastePlaceholder')}
              className="w-full rounded-lg border border-border bg-surface p-3 text-sm"
            />
            <Button onClick={handlePaste} disabled={!pasteText.trim()}>
              {t('readThisText')}
            </Button>
          </div>
        </div>
      )}

      {loaded && !busy && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <h2 className="flex flex-wrap items-center gap-2 font-semibold">
              <span className="break-all">{doc.fileName}</span>
              {doc.fileType === 'sample' && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                  {t('demoSampleBadge')}
                </span>
              )}
            </h2>
            <p className="mt-1 text-muted" aria-hidden="true">
              {statusText}
            </p>
          </div>

          {!demo.active && !state.key.key && <KeyPanel />}

          <div className="flex flex-wrap gap-3">
            <Button size="lg" onClick={() => void performAnalysis()}>
              {t('checkAgreement')}
            </Button>
            <Button variant="ghost" onClick={() => dispatch({ type: 'CLEAR_DOCUMENT' })}>
              {t('useDifferentAgreement')}
            </Button>
          </div>
        </div>
      )}

      {busy && (
        <div className="space-y-3 rounded-xl border border-border p-6">
          <p className="text-lg font-medium" aria-live="polite">
            {stage === 'reading'
              ? t('analysingStage1')
              : stage === 'calling'
                ? t('analysingStage2')
                : stage === 'verify'
                  ? t('analysingStage3')
                  : t('analysingStage4')}
          </p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="h-2 w-1/2 animate-pulse rounded-full bg-primary" />
          </div>
        </div>
      )}
    </section>
  );
}
