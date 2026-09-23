/** Upload — add agreement via PDF, DOCX, paste, or sample; run analysis */

import { useRef, useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { Button } from '../../components/Button';
import { KeyPanel } from '../key/KeyPanel';
import { parsePdf, isPdfFile } from '../../core/parsing/pdfParser';
import { parseDocx, isDocxFile } from '../../core/parsing/docxParser';
import {
  runAnalysis,
  parsePastedText,
  parseSampleAgreement,
  getDefaultModel
} from '../analyse/engine';
import { useDemoMode } from '../analyse/demo';
import { redact } from '../../core/gemini/errors';
import type { ParsedDocument } from '../analyse/engine';

export function Upload({ onAnalysed }: { onAnalysed: () => void }) {
  const { state, dispatch } = useApp();
  const demo = useDemoMode();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showKeyPanel, setShowKeyPanel] = useState(!demo.active && !state.key.key);

  const setDoc = (doc: ParsedDocument, fileName: string, fileType: 'pdf' | 'docx' | 'text') => {
    dispatch({
      type: 'SET_DOCUMENT',
      document: {
        fileName,
        fileType,
        clauses: doc.clauses,
        rawText: doc.rawText,
        pageCount: doc.pageCount,
        charCount: doc.rawText.length,
        error: null
      }
    });
  };

  const performAnalysis = async (doc: ParsedDocument) => {
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
        onStage: s => setStage(s)
      });
      dispatch({ type: 'SET_ANALYSIS', analysis: { result, loading: false, error: null, stage: '' } });
      if (!demo.active) dispatch({ type: 'INCREMENT_BUDGET' });
      onAnalysed();
    } catch (e) {
      const err = e as { code?: string; message?: string };
      dispatch({
        type: 'SET_ANALYSIS',
        analysis: { loading: false, error: { code: err.code ?? 'UNKNOWN', message: redact(err.message ?? ''), retryable: true } }
      });
      setError(redact(err.message ?? t('errorPrefix')));
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    setError(null);
    try {
      let doc: ParsedDocument;
      if (isPdfFile(file)) {
        const parsed = await parsePdf(file);
        doc = parsed as ParsedDocument;
      } else if (isDocxFile(file)) {
        const parsed = await parseDocx(file);
        doc = parsed as ParsedDocument;
      } else {
        setError(t('invalidFile'));
        return;
      }
      setDoc(doc, file.name, isPdfFile(file) ? 'pdf' : 'docx');
      await performAnalysis(doc);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'TOO_LARGE') setError(t('errorPrefix') + t('retry'));
      else if (msg === 'SCANNED_PDF') setError(t('errorPrefix') + t('retry'));
      else setError(redact(msg || t('errorPrefix')));
    }
  };

  const handlePaste = async () => {
    if (!pasteText.trim()) return;
    setError(null);
    const doc = parsePastedText(pasteText);
    setDoc(doc, 'Pasted text', 'text');
    await performAnalysis(doc);
  };

  const handleSample = async () => {
    setError(null);
    const doc = parseSampleAgreement();
    setDoc(doc, 'Sample agreement', 'text');
    if (!demo.active) demo.use();
    await performAnalysis(doc);
  };

  return (
    <section aria-labelledby="upload-title" className="space-y-5 pt-2">
      <h1 id="upload-title" className="text-2xl font-semibold">
        {t('addAgreement')}
      </h1>

      {!busy && !error && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              onClick={() => fileRef.current?.click()}
              variant="secondary"
              className="flex-1"
            >
              {t('uploadFile')}
            </Button>
            <Button
              onClick={() => {
                /* paste area is below */
              }}
              variant="secondary"
              className="flex-1"
              disabled
            >
              {t('pasteText')}
            </Button>
            <Button onClick={handleSample} className="flex-1">
              {t('useSample')}
            </Button>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="sr-only"
            aria-label="Upload agreement file"
            onChange={e => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = '';
            }}
          />

          <div className="space-y-2">
            <label htmlFor="paste-doc" className="text-sm font-medium">
              {t('pasteText')}
            </label>
            <textarea
              id="paste-doc"
              rows={6}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder="Paste your agreement text here…"
              className="w-full rounded-lg border border-border p-3 text-sm"
            />
            <Button onClick={handlePaste} disabled={!pasteText.trim()} variant="secondary">
              {t('next')}
            </Button>
          </div>

          {showKeyPanel && <KeyPanel />}
        </div>
      )}

      {busy && (
        <div className="space-y-3 rounded-xl border border-border p-6" aria-live="polite">
          <p className="text-lg font-medium">
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

      {error && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          <p className="font-medium">{error}</p>
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" onClick={() => setError(null)}>
              {t('retry')}
            </Button>
            <Button variant="ghost" onClick={() => showKeyPanel && setShowKeyPanel(true)}>
              {t('continueDemo')}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}