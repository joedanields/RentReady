/** Disclaimer — cautious legal language */

import { t } from '../../i18n';

export function Disclaimer() {
  return (
    <section aria-labelledby="disclaimer-title" className="space-y-4 pt-2">
      <h1 id="disclaimer-title" className="text-2xl font-semibold">
        {t('disclaimer')}
      </h1>
      <p>{t('infoNotLegalAdvice')}</p>
      <p>
        This tool is a rough check of a residential rental agreement. It does not review every
        point, and rental law in India varies by state and union territory. Anything significant —
        money already paid, a dispute, or an unusual clause — is best reviewed by a qualified
        advocate.
      </p>
    </section>
  );
}
