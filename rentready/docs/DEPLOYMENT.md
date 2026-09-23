# RentReady – Deployment (Cloudflare Pages, static only)

There is no backend, so deployment is just static files. No Functions, no KV, no secrets in the dashboard.

## 1. Build settings (Pages → Create project → Connect to Git)
| Setting | Value |
|---|---|
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |
| Environment variable | `NODE_VERSION = 20` |

Optional build-time vars (public, safe): `VITE_DEFAULT_MODEL` (default Gemini Flash model ID), `VITE_APP_VERSION` (commit SHA for the footer). **Never add a Gemini key here** — there is no server to keep it private, and a key in a build var would ship inside the bundle.

## 2. SPA routing and headers
`public/_redirects`:
```
/*  /index.html  200
```
`public/_headers` — see `docs/SECURITY.md` §4 for the full block. Keep `connect-src` limited to `'self' https://generativelanguage.googleapis.com`.

Verify after deploy:
```bash
curl -sI https://<project>.pages.dev | grep -iE 'content-security-policy|strict-transport|x-frame|referrer'
```

## 3. Local development
```bash
npm install
npm run dev              # :5173, starts in Demo mode
npm run build && npm run preview
npx wrangler pages dev dist   # optional: check _headers/_redirects exactly as Pages serves them
```
`.env.local` (gitignored) is only needed for `npm run eval`:
```
GEMINI_API_KEY=your-key-for-eval-only
VITE_DEFAULT_MODEL=gemini-2.5-flash
```
The app itself never reads `GEMINI_API_KEY`; only `scripts/eval.ts` does.

## 4. PWA notes
- `vite-plugin-pwa` in `generateSW` mode; precache the shell, fonts and icons.
- Never cache Gemini responses in the service worker (they're per-user content): set the Gemini origin to `NetworkOnly`.
- Provide an update prompt ("A new version is available — reload") rather than silent activation, so a stale shell doesn't confuse judges.
- Test offline behaviour with DevTools → Network → Offline and in the Playwright offline spec.

## 5. Pre-demo checklist
- [ ] Demo mode works on a fresh browser with no key, on phone and desktop
- [ ] Real key path works: enter key → analyse sample → report in < 20 s
- [ ] Headers present; `connect-src` has exactly one external origin
- [ ] Lighthouse mobile: Performance ≥ 90, Accessibility ≥ 95, Best Practices ≥ 95, PWA installable
- [ ] Offline reload keeps the app usable (interview, rules, kit)
- [ ] `dist/` initial JS under 200 KB gzip (`npx vite-bundle-visualizer` or the build output table)
- [ ] Repo size small: `git count-objects -vH`

## 6. Troubleshooting
| Symptom | Fix |
|---|---|
| 404 on refresh of a sub-route | `_redirects` missing from `public/` |
| pdf.js worker blocked | CSP needs `worker-src 'self' blob:`; import the worker with `?url` |
| Gemini call blocked by CSP | Add the exact origin to `connect-src`; check for a trailing slash |
| Key works in dev, fails in prod | Some keys are referrer-restricted — add the Pages domain in Google AI Studio, or use an unrestricted free-tier key for the demo |
| Stale app after deploy | PWA update prompt; hard-reload; bump `VITE_APP_VERSION` |
