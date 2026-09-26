# Sands2018 browser checks

## Home basic statistics intervals

Run `npm run test:home-stats:ui` against the dev server, or set
`HOME_STATS_URL=http://localhost:4175` for a production preview. The runner uses
isolated browser storage and fixed roulette data to check the configuration tab
order (打法 / 区间 / 桌子 / 其它), the two cards moved into 区间, default sequences,
seven editable custom interval fields plus a readonly All field, actual counts,
input validation, cancellation, reload persistence, and desktop/phone layouts.
Custom intervals may contain 0–7 strictly increasing positive integers: empty
fields are allowed only at the end. Checks cover five values plus All, an
All-only home row, restoring all seven fields after reload, rejection of interior
gaps, fallback when the selected interval is removed, and preserving an empty
custom list while switching defaults on and off. Custom home buttons stay left
aligned with a maximum layout width of 56px, including the All-only state;
phone targets remain at least 44px, and crowded rows scroll without overflowing
the page. Long interval labels retain their full values in button titles. It also
checks that each tab saves only its own settings, invalid interval drafts do not
block saving 其它, and changing the global statistics window leaves active custom
home intervals intact. The style
prototype is `ui-test.html?design=home-stats`; screenshots go to `test-results/`.

## Mobile touch controls

Run `npm run test:touch:ui` against the dev server, or set
`TOUCH_URL=http://localhost:4173` for a production preview. `TOUCH_ONLY=small`
(also `android`, `iphone`, `landscape`, `desktop`) limits the viewport sweep.
The checks cover all six games, 44px mobile utility buttons, balance top-up
areas, edge taps, report dialogs, settings options, roulette analysis and its
simulator toolbar. Simulator login is mocked in isolated browser storage and
all shared-data RPC requests are intercepted; no real account is used.
Dense roulette betting targets keep their existing geometry. Narrow chip trays
and simulator toolbars scroll horizontally. The matching style prototype is
`ui-test.html?design=touch`; screenshots go to `test-results/sands/`.

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
