/** Progress bar — role="progressbar" with aria-valuenow */

export function Progress({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100);
  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-valuenow={current}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${current} of ${total}`}
        className="h-2 w-full rounded-full bg-gray-200"
      >
        <div
          className="h-2 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}