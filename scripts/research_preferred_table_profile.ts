import fs from "node:fs";
import path from "node:path";
import { buildAutoTableProfileState } from "../app/src/core/autoTableProfile";
import {
  buildTableProfiles,
  matchTableProfile,
  type TableMatch,
  type TableProfile,
  type TableProfileSession,
  type TableProfileTable,
} from "../app/src/core/tableHotProfile";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const ROI_START = 200;
const PAPER_WINDOW = 37;
const MIN_PAPER_HITS = 2;
const PICK_COUNT = 2;
const COOLDOWN = 3;
const PAY = 36;
const ZONE_WINDOW = 37;
const ZONE_RADIUS = 4;
const ZONE_MIN_HITS = 8;

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_INDEX = new Map<RouletteNumber, number>(WHEEL_ORDER.map((num, index) => [num, index]));

interface RawHistoryRow {
  Name?: string;
  Numbers?: string | number[];
  SaveTime?: string;
}

interface Session {
  id: string;
  name: string;
  numbers: RouletteNumber[];
  updatedAt: string;
  importIndex: number;
  sortDate: string;
  sortMinute: number;
  sourceIndex: number;
  manualTableId?: string;
}

type ProfileMode = "none" | "manual-auto-match" | "manual-forced-current" | "auto-only";
type GateSource = "base" | "variant";

interface VariantConfig {
  name: string;
  kind: "baseline" | "support-filter" | "reject-conflict" | "transition-filter" | "transition-blend" | "table-only" | "sector-rerank";
  gateSource: GateSource;
  keepUnknown?: boolean;
  minMatch?: "probable" | "confirmed";
  maxRank?: number;
  minZ?: number;
  conflictRank?: number;
  conflictZ?: number;
  postConflictRank?: number;
  postConflictZ?: number;
  postMaxRank?: number;
  postMinZ?: number;
  tableTop?: number;
  minPrevTransitions?: number;
  alpha?: number;
  beta?: number;
}

interface TableTransitionStats {
  counts: number[][];
  totals: number[];
}

interface ProfileContext {
  profiles: TableProfile[];
  tables: TableProfileTable[];
  transitionsByTable: Map<string, TableTransitionStats>;
}

interface BetEvent {
  sessionId: string;
  sessionName: string;
  tableId?: string;
  index: number;
  picks: RouletteNumber[];
  result: RouletteNumber;
  bet: number;
  win: number;
  hit: boolean;
}

interface Summary {
  signals: number;
  bet: number;
  win: number;
  net: number;
  hits: number;
  roi: number;
  wr: number;
  dd: number;
  sessionsWithSignals: number;
  positiveSessions: number;
  negativeSessions: number;
  worstSession: number;
  bestSession: number;
}

const MANUAL_WZS_TABLE_BY_NAME = new Map<string, string>([
  ["wzs-2026-04-06-703", "macau_wynn_01"],
  ["wzs-2026-05-11-802", "macau_wynn_01"],
  ["wzs-2026-05-11-803", "macau_wynn_01"],

  ["wzs-2026-04-06-702", "macau_wynn_02"],
  ["wzs-2026-05-11-807", "macau_wynn_02"],
  ["wzs-2026-05-11-809", "macau_wynn_02"],

  ["wzs-2026-04-06-701", "macau_wynn_03"],
  ["wzs-2026-05-11-804", "macau_wynn_03"],
  ["wzs-2026-05-11-806", "macau_wynn_03"],
  ["wzs-2026-05-11-808", "macau_wynn_03"],
  ["wzs-2026-05-11-810", "macau_wynn_03"],
]);

const MANUAL_COMPACT_TABLE_BY_PREFIX = new Map<string, string>([
  ["20260601-1630", "macau_wynn_01"],
  ["20260602-0018", "macau_wynn_01"],
  ["20260604-1630", "macau_wynn_01"],

  ["20260603-0030", "macau_wynn_02"],
  ["20260603-2101", "macau_wynn_02"],
  ["20260604-2223", "macau_wynn_02"],
  ["20260605-0230", "macau_wynn_02"],

  ["20260409", "macau_wynn_03"],
  ["20260603-0230", "macau_wynn_03"],
  ["20260606-0131", "macau_wynn_03"],
  ["20260607-0217", "macau_wynn_03"],
]);

