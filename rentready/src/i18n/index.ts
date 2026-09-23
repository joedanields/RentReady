/** i18n entry — t() with interpolation, lang switch. All UI strings route here. */

import { ui, type UiKey, type Lang, type ReadingLevel } from './en.js';
import { getHiString } from './hi.js';

let currentLang: Lang = 'en';

export function setLang(lang: Lang): void {
  currentLang = lang;
  document.documentElement.lang = lang;
}

export function getLang(): Lang {
  return currentLang;
}

export type TParams = Record<string, string | number>;

/** Translate a UI key, interpolating {name} tokens */
export function t(key: UiKey, params?: TParams): string {
  let s: string;
  if (currentLang === 'hi') {
    s = getHiString(key) ?? ui[key];
  } else {
    s = ui[key];
  }
  if (!params) return s;
  for (const [k, v] of Object.entries(params)) {
    s = s.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return s;
}

/** Translate an arbitrary keyed string (e.g. rule text) — falls back to the key */
export function tr(key: string, params?: TParams): string {
  if (currentLang === 'hi') {
    const s = getHiString(key) ?? key;
    return interpolate(s, params);
  }
  return interpolate(key, params);
}

function interpolate(s: string, params?: TParams): string {
  if (!params) return s;
  let out = s;
  for (const [k, v] of Object.entries(params)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return out;
}

export type { UiKey, Lang, ReadingLevel };

export function resolveReadingLevel(level: ReadingLevel): ReadingLevel {
  return level;
}
