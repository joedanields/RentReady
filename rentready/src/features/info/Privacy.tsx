/** Privacy — the statement from SECURITY.md §5. */

import { InfoPage } from './InfoPage';

export function Privacy() {
  return (
    <InfoPage
      title="privacy"
      items={['privacy.1', 'privacy.2', 'privacy.3', 'privacy.4', 'privacy.5', 'privacy.6']}
    />
  );
}
