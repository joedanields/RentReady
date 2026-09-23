/** Zod schemas for all external boundaries — model responses, file input, URL params */

import { z } from 'zod';
import type {
  ModelAnalysisResponse,
  ModelAskResponse,
  ModelNegotiationResponse,
  InterviewAnswers,
  ProtectionId
} from './types.js';

export const modelMatchFindingSchema = z.object({
  key: z.string(),
  found: z.boolean(),
  writtenValue: z.string().nullable(),
  clauseId: z.string().nullable(),
  quote: z.string().nullable(),
  ambiguity: z.string().nullable()
});

export const modelProtectionFindingSchema = z.object({
  id: z.string(),
  state: z.enum(['present', 'absent', 'unclear']),
  summary: z.string().nullable(),
  clauseId: z.string().nullable(),
  quote: z.string().nullable()
});

export const modelAnalysisResponseSchema = z.object({
  overview: z.string(),
  matchFindings: z.array(modelMatchFindingSchema),
  protectionFindings: z.array(modelProtectionFindingSchema)
});

export const modelAskResponseSchema = z.object({
  status: z.enum(['answered', 'not_in_document', 'needs_professional']),
  answer: z.string(),
  citations: z.array(z.object({ clauseId: z.string(), quote: z.string() })),
  missingInfo: z.array(z.string()),
  suggestedQuestions: z.array(z.string())
});

export const modelNegotiationResponseSchema = z.object({
  message: z.string(),
  items: z.array(z.object({
    rowId: z.string(),
    ask: z.string(),
    reason: z.string(),
    suggestedWording: z.string()
  }))
});

export const interviewAnswersSchema: z.ZodType<InterviewAnswers> = z.object({
  city: z.string().nullable(),
  monthlyRent: z.string().nullable(),
  deposit: z.string().nullable(),
  duration: z.string().nullable(),
  lockIn: z.string().nullable(),
  noticePeriod: z.string().nullable(),
  maintenance: z.string().nullable(),
  repairs: z.string().nullable(),
  increase: z.string().nullable(),
  extras: z.array(z.string())
});

export const protectionIdSchema: z.ZodType<ProtectionId> = z.enum([
  'DEPOSIT_AMOUNT',
  'DEPOSIT_REFUND_TIMELINE',
  'DEPOSIT_DEDUCTION_BASIS',
  'RENT_AMOUNT',
  'RENT_DUE_DATE',
  'RENT_INCREASE',
  'MAINTENANCE_CHARGES',
  'REPAIRS_MAJOR',
  'REPAIRS_MINOR',
  'NOTICE_TENANT',
  'NOTICE_LANDLORD',
  'LOCK_IN',
  'ENTRY_NOTICE',
  'ESSENTIAL_SERVICES',
  'SUBLET_GUESTS',
  'RENEWAL',
  'SALE_OF_PROPERTY',
  'REGISTRATION_STAMPING',
  'INVENTORY_HANDOVER',
  'DISPUTE_RESOLUTION'
]);

export const clauseSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  heading: z.string().nullable(),
  text: z.string(),
  page: z.number().nullable(),
  pageEnd: z.number().nullable(),
  order: z.number()
});

export const verifiedQuoteSchema = z.object({
  clauseId: z.string(),
  quote: z.string(),
  status: z.enum(['verified', 'fuzzy', 'unverified']),
  start: z.number().optional(),
  end: z.number().optional()
});

export const urlParamsSchema = z.object({
  demo: z.enum(['1', 'true']).optional(),
  lang: z.enum(['en', 'hi']).optional()
});

export const fileInputSchema = z.object({
  name: z.string(),
  type: z.string(),
  size: z.number()
});

export function validateModelAnalysis(data: unknown): ModelAnalysisResponse {
  return modelAnalysisResponseSchema.parse(data);
}

export function validateModelAsk(data: unknown): ModelAskResponse {
  return modelAskResponseSchema.parse(data);
}

export function validateModelNegotiation(data: unknown): ModelNegotiationResponse {
  return modelNegotiationResponseSchema.parse(data);
}

export function validateInterviewAnswers(data: unknown): InterviewAnswers {
  return interviewAnswersSchema.parse(data);
}

export function validateClauses(data: unknown): import('./types.js').Clause[] {
  return z.array(clauseSchema).parse(data);
}

export function validateUrlParams(data: unknown) {
  return urlParamsSchema.parse(data);
}

export function validateFileInput(data: unknown): { name: string; type: string; size: number } {
  return fileInputSchema.parse(data);
}