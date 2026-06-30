import fs from "node:fs";
import path from "node:path";
import { getHistoryDataIso, getHistoryDataTms } from "./historyTime";
import {
  assignSessionToAutoTableProfileState,
  buildAutoTableProfileState,
  type AutoTableInputSession,
  type AutoTableMatchLevel,
  type AutoTableProfileState,
  type TableAssignmentSource,
} from "../app/src/core/autoTableProfile";
import {
  buildTableProfiles,
  type TableHotSector,
  type TableProfile,
  type TableProfileSession,
} from "../app/src/core/tableHotProfile";
import { inferSpatialVenueKey } from "../app/src/core/spatialTableClustering";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "scripts", "output");
const ROI_START = 200;
const DATASETS = [
  path.join(ROOT, "HistoryData", "data_2026.6.11.json"),
  path.join(ROOT, "HistoryData", "history_data.json"),
];

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
const WHEEL_INDEX = new Map<RouletteNumber, number>(WHEEL_ORDER.map((number, index) => [number, index]));

interface RawHistoryRow {
  Name?: string;
  Numbers?: string | number[];
  SaveTime?: string;
  tms?: number;
  ImportIndex?: number;
  tableId?: string;
  TableId?: string;
}

interface Session extends AutoTableInputSession {
  sourceIndex: number;
}

interface TableStats {
  tableId: string;
  numbers: number;
  counts: number[];
  offsetCounts: number[];
  transitionTotal: number;
}

interface SignalContext {
  assignmentLevel: AutoTableMatchLevel;
  assignmentSimilarity: number;
  assignmentSource: TableAssignmentSource;
  position: number;
  prefix: readonly RouletteNumber[];
  profile: TableProfile;
  result: RouletteNumber;
  session: Session;
  stats: TableStats;
  venueKey: string;
}

interface Method {
  id: string;
  group: string;
  description: string;
  pick: (ctx: SignalContext) => RouletteNumber[];
}

interface SignalEvent {
  activeSessionsKey: string;
  assignmentLevel: AutoTableMatchLevel;
  assignmentSource: TableAssignmentSource;
  bet: number;
  candidates: RouletteNumber[];
  group: string;
  hit: boolean;
  methodId: string;
  net: number;
  position: number;
  result: RouletteNumber;
  sessionDate: string;
  sessionId: string;
  sessionName: string;
  tableId: string;
  tableSessions: number;
  tableTotalNumbers: number;
  venueKey: string;
}

interface Summary {
  activeSessions: number;
  averageBet: number;
  bet: number;
  giniAbsSessionNet: number;
  hitRate: number;
  hits: number;
  maxDrawdown: number;
  meanSessionNet: number;
  negativeSessions: number;
  net: number;
  positiveSessions: number;
  roi: number;
  sdSessionNet: number;
  signals: number;
  top10SignalShare: number;
  win: number;
}

interface PerfStats {
  bet: number;
  net: number;
  signals: number;
  win: number;
}

interface AdaptiveHistory {
  globalGroup: Map<string, PerfStats>;
  globalMethod: Map<string, PerfStats>;
  sessionMethod: Map<string, PerfStats>;
  tableMethod: Map<string, PerfStats>;
  venueMethod: Map<string, PerfStats>;
}

interface AdaptiveRule {
  description: string;
  id: string;
  keep: (event: SignalEvent, history: AdaptiveHistory) => boolean;
  maxCandidates: number;
}

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
}

function parseUpdatedAt(row: RawHistoryRow, sourceIndex: number): string {
  return getHistoryDataIso(row, sourceIndex);
}

function loadSessions(filePath: string): Session[] {
  const rows = JSON.parse(fs.readFileSync(filePath, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex): Session => ({
      id: `${path.basename(filePath, ".json")}_${sourceIndex}`,
      sourceIndex,
      name: String(row.Name ?? `session-${sourceIndex + 1}`),
      numbers: parseNumbers(row.Numbers),
      updatedAt: parseUpdatedAt(row, sourceIndex),
      updatedTms: getHistoryDataTms(row, sourceIndex),
      importIndex: row.ImportIndex ?? sourceIndex,
      tableId: row.tableId ?? row.TableId,
    }))
    .filter((session) => session.numbers.length > 0)
    .sort((left, right) => (
      new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
      || (left.importIndex ?? Number.MAX_SAFE_INTEGER) - (right.importIndex ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name, "zh-Hans-CN")
      || left.id.localeCompare(right.id)
    ));
}

function sessionDate(session: Session): string {
  return session.updatedAt.slice(0, 10);
}

function wheelIndex(number: RouletteNumber): number {
  return WHEEL_INDEX.get(number) ?? 0;
}

function circularDistance(left: RouletteNumber, right: RouletteNumber): number {
  const distance = Math.abs(wheelIndex(left) - wheelIndex(right));
  return Math.min(distance, WHEEL_ORDER.length - distance);
}

function wheelAtOffset(center: RouletteNumber, offset: number): RouletteNumber {
  return WHEEL_ORDER[(wheelIndex(center) + offset + WHEEL_ORDER.length * 10) % WHEEL_ORDER.length];
}

function unique(numbers: readonly RouletteNumber[]): RouletteNumber[] {
  return [...new Set(numbers)];
}

