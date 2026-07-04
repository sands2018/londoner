import fs from "node:fs";
import path from "node:path";

import { getNumberColRows, type RouletteNumber } from "../app/src/core/roulette";

interface RawRow {
  Name?: string;
  Numbers?: string | number[];
  DataTms?: number;
  tms?: number;
}

interface Session {
  importIndex: number;
  name: string;
  numbers: RouletteNumber[];
  updatedTms: number;
  dataTms?: number;
  start: number;
  end: number;
}

interface GapEvent {
  category: number;
  gap: number;
  closePosition: number;
  effectiveClosePosition: number;
  intervalIndex: number;
  sessionName: string;
  sessionOffset: number;
}

interface Chain {
  category: number;
  size: number;
  events: GapEvent[];
}

interface AnalysisResult {
  eventCount: number;
  maxChain: number;
  chainsAtLeast3: number;
  topChains: Chain[];
}

interface SummaryRecord {
  threshold: number;
  scope: ScopeId;
  allowed: number;
  observed: AnalysisResult;
}

interface MonteCarloStats {
  expectedMax: number;
  pMax: number;
  expectedChains3: number;
  pChains3: number;
}

type ScopeId = "groups" | "rows" | "all";

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "same-item-long-gap-repeat-20260703.md");

const RECENT_SESSION_COUNT = 15;
const THRESHOLDS = [10, 9, 8, 7, 6];
const ALLOW_NORMAL_BETWEEN = [0, 1, 2, 3];
const SIMULATIONS = 200;

const CATEGORY_LABELS = ["一组", "二组", "三组", "1行", "2行", "3行"];
const SCOPE_LABELS: Record<ScopeId, string> = {
  groups: "只看组",
  rows: "只看行",
  all: "组+行",
};

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

