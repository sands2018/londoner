import type { RouletteNumber } from "./roulette";

export interface SpatialTableInputSession {
  id: string;
  name: string;
  numbers: readonly RouletteNumber[];
  updatedAt: string;
  importIndex?: number;
  tableId?: string;
}

export interface SpatialTableCluster {
  id: string;
  venueKey: string;
  sessionIds: string[];
  primaryCenters: RouletteNumber[];
  fingerprints: SpatialTableFingerprint[];
  representativeCenter: RouletteNumber;
  silhouette: number;
}

export interface SpatialTableFingerprint {
  venueKey: string;
  primaryCenter: RouletteNumber;
  primaryCenterIndex: number;
  topCenters: RouletteNumber[];
  topCounts: number[];
  topZs: number[];
}

interface Sector {
  startIndex: number;
  centerIndex: number;
  center: RouletteNumber;
  numbers: RouletteNumber[];
  count: number;
  z: number;
}

interface Fingerprint {
  session: SpatialTableInputSession;
  venueKey: string;
  primary: Sector;
  spatial: SpatialTableFingerprint;
}

interface ClusterResult {
  k: number;
  labels: number[];
  medoids: number[];
  silhouette: number;
  score?: number;
}

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_INDEX = new Map<RouletteNumber, number>(
  WHEEL_ORDER.map((number, index) => [number, index]),
);

const MIN_SPATIAL_CLUSTER_SESSIONS = 3;
const MIN_SPATIAL_SESSION_NUMBERS = 80;
const MAX_CLUSTER_COUNT = 6;

function numberToWheelIndex(number: RouletteNumber): number {
  return WHEEL_INDEX.get(number) ?? 0;
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, WHEEL_ORDER.length - distance);
}

export function spatialCenterDistance(left: RouletteNumber, right: RouletteNumber): number {
  return circularDistance(numberToWheelIndex(left), numberToWheelIndex(right));
}

export function spatialFingerprintDistance(
  left: SpatialTableFingerprint,
  right: SpatialTableFingerprint,
): number {
  const length = Math.max(left.topCenters.length, right.topCenters.length, 1);
  let total = 0;
  for (let index = 0; index < length; index += 1) {
    const weight = index === 0 ? 4 : index === 1 ? 2 : 1;
    const leftCenter = left.topCenters[index] ?? left.primaryCenter;
    const rightCenter = right.topCenters[index] ?? right.primaryCenter;
    const centerDistance = spatialCenterDistance(leftCenter, rightCenter);
    const leftCount = left.topCounts[index] ?? 0;
    const rightCount = right.topCounts[index] ?? 0;
    const countScale = Math.max(leftCount, rightCount, 1);
    const countDistance = Math.abs(leftCount - rightCount) / countScale;
    const leftZ = left.topZs[index] ?? 0;
    const rightZ = right.topZs[index] ?? 0;
    const zDistance = Math.abs(leftZ - rightZ) / 10;
    total += weight * (centerDistance + countDistance + zDistance);
  }
  return total;
}

function compareSessionsChronologically(left: SpatialTableInputSession, right: SpatialTableInputSession): number {
  const leftTime = new Date(left.updatedAt).getTime();
  const rightTime = new Date(right.updatedAt).getTime();
  const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
  const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
  return safeLeftTime - safeRightTime
    || (left.importIndex ?? Number.MAX_SAFE_INTEGER) - (right.importIndex ?? Number.MAX_SAFE_INTEGER)
    || left.name.localeCompare(right.name, "zh-Hans-CN")
    || left.id.localeCompare(right.id);
}

function sortSessionsChronologically<T extends SpatialTableInputSession>(sessions: readonly T[]): T[] {
  return [...sessions].sort(compareSessionsChronologically);
}

export function inferSpatialVenueKey(name: string): string {
  const trimmed = name.trim();
  if (/^wzs(?:-|$)/i.test(trimmed)) return "wzs";
  if (/^sxr(?:-|$)/i.test(trimmed)) return "sxr";

  const leadingDate = /^(\d{8}|\d{4}[-.]\d{2}[-.]\d{2})(?:[-_ ]\d{4})?/;
  if (!leadingDate.test(trimmed)) return "unknown";

  const withoutDate = trimmed
    .replace(leadingDate, "")
    .replace(/^[-_ ]+/, "");
  const parts = withoutDate
    .split(/[-_ ]+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^\d{3,4}$/.test(part))
    .filter((part) => !/^(上午|下午|晚上|凌晨|清晨|夜|早|中|晚)$/.test(part));

  return parts[parts.length - 1] || "unknown";
}

