/** Interview questions — pure data, no UI logic */

import type { InterviewAnswers } from '../types.js';

export interface InterviewQuestion {
  key: keyof InterviewAnswers;
  label: string;
  hint: string;
  type: 'text' | 'money' | 'select' | 'multiselect';
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
  chips?: string[];
}

export const INTERVIEW_QUESTIONS: InterviewQuestion[] = [
  {
    key: 'city',
    label: 'Which city is the place in?',
    hint: 'Used only to show "rules vary by state" context',
    type: 'text',
    placeholder: 'e.g., Bengaluru, Mumbai, Delhi',
  },
  {
    key: 'monthlyRent',
    label: 'What monthly rent did you agree to?',
    hint: 'Examples: 40000, 40,000, ₹40k, Rs. 40000/-',
    type: 'money',
    placeholder: '₹40,000',
  },
  {
    key: 'deposit',
    label: 'What security deposit did you agree to?',
    hint: 'Amount or "N months of rent" — e.g., 80000 or "2 months"',
    type: 'money',
    placeholder: '₹80,000 or 2 months',
  },
  {
    key: 'duration',
    label: 'How long is the agreement meant to run?',
    hint: '11 months is the common Indian default',
    type: 'select',
    options: [
      { value: '11 months', label: '11 months' },
      { value: '1 year', label: '1 year' },
      { value: '2 years', label: '2 years' },
      { value: 'other', label: 'Other' },
    ],
  },
  {
    key: 'lockIn',
    label: 'Were you told you must stay a minimum period?',
    hint: 'Lock-in means leaving early can cost rent or deposit',
    type: 'select',
    options: [
      { value: 'no', label: 'No lock-in' },
      { value: 'yes', label: 'Yes, I was told a minimum stay' },
      { value: 'not_sure', label: 'Not sure' },
    ],
  },
  {
    key: 'noticePeriod',
    label: 'How much notice did you agree to give before leaving?',
    hint: 'Standard is often 1 month, but varies',
    type: 'select',
    options: [
      { value: '15 days', label: '15 days' },
      { value: '1 month', label: '1 month' },
      { value: '2 months', label: '2 months' },
      { value: 'other', label: 'Other' },
      { value: 'not_sure', label: 'Not sure' },
    ],
  },
  {
    key: 'maintenance',
    label: 'Who pays society maintenance?',
    hint: 'Monthly society charges, not repairs',
    type: 'select',
    options: [
      { value: 'me', label: 'Me (tenant)' },
      { value: 'owner', label: 'Owner' },
      { value: 'split', label: 'Split between us' },
      { value: 'not_discussed', label: 'Not discussed' },
    ],
  },
  {
    key: 'repairs',
    label: 'Who was going to handle repairs (plumbing, appliances)?',
    hint: 'Think: leaking tap, AC not working, geyser broken',
    type: 'select',
    options: [
      { value: 'me', label: 'Me (tenant)' },
      { value: 'owner', label: 'Owner' },
      { value: 'split', label: 'Small ones me, big ones owner' },
      { value: 'not_discussed', label: 'Not discussed' },
    ],
  },
  {
    key: 'increase',
    label: 'Was a yearly rent increase mentioned?',
    hint: 'Many agreements have 5–10% on renewal',
    type: 'select',
    options: [
      { value: 'no', label: 'No increase mentioned' },
      { value: 'yes', label: 'Yes, a percentage was mentioned' },
      { value: 'not_sure', label: 'Not sure' },
    ],
  },
  {
    key: 'extras',
    label: 'Anything else you were promised?',
    hint: 'Select all that apply, or type your own',
    type: 'multiselect',
    chips: [
      'Parking included',
      'Furniture included',
      'Pets allowed',
      'Guests allowed',
      'Painting before move-in',
      'WiFi included',
      'Water tanker',
      'Power backup',
    ],
  },
];

export const INITIAL_INTERVIEW_ANSWERS: InterviewAnswers = {
  city: null,
  monthlyRent: null,
  deposit: null,
  duration: null,
  lockIn: null,
  noticePeriod: null,
  maintenance: null,
  repairs: null,
  increase: null,
  extras: [],
};
