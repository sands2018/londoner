/**
 * Hot Number Prediction — 148-Window Acceleration
 * ================================================
 * Strategy:
 *   1. Top10 hottest numbers in last 148 spins
 *   2. Three-segment acceleration (strictly increasing: seg3 > seg2 > seg1)
 *   3. Not burst (appeared < 4 times in last 20 spins)
 *
 * Pick 1 number, bet 1 unit flat. Warmup: 148 spins.
 *
 * Based on GPT's research, verified against DS three-window on same dataset.
 * GPT 148+burst<4: ROI +19.09%, CV 2.82, 50 sessions, 5683 signals.
 */
import type { RouletteNumber } from "./roulette";

export interface HotNumberSignal {
  number: RouletteNumber;
  count148: number;   // count in 148 spins
  seg1: number;        // first 49-spin segment
  seg2: number;        // second 49-spin segment
  seg3: number;        // third 49-spin segment
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

const WARMUP = 148;
const ACCEL_WINDOW = 148;
const SEG_SIZE = 49; // ~148/3
const TOP_N_POOL = 10;
const BURST_WINDOW = 20;
const BURST_THRESHOLD = 4;

function countInWindow(numbers: readonly RouletteNumber[], num: number, window: number): number {
  const start = Math.max(0, numbers.length - window);
  let count = 0;
  for (let i = start; i < numbers.length; i++) {
    if (numbers[i] === num) count++;
  }
  return count;
}

function isBurst(numbers: readonly RouletteNumber[], num: number): boolean {
  return countInWindow(numbers, num, BURST_WINDOW) >= BURST_THRESHOLD;
}

function getTopN(numbers: readonly RouletteNumber[], window: number, n: number): RouletteNumber[] {
  const start = Math.max(0, numbers.length - window);
  const counts = new Map<RouletteNumber, number>();
  for (let i = start; i < numbers.length; i++) {
    const val = numbers[i];
    if (val === 0) continue;
    counts.set(val, (counts.get(val) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, n)
    .map(([num]) => num);
}

function selectPick(numbers: readonly RouletteNumber[]): HotNumberSignal | null {
  if (numbers.length < WARMUP) return null;

  const start = numbers.length - ACCEL_WINDOW;
  const top10 = getTopN(numbers, ACCEL_WINDOW, TOP_N_POOL);

  let bestNum: RouletteNumber | null = null;
  let bestCount = 0;
  let bestSegs: [number, number, number] = [0, 0, 0];

  for (const num of top10) {
    // Three-segment acceleration: 49+49+50 spins
    let seg1 = 0, seg2 = 0, seg3 = 0;
    for (let i = start; i < start + SEG_SIZE; i++) {
      if (numbers[i] === num) seg1++;
    }
    for (let i = start + SEG_SIZE; i < start + SEG_SIZE * 2; i++) {
      if (numbers[i] === num) seg2++;
    }
    for (let i = start + SEG_SIZE * 2; i < numbers.length; i++) {
      if (numbers[i] === num) seg3++;
    }

    // Strict acceleration: seg3 > seg2 > seg1
    if (!(seg3 > seg2 && seg2 > seg1)) continue;

    // Burst filter
    if (isBurst(numbers, num)) continue;

    // Pick best by 74-spin count
    const cnt = countInWindow(numbers, num, 74);
    const diff = seg3 - seg1;
    if (cnt > bestCount || (cnt === bestCount && diff > (bestSegs[2] - bestSegs[0]))) {
      bestNum = num;
      bestCount = cnt;
      bestSegs = [seg1, seg2, seg3];
    }
  }

  if (bestNum === null) return null;

  return {
    number: bestNum,
    count148: countInWindow(numbers, bestNum, 148),
    seg1: bestSegs[0],
    seg2: bestSegs[1],
    seg3: bestSegs[2],
  };
}

function computeRoi(
  numbers: readonly RouletteNumber[],
  roiStartIndex: number,
): { signals: number; bet: number; win: number; hits: number } {
  let signals = 0, bet = 0, win = 0, hits = 0;

  for (let i = WARMUP; i < numbers.length; i++) {
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

export function analyzeHotNumbers(
  numbers: readonly RouletteNumber[],
  roiStartIndex = 0,
): HotNumberAnalysis {
  const total = computeRoi(numbers, roiStartIndex);
  const pick = numbers.length >= WARMUP ? selectPick(numbers) : null;

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
