# RentReady – Submission Kit

## 1. Final checklist
- [ ] Live URL loads on a phone over mobile data; Demo mode works with no key
- [ ] README complete with metrics, screenshots and criteria map; no secrets anywhere; repo small
- [ ] CI green; coverage and eval numbers pasted in
- [ ] Disclaimer visible on every screen; privacy page published
- [ ] Demo video (≤ 3 min) recorded
- [ ] Blog post and public build-in-public post published
- [ ] Submission form filled: repo, live URL, blog, post
- [ ] Re-read the official round rules (required tools, deadlines, repo limits) before submitting

## 2. Demo script (≈ 3 minutes)
1. **Hook (20 s):** "Karthik was told two months' deposit, refundable. He's about to sign eleven pages he hasn't read. The agreement says three months, and it never says when he gets it back."
2. **Interview (30 s):** answer four questions fast — rent, deposit, notice, repairs. Point out: *this is the part no chatbot has.*
3. **Agreement (15 s):** use the sample; note "read in your browser, no server".
4. **The moment (40 s):** report opens on **Doesn't match what you were told** — deposit card: *You said 2 months (₹80,000) · The agreement says 3 months (₹1,20,000) · Clause 4.2, page 2*. Expand to show the original text highlighted, with the "Verified quote" badge.
5. **What's missing (25 s):** scroll to **Not covered at all** — no deposit refund timeline, no entry notice. "These are the two things that cause most deposit fights, and they're absent. A summary tool would never tell you this."
6. **Ask (20 s):** "Can I keep a cat?" → *Your agreement doesn't cover this* plus the question to ask, in writing.
7. **Action (25 s):** build the negotiation message, show the polite WhatsApp draft with clause numbers, then the move-in checklist.
8. **Close (15 s):** Hindi toggle + read-aloud, then "No backend, no storage, your own key, and it still works offline."

Record at 1080p, phone-shaped viewport, with the network throttled to show honest timings.

## 3. Blog post outline
Title: *RentReady: what if a legal AI checked the paper against what you were actually promised?*
1. The real failure: the gap between the verbal deal and the written one
2. Why summaries don't help renters — and why absence matters more than presence
3. The interview-first design, and what it unlocks
4. Architecture with no backend: parsing, rules and verification in the browser
5. BYOK: turning "we can't hide a secret" into a privacy guarantee (with the CSP `connect-src` trick)
6. The model reports, the code judges: how verdicts stay deterministic
7. Designing for "your agreement doesn't cover this"
8. Offline-first: why the rule engine runs without AI
9. Testing an AI product: golden set, verification rate, refusal accuracy
10. What I'd build next

## 4. Public post draft
> "Two months' deposit, fully refundable." That's what he was told. The agreement said three months, and never said when he'd get it back.
>
> For #PromptWars I built **RentReady**: you answer a few questions about the deal you were promised, then add your rental agreement. It shows where the paper differs, what's missing entirely (deposit refund timeline, entry notice, repair responsibility), and drafts a polite message asking for the changes — with the exact clause and page beside every claim.
>
> No backend. Your agreement is read in your browser, and you bring your own Gemini key. It even runs the local checks offline.
>
> Try it (demo needs no key): <live link> · Code: <repo link>
> Information, not legal advice — it helps you ask better questions.
>
> #GoogleForDevelopers #Gemini #BuildInPublic #LegalTech #Housing
