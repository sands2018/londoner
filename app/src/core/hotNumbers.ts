/**
 * Hot Number Prediction — Adaptive Dual-Mode
 * ============================================
 * Two strategies run in parallel with paper P&L tracking:
 *
 * LONG (default): 148-window acceleration, Top10, strict seg3>seg2>seg1, burst<4
 * SHORT: DS three-window consensus (37/74/111), Top5 no-ties, half-up trend, burst<4
 *
 * Adaptive switching (every 111-spin paper review):
 *   If short signals >= 5 AND short ROI >= 0 AND short ROI >= long ROI + 20%
 *   → prefer SHORT, fall back to LONG
 *   Otherwise → prefer LONG, fall back to SHORT
 *
 * Signal never decreases — if preferred mode has no pick, use the other.
 *
 * Based on GPT's adaptive research. Baseline: LONG +19.60%, adaptive: +11.98%
 * but saves extreme sessions (user live: -45.73% → +13.83%).
 */
import type { RouletteNumber } from "./roulette";

export type HotNumberMode = "long" | "short";

export interface HotNumberSignal {
  number: RouletteNumber;
  mode: HotNumberMode;
  count148: number;
  seg1: number;
  seg2: number;
  seg3: number;
}

export interface HotNumberRoi {
  signals: number;
  bet: number;
  win: number;
  hits: number;
  roi: number;
}

export interface HotNumberAnalysis {
  activeNumber: HotNumberSignal | null;
  totalRoi: HotNumberRoi;
}

// ---- Shared helpers ----

function countInWindow(numbers: readonly RouletteNumber[], num: number, window: number): number {
  const start = Math.max(0, numbers.length - window);
  let count = 0;
  for (let i = start; i < numbers.length; i++) {
    if (numbers[i] === num) count++;
  }
  return count;
}

