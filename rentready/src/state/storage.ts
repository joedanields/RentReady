/**
 * The only browser storage RentReady touches. Per SECURITY.md: preferences may persist
 * (localStorage); the demo flag lives for the tab (sessionStorage); no document, answer or
 * result is ever written. Every read is Zod-validated and every access is guarded, because
 * storage can be blocked (private mode, disabled cookies) or edited by hand.
 */

import { preferencesSchema, urlParamsSchema } from '../core/schemas';
import type { Preferences } from '../core/types';

const PREFIX = 'rentready:';
export const PREFS_KEY = `${PREFIX}prefs`;
export const DEMO_KEY = `${PREFIX}demo`;
/** Only written when the user ticks "Remember for this tab"; sessionStorage dies with the tab. */
export const API_KEY_KEY = `${PREFIX}key`;

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

/** Saved preferences over the defaults; each field is validated on its own, bad ones ignored. */
export function loadPrefs(defaults: Preferences): Preferences {
  const raw = safe(() => window.localStorage.getItem(PREFS_KEY), null);
  if (!raw) return defaults;
  const parsed = safe<unknown>(() => JSON.parse(raw), null);
  const obj: Record<string, unknown> =
    parsed !== null && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  const { language, readingLevel, theme } = preferencesSchema.shape;
  const lang = language.safeParse(obj.language);
  const level = readingLevel.safeParse(obj.readingLevel);
  const th = theme.safeParse(obj.theme);
  return {
    language: lang.success ? lang.data : defaults.language,
    readingLevel: level.success ? level.data : defaults.readingLevel,
    theme: th.success ? th.data : defaults.theme,
  };
}

export function savePrefs(prefs: Preferences): void {
  safe(() => window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)), undefined);
}

/**
 * Reads `?demo=` and `?lang=` — the only URL parameters the app honours — validating each one
 * separately so a bad `lang` can't disable a good `demo` (or the reverse).
 */
export function readUrlParams(search: string): {
  demo: boolean;
  lang: Preferences['language'] | null;
} {
  const params = safe(() => new URLSearchParams(search), new URLSearchParams());
  const demo = urlParamsSchema.shape.demo.safeParse(params.get('demo') ?? undefined);
  const lang = urlParamsSchema.shape.lang.safeParse(params.get('lang') ?? undefined);
  return {
    demo: demo.success && demo.data !== undefined,
    lang: lang.success ? (lang.data ?? null) : null,
  };
}

export function loadDemoFlag(): boolean {
  return safe(() => window.sessionStorage.getItem(DEMO_KEY) === '1', false);
}

export function saveDemoFlag(on: boolean): void {
  safe(() => {
    if (on) window.sessionStorage.setItem(DEMO_KEY, '1');
    else window.sessionStorage.removeItem(DEMO_KEY);
  }, undefined);
}

/** The remembered key, if the user opted in and it still looks like a Gemini key. */
export function loadRememberedKey(): string | null {
  const raw = safe(() => window.sessionStorage.getItem(API_KEY_KEY), null);
  return raw && /^AIza[0-9A-Za-z_-]{20,}$/.test(raw) ? raw : null;
}

/** Writes the key for this tab only when remembering is on; otherwise makes sure it's gone. */
export function saveRememberedKey(key: string | null, remember: boolean): void {
  safe(() => {
    if (key && remember) window.sessionStorage.setItem(API_KEY_KEY, key);
    else window.sessionStorage.removeItem(API_KEY_KEY);
  }, undefined);
}

/** "Clear everything": removes every RentReady key from both storages. */
export function clearAppStorage(): void {
  for (const store of [
    safe(() => window.localStorage, null),
    safe(() => window.sessionStorage, null),
  ]) {
    if (!store) continue;
    safe(() => {
      const keys = Array.from({ length: store.length }, (_, i) => store.key(i)).filter(
        (k): k is string => k !== null && k.startsWith(PREFIX)
      );
      for (const k of keys) store.removeItem(k);
    }, undefined);
  }
}
