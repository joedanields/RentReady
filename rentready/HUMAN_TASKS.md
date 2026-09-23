# Human tasks

Things only the project owner can do. Everything else is automated or in the repo.

## 1. Push and confirm CI (Phase 0)
1. `git push -u origin main` from the repository root.
2. GitHub → Actions → **ci** should go green. The workflow lives at `.github/workflows/ci.yml` (repo root) and runs every step inside `rentready/`.

## 2. Cloudflare Pages project (Phase 0 — deploy the shell)
1. Cloudflare dashboard → Workers & Pages → Create → Pages → Connect to Git → pick `RentReady`.
2. Build settings:
   | Setting | Value |
   |---|---|
   | Framework preset | Vite |
   | **Root directory** | `rentready` |
   | Build command | `npm run build` |
   | Output directory | `dist` |
   | Env var | `NODE_VERSION = 20` |
3. Do **not** add any Gemini key or secret. No Functions, no bindings.
4. After the first deploy, verify headers:
   ```bash
   curl -sI https://<project>.pages.dev | grep -iE 'content-security-policy|strict-transport|x-frame|referrer'
   ```
   `connect-src` must list exactly one external origin: `https://generativelanguage.googleapis.com`.
5. Paste the live URL into `README.md` and tell Claude so the Phase 0 deploy box can be ticked.

## 3. Real Gemini key for `npm run eval` (Phase 9)
1. Create a free-tier key at https://aistudio.google.com/apikey — a fresh key used only for this project.
2. Put it in `rentready/.env.local` (gitignored) as `GEMINI_API_KEY=...`. Both "AIza…" and newer "AQ.…" keys work. The default model is `gemini-3.6-flash` (`gemini-2.5-flash` is closed to new users).
   The eval makes 15 calls; the free tier may need a pause (429 quota / 503 busy) — re-run later if a case fails. Per-case misses are printed to help tune.
3. Run `npm run eval` and paste the metrics table into the README.
4. Optional: with the same key, analyse the sample in the app and replace the hand-authored fixtures in `src/sample/sampleData.ts` with the real responses (`npx vitest run src/sample` must stay green). Delete the key in AI Studio afterwards if you like.

## 4. Submission (Phase 10)
- Record the demo video (script in `docs/SUBMISSION.md` §2).
- Publish the blog post (draft will be in `docs/BLOG_DRAFT.md`) and the public post.
- Fill in the submission form: repo URL, live URL, blog, post.

## 5. Optional: a built-in key for a hosted machine evaluation
Anything built into a static site is public: anyone can read this key from the page's JavaScript. Use it only for the evaluation window.
1. Create a **new, throwaway** key in Google AI Studio (not your personal key).
2. Google Cloud Console → APIs & Services → Credentials → the key → **API restrictions**: only *Generative Language API*. Set a low daily quota if your plan allows. Do not add website restrictions (the app sends no referrer, so they would block it).
3. Cloudflare Pages → Settings → Environment variables (Production): `VITE_EVAL_GEMINI_KEY` = the key. Redeploy (it is baked in at build time).
4. After the evaluation: **delete the key in AI Studio**, remove the variable, redeploy.
