import { describe, it, expect } from 'vitest';
import { compareAnswer, buildMatchRows, worseAmount } from './compare';
import { normaliseAnswers } from './normalise';
import type { InterviewAnswers, VerifiedQuote } from '../types';

const NORMALISED = normaliseAnswers({
  city: 'Pune',
  monthlyRent: '40000',
  deposit: '80000',
  duration: '11 months',
  lockIn: '6 months',
  noticePeriod: '1 month',
  maintenance: 'owner',
  repairs: 'split',
  increase: '5%',
  extras: ['Parking included', 'Pets allowed'],
});

const RAW_WITH_RENT = {
  city: 'Pune',
  monthlyRent: '40000',
  deposit: '80000',
  duration: '11 months',
  lockIn: '6 months',
  noticePeriod: '1 month',
  maintenance: 'owner',
  repairs: 'split',
  increase: '5%',
  extras: ['Parking included', 'Pets allowed'],
};

const noEvidence = (): VerifiedQuote | null => null;
const verified = (clauseId: string): VerifiedQuote => ({
  clauseId,
  quote: 'exact quote from the agreement text that is long enough',
  status: 'verified',
});
const unverified = (clauseId: string): VerifiedQuote => ({
  clauseId,
  quote: 'some quote that would not verify anywhere',
  status: 'unverified',
});

describe('compareAnswer — skipped answers', () => {
  it('excludes rows where the user gave no answer', () => {
    const row = compareAnswer('monthlyRent', '', '₹40,000', true, noEvidence(), NORMALISED);
    expect(row.verdict).toBe('not_covered');
    expect(row.agreed).toBe('');
  });
});

describe('compareAnswer — model found nothing', () => {
  it('returns not_covered with a suggested question', () => {
    const row = compareAnswer('monthlyRent', '40000', null, false, noEvidence(), NORMALISED);
    expect(row.verdict).toBe('not_covered');
    expect(row.written).toBeNull();
    expect(row.suggestedQuestion).not.toBeNull();
  });
});

