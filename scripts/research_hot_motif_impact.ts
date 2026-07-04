import fs from "node:fs";
import path from "node:path";

import { analyzeHotNumbers } from "../app/src/core/hotNumbers";
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

interface Sector {
  startIndex: number;
  centerIndex: number;
  center: RouletteNumber;
  numbers: RouletteNumber[];
  count: number;
  z: number;
}

interface SnapshotFeature {
  prefix: number;
  ratio: number;
  cumulativeTop: Sector;
  recentTop: Sector;
  cumulativeTop2: Sector;
  recentTop2: Sector;
  cumulativeVector: number[];
  recentVector: number[];
}

interface PrefixFeature {
  snapshots: SnapshotFeature[];
  fullTop: Sector;
  fullTop2: Sector;
  fullVector: number[];
  earlyLateCorrelation: number;
  cumulativeDrift: number;
  recentDrift: number;
  maxRecentJump: number;
  recentAvgStep: number;
  persistenceToFull: number;
  zSlope: number;
  fullZ: number;
  duality: number;
  lineShape: number[];
  lineBias: number;
}

interface Motif {
  id: string;
  label: string;
  predicate: (feature: PrefixFeature) => boolean;
}

interface EventRow {
  order: number;
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  position: number;
  pick: RouletteNumber;
  result: RouletteNumber;
  mode: string;
  hit: boolean;
  net: number;
  motifs: string[];
  cumulativeTop: Sector;
  recentTop: Sector;
  fullZ: number;
  recentDrift: number;
  earlyLateCorrelation: number;
  lineBias: number;
  pickInCumulativeTop: boolean;
  pickInRecentTop: boolean;
  pickNearCumulativeCenter: boolean;
  pickNearRecentCenter: boolean;
}

interface Summary {
  signals: number;
  hits: number;
  bet: number;
  win: number;
  net: number;
  roi: number;
  hitRate: number;
  sp100: number;
  maxDrawdown: number;
  activeSessions: number;
  positiveSessions: number;
  negativeSessions: number;
  signalGini: number;
  top5SignalShare: number;
  top10SignalShare: number;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "hot-motif-impact-20260703.md");

const ROI_START = 200;
const RECENT_WINDOW = 80;
const SNAPSHOT_RATIOS = [0.25, 0.40, 0.55, 0.70, 0.85, 1.0] as const;

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_INDEX = new Map<RouletteNumber, number>(
  WHEEL_ORDER.map((number, index) => [number, index]),
);

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
  })).filter((session) => session.numbers.length > ROI_START);

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

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, WHEEL_ORDER.length - distance);
}

function sectorDistance(left: RouletteNumber, right: RouletteNumber): number {
  return circularDistance(wheelIndex(left), wheelIndex(right));
}

function makeCounts(numbers: readonly RouletteNumber[]): number[] {
  const counts = Array(WHEEL_ORDER.length).fill(0);
  for (const number of numbers) counts[wheelIndex(number)] += 1;
  return counts;
}

function sectorFromCounts(
  counts: readonly number[],
  startIndex: number,
  size: number,
  total: number,
): Sector {
  let count = 0;
  const numbers: RouletteNumber[] = [];
  for (let offset = 0; offset < size; offset += 1) {
    const index = (startIndex + offset) % WHEEL_ORDER.length;
    count += counts[index];
    numbers.push(WHEEL_ORDER[index]);
  }
  const p = size / WHEEL_ORDER.length;
  const expected = total * p;
  const variance = total * p * (1 - p);
  const centerIndex = (startIndex + Math.floor(size / 2)) % WHEEL_ORDER.length;
  return {
    startIndex,
    centerIndex,
    center: WHEEL_ORDER[centerIndex],
    numbers,
    count,
    z: variance > 0 ? (count - expected) / Math.sqrt(variance) : 0,
  };
}

