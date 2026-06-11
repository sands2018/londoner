/**
 * Hot Number Prediction — Adaptive Dual-Mode
 * ============================================
 * Two strategies run in parallel with paper P&L tracking:
 *
 * LONG (default): 148-window acceleration, Top10, strict seg3>seg2>seg1, burst<4
 * SHORT: DS three-window consensus (37/74/111), Top5 no-ties, half-up trend, burst<4
 *
 * Adaptive switching (every 90-spin paper review):
 *   If short signals >= 5 AND short ROI >= -40% AND short ROI >= long ROI - 60%
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
  totalRoiFrom201: HotNumberRoi;
}

// ---- Shared helpers ----

function countInWindow(
  numbers: readonly RouletteNumber[],
  num: number,
  window: number,
  end = numbers.length,
): number {
  const start = Math.max(0, end - window);
  let count = 0;
  for (let i = start; i < end; i++) {
    if (numbers[i] === num) count++;
  }
  return count;
}

function getTopN(
  numbers: readonly RouletteNumber[],
  window: number,
  n: number,
  ties = false,
  end = numbers.length,
): RouletteNumber[] {
  const start = Math.max(0, end - window);
  const counts = new Map<RouletteNumber, number>();
  for (let i = start; i < end; i++) {
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

function topNFromCounts(counts: ArrayLike<number>, n: number): RouletteNumber[] {
  const top: RouletteNumber[] = [];
  for (let num = 1; num <= 36; num++) {
    const value = counts[num];
    if (value <= 0) continue;
    let insertAt = top.length;
    for (let index = 0; index < top.length; index++) {
      const current = top[index];
      if (value > counts[current] || (value === counts[current] && num < current)) {
        insertAt = index;
        break;
      }
    }
    top.splice(insertAt, 0, num as RouletteNumber);
    if (top.length > n) top.pop();
  }
  return top;
}

// ---- LONG strategy (148 acceleration) ----

const LONG_WARMUP = 148;
const ACCEL_WINDOW = 148;
const SEG_SIZE = 49;

function selectLong(numbers: readonly RouletteNumber[], end = numbers.length): RouletteNumber | null {
  if (end < LONG_WARMUP) return null;
  const start = end - ACCEL_WINDOW;
  const count148 = new Uint8Array(37);
  const count74 = new Uint8Array(37);
  const count20 = new Uint8Array(37);
  const seg1Counts = new Uint8Array(37);
  const seg2Counts = new Uint8Array(37);
  const seg3Counts = new Uint8Array(37);

  for (let i = start; i < end; i++) {
    const num = numbers[i];
    if (num === 0) continue;
    count148[num]++;
    if (i >= end - 74) count74[num]++;
    if (i >= end - 20) count20[num]++;
    if (i < start + SEG_SIZE) {
      seg1Counts[num]++;
    } else if (i < start + SEG_SIZE * 2) {
      seg2Counts[num]++;
    } else {
      seg3Counts[num]++;
    }
  }

  const top10 = topNFromCounts(count148, 10);
  let bestNum: RouletteNumber | null = null;
  let bestCount = 0;
  let bestDiff = 0;

  for (const num of top10) {
    const seg1 = seg1Counts[num];
    const seg2 = seg2Counts[num];
    const seg3 = seg3Counts[num];
    if (!(seg3 > seg2 && seg2 > seg1)) continue;
    if (count20[num] >= 4) continue;
    const cnt = count74[num];
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

function selectShort(numbers: readonly RouletteNumber[], end = numbers.length): RouletteNumber | null {
  if (end < SHORT_WARMUP) return null;
  const count37 = new Uint8Array(37);
  const count74 = new Uint8Array(37);
  const count111 = new Uint8Array(37);
  const count20 = new Uint8Array(37);
  const firstHalf37 = new Uint8Array(37);
  const secondHalf37 = new Uint8Array(37);
  const start111 = end - 111;
  const start74 = end - 74;
  const start37 = end - 37;
  const mid37 = start37 + 18;

  for (let i = start111; i < end; i++) {
    const num = numbers[i];
    if (num === 0) continue;
    count111[num]++;
    if (i >= start74) count74[num]++;
    if (i >= start37) {
      count37[num]++;
      if (i < mid37) {
        firstHalf37[num]++;
      } else {
        secondHalf37[num]++;
      }
    }
    if (i >= end - 20) count20[num]++;
  }

  const h37 = new Set(topNFromCounts(count37, 5));
  const h74 = new Set(topNFromCounts(count74, 5));
  const h111 = new Set(topNFromCounts(count111, 5));
  const candidates = [...h37].filter(n => h74.has(n) && h111.has(n));
  if (candidates.length === 0) return null;
  // Half-up trend in 37
  const trending = candidates.filter(n => secondHalf37[n] > firstHalf37[n]);
  if (trending.length === 0) return null;
  // Burst filter
  const filtered = trending.filter(n => count20[n] < 4);
  if (filtered.length === 0) return null;
  // Pick #1 by 37-spin count
  return filtered.sort((a, b) => count37[b] - count37[a])[0];
}

function shortSignalFields(numbers: readonly RouletteNumber[], num: number): Pick<HotNumberSignal, "count148" | "seg1" | "seg2" | "seg3"> {
  return {
    count148: countInWindow(numbers, num, 148),
    seg1: 0, seg2: 0, seg3: 0,
  };
}

// ---- Pre-computed historical picks (cache to avoid O(N²) in ROI) ----

const ADAPTIVE_LOOKBACK = 90;
const ADAPTIVE_MIN_SHORT_SIGNALS = 5;
const ADAPTIVE_MIN_SHORT_ROI = -40;
const ADAPTIVE_SHORT_EDGE = -60;

interface CachedPicks {
  longPicks: Array<RouletteNumber | null>;
  shortPicks: Array<RouletteNumber | null>;
}

/**
 * Pre-compute selectLong/selectShort results for every position once.
 * These are pure functions of numbers[0..i], so caching is equivalent to recomputing.
 */
