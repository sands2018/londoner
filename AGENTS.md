# Londoner — Roulette Analysis Tool

> **This file is jointly maintained by DeepSeek and GPT.**
> Both agents read and write to this file as the single source of project memory.
> When updating, keep existing sections intact unless explicitly replacing them.
> Add new information under the relevant heading; create new headings only when needed.

Modern rebuild of a roulette statistics and prediction tool. Vite + React 19 + TypeScript SPA deployed to GitHub Pages at `/londoner/`.

> **Architecture & feature docs**: See `docs/architecture.md` (codebase overview) and `docs/prediction-models.md` (prediction engine details). These files are maintained alongside the code.

## Quick start

```powershell
cd app
npm install
npm run dev        # Vite dev server
npm run build      # tsc + vite build
npm test           # vitest
```

## Project layout

```text
app/                 # New React app (the active codebase)
  src/
    core/            # Pure domain logic - no React, no DOM
      roulette.ts     # Number -> color/group/row/column mapping
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
      App.tsx         # Main app component + inline sub-components
      styles.css      # All styles - CSS custom properties / design tokens
    main.tsx          # Entry point - font loading, React root, SW registration
  scripts/            # CLI scripts for batch testing & prediction
  public/             # PWA manifest, service worker, icons
legacy/               # Original jQuery+EasyUI static site - behavioral reference
HistoryData/          # Historical data snapshots
docs/                 # Architecture, prediction notes, research notes
comms/dialog/         # GPT <-> DeepSeek dialog files
.github/workflows/    # Deploy to GitHub Pages on push to `codex` branch
```

## Architecture

**Domain layer** (`core/`) is pure TypeScript with zero React dependency. All roulette math lives here:

- `roulette.ts` defines `RouletteNumber` (0-36), color mapping (green/red/black), group/row/column classification matching legacy behavior.
- Stats modules take `readonly RouletteNumber[]` and return plain objects/arrays.
- `prediction.ts` uses prediction engines and a `PredictionTracker` for accuracy metrics.
- `gameStats.ts` simulates betting strategies - configurable bets, rounds, and col/row modes - and returns win/loss/balance stats.
- New prediction research should start in scripts/docs first, then move into `core/` only after the rule is stable enough to productize.

**Storage layer** (`storage/`) abstracts persistence behind the `StorageAdapter` interface. `LocalStorageAdapter` implements it with backward compatibility for legacy `FILE_INDEX_DATA` format (keys like `F_*`).

**UI layer** (`ui/`) is a single large `App.tsx` component with inline sub-components. All main UI state lives in `App` via `useState`/`useMemo`. Keep UI-only work in `App.tsx`/`styles.css`; keep roulette math and backtests in `core/` or `scripts/`.

**Design system** (`styles.css`) uses CSS custom properties for typography, spacing, and color tokens. The token system supports responsive breakpoints: default portrait, `max-width: 390px`, portrait short (`max-height: 820px`), landscape short (`max-height: 560px`), and wide (`min-width: 760px`).

## Key conventions

- **UI tuning workflow**: When adding or restyling signal cards, badges, or other visual components, first put the HTML+CSS into `app/public/ui-test.html`. Tune colors, sizes, and layout there until Wayne is satisfied. Only then copy the final styles into `app/src/ui/styles.css` and update `App.tsx` to match — exactly as tuned, no deviation.
- **Encoding safety**: `App.tsx`, `styles.css`, docs, and any file containing Chinese text must remain UTF-8. Do not rewrite whole files with PowerShell `Set-Content`, especially after `Get-Content -Raw`, because it can mojibake Chinese text. Prefer `apply_patch` for edits. If a scripted rewrite is truly necessary, use Node.js `fs.readFileSync/writeFileSync(..., "utf8")` and verify representative Chinese strings plus a build before finishing.
- **Roulette data scopes / 轮盘数据口径**: In real use, the first 200 numbers are often pre-entered past results used only as context. Name this first-200 context area **录号区数据**. Keep explicit scopes in prediction/stat UI and analysis:
  - **全部数据** means every recorded number, including 录号区数据.
  - **押注区数据** means the portion where the user would actually bet, normally starting after the first 200 numbers.
  - Signals may still use 全部数据/录号区数据 as historical context, but ROI should clearly state whether it is 全部数据 ROI or 押注区数据 ROI.
  - Some sessions do not have 200 pre-entered numbers, so features may include an explicit switch to allow showing signals before the 200-number boundary. That switch is for display/observation and must not silently change ROI scope.
- **Legacy is the reference**: `legacy/index.html` defines correct behavior. New UI can be refactored but workflows must stay compatible.
- **Typography**: Use shared CSS tokens from `styles.css`. Never introduce ad-hoc font weights (480/520/560/580) because they render differently on Android vs iPhone. Use only `--weight-regular` (400), `--weight-ui` (500), `--weight-emphasis` (500), `--weight-strong` (500).
- **Viewport height must not switch typography tokens**: Android address bar changes visible height constantly.
- **Button typography**: Always use shared action/control tokens for dialog buttons, data-list buttons, and modal buttons.
- **Cross-platform consistency** is a baseline requirement across iPhone, Android, Chrome, Edge, Firefox, Safari, and PWA.
- **Storage keys** used by `LocalStorageAdapter`: `londoner.currentNumbers`, `londoner.sessions`, plus legacy `FILE_INDEX_DATA` and `F_*` keys.

