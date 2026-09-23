import { afterEach, describe, expect, it } from 'vitest';
import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AppProvider, initState, useApp, useClearEverything } from './AppProvider';
import { INITIAL_STATE } from './reducer';
import { DEMO_KEY, PREFS_KEY } from './storage';
import { getLang, setLang, t } from '../i18n';

const wrapper = ({ children }: { children: ReactNode }) => <AppProvider>{children}</AppProvider>;

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  setLang('en');
});

describe('initState', () => {
  it('stays in English for this release, and lets ?demo= turn on demo mode', () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ language: 'en', theme: 'dark' }));
    const s = initState(INITIAL_STATE, '?lang=hi&demo=1');
    expect(s.preferences).toEqual({ language: 'en', readingLevel: 'standard', theme: 'dark' });
    expect(s.demo).toBe(true);
  });

  it('restores demo mode for the rest of the tab', () => {
    sessionStorage.setItem(DEMO_KEY, '1');
    expect(initState(INITIAL_STATE, '').demo).toBe(true);
  });
});

describe('AppProvider', () => {
  it('persists preferences and the demo flag as they change', () => {
    const { result } = renderHook(() => useApp(), { wrapper });
    act(() => {
      result.current.dispatch({ type: 'SET_PREFERENCES', prefs: { theme: 'dark' } });
      result.current.dispatch({ type: 'SET_DEMO', demo: true });
    });
    expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')).toMatchObject({ theme: 'dark' });
    expect(sessionStorage.getItem(DEMO_KEY)).toBe('1');
  });

  it('switches t() to the chosen language before children render', () => {
    function Probe() {
      const { dispatch } = useApp();
      return (
        <button
          type="button"
          onClick={() => dispatch({ type: 'SET_PREFERENCES', prefs: { language: 'hi' } })}
        >
          {t('back')}
        </button>
      );
    }
    render(<Probe />, { wrapper });
    expect(screen.getByRole('button')).toHaveTextContent('Back');
    act(() => screen.getByRole('button').click());
    expect(getLang()).toBe('hi');
    expect(screen.getByRole('button')).toHaveTextContent('पीछे');
  });

  it('"Clear everything" wipes state, the key and storage', () => {
    const { result } = renderHook(() => ({ app: useApp(), clear: useClearEverything() }), {
      wrapper,
    });
    act(() => {
      result.current.app.dispatch({ type: 'SET_KEY', key: 'in-memory-key' });
      result.current.app.dispatch({ type: 'SET_DEMO', demo: true });
      result.current.app.dispatch({ type: 'SET_INTERVIEW_ANSWER', key: 'deposit', value: '80000' });
    });
    act(() => result.current.clear());
    expect(result.current.app.state).toEqual(INITIAL_STATE);
    expect(sessionStorage.getItem(DEMO_KEY)).toBeNull();
    // Only default preferences are written back after the reset.
    expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}')).toEqual(INITIAL_STATE.preferences);
  });

  it('throws a clear error when used outside the provider', () => {
    expect(() => renderHook(() => useApp())).toThrow('useApp must be used within AppProvider');
  });
});
