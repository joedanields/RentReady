/** Mark — highlight a quoted substring by splitting into React nodes (never dangerouslySetInnerHTML) */



export function Mark({ text, highlight }: { text: string; highlight: string }) {
  if (!highlight) return <>{text}</>;

  const needle = highlight.trim();
  if (!needle) return <>{text}</>;

  const idx = text.toLowerCase().indexOf(needle.toLowerCase());
  if (idx === -1) return <>{text}</>;

  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + needle.length);
  const after = text.slice(idx + needle.length);

  return (
    <>
      {before}
      <mark className="bg-yellow-200 rounded px-0.5">{match}</mark>
      {after}
    </>
  );
}