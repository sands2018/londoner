/**
 * Hot Number Prediction - rawSafeOrCool@7 + switch50base + sample-gated close
 * ==========================================================================
 * The hot-number engine keeps LONG/SHORT candidate lists, then:
 * - tries the adaptive LONG/SHORT order first;
 * - skips a raw candidate after seven consecutive paper misses;
 * - falls back to a broader cooling-but-warming candidate when needed;
 * - keeps the original signal timing, but reranks the actual pick by each
 *   candidate's recent paper performance.
 *
 * The UI may optionally wait for one betting-area paper hit before showing
 * real hot-number bets, but the core algorithm does not require that gate.
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

export interface HotNumberSignalEvent {
  position: number;
  signal: HotNumberSignal;
  hit: boolean;
}

export interface HotNumberEnvironmentEvent {
  position: number;
  open: boolean;
}

export interface HotNumberEnvironmentSample {
  position: number;
  signal: HotNumberSignal;
  hit: boolean;
}

export interface HotNumberAnalysis {
  activeNumber: HotNumberSignal | null;
  environmentOpen: boolean;
  paperHitPending: boolean;
  environmentHistory: HotNumberEnvironmentEvent[];
  totalRoi: HotNumberRoi;
  totalRoiFrom201: HotNumberRoi;
  /** Per-signal event log for downstream tier/detail breakdown. */
  events: HotNumberSignalEvent[];
}

export interface HotNumberOptions {
  /** In the betting area, wait for one paper hit before recording real hot-number bets. */
  requirePaperHitAfterRoiStart?: boolean;
  /** Optional filter that decides whether a short-mode paper sample participates in environment gating. */
  environmentSampleFilter?: (sample: HotNumberEnvironmentSample) => boolean;
}

interface HotNumberCandidate extends HotNumberSignal {
  count74: number;
  count37: number;
  count20: number;
  lastGap: number;
  order: number;
}

