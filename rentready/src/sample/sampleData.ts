/** Demo mode sample — synthetic agreement with deliberate problems (separated into clause text with page info) */

export const SAMPLE_AGREEMENT_TITLE = 'Leave and Licence Agreement (Sample)';

/** Source text: each block is a "page". Synthetic, no real parties, for demo/eval only. */
export const SAMPLE_PAGES: string[] = [
  `LEAVE AND LICENCE AGREEMENT
THIS LEAVE AND LICENCE AGREEMENT is made and entered into at Sample City on this 1st day of January 2025 by and between Mr. Owner Sample (hereinafter referred to as LICENSOR) of the one part and Ms. Tenant Sample (hereinafter referred to as LICENSEE) of the other part.
1. PREMISES
The Licensor agrees to give and the Licensee agrees to take on licence the residential premises being Flat No. 301, Sunshine Residency, Sample City, more particularly described in the Schedule hereto.
2. TERM
The licence hereby granted shall be for a period of eleven (11) months commencing from the date of handing over possession of the said premises.
3. LOCK-IN
The Licensee shall not vacate the premises before the expiry of six (6) months from the commencement of this agreement. In the event the Licensee vacates the premises within the lock-in period, the Licensor shall forfeit the entire security deposit and the Licensee shall be liable to pay the rent for the remaining months of the lock-in period.
4. RENT
The Licensee shall pay monthly rent of Rs. 40,000/- (Rupees Forty Thousand only) payable in advance on or before the seventh day of each English calendar month.`,
  `5. SECURITY DEPOSIT
The Licensee shall pay a security deposit of Rs. 1,20,000/- (Rupees One Lakh Twenty Thousand only) equivalent to three months' rent at the time of execution of this agreement. The said deposit shall be refunded without interest, subject to deductions as determined by the Licensor.
6. MAINTENANCE
The Licensee shall pay all society maintenance charges, water charges, electricity charges and all other outgoings in respect of the said premises during the tenure of this agreement.
7. REPAIRS
The Licensee shall be responsible for all repairs and maintenance of the premises including but not limited to electrical, plumbing, structural and major repairs.
8. USE OF PREMISES
The premises shall be used only for residential purposes as a residence of the Licensee. The Licensee shall not sublet, assign or part with possession of the premises or any part thereof to any person without the prior written consent of the Licensor. The Licensee shall not permit any person other than the Licensee to reside in the premises.
9. VISITORS
The Licensee shall not permit any visitors to remain in the premises after 10:00 p.m. and shall not permit any guests to stay overnight without prior permission of the Licensor.
10. NOTICE
Either party shall give two months' written notice of termination to the other party before vacating or terminating this licence.
11. TERMINATION
On termination of this licence, the Licensee shall hand over vacant and peaceful possession of the premises to the Licensor and pay all arrears of rent and other charges due under this agreement. The Licensor shall be entitled to re-enter the premises and take possession in the event the Licensee fails to vacate on the expiry of the licence.
12. PROPERTY TAX
The Licensor shall be responsible for payment of property tax in respect of the said premises.
DISPUTE RESOLUTION
Any dispute arising out of this agreement shall be referred to arbitration at Sample City in accordance with the Arbitration and Conciliation Act, 1996.`,
];

export const SAMPLE_DEMO_INTERVIEW_INPUT = {
  city: 'Sample City',
  monthlyRent: '40000',
  deposit: '80000',
  duration: '11 months',
  lockIn: 'no',
  noticePeriod: '1 month',
  maintenance: 'me',
  repairs: 'split',
  increase: 'no',
  extras: ['Guests allowed'],
};