function precomputePicks(numbers: readonly RouletteNumber[]): CachedPicks {
  const n = numbers.length;
  const longPicks: Array<RouletteNumber | null> = new Array(n + 1).fill(null);
  const shortPicks: Array<RouletteNumber | null> = new Array(n + 1).fill(null);

  for (let i = LONG_WARMUP; i <= n; i++) {
    longPicks[i] = selectLong(numbers, i);
  }
  for (let i = SHORT_WARMUP; i <= n; i++) {
    shortPicks[i] = selectShort(numbers, i);
  }

  return { longPicks, shortPicks };
}

/**
 * Determine adaptive pick at a given position using pre-computed strategy picks
 * and a pre-built paper P&L snapshot.
 */
function adaptivePick(
  numbers: readonly RouletteNumber[],
  longPick: RouletteNumber | null,
  shortPick: RouletteNumber | null,
  longCnt: number, longNet: number,
  shortCnt: number, shortNet: number,
): HotNumberSignal | null {
  if (longPick === null && shortPick === null) return null;

  const shortRoi = shortCnt > 0 ? (shortNet / shortCnt) * 100 : -999;
  const longRoi = longCnt > 0 ? (longNet / longCnt) * 100 : -999;

  const preferShort = shortCnt >= ADAPTIVE_MIN_SHORT_SIGNALS
    && shortRoi >= ADAPTIVE_MIN_SHORT_ROI
    && shortRoi >= longRoi + ADAPTIVE_SHORT_EDGE;

  if (preferShort) {
    if (shortPick !== null) {
      return { number: shortPick, mode: "short", ...shortSignalFields(numbers, shortPick) };
    }
    if (longPick !== null) {
      return { number: longPick, mode: "long", ...longSignalFields(numbers, longPick) };
    }
  } else {
    if (longPick !== null) {
      return { number: longPick, mode: "long", ...longSignalFields(numbers, longPick) };
    }
    if (shortPick !== null) {
      return { number: shortPick, mode: "short", ...shortSignalFields(numbers, shortPick) };
    }
  }

  return null;
}

