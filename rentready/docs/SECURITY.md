# RentReady – Security & Privacy

RentReady has **no backend**. That removes entire classes of risk (no server to breach, no database to leak, no logs holding tenancy documents) and creates one new question to answer well: **how is the user's own Gemini API key handled?** This document is the answer.

## 1. Principles
1. The app never ships a secret and never holds one at rest.
2. The user's key is theirs: in memory by default, visible to no one else, one tap to forget.
3. The agreement never travels anywhere except directly from the user's browser to Google's Gemini API, over TLS, when the user asks for analysis.
4. Treat everything as hostile: files, agreement text, questions, model output, URL parameters.

## 2. Key handling (BYOK)
| Decision | Rule |
|---|---|
| Storage | In-memory React context by default. `sessionStorage` only if the user ticks "Remember for this tab", with a plain-language warning; never `localStorage`. |
| Transport | Sent only as the `x-goog-api-key` header to `https://generativelanguage.googleapis.com`. Never in a query string, never to any other origin. |
| Display | Masked (`AIza••••••3f`) after entry; "Show" requires a deliberate click. |
| Leakage | Redacted from every error message, log and export by a central `redact()` used in the error path; an ESLint rule forbids `console.log` in `src/core/gemini`. |
| Removal | "Forget key" in the header and in Settings; `RESET_ALL` clears context and `sessionStorage`. |
| Guidance | The key panel links to Google AI Studio, recommends a free-tier key created for this purpose, and explains how to delete it afterwards. |
| No key path | Demo mode gives the full experience with bundled fixtures. |

**Evaluation exception:** for a hosted machine evaluation the owner may set `VITE_EVAL_GEMINI_KEY` in the host's build settings. That key is bundled into public JavaScript, so it must be a throwaway, API-restricted key deleted after the evaluation (HUMAN_TASKS.md §5). It is unset by default and never committed.

**Why this is safe enough:** the key never leaves the user's own browser, and the only party that receives it is the service that issued it. A hosted proxy would instead concentrate every user's document and one shared secret on a server we'd have to secure — a strictly larger attack surface.

## 3. Threat model
| Threat | Impact | Control |
|---|---|---|
| Key exfiltration by injected script | Quota theft | Strict CSP (`script-src 'self'`), no third-party scripts, no analytics, no ad SDKs, lockfile + `npm audit` in CI |
| Key leaking into exports/screenshots | Quota theft | Key masked; never in DOM text, exports, share text or URLs |
| Key persisting on a shared device | Misuse | Memory default; `sessionStorage` opt-in dies with the tab; "Forget key" always visible |
| XSS via agreement or model text | Full compromise | React escaping only; **no `dangerouslySetInnerHTML`** (enforced by ESLint); highlighting done by splitting strings into nodes; no `eval`/`new Function` |
| Prompt injection inside the agreement | Fake findings, rule bypass | `<agreement>` delimiters, "data not instructions" rule, strict JSON schema, code-side verdicts, quote verification, fixed rule text; injection fixture in the test suite |
| Prompt injection via the user's question | Same | Length cap (500 chars), same rules, verification |
| Malicious or huge files | Tab crash | Magic-byte sniffing (`%PDF`, `PK`), 10 MB / 40 pages / 120k chars caps, parse in try/catch, worker isolation for pdf.js |
| Malicious URL parameters | Phishing/state poisoning | Only `?demo=1` and `?lang=` are read, both validated against enums |
| Accidental data retention | Privacy harm | No document ever written to storage; only `prefs` (language, theme, reading level) persist |
| Quota exhaustion by the user's own runaway loop | Cost/lockout | Session request budget (default 12 calls), memoised results, explicit confirmation before re-analysis |
| Supply-chain compromise | Everything | Minimal dependency list, exact lockfile, `npm audit --omit=dev` in CI, Dependabot, no postinstall-heavy packages |
| Clickjacking / embedding | UI redress | `frame-ancestors 'none'`, `X-Frame-Options: DENY` |

## 4. Headers (`public/_headers`, served by Cloudflare Pages)
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; worker-src 'self' blob:; connect-src 'self' https://generativelanguage.googleapis.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Resource-Policy: same-origin
```
`connect-src` lists exactly one external origin — the Gemini endpoint — so even a compromised dependency cannot quietly ship the agreement or key elsewhere. Say this in the pitch; it's a concrete, checkable claim.

## 5. Privacy statement (ship this page)
- We have no server, no account and no database. The app is static files.
- Your agreement is read in your browser. Its text is sent to Google's Gemini API only when you press Analyse, using your own key, and only for that request.
- Your key stays in this tab unless you choose otherwise, and never reaches us.
- We collect no analytics and set no cookies.
- Google may process API requests under its own terms; free-tier usage in particular may be used to improve Google's products, so avoid pasting anything you don't want shared, and redact names and phone numbers if you prefer.
- "Clear everything" removes all traces from this tab immediately.

This mirrors the data-minimisation and purpose-limitation ideas in India's Digital Personal Data Protection Act, 2023, even though a no-server tool of this kind is unlikely to be a data fiduciary.

## 6. Pre-submission checklist
- [x] `git grep -nE "AIza[0-9A-Za-z_-]{20,}"` → nothing (also check fixtures and `.env*` ignored) — CI step; test keys are assembled at runtime
- [x] No `dangerouslySetInnerHTML`, `eval`, `new Function`, `localStorage.setItem` for the key — ESLint bans; key only in memory or opt-in `sessionStorage`
- [ ] CSP present on the deployed site (verified locally under `vite preview` with the same headers; deployed check pending — HUMAN_TASKS.md) (`curl -I`, securityheaders.com); `connect-src` has exactly one external origin
- [x] Key never appears in DOM text, exports, share text or URLs (E2E assertion) — `e2e/key.spec.ts`, `e2e/actions.spec.ts`
- [x] Injection fixture produces no behavioural change — `src/core/injection.test.ts` (unit level)
- [x] Oversized and wrong-type files rejected with friendly errors — `src/core/parsing/intake.test.ts`, `e2e/upload.spec.ts`
- [x] "Forget key" (E2E) and "Clear everything" (component test `AppProvider.test.tsx`) verified
- [x] `npm audit --omit=dev` — 0 vulnerabilities
