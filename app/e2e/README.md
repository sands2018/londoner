# Sands2018 browser checks

## Loading and deployment recovery

After `npm run build`, run `npm run test:loading:ui`. The runner starts its own
local server for the production files and uses isolated browser data. It checks
stalled scripts, missing JS/CSS chunks, cache-bypassing reload, old Service Worker
controllers, retirement-worker updates, and preservation of saved game data and
unrelated caches. The recovery UI is previewed at `ui-test.html?design=loading`.

Only `londoner-shell-*` HTTP caches and this app's worker registration are retired.
Game localStorage and roulette sessions are never cleared by reload recovery.

## Poker

Run `npm run test:poker:ui` against the dev server, or set
`POKER_URL=http://localhost:4173` to check a production preview. Use
`POKER_SMOKE=1` for desktop only, or `POKER_ONLY=landscape` (also `desktop`,
`laptop`, `iphone`, `android`, `small`) for one viewport. These are process
environment variables; in PowerShell, for example, `$env:POKER_SMOKE='1'`.

The poker runner covers six screen sizes, both games, hidden opponent cards,
legal raises, controls locked during dealing, complete settlement, exact reload
resume, paused computer turns in the lobby and background, simulated iPhone
settings, failed storage, reduced motion, reports, and gameplay after the
loaded page goes offline. It does not assert a fresh offline page load: the
app currently disables its service worker. Each context has separate test data.
Screenshots are written to `test-results/sands/`.

Pure rules tests live in `src/core/poker.test.ts` and run with `npm test`.
They include every three-card combination, Hold'em side pots, short all-ins,
raise reopening, odd chips, accounting, persistence, and bot information limits.
See [POKER.md](../POKER.md) for the implemented rules and module boundaries.

## Baccarat

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