function sectorSlice(sector: TableHotSector, size: 3 | 5 | 7): RouletteNumber[] {
  const start = Math.floor((7 - size) / 2);
  return sector.numbers.slice(start, start + size);
}

function sectorAround(center: RouletteNumber, size: 3 | 5 | 7): RouletteNumber[] {
  const half = Math.floor(size / 2);
  return Array.from({ length: size }, (_, index) => wheelAtOffset(center, index - half));
}

function makeCounts(numbers: readonly RouletteNumber[]): number[] {
  const counts = Array(37).fill(0);
  for (const number of numbers) counts[wheelIndex(number)] += 1;
  return counts;
}

function sectorFromCounts(counts: readonly number[], start: number, size: number, total: number): TableHotSector {
  let count = 0;
  const numbers: RouletteNumber[] = [];
  for (let offset = 0; offset < size; offset += 1) {
    const index = (start + offset) % WHEEL_ORDER.length;
    count += counts[index];
    numbers.push(WHEEL_ORDER[index]);
  }
  const p = size / WHEEL_ORDER.length;
  const expected = total * p;
  const variance = total * p * (1 - p);
  return {
    center: WHEEL_ORDER[(start + Math.floor(size / 2)) % WHEEL_ORDER.length],
    count,
    numbers,
    z: variance > 0 ? (count - expected) / Math.sqrt(variance) : 0,
  };
}

function topSectors(numbers: readonly RouletteNumber[], size = 7, limit = 3): TableHotSector[] {
  if (numbers.length === 0) return [];
  const counts = makeCounts(numbers);
  const sectors = WHEEL_ORDER
    .map((_, start) => sectorFromCounts(counts, start, size, numbers.length))
    .sort((left, right) => right.count - left.count || right.z - left.z);
  const used = new Set<number>();
  const result: TableHotSector[] = [];
  for (const sector of sectors) {
    const indexes = sector.numbers.map(wheelIndex);
    if (indexes.some((index) => used.has(index))) continue;
    result.push(sector);
    indexes.forEach((index) => used.add(index));
    if (result.length >= limit) break;
  }
  return result;
}

function recent(numbers: readonly RouletteNumber[], window: number): RouletteNumber[] {
  return numbers.slice(Math.max(0, numbers.length - window));
}

function countInSet(numbers: readonly RouletteNumber[], set: readonly RouletteNumber[]): number {
  const lookup = new Set(set);
  return numbers.reduce((count, number) => count + (lookup.has(number) ? 1 : 0), 0);
}

function zForCount(count: number, total: number, p: number): number {
  const expected = total * p;
  const variance = total * p * (1 - p);
  return variance > 0 ? (count - expected) / Math.sqrt(variance) : 0;
}

function tableTopNumbers(stats: TableStats, limit: number): RouletteNumber[] {
  return WHEEL_ORDER
    .map((number) => ({ number, count: stats.counts[number] ?? 0 }))
    .sort((left, right) => right.count - left.count || left.number - right.number)
    .slice(0, limit)
    .map((item) => item.number);
}

function tableTopNumberZ(stats: TableStats, number: RouletteNumber): number {
  return zForCount(stats.counts[number] ?? 0, stats.numbers, 1 / 37);
}

function topOffsets(stats: TableStats, limit: number, minLift = 1): number[] {
  if (stats.transitionTotal <= 0) return [];
  const expected = stats.transitionTotal / 37;
  return stats.offsetCounts
    .map((count, offset) => ({ count, lift: expected > 0 ? count / expected : 0, offset }))
    .filter((item) => item.lift >= minLift)
    .sort((left, right) => right.count - left.count || left.offset - right.offset)
    .slice(0, limit)
    .map((item) => item.offset);
}

function buildTableStats(profileSessions: readonly TableProfileSession[]): Map<string, TableStats> {
  const map = new Map<string, TableStats>();
  for (const session of profileSessions) {
    if (!session.tableId) continue;
    const stats = map.get(session.tableId) ?? {
      tableId: session.tableId,
      numbers: 0,
      counts: Array(37).fill(0),
      offsetCounts: Array(37).fill(0),
      transitionTotal: 0,
    };
    for (const number of session.numbers) {
      stats.counts[number] += 1;
      stats.numbers += 1;
    }
    for (let index = 1; index < session.numbers.length; index += 1) {
      const prev = session.numbers[index - 1];
      const next = session.numbers[index];
      const offset = (wheelIndex(next) - wheelIndex(prev) + WHEEL_ORDER.length) % WHEEL_ORDER.length;
      stats.offsetCounts[offset] += 1;
      stats.transitionTotal += 1;
    }
    map.set(session.tableId, stats);
  }
  return map;
}

function hasGoodAssignment(ctx: SignalContext): boolean {
  return ctx.assignmentSource === "auto" && (ctx.assignmentLevel === "confirmed" || ctx.assignmentLevel === "probable");
}

function hasLargeProfile(ctx: SignalContext): boolean {
  return ctx.profile.sessionCount >= 3 && ctx.profile.totalNumbers >= 500;
}

function tableSector(ctx: SignalContext, index = 0): TableHotSector | null {
  return ctx.profile.hotSectors[index] ?? null;
}

function sectorIfZ(ctx: SignalContext, index: number, minZ: number, size: 3 | 5 | 7): RouletteNumber[] {
  const sector = tableSector(ctx, index);
  if (!sector || sector.z < minZ) return [];
  return sectorSlice(sector, size);
}