## UI Layout

The main screen has these sections, top to bottom:

1. **Signal strip** - col/row distance indicators.
2. **Columns panel** - six-number column distances, if any active.
3. **Finished line** - recently closed long gaps.
4. **Queue panel** - recent number history.
5. **Summary grid** - snapshot stats (groups, rows, bisections) with scope selector.
6. **Prediction signal area** - prediction cards when triggered. Keep this concise: one line per signal, immediate and obvious.
7. **Input dock** - keyboard and action buttons.

Bottom action buttons layout:

- Row 1: 传递 | 导出 | 导入 | 保存 | 另存 | 数据 | 快照
- Row 2: 预测 | 打法 | 行组 | 频率 | 距离 | 波浪 | 其它 | 配置

## Current prediction naming

- **124**: The original rhythm-based 124 method. Keep existing state keys such as `londoner.show124` and `predictionTab=rhythm`.
- **新124**: The newer four-tier group-based 124 method. It is currently gated to logged-in user `ww` only.
- **优选号**: Core logic is retained for research/backtesting, but visible UI is currently hidden.
- **长重号 / 短重号**: Single-number repeat methods under the 单号 group.

## Key module relationships

- `roulette.ts` is depended on by every other core module.
- `colRowStats.ts` produces `rawDistances` consumed by the refine/compare logic.
- `prediction.ts` feeds into `App.tsx` prediction display.
- `repeatNumber.ts`, `quality124.ts`, `chaseSix.ts`, and `chaseThree.ts` are pure prediction/stat modules consumed by `App.tsx`.
- `gameStats.ts` reads/writes its own localStorage keys via legacy format helpers (`readLegacyRows`/`writeLegacyRows`).
- `App.tsx` imports from all core modules and is the sole consumer of the storage adapter.

## Research scripts

- Keep exploratory backtests in `scripts/`.
- Prefer deterministic scripts that read `history_data.json` and print all-data, 押注区数据/from-201, recent sessions, max drawdown, and per-tier/per-rule breakdowns.
- Research scripts are useful artifacts, but do not assume they should all be committed. Separate product code from scratch analysis when preparing commits.

## Developer

- **Wayne Wang** is the sole developer and decision-maker for this project.
- All final calls on features, UI, and strategy direction go through Wayne.

## Commit conventions

- Prefix commit messages with agent name: `"DeepSeek - "` or `"GPT - "`.
- Use present tense, describe what the change does.
- End with: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

### ⚠️ CRITICAL: Never auto-commit or auto-push

- **Do NOT run `git commit` or `git push` without Wayne's explicit approval.**
- Wait for Wayne to say "commit", "push", "提交", or "push 一下".
- If you've made changes and think they should be committed, ask Wayne first.
- This applies to BOTH agents (DeepSeek and GPT).

## Project memory

- **This file (`AGENTS.md`) is the single source of project memory for both agents.**
- When Wayne says “项目记忆”, “记一下”, or “写入记忆” → update this file.
- After a restart, both agents should read this file to recover project context.

**Per-agent long-term memory rules:**

| Agent | Long-term memory | Trigger |
|---|---|---|
| GPT (Codex) | Codex long-term memory | Only when Wayne explicitly says “长期记忆” or “Codex 长期记忆” |
| DeepSeek (Claude Code) | `memory/MEMORY.md` → points here | `memory/` directory is read-only pointer; all content lives in AGENTS.md |

- The Claude Code `memory/` directory is **deprecated for content** — it contains only a pointer back to this file.
- If either agent needs to persist information that is NOT project-related (e.g., personal preferences about how to interact with Wayne), use their own long-term memory mechanism.

## Agent dialog channel

- Dialog files: `comms/dialog/gpt.txt` (GPT→DeepSeek) and `comms/dialog/deepseek.txt` (DeepSeek→GPT).
- Every message must include a timestamp header: `[YYYY-MM-DD] AgentName -> OtherAgent`.
- Treat cross-agent feedback as review input, not automatic truth. Verify against code and backtests.
- Shared scratch: `comms/dialog/temp.txt`.

## Current focus

- **Prediction engine**: 124 rhythm, New124 four-tier, cold reversal, chase6/3, hot numbers, repeat/short-repeat.
- **Number zone page**: 37-number popup with distance/circle modes, hot/cold highlighting, trend arrows.
- **Research**: Hot number strategy is still under review. Current GPT-side tentative candidate is the conservative improved hot-number rule: 148-spin window, acceleration trend, Top10 candidate pool, pick Top1, chase 1-2, no overlapping active signal. Latest same-dataset comparison: DS exact rule 2491 signals / +1.16% ROI / max DD 290 / Top3 profit share 43.7%; improved main Top3-pool rule 2793 signals / +24.54% ROI / max DD 482 / Top3 profit share 27.4%; improved conservative Top10-pool rule 4380 signals / +20.48% ROI / max DD 466 / Top3 profit share 20.3%. Tentative decision: prefer the improved conservative version for now, then re-compare after DeepSeek finishes its hot-number work.
- **Research**: Gear rotation for 124 entry timing.
- Active scripts in `scripts/`, research notes in `docs/124-rhythm-research-notes.md`.
