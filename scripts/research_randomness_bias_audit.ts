import fs from "node:fs";
import path from "node:path";

import type { RouletteNumber } from "../app/src/core/roulette";

interface RawRow {
  Count?: number;
  Name?: string;
  Numbers?: string | number[];
  DataTms?: number;
  tms?: number;
  TableId?: string;
  tableId?: string;
}

interface Session {
  id: string;
  importIndex: number;
  name: string;
  numbers: RouletteNumber[];
  updatedTms: number;
  dataTms?: number;
}

interface CountRow {
  key: string;
  observed: number;
  expected: number;
  z: number;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "randomness-bias-audit-20260703.md");

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_INDEX = new Map<RouletteNumber, number>(
  WHEEL_ORDER.map((number, index) => [number, index]),
);

const RED = new Set<RouletteNumber>([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK = new Set<RouletteNumber>([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

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

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => (
    Number.isInteger(value) && value >= 0 && value <= 36
  ));
}

function sessionTime(session: Session): number {
  return Number.isFinite(session.dataTms) ? session.dataTms ?? 0 : session.updatedTms;
}

function formatDate(tms: number | undefined): string {
  if (!Number.isFinite(tms)) return "-";
  return new Date(tms as number).toISOString().slice(0, 10);
}

function loadSessions(): { sessions: Session[]; rawCount: number; manualRows: number } {
  const rawRows = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8")) as RawRow[];
  const sessions = rawRows.map((row, index) => ({
    id: `row-${index + 1}`,
    importIndex: index,
    name: row.Name ?? `row-${index + 1}`,
    numbers: parseNumbers(row.Numbers),
    updatedTms: row.tms ?? row.DataTms ?? index,
    dataTms: row.DataTms,
  })).filter((session) => session.numbers.length > 0);

  sessions.sort((left, right) => (
    sessionTime(left) - sessionTime(right)
    || left.importIndex - right.importIndex
    || left.name.localeCompare(right.name, "zh-Hans-CN")
  ));

  return {
    sessions,
    rawCount: rawRows.length,
    manualRows: rawRows.filter((row) => Boolean(row.TableId ?? row.tableId)).length,
  };
}

function wheelIndex(number: RouletteNumber): number {
  return WHEEL_INDEX.get(number) ?? 0;
}

function wheelDistance(left: RouletteNumber, right: RouletteNumber): number {
  const distance = Math.abs(wheelIndex(left) - wheelIndex(right));
  return Math.min(distance, WHEEL_ORDER.length - distance);
}

function average(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function erf(x: number): number {
  const sign = x >= 0 ? 1 : -1;
  const absX = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * absX);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function normalTwoSidedP(z: number): number {
  return Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
}

function gammaln(xx: number): number {
  const cof = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5,
  ];
  let x = xx - 1;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;
  for (const value of cof) {
    x += 1;
    ser += value / x;
  }
  return -tmp + Math.log(2.5066282746310005 * ser);
}

function gammaP(a: number, x: number): number {
  if (x <= 0) return 0;
  const gln = gammaln(a);
  if (x < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 100; n += 1) {
      ap += 1;
      del *= x / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 3e-7) break;
    }
    return sum * Math.exp(-x + a * Math.log(x) - gln);
  }
  return 1 - gammaQ(a, x);
}

function gammaQ(a: number, x: number): number {
  if (x <= 0) return 1;
  const gln = gammaln(a);
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 100; i += 1) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 3e-7) break;
  }
  return Math.exp(-x + a * Math.log(x) - gln) * h;
}

function chiSquareP(stat: number, df: number): number {
  if (df <= 0) return 1;
  return Math.max(0, Math.min(1, gammaQ(df / 2, stat / 2)));
}

