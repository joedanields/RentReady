/** Analysis engine — local rules always run; Gemini adds match/protection findings (demo=recorded) */

import { analyseDocument } from '../../core/analysis';
import { segmentClauses } from '../../core/parsing/segmenter';
import { generateContent, repairJson } from '../../core/gemini/client';
import {
  buildSystemPreamble,
  buildAnalysisUserPrompt,
  buildAskUserPrompt,
} from '../../core/gemini/prompts';
import { ANALYSIS_SCHEMA, ASK_SCHEMA, DEFAULT_MODEL } from '../../core/gemini/responseSchemas';
import { processAskResponse } from '../../core/gemini/processors';
import { LIMITS } from '../../core/limits';
import { createAppError } from '../../core/gemini/errors';
import type {
  Clause,
  InterviewAnswers,
  AnalysisResult,
  AskResult,
  Preferences,
} from '../../core/types';
import {
  SAMPLE_PAGES,
  SAMPLE_ANALYSIS_RESPONSE,
  SAMPLE_ASK_RESPONSES,
} from '../../sample/sampleData';
import type { ParsedDocument } from '../../core/parsing/intake';

export type { ParsedDocument };

export function parseSampleAgreement(): ParsedDocument {
  const clauses = segmentClauses(SAMPLE_PAGES.join('\n'), SAMPLE_PAGES);
  return {
    clauses,
    rawText: SAMPLE_PAGES.join('\n\n'),
    pageCount: SAMPLE_PAGES.length,
  };
}

/** Run local-only analysis (no AI). Phase 4 core behaviour. */
export function analyseLocalOnly(answers: InterviewAnswers, clauses: Clause[]): AnalysisResult {
  return analyseDocument({ answers, clauses, localOnly: true });
}

export interface AnalyseOptions {
  answers: InterviewAnswers;
  clauses: Clause[];
  apiKey: string | null;
  model: string;
  preferences: Preferences;
  budgetUsed: number;
  budgetLimit: number;
  demo: boolean;
  /** True only for the bundled sample: recorded responses describe that agreement and no other. */
  isSample: boolean;
  onStage?: (stage: string) => void;
  /** Called once per real Gemini request (not for cached or recorded answers): the budget. */
  onCall?: () => void;
}

/**
 * Results of real Gemini calls, keyed by a hash of the exact request (model + system prompt +
 * user prompt, which contain the settings, answers and agreement). Asking the same thing twice
 * — re-running a report, re-asking a question — costs no second call or quota. Memory only,
 * bounded, cleared with the tab.
 */
const aiCache = new Map<string, unknown>();
const AI_CACHE_LIMIT = 16;