function resonanceWithRecent(ctx: SignalContext, window: number, distance: number, sectorIndex = 0): TableHotSector | null {
  const sector = tableSector(ctx, sectorIndex);
  if (!sector) return null;
  const top = topSectors(recent(ctx.prefix, window), 7, 1)[0];
  if (!top || circularDistance(sector.center, top.center) > distance) return null;
  return sector;
}

function resonanceWithAll(ctx: SignalContext, distance: number, sectorIndex = 0): TableHotSector | null {
  const sector = tableSector(ctx, sectorIndex);
  if (!sector) return null;
  const top = topSectors(ctx.prefix, 7, 1)[0];
  if (!top || circularDistance(sector.center, top.center) > distance) return null;
  return sector;
}

function tableHotRecentCold(ctx: SignalContext, window: number, maxZ: number, sectorIndex = 0): TableHotSector | null {
  const sector = tableSector(ctx, sectorIndex);
  if (!sector || sector.z < 0.5) return null;
  const rows = recent(ctx.prefix, window);
  const count = countInSet(rows, sector.numbers);
  const z = zForCount(count, rows.length, sector.numbers.length / 37);
  return z <= maxZ ? sector : null;
}

const METHODS: Method[] = [
  {
    id: "sector7-top1-z0",
    group: "profile-sector",
    description: "桌画像第一热区7邻，z>=0，自动归桌即可。",
    pick: (ctx) => hasGoodAssignment(ctx) ? sectorIfZ(ctx, 0, 0, 7) : [],
  },
  {
    id: "sector7-top1-z1",
    group: "profile-sector",
    description: "桌画像第一热区7邻，z>=1。",
    pick: (ctx) => hasGoodAssignment(ctx) ? sectorIfZ(ctx, 0, 1, 7) : [],
  },
  {
    id: "sector5-top1-z1",
    group: "profile-sector",
    description: "桌画像第一热区中心5邻，z>=1。",
    pick: (ctx) => hasGoodAssignment(ctx) ? sectorIfZ(ctx, 0, 1, 5) : [],
  },
  {
    id: "sector3-top1-z1",
    group: "profile-sector",
    description: "桌画像第一热区中心3邻，z>=1。",
    pick: (ctx) => hasGoodAssignment(ctx) ? sectorIfZ(ctx, 0, 1, 3) : [],
  },
  {
    id: "sector7-top2-z1",
    group: "profile-sector",
    description: "桌画像前二热区7邻并集，单区z>=1。",
    pick: (ctx) => hasGoodAssignment(ctx) ? unique([0, 1].flatMap((index) => sectorIfZ(ctx, index, 1, 7))) : [],
  },
  {
    id: "sector7-top1-large-profile",
    group: "profile-sector",
    description: "大样本桌画像第一热区7邻，桌样本>=3局/500口。",
    pick: (ctx) => hasGoodAssignment(ctx) && hasLargeProfile(ctx) ? sectorIfZ(ctx, 0, 0.5, 7) : [],
  },
  {
    id: "resonance-all-sector7-d2",
    group: "resonance",
    description: "全前缀主热区与桌第一热区中心距离<=2，打7邻。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const sector = resonanceWithAll(ctx, 2, 0);
      return sector && sector.z >= 0.5 ? sector.numbers : [];
    },
  },
  {
    id: "resonance-r120-sector7-d2",
    group: "resonance",
    description: "最近120口主热区与桌第一热区中心距离<=2，打7邻。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const sector = resonanceWithRecent(ctx, 120, 2, 0);
      return sector && sector.z >= 0.5 ? sector.numbers : [];
    },
  },
  {
    id: "resonance-r80-sector5-d2",
    group: "resonance",
    description: "最近80口主热区与桌第一热区中心距离<=2，打中心5邻。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const sector = resonanceWithRecent(ctx, 80, 2, 0);
      return sector && sector.z >= 0.5 ? sectorSlice(sector, 5) : [];
    },
  },
  {
    id: "resonance-double-sector7-d2",
    group: "resonance",
    description: "全前缀和最近120口都与桌第一热区中心距离<=2，打7邻。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const all = resonanceWithAll(ctx, 2, 0);
      const recentSector = resonanceWithRecent(ctx, 120, 2, 0);
      return all && recentSector && all.z >= 0.5 ? all.numbers : [];
    },
  },
  {
    id: "resonance-top2-r120-sector5-d2",
    group: "resonance",
    description: "最近120口主热区贴近桌前二热区之一，打该桌热区中心5邻。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      for (const index of [0, 1]) {
        const sector = resonanceWithRecent(ctx, 120, 2, index);
        if (sector && sector.z >= 0.5) return sectorSlice(sector, 5);
      }
      return [];
    },
  },
  {
    id: "intersection-profile7-r120-7",
    group: "resonance",
    description: "桌第一热区7邻与最近120口主热区7邻交集>=3，只打交集。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const profileSector = tableSector(ctx, 0);
      const recentSector = topSectors(recent(ctx.prefix, 120), 7, 1)[0];
      if (!profileSector || !recentSector || profileSector.z < 0.5) return [];
      const recentSet = new Set(recentSector.numbers);
      const picked = profileSector.numbers.filter((number) => recentSet.has(number));
      return picked.length >= 3 ? picked : [];
    },
  },
  {
    id: "tablehot-cold-r80-sector7",
    group: "reversion",
    description: "桌第一热区历史热，但最近80口偏冷(z<=-0.5)，打7邻回补。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const sector = tableHotRecentCold(ctx, 80, -0.5, 0);
      return sector ? sector.numbers : [];
    },
  },
  {
    id: "tablehot-cold-r120-sector7",
    group: "reversion",
    description: "桌第一热区历史热，但最近120口偏冷(z<=-0.5)，打7邻回补。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const sector = tableHotRecentCold(ctx, 120, -0.5, 0);
      return sector ? sector.numbers : [];
    },
  },
  {
    id: "tablehot-missing20-sector5",
    group: "reversion",
    description: "桌第一热区20口未出，打中心5邻。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const sector = tableSector(ctx, 0);
      if (!sector || sector.z < 0.5) return [];
      return countInSet(recent(ctx.prefix, 20), sector.numbers) === 0 ? sectorSlice(sector, 5) : [];
    },
  },
  {
    id: "num-top1-z1",
    group: "table-number",
    description: "桌历史最高频单号，单号z>=1。",
    pick: (ctx) => {
      const [num] = tableTopNumbers(ctx.stats, 1);
      return hasGoodAssignment(ctx) && num !== undefined && tableTopNumberZ(ctx.stats, num) >= 1 ? [num] : [];
    },
  },
  {
    id: "num-top3-z1",
    group: "table-number",
    description: "桌历史高频前三，单号z>=1。",
    pick: (ctx) => hasGoodAssignment(ctx)
      ? tableTopNumbers(ctx.stats, 3).filter((num) => tableTopNumberZ(ctx.stats, num) >= 1)
      : [],
  },
  {
    id: "num-top5-z05",
    group: "table-number",
    description: "桌历史高频前五，单号z>=0.5。",
    pick: (ctx) => hasGoodAssignment(ctx)
      ? tableTopNumbers(ctx.stats, 5).filter((num) => tableTopNumberZ(ctx.stats, num) >= 0.5)
      : [],
  },
  {
    id: "num-top3-recent37-support",
    group: "table-number",
    description: "桌历史前三单号，且最近37口出现过。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const recentSet = new Set(recent(ctx.prefix, 37));
      return tableTopNumbers(ctx.stats, 3).filter((num) => tableTopNumberZ(ctx.stats, num) >= 0.5 && recentSet.has(num));
    },
  },
  {
    id: "num-top5-missing37",
    group: "table-number",
    description: "桌历史前五单号，最近37口未出，均值回补。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const recentSet = new Set(recent(ctx.prefix, 37));
      return tableTopNumbers(ctx.stats, 5).filter((num) => tableTopNumberZ(ctx.stats, num) >= 0.5 && !recentSet.has(num));
    },
  },
  {
    id: "num-intersect-table10-recent74-10",
    group: "table-number",
    description: "桌历史前10单号与最近74口前10单号交集。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx)) return [];
      const tableSet = new Set(tableTopNumbers(ctx.stats, 10));
      return tableTopNumbers({ ...ctx.stats, counts: makeNumberCounts(recent(ctx.prefix, 74)), numbers: 74 }, 10)
        .filter((num) => tableSet.has(num));
    },
  },
  {
    id: "offset-top1-min500-lift12",
    group: "transition",
    description: "桌内下一口轮盘偏移最高项，转移样本>=500，lift>=1.2，打一号。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx) || ctx.stats.transitionTotal < 500) return [];
      const [offset] = topOffsets(ctx.stats, 1, 1.2);
      const prev = ctx.prefix[ctx.prefix.length - 1];
      return offset === undefined || prev === undefined ? [] : [wheelAtOffset(prev, offset)];
    },
  },
  {
    id: "offset-top3-min500-lift11",
    group: "transition",
    description: "桌内下一口轮盘偏移前三，转移样本>=500，lift>=1.1。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx) || ctx.stats.transitionTotal < 500) return [];
      const prev = ctx.prefix[ctx.prefix.length - 1];
      return prev === undefined ? [] : topOffsets(ctx.stats, 3, 1.1).map((offset) => wheelAtOffset(prev, offset));
    },
  },
  {
    id: "offset-top5-min500",
    group: "transition",
    description: "桌内下一口轮盘偏移前五，转移样本>=500。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx) || ctx.stats.transitionTotal < 500) return [];
      const prev = ctx.prefix[ctx.prefix.length - 1];
      return prev === undefined ? [] : topOffsets(ctx.stats, 5, 1).map((offset) => wheelAtOffset(prev, offset));
    },
  },
  {
    id: "offset-top3-large-profile",
    group: "transition",
    description: "大样本桌画像的轮盘偏移前三，lift>=1.05。",
    pick: (ctx) => {
      if (!hasGoodAssignment(ctx) || !hasLargeProfile(ctx)) return [];
      const prev = ctx.prefix[ctx.prefix.length - 1];
      return prev === undefined ? [] : topOffsets(ctx.stats, 3, 1.05).map((offset) => wheelAtOffset(prev, offset));
    },
  },
];