function chiSquare(observed: readonly number[], expected: readonly number[]): { stat: number; df: number; p: number } {
  const rows = observed.map((obs, index) => ({ obs, exp: expected[index] })).filter((row) => row.exp > 0);
  const stat = rows.reduce((sum, row) => {
    const diff = row.obs - row.exp;
    return sum + diff * diff / row.exp;
  }, 0);
  const df = Math.max(1, rows.length - 1);
  return { stat, df, p: chiSquareP(stat, df) };
}

function binomialZ(observed: number, n: number, p: number): { z: number; twoSidedP: number } {
  const variance = n * p * (1 - p);
  const z = variance > 0 ? (observed - n * p) / Math.sqrt(variance) : 0;
  return { z, twoSidedP: normalTwoSidedP(z) };
}

function countRows(numbers: readonly RouletteNumber[]): CountRow[] {
  const n = numbers.length;
  const counts = Array(37).fill(0);
  numbers.forEach((number) => { counts[number] += 1; });
  const expected = n / 37;
  const sd = Math.sqrt(n * (1 / 37) * (36 / 37));
  return counts.map((observed, number) => ({
    key: String(number),
    observed,
    expected,
    z: sd > 0 ? (observed - expected) / sd : 0,
  }));
}

function categoryCounts(numbers: readonly RouletteNumber[], category: (number: RouletteNumber) => string): Map<string, number> {
  const map = new Map<string, number>();
  numbers.forEach((number) => {
    const key = category(number);
    map.set(key, (map.get(key) ?? 0) + 1);
  });
  return map;
}

function colorOf(number: RouletteNumber): string {
  if (number === 0) return "zero";
  if (RED.has(number)) return "red";
  if (BLACK.has(number)) return "black";
  return "unknown";
}

function dozenOf(number: RouletteNumber): string {
  if (number === 0) return "zero";
  if (number <= 12) return "D1";
  if (number <= 24) return "D2";
  return "D3";
}

function rowOf(number: RouletteNumber): string {
  if (number === 0) return "zero";
  for (let index = 0; index < ROWS.length; index += 1) {
    if (ROWS[index].includes(number)) return `R${index + 1}`;
  }
  return "unknown";
}

function parityOf(number: RouletteNumber): string {
  if (number === 0) return "zero";
  return number % 2 === 0 ? "even" : "odd";
}

function highLowOf(number: RouletteNumber): string {
  if (number === 0) return "zero";
  return number <= 18 ? "low" : "high";
}

function categoryChi(
  numbers: readonly RouletteNumber[],
  keys: readonly string[],
  expectedProb: ReadonlyMap<string, number>,
  category: (number: RouletteNumber) => string,
): { rows: CountRow[]; chi: { stat: number; df: number; p: number } } {
  const counts = categoryCounts(numbers, category);
  const observed = keys.map((key) => counts.get(key) ?? 0);
  const expected = keys.map((key) => numbers.length * (expectedProb.get(key) ?? 0));
  return {
    rows: keys.map((key, index) => ({
      key,
      observed: observed[index],
      expected: expected[index],
      z: expected[index] > 0 ? (observed[index] - expected[index]) / Math.sqrt(expected[index] * (1 - (expectedProb.get(key) ?? 0))) : 0,
    })),
    chi: chiSquare(observed, expected),
  };
}

function formatP(p: number): string {
  if (p < 1e-12) return "<1e-12";
  if (p < 0.0001) return p.toExponential(2);
  return p.toFixed(4);
}

function formatZ(z: number): string {
  return z >= 0 ? `+${z.toFixed(2)}` : z.toFixed(2);
}

function topRows(rows: readonly CountRow[], count: number, direction: "high" | "low" | "abs" = "abs"): CountRow[] {
  return [...rows].sort((left, right) => {
    if (direction === "high") return right.z - left.z;
    if (direction === "low") return left.z - right.z;
    return Math.abs(right.z) - Math.abs(left.z);
  }).slice(0, count);
}

