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
├── AGENTS.md                   # Canonical AI assistant project brief
└── CLAUDE.md                   # Compatibility pointer to AGENTS.md
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

### State Architecture & Undo/Redo

**Critical design rule**: All prediction-related state MUST be derived from `numbers`, never stored independently. This ensures undo/redo works correctly.

- `numbers` is the single source of truth — a `RouletteNumber[]` in React state
- `undo()` removes the last number, `redo()` restores it
- All derived data (predictions, signals, ROI, paused state, chase display) is computed via `useMemo` with `numbers` in the dependency array
- There is NO separate state for active chases, signal history, or pause tracking — everything is recomputed from `numbers` on every render
- The `rhythmPausedCis` hook replays the entire session history to determine which col/rows are currently paused (wave recovery state)
- `signalDisplay` replays engine analysis at each historical step to determine when each signal first fired and what chase round it's on

**When adding new features**: Never introduce separate state for prediction data. Always compute from `numbers` in a `useMemo`. This guarantees undo/redo consistency with zero additional code.

### `styles.css`

CSS custom properties for all design tokens. Responsive with media queries for:
- Portrait (default)
- Portrait short (max-height: 820px)
- Landscape short (max-height: 560px)
- Wide (min-width: 760px)
- Small screen (max-width: 390px)

Android platform adjustments via `.android` class (zoom 0.92, font-weight tweaks).

### Standard Tab Pattern

Two visual schemes for all tab bars. Top-position tabs use the top scheme, bottom-position tabs use the bottom scheme.

**Bottom tabs** — positioned at the bottom of the content area, selected tab connects upward:
- *Gap-line variant*: Container `background: #cfc5b3`, buttons sit with 1px gaps that reveal the background as visible lines. Selected tab has white top border covering the line behind it.
- *Clean variant*: Container `background: transparent; border-bottom: 1px solid #cfc5b3`. Unselected tabs have no visible borders. Selected tab has white bg with left/top/right borders, white bottom border covering the container line.
- Both: `align-items: start`, `border-radius: 0 0 7px 7px` (rounded bottom)

**Top tabs** — positioned at the top of the content area, selected tab connects downward:
- Container `background: transparent; border-top: 1px solid #cfc5b3` (for clean) or `background: #cfc5b3` (for gap-line)
- `align-items: end`, `border-radius: 7px 7px 0 0` (rounded top)
- Selected tab uses `border-bottom`, `margin-bottom: -1px` — the vertical inverse of bottom tabs

Shared: unselected `background: #e8e2d6`, selected `background: #fffdf9`, selected `color: #5a4020`, border color `#cfc5b3`, 1px button gaps, 7px corner radius. Selected tab always has `z-index: 1` and subtle `box-shadow`.

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

- `AGENTS.md` — Canonical project brief for AI assistants
- `CLAUDE.md` — Compatibility pointer to `AGENTS.md`; memory updates belong in `AGENTS.md`
- `docs/architecture.md` — This file
- `docs/prediction-models.md` — Prediction feature details  
- `app/src/core/wave.ts` — Reusable wave analysis module
- `app/src/core/prediction.ts` — Both prediction engines
