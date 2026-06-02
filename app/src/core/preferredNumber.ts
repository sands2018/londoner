import type { RouletteNumber } from "./roulette";

export const PREFERRED_NUMBER_PAPER_WINDOW = 37;
export const PREFERRED_NUMBER_MIN_PAPER_HITS = 2;
export const PREFERRED_NUMBER_PICK_COUNT = 2;
export const PREFERRED_NUMBER_COOLDOWN = 3;
export const PREFERRED_NUMBER_PAY = 36;

export interface PreferredNumberSignal {
  numbers: RouletteNumber[];
  paperHits: number;
  paperWindow: number;
  betAmt: number;
}

export interface PreferredNumberRoi {
  signals: number;
  bet: number;
  win: number;
  hits: number;
  roi: number;
}

export interface PreferredNumberAnalysis {
  activeSignals: PreferredNumberSignal[];
  totalRoi: PreferredNumberRoi;
}

export function analyzePreferredNumber(
  numbers: readonly RouletteNumber[],
  startRound = 0,
): PreferredNumberAnalysis {
  const transitionCounts = createTransitionCounts();
  const paperHits: boolean[] = [];
  let cooldown = 0;
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;

  if (numbers.length < 2) {
    return { activeSignals: [], totalRoi: emptyRoi() };
  }

  for (let index = 1; index < numbers.length; index += 1) {
    addTransition(transitionCounts, numbers[index - 1], numbers[index]);
  }

  const replayCounts = createTransitionCounts();
  for (let index = 1; index < numbers.length; index += 1) {
    const picks = getMarkovTopNumbers(replayCounts, numbers[index - 1], PREFERRED_NUMBER_PICK_COUNT);
    const paperHit = picks.includes(numbers[index]);
    const shouldBet = cooldown <= 0 && canBetFromPaper(paperHits);

    if (cooldown > 0) {
      cooldown -= 1;
    } else if (shouldBet) {
      if (index >= startRound) {
        signals += 1;
        bet += PREFERRED_NUMBER_PICK_COUNT;
      }

      if (paperHit) {
        if (index >= startRound) {
          win += PREFERRED_NUMBER_PAY;
          hits += 1;
        }
        cooldown = 0;
      } else {
        cooldown = PREFERRED_NUMBER_COOLDOWN;
      }
    }

    paperHits.push(paperHit);
    addTransition(replayCounts, numbers[index - 1], numbers[index]);
  }

  const activeSignals = getActiveSignals(numbers, transitionCounts, paperHits, cooldown);
  return { activeSignals, totalRoi: makeRoi(signals, bet, win, hits) };
}

function getActiveSignals(
  numbers: readonly RouletteNumber[],
  transitionCounts: number[][],
  paperHits: readonly boolean[],
  cooldown: number,
): PreferredNumberSignal[] {
  if (numbers.length === 0 || !canBetFromPaper(paperHits) || cooldown > 0) return [];

  const picks = getMarkovTopNumbers(transitionCounts, numbers[numbers.length - 1], PREFERRED_NUMBER_PICK_COUNT);
  return [{
    numbers: picks,
    paperHits: countRecentPaperHits(paperHits),
    paperWindow: PREFERRED_NUMBER_PAPER_WINDOW,
    betAmt: PREFERRED_NUMBER_PICK_COUNT,
  }];
}

function canBetFromPaper(paperHits: readonly boolean[]): boolean {
  return paperHits.length >= PREFERRED_NUMBER_PAPER_WINDOW &&
    countRecentPaperHits(paperHits) >= PREFERRED_NUMBER_MIN_PAPER_HITS;
}

function countRecentPaperHits(paperHits: readonly boolean[]): number {
  return paperHits.slice(-PREFERRED_NUMBER_PAPER_WINDOW).filter(Boolean).length;
}

function createTransitionCounts(): number[][] {
  return Array.from({ length: 37 }, () => Array(37).fill(0));
}

function addTransition(transitionCounts: number[][], from: RouletteNumber, to: RouletteNumber): void {
  transitionCounts[from][to] += 1;
}

function getMarkovTopNumbers(
  transitionCounts: readonly number[][],
  previous: RouletteNumber,
  count: number,
): RouletteNumber[] {
  return transitionCounts[previous]
    .map((appearances, number) => ({ appearances, number: number as RouletteNumber }))
    .sort((a, b) => b.appearances - a.appearances || a.number - b.number)
    .slice(0, count)
    .map((item) => item.number);
}

function makeRoi(signals: number, bet: number, win: number, hits: number): PreferredNumberRoi {
  return {
    signals,
    bet,
    win,
    hits,
    roi: bet > 0 ? ((win - bet) / bet) * 100 : 0,
  };
}

function emptyRoi(): PreferredNumberRoi {
  return { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 };
}
