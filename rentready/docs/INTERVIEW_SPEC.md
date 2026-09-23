# RentReady – Interview Specification

The interview is the product's differentiator: it captures the deal the user *believes* they agreed to, so every later screen can be personal rather than generic. It must feel like two minutes, not a form.

## Principles
- Max 10 questions, one per screen on mobile, 2–3 grouped on desktop.
- Every question skippable ("Not sure" / "Skip"). Skipped ≠ mismatch.
- Plain wording, no legal terms. Examples under each field.
- Answers are editable later from the report without redoing the flow.
- Stored in memory only (optionally `sessionStorage` if the user opts in).

## Questions

| # | Key | Question | Input | Notes |
|---|---|---|---|---|
| 1 | `city` | Which city is the place in? | text + common-city suggestions | Used only to show "rules vary by state" context |
| 2 | `monthlyRent` | What monthly rent did you agree to? | money | Accepts `40000`, `40,000`, `₹40k` |
| 3 | `deposit` | What security deposit did you agree to? | money **or** "N months of rent" | Normalised to both a number and a multiple |
| 4 | `duration` | How long is the agreement meant to run? | select: 11 months / 1 year / 2 years / other | 11 months is the common Indian default |
| 5 | `lockIn` | Were you told you must stay a minimum period? | select: no / yes (months) / not sure | |
| 6 | `noticePeriod` | How much notice did you agree to give before leaving? | select: 15 days / 1 month / 2 months / other / not sure | |
| 7 | `maintenance` | Who pays society maintenance? | select: me / owner / split / not discussed | |
| 8 | `repairs` | Who was going to handle repairs (plumbing, appliances)? | select: me / owner / small ones me, big ones owner / not discussed | |
| 9 | `increase` | Was a yearly rent increase mentioned? | select: no / yes (%) / not sure | |
| 10 | `extras` | Anything else you were promised? | multi-select chips + free text | Chips: parking, furniture, pets allowed, guests allowed, painting before move-in, WiFi included, water tanker, power backup |

## Normalisation rules (`src/core/interview/normalise.ts`)
- Money: strip `₹`, `Rs.`, `INR`, commas, spaces; expand `k`/`K` → ×1000, `lakh`/`L` → ×100000; reject > 10,000,000 and non-numeric with a friendly error.
- Deposit as months: `deposit.months = round(depositAmount / monthlyRent, 1)` when both are known; the user may also answer directly in months.
- Duration and notice: normalise to days (`11 months` → 330, `1 month` → 30, `15 days` → 15) for comparison, while displaying the original phrasing.
- Percentages: `10`, `10%`, `ten percent` → 10.

## Comparison semantics (Match engine)
For each answered key, the AI is asked to find what the agreement says. The result is classified in **code**, not by the model:

| Key | Compared how | `differs` when |
|---|---|---|
| `monthlyRent` | numeric | any difference > ₹1 |
| `deposit` | numeric, and as months of rent | difference > ₹1 or > 0.1 months |
| `duration` | days | difference > 15 days |
| `lockIn` | days | agreement has a lock-in the user said didn't exist, or a longer one |
| `noticePeriod` | days | agreement requires more notice from the tenant than stated |
| `maintenance`, `repairs` | enum | different responsible party |
| `increase` | percent | agreement has an increase the user didn't expect, or a higher one |
| `extras` | presence | promised item absent or contradicted |

Outputs: `matches` | `differs` | `not_covered` | `unclear` (model found something but the quote failed verification, or the wording is ambiguous). `unclear` is always shown honestly, never converted into a mismatch.

Severity for `differs`: HIGH if the agreement is worse for the tenant by a meaningful margin (deposit higher, notice longer, lock-in longer, rent higher, responsibility shifted to the tenant); MEDIUM otherwise; INFO if the agreement is *better* than promised (still shown — the user should know).

## Interview UX details
- Progress: "3 of 10" plus a progress bar with `aria-valuenow`.
- Keyboard: Enter advances, Shift+Tab goes back, numbers/arrow keys select options.
- "Skip all, just analyse" link on the first screen for users who only want the gap and risk engines.
- On completion: summary card of answers with inline edit, then "Add your agreement".
