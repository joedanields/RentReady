/** AppProvider — React context for the reducer state */

import { createContext, useContext, useMemo, useReducer, type ReactNode, type Dispatch } from 'react';
import type { AppState, AppAction } from './reducer.js';
import { INITIAL_STATE, reducer } from './reducer.js';

type AppContextValue = {
  state: AppState;
  dispatch: Dispatch<AppAction>;
};

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}