function topNonOverlappingSectors(numbers: readonly RouletteNumber[], size = 7, limit = 2): Sector[] {
  const counts = makeCounts(numbers);
  const sectors = WHEEL_ORDER
    .map((_, startIndex) => sectorFromCounts(counts, startIndex, size, numbers.length))
    .sort((left, right) => right.count - left.count || right.z - left.z);
  const used = new Set<number>();
  const selected: Sector[] = [];
  for (const sector of sectors) {
    const indexes = Array.from({ length: size }, (_, offset) => (sector.startIndex + offset) % WHEEL_ORDER.length);
    if (indexes.some((index) => used.has(index))) continue;
    selected.push(sector);
    indexes.forEach((index) => used.add(index));
    if (selected.length >= limit) break;
  }
  return selected;
}

function topSectorPair(numbers: readonly RouletteNumber[]): [Sector, Sector] {
  const top = topNonOverlappingSectors(numbers, 7, 2);
  return [top[0], top[1] ?? top[0]];
}

function sectorVector(numbers: readonly RouletteNumber[], size = 7): number[] {
  const counts = makeCounts(numbers);
  return WHEEL_ORDER.map((_, startIndex) => {
    const sector = sectorFromCounts(counts, startIndex, size, numbers.length);
    return numbers.length > 0 ? sector.count / numbers.length : 0;
  });
}

function correlation(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  const leftMean = left.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  const rightMean = right.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  let numerator = 0;
  let leftDenominator = 0;
  let rightDenominator = 0;
  for (let index = 0; index < length; index += 1) {
    const leftDiff = left[index] - leftMean;
    const rightDiff = right[index] - rightMean;
    numerator += leftDiff * rightDiff;
    leftDenominator += leftDiff * leftDiff;
    rightDenominator += rightDiff * rightDiff;
  }
  return leftDenominator > 0 && rightDenominator > 0
    ? numerator / Math.sqrt(leftDenominator * rightDenominator)
    : 0;
}

function lineShape(numbers: readonly RouletteNumber[]): number[] {
  const expected = numbers.length * (12 / 37);
  const variance = numbers.length * (12 / 37) * (25 / 37);
  const denominator = variance > 0 ? Math.sqrt(variance) : 1;
  return [...GROUPS, ...ROWS].map((line) => {
    const set = new Set(line);
    const count = numbers.filter((number) => set.has(number)).length;
    return (count - expected) / denominator;
  });
}

