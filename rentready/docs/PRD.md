# RentReady – Product Requirements Document

## 1. Vision
Most renters don't need a summary of their agreement. They need to know three things before they sign: *does this match what I was promised, what's missing, and what do I do about it?* RentReady answers exactly those, with evidence.

## 2. The four core questions

**1. Who exactly is the user?**
A renter in India about to sign a residential rental or leave-and-licence agreement. Typically 20–35, renting through a broker, WhatsApp, or a listing app; first or second time renting; sometimes reading legal English as a second language; often signing on a phone, in a hurry, with a deposit already half-paid.

**2. What exact problems do they struggle with?**
- The written agreement quietly differs from the verbal deal (deposit amount, notice period, who pays maintenance, lock-in).
- Important things are simply **absent**: deposit refund timeline, repair responsibility, landlord entry notice, what happens if the landlord sells the property.
- They don't know what "normal" looks like, so they can't tell a one-sided clause from a standard one.
- They don't know how to raise changes without sounding difficult or losing the flat.
- They lose deposits months later because nothing was documented at move-in.

**3. Why does GenAI make it meaningfully better?**
Agreements are drafted from hundreds of different templates; keyword search can't reliably locate "who pays for a leaking tap" or match a promised "₹40,000 deposit" to "a sum equivalent to two months' rent". A model can read the whole agreement, map each of the user's stated expectations onto real clauses, explain them in plain Hindi or English, and phrase a polite negotiation message — in seconds, on a phone.

**4. Why not a general-purpose AI assistant?**
A chatbot has no idea what you were promised, doesn't systematically check for absent protections, can't verify its own citations, and gives you text instead of actions. RentReady is built around a structured interview, a fixed protection checklist that runs even without AI, code-level quote verification, an explicit "not in your agreement" state, and concrete outputs: a negotiation message, a move-in checklist, a deposit timeline. It also needs no server, so the user's document never sits on anyone else's machine.

## 3. Personas

**Karthik, 23 – first flat after college (primary).** Renting a 1BHK with two friends. Was told "two months deposit, refundable when you leave". The agreement says three months with deductions "as determined by the Owner". He doesn't notice until RentReady puts the two side by side.

**Sneha, 29 – relocating for work (secondary).** Signing remotely, wants to know what she's committing to: lock-in, notice, rent escalation, and whether she can leave early if the job changes.

**Ravi, 34 – moving out, chasing a deposit (recovery persona).** Already renting; uses RentReady to see what the agreement says about deposit return and notice, and to send a documented, polite request.

## 4. The three engines (the product's spine)

| Engine | What it does | Needs AI? |
|---|---|---|
| **Match** | Compares each interview answer to the agreement → `matches` / `differs` / `not covered`, with evidence | Yes (mapping + quote), verified in code |
| **Gaps** | Checks the agreement against a fixed list of ~18 protections a fair agreement covers | Partly — AI detects presence, the checklist itself is fixed code |
| **Risk** | Applies the India rental rule library to found clauses | No — deterministic, runs offline |

Anything the AI produces is validated, quote-checked, and merged with deterministic output. Rule text is written by humans, never generated.

## 5. Features and priority

| ID | Feature | Priority |
|---|---|---|
| F1 | Interview (see `INTERVIEW_SPEC.md`), skippable, resumable within the session | Must |
| F2 | Upload PDF/DOCX or paste; parsed in-browser with page tracking | Must |
| F3 | Clause segmentation with stable IDs | Must |
| F4 | Match engine → promise-gap report with side-by-side evidence | Must |
| F5 | Gap engine → missing protections list | Must |
| F6 | Risk engine → rule cards with Indian rental context | Must |
| F7 | Code-verified quotes; unverified claims visibly marked | Must |
| F8 | Grounded Q&A with explicit "not in your agreement" | Must |
| F9 | Negotiation pack: message draft + suggested wording per requested change | Must |
| F10 | Move-in kit: inspection checklist, photo guide, meter readings, deposit timeline | Must |
| F11 | BYOK key flow + Demo mode with bundled sample | Must |
| F12 | Export: print, copy, download `.md` | Must |
| F13 | Hindi + reading-level toggle | Should |
| F14 | Read aloud | Should |
| F15 | Offline PWA (interview + rules + saved report work without network) | Should |
| F16 | Deposit-recovery mode for people already renting | Could |
| F17 | Scanned-PDF support via Gemini document understanding, with consent | Could |

