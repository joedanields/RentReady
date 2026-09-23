/** How this works — neutral explanation, no legal claims. */

import { t } from '../../i18n';
import { Glossary } from '../../components/Glossary';
import { InfoPage } from './InfoPage';

export function HowItWorks() {
  return (
    <InfoPage title="howThisWorks" ordered items={['how.1', 'how.2', 'how.3', 'how.4', 'how.5']}>
      <p className="rounded-xl border border-border p-4 text-sm text-muted">
        {t('legalDisclaimer')}
      </p>
      <Glossary />
    </InfoPage>
  );
}