function average(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function pickPrefixes(length: number): Array<{ prefix: number; ratio: number }> {
  const seen = new Set<number>();
  return SNAPSHOT_RATIOS.map((ratio) => ({
    ratio,
    prefix: Math.max(80, Math.min(length, Math.round(length * ratio))),
  })).filter((item) => {
    if (seen.has(item.prefix)) return false;
    seen.add(item.prefix);
    return true;
  });
}

function makePrefixFeature(numbers: readonly RouletteNumber[]): PrefixFeature {
  const snapshots = pickPrefixes(numbers.length).map(({ prefix, ratio }) => {
    const cumulative = numbers.slice(0, prefix);
    const recent = numbers.slice(Math.max(0, prefix - RECENT_WINDOW), prefix);
    const [cumulativeTop, cumulativeTop2] = topSectorPair(cumulative);
    const [recentTop, recentTop2] = topSectorPair(recent);
    return {
      prefix,
      ratio,
      cumulativeTop,
      recentTop,
      cumulativeTop2,
      recentTop2,
      cumulativeVector: sectorVector(cumulative),
      recentVector: sectorVector(recent),
    };
  });

  const [fullTop, fullTop2] = topSectorPair(numbers);
  const firstHalf = numbers.slice(0, Math.floor(numbers.length / 2));
  const secondHalf = numbers.slice(Math.floor(numbers.length / 2));
  const cumulativeCenters = snapshots.map((snapshot) => snapshot.cumulativeTop.center);
  const recentCenters = snapshots.map((snapshot) => snapshot.recentTop.center);
  const recentSteps = recentCenters.slice(1).map((center, index) => sectorDistance(recentCenters[index], center));
  const zValues = snapshots.map((snapshot) => snapshot.recentTop.z);
  const shape = lineShape(numbers.slice(Math.max(0, numbers.length - 120)));
  return {
    snapshots,
    fullTop,
    fullTop2,
    fullVector: sectorVector(numbers),
    earlyLateCorrelation: correlation(sectorVector(firstHalf), sectorVector(secondHalf)),
    cumulativeDrift: sectorDistance(cumulativeCenters[0], cumulativeCenters[cumulativeCenters.length - 1]),
    recentDrift: sectorDistance(recentCenters[0], recentCenters[recentCenters.length - 1]),
    maxRecentJump: Math.max(0, ...recentSteps),
    recentAvgStep: average(recentSteps),
    persistenceToFull: snapshots.filter((snapshot) => sectorDistance(snapshot.cumulativeTop.center, fullTop.center) <= 3).length / snapshots.length,
    zSlope: zValues[zValues.length - 1] - zValues[0],
    fullZ: fullTop.z,
    duality: Math.max(0, 1 - Math.abs(fullTop.z - fullTop2.z) / Math.max(Math.abs(fullTop.z), 1)),
    lineShape: shape,
    lineBias: Math.max(...shape.map((value) => Math.abs(value))),
  };
}

function lastSnapshot(feature: PrefixFeature): SnapshotFeature {
  return feature.snapshots[feature.snapshots.length - 1];
}

function finalRecentDistance(feature: PrefixFeature): number {
  return sectorDistance(lastSnapshot(feature).recentTop.center, feature.fullTop.center);
}

function makeMotifs(): Motif[] {
  return [
    { id: "M01", label: "累积热区稳定", predicate: (f) => f.fullZ >= 1.5 && f.persistenceToFull >= 0.67 && f.cumulativeDrift <= 3 },
    { id: "M02", label: "稳定画像+短窗换区", predicate: (f) => f.persistenceToFull >= 0.67 && f.recentDrift >= 8 },
    { id: "M03", label: "强单热区", predicate: (f) => f.fullZ >= 2.4 },
    { id: "M04", label: "双热区并存", predicate: (f) => f.fullZ >= 1.3 && f.duality >= 0.78 },
    { id: "M05", label: "后段增强", predicate: (f) => f.fullZ >= 1.5 && f.zSlope >= 0.75 },
    { id: "M06", label: "后段衰退", predicate: (f) => f.zSlope <= -0.75 },
    { id: "M07", label: "前后同向", predicate: (f) => f.earlyLateCorrelation >= 0.35 },
    { id: "M08", label: "前后反相", predicate: (f) => f.earlyLateCorrelation <= -0.25 },
    { id: "M09", label: "短窗大跳变", predicate: (f) => f.maxRecentJump >= 14 },
    { id: "M10", label: "跨区远移", predicate: (f) => f.recentDrift >= 10 && f.cumulativeDrift >= 5 },
    { id: "M11", label: "行组强偏", predicate: (f) => f.lineBias >= 2.2 },
    { id: "M12", label: "弱热噪声", predicate: (f) => f.fullZ <= 1.25 && f.persistenceToFull <= 0.5 },
    { id: "M13", label: "短长共振", predicate: (f) => f.fullZ >= 1.5 && finalRecentDistance(f) <= 3 },
    { id: "M14", label: "短窗背离长期", predicate: (f) => f.fullZ >= 1.5 && finalRecentDistance(f) >= 8 },
  ];
}

function eventNet(hit: boolean): number {
  return hit ? 35 : -1;
}

function makeEvents(sessions: readonly Session[], motifs: readonly Motif[]): EventRow[] {
  const rows: EventRow[] = [];
  let order = 0;
  for (const session of sessions) {
    const analysis = analyzeHotNumbers(session.numbers, ROI_START);
    for (const event of analysis.events) {
      if (event.position < ROI_START) continue;
      const prefix = session.numbers.slice(0, event.position);
      const feature = makePrefixFeature(prefix);
      const motifIds = motifs.filter((motif) => motif.predicate(feature)).map((motif) => motif.id);
      rows.push({
        order: order++,
        sessionId: session.id,
        sessionName: session.name,
        sessionDate: formatDate(sessionTime(session)),
        position: event.position,
        pick: event.signal.number,
        result: session.numbers[event.position],
        mode: event.signal.mode,
        hit: event.hit,
        net: eventNet(event.hit),
        motifs: motifIds,
        cumulativeTop: feature.fullTop,
        recentTop: lastSnapshot(feature).recentTop,
        fullZ: feature.fullZ,
        recentDrift: feature.recentDrift,
        earlyLateCorrelation: feature.earlyLateCorrelation,
        lineBias: feature.lineBias,
        pickInCumulativeTop: feature.fullTop.numbers.includes(event.signal.number),
        pickInRecentTop: lastSnapshot(feature).recentTop.numbers.includes(event.signal.number),
        pickNearCumulativeCenter: sectorDistance(event.signal.number, feature.fullTop.center) <= 3,
        pickNearRecentCenter: sectorDistance(event.signal.number, lastSnapshot(feature).recentTop.center) <= 3,
      });
    }
  }
  return rows;
}

function gini(values: readonly number[]): number {
  const positives = values.filter((value) => value > 0).sort((left, right) => left - right);
  if (positives.length === 0) return 0;
  const total = positives.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  const weighted = positives.reduce((sum, value, index) => sum + (index + 1) * value, 0);
  return (2 * weighted) / (positives.length * total) - (positives.length + 1) / positives.length;
}

function topShare(values: readonly number[], top: number): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  return [...values].sort((left, right) => right - left).slice(0, top).reduce((sum, value) => sum + value, 0) / total;
}