/** FNV-1a: a fast, dependency-free hash; collisions are irrelevant at this cache size. */
function hashKey(parts: string[]): string {
  let h = 0x811c9dc5;
  for (const ch of parts.join('\u0000')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

async function cached<T>(parts: string[], compute: () => Promise<T>): Promise<T> {
  const key = hashKey(parts);
  if (aiCache.has(key)) return aiCache.get(key) as T;
  const value = await compute();
  aiCache.set(key, value);
  if (aiCache.size > AI_CACHE_LIMIT) aiCache.delete(aiCache.keys().next().value!);
  return value;
}

/** Test hook: start from an empty cache. */
export function clearAiCache(): void {
  aiCache.clear();
}

export async function runAnalysis(opts: AnalyseOptions): Promise<AnalysisResult> {
  const {
    answers,
    clauses,
    apiKey,
    model,
    preferences,
    budgetUsed,
    budgetLimit,
    demo,
    isSample,
    onStage,
  } = opts;

  // No key, and nothing recorded for this document: the local report (rules only) is still
  // genuinely useful, so give it instead of an error.
  if (!(demo && isSample) && !apiKey) {
    onStage?.('rules');
    return analyseDocument({ answers, clauses, localOnly: true });
  }
  if (!(demo && isSample) && budgetUsed >= budgetLimit) {
    throw createAppError('BUDGET_EXHAUSTED');
  }

  const promptOpts = {
    language: preferences.language,
    readingLevel: preferences.readingLevel,
    city: answers.city,
  };

  // Demo mode on the sample: recorded response through the same validation and verification.
  if (demo && isSample) {
    onStage?.('reading');
    await new Promise(r => setTimeout(r, 400));

    const result = analyseDocument({
      answers,
      clauses,
      modelResponse: SAMPLE_ANALYSIS_RESPONSE,
    });
    onStage?.('rules');
    await new Promise(r => setTimeout(r, 400));
    return result;
  }

  const system = buildSystemPreamble(promptOpts);
  const userPrompt = buildAnalysisUserPrompt(answers, clauses);

  onStage?.('calling');
  if (!apiKey) throw createAppError('NO_KEY');
  try {
    return await cached([model, system, userPrompt], () =>
      analyseWithGemini({ ...opts, apiKey }, system, userPrompt)
    );
  } catch (e) {
    // Offline, too slow or Gemini busy: the rules still run locally, so show that report.
    const fallback = (e as { fallback?: AnalysisResult['fallback'] }).fallback;
    if (fallback) return { ...analyseDocument({ answers, clauses, localOnly: true }), fallback };
    throw e;
  }
}

async function analyseWithGemini(
  opts: AnalyseOptions & { apiKey: string },
  system: string,
  userPrompt: string
): Promise<AnalysisResult> {
  const { answers, clauses, apiKey, model, onStage } = opts;
  let text: string;
  try {
    opts.onCall?.();
    ({ text } = await generateContent({
      model,
      apiKey,
      system,
      userPrompt,
      responseSchema: ANALYSIS_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 8192,
    }));
  } catch (e) {
    // Offline, too slow or busy: tag the error so runAnalysis shows the offline report. Throwing
    // (rather than returning) keeps this failure out of the AI cache.
    const code = (e as { code?: string }).code;
    if (code === 'NETWORK' || code === 'TIMEOUT' || code === 'SERVICE_BUSY') {
      throw Object.assign(new Error(code), { fallback: code });
    }
    throw e;
  }

  if (!text.trim()) {
    throw createAppError('MODEL_INVALID_OUTPUT');
  }

  const repaired = repairJson(text);
  let modelResponse: unknown;
  try {
    modelResponse = JSON.parse(repaired);
  } catch {
    throw createAppError('MODEL_INVALID_OUTPUT');
  }

  onStage?.('verify');
  try {
    return analyseDocument({ answers, clauses, modelResponse });
  } catch {
    // Zod rejected the shape: never show a half-validated report.
    throw createAppError('MODEL_INVALID_OUTPUT');
  }
}

/** Default model from VITE_DEFAULT_MODEL (public, safe) or bundled default */
export function getDefaultModel(): string {
  const fromEnv = import.meta.env?.VITE_DEFAULT_MODEL;
  return typeof fromEnv === 'string' && fromEnv ? fromEnv : DEFAULT_MODEL;
}

export interface AskOptions {
  question: string;
  clauses: Clause[];
  apiKey: string | null;
  model: string;
  preferences: Preferences;
  city: string | null;
  budgetUsed: number;
  budgetLimit: number;
  demo: boolean;
  isSample: boolean;
  /** Called once per real Gemini request (not for cached or recorded answers). */
  onCall?: () => void;
}

/** Normalises a question for matching against the recorded demo questions. */
const questionKey = (q: string) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Answers a question about the agreement. The sample in demo mode uses recorded answers (only
 * for the questions that were recorded — anything else gets NO_KEY, never an invented answer);
 * otherwise a key is required. Every answer goes through processAskResponse, which verifies
 * citations and downgrades an uncited "answered" to "not_in_document".
 */
export async function runAsk(opts: AskOptions): Promise<AskResult> {
  const { question, clauses, apiKey, model, preferences, city, demo, isSample } = opts;

  if (demo && isSample && !apiKey) {
    const recorded = SAMPLE_ASK_RESPONSES.find(
      r => questionKey(r.question) === questionKey(question)
    );
    if (!recorded) throw createAppError('NO_KEY');
    return processAskResponse({ clauses, modelResponse: recorded.response });
  }
  if (!apiKey) throw createAppError('NO_KEY');
  if (opts.budgetUsed >= opts.budgetLimit) throw createAppError('BUDGET_EXHAUSTED');

  const system = buildSystemPreamble({
    language: preferences.language,
    readingLevel: preferences.readingLevel,
    city,
  });
  const userPrompt = buildAskUserPrompt(question, clauses);
  return cached([model, system, userPrompt], async () => {
    opts.onCall?.();
    const { text } = await generateContent({
      model,
      apiKey,
      system,
      userPrompt,
      responseSchema: ASK_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: LIMITS.MAX_SMALL_CALL_TOKENS,
    });
    try {
      return processAskResponse({ clauses, modelResponse: JSON.parse(repairJson(text)) });
    } catch {
      throw createAppError('MODEL_INVALID_OUTPUT');
    }
  });
}
