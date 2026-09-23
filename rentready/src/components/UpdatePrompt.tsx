/**
 * PWA update prompt (DEPLOYMENT §4): a new version waits until the user chooses to reload, so a
 * stale shell never silently swaps out mid-task. Also confirms once that offline use is ready.
 */

import { useRegisterSW } from 'virtual:pwa-register/react';
import { t } from '../i18n';
import { Button } from './Button';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-50 border-b border-border bg-surface p-3 shadow print:hidden"
    >
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {needRefresh ? t('updateAvailable') : t('offlineReady')}
        </p>
        <div className="flex gap-2">
          {needRefresh ? (
            <>
              <Button size="sm" onClick={() => void updateServiceWorker(true)}>
                {t('updateReload')}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setNeedRefresh(false)}>
                {t('updateLater')}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setOfflineReady(false)}>
              {t('dismiss')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