function makeCounts(numbers: readonly RouletteNumber[]): number[] {
  const counts = Array(WHEEL_ORDER.length).fill(0);
  for (const number of numbers) counts[numberToWheelIndex(number)] += 1;
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

export function makeSpatialTableFingerprint(
  session: SpatialTableInputSession,
  venueKey = inferSpatialVenueKey(session.name),
): SpatialTableFingerprint | null {
  if (session.numbers.length < MIN_SPATIAL_SESSION_NUMBERS) return null;
  const topSectors = topNonOverlappingSectors(session.numbers, 7, 3);
  if (topSectors.length === 0) return null;
  return makeSpatialTableFingerprintFromSectors(venueKey, topSectors);
}

function makeSpatialTableFingerprintFromSectors(
  venueKey: string,
  topSectors: readonly Sector[],
): SpatialTableFingerprint {
  return {
    venueKey,
    primaryCenter: topSectors[0].center,
    primaryCenterIndex: topSectors[0].centerIndex,
    topCenters: topSectors.map((sector) => sector.center),
    topCounts: topSectors.map((sector) => sector.count),
    topZs: topSectors.map((sector) => sector.z),
  };
}

function makeFingerprint(session: SpatialTableInputSession, venueKey: string): Fingerprint | null {
  if (session.numbers.length < MIN_SPATIAL_SESSION_NUMBERS) return null;
  const topSectors = topNonOverlappingSectors(session.numbers, 7, 3);
  if (topSectors.length === 0) return null;
  return {
    session,
    venueKey,
    primary: topSectors[0],
    spatial: makeSpatialTableFingerprintFromSectors(venueKey, topSectors),
  };
}

function assignToMedoids(fingerprints: readonly Fingerprint[], medoids: readonly number[]): number[] {
  return fingerprints.map((fingerprint) => {
    let bestLabel = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let label = 0; label < medoids.length; label += 1) {
      const medoid = fingerprints[medoids[label]];
      const distance = circularDistance(fingerprint.primary.centerIndex, medoid.primary.centerIndex);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestLabel = label;
      }
    }
    return bestLabel;
  });
}

function assignmentCost(fingerprints: readonly Fingerprint[], labels: readonly number[], medoids: readonly number[]): number {
  return labels.reduce((sum, label, index) => (
    sum + circularDistance(
      fingerprints[index].primary.centerIndex,
      fingerprints[medoids[label]].primary.centerIndex,
    )
  ), 0);
}

function combinations(size: number, choose: number): number[][] {
  const result: number[][] = [];
  const current: number[] = [];
  function walk(start: number): void {
    if (current.length === choose) {
      result.push([...current]);
      return;
    }
    for (let index = start; index <= size - (choose - current.length); index += 1) {
      current.push(index);
      walk(index + 1);
      current.pop();
    }
  }
  walk(0);
  return result;
}

function updateMedoids(fingerprints: readonly Fingerprint[], labels: readonly number[], k: number): number[] {
  const medoids: number[] = [];
  for (let label = 0; label < k; label += 1) {
    const indexes = labels.map((value, index) => value === label ? index : -1).filter((index) => index >= 0);
    if (indexes.length === 0) {
      medoids.push(0);
      continue;
    }
    let bestIndex = indexes[0];
    let bestCost = Number.POSITIVE_INFINITY;
    for (const candidate of indexes) {
      const cost = indexes.reduce((sum, index) => (
        sum + circularDistance(
          fingerprints[candidate].primary.centerIndex,
          fingerprints[index].primary.centerIndex,
        )
      ), 0);
      if (cost < bestCost) {
        bestCost = cost;
        bestIndex = candidate;
      }
    }
    medoids.push(bestIndex);
  }
  return medoids;
}

function initialMedoids(fingerprints: readonly Fingerprint[], k: number): number[] {
  const medoids = [0];
  while (medoids.length < k) {
    let bestIndex = 0;
    let bestDistance = -1;
    for (let index = 0; index < fingerprints.length; index += 1) {
      if (medoids.includes(index)) continue;
      const distance = Math.min(
        ...medoids.map((medoid) => circularDistance(
          fingerprints[index].primary.centerIndex,
          fingerprints[medoid].primary.centerIndex,
        )),
      );
      if (distance > bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }
    medoids.push(bestIndex);
  }
  return medoids;
}

function silhouette(fingerprints: readonly Fingerprint[], labels: readonly number[], k: number): number {
  if (k <= 1) return 0;
  let total = 0;
  for (let index = 0; index < fingerprints.length; index += 1) {
    const own = labels[index];
    const sums = Array(k).fill(0);
    const counts = Array(k).fill(0);
    for (let other = 0; other < fingerprints.length; other += 1) {
      if (other === index) continue;
      const label = labels[other];
      sums[label] += circularDistance(
        fingerprints[index].primary.centerIndex,
        fingerprints[other].primary.centerIndex,
      );
      counts[label] += 1;
    }
    const a = counts[own] > 0 ? sums[own] / counts[own] : 0;
    let b = Number.POSITIVE_INFINITY;
    for (let label = 0; label < k; label += 1) {
      if (label === own || counts[label] === 0) continue;
      b = Math.min(b, sums[label] / counts[label]);
    }
    if (!Number.isFinite(b)) b = 0;
    total += Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
  }
  return total / fingerprints.length;
}

function exactClusterByPrimaryArc(fingerprints: readonly Fingerprint[], k: number): ClusterResult {
  let best: ClusterResult | null = null;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const medoids of combinations(fingerprints.length, k)) {
    const labels = assignToMedoids(fingerprints, medoids);
    const cost = assignmentCost(fingerprints, labels, medoids);
    const candidate = { k, labels, medoids, silhouette: silhouette(fingerprints, labels, k) };
    if (
      cost < bestCost
      || (cost === bestCost && (!best || candidate.silhouette > best.silhouette))
    ) {
      best = candidate;
      bestCost = cost;
    }
  }
  return best ?? { k, labels: [], medoids: [], silhouette: 0 };
}

