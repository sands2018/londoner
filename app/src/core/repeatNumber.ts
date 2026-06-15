import type { RouletteNumber } from "./roulette";

export const REPEAT_RECENT_SCOPE = 37;
export const REPEAT_PREMIUM_COUNT = 3;
export const REPEAT_PAY = 36;
export const REPEAT_INITIAL_ROUNDS = 200;
export const REPEAT_ENV_WINDOW = 200;
export const SHORT_REPEAT_ENV_WINDOW = 100;
export const SHORT_REPEAT_GAP_MIN = 2;
export const SHORT_REPEAT_GAP_MAX = 3;
export const SHORT_REPEAT_CHASE_LEN = 2;
export const REPEAT_TIER_CORE = "核心信号";
export const REPEAT_TIER_AGGRESSIVE = "进取信号";

export type RepeatTier = typeof REPEAT_TIER_CORE | typeof REPEAT_TIER_AGGRESSIVE;

export interface RepeatNumberSignal {
  number: RouletteNumber;
  prevGap: number;
  recentCount: number;
  betAmt: number;
  isPremium: boolean;
  tier: RepeatTier;
}

export interface RepeatNumberRoi {
  signals: number;
  bet: number;
  win: number;
  hits: number;
  roi: number;
}

export interface ShortRepeatSignal extends RepeatNumberSignal {
  round: number;
  isNew: boolean;
  chaseLen: number;
}

export interface RepeatNumberAnalysis {
  activeSignals: RepeatNumberSignal[];
  coreRoi: RepeatNumberRoi;
  aggressiveRoi: RepeatNumberRoi;
  environmentFilter: RepeatEnvironmentFilter;
}

export interface ShortRepeatAnalysis {
  activeSignals: ShortRepeatSignal[];
  totalRoi: RepeatNumberRoi;
  coreRoi: RepeatNumberRoi;
  aggressiveRoi: RepeatNumberRoi;
  environmentFilter: RepeatEnvironmentFilter;
}

export interface RepeatEnvironmentFilter {
  g2Count: number;
  g3Count: number;
  passed: boolean;
  ready: boolean;
}

interface RepeatAnalyzeOptions {
  tier?: RepeatTier;
  requireInitialFilter?: boolean;
  allowPreInitialSignals?: boolean;
}

export function analyzeRepeatNumber(
  numbers: readonly RouletteNumber[],
  startRound = 0,
  options: RepeatAnalyzeOptions = {},
): RepeatNumberAnalysis {
  const environmentFilter = getEnvironmentFilter(numbers, REPEAT_ENV_WINDOW);
  const tier = options.tier ?? REPEAT_TIER_AGGRESSIVE;
  const coreRoi = computeRoi(numbers, startRound, (signal) => signal.tier === REPEAT_TIER_CORE, options, REPEAT_ENV_WINDOW);
  const aggressiveRoi = computeRoi(numbers, startRound, () => true, options, REPEAT_ENV_WINDOW);
  return {
    activeSignals: getActiveSignals(numbers, tier, options),
    coreRoi,
    aggressiveRoi,
    environmentFilter,
  };
}

export function analyzeShortRepeatNumber(
  numbers: readonly RouletteNumber[],
  startRound = 0,
  options: RepeatAnalyzeOptions = {},
): ShortRepeatAnalysis {
  const environmentFilter = getEnvironmentFilter(numbers, SHORT_REPEAT_ENV_WINDOW);
  const replay = replayShortRepeat(numbers, startRound, REPEAT_TIER_CORE, options);
  return {
    activeSignals: replay.activeSignals,
    totalRoi: replay.roi,
    coreRoi: replay.roi,
    aggressiveRoi: replay.roi,
    environmentFilter,
  };
}

function getActiveSignals(
  numbers: readonly RouletteNumber[],
  tier: RepeatTier,
  options: RepeatAnalyzeOptions,
): RepeatNumberSignal[] {
  if (numbers.length === 0) return [];
  if (!canUseRepeatAt(numbers, numbers.length - 1, options, REPEAT_ENV_WINDOW)) return [];

  const signal = getRepeatSignalAt(numbers, numbers.length - 1);
  if (!signal || !signalMatchesTier(signal, tier)) return [];
  return [signal];
}

