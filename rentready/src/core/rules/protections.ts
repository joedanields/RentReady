/** Protection checklist — fixed list of 20 protections a fair agreement covers */

import type { ProtectionId, GapRow, VerifiedQuote } from '../types.js';

export interface ProtectionDef {
  id: ProtectionId;
  title: string;
  whyItMatters: string;
  requestWording: string | null;
}

export const PROTECTIONS: ProtectionDef[] = [
  {
    id: 'DEPOSIT_AMOUNT',
    title: 'Deposit amount stated in rupees',
    whyItMatters: 'Prevents "two months" arguments later',
    requestWording: 'The Security Deposit is ₹____ (____ months of rent).',
  },
  {
    id: 'DEPOSIT_REFUND_TIMELINE',
    title: 'When the deposit comes back',
    whyItMatters: 'The top dispute cause',
    requestWording:
      'The deposit shall be refunded within 15 days of handing over vacant possession.',
  },
  {
    id: 'DEPOSIT_DEDUCTION_BASIS',
    title: 'What can be deducted',
    whyItMatters: 'Stops open-ended deductions',
    requestWording:
      'Deductions limited to unpaid rent, unpaid utility bills and damage beyond normal wear and tear, supported by bills.',
  },
  {
    id: 'RENT_AMOUNT',
    title: 'Monthly rent',
    whyItMatters: '—',
    requestWording: null,
  },
  {
    id: 'RENT_DUE_DATE',
    title: 'Due date and late fee',
    whyItMatters: 'Avoids surprise penalties',
    requestWording:
      'Rent is payable by the ____ of each month; late fee, if any, shall not exceed ____.',
  },
  {
    id: 'RENT_INCREASE',
    title: 'Increase on renewal',
    whyItMatters: 'Predictable costs',
    requestWording: 'Rent may be increased by not more than ____% on renewal.',
  },
  {
    id: 'MAINTENANCE_CHARGES',
    title: 'Who pays maintenance, water, power, property tax',
    whyItMatters: 'Hidden monthly costs',
    requestWording:
      'Society maintenance and property tax: Owner. Electricity and water usage: Tenant.',
  },
  {
    id: 'REPAIRS_MAJOR',
    title: 'Who handles major repairs',
    whyItMatters: 'Expensive if unclear',
    requestWording: "Structural and major repairs are the Owner's responsibility.",
  },
  {
    id: 'REPAIRS_MINOR',
    title: 'Who handles small repairs',
    whyItMatters: 'Daily friction',
    requestWording: "Minor repairs up to ₹____ per instance are the Tenant's responsibility.",
  },
  {
    id: 'NOTICE_TENANT',
    title: 'Notice you must give',
    whyItMatters: 'Planning your move',
    requestWording: null,
  },
  {
    id: 'NOTICE_LANDLORD',
    title: 'Notice the owner must give',
    whyItMatters: 'Protects you from sudden exit',
    requestWording: "The Owner shall give not less than ____ days' written notice.",
  },
  {
    id: 'LOCK_IN',
    title: 'Minimum stay and its cost',
    whyItMatters: 'Traps you or your deposit',
    requestWording: 'Lock-in period: ____ months, applicable to both parties.',
  },
  {
    id: 'ENTRY_NOTICE',
    title: 'Notice before the owner visits',
    whyItMatters: 'Privacy',
    requestWording:
      "The Owner shall give at least 24 hours' written notice before entry, except in an emergency.",
  },
  {
    id: 'ESSENTIAL_SERVICES',
    title: 'Water and power cannot be cut',
    whyItMatters: 'Safety',
    requestWording: 'Essential supplies shall not be withheld under any circumstances.',
  },
  {
    id: 'SUBLET_GUESTS',
    title: 'Flatmates and guests',
    whyItMatters: 'Affects who can live with you',
    requestWording: 'The Tenant may share the premises with ____ (named flatmates).',
  },
  {
    id: 'RENEWAL',
    title: 'How renewal works',
    whyItMatters: 'Avoids a scramble at month 11',
    requestWording: 'Either party shall confirm renewal at least 30 days before expiry.',
  },
  {
    id: 'SALE_OF_PROPERTY',
    title: 'If the property is sold',
    whyItMatters: "Your tenancy's survival",
    requestWording: 'This agreement shall continue to bind any new owner for the remaining term.',
  },
  {
    id: 'REGISTRATION_STAMPING',
    title: 'Registration, stamp duty, who pays',
    whyItMatters: 'Enforceability and cost',
    requestWording:
      'The agreement shall be registered; stamp duty and registration charges shall be borne ____.',
  },
  {
    id: 'INVENTORY_HANDOVER',
    title: 'List of furniture and fittings, condition at handover',
    whyItMatters: 'Deposit protection',
    requestWording:
      'An inventory with photographs, signed by both parties, is annexed as Schedule ____.',
  },
  {
    id: 'DISPUTE_RESOLUTION',
    title: 'Where disputes are decided',
    whyItMatters: 'Cost of a fight',
    requestWording: null,
  },
];

export const PROTECTION_IDS = PROTECTIONS.map(p => p.id) as ProtectionId[];

/** Build gap rows from model protection findings */
export function buildGapRows(
  modelFindings: Array<{
    id: string;
    state: 'present' | 'absent' | 'unclear';
    summary: string | null;
    clauseId: string | null;
    quote: string | null;
  }>,
  verifiedQuotes: Map<string, VerifiedQuote | null>
): GapRow[] {
  return PROTECTIONS.map(protection => {
    const finding = modelFindings.find(f => f.id === protection.id);
    const evidence = finding?.clauseId ? (verifiedQuotes.get(finding.clauseId) ?? null) : null;

    return {
      id: protection.id,
      title: protection.title,
      state: finding?.state ?? 'unclear',
      evidence,
      whyItMatters: protection.whyItMatters,
      requestWording: protection.requestWording,
    };
  });
}
