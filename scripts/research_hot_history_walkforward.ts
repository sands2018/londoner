import fs from "node:fs";
import path from "node:path";
import { getHistoryDataIso, getHistoryDataTms } from "./historyTime";
import { analyzeHotNumbers, type HotNumberSignalEvent } from "../app/src/core/hotNumbers";
import {
  assignSessionToAutoTableProfileState,
  buildAutoTableProfileState,
  type AutoTableInputSession,
  type TableAssignment,
} from "../app/src/core/autoTableProfile";
import {
  buildHotTableCalibrationState,
  type HotTableCalibrationAction,
  type HotTableCalibrationBucket,
  type HotTableCalibrationSample,
  type HotTableCalibrationScope,
  type HotTableCalibrationState,
  type HotTableCalibrationStats,
} from "../app/src/core/hotTableCalibration";
import {
  buildTableProfiles,
  evaluateHotNumberTableSupport,
  type HotTableSupport,
  type HotTableSupportLevel,
  type TableProfile,
} from "../app/src/core/tableHotProfile";
import { inferSpatialVenueKey } from "../app/src/core/spatialTableClustering";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const ROI_START = 200;

type PlanName =
  | "raw-all"
  | "default-visible"
  | "enhance+baseline"
  | "enhance-only"
  | "hide-block";

interface RawHistoryRow {
  Name?: string;
  Numbers?: string | number[];
  Count?: number;
  SaveTime?: string;
  tms?: number;
  ImportIndex?: number;
  tableId?: string;
}

interface Session extends AutoTableInputSession {
  sourceIndex: number;
}

interface CalibrationParams {
  name: string;
  tableTierMin: number;
  tableOverallMin: number;
  venueTierMin: number;
  venueOverallMin: number;
  enhanceRoi: number;
  observeRoi: number;
  hintRoi: number;
}

interface Decision {
  action: HotTableCalibrationAction;
  scope: HotTableCalibrationScope;
  sample: HotTableCalibrationSample;
  stats: HotTableCalibrationStats | null;
  bucket: HotTableCalibrationBucket | null;
}

interface EventRow {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  month: string;
  venueKey: string;
  position: number;
  pick: RouletteNumber;
  result: RouletteNumber;
  hit: boolean;
  net: number;
  mode: string;
  action: HotTableCalibrationAction;
  scope: HotTableCalibrationScope;
  sample: HotTableCalibrationSample;
  support: HotTableSupportLevel;
  tableId: string;
  tableLabel: string;
  matchLevel: string;
  similarity: number;
  gap: number;
  rank: number | null;
  z: number;
  calibrationSignals: number;
  calibrationRoi: number | null;
  calibrationKey: string;
  calibrationLabel: string;
}

interface WalkForwardSessionRow {
  session: Session;
  assignment?: TableAssignment;
  events: EventRow[];
}

interface Summary {
  signals: number;
  hits: number;
  bet: number;
  win: number;
  net: number;
  roi: number;
  hitRate: number;
  maxDrawdown: number;
  activeSessions: number;
  positiveSessions: number;
  negativeSessions: number;
}

const ACTIONS: HotTableCalibrationAction[] = ["enhance", "baseline", "observe", "hint", "block"];

const CURRENT_PARAMS: CalibrationParams = {
  name: "current",
  tableTierMin: 24,
  tableOverallMin: 60,
  venueTierMin: 45,
  venueOverallMin: 120,
  enhanceRoi: 35,
  observeRoi: 10,
  hintRoi: -5,
};

