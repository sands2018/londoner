import type { RouletteNumber } from "./roulette";
import type { HotNumberSignalEvent } from "./hotNumbers";

export interface TableProfileSession {
  id: string;
  name: string;
  numbers: readonly RouletteNumber[];
  tableId?: string;
}

export interface TableProfileTable {
  id: string;
  name: string;
  parentId: string;
}

export interface TableHotSector {
  center: RouletteNumber;
  numbers: RouletteNumber[];
  count: number;
  z: number;
}

export interface TableProfile {
  tableId: string;
  tableName: string;
  sessionCount: number;
  totalNumbers: number;
  sectorVector: number[];
  sectorCounts: number[];
  hotSectors: TableHotSector[];
}

export type TableMatchLevel = "none" | "weak" | "probable" | "confirmed";
export type HotTableSupportLevel = "none" | "unknown" | "conflict" | "watch" | "support" | "strong";

export interface TableMatch {
  level: TableMatchLevel;
  profile: TableProfile | null;
  similarity: number;
  gap: number;
  secondSimilarity: number | null;
}

export interface HotTableSupport {
  level: HotTableSupportLevel;
  profile: TableProfile | null;
  match: TableMatch;
  sector: TableHotSector | null;
  rank: number | null;
  z: number;
  reason: string;
}

export const TABLE_PROFILE_MIN_SESSION_NUMBERS = 120;
export const TABLE_MATCH_MIN_NUMBERS = 80;

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_INDEX = new Map<RouletteNumber, number>(
  WHEEL_ORDER.map((number, index) => [number, index]),
);

function isKnownTableId(tableId: string | undefined): tableId is string {
  return Boolean(tableId && !tableId.startsWith("t_unknown_"));
}

function numberToWheelIndex(number: RouletteNumber): number {
  return WHEEL_INDEX.get(number) ?? 0;
}

function makeCounts(numbers: readonly RouletteNumber[]): number[] {
  const counts = Array(37).fill(0);
  for (const number of numbers) {
    counts[numberToWheelIndex(number)] += 1;
  }
  return counts;
}

function makeSectorFromCounts(counts: readonly number[], start: number, size: number): TableHotSector {
  let count = 0;
  const numbers: RouletteNumber[] = [];
  for (let offset = 0; offset < size; offset += 1) {
    const index = (start + offset) % WHEEL_ORDER.length;
    count += counts[index];
    numbers.push(WHEEL_ORDER[index]);
  }
  const total = counts.reduce((sum, value) => sum + value, 0);
  const p = size / WHEEL_ORDER.length;
  const expected = total * p;
  const variance = total * p * (1 - p);
  const z = variance > 0 ? (count - expected) / Math.sqrt(variance) : 0;
  return {
    center: WHEEL_ORDER[(start + Math.floor(size / 2)) % WHEEL_ORDER.length],
    count,
    numbers,
    z,
  };
}

function makeSectorCounts(counts: readonly number[], size: number): number[] {
  return WHEEL_ORDER.map((_, start) => makeSectorFromCounts(counts, start, size).count);
}

function makeSectorVector(numbers: readonly RouletteNumber[], size: number): number[] {
  if (numbers.length === 0) return Array(37).fill(0);
  const counts = makeCounts(numbers);
  return makeSectorCounts(counts, size).map((count) => count / numbers.length);
}

function topNonOverlappingSectors(counts: readonly number[], size: number, limit: number): TableHotSector[] {
  const sectors = WHEEL_ORDER
    .map((_, start) => ({ start, sector: makeSectorFromCounts(counts, start, size) }))
    .sort((left, right) => right.sector.count - left.sector.count || right.sector.z - left.sector.z);
  const used = new Set<number>();
  const selected: TableHotSector[] = [];
  for (const item of sectors) {
    const indexes = Array.from({ length: size }, (_, offset) => (item.start + offset) % WHEEL_ORDER.length);
    if (indexes.some((index) => used.has(index))) continue;
    selected.push(item.sector);
    indexes.forEach((index) => used.add(index));
    if (selected.length >= limit) break;
  }
  return selected;
}

function correlation(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) return 0;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const l = left[index] - leftMean;
    const r = right[index] - rightMean;
    numerator += l * r;
    leftVariance += l * l;
    rightVariance += r * r;
  }
  return leftVariance > 0 && rightVariance > 0 ? numerator / Math.sqrt(leftVariance * rightVariance) : 0;
}