describe('compareAnswer — unverified evidence demotes to unclear', () => {
  it('never reports differs without a verified quote', () => {
    const row = compareAnswer(
      'monthlyRent',
      '40000',
      '₹40,000',
      true,
      unverified('c001'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
    expect(row.evidence?.status).toBe('unverified');
    expect(row.suggestedQuestion).not.toBeNull();
  });
});

describe('compareAnswer — monthlyRent', () => {
  it('equal rent matches', () => {
    const row = compareAnswer(
      'monthlyRent',
      '40000',
      '₹40,000',
      true,
      verified('c001'),
      NORMALISED
    );
    expect(row.verdict).toBe('matches');
    expect(row.severity).toBe('INFO');
  });

  it('higher written rent is differs HIGH', () => {
    const row = compareAnswer(
      'monthlyRent',
      '40000',
      '₹1,20,000',
      true,
      verified('c001'),
      NORMALISED
    );
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
    expect(row.suggestedQuestion).not.toBeNull();
  });

  it('lower written rent is differs INFO (better)', () => {
    const row = compareAnswer(
      'monthlyRent',
      '40000',
      '₹38,000',
      true,
      verified('c001'),
      NORMALISED
    );
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('INFO');
  });

  it('unparseable values are unclear', () => {
    const row = compareAnswer('monthlyRent', 'asdf', 'junk', true, verified('c001'), NORMALISED);
    expect(row.verdict).toBe('unclear');
  });

  it('parses k/lakh suffixes on both sides', () => {
    const k = compareAnswer('monthlyRent', '40k', '40k', true, verified('c001'), NORMALISED);
    expect(k.verdict).toBe('matches');
    const lakh = compareAnswer(
      'deposit',
      '2 lakh',
      '₹2,00,000',
      true,
      verified('c001'),
      normaliseAnswers({ ...RAW_WITH_RENT, monthlyRent: null })
    );
    expect(lakh.verdict).toBe('matches');
  });
});

describe('compareAnswer — deposit', () => {
  it('is unclear, never "matches", when the written deposit has no amount or months', () => {
    const row = compareAnswer(
      'deposit',
      '80000',
      'a deposit as mutually agreed',
      true,
      verified('c001'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
  });

  it('matches when months agree even if raw amounts differ in phrasing', () => {
    const row = compareAnswer('deposit', '2 months', '₹80,000', true, verified('c001'), NORMALISED);
    expect(row.verdict).toBe('matches');
  });

  it('flag differs HIGH when written deposit is more (months conversion)', () => {
    const row = compareAnswer('deposit', '80000', '₹1,20,000', true, verified('c001'), NORMALISED);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
    expect(row.note).toContain('months');
  });

  it('flag differs INFO when written is less', () => {
    const norm = normaliseAnswers({ ...RAW_WITH_RENT, deposit: '3 months' });
    const row = compareAnswer('deposit', '3 months', '₹80,000', true, verified('c001'), norm);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('INFO');
  });

  it('compares amounts when months are not derivable', () => {
    const noRent = normaliseAnswers({ ...RAW_WITH_RENT, monthlyRent: null });
    const row = compareAnswer('deposit', '80000', '1,20,000', true, verified('c001'), noRent);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });

  it('matches when amounts equal and no months derivable', () => {
    const noRent = normaliseAnswers({ ...RAW_WITH_RENT, monthlyRent: null });
    const row = compareAnswer('deposit', '80000', '80,000', true, verified('c001'), noRent);
    expect(row.verdict).toBe('matches');
  });

  it('compares amounts in plain digits when months are not derivable', () => {
    const noRent = normaliseAnswers({ ...RAW_WITH_RENT, monthlyRent: null });
    const row = compareAnswer('deposit', '80000', '120000', true, verified('c001'), noRent);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
    expect(row.note).toContain('You said ₹80,000');
    expect(row.note).toContain('The agreement says ₹1,20,000');
  });

  it('compares in months when both sides say "N months" in the document', () => {
    const row = compareAnswer(
      'deposit',
      '2 months',
      '120000 (2 months)',
      true,
      verified('c001'),
      NORMALISED
    );
    expect(row.verdict).toBe('matches');
  });

  it('shows the wording as written when the document amount is unclear', () => {
    const row = compareAnswer(
      'deposit',
      '80000',
      '₹80k (refundable)',
      true,
      verified('c001'),
      NORMALISED
    );
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('INFO');
    expect(row.note).toContain('₹80k (refundable)');
  });
});

describe('worseAmount', () => {
  it('reports larger written amounts', () => {
    expect(worseAmount(80000, 120000)).toBe(true);
    expect(worseAmount(80000, 50000)).toBe(false);
  });

  it('treats a missing amount as zero', () => {
    expect(worseAmount(null, 120000)).toBe(true);
    expect(worseAmount(80000, null)).toBe(false);
    expect(worseAmount(null, null)).toBe(false);
  });
});

describe('compareAnswer — duration', () => {
  it('matches within 15 days', () => {
    const row = compareAnswer(
      'duration',
      '11 months',
      '11 months',
      true,
      verified('c002'),
      NORMALISED
    );
    expect(row.verdict).toBe('matches');
  });

  it('differs MEDIUM when materially different', () => {
    const row = compareAnswer(
      'duration',
      '11 months',
      '2 years',
      true,
      verified('c002'),
      NORMALISED
    );
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('MEDIUM');
  });

  it('unclear when values cannot be parsed', () => {
    const row = compareAnswer(
      'duration',
      'forever',
      'indefinite',
      true,
      verified('c002'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
  });

  it('parses exact years, general months, decimal years and days', () => {
    const year = compareAnswer(
      'duration',
      '12 months',
      '12 months',
      true,
      verified('c002'),
      NORMALISED
    );
    expect(year.verdict).toBe('matches');

    const months = compareAnswer(
      'duration',
      '6 months',
      '6 months',
      true,
      verified('c002'),
      NORMALISED
    );
    expect(months.verdict).toBe('matches');

    const yAndHalf = compareAnswer(
      'duration',
      '1.5 years',
      '15 months',
      true,
      verified('c002'),
      NORMALISED
    );
    expect(yAndHalf.verdict).toBe('differs');
    expect(yAndHalf.severity).toBe('MEDIUM');

    const days = compareAnswer(
      'duration',
      '45 days',
      '45 days',
      true,
      verified('c002'),
      NORMALISED
    );
    expect(days.verdict).toBe('matches');
  });
});

describe('compareAnswer — lockIn', () => {
  it('matches when both say no lock-in', () => {
    const row = compareAnswer(
      'lockIn',
      'no',
      'no lock-in period',
      true,
      verified('c003'),
      NORMALISED
    );
    expect(row.verdict).toBe('matches');
  });

  it('differs HIGH when agreement has a lock-in but user was told none', () => {
    const row = compareAnswer('lockIn', 'no', '6 months', true, verified('c003'), NORMALISED);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });

  it('matches when lock-ins are close', () => {
    const row = compareAnswer('lockIn', '6 months', '6 months', true, verified('c003'), NORMALISED);
    expect(row.verdict).toBe('matches');
  });

  it('differs HIGH when agreement lock-in is longer', () => {
    const row = compareAnswer('lockIn', '3 months', '6 months', true, verified('c003'), NORMALISED);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });

  it('unclear when only one side parses', () => {
    const row = compareAnswer(
      'lockIn',
      '6 months',
      'indefinite',
      true,
      verified('c003'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
  });

  it('treats a double not_sure lock-in as no lock-in', () => {
    const row = compareAnswer('lockIn', 'not_sure', 'not_sure', true, verified('c003'), NORMALISED);
    expect(row.verdict).toBe('matches');
  });
});

describe('compareAnswer — noticePeriod', () => {
  it('matches when equal or better', () => {
    const equal = compareAnswer(
      'noticePeriod',
      '1 month',
      '1 month',
      true,
      verified('c004'),
      NORMALISED
    );
    expect(equal.verdict).toBe('matches');
    const better = compareAnswer(
      'noticePeriod',
      '1 month',
      '15 days',
      true,
      verified('c004'),
      NORMALISED
    );
    expect(better.verdict).toBe('matches');
  });

  it('differs HIGH when worse', () => {
    const row = compareAnswer(
      'noticePeriod',
      '1 month',
      '2 months',
      true,
      verified('c004'),
      NORMALISED
    );
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });

  it('unclear when unparseable', () => {
    const row = compareAnswer(
      'noticePeriod',
      'whenever',
      '2 months',
      true,
      verified('c004'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
  });

  it('treats a shorter written notice as better', () => {
    const week = compareAnswer(
      'noticePeriod',
      '1 month',
      '7 days',
      true,
      verified('c004'),
      NORMALISED
    );
    expect(week.verdict).toBe('matches');

    const day = compareAnswer(
      'noticePeriod',
      '1 month',
      '1 day',
      true,
      verified('c004'),
      NORMALISED
    );
    expect(day.verdict).toBe('matches');
  });

  it('unclear when the user answer is not_sure', () => {
    const row = compareAnswer(
      'noticePeriod',
      'not_sure',
      '1 month',
      true,
      verified('c004'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
  });

  it('compares general multi-month notices', () => {
    const row = compareAnswer(
      'noticePeriod',
      '1 month',
      '3 months',
      true,
      verified('c004'),
      NORMALISED
    );
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });
});

describe('compareAnswer — maintenance / repairs', () => {
  it('matches when parties agree', () => {
    const m = compareAnswer('maintenance', 'owner', 'owner', true, verified('c005'), NORMALISED);
    expect(m.verdict).toBe('matches');
    const r = compareAnswer('repairs', 'split', 'split', true, verified('c006'), NORMALISED);
    expect(r.verdict).toBe('matches');
  });

  it('differs HIGH when tenant bears what owner promised to bear', () => {
    const row = compareAnswer('maintenance', 'owner', 'me', true, verified('c005'), NORMALISED);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });

  it('differs HIGH when the split responsibility shifts to the tenant', () => {
    const row = compareAnswer('repairs', 'split', 'me', true, verified('c006'), NORMALISED);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });

  it('differs MEDIUM for other mismatches', () => {
    const row = compareAnswer('maintenance', 'owner', 'split', true, verified('c006'), NORMALISED);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('MEDIUM');
  });

  it('unclear when either side unparseable', () => {
    const row = compareAnswer(
      'maintenance',
      'owner',
      'someone else',
      true,
      verified('c005'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
  });

  it('renders not_discussed parties in the note', () => {
    const row = compareAnswer(
      'maintenance',
      'not_discussed',
      'me',
      true,
      verified('c005'),
      NORMALISED
    );
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('MEDIUM');
    expect(row.note).toContain('not specified');
  });
});

describe('compareAnswer — increase', () => {
  it('matches when neither mentions an increase', () => {
    const row = compareAnswer(
      'increase',
      'no',
      'no escalation clause',
      true,
      verified('c007'),
      NORMALISED
    );
    expect(row.verdict).toBe('matches');
  });

  it('differs HIGH when agreement adds an increase unagreed', () => {
    const row = compareAnswer('increase', 'no', '10%', true, verified('c007'), NORMALISED);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });

  it('matches with same or better percentage', () => {
    const same = compareAnswer('increase', '5%', '5%', true, verified('c007'), NORMALISED);
    expect(same.verdict).toBe('matches');
    const better = compareAnswer('increase', '10%', '5%', true, verified('c007'), NORMALISED);
    expect(better.verdict).toBe('matches');
  });

  it('differs HIGH when written is higher', () => {
    const row = compareAnswer('increase', '5%', '12%', true, verified('c007'), NORMALISED);
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('HIGH');
  });

  it('unclear when one side unparseable', () => {
    const row = compareAnswer('increase', '5%', 'unknown', true, verified('c007'), NORMALISED);
    expect(row.verdict).toBe('unclear');
  });
});

describe('compareAnswer — extras', () => {
  it('matches when all agreed extras appear in the agreement', () => {
    const row = compareAnswer(
      'extras',
      'Parking included, Pets allowed',
      'Tenant may park one vehicle. Parking included. Small pets allowed with consent.',
      true,
      verified('c008'),
      NORMALISED
    );
    expect(row.verdict).toBe('matches');
  });

  it('differs MEDIUM listing the missing extras', () => {
    const row = compareAnswer(
      'extras',
      'Parking included, Pets allowed',
      'Tenant may park one vehicle.',
      true,
      verified('c008'),
      NORMALISED
    );
    expect(row.verdict).toBe('differs');
    expect(row.severity).toBe('MEDIUM');
    expect(row.note).toContain('pets allowed');
  });
});

describe('compareAnswer — city and fallback', () => {
  it('city is always a contextual match', () => {
    const row = compareAnswer('city', 'Pune', 'Mumbai', true, noEvidence(), NORMALISED);
    expect(row.verdict).toBe('matches');
  });
});

describe('buildMatchRows', () => {
  it('builds rows only for answered keys, matching findings by key', () => {
    const answers: InterviewAnswers = {
      city: 'Pune',
      monthlyRent: '40000',
      deposit: null,
      duration: null,
      lockIn: 'no',
      noticePeriod: '1 month',
      maintenance: null,
      repairs: null,
      increase: null,
      extras: [],
    };
    const verifiedMap = new Map<string, VerifiedQuote>([['c001', verified('c001')]]);
    const rows = buildMatchRows(
      answers,
      [
        {
          key: 'monthlyRent',
          found: true,
          writtenValue: '₹40,000',
          clauseId: 'c001',
          quote: 'x',
          ambiguity: null,
        },
        {
          key: 'lockIn',
          found: false,
          writtenValue: null,
          clauseId: null,
          quote: null,
          ambiguity: null,
        },
        {
          key: 'noticePeriod',
          found: true,
          writtenValue: '1 month',
          clauseId: 'c002',
          quote: 'y',
          ambiguity: null,
        },
      ],
      verifiedMap
    );
    // City is context for the "rules vary by state" line, never a promise to check.
    expect(rows.map(r => r.key)).toEqual(['monthlyRent', 'lockIn', 'noticePeriod']);
    expect(rows.find(r => r.key === 'monthlyRent')?.verdict).toBe('matches');
    expect(rows.find(r => r.key === 'lockIn')?.verdict).toBe('not_covered');
  });

  it('treats "Not sure" and "Not discussed" answers as skipped, never as a promise', () => {
    const answers: InterviewAnswers = {
      city: null,
      monthlyRent: null,
      deposit: null,
      duration: null,
      lockIn: 'not_sure',
      noticePeriod: 'not_sure',
      maintenance: 'not_discussed',
      repairs: 'NOT_DISCUSSED',
      increase: ' not_sure ',
      extras: [],
    };
    expect(buildMatchRows(answers, [], new Map())).toEqual([]);
  });

  it('serialises multi-value extras into the agreed string', () => {
    const answers: InterviewAnswers = {
      city: null,
      monthlyRent: null,
      deposit: null,
      duration: null,
      lockIn: null,
      noticePeriod: null,
      maintenance: null,
      repairs: null,
      increase: null,
      extras: ['Parking included', 'Pets allowed'],
    };
    const rows = buildMatchRows(answers, [], new Map());
    const extras = rows.find(r => r.key === 'extras')!;
    expect(extras.agreed).toBe('Parking included, Pets allowed');
    expect(extras.verdict).toBe('not_covered');
  });
});

describe('compareAnswer — edge branches', () => {
  it('reports unclear when repairs on either side cannot be parsed', () => {
    const row = compareAnswer(
      'repairs',
      'whoever fixes it',
      'Tenant pays',
      true,
      verified('c006'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
  });

  it('falls back to unclear for an unrecognised key', () => {
    const row = compareAnswer(
      'saleTerms' as keyof InterviewAnswers,
      'any',
      'any',
      true,
      verified('c001'),
      NORMALISED
    );
    expect(row.verdict).toBe('unclear');
    expect(row.severity).toBe('INFO');
  });
});
