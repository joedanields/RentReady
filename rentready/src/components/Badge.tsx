/** Badge for statuses, severities and verification states — icon + word + colour */

import { clsx } from 'clsx';

export type BadgeTone =
  | 'matches'
  | 'differs'
  | 'notcovered'
  | 'unclear'
  | 'info'
  | 'present'
  | 'absent'
  | 'verified'
  | 'fuzzy'
  | 'unverified'
  | 'high'
  | 'medium';

const toneClasses: Record<BadgeTone, string> = {
  matches: 'bg-green-100 text-green-800 border-green-300',
  differs: 'bg-red-100 text-red-800 border-red-300',
  notcovered: 'bg-amber-100 text-amber-900 border-amber-300',
  unclear: 'bg-gray-100 text-gray-700 border-gray-300',
  info: 'bg-blue-100 text-blue-800 border-blue-300',
  present: 'bg-green-100 text-green-800 border-green-300',
  absent: 'bg-amber-100 text-amber-900 border-amber-300',
  verified: 'bg-green-100 text-green-800 border-green-300',
  fuzzy: 'bg-yellow-100 text-yellow-900 border-yellow-300',
  unverified: 'bg-gray-100 text-gray-600 border-gray-300',
  high: 'bg-red-100 text-red-800 border-red-300',
  medium: 'bg-amber-100 text-amber-900 border-amber-300'
};

const toneIcons: Record<BadgeTone, string> = {
  matches: '✓',
  differs: '✗',
  notcovered: '—',
  unclear: '?',
  info: 'i',
  present: '✓',
  absent: '—',
  verified: '✓',
  fuzzy: '~',
  unverified: '!',
  high: '▲',
  medium: '◆'
};

export function Badge({
  tone,
  label,
  className
}: {
  tone: BadgeTone;
  label: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium',
        toneClasses[tone],
        className
      )}
    >
      <span aria-hidden="true">{toneIcons[tone]}</span>
      <span>{label}</span>
    </span>
  );
}