function sectorScan(numbers: readonly RouletteNumber[], size: number): CountRow[] {
  const counts = Array(37).fill(0);
  numbers.forEach((number) => { counts[wheelIndex(number)] += 1; });
  const p = size / 37;
  const expected = numbers.length * p;
  const sd = Math.sqrt(numbers.length * p * (1 - p));
  return WHEEL_ORDER.map((center, centerIndex) => {
    const half = Math.floor(size / 2);
    let observed = 0;
    const sectorNumbers: RouletteNumber[] = [];
    for (let offset = -half; offset <= half; offset += 1) {
      const index = (centerIndex + offset + 37) % 37;
      observed += counts[index];
      sectorNumbers.push(WHEEL_ORDER[index]);
    }
    return {
      key: `${center} [${sectorNumbers.join("-")}]`,
      observed,
      expected,
      z: sd > 0 ? (observed - expected) / sd : 0,
    };
  });
}

function maxRun(numbers: readonly RouletteNumber[], predicate: (number: RouletteNumber) => boolean): number {
  let best = 0;
  let current = 0;
  numbers.forEach((number) => {
    if (predicate(number)) {
      current += 1;
      best = Math.max(best, current);
    } else {
      current = 0;
    }
  });
  return best;
}

function transitionMatrix(numbers: readonly RouletteNumber[]): number[][] {
  const matrix = Array.from({ length: 37 }, () => Array(37).fill(0));
  for (let index = 1; index < numbers.length; index += 1) {
    matrix[numbers[index - 1]][numbers[index]] += 1;
  }
  return matrix;
}

function transitionChi(numbers: readonly RouletteNumber[]): { stat: number; df: number; p: number } {
  const matrix = transitionMatrix(numbers);
  let stat = 0;
  let df = 0;
  matrix.forEach((row) => {
    const total = row.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return;
    const expected = total / 37;
    row.forEach((value) => {
      const diff = value - expected;
      stat += diff * diff / expected;
    });
    df += 36;
  });
  return { stat, df, p: chiSquareP(stat, df) };
}

function topTransitionResiduals(numbers: readonly RouletteNumber[], count: number): Array<{ pair: string; observed: number; expected: number; z: number }> {
  const matrix = transitionMatrix(numbers);
  const rows: Array<{ pair: string; observed: number; expected: number; z: number }> = [];
  matrix.forEach((row, from) => {
    const total = row.reduce((sum, value) => sum + value, 0);
    if (total <= 0) return;
    const expected = total / 37;
    const sd = Math.sqrt(total * (1 / 37) * (36 / 37));
    row.forEach((observed, to) => {
      rows.push({
        pair: `${from}->${to}`,
        observed,
        expected,
        z: sd > 0 ? (observed - expected) / sd : 0,
      });
    });
  });
  return rows.sort((left, right) => Math.abs(right.z) - Math.abs(left.z)).slice(0, count);
}

function wheelDistanceRows(numbers: readonly RouletteNumber[]): CountRow[] {
  const total = numbers.length - 1;
  const counts = Array(19).fill(0);
  for (let index = 1; index < numbers.length; index += 1) {
    counts[wheelDistance(numbers[index - 1], numbers[index])] += 1;
  }
  return counts.map((observed, distance) => {
    const p = distance === 0 ? 1 / 37 : 2 / 37;
    const expected = total * p;
    return {
      key: String(distance),
      observed,
      expected,
      z: (observed - expected) / Math.sqrt(total * p * (1 - p)),
    };
  });
}

