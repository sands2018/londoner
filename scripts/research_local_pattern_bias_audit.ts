import fs from "node:fs";
import path from "node:path";

import type { RouletteNumber } from "../app/src/core/roulette";

interface RawRow {
  Count?: number;
  Name?: string;
  Numbers?: string | number[];
  DataTms?: number;
  tms?: number;
}

interface Session {
  id: string;
  importIndex: number;
  name: string;
  numbers: RouletteNumber[];
  updatedTms: number;
  dataTms?: number;
  start: number;
  end: number;
}

interface BurstWindow {
  start: number;
  end: number;
  count: number;
  label: string;
  sessionName: string;
  offset: number;
}

interface NumberWindowMetric {
  window: number;
  maxCount: number;
  monteCarloP: number;
  topWindows: BurstWindow[];
}

interface CategoryWindowMetric {
  window: number;
  maxCount: number;
  maxP: number;
  minCount: number;
  minP: number;
  maxWindows: BurstWindow[];
  minWindows: BurstWindow[];
}

interface SimMetric {
  numberMaxByWindow: Map<number, number>;
  groupMaxByWindow: Map<number, number>;
  groupMinByWindow: Map<number, number>;
  rowMaxByWindow: Map<number, number>;
  rowMinByWindow: Map<number, number>;
  maxSameNumberRun: number;
  maxGroupRun: number;
  maxRowRun: number;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "local-pattern-bias-audit-20260703.md");

const NUMBER_WINDOWS = [5, 10, 20, 37, 50, 100];
const CATEGORY_WINDOWS = [10, 20, 37, 50, 100];
const SIMULATIONS = 500;

const GROUPS: RouletteNumber[][] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
];

const ROWS: RouletteNumber[][] = [
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
];

const GROUP_LABELS = ["一组", "二组", "三组"];
const ROW_LABELS = ["1行", "2行", "3行"];

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => (
    Number.isInteger(value) && value >= 0 && value <= 36
  ));
}

function sessionTime(session: Pick<Session, "dataTms" | "updatedTms">): number {
  return Number.isFinite(session.dataTms) ? session.dataTms ?? 0 : session.updatedTms;
}

function formatDate(tms: number | undefined): string {
  if (!Number.isFinite(tms)) return "-";
  return new Date(tms as number).toISOString().slice(0, 10);
}

function loadSessions(): { sessions: Session[]; rawCount: number; numbers: RouletteNumber[] } {
  const rawRows = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8")) as RawRow[];
  const base = rawRows.map((row, index) => ({
    id: `row-${index + 1}`,
    importIndex: index,
    name: row.Name ?? `row-${index + 1}`,
    numbers: parseNumbers(row.Numbers),
    updatedTms: row.tms ?? row.DataTms ?? index,
    dataTms: row.DataTms,
  })).filter((session) => session.numbers.length > 0);

  base.sort((left, right) => (
    sessionTime(left) - sessionTime(right)
    || left.importIndex - right.importIndex
    || left.name.localeCompare(right.name, "zh-Hans-CN")
  ));

  const numbers: RouletteNumber[] = [];
  const sessions: Session[] = [];
  for (const item of base) {
    const start = numbers.length;
    numbers.push(...item.numbers);
    sessions.push({ ...item, start, end: numbers.length });
  }
  return { sessions, rawCount: rawRows.length, numbers };
}

function groupOf(number: RouletteNumber): number {
  if (number === 0) return -1;
  for (let index = 0; index < GROUPS.length; index += 1) {
    if (GROUPS[index].includes(number)) return index;
  }
  return -1;
}

function rowOf(number: RouletteNumber): number {
  if (number === 0) return -1;
  for (let index = 0; index < ROWS.length; index += 1) {
    if (ROWS[index].includes(number)) return index;
  }
  return -1;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomSequence(length: number, rng: () => number): RouletteNumber[] {
  const result: RouletteNumber[] = [];
  for (let index = 0; index < length; index += 1) {
    result.push(Math.floor(rng() * 37) as RouletteNumber);
  }
  return result;
}

function locateSession(sessions: readonly Session[], position: number): Session {
  let left = 0;
  let right = sessions.length - 1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const session = sessions[middle];
    if (position < session.start) {
      right = middle - 1;
    } else if (position >= session.end) {
      left = middle + 1;
    } else {
      return session;
    }
  }
  return sessions[sessions.length - 1];
}

