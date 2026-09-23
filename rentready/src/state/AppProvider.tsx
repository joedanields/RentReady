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
import { isKeyFormatValid } from '../core/gemini/client';
import {
  clearAppStorage,
  loadDemoFlag,
  loadPrefs,
  loadRememberedKey,
  saveRememberedKey,
  readUrlParams,
  saveDemoFlag,
  savePrefs,
} from './storage.js';

/** Flip to false once src/i18n/hi.ts covers every key. */
const ENGLISH_ONLY = true;

type AppContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const AppContext = createContext<AppContextValue | null>(null);

/**
 * Optional key for a hosted machine evaluation, set as VITE_EVAL_GEMINI_KEY in the host's build
 * settings — never in the repo. Anything built this way ships the key in public JavaScript, so it
 * must be a throwaway, API-restricted key deleted after the evaluation (HUMAN_TASKS.md §5).
 * Unset by default; loaded into memory like a typed key, so "Forget key" still clears it.
 */
export function evaluationKey(env: Record<string, unknown> = import.meta.env): string | null {
  const raw = env.VITE_EVAL_GEMINI_KEY;
  return typeof raw === 'string' && isKeyFormatValid(raw.trim()) ? raw.trim() : null;
}

/** Initial state: saved preferences, then `?lang=` / `?demo=` from the URL on top. */
export function initState(base: AppState, search: string): AppState {
  const url = readUrlParams(search);
  const prefs = loadPrefs(base.preferences);
  const remembered = loadRememberedKey();
  const evalKey = evaluationKey();
  return {
    ...base,
    // English-only release: the Hindi dictionary is incomplete, so a saved preference or
    // ?lang=hi must not switch the UI into a half-translated state (DECISIONS #50).
    preferences: { ...prefs, language: ENGLISH_ONLY ? 'en' : (url.lang ?? prefs.language) },
    demo: base.demo || url.demo || loadDemoFlag(),
    key: remembered
      ? { ...base.key, key: remembered, remember: true }
      : evalKey
        ? { ...base.key, key: evalKey }
        : base.key,
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

  // Theme: explicit light/dark, or follow the OS (and its changes) for "system".
  const theme = state.preferences.theme;
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && media?.matches === true);
      document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    };
    apply();
    media?.addEventListener?.('change', apply);
    return () => media?.removeEventListener?.('change', apply);
  }, [theme]);
  useEffect(() => saveDemoFlag(state.demo), [state.demo]);
  useEffect(
    () => saveRememberedKey(state.key.key, state.key.remember),
    [state.key.key, state.key.remember]
  );

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
