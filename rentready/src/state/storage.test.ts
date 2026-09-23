// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  DEMO_KEY,
  PREFS_KEY,
  clearAppStorage,
  loadDemoFlag,
  loadPrefs,
  readUrlParams,
  saveDemoFlag,
  savePrefs,
} from './storage';
import type { Preferences } from '../core/types';

const DEFAULTS: Preferences = { language: 'en', readingLevel: 'standard', theme: 'system' };

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('preferences', () => {
  it('round-trips saved preferences', () => {
    savePrefs({ language: 'hi', readingLevel: 'simple', theme: 'dark' });
    expect(loadPrefs(DEFAULTS)).toEqual({ language: 'hi', readingLevel: 'simple', theme: 'dark' });
  });

  it('falls back to defaults when nothing is saved or the JSON is broken', () => {
    expect(loadPrefs(DEFAULTS)).toEqual(DEFAULTS);
    localStorage.setItem(PREFS_KEY, '{not json');
    expect(loadPrefs(DEFAULTS)).toEqual(DEFAULTS);
    localStorage.setItem(PREFS_KEY, '"a string"');
    expect(loadPrefs(DEFAULTS)).toEqual(DEFAULTS);
  });

  it('keeps valid fields and drops tampered ones individually', () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ language: 'hi', readingLevel: '<script>', theme: 42, extra: 'x' })
    );
    expect(loadPrefs(DEFAULTS)).toEqual({ ...DEFAULTS, language: 'hi' });
  });

  it('survives storage that throws (private mode, blocked cookies)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(loadPrefs(DEFAULTS)).toEqual(DEFAULTS);
    expect(() => savePrefs(DEFAULTS)).not.toThrow();
    expect(loadDemoFlag()).toBe(false);
    expect(() => saveDemoFlag(true)).not.toThrow();
  });
});

describe('URL parameters', () => {
  it('honours only valid demo and lang values', () => {
    expect(readUrlParams('?demo=1&lang=hi')).toEqual({ demo: true, lang: 'hi' });
    expect(readUrlParams('?demo=true')).toEqual({ demo: true, lang: null });
    expect(readUrlParams('')).toEqual({ demo: false, lang: null });
  });

  it('ignores hostile values without letting one break the other', () => {
    expect(readUrlParams('?demo=yes&lang=hi')).toEqual({ demo: false, lang: 'hi' });
    expect(readUrlParams('?demo=1&lang=<script>')).toEqual({ demo: true, lang: null });
    expect(readUrlParams('?key=AI&next=https://evil.example')).toEqual({ demo: false, lang: null });
  });
});

describe('demo flag and clear everything', () => {
  it('persists the demo flag for the tab only', () => {
    saveDemoFlag(true);
    expect(sessionStorage.getItem(DEMO_KEY)).toBe('1');
    expect(localStorage.getItem(DEMO_KEY)).toBeNull();
    expect(loadDemoFlag()).toBe(true);
    saveDemoFlag(false);
    expect(loadDemoFlag()).toBe(false);
  });

  it('removes every RentReady key from both storages and leaves other keys alone', () => {
    savePrefs(DEFAULTS);
    saveDemoFlag(true);
    sessionStorage.setItem('rentready:key', 'x');
    localStorage.setItem('someone-else', 'keep');
    clearAppStorage();
    expect(localStorage.getItem(PREFS_KEY)).toBeNull();
    expect(sessionStorage.getItem(DEMO_KEY)).toBeNull();
    expect(sessionStorage.getItem('rentready:key')).toBeNull();
    expect(localStorage.getItem('someone-else')).toBe('keep');
  });
});
