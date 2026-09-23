/** How this works — neutral explanation, no legal claims */

import { t } from '../../i18n';

export function HowItWorks() {
  return (
    <section aria-labelledby="how-title" className="space-y-4 pt-2">
      <h1 id="how-title" className="text-2xl font-semibold">
        {t('howThisWorks')}
      </h1>
      <ol className="list-decimal space-y-3 pl-5">
        <li>
          <strong>You answer 10 quick questions</strong> — rent, deposit, who fixes what, and any
          extras you were promised in person.
        </li>
        <li>
          <strong>Add your agreement</strong> — upload a PDF or DOCX, paste the text, or use the
          sample.
        </li>
        <li>
          <strong>We compare</strong> — your answers go to Google&apos;s Gemini with your key. The
          model reports what the agreement says; the rules and judgement stay in your browser.
        </li>
        <li>
          <strong>You see the gaps</strong> — what doesn&apos;t match, what&apos;s missing, and a
          plain-English explanation with the exact clause text (verified against the document).
        </li>
        <li>
          <strong>Send a message</strong> — draft a polite note to the owner, and get a move-in
          checklist.
        </li>
      </ol>
      <p className="rounded-xl border border-border p-4 text-sm text-muted">
        {t('legalDisclaimer')}
      </p>
    </section>
  );
}
