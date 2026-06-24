import fs from "node:fs";
import path from "node:path";
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

type TableType = "diffuse" | "drifting" | "mixed-core" | "multi-core" | "single-core" | "small-sample";

interface RawHistoryRow {
  ImportIndex?: number;
  Name?: string;
  Numbers?: string | number[];
  SaveTime?: string;
  TableId?: string;
  tableId?: string;
  tms?: number;
}

interface Session extends AutoTableInputSession {
  sourceIndex: number;
}

interface PriorContext {
  profilesById: Map<string, TableProfile>;
  state: AutoTableProfileState;
  statsById: Map<string, TableStats>;
}

interface TableStats {
  numberCounts: number[];
  offsetCounts: number[];
  primaryCenters: RouletteNumber[];
  tableId: string;
  transitionTotal: number;
}

interface TableCard {
  offsetLift: number;
  offsetSample: number;
  offsetTop: number | null;
  primaryStability: number;
  tableId: string;
  tableName: string;
  totalNumbers: number;
  top1: TableHotSector | null;
  top2: TableHotSector | null;
  top3: TableHotSector | null;
  topGapZ: number;
  type: TableType;
  sessionCount: number;
}

interface SignalContext {
  assignmentLevel: AutoTableMatchLevel;
  assignmentSource: TableAssignmentSource;
  card: TableCard;
  position: number;
  prefix: readonly RouletteNumber[];
  recent: Map<number, TableHotSector | null>;
  result: RouletteNumber;
  session: Session;
  stats: TableStats;
  venueKey: string;
}

interface Strategy {
  description: string;
  family: string;
  id: string;
  pick: (ctx: SignalContext) => RouletteNumber[];
}

interface Event {
  assignmentLevel: AutoTableMatchLevel;
  bet: number;
  candidates: RouletteNumber[];
  family: string;
  hit: boolean;
  net: number;
  position: number;
  result: RouletteNumber;
  sessionId: string;
  strategyId: string;
  tableId: string;
  tableType: TableType;
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
  negativeSessions: number;
  net: number;
  positiveSessions: number;
  roi: number;
  signals: number;
  top10SignalShare: number;
  win: number;
}

interface DatasetResult {
  cards: TableCard[];
  events: Event[];
  filePath: string;
  sessions: Session[];
}

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
}

