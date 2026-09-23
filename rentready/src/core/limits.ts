/** Size, page, character caps and request budget */

export const LIMITS = {
  /** Max file size in bytes (10 MB) */
  MAX_FILE_SIZE: 10 * 1024 * 1024,
  /** Max pages for PDF */
  MAX_PAGES: 40,
  /** Max characters for agreement text */
  MAX_CHARS: 120_000,
  /** Max clauses before splitting AI call */
  MAX_CLAUSES_PER_CALL: 120,
  /** Default AI call budget per session */
  DEFAULT_BUDGET: 12,
  /** Max question length for Ask */
  MAX_QUESTION_CHARS: 500,
  /** Min quote length for verification */
  MIN_QUOTE_LENGTH: 12,
  /** Max quote length */
  MAX_QUOTE_LENGTH: 200,
  /** Analysis timeout in ms */
  ANALYSIS_TIMEOUT: 25_000,
  /** Max output tokens for analysis call */
  MAX_ANALYSIS_TOKENS: 8192,
  /** Max output tokens for ask/negotiation calls */
  MAX_SMALL_CALL_TOKENS: 1536
} as const;

export type LimitKey = keyof typeof LIMITS;