function gapRows(numbers: readonly RouletteNumber[]): CountRow[] {
  const buckets = [
    { key: "1", min: 1, max: 1 },
    { key: "2", min: 2, max: 2 },
    { key: "3-5", min: 3, max: 5 },
    { key: "6-10", min: 6, max: 10 },
    { key: "11-20", min: 11, max: 20 },
    { key: "21-40", min: 21, max: 40 },
    { key: "41-80", min: 41, max: 80 },
    { key: ">80", min: 81, max: Infinity },
  ];
  const gaps: number[] = [];
  for (let number = 0; number <= 36; number += 1) {
    let last = -1;
    numbers.forEach((value, index) => {
      if (value !== number) return;
      if (last >= 0) gaps.push(index - last);
      last = index;
    });
  }
  const p = 1 / 37;
  const observed = buckets.map((bucket) => gaps.filter((gap) => gap >= bucket.min && gap <= bucket.max).length);
  const expectedProb = buckets.map((bucket) => {
    const start = bucket.min;
    if (!Number.isFinite(bucket.max)) return Math.pow(1 - p, start - 1);
    let prob = 0;
    for (let gap = start; gap <= bucket.max; gap += 1) {
      prob += Math.pow(1 - p, gap - 1) * p;
    }
    return prob;
  });
  const total = gaps.length;
  return buckets.map((bucket, index) => ({
    key: bucket.key,
    observed: observed[index],
    expected: total * expectedProb[index],
    z: (observed[index] - total * expectedProb[index]) / Math.sqrt(total * expectedProb[index] * (1 - expectedProb[index])),
  }));
}

function segmentRows(numbers: readonly RouletteNumber[], segments: number): Array<{ segment: string; chi: { stat: number; df: number; p: number }; topHigh: CountRow[]; topLow: CountRow[] }> {
  return Array.from({ length: segments }, (_, index) => {
    const start = Math.floor(numbers.length * index / segments);
    const end = Math.floor(numbers.length * (index + 1) / segments);
    const slice = numbers.slice(start, end);
    const rows = countRows(slice);
    const observed = rows.map((row) => row.observed);
    const expected = rows.map((row) => row.expected);
    return {
      segment: `${index + 1}`,
      chi: chiSquare(observed, expected),
      topHigh: topRows(rows, 3, "high"),
      topLow: topRows(rows, 3, "low"),
    };
  });
}

function formatCountRow(row: CountRow): string {
  return `${row.key}: ${row.observed} vs ${row.expected.toFixed(1)} z=${formatZ(row.z)}`;
}

