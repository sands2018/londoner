import { getNumberColRows, type RouletteNumber } from "./roulette";

export type OtherNumberSortField = "number" | "distance" | "frequency";
export type OtherSortDirection = "asc" | "desc";

export interface OtherNumberItem {
  distance: number;
  frequency: number;
  isAverage?: boolean;
  number: number;
}

export interface OtherMaxDistanceItem {
  distance: number;
  number: number;
}

export interface OtherLongStats {
  misses: number;
  percentages: number[];
  rounds: number[];
  total: number;
  wins: number[];
}

export interface OtherRoundBetRow {
  failed: number[];
  failedPercentages: number[];
  notYet: number;
  notYetPercentage: number;
  round: number;
}

export interface OtherRoundSummaryRow {
  all: OtherRoundSummaryCells;
  group: OtherRoundSummaryCells;
  row: OtherRoundSummaryCells;
  round: number;
}

export interface OtherRoundSummaryCells {
  after: number;
  before: number;
  current: number;
}

const rouletteNumberCount = 37;
const roundBetRounds = [3, 4, 5, 6, 7, 8, 9];
export const otherRoundFailedRounds = [4, 6] as const;
export const otherLongBetCountOptions = [2, 3, 4, 5, 6, 7] as const;
export const otherLongRoundOptions = [3, 4, 5, 6, 7] as const;

export function calculateOtherNumberStats(
  numbers: readonly RouletteNumber[],
  scope: number,
  sortField: OtherNumberSortField,
  sortDirection: OtherSortDirection,
) {
  const scoped = scopedNumbers(numbers, scope);
  const distances = Array<number>(rouletteNumberCount).fill(0);
  const frequencies = Array<number>(rouletteNumberCount).fill(0);
  const stopped = Array<boolean>(rouletteNumberCount).fill(false);

  for (let index = scoped.length - 1; index >= 0; index -= 1) {
    let changed = false;
    const value = scoped[index];
    for (let number = 0; number <= 36; number += 1) {
      if (stopped[number]) continue;
      if (value === number) {
        stopped[number] = true;
      } else {
        distances[number] += 1;
        changed = true;
      }
    }
    if (!changed) break;
  }

  for (const value of scoped) {
    frequencies[value] += 1;
  }

  const items: OtherNumberItem[] = Array.from({ length: rouletteNumberCount }, (_, number) => ({
    distance: distances[number],
    frequency: frequencies[number],
    number,
  }));
  items.push({
    distance: average(distances),
    frequency: average(frequencies),
    isAverage: true,
    number: -1,
  });

  if (sortField !== "number") {
    const multiplier = sortDirection === "asc" ? 1 : -1;
    items.sort((left, right) => {
      const diff = sortField === "distance" ? left.distance - right.distance : left.frequency - right.frequency;
      if (diff !== 0) return diff * multiplier;
      return left.number - right.number;
    });
  }

  const rows = Array.from({ length: 19 }, (_, index) => ({
    left: items[index],
    right: items[index + 19],
  }));

  return {
    maxDistances: calculateMaxDistances(scoped),
    rows,
  };
}

export function calculateOtherLongStats(
  numbers: readonly RouletteNumber[],
  betCount: number,
  longRound: number,
): OtherLongStats {
  const misses = Array<number>(6).fill(0);
  const trackers = Array.from({ length: 6 }, () => ({ active: false, roundAfter: 0 }));
  const wins = Array<number>(betCount).fill(0);
  let failed = 0;
  let total = 0;

  for (const value of numbers) {
    if (value === 0) continue;

    const hits = getNumberColRows(value).map((item) => item as number);
    for (let index = 0; index < 6; index += 1) {
      const tracker = trackers[index];
      if (tracker.active) {
        if (hits.includes(index)) {
          wins[tracker.roundAfter] += 1;
          tracker.active = false;
          tracker.roundAfter = 0;
        } else {
          tracker.roundAfter += 1;
          if (tracker.roundAfter >= betCount) {
            failed += 1;
            tracker.active = false;
            tracker.roundAfter = 0;
          }
        }
      } else if (misses[index] >= longRound && hits.includes(index)) {
        tracker.active = true;
        tracker.roundAfter = 0;
        total += 1;
      }
    }

    for (let index = 0; index < 6; index += 1) {
      misses[index] = hits.includes(index) ? 0 : misses[index] + 1;
    }
  }

  return {
    misses: failed,
    percentages: [...wins, failed].map((count) => (total > 0 ? count / total : 0)),
    rounds: Array.from({ length: betCount }, (_, index) => index + 1),
    total,
    wins,
  };
}

