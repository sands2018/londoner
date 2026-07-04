import fs from "node:fs";
import path from "node:path";

import { getNumberColRows, type RouletteNumber } from "../app/src/core/roulette";

interface RawRow {
  Count?: number;
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

interface LongEvent {
  category: number;
  gap: number;
  position: number;
  nonZeroPosition: number;
  sessionName: string;
  sessionOffset: number;
}

interface Cluster {
  start: number;
  end: number;
  size: number;
  events: LongEvent[];
}

interface GapMetrics {
  totalEvents: number;
  maxGap: number;
  maxActive: number;
  activeAtLeast3Spins: number;
  maxCloseCluster5: number;
  closeClustersAtLeast3: number;
  maxStartCluster5: number;
  startClustersAtLeast3: number;
}

interface SummaryRow {
  threshold: number;
  scope: ScopeId;
  observed: GapMetrics;
  expected: GapMetrics;
  p: Record<keyof GapMetrics, number>;
  topCloseClusters: Cluster[];
  topStartClusters: Cluster[];
  topEvents: LongEvent[];
}

type ScopeId = "groups" | "rows" | "all";

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "long-gap-cluster-audit-20260703.md");

const SIMULATIONS = 500;
const THRESHOLDS = [10, 12, 15, 20];
const CLUSTER_SPAN = 5;
const CATEGORY_LABELS = ["一组", "二组", "三组", "1行", "2行", "3行"];
const SCOPE_LABELS: Record<ScopeId, string> = {
  groups: "组",
  rows: "行",
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

function loadSessions(): { sessions: Session[]; rawCount: number; numbers: RouletteNumber[] } {
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

  const numbers: RouletteNumber[] = [];
  const sessions: Session[] = [];
  for (const item of base) {
    const start = numbers.length;
    numbers.push(...item.numbers);
    sessions.push({ ...item, start, end: numbers.length });
  }

  return { sessions, rawCount: rawRows.length, numbers };
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

function categoriesForScope(number: RouletteNumber, scope: ScopeId): number[] {
  const hits = getNumberColRows(number).map((item) => item as number);
  if (scope === "groups") return hits.filter((item) => item < 3);
  if (scope === "rows") return hits.filter((item) => item >= 3);
  return hits;
}

function categoryIndexes(scope: ScopeId): number[] {
  if (scope === "groups") return [0, 1, 2];
  if (scope === "rows") return [3, 4, 5];
  return [0, 1, 2, 3, 4, 5];
}

function emptyMetrics(): GapMetrics {
  return {
    totalEvents: 0,
    maxGap: 0,
    maxActive: 0,
    activeAtLeast3Spins: 0,
    maxCloseCluster5: 0,
    closeClustersAtLeast3: 0,
    maxStartCluster5: 0,
    startClustersAtLeast3: 0,
  };
}

function buildClusters(events: readonly LongEvent[], maxDistance: number): Cluster[] {
  if (events.length === 0) return [];
  const ordered = [...events].sort((left, right) => (
    left.nonZeroPosition - right.nonZeroPosition
    || left.position - right.position
    || left.category - right.category
  ));
  const clusters: Cluster[] = [];
  let current: LongEvent[] = [ordered[0]];
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = current[current.length - 1];
    const event = ordered[index];
    if (event.nonZeroPosition - previous.nonZeroPosition <= maxDistance) {
      current.push(event);
    } else {
      clusters.push(toCluster(current));
      current = [event];
    }
  }
  clusters.push(toCluster(current));
  return clusters.sort((left, right) => right.size - left.size || left.start - right.start);
}

function toCluster(events: readonly LongEvent[]): Cluster {
  return {
    start: events[0].nonZeroPosition,
    end: events[events.length - 1].nonZeroPosition,
    size: events.length,
    events: [...events],
  };
}

function analyzeSequence(
  numbers: readonly RouletteNumber[],
  sessions: readonly Session[] | null,
  threshold: number,
  scope: ScopeId,
  countZeroAsMiss: boolean,
): { metrics: GapMetrics; closeClusters: Cluster[]; startClusters: Cluster[]; topEvents: LongEvent[] } {
  const indexes = categoryIndexes(scope);
  const gaps = Array<number>(6).fill(0);
  const closeEvents: LongEvent[] = [];
  const startEvents: LongEvent[] = [];
  let nonZeroPosition = -1;
  let maxActive = 0;
  let activeAtLeast3Spins = 0;

  for (let position = 0; position < numbers.length; position += 1) {
    const number = numbers[position];
    const hits = categoriesForScope(number, scope);
    const shouldStep = number !== 0 || countZeroAsMiss;
    if (!shouldStep) continue;
    if (number !== 0 || countZeroAsMiss) nonZeroPosition += 1;

    const hitSet = new Set(hits);
    for (const category of indexes) {
      if (hitSet.has(category)) {
        if (gaps[category] >= threshold) {
          closeEvents.push(makeLongEvent(category, gaps[category], position, nonZeroPosition, sessions));
        }
        gaps[category] = 0;
      } else {
        gaps[category] += 1;
        if (gaps[category] === threshold) {
          startEvents.push(makeLongEvent(category, gaps[category], position, nonZeroPosition, sessions));
        }
      }
    }

    const active = indexes.filter((category) => gaps[category] >= threshold).length;
    maxActive = Math.max(maxActive, active);
    if (active >= 3) activeAtLeast3Spins += 1;
  }

  const closeClusters = buildClusters(closeEvents, CLUSTER_SPAN);
  const startClusters = buildClusters(startEvents, CLUSTER_SPAN);
  const metrics: GapMetrics = {
    totalEvents: closeEvents.length,
    maxGap: closeEvents.reduce((best, event) => Math.max(best, event.gap), 0),
    maxActive,
    activeAtLeast3Spins,
    maxCloseCluster5: closeClusters[0]?.size ?? 0,
    closeClustersAtLeast3: closeClusters.filter((cluster) => cluster.size >= 3).length,
    maxStartCluster5: startClusters[0]?.size ?? 0,
    startClustersAtLeast3: startClusters.filter((cluster) => cluster.size >= 3).length,
  };

  return {
    metrics,
    closeClusters,
    startClusters,
    topEvents: [...closeEvents].sort((left, right) => right.gap - left.gap || left.position - right.position).slice(0, 8),
  };
}

function makeLongEvent(
  category: number,
  gap: number,
  position: number,
  nonZeroPosition: number,
  sessions: readonly Session[] | null,
): LongEvent {
  if (sessions === null) {
    return {
      category,
      gap,
      position,
      nonZeroPosition,
      sessionName: "-",
      sessionOffset: position,
    };
  }
  const session = locateSession(sessions, position);
  return {
    category,
    gap,
    position,
    nonZeroPosition,
    sessionName: session.name,
    sessionOffset: position - session.start,
  };
}

function averageMetrics(rows: readonly GapMetrics[]): GapMetrics {
  const result = emptyMetrics();
  const keys = Object.keys(result) as Array<keyof GapMetrics>;
  for (const key of keys) {
    result[key] = rows.reduce((sum, row) => sum + row[key], 0) / Math.max(rows.length, 1);
  }
  return result;
}

function monteCarloSummary(
  numbers: readonly RouletteNumber[],
  observed: GapMetrics,
  threshold: number,
  scope: ScopeId,
  countZeroAsMiss: boolean,
): { expected: GapMetrics; p: Record<keyof GapMetrics, number> } {
  const rng = mulberry32(20260705 + threshold * 101 + categoryIndexes(scope).length * 17 + (countZeroAsMiss ? 9 : 0));
  const simulated: GapMetrics[] = [];
  for (let run = 0; run < SIMULATIONS; run += 1) {
    const sequence = randomSequence(numbers.length, rng);
    simulated.push(analyzeSequence(sequence, null, threshold, scope, countZeroAsMiss).metrics);
  }
  const expected = averageMetrics(simulated);
  const keys = Object.keys(observed) as Array<keyof GapMetrics>;
  const p = {} as Record<keyof GapMetrics, number>;
  for (const key of keys) {
    const extreme = simulated.filter((row) => row[key] >= observed[key]).length;
    p[key] = (extreme + 1) / (SIMULATIONS + 1);
  }
  return { expected, p };
}

function fmt(value: number, digits = 1): string {
  return value.toFixed(digits);
}

function fmtP(p: number): string {
  if (p <= 1 / (SIMULATIONS + 1)) return `<=${(1 / (SIMULATIONS + 1)).toFixed(4)}`;
  return p.toFixed(4);
}

function fmtCategory(category: number): string {
  return CATEGORY_LABELS[category] ?? String(category);
}

function fmtEvent(event: LongEvent): string {
  return `${fmtCategory(event.category)} ${event.gap}口 @ ${event.sessionName} #${event.sessionOffset}`;
}

function fmtCluster(cluster: Cluster | undefined): string {
  if (!cluster) return "-";
  return `${cluster.size}个 / ${cluster.end - cluster.start}口：${cluster.events.slice(0, 5).map(fmtEvent).join("<br>")}`;
}

function buildReport(): string {
  const { sessions, rawCount, numbers } = loadSessions();
  const mainRows: SummaryRow[] = [];

  for (const threshold of THRESHOLDS) {
    for (const scope of ["groups", "rows", "all"] as ScopeId[]) {
      const observedDetail = analyzeSequence(numbers, sessions, threshold, scope, false);
      const { expected, p } = monteCarloSummary(numbers, observedDetail.metrics, threshold, scope, false);
      mainRows.push({
        threshold,
        scope,
        observed: observedDetail.metrics,
        expected,
        p,
        topCloseClusters: observedDetail.closeClusters.slice(0, 5),
        topStartClusters: observedDetail.startClusters.slice(0, 5),
        topEvents: observedDetail.topEvents,
      });
    }
  }

  const zeroSensitivity = THRESHOLDS.flatMap((threshold) => {
    return (["groups", "rows", "all"] as ScopeId[]).map((scope) => {
      const observed = analyzeSequence(numbers, sessions, threshold, scope, true);
      const { expected, p } = monteCarloSummary(numbers, observed.metrics, threshold, scope, true);
      return { threshold, scope, observed: observed.metrics, expected, p };
    });
  });

  const lines: string[] = [];
  lines.push("# 行组长套接连出现审计");
  lines.push("");
  lines.push(`输入：\`HistoryData/data_20260703.json\``);
  lines.push(`原始记录 ${rawCount} 条；拼接后总号码 ${numbers.length} 个；时间范围 ${formatDate(sessionTime(sessions[0]))} 到 ${formatDate(sessionTime(sessions[sessions.length - 1]))}。`);
  lines.push(`主口径：沿用程序行组距离逻辑，0 跳过，不增加也不清零。Monte Carlo：${SIMULATIONS} 条同长度均匀随机序列。`);
  lines.push(`长套定义：某一组/行连续未出达到阈值；“结束事件”指长套后该组/行终于出了；“成簇”指相邻结束/触发事件之间相隔不超过 ${CLUSTER_SPAN} 个有效口。`);
  lines.push("");

  lines.push("## 1. 主口径汇总（0 跳过）");
  lines.push("");
  lines.push("| 阈值 | 范围 | 长套结束次数 obs/exp/p | 最长长套 obs/exp/p | 同时长套最多 | 同时>=3口数 obs/exp/p | 结束簇最大/簇>=3 | 触发簇最大/簇>=3 |");
  lines.push("|---:|---|---:|---:|---:|---:|---:|---:|");
  for (const row of mainRows) {
    lines.push([
      `| ${row.threshold}`,
      SCOPE_LABELS[row.scope],
      `${row.observed.totalEvents}/${fmt(row.expected.totalEvents)}/${fmtP(row.p.totalEvents)}`,
      `${row.observed.maxGap}/${fmt(row.expected.maxGap)}/${fmtP(row.p.maxGap)}`,
      `${row.observed.maxActive}/${fmt(row.expected.maxActive)}/${fmtP(row.p.maxActive)}`,
      `${row.observed.activeAtLeast3Spins}/${fmt(row.expected.activeAtLeast3Spins)}/${fmtP(row.p.activeAtLeast3Spins)}`,
      `${row.observed.maxCloseCluster5}/${row.observed.closeClustersAtLeast3}`,
      `${row.observed.maxStartCluster5}/${row.observed.startClustersAtLeast3} |`,
    ].join(" | "));
  }
  lines.push("");

  lines.push("## 1b. 成簇指标 Monte Carlo 对照（0 跳过）");
  lines.push("");
  lines.push("| 阈值 | 范围 | 最大结束簇 obs/exp/p | 结束簇>=3 obs/exp/p | 最大触发簇 obs/exp/p | 触发簇>=3 obs/exp/p |");
  lines.push("|---:|---|---:|---:|---:|---:|");
  for (const row of mainRows) {
    lines.push([
      `| ${row.threshold}`,
      SCOPE_LABELS[row.scope],
      `${row.observed.maxCloseCluster5}/${fmt(row.expected.maxCloseCluster5)}/${fmtP(row.p.maxCloseCluster5)}`,
      `${row.observed.closeClustersAtLeast3}/${fmt(row.expected.closeClustersAtLeast3)}/${fmtP(row.p.closeClustersAtLeast3)}`,
      `${row.observed.maxStartCluster5}/${fmt(row.expected.maxStartCluster5)}/${fmtP(row.p.maxStartCluster5)}`,
      `${row.observed.startClustersAtLeast3}/${fmt(row.expected.startClustersAtLeast3)}/${fmtP(row.p.startClustersAtLeast3)} |`,
    ].join(" | "));
  }
  lines.push("");

  lines.push("## 2. 阈值10的具体极端位置");
  lines.push("");
  for (const row of mainRows.filter((item) => item.threshold === 10)) {
    lines.push(`### ${SCOPE_LABELS[row.scope]}`);
    lines.push("");
    lines.push(`- 最大结束簇：${fmtCluster(row.topCloseClusters[0])}`);
    lines.push(`- 最大触发簇：${fmtCluster(row.topStartClusters[0])}`);
    lines.push(`- 最长长套：${row.topEvents.slice(0, 6).map(fmtEvent).join("；")}`);
    lines.push("");
  }

  lines.push("## 3. 0 算作未出的敏感性检查");
  lines.push("");
  lines.push("| 阈值 | 范围 | 长套结束次数 obs/exp/p | 最长长套 obs/exp/p | 同时长套最多 | 同时>=3口数 obs/exp/p |");
  lines.push("|---:|---|---:|---:|---:|---:|");
  for (const row of zeroSensitivity) {
    lines.push([
      `| ${row.threshold}`,
      SCOPE_LABELS[row.scope],
      `${row.observed.totalEvents}/${fmt(row.expected.totalEvents)}/${fmtP(row.p.totalEvents)}`,
      `${row.observed.maxGap}/${fmt(row.expected.maxGap)}/${fmtP(row.p.maxGap)}`,
      `${row.observed.maxActive}/${fmt(row.expected.maxActive)}/${fmtP(row.p.maxActive)}`,
      `${row.observed.activeAtLeast3Spins}/${fmt(row.expected.activeAtLeast3Spins)}/${fmtP(row.p.activeAtLeast3Spins)} |`,
    ].join(" | "));
  }
  lines.push("");

  lines.push("## 4. 初步判断");
  lines.push("");
  lines.push("1. 阈值 10 的组/行长套本来就不稀有：单个组/行每次命中间隔服从近似几何分布，10口未出在长样本里会反复出现。");
  lines.push("2. “同时多个长套”和“长套结束事件接连出现”也会自然发生，因为任意一个号码同时只命中一个组和一个行，其他组/行的距离会一起积累。");
  lines.push("3. 是否像被调过，要重点看 Monte Carlo p 是否很小，以及极端事件是否长期集中在同一类/同一局段。");
  lines.push("4. 如果 p 不小，说明随机序列里也经常出现同等强度的长套成串，不能直接当作破绽。");
  lines.push("");

  return lines.join("\n");
}

const report = buildReport();
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, report, "utf8");
console.log(report);