function summarize(events: readonly EventRow[], eligibleSpins: number): Summary {
  const ordered = [...events].sort((left, right) => left.order - right.order);
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const sessionStats = new Map<string, { signals: number; net: number }>();

  for (const event of ordered) {
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
    const current = sessionStats.get(event.sessionId) ?? { signals: 0, net: 0 };
    current.signals += 1;
    current.net += event.net;
    sessionStats.set(event.sessionId, current);
  }

  const signals = events.length;
  const hits = events.filter((event) => event.hit).length;
  const sessionRows = [...sessionStats.values()];
  const signalCounts = sessionRows.map((row) => row.signals);
  const net = events.reduce((sum, event) => sum + event.net, 0);
  return {
    signals,
    hits,
    bet: signals,
    win: hits * 36,
    net,
    roi: signals > 0 ? net / signals : 0,
    hitRate: signals > 0 ? hits / signals : 0,
    sp100: eligibleSpins > 0 ? signals / eligibleSpins * 100 : 0,
    maxDrawdown,
    activeSessions: sessionRows.length,
    positiveSessions: sessionRows.filter((row) => row.net > 0).length,
    negativeSessions: sessionRows.filter((row) => row.net < 0).length,
    signalGini: gini(signalCounts),
    top5SignalShare: topShare(signalCounts, 5),
    top10SignalShare: topShare(signalCounts, 10),
  };
}