function makeNumberCounts(numbers: readonly RouletteNumber[]): number[] {
  const counts = Array(37).fill(0);
  for (const number of numbers) counts[number] += 1;
  return counts;
}

function emptyPerf(): PerfStats {
  return { bet: 0, net: 0, signals: 0, win: 0 };
}

function perfRoi(stats: PerfStats): number {
  return stats.bet > 0 ? (stats.net / stats.bet) * 100 : 0;
}

function statPass(stats: PerfStats, minBet: number, minRoi: number): boolean {
  return stats.bet >= minBet && perfRoi(stats) >= minRoi;
}

function methodKey(event: SignalEvent): string {
  return event.methodId;
}

function tableMethodKey(event: SignalEvent): string {
  return `${event.tableId}|${event.methodId}`;
}

function venueMethodKey(event: SignalEvent): string {
  return `${event.venueKey}|${event.methodId}`;
}

function sessionMethodKey(event: SignalEvent): string {
  return `${event.sessionId}|${event.methodId}`;
}

function mapStats(map: Map<string, PerfStats>, key: string): PerfStats {
  return map.get(key) ?? emptyPerf();
}

function updateStats(map: Map<string, PerfStats>, key: string, event: SignalEvent): void {
  const stats = map.get(key) ?? emptyPerf();
  stats.bet += event.bet;
  stats.net += event.net;
  stats.signals += 1;
  stats.win += event.hit ? 36 : 0;
  map.set(key, stats);
}

