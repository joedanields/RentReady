/** Gemini client — plain fetch, no SDK. All errors redacted. Key never logged. */

import { createAppError, mapHttpError, redact, type AppError } from './errors.js';
import { LIMITS } from '../limits.js';

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta';

export interface GenerateParams {
  model: string;
  apiKey: string;
  system: string;
  userPrompt: string;
  responseSchema?: object;
  temperature: number;
  maxOutputTokens: number;
  timeoutMs?: number;
}

export interface GeminiResult {
  text: string;
  aborted: boolean;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    // AbortController timer cleared after we resolved
    return res;
  } catch (err) {
    if (controller.signal.aborted) {
      const e = err as Error;
      throw createAppError('TIMEOUT', e?.message);
    }
    throw createAppError('NETWORK', (err as Error)?.message);
  } finally {
    clearTimeout(timer);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/** Call generateContent with retry + JSON repair. Returns raw text. */
export async function generateContent(params: GenerateParams): Promise<GeminiResult> {
  const {
    model,
    apiKey,
    system,
    userPrompt,
    responseSchema,
    temperature,
    maxOutputTokens,
    timeoutMs = LIMITS.ANALYSIS_TIMEOUT,
  } = params;

  const url = `${GEMINI_ENDPOINT}/models/${encodeURIComponent(model)}:generateContent`;

  const body: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: { temperature, maxOutputTokens },
  };
  if (responseSchema) {
    body.generationConfig = {
      temperature,
      maxOutputTokens,
      responseMimeType: 'application/json',
      responseSchema,
    };
  }

  let attempts = 0;
  const maxAttempts = 2;
  let lastError: AppError | null = null;

  while (attempts < maxAttempts) {
    attempts++;
    try {
      const res = await fetchWithTimeout(
        url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(body),
        },
        timeoutMs
      );

      const rawBody = await res.text();

      if (!res.ok) {
        const appErr = mapHttpError(res.status, rawBody);
        if ((res.status === 429 || res.status >= 500) && attempts < maxAttempts) {
          const backoff = 500 * attempts + Math.random() * 500;
          await sleep(backoff);
          lastError = appErr;
          continue;
        }
        lastError = appErr;
        break;
      }

      // Gemini returns a JSON envelope: { candidates: [{ content: { parts: [{ text }] } }] }
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawBody);
      } catch {
        return { text: '', aborted: false }; // outer caller repairs
      }

      const text = extractTextFromEnvelope(parsed, rawBody);
      return { text, aborted: false };
    } catch (err) {
      const appErr = err as AppError;
      if (appErr?.retryable && attempts < maxAttempts) {
        await sleep(500 * attempts + Math.random() * 500);
        continue;
      }
      if (appErr?.code === 'TIMEOUT') {
        return { text: '', aborted: true };
      }
      throw appErr ?? createAppError('UNKNOWN');
    }
  }

  if (lastError) throw lastError;
  return { text: '', aborted: false };
}

type CandidateEnvelope = {
  content?: { parts?: Array<{ text?: string }> };
  finishReason?: string;
  promptFeedback?: { blockReason?: string };
};

function extractTextFromEnvelope(parsed: unknown, rawBody: string): string {
  if (
    parsed &&
    typeof parsed === 'object' &&
    'candidates' in parsed &&
    Array.isArray((parsed as { candidates: unknown }).candidates)
  ) {
    const candidates = (parsed as { candidates: CandidateEnvelope[] }).candidates;
    const first = candidates[0];
    if (first && typeof first === 'object') {
      const content = first.content;
      if (content?.parts) {
        const text = content.parts.map(p => (typeof p.text === 'string' ? p.text : '')).join('');
        if (text.trim()) return text.trim();
      }
      // Safety block
      if (first.finishReason === 'SAFETY' || first.promptFeedback?.blockReason) {
        throw createAppError('MODEL_BLOCKED');
      }
    }
  }
  // If we couldn't find text, keep raw body for repair attempt
  return extractFromRawBody(rawBody);
}

function extractFromRawBody(rawBody: string): string {
  try {
    const parsed = JSON.parse(rawBody) as { text?: string };
    if (typeof parsed.text === 'string') return parsed.text;
  } catch {
    // fall through
  }
  // If the whole output is markdown JSON (repair will strip), return as-is
  if (rawBody.trim().startsWith('{') || rawBody.trim().startsWith('[')) {
    return rawBody.trim();
  }
  return '';
}

/** Strip code fences / stray prose from a model JSON response, then return bare JSON */
export function repairJson(raw: string): string {
  let s = raw.trim();
  // Remove markdown fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  // Find first { ... to last }
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) {
    s = s.slice(start, end + 1);
  }
  return s;
}

export function isKeyFormatValid(key: string): boolean {
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(key.trim());
}

// Re-export redact for the error path so outer code can scrub model errors too
export { redact };