function getRepeatSignalAt(numbers: readonly RouletteNumber[], index: number): RepeatNumberSignal | null {
  const value = numbers[index];
  let previousIndex = -1;

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (numbers[cursor] === value) {
      previousIndex = cursor;
      break;
    }
  }

  if (previousIndex < 0) return null;

  const prevGap = index - previousIndex - 1;
  const recentCount = countRecent(numbers, index, value);
  if (recentCount < REPEAT_PREMIUM_COUNT) return null;

  const shortEnvironmentCount = countShortRepeatEnvironment(numbers, index);
  if (shortEnvironmentCount <= 0) return null;

  const isCore = prevGap >= 9 && prevGap <= 10;
  const isAggressiveExtra =
    (prevGap === 8 || prevGap === 11 || prevGap === 12) &&
    shortEnvironmentCount >= 1 &&
    shortEnvironmentCount <= 2;

  if (!isCore && !isAggressiveExtra) return null;

  return {
    number: value,
    prevGap,
    recentCount,
    betAmt: 1,
    isPremium: isCore,
    tier: isCore ? REPEAT_TIER_CORE : REPEAT_TIER_AGGRESSIVE,
  };
}

function computeRoi(
  numbers: readonly RouletteNumber[],
  startRound = 0,
  filter: (signal: RepeatNumberSignal) => boolean = () => true,
  options: RepeatAnalyzeOptions = {},
  environmentWindow = REPEAT_ENV_WINDOW,
): RepeatNumberRoi {
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;

  for (let index = 0; index < numbers.length - 1; index += 1) {
    if (index < startRound) continue;
    if (!canUseRepeatAt(numbers, index, options, environmentWindow)) continue;
    const signal = getRepeatSignalAt(numbers, index);
    if (!signal || !filter(signal)) continue;

    signals += 1;
    bet += signal.betAmt;
    if (numbers[index + 1] === signal.number) {
      win += signal.betAmt * REPEAT_PAY;
      hits += 1;
    }
  }

  const roi = bet > 0 ? ((win - bet) / bet) * 100 : 0;
  return { signals, bet, win, hits, roi };
}

function getShortRepeatSignalAt(numbers: readonly RouletteNumber[], index: number): RepeatNumberSignal | null {
  const value = numbers[index];
  let previousIndex = -1;

  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (numbers[cursor] === value) {
      previousIndex = cursor;
      break;
    }
  }

  if (previousIndex < 0) return null;

  const prevGap = index - previousIndex - 1;
  if (prevGap < SHORT_REPEAT_GAP_MIN || prevGap > SHORT_REPEAT_GAP_MAX) return null;

  const recentCount = countRecent(numbers, index, value);
  if (recentCount < REPEAT_PREMIUM_COUNT) return null;

  return {
    number: value,
    prevGap,
    recentCount,
    betAmt: 1,
    isPremium: prevGap === 3,
    tier: prevGap === 3 ? REPEAT_TIER_CORE : REPEAT_TIER_AGGRESSIVE,
  };
}

function countShortRepeatEnvironment(numbers: readonly RouletteNumber[], index: number): number {
  const scopeStart = Math.max(0, index - REPEAT_RECENT_SCOPE);
  let count = 0;
  for (let cursor = scopeStart; cursor < index; cursor += 1) {
    if (getShortRepeatSignalAt(numbers, cursor)) count += 1;
  }
  return count;
}

function countRecent(numbers: readonly RouletteNumber[], index: number, value: RouletteNumber): number {
  const scopeStart = Math.max(0, index - REPEAT_RECENT_SCOPE + 1);
  let recentCount = 0;
  for (let cursor = scopeStart; cursor <= index; cursor += 1) {
    if (numbers[cursor] === value) recentCount += 1;
  }
  return recentCount;
}

