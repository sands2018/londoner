import { getNumberColRows, type RouletteNumber } from "./roulette";

export const colRowLabels = ["一组", "二组", "三组", "组", "1行", "2行", "3行", "行", "全部"] as const;
export const colRowLongLabels = ["第一组", "第二组", "第三组", "组", "第1行", "第2行", "第3行", "行", "全部"] as const;
export const colRowSummaryHeaders = ["0", "1", "2", "3", "4", "5", "6", "6+"] as const;
export const colRowExploreRounds = [0, 1, 2, 3, 4, 5, 6];

export interface ColRowWave {
  current: number;
  distances: number[];
  key: number;
  label: string;
  longLabel: string;
  summary: number[];
}

export interface ColRowExploreResult {
  key: number;
  label: string;
  value: number;
}

export interface ColRowStats {
  rawDistances: number[][];
  rows: ColRowWave[];
}

const crcBucketCount = 8;

export function calculateColRowStats(numbers: readonly RouletteNumber[], scope: number): ColRowStats {
  const previousIndexes = Array<number>(6).fill(-1);
  const rawDistances = Array.from({ length: 8 }, () => [] as number[]);
  let nonZeroIndex = 0;

  for (const value of numbers) {
    if (value === 0) continue;

    const hits = getNumberColRows(value);
    for (const hit of hits) {
      const baseIndex = hit as number;
      const distance = nonZeroIndex - previousIndexes[baseIndex];
      const waveIndex = baseIndex >= 3 ? baseIndex + 1 : baseIndex;
      const aggregateIndex = baseIndex >= 3 ? 7 : 3;

      rawDistances[waveIndex].push(distance);
      rawDistances[aggregateIndex].push(distance);
      previousIndexes[baseIndex] = nonZeroIndex;
    }

    nonZeroIndex += 1;
  }

  const currentFor = (index: number) => {
    return previousIndexes[index] < 0 ? nonZeroIndex : Math.max(0, nonZeroIndex - previousIndexes[index] - 1);
  };
  const current = [
    currentFor(0),
    currentFor(1),
    currentFor(2),
    Math.min(currentFor(0), currentFor(1), currentFor(2)),
    currentFor(3),
    currentFor(4),
    currentFor(5),
    Math.min(currentFor(3), currentFor(4), currentFor(5)),
  ];
  const summary = calculateColRowSummary(rawDistances, scope);

  return {
    rawDistances,
    rows: rawDistances.map((distances, index) => ({
      current: current[index] ?? 0,
      distances: distances.slice(-80).reverse().map(displayDistance),
      key: index,
      label: colRowLabels[index] ?? "",
      longLabel: colRowLongLabels[index] ?? "",
      summary: summary[index],
    })),
  };
}

export function calculateColRowExplore(
  rows: readonly ColRowWave[],
  selectedRowIndexes: readonly number[],
  selectedRounds: readonly number[],
): ColRowExploreResult[] {
  return selectedRowIndexes
    .filter((index) => index >= 0 && index < 8)
    .map((index) => {
      let value = 0;
      const summary = rows[index]?.summary ?? [];
      for (const round of selectedRounds) {
        const won = summary[round] ?? 0;
        value += won * 20;
        for (let lostRound = round + 1; lostRound < crcBucketCount; lostRound += 1) {
          value -= (summary[lostRound] ?? 0) * 10;
        }
      }
      return {
        key: index,
        label: colRowLongLabels[index] ?? "",
        value,
      };
    })
    .sort((left, right) => right.value - left.value);
}

export function calculateColRowCompare(
  rawDistances: readonly number[][],
  scope: number,
  roundStart: number,
  roundBet: number,
) {
  const result = Array.from({ length: 9 }, (_, index) => ({
    failed: 0,
    failureRate: 0,
    key: index,
    label: colRowLongLabels[index] ?? "",
    succeeded: 0,
  }));

  for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
    if (rowIndex % 4 === 3) continue;

    let total = 0;
    const distances = rawDistances[rowIndex] ?? [];
    for (let index = distances.length - 1; index >= 0; index -= 1) {
      const distance = distances[index];
      total += distance;
      if (total > scope) break;

      const displayed = distance - 1;
      if (displayed >= roundStart) {
        if (displayed < roundStart + roundBet) {
          result[rowIndex].succeeded += 1;
        } else {
          result[rowIndex].failed += 1;
        }
      }
    }
  }

  result[3].succeeded = result[0].succeeded + result[1].succeeded + result[2].succeeded;
  result[3].failed = result[0].failed + result[1].failed + result[2].failed;
  result[7].succeeded = result[4].succeeded + result[5].succeeded + result[6].succeeded;
  result[7].failed = result[4].failed + result[5].failed + result[6].failed;
  result[8].succeeded = result[3].succeeded + result[7].succeeded;
  result[8].failed = result[3].failed + result[7].failed;

  return result.map((item) => {
    const total = item.succeeded + item.failed;
    return {
      ...item,
      failureRate: total > 0 ? item.failed / total : 0,
    };
  });
}

export function loadColRowExploreSelections() {
  return {
    rows: readNumberList("CRE_COLROW_INDEXES", [0, 1, 2, 4, 5, 6]),
    rounds: readNumberList("CRE_BET_ROUNDS", [0, 1, 2, 3, 4, 5, 6]),
  };
}

export function saveColRowExploreSelections(rows: readonly number[], rounds: readonly number[]) {
  localStorage.setItem("CRE_COLROW_INDEXES", rows.join(","));
  localStorage.setItem("CRE_BET_ROUNDS", rounds.join(","));
}

function calculateColRowSummary(rawDistances: readonly number[][], scope: number) {
  const summary = Array.from({ length: 8 }, () => Array<number>(crcBucketCount).fill(0));
  const effectiveScope = scope < 0 ? Number.POSITIVE_INFINITY : scope;

  for (let rowIndex = 0; rowIndex < 8; rowIndex += 1) {
    if (rowIndex % 4 === 3) continue;

    const aggregateIndex = rowIndex > 3 ? 7 : 3;
    const distances = rawDistances[rowIndex] ?? [];
    let total = 0;

    for (let index = distances.length - 1; index >= 0; index -= 1) {
      const distance = distances[index];
      const displayed = displayDistance(distance);
      total += displayed + 1;
      if (total > effectiveScope) break;

      const bucket = Math.min(displayed, crcBucketCount - 1);
      summary[rowIndex][bucket] += 1;
      summary[aggregateIndex][bucket] += 1;
    }
  }

  return summary;
}

function displayDistance(distance: number) {
  return Math.max(distance - 1, 0);
}

function readNumberList(key: string, fallback: number[]) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  const values = raw
    .split(",")
    .map((item) => Number.parseInt(item, 10))
    .filter((value) => Number.isInteger(value));
  return values.length > 0 ? values : fallback;
}
