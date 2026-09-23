# RentReady – Project Planner

**Goal:** a deployed, tested, accessible RentReady on Cloudflare Pages, with a demo video, blog post and public post, submitted before the deadline.
**Order of value:** interview → local rule engine → AI analysis → actions. If time runs out, a working offline-only RentReady with a great interview and checklist still demos well; a half-built AI feature does not.

Legend: ⬜ todo · 🟨 doing · ✅ done · Est = focused hours

---

## Phase 0 – Setup (Day 1) · Est 4h
- ✅ Repo, docs, `.gitignore` (node_modules, dist, .env*, coverage, playwright-report, dev-dist)
- ✅ Vite + React + TS scaffold; `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- ✅ ESLint (typescript-eslint, react-hooks, jsx-a11y, ban `dangerouslySetInnerHTML`, ban `console` in `src/core/gemini`), Prettier
- ✅ Tailwind, tokens from `UX_FLOW.md`, app shell: skip link, header, footer, disclaimer
- ✅ Vitest + RTL + vitest-axe; Playwright + axe
- ✅ `public/_headers`, `public/_redirects`
- 🟨 CI green; **deploy the empty shell to Cloudflare Pages on day 1** — workflow written and every step passes locally; first push and Pages project are owner steps (`HUMAN_TASKS.md` §1–2)
**Done when:** live URL loads, CSP headers verified, CI green.

## Phase 1 – Domain core, no UI (Day 2) · Est 7h
- ✅ `core/types.ts`, `core/schemas.ts`, `core/limits.ts`
- ✅ `core/interview/questions.ts` + `normalise.ts` + tests (money, months, durations)
- ✅ `core/verify/*` + tests (100%)
- ✅ `core/rules/rental.ts` + `protections.ts` from `LEGAL_RULES.md` + tests for every rule
- ✅ `core/interview/compare.ts` (verdict logic) + tests (100%)
**Done when:** `npm run test:coverage` shows 100% on verify, rules and compare.

## Phase 2 – Interview UI (Day 3) · Est 6h
- ⬜ `AppProvider` state + reducer + `RESET_ALL`
- ⬜ Interview screens, progress, skip, back, live normalised echo
- ⬜ Answer summary with inline edit
- ⬜ i18n scaffolding (`t()`, `en`) wired from the start
- ⬜ Component tests + axe on each step
**Done when:** full interview is keyboard-only navigable and covered by tests.

## Phase 3 – Document intake (Day 4) · Est 6h
- ⬜ Lazy pdf.js parser with pages; scanned detection; lazy mammoth; paste path
- ⬜ File guards (magic bytes, size, pages, chars) with friendly errors
- ⬜ `core/parsing/segmenter.ts` + tests
- ⬜ Sample agreement (synthetic, with deliberate problems) + "Use the sample"
**Done when:** sample and a real PDF both produce clauses with correct pages.

## Phase 4 – Local-only report (Day 5) · Est 6h
- ⬜ Run rules + protection skeleton with **no AI**; render the "Worth a closer look" section and the checklist as Unclear
- ⬜ Report shell with tabs, clause list, side-by-side viewer, `<mark>` highlighting
- ⬜ Empty/loading/error states with live regions
**Done when:** the app is genuinely useful offline, before any AI exists.

## Phase 5 – Gemini layer (Day 6–7) · Est 10h
- ⬜ `core/gemini/client.ts` (fetch, schema, timeout, retries, typed errors, `redact()`)
- ⬜ Key panel: entry, masking, remember-for-tab opt-in, forget, budget counter
- ⬜ Prompts + response schemas from `AI_PIPELINE.md`
- ⬜ Wire analysis: model findings → Zod → verification → `compare.ts` → report
- ⬜ Record real responses into `src/sample/` for Demo mode; `?demo=1` route
- ⬜ Client tests with mocked fetch, including key-never-leaks assertions
**Done when:** sample agreement produces correct `differs` / `not_covered` rows with verified quotes, and Demo mode needs no key.

## Phase 6 – Ask (Day 8) · Est 4h
- ⬜ Ask panel, suggested questions from the user's own answers
- ⬜ Status cards, citation chips that focus clauses
- ⬜ Downgrade rule + tests for all statuses

## Phase 7 – Actions (Day 9) · Est 6h
- ⬜ Negotiation pack: selection, tone/channel, AI wording call, editable output, copy/share/download
- ⬜ Move-in kit: checklist, photo guide, meter readings, timeline computed from found notice/term dates
- ⬜ Print stylesheet; `.md` export
**Done when:** a judge can leave the demo holding a message and a checklist.

## Phase 8 – Language, a11y, PWA (Day 10) · Est 6h
- ⬜ Hindi dictionary incl. rule text; reading-level toggle wired into prompts
- ⬜ Read-aloud; glossary popovers
- ⬜ Full keyboard + screen-reader pass; fix every axe finding; 320 px and 200% zoom
- ⬜ `vite-plugin-pwa`, offline verification, update prompt

## Phase 9 – Quality & eval (Day 11) · Est 6h
- ⬜ Golden set (5 agreements + expected.json); `scripts/eval.ts`; metrics into README
- ⬜ Complete E2E suite incl. offline, key-leak and injection specs
- ⬜ Coverage thresholds; bundle analysis; Lighthouse mobile
- ⬜ Security checklist (`SECURITY.md` §6) fully ticked

## Phase 10 – Ship (Day 12–13) · Est 6h
- ⬜ Final deploy; smoke test on a real phone on mobile data
- ⬜ README: screenshots (compressed), metrics table, criteria map
- ⬜ Demo video (see `SUBMISSION.md`)
- ⬜ Blog post + public build-in-public post
- ⬜ Submit repo URL + live URL + blog + post; keep one attempt in reserve

---

## Stretch (only when every Must is green)
Deposit-recovery mode for current renters · consented Gemini OCR for scanned agreements · more Indian languages · comparing two versions of the same agreement · shareable printable report

## Risks
| Risk | Mitigation |
|---|---|
| Judge has no Gemini key | Demo mode is a Must, not a nice-to-have; it's the default entry on Home |
| Free-tier rate limits mid-demo | Budget counter, memoised results, Demo mode fallback, fresh key on demo day |
| Model returns bad JSON | Schema + Zod + repair retry + recorded fixtures |
| Verdict logic feels wrong on real agreements | Verdicts are code with 100% test coverage; test against 5 varied synthetic agreements early |
| Legal inaccuracy | Human-written rule text, cautious wording, "varies by state" on every card, verified against primary sources in Phase 9 |
| Scope creep | Freeze scope after Phase 7; stretch items only in Phase 10 if green |

## Daily log
```
### Day N – YYYY-MM-DD
Done:
Blocked:
Decisions:
Next:
```

### Day 1 – 2026-09-23
Done: Phase 1 domain core (verify/rules/interview at 100%). Phase 0 audit: the scaffold, strict TS, Tailwind tokens, shell, headers and redirects were already in place and are now ticked. Added the ESLint bans (`dangerouslySetInnerHTML`, `eval`/`new Function`, all `console` in `src/core/gemini`); jsdom + jest-dom + axe for component tests (`App.test.tsx`); Playwright config and a shell spec running under the production CSP (10/10, desktop + mobile); CI workflow + Dependabot; SVG icon. Fixed the 320 px overflow caused by the key panel in the header. Removed key-shaped literals from tests so the CI secret scan passes.
Blocked: live deploy needs the owner's Cloudflare account and a push (HUMAN_TASKS.md).
Decisions: #5 (reworded), #17–21.
Next: Phase 2 — audit the existing AppProvider/Interview against INTERVIEW_SPEC, add component tests + axe per step.