function tableName(tableId: string, tables: readonly TableProfileTable[]): string {
  return tables.find((table) => table.id === tableId)?.name ?? tableId;
}

export function buildTableProfiles(
  sessions: readonly TableProfileSession[],
  tables: readonly TableProfileTable[] = [],
): TableProfile[] {
  const grouped = new Map<string, { sessionCount: number; numbers: RouletteNumber[] }>();
  for (const session of sessions) {
    if (!isKnownTableId(session.tableId)) continue;
    if (session.numbers.length < TABLE_PROFILE_MIN_SESSION_NUMBERS) continue;
    const existing = grouped.get(session.tableId) ?? { sessionCount: 0, numbers: [] };
    existing.sessionCount += 1;
    existing.numbers.push(...session.numbers);
    grouped.set(session.tableId, existing);
  }

  return [...grouped.entries()]
    .map(([tableId, group]) => {
      const counts = makeCounts(group.numbers);
      const sectorCounts = makeSectorCounts(counts, 7);
      return {
        tableId,
        tableName: tableName(tableId, tables),
        sessionCount: group.sessionCount,
        totalNumbers: group.numbers.length,
        sectorVector: sectorCounts.map((count) => count / group.numbers.length),
        sectorCounts,
        hotSectors: topNonOverlappingSectors(counts, 7, 3),
      };
    })
    .sort((left, right) => left.tableName.localeCompare(right.tableName, "zh-Hans-CN"));
}

export function matchTableProfile(
  numbers: readonly RouletteNumber[],
  profiles: readonly TableProfile[],
  forcedTableId?: string,
): TableMatch {
  if (forcedTableId) {
    const forced = profiles.find((profile) => profile.tableId === forcedTableId) ?? null;
    if (forced) {
      const similarity = numbers.length >= TABLE_MATCH_MIN_NUMBERS
        ? correlation(makeSectorVector(numbers, 7), forced.sectorVector)
        : 0;
      return { level: "confirmed", profile: forced, similarity, gap: similarity, secondSimilarity: null };
    }
    return { level: "none", profile: null, similarity: 0, gap: 0, secondSimilarity: null };
  }
  if (numbers.length < TABLE_MATCH_MIN_NUMBERS || profiles.length === 0) {
    return { level: "none", profile: null, similarity: 0, gap: 0, secondSimilarity: null };
  }

  const currentVector = makeSectorVector(numbers, 7);
  const ranked = profiles
    .map((profile) => ({ profile, similarity: correlation(currentVector, profile.sectorVector) }))
    .sort((left, right) => right.similarity - left.similarity);
  const best = ranked[0];
  const secondSimilarity = ranked[1]?.similarity ?? null;
  const gap = secondSimilarity === null ? best.similarity : best.similarity - secondSimilarity;

  let level: TableMatchLevel = "weak";
  if (best.similarity >= 0.45 && gap >= 0.15) {
    level = "confirmed";
  } else if (best.similarity >= 0.25 && gap >= 0.08) {
    level = "probable";
  }

  return {
    level,
    profile: best.profile,
    similarity: best.similarity,
    gap,
    secondSimilarity,
  };
}

function supportSectorForNumber(profile: TableProfile, number: RouletteNumber): { sector: TableHotSector; rank: number } {
  const wheelIndex = numberToWheelIndex(number);
  const centeredStart = (wheelIndex - 3 + WHEEL_ORDER.length) % WHEEL_ORDER.length;
  const allRanked = profile.sectorCounts
    .map((count, start) => ({ start, count }))
    .sort((left, right) => right.count - left.count || left.start - right.start);
  const rank = allRanked.findIndex((item) => item.start === centeredStart) + 1;
  return {
    sector: makeSectorFromCountsFromSectorCounts(profile, centeredStart),
    rank: rank > 0 ? rank : 37,
  };
}

function makeSectorFromCountsFromSectorCounts(profile: TableProfile, start: number): TableHotSector {
  const count = profile.sectorCounts[start] ?? 0;
  const numbers = Array.from({ length: 7 }, (_, offset) => WHEEL_ORDER[(start + offset) % WHEEL_ORDER.length]);
  const total = profile.totalNumbers;
  const p = 7 / WHEEL_ORDER.length;
  const expected = total * p;
  const variance = total * p * (1 - p);
  return {
    center: WHEEL_ORDER[(start + 3) % WHEEL_ORDER.length],
    count,
    numbers,
    z: variance > 0 ? (count - expected) / Math.sqrt(variance) : 0,
  };
}