const PARAM_GRID: CalibrationParams[] = [
  CURRENT_PARAMS,
  { ...CURRENT_PARAMS, name: "loose-sample", tableTierMin: 16, tableOverallMin: 45, venueTierMin: 30, venueOverallMin: 90 },
  { ...CURRENT_PARAMS, name: "strict-sample", tableTierMin: 36, tableOverallMin: 90, venueTierMin: 60, venueOverallMin: 160 },
  { ...CURRENT_PARAMS, name: "table-first", venueTierMin: 9999, venueOverallMin: 9999 },
  { ...CURRENT_PARAMS, name: "conservative-roi", enhanceRoi: 50, observeRoi: 15, hintRoi: 0 },
  { ...CURRENT_PARAMS, name: "lenient-roi", enhanceRoi: 25, observeRoi: 5, hintRoi: -15 },
  {
    name: "loose+conservative",
    tableTierMin: 16,
    tableOverallMin: 45,
    venueTierMin: 30,
    venueOverallMin: 90,
    enhanceRoi: 50,
    observeRoi: 15,
    hintRoi: 0,
  },
  {
    name: "strict+conservative",
    tableTierMin: 36,
    tableOverallMin: 90,
    venueTierMin: 60,
    venueOverallMin: 160,
    enhanceRoi: 50,
    observeRoi: 15,
    hintRoi: 0,
  },
];

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
  const rows = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex): Session => ({
      id: `history_${sourceIndex}`,
      sourceIndex,
      name: String(row.Name ?? `session-${sourceIndex + 1}`),
      numbers: parseNumbers(row.Numbers),
      updatedAt: parseUpdatedAt(row, sourceIndex),
      updatedTms: getHistoryDataTms(row, sourceIndex),
      importIndex: row.ImportIndex ?? sourceIndex,
      tableId: row.tableId,
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

function eventNet(event: HotNumberSignalEvent): number {
  return event.hit ? 35 : -1;
}

function tableBucketKey(tableId: string): string {
  return `table:${tableId}`;
}

function venueBucketKey(venueKey: string): string {
  return `venue:${venueKey}`;
}

function classify(stats: HotTableCalibrationStats, params: CalibrationParams): HotTableCalibrationAction {
  if (stats.roi >= params.enhanceRoi) return "enhance";
  if (stats.roi >= params.observeRoi) return "observe";
  if (stats.roi >= params.hintRoi) return "hint";
  return "block";
}

function makeDecision(
  bucket: HotTableCalibrationBucket,
  stats: HotTableCalibrationStats,
  sample: Exclude<HotTableCalibrationSample, "none">,
  params: CalibrationParams,
): Decision {
  return {
    action: classify(stats, params),
    scope: bucket.scope,
    sample,
    stats,
    bucket,
  };
}

function evaluateWithParams(
  support: HotTableSupport,
  state: HotTableCalibrationState,
  params: CalibrationParams,
): Decision {
  const tableId = support.profile?.tableId;
  const tableBucket = tableId ? state.bucketsByKey.get(tableBucketKey(tableId)) ?? null : null;
  const venueKey = tableId ? state.tableVenueById.get(tableId) ?? tableBucket?.venueKey : undefined;
  const venueBucket = venueKey ? state.bucketsByKey.get(venueBucketKey(venueKey)) ?? null : null;

  if (tableBucket) {
    const tierStats = tableBucket.tiers[support.level];
    if (tierStats.signals >= params.tableTierMin) return makeDecision(tableBucket, tierStats, "tier", params);
    if (tableBucket.total.signals >= params.tableOverallMin) return makeDecision(tableBucket, tableBucket.total, "overall", params);
  }

  if (venueBucket) {
    const tierStats = venueBucket.tiers[support.level];
    if (tierStats.signals >= params.venueTierMin) return makeDecision(venueBucket, tierStats, "tier", params);
    if (venueBucket.total.signals >= params.venueOverallMin) return makeDecision(venueBucket, venueBucket.total, "overall", params);
  }

  return { action: "baseline", scope: "none", sample: "none", stats: null, bucket: null };
}

function planIncludes(plan: PlanName, event: EventRow): boolean {
  if (plan === "raw-all") return true;
  if (plan === "default-visible") return event.action === "enhance" || event.action === "baseline" || event.action === "observe";
  if (plan === "enhance+baseline") return event.action === "enhance" || event.action === "baseline";
  if (plan === "enhance-only") return event.action === "enhance";
  if (plan === "hide-block") return event.action !== "block";
  return true;
}

function summarize(events: readonly EventRow[]): Summary {
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let hits = 0;
  const sessionNet = new Map<string, number>();

  for (const event of events) {
    if (event.hit) hits += 1;
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
    sessionNet.set(event.sessionId, (sessionNet.get(event.sessionId) ?? 0) + event.net);
  }

  const signals = events.length;
  const win = hits * 36;
  const net = win - signals;
  const activeNets = [...sessionNet.values()];
  return {
    signals,
    hits,
    bet: signals,
    win,
    net,
    roi: signals > 0 ? (net / signals) * 100 : 0,
    hitRate: signals > 0 ? (hits / signals) * 100 : 0,
    maxDrawdown,
    activeSessions: activeNets.length,
    positiveSessions: activeNets.filter((value) => value > 0).length,
    negativeSessions: activeNets.filter((value) => value < 0).length,
  };
}

function formatSummary(summary: Summary): string {
  return [
    `sig=${String(summary.signals).padStart(5)}`,
    `hit=${String(summary.hits).padStart(4)}`,
    `net=${String(summary.net).padStart(7)}`,
    `roi=${summary.roi.toFixed(1).padStart(7)}%`,
    `wr=${summary.hitRate.toFixed(1).padStart(5)}%`,
    `dd=${String(summary.maxDrawdown).padStart(5)}`,
    `pos=${String(summary.positiveSessions).padStart(2)}/${String(summary.activeSessions).padEnd(2)}`,
  ].join(" ");
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

function stddev(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
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

function runWalkForward(sessions: readonly Session[], params: CalibrationParams): WalkForwardSessionRow[] {
  const rows: WalkForwardSessionRow[] = [];
  const prior: Session[] = [];

  for (const session of sessions) {
    const priorAutoState = buildAutoTableProfileState(prior);
    const profiles = buildTableProfiles(priorAutoState.profileSessions, priorAutoState.tables);
    const calibrationSessions = prior.map((priorSession) => {
      const assignment = priorAutoState.assignmentsById.get(priorSession.id);
      return {
        id: priorSession.id,
        name: priorSession.name,
        numbers: priorSession.numbers,
        updatedAt: priorSession.updatedAt,
        updatedTms: priorSession.updatedTms,
        importIndex: priorSession.importIndex,
        tableId: assignment?.effectiveTableId ?? priorSession.tableId,
      };
    });
    const calibrationState = buildHotTableCalibrationState(calibrationSessions, priorAutoState.tables);
    const assignment = assignSessionToAutoTableProfileState(session, priorAutoState);
    const forcedTableId = assignment.effectiveTableId;
    const analysis = analyzeHotNumbers(session.numbers, ROI_START);
    const events: EventRow[] = [];

    for (const event of analysis.events) {
      if (event.position < ROI_START) continue;
      const prefix = session.numbers.slice(0, event.position);
      const support = forcedTableId
        ? evaluateHotNumberTableSupport(prefix, event.signal.number, profiles, forcedTableId)
        : evaluateHotNumberTableSupport(prefix, event.signal.number, profiles);
      const decision = evaluateWithParams(support, calibrationState, params);
      events.push({
        sessionId: session.id,
        sessionName: session.name,
        sessionDate: sessionDate(session),
        month: sessionDate(session).slice(0, 7),
        venueKey: inferSpatialVenueKey(session.name),
        position: event.position,
        pick: event.signal.number,
        result: session.numbers[event.position],
        hit: event.hit,
        net: eventNet(event),
        mode: event.signal.mode,
        action: decision.action,
        scope: decision.scope,
        sample: decision.sample,
        support: support.level,
        tableId: support.profile?.tableId ?? forcedTableId ?? "",
        tableLabel: support.profile?.tableName ?? forcedTableId ?? "",
        matchLevel: support.match.level,
        similarity: support.match.similarity,
        gap: support.match.gap,
        rank: support.rank,
        z: support.z,
        calibrationSignals: decision.stats?.signals ?? 0,
        calibrationRoi: decision.stats?.roi ?? null,
        calibrationKey: decision.bucket?.key ?? "none",
        calibrationLabel: decision.bucket?.label ?? "none",
      });
    }

    rows.push({ session, assignment, events });
    prior.push(session);
  }

  return rows;
}

function flatten(rows: readonly WalkForwardSessionRow[]): EventRow[] {
  return rows.flatMap((row) => row.events);
}

function printPlanSummary(events: readonly EventRow[]): void {
  console.log("\n=== Plan ROI, betting-zone only ===");
  const plans: PlanName[] = ["raw-all", "default-visible", "enhance+baseline", "enhance-only", "hide-block"];
  for (const plan of plans) {
    console.log(`${plan.padEnd(18)} ${formatSummary(summarize(events.filter((event) => planIncludes(plan, event))))}`);
  }
  const hidden = events.filter((event) => event.action === "hint" || event.action === "block");
  const blockOnly = events.filter((event) => event.action === "block");
  const nonBaseline = events.filter((event) => event.action !== "baseline");
  const tableOnly = events.filter((event) => event.scope === "table");
  const knownFeature = events.filter((event) => event.support !== "unknown" && event.support !== "none");
  console.log(`${"hidden-only".padEnd(18)} ${formatSummary(summarize(hidden))}`);
  console.log(`${"block-only".padEnd(18)} ${formatSummary(summarize(blockOnly))}`);
  console.log(`${"non-baseline".padEnd(18)} ${formatSummary(summarize(nonBaseline))}`);
  console.log(`${"table-only".padEnd(18)} ${formatSummary(summarize(tableOnly))}`);
  console.log(`${"known-feature".padEnd(18)} ${formatSummary(summarize(knownFeature))}`);
}

function printActionBreakdown(events: readonly EventRow[]): void {
  console.log("\n=== Calibration action breakdown ===");
  for (const action of ACTIONS) {
    const rows = events.filter((event) => event.action === action);
    console.log(`${action.padEnd(9)} ${formatSummary(summarize(rows))}`);
  }
}

function printSupportBreakdown(events: readonly EventRow[]): void {
  console.log("\n=== Table feature/support breakdown ===");
  const levels: HotTableSupportLevel[] = ["strong", "support", "watch", "conflict", "unknown", "none"];
  for (const level of levels) {
    const rows = events.filter((event) => event.support === level);
    if (rows.length === 0) continue;
    console.log(`${level.padEnd(9)} ${formatSummary(summarize(rows))}`);
  }
}

function printScopeBreakdown(events: readonly EventRow[]): void {
  console.log("\n=== Calibration source breakdown ===");
  for (const scope of ["table", "venue", "none"] as HotTableCalibrationScope[]) {
    const rows = events.filter((event) => event.scope === scope);
    console.log(`${scope.padEnd(6)} ${formatSummary(summarize(rows))}`);
  }
  console.log("\n=== Calibration sample breakdown ===");
  for (const sample of ["tier", "overall", "none"] as HotTableCalibrationSample[]) {
    const rows = events.filter((event) => event.sample === sample);
    console.log(`${sample.padEnd(7)} ${formatSummary(summarize(rows))}`);
  }
}

function printPeriodBreakdown(events: readonly EventRow[]): void {
  console.log("\n=== Default-visible by year ===");
  const visible = events.filter((event) => planIncludes("default-visible", event));
  for (const [year, rows] of [...groupBy(visible, (event) => event.sessionDate.slice(0, 4)).entries()].sort()) {
    console.log(`${year} ${formatSummary(summarize(rows))}`);
  }

  console.log("\n=== Default-visible by month, min 15 signals ===");
  for (const [month, rows] of [...groupBy(visible, (event) => event.month).entries()].sort()) {
    if (rows.length < 15) continue;
    console.log(`${month} ${formatSummary(summarize(rows))}`);
  }
}

function printActionByYear(events: readonly EventRow[]): void {
  console.log("\n=== Action by year ===");
  for (const [year, rows] of [...groupBy(events, (event) => event.sessionDate.slice(0, 4)).entries()].sort()) {
    const parts = ACTIONS.map((action) => {
      const summary = summarize(rows.filter((event) => event.action === action));
      return `${action}:${summary.signals}/${summary.net}/${summary.roi.toFixed(0)}%`;
    }).join(" | ");
    console.log(`${year} ${formatSummary(summarize(rows))} :: ${parts}`);
  }
}

function printActionByVenue(events: readonly EventRow[]): void {
  console.log("\n=== Action by venue, min 80 raw signals ===");
  for (const [venue, rows] of [...groupBy(events, (event) => event.venueKey).entries()]
    .filter(([, rows]) => rows.length >= 80)
    .sort((a, b) => b[1].length - a[1].length)) {
    const parts = ACTIONS.map((action) => {
      const summary = summarize(rows.filter((event) => event.action === action));
      return `${action}:${summary.signals}/${summary.net}/${summary.roi.toFixed(0)}%`;
    }).join(" | ");
    console.log(`${venue.padEnd(12)} ${formatSummary(summarize(rows))} :: ${parts}`);
  }
}

function printSupportActionMatrix(events: readonly EventRow[]): void {
  console.log("\n=== Support x action matrix ===");
  const levels: HotTableSupportLevel[] = ["strong", "support", "watch", "conflict", "unknown", "none"];
  for (const level of levels) {
    const levelRows = events.filter((event) => event.support === level);
    if (levelRows.length === 0) continue;
    const parts = ACTIONS.map((action) => {
      const summary = summarize(levelRows.filter((event) => event.action === action));
      return `${action}:${summary.signals}/${summary.net}/${summary.roi.toFixed(0)}%`;
    }).join(" | ");
    console.log(`${level.padEnd(9)} ${formatSummary(summarize(levelRows))} :: ${parts}`);
  }
}

function calibrationRoiBand(event: EventRow): string {
  const roi = event.calibrationRoi;
  if (roi === null) return "none";
  if (roi < -50) return "<-50";
  if (roi < -20) return "-50..-20";
  if (roi < -5) return "-20..-5";
  if (roi < 10) return "-5..10";
  if (roi < 35) return "10..35";
  return ">=35";
}

function printCalibrationDiagnostics(events: readonly EventRow[]): void {
  console.log("\n=== Action x scope/sample ===");
  for (const action of ACTIONS) {
    const rows = events.filter((event) => event.action === action);
    const parts = [...groupBy(rows, (event) => `${event.scope}/${event.sample}`).entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([key, keyRows]) => {
        const summary = summarize(keyRows);
        return `${key}:${summary.signals}/${summary.net}/${summary.roi.toFixed(0)}%`;
      })
      .join(" | ");
    console.log(`${action.padEnd(9)} ${parts}`);
  }

  console.log("\n=== Realized ROI by historical calibration ROI band ===");
  const bandOrder = ["none", "<-50", "-50..-20", "-20..-5", "-5..10", "10..35", ">=35"];
  for (const band of bandOrder) {
    const rows = events.filter((event) => calibrationRoiBand(event) === band);
    if (rows.length === 0) continue;
    const actionParts = ACTIONS.map((action) => {
      const summary = summarize(rows.filter((event) => event.action === action));
      return `${action}:${summary.signals}/${summary.net}`;
    }).join(" | ");
    console.log(`${band.padEnd(8)} ${formatSummary(summarize(rows))} :: ${actionParts}`);
  }

  console.log("\n=== Top block buckets by realized net, min 25 block signals ===");
  const blockBuckets = [...groupBy(events.filter((event) => event.action === "block"), (event) => event.calibrationKey).entries()]
    .map(([key, rows]) => {
      const summary = summarize(rows);
      const first = rows[0];
      const calibrationSignals = Math.max(...rows.map((event) => event.calibrationSignals));
      const calibrationRois = rows
        .map((event) => event.calibrationRoi)
        .filter((roi): roi is number => roi !== null);
      const minCalibrationRoi = calibrationRois.length > 0 ? Math.min(...calibrationRois) : null;
      const maxCalibrationRoi = calibrationRois.length > 0 ? Math.max(...calibrationRois) : null;
      return {
        key,
        label: first?.calibrationLabel ?? key,
        scope: first?.scope ?? "none",
        sample: first?.sample ?? "none",
        summary,
        calibrationSignals,
        minCalibrationRoi,
        maxCalibrationRoi,
      };
    })
    .filter((row) => row.summary.signals >= 25)
    .sort((a, b) => b.summary.net - a.summary.net);
  for (const row of blockBuckets.slice(0, 12)) {
    const calRange = row.minCalibrationRoi === null
      ? "cal=none"
      : `cal=${row.minCalibrationRoi.toFixed(0)}..${(row.maxCalibrationRoi ?? row.minCalibrationRoi).toFixed(0)}%/${row.calibrationSignals}`;
    console.log(`${row.key.padEnd(18)} ${row.scope}/${row.sample} ${row.label.padEnd(12)} ${formatSummary(row.summary)} ${calRange}`);
  }
}

function printVenueTableBreakdown(events: readonly EventRow[]): void {
  const visible = events.filter((event) => planIncludes("default-visible", event));
  console.log("\n=== Default-visible by venue ===");
  for (const [venue, rows] of [...groupBy(visible, (event) => event.venueKey).entries()]
    .sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${venue.padEnd(18)} ${formatSummary(summarize(rows))}`);
  }

  console.log("\n=== Default-visible by matched table, min 20 signals ===");
  for (const [table, rows] of [...groupBy(visible, (event) => event.tableLabel || "unmatched").entries()]
    .filter(([, rows]) => rows.length >= 20)
    .sort((a, b) => b[1].length - a[1].length)) {
    console.log(`${table.padEnd(18)} ${formatSummary(summarize(rows))}`);
  }
}

function printUniformity(events: readonly EventRow[]): void {
  const visible = events.filter((event) => planIncludes("default-visible", event));
  const sessionRows = [...groupBy(visible, (event) => event.sessionId).entries()].map(([sessionId, rows]) => {
    const summary = summarize(rows);
    return { sessionId, sessionName: rows[0]?.sessionName ?? "", summary };
  });
  const nets = sessionRows.map((row) => row.summary.net);
  const signals = sessionRows.map((row) => row.summary.signals);
  const sortedBySignals = [...sessionRows].sort((a, b) => b.summary.signals - a.summary.signals);
  const top10Signals = sortedBySignals.slice(0, 10).reduce((sum, row) => sum + row.summary.signals, 0);
  const totalSignals = signals.reduce((sum, value) => sum + value, 0);

  console.log("\n=== Uniformity, default-visible ===");
  console.log(`activeSessions=${sessionRows.length}`);
  console.log(`sessionNet mean=${(nets.reduce((s, v) => s + v, 0) / Math.max(nets.length, 1)).toFixed(1)} sd=${stddev(nets).toFixed(1)} giniAbs=${gini(nets).toFixed(3)}`);
  console.log(`sessionSignals mean=${(totalSignals / Math.max(signals.length, 1)).toFixed(1)} sd=${stddev(signals).toFixed(1)} top10Share=${totalSignals > 0 ? ((top10Signals / totalSignals) * 100).toFixed(1) : "0.0"}%`);
  console.log("Worst 8 sessions:");
  for (const row of [...sessionRows].sort((a, b) => a.summary.net - b.summary.net).slice(0, 8)) {
    console.log(`  ${row.sessionName.padEnd(32)} ${formatSummary(row.summary)}`);
  }
  console.log("Best 8 sessions:");
  for (const row of [...sessionRows].sort((a, b) => b.summary.net - a.summary.net).slice(0, 8)) {
    console.log(`  ${row.sessionName.padEnd(32)} ${formatSummary(row.summary)}`);
  }
}

function printAssignments(rows: readonly WalkForwardSessionRow[]): void {
  console.log("\n=== Walk-forward auto table assignment, latest 15 by time ===");
  for (const row of rows.slice(-15)) {
    const assignment = row.assignment;
    console.log([
      sessionDate(row.session),
      row.session.name.padEnd(30),
      `source=${assignment?.source ?? "none"}`,
      `effective=${assignment?.effectiveTableId ?? "-"}`,
      `auto=${assignment?.autoTableId ?? "-"}`,
      `level=${assignment?.autoMatchLevel ?? "-"}`,
      `sim=${(assignment?.autoSimilarity ?? 0).toFixed(2)}`,
      `gap=${(assignment?.autoGap ?? 0).toFixed(2)}`,
    ].join(" "));
  }
}

function printParamSweep(sessions: readonly Session[]): void {
  console.log("\n=== Param sweep: default-visible ROI ===");
  const rows = PARAM_GRID.map((params) => {
    const events = flatten(runWalkForward(sessions, params));
    const visible = events.filter((event) => planIncludes("default-visible", event));
    const hidden = events.filter((event) => event.action === "hint" || event.action === "block");
    return {
      params,
      visible: summarize(visible),
      hidden: summarize(hidden),
      actions: new Map(ACTIONS.map((action) => [action, summarize(events.filter((event) => event.action === action))])),
    };
  }).sort((a, b) => b.visible.roi - a.visible.roi || b.visible.net - a.visible.net);

  for (const row of rows) {
    console.log(`${row.params.name.padEnd(20)} visible ${formatSummary(row.visible)} | hidden ${formatSummary(row.hidden)}`);
  }
}

const sessions = loadSessions();
const rows = runWalkForward(sessions, CURRENT_PARAMS);
const events = flatten(rows);
const totalSpins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
const compact = process.argv.includes("--compact");

console.log(`History file: ${path.relative(ROOT, HISTORY_PATH)}`);
console.log(`Sessions: ${sessions.length}; spins: ${totalSpins}; ROI starts at index ${ROI_START}`);
console.log("No-future rule: for session N, table profiles and calibration buckets use sessions < N only; each event uses only numbers before that event.");

if (compact) {
  printPlanSummary(events);
  printActionBreakdown(events);
  printActionByYear(events);
  printActionByVenue(events);
  printSupportActionMatrix(events);
  printCalibrationDiagnostics(events);
  printParamSweep(sessions);
} else {
  printAssignments(rows);
  printPlanSummary(events);
  printActionBreakdown(events);
  printSupportBreakdown(events);
  printScopeBreakdown(events);
  printPeriodBreakdown(events);
  printVenueTableBreakdown(events);
  printUniformity(events);
  printCalibrationDiagnostics(events);
  printParamSweep(sessions);
}
