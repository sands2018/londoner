import fs from "node:fs";
import path from "node:path";
import { getHistoryDataIso } from "./historyTime";

type RouletteNumber = number;

interface RawHistoryRow {
  Count?: number;
  Name?: string;
  Numbers?: string | number[];
  SaveTime?: string;
  tms?: number;
  ImportIndex?: number;
  SharedUploader?: string;
}

interface Session {
  id: string;
  sourceIndex: number;
  name: string;
  saveTime: string;
  count: number;
  numbers: RouletteNumber[];
  venueKey: string;
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
  session: Session;
  primary: Sector;
  topSectors: Sector[];
  nearMoveRate: number;
  oppositeMoveRate: number;
}

interface ClusterResult {
  k: number;
  labels: number[];
  medoids: number[];
  silhouette: number;
  score?: number;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_DIR = path.join(ROOT, "HistoryData");

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_INDEX = new Map<RouletteNumber, number>(
  WHEEL_ORDER.map((number, index) => [number, index]),
);

const MANUAL_JUNE_TABLE = new Map<string, string>([
  ["20260601-1630", "澳门永利_01"],
  ["20260602-0018", "澳门永利_01"],
  ["20260604-1630", "澳门永利_01"],
  ["20260603-0030", "澳门永利_02"],
  ["20260603-2101", "澳门永利_02"],
  ["20260604-2223", "澳门永利_02"],
  ["20260605-0230", "澳门永利_02"],
  ["20260603-0230", "澳门永利_03"],
  ["20260606-0131", "澳门永利_03"],
  ["20260607-0217", "澳门永利_03"],
]);

function resolveHistoryFile(): string {
  const requested = process.argv.find((arg) => arg.startsWith("--file="))?.slice("--file=".length);
  if (requested) return path.resolve(ROOT, requested);
  const exact = fs.readdirSync(HISTORY_DIR)
    .find((fileName) => fileName.startsWith("data_2026.6.11") && fileName.endsWith(".json"));
  if (!exact) throw new Error("Cannot find HistoryData/data_2026.6.11*.json");
  return path.join(HISTORY_DIR, exact);
}

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => (
    Number.isInteger(value) && value >= 0 && value <= 36
  ));
}

function cleanName(name: string): string {
  return name
    .replace(/æ¾³é—¨æ°¸åˆ©/g, "澳门永利")
    .replace(/å–œæ¥ç™»/g, "喜来登")
    .replace(/å·´é»Žäºº/g, "巴黎人")
    .replace(/ä¼¦æ•¦äºº/g, "伦敦人");
}

function inferVenueKey(name: string): string {
  const normalized = cleanName(name);
  const known = ["澳门永利", "伦敦人", "巴黎人", "喜来登", "威尼斯人", "银河", "假日"];
  for (const venue of known) {
    if (normalized.includes(venue)) return venue;
  }
  if (normalized.startsWith("wzs-")) return "wzs";
  if (normalized.startsWith("sxr-")) return "sxr";
  const stripped = normalized
    .replace(/^\d{8}(?:-\d{4})?-?/, "")
    .replace(/^(上午|下午|晚上|凌晨|清晨|夜|上下午)-?/, "");
  return stripped || "unknown";
}

function sessionKey(name: string): string {
  return cleanName(name).replace(/-澳门永利$/, "");
}

function numberToWheelIndex(number: RouletteNumber): number {
  return WHEEL_INDEX.get(number) ?? 0;
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, WHEEL_ORDER.length - distance);
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

function movementRates(numbers: readonly RouletteNumber[]): { nearMoveRate: number; oppositeMoveRate: number } {
  if (numbers.length < 2) return { nearMoveRate: 0, oppositeMoveRate: 0 };
  let near = 0;
  let opposite = 0;
  for (let index = 1; index < numbers.length; index += 1) {
    const left = numberToWheelIndex(numbers[index - 1]);
    const right = numberToWheelIndex(numbers[index]);
    const distance = circularDistance(left, right);
    if (distance <= 2) near += 1;
    if (distance >= 16) opposite += 1;
  }
  const total = numbers.length - 1;
  return { nearMoveRate: near / total, oppositeMoveRate: opposite / total };
}