export function evaluateHotNumberTableSupport(
  numbers: readonly RouletteNumber[],
  hotNumber: RouletteNumber | null | undefined,
  profiles: readonly TableProfile[],
  forcedTableId?: string,
): HotTableSupport {
  const match = matchTableProfile(numbers, profiles, forcedTableId);
  if (!hotNumber) {
    return { level: "none", profile: null, match, sector: null, rank: null, z: 0, reason: "暂无热门信号" };
  }
  if (!match.profile) {
    return { level: "unknown", profile: null, match, sector: null, rank: null, z: 0, reason: "暂无可用桌台画像" };
  }
  if (match.level === "weak") {
    return {
      level: "unknown",
      profile: match.profile,
      match,
      sector: null,
      rank: null,
      z: 0,
      reason: `疑似 ${match.profile.tableName}，置信不足`,
    };
  }

  const { sector, rank } = supportSectorForNumber(match.profile, hotNumber);
  let level: HotTableSupportLevel = "watch";
  if (rank <= 3 && sector.z >= 1) {
    level = "strong";
  } else if (rank <= 6 && sector.z >= 0.35) {
    level = "support";
  } else if (rank >= 30 && sector.z <= -0.35) {
    level = "conflict";
  }

  const matchLabel = match.level === "confirmed" ? "本桌" : "疑似桌";
  const reason = `${matchLabel} ${match.profile.tableName}，中心邻区排名 ${rank}/37，z=${sector.z.toFixed(2)}，sim=${match.similarity.toFixed(2)}，样本${match.profile.sessionCount}局/${match.profile.totalNumbers}口`;
  return {
    level,
    profile: match.profile,
    match,
    sector,
    rank,
    z: sector.z,
    reason,
  };
}

// ---- Per-tier ROI for hot number table support ----

export interface HotNumberTableTierStats {
  tier: HotTableSupportLevel;
  label: string;
  signals: number;
  bet: number;
  win: number;
  hits: number;
  roi: number;
}

const TIER_LABELS: Record<HotTableSupportLevel, string> = {
  strong: "强",
  support: "中",
  watch: "弱",
  conflict: "冲突",
  unknown: "未知",
  none: "无",
};

const TIER_ORDER: HotTableSupportLevel[] = ["strong", "support", "watch", "conflict", "unknown", "none"];

function emptyTierStats(): HotNumberTableTierStats {
  return { tier: "none", label: "", signals: 0, bet: 0, win: 0, hits: 0, roi: 0 };
}

/**
 * Compute per-tier ROI breakdown for hot number signals.
 * Replays each signal event with the table profile state at that point
 * and aggregates bet/win/hits by support level.
 */
export function computeHotNumberTableTierRoi(
  numbers: readonly RouletteNumber[],
  events: readonly HotNumberSignalEvent[],
  profiles: readonly TableProfile[],
  forcedTableId?: string,
): HotNumberTableTierStats[] {
  const tiers = new Map<HotTableSupportLevel, HotNumberTableTierStats>();

  for (const evt of events) {
    const prefix = numbers.slice(0, evt.position);
    const support = evaluateHotNumberTableSupport(prefix, evt.signal.number, profiles, forcedTableId);
    const tier = support.level;

    let stats = tiers.get(tier);
    if (!stats) {
      stats = { ...emptyTierStats(), tier, label: TIER_LABELS[tier] };
      tiers.set(tier, stats);
    }

    stats.signals += 1;
    stats.bet += 1;
    if (evt.hit) {
      stats.win += 36;
      stats.hits += 1;
    }
  }

  return TIER_ORDER
    .filter((tier) => tier !== "none") // "none" only appears when there is no signal at all
    .map((tier) => {
      const stats = tiers.get(tier);
      if (stats) {
        stats.roi = stats.bet > 0 ? ((stats.win - stats.bet) / stats.bet) * 100 : 0;
        return stats;
      }
      return { tier, label: TIER_LABELS[tier], signals: 0, bet: 0, win: 0, hits: 0, roi: 0 };
    });
}
