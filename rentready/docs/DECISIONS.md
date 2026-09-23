# RentReady – Design Decisions Log

Every resolution of ambiguity or conflict is logged here in one line. Append as you go.

| # | Date | Decision |
|---|---|---|
| 1 | 2026-09-23 | Default Gemini model `gemini-2.5-flash` (stable, widely available, documented in AI_PIPELINE); expose newer IDs (`gemini-3.5-flash`, `gemini-3.8-flash`) in settings for the user to select; client uses `generateContent` (stable REST surface). |
| 2 | 2026-09-23 | `pdfjs-dist` pinned to ^4.10.38 — API surface (`getDocument().promise`, `getTextContent`) verified from installed types; worker via `?url` import matching CSP `worker-src 'self' blob:`. |
| 3 | 2026-09-23 | No PDF/DOCX export libraries: only `.md` download, `print`, and copy (approved-dep list has no jspdf/html2canvas). Keeps bundle small and CSP tight. |
| 4 | 2026-09-23 | `npm audit --omit=dev` returns 0 vulnerabilities; the 7 dev-only findings (vitest/vite/esbuild dev-server paths) are out of production scope and noted in SECURITY.md §6 — CI uses `--omit=dev`. |
| 5 | 2026-09-23 | `redact()` lives centrally in `src/core/gemini/errors.ts`; the gemini module bans the `console` global via ESLint. Test fixtures never contain a key-shaped literal — `tests/fakeKey.ts` assembles one at runtime so CI's `git grep 'AIza…'` scan stays meaningful. |
| 6 | 2026-09-23 | Verdicts, severities, rule text, checklist: always from `src/core`; model supplies only `key`/`found`/`writtenValue`/`clauseId`/`quote`. |
| 7 | 2026-09-23 | `compare.ts` treats skipped interview answers as excluded; model findings returning nothing → `not_covered`; unverified quote → `unclear` (never `differs`). |
| 8 | 2026-09-23 | Interview extras comparison uses comma-joined string containment against agreement text (deterministic, no model) — confirmed in compare tests. |
| 9 | 2026-09-23 | Demo mode is default entry; `?demo=1` and `?lang=` validated against enums; sample fixtures flow through the same Zod + verify pipeline. |
| 10 | 2026-09-23 | Clause segmentation: numbered/Clause/letter/roman/ALL-CAPS starts; merged to >=200 chars; split >2000 at sentence boundaries; stable IDs `c001…`. |
| 11 | 2026-09-23 | Key stored in-memory by default; `sessionStorage` only behind opt-in checkbox; every error routed through `redact()`; `Forget key`/`RESET_ALL` always reachable. |
| 12 | 2026-09-23 | One AI call per full report (analysis), on-demand Ask and Negotiation wording, with session budget (default 12) and memoised results. |
| 13 | 2026-09-23 | Build targets `es2022`; initial JS chunk budget <200KB gzip enforced via bundle analysis in Phase 9; parsers/export lazy via dynamic `import()`. |
| 14 | 2026-09-23 | i18n via `t()` PO-less dictionary (`src/i18n/en.ts`, `hi.ts`); all UI strings incl. errors pass through it; Hindi explanations mirrored in prompts. |
| 15 | 2026-09-23 | No CI eval; `npm run eval` is manual (real key, quota cost). CI runs lint+typecheck+coverage+build+e2e+secret grep+audit. |
| 16 | 2026-09-23 | `interview/compare.ts` reached 100% branch by exporting two pure helpers unit-tested directly (`formatDays` reused from `normalise.ts` instead of a duplicate; `worseAmount` covers the `?? 0` null-fallback arms that are unreachable through `compareAnswer` logic). |
| 17 | 2026-09-23 | Git root is the parent folder; the app lives in `rentready/`. CI uses `defaults.run.working-directory: rentready`; Cloudflare Pages root directory is `rentready` (HUMAN_TASKS.md). |
| 18 | 2026-09-23 | `vite preview` reads `public/_headers` (minus HSTS/`upgrade-insecure-requests`, which need HTTPS) so Playwright runs under the production CSP; e2e fails on any CSP violation or page error. Preview uses port 4317 with `reuseExistingServer: false` so another project's server can't be tested by mistake. |
| 19 | 2026-09-23 | vitest-axe 0.1 augments the legacy `Vi` namespace that Vitest 2 ignores; component tests call `axe()` via `tests/axe.ts#expectNoAxeViolations` instead of a custom matcher (no `any` augmentation needed). Colour contrast is checked in Playwright, not jsdom. |
| 20 | 2026-09-23 | App icon is a single SVG (`public/icon.svg`, `sizes: any`) — no PNG binaries in the repo; the duplicate `public/manifest.webmanifest` was removed because vite-plugin-pwa generates it. |
| 21 | 2026-09-23 | Header carries only a compact "Forget key" button (shown once a key exists); the full key panel stays on Upload and Settings. The full panel in the header overflowed 320 px by 186 px. |
