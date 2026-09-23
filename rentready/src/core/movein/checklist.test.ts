import { describe, it, expect } from 'vitest';
import { ROOMS, METER_TYPES, PHOTO_GUIDE, CHECKLIST_TEMPLATE, buildMoveInKit, exportMoveInKitAsMarkdown } from './checklist';
import type { NormalisedAnswers, MatchRow, InterviewAnswers } from '../types';

const INTERVIEW: NormalisedAnswers = {
  city: 'Pune',
  monthlyRent: 40000,
  deposit: { amount: 80000, months: 2 },
  duration: 330,
  lockIn: null,
  noticePeriod: null,
  maintenance: null,
  repairs: null,
  increase: null,
  extras: []
};

const match = (key: string, written: string): MatchRow => ({
  key: key as keyof InterviewAnswers,
  agreed: '',
  verdict: 'matches',
  severity: 'INFO',
  note: '',
  written,
  evidence: null,
  suggestedQuestion: null
});

describe('constants', () => {
  it('exposes rooms, meter types and photo tips', () => {
    expect(ROOMS).toContain('Bedroom 1');
    expect(METER_TYPES.map(m => m.id)).toEqual(['electricity', 'water', 'gas']);
    expect(PHOTO_GUIDE.length).toBeGreaterThan(5);
    expect(CHECKLIST_TEMPLATE.length).toBeGreaterThan(20);
  });
});

describe('buildMoveInKit', () => {
  it('builds a complete checklist with stable ids and every room', () => {
    const kit = buildMoveInKit(INTERVIEW, []);
    const rooms = new Set(kit.checklist.map(i => i.room));
    for (const room of ['Living Room', 'Bedroom 1', 'Bedroom 2', 'Kitchen', 'Bathroom 1', 'Bathroom 2', 'Balcony', 'Common Areas']) {
      expect(rooms.has(room)).toBe(true);
    }
    expect(kit.checklist).toHaveLength(48);
    expect(new Set(kit.checklist.map(i => i.id)).size).toBe(48);
    expect(kit.checklist.every(i => i.completed === false)).toBe(true);
  });

  it('starts with empty meter readings and 5 timeline events', () => {
    const kit = buildMoveInKit(INTERVIEW, []);
    expect(kit.meterReadings).toEqual({ electricity: '', water: '', gas: '' });
    expect(kit.timeline).toHaveLength(5);
    expect(kit.timeline[0]!.description).toContain('inspection checklist');
  });

  it('uses the written notice period when present', () => {
    const kit = buildMoveInKit(INTERVIEW, [match('noticePeriod', '2 months')]);
    expect(kit.timeline[1]!.description).toContain('60-day notice');
  });

  it('falls back to the interview notice period', () => {
    const kit = buildMoveInKit({ ...INTERVIEW, noticePeriod: 15 }, []);
    expect(kit.timeline[1]!.description).toContain('15-day notice');
  });

  it('defaults notice to 30 days and duration to 330 days when unknown', () => {
    const kit = buildMoveInKit(
      { city: null, monthlyRent: null, deposit: null, duration: null, lockIn: null, noticePeriod: null, maintenance: null, repairs: null, increase: null, extras: [] },
      [match('noticePeriod', 'unparseable')]
    );
    expect(kit.timeline[1]!.description).toContain('30-day notice');
  });
});

describe('exportMoveInKitAsMarkdown', () => {
  it('renders interview facts, checklist, meters, timeline and photo guide', () => {
    const kit = buildMoveInKit(INTERVIEW, []);
    const md = exportMoveInKitAsMarkdown(kit, INTERVIEW);

    expect(md).toContain('# Move-In Kit');
    expect(md).toContain('**Property:** Pune');
    expect(md).toContain('**Monthly Rent:** ₹40,000');
    expect(md).toContain('**Deposit:** ₹80,000');
    expect(md).toContain('## Inspection Checklist');
    expect(md).toContain('### Bedroom 1');
    expect(md).toContain('## Meter Readings');
    expect(md).toContain('**Electricity Meter:** Not recorded kWh');
    expect(md).toContain('## Timeline');
    expect(md).toContain('Move-in / Handover');
    expect(md).toContain('## Photo Guide');
    expect(md).toContain('Information, not legal advice.');
  });

  it('says Not specified for missing facts', () => {
    const empty: NormalisedAnswers = {
      city: null,
      monthlyRent: null,
      deposit: null,
      duration: null,
      lockIn: null,
      noticePeriod: null,
      maintenance: null,
      repairs: null,
      increase: null,
      extras: []
    };
    const kit = buildMoveInKit(empty, []);
    const md = exportMoveInKitAsMarkdown(kit, empty);
    expect(md).toContain('**Property:** Not specified');
    expect(md).toContain('**Monthly Rent:** Not specified');
    expect(md).toContain('**Deposit:** Not specified');
  });
});