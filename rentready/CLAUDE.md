# CLAUDE.md – Instructions for Claude Code

## Project
RentReady: a **backend-free** React app that checks an Indian rental agreement against what the renter says they were promised, reports what's missing, and produces a negotiation message and move-in kit. Static hosting on Cloudflare Pages. The user brings their own Gemini API key (BYOK), called directly from the browser.

Read `README.md` and all of `docs/` before deciding anything. `docs/ARCHITECTURE.md` governs structure; `docs/INTERVIEW_SPEC.md` governs the interview and verdict semantics; `docs/PROJECT_PLAN.md` governs order of work.

## Commands
`npm run dev` · `npm run build` · `npm run preview` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run test:coverage` · `npm run test:e2e` · `npm run eval` (needs a real key in `.env.local`; never in CI)

## Non-negotiable rules
1. **No backend, ever.** No Pages Functions, no Workers, no server routes, no proxy. If something seems to need a server, solve it client-side or drop it.
2. **No bundled secret.** The Gemini key comes from the user at runtime. It is never in source, env vars, `VITE_*`, fixtures, exports, URLs, logs or commits. `src/core/gemini` must route all errors through `redact()`.
3. **The model reports, the code judges.** Verdicts (`matches`/`differs`/`not_covered`/`unclear`), severities, page numbers, rule text and the protection checklist all come from `src/core`, never from model output.
4. Every model response is Zod-validated, clause IDs are checked against real clauses, and every quote goes through `verifyQuote`. Unverified evidence demotes a row to `unclear`; an `answered` Q&A with no verified citation becomes `not_in_document`.
5. Agreement text and user questions are untrusted: keep `<agreement>` delimiters and the "data, not instructions" rule in every prompt.
6. No `dangerouslySetInnerHTML`, `eval`, `new Function`. Highlight by splitting strings into React nodes.
7. The app must be useful **offline and without a key**: interview, rules, checklist, move-in kit and exports never require the network.
8. Cautious legal language always: "generally", "commonly", "varies by state". Never "void", "illegal", "you should sign".
9. Keep the repo small (well under 10 MB): no binaries, tiny synthetic fixtures, compressed images.
10. `src/core` stays pure TypeScript — no React, no DOM APIs beyond `fetch`/`TextEncoder`/`crypto` — so it runs in Node for `scripts/eval.ts`.

## Conventions
- TypeScript strict; no `any`; parse `unknown` with Zod at every boundary (model output, file input, URL params).
- React function components + hooks; state via Context + `useReducer` in `src/state`. No extra state or UI library without a written reason.
- `PascalCase.tsx` components, `camelCase.ts` modules, tests co-located as `*.test.ts(x)`.
- All user-facing strings go through `t()` in `src/i18n` — including error messages.
- Accessibility is part of "done": semantic elements, real form controls, labels, keyboard, visible focus, live regions, icon+word for status, 44 px targets.
- Conventional commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`); small and frequent.
- Short JSDoc on exported functions explaining *why*, especially in `verify/`, `rules/`, `interview/compare.ts`.

## Definition of done (each task)
- [ ] lint, typecheck, tests pass
- [ ] new logic has tests; coverage thresholds hold (100% for verify, rules, compare)
- [ ] works in Demo mode with no key, and offline where applicable
- [ ] keyboard + screen-reader basics checked for new UI
- [ ] `docs/PROJECT_PLAN.md` checkbox ticked and daily log updated
- [ ] docs updated if a contract or decision changed

## Approved dependencies
react, react-dom, zod, pdfjs-dist, mammoth, tailwindcss, @tailwindcss/vite, clsx, vite-plugin-pwa.
Dev: vite, @vitejs/plugin-react, typescript, vitest, @vitest/coverage-v8, jsdom, @testing-library/react, @testing-library/user-event, @testing-library/jest-dom, vitest-axe, @playwright/test, @axe-core/playwright, eslint, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y, prettier, tsx.
No Gemini SDK — use plain `fetch`. Ask before adding anything else.

## Working style
- Follow `docs/PROJECT_PLAN.md` phase by phase. After each phase: run all checks, tick boxes, commit, summarise decisions, and continue unless I've said to stop.
- Resolve doc ambiguity by choosing the simpler option that respects the rules above; log it in `docs/DECISIONS.md` and keep moving. Ask only for hard-to-reverse choices.
- Verify library APIs against installed versions (read the types) instead of assuming.