function binomialZ(observed: number, n: number, p: number): number {
  const variance = n * p * (1 - p);
  return variance > 0 ? (observed - n * p) / Math.sqrt(variance) : 0;
}

function formatP(p: number): string {
  if (p <= 1 / (SIMULATIONS + 1)) return `<=${(1 / (SIMULATIONS + 1)).toFixed(4)}`;
  if (p < 0.0001) return p.toExponential(2);
  return p.toFixed(4);
}

function formatZ(z: number): string {
  return z >= 0 ? `+${z.toFixed(2)}` : z.toFixed(2);
}

function maxSameNumberRun(numbers: readonly RouletteNumber[]): number {
  let best = 0;
  let current = 0;
  let previous: RouletteNumber | null = null;
  for (const number of numbers) {
    current = number === previous ? current + 1 : 1;
    previous = number;
    best = Math.max(best, current);
  }
  return best;
}

function maxCategoryRun(numbers: readonly RouletteNumber[], categoryOf: (number: RouletteNumber) => number): number {
  let best = 0;
  let current = 0;
  let previous = -2;
  for (const number of numbers) {
    const category = categoryOf(number);
    if (category < 0) {
      current = 0;
      previous = -2;
      continue;
    }
    current = category === previous ? current + 1 : 1;
    previous = category;
    best = Math.max(best, current);
  }
  return best;
}

function sameNumberRunWindows(numbers: readonly RouletteNumber[], length: number): number {
  let count = 0;
  for (let index = 0; index + length <= numbers.length; index += 1) {
    const first = numbers[index];
    let same = true;
    for (let offset = 1; offset < length; offset += 1) {
      if (numbers[index + offset] !== first) {
        same = false;
        break;
      }
    }
    if (same) count += 1;
  }
  return count;
}

function maxAnyNumberInWindow(numbers: readonly RouletteNumber[], window: number): number {
  if (numbers.length < window) return 0;
  const counts = Array(37).fill(0);
  const countFreq = Array(window + 1).fill(0);
  countFreq[0] = 37;
  const inc = (number: number): void => {
    const old = counts[number];
    countFreq[old] -= 1;
    counts[number] += 1;
    countFreq[old + 1] += 1;
  };
  const dec = (number: number): void => {
    const old = counts[number];
    countFreq[old] -= 1;
    counts[number] -= 1;
    countFreq[old - 1] += 1;
  };
  for (let index = 0; index < window; index += 1) inc(numbers[index]);
  let maxCount = window;
  while (countFreq[maxCount] === 0) maxCount -= 1;
  let best = maxCount;
  for (let start = 1; start + window <= numbers.length; start += 1) {
    dec(numbers[start - 1]);
    inc(numbers[start + window - 1]);
    while (maxCount < window && countFreq[maxCount + 1] > 0) maxCount += 1;
    while (maxCount > 0 && countFreq[maxCount] === 0) maxCount -= 1;
    best = Math.max(best, maxCount);
  }
  return best;
}

function topNumberBurstWindows(numbers: readonly RouletteNumber[], sessions: readonly Session[], window: number, limit = 8): BurstWindow[] {
  if (numbers.length < window) return [];
  const counts = Array(37).fill(0);
  for (let index = 0; index < window; index += 1) counts[numbers[index]] += 1;
  const candidates: BurstWindow[] = [];
  const addCandidate = (start: number): void => {
    let bestNumber = 0;
    let bestCount = -1;
    for (let number = 0; number <= 36; number += 1) {
      if (counts[number] > bestCount) {
        bestNumber = number;
        bestCount = counts[number];
      }
    }
    const session = locateSession(sessions, start);
    candidates.push({
      start,
      end: start + window,
      count: bestCount,
      label: String(bestNumber),
      sessionName: session.name,
      offset: start - session.start,
    });
  };
  addCandidate(0);
  for (let start = 1; start + window <= numbers.length; start += 1) {
    counts[numbers[start - 1]] -= 1;
    counts[numbers[start + window - 1]] += 1;
    addCandidate(start);
  }
  return selectNonOverlapping(candidates.sort((left, right) => right.count - left.count), window, limit);
}

