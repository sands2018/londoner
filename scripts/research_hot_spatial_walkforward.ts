import fs from "node:fs";
import path from "node:path";
import { getHistoryDataIso, getHistoryDataTms } from "./historyTime";
import { analyzeHotNumbers, type HotNumberSignalEvent } from "../app/src/core/hotNumbers";
import { buildAutoTableProfileState, type AutoTableInputSession } from "../app/src/core/autoTableProfile";
import { buildTableProfiles, evaluateHotNumberTableSupport, type HotTableSupportLevel } from "../app/src/core/tableHotProfile";
import { inferSpatialVenueKey } from "../app/src/core/spatialTableClustering";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_DIR = path.join(ROOT, "HistoryData");
const ROI_START = 200;

interface RawHistoryRow {
  Name?: string;
  Numbers?: string | number[];
  Count?: number;
  SaveTime?: string;
  tms?: number;
  ImportIndex?: number;
}

interface Session extends AutoTableInputSession {
  sourceIndex: number;
}

interface AnnotatedHotEvent {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  venueKey: string;
  position: number;
  pick: RouletteNumber;
  result: RouletteNumber;
  hit: boolean;
  net: number;
  support: HotTableSupportLevel;
  tableId: string;
  tableName: string;
  tableSessionCount: number;
  tableTotalNumbers: number;
  matchLevel: string;
  similarity: number;
  rank: number | null;
  z: number;
}

interface Summary {
  signals: number;
  hits: number;
  bet: number;
  win: number;
  net: number;
  roi: number;
  wr: number;
  maxDrawdown: number;
  positiveSessions: number;
  activeSessions: number;
}

