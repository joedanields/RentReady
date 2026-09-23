# Claude Code kickoff prompt — RentReady

Place `README.md`, `CLAUDE.md` and `docs/` at the repo root, open Claude Code there, and paste the block below. It's written for a long autonomous run: it keeps going through every phase instead of stopping for approval.

---

```
You are the lead engineer for RentReady, a Google PromptWars entry (theme: AI for legal
assistance and access). Judged on: Problem Statement Alignment, Code Quality, Security,
Efficiency, Testing, Accessibility. I have plenty of tokens and little time, so work
AUTONOMOUSLY and CONTINUOUSLY until the project is finished. Do not pause for approval
between phases.

HARD CONSTRAINT: React only, NO BACKEND of any kind. Static build hosted on Cloudflare Pages.
The user supplies their own Gemini API key at runtime, called directly from the browser.
If something appears to need a server, solve it client-side or drop it.

## 0. Orient
1. Read CLAUDE.md, README.md and every file in docs/ (PRD, INTERVIEW_SPEC, ARCHITECTURE,
   AI_PIPELINE, LEGAL_RULES, UX_FLOW, SECURITY, TESTING, ACCESSIBILITY, DEPLOYMENT,
   PROJECT_PLAN, SUBMISSION).
2. Summarise in ≤ 15 bullets what you're building, and list gaps, conflicts or risky
   assumptions with your proposed resolution.
3. Check current stable versions of the approved dependencies and the current stable Gemini
   Flash model ID; read installed type definitions before using any API.
4. Build a todo list from every checkbox in docs/PROJECT_PLAN.md and keep it updated.
5. Create docs/DECISIONS.md and log each resolution as one line.

## 1. Build
Work Phases 0 → 10 in order. Notes:
- Phase 4 must produce a genuinely useful app with NO AI at all (interview + rule engine +
  checklist + move-in kit). Prove it works offline before adding Gemini.
- Demo mode is a Must: a synthetic sample agreement (3-month deposit, 6-month lock-in, no
  refund timeline, no entry notice, all repairs on tenant, guest restriction) plus recorded
  Gemini responses that flow through the same Zod validation and quote verification.
- Write 5 synthetic golden-set agreements with expected.json for scripts/eval.ts.
- Use subagents for independent work (rule tests, i18n strings, component tests, e2e specs),
  then integrate and verify their output yourself.

## 2. Quality gate after EVERY phase
Run: npm run lint && npm run typecheck && npm run test:coverage && npm run build
(plus npm run test:e2e once it exists). Fix everything before moving on. Then tick the
checkboxes in docs/PROJECT_PLAN.md, append a dated log entry, and commit with a conventional
message. Never disable a test, lower a threshold, or add eslint-disable to get green.

## 3. Non-negotiables (also in CLAUDE.md)
- No backend, no bundled secret, key handled per docs/SECURITY.md §2 (memory by default,
  masked, redacted from errors, never in DOM text/exports/URLs, "Forget key" always available).
- The model reports, the code judges: verdicts, severities, page numbers, rule text and the
  protection checklist come from src/core only.
- Zod-validate every model response; verify every quote; demote unverified evidence to
  "unclear"; downgrade uncited "answered" Q&A to "not_in_document".
- Keep <agreement> delimiters and the injection rule in every prompt; include an injection
  test fixture proving behaviour doesn't change.
- src/core stays pure TS so it runs under Node for scripts/eval.ts.
- Accessibility is part of done for every UI piece; cautious legal language everywhere.
- Repo stays small; no binaries.

## 4. Things only I can do
Don't block on these — use Demo mode and list each with exact steps in HUMAN_TASKS.md:
Cloudflare Pages project creation, custom domain (if any), a real Gemini key for npm run eval,
demo video, blog post, public post. Prepare everything else, including a blog draft in
docs/BLOG_DRAFT.md.

## 5. Final hardening (after Phase 9)
In order, fixing as you go and re-running the quality gate after each:
a. Security: verify every item in docs/SECURITY.md §6 with real commands and E2E assertions,
   including "the key never appears in DOM text, exports or URLs".
b. Accessibility: axe on every screen, keyboard-only journey, 320 px and 200% zoom, Hindi pass.
c. Efficiency: bundle analysis, confirm pdf.js/mammoth/export chunks are lazy, initial JS
   under 200 KB gzip, one AI call per full report, memoised results.
d. Code quality: remove duplication and dead code, JSDoc on exported core functions, no any.
e. Judge review: act as a strict PromptWars judge, score each criterion 1–10 with file-path
   evidence, fix the highest-impact issues, re-score, repeat until every criterion ≥ 8 or the
   remainder needs me.
f. README: metrics table, screenshots placeholders, criteria map, quick start verified from a
   fresh clone.

## 6. Finish
Stop only when all Must and Should items pass the gate and hardening is done, or you're truly
blocked on HUMAN_TASKS.md. Then report: what was built, final judge scores with evidence, test
count, coverage, bundle size, repo size, anything skipped and why, and my next steps in order.

Start with step 0, then go straight into Phase 0 and keep going.
```

---

## Follow-up prompts
- **Judge review:** "Act as a strict PromptWars judge. Score all six criteria 1–10 with file-path evidence and list the top 10 fixes ranked by impact per hour. Then implement them."
- **Key safety:** "Prove the API key cannot leak. Add E2E assertions that it never appears in DOM text, downloads, share text, URLs or console, then run them."
- **Verdict quality:** "Run npm run eval on all five golden agreements. Report verdict accuracy, absence-detection accuracy and refusal accuracy. Fix only where below target, and show before/after."
- **Offline proof:** "Verify the interview, rule engine, checklist, move-in kit and exports work with the network disabled, and add a Playwright offline spec."
- **Pre-submit:** "Run every item in docs/SUBMISSION.md §1 and report pass/fail with evidence."