function loadSessions(): Session[] {
  const rawRows = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8")) as RawRow[];
  const base = rawRows.map((row, index) => ({
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

  const sessions: Session[] = [];
  let start = 0;
  for (const session of base) {
    sessions.push({ ...session, start, end: start + session.numbers.length });
    start += session.numbers.length;
  }
  return sessions;
}

function flattenNumbers(sessions: readonly Session[]): RouletteNumber[] {
  return sessions.flatMap((session) => session.numbers);
}

function locateSession(sessions: readonly Session[], position: number): Session {
  let left = 0;
  let right = sessions.length - 1;
  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const session = sessions[middle];
    if (position < session.start) right = middle - 1;
    else if (position >= session.end) left = middle + 1;
    else return session;
  }
  return sessions[sessions.length - 1];
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
  return Array.from({ length }, () => Math.floor(rng() * 37) as RouletteNumber);
}

function categoryIndexes(scope: ScopeId): number[] {
  if (scope === "groups") return [0, 1, 2];
  if (scope === "rows") return [3, 4, 5];
  return [0, 1, 2, 3, 4, 5];
}

function buildGapEvents(numbers: readonly RouletteNumber[], sessions: readonly Session[] | null): GapEvent[] {
  const previousEffective = Array<number>(6).fill(-1);
  const intervalIndexes = Array<number>(6).fill(0);
  const events: GapEvent[] = [];
  let effectivePosition = -1;

  for (let position = 0; position < numbers.length; position += 1) {
    const number = numbers[position];
    if (number === 0) continue;
    effectivePosition += 1;

    for (const category of getNumberColRows(number).map((item) => item as number)) {
      if (previousEffective[category] >= 0) {
        intervalIndexes[category] += 1;
        const session = sessions ? locateSession(sessions, position) : null;
        events.push({
          category,
          gap: effectivePosition - previousEffective[category] - 1,
          closePosition: position,
          effectiveClosePosition: effectivePosition,
          intervalIndex: intervalIndexes[category],
          sessionName: session?.name ?? "-",
          sessionOffset: session ? position - session.start : position,
        });
      }
      previousEffective[category] = effectivePosition;
    }
  }

  return events;
}

function analyzeRepeat(
  gapEvents: readonly GapEvent[],
  recentStart: number,
  threshold: number,
  scope: ScopeId,
  allowedNormalBetween: number,
): AnalysisResult {
  const categories = categoryIndexes(scope);
  const chains: Chain[] = [];
  let eventCount = 0;

  for (const category of categories) {
    const longs = gapEvents
      .filter((event) => event.category === category && event.gap >= threshold && event.closePosition >= recentStart)
      .sort((left, right) => left.intervalIndex - right.intervalIndex);
    eventCount += longs.length;
    if (longs.length === 0) continue;

    let current: GapEvent[] = [longs[0]];
    for (let index = 1; index < longs.length; index += 1) {
      const previous = current[current.length - 1];
      const event = longs[index];
      const normalBetween = event.intervalIndex - previous.intervalIndex - 1;
      if (normalBetween <= allowedNormalBetween) {
        current.push(event);
      } else {
        chains.push({ category, size: current.length, events: current });
        current = [event];
      }
    }
    chains.push({ category, size: current.length, events: current });
  }

  chains.sort((left, right) => (
    right.size - left.size
    || right.events.reduce((sum, event) => sum + event.gap, 0) - left.events.reduce((sum, event) => sum + event.gap, 0)
    || left.events[0].closePosition - right.events[0].closePosition
  ));

  return {
    eventCount,
    maxChain: chains[0]?.size ?? 0,
    chainsAtLeast3: chains.filter((chain) => chain.size >= 3).length,
    topChains: chains.slice(0, 6),
  };
}

function recordKey(record: Pick<SummaryRecord, "threshold" | "scope" | "allowed">): string {
  return `${record.threshold}|${record.scope}|${record.allowed}`;
}

function monteCarloBatch(
  numbersLength: number,
  recentStart: number,
  records: readonly SummaryRecord[],
): Map<string, MonteCarloStats> {
  const rng = mulberry32(20260705);
  const sums = new Map<string, {
    max: number;
    maxExtreme: number;
    chains3: number;
    chains3Extreme: number;
  }>();
  for (const record of records) {
    sums.set(recordKey(record), { max: 0, maxExtreme: 0, chains3: 0, chains3Extreme: 0 });
  }

  for (let run = 0; run < SIMULATIONS; run += 1) {
    const random = randomSequence(numbersLength, rng);
    const gapEvents = buildGapEvents(random, null);
    for (const record of records) {
      const result = analyzeRepeat(gapEvents, recentStart, record.threshold, record.scope, record.allowed);
      const bucket = sums.get(recordKey(record));
      if (!bucket) continue;
      bucket.max += result.maxChain;
      bucket.chains3 += result.chainsAtLeast3;
      if (result.maxChain >= record.observed.maxChain) bucket.maxExtreme += 1;
      if (result.chainsAtLeast3 >= record.observed.chainsAtLeast3) bucket.chains3Extreme += 1;
    }
  }

  const result = new Map<string, MonteCarloStats>();
  for (const [key, bucket] of sums) {
    result.set(key, {
      expectedMax: bucket.max / SIMULATIONS,
      pMax: (bucket.maxExtreme + 1) / (SIMULATIONS + 1),
      expectedChains3: bucket.chains3 / SIMULATIONS,
      pChains3: (bucket.chains3Extreme + 1) / (SIMULATIONS + 1),
    });
  }
  return result;
}

function fmtP(p: number): string {
  if (p <= 1 / (SIMULATIONS + 1)) return `<=${(1 / (SIMULATIONS + 1)).toFixed(4)}`;
  return p.toFixed(4);
}

function fmtCategory(category: number): string {
  return CATEGORY_LABELS[category] ?? String(category);
}

function fmtEvent(event: GapEvent): string {
  return `${event.gap} @ ${event.sessionName} #${event.sessionOffset}`;
}

function fmtChain(chain: Chain | undefined): string {
  if (!chain) return "-";
  return `${fmtCategory(chain.category)} ${chain.size}次：${chain.events.map(fmtEvent).join("<br>")}`;
}

function buildReport(): string {
  const sessions = loadSessions();
  const numbers = flattenNumbers(sessions);
  const recent = sessions.slice(-RECENT_SESSION_COUNT);
  const recentStart = recent[0].start;
  const gapEvents = buildGapEvents(numbers, sessions);
  const lines: string[] = [];

  lines.push("# 同组/同行重复长套检查");
  lines.push("");
  lines.push("输入：`HistoryData/data_20260703.json`");
  lines.push(`范围：最新 ${recent.length} 局，${numbers.length - recentStart} 个号码；时间 ${formatDate(sessionTime(recent[0]))} 到 ${formatDate(sessionTime(recent[recent.length - 1]))}。`);
  lines.push("口径：0 跳过；先用全历史建立每个组/行自己的 gap 序列，再只统计关闭点落在最近范围内的长套。");
  lines.push("这里的“连续”指同一个组/行重复长套；允许夹普通间隔=0/1/2/3，表示两次长套之间最多允许夹几次未达到阈值的普通 gap。");
  lines.push("");

  const records: SummaryRecord[] = [];
  for (const threshold of THRESHOLDS) {
    for (const scope of ["groups", "rows", "all"] as ScopeId[]) {
      for (const allowed of ALLOW_NORMAL_BETWEEN) {
        records.push({
          threshold,
          scope,
          allowed,
          observed: analyzeRepeat(gapEvents, recentStart, threshold, scope, allowed),
        });
      }
    }
  }
  const mcRecords = records.filter((record) => (
    record.observed.maxChain >= 3 || record.observed.chainsAtLeast3 > 0
  ));
  const mcStats = monteCarloBatch(numbers.length, recentStart, mcRecords);

  lines.push("## 汇总");
  lines.push("");
  lines.push("| 阈值 | 口径 | 允许夹普通 | 长套次数 | 最大连发 obs/exp/p | 3连簇数 obs/exp/p | 最大连发详情 |");
  lines.push("|---:|---|---:|---:|---:|---:|---|");
  for (const record of records) {
    const observed = record.observed;
    const mc = mcStats.get(recordKey(record));
    lines.push([
      `| ${record.threshold}`,
      SCOPE_LABELS[record.scope],
      String(record.allowed),
      String(observed.eventCount),
      mc ? `${observed.maxChain}/${mc.expectedMax.toFixed(1)}/${fmtP(mc.pMax)}` : `${observed.maxChain}/-/-`,
      mc ? `${observed.chainsAtLeast3}/${mc.expectedChains3.toFixed(1)}/${fmtP(mc.pChains3)}` : `${observed.chainsAtLeast3}/-/-`,
      `${fmtChain(observed.topChains[0])} |`,
    ].join(" | "));
  }
  lines.push("");

  lines.push("## 重点 3 连以上");
  lines.push("");
  for (const record of records) {
    const chains = record.observed.topChains.filter((chain) => chain.size >= 3);
    if (chains.length === 0) continue;
    lines.push(`### 阈值 ${record.threshold} / ${SCOPE_LABELS[record.scope]} / 允许夹普通 ${record.allowed}`);
    lines.push("");
    for (const chain of chains.slice(0, 5)) {
      lines.push(`- ${fmtChain(chain)}`);
    }
    lines.push("");
  }

  lines.push("## 初步读法");
  lines.push("");
  lines.push("1. 允许夹普通 0 是最严格口径：同一个组/行的连续多个 gap 都必须达到阈值。");
  lines.push("2. 允许夹普通 1/2/3 更接近实战感觉：中间可以正常出过几次，但同一个组/行很快又进入长套。");
  lines.push("3. 如果最大连发或 3连簇数的 p 很小，说明这种同项反复长套比随机更集中；否则更多是自然波动。");
  lines.push("");

  return lines.join("\n");
}

const report = buildReport();
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, report, "utf8");
console.log(report);
