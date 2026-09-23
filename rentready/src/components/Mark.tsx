/**
 * Mark — highlights a quote inside clause text by splitting it into React nodes (never
 * dangerouslySetInnerHTML). Uses the offsets verifyQuote mapped back to the original text when
 * present; otherwise falls back to a case-insensitive search.
 */

export function Mark({
  text,
  highlight,
  start,
  end,
}: {
  text: string;
  highlight: string;
  start?: number | undefined;
  end?: number | undefined;
}) {
  let from = -1;
  let to = -1;
  if (start !== undefined && end !== undefined && start >= 0 && end > start && end <= text.length) {
    from = start;
    to = end;
  } else {
    const needle = highlight.trim();
    from = needle ? text.toLowerCase().indexOf(needle.toLowerCase()) : -1;
    to = from + needle.length;
  }
  if (from === -1) return <>{text}</>;

  return (
    <>
      {text.slice(0, from)}
      <mark className="rounded bg-yellow-200 px-0.5 text-ink">{text.slice(from, to)}</mark>
      {text.slice(to)}
    </>
  );
}