interface CandidatePaperStats {
  nets: number[];
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

function lastGap(
  numbers: readonly RouletteNumber[],
  num: RouletteNumber,
  end = numbers.length,
): number {
  for (let i = end - 1; i >= 0; i--) {
    if (numbers[i] === num) return end - i;
  }
  return 999;
}

function toSignal(candidate: HotNumberCandidate): HotNumberSignal {
  return {
    number: candidate.number,
    mode: candidate.mode,
    count148: candidate.count148,
    seg1: candidate.seg1,
    seg2: candidate.seg2,
    seg3: candidate.seg3,
  };
}

// ---- LONG strategy (148 acceleration) ----

const LONG_WARMUP = 148;
const ACCEL_WINDOW = 148;
const SEG_SIZE = 49;

function selectLongCandidates(numbers: readonly RouletteNumber[], end = numbers.length): HotNumberCandidate[] {
  if (end < LONG_WARMUP) return [];
  const start = end - ACCEL_WINDOW;
  const count148 = new Uint8Array(37);
  const count74 = new Uint8Array(37);
  const count37 = new Uint8Array(37);
  const count20 = new Uint8Array(37);
  const seg1Counts = new Uint8Array(37);
  const seg2Counts = new Uint8Array(37);
  const seg3Counts = new Uint8Array(37);

  for (let i = start; i < end; i++) {
    const num = numbers[i];
    if (num === 0) continue;
    count148[num]++;
    if (i >= end - 74) count74[num]++;
    if (i >= end - 37) count37[num]++;
    if (i >= end - 20) count20[num]++;
    if (i < start + SEG_SIZE) {
      seg1Counts[num]++;
    } else if (i < start + SEG_SIZE * 2) {
      seg2Counts[num]++;
    } else {
      seg3Counts[num]++;
    }
  }

  return topNFromCounts(count148, 10)
    .map((num, order) => ({ num, order }))
    .filter(({ num }) => seg3Counts[num] > seg2Counts[num] && seg2Counts[num] > seg1Counts[num])
    .filter(({ num }) => count20[num] < 4)
    .map(({ num, order }) => ({
      number: num,
      mode: "long" as const,
      count148: count148[num],
      count74: count74[num],
      count37: count37[num],
      count20: count20[num],
      seg1: seg1Counts[num],
      seg2: seg2Counts[num],
      seg3: seg3Counts[num],
      lastGap: lastGap(numbers, num, end),
      order,
    }))
    .sort((left, right) => (
      right.count74 - left.count74
      || (right.seg3 - right.seg1) - (left.seg3 - left.seg1)
      || left.order - right.order
    ));
}

// ---- SHORT strategy (DS three-window) ----

const SHORT_WARMUP = 111;

function selectShortCandidates(numbers: readonly RouletteNumber[], end = numbers.length): HotNumberCandidate[] {
  if (end < SHORT_WARMUP) return [];
  const count37 = new Uint8Array(37);
  const count74 = new Uint8Array(37);
  const count111 = new Uint8Array(37);
  const count148 = new Uint8Array(37);
  const count20 = new Uint8Array(37);
  const firstHalf37 = new Uint8Array(37);
  const secondHalf37 = new Uint8Array(37);
  const start111 = end - 111;
  const start74 = end - 74;
  const start37 = end - 37;
  const start148 = Math.max(0, end - 148);
  const mid37 = start37 + 18;

  for (let i = start148; i < end; i++) {
    const num = numbers[i];
    if (num === 0) continue;
    count148[num]++;
    if (i >= start111) count111[num]++;
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
  return [...h37]
    .map((num, order) => ({ num, order }))
    .filter(({ num }) => h74.has(num) && h111.has(num))
    .filter(({ num }) => secondHalf37[num] > firstHalf37[num])
    .filter(({ num }) => count20[num] < 4)
    .map(({ num, order }) => ({
      number: num,
      mode: "short" as const,
      count148: count148[num],
      count74: count74[num],
      count37: count37[num],
      count20: count20[num],
      seg1: 0,
      seg2: 0,
      seg3: 0,
      lastGap: lastGap(numbers, num, end),
      order,
    }))
    .sort((left, right) => right.count37 - left.count37 || left.order - right.order);
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
// Continuous hot-environment gate: recent short-mode paper signals, x3 confirmation.
// Confirmation advances only when a fresh short-mode paper sample arrives; stale
// windows must not close or reopen the gate by being counted repeatedly.
const HOT_ENVIRONMENT_WINDOW = 90;
const HOT_ENVIRONMENT_CONFIRM = 3;

function netRoiPercent(nets: readonly number[]): number {
  return nets.length > 0 ? (nets.reduce((sum, net) => sum + net, 0) / nets.length) * 100 : 0;
}

function isHotEnvironmentAllowed(nets: readonly number[]): boolean {
  if (nets.length === 0) return true;

  const overallRoi = netRoiPercent(nets);
  const splitIndex = Math.floor(nets.length / 2);
  const earlyRoi = netRoiPercent(nets.slice(0, splitIndex));
  const lateRoi = netRoiPercent(nets.slice(splitIndex));

  return overallRoi < 0 && lateRoi >= earlyRoi;
}

function updateHotEnvironmentState(
  recentShortNets: readonly number[],
  allowsSignals: boolean,
  allowConfirmCount: number,
  blockConfirmCount: number,
): {
  allowsSignals: boolean;
  allowConfirmCount: number;
  blockConfirmCount: number;
} {
  const shouldAllow = isHotEnvironmentAllowed(recentShortNets);

  if (allowsSignals) {
    const nextBlockConfirmCount = shouldAllow ? 0 : blockConfirmCount + 1;
    if (nextBlockConfirmCount >= HOT_ENVIRONMENT_CONFIRM) {
      return { allowsSignals: false, allowConfirmCount: 0, blockConfirmCount: 0 };
    }
    return {
      allowsSignals: true,
      allowConfirmCount: 0,
      blockConfirmCount: nextBlockConfirmCount,
    };
  }

  const nextAllowConfirmCount = shouldAllow ? allowConfirmCount + 1 : 0;
  if (nextAllowConfirmCount >= HOT_ENVIRONMENT_CONFIRM) {
    return { allowsSignals: true, allowConfirmCount: 0, blockConfirmCount: 0 };
  }

  return {
    allowsSignals: false,
    allowConfirmCount: nextAllowConfirmCount,
    blockConfirmCount: 0,
  };
}

interface CachedCandidates {
  longCandidates: HotNumberCandidate[][];
  shortCandidates: HotNumberCandidate[][];
}

/**
 * Pre-compute selectLong/selectShort candidates for every position once.
 * These are pure functions of numbers[0..i], so caching is equivalent to recomputing.
 */
function precomputeCandidates(numbers: readonly RouletteNumber[]): CachedCandidates {
  const n = numbers.length;
  const longCandidates: HotNumberCandidate[][] = Array.from({ length: n + 1 }, () => []);
  const shortCandidates: HotNumberCandidate[][] = Array.from({ length: n + 1 }, () => []);

  for (let i = LONG_WARMUP; i <= n; i++) {
    longCandidates[i] = selectLongCandidates(numbers, i);
  }
  for (let i = SHORT_WARMUP; i <= n; i++) {
    shortCandidates[i] = selectShortCandidates(numbers, i);
  }

  return { longCandidates, shortCandidates };
}

function shouldPreferShort(
  longCnt: number, longNet: number,
  shortCnt: number, shortNet: number,
): boolean {
  const shortRoi = shortCnt > 0 ? (shortNet / shortCnt) * 100 : -999;
  const longRoi = longCnt > 0 ? (longNet / longCnt) * 100 : -999;

  return shortCnt >= ADAPTIVE_MIN_SHORT_SIGNALS
    && shortRoi >= ADAPTIVE_MIN_SHORT_ROI
    && shortRoi >= longRoi + ADAPTIVE_SHORT_EDGE;
}

function orderedCandidates(
  longCandidates: readonly HotNumberCandidate[],
  shortCandidates: readonly HotNumberCandidate[],
  preferShort: boolean,
): HotNumberCandidate[] {
  return preferShort ? [...shortCandidates, ...longCandidates] : [...longCandidates, ...shortCandidates];
}

const RAW_SAFE_MISS_LIMIT = 7;
const RERANK_PAPER_WINDOW = 50;
const RERANK_MIN_SAMPLES = 8;

function broadCoolCandidate(numbers: readonly RouletteNumber[], end: number): HotNumberCandidate | null {
  let best: RouletteNumber | null = null;
  let bestScore = -Infinity;

  for (let num = 1; num <= 36; num++) {
    const n = num as RouletteNumber;
    const recentHalf = countInWindow(numbers, n, 18, end);
    const priorHalf = countInWindow(numbers, n, 19, end - 18);
    const count20 = countInWindow(numbers, n, 20, end);
    const count37 = recentHalf + priorHalf;
    const count74 = countInWindow(numbers, n, 74, end);
    const count111 = countInWindow(numbers, n, 111, end);
    const gap = lastGap(numbers, n, end);

    if (count37 < 2 || count74 < 3 || count111 < 4 || count20 > 3) continue;
    if (recentHalf <= priorHalf) continue;

    const score = count111 * 30 + count74 * 25 - count20 * 30 + Math.min(gap, 60);
    if (score > bestScore || (score === bestScore && n < (best ?? 37))) {
      best = n;
      bestScore = score;
    }
  }

  if (best === null) return null;

  return {
    number: best,
    mode: "long",
    count148: countInWindow(numbers, best, 148, end),
    count74: countInWindow(numbers, best, 74, end),
    count37: countInWindow(numbers, best, 37, end),
    count20: countInWindow(numbers, best, 20, end),
    seg1: 0,
    seg2: 0,
    seg3: 0,
    lastGap: lastGap(numbers, best, end),
    order: 0,
  };
}

function chooseHotCandidate(
  numbers: readonly RouletteNumber[],
  end: number,
  candidates: readonly HotNumberCandidate[],
  rawMissStreak: ArrayLike<number>,
): HotNumberCandidate | null {
  return candidates.find((candidate) => rawMissStreak[candidate.number] < RAW_SAFE_MISS_LIMIT)
    ?? broadCoolCandidate(numbers, end);
}

function paperStatsScore(stats: CandidatePaperStats): { count: number; roi: number } {
  const nets = stats.nets;
  const net = nets.reduce((sum, value) => sum + value, 0);
  return {
    count: nets.length,
    roi: nets.length > 0 ? (net / nets.length) * 100 : -999,
  };
}

function chooseRerankedHotCandidate(
  numbers: readonly RouletteNumber[],
  end: number,
  candidates: readonly HotNumberCandidate[],
  rawMissStreak: ArrayLike<number>,
  candidatePaperStats: readonly CandidatePaperStats[],
): HotNumberCandidate | null {
  const eligible = candidates.filter((candidate) => rawMissStreak[candidate.number] < RAW_SAFE_MISS_LIMIT);
  const current = eligible[0] ?? null;
  if (current === null) return broadCoolCandidate(numbers, end);
  if (eligible.length <= 1) return current;

  const currentScore = paperStatsScore(candidatePaperStats[current.number]);
  let best = current;
  let bestRoi = currentScore.count >= RERANK_MIN_SAMPLES ? currentScore.roi : -999;

  for (const candidate of eligible) {
    const score = paperStatsScore(candidatePaperStats[candidate.number]);
    if (score.count < RERANK_MIN_SAMPLES) continue;
    if (score.roi > bestRoi || (score.roi === bestRoi && candidate.order < best.order)) {
      best = candidate;
      bestRoi = score.roi;
    }
  }

  return best;
}

function updateCandidatePaperStats(
  stats: CandidatePaperStats[],
  candidates: readonly HotNumberCandidate[],
  outcome: RouletteNumber,
): void {
  const seen = new Set<number>();
  for (const candidate of candidates) {
    if (seen.has(candidate.number)) continue;
    seen.add(candidate.number);
    const nets = stats[candidate.number].nets;
    nets.push(outcome === candidate.number ? 35 : -1);
    if (nets.length > RERANK_PAPER_WINDOW) nets.shift();
  }
}

// ---- Public API ----

export function analyzeHotNumbers(
  numbers: readonly RouletteNumber[],
  roiStartIndex = 0,
  options: HotNumberOptions = {},
): HotNumberAnalysis {
  const n = numbers.length;
  const requirePaperHitAfterRoiStart = options.requirePaperHitAfterRoiStart ?? false;
  const environmentSampleFilter = options.environmentSampleFilter;

  if (n < LONG_WARMUP) {
    return {
      activeNumber: null,
      environmentOpen: true,
      paperHitPending: false,
      environmentHistory: [],
      totalRoi: { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 },
      totalRoiFrom201: { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 },
      events: [],
    };
  }

  // Step 1: Pre-compute all historical strategy picks (O(N × WINDOW), once)
  const { longCandidates, shortCandidates } = precomputeCandidates(numbers);

  // Step 2: Compute both ROIs in a single pass with incremental paper P&L
  let sigAll = 0, betAll = 0, winAll = 0, hitsAll = 0;
  let sig201 = 0, bet201 = 0, win201 = 0, hits201 = 0;
  const events: HotNumberSignalEvent[] = [];
  const environmentHistory: HotNumberEnvironmentEvent[] = [];
  const recentShortEnvironmentNets: number[] = [];
  let environmentAllowsSignals = true;
  let allowConfirmCount = 0;
  let blockConfirmCount = 0;
  let hasPendingEnvironmentSample = false;
  let paperHitConfirmed = !requirePaperHitAfterRoiStart;
  const rawMissStreak = new Uint16Array(37);
  const candidatePaperStats: CandidatePaperStats[] = Array.from({ length: 37 }, () => ({ nets: [] }));

  // Running paper P&L (sliding ADAPTIVE_LOOKBACK window, pointer-based for O(1) trim)
  let longCnt = 0, longNet = 0;
  let shortCnt = 0, shortNet = 0;
  const longQueue: Array<{ index: number; net: number }> = [];
  const shortQueue: Array<{ index: number; net: number }> = [];
  let longQueueStart = 0;
  let shortQueueStart = 0;

  function pushPaper(longN: HotNumberCandidate | null, shortN: HotNumberCandidate | null, outcomeIdx: number) {
    if (longN !== null) {
      const net = numbers[outcomeIdx] === longN.number ? 35 : -1;
      longQueue.push({ index: outcomeIdx, net });
      longNet += net;
      longCnt++;
    }
    if (shortN !== null && outcomeIdx >= SHORT_WARMUP) {
      const net = numbers[outcomeIdx] === shortN.number ? 35 : -1;
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

  function pushShortEnvironmentNet(shortN: HotNumberCandidate | null, outcomeIdx: number) {
    if (shortN === null) return;
    const hit = numbers[outcomeIdx] === shortN.number;
    if (environmentSampleFilter && !environmentSampleFilter({
      position: outcomeIdx,
      signal: toSignal(shortN),
      hit,
    })) {
      return;
    }
    recentShortEnvironmentNets.push(hit ? 35 : -1);
    if (recentShortEnvironmentNets.length > HOT_ENVIRONMENT_WINDOW) {
      recentShortEnvironmentNets.shift();
    }
    hasPendingEnvironmentSample = true;
  }

  for (let i = LONG_WARMUP; i < n; i++) {
    if (i > LONG_WARMUP) {
      pushPaper(longCandidates[i - 1][0] ?? null, shortCandidates[i - 1][0] ?? null, i - 1);
    }
    trimPaper(Math.max(LONG_WARMUP, i - ADAPTIVE_LOOKBACK));

    if (hasPendingEnvironmentSample) {
      const environmentState = updateHotEnvironmentState(
        recentShortEnvironmentNets,
        environmentAllowsSignals,
        allowConfirmCount,
        blockConfirmCount,
      );
      if (environmentState.allowsSignals !== environmentAllowsSignals) {
        environmentHistory.push({ position: i, open: environmentState.allowsSignals });
      }
      environmentAllowsSignals = environmentState.allowsSignals;
      allowConfirmCount = environmentState.allowConfirmCount;
      blockConfirmCount = environmentState.blockConfirmCount;
      hasPendingEnvironmentSample = false;
    }

    const candidates = orderedCandidates(
      longCandidates[i],
      shortCandidates[i],
      shouldPreferShort(longCnt, longNet, shortCnt, shortNet),
    );
    const rawPick = candidates[0] ?? null;
    const basePick = environmentAllowsSignals
      ? chooseHotCandidate(numbers, i, candidates, rawMissStreak)
      : null;
    const pick = environmentAllowsSignals
      ? chooseRerankedHotCandidate(numbers, i, candidates, rawMissStreak, candidatePaperStats)
      : null;
    if (pick !== null) {
      const hit = numbers[i] === pick.number;
      if (i >= roiStartIndex && !paperHitConfirmed) {
        if (basePick !== null && numbers[i] === basePick.number) paperHitConfirmed = true;
      } else {
        // All-data ROI
        sigAll++; betAll++;
        if (hit) { winAll += 36; hitsAll++; }
        // From-201 ROI
        if (i >= roiStartIndex) {
          sig201++; bet201++;
          if (hit) { win201 += 36; hits201++; }
        }
        // Record event for downstream tier analysis
        events.push({ position: i, signal: toSignal(pick), hit });
      }
    }
    if (rawPick !== null) {
      rawMissStreak[rawPick.number] = numbers[i] === rawPick.number ? 0 : rawMissStreak[rawPick.number] + 1;
    }
    updateCandidatePaperStats(candidatePaperStats, candidates, numbers[i]);
    pushShortEnvironmentNet(shortCandidates[i][0] ?? null, i);
  }

  // Step 3: Current adaptive pick (at position n, using full paper P&L window)
  pushPaper(longCandidates[n - 1][0] ?? null, shortCandidates[n - 1][0] ?? null, n - 1);
  trimPaper(Math.max(LONG_WARMUP, n - ADAPTIVE_LOOKBACK));
  if (hasPendingEnvironmentSample) {
    const environmentState = updateHotEnvironmentState(
      recentShortEnvironmentNets,
      environmentAllowsSignals,
      allowConfirmCount,
      blockConfirmCount,
    );
    if (environmentState.allowsSignals !== environmentAllowsSignals) {
      environmentHistory.push({ position: n, open: environmentState.allowsSignals });
    }
    environmentAllowsSignals = environmentState.allowsSignals;
    allowConfirmCount = environmentState.allowConfirmCount;
    blockConfirmCount = environmentState.blockConfirmCount;
    hasPendingEnvironmentSample = false;
  }
  const currentCandidates = orderedCandidates(
    longCandidates[n],
    shortCandidates[n],
    shouldPreferShort(longCnt, longNet, shortCnt, shortNet),
  );
  const rerankedCurrentPick = chooseRerankedHotCandidate(
    numbers,
    n,
    currentCandidates,
    rawMissStreak,
    candidatePaperStats,
  );
  const currentPick = environmentAllowsSignals
    && (n < roiStartIndex || paperHitConfirmed)
    ? rerankedCurrentPick
    : null;

  return {
    activeNumber: currentPick ? toSignal(currentPick) : null,
    environmentOpen: environmentAllowsSignals,
    paperHitPending: requirePaperHitAfterRoiStart && n >= roiStartIndex && !paperHitConfirmed,
    environmentHistory,
    totalRoi: {
      signals: sigAll, bet: betAll, win: winAll, hits: hitsAll,
      roi: betAll > 0 ? ((winAll - betAll) / betAll) * 100 : 0,
    },
    totalRoiFrom201: {
      signals: sig201, bet: bet201, win: win201, hits: hits201,
      roi: bet201 > 0 ? ((win201 - bet201) / bet201) * 100 : 0,
    },
    events,
  };
}
