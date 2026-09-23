/** Home screen — trust lines, primary CTA, demo CTA, disclaimer */

import { t } from '../../i18n';
import { Button } from '../../components/Button';
import { useApp } from '../../state/AppProvider';

export function Home({ onStart, onDemo }: { onStart: () => void; onDemo: () => void }) {
  const { state } = useApp();
  const firstRun = !state.interview.completed;

  return (
    <section aria-labelledby="home-title" className="space-y-6 pt-6">
      <div className="space-y-3">
        <h1 id="home-title" className="text-3xl font-semibold leading-tight">
          {t('tagline')}
        </h1>
        <p className="text-lg text-muted">{t('legalDisclaimer')}</p>
      </div>

      <ul className="space-y-3 rounded-xl border border-border p-4">
        {[t('trust1'), t('trust2'), t('trust3')].map((point, i) => (
          <li key={i} className="flex items-start gap-2">
            <span aria-hidden="true" className="mt-1 text-primary">
              ✓
            </span>
            <span>{point}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onStart}>
          {t('startCta')}
        </Button>
        <Button size="lg" variant="secondary" onClick={onDemo}>
          {t('demoCta')}
        </Button>
      </div>

      {!firstRun && (
        <Button variant="ghost" onClick={onStart} className="self-start">
          {t('summaryTitle')}
        </Button>
      )}
    </section>
  );
}
