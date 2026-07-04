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

interface ArchetypeFeature {
  session: Session;
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

interface ClusterResult {
  k: number;
  labels: number[];
  medoids: number[];
  silhouette: number;
  score: number;
}

interface AssignedFeature {
  feature: ArchetypeFeature;
  clusterIndex: number;
  nearest: number;
  secondNearest: number;
  margin: number;
  confidence: "strong" | "medium" | "weak";
}

interface Motif {
  id: string;
  label: string;
  description: string;
  predicate: (feature: ArchetypeFeature) => boolean;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "state-archetypes-20260703.md");

const MIN_SESSION_NUMBERS = 160;
const RECENT_WINDOW = 80;
const SNAPSHOT_RATIOS = [0.25, 0.40, 0.55, 0.70, 0.85, 1.0] as const;
const K_MIN = 8;
const K_MAX = 16;

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
  })).filter((session) => session.numbers.length >= MIN_SESSION_NUMBERS);

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

function signedWheelDelta(left: RouletteNumber, right: RouletteNumber): number {
  const delta = wheelIndex(right) - wheelIndex(left);
  if (delta > 18) return delta - 37;
  if (delta < -18) return delta + 37;
  return delta;
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

function stdev(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
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

function makeFeature(session: Session): ArchetypeFeature {
  const snapshots = pickPrefixes(session.numbers.length).map(({ prefix, ratio }) => {
    const cumulative = session.numbers.slice(0, prefix);
    const recent = session.numbers.slice(Math.max(0, prefix - RECENT_WINDOW), prefix);
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

  const [fullTop, fullTop2] = topSectorPair(session.numbers);
  const firstHalf = session.numbers.slice(0, Math.floor(session.numbers.length / 2));
  const secondHalf = session.numbers.slice(Math.floor(session.numbers.length / 2));
  const cumulativeCenters = snapshots.map((snapshot) => snapshot.cumulativeTop.center);
  const recentCenters = snapshots.map((snapshot) => snapshot.recentTop.center);
  const recentSteps = recentCenters.slice(1).map((center, index) => sectorDistance(recentCenters[index], center));
  const zValues = snapshots.map((snapshot) => snapshot.recentTop.z);
  const shape = lineShape(session.numbers.slice(Math.max(0, session.numbers.length - 120)));
  return {
    session,
    snapshots,
    fullTop,
    fullTop2,
    fullVector: sectorVector(session.numbers),
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

function featureDistance(left: ArchetypeFeature, right: ArchetypeFeature): number {
  const length = Math.min(left.snapshots.length, right.snapshots.length);
  let cumulativeDistance = 0;
  let recentDistance = 0;
  let vectorDistance = 0;
  let zDistance = 0;
  for (let index = 0; index < length; index += 1) {
    cumulativeDistance += sectorDistance(left.snapshots[index].cumulativeTop.center, right.snapshots[index].cumulativeTop.center) / 18;
    recentDistance += sectorDistance(left.snapshots[index].recentTop.center, right.snapshots[index].recentTop.center) / 18;
    vectorDistance += (1 - correlation(left.snapshots[index].recentVector, right.snapshots[index].recentVector)) / 2;
    zDistance += Math.min(1, Math.abs(left.snapshots[index].recentTop.z - right.snapshots[index].recentTop.z) / 4);
  }
  cumulativeDistance /= length;
  recentDistance /= length;
  vectorDistance /= length;
  zDistance /= length;

  const behaviorLeft = [
    left.earlyLateCorrelation,
    left.cumulativeDrift / 18,
    left.recentDrift / 18,
    left.maxRecentJump / 18,
    left.recentAvgStep / 18,
    left.persistenceToFull,
    Math.max(-1, Math.min(1, left.zSlope / 4)),
    Math.max(-1, Math.min(1, left.fullZ / 4)),
    left.duality,
    Math.max(0, Math.min(1, left.lineBias / 4)),
  ];
  const behaviorRight = [
    right.earlyLateCorrelation,
    right.cumulativeDrift / 18,
    right.recentDrift / 18,
    right.maxRecentJump / 18,
    right.recentAvgStep / 18,
    right.persistenceToFull,
    Math.max(-1, Math.min(1, right.zSlope / 4)),
    Math.max(-1, Math.min(1, right.fullZ / 4)),
    right.duality,
    Math.max(0, Math.min(1, right.lineBias / 4)),
  ];
  const behaviorDistance = Math.sqrt(average(behaviorLeft.map((value, index) => (value - behaviorRight[index]) ** 2)));
  const lineDistance = Math.sqrt(average(left.lineShape.map((value, index) => {
    const diff = value - right.lineShape[index];
    return diff * diff;
  }))) / 4;

  return (
    cumulativeDistance * 0.22
    + recentDistance * 0.24
    + vectorDistance * 0.18
    + zDistance * 0.08
    + behaviorDistance * 0.20
    + Math.min(1, lineDistance) * 0.08
  );
}

function distanceMatrix(features: readonly ArchetypeFeature[]): number[][] {
  return features.map((left, leftIndex) => features.map((right, rightIndex) => (
    leftIndex === rightIndex ? 0 : featureDistance(left, right)
  )));
}

function assignToMedoids(distances: readonly number[][], medoids: readonly number[]): number[] {
  return distances.map((row) => {
    let bestLabel = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    medoids.forEach((medoid, label) => {
      if (row[medoid] < bestDistance) {
        bestDistance = row[medoid];
        bestLabel = label;
      }
    });
    return bestLabel;
  });
}

function initializeMedoids(distances: readonly number[][], k: number): number[] {
  const medoids = [0];
  while (medoids.length < k) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let index = 0; index < distances.length; index += 1) {
      if (medoids.includes(index)) continue;
      const nearest = Math.min(...medoids.map((medoid) => distances[index][medoid]));
      if (nearest > bestDistance) {
        bestDistance = nearest;
        bestIndex = index;
      }
    }
    medoids.push(bestIndex);
  }
  return medoids;
}

function updateMedoids(distances: readonly number[][], labels: readonly number[], k: number): number[] {
  const medoids: number[] = [];
  for (let label = 0; label < k; label += 1) {
    const members = labels.map((item, index) => item === label ? index : -1).filter((index) => index >= 0);
    let bestMember = members[0] ?? 0;
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidate of members) {
      const cost = members.reduce((sum, member) => sum + distances[candidate][member], 0);
      if (cost < bestCost) {
        bestCost = cost;
        bestMember = candidate;
      }
    }
    medoids.push(bestMember);
  }
  return medoids;
}

function sameArray(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function silhouette(distances: readonly number[][], labels: readonly number[], k: number): number {
  const values = distances.map((row, index) => {
    const ownLabel = labels[index];
    const ownMembers = labels.map((label, member) => label === ownLabel && member !== index ? member : -1).filter((member) => member >= 0);
    const a = ownMembers.length > 0 ? average(ownMembers.map((member) => row[member])) : 0;
    const b = Math.min(...Array.from({ length: k }, (_, label) => {
      if (label === ownLabel) return Number.POSITIVE_INFINITY;
      const members = labels.map((item, member) => item === label ? member : -1).filter((member) => member >= 0);
      return members.length > 0 ? average(members.map((member) => row[member])) : Number.POSITIVE_INFINITY;
    }));
    return Number.isFinite(b) && Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
  });
  return average(values);
}

function kMedoids(distances: readonly number[][], k: number): ClusterResult {
  let medoids = initializeMedoids(distances, k);
  let labels = assignToMedoids(distances, medoids);
  for (let iteration = 0; iteration < 30; iteration += 1) {
    const nextMedoids = updateMedoids(distances, labels, k);
    const nextLabels = assignToMedoids(distances, nextMedoids);
    if (sameArray(medoids, nextMedoids) && sameArray(labels, nextLabels)) break;
    medoids = nextMedoids;
    labels = nextLabels;
  }
  const sil = silhouette(distances, labels, k);
  const sizes = Array.from({ length: k }, (_, label) => labels.filter((item) => item === label).length);
  const tinyPenalty = sizes.filter((size) => size < 4).length * 0.03;
  const balancePenalty = stdev(sizes) / Math.max(1, average(sizes)) * 0.02;
  return {
    k,
    labels,
    medoids,
    silhouette: sil,
    score: sil - tinyPenalty - balancePenalty,
  };
}

function nearestInfo(distances: readonly number[][], index: number, medoids: readonly number[]): { nearest: number; second: number; label: number } {
  const sorted = medoids
    .map((medoid, label) => ({ label, distance: distances[index][medoid] }))
    .sort((left, right) => left.distance - right.distance);
  return {
    label: sorted[0].label,
    nearest: sorted[0].distance,
    second: sorted[1]?.distance ?? sorted[0].distance,
  };
}

function confidenceFrom(nearest: number, secondNearest: number, clusterAverage: number): AssignedFeature["confidence"] {
  const margin = secondNearest - nearest;
  const threshold = Math.max(clusterAverage * 1.65, 0.20);
  if (nearest <= threshold * 0.85 && margin >= 0.08) return "strong";
  if (nearest <= threshold && margin >= 0.035) return "medium";
  return "weak";
}

function formatSector(sector: Sector): string {
  return `${sector.center} [${sector.numbers.join("-")}] z=${sector.z.toFixed(2)}`;
}

function centerSequence(feature: ArchetypeFeature, kind: "cumulative" | "recent"): string {
  return feature.snapshots.map((snapshot) => (
    kind === "cumulative" ? snapshot.cumulativeTop.center : snapshot.recentTop.center
  )).join(" -> ");
}

function describeMovement(feature: ArchetypeFeature): string {
  const recentCenters = feature.snapshots.map((snapshot) => snapshot.recentTop.center);
  const signed = recentCenters.slice(1).map((center, index) => signedWheelDelta(recentCenters[index], center));
  const direction = Math.abs(average(signed)) >= 2
    ? average(signed) > 0 ? "顺轮偏移" : "逆轮偏移"
    : "来回摆动";
  if (feature.maxRecentJump >= 10) return `突变换区/${direction}`;
  if (feature.recentDrift >= 8) return `跨区漂移/${direction}`;
  if (feature.recentDrift <= 3 && feature.persistenceToFull >= 0.5) return "热区相对固定";
  return `温和漂移/${direction}`;
}

function lineBiasLabel(feature: ArchetypeFeature): string {
  const labels = ["一组", "二组", "三组", "1行", "2行", "3行"];
  const bestIndex = feature.lineShape
    .map((value, index) => ({ value, index }))
    .sort((left, right) => Math.abs(right.value) - Math.abs(left.value))[0]?.index ?? 0;
  const value = feature.lineShape[bestIndex] ?? 0;
  return `${labels[bestIndex]}${value >= 0 ? "+" : "-"}${Math.abs(value).toFixed(1)}`;
}

function clusterName(features: readonly ArchetypeFeature[]): string {
  const medoid = features[Math.floor(features.length / 2)];
  const avgFullZ = average(features.map((feature) => feature.fullZ));
  const avgDrift = average(features.map((feature) => feature.recentDrift));
  const avgJump = average(features.map((feature) => feature.maxRecentJump));
  const avgCorr = average(features.map((feature) => feature.earlyLateCorrelation));
  const avgDual = average(features.map((feature) => feature.duality));
  const avgSlope = average(features.map((feature) => feature.zSlope));
  const strength = avgFullZ >= 2 ? "强热" : avgFullZ >= 1.2 ? "中热" : "弱热";
  let motion = "漂移";
  if (avgDrift <= 3.5 && avgCorr >= 0.15) motion = "稳定";
  else if (avgJump >= 8) motion = "突变";
  else if (avgDrift >= 7) motion = "远移";
  else if (avgDual >= 0.72) motion = "双区";
  const trend = avgSlope >= 0.55 ? "增强" : avgSlope <= -0.55 ? "衰退" : "";
  return `${strength}${motion}${trend ? `/${trend}` : ""} ${medoid.fullTop.center}区`;
}

function clusterNotes(features: readonly ArchetypeFeature[], medoid: ArchetypeFeature): string {
  const avgFullZ = average(features.map((feature) => feature.fullZ));
  const avgDrift = average(features.map((feature) => feature.recentDrift));
  const avgJump = average(features.map((feature) => feature.maxRecentJump));
  const avgCorr = average(features.map((feature) => feature.earlyLateCorrelation));
  const avgPersistence = average(features.map((feature) => feature.persistenceToFull));
  const avgDual = average(features.map((feature) => feature.duality));
  const avgSlope = average(features.map((feature) => feature.zSlope));
  const pieces = [
    `代表区 ${formatSector(medoid.fullTop)}`,
    `累积轨迹 ${centerSequence(medoid, "cumulative")}`,
    `短窗轨迹 ${centerSequence(medoid, "recent")}`,
    `均值 z=${avgFullZ.toFixed(2)}`,
    `短窗漂移=${avgDrift.toFixed(1)}`,
    `最大跳变=${avgJump.toFixed(1)}`,
    `前后相关=${avgCorr.toFixed(2)}`,
    `持久度=${(avgPersistence * 100).toFixed(0)}%`,
    `双区=${avgDual.toFixed(2)}`,
    `强弱变化=${avgSlope >= 0 ? "+" : ""}${avgSlope.toFixed(2)}`,
  ];
  return pieces.join("；");
}

function lastSnapshot(feature: ArchetypeFeature): SnapshotFeature {
  return feature.snapshots[feature.snapshots.length - 1];
}

function finalRecentDistance(feature: ArchetypeFeature): number {
  return sectorDistance(lastSnapshot(feature).recentTop.center, feature.fullTop.center);
}

function makeMotifs(): Motif[] {
  return [
    {
      id: "M01",
      label: "累积热区稳定",
      description: "累积热区多次落回同一轮盘邻区，适合当作长期画像候选。",
      predicate: (feature) => feature.fullZ >= 1.5 && feature.persistenceToFull >= 0.67 && feature.cumulativeDrift <= 3,
    },
    {
      id: "M02",
      label: "稳定画像+短窗换区",
      description: "长期累积画像稳定，但最近 80 口已经明显换区，适合观察画像是否失效。",
      predicate: (feature) => feature.persistenceToFull >= 0.67 && feature.recentDrift >= 8,
    },
    {
      id: "M03",
      label: "强单热区",
      description: "全局 7 邻区 z 值很高，说明热区强度本身突出。",
      predicate: (feature) => feature.fullZ >= 2.4,
    },
    {
      id: "M04",
      label: "双热区并存",
      description: "top1/top2 接近，可能不是一个单中心，而是两个区域共同抬头。",
      predicate: (feature) => feature.fullZ >= 1.3 && feature.duality >= 0.78,
    },
    {
      id: "M05",
      label: "后段增强",
      description: "最近热区强度从早期到后期明显增强。",
      predicate: (feature) => feature.fullZ >= 1.5 && feature.zSlope >= 0.75,
    },
    {
      id: "M06",
      label: "后段衰退",
      description: "早期热区较明显，后段热度明显走弱。",
      predicate: (feature) => feature.zSlope <= -0.75,
    },
    {
      id: "M07",
      label: "前后同向",
      description: "前半和后半整圈形状相关性较高，整体状态连续性好。",
      predicate: (feature) => feature.earlyLateCorrelation >= 0.35,
    },
    {
      id: "M08",
      label: "前后反相",
      description: "前半和后半整圈形状明显不一致，属于强漂移或换状态。",
      predicate: (feature) => feature.earlyLateCorrelation <= -0.25,
    },
    {
      id: "M09",
      label: "短窗大跳变",
      description: "最近 80 口热区中心在快照间出现大幅跳变。",
      predicate: (feature) => feature.maxRecentJump >= 14,
    },
    {
      id: "M10",
      label: "跨区远移",
      description: "累积或短窗热区从早期到后期移动距离很远。",
      predicate: (feature) => feature.recentDrift >= 10 && feature.cumulativeDrift >= 5,
    },
    {
      id: "M11",
      label: "行组强偏",
      description: "最近 120 口在某一组或某一行上偏离明显。",
      predicate: (feature) => feature.lineBias >= 2.2,
    },
    {
      id: "M12",
      label: "弱热噪声",
      description: "全局热区不强，且持久度不高，暂时不适合强行画像。",
      predicate: (feature) => feature.fullZ <= 1.25 && feature.persistenceToFull <= 0.5,
    },
    {
      id: "M13",
      label: "短长共振",
      description: "最新短窗热区和全局累积热区接近，短期与长期同向。",
      predicate: (feature) => feature.fullZ >= 1.5 && finalRecentDistance(feature) <= 3,
    },
    {
      id: "M14",
      label: "短窗背离长期",
      description: "全局有热区，但最新短窗已经跑到远处，适合观察切换。",
      predicate: (feature) => feature.fullZ >= 1.5 && finalRecentDistance(feature) >= 8,
    },
  ];
}

function motifExamples(features: readonly ArchetypeFeature[]): string {
  return features
    .sort((left, right) => right.fullZ - left.fullZ)
    .slice(0, 4)
    .map((feature) => feature.session.name)
    .join("<br>");
}

function main(): void {
  const { sessions, rawCount, manualRows } = loadSessions();
  const features = sessions.map(makeFeature);
  const distances = distanceMatrix(features);
  const candidates = Array.from({ length: K_MAX - K_MIN + 1 }, (_, offset) => kMedoids(distances, K_MIN + offset));
  const chosen = candidates
    .filter((candidate) => candidate.k >= 10 && candidate.k <= 14)
    .sort((left, right) => right.score - left.score)[0]
    ?? candidates.sort((left, right) => right.score - left.score)[0];

  const clusterAverageDistances = Array.from({ length: chosen.k }, (_, label) => {
    const members = chosen.labels.map((item, index) => item === label ? index : -1).filter((index) => index >= 0);
    const medoid = chosen.medoids[label];
    return average(members.map((index) => distances[index][medoid]));
  });

  const assigned = features.map((feature, index): AssignedFeature => {
    const nearest = nearestInfo(distances, index, chosen.medoids);
    const margin = nearest.second - nearest.nearest;
    return {
      feature,
      clusterIndex: nearest.label,
      nearest: nearest.nearest,
      secondNearest: nearest.second,
      margin,
      confidence: confidenceFrom(nearest.nearest, nearest.second, clusterAverageDistances[nearest.label]),
    };
  });

  const lines: string[] = [];
  lines.push("# 桌面局面特征类型研究");
  lines.push("");
  lines.push(`输入：\`${path.relative(ROOT, INPUT_FILE).replace(/\\/g, "/")}\``);
  lines.push(`原始记录 ${rawCount} 条；参与分类 ${sessions.length} 条，条件是号码数 >= ${MIN_SESSION_NUMBERS}。`);
  lines.push(`文件中带手工 TableId 的记录 ${manualRows} 条；本研究不读取、不使用 TableId。`);
  lines.push(`时间范围：${formatDate(sessionTime(sessions[0]))} 到 ${formatDate(sessionTime(sessions[sessions.length - 1]))}。`);
  lines.push("");
  lines.push("## 抽取的特征");
  lines.push("");
  lines.push("- 累积热区：从开局到当前快照的 7 邻区 top1/top2。");
  lines.push("- 最近热区：当前快照前 80 口的 7 邻区 top1/top2。");
  lines.push("- 热区演进：25%/40%/55%/70%/85%/100% 六个快照的中心轨迹、漂移距离、最大跳变。");
  lines.push("- 热区强弱：top1 z 值、前后 z 变化、top1/top2 接近程度。");
  lines.push("- 整圈形状：sectorVector 相关性，避免只看一个中心点。");
  lines.push("- 行组偏置：最近 120 口的一组/二组/三组/1行/2行/3行偏离。");
  lines.push("");
  lines.push("## K 选择");
  lines.push("");
  lines.push("| K | silhouette | score |");
  lines.push("|---:|---:|---:|");
  candidates.forEach((candidate) => {
    lines.push(`| ${candidate.k} | ${candidate.silhouette.toFixed(3)} | ${candidate.score.toFixed(3)} |`);
  });
  lines.push("");
  lines.push(`本次选择 K=${chosen.k}，形成 ${chosen.k} 个局面类型。分类允许 weak，weak 不适合直接作为明确类型使用。`);
  lines.push("");
  lines.push("## 可解释特征线索");
  lines.push("");
  lines.push("下面这组不是互斥分类，而是“可读标签”。一局可以同时命中多个标签；没有命中也可以保留为无明显线索。");
  lines.push("");
  lines.push("| motif | label | count | avg z | drift | jump | corr | short-long | line | description | examples |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---|---|---|");
  makeMotifs().forEach((motif) => {
    const matched = features.filter(motif.predicate);
    if (matched.length === 0) return;
    lines.push(`| ${motif.id} | ${motif.label} | ${matched.length} | ${average(matched.map((feature) => feature.fullZ)).toFixed(2)} | ${average(matched.map((feature) => feature.recentDrift)).toFixed(1)} | ${average(matched.map((feature) => feature.maxRecentJump)).toFixed(1)} | ${average(matched.map((feature) => feature.earlyLateCorrelation)).toFixed(2)} | ${average(matched.map(finalRecentDistance)).toFixed(1)} | ${lineBiasLabel(matched[0])} | ${motif.description} | ${motifExamples(matched)} |`);
  });
  lines.push("");
  lines.push("## 类型总表");
  lines.push("");
  lines.push("| type | name | sessions | strong/medium/weak | medoid | date span | avg z | drift | jump | corr | dual | line | examples |");
  lines.push("|---|---|---:|---|---|---|---:|---:|---:|---:|---:|---|---|");

  for (let label = 0; label < chosen.k; label += 1) {
    const rows = assigned.filter((item) => item.clusterIndex === label);
    const clusterFeatures = rows.map((row) => row.feature);
    const medoid = features[chosen.medoids[label]];
    const strong = rows.filter((row) => row.confidence === "strong").length;
    const medium = rows.filter((row) => row.confidence === "medium").length;
    const weak = rows.filter((row) => row.confidence === "weak").length;
    const sortedByTime = [...clusterFeatures].sort((left, right) => sessionTime(left.session) - sessionTime(right.session));
    const examples = rows
      .sort((left, right) => left.nearest - right.nearest)
      .slice(0, 3)
      .map((row) => row.feature.session.name)
      .join("<br>");
    lines.push(`| T${String(label + 1).padStart(2, "0")} | ${clusterName(clusterFeatures)} | ${rows.length} | ${strong}/${medium}/${weak} | ${medoid.session.name} | ${formatDate(sessionTime(sortedByTime[0].session))}~${formatDate(sessionTime(sortedByTime[sortedByTime.length - 1].session))} | ${average(clusterFeatures.map((feature) => feature.fullZ)).toFixed(2)} | ${average(clusterFeatures.map((feature) => feature.recentDrift)).toFixed(1)} | ${average(clusterFeatures.map((feature) => feature.maxRecentJump)).toFixed(1)} | ${average(clusterFeatures.map((feature) => feature.earlyLateCorrelation)).toFixed(2)} | ${average(clusterFeatures.map((feature) => feature.duality)).toFixed(2)} | ${lineBiasLabel(medoid)} | ${examples} |`);
  }

  lines.push("");
  lines.push("## 类型详解");
  lines.push("");
  for (let label = 0; label < chosen.k; label += 1) {
    const rows = assigned.filter((item) => item.clusterIndex === label);
    const clusterFeatures = rows.map((row) => row.feature);
    const medoid = features[chosen.medoids[label]];
    lines.push(`### T${String(label + 1).padStart(2, "0")} ${clusterName(clusterFeatures)}`);
    lines.push("");
    lines.push(clusterNotes(clusterFeatures, medoid));
    lines.push("");
    lines.push(`运动判断：${describeMovement(medoid)}；行组偏置：${lineBiasLabel(medoid)}。`);
    lines.push("");
    lines.push("| confidence | session | count | full top | recent path | distance | margin |");
    lines.push("|---|---|---:|---|---|---:|---:|");
    rows
      .sort((left, right) => left.nearest - right.nearest)
      .slice(0, 8)
      .forEach((row) => {
        lines.push(`| ${row.confidence} | ${row.feature.session.name} | ${row.feature.session.numbers.length} | ${formatSector(row.feature.fullTop)} | ${centerSequence(row.feature, "recent")} | ${row.nearest.toFixed(3)} | ${row.margin.toFixed(3)} |`);
      });
    lines.push("");
  }

  const weakRows = assigned.filter((item) => item.confidence === "weak");
  lines.push("## 弱归类样本");
  lines.push("");
  lines.push(`弱归类 ${weakRows.length}/${assigned.length}。这些局面离最近类型不够近，或者和第二近类型差距太小，暂时不适合作为明确特征类型。`);
  lines.push("");
  lines.push("| session | nearest type | nearest | margin | full top | recent path |");
  lines.push("|---|---|---:|---:|---|---|");
  weakRows
    .sort((left, right) => left.margin - right.margin || right.nearest - left.nearest)
    .slice(0, 20)
    .forEach((row) => {
      lines.push(`| ${row.feature.session.name} | T${String(row.clusterIndex + 1).padStart(2, "0")} | ${row.nearest.toFixed(3)} | ${row.margin.toFixed(3)} | ${formatSector(row.feature.fullTop)} | ${centerSequence(row.feature, "recent")} |`);
    });
  lines.push("");
  lines.push("## 初步结论");
  lines.push("");
  lines.push("1. 这批数据确实能归纳出十来类可读的局面特征，但它们应被称为“局面类型”或“空间状态类型”，不是物理桌身份。");
  lines.push("2. 最清楚的类型通常同时满足：热区中心轨迹接近、最近 80 口轨迹相似、整圈 sectorVector 相关、行组偏置方向接近。");
  lines.push("3. 弱归类样本要保留为“不可判定”，这比强行分桌更重要。");
  lines.push("4. 下一步若要变成预示工具，应只把 strong/medium 类型拿去做递进后验：每类后 1/2/3/5 口落点、ROI、SP100、均匀度。");

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(lines.join("\n"));
}

main();
