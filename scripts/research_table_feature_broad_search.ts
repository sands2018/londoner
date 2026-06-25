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
const FOCUS_STRATEGY_ID = "recent-recent-w160-r1-d3-s3-rz0p5";
const FOCUS_DEEP_DIVE_IDS = new Set([
  FOCUS_STRATEGY_ID,
  "recent-recent-w160-r1-d3-s3-rz1",
  "recent-recent-w200-r1-d3-s3-rz0p5",
  "recent-recent-w160-r1-d2-s3-rz0p5",
  "recent-recent-w80-r1-d2-s3-rz1",
  "intersection-w160-r1-min3-rz0p5",
]);

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

interface Accumulator {
  bet: number;
  hits: number;
  maxDrawdown: number;
  peak: number;
  running: number;
  sessionNet: Map<string, number>;
  sessionSignals: Map<string, number>;
  signals: number;
  win: number;
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

interface FocusEvent {
  assignmentLevel: AutoTableMatchLevel;
  bet: number;
  candidates: RouletteNumber[];
  distance: number;
  hit: boolean;
  net: number;
  position: number;
  primaryStability: number;
  recentCenter: RouletteNumber | null;
  recentZ: number;
  result: RouletteNumber;
  sessionId: string;
  sessionName: string;
  sessionUpdatedAt: string;
  sourceIndex: number;
  strategyId: string;
  tableId: string;
  tableNumbers: number;
  tableSessionCount: number;
  tableTop1Center: RouletteNumber | null;
  tableTop1Z: number;
  tableType: TableType;
  topGapZ: number;
  venueKey: string;
  window: number;
}

interface DatasetResult {
  filePath: string;
  focusEvents: FocusEvent[];
  latest10: Map<string, Summary>;
  sessions: Session[];
  summaries: Map<string, Summary>;
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
  if (match) return `${match[1]}-${match[2]}-${match[3]}T${match[4] ?? "12"}:${match[5] ?? "00"}:00.000+08:00`;
  return new Date(sourceIndex).toISOString();
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
    tableId: profile.tableId,
    totalNumbers: profile.totalNumbers,
    top1,
    top2,
    top3: profile.hotSectors[2] ?? null,
    topGapZ: (top1?.z ?? 0) - (top2?.z ?? 0),
    type: classifyTable(profile, stats),
    sessionCount: profile.sessionCount,
  };
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

function coreByRank(card: TableCard, rank: 1 | 2 | 3): TableHotSector | null {
  if (rank === 1) return card.top1;
  if (rank === 2) return card.top2;
  return card.top3;
}

function recentSector(ctx: SignalContext, window: number): TableHotSector | null {
  return ctx.recent.get(window) ?? null;
}

function coreRecentZ(ctx: SignalContext, core: TableHotSector, window: number): number {
  const rows = recent(ctx.prefix, window);
  return zForCount(countInSet(rows, core.numbers), rows.length, core.numbers.length / 37);
}

function overlap(left: readonly RouletteNumber[], right: readonly RouletteNumber[]): RouletteNumber[] {
  const lookup = new Set(right);
  return left.filter((number) => lookup.has(number));
}

function tag(value: number): string {
  return String(value).replace("-", "m").replace(".", "p");
}

function addStrategy(strategies: Strategy[], seen: Set<string>, strategy: Strategy): void {
  if (seen.has(strategy.id)) return;
  seen.add(strategy.id);
  strategies.push(strategy);
}

function buildStrategies(): Strategy[] {
  const strategies: Strategy[] = [];
  const seen = new Set<string>();
  const coreRanks: Array<1 | 2 | 3> = [1, 2, 3];
  const sizes: Array<3 | 5 | 7> = [3, 5, 7];

  for (const rank of coreRanks) {
    for (const size of sizes) {
      for (const minNumbers of [500, 1000, 1500]) {
        for (const minZ of [0.7, 1.0, 1.3]) {
          addStrategy(strategies, seen, {
            id: `profile-core-r${rank}-s${size}-n${minNumbers}-z${tag(minZ)}`,
            family: "profile-core",
            description: `Bet table core rank ${rank} (${size} nums), min profile numbers ${minNumbers}, core z>=${minZ}.`,
            pick: (ctx) => {
              const core = coreByRank(ctx.card, rank);
              if (!goodAssignment(ctx) || !core || ctx.card.totalNumbers < minNumbers || core.z < minZ) return [];
              return sectorSlice(core, size);
            },
          });
        }
      }
    }
  }

  for (const size of sizes) {
    for (const minNumbers of [500, 1000, 1500]) {
      for (const minZ of [0.7, 1.0, 1.3]) {
        for (const minStability of [0.45, 0.7]) {
          addStrategy(strategies, seen, {
            id: `profile-stable-top1-s${size}-n${minNumbers}-z${tag(minZ)}-stab${tag(minStability)}`,
            family: "profile-core-stable",
            description: `Bet stable table top1 (${size} nums), stability>=${minStability}.`,
            pick: (ctx) => {
              const core = ctx.card.top1;
              if (!goodAssignment(ctx) || !core || ctx.card.totalNumbers < minNumbers) return [];
              if (core.z < minZ || ctx.card.primaryStability < minStability) return [];
              return sectorSlice(core, size);
            },
          });
        }
      }
    }
  }

  for (const window of [37, 60, 80, 120, 160, 200]) {
    for (const rank of [1, 2] as const) {
      for (const size of sizes) {
        for (const maxDistance of [0, 1, 2, 3]) {
          for (const minRecentZ of [0.5, 1.0, 1.5]) {
            for (const target of ["recent", "core"] as const) {
              addStrategy(strategies, seen, {
                id: `recent-${target}-w${window}-r${rank}-d${maxDistance}-s${size}-rz${tag(minRecentZ)}`,
                family: "recent-core-agreement",
                description: `Current ${window} top sector within ${maxDistance} of table core rank ${rank}; bet ${target} ${size}.`,
                pick: (ctx) => {
                  const core = coreByRank(ctx.card, rank);
                  const sector = recentSector(ctx, window);
                  if (!goodAssignment(ctx) || !core || !sector || core.z < 0.7 || sector.z < minRecentZ) return [];
                  if (circularDistance(core.center, sector.center) > maxDistance) return [];
                  return target === "recent" ? sectorAround(sector.center, size) : sectorSlice(core, size);
                },
              });
            }
          }
        }
      }
    }
  }

  for (const window of [60, 80, 120, 160, 200]) {
    for (const rank of [1, 2] as const) {
      for (const minOverlap of [3, 4, 5]) {
        for (const minRecentZ of [0.5, 1.0, 1.5]) {
          addStrategy(strategies, seen, {
            id: `intersection-w${window}-r${rank}-min${minOverlap}-rz${tag(minRecentZ)}`,
            family: "intersection",
            description: `Bet overlap between current ${window} top sector and table core rank ${rank}.`,
            pick: (ctx) => {
              const core = coreByRank(ctx.card, rank);
              const sector = recentSector(ctx, window);
              if (!goodAssignment(ctx) || !core || !sector || core.z < 0.7 || sector.z < minRecentZ) return [];
              const picked = overlap(core.numbers, sector.numbers);
              return picked.length >= minOverlap ? picked : [];
            },
          });
        }
      }
    }
  }

  for (const window of [60, 80, 120, 160, 200]) {
    for (const rank of [1, 2] as const) {
      for (const maxRecentZ of [-1.0, -0.5, 0, 0.5]) {
        for (const size of [5, 7] as const) {
          for (const minCoreZ of [0.7, 1.0]) {
            addStrategy(strategies, seen, {
              id: `core-rebound-w${window}-r${rank}-maxrz${tag(maxRecentZ)}-s${size}-cz${tag(minCoreZ)}`,
              family: "profile-rebound",
              description: `Historical table core rank ${rank} is cold in current ${window}; bet core ${size}.`,
              pick: (ctx) => {
                const core = coreByRank(ctx.card, rank);
                if (!goodAssignment(ctx) || !core || core.z < minCoreZ || ctx.card.type === "small-sample") return [];
                if (coreRecentZ(ctx, core, window) > maxRecentZ) return [];
                return sectorSlice(core, size);
              },
            });
          }
        }
      }
    }
  }

  for (const minSample of [300, 500, 1000]) {
    for (const minLift of [1.05, 1.1, 1.15, 1.2, 1.25]) {
      for (const topK of [1, 2, 3, 5]) {
        addStrategy(strategies, seen, {
          id: `offset-top${topK}-sample${minSample}-lift${tag(minLift)}`,
          family: "transition-offset",
          description: `Bet top ${topK} historical same-table wheel offsets, sample>=${minSample}, lift>=${minLift}.`,
          pick: (ctx) => {
            if (!goodAssignment(ctx) || ctx.stats.transitionTotal < minSample) return [];
            const prev = ctx.prefix[ctx.prefix.length - 1];
            if (prev === undefined) return [];
            return topOffsets(ctx.stats, topK, minLift).map((offset) => wheelAtOffset(prev, offset));
          },
        });
      }
    }
  }

  return strategies;
}

function newAccumulator(): Accumulator {
  return {
    bet: 0,
    hits: 0,
    maxDrawdown: 0,
    peak: 0,
    running: 0,
    sessionNet: new Map(),
    sessionSignals: new Map(),
    signals: 0,
    win: 0,
  };
}

function updateAccumulator(acc: Accumulator, sessionId: string, bet: number, hit: boolean): void {
  const net = hit ? 36 - bet : -bet;
  acc.bet += bet;
  acc.hits += hit ? 1 : 0;
  acc.win += hit ? 36 : 0;
  acc.signals += 1;
  acc.running += net;
  acc.peak = Math.max(acc.peak, acc.running);
  acc.maxDrawdown = Math.max(acc.maxDrawdown, acc.peak - acc.running);
  acc.sessionNet.set(sessionId, (acc.sessionNet.get(sessionId) ?? 0) + net);
  acc.sessionSignals.set(sessionId, (acc.sessionSignals.get(sessionId) ?? 0) + 1);
}

function summarize(acc: Accumulator): Summary {
  const nets = [...acc.sessionNet.values()];
  const top10Signals = [...acc.sessionSignals.values()].sort((a, b) => b - a).slice(0, 10).reduce((sum, value) => sum + value, 0);
  return {
    activeSessions: nets.length,
    averageBet: acc.signals > 0 ? acc.bet / acc.signals : 0,
    bet: acc.bet,
    giniAbsSessionNet: gini(nets),
    hitRate: acc.signals > 0 ? (acc.hits / acc.signals) * 100 : 0,
    hits: acc.hits,
    maxDrawdown: acc.maxDrawdown,
    negativeSessions: nets.filter((value) => value < 0).length,
    net: acc.win - acc.bet,
    positiveSessions: nets.filter((value) => value > 0).length,
    roi: acc.bet > 0 ? ((acc.win - acc.bet) / acc.bet) * 100 : 0,
    signals: acc.signals,
    top10SignalShare: acc.signals > 0 ? (top10Signals / acc.signals) * 100 : 0,
    win: acc.win,
  };
}

function gini(values: readonly number[]): number {
  const sorted = values.map((value) => Math.abs(value)).sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((total, value) => total + value, 0);
  if (n === 0 || sum === 0) return 0;
  const weighted = sorted.reduce((total, value, index) => total + (index + 1) * value, 0);
  return (2 * weighted) / (n * sum) - (n + 1) / n;
}

function eligibleSpins(session: Session): number {
  return Math.max(0, session.numbers.length - ROI_START);
}

function totalEligibleSpins(sessions: readonly Session[]): number {
  return sessions.reduce((sum, session) => sum + eligibleSpins(session), 0);
}

function sp100(summary: Summary, spins: number): number {
  return spins > 0 ? (summary.signals / spins) * 100 : 0;
}

function focusWindow(strategyId: string): number {
  const match = strategyId.match(/-w(\d+)-/u);
  return match ? Number(match[1]) : 160;
}

function focusRank(strategyId: string): 1 | 2 | 3 {
  const match = strategyId.match(/-r([123])-/u);
  const value = match ? Number(match[1]) : 1;
  return value === 2 ? 2 : value === 3 ? 3 : 1;
}

function makeFocusEvent(strategyId: string, ctx: SignalContext, candidates: RouletteNumber[], hit: boolean): FocusEvent {
  const window = focusWindow(strategyId);
  const core = coreByRank(ctx.card, focusRank(strategyId));
  const sector = recentSector(ctx, window);
  return {
    assignmentLevel: ctx.assignmentLevel,
    bet: candidates.length,
    candidates,
    distance: core && sector ? circularDistance(core.center, sector.center) : -1,
    hit,
    net: hit ? 36 - candidates.length : -candidates.length,
    position: ctx.position,
    primaryStability: ctx.card.primaryStability,
    recentCenter: sector?.center ?? null,
    recentZ: sector?.z ?? 0,
    result: ctx.result,
    sessionId: ctx.session.id,
    sessionName: ctx.session.name,
    sessionUpdatedAt: ctx.session.updatedAt,
    sourceIndex: ctx.session.sourceIndex,
    strategyId,
    tableId: ctx.card.tableId,
    tableNumbers: ctx.card.totalNumbers,
    tableSessionCount: ctx.card.sessionCount,
    tableTop1Center: ctx.card.top1?.center ?? null,
    tableTop1Z: ctx.card.top1?.z ?? 0,
    tableType: ctx.card.type,
    topGapZ: ctx.card.topGapZ,
    venueKey: ctx.venueKey,
    window,
  };
}

function runDataset(filePath: string, strategies: readonly Strategy[]): DatasetResult {
  const sessions = loadSessions(filePath);
  const contexts = buildPriorContexts(sessions);
  const latestIds = new Set(sessions.slice(-10).map((session) => session.id));
  const accs = new Map(strategies.map((strategy) => [strategy.id, newAccumulator()]));
  const latestAccs = new Map(strategies.map((strategy) => [strategy.id, newAccumulator()]));
  const focusEvents: FocusEvent[] = [];
  const startTime = Date.now();

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
      const recentMap = new Map<number, TableHotSector | null>();
      for (const window of [37, 60, 80, 120, 160, 200]) {
        recentMap.set(window, topSector(recent(prefix, window), 7));
      }
      const ctx: SignalContext = {
        assignmentLevel: assignment.autoMatchLevel,
        assignmentSource: assignment.source,
        card: makeCard(profile, stats),
        position,
        prefix,
        recent: recentMap,
        result: session.numbers[position],
        session,
        stats,
        venueKey,
      };

      for (const strategy of strategies) {
        const candidates = unique(strategy.pick(ctx)).filter((number) => Number.isInteger(number) && number >= 0 && number <= 36);
        if (candidates.length === 0) continue;
        const hit = candidates.includes(ctx.result);
        updateAccumulator(accs.get(strategy.id)!, session.id, candidates.length, hit);
        if (latestIds.has(session.id)) {
          updateAccumulator(latestAccs.get(strategy.id)!, session.id, candidates.length, hit);
        }
        if (FOCUS_DEEP_DIVE_IDS.has(strategy.id)) {
          focusEvents.push(makeFocusEvent(strategy.id, ctx, candidates, hit));
        }
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`  strategies=${strategies.length} elapsed=${elapsed}s`);

  return {
    filePath,
    focusEvents,
    latest10: new Map([...latestAccs.entries()].map(([id, acc]) => [id, summarize(acc)])),
    sessions,
    summaries: new Map([...accs.entries()].map(([id, acc]) => [id, summarize(acc)])),
  };
}

function fmt(summary: Summary, denominatorSpins: number): string {
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
    `sp100=${sp100(summary, denominatorSpins).toFixed(2)}`,
  ].join(" ");
}