// ---- Public API ----

export function analyzeHotNumbers(
  numbers: readonly RouletteNumber[],
  roiStartIndex = 0,
): HotNumberAnalysis {
  const n = numbers.length;

  if (n < LONG_WARMUP) {
    return {
      activeNumber: null,
      totalRoi: { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 },
      totalRoiFrom201: { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 },
    };
  }

  // Step 1: Pre-compute all historical strategy picks (O(N × WINDOW), once)
  const { longPicks, shortPicks } = precomputePicks(numbers);

  // Step 2: Compute both ROIs in a single pass with incremental paper P&L
  let sigAll = 0, betAll = 0, winAll = 0, hitsAll = 0;
  let sig201 = 0, bet201 = 0, win201 = 0, hits201 = 0;

  // Running paper P&L (sliding ADAPTIVE_LOOKBACK window, pointer-based for O(1) trim)
  let longCnt = 0, longNet = 0;
  let shortCnt = 0, shortNet = 0;
  const longQueue: Array<{ index: number; net: number }> = [];
  const shortQueue: Array<{ index: number; net: number }> = [];
  let longQueueStart = 0;
  let shortQueueStart = 0;

  function pushPaper(longN: number | null, shortN: number | null, outcomeIdx: number) {
    if (longN !== null) {
      const net = numbers[outcomeIdx] === longN ? 35 : -1;
      longQueue.push({ index: outcomeIdx, net });
      longNet += net;
      longCnt++;
    }
    if (shortN !== null && outcomeIdx >= SHORT_WARMUP) {
      const net = numbers[outcomeIdx] === shortN ? 35 : -1;
      shortQueue.push({ index: outcomeIdx, net });
      shortNet += net;
      shortCnt++;
    }
  }

  function trimPaper(minOutcomeIndex: number) {
    while (longQueueStart < longQueue.length && longQueue[longQueueStart].index < minOutcomeIndex) {
      longNet -= longQueue[longQueueStart].net;
      longCnt--;
      longQueueStart++;
    }
    while (shortQueueStart < shortQueue.length && shortQueue[shortQueueStart].index < minOutcomeIndex) {
      shortNet -= shortQueue[shortQueueStart].net;
      shortCnt--;
      shortQueueStart++;
    }
  }

  for (let i = LONG_WARMUP; i < n; i++) {
    if (i > LONG_WARMUP) {
      pushPaper(longPicks[i - 1], shortPicks[i - 1], i - 1);
    }
    trimPaper(Math.max(LONG_WARMUP, i - ADAPTIVE_LOOKBACK));

    const pick = adaptivePick(
      numbers, longPicks[i], shortPicks[i],
      longCnt, longNet, shortCnt, shortNet,
    );
    if (pick !== null) {
      // All-data ROI
      sigAll++; betAll++;
      if (numbers[i] === pick.number) { winAll += 36; hitsAll++; }
      // From-201 ROI
      if (i >= roiStartIndex) {
        sig201++; bet201++;
        if (numbers[i] === pick.number) { win201 += 36; hits201++; }
      }
    }
  }

  // Step 3: Current adaptive pick (at position n, using full paper P&L window)
  pushPaper(longPicks[n - 1], shortPicks[n - 1], n - 1);
  trimPaper(Math.max(LONG_WARMUP, n - ADAPTIVE_LOOKBACK));
  const currentPick = adaptivePick(
    numbers, longPicks[n], shortPicks[n],
    longCnt, longNet, shortCnt, shortNet,
  );

  return {
    activeNumber: currentPick,
    totalRoi: {
      signals: sigAll, bet: betAll, win: winAll, hits: hitsAll,
      roi: betAll > 0 ? ((winAll - betAll) / betAll) * 100 : 0,
    },
    totalRoiFrom201: {
      signals: sig201, bet: bet201, win: win201, hits: hits201,
      roi: bet201 > 0 ? ((win201 - bet201) / bet201) * 100 : 0,
    },
  };
}
