import type { RouletteNumber } from "./roulette";

export const PREFERRED_NUMBER_PAPER_WINDOW = 37;
export const PREFERRED_NUMBER_MIN_PAPER_HITS = 2;
export const PREFERRED_NUMBER_PICK_COUNT = 2;
export const PREFERRED_NUMBER_COOLDOWN = 3;
export const PREFERRED_NUMBER_PAY = 36;
export const PREFERRED_NUMBER_ZONE_WINDOW = 37;
export const PREFERRED_NUMBER_ZONE_RADIUS = 4;
export const PREFERRED_NUMBER_ZONE_MIN_HITS = 8;

const europeanWheelOrder: readonly RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const wheelPositions = europeanWheelOrder.reduce<number[]>((positions, number, index) => {
  positions[number] = index;
  return positions;
}, []);

export interface PreferredNumberSignal {
  numbers: RouletteNumber[];
  paperHits: number;
  paperWindow: number;
  zoneHits: number;
  zoneMinHits: number;
  zoneRadius: number;
  zoneWindow: number;
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

// 优选号当前不在 UI 展示；保留核心逻辑用于后续研究、回测和可能重新开放。
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
    const zoneHits = countRecentZoneHits(numbers, index, numbers[index - 1]);
    const shouldBet = cooldown <= 0 && canBetFromPaper(paperHits) && canBetFromZone(zoneHits);

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

  const zoneHits = countRecentZoneHits(numbers, numbers.length, numbers[numbers.length - 1]);
  if (!canBetFromZone(zoneHits)) return [];

  const picks = getMarkovTopNumbers(transitionCounts, numbers[numbers.length - 1], PREFERRED_NUMBER_PICK_COUNT);
  return [{
    numbers: picks,
    paperHits: countRecentPaperHits(paperHits),
    paperWindow: PREFERRED_NUMBER_PAPER_WINDOW,
    zoneHits,
    zoneMinHits: PREFERRED_NUMBER_ZONE_MIN_HITS,
    zoneRadius: PREFERRED_NUMBER_ZONE_RADIUS,
    zoneWindow: PREFERRED_NUMBER_ZONE_WINDOW,
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

function canBetFromZone(zoneHits: number): boolean {
  return zoneHits >= PREFERRED_NUMBER_ZONE_MIN_HITS;
}

function countRecentZoneHits(
  numbers: readonly RouletteNumber[],
  nextIndex: number,
  center: RouletteNumber,
): number {
  const start = Math.max(0, nextIndex - PREFERRED_NUMBER_ZONE_WINDOW);
  let hits = 0;

  for (let index = start; index < nextIndex; index += 1) {
    if (getWheelDistance(numbers[index], center) <= PREFERRED_NUMBER_ZONE_RADIUS) hits += 1;
  }

  return hits;
}

function getWheelDistance(a: RouletteNumber, b: RouletteNumber): number {
  const distance = Math.abs(wheelPositions[a] - wheelPositions[b]);
  return Math.min(distance, europeanWheelOrder.length - distance);
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
