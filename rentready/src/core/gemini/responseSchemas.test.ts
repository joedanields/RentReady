import { describe, it, expect } from 'vitest';
import { ANALYSIS_SCHEMA, ASK_SCHEMA, NEGOTIATION_SCHEMA, DEFAULT_MODEL } from './responseSchemas';

describe('responseSchemas', () => {
  it('analysis schema requires the three top-level keys', () => {
    expect(ANALYSIS_SCHEMA).toMatchObject({ type: 'OBJECT' });
    expect(ANALYSIS_SCHEMA.required).toEqual(['overview', 'matchFindings', 'protectionFindings']);
  });

  it('match findings carry nullable quote fields and a found flag', () => {
    const match = ANALYSIS_SCHEMA.properties.matchFindings.items;
    expect(match.required).toEqual(['key', 'found']);
    expect(match.properties.found.type).toBe('BOOLEAN');
    expect(match.properties.quote.nullable).toBe(true);
  });

  it('protection findings restrict state to the three values', () => {
    const protection = ANALYSIS_SCHEMA.properties.protectionFindings.items;
    expect(protection.properties.state.enum).toEqual(['present', 'absent', 'unclear']);
  });

  it('ask schema constrains status values', () => {
    expect(ASK_SCHEMA.properties.status.enum).toEqual(['answered', 'not_in_document', 'needs_professional']);
    expect(ASK_SCHEMA.required).toContain('citations');
  });

  it('negotiation schema requires message and items', () => {
    expect(NEGOTIATION_SCHEMA.required).toEqual(['message', 'items']);
    expect(NEGOTIATION_SCHEMA.properties.items.items.required).toEqual(['rowId', 'ask', 'reason', 'suggestedWording']);
  });

  it('defaults to the flash model', () => {
    expect(DEFAULT_MODEL).toBe('gemini-2.5-flash');
  });
});