function main(): void {
  const { sessions, rawCount, manualRows } = loadSessions();
  const numbers = sessions.flatMap((session) => session.numbers);
  const total = numbers.length;
  const countByNumber = countRows(numbers);
  const countChi = chiSquare(countByNumber.map((row) => row.observed), countByNumber.map((row) => row.expected));
  const color = categoryChi(
    numbers,
    ["red", "black", "zero"],
    new Map([["red", 18 / 37], ["black", 18 / 37], ["zero", 1 / 37]]),
    colorOf,
  );
  const parity = categoryChi(
    numbers,
    ["odd", "even", "zero"],
    new Map([["odd", 18 / 37], ["even", 18 / 37], ["zero", 1 / 37]]),
    parityOf,
  );
  const highLow = categoryChi(
    numbers,
    ["low", "high", "zero"],
    new Map([["low", 18 / 37], ["high", 18 / 37], ["zero", 1 / 37]]),
    highLowOf,
  );
  const dozen = categoryChi(
    numbers,
    ["D1", "D2", "D3", "zero"],
    new Map([["D1", 12 / 37], ["D2", 12 / 37], ["D3", 12 / 37], ["zero", 1 / 37]]),
    dozenOf,
  );
  const row = categoryChi(
    numbers,
    ["R1", "R2", "R3", "zero"],
    new Map([["R1", 12 / 37], ["R2", 12 / 37], ["R3", 12 / 37], ["zero", 1 / 37]]),
    rowOf,
  );

  const repeats = numbers.slice(1).filter((number, index) => number === numbers[index]).length;
  const repeatZ = binomialZ(repeats, total - 1, 1 / 37);
  const colorRepeats = numbers.slice(1).filter((number, index) => colorOf(number) !== "zero" && colorOf(number) === colorOf(numbers[index])).length;
  const nonZeroPairs = numbers.slice(1).filter((number, index) => number !== 0 && numbers[index] !== 0).length;
  const colorRepeatZ = binomialZ(colorRepeats, nonZeroPairs, 0.5);
  const transition = transitionChi(numbers);
  const distanceRows = wheelDistanceRows(numbers);
  const distanceChi = chiSquare(distanceRows.map((item) => item.observed), distanceRows.map((item) => item.expected));
  const gap = gapRows(numbers);
  const gapChi = chiSquare(gap.map((item) => item.observed), gap.map((item) => item.expected));
  const segments = segmentRows(numbers, 10);

  const lines: string[] = [];
  lines.push("# 连续数据随机性/概率偏向审计");
  lines.push("");
  lines.push(`输入：\`${path.relative(ROOT, INPUT_FILE).replace(/\\/g, "/")}\``);
  lines.push(`原始记录 ${rawCount} 条；参与拼接 ${sessions.length} 条；总号码 ${total} 个。`);
  lines.push(`文件中带手工 TableId 的记录 ${manualRows} 条；本审计不使用 TableId。`);
  lines.push(`拼接顺序：按 dataTms/tms/importIndex/name 排序；时间范围 ${formatDate(sessionTime(sessions[0]))} 到 ${formatDate(sessionTime(sessions[sessions.length - 1]))}。`);
  lines.push("本报告假设所有号码首尾相连；因此跨局边界也被当作连续转移。");
  lines.push("");
  lines.push("## 1. 总体单号频率");
  lines.push("");
  lines.push(`- 37 单号均匀卡方：chi2=${countChi.stat.toFixed(2)}, df=${countChi.df}, p=${formatP(countChi.p)}。`);
  lines.push(`- 最大正偏：${formatCountRow(topRows(countByNumber, 1, "high")[0])}。`);
  lines.push(`- 最大负偏：${formatCountRow(topRows(countByNumber, 1, "low")[0])}。`);
  lines.push("");
  lines.push("| number | observed | expected | z |");
  lines.push("|---|---:|---:|---:|");
  topRows(countByNumber, 12, "abs").forEach((item) => {
    lines.push(`| ${item.key} | ${item.observed} | ${item.expected.toFixed(1)} | ${formatZ(item.z)} |`);
  });
  lines.push("");
  lines.push("## 2. 基础分类频率");
  lines.push("");
  lines.push("| category | chi2 / p | details |");
  lines.push("|---|---|---|");
  [
    ["red/black/zero", color],
    ["odd/even/zero", parity],
    ["low/high/zero", highLow],
    ["dozen/zero", dozen],
    ["row/zero", row],
  ].forEach(([label, result]) => {
    const typed = result as typeof color;
    lines.push(`| ${label} | chi2=${typed.chi.stat.toFixed(2)}, p=${formatP(typed.chi.p)} | ${typed.rows.map(formatCountRow).join("<br>")} |`);
  });
  lines.push("");
  lines.push("## 3. 轮盘邻区扫描");
  lines.push("");
  [3, 5, 7, 9].forEach((size) => {
    const scan = sectorScan(numbers, size);
    lines.push(`### ${size} 邻区 top 偏离`);
    lines.push("");
    lines.push("| rank | sector | observed | expected | z |");
    lines.push("|---:|---|---:|---:|---:|");
    topRows(scan, 8, "abs").forEach((item, index) => {
      lines.push(`| ${index + 1} | ${item.key} | ${item.observed} | ${item.expected.toFixed(1)} | ${formatZ(item.z)} |`);
    });
    lines.push("");
  });
  lines.push("## 4. 顺序结构");
  lines.push("");
  lines.push(`- 相邻同号：${repeats}，期望 ${((total - 1) / 37).toFixed(1)}，z=${formatZ(repeatZ.z)}，p=${formatP(repeatZ.twoSidedP)}。`);
  lines.push(`- 非零相邻同色：${colorRepeats}/${nonZeroPairs}，期望 ${(nonZeroPairs * 0.5).toFixed(1)}，z=${formatZ(colorRepeatZ.z)}，p=${formatP(colorRepeatZ.twoSidedP)}。`);
  lines.push(`- 37x37 转移矩阵独立性：chi2=${transition.stat.toFixed(2)}, df=${transition.df}, p=${formatP(transition.p)}。`);
  lines.push(`- 轮盘距离分布：chi2=${distanceChi.stat.toFixed(2)}, df=${distanceChi.df}, p=${formatP(distanceChi.p)}。`);
  lines.push("");
  lines.push("### 最大转移残差");
  lines.push("");
  lines.push("| pair | observed | expected | z |");
  lines.push("|---|---:|---:|---:|");
  topTransitionResiduals(numbers, 16).forEach((item) => {
    lines.push(`| ${item.pair} | ${item.observed} | ${item.expected.toFixed(1)} | ${formatZ(item.z)} |`);
  });
  lines.push("");
  lines.push("### 轮盘距离分布");
  lines.push("");
  lines.push("| distance | observed | expected | z |");
  lines.push("|---:|---:|---:|---:|");
  distanceRows.forEach((item) => {
    lines.push(`| ${item.key} | ${item.observed} | ${item.expected.toFixed(1)} | ${formatZ(item.z)} |`);
  });
  lines.push("");
  lines.push("## 5. Gap 分布");
  lines.push("");
  lines.push(`- 所有单号相邻出现间隔合并后，几何分布卡方：chi2=${gapChi.stat.toFixed(2)}, df=${gapChi.df}, p=${formatP(gapChi.p)}。`);
  lines.push("");
  lines.push("| gap bucket | observed | expected | z |");
  lines.push("|---|---:|---:|---:|");
  gap.forEach((item) => {
    lines.push(`| ${item.key} | ${item.observed} | ${item.expected.toFixed(1)} | ${formatZ(item.z)} |`);
  });
  lines.push("");
  lines.push("## 6. 连续段/极端运行");
  lines.push("");
  lines.push(`- 最长红色连续：${maxRun(numbers, (number) => colorOf(number) === "red")}。`);
  lines.push(`- 最长黑色连续：${maxRun(numbers, (number) => colorOf(number) === "black")}。`);
  lines.push(`- 最长非零奇数连续：${maxRun(numbers, (number) => parityOf(number) === "odd")}。`);
  lines.push(`- 最长非零偶数连续：${maxRun(numbers, (number) => parityOf(number) === "even")}。`);
  lines.push(`- 最长低区连续：${maxRun(numbers, (number) => highLowOf(number) === "low")}。`);
  lines.push(`- 最长高区连续：${maxRun(numbers, (number) => highLowOf(number) === "high")}。`);
  lines.push("");
  lines.push("## 7. 十段漂移");
  lines.push("");
  lines.push("| segment | chi2 / p | high numbers | low numbers |");
  lines.push("|---:|---|---|---|");
  segments.forEach((segment) => {
    lines.push(`| ${segment.segment} | chi2=${segment.chi.stat.toFixed(1)}, p=${formatP(segment.chi.p)} | ${segment.topHigh.map(formatCountRow).join("<br>")} | ${segment.topLow.map(formatCountRow).join("<br>")} |`);
  });
  lines.push("");
  lines.push("## 8. 初步判断口径");
  lines.push("");
  lines.push("1. 单项 p 很小不等于人为调偏；这里有大量重复检验，而且数据来自不同日期/地点/局，非平稳性本身会放大异常。");
  lines.push("2. 更值得警惕的是同一方向在多个独立角度同时异常，例如单号频率、邻区扫描、gap、转移矩阵、分段漂移都指向同一区域。");
  lines.push("3. 如果只有轮盘邻区/分段漂移显著，而总体单号和基础分类不显著，更像是不同局面混合后的空间结构，不足以证明数据被程序调偏。");
  lines.push("4. 下一步若要更严谨，应把跨局边界去掉，再按年份/场地/最新局分别重复同样审计。");

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(lines.join("\n"));
}

main();
