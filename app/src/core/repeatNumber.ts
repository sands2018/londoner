import type { RouletteNumber } from "./roulette";

export const REPEAT_GAP_MIN = 8;
export const REPEAT_GAP_MAX = 12;
export const REPEAT_RECENT_SCOPE = 37;
export const REPEAT_PREMIUM_COUNT = 3;
export const REPEAT_PAY = 36;

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

export interface RepeatNumberAnalysis {
  activeSignals: RepeatNumberSignal[];
  totalRoi: RepeatNumberRoi;
  normalRoi: RepeatNumberRoi;
  premiumRoi: RepeatNumberRoi;
}

export function analyzeRepeatNumber(numbers: readonly RouletteNumber[]): RepeatNumberAnalysis {
  return {
    activeSignals: getActiveSignals(numbers),
    totalRoi: computeRoi(numbers),
    normalRoi: computeRoi(numbers),
    premiumRoi: computeRoi(numbers, (signal) => signal.isPremium),
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

  const scopeStart = Math.max(0, index - REPEAT_RECENT_SCOPE + 1);
  let recentCount = 0;
  for (let cursor = scopeStart; cursor <= index; cursor += 1) {
    if (numbers[cursor] === value) recentCount += 1;
  }

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
  filter: (signal: RepeatNumberSignal) => boolean = () => true,
): RepeatNumberRoi {
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;

  for (let index = 0; index < numbers.length - 1; index += 1) {
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
