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

interface LongEvent {
  category: number;
  gap: number;
  position: number;
  effectivePosition: number;
  sessionName: string;
  sessionOffset: number;
}

interface Cluster {
  start: number;
  end: number;
  size: number;
  events: LongEvent[];
}

interface MonteCarloRow {
  threshold: number;
  scope: ScopeId;
  mode: EventMode;
  observed: number;
  expected: number;
  p: number;
}

type ScopeId = "groups" | "rows" | "all";
type EventMode = "start" | "close";

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "recent-long-gap-cluster-20260703.md");

const RECENT_SESSION_COUNT = 15;
const THRESHOLDS = [10, 9, 8, 7, 6];
const CLUSTER_SPANS = [0, 2, 5, 10];
const SIMULATIONS = 500;
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

  let start = 0;
  return base.map((session) => {
    const result = { ...session, start, end: start + session.numbers.length };
    start = result.end;
    return result;
  });
}

function flattenSessions(sessions: readonly Session[]): { numbers: RouletteNumber[]; sessions: Session[] } {
  const numbers: RouletteNumber[] = [];
  const shifted: Session[] = [];
  for (const session of sessions) {
    const start = numbers.length;
    numbers.push(...session.numbers);
    shifted.push({ ...session, start, end: numbers.length });
  }
  return { numbers, sessions: shifted };
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

function locateSession(sessions: readonly Session[], position: number): Session {
  for (const session of sessions) {
    if (position >= session.start && position < session.end) return session;
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

function makeEvent(
  category: number,
  gap: number,
  position: number,
  effectivePosition: number,
  sessions: readonly Session[] | null,
): LongEvent {
  if (sessions === null) {
    return {
      category,
      gap,
      position,
      effectivePosition,
      sessionName: "-",
      sessionOffset: position,
    };
  }
  const session = locateSession(sessions, position);
  return {
    category,
    gap,
    position,
    effectivePosition,
    sessionName: session.name,
    sessionOffset: position - session.start,
  };
}

function collectEvents(
  numbers: readonly RouletteNumber[],
  sessions: readonly Session[] | null,
  threshold: number,
  scope: ScopeId,
  mode: EventMode,
): LongEvent[] {
  const indexes = categoryIndexes(scope);
  const gaps = Array<number>(6).fill(0);
  const events: LongEvent[] = [];
  let effectivePosition = -1;

  for (let position = 0; position < numbers.length; position += 1) {
    const number = numbers[position];
    if (number === 0) continue;
    effectivePosition += 1;

    const hitSet = new Set(categoriesForScope(number, scope));
    for (const category of indexes) {
      if (hitSet.has(category)) {
        if (mode === "close" && gaps[category] >= threshold) {
          events.push(makeEvent(category, gaps[category], position, effectivePosition, sessions));
        }
        gaps[category] = 0;
      } else {
        gaps[category] += 1;
        if (mode === "start" && gaps[category] === threshold) {
          events.push(makeEvent(category, gaps[category], position, effectivePosition, sessions));
        }
      }
    }
  }

  return events.sort((left, right) => (
    left.effectivePosition - right.effectivePosition
    || left.category - right.category
  ));
}

function buildClusters(events: readonly LongEvent[], maxDistance: number): Cluster[] {
  if (events.length === 0) return [];
  const clusters: Cluster[] = [];
  let current: LongEvent[] = [events[0]];

  for (let index = 1; index < events.length; index += 1) {
    const previous = current[current.length - 1];
    const event = events[index];
    if (event.effectivePosition - previous.effectivePosition <= maxDistance) {
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
    start: events[0].effectivePosition,
    end: events[events.length - 1].effectivePosition,
    size: events.length,
    events: [...events],
  };
}

function fmtCategory(category: number): string {
  return CATEGORY_LABELS[category] ?? String(category);
}

function fmtEvent(event: LongEvent): string {
  return `${fmtCategory(event.category)}${event.gap} @ ${event.sessionName} #${event.sessionOffset}`;
}

function fmtCluster(cluster: Cluster | undefined): string {
  if (!cluster) return "-";
  return `${cluster.size}个/${cluster.end - cluster.start}口：${cluster.events.slice(0, 6).map(fmtEvent).join("<br>")}`;
}

function maxSpan5Cluster(numbers: readonly RouletteNumber[], threshold: number, scope: ScopeId, mode: EventMode): number {
  return buildClusters(collectEvents(numbers, null, threshold, scope, mode), 5)[0]?.size ?? 0;
}

function monteCarloRows(numbers: readonly RouletteNumber[], observedRows: readonly MonteCarloRow[]): MonteCarloRow[] {
  const rng = mulberry32(20260705);
  const simulated = observedRows.map(() => [] as number[]);

  for (let run = 0; run < SIMULATIONS; run += 1) {
    const random = randomSequence(numbers.length, rng);
    observedRows.forEach((row, index) => {
      simulated[index].push(maxSpan5Cluster(random, row.threshold, row.scope, row.mode));
    });
  }

  return observedRows.map((row, index) => {
    const values = simulated[index];
    const expected = values.reduce((sum, value) => sum + value, 0) / values.length;
    const p = (values.filter((value) => value >= row.observed).length + 1) / (values.length + 1);
    return { ...row, expected, p };
  });
}

function fmtP(p: number): string {
  if (p <= 1 / (SIMULATIONS + 1)) return `<=${(1 / (SIMULATIONS + 1)).toFixed(4)}`;
  return p.toFixed(4);
}

function buildReport(): string {
  const allSessions = loadSessions();
  const recent = allSessions.slice(-RECENT_SESSION_COUNT);
  const { numbers, sessions } = flattenSessions(recent);
  const lines: string[] = [];
  const observedForMc: MonteCarloRow[] = [];

  lines.push("# 最近长套接连出现检查");
  lines.push("");
  lines.push(`输入：\`HistoryData/data_20260703.json\``);
  lines.push(`范围：最新 ${recent.length} 局，${numbers.length} 个号码；时间 ${formatDate(sessionTime(recent[0]))} 到 ${formatDate(sessionTime(recent[recent.length - 1]))}。`);
  lines.push("口径：沿用程序行组距离，0 跳过；长套阈值从 10 下探到 6。");
  lines.push("");
  lines.push("## 最近局列表");
  lines.push("");
  for (const session of recent) {
    lines.push(`- ${session.name}：${session.numbers.length} 个`);
  }
  lines.push("");

  for (const mode of ["start", "close"] as EventMode[]) {
    lines.push(`## ${mode === "start" ? "长套触发成簇" : "长套结束成簇"}`);
    lines.push("");
    lines.push("| 阈值 | 口径 | 事件数 | span0最大 | span2最大 | span5最大 | span10最大 | span5最大详情 |");
    lines.push("|---:|---|---:|---:|---:|---:|---:|---|");
    for (const threshold of THRESHOLDS) {
      for (const scope of ["groups", "rows", "all"] as ScopeId[]) {
        const events = collectEvents(numbers, sessions, threshold, scope, mode);
        const clustersBySpan = CLUSTER_SPANS.map((span) => buildClusters(events, span));
        observedForMc.push({
          threshold,
          scope,
          mode,
          observed: clustersBySpan[2][0]?.size ?? 0,
          expected: 0,
          p: 1,
        });
        lines.push([
          `| ${threshold}`,
          SCOPE_LABELS[scope],
          String(events.length),
          String(clustersBySpan[0][0]?.size ?? 0),
          String(clustersBySpan[1][0]?.size ?? 0),
          String(clustersBySpan[2][0]?.size ?? 0),
          String(clustersBySpan[3][0]?.size ?? 0),
          `${fmtCluster(clustersBySpan[2][0])} |`,
        ].join(" | "));
      }
    }
    lines.push("");
  }

  lines.push("## span5 最大成簇随机对照");
  lines.push("");
  lines.push(`Monte Carlo：${SIMULATIONS} 条同长度随机序列；p 表示随机序列达到同等或更大 span5 最大簇的比例。`);
  lines.push("");
  lines.push("| 阈值 | 口径 | 触发 obs/exp/p | 结束 obs/exp/p |");
  lines.push("|---:|---|---:|---:|");
  const mcRows = monteCarloRows(numbers, observedForMc);
  for (const threshold of THRESHOLDS) {
    for (const scope of ["groups", "rows", "all"] as ScopeId[]) {
      const start = mcRows.find((row) => row.threshold === threshold && row.scope === scope && row.mode === "start");
      const close = mcRows.find((row) => row.threshold === threshold && row.scope === scope && row.mode === "close");
      lines.push([
        `| ${threshold}`,
        SCOPE_LABELS[scope],
        start ? `${start.observed}/${start.expected.toFixed(1)}/${fmtP(start.p)}` : "-",
        close ? `${close.observed}/${close.expected.toFixed(1)}/${fmtP(close.p)} |` : "- |",
      ].join(" | "));
    }
  }
  lines.push("");

  lines.push("## 初步读法");
  lines.push("");
  lines.push("- span0 表示同一有效口上同时触发/结束多个长套。");
  lines.push("- span2/5/10 表示相邻长套事件在 2/5/10 个有效口内，就算接连成簇。");
  lines.push("- 如果只看组或只看行能达到 3 个，说明同类长套确实连续；如果只有组+行达到 3 个，更多是组和行混合叠加。");
  lines.push("");

  return lines.join("\n");
}

const report = buildReport();
fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, report, "utf8");
console.log(report);
