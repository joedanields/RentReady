/** Analysis engine — local rules always run; Gemini adds match/protection findings (demo=recorded) */

import { analyseDocument } from '../../core/analysis';
import { segmentClauses } from '../../core/parsing/segmenter';
import { generateContent, repairJson } from '../../core/gemini/client';
import {
  buildSystemPreamble,
  buildAnalysisUserPrompt,
  serialiseClausesForPrompt,
} from '../../core/gemini/prompts';
import { ANALYSIS_SCHEMA, DEFAULT_MODEL } from '../../core/gemini/responseSchemas';
import { createAppError } from '../../core/gemini/errors';
import type { Clause, InterviewAnswers, AnalysisResult, Preferences } from '../../core/types';
import { SAMPLE_PAGES, SAMPLE_ANALYSIS_RESPONSE } from '../../sample/sampleData';

export interface ParsedDocument {
  clauses: Clause[];
  rawText: string;
  pageCount: number;
}

export function parsePastedText(text: string): ParsedDocument {
  const clauses = segmentClauses(text);
  return { clauses, rawText: text, pageCount: 1 };
}

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
  onStage?: (stage: string) => void;
}

export async function runAnalysis(opts: AnalyseOptions): Promise<AnalysisResult> {
  const { answers, clauses, apiKey, model, preferences, budgetUsed, budgetLimit, demo, onStage } =
    opts;

  if (!demo && !apiKey) {
    throw createAppError('NO_KEY');
  }
  if (!demo && budgetUsed >= budgetLimit) {
    throw createAppError('BUDGET_EXHAUSTED');
  }

  const promptOpts = {
    language: preferences.language,
    readingLevel: preferences.readingLevel,
    city: answers.city,
  };

  // Demo mode: recorded response via the same pipeline
  if (demo) {
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
  const { text } = await generateContent({
    model,
    apiKey,
    system,
    userPrompt,
    responseSchema: ANALYSIS_SCHEMA,
    temperature: 0.2,
    maxOutputTokens: 8192,
  });

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
  return analyseDocument({ answers, clauses, modelResponse });
}

/** Default model from VITE_DEFAULT_MODEL (public, safe) or bundled default */
export function getDefaultModel(): string {
  const fromEnv = import.meta.env?.VITE_DEFAULT_MODEL;
  return typeof fromEnv === 'string' && fromEnv ? fromEnv : DEFAULT_MODEL;
}

export function serialiseAgreementForExport(rawText: string): string {
  return serialiseClausesForPrompt(segmentClauses(rawText).slice(0, 1));
}
