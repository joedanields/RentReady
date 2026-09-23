/** Maps a typed AI error to its translated, actionable message (never raw provider output). */

import { t, type UiKey } from '../../i18n';
import { ui } from '../../i18n/en';

export function aiErrorMessage(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  const key = `aiError.${typeof code === 'string' ? code : 'UNKNOWN'}`;
  return Object.prototype.hasOwnProperty.call(ui, key) ? t(key as UiKey) : t('aiError.UNKNOWN');
}
