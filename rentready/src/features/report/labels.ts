/** Feature-local label helpers for verdict rows (must stay in sync with INTERVIEW questions) */

import type { InterviewAnswers } from '../../core/types';

const TOPIC_LABELS: Record<keyof InterviewAnswers, string> = {
  city: 'City',
  monthlyRent: 'Monthly rent',
  deposit: 'Security deposit',
  duration: 'Agreement duration',
  lockIn: 'Lock-in period',
  noticePeriod: 'Notice period',
  maintenance: 'Maintenance charges',
  repairs: 'Repairs',
  increase: 'Rent increase',
  extras: 'Extra promises',
};

export function topicLabel(key: keyof InterviewAnswers): string {
  return TOPIC_LABELS[key] ?? key;
}

export function verdictWord(verdict: string): string {
  switch (verdict) {
    case 'matches':
      return 'Matches what you were told';
    case 'differs':
      return "Doesn't match what you were told";
    case 'not_covered':
      return 'Not covered by the agreement';
    case 'unclear':
      return "Couldn't confirm";
    default:
      return verdict;
  }
}
