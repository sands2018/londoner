# Baccarat browser checks

From `app/`, start `npm run dev`, then run `npm run test:baccarat:ui` in a second
terminal. Install Chromium once with `npx playwright install chromium` if needed.
The runner also detects the local `.playwright-browsers/` cache.

To verify a production build, run `npm run build` and `npm run preview`, then set
`BAC_URL=http://localhost:4173` before running the same checks. Each test uses a
separate browser context; it does not read or replace your browser's saved game.

Coverage includes six desktop/phone viewport sizes, portrait and landscape,
bet limits, payouts, reports, reload during animation, full-shoe road history,
dragon tails, minimal horizontal scrolling, preserved manual scrolling, scaled
desktop layout, card-by-card playback at both speeds, reduced motion, and
background settlement. Screenshots are written to `test-results/sands/`.

The complete round is persisted before playback. Slow playback takes about
6–9 seconds for four to six cards, including the result pause; fast playback
takes about 4–6 seconds. Betting stays locked until presentation finishes.
