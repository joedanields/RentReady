/** AppProvider — React context for the reducer state, plus the few things that touch storage. */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type { AppState, AppAction } from './reducer.js';
import { INITIAL_STATE, reducer } from './reducer.js';
import { getLang, setLang } from '../i18n';
import {
  clearAppStorage,
  loadDemoFlag,
  loadPrefs,
  readUrlParams,
  saveDemoFlag,
  savePrefs,
} from './storage.js';

type AppContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const AppContext = createContext<AppContextValue | null>(null);

/** Initial state: saved preferences, then `?lang=` / `?demo=` from the URL on top. */
export function initState(base: AppState, search: string): AppState {
  const url = readUrlParams(search);
  const prefs = loadPrefs(base.preferences);
  return {
    ...base,
    preferences: url.lang ? { ...prefs, language: url.lang } : prefs,
    demo: url.demo || loadDemoFlag(),
  };
}

export function AppProvider({
  children,
  initial = INITIAL_STATE,
}: {
  children: ReactNode;
  initial?: AppState;
}) {
  const [state, dispatch] = useReducer(reducer, initial, base =>
    initState(base, window.location.search)
  );

  // t() reads a module-level language. Syncing it here, before children render, means no
  // screen ever renders one frame in the old language. setLang is idempotent.
  if (getLang() !== state.preferences.language) setLang(state.preferences.language);

  useEffect(() => savePrefs(state.preferences), [state.preferences]);
  useEffect(() => saveDemoFlag(state.demo), [state.demo]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

/**
 * "Clear everything": wipes every RentReady key from storage, then resets state (which also
 * forgets the in-memory key). Storage is cleared first so the persistence effects that run after
 * the reset write only defaults.
 */
export function useClearEverything(): () => void {
  const { dispatch } = useApp();
  return useCallback(() => {
    clearAppStorage();
    dispatch({ type: 'RESET_ALL' });
  }, [dispatch]);
}
