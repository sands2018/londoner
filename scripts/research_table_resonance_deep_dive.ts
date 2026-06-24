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

type AssignmentMode = "confirmed" | "probable+";
type PickMode = "center2" | "intersect3" | "intersect5" | "profile3" | "profile5" | "profile7" | "recent3" | "recent5" | "recent7" | "union12";
type ProfileTier = "any" | "large" | "mature";

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
}

interface SignalContext {
  allSector: TableHotSector | null;
  assignmentLevel: AutoTableMatchLevel;
  assignmentSimilarity: number;
  assignmentSource: TableAssignmentSource;
  prefix: readonly RouletteNumber[];
  profile: TableProfile;
  profileSector: TableHotSector;
  recentByWindow: Map<number, TableHotSector | null>;
  result: RouletteNumber;
  session: Session;
  tableId: string;
  venueKey: string;
}

interface ResonanceRule {
  assignmentMode: AssignmentMode;
  description: string;
  distance: number;
  doubleAll: boolean;
  id: string;
  pickMode: PickMode;
  profileMinZ: number;
  profileTier: ProfileTier;
  recentMinZ: number;
  window: number;
}

interface SummaryState {
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

interface DatasetResult {
  all: Map<string, Summary>;
  filePath: string;
  latest: Map<string, Summary>;
  sessions: Session[];
  totalSpins: number;
}

interface RuleRow {
  latest: Summary;
  rule: ResonanceRule;
  summary: Summary;
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
    .sort((left, right) => (
      new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
      || (left.importIndex ?? Number.MAX_SAFE_INTEGER) - (right.importIndex ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name, "zh-Hans-CN")
      || left.id.localeCompare(right.id)
    ));
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
  let best: TableHotSector | null = null;
  for (let start = 0; start < WHEEL_ORDER.length; start += 1) {
    const sector = sectorFromCounts(counts, start, size, numbers.length);
    if (!best || sector.count > best.count || (sector.count === best.count && sector.z > best.z)) {
      best = sector;
    }
  }
  return best;
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
    });
    prior.push(session);
  }
  return contexts;
}

function assignmentPass(rule: ResonanceRule, ctx: SignalContext): boolean {
  if (ctx.assignmentSource !== "auto") return false;
  if (rule.assignmentMode === "confirmed") return ctx.assignmentLevel === "confirmed";
  return ctx.assignmentLevel === "confirmed" || ctx.assignmentLevel === "probable";
}

function profileTierPass(rule: ResonanceRule, profile: TableProfile): boolean {
  if (rule.profileTier === "any") return true;
  if (rule.profileTier === "large") return profile.sessionCount >= 3 && profile.totalNumbers >= 500;
  return profile.sessionCount >= 5 && profile.totalNumbers >= 1000;
}

function pickCandidates(rule: ResonanceRule, ctx: SignalContext, recentSector: TableHotSector): RouletteNumber[] {
  switch (rule.pickMode) {
    case "profile7":
      return sectorSlice(ctx.profileSector, 7);
    case "profile5":
      return sectorSlice(ctx.profileSector, 5);
    case "profile3":
      return sectorSlice(ctx.profileSector, 3);
    case "recent7":
      return sectorAround(recentSector.center, 7);
    case "recent5":
      return sectorAround(recentSector.center, 5);
    case "recent3":
      return sectorAround(recentSector.center, 3);
    case "center2":
      return unique([ctx.profileSector.center, recentSector.center]);
    case "intersect3": {
      const recentSet = new Set(recentSector.numbers);
      const intersection = ctx.profileSector.numbers.filter((number) => recentSet.has(number));
      return intersection.length >= 3 ? intersection : [];
    }
    case "intersect5": {
      const recentSet = new Set(recentSector.numbers);
      const intersection = ctx.profileSector.numbers.filter((number) => recentSet.has(number));
      return intersection.length >= 5 ? intersection : [];
    }
    case "union12": {
      const union = unique([...ctx.profileSector.numbers, ...recentSector.numbers]);
      return union.length <= 12 ? union : [];
    }
    default:
      return [];
  }
}