function createAdaptiveHistory(): AdaptiveHistory {
  return {
    globalGroup: new Map(),
    globalMethod: new Map(),
    sessionMethod: new Map(),
    tableMethod: new Map(),
    venueMethod: new Map(),
  };
}

const ADAPTIVE_RULES: AdaptiveRule[] = [
  {
    id: "meta-global-positive-cap12",
    description: "Enable methods whose own prior live ROI is positive, min prior bet 500, merged candidates <=12.",
    maxCandidates: 12,
    keep: (event, history) => statPass(mapStats(history.globalMethod, methodKey(event)), 500, 0),
  },
  {
    id: "meta-global-beats-house-cap12",
    description: "Enable methods whose prior live ROI is better than -1%, min prior bet 1000, merged candidates <=12.",
    maxCandidates: 12,
    keep: (event, history) => statPass(mapStats(history.globalMethod, methodKey(event)), 1000, -1),
  },
  {
    id: "meta-table-positive-cap12",
    description: "Enable methods positive on the same auto table/profile, min prior table-method bet 150.",
    maxCandidates: 12,
    keep: (event, history) => statPass(mapStats(history.tableMethod, tableMethodKey(event)), 150, 0),
  },
  {
    id: "meta-table-beats-house-cap12",
    description: "Enable methods better than -1% on the same auto table/profile, min prior table-method bet 250.",
    maxCandidates: 12,
    keep: (event, history) => statPass(mapStats(history.tableMethod, tableMethodKey(event)), 250, -1),
  },
  {
    id: "meta-venue-positive-cap12",
    description: "Enable methods positive in the same inferred venue, min prior venue-method bet 250.",
    maxCandidates: 12,
    keep: (event, history) => statPass(mapStats(history.venueMethod, venueMethodKey(event)), 250, 0),
  },
  {
    id: "meta-consensus2-cap12",
    description: "Enable methods only when at least two of global/table/venue prior records are positive.",
    maxCandidates: 12,
    keep: (event, history) => {
      const votes = [
        statPass(mapStats(history.globalMethod, methodKey(event)), 500, 0),
        statPass(mapStats(history.tableMethod, tableMethodKey(event)), 150, 0),
        statPass(mapStats(history.venueMethod, venueMethodKey(event)), 250, 0),
      ].filter(Boolean).length;
      return votes >= 2;
    },
  },
  {
    id: "meta-resonance-global-positive-cap10",
    description: "Only resonance methods with positive prior method ROI, min prior bet 300, merged candidates <=10.",
    maxCandidates: 10,
    keep: (event, history) => event.group === "resonance"
      && statPass(mapStats(history.globalMethod, methodKey(event)), 300, 0),
  },
  {
    id: "meta-resonance-group-beats-house-cap12",
    description: "Only resonance methods while the resonance group is better than -1% live, min prior group bet 1000.",
    maxCandidates: 12,
    keep: (event, history) => event.group === "resonance"
      && statPass(mapStats(history.globalGroup, event.group), 1000, -1),
  },
  {
    id: "meta-table-positive-session-stop-cap12",
    description: "Same-table positive method, but stop that method for the current session after live session net <= -72.",
    maxCandidates: 12,
    keep: (event, history) => statPass(mapStats(history.tableMethod, tableMethodKey(event)), 150, 0)
      && mapStats(history.sessionMethod, sessionMethodKey(event)).net > -72,
  },
  {
    id: "meta-venue-positive-session-stop-cap12",
    description: "Same-venue positive method, but stop that method for the current session after live session net <= -72.",
    maxCandidates: 12,
    keep: (event, history) => statPass(mapStats(history.venueMethod, venueMethodKey(event)), 250, 0)
      && mapStats(history.sessionMethod, sessionMethodKey(event)).net > -72,
  },
];

function updateAdaptiveHistory(history: AdaptiveHistory, eventsAtPosition: readonly SignalEvent[]): void {
  for (const event of eventsAtPosition) {
    updateStats(history.globalGroup, event.group, event);
    updateStats(history.globalMethod, methodKey(event), event);
    updateStats(history.sessionMethod, sessionMethodKey(event), event);
    updateStats(history.tableMethod, tableMethodKey(event), event);
    updateStats(history.venueMethod, venueMethodKey(event), event);
  }
}

