import { describe, expect, it } from 'vitest';
import { INITIAL_STATE, reducer } from './reducer';
import type { AppState } from '../core/types';

const answered = (): AppState =>
  reducer(
    reducer(INITIAL_STATE, { type: 'SET_INTERVIEW_ANSWER', key: 'deposit', value: '80000' }),
    { type: 'SET_INTERVIEW_ANSWER', key: 'extras', value: ['Pets allowed'] }
  );

describe('reducer — interview', () => {
  it('stores answers without touching other keys', () => {
    const s = answered();
    expect(s.interview.answers.deposit).toBe('80000');
    expect(s.interview.answers.extras).toEqual(['Pets allowed']);
    expect(s.interview.answers.monthlyRent).toBeNull();
    expect(INITIAL_STATE.interview.answers.deposit).toBeNull();
  });

  it('clears a skipped answer to null, and extras to an empty list', () => {
    let s = reducer(answered(), { type: 'CLEAR_INTERVIEW_ANSWER', key: 'deposit' });
    s = reducer(s, { type: 'CLEAR_INTERVIEW_ANSWER', key: 'extras' });
    expect(s.interview.answers.deposit).toBeNull();
    expect(s.interview.answers.extras).toEqual([]);
  });

  it('tracks the current step and completion', () => {
    let s = reducer(INITIAL_STATE, { type: 'SET_INTERVIEW_STEP', step: 4 });
    s = reducer(s, { type: 'SET_INTERVIEW_COMPLETED', completed: true });
    expect(s.interview.currentStep).toBe(4);
    expect(s.interview.completed).toBe(true);
  });
});

describe('reducer — RESET_ALL', () => {
  it('returns every slice to its initial value, including the key and demo flag', () => {
    let s = answered();
    s = reducer(s, { type: 'SET_KEY', key: 'secret-in-memory' });
    s = reducer(s, { type: 'SET_KEY_REMEMBER', remember: true });
    s = reducer(s, { type: 'SET_DEMO', demo: true });
    s = reducer(s, { type: 'SET_PREFERENCES', prefs: { language: 'hi' } });
    s = reducer(s, { type: 'INCREMENT_BUDGET' });
    s = reducer(s, {
      type: 'SET_DOCUMENT',
      document: { rawText: 'agreement text', fileName: 'a.pdf' },
    });
    const reset = reducer(s, { type: 'RESET_ALL' });
    expect(reset).toEqual(INITIAL_STATE);
    expect(JSON.stringify(reset)).not.toContain('secret-in-memory');
  });

  it('never hands back the shared initial object, so later updates cannot mutate it', () => {
    const reset = reducer(answered(), { type: 'RESET_ALL' });
    expect(reset).not.toBe(INITIAL_STATE);
    reset.interview.answers.extras.push('mutated');
    expect(INITIAL_STATE.interview.answers.extras).toEqual([]);
  });
});

describe('reducer — demo flag', () => {
  it('turns demo mode on and off', () => {
    const on = reducer(INITIAL_STATE, { type: 'SET_DEMO', demo: true });
    expect(on.demo).toBe(true);
    expect(reducer(on, { type: 'SET_DEMO', demo: false }).demo).toBe(false);
  });
});
