/** Privacy — no-server guarantee */

import { t } from '../../i18n';

export function Privacy() {
  return (
    <section aria-labelledby="privacy-title" className="space-y-4 pt-2">
      <h1 id="privacy-title" className="text-2xl font-semibold">
        {t('privacy')}
      </h1>
      <ul className="list-disc space-y-3 pl-5">
        <li>There is no backend. This site is static files served from Cloudflare Pages.</li>
        <li>
          Your agreement is parsed and analysed in your browser and sent only to Google&apos;s
          Gemini API when you provide a key and run an AI analysis.
        </li>
        <li>
          Your Gemini key is held in memory for this tab only. It is never stored, copied to the
          clipboard, put in URLs, or exported.
        </li>
        <li>We don&apos;t use cookies, trackers, or analytics.</li>
        <li>Local checks (rules, checklist, move-in kit) never leave your device.</li>
      </ul>
    </section>
  );
}