function makeFingerprint(session: Session): Fingerprint {
  const topSectors = topNonOverlappingSectors(session.numbers, 7, 3);
  const moves = movementRates(session.numbers);
  return {
    session,
    primary: topSectors[0],
    topSectors,
    ...moves,
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
  const singletonPenalty = sizes.some((size) => size === 1) && sampleSize >= 8 ? 0.08 : 0;
  const complexityPenalty = Math.max(0, result.k - 1) * 0.01;
  return result.silhouette - complexityPenalty - singletonPenalty;
}

function chooseClusterCount(fingerprints: readonly Fingerprint[]): ClusterResult {
  const maxK = Math.min(6, fingerprints.length);
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

function loadSessions(): Session[] {
  const historyPath = resolveHistoryFile();
  const raw = JSON.parse(fs.readFileSync(historyPath, "utf8")) as RawHistoryRow[];
  return raw
    .map((row, sourceIndex) => {
      const name = cleanName(String(row.Name ?? `session_${sourceIndex}`));
      const numbers = parseNumbers(row.Numbers);
      return {
        id: `${name}#${row.ImportIndex ?? ""}#${sourceIndex}`,
        sourceIndex,
        name,
        saveTime: getHistoryDataIso(row, sourceIndex),
        count: typeof row.Count === "number" ? row.Count : numbers.length,
        numbers,
        venueKey: inferVenueKey(name),
      };
    })
    .filter((session) => session.numbers.length >= 80);
}

function printVenueSummary(sessions: readonly Session[]): void {
  const counts = new Map<string, number>();
  for (const session of sessions) {
    counts.set(session.venueKey, (counts.get(session.venueKey) ?? 0) + 1);
  }
  console.log("\n== Venue groups ==");
  for (const [venue, count] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
    console.log(`${venue.padEnd(12)} ${count}`);
  }
}

function printVenueClusterOverview(sessions: readonly Session[]): void {
  const groups = new Map<string, Session[]>();
  for (const session of sessions) {
    if (session.venueKey === "unknown") continue;
    const group = groups.get(session.venueKey) ?? [];
    group.push(session);
    groups.set(session.venueKey, group);
  }
  console.log("\n== Venue-space cluster overview ==");
  for (const [venue, group] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
    if (group.length < 3) continue;
    const fingerprints = group
      .sort((left, right) => left.saveTime.localeCompare(right.saveTime))
      .map(makeFingerprint);
    const result = chooseClusterCount(fingerprints);
    const sizes = clusterSizes(result.labels, result.k).join("/");
    const centers = Array.from({ length: result.k }, (_, label) => (
      fingerprints
        .map((fingerprint, index) => result.labels[index] === label ? fingerprint.primary.center : undefined)
        .filter((center): center is RouletteNumber => center !== undefined)
        .join(",")
    )).join(" | ");
    console.log(
      `${venue.padEnd(12)} sessions=${String(group.length).padStart(2)} `
      + `k=${result.k} silhouette=${result.silhouette.toFixed(3)} sizes=${sizes} centers=${centers}`,
    );
  }
}

function printClusterReport(title: string, fingerprints: readonly Fingerprint[], result: ClusterResult): void {
  console.log(`\n== ${title} ==`);
  console.log(`sessions=${fingerprints.length}, k=${result.k}, silhouette=${result.silhouette.toFixed(3)}`);
  for (let label = 0; label < result.k; label += 1) {
    const members = fingerprints
      .map((fingerprint, index) => ({ fingerprint, index }))
      .filter((item) => result.labels[item.index] === label)
      .sort((left, right) => left.fingerprint.primary.centerIndex - right.fingerprint.primary.centerIndex);
    const centers = members.map((item) => item.fingerprint.primary.center).join(",");
    console.log(`\ncluster ${label + 1}  size=${members.length}  primaryCenters=${centers}`);
    for (const { fingerprint } of members) {
      const key = sessionKey(fingerprint.session.name);
      const manual = MANUAL_JUNE_TABLE.get(key) ?? "";
      const arc = fingerprint.primary.numbers.join("-");
      const move = `near=${(fingerprint.nearMoveRate * 100).toFixed(1)}%, opposite=${(fingerprint.oppositeMoveRate * 100).toFixed(1)}%`;
      console.log([
        `  ${key.padEnd(18)}`,
        `count=${String(fingerprint.session.count).padStart(4)}`,
        `center=${String(fingerprint.primary.center).padStart(2)}`,
        `z=${fingerprint.primary.z.toFixed(2).padStart(5)}`,
        `arc=${arc.padEnd(22)}`,
        move,
        manual ? `manual=${manual}` : "",
      ].filter(Boolean).join("  "));
    }
  }
}

function printCandidateScores(title: string, fingerprints: readonly Fingerprint[]): void {
  console.log(`\n-- ${title} candidate k scores --`);
  const maxK = Math.min(6, fingerprints.length);
  for (let k = 1; k <= maxK; k += 1) {
    const result = clusterByPrimaryArc(fingerprints, k);
    result.score = clusterScore(result, fingerprints.length);
    const sizes = clusterSizes(result.labels, k).join("/");
    console.log(`k=${k} silhouette=${result.silhouette.toFixed(3)} score=${result.score.toFixed(3)} sizes=${sizes}`);
  }
}

function main(): void {
  const sessions = loadSessions();
  console.log(`source sessions>=80: ${sessions.length}`);
  printVenueSummary(sessions);
  printVenueClusterOverview(sessions);

  const macauJune = sessions
    .filter((session) => session.name.startsWith("202606") && session.name.includes("澳门永利"))
    .sort((left, right) => left.saveTime.localeCompare(right.saveTime));
  const macauFingerprints = macauJune.map(makeFingerprint);
  printCandidateScores("2026-06 Macau Wynn primary-arc", macauFingerprints);
  const macauResult = chooseClusterCount(macauFingerprints);
  printClusterReport("2026-06 澳门永利 primary-arc clustering", macauFingerprints, macauResult);

  const macauAll = sessions
    .filter((session) => session.venueKey === "澳门永利")
    .sort((left, right) => left.saveTime.localeCompare(right.saveTime));
  if (macauAll.length !== macauJune.length) {
    const allFingerprints = macauAll.map(makeFingerprint);
    printCandidateScores("All Macau Wynn primary-arc", allFingerprints);
    printClusterReport("All 澳门永利 primary-arc clustering", allFingerprints, chooseClusterCount(allFingerprints));
  }
}

main();