## 6. User stories and acceptance criteria

**US1 – Interview.** As Karthik, I want to state the deal I was promised.
- ≤ 10 questions, each skippable; progress shown; answers editable later from the report.
- Money fields accept "40000", "40,000", "₹40k", "two months" and normalise to a comparable value.
- No question is mandatory; skipped items become "you didn't say" and are excluded from mismatches.

**US2 – Promise gap.** As Karthik, I want to see where paper and promise differ.
- Each interview item appears with one of: **Matches** (green, with clause), **Differs** (red, showing agreed vs written, with clause and page), **Not covered** (amber, with a suggested question).
- Every `matches`/`differs` row carries a verified quote; unverified ones are shown as "couldn't confirm" and never counted as a mismatch.

**US3 – Missing protections.** As Sneha, I want to know what my agreement doesn't say.
- The fixed checklist (see `LEGAL_RULES.md` §3) is always shown in full, each item marked Present (with clause) / Absent / Unclear.
- Absent items produce a suggested clause request in the negotiation pack.

**US4 – Ask.** As Sneha, I want to ask "Can I leave after six months?"
- Answer cites ≥ 1 verified clause, or returns "Your agreement doesn't cover this" plus what to ask.
- High-consequence topics (eviction, disputes, money owed) add a "check with a lawyer" note.

**US5 – Negotiation pack.** As Karthik, I want to ask for changes without sounding hostile.
- I pick which items to raise; the app drafts a short, polite message (WhatsApp and email versions) listing each requested change with the clause number and a one-line reason.
- For each change, suggested replacement wording is offered, clearly labelled as a suggestion to be reviewed.
- Copy and download work on mobile.

**US6 – Move-in kit.** As Karthik, I want to protect my deposit from day one.
- Checklist with room-by-room items, meter readings, photo guidance, and a timeline ("give notice by X if you plan to leave on Y", computed from the agreement's notice period when found).
- Checkbox state is local to the session and exportable.

**US7 – Key and privacy.** As any user, I want to know where my document goes.
- On first analysis, a clear panel explains: your key stays in this tab, the agreement text goes directly from your browser to Google's Gemini API, we have no server.
- "Forget key" and "Clear everything" buttons are always reachable.
- Demo mode requires no key and is labelled as sample data everywhere it appears.

**US8 – Accessibility.** As a Hindi-first user on a slow phone, I want to use everything.
- Interview, rules, gaps, and exports work with no network after first load (F15).
- Full keyboard use, screen-reader labels, Hindi UI + explanations, read-aloud.

## 7. Non-goals
- No legal advice, no "sign / don't sign" verdict, no prediction of court outcomes.
- No accounts, no server storage, no sharing links.
- No state-by-state rent control analysis in v1 (flagged as "varies by state" instead).
- Not for commercial leases in v1.

## 8. Success metrics (demo + eval)
- ≥ 95% of displayed quotes verified against source on the golden set.
- 100% correct "not covered" detection on the golden set's absent-protection cases.
- Interview → full report in < 20 s on a mid-range phone.
- Lighthouse Accessibility ≥ 95, Performance ≥ 90; axe 0 serious/critical.
- Initial JS < 200 KB gzip; rules + interview usable offline.

## 9. Standard language
- Banner: "RentReady explains your agreement. It isn't legal advice."
- Not covered: "Your agreement doesn't cover this. Ask the owner to add it in writing."
- Differs: "You said you agreed to X. The agreement says Y (Clause 4.2, page 2)."
- Escalation: "This one is worth checking with a lawyer before you sign."
