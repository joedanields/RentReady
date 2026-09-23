import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearAiCache,
  runAnalysis,
  runAsk,
  parseSampleAgreement,
  type AnalyseOptions,
} from './engine';
import { SAMPLE_ANALYSIS_RESPONSE, SAMPLE_DEMO_INTERVIEW_INPUT } from '../../sample/sampleData';
import { fakeKey } from '../../../tests/fakeKey';
import { aiErrorMessage } from './aiError';
import { ui } from '../../i18n/en';

const KEY = fakeKey();
const sample = parseSampleAgreement();

function opts(overrides: Partial<AnalyseOptions> = {}): AnalyseOptions {
  return {
    answers: SAMPLE_DEMO_INTERVIEW_INPUT,
    clauses: sample.clauses,
    apiKey: null,
    model: 'gemini-2.5-flash',
    preferences: { language: 'en', readingLevel: 'standard', theme: 'system' },
    budgetUsed: 0,
    budgetLimit: 12,
    demo: false,
    isSample: false,
    ...overrides,
  };
}

const geminiReply = (payload: unknown) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] } }] }),
    { status: 200 }
  );

afterEach(() => {
  clearAiCache();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('runAnalysis routing', () => {
  it('uses the recorded response only for the sample in demo mode', async () => {
    vi.useFakeTimers();
    const pending = runAnalysis(opts({ demo: true, isSample: true }));
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.mode).toBe('ai');
    expect(result.matches.find(m => m.key === 'deposit')?.verdict).toBe('differs');
  });

  it('gives the local report for the user’s own document without a key, even in demo mode', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const result = await runAnalysis(opts({ demo: true, isSample: false }));
    expect(result.mode).toBe('local');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('calls Gemini with the key in a header only, then verifies the response in code', async () => {
    const fetch = vi.fn(async () => geminiReply(SAMPLE_ANALYSIS_RESPONSE));
    vi.stubGlobal('fetch', fetch);
    const result = await runAnalysis(opts({ apiKey: KEY }));
    expect(result.mode).toBe('ai');
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/generativelanguage\.googleapis\.com\//);
    expect(url).not.toContain(KEY);
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    expect(String(init.body)).not.toContain(KEY);
    expect(String(init.body)).toContain('<agreement>');
  });

  it('falls back to the local report when offline, and says why', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    );
    vi.useFakeTimers();
    const pending = runAnalysis(opts({ apiKey: KEY }));
    await vi.runAllTimersAsync();
    const result = await pending;
    expect(result.mode).toBe('local');
    expect(result.fallback).toBe('NETWORK');
  });

  it('answers a repeated request from memory: no second call, budget counted once', async () => {
    const fetch = vi.fn(async () => geminiReply(SAMPLE_ANALYSIS_RESPONSE));
    vi.stubGlobal('fetch', fetch);
    const onCall = vi.fn();
    const first = await runAnalysis(opts({ apiKey: KEY, onCall }));
    const second = await runAnalysis(opts({ apiKey: KEY, onCall }));
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onCall).toHaveBeenCalledTimes(1);
    // A different answer set is a different request.
    await runAnalysis(
      opts({
        apiKey: KEY,
        onCall,
        answers: { ...SAMPLE_DEMO_INTERVIEW_INPUT, deposit: '3 months' },
      })
    );
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('caches Ask answers the same way', async () => {
    const reply = {
      status: 'not_in_document',
      answer: 'No.',
      citations: [],
      missingInfo: [],
      suggestedQuestions: [],
    };
    const fetch = vi.fn(async () => geminiReply(reply));
    vi.stubGlobal('fetch', fetch);
    const ask = () =>
      runAsk({
        question: 'Can I keep a cat?',
        clauses: sample.clauses,
        apiKey: KEY,
        model: 'm',
        preferences: { language: 'en', readingLevel: 'standard', theme: 'system' },
        city: null,
        budgetUsed: 0,
        budgetLimit: 12,
        demo: false,
        isSample: false,
      });
    expect((await ask()).status).toBe('not_in_document');
    await ask();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache a failed call: offline now, answered later', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('Failed to fetch')))
    );
    vi.useFakeTimers();
    const pending = runAnalysis(opts({ apiKey: KEY }));
    await vi.runAllTimersAsync();
    expect((await pending).mode).toBe('local');
    vi.useRealTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => geminiReply(SAMPLE_ANALYSIS_RESPONSE))
    );
    expect((await runAnalysis(opts({ apiKey: KEY }))).mode).toBe('ai');
  });

  it('refuses when the session budget is used up, without calling Gemini', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    await expect(runAnalysis(opts({ apiKey: KEY, budgetUsed: 12 }))).rejects.toMatchObject({
      code: 'BUDGET_EXHAUSTED',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('never lets the key reach an error the user sees', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(`API key not valid: ${KEY}`, { status: 400 }))
    );
    const err = await runAnalysis(opts({ apiKey: KEY })).catch((e: unknown) => e);
    expect(JSON.stringify(err)).not.toContain(KEY);
    expect(aiErrorMessage(err)).toBe(ui['aiError.KEY_REJECTED']);
  });

  it('rejects unusable model output as MODEL_INVALID_OUTPUT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => geminiReply({ overview: 42 }))
    );
    await expect(runAnalysis(opts({ apiKey: KEY }))).rejects.toMatchObject({
      code: 'MODEL_INVALID_OUTPUT',
    });
  });
});

describe('aiErrorMessage', () => {
  it('falls back to a generic message for unknown or missing codes', () => {
    expect(aiErrorMessage({ code: 'WHATEVER' })).toBe(ui['aiError.UNKNOWN']);
    expect(aiErrorMessage(null)).toBe(ui['aiError.UNKNOWN']);
    expect(aiErrorMessage({ code: 'QUOTA' })).toBe(ui['aiError.QUOTA']);
  });
});
