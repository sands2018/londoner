# Londoner — Roulette Analysis Tool

Modern rebuild of a roulette statistics and prediction tool. Vite + React 19 + TypeScript SPA deployed to GitHub Pages at `/londoner/`.

## Quick start

```powershell
cd app
npm install
npm run dev        # Vite dev server
npm run build      # tsc + vite build
npm test           # vitest
```

## Project layout

```
app/                 # New React app (the active codebase)
  src/
    core/            # Pure domain logic — no React, no DOM
      roulette.ts     # Number → color/group/row/column mapping
      stats.ts        # Snapshot, col/row distances, column distances, finished longs
      numberText.ts   # Parse/format number strings
      gameStats.ts    # Betting strategy simulation engine
      colRowStats.ts  # Col/row wave stats, summary, explore, compare
      frequencyStats.ts  # Frequency deviation charts
      otherStats.ts   # Long chase, per-number stats, round stats
      prediction.ts   # ML prediction engine (Markov + frequency + Bayesian)
      roulette.test.ts  # Tests for core logic
    storage/
      storage.ts      # StorageAdapter interface
      localStorageAdapter.ts  # localStorage impl with legacy format compat
    ui/
      App.tsx         # Main app component (~2980 lines) + inline sub-components
      styles.css      # All styles — CSS custom properties / design tokens
    main.tsx          # Entry point — font loading, React root, SW registration
  scripts/            # CLI scripts for batch testing & prediction
  public/             # PWA manifest, service worker, icons
legacy/               # Original jQuery+EasyUI static site — behavioral reference
data/                 # Sample data sets and batch results
docs/                 # Design notes (prediction-notes.md)
.github/workflows/    # Deploy to GitHub Pages on push to `codex` branch
```

## Architecture

**Domain layer** (`core/`) is pure TypeScript with zero React dependency. All roulette math lives here:
- `roulette.ts` defines `RouletteNumber` (0–36), color mapping (green/red/black), group/row/column classification matching legacy behavior
- Stats modules take `readonly RouletteNumber[]` and return plain objects/arrays
- `prediction.ts` uses a combined ML model (Markov chain, frequency regression, Bayesian update) with configurable weights and a `PredictionTracker` for accuracy metrics
- `gameStats.ts` simulates betting strategies — configurable bets, rounds, and col/row modes — returns win/loss/balance stats

**Storage layer** (`storage/`) abstracts persistence behind the `StorageAdapter` interface. `LocalStorageAdapter` implements it with backward compatibility for legacy `FILE_INDEX_DATA` format (keys like `F_*`).

**UI layer** (`ui/`) is a single large `App.tsx` component with inline sub-components (`SegmentedStatGroup`, `ColRowDetailView`, `ColRowChartView`, `ColRowSummaryView`, frequency/distance chart components, dialog components). All state lives in the `App` component via `useState`/`useMemo`.

**Design system** (`styles.css`) uses CSS custom properties for all typography, spacing, and color tokens. The token system supports responsive breakpoints: default portrait, `max-width: 390px`, portrait short (`max-height: 820px`), landscape short (`max-height: 560px`), and wide (`min-width: 760px`). Shared tokens cover fonts, weights, dialog titles, buttons, tables, and control sizing.

## Key conventions

- **Legacy is the reference**: `legacy/index.html` defines correct behavior. New UI can be refactored but workflows must stay compatible.
- **Typography**: Use shared CSS tokens from `styles.css`. Never introduce ad-hoc font weights (480/520/560/580) — they render differently on Android vs iPhone. Use only `--weight-regular` (400), `--weight-ui` (500), `--weight-emphasis` (500), `--weight-strong` (500).
- **Viewport height must not switch typography tokens** — Android address bar changes visible height constantly.
- **Button typography**: Always use shared action/control tokens for dialog buttons, data-list buttons, and modal buttons.
- **Cross-platform consistency** is a baseline requirement across iPhone, Android, Chrome, Edge, Firefox, Safari, and PWA.
- **Storage keys** used by `LocalStorageAdapter`: `londoner.currentNumbers`, `londoner.sessions`, plus legacy `FILE_INDEX_DATA` and `F_*` keys.

## UI Layout

The main screen has these sections, top to bottom:
1. **Signal strip** — col/row distance indicators
2. **Columns panel** — six-number column distances (if any active)
3. **Finished line** — recently closed long gaps
4. **Queue panel** — recent number history
5. **Summary grid** — snapshot stats (groups, rows, bisections) with scope selector
6. **Prediction signal area** — cold reversal signals when triggered. Brief and direct: label, rounds since last appearance, chase length, progression. "详情" button opens full prediction view.
7. **Input dock** — keyboard, action buttons. Second row starts with "预测".

Bottom action buttons layout:
- Row 1: SAND brand | 导出 | 导入 | 保存 | 另存 | 数据 | 配置
- Row 2: **预测** | 打法 | 行组 | 频率 | 距离 | 细化 | 其它

The prediction signal area must remain concise — one line per signal, immediate and obvious.

## Key module relationships

- `roulette.ts` is depended on by every other core module
- `colRowStats.ts` produces `rawDistances` consumed by the refine/compare logic
- `prediction.ts` is independent but feeds into `App.tsx` prediction display
- `gameStats.ts` reads/writes its own localStorage keys via legacy format helpers (`readLegacyRows`/`writeLegacyRows`)
- `App.tsx` imports from all core modules and is the sole consumer of the storage adapter