function eligibleSpins(sessions: readonly Session[]): number {
  return sessions.reduce((sum, session) => sum + Math.max(0, session.numbers.length - ROI_START), 0);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatSummary(summary: Summary): string {
  return [
    `sig=${summary.signals}`,
    `hit=${summary.hits}`,
    `net=${summary.net}`,
    `ROI=${formatPct(summary.roi)}`,
    `HR=${formatPct(summary.hitRate)}`,
    `SP100=${summary.sp100.toFixed(2)}`,
    `DD=${summary.maxDrawdown}`,
    `pos=${summary.positiveSessions}/${summary.activeSessions}`,
    `gini=${summary.signalGini.toFixed(3)}`,
    `top5=${formatPct(summary.top5SignalShare)}`,
  ].join(" ");
}

function shortSummary(summary: Summary): string {
  return `${summary.signals} / ${summary.net} / ${formatPct(summary.roi)} / ${summary.sp100.toFixed(2)} / DD ${summary.maxDrawdown} / top5 ${formatPct(summary.top5SignalShare)}`;
}

function filterBySessions(events: readonly EventRow[], sessions: readonly Session[]): EventRow[] {
  const ids = new Set(sessions.map((session) => session.id));
  return events.filter((event) => ids.has(event.sessionId));
}

function main(): void {
  const { sessions, rawCount, manualRows } = loadSessions();
  const motifs = makeMotifs();
  const events = makeEvents(sessions, motifs);
  const totalEligibleSpins = eligibleSpins(sessions);
  const baseline = summarize(events, totalEligibleSpins);
  const latest20Sessions = sessions.slice(-20);
  const latest10Sessions = sessions.slice(-10);
  const priorSessions = sessions.slice(0, -20);

  const lines: string[] = [];
  lines.push("# 热门号 x 局面特征标签影响研究");
  lines.push("");
  lines.push(`输入：\`${path.relative(ROOT, INPUT_FILE).replace(/\\/g, "/")}\``);
  lines.push(`原始记录 ${rawCount} 条；参与热门回测 ${sessions.length} 条；押注区号码 ${totalEligibleSpins} 口。`);
  lines.push(`文件中带手工 TableId 的记录 ${manualRows} 条；本研究不读取、不使用 TableId，也不使用 TableProfile 校准。`);
  lines.push("每个热门信号只用该信号 position 之前的号码前缀计算局面标签，命中统计看下一口实际号码。");
  lines.push("");
  lines.push("## 总体");
  lines.push("");
  lines.push(`- 原始热门：${formatSummary(baseline)}`);
  lines.push("");
  lines.push("## 热门号与当前热区是否重合");
  lines.push("");
  const alignmentRows: Array<[string, EventRow[]]> = [
    ["pick in 累积热区", events.filter((event) => event.pickInCumulativeTop)],
    ["pick not in 累积热区", events.filter((event) => !event.pickInCumulativeTop)],
    ["pick in 最近80热区", events.filter((event) => event.pickInRecentTop)],
    ["pick not in 最近80热区", events.filter((event) => !event.pickInRecentTop)],
    ["pick in 累积+最近", events.filter((event) => event.pickInCumulativeTop && event.pickInRecentTop)],
    ["pick in 任一热区", events.filter((event) => event.pickInCumulativeTop || event.pickInRecentTop)],
    ["pick 不在两个热区", events.filter((event) => !event.pickInCumulativeTop && !event.pickInRecentTop)],
    ["pick near 累积中心<=3", events.filter((event) => event.pickNearCumulativeCenter)],
    ["pick near 最近中心<=3", events.filter((event) => event.pickNearRecentCenter)],
  ];
  lines.push("| slice | signals / net / ROI / SP100 / DD / top5 |");
  lines.push("|---|---|");
  alignmentRows.forEach(([label, rows]) => {
    lines.push(`| ${label} | ${shortSummary(summarize(rows, totalEligibleSpins))} |`);
  });
  lines.push("");
  lines.push("## 局面标签：保留该标签下热门信号");
  lines.push("");
  lines.push("| motif | label | keep summary | drop summary | ROI delta vs all |");
  lines.push("|---|---|---|---|---:|");
  motifs.forEach((motif) => {
    const keep = events.filter((event) => event.motifs.includes(motif.id));
    const drop = events.filter((event) => !event.motifs.includes(motif.id));
    const keepSummary = summarize(keep, totalEligibleSpins);
    const dropSummary = summarize(drop, totalEligibleSpins);
    lines.push(`| ${motif.id} | ${motif.label} | ${shortSummary(keepSummary)} | ${shortSummary(dropSummary)} | ${formatPct(keepSummary.roi - baseline.roi)} |`);
  });
  lines.push("");
  lines.push("## 按 keep ROI 排序");
  lines.push("");
  lines.push("| rank | motif | label | keep | drop |");
  lines.push("|---:|---|---|---|---|");
  motifs
    .map((motif) => {
      const keep = events.filter((event) => event.motifs.includes(motif.id));
      const drop = events.filter((event) => !event.motifs.includes(motif.id));
      return { motif, keepSummary: summarize(keep, totalEligibleSpins), dropSummary: summarize(drop, totalEligibleSpins) };
    })
    .sort((left, right) => right.keepSummary.roi - left.keepSummary.roi)
    .forEach((row, index) => {
      lines.push(`| ${index + 1} | ${row.motif.id} | ${row.motif.label} | ${shortSummary(row.keepSummary)} | ${shortSummary(row.dropSummary)} |`);
    });
  lines.push("");
  lines.push("## 组合候选");
  lines.push("");
  const goodMotifs = new Set(["M01", "M03", "M07", "M13"]);
  const badMotifs = new Set(["M08", "M12", "M14"]);
  const combos: Array<[string, EventRow[]]> = [
    ["good any: M01/M03/M07/M13", events.filter((event) => event.motifs.some((motif) => goodMotifs.has(motif)))],
    ["good >=2", events.filter((event) => event.motifs.filter((motif) => goodMotifs.has(motif)).length >= 2)],
    ["bad any: M08/M12/M14", events.filter((event) => event.motifs.some((motif) => badMotifs.has(motif)))],
    ["good any 且无 bad", events.filter((event) => event.motifs.some((motif) => goodMotifs.has(motif)) && !event.motifs.some((motif) => badMotifs.has(motif)))],
    ["good >=2 且无 bad", events.filter((event) => event.motifs.filter((motif) => goodMotifs.has(motif)).length >= 2 && !event.motifs.some((motif) => badMotifs.has(motif)))],
    ["pick in both heat zones + good any", events.filter((event) => event.pickInCumulativeTop && event.pickInRecentTop && event.motifs.some((motif) => goodMotifs.has(motif)))],
    ["pick neither heat zones + bad any", events.filter((event) => !event.pickInCumulativeTop && !event.pickInRecentTop && event.motifs.some((motif) => badMotifs.has(motif)))],
  ];
  lines.push("| combo | signals / net / ROI / SP100 / DD / top5 |");
  lines.push("|---|---|");
  combos.forEach(([label, rows]) => {
    lines.push(`| ${label} | ${shortSummary(summarize(rows, totalEligibleSpins))} |`);
  });
  lines.push("");
  lines.push("## 时间稳健性：关键标签/组合");
  lines.push("");
  const splitSpecs: Array<[string, readonly Session[]]> = [
    ["prior", priorSessions],
    ["latest20", latest20Sessions],
    ["latest10", latest10Sessions],
  ];
  const ruleSpecs: Array<[string, (rows: readonly EventRow[]) => EventRow[]]> = [
    ["all", (rows) => [...rows]],
    ["M02 稳定画像+短窗换区", (rows) => rows.filter((event) => event.motifs.includes("M02"))],
    ["M05 后段增强", (rows) => rows.filter((event) => event.motifs.includes("M05"))],
    ["M07 前后同向", (rows) => rows.filter((event) => event.motifs.includes("M07"))],
    ["M06 后段衰退", (rows) => rows.filter((event) => event.motifs.includes("M06"))],
    ["M10 跨区远移", (rows) => rows.filter((event) => event.motifs.includes("M10"))],
    ["M11 行组强偏", (rows) => rows.filter((event) => event.motifs.includes("M11"))],
    ["good>=2 no bad", (rows) => rows.filter((event) => event.motifs.filter((motif) => goodMotifs.has(motif)).length >= 2 && !event.motifs.some((motif) => badMotifs.has(motif)))],
  ];
  lines.push("| rule | prior | latest20 | latest10 |");
  lines.push("|---|---|---|---|");
  ruleSpecs.forEach(([label, filter]) => {
    const cells = splitSpecs.map(([, splitSessions]) => {
      const splitEvents = filterBySessions(events, splitSessions);
      return shortSummary(summarize(filter(splitEvents), eligibleSpins(splitSessions)));
    });
    lines.push(`| ${label} | ${cells.join(" | ")} |`);
  });
  lines.push("");
  lines.push("## 模式拆分");
  lines.push("");
  lines.push("| mode | summary |");
  lines.push("|---|---|");
  [...new Set(events.map((event) => event.mode))].forEach((mode) => {
    lines.push(`| ${mode} | ${shortSummary(summarize(events.filter((event) => event.mode === mode), totalEligibleSpins))} |`);
  });
  lines.push("");
  lines.push("## 初步判断");
  lines.push("");
  lines.push("1. 如果某个标签 keep ROI 明显高于总体，同时 drop 后不变差，说明它更适合做增强条件。");
  lines.push("2. 如果某个标签 keep ROI 明显低于总体，而 drop 后 ROI 提升，说明它更适合做降权/过滤条件。");
  lines.push("3. 单标签样本太少或 top5 占比太高时，只能作为观察，不能直接产品化。");

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(lines.join("\n"));
}

main();
