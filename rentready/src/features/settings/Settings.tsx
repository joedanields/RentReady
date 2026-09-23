/** Settings — language, reading level, theme, key, budget, danger zone */


import { useApp } from '../../state/AppProvider';
import { t } from '../../i18n';
import { setLang } from '../../i18n';
import { Button } from '../../components/Button';
import { KeyPanel } from '../key/KeyPanel';

export function Settings({ onReset }: { onReset: () => void }) {
  const { state, dispatch } = useApp();
  const { preferences, budget } = state;

  return (
    <section aria-labelledby="settings-title" className="space-y-6 pt-2">
      <h1 id="settings-title" className="text-2xl font-semibold">
        {t('settings')}
      </h1>

      <div>
        <h2 className="mb-2 font-semibold">{t('language')}</h2>
        <div className="flex gap-2" role="radiogroup" aria-label={t('language')}>
          {(['en', 'hi'] as const).map(lang => (
            <button
              key={lang}
              type="button"
              role="radio"
              aria-checked={preferences.language === lang}
              onClick={() => {
                dispatch({ type: 'SET_PREFERENCES', prefs: { language: lang } });
                setLang(lang);
              }}
              className={`min-h-[44px] rounded-lg border px-4 ${
                preferences.language === lang ? 'border-primary bg-primary text-white' : 'border-border'
              }`}
            >
              {lang === 'en' ? 'English' : 'हिन्दी'}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">{t('readingLevel')}</h2>
        <div className="flex gap-2" role="radiogroup" aria-label={t('readingLevel')}>
          {(['standard', 'simple'] as const).map(level => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={preferences.readingLevel === level}
              onClick={() => dispatch({ type: 'SET_PREFERENCES', prefs: { readingLevel: level } })}
              className={`min-h-[44px] rounded-lg border px-4 ${
                preferences.readingLevel === level ? 'border-primary bg-primary text-white' : 'border-border'
              }`}
            >
              {level === 'simple' ? t('readingLevelSimple') : t('readingLevelStandard')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 font-semibold">{t('theme')}</h2>
        <div className="flex gap-2" role="radiogroup" aria-label={t('theme')}>
          {(['light', 'dark', 'system'] as const).map(theme => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={preferences.theme === theme}
              onClick={() => dispatch({ type: 'SET_PREFERENCES', prefs: { theme } })}
              className={`min-h-[44px] rounded-lg border px-4 ${
                preferences.theme === theme ? 'border-primary bg-primary text-white' : 'border-border'
              }`}
            >
              {theme === 'light' ? t('themeLight') : theme === 'dark' ? t('themeDark') : t('themeSystem')}
            </button>
          ))}
        </div>
      </div>

      <p className="text-sm text-muted">
        {t('offlineNote')}
      </p>

      <KeyPanel />

      <div className="text-sm text-muted">
        {t('budgetCounter', { used: budget.used, limit: budget.limit })}
      </div>

      <div className="rounded-xl border border-red-200 p-4">
        <h2 className="mb-2 font-semibold text-red-700">{t('clearEverything')}</h2>
        <p className="mb-3 text-sm text-muted">{t('rememberKeyWarn')}</p>
        <Button
          variant="danger"
          onClick={() => {
            dispatch({ type: 'RESET_ALL' });
            onReset();
          }}
        >
          {t('clearEverything')}
        </Button>
      </div>
    </section>
  );
}