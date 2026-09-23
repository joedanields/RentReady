/**
 * Glossary (ACCESSIBILITY §6): tap-to-open definitions — real buttons with aria-expanded, never
 * hover-only, so they work by touch, keyboard and screen reader alike.
 */

import { useId, useState } from 'react';
import { t, type UiKey } from '../i18n';

const TERMS: Array<[UiKey, UiKey]> = [
  ['glossaryLockIn', 'glossary.lockIn'],
  ['glossaryLeaveLicence', 'glossary.leaveLicence'],
  ['glossaryNoticePeriod', 'glossary.noticePeriod'],
  ['glossaryDeposit', 'glossary.deposit'],
  ['glossaryStampDuty', 'glossary.stampDuty'],
  ['glossaryRegistration', 'glossary.registration'],
  ['glossaryInventory', 'glossary.inventory'],
];

function Term({ term, definition }: { term: UiKey; definition: UiKey }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(v => !v)}
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false);
        }}
        className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-lg border border-border px-3 text-left font-medium"
      >
        {t(term)}
        <span aria-hidden="true">{open ? '−' : '+'}</span>
      </button>
      <p id={id} hidden={!open} className="px-3 pt-1 pb-2 text-sm text-muted">
        {t(definition)}
      </p>
    </li>
  );
}

export function Glossary() {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-2">
      <h2 id={headingId} className="text-lg font-semibold">
        {t('glossaryTitle')}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {TERMS.map(([term, definition]) => (
          <Term key={term} term={term} definition={definition} />
        ))}
      </ul>
    </section>
  );
}
