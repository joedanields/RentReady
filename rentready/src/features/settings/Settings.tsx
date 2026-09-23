/**
 * Settings (UX_FLOW §10): reading level, theme, API key and budget, and "Clear everything"
 * behind a confirmation. Real radio groups throughout; English only for this release.
 */

import { useId, useState } from 'react';
import { useApp, useClearEverything } from '../../state/AppProvider';
import { t, type UiKey } from '../../i18n';
import { Button } from '../../components/Button';
import { Dialog } from '../../components/Dialog';
import { KeyPanel } from '../key/KeyPanel';
import type { Preferences } from '../../core/types';

function RadioGroup<K extends 'readingLevel' | 'theme'>({
  name,
  legend,
  hint,
  options,
}: {
  name: K;
  legend: string;
  hint: string;
  options: Array<[Preferences[K], UiKey]>;
}) {
  const { state, dispatch } = useApp();
  const id = useId();
  return (
    <fieldset aria-describedby={`${id}-hint`}>
      <legend className="font-semibold">{legend}</legend>
      <p id={`${id}-hint`} className="mb-2 text-sm text-muted">
        {hint}
      </p>
      <div className="flex flex-wrap gap-2">
        {options.map(([value, label]) => (
          <label
            key={value}
            className="flex min-h-[44px] items-center gap-2 rounded-lg border border-border px-3 has-[:checked]:border-primary has-[:checked]:bg-green-50"
          >
            <input
              type="radio"
              name={`${id}-${name}`}
              checked={state.preferences[name] === value}
              onChange={() => dispatch({ type: 'SET_PREFERENCES', prefs: { [name]: value } })}
              className="h-5 w-5 accent-primary"
            />
            {t(label)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function Settings({ onReset }: { onReset: () => void }) {
  const clearEverything = useClearEverything();
  const [confirming, setConfirming] = useState(false);

  return (
    <section aria-labelledby="settings-title" className="space-y-6 pt-2">
      <h1 id="settings-title" className="text-2xl font-semibold">
        {t('settings')}
      </h1>

      <RadioGroup
        name="readingLevel"
        legend={t('readingLevel')}
        hint={t('readingLevelHint')}
        options={[
          ['standard', 'readingLevelStandard'],
          ['simple', 'readingLevelSimple'],
        ]}
      />

      <RadioGroup
        name="theme"
        legend={t('theme')}
        hint={t('themeHint')}
        options={[
          ['system', 'themeSystem'],
          ['light', 'themeLight'],
          ['dark', 'themeDark'],
        ]}
      />

      <p className="text-sm text-muted">{t('offlineNote')}</p>

      <KeyPanel />

      <section aria-labelledby="clear-title" className="rounded-xl border border-differs/40 p-4">
        <h2 id="clear-title" className="mb-1 font-semibold">
          {t('clearEverything')}
        </h2>
        <p className="mb-3 text-sm text-muted">{t('clearEverythingHint')}</p>
        <Button variant="danger" onClick={() => setConfirming(true)}>
          {t('clearEverything')}
        </Button>
      </section>

      <Dialog open={confirming} onClose={() => setConfirming(false)} title={t('clearConfirmTitle')}>
        <p className="mb-4 text-sm">{t('clearConfirmBody')}</p>
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            {t('cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              setConfirming(false);
              clearEverything();
              onReset();
            }}
          >
            {t('clearEverything')}
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