function categoryWindowExtreme(
  numbers: readonly RouletteNumber[],
  window: number,
  categoryOf: (number: RouletteNumber) => number,
): { max: number; min: number } {
  if (numbers.length < window) return { max: 0, min: 0 };
  const counts = [0, 0, 0];
  for (let index = 0; index < window; index += 1) {
    const category = categoryOf(numbers[index]);
    if (category >= 0) counts[category] += 1;
  }
  let max = Math.max(...counts);
  let min = Math.min(...counts);
  for (let start = 1; start + window <= numbers.length; start += 1) {
    const removed = categoryOf(numbers[start - 1]);
    const added = categoryOf(numbers[start + window - 1]);
    if (removed >= 0) counts[removed] -= 1;
    if (added >= 0) counts[added] += 1;
    max = Math.max(max, ...counts);
    min = Math.min(min, ...counts);
  }
  return { max, min };
}

function topCategoryWindows(
  numbers: readonly RouletteNumber[],
  sessions: readonly Session[],
  window: number,
  categoryOf: (number: RouletteNumber) => number,
  labels: readonly string[],
  direction: "max" | "min",
  limit = 8,
): BurstWindow[] {
  if (numbers.length < window) return [];
  const counts = [0, 0, 0];
  for (let index = 0; index < window; index += 1) {
    const category = categoryOf(numbers[index]);
    if (category >= 0) counts[category] += 1;
  }
  const candidates: BurstWindow[] = [];
  const addCandidate = (start: number): void => {
    let bestCategory = 0;
    let bestCount = direction === "max" ? -1 : Number.POSITIVE_INFINITY;
    counts.forEach((count, category) => {
      if (
        (direction === "max" && count > bestCount)
        || (direction === "min" && count < bestCount)
      ) {
        bestCategory = category;
        bestCount = count;
      }
    });
    const session = locateSession(sessions, start);
    candidates.push({
      start,
      end: start + window,
      count: bestCount,
      label: labels[bestCategory],
      sessionName: session.name,
      offset: start - session.start,
    });
  };
  addCandidate(0);
  for (let start = 1; start + window <= numbers.length; start += 1) {
    const removed = categoryOf(numbers[start - 1]);
    const added = categoryOf(numbers[start + window - 1]);
    if (removed >= 0) counts[removed] -= 1;
    if (added >= 0) counts[added] += 1;
    addCandidate(start);
  }
  const sorted = candidates.sort((left, right) => (
    direction === "max" ? right.count - left.count : left.count - right.count
  ));
  return selectNonOverlapping(sorted, window, limit);
}

function selectNonOverlapping(candidates: readonly BurstWindow[], window: number, limit: number): BurstWindow[] {
  const selected: BurstWindow[] = [];
  for (const candidate of candidates) {
    if (selected.some((item) => Math.abs(item.start - candidate.start) < window)) continue;
    selected.push(candidate);
    if (selected.length >= limit) break;
  }
  return selected;
}

function simulateMetrics(length: number, rng: () => number): SimMetric {
  const numbers = randomSequence(length, rng);
  return {
    numberMaxByWindow: new Map(NUMBER_WINDOWS.map((window) => [window, maxAnyNumberInWindow(numbers, window)])),
    groupMaxByWindow: new Map(CATEGORY_WINDOWS.map((window) => [window, categoryWindowExtreme(numbers, window, groupOf).max])),
    groupMinByWindow: new Map(CATEGORY_WINDOWS.map((window) => [window, categoryWindowExtreme(numbers, window, groupOf).min])),
    rowMaxByWindow: new Map(CATEGORY_WINDOWS.map((window) => [window, categoryWindowExtreme(numbers, window, rowOf).max])),
    rowMinByWindow: new Map(CATEGORY_WINDOWS.map((window) => [window, categoryWindowExtreme(numbers, window, rowOf).min])),
    maxSameNumberRun: maxSameNumberRun(numbers),
    maxGroupRun: maxCategoryRun(numbers, groupOf),
    maxRowRun: maxCategoryRun(numbers, rowOf),
  };
}

