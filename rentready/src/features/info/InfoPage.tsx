/** Shared layout for the three help pages that sit in the footer on every screen (WCAG 3.2.6). */

import { t, type UiKey } from '../../i18n';

export function InfoPage({
  title,
  items,
  ordered = false,
  children,
}: {
  title: UiKey;
  items: UiKey[];
  ordered?: boolean;
  children?: React.ReactNode;
}) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <section aria-labelledby="info-title" className="space-y-4 pt-2">
      <h1 id="info-title" className="text-2xl font-semibold">
        {t(title)}
      </h1>
      <List className={`${ordered ? 'list-decimal' : 'list-disc'} space-y-3 pl-5`}>
        {items.map(key => (
          <li key={key}>{t(key)}</li>
        ))}
      </List>
      {children}
    </section>
  );
}
