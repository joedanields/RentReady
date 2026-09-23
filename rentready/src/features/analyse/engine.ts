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
  let text: string;
  try {
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
    // Offline or too slow: the rules still run locally, so show that report instead of nothing.
    const code = (e as { code?: string }).code;
    if (code === 'NETWORK' || code === 'TIMEOUT' || code === 'SERVICE_BUSY') {
      return { ...analyseDocument({ answers, clauses, localOnly: true }), fallback: code };
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

  const { text } = await generateContent({
    model,
    apiKey,
    system: buildSystemPreamble({
      language: preferences.language,
      readingLevel: preferences.readingLevel,
      city,
    }),
    userPrompt: buildAskUserPrompt(question, clauses),
    responseSchema: ASK_SCHEMA,
    temperature: 0.2,
    maxOutputTokens: LIMITS.MAX_SMALL_CALL_TOKENS,
  });
  try {
    return processAskResponse({ clauses, modelResponse: JSON.parse(repairJson(text)) });
  } catch {
    throw createAppError('MODEL_INVALID_OUTPUT');
  }
}