export function calculateOtherRoundBet(numbers: readonly RouletteNumber[], scope: number): OtherRoundBetRow[] {
  const scoped = scopedNumbers(numbers, scope);
  const misses = Array<number>(6).fill(0);
  const notYet = Array<number>(roundBetRounds.length).fill(0);
  const failed = otherRoundFailedRounds.map(() => Array<number>(roundBetRounds.length).fill(0));

  for (const value of scoped) {
    if (value === 0) continue;

    const hits = getNumberColRows(value).map((item) => item as number);
    for (let index = 0; index < 6; index += 1) {
      misses[index] = hits.includes(index) ? 0 : misses[index] + 1;
    }

    for (let index = 0; index < 6; index += 1) {
      roundBetRounds.forEach((round, roundIndex) => {
        if (misses[index] === round) {
          notYet[roundIndex] += 1;
        }
        otherRoundFailedRounds.forEach((failedRound, failedIndex) => {
          if (misses[index] === round + failedRound) {
            failed[failedIndex][roundIndex] += 1;
          }
        });
      });
    }
  }

  const total = Math.max(scoped.length, 1);
  return roundBetRounds.map((round, index) => ({
    failed: failed.map((items) => items[index]),
    failedPercentages: failed.map((items) => (notYet[index] > 0 ? items[index] / notYet[index] : 0)),
    notYet: notYet[index],
    notYetPercentage: notYet[index] / total,
    round,
  }));
}

export function calculateOtherRoundSummary(numbers: readonly RouletteNumber[], scope: number): OtherRoundSummaryRow[] {
  const maxCount = 20;
  const scoped = scopedNumbers(numbers, scope);
  const counts = Array.from({ length: 3 }, () => Array<number>(maxCount).fill(0));
  const above = Array<number>(3).fill(0);
  const previous = Array<number>(6).fill(-1);

  scoped.forEach((value, rawIndex) => {
    if (value === 0) return;

    const hits = getNumberColRows(value).map((item) => item as number);
    hits.forEach((hit, hitIndex) => {
      const aggregateIndex = hitIndex === 0 ? 0 : 1;
      const gap = rawIndex - previous[hit] - 1;
      if (gap < maxCount) {
        counts[aggregateIndex][gap] += 1;
        counts[2][gap] += 1;
      } else {
        above[aggregateIndex] += 1;
        above[2] += 1;
      }
      previous[hit] = rawIndex;
    });
  });

  const before = Array.from({ length: 3 }, () => Array<number>(maxCount).fill(0));
  const after = Array.from({ length: 3 }, () => Array<number>(maxCount).fill(0));
  for (let group = 0; group < 3; group += 1) {
    after[group][maxCount - 1] = above[group];
    for (let index = maxCount - 2; index >= 0; index -= 1) {
      after[group][index] = counts[group][index + 1] + after[group][index + 1];
    }
    for (let index = 1; index < maxCount; index += 1) {
      before[group][index] = counts[group][index - 1] + before[group][index - 1];
    }
  }

  return Array.from({ length: maxCount }, (_, index) => ({
    all: cells(before, counts, after, 2, index),
    group: cells(before, counts, after, 0, index),
    row: cells(before, counts, after, 1, index),
    round: index + 1,
  }));
}

function calculateMaxDistances(numbers: readonly RouletteNumber[]): OtherMaxDistanceItem[] {
  const previous = Array<number>(rouletteNumberCount).fill(-1);
  const maximum = Array<number>(rouletteNumberCount).fill(-1);
  const top: OtherMaxDistanceItem[] = [];

  numbers.forEach((value, index) => {
    const distance = index - previous[value] - 1;
    previous[value] = index;
    maximum[value] = Math.max(maximum[value], distance);
    insertTop(top, { distance, number: value });
  });

  for (let number = 0; number <= 36; number += 1) {
    const distance = numbers.length - previous[number] - 1;
    maximum[number] = Math.max(maximum[number], distance);
    insertTop(top, { distance, number });
  }

  return top.slice(0, 5);
}

function cells(
  before: readonly number[][],
  current: readonly number[][],
  after: readonly number[][],
  group: number,
  index: number,
): OtherRoundSummaryCells {
  return {
    after: after[group][index],
    before: before[group][index],
    current: current[group][index],
  };
}

function insertTop(items: OtherMaxDistanceItem[], candidate: OtherMaxDistanceItem) {
  const index = items.findIndex((item) => item.distance < candidate.distance);
  if (index < 0) {
    if (items.length < 10) items.push(candidate);
    return;
  }

  items.splice(index, 0, candidate);
  if (items.length > 10) items.length = 10;
}

function scopedNumbers(numbers: readonly RouletteNumber[], scope: number) {
  return scope < 0 ? numbers : numbers.slice(Math.max(0, numbers.length - scope));
}

function average(values: readonly number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
