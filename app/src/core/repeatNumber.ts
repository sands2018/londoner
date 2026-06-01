import type { RouletteNumber } from "./roulette";

export const REPEAT_GAP_MIN = 8;
export const REPEAT_GAP_MAX = 12;
export const REPEAT_RECENT_SCOPE = 37;
export const REPEAT_PREMIUM_COUNT = 3;
export const REPEAT_PAY = 36;
export const SHORT_REPEAT_GAP_MIN = 2;
export const SHORT_REPEAT_GAP_MAX = 3;
export const SHORT_REPEAT_CHASE_LEN = 2;

export interface RepeatNumberSignal {
  number: RouletteNumber;
  prevGap: number;
  recentCount: number;
  betAmt: number;
  isPremium: boolean;
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
  normalRoi: RepeatNumberRoi;
  premiumRoi: RepeatNumberRoi;
}

export interface ShortRepeatAnalysis {
  activeSignals: ShortRepeatSignal[];
  totalRoi: RepeatNumberRoi;
}

export function analyzeRepeatNumber(
  numbers: readonly RouletteNumber[],
  startRound = 0,
): RepeatNumberAnalysis {
  return {
    activeSignals: getActiveSignals(numbers),
    normalRoi: computeRoi(numbers, startRound),
    premiumRoi: computeRoi(numbers, startRound, (signal) => signal.isPremium),
  };
}

export function analyzeShortRepeatNumber(
  numbers: readonly RouletteNumber[],
  startRound = 0,
): ShortRepeatAnalysis {
  const replay = replayShortRepeat(numbers, startRound);
  return {
    activeSignals: replay.activeSignals,
    totalRoi: replay.roi,
  };
}

function getActiveSignals(numbers: readonly RouletteNumber[]): RepeatNumberSignal[] {
  if (numbers.length === 0) return [];

  const signal = getRepeatSignalAt(numbers, numbers.length - 1);
  return signal ? [signal] : [];
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
  if (prevGap < REPEAT_GAP_MIN || prevGap > REPEAT_GAP_MAX) return null;

  const recentCount = countRecent(numbers, index, value);
  if (!hasShortRepeatEnvironment(numbers, index)) return null;

  return {
    number: value,
    prevGap,
    recentCount,
    betAmt: 1,
    isPremium: recentCount >= REPEAT_PREMIUM_COUNT,
  };
}

function computeRoi(
  numbers: readonly RouletteNumber[],
  startRound = 0,
  filter: (signal: RepeatNumberSignal) => boolean = () => true,
): RepeatNumberRoi {
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;

  for (let index = 0; index < numbers.length - 1; index += 1) {
    const signal = getRepeatSignalAt(numbers, index);
    if (!signal || !filter(signal)) continue;
    if (index < startRound) continue;

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
    isPremium: true,
  };
}

function hasShortRepeatEnvironment(numbers: readonly RouletteNumber[], index: number): boolean {
  const scopeStart = Math.max(0, index - REPEAT_RECENT_SCOPE);
  for (let cursor = scopeStart; cursor < index; cursor += 1) {
    if (getShortRepeatSignalAt(numbers, cursor)) return true;
  }
  return false;
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
): { activeSignals: ShortRepeatSignal[]; roi: RepeatNumberRoi } {
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;
  const activeChases: Array<RepeatNumberSignal & { startRound: number }> = [];

  for (let index = 0; index < numbers.length; index += 1) {
    const value = numbers[index];
    const surviving: typeof activeChases = [];

    for (const chase of activeChases) {
      const roundIndex = index - chase.startRound;
      if (roundIndex >= SHORT_REPEAT_CHASE_LEN) continue;

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

    const signal = getShortRepeatSignalAt(numbers, index);
    if (!signal) continue;

    if (index < numbers.length - 1 && index + SHORT_REPEAT_CHASE_LEN >= startRound) signals += 1;
    activeChases.push({ ...signal, startRound: index + 1 });
  }

  const activeSignals: ShortRepeatSignal[] = activeChases
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
        round,
        isNew: round === 1,
        chaseLen: SHORT_REPEAT_CHASE_LEN,
      };
    })
    .filter((signal): signal is ShortRepeatSignal => signal !== null);

  const roi = bet > 0 ? ((win - bet) / bet) * 100 : 0;
  return { activeSignals, roi: { signals, bet, win, hits, roi } };
}
