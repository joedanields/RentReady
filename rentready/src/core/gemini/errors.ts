/** Error handling and redaction for the Gemini client — pure TS, no DOM */

import type { AppError } from '../types.js';

export type { AppError };

/** Redact common API key patterns from arbitrary strings */
export function redact(text: string): string {
  const KEY_PATTERN = /AIza[0-9A-Za-z_-]{20,}/g;
  const GENERIC_KEY_PATTERN = /(api[_-]?key|key)\s*[=:]\s*['"]?[A-Za-z0-9_-]{8,}['"]?/gi;
  const BEARER_PATTERN = /(Bearer\s+)[A-Za-z0-9._~+/-]+/gi;

  return text
    .replace(KEY_PATTERN, 'AIza••••••[redacted]')
    .replace(GENERIC_KEY_PATTERN, '$1=[redacted]')
    .replace(BEARER_PATTERN, '$1[redacted]');
}

export type ErrorCode =
  | 'INVALID_FILE'
  | 'TOO_LARGE'
  | 'SCANNED_PDF'
  | 'NO_KEY'
  | 'KEY_REJECTED'
  | 'RATE_LIMITED'
  | 'QUOTA'
  | 'MODEL_BLOCKED'
  | 'MODEL_INVALID_OUTPUT'
  | 'NETWORK'
  | 'BUDGET_EXHAUSTED'
  | 'TIMEOUT'
  | 'UNKNOWN';

export const ERROR_MESSAGES: Record<ErrorCode, { message: string; retryable: boolean }> = {
  INVALID_FILE: {
    message: 'That file could not be read. Please use a PDF, DOCX, or paste the text instead.',
    retryable: false,
  },
  TOO_LARGE: {
    message: 'That file is too large. Please use a file under 10 MB, or paste the text instead.',
    retryable: false,
  },
  SCANNED_PDF: {
    message:
      'This looks like a scanned PDF with no selectable text. Please paste the agreement text instead.',
    retryable: false,
  },
  NO_KEY: {
    message: 'No API key set. Add your key in Settings, or continue in Demo mode.',
    retryable: true,
  },
  KEY_REJECTED: {
    message: 'Your key was rejected. Check it in Google AI Studio, or continue in Demo mode.',
    retryable: true,
  },
  RATE_LIMITED: {
    message: 'Too many requests. Wait a moment and try again, or use Demo mode.',
    retryable: true,
  },
  QUOTA: {
    message: 'Your free-tier quota may be exhausted. Try again later or use Demo mode.',
    retryable: true,
  },
  MODEL_BLOCKED: {
    message: 'The model declined to respond. Try rephrasing, or use Demo mode.',
    retryable: false,
  },
  MODEL_INVALID_OUTPUT: {
    message: 'The model returned an unexpected response. Please try again.',
    retryable: true,
  },
  NETWORK: {
    message: 'Network error. The agreement is only analysed when your device is online.',
    retryable: true,
  },
  BUDGET_EXHAUSTED: {
    message: "You've used this session's analysis budget. Reload to reset, or use Demo mode.",
    retryable: false,
  },
  TIMEOUT: { message: 'The request took too long. Try again, or use Demo mode.', retryable: true },
  UNKNOWN: { message: 'Something went wrong. Please try again.', retryable: true },
};

/**
 * Builds a typed error. `details` (an HTTP body, a fetch message) is redacted and kept apart
 * from the user-facing message: the UI shows the translated message for `code`, never raw
 * provider output, which may echo request data.
 */
export function createAppError(code: ErrorCode, details?: string): AppError {
  const { message, retryable } = ERROR_MESSAGES[code];
  return details
    ? { code, message, retryable, details: redact(details) }
    : { code, message, retryable };
}

/** Post-process an error from a fetch call to a typed AppError */
export function mapHttpError(status: number, body: string): AppError {
  switch (status) {
    case 400:
    case 401:
    case 403:
      return createAppError('KEY_REJECTED', body);
    case 429:
      // Free-tier daily quota and per-minute rate limits share 429; only the body tells them apart.
      return createAppError(/quota/i.test(body) ? 'QUOTA' : 'RATE_LIMITED', body);
    case 500:
    case 502:
    case 503:
      return createAppError('NETWORK', body);
    default:
      return createAppError('UNKNOWN', body);
  }
}
