/** "Clause 5 · page 2" — the label a person would look for in their own copy of the agreement. */

import { t } from '../../i18n';
import type { Clause } from '../../core/types';

export function clauseName(clause: Clause): string {
  const label = clause.label ?? clause.heading ?? String(clause.order);
  if (clause.page === null) return t('clauseChipNoPage', { label });
  if (clause.pageEnd !== null && clause.pageEnd !== clause.page) {
    return t('clauseChipPages', { label, page: clause.page, pageEnd: clause.pageEnd });
  }
  return t('clauseChip', { label, page: clause.page });
}