function evaluateRule(rule: ResonanceRule, ctx: SignalContext): RouletteNumber[] {
  if (!assignmentPass(rule, ctx)) return [];
  if (!profileTierPass(rule, ctx.profile)) return [];
  if (ctx.profileSector.z < rule.profileMinZ) return [];

  const recentSector = ctx.recentByWindow.get(rule.window);
  if (!recentSector || recentSector.z < rule.recentMinZ) return [];
  if (circularDistance(ctx.profileSector.center, recentSector.center) > rule.distance) return [];

  if (rule.doubleAll) {
    const allSector = ctx.allSector;
    if (!allSector || circularDistance(ctx.profileSector.center, allSector.center) > rule.distance) return [];
  }

  const candidates = pickCandidates(rule, ctx, recentSector);
  return unique(candidates).filter((number) => Number.isInteger(number) && number >= 0 && number <= 36);
}

function ruleId(rule: Omit<ResonanceRule, "description" | "id">): string {
  const pz = String(rule.profileMinZ).replace(".", "");
  const rz = String(rule.recentMinZ).replace(".", "");
  const dbl = rule.doubleAll ? "dbl" : "one";
  const asg = rule.assignmentMode === "confirmed" ? "conf" : "prob";
  const tier = rule.profileTier === "any" ? "any" : rule.profileTier;
  return `w${rule.window}-d${rule.distance}-${rule.pickMode}-pz${pz}-rz${rz}-${dbl}-${asg}-${tier}`;
}

function ruleDescription(rule: Omit<ResonanceRule, "description" | "id">): string {
  return [
    `window=${rule.window}`,
    `distance<=${rule.distance}`,
    `pick=${rule.pickMode}`,
    `profileZ>=${rule.profileMinZ}`,
    `recentZ>=${rule.recentMinZ}`,
    rule.doubleAll ? "requires full-prefix resonance" : "recent-only resonance",
    `assignment=${rule.assignmentMode}`,
    `profileTier=${rule.profileTier}`,
  ].join("; ");
}

function buildRules(): ResonanceRule[] {
  const windows = [60, 80, 100, 120, 160, 200];
  const distances = [0, 1, 2, 3, 4];
  const profileZ = [0, 0.5, 1];
  const recentZ = [0, 0.5, 1, 1.5];
  const pickModes: PickMode[] = [
    "profile7",
    "profile5",
    "profile3",
    "recent7",
    "recent5",
    "recent3",
    "intersect3",
    "intersect5",
    "center2",
    "union12",
  ];
  const rules: ResonanceRule[] = [];

  for (const window of windows) {
    for (const distance of distances) {
      for (const pickMode of pickModes) {
        for (const profileMinZ of profileZ) {
          for (const recentMinZ of recentZ) {
            const base = {
              assignmentMode: "probable+" as const,
              distance,
              doubleAll: false,
              pickMode,
              profileMinZ,
              profileTier: "any" as const,
              recentMinZ,
              window,
            };
            rules.push({ ...base, description: ruleDescription(base), id: ruleId(base) });
          }
        }
      }
    }
  }

  for (const window of [80, 120, 160]) {
    for (const distance of [1, 2, 3]) {
      for (const pickMode of ["profile7", "profile5", "recent5", "intersect3", "center2"] satisfies PickMode[]) {
        for (const profileMinZ of [0, 0.5, 1]) {
          for (const recentMinZ of [0.5, 1, 1.5]) {
            for (const assignmentMode of ["probable+", "confirmed"] satisfies AssignmentMode[]) {
              for (const profileTier of ["any", "large", "mature"] satisfies ProfileTier[]) {
                const focused = {
                  assignmentMode,
                  distance,
                  doubleAll: true,
                  pickMode,
                  profileMinZ,
                  profileTier,
                  recentMinZ,
                  window,
                };
                rules.push({ ...focused, description: ruleDescription(focused), id: ruleId(focused) });
              }
            }
          }
        }
      }
    }
  }

  return [...new Map(rules.map((rule) => [rule.id, rule])).values()];
}

