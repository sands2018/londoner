import fs from "node:fs";
import path from "node:path";
import { getHistoryDataIso, getHistoryDataTms } from "./historyTime";
import { analyzeHotNumbers, type HotNumberSignalEvent } from "../app/src/core/hotNumbers";
import {
  assignSessionToAutoTableProfileState,
  buildAutoTableProfileState,
  type AutoTableInputSession,
  type AutoTableProfileState,
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
const ROI_START = 200;
const ACTIONS: HotTableCalibrationAction[] = ["enhance", "baseline", "observe", "hint", "block"];
const SUPPORT_LEVELS: HotTableSupportLevel[] = ["strong", "support", "watch", "conflict", "unknown", "none"];
const DATASETS = [
  path.join(ROOT, "HistoryData", "data_2026.6.11.json"),
  path.join(ROOT, "HistoryData", "history_data.json"),
];

type TableMode = "legacy-match" | "auto-prefix";

interface RawHistoryRow {
  Name?: string;
  Numbers?: string | number[];
  Count?: number;
  SaveTime?: string;
  tms?: number;
  ImportIndex?: number;
  tableId?: string;
  TableId?: string;
}

interface Session extends AutoTableInputSession {
  sourceIndex: number;
}

interface CalibrationParams {
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

interface SessionContext {
  priorAutoState: AutoTableProfileState;
  profiles: TableProfile[];
  calibrationState: HotTableCalibrationState;
}

interface EventRow {
  sessionId: string;
  sessionName: string;
  sessionDate: string;
  year: string;
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
  assignmentSource: string;
  assignedTableId: string;
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
  meanSessionNet: number;
  sdSessionNet: number;
  giniAbsSessionNet: number;
  top10SignalShare: number;
}

const CURRENT_PARAMS: CalibrationParams = {
  tableTierMin: 24,
  tableOverallMin: 60,
  venueTierMin: 45,
  venueOverallMin: 120,
  enhanceRoi: 35,
  observeRoi: 10,
  hintRoi: -5,
};

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
  return { action: classify(stats, params), scope: bucket.scope, sample, stats, bucket };
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

function summarize(events: readonly EventRow[]): Summary {
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let hits = 0;
  const sessionNet = new Map<string, number>();
  const sessionSignals = new Map<string, number>();

  for (const event of events) {
    if (event.hit) hits += 1;
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
    sessionNet.set(event.sessionId, (sessionNet.get(event.sessionId) ?? 0) + event.net);
    sessionSignals.set(event.sessionId, (sessionSignals.get(event.sessionId) ?? 0) + 1);
  }

  const signals = events.length;
  const win = hits * 36;
  const net = win - signals;
  const nets = [...sessionNet.values()];
  const top10Signals = [...sessionSignals.values()].sort((a, b) => b - a).slice(0, 10).reduce((sum, value) => sum + value, 0);
  return {
    signals,
    hits,
    bet: signals,
    win,
    net,
    roi: signals > 0 ? (net / signals) * 100 : 0,
    hitRate: signals > 0 ? (hits / signals) * 100 : 0,
    maxDrawdown,
    activeSessions: nets.length,
    positiveSessions: nets.filter((value) => value > 0).length,
    negativeSessions: nets.filter((value) => value < 0).length,
    meanSessionNet: nets.length > 0 ? nets.reduce((sum, value) => sum + value, 0) / nets.length : 0,
    sdSessionNet: stddev(nets),
    giniAbsSessionNet: gini(nets),
    top10SignalShare: signals > 0 ? (top10Signals / signals) * 100 : 0,
  };
}

function fmt(summary: Summary): string {
  return [
    `sig=${String(summary.signals).padStart(5)}`,
    `hit=${String(summary.hits).padStart(4)}`,
    `net=${String(summary.net).padStart(7)}`,
    `roi=${summary.roi.toFixed(1).padStart(7)}%`,
    `wr=${summary.hitRate.toFixed(1).padStart(5)}%`,
    `dd=${String(summary.maxDrawdown).padStart(5)}`,
    `pos=${String(summary.positiveSessions).padStart(2)}/${String(summary.activeSessions).padEnd(2)}`,
    `mean=${summary.meanSessionNet.toFixed(1).padStart(6)}`,
    `sd=${summary.sdSessionNet.toFixed(1).padStart(6)}`,
    `gini=${summary.giniAbsSessionNet.toFixed(3)}`,
    `top10=${summary.top10SignalShare.toFixed(1)}%`,
  ].join(" ");
}

function buildContexts(sessions: readonly Session[]): SessionContext[] {
  const contexts: SessionContext[] = [];
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
    contexts.push({
      priorAutoState,
      profiles,
      calibrationState: buildHotTableCalibrationState(calibrationSessions, priorAutoState.tables),
    });
    prior.push(session);
  }
  return contexts;
}

function evaluateSupportAtPrefix(
  session: Session,
  event: HotNumberSignalEvent,
  context: SessionContext,
  tableMode: TableMode,
): { support: HotTableSupport; assignmentSource: string; assignedTableId: string } {
  const prefix = session.numbers.slice(0, event.position);
  if (tableMode === "legacy-match") {
    return {
      support: evaluateHotNumberTableSupport(prefix, event.signal.number, context.profiles),
      assignmentSource: "profile-match",
      assignedTableId: "",
    };
  }

  const prefixSession: Session = { ...session, numbers: prefix };
  const assignment = assignSessionToAutoTableProfileState(prefixSession, context.priorAutoState);
  const forcedTableId = assignment.effectiveTableId;
  return {
    support: forcedTableId
      ? evaluateHotNumberTableSupport(prefix, event.signal.number, context.profiles, forcedTableId)
      : evaluateHotNumberTableSupport(prefix, event.signal.number, context.profiles),
    assignmentSource: assignment.source,
    assignedTableId: forcedTableId ?? "",
  };
}

function runDataset(sessions: readonly Session[], contexts: readonly SessionContext[], tableMode: TableMode): EventRow[] {
  const rows: EventRow[] = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    const context = contexts[index];
    const analysis = analyzeHotNumbers(session.numbers, ROI_START);
    for (const event of analysis.events) {
      if (event.position < ROI_START) continue;
      const { support, assignmentSource, assignedTableId } = evaluateSupportAtPrefix(session, event, context, tableMode);
      const decision = evaluateWithParams(support, context.calibrationState, CURRENT_PARAMS);
      rows.push({
        sessionId: session.id,
        sessionName: session.name,
        sessionDate: sessionDate(session),
        year: sessionDate(session).slice(0, 4),
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
        tableId: support.profile?.tableId ?? assignedTableId,
        tableLabel: support.profile?.tableName ?? assignedTableId,
        matchLevel: support.match.level,
        similarity: support.match.similarity,
        gap: support.match.gap,
        rank: support.rank,
        z: support.z,
        calibrationSignals: decision.stats?.signals ?? 0,
        calibrationRoi: decision.stats?.roi ?? null,
        calibrationKey: decision.bucket?.key ?? "none",
        calibrationLabel: decision.bucket?.label ?? "none",
        assignmentSource,
        assignedTableId,
      });
    }
  }
  return rows;
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

function addSummaryTable(lines: string[], title: string, rows: Array<[string, readonly EventRow[]]>): void {
  lines.push(`\n### ${title}`);
  lines.push("| bucket | summary |");
  lines.push("|---|---:|");
  for (const [label, events] of rows) {
    lines.push(`| ${label} | \`${fmt(summarize(events))}\` |`);
  }
}

function addGroupedSummary(
  lines: string[],
  title: string,
  events: readonly EventRow[],
  keyFn: (event: EventRow) => string,
  options: { minSignals?: number; limit?: number } = {},
): void {
  const minSignals = options.minSignals ?? 1;
  const limit = options.limit ?? Number.POSITIVE_INFINITY;
  const rows = [...groupBy(events, keyFn).entries()]
    .map(([key, items]) => ({ key, items, summary: summarize(items) }))
    .filter((row) => row.summary.signals >= minSignals)
    .sort((left, right) => right.summary.signals - left.summary.signals || right.summary.net - left.summary.net)
    .slice(0, limit);
  lines.push(`\n### ${title}`);
  lines.push("| key | summary |");
  lines.push("|---|---:|");
  for (const row of rows) {
    lines.push(`| ${row.key} | \`${fmt(row.summary)}\` |`);
  }
}

function addActionUniformity(lines: string[], events: readonly EventRow[]): void {
  lines.push("\n### Action Uniformity");
  lines.push("| action | summary | worst sessions | best sessions |");
  lines.push("|---|---:|---|---|");
  for (const action of ACTIONS) {
    const actionRows = events.filter((event) => event.action === action);
    const perSession = [...groupBy(actionRows, (event) => event.sessionId).entries()]
      .map(([, rows]) => ({ name: rows[0]?.sessionName ?? "", summary: summarize(rows) }));
    const worst = [...perSession]
      .sort((left, right) => left.summary.net - right.summary.net)
      .slice(0, 5)
      .map((row) => `${row.name}:${row.summary.net}/${row.summary.signals}`)
      .join("<br>");
    const best = [...perSession]
      .sort((left, right) => right.summary.net - left.summary.net)
      .slice(0, 5)
      .map((row) => `${row.name}:${row.summary.net}/${row.summary.signals}`)
      .join("<br>");
    lines.push(`| ${action} | \`${fmt(summarize(actionRows))}\` | ${worst || "-"} | ${best || "-"} |`);
  }
}

function addModeReport(lines: string[], title: string, events: readonly EventRow[]): void {
  lines.push(`\n## ${title}`);
  addSummaryTable(lines, "Action ROI", ACTIONS.map((action) => [action, events.filter((event) => event.action === action)]));
  addSummaryTable(lines, "Plan ROI", [
    ["raw-all", events],
    ["default-visible(enhance+baseline+observe)", events.filter((event) => event.action === "enhance" || event.action === "baseline" || event.action === "observe")],
    ["hidden(hint+block)", events.filter((event) => event.action === "hint" || event.action === "block")],
    ["non-baseline", events.filter((event) => event.action !== "baseline")],
    ["table-only", events.filter((event) => event.scope === "table")],
    ["known-feature", events.filter((event) => event.support !== "unknown" && event.support !== "none")],
  ]);
  addActionUniformity(lines, events);
  addGroupedSummary(lines, "Action by Year", events, (event) => `${event.year}/${event.action}`);
  addGroupedSummary(lines, "Action by Venue, min 40 signals", events, (event) => `${event.venueKey}/${event.action}`, { minSignals: 40 });
  addGroupedSummary(lines, "Action x Scope/Sample", events, (event) => `${event.action}/${event.scope}/${event.sample}`);
  addGroupedSummary(lines, "Support x Action", events, (event) => `${event.support}/${event.action}`);
  addGroupedSummary(lines, "Realized ROI by Historical Calibration ROI Band", events, (event) => `${calibrationRoiBand(event)}/${event.action}`);
  addGroupedSummary(lines, "Top Calibration Buckets, min 25 signals", events, (event) => `${event.action}/${event.calibrationKey}/${event.calibrationLabel}`, { minSignals: 25, limit: 30 });
  addGroupedSummary(lines, "Auto Assignment Source", events, (event) => `${event.assignmentSource || "none"}/${event.action}`);
}

function addLatestTenFocus(
  lines: string[],
  sessions: readonly Session[],
  legacyEvents: readonly EventRow[],
  autoEvents: readonly EventRow[],
): void {
  const latestSessions = sessions.slice(-10);
  const latestIds = new Set(latestSessions.map((session) => session.id));
  const legacyLatest = legacyEvents.filter((event) => latestIds.has(event.sessionId));
  const autoLatest = autoEvents.filter((event) => latestIds.has(event.sessionId));

  lines.push("\n## Latest 10 Sessions Focus");
  lines.push("");
  lines.push("These rows are still walk-forward: each latest session uses only earlier sessions, and each signal uses only prefix numbers before that signal.");
  lines.push("");
  lines.push("| order | date | session | spins | legacy signals/net | auto signals/net |");
  lines.push("|---:|---|---|---:|---:|---:|");
  for (let index = 0; index < latestSessions.length; index += 1) {
    const session = latestSessions[index];
    const legacySummary = summarize(legacyLatest.filter((event) => event.sessionId === session.id));
    const autoSummary = summarize(autoLatest.filter((event) => event.sessionId === session.id));
    lines.push(`| ${index + 1} | ${sessionDate(session)} | ${session.name} | ${session.numbers.length} | ${legacySummary.signals}/${legacySummary.net}/${legacySummary.roi.toFixed(1)}% | ${autoSummary.signals}/${autoSummary.net}/${autoSummary.roi.toFixed(1)}% |`);
  }

  lines.push("\n### Latest 10 Action Delta");
  lines.push(...actionDiffRows(legacyLatest, autoLatest));

  addSummaryTable(lines, "Latest 10 Legacy Action ROI", ACTIONS.map((action) => [
    action,
    legacyLatest.filter((event) => event.action === action),
  ]));
  addSummaryTable(lines, "Latest 10 Auto-Prefix Action ROI", ACTIONS.map((action) => [
    action,
    autoLatest.filter((event) => event.action === action),
  ]));
  addSummaryTable(lines, "Latest 10 Plan ROI", [
    ["legacy raw-all", legacyLatest],
    ["legacy default-visible", legacyLatest.filter((event) => event.action === "enhance" || event.action === "baseline" || event.action === "observe")],
    ["legacy hidden", legacyLatest.filter((event) => event.action === "hint" || event.action === "block")],
    ["auto raw-all", autoLatest],
    ["auto default-visible", autoLatest.filter((event) => event.action === "enhance" || event.action === "baseline" || event.action === "observe")],
    ["auto hidden", autoLatest.filter((event) => event.action === "hint" || event.action === "block")],
  ]);

  lines.push("\n### Latest 10 Changed Event Summary");
  lines.push(...compareChangedEvents(legacyLatest, autoLatest));

  addGroupedSummary(lines, "Latest 10 Legacy by Session/Action", legacyLatest, (event) => `${event.sessionName}/${event.action}`);
  addGroupedSummary(lines, "Latest 10 Auto by Session/Action", autoLatest, (event) => `${event.sessionName}/${event.action}`);
  addGroupedSummary(lines, "Latest 10 Auto Assignment Source", autoLatest, (event) => `${event.assignmentSource || "none"}/${event.action}`);
  addGroupedSummary(lines, "Latest 10 Auto Support x Action", autoLatest, (event) => `${event.support}/${event.action}`);
  addGroupedSummary(lines, "Latest 10 Auto Calibration Buckets, min 10 signals", autoLatest, (event) => `${event.action}/${event.calibrationKey}/${event.calibrationLabel}`, { minSignals: 10, limit: 20 });
}

function actionDiffRows(left: readonly EventRow[], right: readonly EventRow[]): string[] {
  const lines = ["| action | legacy-match | auto-prefix | delta net | delta roi pp | delta signals |", "|---|---:|---:|---:|---:|---:|"];
  for (const action of ACTIONS) {
    const leftSummary = summarize(left.filter((event) => event.action === action));
    const rightSummary = summarize(right.filter((event) => event.action === action));
    lines.push(`| ${action} | \`${fmt(leftSummary)}\` | \`${fmt(rightSummary)}\` | ${rightSummary.net - leftSummary.net} | ${(rightSummary.roi - leftSummary.roi).toFixed(1)} | ${rightSummary.signals - leftSummary.signals} |`);
  }
  return lines;
}

function compareChangedEvents(left: readonly EventRow[], right: readonly EventRow[]): string[] {
  const leftByKey = new Map(left.map((event) => [`${event.sessionId}:${event.position}:${event.pick}`, event]));
  const rows = right
    .map((event) => ({ before: leftByKey.get(`${event.sessionId}:${event.position}:${event.pick}`), after: event }))
    .filter((row): row is { before: EventRow; after: EventRow } => Boolean(row.before))
    .filter((row) => row.before.action !== row.after.action || row.before.support !== row.after.support || row.before.tableId !== row.after.tableId);
  const lines = ["| changed set | summary |"];
  lines.push("|---|---:|");
  lines.push(`| all changed events | \`${fmt(summarize(rows.map((row) => row.after)))}\` |`);
  for (const action of ACTIONS) {
    lines.push(`| changed into ${action} | \`${fmt(summarize(rows.filter((row) => row.after.action === action).map((row) => row.after)))}\` |`);
  }
  return lines;
}

function datasetReport(filePath: string): string {
  const sessions = loadSessions(filePath);
  const contexts = buildContexts(sessions);
  const totalSpins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
  const manualTagged = sessions.filter((session) => Boolean(session.tableId)).length;
  const legacyEvents = runDataset(sessions, contexts, "legacy-match");
  const autoEvents = runDataset(sessions, contexts, "auto-prefix");
  const lines: string[] = [];

  lines.push(`# Hot Calibration Walk-Forward Report: ${path.basename(filePath)}`);
  lines.push("");
  lines.push(`- file: \`${path.relative(ROOT, filePath)}\``);
  lines.push(`- sessions: ${sessions.length}`);
  lines.push(`- spins: ${totalSpins}`);
  lines.push(`- manual table-tagged sessions: ${manualTagged}`);
  lines.push(`- ROI scope: betting-zone only, index >= ${ROI_START}`);
  lines.push("- no-future rule: session N uses only sessions 1..N-1 for calibration/profile state; each current hot signal uses only numbers before that signal for current table matching.");
  lines.push("- table modes:");
  lines.push("  - legacy-match: current signal uses prefix-only profile matching, without forcing an auto table assignment.");
  lines.push("  - auto-prefix: current signal first runs new automatic table assignment on the prefix only, then uses that assigned table if available.");
  lines.push("");
  lines.push("## Auto-Prefix vs Legacy-Match Delta");
  lines.push(...actionDiffRows(legacyEvents, autoEvents));
  lines.push("\n### Changed Event Summary");
  lines.push(...compareChangedEvents(legacyEvents, autoEvents));
  addLatestTenFocus(lines, sessions, legacyEvents, autoEvents);

  addModeReport(lines, "legacy-match", legacyEvents);
  addModeReport(lines, "auto-prefix", autoEvents);
  return `${lines.join("\n")}\n`;
}

const outDir = path.join(ROOT, "scripts", "output");
fs.mkdirSync(outDir, { recursive: true });

for (const filePath of DATASETS) {
  const started = Date.now();
  console.log(`Running ${path.relative(ROOT, filePath)}...`);
  const report = datasetReport(filePath);
  const outPath = path.join(outDir, `hot-calibration-${path.basename(filePath, ".json")}.md`);
  fs.writeFileSync(outPath, report, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outPath)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
