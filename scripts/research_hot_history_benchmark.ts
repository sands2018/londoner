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
  type TableProfile,
} from "../app/src/core/tableHotProfile";
import { inferSpatialVenueKey } from "../app/src/core/spatialTableClustering";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const OUTPUT_PATH = path.join(ROOT, "scripts", "output", "hot-history-benchmark.md");
const ROI_START = 200;

const ACTIONS: HotTableCalibrationAction[] = ["enhance", "baseline", "observe", "hint", "block"];

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
  action: HotTableCalibrationAction;
  hit: boolean;
  net: number;
  position: number;
  sessionId: string;
}

interface Summary {
  signals: number;
  bet: number;
  win: number;
  hits: number;
  net: number;
  roi: number;
  sp100: number;
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
    : String(raw ?? "").split(/[,\uFF0C\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
}

function parseUpdatedAt(row: RawHistoryRow, sourceIndex: number): string {
  return getHistoryDataIso(row, sourceIndex);
}

function loadSessions(): Session[] {
  const rows = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex): Session => ({
      id: `history_data_${sourceIndex}`,
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

function supportAtPrefix(session: Session, event: HotNumberSignalEvent, context: SessionContext): HotTableSupport {
  const prefix = session.numbers.slice(0, event.position);
  const assignment = assignSessionToAutoTableProfileState({ ...session, numbers: prefix }, context.priorAutoState);
  return assignment.effectiveTableId
    ? evaluateHotNumberTableSupport(prefix, event.signal.number, context.profiles, assignment.effectiveTableId)
    : evaluateHotNumberTableSupport(prefix, event.signal.number, context.profiles);
}

function replay(sessions: readonly Session[], contexts: readonly SessionContext[]): EventRow[] {
  const rows: EventRow[] = [];
  for (let index = 0; index < sessions.length; index += 1) {
    const session = sessions[index];
    const context = contexts[index];
    const analysis = analyzeHotNumbers(session.numbers, ROI_START);
    for (const event of analysis.events) {
      if (event.position < ROI_START) continue;
      const support = supportAtPrefix(session, event, context);
      const decision = evaluateWithParams(support, context.calibrationState, CURRENT_PARAMS);
      rows.push({
        action: decision.action,
        hit: event.hit,
        net: event.hit ? 35 : -1,
        position: event.position,
        sessionId: session.id,
      });
    }
  }
  return rows;
}

function summarize(events: readonly EventRow[], denominatorSpins: number): Summary {
  const hits = events.filter((event) => event.hit).length;
  const signals = events.length;
  const win = hits * 36;
  const net = win - signals;
  return {
    signals,
    bet: signals,
    win,
    hits,
    net,
    roi: signals > 0 ? (net / signals) * 100 : 0,
    sp100: denominatorSpins > 0 ? (signals / denominatorSpins) * 100 : 0,
  };
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function fmtSp100(value: number): string {
  return value.toFixed(2);
}

function tsRow(action: HotTableCalibrationAction, summary: Summary): string {
  return `    { action: "${action}", signals: ${summary.signals}, bet: ${summary.bet}, win: ${summary.win}, hits: ${summary.hits}, net: ${summary.net}, roi: ${summary.roi.toFixed(6)}, sp100: ${summary.sp100.toFixed(6)} },`;
}

const sessions = loadSessions();
const contexts = buildContexts(sessions);
const events = replay(sessions, contexts);
const totalSpins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
const bettingSpins = sessions.reduce((sum, session) => sum + Math.max(0, session.numbers.length - ROI_START), 0);
const actionSummaries = ACTIONS.map((action) => ({
  action,
  summary: summarize(events.filter((event) => event.action === action), bettingSpins),
}));
const rawSummary = summarize(events, bettingSpins);
const defaultVisibleSummary = summarize(events.filter((event) => (
  event.action === "enhance" || event.action === "baseline" || event.action === "observe"
)), bettingSpins);

const lines: string[] = [];
lines.push("# Hot History Benchmark");
lines.push("");
lines.push(`- source: \`${path.relative(ROOT, HISTORY_PATH)}\``);
lines.push(`- sessions: ${sessions.length}`);
lines.push(`- spins: ${totalSpins}`);
lines.push(`- bettingSpins: ${bettingSpins}`);
lines.push(`- ROI/SP100 scope: index >= ${ROI_START}`);
lines.push("- no-future: session N uses sessions 1..N-1; each signal uses prefix before the signal; auto table assignment is prefix-only.");
lines.push("");
lines.push("## Action Benchmark");
lines.push("| action | signals | hits | bet | win | net | ROI | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
for (const row of actionSummaries) {
  const s = row.summary;
  lines.push(`| ${row.action} | ${s.signals} | ${s.hits} | ${s.bet} | ${s.win} | ${s.net} | ${fmtPct(s.roi)} | ${fmtSp100(s.sp100)} |`);
}
lines.push("");
lines.push("## Plan Benchmark");
lines.push("| plan | signals | hits | bet | win | net | ROI | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
for (const [label, s] of [["raw-all", rawSummary], ["default-visible", defaultVisibleSummary]] as const) {
  lines.push(`| ${label} | ${s.signals} | ${s.hits} | ${s.bet} | ${s.win} | ${s.net} | ${fmtPct(s.roi)} | ${fmtSp100(s.sp100)} |`);
}
lines.push("");
lines.push("## TypeScript Literal");
lines.push("```ts");
lines.push("export const HOT_HISTORY_BENCHMARK = {");
lines.push('  source: "HistoryData/history_data.json",');
lines.push("  roiStartIndex: 200,");
lines.push(`  sessions: ${sessions.length},`);
lines.push(`  spins: ${totalSpins},`);
lines.push(`  bettingSpins: ${bettingSpins},`);
lines.push('  tableMode: "auto-prefix",');
lines.push("  rows: [");
for (const row of actionSummaries) lines.push(tsRow(row.action, row.summary));
lines.push("  ],");
lines.push("} as const;");
lines.push("```");
lines.push("");

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");

console.log(lines.slice(0, lines.indexOf("## TypeScript Literal") - 1).join("\n"));
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