const TABLES: TableProfileTable[] = [
  { id: "macau_wynn_01", name: "macau_wynn_01", parentId: "macau_wynn" },
  { id: "macau_wynn_02", name: "macau_wynn_02", parentId: "macau_wynn" },
  { id: "macau_wynn_03", name: "macau_wynn_03", parentId: "macau_wynn" },
];

const BASE_VARIANTS: VariantConfig[] = [
  { name: "baseline", kind: "baseline", gateSource: "base" },
  { name: "support<=6 z>=0.35 keepUnknown", kind: "support-filter", gateSource: "base", keepUnknown: true, maxRank: 6, minZ: 0.35 },
  { name: "support<=6 z>=0.35 matchOnly", kind: "support-filter", gateSource: "base", keepUnknown: false, maxRank: 6, minZ: 0.35 },
  { name: "strong<=3 z>=1 keepUnknown", kind: "support-filter", gateSource: "base", keepUnknown: true, maxRank: 3, minZ: 1 },
  { name: "strong<=3 z>=1 matchOnly", kind: "support-filter", gateSource: "base", keepUnknown: false, maxRank: 3, minZ: 1 },
  { name: "reject conflict keepUnknown", kind: "reject-conflict", gateSource: "base", keepUnknown: true, conflictRank: 30, conflictZ: -0.35 },
  { name: "transition filter top6", kind: "transition-filter", gateSource: "base", keepUnknown: true, tableTop: 6, minPrevTransitions: 2 },
  { name: "transition filter top4", kind: "transition-filter", gateSource: "base", keepUnknown: true, tableTop: 4, minPrevTransitions: 3 },
  { name: "table only min3", kind: "table-only", gateSource: "variant", keepUnknown: true, minPrevTransitions: 3 },
  { name: "table only min5", kind: "table-only", gateSource: "variant", keepUnknown: true, minPrevTransitions: 5 },
  { name: "blend alpha2", kind: "transition-blend", gateSource: "variant", keepUnknown: true, minPrevTransitions: 2, alpha: 2 },
  { name: "blend alpha4", kind: "transition-blend", gateSource: "variant", keepUnknown: true, minPrevTransitions: 2, alpha: 4 },
  { name: "blend alpha4 + reject conflict", kind: "transition-blend", gateSource: "variant", keepUnknown: true, minPrevTransitions: 2, alpha: 4, postConflictRank: 30, postConflictZ: -0.35 },
  { name: "blend alpha4 + loose support", kind: "transition-blend", gateSource: "variant", keepUnknown: true, minPrevTransitions: 2, alpha: 4, postMaxRank: 16, postMinZ: -0.2 },
  { name: "blend alpha4 min5", kind: "transition-blend", gateSource: "variant", keepUnknown: true, minPrevTransitions: 5, alpha: 4 },
  { name: "blend alpha4 min8", kind: "transition-blend", gateSource: "variant", keepUnknown: true, minPrevTransitions: 8, alpha: 4 },
  { name: "sector rerank beta0.6", kind: "sector-rerank", gateSource: "variant", keepUnknown: true, beta: 0.6 },
  { name: "sector rerank beta1.0", kind: "sector-rerank", gateSource: "variant", keepUnknown: true, beta: 1.0 },
];