function balancedScore(data: Summary, history: Summary, dataSpins: number, historySpins: number): number {
  const minRoi = Math.min(data.roi, history.roi);
  const minSp100 = Math.min(sp100(data, dataSpins), sp100(history, historySpins));
  const maxTop10 = Math.max(data.top10SignalShare, history.top10SignalShare);
  const maxGini = Math.max(data.giniAbsSessionNet, history.giniAbsSessionNet);
  const roiSpread = Math.abs(data.roi - history.roi);
  const active = Math.min(data.activeSessions, history.activeSessions);
  return minRoi + minSp100 * 0.35 + active * 0.08 - maxTop10 * 0.12 - maxGini * 5 - roiSpread * 0.10;
}

function crossRows(results: readonly DatasetResult[], strategies: readonly Strategy[]) {
  const [dataResult, historyResult] = results;
  const dataSpins = totalEligibleSpins(dataResult.sessions);
  const historySpins = totalEligibleSpins(historyResult.sessions);
  return strategies.map((strategy) => {
    const data = dataResult.summaries.get(strategy.id)!;
    const history = historyResult.summaries.get(strategy.id)!;
    const latestData = dataResult.latest10.get(strategy.id)!;
    const latestHistory = historyResult.latest10.get(strategy.id)!;
    return {
      data,
      history,
      latestData,
      latestHistory,
      score: balancedScore(data, history, dataSpins, historySpins),
      strategy,
    };
  });
}