function historyPath(): string {
  const file = fs
    .readdirSync(HISTORY_DIR)
    .find((name) => name.startsWith("data_2026.6.11") && name.endsWith(".json"));
  if (!file) throw new Error("HistoryData/data_2026.6.11*.json not found");
  return path.join(HISTORY_DIR, file);
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

function loadSessions(): Session[] {
  const rows = JSON.parse(fs.readFileSync(historyPath(), "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex): Session => {
      const name = String(row.Name ?? `session-${sourceIndex + 1}`);
      return {
        id: `h${sourceIndex}`,
        sourceIndex,
        name,
        numbers: parseNumbers(row.Numbers),
        updatedAt: parseUpdatedAt(row, sourceIndex),
      updatedTms: getHistoryDataTms(row, sourceIndex),
        importIndex: row.ImportIndex ?? sourceIndex,
      };
    })
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

function eventNet(event: HotNumberSignalEvent): number {
  return event.hit ? 35 : -1;
}

function summarize(events: readonly AnnotatedHotEvent[]): Summary {
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let hits = 0;
  const bySession = new Map<string, number>();
  for (const event of events) {
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
    if (event.hit) hits += 1;
    bySession.set(event.sessionName, (bySession.get(event.sessionName) ?? 0) + event.net);
  }
  const bet = events.length;
  const win = hits * 36;
  const net = win - bet;
  return {
    signals: bet,
    hits,
    bet,
    win,
    net,
    roi: bet > 0 ? (net / bet) * 100 : 0,
    wr: bet > 0 ? (hits / bet) * 100 : 0,
    maxDrawdown,
    positiveSessions: [...bySession.values()].filter((value) => value > 0).length,
    activeSessions: bySession.size,
  };
}

function fmt(summary: Summary): string {
  return [
    `sig=${String(summary.signals).padStart(5)}`,
    `hit=${String(summary.hits).padStart(4)}`,
    `net=${String(summary.net).padStart(7)}`,
    `ROI=${summary.roi.toFixed(2).padStart(8)}%`,
    `WR=${summary.wr.toFixed(2).padStart(6)}%`,
    `DD=${String(summary.maxDrawdown).padStart(5)}`,
    `pos=${String(summary.positiveSessions).padStart(3)}/${String(summary.activeSessions).padEnd(3)}`,
  ].join(" ");
}

function buildPriorProfiles(prior: readonly Session[]) {
  const state = buildAutoTableProfileState(prior);
  return buildTableProfiles(state.profileSessions, state.tables);
}

function runWalkForward(sessions: readonly Session[]): AnnotatedHotEvent[] {
  const out: AnnotatedHotEvent[] = [];
  const prior: Session[] = [];

  for (const session of sessions) {
    const profiles = buildPriorProfiles(prior);
    const analysis = analyzeHotNumbers(session.numbers, ROI_START);
    for (const event of analysis.events) {
      const prefix = session.numbers.slice(0, event.position);
      const support = evaluateHotNumberTableSupport(prefix, event.signal.number, profiles);
      out.push({
        sessionId: session.id,
        sessionName: session.name,
        sessionDate: sessionDate(session),
        venueKey: inferSpatialVenueKey(session.name),
        position: event.position,
        pick: event.signal.number,
        result: session.numbers[event.position],
        hit: event.hit,
        net: eventNet(event),
        support: support.level,
        tableId: support.profile?.tableId ?? "",
        tableName: support.profile?.tableName ?? "",
        tableSessionCount: support.profile?.sessionCount ?? 0,
        tableTotalNumbers: support.profile?.totalNumbers ?? 0,
        matchLevel: support.match.level,
        similarity: support.match.similarity,
        rank: support.rank,
        z: support.z,
      });
    }
    prior.push(session);
  }

  return out;
}

function filterBetting(events: readonly AnnotatedHotEvent[]): AnnotatedHotEvent[] {
  return events.filter((event) => event.position >= ROI_START);
}

function filterByPlan(events: readonly AnnotatedHotEvent[], plan: string): AnnotatedHotEvent[] {
  if (plan === "strong") return events.filter((event) => event.support === "strong");
  if (plan === "support-only") return events.filter((event) => event.support === "support");
  if (plan === "support+") return events.filter((event) => event.support === "strong" || event.support === "support");
  if (plan === "watch+") return events.filter((event) => event.support === "strong" || event.support === "support" || event.support === "watch");
  if (plan === "reject-conflict") return events.filter((event) => event.support !== "conflict");
  if (plan === "known-nonconflict") return events.filter((event) => event.support === "strong" || event.support === "support" || event.support === "watch");
  return events;
}

function groupBy<T>(items: readonly T[], keyFn: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = map.get(key) ?? [];
    bucket.push(item);
    map.set(key, bucket);
  }
  return map;
}

function printPlanSet(title: string, events: readonly AnnotatedHotEvent[]): void {
  console.log(`\n=== ${title} ===`);
  for (const plan of ["baseline", "strong", "support-only", "support+", "watch+", "known-nonconflict", "reject-conflict"]) {
    const subset = filterByPlan(events, plan);
    console.log(`${plan.padEnd(18)} ${fmt(summarize(subset))}`);
  }
}

function printSupportBreakdown(title: string, events: readonly AnnotatedHotEvent[]): void {
  console.log(`\n=== ${title}: support level breakdown ===`);
  const grouped = groupBy(events, (event) => event.support);
  for (const level of ["strong", "support", "watch", "conflict", "unknown", "none"] as HotTableSupportLevel[]) {
    const rows = grouped.get(level) ?? [];
    if (rows.length === 0) continue;
    console.log(`${level.padEnd(10)} ${fmt(summarize(rows))}`);
  }
}

function printPeriodBreakdown(title: string, events: readonly AnnotatedHotEvent[]): void {
  console.log(`\n=== ${title}: period breakdown ===`);
  const byYear = groupBy(events, (event) => event.sessionDate.slice(0, 4));
  for (const [year, rows] of [...byYear.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`${year} ${fmt(summarize(rows))}`);
  }
}

function printRecentSessionRows(title: string, sessions: readonly Session[], events: readonly AnnotatedHotEvent[]): void {
  console.log(`\n=== ${title}: per recent session ===`);
  const bySession = groupBy(events, (event) => event.sessionId);
  for (const session of sessions) {
    const rows = bySession.get(session.id) ?? [];
    if (rows.length === 0 && session.numbers.length < ROI_START) continue;
    console.log(`${sessionDate(session)} ${session.name.padEnd(28)} ${fmt(summarize(rows))}`);
  }
}

function printGroupedPlanComparison(
  title: string,
  events: readonly AnnotatedHotEvent[],
  keyFn: (event: AnnotatedHotEvent) => string,
  minBaselineSignals = 30,
): void {
  console.log(`\n=== ${title}: grouped plan comparison ===`);
  const grouped = groupBy(events, keyFn);
  const rows = [...grouped.entries()]
    .map(([key, bucket]) => {
      const baseline = summarize(bucket);
      const plans = ["strong", "support-only", "support+", "watch+", "known-nonconflict", "reject-conflict"]
        .map((plan) => ({ plan, summary: summarize(filterByPlan(bucket, plan)) }))
        .filter((item) => item.summary.signals >= Math.max(10, Math.floor(baseline.signals * 0.08)));
      const best = plans.sort((left, right) => right.summary.roi - left.summary.roi || right.summary.net - left.summary.net)[0];
      return { key, baseline, best };
    })
    .filter((row) => row.baseline.signals >= minBaselineSignals)
    .sort((left, right) => right.baseline.signals - left.baseline.signals);

  for (const row of rows) {
    const bestText = row.best ? `${row.best.plan.padEnd(17)} ${fmt(row.best.summary)}` : "no stable plan";
    console.log(`${row.key.padEnd(26)} base ${fmt(row.baseline)} | best ${bestText}`);
  }
}

function printSupportByGroup(
  title: string,
  events: readonly AnnotatedHotEvent[],
  keyFn: (event: AnnotatedHotEvent) => string,
  minKnownSignals = 25,
): void {
  console.log(`\n=== ${title}: support breakdown by group ===`);
  const grouped = groupBy(events, keyFn);
  const rows = [...grouped.entries()]
    .map(([key, bucket]) => ({
      key,
      total: summarize(bucket),
      levels: groupBy(bucket, (event) => event.support),
    }))
    .filter((row) => row.total.signals >= minKnownSignals)
    .sort((left, right) => right.total.signals - left.total.signals);

  for (const row of rows) {
    console.log(`\n${row.key} total ${fmt(row.total)}`);
    for (const level of ["strong", "support", "watch", "conflict", "unknown"] as HotTableSupportLevel[]) {
      const bucket = row.levels.get(level) ?? [];
      if (bucket.length === 0) continue;
      console.log(`  ${level.padEnd(9)} ${fmt(summarize(bucket))}`);
    }
  }
}

function printRankBands(title: string, events: readonly AnnotatedHotEvent[]): void {
  console.log(`\n=== ${title}: rank/z bands ===`);
  const known = events.filter((event) => event.rank !== null);
  const bands: Array<[string, (event: AnnotatedHotEvent) => boolean]> = [
    ["rank 1-3", (event) => (event.rank ?? 99) <= 3],
    ["rank 4-6", (event) => (event.rank ?? 99) >= 4 && (event.rank ?? 99) <= 6],
    ["rank 7-12", (event) => (event.rank ?? 99) >= 7 && (event.rank ?? 99) <= 12],
    ["rank 13-24", (event) => (event.rank ?? 99) >= 13 && (event.rank ?? 99) <= 24],
    ["rank 25-29", (event) => (event.rank ?? 99) >= 25 && (event.rank ?? 99) <= 29],
    ["rank 30-37", (event) => (event.rank ?? 99) >= 30],
    ["z >= 1.00", (event) => event.z >= 1],
    ["0.35 <= z < 1", (event) => event.z >= 0.35 && event.z < 1],
    ["0 <= z < .35", (event) => event.z >= 0 && event.z < 0.35],
    ["z < 0", (event) => event.z < 0],
  ];
  for (const [label, predicate] of bands) {
    console.log(`${label.padEnd(16)} ${fmt(summarize(known.filter(predicate)))}`);
  }
}

function printBestThresholds(title: string, events: readonly AnnotatedHotEvent[]): void {
  console.log(`\n=== ${title}: best rank/z/sim thresholds, min 80 signals ===`);
  const candidates: Array<{ label: string; summary: Summary }> = [];
  for (const maxRank of [3, 4, 5, 6, 8, 10, 12, 18, 24, 30]) {
    for (const minZ of [-0.5, -0.2, 0, 0.2, 0.35, 0.5, 0.8, 1]) {
      for (const minSim of [0, 0.25, 0.35, 0.45]) {
        const rows = events.filter((event) => (
          event.rank !== null
          && event.rank <= maxRank
          && event.z >= minZ
          && event.similarity >= minSim
        ));
        const summary = summarize(rows);
        if (summary.signals < 80) continue;
        candidates.push({
          label: `rank<=${String(maxRank).padStart(2)} z>=${minZ.toFixed(2).padStart(5)} sim>=${minSim.toFixed(2)}`,
          summary,
        });
      }
    }
  }
  candidates
    .sort((left, right) => right.summary.roi - left.summary.roi || right.summary.net - left.summary.net)
    .slice(0, 12)
    .forEach((candidate) => {
      console.log(`${candidate.label} ${fmt(candidate.summary)}`);
    });
}

const sessions = loadSessions();
const events = runWalkForward(sessions);
const betting = filterBetting(events);
const recentSessions = sessions.filter((session) => sessionDate(session) >= "2026-04-01");
const recentSessionIds = new Set(recentSessions.map((session) => session.id));
const recentBetting = betting.filter((event) => recentSessionIds.has(event.sessionId));
const recentMacauWynnIds = new Set(
  recentSessions
    .filter((session) => session.name.includes("澳门永利"))
    .map((session) => session.id),
);
const recentMacauWynnBetting = betting.filter((event) => recentMacauWynnIds.has(event.sessionId));
const supportPlus = filterByPlan(betting, "support+");
const recentSupportPlus = filterByPlan(recentBetting, "support+");

console.log(`History file: ${path.relative(ROOT, historyPath())}`);
console.log(`Sessions used: ${sessions.length}`);
console.log(`Spins used: ${sessions.reduce((sum, session) => sum + session.numbers.length, 0)}`);
console.log("No-future rule: profiles are rebuilt from previous sessions only; current event support uses numbers before that event only.");

printPlanSet("All history, betting-zone events only", betting);
printSupportBreakdown("All history, betting-zone events only", betting);
printRankBands("All history, betting-zone events only", betting);
printBestThresholds("All history, betting-zone events only", betting);
printGroupedPlanComparison("All history by venue", betting, (event) => event.venueKey);
printSupportByGroup("All history by matched table", betting, (event) => (
  event.tableId ? `${event.venueKey}/${event.tableName || event.tableId}` : `${event.venueKey}/unknown`
), 60);
printPeriodBreakdown("Support+ all history betting-zone", supportPlus);

printPlanSet("2026-04+, betting-zone events only", recentBetting);
printSupportBreakdown("2026-04+, betting-zone events only", recentBetting);
printRankBands("2026-04+, betting-zone events only", recentBetting);
printBestThresholds("2026-04+, betting-zone events only", recentBetting);
printGroupedPlanComparison("2026-04+ by venue", recentBetting, (event) => event.venueKey);
printSupportByGroup("2026-04+ by matched table", recentBetting, (event) => (
  event.tableId ? `${event.venueKey}/${event.tableName || event.tableId}` : `${event.venueKey}/unknown`
), 25);
printPlanSet("2026-04+ Macau Wynn only, betting-zone events only", recentMacauWynnBetting);
printSupportBreakdown("2026-04+ Macau Wynn only, betting-zone events only", recentMacauWynnBetting);
printRecentSessionRows("2026-04+ support+", recentSessions, recentSupportPlus);