const SCAN_VARIANTS: VariantConfig[] = [
  ...BASE_VARIANTS,
  ...[4, 6, 8, 10, 12, 16].flatMap((rank) =>
    [-0.2, 0, 0.2, 0.35, 0.6].map((z) => ({
      name: `scan matchOnly rank<=${rank} z>=${z}`,
      kind: "support-filter" as const,
      gateSource: "base" as const,
      keepUnknown: false,
      maxRank: rank,
      minZ: z,
    })),
  ),
  ...[4, 6, 8, 10, 12].flatMap((top) =>
    [2, 3, 5, 8].map((minPrev) => ({
      name: `scan transFilter top${top} min${minPrev}`,
      kind: "transition-filter" as const,
      gateSource: "base" as const,
      keepUnknown: true,
      tableTop: top,
      minPrevTransitions: minPrev,
    })),
  ),
  ...[1, 2, 4, 8, 12].map((alpha) => ({
    name: `scan blend alpha${alpha}`,
    kind: "transition-blend" as const,
    gateSource: "variant" as const,
    keepUnknown: true,
    minPrevTransitions: 2,
    alpha,
  })),
  ...[1, 2, 4, 8, 12].map((alpha) => ({
    name: `scan blend alpha${alpha} reject`,
    kind: "transition-blend" as const,
    gateSource: "variant" as const,
    keepUnknown: true,
    minPrevTransitions: 2,
    alpha,
    postConflictRank: 30,
    postConflictZ: -0.35,
  })),
  ...[2, 3, 5, 8, 12].map((minPrev) => ({
    name: `scan blend alpha4 min${minPrev}`,
    kind: "transition-blend" as const,
    gateSource: "variant" as const,
    keepUnknown: true,
    minPrevTransitions: minPrev,
    alpha: 4,
  })),
];

function manualTableForName(name: string): string | undefined {
  const exact = MANUAL_WZS_TABLE_BY_NAME.get(name);
  if (exact) return exact;
  for (const [prefix, tableId] of MANUAL_COMPACT_TABLE_BY_PREFIX) {
    if (name === prefix || name.startsWith(`${prefix}-`)) return tableId;
  }
  return undefined;
}

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
}

