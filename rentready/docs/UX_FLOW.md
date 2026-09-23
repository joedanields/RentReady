# RentReady – UX Flow and Screens

## Principles
1. **Personal before general.** The first thing the user sees is their own deal, not a summary of a PDF.
2. **Evidence beside every claim.** Agreed vs written, with the original clause and page.
3. **Absence is information.** "Not covered" is shown as prominently as "differs".
4. **End with an action.** Every report leads to a message to send or a checklist to use.
5. **Phone first.** Single column, thumb-reachable actions, works on a weak connection.

## Flow
```
Home → Interview (10 short screens, skippable) → Add agreement → Analysing…
   → Report [ Gaps | Details | Ask ] → Negotiate → Move-in kit → Export
```

## Screens

### 1. Home
- Headline: "Know what you're signing before you get the keys."
- Three lines of trust: *Checks the paper against what you were promised* · *Tells you what's missing* · *No server — your agreement stays on your device*.
- Primary: "Start — 2 minutes". Secondary: "See a demo" (no key needed).
- Small print: information, not legal advice.

### 2. Interview
- One question per screen on mobile; progress "3 of 10" with a labelled progress bar.
- Big tappable options; "Not sure" always present; Back always available.
- Money inputs show a live normalised echo ("₹40,000 — about 2 months' rent").
- Ends with an editable summary of answers.

### 3. Add agreement
- Buttons: Upload file · Paste text · Use the sample.
- After parsing: "Read 42 clauses across 9 pages."
- Key panel appears here if no key is set: what a key is, where to get one, what happens to it, and a "Continue in demo mode" escape.

### 4. Analysing
- Staged text in a live region: "Reading your agreement… Matching your answers… Checking quotes… Running local checks…"
- Local rule results appear first, before the AI returns, so the screen is never empty.

### 5. Report — tab "Gaps" (default)
Three stacked sections, each collapsible:
- **Doesn't match what you were told** — cards: `You said: 2 months (₹80,000)` / `The agreement says: 3 months (₹1,20,000)` with clause chip "Clause 4.2 · page 2" and a "See original" expander. Severity as icon + word.
- **Not covered at all** — items from the protection checklist marked Absent, each with why it matters and "Ask for this" (adds to the negotiation pack).
- **Worth a closer look** — rule cards with basis, "Rules vary by state — confirm for {{city}}", and "last reviewed".
Sticky footer: "{{n}} things to raise → Build my message".

### 6. Report — tab "Details"
- Full protection checklist with Present/Absent/Unclear and evidence.
- Full clause list with filters and search; each clause expandable with any findings attached.
- Verification badges: ✓ Verified quote · ~ Close match · ⚠ Couldn't confirm.

### 7. Report — tab "Ask"
- Suggested questions drawn from the user's own answers ("Can I leave after 6 months?" appears when a lock-in was found).
- Answer cards with status: Answered / Not in your agreement / Worth asking a lawyer; citation chips move focus to the clause.

### 8. Negotiate
- Checklist of everything raisable (pre-ticked for HIGH items).
- Tone: Polite / Direct. Channel: WhatsApp / Email.
- Generated message in an editable textarea, plus per-item suggested wording labelled "a starting point, not legal drafting".
- Copy · Share · Download `.md`.

### 9. Move-in kit
- Room-by-room inspection checklist, meter readings, photo guidance ("date-stamped, wide then close-up").
- Timeline computed from the agreement: notice deadline, renewal reminder, deposit-return date.
- Print-friendly; checkbox state local to the session.

### 10. Settings / privacy
- Key: set, remember for this tab (opt-in), forget.
- AI calls used: "3 of 12 this session".
- Language, reading level, theme.
- "Clear everything" wipes state and storage and returns to Home.

## States to design
Parsing, scanned PDF, no key, key rejected, quota exceeded, budget exhausted, offline (local results only), model blocked, partial verification, empty interview (user skipped everything).

## Visual tokens
- Font: system stack with Noto Sans Devanagari fallback for Hindi; base 16px, line-height 1.6.
- Colours (≥ 4.5:1): ink `#161B22`, surface `#FFFFFF`, muted `#5B6672`, primary `#0B6E4F` (a calm green, deliberately unlike a warning-red app), differs `#B42318`, notcovered `#B54708`, matches `#067647`.
- Verdicts always icon + word + colour.
- Touch targets ≥ 44×44 px; cards have generous spacing for thumbs.
- `prefers-reduced-motion` and `prefers-color-scheme` respected.