const RULES = buildRules();
const WINDOWS = [...new Set(RULES.map((rule) => rule.window))].sort((left, right) => left - right);

function emptyState(): SummaryState {
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

function recordSignal(states: Map<string, SummaryState>, rule: ResonanceRule, sessionId: string, bet: number, hit: boolean): void {
  const state = states.get(rule.id) ?? emptyState();
  const net = hit ? 36 - bet : -bet;
  state.bet += bet;
  state.hits += hit ? 1 : 0;
  state.running += net;
  state.peak = Math.max(state.peak, state.running);
  state.maxDrawdown = Math.max(state.maxDrawdown, state.peak - state.running);
  state.sessionNet.set(sessionId, (state.sessionNet.get(sessionId) ?? 0) + net);
  state.sessionSignals.set(sessionId, (state.sessionSignals.get(sessionId) ?? 0) + 1);
  state.signals += 1;
  state.win += hit ? 36 : 0;
  states.set(rule.id, state);
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

function summarizeState(state: SummaryState | undefined): Summary {
  if (!state) {
    return {
      activeSessions: 0,
      averageBet: 0,
      bet: 0,
      giniAbsSessionNet: 0,
      hitRate: 0,
      hits: 0,
      maxDrawdown: 0,
      meanSessionNet: 0,
      negativeSessions: 0,
      net: 0,
      positiveSessions: 0,
      roi: 0,
      sdSessionNet: 0,
      signals: 0,
      top10SignalShare: 0,
      win: 0,
    };
  }
  const nets = [...state.sessionNet.values()];
  const top10Signals = [...state.sessionSignals.values()].sort((a, b) => b - a).slice(0, 10).reduce((sum, value) => sum + value, 0);
  return {
    activeSessions: nets.length,
    averageBet: state.signals > 0 ? state.bet / state.signals : 0,
    bet: state.bet,
    giniAbsSessionNet: gini(nets),
    hitRate: state.signals > 0 ? (state.hits / state.signals) * 100 : 0,
    hits: state.hits,
    maxDrawdown: state.maxDrawdown,
    meanSessionNet: nets.length > 0 ? nets.reduce((sum, value) => sum + value, 0) / nets.length : 0,
    negativeSessions: nets.filter((value) => value < 0).length,
    net: state.win - state.bet,
    positiveSessions: nets.filter((value) => value > 0).length,
    roi: state.bet > 0 ? ((state.win - state.bet) / state.bet) * 100 : 0,
    sdSessionNet: stddev(nets),
    signals: state.signals,
    top10SignalShare: state.signals > 0 ? (top10Signals / state.signals) * 100 : 0,
    win: state.win,
  };
}

function summaryMap(states: Map<string, SummaryState>): Map<string, Summary> {
  return new Map(RULES.map((rule) => [rule.id, summarizeState(states.get(rule.id))]));
}

function runDataset(filePath: string): DatasetResult {
  const sessions = loadSessions(filePath);
  const contexts = buildPriorContexts(sessions);
  const latestIds = new Set(sessions.slice(-10).map((session) => session.id));
  const allStates = new Map<string, SummaryState>();
  const latestStates = new Map<string, SummaryState>();

  for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
    const session = sessions[sessionIndex];
    const context = contexts[sessionIndex];
    const venueKey = inferSpatialVenueKey(session.name);
    const isLatest = latestIds.has(session.id);

    for (let position = ROI_START; position < session.numbers.length; position += 1) {
      const prefix = session.numbers.slice(0, position);
      const assignment = assignSessionToAutoTableProfileState({ ...session, numbers: prefix }, context.state);
      const tableId = assignment.effectiveTableId;
      if (!tableId) continue;

      const profile = context.profilesById.get(tableId);
      const profileSector = profile?.hotSectors[0];
      if (!profile || !profileSector) continue;

      const recentByWindow = new Map<number, TableHotSector | null>();
      for (const window of WINDOWS) {
        recentByWindow.set(window, topSector(recent(prefix, window), 7));
      }

      const ctx: SignalContext = {
        allSector: topSector(prefix, 7),
        assignmentLevel: assignment.autoMatchLevel,
        assignmentSimilarity: assignment.autoSimilarity,
        assignmentSource: assignment.source,
        prefix,
        profile,
        profileSector,
        recentByWindow,
        result: session.numbers[position],
        session,
        tableId,
        venueKey,
      };

      for (const rule of RULES) {
        const candidates = evaluateRule(rule, ctx);
        if (candidates.length === 0) continue;
        const hit = candidates.includes(ctx.result);
        recordSignal(allStates, rule, session.id, candidates.length, hit);
        if (isLatest) recordSignal(latestStates, rule, session.id, candidates.length, hit);
      }
    }
  }

  return {
    all: summaryMap(allStates),
    filePath,
    latest: summaryMap(latestStates),
    sessions,
    totalSpins: sessions.reduce((sum, session) => sum + session.numbers.length, 0),
  };
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

function allRows(result: DatasetResult): RuleRow[] {
  return RULES.map((rule) => ({
    latest: result.latest.get(rule.id) ?? summarizeState(undefined),
    rule,
    summary: result.all.get(rule.id) ?? summarizeState(undefined),
  }));
}

function summaryTable(rows: readonly RuleRow[], useLatest = false): string[] {
  const lines = [
    "| rule | params | summary |",
    "|---|---|---:|",
  ];
  for (const row of rows) {
    lines.push(`| ${row.rule.id} | ${row.rule.description} | \`${fmt(useLatest ? row.latest : row.summary)}\` |`);
  }
  return lines;
}

function groupBestRows(rows: readonly RuleRow[], field: keyof ResonanceRule): Array<{ key: string; row: RuleRow }> {
  const byKey = new Map<string, RuleRow[]>();
  for (const row of rows) {
    const key = String(row.rule[field]);
    const bucket = byKey.get(key) ?? [];
    bucket.push(row);
    byKey.set(key, bucket);
  }
  return [...byKey.entries()]
    .map(([key, bucket]) => ({
      key,
      row: [...bucket].sort((a, b) => b.summary.roi - a.summary.roi || b.summary.net - a.summary.net)[0],
    }))
    .filter((item): item is { key: string; row: RuleRow } => Boolean(item.row))
    .sort((a, b) => b.row.summary.roi - a.row.summary.roi || b.row.summary.net - a.row.summary.net);
}

function addDatasetSection(lines: string[], result: DatasetResult): void {
  const rows = allRows(result);
  const robust = rows.filter((row) => row.summary.bet >= 1000 && row.summary.activeSessions >= 8);
  const latestRobust = rows.filter((row) => row.latest.bet >= 300 && row.latest.activeSessions >= 5);

  lines.push(`\n## Dataset: ${path.basename(result.filePath)}`);
  lines.push(`- sessions: ${result.sessions.length}`);
  lines.push(`- spins: ${result.totalSpins}`);
  lines.push(`- resonance rules: ${RULES.length}`);
  lines.push(`- no-future: prior auto tables and profiles use only earlier sessions; current features use only prefix before the target spin.`);

  lines.push("\n### Full Range, Top Robust By ROI");
  lines.push(...summaryTable([...robust].sort((a, b) => b.summary.roi - a.summary.roi || b.summary.net - a.summary.net).slice(0, 25)));

  lines.push("\n### Full Range, Top Robust By Net");
  lines.push(...summaryTable([...robust].sort((a, b) => b.summary.net - a.summary.net || b.summary.roi - a.summary.roi).slice(0, 20)));

  lines.push("\n### Latest 10 Sessions, Top Robust By ROI");
  lines.push(...summaryTable([...latestRobust].sort((a, b) => b.latest.roi - a.latest.roi || b.latest.net - a.latest.net).slice(0, 25), true));

  lines.push("\n### Best Full-Range Robust Rule By Parameter");
  for (const field of ["window", "distance", "pickMode", "profileMinZ", "recentMinZ", "doubleAll", "assignmentMode", "profileTier"] satisfies Array<keyof ResonanceRule>) {
    lines.push(`\n#### ${field}`);
    lines.push("| value | bestRule | summary |");
    lines.push("|---|---|---:|");
    for (const item of groupBestRows(robust, field)) {
      lines.push(`| ${item.key} | ${item.row.rule.id} | \`${fmt(item.row.summary)}\` |`);
    }
  }
}

function crossRows(results: readonly DatasetResult[]): Array<{
  latestA: Summary;
  latestB: Summary;
  minLatestRoi: number;
  minRoi: number;
  rule: ResonanceRule;
  summaryA: Summary;
  summaryB: Summary;
}> {
  const [a, b] = results;
  return RULES.map((rule) => {
    const summaryA = a.all.get(rule.id) ?? summarizeState(undefined);
    const summaryB = b.all.get(rule.id) ?? summarizeState(undefined);
    const latestA = a.latest.get(rule.id) ?? summarizeState(undefined);
    const latestB = b.latest.get(rule.id) ?? summarizeState(undefined);
    return {
      latestA,
      latestB,
      minLatestRoi: Math.min(latestA.roi, latestB.roi),
      minRoi: Math.min(summaryA.roi, summaryB.roi),
      rule,
      summaryA,
      summaryB,
    };
  });
}

function addParamVotes(lines: string[], rows: readonly ReturnType<typeof crossRows>[number][]): void {
  const fields: Array<keyof ResonanceRule> = ["window", "distance", "pickMode", "profileMinZ", "recentMinZ", "doubleAll", "assignmentMode", "profileTier"];
  for (const field of fields) {
    const counts = new Map<string, number>();
    for (const row of rows) {
      const key = String(row.rule[field]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const values = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    lines.push(`- ${field}: ${values.map(([key, count]) => `${key}=${count}`).join(", ")}`);
  }
}

function addCrossTable(
  lines: string[],
  rows: readonly ReturnType<typeof crossRows>[number][],
  title: string,
  useLatest: boolean,
  limit = 20,
): void {
  lines.push(`\n### ${title}`);
  lines.push("| rule | params | data_2026.6.11 | history_data | minROI |");
  lines.push("|---|---|---:|---:|---:|");
  const sorted = [...rows].sort((a, b) => {
    const left = useLatest ? a.minLatestRoi : a.minRoi;
    const right = useLatest ? b.minLatestRoi : b.minRoi;
    const leftNet = useLatest ? a.latestA.net + a.latestB.net : a.summaryA.net + a.summaryB.net;
    const rightNet = useLatest ? b.latestA.net + b.latestB.net : b.summaryA.net + b.summaryB.net;
    return right - left || rightNet - leftNet;
  });
  for (const row of sorted.slice(0, limit)) {
    const a = useLatest ? row.latestA : row.summaryA;
    const b = useLatest ? row.latestB : row.summaryB;
    lines.push(`| ${row.rule.id} | ${row.rule.description} | \`${fmt(a)}\` | \`${fmt(b)}\` | ${(useLatest ? row.minLatestRoi : row.minRoi).toFixed(1)}% |`);
  }
}

function addCrossDatasetSection(lines: string[], results: readonly DatasetResult[]): void {
  const rows = crossRows(results);
  const fullRobust = rows
    .filter((row) => row.summaryA.bet >= 1000 && row.summaryB.bet >= 1000 && row.summaryA.activeSessions >= 8 && row.summaryB.activeSessions >= 8)
    .sort((a, b) => b.minRoi - a.minRoi || (b.summaryA.net + b.summaryB.net) - (a.summaryA.net + a.summaryB.net));
  const latestRobust = rows
    .filter((row) => row.latestA.bet >= 300 && row.latestB.bet >= 300 && row.latestA.activeSessions >= 5 && row.latestB.activeSessions >= 5)
    .sort((a, b) => b.minLatestRoi - a.minLatestRoi || (b.latestA.net + b.latestB.net) - (a.latestA.net + a.latestB.net));

  lines.push("\n## Cross-Dataset Robustness");
  lines.push("\n### Full Range, Best Minimum ROI Across Both Datasets");
  lines.push("| rule | params | data_2026.6.11 | history_data | minROI |");
  lines.push("|---|---|---:|---:|---:|");
  for (const row of fullRobust.slice(0, 30)) {
    lines.push(`| ${row.rule.id} | ${row.rule.description} | \`${fmt(row.summaryA)}\` | \`${fmt(row.summaryB)}\` | ${row.minRoi.toFixed(1)}% |`);
  }

  lines.push("\n### Latest 10, Best Minimum ROI Across Both Datasets");
  lines.push("| rule | params | data_2026.6.11 latest10 | history_data latest10 | minROI |");
  lines.push("|---|---|---:|---:|---:|");
  for (const row of latestRobust.slice(0, 30)) {
    lines.push(`| ${row.rule.id} | ${row.rule.description} | \`${fmt(row.latestA)}\` | \`${fmt(row.latestB)}\` | ${row.minLatestRoi.toFixed(1)}% |`);
  }

  lines.push("\n### Parameter Votes Among Full-Range Top 30");
  addParamVotes(lines, fullRobust.slice(0, 30));

  lines.push("\n### Parameter Votes Among Latest-10 Top 30");
  addParamVotes(lines, latestRobust.slice(0, 30));

  addCrossTable(
    lines,
    fullRobust.filter((row) => row.rule.window === 120),
    "Focus Full Range: Window 120",
    false,
  );
  addCrossTable(
    lines,
    latestRobust.filter((row) => row.rule.window === 120),
    "Focus Latest 10: Window 120",
    true,
  );
  addCrossTable(
    lines,
    fullRobust.filter((row) => row.rule.doubleAll),
    "Focus Full Range: Double Resonance",
    false,
  );
  addCrossTable(
    lines,
    latestRobust.filter((row) => row.rule.doubleAll),
    "Focus Latest 10: Double Resonance",
    true,
  );
  addCrossTable(
    lines,
    fullRobust.filter((row) => row.rule.pickMode === "intersect3" || row.rule.pickMode === "intersect5"),
    "Focus Full Range: Intersection Picks",
    false,
  );
  addCrossTable(
    lines,
    latestRobust.filter((row) => row.rule.pickMode === "intersect3" || row.rule.pickMode === "intersect5"),
    "Focus Latest 10: Intersection Picks",
    true,
  );
  addCrossTable(
    lines,
    fullRobust.filter((row) => row.rule.distance === 0),
    "Focus Full Range: Exact Center Match",
    false,
  );
  addCrossTable(
    lines,
    latestRobust.filter((row) => row.rule.distance === 0),
    "Focus Latest 10: Exact Center Match",
    true,
  );
}

function main(): void {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const report: string[] = [
    "# Table Resonance Deep Dive",
    "",
    "Focus: table-profile hot sector + current-session short-window hot sector resonance.",
    "",
    "This deliberately excludes raw table hot sectors, adaptive meta-gates, and table historical top-number rules.",
    "",
    "Bet accounting: each candidate number is one straight-up unit. A signal with 5 candidates risks 5 units and wins 36 units if any candidate hits.",
  ];
  const results: DatasetResult[] = [];

  for (const filePath of DATASETS) {
    const started = Date.now();
    console.log(`Running ${path.relative(ROOT, filePath)} with ${RULES.length} resonance rules...`);
    const result = runDataset(filePath);
    results.push(result);
    addDatasetSection(report, result);
    console.log(`  elapsed=${((Date.now() - started) / 1000).toFixed(1)}s`);
  }

  addCrossDatasetSection(report, results);

  const outPath = path.join(OUT_DIR, "table-resonance-deep-dive.md");
  fs.writeFileSync(outPath, `${report.join("\n")}\n`, "utf8");
  console.log(`Wrote ${path.relative(ROOT, outPath)}`);
}

main();
