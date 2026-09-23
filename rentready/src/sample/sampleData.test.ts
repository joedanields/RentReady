import { describe, expect, it } from 'vitest';
import { segmentClauses } from '../core/parsing/segmenter';
import { verifyQuote } from '../core/verify/verifyQuote';
import { PROTECTION_IDS } from '../core/rules/protections';
import { SAMPLE_ANALYSIS_RESPONSE, SAMPLE_ASK_RESPONSES, SAMPLE_PAGES } from './sampleData';

/**
 * Demo mode must be as honest as live mode (AI_PIPELINE §7): recorded responses go through the
 * same verification, so every recorded quote has to verify exactly against the clause it names.
 * If segmentation or the sample text changes, this test says which fixture to update.
 */
const clauses = segmentClauses(SAMPLE_PAGES.join('\n'), SAMPLE_PAGES);
const byId = new Map(clauses.map(c => [c.id, c.text]));

function expectVerified(clauseId: string | null, quote: string | null, where: string) {
  expect(clauseId, where).not.toBeNull();
  expect(quote, where).not.toBeNull();
  const text = byId.get(clauseId!);
  expect(text, `${where}: unknown clause ${clauseId}`).toBeDefined();
  expect(verifyQuote(text!, quote!, clauseId!).status, `${where}: "${quote}"`).toBe('verified');
}

describe('sample agreement fixtures', () => {
  it('verifies every analysis quote against the clause it cites', () => {
    for (const f of SAMPLE_ANALYSIS_RESPONSE.matchFindings) {
      if (f.found) expectVerified(f.clauseId, f.quote, `match ${f.key}`);
    }
    for (const p of SAMPLE_ANALYSIS_RESPONSE.protectionFindings) {
      if (p.clauseId !== null) expectVerified(p.clauseId, p.quote, `protection ${p.id}`);
    }
  });

  it('covers every protection exactly once', () => {
    const ids = SAMPLE_ANALYSIS_RESPONSE.protectionFindings.map(p => p.id);
    expect([...ids].sort()).toEqual([...PROTECTION_IDS].sort());
  });

  it('verifies every recorded Ask citation', () => {
    for (const { question, response } of SAMPLE_ASK_RESPONSES) {
      const citations = (response as { citations: Array<{ clauseId: string; quote: string }> })
        .citations;
      for (const c of citations) expectVerified(c.clauseId, c.quote, `ask "${question}"`);
    }
  });

  it('keeps the deliberate problems the demo is built to show (KICKOFF brief)', () => {
    const all = clauses
      .map(c => c.text)
      .join('\n')
      .toLowerCase();
    expect(all).toContain("three months' rent"); // 3-month deposit
    expect(all).toContain('six (6) months'); // 6-month lock-in
    expect(all).toContain('responsible for all repairs'); // all repairs on tenant
    expect(all).toContain('after 10:00 p.m.'); // guest restriction
    expect(all).not.toMatch(/refund(ed|able)? within/); // no refund timeline
    expect(all).not.toMatch(/notice before (any )?(entry|visit|inspection)/); // no entry notice
  });
});
