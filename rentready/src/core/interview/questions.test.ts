import { describe, it, expect } from 'vitest';
import {
  INTERVIEW_QUESTIONS,
  INITIAL_INTERVIEW_ANSWERS,
  type InterviewQuestion,
} from './questions';
import type { InterviewAnswers } from '../types';

const byKey = (key: string): InterviewQuestion => INTERVIEW_QUESTIONS.find(q => q.key === key)!;

describe('INTERVIEW_QUESTIONS', () => {
  it('covers every answer key exactly once in interview order', () => {
    const keys = INTERVIEW_QUESTIONS.map(q => q.key);
    expect(new Set(keys).size).toBe(keys.length);
    const allKeys: Array<keyof InterviewAnswers> = [
      'city',
      'monthlyRent',
      'deposit',
      'duration',
      'lockIn',
      'noticePeriod',
      'maintenance',
      'repairs',
      'increase',
      'extras',
    ];
    expect(keys).toEqual(allKeys);
    expect(keys[0]).toBe('city');
  });

  it('always includes a hint', () => {
    for (const q of INTERVIEW_QUESTIONS) {
      expect(q.hint.length).toBeGreaterThan(0);
      expect(q.label.length).toBeGreaterThan(0);
    }
  });

  it('select questions offer the values used by normalisers', () => {
    const select = INTERVIEW_QUESTIONS.filter(q => q.type === 'select');
    expect(select.length).toBeGreaterThan(3);
    for (const q of select) {
      expect(q.options!.length).toBeGreaterThanOrEqual(3);
      for (const opt of q.options!) {
        expect(opt.value.length).toBeGreaterThan(0);
        expect(opt.label.length).toBeGreaterThan(0);
      }
    }
  });

  it('duration offers the 11-month default', () => {
    expect(byKey('duration').options!.map(o => o.value)).toContain('11 months');
  });

  it('extras is a multiselect with chips', () => {
    const extras = byKey('extras');
    expect(extras.type).toBe('multiselect');
    expect(extras.chips!).toContain('Parking included');
    expect(extras.chips!.length).toBeGreaterThanOrEqual(6);
  });

  it('money questions have placeholders', () => {
    expect(byKey('monthlyRent').placeholder).toBeDefined();
    expect(byKey('deposit').placeholder).toBeDefined();
  });
});

describe('INITIAL_INTERVIEW_ANSWERS', () => {
  it('starts empty with no extras', () => {
    expect(INITIAL_INTERVIEW_ANSWERS).toEqual({
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
    });
  });
});
