/** KeyPanel — BYOK in-memory; masked, redacted from errors, never in DOM exports/URLs */

import React, { useState } from 'react';
import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { isKeyFormatValid } from '../../core/gemini/client';
import { useDemoMode } from '../analyse/demo';

/** Clears the key from memory and ends any opt-in tab storage — shared by the header and panel. */
function useForgetKey(): () => void {
  const { dispatch } = useApp();
  const demo = useDemoMode();
  return () => {
    dispatch({ type: 'SET_KEY', key: null });
    dispatch({ type: 'SET_KEY_REMEMBER', remember: false });
    demo.disable();
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

export function KeyPanel() {
  const { state, dispatch } = useApp();
  const demo = useDemoMode();
  const forget = useForgetKey();
  const [input, setInput] = useState('');
  const [show, setShow] = useState(false);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setInput(next);
    // Only trigger when it looks like a complete key
    if (next.length >= 20 && isKeyFormatValid(next)) {
      dispatch({ type: 'SET_KEY', key: next });
    } else if (next.length === 0) {
      dispatch({ type: 'SET_KEY', key: null });
    }
  };

  return (
    <section
      aria-label={t('keyManagement')}
      className="rounded-xl border border-border bg-gray-50 p-6"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{t('keyManagement')}</h2>
        {state.key.key ? (
          <button
            type="button"
            onClick={() => setShow(v => !v)}
            className="min-h-[44px] text-sm text-primary"
          >
            {show ? t('hideKey') : t('showKey')}
          </button>
        ) : null}
      </div>

      <p className="mb-4 text-sm text-muted">{t('keyExplanation')}</p>

      {state.key.key ? (
        <p className="mb-4 break-all text-sm text-muted" data-testid="key-status">
          {t('keyMasked')}: {show ? state.key.key : '••••' + state.key.key.slice(-4)}
        </p>
      ) : (
        <p className="mb-4 text-sm text-muted">{t('noKeyYet')}</p>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <label htmlFor="api-key" className="sr-only">
            {t('getKeyLink')}
          </label>
          <input
            id="api-key"
            type={show ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={input}
            onChange={onChange}
            placeholder="AIza••••"
            className="min-h-[44px] flex-1 rounded-lg border border-border px-3"
          />
          {!state.key.key && (
            <button
              type="button"
              onClick={() => setShow(v => !v)}
              className="min-h-[44px] px-2 text-muted"
            >
              {show ? t('hideKey') : t('showKey')}
            </button>
          )}
        </div>

        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noreferrer"
          className="text-sm text-primary hover:underline"
        >
          {t('getKeyLink')}
        </a>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={state.key.remember}
            onChange={e => dispatch({ type: 'SET_KEY_REMEMBER', remember: e.target.checked })}
            className="h-5 w-5"
          />
          {t('rememberKey')}
        </label>
        {state.key.remember && <p className="text-xs text-muted">{t('rememberKeyWarn')}</p>}

        {!demo.active && (
          <button
            type="button"
            onClick={demo.use}
            className="min-h-[44px] self-start rounded-lg border border-border px-4 text-sm text-primary"
          >
            {t('continueDemo')}
          </button>
        )}
        <button
          type="button"
          onClick={forget}
          className="min-h-[44px] self-start rounded-lg border border-red-300 px-4 text-sm text-red-700"
        >
          {t('forgetKey')}
        </button>
      </div>
    </section>
  );
}