function mergeCandidates(events: readonly SignalEvent[]): RouletteNumber[] {
  const seen = new Set<RouletteNumber>();
  const candidates: RouletteNumber[] = [];
  for (const event of events) {
    for (const number of event.candidates) {
      if (seen.has(number)) continue;
      seen.add(number);
      candidates.push(number);
    }
  }
  return candidates;
}

function makeAdaptiveEvent(rule: AdaptiveRule, eventsAtPosition: readonly SignalEvent[]): SignalEvent | null {
  const base = eventsAtPosition[0];
  if (!base) return null;
  const candidates = mergeCandidates(eventsAtPosition);
  if (candidates.length === 0 || candidates.length > rule.maxCandidates) return null;
  const hit = candidates.includes(base.result);
  const bet = candidates.length;
  return {
    ...base,
    bet,
    candidates,
    group: "adaptive",
    hit,
    methodId: rule.id,
    net: hit ? 36 - bet : -bet,
  };
}

function runAdaptiveMeta(events: readonly SignalEvent[]): SignalEvent[] {
  const history = createAdaptiveHistory();
  const adaptive: SignalEvent[] = [];
  let currentKey = "";
  let eventsAtPosition: SignalEvent[] = [];

  const flush = () => {
    if (eventsAtPosition.length === 0) return;
    for (const rule of ADAPTIVE_RULES) {
      const selected = eventsAtPosition.filter((event) => rule.keep(event, history));
      const adaptiveEvent = makeAdaptiveEvent(rule, selected);
      if (adaptiveEvent) adaptive.push(adaptiveEvent);
    }
    updateAdaptiveHistory(history, eventsAtPosition);
  };

  for (const event of events) {
    const key = `${event.sessionId}|${event.position}`;
    if (key !== currentKey) {
      flush();
      currentKey = key;
      eventsAtPosition = [];
    }
    eventsAtPosition.push(event);
  }
  flush();

  return adaptive;
}

function summarize(events: readonly SignalEvent[]): Summary {
  let running = 0;
  let peak = 0;
  let hits = 0;
  let bet = 0;
  let win = 0;
  const sessionNet = new Map<string, number>();
  const sessionSignals = new Map<string, number>();

  for (const event of events) {
    hits += event.hit ? 1 : 0;
    bet += event.bet;
    win += event.hit ? 36 : 0;
    running += event.net;
    peak = Math.max(peak, running);
    sessionNet.set(event.sessionId, (sessionNet.get(event.sessionId) ?? 0) + event.net);
    sessionSignals.set(event.sessionId, (sessionSignals.get(event.sessionId) ?? 0) + 1);
  }

  const nets = [...sessionNet.values()];
  const top10Signals = [...sessionSignals.values()].sort((a, b) => b - a).slice(0, 10).reduce((sum, value) => sum + value, 0);
  return {
    activeSessions: nets.length,
    averageBet: events.length > 0 ? bet / events.length : 0,
    bet,
    giniAbsSessionNet: gini(nets),
    hitRate: events.length > 0 ? (hits / events.length) * 100 : 0,
    hits,
    maxDrawdown: Math.max(0, peak - running, ...drawdowns(events)),
    meanSessionNet: nets.length > 0 ? nets.reduce((sum, value) => sum + value, 0) / nets.length : 0,
    negativeSessions: nets.filter((value) => value < 0).length,
    net: win - bet,
    positiveSessions: nets.filter((value) => value > 0).length,
    roi: bet > 0 ? ((win - bet) / bet) * 100 : 0,
    sdSessionNet: stddev(nets),
    signals: events.length,
    top10SignalShare: events.length > 0 ? (top10Signals / events.length) * 100 : 0,
    win,
  };
}

function drawdowns(events: readonly SignalEvent[]): number[] {
  let running = 0;
  let peak = 0;
  const result: number[] = [];
  for (const event of events) {
    running += event.net;
    peak = Math.max(peak, running);
    result.push(peak - running);
  }
  return result;
}