function clusterByPrimaryArc(fingerprints: readonly Fingerprint[], k: number): ClusterResult {
  if (fingerprints.length <= 14) {
    return exactClusterByPrimaryArc(fingerprints, k);
  }
  let medoids = initialMedoids(fingerprints, k);
  let labels = assignToMedoids(fingerprints, medoids);
  for (let iter = 0; iter < 20; iter += 1) {
    const nextMedoids = updateMedoids(fingerprints, labels, k);
    const nextLabels = assignToMedoids(fingerprints, nextMedoids);
    if (nextMedoids.join(",") === medoids.join(",") && nextLabels.join(",") === labels.join(",")) break;
    medoids = nextMedoids;
    labels = nextLabels;
  }
  return { k, labels, medoids, silhouette: silhouette(fingerprints, labels, k) };
}

function clusterSizes(labels: readonly number[], k: number): number[] {
  const sizes = Array(k).fill(0);
  labels.forEach((label) => { sizes[label] += 1; });
  return sizes;
}

function clusterScore(result: ClusterResult, sampleSize: number): number {
  const sizes = clusterSizes(result.labels, result.k);
  const singletonPenalty = sizes.some((size) => size === 1) && sampleSize >= 6 ? 0.08 : 0;
  const complexityPenalty = Math.max(0, result.k - 1) * 0.01;
  return result.silhouette - complexityPenalty - singletonPenalty;
}

function chooseClusterCount(fingerprints: readonly Fingerprint[]): ClusterResult {
  const maxK = Math.min(MAX_CLUSTER_COUNT, fingerprints.length);
  const candidates: ClusterResult[] = [];
  for (let k = 1; k <= maxK; k += 1) {
    const result = clusterByPrimaryArc(fingerprints, k);
    result.score = clusterScore(result, fingerprints.length);
    candidates.push(result);
  }
  const minClusterSize = fingerprints.length >= 6 ? 2 : 1;
  const viable = candidates.filter((result) => (
    clusterSizes(result.labels, result.k).every((size) => size >= minClusterSize)
  ));
  let best: ClusterResult | null = null;
  for (const result of viable.length > 0 ? viable : candidates) {
    const currentScore = best?.score ?? Number.NEGATIVE_INFINITY;
    const score = result.score ?? clusterScore(result, fingerprints.length);
    if (!best || score > currentScore) best = result;
  }
  return best ?? clusterByPrimaryArc(fingerprints, 1);
}

export function buildSpatialTableClusters(sessions: readonly SpatialTableInputSession[]): SpatialTableCluster[] {
  const groups = new Map<string, Fingerprint[]>();
  for (const session of sortSessionsChronologically(sessions)) {
    const venueKey = inferSpatialVenueKey(session.name);
    if (venueKey === "unknown") continue;
    const fingerprint = makeFingerprint(session, venueKey);
    if (!fingerprint) continue;
    const group = groups.get(venueKey) ?? [];
    group.push(fingerprint);
    groups.set(venueKey, group);
  }

  const clusters: SpatialTableCluster[] = [];
  for (const [venueKey, fingerprints] of groups) {
    if (fingerprints.length < MIN_SPATIAL_CLUSTER_SESSIONS) continue;
    const result = chooseClusterCount(fingerprints);
    let clusterOrdinal = 1;
    for (let label = 0; label < result.k; label += 1) {
      const members = fingerprints
        .map((fingerprint, index) => ({ fingerprint, index }))
        .filter((item) => result.labels[item.index] === label)
        .sort((left, right) => compareSessionsChronologically(left.fingerprint.session, right.fingerprint.session));
      if (members.length === 0) continue;
      const medoid = fingerprints[result.medoids[label]] ?? members[0].fingerprint;
      clusters.push({
        id: `${venueKey}:${clusterOrdinal}`,
        venueKey,
        sessionIds: members.map((member) => member.fingerprint.session.id),
        primaryCenters: members.map((member) => member.fingerprint.primary.center),
        fingerprints: members.map((member) => member.fingerprint.spatial),
        representativeCenter: medoid.primary.center,
        silhouette: result.silhouette,
      });
      clusterOrdinal += 1;
    }
  }

  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  return clusters.sort((left, right) => {
    const leftFirst = left.sessionIds.map((id) => sessionById.get(id)).find(Boolean);
    const rightFirst = right.sessionIds.map((id) => sessionById.get(id)).find(Boolean);
    if (!leftFirst && !rightFirst) return left.id.localeCompare(right.id);
    if (!leftFirst) return 1;
    if (!rightFirst) return -1;
    return compareSessionsChronologically(leftFirst, rightFirst);
  });
}
