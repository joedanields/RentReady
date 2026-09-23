/** Demo mode hook — flips the app into demo mode; analysis uses recorded responses through the same pipeline */

import { useEffect, useState } from 'react';
import { useApp } from '../../state/AppProvider';

const STORAGE_KEY = 'rentready:demo';

export function isDemoUrlParam(): boolean {
  const params = new URLSearchParams(window.location.search);
  const demo = params.get('demo');
  return demo === '1' || demo === 'true';
}

export function useDemoMode() {
  const { dispatch, state } = useApp();
  const [active, setActive] = useState<boolean>(() => isDemoUrlParam());

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored === '1' || isDemoUrlParam()) {
      setActive(true);
      window.sessionStorage.setItem(STORAGE_KEY, '1');
    }
  }, []);

  const activate = () => {
    setActive(true);
    window.sessionStorage.setItem(STORAGE_KEY, '1');
  };

  const deactivate = () => {
    setActive(false);
    window.sessionStorage.removeItem(STORAGE_KEY);
  };

  return {
    active,
    use: activate,
    disable: deactivate,
    dispatch,
    state
  };
}