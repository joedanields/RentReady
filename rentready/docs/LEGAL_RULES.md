# RentReady – India Rental Rule Library & Protection Checklist

> **Team note:** this file is the source of truth for `src/core/rules/rental.ts` and `src/core/rules/protections.ts`. All rule text is human-written and fixed; the model never generates it. Before submission, re-verify every "Basis" line against primary sources (India Code, the Model Tenancy Act text, your state's rent-control or leave-and-licence rules) and update `lastReviewed`. Rental law in India is **state-specific**: every rule card must carry the line *"Rules vary by state — confirm for {{city}}."*
>
> Language rules: use "generally", "commonly", "in many states", "may". Never assert that a clause is void, illegal or unenforceable for this user.

## 1. Severity guide
- **HIGH** – could cost the renter significant money or their home (deposit, lock-in, eviction, essential services, entry).
- **MEDIUM** – one-sided, unclear, or shifts normal costs to the renter.
- **INFO** – worth knowing, usually standard.

## 2. Clause rules

### IN-RENT-DEPOSIT-HIGH — Deposit larger than the common norm
- **Trigger:** deposit ≥ 3× monthly rent (computed in code from the agreement's stated deposit and rent).
- **Severity:** HIGH
- **Message:** Your deposit is about {{n}} months of rent. The Model Tenancy Act, 2021 suggests a cap of two months' rent for residential tenancies, and two to three months is the common practice in much of India, though some cities ask for more. A larger deposit means more of your money is locked with the owner, so it's worth negotiating or at least pinning down exactly how and when it comes back.
- **Basis:** Model Tenancy Act, 2021 (a model law — it applies only where a state has adopted it); local practice.
- **Questions:** "Would you consider two months instead?" · "When exactly will the deposit be returned after I hand over the keys?"

### IN-RENT-DEPOSIT-NO-TIMELINE — No deadline for returning the deposit
- **Trigger:** `DEPOSIT_REFUND_TIMELINE` protection is `absent` or `unclear`.
- **Severity:** HIGH
- **Message:** The agreement doesn't say *when* your deposit must be returned. This is the single most common source of rental disputes. Ask for a specific number of days after you hand over possession, written into the agreement.
- **Basis:** Model Tenancy Act, 2021 (deposit refundable at the time of taking vacant possession, after permitted deductions); contract terms.
- **Questions:** "Can we write: the deposit will be refunded within 15 days of handing over the keys?"

### IN-RENT-DEPOSIT-DISCRETION — Deductions decided only by the owner
- **Trigger:** deposit clause contains `sole discretion|as determined by the (owner|licensor|landlord)|deemed (fit|necessary)` without an itemised basis.
- **Severity:** HIGH
- **Message:** The agreement lets the owner decide deductions without a stated basis. Ask for deductions to be limited to unpaid rent, unpaid bills, and damage beyond normal wear and tear, supported by bills or photos.
- **Questions:** "Can deductions be limited to unpaid dues and actual damage, with receipts shared?"

### IN-RENT-LOCKIN-LONG — Long minimum stay
- **Trigger:** lock-in ≥ 6 months, or lock-in ≥ half the agreement term.
- **Severity:** HIGH if the penalty is forfeiture of the full deposit, otherwise MEDIUM.
- **Message:** A lock-in period means leaving early can cost you rent or part of your deposit even if you give notice. Check whether the lock-in applies to both sides, and what exactly you owe if you must leave early.
- **Questions:** "Does the lock-in apply to the owner too?" · "If I leave early, is it the remaining rent or a fixed amount?"

### IN-RENT-NOTICE-ASYMMETRIC — Unequal notice periods
- **Trigger:** tenant's notice > owner's notice.
- **Severity:** MEDIUM
- **Message:** You must give more notice than the owner. Where an agreement is silent, the Transfer of Property Act, 1882 provides a 15-day notice for month-to-month tenancies, but a written agreement usually overrides that. Equal notice on both sides is a reasonable thing to ask for.
- **Basis:** Transfer of Property Act, 1882, s.106; contract terms.
- **Questions:** "Can we make the notice period the same for both of us?"

### IN-RENT-ENTRY-NO-NOTICE — Owner can enter without notice
- **Trigger:** entry clause present without a notice period, or `at any time|without prior notice`; or `ENTRY_NOTICE` protection `absent`.
- **Severity:** HIGH
- **Message:** The agreement doesn't require the owner to give notice before entering. The Model Tenancy Act, 2021 provides for at least 24 hours' written notice before entry, and that is a fair benchmark to ask for even where the Act hasn't been adopted.
- **Basis:** Model Tenancy Act, 2021.
- **Questions:** "Can we add 24 hours' written notice before any visit, except emergencies?"

### IN-RENT-ESSENTIAL-SERVICES — Cutting water or power as a remedy
- **Trigger:** `disconnect|cut off|withhold|discontinue` near `water|electricity|power|supply|amenities`.
- **Severity:** HIGH
- **Message:** This clause suggests the owner may cut essential supplies if there's a dispute. The Model Tenancy Act, 2021 specifically bars withholding essential supplies, and this is widely treated as unacceptable. Ask for it to be removed, and speak to a lawyer if it ever happens.
- **Basis:** Model Tenancy Act, 2021.
- **Questions:** "Can this clause be removed?"

### IN-RENT-EVICTION-SELF-HELP — Locking out or removing belongings
- **Trigger:** `re-?enter|take possession|lock|remove (the )?(goods|belongings|articles)` without reference to a court, tribunal or rent authority.
- **Severity:** HIGH
- **Message:** The agreement appears to allow the owner to take back possession directly. Eviction in India generally has to follow a legal process through the appropriate court, tribunal or rent authority. If you ever face a lock-out, get legal help immediately.
- **Basis:** State rent control legislation; Model Tenancy Act, 2021 (rent authority/tribunal process).
- **Questions:** "Can we state that possession will be taken back only through the process allowed by law?"

### IN-RENT-REPAIRS-ON-TENANT — All repairs pushed to the renter
- **Trigger:** repairs clause makes the tenant responsible for `all repairs|structural|major` items.
- **Severity:** MEDIUM
- **Message:** Normally structural and major repairs (walls, roof, plumbing, wiring) stay with the owner, while the renter handles small day-to-day fixes. This agreement shifts more to you. Ask for a split with a rupee threshold.
- **Basis:** Transfer of Property Act, 1882, s.108 (rights and liabilities in the absence of contract); Model Tenancy Act, 2021 (schedule of repair responsibilities).
- **Questions:** "Can repairs above ₹2,000 be the owner's responsibility?"

### IN-RENT-INCREASE-UNCAPPED — Rent can be raised at will
- **Trigger:** `revise|increase|escalate` rent with `sole discretion|from time to time|as decided by the owner` and no fixed percentage.
- **Severity:** MEDIUM
- **Message:** The agreement lets rent be raised without a fixed limit. A stated percentage on renewal (commonly around 5–10% a year in many cities) makes your costs predictable.
- **Questions:** "Can we fix the increase at a specific percentage on renewal?"

### IN-RENT-MAINTENANCE-UNCLEAR — Maintenance and bills not split clearly
- **Trigger:** `MAINTENANCE_CHARGES` protection `absent`/`unclear`, or the clause doesn't name who pays society maintenance, water, electricity or property tax.
- **Severity:** MEDIUM
- **Questions:** "Who pays society maintenance, water, electricity and property tax? Can we list each one?"

### IN-RENT-REGISTRATION — 11 months, registration and stamping
- **Trigger:** term ≤ 11 months, or `REGISTRATION_STAMPING` absent.
- **Severity:** INFO
- **Message:** Agreements are often written for 11 months because, under the Registration Act, 1908, leases from year to year or for a term exceeding one year generally must be registered. Registration and stamp duty rules differ by state, and some states require registration of leave-and-licence agreements regardless of term. A registered or properly stamped agreement is far easier to rely on if there's ever a dispute.
- **Basis:** Registration Act, 1908, s.17; Indian Stamp Act and state stamp laws; state-specific leave-and-licence rules.
- **Questions:** "Will the agreement be registered, and who pays the stamp duty and registration fee?"

### IN-RENT-GUEST-RESTRICTION — Limits on guests, visitors or lifestyle
- **Trigger:** `no (visitors|guests)|opposite sex|non-?veg|unmarried|pets` restrictions.
- **Severity:** MEDIUM
- **Message:** The agreement restricts who can visit or how you live in the home. These terms are common in practice but can be intrusive, and some kinds of restrictions raise fairness concerns. If a term would be hard for you to live with, raise it before signing rather than after.
- **Questions:** "Can the restriction on {{item}} be removed or limited to overnight stays beyond a week?"

### IN-RENT-SUBLET-SHARING — Sharing the flat with flatmates
- **Trigger:** `sub-?let|part with possession|shall not allow any other person`.
- **Severity:** MEDIUM if the user indicated flatmates, else INFO.
- **Questions:** "Are my named flatmates allowed under this clause?" · "What if one flatmate moves out and another joins?"

### IN-RENT-SALE-OF-PROPERTY — If the owner sells the property
- **Trigger:** `SALE_OF_PROPERTY` protection absent.
- **Severity:** MEDIUM
- **Message:** The agreement doesn't say what happens if the property is sold during your tenancy. Ask for a line saying the agreement continues with the new owner for the remaining term.
- **Questions:** "If the flat is sold, does my agreement continue with the new owner?"

### IN-RENT-TDS — Tax deduction when rent is high
- **Trigger:** monthly rent > ₹50,000.
- **Severity:** INFO
- **Message:** Where monthly rent crosses ₹50,000, income-tax rules can require the tenant to deduct tax at source when paying rent. Rates and procedures change, so confirm the current position with a tax professional or the Income Tax portal, and check whether the agreement says who handles it.
- **Basis:** Income-tax Act, 1961, s.194-IB (verify the current rate and threshold before release).
- **Questions:** "Who will handle TDS, and do you have a PAN to share for it?"

### IN-RENT-POLICE-VERIFICATION — Tenant verification
- **Trigger:** `police verification` present, or protection absent and city is a metro.
- **Severity:** INFO
- **Message:** Many states require tenant verification with the local police. It's usually the owner's responsibility to file it, with documents from you.
- **Questions:** "Will you complete the police verification, and what documents do you need from me?"

### IN-RENT-DISPUTE — Where disputes go
- **Trigger:** `DISPUTE_RESOLUTION` present (arbitration, courts, rent authority) or absent.
- **Severity:** INFO
- **Questions:** "If we ever disagree, where is it decided, and who pays the cost?"

## 3. Protection checklist (`protections.ts`)
Always displayed in full, each marked Present / Absent / Unclear. The checklist itself is fixed code — this is what lets RentReady report what's **missing**, which is the thing chat assistants do worst.

| ID | Plain title | Why it matters | Suggested wording to request |
|---|---|---|---|
| DEPOSIT_AMOUNT | Deposit amount stated in rupees | Prevents "two months" arguments later | "The Security Deposit is ₹____ (____ months of rent)." |
| DEPOSIT_REFUND_TIMELINE | When the deposit comes back | The top dispute cause | "The deposit shall be refunded within 15 days of handing over vacant possession." |
| DEPOSIT_DEDUCTION_BASIS | What can be deducted | Stops open-ended deductions | "Deductions limited to unpaid rent, unpaid utility bills and damage beyond normal wear and tear, supported by bills." |
| RENT_AMOUNT | Monthly rent | — | — |
| RENT_DUE_DATE | Due date and late fee | Avoids surprise penalties | "Rent is payable by the ____ of each month; late fee, if any, shall not exceed ____." |
| RENT_INCREASE | Increase on renewal | Predictable costs | "Rent may be increased by not more than ____% on renewal." |
| MAINTENANCE_CHARGES | Who pays maintenance, water, power, property tax | Hidden monthly costs | "Society maintenance and property tax: Owner. Electricity and water usage: Tenant." |
| REPAIRS_MAJOR | Who handles major repairs | Expensive if unclear | "Structural and major repairs are the Owner's responsibility." |
| REPAIRS_MINOR | Who handles small repairs | Daily friction | "Minor repairs up to ₹____ per instance are the Tenant's responsibility." |
| NOTICE_TENANT | Notice you must give | Planning your move | — |
| NOTICE_LANDLORD | Notice the owner must give | Protects you from sudden exit | "The Owner shall give not less than ____ days' written notice." |
| LOCK_IN | Minimum stay and its cost | Traps you or your deposit | "Lock-in period: ____ months, applicable to both parties." |
| ENTRY_NOTICE | Notice before the owner visits | Privacy | "The Owner shall give at least 24 hours' written notice before entry, except in an emergency." |
| ESSENTIAL_SERVICES | Water and power cannot be cut | Safety | "Essential supplies shall not be withheld under any circumstances." |
| SUBLET_GUESTS | Flatmates and guests | Affects who can live with you | "The Tenant may share the premises with ____ (named flatmates)." |
| RENEWAL | How renewal works | Avoids a scramble at month 11 | "Either party shall confirm renewal at least 30 days before expiry." |
| SALE_OF_PROPERTY | If the property is sold | Your tenancy's survival | "This agreement shall continue to bind any new owner for the remaining term." |
| REGISTRATION_STAMPING | Registration, stamp duty, who pays | Enforceability and cost | "The agreement shall be registered; stamp duty and registration charges shall be borne ____." |
| INVENTORY_HANDOVER | List of furniture and fittings, condition at handover | Deposit protection | "An inventory with photographs, signed by both parties, is annexed as Schedule ____." |
| DISPUTE_RESOLUTION | Where disputes are decided | Cost of a fight | — |

## 4. Implementation shape
```ts
export interface RentalRule {
  id: string;
  test: (ctx: RuleContext) => boolean;   // ctx = { clauses, findings, interview, derived }
  severity: (ctx: RuleContext) => Severity;
  title: string;
  message: string;                        // supports {{n}}, {{city}}, {{item}} tokens
  basis: string;
  questions: string[];
  lastReviewed: string;                   // 'YYYY-MM-DD'
  stateVariesNote: true;                  // always rendered
}
```
- Pure functions, no network, no React. 100% unit-test coverage with ≥ 2 positive and ≥ 2 negative fixtures per rule.
- Rule and checklist text is translated by humans into `src/i18n/hi.ts`, keyed by rule ID — never machine-translated at runtime.
