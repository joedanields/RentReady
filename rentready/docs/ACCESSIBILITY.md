# RentReady – Accessibility

Target: **WCAG 2.2 AA**, Lighthouse Accessibility ≥ 95, axe 0 serious/critical. For this audience, accessibility also means *comprehension and connectivity*: plain language, Hindi, read-aloud, and an app that still works on one bar of signal.

## 1. Structure
- One `<h1>` per screen; ordered headings; landmarks (`header`, `nav`, `main#main`, `footer`); skip link first in tab order.
- Interview is a real `<form>` per step with `<fieldset>`/`<legend>` for option groups and radio/checkbox inputs, not clickable divs.
- Progress uses `role="progressbar"` with `aria-valuenow/min/max` plus visible "3 of 10".
- Report tabs follow the WAI-ARIA Tabs pattern (roving tabindex, arrow keys, `aria-selected`, `aria-controls`).
- Each finding card is an `<article>` labelled by its heading; agreed/written pairs use a `<dl>` so the relationship is announced.
- Side-by-side original text is a labelled region: "Original text, Clause 4.2, page 2"; highlight uses `<mark>`.

## 2. Keyboard
- Everything reachable and operable; visible focus ring ≥ 2px at ≥ 3:1 contrast; no traps.
- Interview: Enter advances, Backspace/Shift+Tab returns, arrow keys move within option groups.
- Upload has a real file input button; drag-and-drop is an optional extra (WCAG 2.5.7).
- Citation chips move focus to the clause and set `scroll-margin-top` so the sticky header never hides it (2.4.11).
- Dialogs (key panel, clear-everything confirm) trap focus, close on `Esc`, restore focus.

## 3. Dynamic content
- Analysis stages announced in one `aria-live="polite"` region; the region is not re-created between updates.
- Errors in `role="alert"` with a concrete next step.
- Results never steal focus; a "Jump to results" link appears and is announced instead.
- Read-aloud and copy actions confirm with visible + announced feedback.

## 4. Visual and layout
- Text contrast ≥ 4.5:1, UI components ≥ 3:1, in both themes.
- Verdicts (Matches / Differs / Not covered) use icon + word + colour, never colour alone.
- Reflow at 320 px and 200% zoom with no horizontal scrolling; long clause text scrolls inside its own container.
- Targets ≥ 44×44 px with ≥ 8 px spacing.
- `prefers-reduced-motion` disables transitions; `prefers-color-scheme` drives the theme, with a manual override.

## 5. Forms and errors
- Visible `<label>` for every input; hints via `aria-describedby`; errors linked with `aria-describedby` and `aria-invalid`.
- Errors say how to fix: "That file is 14 MB. Please use a file under 10 MB, or paste the text instead."
- Consistent help: "How this works", "Privacy" and "Disclaimer" in the same footer position on every screen (3.2.6).
- No redundant entry: interview answers and preferences persist across tabs and are pre-filled when editing (3.3.7).
- No CAPTCHA anywhere (3.3.8 satisfied by design — there's no backend to protect).

## 6. Comprehension features
- **Reading level:** Simple / Standard, passed into prompts and applied to fixed UI copy too.
- **Hindi:** full UI strings plus model explanations; `lang="hi"` on translated blocks; Devanagari-capable font stack; numbers and clause labels left as in the agreement.
- **Glossary:** tap-to-open definitions for lock-in, leave and licence, notice period, security deposit, stamp duty, registration, inventory — as buttons with popovers, never hover-only.
- **Read aloud:** Web Speech API with `en-IN` / `hi-IN` voices; play, pause, stop, all labelled; hidden when unsupported.
- **Low bandwidth:** PWA precache means the second visit loads instantly, and the interview, rules, checklist and move-in kit work with no network at all.

## 7. Testing
- Automated: `vitest-axe` in component tests, `@axe-core/playwright` on every screen, `eslint-plugin-jsx-a11y` in CI.
- Manual, recorded in the PR: keyboard-only journey; NVDA + Firefox or VoiceOver + Safari through interview → report → ask; 200% zoom; 360 px phone; Hindi pass with a Hindi-reading tester if available.
