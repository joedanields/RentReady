/** Turns an intake failure into the specific, fixable message the user sees (ACCESSIBILITY §5). */

import { t } from '../../i18n';
import { IntakeError } from '../../core/parsing/intake';

const nf = new Intl.NumberFormat('en-IN');

export function intakeMessage(error: unknown): string {
  if (!(error instanceof IntakeError)) return t('intake.PARSE_FAILED');
  const params = Object.fromEntries(
    Object.entries(error.detail).map(([k, v]) => [k, k === 'mb' ? String(v) : nf.format(v)])
  );
  return t(`intake.${error.code}`, params);
}