function parseUpdatedAt(row: RawHistoryRow, sourceIndex: number): string {
  if (typeof row.tms === "number" && Number.isFinite(row.tms)) return new Date(row.tms).toISOString();
  const text = String(row.SaveTime ?? "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/u);
  if (match) {
    return `${match[1]}-${match[2]}-${match[3]}T${match[4] ?? "12"}:${match[5] ?? "00"}:00.000+08:00`;
  }
  return new Date(sourceIndex).toISOString();
}

function loadSessions(filePath: string): Session[] {
  const rows = JSON.parse(fs.readFileSync(filePath, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex): Session => ({
      id: `${path.basename(filePath, ".json")}_${sourceIndex}`,
      importIndex: row.ImportIndex ?? sourceIndex,
      name: String(row.Name ?? `session-${sourceIndex + 1}`),
      numbers: parseNumbers(row.Numbers),
      sourceIndex,
      tableId: row.tableId ?? row.TableId,
      updatedAt: parseUpdatedAt(row, sourceIndex),
    }))
    .filter((session) => session.numbers.length > 0)
    .sort(compareSessionsChronologically);
}

function compareSessionsChronologically(left: AutoTableInputSession, right: AutoTableInputSession): number {
  const leftTime = new Date(left.updatedAt).getTime();
  const rightTime = new Date(right.updatedAt).getTime();
  const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
  const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
  return safeLeftTime - safeRightTime
    || (left.importIndex ?? Number.MAX_SAFE_INTEGER) - (right.importIndex ?? Number.MAX_SAFE_INTEGER)
    || left.name.localeCompare(right.name, "zh-Hans-CN")
    || left.id.localeCompare(right.id);
}

function wheelIndex(number: RouletteNumber): number {
  return WHEEL_INDEX.get(number) ?? 0;
}

function wheelAtOffset(center: RouletteNumber, offset: number): RouletteNumber {
  return WHEEL_ORDER[(wheelIndex(center) + offset + WHEEL_ORDER.length * 10) % WHEEL_ORDER.length];
}

function circularDistance(left: RouletteNumber, right: RouletteNumber): number {
  const distance = Math.abs(wheelIndex(left) - wheelIndex(right));
  return Math.min(distance, WHEEL_ORDER.length - distance);
}

function unique(numbers: readonly RouletteNumber[]): RouletteNumber[] {
  return [...new Set(numbers)];
}

function sectorAround(center: RouletteNumber, size: 3 | 5 | 7): RouletteNumber[] {
  const half = Math.floor(size / 2);
  return Array.from({ length: size }, (_, index) => wheelAtOffset(center, index - half));
}

function sectorSlice(sector: TableHotSector, size: 3 | 5 | 7): RouletteNumber[] {
  if (size === 7) return [...sector.numbers];
  const start = Math.floor((7 - size) / 2);
  return sector.numbers.slice(start, start + size);
}

function recent(numbers: readonly RouletteNumber[], window: number): RouletteNumber[] {
  return numbers.slice(Math.max(0, numbers.length - window));
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

function topSector(numbers: readonly RouletteNumber[], size = 7): TableHotSector | null {
  if (numbers.length === 0) return null;
  const counts = makeCounts(numbers);
  return WHEEL_ORDER
    .map((_, start) => sectorFromCounts(counts, start, size, numbers.length))
    .sort((left, right) => right.count - left.count || right.z - left.z)[0] ?? null;
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

function buildTableStats(profileSessions: readonly TableProfileSession[]): Map<string, TableStats> {
  const map = new Map<string, TableStats>();
  for (const session of profileSessions) {
    if (!session.tableId) continue;
    const stats = map.get(session.tableId) ?? {
      numberCounts: Array(37).fill(0),
      offsetCounts: Array(37).fill(0),
      primaryCenters: [],
      tableId: session.tableId,
      transitionTotal: 0,
    };
    for (const number of session.numbers) stats.numberCounts[number] += 1;
    const primary = topSector(session.numbers, 7);
    if (primary) stats.primaryCenters.push(primary.center);
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

function topOffset(stats: TableStats): { lift: number; offset: number | null; sample: number } {
  if (stats.transitionTotal <= 0) return { lift: 0, offset: null, sample: 0 };
  const expected = stats.transitionTotal / 37;
  const best = stats.offsetCounts
    .map((count, offset) => ({ count, lift: expected > 0 ? count / expected : 0, offset }))
    .sort((left, right) => right.count - left.count || right.lift - left.lift)[0];
  return best ? { lift: best.lift, offset: best.offset, sample: stats.transitionTotal } : { lift: 0, offset: null, sample: stats.transitionTotal };
}

function topOffsets(stats: TableStats, limit: number, minLift: number): number[] {
  if (stats.transitionTotal <= 0) return [];
  const expected = stats.transitionTotal / 37;
  return stats.offsetCounts
    .map((count, offset) => ({ count, lift: expected > 0 ? count / expected : 0, offset }))
    .filter((item) => item.lift >= minLift)
    .sort((left, right) => right.count - left.count || right.lift - left.lift)
    .slice(0, limit)
    .map((item) => item.offset);
}

function primaryStability(stats: TableStats, top1: TableHotSector | null): number {
  if (!top1 || stats.primaryCenters.length === 0) return 0;
  const near = stats.primaryCenters.filter((center) => circularDistance(center, top1.center) <= 1).length;
  return near / stats.primaryCenters.length;
}

function classifyTable(profile: TableProfile, stats: TableStats): TableType {
  const top1 = profile.hotSectors[0] ?? null;
  const top2 = profile.hotSectors[1] ?? null;
  const stability = primaryStability(stats, top1);
  const top2z = top2?.z ?? 0;
  const topGapZ = (top1?.z ?? 0) - top2z;

  if (profile.sessionCount < 3 || profile.totalNumbers < 500) return "small-sample";
  if (!top1 || top1.z < 0.75) return "diffuse";
  if (stability < 0.35 && top1.z < 1.4) return "drifting";
  if (top1.z >= 1.2 && topGapZ >= 0.4 && stability >= 0.45) return "single-core";
  if (top1.z >= 1 && top2z >= 0.8 && topGapZ < 0.7) return "multi-core";
  return "mixed-core";
}

function makeCard(profile: TableProfile, stats: TableStats): TableCard {
  const top1 = profile.hotSectors[0] ?? null;
  const top2 = profile.hotSectors[1] ?? null;
  const offset = topOffset(stats);
  return {
    offsetLift: offset.lift,
    offsetSample: offset.sample,
    offsetTop: offset.offset,
    primaryStability: primaryStability(stats, top1),
    sessionCount: profile.sessionCount,
    tableId: profile.tableId,
    tableName: profile.tableName,
    totalNumbers: profile.totalNumbers,
    top1,
    top2,
    top3: profile.hotSectors[2] ?? null,
    topGapZ: (top1?.z ?? 0) - (top2?.z ?? 0),
    type: classifyTable(profile, stats),
  };
}

function buildCards(profileSessions: readonly TableProfileSession[], state: AutoTableProfileState): TableCard[] {
  const profiles = buildTableProfiles(profileSessions, state.tables);
  const statsById = buildTableStats(profileSessions);
  return profiles
    .map((profile) => {
      const stats = statsById.get(profile.tableId);
      return stats ? makeCard(profile, stats) : null;
    })
    .filter((card): card is TableCard => Boolean(card))
    .sort((left, right) => right.totalNumbers - left.totalNumbers || left.tableId.localeCompare(right.tableId));
}

function buildPriorContexts(sessions: readonly Session[]): PriorContext[] {
  const contexts: PriorContext[] = [];
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

function goodAssignment(ctx: SignalContext): boolean {
  return ctx.assignmentSource === "auto"
    && (ctx.assignmentLevel === "confirmed" || ctx.assignmentLevel === "probable");
}

function recentSector(ctx: SignalContext, window: number): TableHotSector | null {
  return ctx.recent.get(window) ?? null;
}

function coreDistance(ctx: SignalContext, window: number): number | null {
  const top1 = ctx.card.top1;
  const sector = recentSector(ctx, window);
  return top1 && sector ? circularDistance(top1.center, sector.center) : null;
}

function nearAnyCore(ctx: SignalContext, window: number, maxDistance: number): boolean {
  const sector = recentSector(ctx, window);
  if (!sector) return false;
  return [ctx.card.top1, ctx.card.top2, ctx.card.top3]
    .filter((item): item is TableHotSector => Boolean(item))
    .some((core) => core.z >= 0.7 && circularDistance(core.center, sector.center) <= maxDistance);
}

function recentColdInCore(ctx: SignalContext, window: number, maxZ: number): boolean {
  const top1 = ctx.card.top1;
  if (!top1 || top1.z < 1) return false;
  const rows = recent(ctx.prefix, window);
  const count = countInSet(rows, top1.numbers);
  const z = zForCount(count, rows.length, top1.numbers.length / 37);
  return z <= maxZ;
}

const STRATEGIES: Strategy[] = [
  {
    id: "single-exact120-recent3",
    family: "single-core",
    description: "Single/mixed core, 120-window center exactly matches table top1, bet recent center 3-neighbor.",
    pick: (ctx) => {
      const sector = recentSector(ctx, 120);
      if (!goodAssignment(ctx) || !sector || !ctx.card.top1) return [];
      if (!["single-core", "mixed-core"].includes(ctx.card.type)) return [];
      if (ctx.card.top1.z < 1 || sector.z < 1 || coreDistance(ctx, 120) !== 0) return [];
      return sectorAround(sector.center, 3);
    },
  },
  {
    id: "single-near120-recent3",
    family: "single-core",
    description: "Single/mixed core, 120-window center within 1 of table top1, recent z>=1.5, bet recent center 3-neighbor.",
    pick: (ctx) => {
      const sector = recentSector(ctx, 120);
      const distance = coreDistance(ctx, 120);
      if (!goodAssignment(ctx) || !sector || !ctx.card.top1 || distance === null) return [];
      if (!["single-core", "mixed-core"].includes(ctx.card.type)) return [];
      if (ctx.card.top1.z < 1 || sector.z < 1.5 || distance > 1) return [];
      return sectorAround(sector.center, 3);
    },
  },
  {
    id: "single-exact60-recent5",
    family: "single-core",
    description: "Fast short-window exact center match, bet recent center 5-neighbor.",
    pick: (ctx) => {
      const sector = recentSector(ctx, 60);
      if (!goodAssignment(ctx) || !sector || !ctx.card.top1) return [];
      if (ctx.card.top1.z < 1 || sector.z < 1.5 || coreDistance(ctx, 60) !== 0) return [];
      return sectorAround(sector.center, 5);
    },
  },
  {
    id: "stable-exact160-recent3",
    family: "stability",
    description: "Stable profile, 160-window exact center match, bet recent center 3-neighbor.",
    pick: (ctx) => {
      const sector = recentSector(ctx, 160);
      if (!goodAssignment(ctx) || !sector || !ctx.card.top1) return [];
      if (ctx.card.primaryStability < 0.45 || ctx.card.top1.z < 1 || coreDistance(ctx, 160) !== 0) return [];
      return sectorAround(sector.center, 3);
    },
  },
  {
    id: "multi-follow120-recent3",
    family: "multi-core",
    description: "Multi/mixed core, 120-window center follows any top-3 table core, bet recent center 3-neighbor.",
    pick: (ctx) => {
      const sector = recentSector(ctx, 120);
      if (!goodAssignment(ctx) || !sector) return [];
      if (!["multi-core", "mixed-core"].includes(ctx.card.type)) return [];
      if (sector.z < 1 || !nearAnyCore(ctx, 120, 1)) return [];
      return sectorAround(sector.center, 3);
    },
  },
  {
    id: "multi-follow120-recent5",
    family: "multi-core",
    description: "Multi/mixed core, 120-window follows any top-3 table core, bet recent center 5-neighbor.",
    pick: (ctx) => {
      const sector = recentSector(ctx, 120);
      if (!goodAssignment(ctx) || !sector) return [];
      if (!["multi-core", "mixed-core"].includes(ctx.card.type)) return [];
      if (sector.z < 1.5 || !nearAnyCore(ctx, 120, 1)) return [];
      return sectorAround(sector.center, 5);
    },
  },
  {
    id: "core-cold120-profile5",
    family: "rebound",
    description: "Table top1 is hot historically but cold in recent 120 spins, bet table top1 center 5-neighbor.",
    pick: (ctx) => {
      if (!goodAssignment(ctx) || !ctx.card.top1) return [];
      if (ctx.card.type === "diffuse" || ctx.card.type === "small-sample") return [];
      if (!recentColdInCore(ctx, 120, -0.5)) return [];
      return sectorSlice(ctx.card.top1, 5);
    },
  },
  {
    id: "core-cold80-profile5",
    family: "rebound",
    description: "Table top1 is hot historically but cold in recent 80 spins, bet table top1 center 5-neighbor.",
    pick: (ctx) => {
      if (!goodAssignment(ctx) || !ctx.card.top1) return [];
      if (ctx.card.type === "diffuse" || ctx.card.type === "small-sample") return [];
      if (!recentColdInCore(ctx, 80, -0.5)) return [];
      return sectorSlice(ctx.card.top1, 5);
    },
  },
  {
    id: "intersection160-zone",
    family: "zone-observe",
    description: "160-window exact center match, draw/bet the 7-neighbor intersection zone.",
    pick: (ctx) => {
      const sector = recentSector(ctx, 160);
      if (!goodAssignment(ctx) || !sector || !ctx.card.top1) return [];
      if (coreDistance(ctx, 160) !== 0) return [];
      const recentSet = new Set(sector.numbers);
      const picked = ctx.card.top1.numbers.filter((number) => recentSet.has(number));
      return picked.length >= 5 ? picked : [];
    },
  },
  {
    id: "offset-top1",
    family: "transition",
    description: "Same-table historical wheel offset top-1 has lift>=1.25, bet one number.",
    pick: (ctx) => {
      if (!goodAssignment(ctx) || ctx.card.offsetSample < 500 || ctx.card.offsetLift < 1.25) return [];
      const prev = ctx.prefix[ctx.prefix.length - 1];
      return prev === undefined || ctx.card.offsetTop === null ? [] : [wheelAtOffset(prev, ctx.card.offsetTop)];
    },
  },
  {
    id: "offset-top3",
    family: "transition",
    description: "Same-table historical wheel offset top-3 has lift>=1.15, bet three numbers.",
    pick: (ctx) => {
      if (!goodAssignment(ctx) || ctx.card.offsetSample < 500) return [];
      const prev = ctx.prefix[ctx.prefix.length - 1];
      return prev === undefined ? [] : topOffsets(ctx.stats, 3, 1.15).map((offset) => wheelAtOffset(prev, offset));
    },
  },
];

function runDataset(filePath: string): DatasetResult {
  const sessions = loadSessions(filePath);
  const contexts = buildPriorContexts(sessions);
  const events: Event[] = [];

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
      if (!profile || !stats) continue;

      const card = makeCard(profile, stats);
      const recentMap = new Map<number, TableHotSector | null>();
      for (const window of [60, 80, 120, 160, 200]) {
        recentMap.set(window, topSector(recent(prefix, window), 7));
      }
      const ctx: SignalContext = {
        assignmentLevel: assignment.autoMatchLevel,
        assignmentSource: assignment.source,
        card,
        position,
        prefix,
        recent: recentMap,
        result: session.numbers[position],
        session,
        stats,
        venueKey,
      };

      for (const strategy of STRATEGIES) {
        const candidates = unique(strategy.pick(ctx)).filter((number) => Number.isInteger(number) && number >= 0 && number <= 36);
        if (candidates.length === 0) continue;
        const hit = candidates.includes(ctx.result);
        const bet = candidates.length;
        events.push({
          assignmentLevel: ctx.assignmentLevel,
          bet,
          candidates,
          family: strategy.family,
          hit,
          net: hit ? 36 - bet : -bet,
          position,
          result: ctx.result,
          sessionId: session.id,
          strategyId: strategy.id,
          tableId: card.tableId,
          tableType: card.type,
          venueKey,
        });
      }
    }
  }

  const finalState = buildAutoTableProfileState(sessions);
  const cards = buildCards(finalState.profileSessions, finalState);
  return { cards, events, filePath, sessions };
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

function summarize(events: readonly Event[]): Summary {
  let bet = 0;
  let hits = 0;
  let peak = 0;
  let running = 0;
  let win = 0;
  let maxDrawdown = 0;
  const sessionNet = new Map<string, number>();
  const sessionSignals = new Map<string, number>();
  for (const event of events) {
    bet += event.bet;
    hits += event.hit ? 1 : 0;
    win += event.hit ? 36 : 0;
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
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
    maxDrawdown,
    negativeSessions: nets.filter((value) => value < 0).length,
    net: win - bet,
    positiveSessions: nets.filter((value) => value > 0).length,
    roi: bet > 0 ? ((win - bet) / bet) * 100 : 0,
    signals: events.length,
    top10SignalShare: events.length > 0 ? (top10Signals / events.length) * 100 : 0,
    win,
  };
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
    `bet=${String(summary.bet).padStart(7)}`,
    `hit=${String(summary.hits).padStart(4)}`,
    `net=${String(summary.net).padStart(8)}`,
    `roi=${summary.roi.toFixed(1).padStart(7)}%`,
    `hr=${summary.hitRate.toFixed(1).padStart(5)}%`,
    `avgBet=${summary.averageBet.toFixed(1)}`,
    `dd=${String(summary.maxDrawdown).padStart(5)}`,
    `pos=${String(summary.positiveSessions).padStart(2)}/${String(summary.activeSessions).padEnd(2)}`,
    `gini=${summary.giniAbsSessionNet.toFixed(3)}`,
    `top10=${summary.top10SignalShare.toFixed(1)}%`,
  ].join(" ");
}

function cardText(card: TableCard | null): string {
  if (!card) return "-";
  const top = [card.top1, card.top2, card.top3]
    .filter((sector): sector is TableHotSector => Boolean(sector))
    .map((sector) => `${sector.center}(z=${sector.z.toFixed(1)})`)
    .join(", ");
  return `${card.type}; sessions=${card.sessionCount}; nums=${card.totalNumbers}; top=${top}; stability=${card.primaryStability.toFixed(2)}; gapZ=${card.topGapZ.toFixed(2)}; offset=${card.offsetTop ?? "-"} lift=${card.offsetLift.toFixed(2)}`;
}

function summaryRows(events: readonly Event[], keyFn: (event: Event) => string): Array<{ key: string; summary: Summary }> {
  return [...groupBy(events, keyFn).entries()]
    .map(([key, rows]) => ({ key, summary: summarize(rows) }))
    .sort((a, b) => b.summary.net - a.summary.net || b.summary.roi - a.summary.roi);
}

function table(lines: string[], rows: Array<{ key: string; summary: Summary }>, title: string, limit = 20): void {
  lines.push(`\n### ${title}`);
  lines.push("| key | summary |");
  lines.push("|---|---:|");
  for (const row of rows.slice(0, limit)) {
    lines.push(`| ${row.key} | \`${fmt(row.summary)}\` |`);
  }
}

function strategyDescription(id: string): string {
  return STRATEGIES.find((strategy) => strategy.id === id)?.description ?? "";
}

function addDatasetReport(lines: string[], result: DatasetResult): void {
  const totalSpins = result.sessions.reduce((sum, session) => sum + session.numbers.length, 0);
  const latestIds = new Set(result.sessions.slice(-10).map((session) => session.id));
  const latestEvents = result.events.filter((event) => latestIds.has(event.sessionId));

  lines.push(`\n## Dataset: ${path.basename(result.filePath)}`);
  lines.push(`- sessions: ${result.sessions.length}`);
  lines.push(`- spins: ${totalSpins}`);
  lines.push(`- final descriptive cards: ${result.cards.length}`);
  lines.push(`- walk-forward strategy events: ${result.events.length}`);
  lines.push("- no-future: strategy events only use prior sessions for table cards and current prefix for live features.");

  lines.push("\n### Final Descriptive Table Cards");
  lines.push("| table | card |");
  lines.push("|---|---|");
  for (const card of result.cards.slice(0, 20)) {
    lines.push(`| ${card.tableName} (${card.tableId}) | ${cardText(card)} |`);
  }

  table(lines, summaryRows(result.events, (event) => event.strategyId), "Walk-Forward By Strategy", 30);
  table(lines, summaryRows(result.events, (event) => event.tableType), "Walk-Forward By Table Type", 20);
  table(lines, summaryRows(result.events, (event) => `${event.tableType} / ${event.strategyId}`), "Walk-Forward By Table Type + Strategy", 40);
  table(lines, summaryRows(result.events, (event) => `${event.tableId} / ${event.tableType} / ${event.strategyId}`), "Walk-Forward By Evolving Table Card + Strategy", 40);
  table(lines, summaryRows(latestEvents, (event) => event.strategyId), "Latest 10 By Strategy", 20);

  lines.push("\n### Strategy Legend");
  lines.push("| strategy | family | description |");
  lines.push("|---|---|---|");
  for (const strategy of STRATEGIES) {
    lines.push(`| ${strategy.id} | ${strategy.family} | ${strategy.description} |`);
  }
}

function addCrossDatasetReport(lines: string[], results: readonly DatasetResult[]): void {
  const [a, b] = results;
  lines.push("\n## Cross-Dataset Robustness");
  lines.push("\n### Strategy");
  lines.push("| strategy | data_2026.6.11 | history_data | minROI | description |");
  lines.push("|---|---:|---:|---:|---|");
  for (const strategy of STRATEGIES) {
    const summaryA = summarize(a.events.filter((event) => event.strategyId === strategy.id));
    const summaryB = summarize(b.events.filter((event) => event.strategyId === strategy.id));
    const minRoi = Math.min(summaryA.roi, summaryB.roi);
    lines.push(`| ${strategy.id} | \`${fmt(summaryA)}\` | \`${fmt(summaryB)}\` | ${minRoi.toFixed(1)}% | ${strategy.description} |`);
  }

  lines.push("\n### Table Type + Strategy");
  lines.push("| key | data_2026.6.11 | history_data | minROI |");
  lines.push("|---|---:|---:|---:|");
  const keys = new Set([
    ...a.events.map((event) => `${event.tableType} / ${event.strategyId}`),
    ...b.events.map((event) => `${event.tableType} / ${event.strategyId}`),
  ]);
  const rows = [...keys]
    .map((key) => {
      const [type, strategy] = key.split(" / ");
      const summaryA = summarize(a.events.filter((event) => event.tableType === type && event.strategyId === strategy));
      const summaryB = summarize(b.events.filter((event) => event.tableType === type && event.strategyId === strategy));
      return { key, summaryA, summaryB, minRoi: Math.min(summaryA.roi, summaryB.roi) };
    })
    .filter((row) => row.summaryA.bet >= 300 && row.summaryB.bet >= 300 && row.summaryA.activeSessions >= 5 && row.summaryB.activeSessions >= 5)
    .sort((left, right) => right.minRoi - left.minRoi || (right.summaryA.net + right.summaryB.net) - (left.summaryA.net + left.summaryB.net));
  for (const row of rows.slice(0, 40)) {
    lines.push(`| ${row.key} | \`${fmt(row.summaryA)}\` | \`${fmt(row.summaryB)}\` | ${row.minRoi.toFixed(1)}% |`);
  }
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const lines = [
    "# Table Strategy Cards",
    "",
    "Research goal: describe each auto table/regime, classify table types, then test fixed strategy families by table type in strict walk-forward.",
    "",
    "Descriptive final cards are for interpretation only. Betting summaries are walk-forward: prior sessions only build the table card; current spin uses prefix only.",
  ];
  const results: DatasetResult[] = [];

  for (const filePath of DATASETS) {
    const started = Date.now();
    console.log(`Running ${path.relative(ROOT, filePath)}...`);
    const result = runDataset(filePath);
    results.push(result);
    addDatasetReport(lines, result);
    console.log(`  cards=${result.cards.length} events=${result.events.length} elapsed=${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  addCrossDatasetReport(lines, results);

  const outPath = path.join(OUT_DIR, "table-strategy-cards.md");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

main();
