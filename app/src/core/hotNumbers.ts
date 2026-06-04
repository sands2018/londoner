/**
 * Hot Number Prediction — Single Pick
 * =====================================
 * Strategy: pick the #1 number that is:
 *   1. Hot in 1圈/2圈/3圈 simultaneously (triple consensus)
 *   2. Trending up within 1圈 (2nd half > 1st half)
 *   3. Not burst (appeared < 4 times in last 20 spins)
 *
 * Pick 1 number, bet 1 unit flat.
 */
import type { RouletteNumber } from "./roulette";

export interface HotNumberSignal {
  number: RouletteNumber;
  count1: number;    // count in 1圈 (37 spins)
  count2: number;    // count in 2圈 (74 spins)
  count3: number;    // count in 3圈 (111 spins)
  trendDiff: number;  // 2nd half - 1st half in 1圈
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

function countInWindow(numbers: readonly RouletteNumber[], num: number, window: number): number {
  const start = Math.max(0, numbers.length - window);
  let count = 0;
  for (let i = start; i < numbers.length; i++) {
    if (numbers[i] === num) count++;
  }
  return count;
}

function isTrendingUp(numbers: readonly RouletteNumber[], num: number, window: number): number {
  const start = Math.max(0, numbers.length - window);
  const mid = start + Math.floor(window / 2);
  let first = 0, second = 0;
  for (let i = start; i < mid; i++) { if (numbers[i] === num) first++; }
  for (let i = mid; i < numbers.length; i++) { if (numbers[i] === num) second++; }
  return second - first;
}

function isBurst(numbers: readonly RouletteNumber[], num: number, window: number, threshold: number): boolean {
  return countInWindow(numbers, num, window) >= threshold;
}

// Track ROI: walk through history spin by spin
function computeRoi(
  numbers: readonly RouletteNumber[],
  roiStartIndex: number,
): { signals: number; bet: number; win: number; hits: number } {
  let signals = 0, bet = 0, win = 0, hits = 0;

  for (let i = 50; i < numbers.length; i++) {
    if (i < roiStartIndex) continue;
    const pick = selectPick(numbers.slice(0, i));
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

function selectPick(recentNumbers: readonly RouletteNumber[]): { number: RouletteNumber; count1: number; count2: number; count3: number; trendDiff: number } | null {
  if (recentNumbers.length < 50) return null;

  // Get top candidates from each window
  const getTopN = (window: number, n: number): Set<RouletteNumber> => {
    const start = Math.max(0, recentNumbers.length - window);
    const counts = new Map<RouletteNumber, number>();
    for (let i = start; i < recentNumbers.length; i++) {
      const n = recentNumbers[i];
      if (n === 0) continue;
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
    if (sorted.length <= n) return new Set(sorted.map(([num]) => num));
    const cutoff = sorted[n - 1][1];
    return new Set(sorted.filter(([, cnt]) => cnt >= cutoff).map(([num]) => num));
  };

  const hot37 = getTopN(37, 3);
  const hot74 = getTopN(74, 3);
  const hot111 = getTopN(111, 3);

  // Triple consensus
  const consensus = new Set([...hot37].filter(n => hot74.has(n) && hot111.has(n)));
  if (consensus.size === 0) return null;

  // Filter trending up
  const trending = new Set([...consensus].filter(n => isTrendingUp(recentNumbers, n, 37) > 0));
  if (trending.size === 0) return null;

  // Filter burst: < 4 in last 20
  const candidates = [...trending].filter(n => !isBurst(recentNumbers, n, 20, 4));
  if (candidates.length === 0) return null;

  // Pick #1 by 1圈 count
  candidates.sort((a, b) => countInWindow(recentNumbers, b, 37) - countInWindow(recentNumbers, a, 37));
  const best = candidates[0];

  return {
    number: best,
    count1: countInWindow(recentNumbers, best, 37),
    count2: countInWindow(recentNumbers, best, 74),
    count3: countInWindow(recentNumbers, best, 111),
    trendDiff: isTrendingUp(recentNumbers, best, 37),
  };
}

export function analyzeHotNumbers(
  numbers: readonly RouletteNumber[],
  roiStartIndex = 0,
): HotNumberAnalysis {
  const total = computeRoi(numbers, roiStartIndex);
  const pick = numbers.length >= 50 ? selectPick(numbers) : null;

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
