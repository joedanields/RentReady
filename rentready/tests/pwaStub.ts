/** Test stand-in for `virtual:pwa-register/react` (only Vite's build provides the real module). */
import { useState } from 'react';

export function useRegisterSW() {
  return {
    needRefresh: useState(false),
    offlineReady: useState(false),
    updateServiceWorker: async () => undefined,
  };
}