function getTopN(numbers: readonly RouletteNumber[], window: number, n: number, ties = false): RouletteNumber[] {
  const start = Math.max(0, numbers.length - window);
  const counts = new Map<RouletteNumber, number>();
  for (let i = start; i < numbers.length; i++) {
    const val = numbers[i];
    if (val === 0) continue;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  if (sorted.length <= n) return sorted.map(([num]) => num);
  if (ties) {
    const cutoff = sorted[n - 1][1];
    return sorted.filter(([, cnt]) => cnt >= cutoff).map(([num]) => num);
  }
  return sorted.slice(0, n).map(([num]) => num);
}

// ---- LONG strategy (148 acceleration) ----

const LONG_WARMUP = 148;
const ACCEL_WINDOW = 148;
const SEG_SIZE = 49;

function selectLong(numbers: readonly RouletteNumber[]): RouletteNumber | null {
  if (numbers.length < LONG_WARMUP) return null;
  const start = numbers.length - ACCEL_WINDOW;
  const top10 = getTopN(numbers, ACCEL_WINDOW, 10);
  let bestNum: RouletteNumber | null = null;
  let bestCount = 0;
  let bestDiff = 0;

  for (const num of top10) {
    let seg1 = 0, seg2 = 0, seg3 = 0;
    for (let i = start; i < start + SEG_SIZE; i++) { if (numbers[i] === num) seg1++; }
    for (let i = start + SEG_SIZE; i < start + SEG_SIZE * 2; i++) { if (numbers[i] === num) seg2++; }
    for (let i = start + SEG_SIZE * 2; i < numbers.length; i++) { if (numbers[i] === num) seg3++; }
    if (!(seg3 > seg2 && seg2 > seg1)) continue;
    if (countInWindow(numbers, num, 20) >= 4) continue;
    const cnt = countInWindow(numbers, num, 74);
    const diff = seg3 - seg1;
    if (cnt > bestCount || (cnt === bestCount && diff > bestDiff)) {
      bestNum = num; bestCount = cnt; bestDiff = diff;
    }
  }
  return bestNum;
}

function longSignalFields(numbers: readonly RouletteNumber[], num: number): Pick<HotNumberSignal, "count148" | "seg1" | "seg2" | "seg3"> {
  const start = numbers.length - ACCEL_WINDOW;
  let seg1 = 0, seg2 = 0, seg3 = 0;
  for (let i = start; i < start + SEG_SIZE; i++) { if (numbers[i] === num) seg1++; }
  for (let i = start + SEG_SIZE; i < start + SEG_SIZE * 2; i++) { if (numbers[i] === num) seg2++; }
  for (let i = start + SEG_SIZE * 2; i < numbers.length; i++) { if (numbers[i] === num) seg3++; }
  return { count148: countInWindow(numbers, num, 148), seg1, seg2, seg3 };
}

// ---- SHORT strategy (DS three-window) ----

const SHORT_WARMUP = 111;

function selectShort(numbers: readonly RouletteNumber[]): RouletteNumber | null {
  if (numbers.length < SHORT_WARMUP) return null;
  const h37 = new Set(getTopN(numbers, 37, 5));
  const h74 = new Set(getTopN(numbers, 74, 5));
  const h111 = new Set(getTopN(numbers, 111, 5));
  const candidates = [...h37].filter(n => h74.has(n) && h111.has(n));
  if (candidates.length === 0) return null;
  // Half-up trend in 37
  const trending = candidates.filter(n => {
    const start = Math.max(0, numbers.length - 37);
    const mid = start + 18;
    let first = 0, second = 0;
    for (let i = start; i < mid; i++) { if (numbers[i] === n) first++; }
    for (let i = mid; i < numbers.length; i++) { if (numbers[i] === n) second++; }
    return second > first;
  });
  if (trending.length === 0) return null;
  // Burst filter
  const filtered = trending.filter(n => countInWindow(numbers, n, 20) < 4);
  if (filtered.length === 0) return null;
  // Pick #1 by 37-spin count
  return filtered.sort((a, b) => countInWindow(numbers, b, 37) - countInWindow(numbers, a, 37))[0];
}

function shortSignalFields(numbers: readonly RouletteNumber[], num: number): Pick<HotNumberSignal, "count148" | "seg1" | "seg2" | "seg3"> {
  return {
    count148: countInWindow(numbers, num, 148),
    seg1: 0, seg2: 0, seg3: 0,
  };
}

// ---- Paper P&L tracking ----

interface PaperRecord {
  net: number; // +35 for hit, -1 for miss
}

function computePaperRoi(paper: PaperRecord[]): number {
  if (paper.length === 0) return -999;
  const net = paper.reduce((s, r) => s + r.net, 0);
  return (net / paper.length) * 100;
}

// ---- Adaptive picker ----

const ADAPTIVE_LOOKBACK = 111;

function selectAdaptive(
  numbers: readonly RouletteNumber[],
): { pick: HotNumberSignal | null; mode: HotNumberMode } {
  const longPick = selectLong(numbers);
  const shortPick = numbers.length >= SHORT_WARMUP ? selectShort(numbers) : null;

  // Compute paper P&L over last ADAPTIVE_LOOKBACK spins
  const longPaper: PaperRecord[] = [];
  const shortPaper: PaperRecord[] = [];

  for (let i = Math.max(LONG_WARMUP, numbers.length - ADAPTIVE_LOOKBACK); i < numbers.length; i++) {
    const history = numbers.slice(0, i);
    const lp = selectLong(history);
    if (lp !== null) {
      longPaper.push({ net: numbers[i] === lp ? 35 : -1 });
    }
    if (i >= SHORT_WARMUP) {
      const sp = selectShort(history);
      if (sp !== null) {
        shortPaper.push({ net: numbers[i] === sp ? 35 : -1 });
      }
    }
  }

  const shortSignals = shortPaper.length;
  const shortRoi = computePaperRoi(shortPaper);
  const longRoi = computePaperRoi(longPaper);

  // Adaptive rule: prefer SHORT if it's clearly better
  const preferShort = shortSignals >= 5
    && shortRoi >= 0
    && shortRoi >= longRoi + 20;

  // Try preferred mode first, fall back to other
  if (preferShort) {
    if (shortPick !== null) {
      return {
        pick: { number: shortPick, mode: "short", ...shortSignalFields(numbers, shortPick) },
        mode: "short",
      };
    }
    if (longPick !== null) {
      return {
        pick: { number: longPick, mode: "long", ...longSignalFields(numbers, longPick) },
        mode: "long",
      };
    }
  } else {
    if (longPick !== null) {
      return {
        pick: { number: longPick, mode: "long", ...longSignalFields(numbers, longPick) },
        mode: "long",
      };
    }
    if (shortPick !== null) {
      return {
        pick: { number: shortPick, mode: "short", ...shortSignalFields(numbers, shortPick) },
        mode: "short",
      };
    }
  }

  return { pick: null, mode: "long" };
}

// ---- ROI computation ----

function computeRoi(
  numbers: readonly RouletteNumber[],
  roiStartIndex: number,
): { signals: number; bet: number; win: number; hits: number } {
  let signals = 0, bet = 0, win = 0, hits = 0;

  for (let i = LONG_WARMUP; i < numbers.length; i++) {
    if (i < roiStartIndex) continue;
    const { pick } = selectAdaptive(numbers.slice(0, i));
    if (pick === null) continue;
    signals++;
    bet += 1;
    if (numbers[i] === pick.number) {
      win += 36;
      hits++;
    }
  }
  return { signals, bet, win, hits };
}

// ---- Public API ----

export function analyzeHotNumbers(
  numbers: readonly RouletteNumber[],
  roiStartIndex = 0,
): HotNumberAnalysis {
  const total = computeRoi(numbers, roiStartIndex);
  const { pick } = numbers.length >= LONG_WARMUP
    ? selectAdaptive(numbers)
    : { pick: null };

  return {
    activeNumber: pick,
    totalRoi: {
      signals: total.signals,
      bet: total.bet,
      win: total.win,
      hits: total.hits,
      roi: total.bet > 0 ? ((total.win - total.bet) / total.bet) * 100 : 0,
    },
  };
}