function stddev(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function gini(values: readonly number[]): number {
  const sorted = values.map((value) => Math.abs(value)).sort((a, b) => a - b);
  const n = sorted.length;
  if (n === 0) return 0;
  const sum = sorted.reduce((total, value) => total + value, 0);
  if (sum === 0) return 0;
  const weighted = sorted.reduce((total, value, index) => total + (index + 1) * value, 0);
  return (2 * weighted) / (n * sum) - (n + 1) / n;
}

function fmt(summary: Summary): string {
  return [
    `sig=${String(summary.signals).padStart(5)}`,
    `bet=${String(summary.bet).padStart(6)}`,
    `hit=${String(summary.hits).padStart(4)}`,
    `net=${String(summary.net).padStart(7)}`,
    `roi=${summary.roi.toFixed(1).padStart(7)}%`,
    `hr=${summary.hitRate.toFixed(1).padStart(5)}%`,
    `avgBet=${summary.averageBet.toFixed(1)}`,
    `dd=${String(summary.maxDrawdown).padStart(5)}`,
    `pos=${String(summary.positiveSessions).padStart(2)}/${String(summary.activeSessions).padEnd(2)}`,
    `gini=${summary.giniAbsSessionNet.toFixed(3)}`,
    `top10=${summary.top10SignalShare.toFixed(1)}%`,
  ].join(" ");
}

function buildPriorContexts(sessions: readonly Session[]) {
  const contexts: Array<{
    profilesById: Map<string, TableProfile>;
    state: AutoTableProfileState;
    statsById: Map<string, TableStats>;
  }> = [];
  const prior: Session[] = [];
  for (const session of sessions) {
    const state = buildAutoTableProfileState(prior);
    const profiles = buildTableProfiles(state.profileSessions, state.tables);
    contexts.push({
      profilesById: new Map(profiles.map((profile) => [profile.tableId, profile])),
      state,
      statsById: buildTableStats(state.profileSessions),
    });
    prior.push(session);
  }
  return contexts;
}

function runDataset(sessions: readonly Session[]): SignalEvent[] {
  const contexts = buildPriorContexts(sessions);
  const events: SignalEvent[] = [];

  for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
    const session = sessions[sessionIndex];
    const context = contexts[sessionIndex];
    const venueKey = inferSpatialVenueKey(session.name);
    for (let position = ROI_START; position < session.numbers.length; position += 1) {
      const prefix = session.numbers.slice(0, position);
      const assignment = assignSessionToAutoTableProfileState({ ...session, numbers: prefix }, context.state);
      const tableId = assignment.effectiveTableId;
      if (!tableId) continue;
      const profile = context.profilesById.get(tableId);
      const stats = context.statsById.get(tableId);
      if (!profile || !stats || stats.numbers <= 0) continue;
      const result = session.numbers[position];
      const signalContext: SignalContext = {
        assignmentLevel: assignment.autoMatchLevel,
        assignmentSimilarity: assignment.autoSimilarity,
        assignmentSource: assignment.source,
        position,
        prefix,
        profile,
        result,
        session,
        stats,
        venueKey,
      };

      for (const method of METHODS) {
        const candidates = unique(method.pick(signalContext)).filter((number) => Number.isInteger(number) && number >= 0 && number <= 36);
        if (candidates.length === 0) continue;
        const hit = candidates.includes(result);
        const bet = candidates.length;
        events.push({
          activeSessionsKey: session.id,
          assignmentLevel: assignment.autoMatchLevel,
          assignmentSource: assignment.source,
          bet,
          candidates,
          group: method.group,
          hit,
          methodId: method.id,
          net: hit ? 36 - bet : -bet,
          position,
          result,
          sessionDate: sessionDate(session),
          sessionId: session.id,
          sessionName: session.name,
          tableId,
          tableSessions: profile.sessionCount,
          tableTotalNumbers: profile.totalNumbers,
          venueKey,
        });
      }
    }
  }
  return events;
}

function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const rows = map.get(key) ?? [];
    rows.push(item);
    map.set(key, rows);
  }
  return map;
}

function methodSummaryRows(events: readonly SignalEvent[]): Array<{ method: Method; summary: Summary }> {
  const byMethod = groupBy(events, (event) => event.methodId);
  return METHODS.map((method) => ({ method, summary: summarize(byMethod.get(method.id) ?? []) }));
}

function summaryTable(rows: Array<{ id: string; group?: string; description?: string; summary: Summary }>): string[] {
  const lines = [
    "| method | group | summary | description |",
    "|---|---|---:|---|",
  ];
  for (const row of rows) {
    lines.push(`| ${row.id} | ${row.group ?? ""} | \`${fmt(row.summary)}\` | ${row.description ?? ""} |`);
  }
  return lines;
}

function adaptiveSummaryRows(events: readonly SignalEvent[]): Array<{ rule: AdaptiveRule; summary: Summary }> {
  const byMethod = groupBy(events, (event) => event.methodId);
  return ADAPTIVE_RULES.map((rule) => ({ rule, summary: summarize(byMethod.get(rule.id) ?? []) }));
}