function replayShortRepeat(
  numbers: readonly RouletteNumber[],
  startRound = 0,
  tier: RepeatTier,
  options: RepeatAnalyzeOptions,
): { activeSignals: ShortRepeatSignal[]; roi: RepeatNumberRoi } {
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;
  const activeChases: Array<RepeatNumberSignal & { startRound: number }> = [];

  for (let index = 0; index < numbers.length; index += 1) {
    const value = numbers[index];
    const surviving: typeof activeChases = [];
    const allowBet = canUseRepeatAt(numbers, index - 1, options, SHORT_REPEAT_ENV_WINDOW);

    for (const chase of activeChases) {
      const roundIndex = index - chase.startRound;
      if (roundIndex >= SHORT_REPEAT_CHASE_LEN) continue;

      if (!allowBet) continue;

      if (index >= startRound) bet += chase.betAmt;

      if (value === chase.number) {
        if (index >= startRound) {
          win += chase.betAmt * REPEAT_PAY;
          hits += 1;
        }
        continue;
      }

      if (roundIndex + 1 < SHORT_REPEAT_CHASE_LEN) surviving.push(chase);
    }

    activeChases.length = 0;
    activeChases.push(...surviving);

    const allowSignal = canUseRepeatAt(numbers, index, options, SHORT_REPEAT_ENV_WINDOW);
    if (!allowSignal) continue;

    const signal = getShortRepeatSignalAt(numbers, index);
    if (!signal || signal.prevGap !== 3 || !signalMatchesTier(signal, tier)) continue;

    if (index < numbers.length - 1 && index + SHORT_REPEAT_CHASE_LEN >= startRound) signals += 1;
    activeChases.push({ ...signal, startRound: index + 1 });
  }

  const activeSignals: ShortRepeatSignal[] = canUseRepeatAt(numbers, numbers.length - 1, options, SHORT_REPEAT_ENV_WINDOW) ? activeChases
    .map((chase) => {
      const roundsPlayed = Math.max(0, numbers.length - chase.startRound);
      const round = roundsPlayed + 1;
      if (round > SHORT_REPEAT_CHASE_LEN) return null;
      return {
        number: chase.number,
        prevGap: chase.prevGap,
        recentCount: chase.recentCount,
        betAmt: chase.betAmt,
        isPremium: chase.isPremium,
        tier: chase.tier,
        round,
        isNew: round === 1,
        chaseLen: SHORT_REPEAT_CHASE_LEN,
      };
    })
    .filter((signal): signal is ShortRepeatSignal => signal !== null) : [];

  const roi = bet > 0 ? ((win - bet) / bet) * 100 : 0;
  return { activeSignals, roi: { signals, bet, win, hits, roi } };
}

function signalMatchesTier(signal: RepeatNumberSignal, tier: RepeatTier): boolean {
  return tier === REPEAT_TIER_AGGRESSIVE || signal.tier === REPEAT_TIER_CORE;
}

export function getEnvironmentFilter(
  numbers: readonly RouletteNumber[],
  windowSize = REPEAT_ENV_WINDOW,
  endIndex = numbers.length - 1,
): RepeatEnvironmentFilter {
  let g2Count = 0;
  let g3Count = 0;
  const safeEnd = Math.min(Math.max(0, endIndex), numbers.length - 1);
  const start = Math.max(0, safeEnd - windowSize + 1);

  for (let index = start; index <= safeEnd; index += 1) {
    const signal = getShortRepeatSignalAt(numbers, index);
    if (!signal) continue;
    if (signal.prevGap === 2) g2Count += 1;
    if (signal.prevGap === 3) g3Count += 1;
  }

  return {
    g2Count,
    g3Count,
    passed: g3Count > g2Count,
    ready: safeEnd + 1 >= windowSize,
  };
}

function canUseRepeatAt(
  numbers: readonly RouletteNumber[],
  index: number,
  options: RepeatAnalyzeOptions,
  windowSize: number,
): boolean {
  if (!options.requireInitialFilter) return true;
  if (index < 0 || numbers.length === 0) return false;
  const filter = getEnvironmentFilter(numbers, windowSize, index);
  if (!filter.ready) return options.allowPreInitialSignals === true;
  return filter.passed;
}

function emptyRoi(): RepeatNumberRoi {
  return { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 };
}