export const SAMPLE_ANALYSIS_RESPONSE = {
  overview:
    "This is a residential leave-and-licence agreement for eleven months with a security deposit of three months' rent and a lock-in period of six months. It places most repair and maintenance costs on the tenant and restricts visitors.",
  matchFindings: [
    {
      key: 'monthlyRent',
      found: true,
      writtenValue: 'Rs. 40,000/- per month',
      clauseId: 'c005',
      quote: 'The Licensee shall pay monthly rent of Rs. 40,000/-',
      ambiguity: null,
    },
    {
      key: 'deposit',
      found: true,
      writtenValue: "Rs. 1,20,000/- equivalent to three months' rent",
      clauseId: 'c006',
      quote:
        "a security deposit of Rs. 1,20,000/- (Rupees One Lakh Twenty Thousand only) equivalent to three months' rent",
      ambiguity: null,
    },
    {
      key: 'duration',
      found: true,
      writtenValue: 'eleven (11) months',
      clauseId: 'c003',
      quote: 'for a period of eleven (11) months',
      ambiguity: null,
    },
    {
      key: 'lockIn',
      found: true,
      writtenValue: 'six (6) months lock-in',
      clauseId: 'c004',
      quote: 'shall not vacate the premises before the expiry of six (6) months',
      ambiguity: null,
    },
    {
      key: 'noticePeriod',
      found: true,
      writtenValue: 'two months',
      clauseId: 'c011',
      quote: "give two months' written notice",
      ambiguity: null,
    },
    {
      key: 'maintenance',
      found: true,
      writtenValue: 'Licensee pays society maintenance, water, electricity',
      clauseId: 'c007',
      quote:
        'The Licensee shall pay all society maintenance charges, water charges, electricity charges',
      ambiguity: null,
    },
    {
      key: 'repairs',
      found: true,
      writtenValue: 'Licensee responsible for all repairs including structural',
      clauseId: 'c008',
      quote:
        'responsible for all repairs and maintenance of the premises including but not limited to electrical, plumbing, structural',
      ambiguity: null,
    },
    {
      key: 'increase',
      found: false,
      writtenValue: null,
      clauseId: null,
      quote: null,
      ambiguity: null,
    },
    {
      key: 'extras',
      found: true,
      writtenValue: 'no visitors after 10 p.m. and no overnight guests without permission',
      clauseId: 'c010',
      quote:
        'shall not permit any visitors to remain in the premises after 10:00 p.m. and shall not permit any guests to stay overnight',
      ambiguity: null,
    },
  ],
  protectionFindings: [
    {
      id: 'DEPOSIT_AMOUNT',
      state: 'present',
      summary: 'Deposit stated in rupees',
      clauseId: 'c006',
      quote: 'a security deposit of Rs. 1,20,000/-',
    },
    {
      id: 'DEPOSIT_REFUND_TIMELINE',
      state: 'absent',
      summary: 'No refund deadline',
      clauseId: null,
      quote: null,
    },
    {
      id: 'DEPOSIT_DEDUCTION_BASIS',
      state: 'unclear',
      summary: 'Deductions as determined by Licensor',
      clauseId: 'c006',
      quote: 'subject to deductions as determined by the Licensor',
    },
    {
      id: 'RENT_AMOUNT',
      state: 'present',
      summary: 'Rent stated',
      clauseId: 'c005',
      quote: 'The Licensee shall pay monthly rent of Rs. 40,000/-',
    },
    {
      id: 'RENT_DUE_DATE',
      state: 'present',
      summary: 'Due by 7th of month',
      clauseId: 'c005',
      quote: 'payable in advance on or before the seventh day',
    },
    {
      id: 'RENT_INCREASE',
      state: 'absent',
      summary: 'No increase clause',
      clauseId: null,
      quote: null,
    },
    {
      id: 'MAINTENANCE_CHARGES',
      state: 'present',
      summary: 'Tenant pays all charges',
      clauseId: 'c007',
      quote: 'The Licensee shall pay all society maintenance charges',
    },
    {
      id: 'REPAIRS_MAJOR',
      state: 'present',
      summary: 'Tenant responsible for structural repairs',
      clauseId: 'c008',
      quote: 'including but not limited to electrical, plumbing, structural and major repairs',
    },
    {
      id: 'REPAIRS_MINOR',
      state: 'present',
      summary: 'All repairs on tenant',
      clauseId: 'c008',
      quote: 'responsible for all repairs and maintenance',
    },
    {
      id: 'NOTICE_TENANT',
      state: 'present',
      summary: 'Two months notice',
      clauseId: 'c011',
      quote: "give two months' written notice",
    },
    {
      id: 'NOTICE_LANDLORD',
      state: 'present',
      summary: 'Two months notice',
      clauseId: 'c011',
      quote: "give two months' written notice",
    },
    {
      id: 'LOCK_IN',
      state: 'present',
      summary: 'Six months lock-in',
      clauseId: 'c004',
      quote: 'before the expiry of six (6) months',
    },
    {
      id: 'ENTRY_NOTICE',
      state: 'absent',
      summary: 'No entry notice clause',
      clauseId: null,
      quote: null,
    },
    {
      id: 'ESSENTIAL_SERVICES',
      state: 'absent',
      summary: 'Not mentioned',
      clauseId: null,
      quote: null,
    },
    {
      id: 'SUBLET_GUESTS',
      state: 'present',
      summary: 'No subletting, no visitors after 10pm',
      clauseId: 'c010',
      quote: 'shall not permit any visitors to remain in the premises after 10:00 p.m.',
    },
    { id: 'RENEWAL', state: 'absent', summary: 'No renewal clause', clauseId: null, quote: null },
    {
      id: 'SALE_OF_PROPERTY',
      state: 'absent',
      summary: 'Not mentioned',
      clauseId: null,
      quote: null,
    },
    {
      id: 'REGISTRATION_STAMPING',
      state: 'unclear',
      summary: 'Not addressed',
      clauseId: null,
      quote: null,
    },
    {
      id: 'INVENTORY_HANDOVER',
      state: 'absent',
      summary: 'No inventory schedule',
      clauseId: null,
      quote: null,
    },
    {
      id: 'DISPUTE_RESOLUTION',
      state: 'present',
      summary: 'Arbitration in Sample City',
      clauseId: 'c014',
      quote: 'shall be referred to arbitration at Sample City',
    },
  ],
};