function addDatasetReport(
  lines: string[],
  filePath: string,
  sessions: readonly Session[],
  events: readonly SignalEvent[],
  adaptiveEvents: readonly SignalEvent[],
): void {
  const totalSpins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
  const rows = methodSummaryRows(events);
  const sortedByNet = [...rows].sort((a, b) => b.summary.net - a.summary.net);
  const sortedRobust = [...rows]
    .filter((row) => row.summary.bet >= 500 && row.summary.activeSessions >= 8)
    .sort((a, b) => b.summary.roi - a.summary.roi || b.summary.net - a.summary.net);
  const latestIds = new Set(sessions.slice(-10).map((session) => session.id));
  const latestEvents = events.filter((event) => latestIds.has(event.sessionId));
  const latestRows = methodSummaryRows(latestEvents).sort((a, b) => b.summary.net - a.summary.net);
  const adaptiveRows = adaptiveSummaryRows(adaptiveEvents);
  const adaptiveLatestEvents = adaptiveEvents.filter((event) => latestIds.has(event.sessionId));
  const adaptiveLatestRows = adaptiveSummaryRows(adaptiveLatestEvents).sort((a, b) => b.summary.net - a.summary.net);

  lines.push(`\n## Dataset: ${path.basename(filePath)}`);
  lines.push(`- sessions: ${sessions.length}`);
  lines.push(`- spins: ${totalSpins}`);
  lines.push(`- signal positions: index >= ${ROI_START}`);
  lines.push("- no-future: prior table state uses only earlier sessions; current assignment and all current features use only prefix before the predicted spin.");

  lines.push("\n### Top By Net");
  lines.push(...summaryTable(sortedByNet.slice(0, 12).map((row) => ({
    id: row.method.id,
    group: row.method.group,
    description: row.method.description,
    summary: row.summary,
  }))));

  lines.push("\n### Robust Candidates, min bet 500 and min 8 active sessions");
  lines.push(...summaryTable(sortedRobust.slice(0, 16).map((row) => ({
    id: row.method.id,
    group: row.method.group,
    description: row.method.description,
    summary: row.summary,
  }))));

  lines.push("\n### All Methods");
  lines.push(...summaryTable(rows.map((row) => ({
    id: row.method.id,
    group: row.method.group,
    description: row.method.description,
    summary: row.summary,
  }))));

  lines.push("\n### Latest 10 Sessions, Top By Net");
  lines.push(...summaryTable(latestRows.slice(0, 12).map((row) => ({
    id: row.method.id,
    group: row.method.group,
    description: row.method.description,
    summary: row.summary,
  }))));

  lines.push("\n### Best Method By Group");
  const groupRows = [...groupBy(rows, (row) => row.method.group).entries()]
    .map(([group, items]) => [...items].sort((a, b) => b.summary.net - a.summary.net)[0])
    .filter((row): row is { method: Method; summary: Summary } => Boolean(row));
  lines.push(...summaryTable(groupRows.map((row) => ({
    id: row.method.id,
    group: row.method.group,
    description: row.method.description,
    summary: row.summary,
  }))));

  lines.push("\n### Adaptive No-Future Meta-Gates");
  lines.push(...summaryTable(adaptiveRows
    .sort((a, b) => b.summary.net - a.summary.net)
    .map((row) => ({
      id: row.rule.id,
      group: "adaptive",
      description: row.rule.description,
      summary: row.summary,
    }))));

  lines.push("\n### Latest 10 Sessions, Adaptive Meta-Gates");
  lines.push(...summaryTable(adaptiveLatestRows.slice(0, 10).map((row) => ({
    id: row.rule.id,
    group: "adaptive",
    description: row.rule.description,
    summary: row.summary,
  }))));
}

function addCrossDatasetReport(
  lines: string[],
  results: Array<{ adaptiveEvents: SignalEvent[]; events: SignalEvent[]; filePath: string }>,
): void {
  lines.push("\n## Cross-Dataset Robustness");
  lines.push("| method | group | data_2026.6.11 | history_data | note |");
  lines.push("|---|---|---:|---:|---|");
  for (const method of METHODS) {
    const summaries = results.map((result) => summarize(result.events.filter((event) => event.methodId === method.id)));
    const bothPositive = summaries.every((summary) => summary.net > 0 && summary.roi > 0);
    const enoughBoth = summaries.every((summary) => summary.bet >= 300 && summary.activeSessions >= 5);
    const note = bothPositive && enoughBoth
      ? "positive both"
      : bothPositive
        ? "positive but sparse"
        : "mixed/negative";
    lines.push(`| ${method.id} | ${method.group} | \`${fmt(summaries[0])}\` | \`${fmt(summaries[1])}\` | ${note} |`);
  }

  lines.push("\n## Cross-Dataset Adaptive Robustness");
  lines.push("| rule | data_2026.6.11 | history_data | note |");
  lines.push("|---|---:|---:|---|");
  for (const rule of ADAPTIVE_RULES) {
    const summaries = results.map((result) => summarize(result.adaptiveEvents.filter((event) => event.methodId === rule.id)));
    const bothPositive = summaries.every((summary) => summary.net > 0 && summary.roi > 0);
    const enoughBoth = summaries.every((summary) => summary.bet >= 300 && summary.activeSessions >= 5);
    const note = bothPositive && enoughBoth
      ? "positive both"
      : bothPositive
        ? "positive but sparse"
        : "mixed/negative";
    lines.push(`| ${rule.id} | \`${fmt(summaries[0])}\` | \`${fmt(summaries[1])}\` | ${note} |`);
  }
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report: string[] = [];
  const results: Array<{ adaptiveEvents: SignalEvent[]; events: SignalEvent[]; filePath: string; sessions: Session[] }> = [];

  report.push("# Table Fingerprint Signal Sweep");
  report.push("");
  report.push("Exploratory walk-forward research for using table fingerprints directly, not only as a hot-number filter.");
  report.push("");
  report.push("Bet accounting: each candidate number is one straight-up unit. A signal with 7 candidates risks 7 units and wins 36 units if any candidate hits.");
  report.push("");
  report.push("Important caveat: this is a broad multi-method sweep. Treat strong rows as research leads, not product rules, until they survive stricter holdout and parameter-free validation.");

  for (const filePath of DATASETS) {
    const started = Date.now();
    console.log(`Running ${path.relative(ROOT, filePath)}...`);
    const sessions = loadSessions(filePath);
    const events = runDataset(sessions);
    const adaptiveEvents = runAdaptiveMeta(events);
    results.push({ adaptiveEvents, events, filePath, sessions });
    addDatasetReport(report, filePath, sessions, events, adaptiveEvents);
    console.log(`  events=${events.length} adaptive=${adaptiveEvents.length} elapsed=${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  addCrossDatasetReport(report, results);

  const outPath = path.join(OUT_DIR, "table-fingerprint-signal-sweep.md");
  fs.writeFileSync(outPath, `${report.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

main();
