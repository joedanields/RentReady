/**
 * Key panel — BYOK per SECURITY.md §2. The key lives in memory; "Remember for this tab" (opt-in)
 * keeps it in sessionStorage until the tab closes. It is masked once set, shown only on a
 * deliberate click, and "Forget key" is always one tap away.
 */

import { useId, useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { isKeyFormatValid } from '../../core/gemini/client';
import { Button } from '../../components/Button';

/** "AIza••••••3f": enough to recognise your key, not enough to use it. */
export function maskKey(key: string): string {
  return `${key.slice(0, 4)}••••••${key.slice(-2)}`;
}

function useForgetKey(): () => void {
  const { dispatch } = useApp();
  return () => {
    dispatch({ type: 'SET_KEY', key: null });
    dispatch({ type: 'SET_KEY_REMEMBER', remember: false });
  };
}

/** Compact header control: "Forget key" stays one tap away on every screen once a key is set. */
export function ForgetKeyButton() {
  const { state } = useApp();
  const forget = useForgetKey();
  if (!state.key.key) return null;
  return (
    <button
      type="button"
      onClick={forget}
      className="min-h-[44px] rounded px-3 text-sm font-medium text-red-700 hover:underline"
    >
      {t('forgetKey')}
    </button>
  );
}

export function KeyPanel({ onUseSample }: { onUseSample?: () => void }) {
  const { state, dispatch } = useApp();
  const forget = useForgetKey();
  const id = useId();
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState(false);
  const key = state.key.key;

  const save = () => {
    const value = input.trim();
    if (!isKeyFormatValid(value)) {
      setError(true);
      return;
    }
    dispatch({ type: 'SET_KEY', key: value });
    setInput('');
    setShow(false);
    setError(false);
  };

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="space-y-3 rounded-xl border border-border bg-gray-50 p-4 sm:p-6"
    >
      <h2 id={`${id}-title`} className="font-semibold">
        {t('keyManagement')}
      </h2>
      <p className="text-sm text-muted">{t('keyExplanation')}</p>

      {key ? (
        <div className="space-y-2">
          <p className="break-all text-sm font-medium" data-testid="key-status">
            {t('keySaved', { masked: show ? key : maskKey(key) })}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShow(v => !v)}
              aria-pressed={show}
            >
              {show ? t('hideKey') : t('showKey')}
            </Button>
            <Button variant="danger" size="sm" onClick={forget}>
              {t('forgetKey')}
            </Button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={e => {
            e.preventDefault();
            save();
          }}
          className="space-y-2"
        >
          <label htmlFor={`${id}-key`} className="block font-medium">
            {t('keyFieldLabel')}
          </label>
          <p id={`${id}-hint`} className="text-sm text-muted">
            {t('keyFieldHint')}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              id={`${id}-key`}
              type={show ? 'text' : 'password'}
              autoComplete="off"
              spellCheck={false}
              value={input}
              aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`}
              aria-invalid={error ? true : undefined}
              onChange={e => {
                setInput(e.target.value);
                setError(false);
              }}
              className="min-h-[44px] min-w-0 flex-1 rounded-lg border border-border bg-surface px-3"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShow(v => !v)}
              aria-pressed={show}
            >
              {show ? t('hideKey') : t('showKey')}
            </Button>
            <Button type="submit" disabled={!input.trim()}>
              {t('keySave')}
            </Button>
          </div>
          {error && (
            <p id={`${id}-error`} role="alert" className="text-sm font-medium text-differs">
              <span aria-hidden="true">⚠ </span>
              {t('keyInvalid')}
            </p>
          )}
        </form>
      )}

      <label className="flex min-h-[44px] items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={state.key.remember}
          onChange={e => dispatch({ type: 'SET_KEY_REMEMBER', remember: e.target.checked })}
          className="h-5 w-5 accent-primary"
        />
        {t('rememberKey')}
      </label>
      {state.key.remember && <p className="text-xs text-muted">{t('rememberKeyWarn')}</p>}

      <p className="text-sm">
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline"
        >
          {t('getKeyLink')}
        </a>
      </p>
      <p className="text-xs text-muted">{t('keyDeleteTip')}</p>
      <p className="text-xs text-muted">
        {t('budgetCounter', { used: state.budget.used, limit: state.budget.limit })}
      </p>

      {onUseSample && !key && (
        <Button variant="ghost" size="sm" onClick={onUseSample}>
          {t('keyUseSample')}
        </Button>
      )}
    </section>
  );
}
