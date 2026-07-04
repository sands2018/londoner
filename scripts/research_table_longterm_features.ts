import fs from "node:fs";
import path from "node:path";

import type { RouletteNumber } from "../app/src/core/roulette";
import {
  buildSpatialTableClusters,
  makeSpatialTableFingerprint,
  spatialCenterDistance,
} from "../app/src/core/spatialTableClustering";

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

interface SessionFeature {
  session: Session;
  fullTop: Sector[];
  firstTop: Sector[];
  secondTop: Sector[];
  halfDistance: number;
  halfCorrelation: number;
}

interface LongTermProfile {
  id: string;
  trainSessions: number;
  top: Sector;
  vector: number[];
}

interface WalkForwardMatch {
  session: Session;
  actualTop: Sector;
  profile: LongTermProfile;
  distance: number;
  profileCorrelation: number;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "table-longterm-features-20260703.md");

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_INDEX = new Map<RouletteNumber, number>(
  WHEEL_ORDER.map((number, index) => [number, index]),
);

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/).map((item) => Number(item.trim()));
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

function wheelIndex(number: RouletteNumber): number {
  return WHEEL_INDEX.get(number) ?? 0;
}

function circularDistanceIndex(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, WHEEL_ORDER.length - distance);
}

function sectorDistance(left: RouletteNumber, right: RouletteNumber): number {
  return circularDistanceIndex(wheelIndex(left), wheelIndex(right));
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

function topNonOverlappingSectors(numbers: readonly RouletteNumber[], size = 7, limit = 3): Sector[] {
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

function loadSessions(): { sessions: Session[]; rawCount: number; manualTableRows: number } {
  const rawRows = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8")) as RawRow[];
  const sessions = rawRows.map((row, index) => {
    const numbers = parseNumbers(row.Numbers);
    return {
      id: `row-${index + 1}`,
      importIndex: index,
      name: row.Name ?? `row-${index + 1}`,
      numbers,
      updatedTms: row.tms ?? row.DataTms ?? index,
      dataTms: row.DataTms,
    };
  }).filter((session) => session.numbers.length >= 80);

  sessions.sort((left, right) => (
    sessionTime(left) - sessionTime(right)
    || left.importIndex - right.importIndex
    || left.name.localeCompare(right.name, "zh-Hans-CN")
  ));

  const manualTableRows = rawRows.filter((row) => Boolean(row.TableId ?? row.tableId)).length;
  return { sessions, rawCount: rawRows.length, manualTableRows };
}

function makeSessionFeature(session: Session): SessionFeature {
  const middle = Math.floor(session.numbers.length / 2);
  const first = session.numbers.slice(0, middle);
  const second = session.numbers.slice(middle);
  const firstTop = topNonOverlappingSectors(first);
  const secondTop = topNonOverlappingSectors(second);
  return {
    session,
    fullTop: topNonOverlappingSectors(session.numbers),
    firstTop,
    secondTop,
    halfDistance: firstTop[0] && secondTop[0] ? sectorDistance(firstTop[0].center, secondTop[0].center) : 99,
    halfCorrelation: correlation(sectorVector(first), sectorVector(second)),
  };
}

function average(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function formatSector(sector: Sector | undefined): string {
  if (!sector) return "-";
  return `${sector.center} z=${sector.z.toFixed(2)} [${sector.numbers.join("-")}]`;
}

function formatCenters(features: readonly SessionFeature[]): string {
  return features.map((feature) => String(feature.fullTop[0]?.center ?? "-")).join(" -> ");
}

function inferVenue(name: string): string {
  if (name.includes("澳门永利")) return "澳门永利";
  if (name.includes("伦敦人")) return "伦敦人";
  if (name.includes("巴黎人")) return "巴黎人";
  if (name.includes("喜来登")) return "喜来登";
  if (name.startsWith("wzs-")) return "wzs";
  return "unknown";
}

function inferYear(session: Session): number {
  const match = session.name.match(/^(\d{4})/u);
  if (match) return Number(match[1]);
  const tms = sessionTime(session);
  return Number.isFinite(tms) ? new Date(tms).getUTCFullYear() : 0;
}

function describeClusterStability(
  size: number,
  avgPairDistance: number,
  consensusPct: number,
  earlyLateDistance: number,
  earlyLateCorrelation: number,
  aggregateZ: number,
): string {
  if (
    size >= 4
    && avgPairDistance <= 4
    && consensusPct >= 0.55
    && earlyLateDistance <= 3
    && earlyLateCorrelation >= 0.35
    && aggregateZ >= 1
  ) {
    return "长期稳定候选";
  }
  if (size >= 3 && earlyLateDistance <= 5 && earlyLateCorrelation >= 0.15 && aggregateZ >= 0.7) {
    return "轻微漂移/弱稳定";
  }
  if (earlyLateDistance >= 8 || earlyLateCorrelation < -0.05) return "明显漂移";
  return "分散/证据不足";
}

function pairDistances(features: readonly SessionFeature[]): number[] {
  const distances: number[] = [];
  for (let left = 0; left < features.length; left += 1) {
    for (let right = left + 1; right < features.length; right += 1) {
      const leftCenter = features[left].fullTop[0]?.center;
      const rightCenter = features[right].fullTop[0]?.center;
      if (leftCenter === undefined || rightCenter === undefined) continue;
      distances.push(sectorDistance(leftCenter, rightCenter));
    }
  }
  return distances;
}

function appendClusterSummary(
  lines: string[],
  title: string,
  groupSessions: readonly Session[],
  featuresById: ReadonlyMap<string, SessionFeature>,
): void {
  lines.push(`## ${title}`);
  lines.push("");
  if (groupSessions.length < 3) {
    lines.push(`样本只有 ${groupSessions.length} 条，不做自动空间簇分析。`);
    lines.push("");
    return;
  }

  const groupSpins = groupSessions.reduce((sum, session) => sum + session.numbers.length, 0);
  const groupFeatures = groupSessions
    .map((session) => featuresById.get(session.id))
    .filter((item): item is SessionFeature => Boolean(item));
  const stable = groupFeatures.filter((feature) => feature.halfDistance <= 3 && feature.halfCorrelation >= 0.2);
  const drift = groupFeatures.filter((feature) => feature.halfDistance >= 8 || feature.halfCorrelation < -0.05);
  const clusters = buildSpatialTableClusters(groupSessions);

  lines.push(`记录：${groupSessions.length} 条；号码：${groupSpins}；自动空间簇：${clusters.length} 个。`);
  lines.push(`单局前后半稳定：${stable.length}/${groupSessions.length} (${(stable.length / groupSessions.length * 100).toFixed(1)}%)；明显漂移：${drift.length}/${groupSessions.length} (${(drift.length / groupSessions.length * 100).toFixed(1)}%)。`);
  lines.push("");
  lines.push("| cluster | sessions | date span | aggregate top1 | consensus | avg pair dist | early top1 | late top1 | early-late | corr | verdict | centers over time |");
  lines.push("|---|---:|---|---|---:|---:|---|---|---:|---:|---|---|");

  for (const cluster of clusters) {
    const features = cluster.sessionIds
      .map((id) => featuresById.get(id))
      .filter((item): item is SessionFeature => Boolean(item))
      .sort((left, right) => sessionTime(left.session) - sessionTime(right.session));
    if (features.length === 0) continue;

    const clusterNumbers = features.flatMap((feature) => feature.session.numbers);
    const aggregateTop = topNonOverlappingSectors(clusterNumbers);
    const primary = aggregateTop[0];
    const consensus = primary
      ? features.filter((feature) => sectorDistance(feature.fullTop[0]?.center ?? primary.center, primary.center) <= 3).length / features.length
      : 0;
    const avgPairDistance = average(pairDistances(features));
    const split = Math.max(1, Math.floor(features.length / 2));
    const early = features.slice(0, split);
    const late = features.slice(split);
    const earlyNumbers = early.flatMap((feature) => feature.session.numbers);
    const lateNumbers = late.length > 0
      ? late.flatMap((feature) => feature.session.numbers)
      : earlyNumbers;
    const earlyTop = topNonOverlappingSectors(earlyNumbers);
    const lateTop = topNonOverlappingSectors(lateNumbers);
    const earlyLateDistance = earlyTop[0] && lateTop[0] ? sectorDistance(earlyTop[0].center, lateTop[0].center) : 0;
    const earlyLateCorrelation = correlation(sectorVector(earlyNumbers), sectorVector(lateNumbers));
    const verdict = describeClusterStability(
      features.length,
      avgPairDistance,
      consensus,
      earlyLateDistance,
      earlyLateCorrelation,
      primary?.z ?? 0,
    );
    lines.push(`| ${cluster.id} | ${features.length} | ${formatDate(sessionTime(features[0].session))}~${formatDate(sessionTime(features[features.length - 1].session))} | ${formatSector(primary)} | ${(consensus * 100).toFixed(0)}% | ${avgPairDistance.toFixed(2)} | ${formatSector(earlyTop[0])} | ${formatSector(lateTop[0])} | ${earlyLateDistance} | ${earlyLateCorrelation.toFixed(3)} | ${verdict} | ${formatCenters(features)} |`);
  }
  lines.push("");
}

function buildLongTermProfiles(trainSessions: readonly Session[]): LongTermProfile[] {
  const clusters = buildSpatialTableClusters(trainSessions);
  const sessionById = new Map(trainSessions.map((session) => [session.id, session]));
  return clusters.flatMap((cluster) => {
    const sessions = cluster.sessionIds
      .map((id) => sessionById.get(id))
      .filter((session): session is Session => Boolean(session));
    const numbers = sessions.flatMap((session) => session.numbers);
    const top = topNonOverlappingSectors(numbers)[0];
    if (!top) return [];
    return [{
      id: cluster.id,
      trainSessions: sessions.length,
      top,
      vector: sectorVector(numbers),
    }];
  });
}

function matchToLongTermProfiles(session: Session, profiles: readonly LongTermProfile[]): WalkForwardMatch | null {
  const actualTop = topNonOverlappingSectors(session.numbers)[0];
  if (!actualTop || profiles.length === 0) return null;
  const currentVector = sectorVector(session.numbers);
  let best: WalkForwardMatch | null = null;
  for (const profile of profiles) {
    const distance = sectorDistance(actualTop.center, profile.top.center);
    const profileCorrelation = correlation(currentVector, profile.vector);
    const candidate: WalkForwardMatch = {
      session,
      actualTop,
      profile,
      distance,
      profileCorrelation,
    };
    if (
      !best
      || candidate.distance < best.distance
      || (candidate.distance === best.distance && candidate.profileCorrelation > best.profileCorrelation)
    ) {
      best = candidate;
    }
  }
  return best;
}

function appendWalkForwardCheck(
  lines: string[],
  title: string,
  groupSessions: readonly Session[],
  minPriorSessions = 8,
): void {
  const sorted = [...groupSessions].sort((left, right) => (
    sessionTime(left) - sessionTime(right)
    || left.importIndex - right.importIndex
    || left.name.localeCompare(right.name, "zh-Hans-CN")
  ));
  lines.push(`### ${title}`);
  lines.push("");
  if (sorted.length <= minPriorSessions) {
    lines.push(`样本只有 ${sorted.length} 条，不足以做 minPrior=${minPriorSessions} 的递进检验。`);
    lines.push("");
    return;
  }

  const matches: WalkForwardMatch[] = [];
  for (let index = minPriorSessions; index < sorted.length; index += 1) {
    const trainSessions = sorted.slice(0, index);
    const profiles = buildLongTermProfiles(trainSessions);
    const match = matchToLongTermProfiles(sorted[index], profiles);
    if (match) matches.push(match);
  }

  const exact = matches.filter((match) => match.distance === 0);
  const near = matches.filter((match) => match.distance <= 3 && match.profileCorrelation >= 0.15);
  const loose = matches.filter((match) => match.distance <= 5 && match.profileCorrelation >= 0);
  const drift = matches.filter((match) => match.distance >= 8 || match.profileCorrelation < -0.05);

  lines.push(`递进口径：第 N 条只用同一子集内第 1 到 N-1 条建自动空间画像；不使用当前条之后的数据，也不使用 TableId。`);
  lines.push(`可评估：${matches.length} 条；精确回到旧中心：${exact.length}/${matches.length}；近邻回归(distance<=3 且 corr>=0.15)：${near.length}/${matches.length}；宽松回归(distance<=5 且 corr>=0)：${loose.length}/${matches.length}；明显偏离：${drift.length}/${matches.length}。`);
  lines.push(`平均最近旧画像距离：${average(matches.map((match) => match.distance)).toFixed(2)}；平均旧画像相关性：${average(matches.map((match) => match.profileCorrelation)).toFixed(3)}。`);
  lines.push("");
  lines.push("| name | count | current top1 | matched old profile | distance | corr | profile train sessions |");
  lines.push("|---|---:|---|---|---:|---:|---:|");
  matches.slice(-12).forEach((match) => {
    lines.push(`| ${match.session.name} | ${match.session.numbers.length} | ${formatSector(match.actualTop)} | ${formatSector(match.profile.top)} | ${match.distance} | ${match.profileCorrelation.toFixed(3)} | ${match.profile.trainSessions} |`);
  });
  lines.push("");
}

function main(): void {
  const { sessions, rawCount, manualTableRows } = loadSessions();
  const featuresById = new Map(sessions.map((session) => [session.id, makeSessionFeature(session)]));
  const clusters = buildSpatialTableClusters(sessions);

  const allSpins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
  const halfStable = [...featuresById.values()].filter((feature) => feature.halfDistance <= 3 && feature.halfCorrelation >= 0.2);
  const halfDrift = [...featuresById.values()].filter((feature) => feature.halfDistance >= 8 || feature.halfCorrelation < -0.05);

  const lines: string[] = [];
  lines.push("# data_20260703 桌长期特征研究");
  lines.push("");
  lines.push(`输入文件：\`${path.relative(ROOT, INPUT_FILE).replace(/\\/g, "/")}\``);
  lines.push(`总记录：${rawCount} 条；参与分析：${sessions.length} 条；总号码：${allSpins}。`);
  lines.push(`文件中带手工 TableId 的记录：${manualTableRows} 条。本脚本解析时没有读取/使用 TableId，只按号码序列做空间分析。`);
  lines.push(`时间跨度：${formatDate(sessionTime(sessions[0]))} 到 ${formatDate(sessionTime(sessions[sessions.length - 1]))}。`);
  lines.push("");
  lines.push("## 1. 单局内部稳定性");
  lines.push("");
  lines.push(`把每局切成前半/后半，比较 7 邻区 top1 中心距离与整圈 sectorVector 相关性。`);
  lines.push("");
  lines.push(`- 前后半稳定候选：${halfStable.length}/${sessions.length} (${(halfStable.length / sessions.length * 100).toFixed(1)}%)，条件：top1 距离 <=3 且相关性 >=0.20。`);
  lines.push(`- 明显漂移候选：${halfDrift.length}/${sessions.length} (${(halfDrift.length / sessions.length * 100).toFixed(1)}%)，条件：top1 距离 >=8 或相关性 < -0.05。`);
  lines.push(`- 平均前后半 top1 距离：${average([...featuresById.values()].map((feature) => feature.halfDistance)).toFixed(2)} 格。`);
  lines.push(`- 平均前后半相关性：${average([...featuresById.values()].map((feature) => feature.halfCorrelation)).toFixed(3)}。`);
  lines.push("");
  lines.push("### 单局内部最稳定示例");
  lines.push("");
  lines.push("| name | count | first top1 | second top1 | distance | corr |");
  lines.push("|---|---:|---|---|---:|---:|");
  [...featuresById.values()]
    .sort((left, right) => left.halfDistance - right.halfDistance || right.halfCorrelation - left.halfCorrelation)
    .slice(0, 8)
    .forEach((feature) => {
      lines.push(`| ${feature.session.name} | ${feature.session.numbers.length} | ${formatSector(feature.firstTop[0])} | ${formatSector(feature.secondTop[0])} | ${feature.halfDistance} | ${feature.halfCorrelation.toFixed(3)} |`);
    });
  lines.push("");
  lines.push("### 单局内部明显漂移示例");
  lines.push("");
  lines.push("| name | count | first top1 | second top1 | distance | corr |");
  lines.push("|---|---:|---|---|---:|---:|");
  [...featuresById.values()]
    .sort((left, right) => right.halfDistance - left.halfDistance || left.halfCorrelation - right.halfCorrelation)
    .slice(0, 8)
    .forEach((feature) => {
      lines.push(`| ${feature.session.name} | ${feature.session.numbers.length} | ${formatSector(feature.firstTop[0])} | ${formatSector(feature.secondTop[0])} | ${feature.halfDistance} | ${feature.halfCorrelation.toFixed(3)} |`);
    });
  lines.push("");
  lines.push("## 2. 忽略手工分桌后的自动空间簇");
  lines.push("");
  lines.push(`自动空间聚类得到 ${clusters.length} 个簇。注意：这是按号码空间指纹形成的“空间状态簇”，不是手工桌号，也不等于确认物理桌。`);
  lines.push("");
  lines.push("| cluster | sessions | date span | aggregate top1 | consensus | avg pair dist | early top1 | late top1 | early-late | corr | verdict | centers over time |");
  lines.push("|---|---:|---|---|---:|---:|---|---|---:|---:|---|---|");

  for (const cluster of clusters) {
    const features = cluster.sessionIds
      .map((id) => featuresById.get(id))
      .filter((item): item is SessionFeature => Boolean(item))
      .sort((left, right) => sessionTime(left.session) - sessionTime(right.session));
    if (features.length === 0) continue;

    const clusterNumbers = features.flatMap((feature) => feature.session.numbers);
    const aggregateTop = topNonOverlappingSectors(clusterNumbers);
    const primary = aggregateTop[0];
    const consensus = primary
      ? features.filter((feature) => sectorDistance(feature.fullTop[0]?.center ?? primary.center, primary.center) <= 3).length / features.length
      : 0;
    const distances = pairDistances(features);
    const avgPairDistance = average(distances);

    const split = Math.max(1, Math.floor(features.length / 2));
    const early = features.slice(0, split);
    const late = features.slice(split);
    const earlyNumbers = early.flatMap((feature) => feature.session.numbers);
    const lateNumbers = late.length > 0
      ? late.flatMap((feature) => feature.session.numbers)
      : earlyNumbers;
    const earlyTop = topNonOverlappingSectors(earlyNumbers);
    const lateTop = topNonOverlappingSectors(lateNumbers);
    const earlyLateDistance = earlyTop[0] && lateTop[0] ? sectorDistance(earlyTop[0].center, lateTop[0].center) : 0;
    const earlyLateCorrelation = correlation(sectorVector(earlyNumbers), sectorVector(lateNumbers));
    const verdict = describeClusterStability(
      features.length,
      avgPairDistance,
      consensus,
      earlyLateDistance,
      earlyLateCorrelation,
      primary?.z ?? 0,
    );
    const firstTime = sessionTime(features[0].session);
    const lastTime = sessionTime(features[features.length - 1].session);
    lines.push(`| ${cluster.id} | ${features.length} | ${formatDate(firstTime)}~${formatDate(lastTime)} | ${formatSector(primary)} | ${(consensus * 100).toFixed(0)}% | ${avgPairDistance.toFixed(2)} | ${formatSector(earlyTop[0])} | ${formatSector(lateTop[0])} | ${earlyLateDistance} | ${earlyLateCorrelation.toFixed(3)} | ${verdict} | ${formatCenters(features)} |`);
  }

  lines.push("");
  appendClusterSummary(
    lines,
    "3. 重点子集：2026 澳门永利（忽略手工 TableId）",
    sessions.filter((session) => inferVenue(session.name) === "澳门永利" && inferYear(session) === 2026),
    featuresById,
  );

  appendClusterSummary(
    lines,
    "4. 参考子集：2026 wzs",
    sessions.filter((session) => inferVenue(session.name) === "wzs" && inferYear(session) === 2026),
    featuresById,
  );

  lines.push("## 5. 递进检验：只用更早数据建画像");
  lines.push("");
  appendWalkForwardCheck(lines, "全量数据", sessions, 12);
  appendWalkForwardCheck(
    lines,
    "2026 澳门永利",
    sessions.filter((session) => inferVenue(session.name) === "澳门永利" && inferYear(session) === 2026),
    8,
  );
  appendWalkForwardCheck(
    lines,
    "2026 wzs",
    sessions.filter((session) => inferVenue(session.name) === "wzs" && inferYear(session) === 2026),
    8,
  );

  lines.push("## 6. 结论");
  lines.push("");
  lines.push("1. 这份数据里确实能看到一些长期空间特征候选，尤其是自动空间簇中早晚期 top1 距离小、sectorVector 相关性为正、聚合 top1 z 值较高的簇。");
  lines.push("2. 但也有不少局前后半段明显漂移，说明不能假设一张桌的热区永久不变。更合理的表达是：某些空间状态会反复出现，且有些状态比其它状态更稳定。");
  lines.push("3. 由于本次完全忽略手工 TableId，自动簇只能解释为空间 regime，不应直接等同于真实物理桌。");
  lines.push("4. 后续若要实战使用，应把长期画像、近期画像、当前短窗分开，并用早晚期漂移/相关性给每个画像打“稳定/漂移/失效”标签。");

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(lines.join("\n"));
}

main();
