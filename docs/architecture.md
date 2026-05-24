# Londoner — Architecture Overview

## Project Summary

A roulette analysis PWA (Progressive Web App) built with Vite + React 19 + TypeScript. Two prediction engines: cold reversal and rhythm chase, both backed by a shared wave analysis module.

## Directory Structure

```
├── app/                        # Main application (Vite + React + TS)
│   ├── src/
│   │   ├── core/               # Pure domain logic (no React/DOM dependency)
│   │   │   ├── roulette.ts     # Number → color, group, row, column mapping
│   │   │   ├── stats.ts        # Snapshot stats, col/row distances
│   │   │   ├── numberText.ts   # Parse/format number strings
│   │   │   ├── gameStats.ts    # Betting strategy simulation
│   │   │   ├── colRowStats.ts  # Col/row wave stats, summary, charts
│   │   │   ├── frequencyStats.ts # Frequency deviation charts
│   │   │   ├── otherStats.ts   # Long chase, per-number, round stats
│   │   │   ├── prediction.ts   # Prediction engines (cold + rhythm)
│   │   │   ├── wave.ts         # Wave analysis (peak tracking, SMA, recovery)
│   │   │   └── roulette.test.ts
│   │   ├── storage/            # Persistence layer
│   │   │   ├── storage.ts      # StorageAdapter interface
│   │   │   └── localStorageAdapter.ts
│   │   ├── ui/                 # React components
│   │   │   ├── App.tsx         # Main app (~2500 lines)
│   │   │   └── styles.css      # All styles (~2900 lines)
│   │   └── main.tsx            # Entry point, font loading, SW (disabled)
│   ├── scripts/                # Build & test scripts (not in git)
│   └── dist/                   # Build output
├── legacy/                     # Original jQuery+EasyUI static site (reference)
├── data/                       # Test datasets (not in git)
├── docs/                       # Documentation
│   ├── architecture.md         # This file
│   ├── prediction-models.md    # Prediction feature details
│   └── prediction-notes.md     # Early prediction design notes
└── CLAUDE.md                   # AI assistant project brief
```

## Core Layer (`src/core/`)

**Design principle**: Pure TypeScript, zero React/DOM imports. All functions take immutable data and return plain objects. Testable in isolation.

### `roulette.ts` — Foundation

Exports the domain types and mappings everything depends on:

- `RouletteNumber` = 0-36
- `NumberColor` = "green" | "red" | "black"
- `ColRowIndex` = 0|1|2|3|4|5 (三组 + 三行)
- `getNumberColRows(value)` → ColRowIndex[] (which group + row)
- `getGroupIndex(value)` → 0|1|2|null
- `getRowIndex(value)` → 0|1|2|null
- `getNumberColor(value)` → NumberColor
- `getColumnIndexes(value)` → six-number column windows

### `wave.ts` — Wave Analysis (shared prediction foundation)

Independent module for tracking gap distribution peak trends over time. Used by both prediction engines. Exports:

- `extractGaps(numbers, ci)` — gap sequence for a col/row
- `computePeakStats(gaps)` → `{ peak, conc, zoneLen, sma }` — current rhythm snapshot
- `computePeakSma(gaps)` — moving average of recent peak k values (wave indicator)
- `checkWaveRecovery(state, gaps, round)` — wave-based recovery state machine
- `WaveRecoveryState` type — `{ paused, failSma, failRound, phase }`

### `prediction.ts` — Prediction Engines

Two engines, both using `wave.ts` for gap analysis:

**ColdReversalEngine**: Extreme-gap reversion strategy. Exports `ColdSignal` type.

**RhythmEngine**: Peak-following rhythm strategy. Exports `RhythmSignal` type.

Also exports ROI computation functions: `computeRoi()`, `computeRhythmRoi()`.

Full details in `docs/prediction-models.md`.

### Other Core Modules

- `stats.ts`: Snapshot statistics (group/row counts, bisection ratios), col/row distances, column distances, finished longs. All take `numbers[]` and return typed records.
- `numberText.ts`: `parseNumbersText(str)` → `{ numbers, invalidTokens }`, `formatNumbers(arr)` → string. Handles mixed delimiters.
- `gameStats.ts`: Betting strategy simulator. Configurable bets, rounds, col/row modes. Persists config in localStorage with legacy format compatibility.
- `colRowStats.ts`: Col/row wave detail stats, summary tables, explore/compare. Data structures: `ColRowWave`, `ColRowStats`.
- `frequencyStats.ts`: Frequency deviation over multiple scopes. Used by frequency charts.
- `otherStats.ts`: Long-chase stats, per-number distance/frequency, round-bet/summary stats.

## Storage Layer (`src/storage/`)

- `StorageAdapter` interface: async methods for current numbers, session CRUD
- `LocalStorageAdapter`: implements interface with legacy `FILE_INDEX_DATA` format compatibility for data migration

## UI Layer (`src/ui/`)

### `App.tsx`

Single large component (~2500 lines) containing all app state and layout:

**State**: All managed via `useState` at the App level. No external state management.

**Layout** (top to bottom):
1. Signal strip — col/row distances
2. Columns panel — six-number column distances
3. Finished line — recently closed longs
4. Queue panel — recent numbers
5. Summary grid — snapshot stats with scope selector
6. Prediction signal area — cold + rhythm signals
7. Input dock — keyboard + action buttons

**Sub-components** (defined as functions in same file):
- `SegmentedStatGroup`, `SortMark` — shared display helpers
- `NumberButton` — keyboard key
- `ColRowDetailView`, `ColRowChartView`, `ColRowSummaryView` — col/row stats
- `FrequencyOverviewChart`, `FrequencyDetailChart` — frequency SVG charts
- `DistanceOverviewChart`, `DistanceSingleChart` — distance SVG charts
- `MessageDialog` — modal dialogs (notice, confirm, prompt)

**Prediction integration**: Both engines run via `useMemo`. Signal display derived from engine output + wave recovery state. Detail modals for each strategy.

### `styles.css`

CSS custom properties for all design tokens. Responsive with media queries for:
- Portrait (default)
- Portrait short (max-height: 820px)
- Landscape short (max-height: 560px)
- Wide (min-width: 760px)
- Small screen (max-width: 390px)

Android platform adjustments via `.android` class (zoom 0.92, font-weight tweaks).

### `main.tsx`

Entry point: font loading (Roboto + Noto Sans SC), React root render, Service Worker disabled during development.

## Data Flow

```
User input (keyboard/import)
  → numbers state (RouletteNumber[])
  → core functions compute stats synchronously
  → useMemo triggers re-computation
  → React re-renders UI
  → signalDisplay derived from engines + wave recovery
  → Prediction signal area + detail modals
```

## Coding Conventions

- **Pure functions in core/**: No side effects, no React, no DOM
- **Immutable data**: Functions take `readonly T[]`, return new objects
- **Type-driven**: All interfaces exported, ColRowIndex used throughout
- **Chinese UI text**: Inline in JSX, no i18n abstraction
- **CSS tokens**: Use `var(--token-name)` for all design values. Never ad-hoc font weights (no 480/520/560/580)
- **No comments unless WHY is non-obvious**: Code should be self-documenting
- **File size**: App.tsx and styles.css are large — prefer editing existing patterns over adding new files

## Key Files for AI Assistants

- `CLAUDE.md` — Project brief (this file's summary)
- `docs/architecture.md` — This file
- `docs/prediction-models.md` — Prediction feature details  
- `app/src/core/wave.ts` — Reusable wave analysis module
- `app/src/core/prediction.ts` — Both prediction engines
