/** JSON response schemas for Gemini structured output — matching AI_PIPELINE.md */

export const ANALYSIS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    overview: { type: 'STRING' },
    matchFindings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          key: { type: 'STRING' },
          found: { type: 'BOOLEAN' },
          writtenValue: { type: 'STRING', nullable: true },
          clauseId: { type: 'STRING', nullable: true },
          quote: { type: 'STRING', nullable: true },
          ambiguity: { type: 'STRING', nullable: true },
        },
        required: ['key', 'found'],
      },
    },
    protectionFindings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          state: { type: 'STRING', enum: ['present', 'absent', 'unclear'] },
          summary: { type: 'STRING', nullable: true },
          clauseId: { type: 'STRING', nullable: true },
          quote: { type: 'STRING', nullable: true },
        },
        required: ['id', 'state'],
      },
    },
  },
  required: ['overview', 'matchFindings', 'protectionFindings'],
};

export const ASK_SCHEMA = {
  type: 'OBJECT',
  properties: {
    status: { type: 'STRING', enum: ['answered', 'not_in_document', 'needs_professional'] },
    answer: { type: 'STRING' },
    citations: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          clauseId: { type: 'STRING' },
          quote: { type: 'STRING' },
        },
        required: ['clauseId', 'quote'],
      },
    },
    missingInfo: { type: 'ARRAY', items: { type: 'STRING' } },
    suggestedQuestions: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['status', 'answer', 'citations', 'missingInfo', 'suggestedQuestions'],
};

export const NEGOTIATION_SCHEMA = {
  type: 'OBJECT',
  properties: {
    message: { type: 'STRING' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          rowId: { type: 'STRING' },
          ask: { type: 'STRING' },
          reason: { type: 'STRING' },
          suggestedWording: { type: 'STRING' },
        },
        required: ['rowId', 'ask', 'reason', 'suggestedWording'],
      },
    },
  },
  required: ['message', 'items'],
};

export const DEFAULT_MODEL = 'gemini-2.5-flash';
