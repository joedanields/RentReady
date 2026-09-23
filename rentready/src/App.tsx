/** App shell — skip link, header, main, footer with consistent-help links */

import { lazy, Suspense, useEffect, useState } from 'react';
import { useApp } from './state/AppProvider';
import { t } from './i18n';
import { Home } from './features/home/Home';
import { ForgetKeyButton } from './features/key/KeyPanel';
import { UpdatePrompt } from './components/UpdatePrompt';
import { useDemoMode } from './features/analyse/demo';
import type { InterviewAnswers } from './core/types';

// Only Home ships in the first download; every other screen is its own chunk. Once the page is
// idle they are fetched in the background (see prefetchScreens), so the first paint is fast
// and the app still works if the connection drops before the service worker takes over.
const screens = {
  Interview: () => import('./features/interview/Interview').then(m => ({ default: m.Interview })),
  Upload: () => import('./features/upload/Upload').then(m => ({ default: m.Upload })),
  Report: () => import('./features/report/Report').then(m => ({ default: m.Report })),
  Negotiate: () => import('./features/negotiate/Negotiate').then(m => ({ default: m.Negotiate })),
  MoveIn: () => import('./features/movein/MoveIn').then(m => ({ default: m.MoveIn })),
  Settings: () => import('./features/settings/Settings').then(m => ({ default: m.Settings })),
  HowItWorks: () => import('./features/info/HowItWorks').then(m => ({ default: m.HowItWorks })),
  Privacy: () => import('./features/info/Privacy').then(m => ({ default: m.Privacy })),
  Disclaimer: () => import('./features/info/Disclaimer').then(m => ({ default: m.Disclaimer })),
};
const Interview = lazy(screens.Interview);
const Upload = lazy(screens.Upload);
const Report = lazy(screens.Report);
const Negotiate = lazy(screens.Negotiate);
const MoveIn = lazy(screens.MoveIn);
const Settings = lazy(screens.Settings);
const HowItWorks = lazy(screens.HowItWorks);
const Privacy = lazy(screens.Privacy);
const Disclaimer = lazy(screens.Disclaimer);

/** Warms every screen chunk when the browser is idle (the PDF/Word readers are not included). */
export function prefetchScreens(): void {
  const run = () => {
    for (const load of Object.values(screens)) void load().catch(() => undefined);
  };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run);
  else setTimeout(run, 1500);
}

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

  useEffect(prefetchScreens, []);

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
      <UpdatePrompt />
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-on-primary"
      >
        {t('skipLink')}
      </a>
      <header className="border-b border-border bg-surface">
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
              // The sample's interview answers load with the sample, not in the first download.
              void import('./sample/sampleData').then(({ SAMPLE_DEMO_INTERVIEW_INPUT }) => {
                const answers: Partial<InterviewAnswers> = SAMPLE_DEMO_INTERVIEW_INPUT;
                for (const [key, value] of Object.entries(answers)) {
                  if (value !== null && value !== undefined) {
                    dispatch({
                      type: 'SET_INTERVIEW_ANSWER',
                      key: key as keyof InterviewAnswers,
                      value,
                    });
                  }
                }
                go('upload');
              });
            }}
          />
        )}
        <Suspense
          fallback={
            <p role="status" className="text-muted">
              {t('loading')}
            </p>
          }
        >
          {screen === 'interview' && (
            <Interview onDone={() => go('upload')} onBack={() => go('home')} />
          )}
          {screen === 'upload' && <Upload onAnalysed={() => go('report')} />}
          {screen === 'report' && (
            <Report
              onNegotiate={() => go('negotiate')}
              onMoveIn={() => go('movein')}
              onAddAgreement={() => go('upload')}
            />
          )}
          {screen === 'negotiate' && <Negotiate onBack={() => go('report')} />}
          {screen === 'movein' && <MoveIn onBack={() => go('report')} />}
          {screen === 'settings' && <Settings onReset={() => go('home')} />}
          {screen === 'help' && <HowItWorks />}
          {screen === 'privacy' && <Privacy />}
          {screen === 'disclaimer' && <Disclaimer />}
        </Suspense>
      </main>

      <footer className="border-t border-border bg-surface">
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