function parseSortInfo(name: string, saveTime: string | undefined, sourceIndex: number): { date: string; minute: number } {
  const wzs = name.match(/^wzs-(\d{4})-(\d{2})-(\d{2})-(\d+)/u);
  const fallback = String(saveTime ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/u);
  if (fallback) {
    return {
      date: `${fallback[1]}-${fallback[2]}-${fallback[3]}`,
      minute: Number(fallback[4] ?? "12") * 60 + Number(fallback[5] ?? "00"),
    };
  }
  if (wzs) return { date: `${wzs[1]}-${wzs[2]}-${wzs[3]}`, minute: 12 * 60 };

  const compact = name.match(/^(\d{8})-(\d{4})/u);
  if (compact) {
    const rawDate = compact[1];
    const rawTime = compact[2];
    return {
      date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
      minute: Number(rawTime.slice(0, 2)) * 60 + Number(rawTime.slice(2, 4)),
    };
  }
  const compactDate = name.match(/^(\d{8})/u);
  if (compactDate) {
    const rawDate = compactDate[1];
    return { date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`, minute: 12 * 60 };
  }
  return { date: "9999-12-31", minute: sourceIndex };
}

function makeUpdatedAt(sortDate: string, sortMinute: number, ordinal: number): string {
  const [year, month, day] = sortDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, Math.floor(sortMinute / 60), sortMinute % 60, ordinal % 60)).toISOString();
}

function loadSessions(): Session[] {
  const rows = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex) => {
      const name = String(row.Name ?? `session-${sourceIndex + 1}`);
      const { date, minute } = parseSortInfo(name, row.SaveTime, sourceIndex);
      return {
        id: `s${sourceIndex}`,
        name,
        numbers: parseNumbers(row.Numbers),
        updatedAt: makeUpdatedAt(date, minute, sourceIndex),
        importIndex: sourceIndex,
        sortDate: date,
        sortMinute: minute,
        sourceIndex,
        manualTableId: manualTableForName(name),
      };
    })
    .sort((left, right) =>
      left.sortDate.localeCompare(right.sortDate)
      || left.sortMinute - right.sortMinute
      || left.sourceIndex - right.sourceIndex,
    );
}

function createTransitionCounts(): number[][] {
  return Array.from({ length: 37 }, () => Array(37).fill(0));
}

function addTransition(counts: number[][], from: RouletteNumber, to: RouletteNumber): void {
  counts[from][to] += 1;
}

function topNumbersFromScores(scores: readonly number[], count: number): RouletteNumber[] {
  return scores
    .map((score, number) => ({ score, number: number as RouletteNumber }))
    .sort((left, right) => right.score - left.score || left.number - right.number)
    .slice(0, count)
    .map((item) => item.number);
}

function getMarkovTopNumbers(counts: readonly number[][], previous: RouletteNumber, count = PICK_COUNT): RouletteNumber[] {
  return topNumbersFromScores(counts[previous], count);
}

function wheelDistance(a: RouletteNumber, b: RouletteNumber): number {
  const left = WHEEL_INDEX.get(a) ?? 0;
  const right = WHEEL_INDEX.get(b) ?? 0;
  const diff = Math.abs(left - right);
  return Math.min(diff, WHEEL_ORDER.length - diff);
}

function countRecentZoneHits(numbers: readonly RouletteNumber[], nextIndex: number, center: RouletteNumber): number {
  const start = Math.max(0, nextIndex - ZONE_WINDOW);
  let hits = 0;
  for (let index = start; index < nextIndex; index += 1) {
    if (wheelDistance(numbers[index], center) <= ZONE_RADIUS) hits += 1;
  }
  return hits;
}

function countRecentPaperHits(paperHits: readonly boolean[]): number {
  return paperHits.slice(-PAPER_WINDOW).filter(Boolean).length;
}

function canBetFromPaper(paperHits: readonly boolean[]): boolean {
  return paperHits.length >= PAPER_WINDOW && countRecentPaperHits(paperHits) >= MIN_PAPER_HITS;
}

function canBetFromZone(zoneHits: number): boolean {
  return zoneHits >= ZONE_MIN_HITS;
}

function hasMinMatch(match: TableMatch, minMatch?: "probable" | "confirmed"): boolean {
  if (!minMatch) return match.level === "probable" || match.level === "confirmed";
  if (minMatch === "confirmed") return match.level === "confirmed";
  return match.level === "probable" || match.level === "confirmed";
}

function sectorSupport(profile: TableProfile, number: RouletteNumber): { rank: number; z: number } {
  const wheelIndex = WHEEL_INDEX.get(number) ?? 0;
  const centeredStart = (wheelIndex - 3 + WHEEL_ORDER.length) % WHEEL_ORDER.length;
  const ranked = profile.sectorCounts
    .map((count, start) => ({ start, count }))
    .sort((left, right) => right.count - left.count || left.start - right.start);
  const rank = ranked.findIndex((item) => item.start === centeredStart) + 1;
  const count = profile.sectorCounts[centeredStart] ?? 0;
  const total = profile.totalNumbers;
  const p = 7 / 37;
  const variance = total * p * (1 - p);
  return {
    rank: rank > 0 ? rank : 37,
    z: variance > 0 ? (count - total * p) / Math.sqrt(variance) : 0,
  };
}

function makeTransitionStats(profileSessions: readonly TableProfileSession[]): Map<string, TableTransitionStats> {
  const result = new Map<string, TableTransitionStats>();
  for (const session of profileSessions) {
    if (!session.tableId) continue;
    let stats = result.get(session.tableId);
    if (!stats) {
      stats = { counts: createTransitionCounts(), totals: Array(37).fill(0) };
      result.set(session.tableId, stats);
    }
    for (let index = 1; index < session.numbers.length; index += 1) {
      const from = session.numbers[index - 1];
      const to = session.numbers[index];
      stats.counts[from][to] += 1;
      stats.totals[from] += 1;
    }
  }
  return result;
}

function makeProfileContext(priorSessions: readonly Session[], mode: ProfileMode): ProfileContext {
  if (mode === "none") return { profiles: [], tables: TABLES, transitionsByTable: new Map() };

  let profileSessions: TableProfileSession[] = [];
  let tables: TableProfileTable[] = TABLES;
  if (mode === "auto-only") {
    const state = buildAutoTableProfileState(priorSessions.map((session) => ({
      id: session.id,
      name: session.name,
      numbers: session.numbers,
      updatedAt: session.updatedAt,
      importIndex: session.importIndex,
    })));
    profileSessions = state.profileSessions;
    tables = state.tables;
  } else {
    profileSessions = priorSessions
      .filter((session) => session.manualTableId)
      .map((session) => ({
        id: session.id,
        name: session.name,
        numbers: session.numbers,
        tableId: session.manualTableId,
      }));
  }

  return {
    profiles: buildTableProfiles(profileSessions, tables),
    tables,
    transitionsByTable: makeTransitionStats(profileSessions),
  };
}

function choosePicks(
  config: VariantConfig,
  basePicks: readonly RouletteNumber[],
  replayCounts: readonly number[][],
  previous: RouletteNumber,
  match: TableMatch,
  context: ProfileContext,
): RouletteNumber[] {
  const applyPostFilters = (picks: RouletteNumber[]): RouletteNumber[] => {
    if (!match.profile || !hasMinMatch(match, config.minMatch)) return picks;
    return picks.filter((number) => {
      const support = sectorSupport(match.profile as TableProfile, number);
      if (
        config.postConflictRank !== undefined
        && config.postConflictZ !== undefined
        && support.rank >= config.postConflictRank
        && support.z <= config.postConflictZ
      ) {
        return false;
      }
      if (
        config.postMaxRank !== undefined
        && support.rank > config.postMaxRank
      ) {
        return false;
      }
      if (
        config.postMinZ !== undefined
        && support.z < config.postMinZ
      ) {
        return false;
      }
      return true;
    });
  };

  if (config.kind === "baseline") return applyPostFilters([...basePicks]);

  const profile = match.profile;
  const matched = Boolean(profile && hasMinMatch(match, config.minMatch));
  if (!profile || !matched) {
    return config.keepUnknown ? [...basePicks] : [];
  }

  if (config.kind === "support-filter") {
    return applyPostFilters(basePicks.filter((number) => {
      const support = sectorSupport(profile, number);
      return support.rank <= (config.maxRank ?? 6) && support.z >= (config.minZ ?? 0.35);
    }));
  }

  if (config.kind === "reject-conflict") {
    return applyPostFilters(basePicks.filter((number) => {
      const support = sectorSupport(profile, number);
      return !(support.rank >= (config.conflictRank ?? 30) && support.z <= (config.conflictZ ?? -0.35));
    }));
  }

  const tableTransitions = context.transitionsByTable.get(profile.tableId);
  const prevTotal = tableTransitions?.totals[previous] ?? 0;
  if (!tableTransitions || prevTotal < (config.minPrevTransitions ?? 0)) {
    return config.keepUnknown ? [...basePicks] : [];
  }

  if (config.kind === "transition-filter") {
    const top = new Set(getMarkovTopNumbers(tableTransitions.counts, previous, config.tableTop ?? 6));
    return applyPostFilters(basePicks.filter((number) => top.has(number)));
  }

  if (config.kind === "table-only") {
    return applyPostFilters(getMarkovTopNumbers(tableTransitions.counts, previous, PICK_COUNT));
  }

  if (config.kind === "transition-blend") {
    const alpha = config.alpha ?? 2;
    const scores = Array.from({ length: 37 }, (_, number) =>
      replayCounts[previous][number] + alpha * (tableTransitions.counts[previous][number] / prevTotal),
    );
    return applyPostFilters(topNumbersFromScores(scores, PICK_COUNT));
  }

  if (config.kind === "sector-rerank") {
    const beta = config.beta ?? 0.6;
    const scores = Array.from({ length: 37 }, (_, number) => {
      const support = sectorSupport(profile, number as RouletteNumber);
      return replayCounts[previous][number] + beta * Math.max(-1.5, Math.min(2.5, support.z));
    });
    return applyPostFilters(topNumbersFromScores(scores, PICK_COUNT));
  }

  return applyPostFilters([...basePicks]);
}

function replaySession(
  session: Session,
  context: ProfileContext,
  mode: ProfileMode,
  config: VariantConfig,
): BetEvent[] {
  const replayCounts = createTransitionCounts();
  const basePaperHits: boolean[] = [];
  const variantPaperHits: boolean[] = [];
  const events: BetEvent[] = [];
  let cooldown = 0;

  for (let index = 1; index < session.numbers.length; index += 1) {
    const previous = session.numbers[index - 1];
    const result = session.numbers[index];
    const prefix = session.numbers.slice(0, index);
    const forcedTableId = mode === "manual-forced-current" ? session.manualTableId : undefined;
    const match = matchTableProfile(prefix, context.profiles, forcedTableId);
    const basePicks = getMarkovTopNumbers(replayCounts, previous, PICK_COUNT);
    const picks = choosePicks(config, basePicks, replayCounts, previous, match, context);
    const zoneHits = countRecentZoneHits(session.numbers, index, previous);
    const paperGate = config.gateSource === "base" ? basePaperHits : variantPaperHits;
    const shouldBet = cooldown <= 0 && picks.length > 0 && canBetFromPaper(paperGate) && canBetFromZone(zoneHits);

    if (cooldown > 0) {
      cooldown -= 1;
    } else if (shouldBet) {
      const hit = picks.includes(result);
      if (index >= ROI_START) {
        events.push({
          sessionId: session.id,
          sessionName: session.name,
          tableId: session.manualTableId,
          index,
          picks: [...picks],
          result,
          bet: picks.length,
          win: hit ? PAY : 0,
          hit,
        });
      }
      cooldown = hit ? 0 : COOLDOWN;
    }

    basePaperHits.push(basePicks.includes(result));
    variantPaperHits.push(picks.includes(result));
    addTransition(replayCounts, previous, result);
  }

  return events;
}

function maxDrawdown(events: readonly BetEvent[]): number {
  let equity = 0;
  let peak = 0;
  let dd = 0;
  for (const event of events) {
    equity += event.win - event.bet;
    peak = Math.max(peak, equity);
    dd = Math.max(dd, peak - equity);
  }
  return dd;
}

function summarize(events: readonly BetEvent[], sessions: readonly Session[]): Summary {
  const bet = events.reduce((sum, event) => sum + event.bet, 0);
  const win = events.reduce((sum, event) => sum + event.win, 0);
  const hits = events.filter((event) => event.hit).length;
  const bySession = new Map<string, { bet: number; win: number }>();
  for (const event of events) {
    const row = bySession.get(event.sessionId) ?? { bet: 0, win: 0 };
    row.bet += event.bet;
    row.win += event.win;
    bySession.set(event.sessionId, row);
  }
  const nets = sessions.map((session) => {
    const row = bySession.get(session.id);
    return row ? row.win - row.bet : 0;
  });
  return {
    signals: events.length,
    bet,
    win,
    net: win - bet,
    hits,
    roi: bet > 0 ? ((win - bet) / bet) * 100 : 0,
    wr: events.length > 0 ? (hits / events.length) * 100 : 0,
    dd: maxDrawdown(events),
    sessionsWithSignals: [...bySession.values()].filter((row) => row.bet > 0).length,
    positiveSessions: nets.filter((net) => net > 0).length,
    negativeSessions: nets.filter((net) => net < 0).length,
    worstSession: Math.min(...nets, 0),
    bestSession: Math.max(...nets, 0),
  };
}

function replayWalkForward(sessions: readonly Session[], mode: ProfileMode, config: VariantConfig): { events: BetEvent[]; summary: Summary } {
  const events: BetEvent[] = [];
  for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
    const prior = sessions.slice(0, sessionIndex);
    const context = makeProfileContext(prior, mode);
    events.push(...replaySession(sessions[sessionIndex], context, mode, config));
  }
  return { events, summary: summarize(events, sessions) };
}

function replayWalkForwardWithTablePerformanceGate(
  sessions: readonly Session[],
  mode: ProfileMode,
  config: VariantConfig,
  minPriorBet: number,
  minPriorRoi: number,
  shadowUpdate: boolean,
): { events: BetEvent[]; summary: Summary } {
  const events: BetEvent[] = [];
  const tableStats = new Map<string, { bet: number; win: number }>();

  for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
    const session = sessions[sessionIndex];
    const prior = sessions.slice(0, sessionIndex);
    const context = makeProfileContext(prior, mode);
    const sessionEvents = replaySession(session, context, mode, config);
    const tableId = session.manualTableId ?? "unknown";
    const priorStats = tableStats.get(tableId) ?? { bet: 0, win: 0 };
    const priorRoi = priorStats.bet > 0 ? ((priorStats.win - priorStats.bet) / priorStats.bet) * 100 : 0;
    const allowed = priorStats.bet < minPriorBet || priorRoi >= minPriorRoi;

    if (allowed) {
      events.push(...sessionEvents);
    }

    if (allowed || shadowUpdate) {
      priorStats.bet += sessionEvents.reduce((sum, event) => sum + event.bet, 0);
      priorStats.win += sessionEvents.reduce((sum, event) => sum + event.win, 0);
      tableStats.set(tableId, priorStats);
    }
  }

  return { events, summary: summarize(events, sessions) };
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function printSummary(title: string, rows: Array<{ mode: ProfileMode; variant: string; summary: Summary }>): void {
  console.log(`\n## ${title}`);
  console.log("mode\tvariant\tsignals\tbet\tnet\tROI\thit%\tDD\tsess+\tsess-\tworst\tbest");
  for (const row of rows) {
    const s = row.summary;
    console.log([
      row.mode,
      row.variant,
      s.signals,
      s.bet,
      s.net,
      fmtPct(s.roi),
      fmtPct(s.wr),
      s.dd,
      s.positiveSessions,
      s.negativeSessions,
      s.worstSession,
      s.bestSession,
    ].join("\t"));
  }
}

function tableBreakdown(events: readonly BetEvent[]): void {
  const grouped = new Map<string, BetEvent[]>();
  for (const event of events) {
    const key = event.tableId ?? "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  console.log("table\tsignals\tbet\tnet\tROI\thit%");
  for (const [table, rows] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = summarize(rows, []);
    console.log([table, s.signals, s.bet, s.net, fmtPct(s.roi), fmtPct(s.wr)].join("\t"));
  }
}

function monthBreakdown(events: readonly BetEvent[], sessions: readonly Session[]): void {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const grouped = new Map<string, BetEvent[]>();
  for (const event of events) {
    const session = sessionById.get(event.sessionId);
    const key = session?.sortDate.slice(0, 7) ?? "unknown";
    grouped.set(key, [...(grouped.get(key) ?? []), event]);
  }
  console.log("month\tsignals\tbet\tnet\tROI\thit%");
  for (const [month, rows] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = summarize(rows, []);
    console.log([month, s.signals, s.bet, s.net, fmtPct(s.roi), fmtPct(s.wr)].join("\t"));
  }
}

function sessionBreakdown(events: readonly BetEvent[], sessions: readonly Session[]): void {
  const grouped = new Map<string, BetEvent[]>();
  for (const event of events) {
    grouped.set(event.sessionId, [...(grouped.get(event.sessionId) ?? []), event]);
  }
  console.log("session\ttable\tsignals\tbet\tnet\tROI");
  for (const session of sessions) {
    const rows = grouped.get(session.id) ?? [];
    const s = summarize(rows, [session]);
    console.log([session.name, session.manualTableId ?? "", s.signals, s.bet, s.net, fmtPct(s.roi)].join("\t"));
  }
}

const allSessions = loadSessions();
const target22 = allSessions.filter((session) => session.sortDate >= "2026-04-01" && session.sortDate < "2026-07-01");

console.log(`Loaded sessions: all=${allSessions.length}, target22=${target22.length}`);

const baselineAll = replayWalkForward(allSessions, "none", BASE_VARIANTS[0]).summary;
const baselineTarget = replayWalkForward(target22, "none", BASE_VARIANTS[0]).summary;
printSummary("Baseline reference", [
  { mode: "none", variant: "all76 baseline", summary: baselineAll },
  { mode: "none", variant: "target22 baseline", summary: baselineTarget },
]);

const selectedFullVariants = SCAN_VARIANTS.filter((variant) =>
  variant.name === "baseline"
  || variant.name === "scan transFilter top4 min8"
  || variant.name === "scan transFilter top6 min8"
  || variant.name === "scan transFilter top8 min8"
  || variant.name === "scan transFilter top12 min8"
  || variant.name === "scan blend alpha4"
  || variant.name === "scan blend alpha4 reject"
  || variant.name === "scan blend alpha4 min5"
  || variant.name === "scan blend alpha4 min8"
  || variant.name === "reject conflict keepUnknown",
);
const fullAutoRows = selectedFullVariants
  .map((variant) => ({ mode: "auto-only" as const, variant: variant.name, ...replayWalkForward(allSessions, "auto-only", variant) }))
  .sort((left, right) => right.summary.net - left.summary.net || right.summary.roi - left.summary.roi);
printSummary(
  "All76 walk-forward auto-only selected",
  fullAutoRows.map((row) => ({ mode: row.mode, variant: row.variant, summary: row.summary })),
);

for (const mode of ["manual-auto-match", "manual-forced-current", "auto-only"] as const) {
  const rows = SCAN_VARIANTS
    .map((variant) => ({ mode, variant: variant.name, ...replayWalkForward(target22, mode, variant) }))
    .sort((left, right) => right.summary.roi - left.summary.roi || right.summary.net - left.summary.net);
  printSummary(
    `Target22 walk-forward ${mode} top ROI`,
    rows.slice(0, 20).map((row) => ({ mode: row.mode, variant: row.variant, summary: row.summary })),
  );
  printSummary(
    `Target22 walk-forward ${mode} top net with bet>=500`,
    rows
      .filter((row) => row.summary.bet >= 500)
      .sort((left, right) => right.summary.net - left.summary.net || right.summary.roi - left.summary.roi)
      .slice(0, 12)
      .map((row) => ({ mode: row.mode, variant: row.variant, summary: row.summary })),
  );

  const interesting = rows
    .filter((row) => row.summary.bet >= 80)
    .sort((left, right) => right.summary.net - left.summary.net)[0] ?? rows[0];
  console.log(`\n### Detail: ${mode} / ${interesting.variant}`);
  monthBreakdown(interesting.events, target22);
  tableBreakdown(interesting.events);
  sessionBreakdown(interesting.events, target22);
}

const forcedBlend = SCAN_VARIANTS.find((variant) => variant.name === "scan blend alpha4");
if (forcedBlend) {
  const gateRows = [40, 80, 120, 160, 240].flatMap((minBet) =>
    [-10, 0, 5, 10].flatMap((minRoi) =>
      [false, true].map((shadowUpdate) => ({
        mode: "manual-forced-current" as const,
        variant: `blend alpha4 tablePerf minBet${minBet} roi>=${minRoi}${shadowUpdate ? " shadow" : ""}`,
        ...replayWalkForwardWithTablePerformanceGate(
          target22,
          "manual-forced-current",
          forcedBlend,
          minBet,
          minRoi,
          shadowUpdate,
        ),
      })),
    ),
  );
  printSummary(
    "Target22 manual-forced-current table performance gates",
    gateRows
      .sort((left, right) => right.summary.net - left.summary.net || right.summary.roi - left.summary.roi)
      .slice(0, 16)
      .map((row) => ({ mode: row.mode, variant: row.variant, summary: row.summary })),
  );
}
