import {
  type ColRowIndex,
  type RouletteNumber,
  getColRowLabel,
  getColumnIndexes,
  getNumberColor,
  getNumberColRows,
} from "./roulette";

export interface ColRowCount {
  index: ColRowIndex;
  label: string;
  count: number;
}

export interface BisectionStats {
  red: number;
  black: number;
  odd: number;
  even: number;
  big: number;
  small: number;
}

export interface SnapshotStats {
  total: number;
  zeroCount: number;
  colRows: ColRowCount[];
  bisections: BisectionStats;
}

export interface DistanceStat {
  index: ColRowIndex;
  label: string;
  distance: number;
}

export interface ColumnDistanceStat {
  index: number;
  label: string;
  distance: number;
  active: boolean;
}

export interface FinishedLongStat {
  index: ColRowIndex;
  label: string;
  closedDistance: number;
  afterDistance: number;
}

export function calculateSnapshotStats(
  numbers: readonly RouletteNumber[],
  scope = numbers.length,
): SnapshotStats {
  const recent = numbers.slice(Math.max(0, numbers.length - scope));
  const colRowCounts = [0, 0, 0, 0, 0, 0];
  const bisections: BisectionStats = {
    red: 0,
    black: 0,
    odd: 0,
    even: 0,
    big: 0,
    small: 0,
  };

  let zeroCount = 0;

  for (const value of recent) {
    if (value === 0) {
      zeroCount += 1;
      continue;
    }

    for (const index of getNumberColRows(value)) {
      colRowCounts[index] += 1;
    }

    const color = getNumberColor(value);
    if (color === "red") bisections.red += 1;
    if (color === "black") bisections.black += 1;

    if (value % 2 === 0) bisections.even += 1;
    else bisections.odd += 1;

    if (value > 18) bisections.big += 1;
    else bisections.small += 1;
  }

  return {
    total: recent.length,
    zeroCount,
    colRows: colRowCounts
      .map((count, index) => ({
        index: index as ColRowIndex,
        label: getColRowLabel(index as ColRowIndex),
        count,
      }))
      .sort((left, right) => right.count - left.count),
    bisections,
  };
}

export function calculateColRowDistances(numbers: readonly RouletteNumber[]): DistanceStat[] {
  const distances = [0, 0, 0, 0, 0, 0];

  for (const value of numbers) {
    if (value === 0) continue;

    for (let index = 0; index < distances.length; index += 1) {
      distances[index] += 1;
    }

    for (const index of getNumberColRows(value)) {
      distances[index] = 0;
    }
  }

  return distances
    .map((distance, index) => ({
      index: index as ColRowIndex,
      label: getColRowLabel(index as ColRowIndex),
      distance,
    }))
    .sort((left, right) => right.distance - left.distance);
}

export function calculateColumnDistances(numbers: readonly RouletteNumber[]): ColumnDistanceStat[] {
  const starts = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31];
  const distances = starts.map(() => 0);
  const counting = starts.map(() => true);

  for (let numberIndex = numbers.length - 1; numberIndex >= 0; numberIndex -= 1) {
    const value = numbers[numberIndex];
    if (value === 0) continue;

    let changed = false;
    const hitColumns = getColumnIndexes(value);

    for (let index = 0; index < starts.length; index += 1) {
      if (hitColumns.includes(index)) {
        counting[index] = false;
      } else if (counting[index]) {
        distances[index] += 1;
        changed = true;
      }
    }

    if (!changed) break;
  }

  const ordered = distances
    .map((distance, index) => ({
      index,
      label: `${starts[index]}-${starts[index] + 5}`,
      distance,
      active: true,
    }))
    .sort((left, right) => right.distance - left.distance);

  for (let index = 0; index < ordered.length - 1; index += 1) {
    if (!ordered[index].active || ordered[index].index % 2 !== 0) continue;

    for (let next = index + 1; next < ordered.length; next += 1) {
      const min = Math.min(ordered[index].index, ordered[next].index);
      const max = Math.max(ordered[index].index, ordered[next].index);

      if (min % 4 === 0 && max - min === 2) {
        ordered[index].active = false;
        ordered[next].active = false;
        break;
      }
    }
  }

  return ordered;
}

export function filterColumnDistances(
  stats: readonly ColumnDistanceStat[],
  minimum: number,
): ColumnDistanceStat[] {
  return stats.filter((item) => item.distance >= minimum).slice(0, 12);
}

export function calculateFinishedLongs(
  numbers: readonly RouletteNumber[],
  minimum = 10,
): FinishedLongStat[] {
  const occurredOnce = [false, false, false, false, false, false];
  const occurredTwice = [false, false, false, false, false, false];
  const afterCounts = [0, 0, 0, 0, 0, 0];
  const closedCounts = [0, 0, 0, 0, 0, 0];

  for (let numberIndex = numbers.length - 1; numberIndex >= 0; numberIndex -= 1) {
    const value = numbers[numberIndex];
    if (value === 0) continue;

    const indexes = getNumberColRows(value);
    let shouldContinue = false;

    for (const index of indexes) {
      if (occurredTwice[index]) continue;
      if (occurredOnce[index]) {
        occurredTwice[index] = true;
      } else {
        occurredOnce[index] = true;
      }
    }

    for (let index = 0; index < 6; index += 1) {
      if (indexes.includes(index as ColRowIndex) || occurredTwice[index]) continue;

      shouldContinue = true;
      if (occurredOnce[index]) {
        afterCounts[index] += 1;
      } else {
        closedCounts[index] += 1;
      }
    }

    if (!shouldContinue) break;
  }

  return afterCounts
    .map((closedDistance, index) => ({
      index: index as ColRowIndex,
      label: getColRowLabel(index as ColRowIndex),
      closedDistance,
      afterDistance: closedCounts[index],
    }))
    .filter((item) => item.closedDistance >= minimum)
    .sort((left, right) => left.afterDistance - right.afterDistance);
}