function monteCarloPHigh(simValues: readonly number[], observed: number): number {
  return (simValues.filter((value) => value >= observed).length + 1) / (simValues.length + 1);
}

function monteCarloPLow(simValues: readonly number[], observed: number): number {
  return (simValues.filter((value) => value <= observed).length + 1) / (simValues.length + 1);
}

function formatWindow(window: BurstWindow): string {
  return `${window.label}=${window.count} @ ${window.sessionName} #${window.offset}`;
}

function main(): void {
  const { sessions, rawCount, numbers } = loadSessions();
  const rng = mulberry32(20260703);
  const simMetrics: SimMetric[] = [];
  for (let index = 0; index < SIMULATIONS; index += 1) {
    simMetrics.push(simulateMetrics(numbers.length, rng));
  }

  const numberWindowMetrics: NumberWindowMetric[] = NUMBER_WINDOWS.map((window) => {
    const observed = maxAnyNumberInWindow(numbers, window);
    return {
      window,
      maxCount: observed,
      monteCarloP: monteCarloPHigh(simMetrics.map((metric) => metric.numberMaxByWindow.get(window) ?? 0), observed),
      topWindows: topNumberBurstWindows(numbers, sessions, window),
    };
  });

  const groupWindowMetrics: CategoryWindowMetric[] = CATEGORY_WINDOWS.map((window) => {
    const observed = categoryWindowExtreme(numbers, window, groupOf);
    const simMax = simMetrics.map((metric) => metric.groupMaxByWindow.get(window) ?? 0);
    const simMin = simMetrics.map((metric) => metric.groupMinByWindow.get(window) ?? 0);
    return {
      window,
      maxCount: observed.max,
      maxP: monteCarloPHigh(simMax, observed.max),
      minCount: observed.min,
      minP: monteCarloPLow(simMin, observed.min),
      maxWindows: topCategoryWindows(numbers, sessions, window, groupOf, GROUP_LABELS, "max"),
      minWindows: topCategoryWindows(numbers, sessions, window, groupOf, GROUP_LABELS, "min"),
    };
  });

  const rowWindowMetrics: CategoryWindowMetric[] = CATEGORY_WINDOWS.map((window) => {
    const observed = categoryWindowExtreme(numbers, window, rowOf);
    const simMax = simMetrics.map((metric) => metric.rowMaxByWindow.get(window) ?? 0);
    const simMin = simMetrics.map((metric) => metric.rowMinByWindow.get(window) ?? 0);
    return {
      window,
      maxCount: observed.max,
      maxP: monteCarloPHigh(simMax, observed.max),
      minCount: observed.min,
      minP: monteCarloPLow(simMin, observed.min),
      maxWindows: topCategoryWindows(numbers, sessions, window, rowOf, ROW_LABELS, "max"),
      minWindows: topCategoryWindows(numbers, sessions, window, rowOf, ROW_LABELS, "min"),
    };
  });

  const sameRun = maxSameNumberRun(numbers);
  const maxGroupRun = maxCategoryRun(numbers, groupOf);
  const maxRowRun = maxCategoryRun(numbers, rowOf);
  const sameRunP = monteCarloPHigh(simMetrics.map((metric) => metric.maxSameNumberRun), sameRun);
  const groupRunP = monteCarloPHigh(simMetrics.map((metric) => metric.maxGroupRun), maxGroupRun);
  const rowRunP = monteCarloPHigh(simMetrics.map((metric) => metric.maxRowRun), maxRowRun);

  const lines: string[] = [];
  lines.push("# 局部结构/短窗爆发偏向审计");
  lines.push("");
  lines.push(`输入：\`${path.relative(ROOT, INPUT_FILE).replace(/\\/g, "/")}\``);
  lines.push(`原始记录 ${rawCount} 条；拼接后总号码 ${numbers.length} 个。`);
  lines.push(`拼接顺序：按 dataTms/tms/importIndex/name 排序；时间范围 ${formatDate(sessionTime(sessions[0]))} 到 ${formatDate(sessionTime(sessions[sessions.length - 1]))}。`);
  lines.push(`Monte Carlo：${SIMULATIONS} 条同长度均匀随机序列，p 表示随机序列达到同等或更极端程度的比例。`);
  lines.push("");
  lines.push("## 1. 连续相同号码");
  lines.push("");
  lines.push("| pattern | observed | expected | z / Monte Carlo p |");
  lines.push("|---|---:|---:|---|");
  [2, 3, 4, 5].forEach((length) => {
    const observed = sameNumberRunWindows(numbers, length);
    const trials = numbers.length - length + 1;
    const p = 1 / (37 ** (length - 1));
    const expected = trials * p;
    const z = binomialZ(observed, trials, p);
    lines.push(`| ${length}连同号窗口 | ${observed} | ${expected.toFixed(2)} | z=${formatZ(z)} |`);
  });
  lines.push(`| 最长同号连续 | ${sameRun} | - | MC p=${formatP(sameRunP)} |`);
  lines.push("");
  lines.push("## 2. 短窗内同一号码爆发");
  lines.push("");
  lines.push("| window | max same-number count | MC p | top windows |");
  lines.push("|---:|---:|---:|---|");
  numberWindowMetrics.forEach((metric) => {
    lines.push(`| ${metric.window} | ${metric.maxCount} | ${formatP(metric.monteCarloP)} | ${metric.topWindows.slice(0, 5).map(formatWindow).join("<br>")} |`);
  });
  lines.push("");
  lines.push("## 3. 组短窗过热/过冷");
  lines.push("");
  lines.push("| window | max group count / p | min group count / p | hottest windows | coldest windows |");
  lines.push("|---:|---|---|---|---|");
  groupWindowMetrics.forEach((metric) => {
    lines.push(`| ${metric.window} | ${metric.maxCount} / ${formatP(metric.maxP)} | ${metric.minCount} / ${formatP(metric.minP)} | ${metric.maxWindows.slice(0, 4).map(formatWindow).join("<br>")} | ${metric.minWindows.slice(0, 4).map(formatWindow).join("<br>")} |`);
  });
  lines.push("");
  lines.push("## 4. 行短窗过热/过冷");
  lines.push("");
  lines.push("| window | max row count / p | min row count / p | hottest windows | coldest windows |");
  lines.push("|---:|---|---|---|---|");
  rowWindowMetrics.forEach((metric) => {
    lines.push(`| ${metric.window} | ${metric.maxCount} / ${formatP(metric.maxP)} | ${metric.minCount} / ${formatP(metric.minP)} | ${metric.maxWindows.slice(0, 4).map(formatWindow).join("<br>")} | ${metric.minWindows.slice(0, 4).map(formatWindow).join("<br>")} |`);
  });
  lines.push("");
  lines.push("## 5. 连续同组/同行");
  lines.push("");
  lines.push("| pattern | observed max run | MC p |");
  lines.push("|---|---:|---:|");
  lines.push(`| 同组连续，0打断 | ${maxGroupRun} | ${formatP(groupRunP)} |`);
  lines.push(`| 同行连续，0打断 | ${maxRowRun} | ${formatP(rowRunP)} |`);
  lines.push("");
  lines.push("## 6. 初步判断");
  lines.push("");
  lines.push("1. 如果短窗爆发或行组过热的 MC p 很小，且集中在相同号码/相同局段，需要重点复查。");
  lines.push("2. 如果极端窗口在 Monte Carlo 中也经常出现，则属于长序列里自然会出现的局部爆发，不应直接视为破绽。");
  lines.push("3. 同号三连、四连、短窗多次同号这类局部结构，比总体红黑单双更适合检查程序调偏。");

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(lines.join("\n"));
}

main();