function addRows(
  lines: string[],
  title: string,
  rows: ReturnType<typeof crossRows>,
  dataSpins: number,
  historySpins: number,
  limit = 25,
): void {
  lines.push(`\n## ${title}`);
  lines.push("| strategy | family | score | data_2026 | history | why |");
  lines.push("|---|---|---:|---:|---:|---|");
  for (const row of rows.slice(0, limit)) {
    lines.push(`| ${row.strategy.id} | ${row.strategy.family} | ${row.score.toFixed(2)} | \`${fmt(row.data, dataSpins)}\` | \`${fmt(row.history, historySpins)}\` | ${row.strategy.description} |`);
  }
}

function addLatestRows(
  lines: string[],
  title: string,
  rows: ReturnType<typeof crossRows>,
  dataSpins: number,
  historySpins: number,
  limit = 15,
): void {
  lines.push(`\n## ${title}`);
  lines.push("| strategy | latest data_2026 | latest history |");
  lines.push("|---|---:|---:|");
  for (const row of rows.slice(0, limit)) {
    lines.push(`| ${row.strategy.id} | \`${fmt(row.latestData, dataSpins)}\` | \`${fmt(row.latestHistory, historySpins)}\` |`);
  }
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

function summarizeFocusEvents(events: readonly FocusEvent[]): Summary {
  const acc = newAccumulator();
  for (const event of events) {
    updateAccumulator(acc, event.sessionId, event.bet, event.hit);
  }
  return summarize(acc);
}

function sessionMap(sessions: readonly Session[]): Map<string, Session> {
  return new Map(sessions.map((session) => [session.id, session]));
}

function activeEligibleSpins(events: readonly FocusEvent[], sessionsById: ReadonlyMap<string, Session>): number {
  const ids = new Set(events.map((event) => event.sessionId));
  let spins = 0;
  for (const id of ids) {
    const session = sessionsById.get(id);
    if (session) spins += eligibleSpins(session);
  }
  return spins;
}

function yearOf(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? String(date.getFullYear()) : "unknown";
}

function numberBucket(value: number, buckets: readonly Array<{ label: string; max: number }>, fallback: string): string {
  for (const bucket of buckets) {
    if (value <= bucket.max) return bucket.label;
  }
  return fallback;
}

function zBucket(value: number): string {
  return numberBucket(value, [
    { label: "<0.75", max: 0.749999 },
    { label: "0.75-0.99", max: 0.999999 },
    { label: "1.00-1.49", max: 1.499999 },
    { label: "1.50-1.99", max: 1.999999 },
  ], "2.00+");
}

function stabilityBucket(value: number): string {
  return numberBucket(value, [
    { label: "<0.45", max: 0.449999 },
    { label: "0.45-0.69", max: 0.699999 },
  ], "0.70+");
}

function tableNumbersBucket(value: number): string {
  return numberBucket(value, [
    { label: "<500", max: 499 },
    { label: "500-999", max: 999 },
    { label: "1000-1499", max: 1499 },
    { label: "1500-1999", max: 1999 },
  ], "2000+");
}

function positionBucket(value: number): string {
  return numberBucket(value, [
    { label: "200-399", max: 399 },
    { label: "400-599", max: 599 },
    { label: "600-799", max: 799 },
    { label: "800-999", max: 999 },
  ], "1000+");
}

function average(events: readonly FocusEvent[], valueFn: (event: FocusEvent) => number): number {
  return events.length > 0 ? events.reduce((sum, event) => sum + valueFn(event), 0) / events.length : 0;
}

function addFocusSummaryRows(
  lines: string[],
  title: string,
  rows: Array<{ key: string; events: FocusEvent[]; denominatorSpins: number }>,
  limit = 40,
): void {
  lines.push(`\n## ${title}`);
  lines.push("| key | summary + SP100 | avg distance | avg recentZ | avg stability |");
  lines.push("|---|---:|---:|---:|---:|");
  for (const row of rows.slice(0, limit)) {
    const summary = summarizeFocusEvents(row.events);
    lines.push(`| ${row.key} | \`${fmt(summary, row.denominatorSpins)}\` | ${average(row.events, (event) => event.distance).toFixed(2)} | ${average(row.events, (event) => event.recentZ).toFixed(2)} | ${average(row.events, (event) => event.primaryStability).toFixed(2)} |`);
  }
}

function focusRows(
  events: readonly FocusEvent[],
  keyFn: (event: FocusEvent) => string,
  denominatorFn: (rows: readonly FocusEvent[]) => number,
): Array<{ key: string; events: FocusEvent[]; denominatorSpins: number }> {
  return [...groupBy(events, keyFn).entries()]
    .map(([key, rows]) => ({ key, events: rows, denominatorSpins: denominatorFn(rows) }))
    .sort((left, right) => summarizeFocusEvents(right.events).net - summarizeFocusEvents(left.events).net);
}

function addStrategyComparison(lines: string[], results: readonly DatasetResult[], strategies: readonly Strategy[]): void {
  const [dataResult, historyResult] = results;
  const dataSpins = totalEligibleSpins(dataResult.sessions);
  const historySpins = totalEligibleSpins(historyResult.sessions);
  const latestDataSpins = totalEligibleSpins(dataResult.sessions.slice(-10));
  const latestHistorySpins = totalEligibleSpins(historyResult.sessions.slice(-10));
  lines.push("\n## Focus Strategy Comparison");
  lines.push("| strategy | why | data_2026 | history | latest data_2026 | latest history |");
  lines.push("|---|---|---:|---:|---:|---:|");
  for (const strategyId of FOCUS_DEEP_DIVE_IDS) {
    const strategy = strategies.find((item) => item.id === strategyId);
    const data = dataResult.summaries.get(strategyId);
    const history = historyResult.summaries.get(strategyId);
    const latestData = dataResult.latest10.get(strategyId);
    const latestHistory = historyResult.latest10.get(strategyId);
    if (!strategy || !data || !history || !latestData || !latestHistory) continue;
    lines.push(`| ${strategyId} | ${strategy.description} | \`${fmt(data, dataSpins)}\` | \`${fmt(history, historySpins)}\` | \`${fmt(latestData, latestDataSpins)}\` | \`${fmt(latestHistory, latestHistorySpins)}\` |`);
  }
}

interface FocusRefinement {
  description: string;
  id: string;
  keep: (event: FocusEvent) => boolean;
}

const FOCUS_REFINEMENTS: FocusRefinement[] = [
  { id: "original", description: "Original target rule.", keep: () => true },
  { id: "recentZ-1-to-2", description: "Keep recent 160 z in [1.0, 2.0). Avoid weak and overheated sectors.", keep: (event) => event.recentZ >= 1 && event.recentZ < 2 },
  { id: "recentZ-under-2", description: "Drop overheated recent 160 sectors, keep z<2.0.", keep: (event) => event.recentZ < 2 },
  { id: "recentZ-at-least-1", description: "Require recent 160 z>=1.0.", keep: (event) => event.recentZ >= 1 },
  { id: "position-200-399", description: "Only first 200 live spins after the ROI boundary.", keep: (event) => event.position >= 200 && event.position <= 399 },
  { id: "recentZ-1-to-2-position-200-399", description: "recentZ in [1,2) and position 200-399.", keep: (event) => event.recentZ >= 1 && event.recentZ < 2 && event.position >= 200 && event.position <= 399 },
  { id: "distance-0-or-3", description: "Keep only exact alignment or outer edge distance 3.", keep: (event) => event.distance === 0 || event.distance === 3 },
  { id: "distance-not-1", description: "Drop distance 1, which was weak in both datasets.", keep: (event) => event.distance !== 1 },
  { id: "stability-0p70-plus", description: "Only highly stable table profiles.", keep: (event) => event.primaryStability >= 0.7 },
  { id: "not-multi-core", description: "Drop multi-core table type.", keep: (event) => event.tableType !== "multi-core" },
];
const FOCUS_REFINEMENT_YEAR_IDS = new Set(["original", "recentZ-1-to-2", "position-200-399", "recentZ-1-to-2-position-200-399"]);

function addRefinementCrossReport(lines: string[], results: readonly DatasetResult[]): void {
  const [dataResult, historyResult] = results;
  const dataEvents = dataResult.focusEvents.filter((event) => event.strategyId === FOCUS_STRATEGY_ID);
  const historyEvents = historyResult.focusEvents.filter((event) => event.strategyId === FOCUS_STRATEGY_ID);
  const dataSpins = totalEligibleSpins(dataResult.sessions);
  const historySpins = totalEligibleSpins(historyResult.sessions);
  lines.push("\n## Target Refinement Candidates");
  lines.push("| filter | why | data_2026 | history |");
  lines.push("|---|---|---:|---:|");
  for (const refinement of FOCUS_REFINEMENTS) {
    const dataRows = dataEvents.filter(refinement.keep);
    const historyRows = historyEvents.filter(refinement.keep);
    lines.push(`| ${refinement.id} | ${refinement.description} | \`${fmt(summarizeFocusEvents(dataRows), dataSpins)}\` | \`${fmt(summarizeFocusEvents(historyRows), historySpins)}\` |`);
  }
}

function addRefinementYearReport(lines: string[], results: readonly DatasetResult[]): void {
  lines.push("\n## Selected Refinements By Year");
  lines.push("| dataset | filter | year | summary + SP100 |");
  lines.push("|---|---|---:|---:|");
  for (const result of results) {
    const dataset = path.basename(result.filePath);
    const targetEvents = result.focusEvents.filter((event) => event.strategyId === FOCUS_STRATEGY_ID);
    const sessionsByYear = groupBy(result.sessions, (session) => yearOf(session.updatedAt));
    for (const refinement of FOCUS_REFINEMENTS.filter((item) => FOCUS_REFINEMENT_YEAR_IDS.has(item.id))) {
      const rowsByYear = [...groupBy(targetEvents.filter(refinement.keep), (event) => yearOf(event.sessionUpdatedAt)).entries()]
        .sort(([left], [right]) => left.localeCompare(right));
      for (const [year, rows] of rowsByYear) {
        lines.push(`| ${dataset} | ${refinement.id} | ${year} | \`${fmt(summarizeFocusEvents(rows), totalEligibleSpins(sessionsByYear.get(year) ?? []))}\` |`);
      }
    }
  }
}

function addTargetDatasetDeepDive(lines: string[], result: DatasetResult): void {
  const dataset = path.basename(result.filePath);
  const targetEvents = result.focusEvents.filter((event) => event.strategyId === FOCUS_STRATEGY_ID);
  const sessionsById = sessionMap(result.sessions);
  const denominatorSpins = totalEligibleSpins(result.sessions);
  const activeDenominator = (rows: readonly FocusEvent[]) => activeEligibleSpins(rows, sessionsById);
  const sessionsByYear = groupBy(result.sessions, (session) => yearOf(session.updatedAt));
  const latestSessions = result.sessions.slice(-10);
  const latestIds = new Set(latestSessions.map((session) => session.id));

  lines.push(`\n# Dataset Deep Dive: ${dataset}`);
  lines.push(`- target strategy: \`${FOCUS_STRATEGY_ID}\``);
  lines.push(`- eligible post-200 spins: ${denominatorSpins}`);
  lines.push(`- target overall: \`${fmt(summarizeFocusEvents(targetEvents), denominatorSpins)}\``);

  const yearRows = [...groupBy(targetEvents, (event) => yearOf(event.sessionUpdatedAt)).entries()]
    .map(([year, rows]) => ({ key: year, events: rows, denominatorSpins: totalEligibleSpins(sessionsByYear.get(year) ?? []) }))
    .sort((left, right) => left.key.localeCompare(right.key));
  addFocusSummaryRows(lines, `${dataset} / By Year`, yearRows, 20);

  addFocusSummaryRows(lines, `${dataset} / By Table Type`, focusRows(targetEvents, (event) => event.tableType, activeDenominator), 20);
  addFocusSummaryRows(lines, `${dataset} / By Assignment Level`, focusRows(targetEvents, (event) => event.assignmentLevel, activeDenominator), 20);
  addFocusSummaryRows(lines, `${dataset} / By Distance`, focusRows(targetEvents, (event) => String(event.distance), activeDenominator), 20);
  addFocusSummaryRows(lines, `${dataset} / By Recent Z`, focusRows(targetEvents, (event) => zBucket(event.recentZ), activeDenominator), 20);
  addFocusSummaryRows(lines, `${dataset} / By Table Top1 Z`, focusRows(targetEvents, (event) => zBucket(event.tableTop1Z), activeDenominator), 20);
  addFocusSummaryRows(lines, `${dataset} / By Primary Stability`, focusRows(targetEvents, (event) => stabilityBucket(event.primaryStability), activeDenominator), 20);
  addFocusSummaryRows(lines, `${dataset} / By Table Numbers`, focusRows(targetEvents, (event) => tableNumbersBucket(event.tableNumbers), activeDenominator), 20);
  addFocusSummaryRows(lines, `${dataset} / By Position Bucket`, focusRows(targetEvents, (event) => positionBucket(event.position), activeDenominator), 20);
  addFocusSummaryRows(lines, `${dataset} / By Venue`, focusRows(targetEvents, (event) => event.venueKey, activeDenominator), 20);

  lines.push(`\n## ${dataset} / Latest 10 Sessions`);
  lines.push("| # | date | name | spins | summary + SP100 | avg distance | avg recentZ |");
  lines.push("|---:|---|---|---:|---:|---:|---:|");
  latestSessions.forEach((session, index) => {
    const rows = targetEvents.filter((event) => event.sessionId === session.id);
    lines.push(`| ${index + 1} | ${session.updatedAt.slice(0, 10)} | ${session.name} | ${eligibleSpins(session)} | \`${fmt(summarizeFocusEvents(rows), eligibleSpins(session))}\` | ${average(rows, (event) => event.distance).toFixed(2)} | ${average(rows, (event) => event.recentZ).toFixed(2)} |`);
  });

  const latestEvents = targetEvents.filter((event) => latestIds.has(event.sessionId));
  addFocusSummaryRows(lines, `${dataset} / Latest 10 By Distance`, focusRows(latestEvents, (event) => String(event.distance), activeDenominator), 20);

  const sessionRows = [...groupBy(targetEvents, (event) => event.sessionId).entries()]
    .map(([sessionId, rows]) => {
      const session = sessionsById.get(sessionId);
      return {
        key: `${session?.updatedAt.slice(0, 10) ?? ""} / ${session?.name ?? sessionId}`,
        events: rows,
        denominatorSpins: session ? eligibleSpins(session) : activeDenominator(rows),
      };
    });
  addFocusSummaryRows(lines, `${dataset} / Top Winning Sessions`, sessionRows.sort((left, right) => summarizeFocusEvents(right.events).net - summarizeFocusEvents(left.events).net), 15);
  addFocusSummaryRows(lines, `${dataset} / Worst Losing Sessions`, sessionRows.sort((left, right) => summarizeFocusEvents(left.events).net - summarizeFocusEvents(right.events).net), 15);
}

function writeFocusedDeepDiveReport(results: readonly DatasetResult[], strategies: readonly Strategy[]): void {
  const lines: string[] = [];
  lines.push("# Table Feature Resonance Deep Dive");
  lines.push("");
  lines.push(`Target: \`${FOCUS_STRATEGY_ID}\``);
  lines.push("");
  lines.push("Meaning: current 160-spin top wheel sector is within 3 wheel slots of the table profile top-1 sector center, recent sector z>=0.5, and the signal bets the current recent sector center 3 numbers.");
  lines.push("");
  lines.push("No-future rule: table profile uses only prior sessions; current spin features use only the prefix before the result.");
  addStrategyComparison(lines, results, strategies);
  addRefinementCrossReport(lines, results);
  addRefinementYearReport(lines, results);
  for (const result of results) {
    addTargetDatasetDeepDive(lines, result);
  }

  const outPath = path.join(OUT_DIR, "table-feature-resonance-deep-dive.md");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

function writeReport(results: readonly DatasetResult[], strategies: readonly Strategy[]): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const [dataResult, historyResult] = results;
  const dataSpins = totalEligibleSpins(dataResult.sessions);
  const historySpins = totalEligibleSpins(historyResult.sessions);
  const rows = crossRows(results, strategies);
  const lines: string[] = [];

  lines.push("# Table Feature Broad Search");
  lines.push("");
  lines.push(`Strategies searched: ${strategies.length}`);
  lines.push("No-future rule: each session uses only prior sessions for automatic table profiles; each spin uses only the current prefix before the result.");
  lines.push("Search goal: prefer rules with positive cross-dataset ROI, decent SP100, more active sessions, lower top10 concentration, and lower gini.");
  lines.push("");
  lines.push(`- data_2026.6.11 eligible post-200 spins: ${dataSpins}`);
  lines.push(`- history_data eligible post-200 spins: ${historySpins}`);

  const balanced = rows
    .filter((row) => row.data.signals >= 100 && row.history.signals >= 60)
    .filter((row) => sp100(row.data, dataSpins) >= 2 && sp100(row.history, historySpins) >= 2)
    .filter((row) => row.data.activeSessions >= 18 && row.history.activeSessions >= 12)
    .filter((row) => Math.max(row.data.top10SignalShare, row.history.top10SignalShare) <= 70)
    .sort((left, right) => right.score - left.score);
  addRows(lines, "Balanced Candidates (Uniformity First)", balanced, dataSpins, historySpins, 30);

  const positiveBalanced = balanced
    .filter((row) => Math.min(row.data.roi, row.history.roi) > 0)
    .sort((left, right) => right.score - left.score);
  addRows(lines, "Positive Balanced Candidates", positiveBalanced, dataSpins, historySpins, 30);

  const lowConcentrationPositive = rows
    .filter((row) => Math.min(row.data.roi, row.history.roi) > 0)
    .filter((row) => Math.max(row.data.top10SignalShare, row.history.top10SignalShare) <= 55)
    .filter((row) => Math.min(row.data.activeSessions, row.history.activeSessions) >= 12)
    .sort((left, right) => right.score - left.score);
  addRows(lines, "Lowest Concentration Positive Candidates", lowConcentrationPositive, dataSpins, historySpins, 30);

  const topRoi = rows
    .filter((row) => row.data.signals >= 20 && row.history.signals >= 20)
    .sort((left, right) => Math.min(right.data.roi, right.history.roi) - Math.min(left.data.roi, left.history.roi));
  addRows(lines, "Top ROI Candidates (May Be Concentrated)", topRoi, dataSpins, historySpins, 30);

  const familyRows = [...new Set(strategies.map((strategy) => strategy.family))]
    .map((family) => {
      const familyRowsInner = rows.filter((row) => row.strategy.family === family);
      return familyRowsInner.sort((left, right) => right.score - left.score)[0];
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row))
    .sort((left, right) => right.score - left.score);
  addRows(lines, "Best Per Family", familyRows, dataSpins, historySpins, 20);

  addLatestRows(lines, "Latest 10 For Positive Balanced", positiveBalanced, totalEligibleSpins(dataResult.sessions.slice(-10)), totalEligibleSpins(historyResult.sessions.slice(-10)), 20);

  const outPath = path.join(OUT_DIR, "table-feature-broad-search.md");
  fs.writeFileSync(outPath, `${lines.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

const strategies = buildStrategies();
const results: DatasetResult[] = [];
for (const filePath of DATASETS) {
  console.log(`Running ${path.relative(ROOT, filePath)}...`);
  results.push(runDataset(filePath, strategies));
}
writeReport(results, strategies);
writeFocusedDeepDiveReport(results, strategies);
