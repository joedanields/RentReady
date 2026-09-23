/** App shell — skip link, header, main, footer with consistent-help links */

import { useEffect, useState } from 'react';
import { useApp } from './state/AppProvider';
import { t } from './i18n';
import { Home } from './features/home/Home';
import { Interview } from './features/interview/Interview';
import { Upload } from './features/upload/Upload';
import { Report } from './features/report/Report';
import { Negotiate } from './features/negotiate/Negotiate';
import { MoveIn } from './features/movein/MoveIn';
import { Settings } from './features/settings/Settings';
import { ForgetKeyButton } from './features/key/KeyPanel';
import { HowItWorks } from './features/info/HowItWorks';
import { Privacy } from './features/info/Privacy';
import { Disclaimer } from './features/info/Disclaimer';
import { useDemoMode } from './features/analyse/demo';
import { SAMPLE_DEMO_INTERVIEW_INPUT } from './sample/sampleData';

const SCREENS = [
  'home',
  'interview',
  'upload',
  'report',
  'negotiate',
  'movein',
  'settings',
  'help',
  'privacy',
  'disclaimer',
] as const;
type Screen = (typeof SCREENS)[number];

function parseHash(): Screen {
  const h = window.location.hash.replace(/^#\/?/, '');
  if ((SCREENS as readonly string[]).includes(h)) return h as Screen;
  return 'home';
}

export function App() {
  const { state, dispatch } = useApp();
  // Honour the hash on first load too, so a refresh or deep link keeps the user where they were.
  const [screen, setScreen] = useState<Screen>(parseHash);
  const demo = useDemoMode();

  useEffect(() => {
    const onHash = () => setScreen(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const go = (s: Screen) => {
    window.location.hash = `#/${s}`;
    setScreen(s);
  };

  const lang = state.preferences.language;
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
  }, [lang]);

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-white"
      >
        {t('skipLink')}
      </a>
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => go('home')}
            className="flex items-center gap-2 text-lg font-semibold text-primary"
            aria-label={t('appName')}
          >
            🏠 {t('appName')}
            {demo.active && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                {t('demoMode')}
              </span>
            )}
          </button>
          <nav aria-label={t('navPrimary')} className="flex items-center gap-2">
            <ForgetKeyButton />
            <button
              type="button"
              onClick={() => go('settings')}
              className="min-h-[44px] rounded px-3 text-sm font-medium text-muted hover:text-ink"
            >
              {t('settings')}
            </button>
          </nav>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
        {screen === 'home' && (
          <Home
            onStart={() => go('interview')}
            onDemo={() => {
              demo.use();
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'city',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.city ?? '',
              });
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'monthlyRent',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.monthlyRent ?? '',
              });
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'deposit',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.deposit ?? '',
              });
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'duration',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.duration ?? '',
              });
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'lockIn',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.lockIn ?? '',
              });
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'noticePeriod',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.noticePeriod ?? '',
              });
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'maintenance',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.maintenance ?? '',
              });
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'repairs',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.repairs ?? '',
              });
              dispatch({
                type: 'SET_INTERVIEW_ANSWER',
                key: 'increase',
                value: SAMPLE_DEMO_INTERVIEW_INPUT.increase ?? '',
              });
              go('upload');
            }}
          />
        )}
        {screen === 'interview' && (
          <Interview onDone={() => go('upload')} onBack={() => go('home')} />
        )}
        {screen === 'upload' && <Upload onAnalysed={() => go('report')} />}
        {screen === 'report' && (
          <Report onNegotiate={() => go('negotiate')} onMoveIn={() => go('movein')} />
        )}
        {screen === 'negotiate' && <Negotiate onBack={() => go('report')} />}
        {screen === 'movein' && <MoveIn onBack={() => go('report')} />}
        {screen === 'settings' && <Settings onReset={() => go('home')} />}
        {screen === 'help' && <HowItWorks />}
        {screen === 'privacy' && <Privacy />}
        {screen === 'disclaimer' && <Disclaimer />}
      </main>

      <footer className="border-t border-border bg-white">
        <div className="mx-auto max-w-3xl px-4 py-4 text-center text-sm text-muted">
          <p className="mb-2">{t('infoNotLegalAdvice')}</p>
          <nav aria-label={t('navFooter')} className="flex justify-center gap-4">
            <button
              type="button"
              onClick={() => go('help')}
              className="min-h-[44px] text-primary hover:underline"
            >
              {t('howThisWorks')}
            </button>
            <button
              type="button"
              onClick={() => go('privacy')}
              className="min-h-[44px] text-primary hover:underline"
            >
              {t('privacy')}
            </button>
            <button
              type="button"
              onClick={() => go('disclaimer')}
              className="min-h-[44px] text-primary hover:underline"
            >
              {t('disclaimer')}
            </button>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export type { Screen };