export const SAMPLE_ASK_RESPONSES: Array<{ question: string; response: unknown }> = [
  {
    question: 'Can I leave after six months?',
    response: {
      status: 'answered',
      answer:
        "Yes — after the six-month lock-in ends you may give two months' written notice. If you leave during the lock-in, the agreement says the owner keeps the full deposit and you owe rent for the remaining lock-in months, so it is better to wait until the lock-in completes.",
      citations: [
        {
          clauseId: 'c004',
          quote: 'shall not vacate the premises before the expiry of six (6) months',
        },
        { clauseId: 'c011', quote: "give two months' written notice" },
      ],
      missingInfo: [],
      suggestedQuestions: [],
    },
  },
  {
    question: 'Can I keep a cat?',
    response: {
      status: 'not_in_document',
      answer:
        "Your agreement doesn't mention pets. It restricts guests and visitors after 10 p.m., but says nothing about animals. Ask the owner in writing whether pets are allowed before you sign.",
      citations: [],
      missingInfo: ['Whether pets are allowed'],
      suggestedQuestions: [
        'Are pets allowed in the flat, and should we add that to the agreement in writing?',
        'Is there any no-pet policy for the building society?',
      ],
    },
  },
  {
    question: 'Can the owner cut off the water if we have a dispute?',
    response: {
      status: 'needs_professional',
      answer:
        'The agreement itself does not say anything about cutting water or power. Generally, withholding essential supplies as a remedy is viewed severely and the Model Tenancy Act, 2021 bars it where adopted. If this ever happens, the outcome depends on state law and specifics, so confirm with a lawyer.',
      citations: [
        {
          clauseId: 'c012',
          quote: 'The Licensor shall be entitled to re-enter the premises and take possession',
        },
      ],
      missingInfo: ['State-specific tenancy rules'],
      suggestedQuestions: [
        'What does the local rent law say about withholding essential services?',
      ],
    },
  },
];

export const SAMPLE_NEGOTIATION_RESPONSE = {
  message:
    "Hi, thank you for showing me the agreement. After reviewing it, a few points differ from what we discussed, and I'd love to align them.\n1. Deposit: we agreed on two months (Rs. 80,000) but the agreement says three months (Rs. 1,20,000). Could we set it back to two months?\n2. Lock-in: we didn't discuss a lock-in, but the agreement has a six-month lock-in. Could we remove it, or apply it to both sides?\n3. Deposit return: the agreement doesn't say when the deposit comes back. Could we add \u201cwithin 15 days of handing over the keys\u201d?\n4. Entry: there's no entry-notice clause. Could we add 24 hours' written notice before visits?\n5. Repairs: the agreement puts all repairs, including structural, on the tenant. Could structural repairs over Rs. 2,000 stay with the owner?\n6. Guests: the 10 p.m. visitor limit is hard for us. Could it be removed or limited to overnight stays?\nThank you for your time!",
  items: [
    {
      rowId: 'match-deposit',
      ask: 'Deposit: we agreed on two months (Rs. 80,000), agreement says three months.',
      reason: 'The deposit is larger than the two months we discussed.',
      suggestedWording:
        "Security deposit: Rs. 80,000 (two months' rent), refundable within 15 days of handing over vacant possession.",
    },
    {
      rowId: 'match-lockIn',
      ask: 'Lock-in: not discussed, but the agreement has six months.',
      reason: 'A lock-in period was never mentioned and traps the deposit.',
      suggestedWording: 'Lock-in period: none, or six months applicable to both parties.',
    },
    {
      rowId: 'gap-DEPOSIT_REFUND_TIMELINE',
      ask: 'Deposit return: add a refund deadline.',
      reason: "The agreement doesn't say when the deposit is refunded.",
      suggestedWording:
        'The deposit shall be refunded within 15 days of handing over vacant possession.',
    },
    {
      rowId: 'gap-ENTRY_NOTICE',
      ask: "Add 24 hours' written notice before the owner visits.",
      reason: 'The agreement has no entry-notice provision.',
      suggestedWording:
        "The Owner shall give at least 24 hours' written notice before entry, except in an emergency.",
    },
    {
      rowId: 'gap-REPAIRS_MAJOR',
      ask: 'Keep structural repairs with the owner.',
      reason: 'The agreement puts all repairs, including major, on the tenant.',
      suggestedWording: "Structural and major repairs are the Owner's responsibility.",
    },
    {
      rowId: 'match-extras',
      ask: 'Remove or narrow the 10 p.m. visitor rule.',
      reason: 'Guests were promised, but the agreement restricts visits after 10 p.m.',
      suggestedWording:
        'The Tenant may receive visitors; overnight stays beyond a week require consent.',
    },
  ],
};
