import fs from "node:fs";
import path from "node:path";
import {
  buildTableProfiles,
  evaluateHotNumberTableSupport,
  matchTableProfile,
  type HotTableSupportLevel,
  type TableProfileSession,
  type TableProfileTable,
} from "../app/src/core/tableHotProfile";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const ROI_START = 200;

type Mode = "long" | "short";

interface RawHistoryRow {
  Name?: string;
  Numbers?: string | number[];
  Count?: number;
  SaveTime?: string;
  tms?: number;
}

interface Session {
  id: string;
  sourceIndex: number;
  name: string;
  sortDate: string;
  sortOrder: number;
  numbers: RouletteNumber[];
  manualTable: string;
}

interface HotEvent {
  sessionId: string;
  sessionName: string;
  index: number;
  mode: Mode;
  pick: RouletteNumber;
  result: RouletteNumber;
  hit: boolean;
  net: number;
  support?: HotTableSupportLevel;
  tableId?: string;
  reason?: string;
}

interface CachedPicks {
  longPicks: Array<RouletteNumber | null>;
  shortPicks: Array<RouletteNumber | null>;
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
}

const MANUAL_TABLE_BY_NAME = new Map<string, string>([
  ["wzs-2026-04-06-703", "macau_wynn_01"],
  ["wzs-2026-05-11-802", "macau_wynn_01"],
  ["wzs-2026-05-11-803", "macau_wynn_01"],
  ["20260601-1630-澳门永利", "macau_wynn_01"],
  ["20260602-0018-澳门永利", "macau_wynn_01"],
  ["20260604-1630-澳门永利", "macau_wynn_01"],

  ["wzs-2026-04-06-702", "macau_wynn_02"],
  ["wzs-2026-05-11-807", "macau_wynn_02"],
  ["wzs-2026-05-11-809", "macau_wynn_02"],
  ["20260603-0030-澳门永利", "macau_wynn_02"],
  ["20260603-2101-澳门永利", "macau_wynn_02"],
  ["20260604-2223-澳门永利", "macau_wynn_02"],
  ["20260605-0230-澳门永利", "macau_wynn_02"],

  ["wzs-2026-04-06-701", "macau_wynn_03"],
  ["20260409-夜-澳门永利", "macau_wynn_03"],
  ["wzs-2026-05-11-804", "macau_wynn_03"],
  ["wzs-2026-05-11-806", "macau_wynn_03"],
  ["wzs-2026-05-11-808", "macau_wynn_03"],
  ["wzs-2026-05-11-810", "macau_wynn_03"],
  ["20260603-0230-澳门永利", "macau_wynn_03"],
  ["20260606-0131-澳门永利", "macau_wynn_03"],
  ["20260607-0217-澳门永利", "macau_wynn_03"],
]);

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
}

function parseSortInfo(name: string, saveTime: string | undefined, sourceIndex: number): { sortDate: string; sortOrder: number } {
  const compact = name.match(/^(\d{4})(\d{2})(\d{2})-(\d{4}|夜|下午|晚上|凌晨)/u);
  if (compact) {
    const date = `${compact[1]}-${compact[2]}-${compact[3]}`;
    const marker = compact[4];
    const order = /^\d{4}$/.test(marker)
      ? Number(marker)
      : marker === "凌晨" ? 300
      : marker === "下午" ? 1500
      : marker === "夜" || marker === "晚上" ? 2200
      : 1200;
    return { sortDate: date, sortOrder: order };
  }

  const wzs = name.match(/^wzs-(\d{4})-(\d{2})-(\d{2})-(\d+)/u);
  if (wzs) {
    return {
      sortDate: `${wzs[1]}-${wzs[2]}-${wzs[3]}`,
      sortOrder: 120000 + Number(wzs[4]),
    };
  }

  const fallback = String(saveTime ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/u);
  if (fallback) {
    return {
      sortDate: `${fallback[1]}-${fallback[2]}-${fallback[3]}`,
      sortOrder: Number(`${fallback[4] ?? "12"}${fallback[5] ?? "00"}`),
    };
  }

  return { sortDate: "9999-12-31", sortOrder: sourceIndex };
}

function loadTargetSessions(): Session[] {
  const rows = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex) => {
      const name = String(row.Name ?? `session-${sourceIndex + 1}`);
      const numbers = parseNumbers(row.Numbers);
      const { sortDate, sortOrder } = parseSortInfo(name, row.SaveTime, sourceIndex);
      return {
        id: `s${sourceIndex}`,
        sourceIndex,
        name,
        sortDate,
        sortOrder,
        numbers,
        manualTable: MANUAL_TABLE_BY_NAME.get(name) ?? "",
      };
    })
    .filter((session) => session.sortDate >= "2026-04-01" && session.sortDate < "2026-07-01")
    .sort((left, right) => left.sortDate.localeCompare(right.sortDate) || left.sortOrder - right.sortOrder || left.sourceIndex - right.sourceIndex);
}

function countInWindow(numbers: readonly RouletteNumber[], num: number, window: number, end = numbers.length): number {
  const start = Math.max(0, end - window);
  let count = 0;
  for (let i = start; i < end; i += 1) {
    if (numbers[i] === num) count += 1;
  }
  return count;
}

function topNFromCounts(counts: ArrayLike<number>, n: number): RouletteNumber[] {
  const top: RouletteNumber[] = [];
  for (let num = 1; num <= 36; num += 1) {
    const value = counts[num];
    if (value <= 0) continue;
    let insertAt = top.length;
    for (let index = 0; index < top.length; index += 1) {
      const current = top[index];
      if (value > counts[current] || (value === counts[current] && num < current)) {
        insertAt = index;
        break;
      }
    }
    top.splice(insertAt, 0, num as RouletteNumber);
    if (top.length > n) top.pop();
  }
  return top;
}

const LONG_WARMUP = 148;
const ACCEL_WINDOW = 148;
const SEG_SIZE = 49;
const SHORT_WARMUP = 111;
const ADAPTIVE_LOOKBACK = 90;
const ADAPTIVE_MIN_SHORT_SIGNALS = 5;
const ADAPTIVE_MIN_SHORT_ROI = -40;
const ADAPTIVE_SHORT_EDGE = -60;

function selectLong(numbers: readonly RouletteNumber[], end = numbers.length): RouletteNumber | null {
  if (end < LONG_WARMUP) return null;
  const start = end - ACCEL_WINDOW;
  const count148 = new Uint8Array(37);
  const count74 = new Uint8Array(37);
  const count20 = new Uint8Array(37);
  const seg1Counts = new Uint8Array(37);
  const seg2Counts = new Uint8Array(37);
  const seg3Counts = new Uint8Array(37);

  for (let i = start; i < end; i += 1) {
    const num = numbers[i];
    if (num === 0) continue;
    count148[num] += 1;
    if (i >= end - 74) count74[num] += 1;
    if (i >= end - 20) count20[num] += 1;
    if (i < start + SEG_SIZE) {
      seg1Counts[num] += 1;
    } else if (i < start + SEG_SIZE * 2) {
      seg2Counts[num] += 1;
    } else {
      seg3Counts[num] += 1;
    }
  }

  const top10 = topNFromCounts(count148, 10);
  let bestNum: RouletteNumber | null = null;
  let bestCount = 0;
  let bestDiff = 0;

  for (const num of top10) {
    const seg1 = seg1Counts[num];
    const seg2 = seg2Counts[num];
    const seg3 = seg3Counts[num];
    if (!(seg3 > seg2 && seg2 > seg1)) continue;
    if (count20[num] >= 4) continue;
    const cnt = count74[num];
    const diff = seg3 - seg1;
    if (cnt > bestCount || (cnt === bestCount && diff > bestDiff)) {
      bestNum = num;
      bestCount = cnt;
      bestDiff = diff;
    }
  }
  return bestNum;
}

function selectShort(numbers: readonly RouletteNumber[], end = numbers.length): RouletteNumber | null {
  if (end < SHORT_WARMUP) return null;
  const count37 = new Uint8Array(37);
  const count74 = new Uint8Array(37);
  const count111 = new Uint8Array(37);
  const count20 = new Uint8Array(37);
  const firstHalf37 = new Uint8Array(37);
  const secondHalf37 = new Uint8Array(37);
  const start111 = end - 111;
  const start74 = end - 74;
  const start37 = end - 37;
  const mid37 = start37 + 18;

  for (let i = start111; i < end; i += 1) {
    const num = numbers[i];
    if (num === 0) continue;
    count111[num] += 1;
    if (i >= start74) count74[num] += 1;
    if (i >= start37) {
      count37[num] += 1;
      if (i < mid37) {
        firstHalf37[num] += 1;
      } else {
        secondHalf37[num] += 1;
      }
    }
    if (i >= end - 20) count20[num] += 1;
  }

  const h37 = new Set(topNFromCounts(count37, 5));
  const h74 = new Set(topNFromCounts(count74, 5));
  const h111 = new Set(topNFromCounts(count111, 5));
  const candidates = [...h37].filter((n) => h74.has(n) && h111.has(n));
  const trending = candidates.filter((n) => secondHalf37[n] > firstHalf37[n]);
  const filtered = trending.filter((n) => count20[n] < 4);
  if (filtered.length === 0) return null;
  return filtered.sort((a, b) => count37[b] - count37[a])[0];
}

function precomputePicks(numbers: readonly RouletteNumber[]): CachedPicks {
  const n = numbers.length;
  const longPicks: Array<RouletteNumber | null> = new Array(n + 1).fill(null);
  const shortPicks: Array<RouletteNumber | null> = new Array(n + 1).fill(null);
  for (let i = LONG_WARMUP; i <= n; i += 1) longPicks[i] = selectLong(numbers, i);
  for (let i = SHORT_WARMUP; i <= n; i += 1) shortPicks[i] = selectShort(numbers, i);
  return { longPicks, shortPicks };
}

function netRoiPercent(nets: readonly number[]): number {
  return nets.length > 0 ? (nets.reduce((sum, net) => sum + net, 0) / nets.length) * 100 : 0;
}

function isHotEnvironmentAllowed(preNets: readonly number[]): boolean {
  if (preNets.length === 0) return true;
  const overallRoi = netRoiPercent(preNets);
  const splitIndex = Math.floor(preNets.length / 2);
  const earlyRoi = netRoiPercent(preNets.slice(0, splitIndex));
  const lateRoi = netRoiPercent(preNets.slice(splitIndex));
  return overallRoi < 0 && lateRoi >= earlyRoi;
}

function adaptivePick(
  numbers: readonly RouletteNumber[],
  longPick: RouletteNumber | null,
  shortPick: RouletteNumber | null,
  longCnt: number,
  longNet: number,
  shortCnt: number,
  shortNet: number,
): { number: RouletteNumber; mode: Mode } | null {
  if (longPick === null && shortPick === null) return null;
  const shortRoi = shortCnt > 0 ? (shortNet / shortCnt) * 100 : -999;
  const longRoi = longCnt > 0 ? (longNet / longCnt) * 100 : -999;
  const preferShort = shortCnt >= ADAPTIVE_MIN_SHORT_SIGNALS
    && shortRoi >= ADAPTIVE_MIN_SHORT_ROI
    && shortRoi >= longRoi + ADAPTIVE_SHORT_EDGE;

  if (preferShort) {
    if (shortPick !== null) return { number: shortPick, mode: "short" };
    if (longPick !== null) return { number: longPick, mode: "long" };
  } else {
    if (longPick !== null) return { number: longPick, mode: "long" };
    if (shortPick !== null) return { number: shortPick, mode: "short" };
  }

  return null;
}

function buildBaselineHotEvents(session: Session): HotEvent[] {
  const numbers = session.numbers;
  const { longPicks, shortPicks } = precomputePicks(numbers);
  const events: HotEvent[] = [];
  const preEnvironmentNets: number[] = [];
  let environmentEvaluated = false;
  let environmentAllowsSignals = true;
  let longCnt = 0;
  let longNet = 0;
  let shortCnt = 0;
  let shortNet = 0;
  const longQueue: Array<{ index: number; net: number }> = [];
  const shortQueue: Array<{ index: number; net: number }> = [];
  let longQueueStart = 0;
  let shortQueueStart = 0;

  function pushPaper(longN: number | null, shortN: number | null, outcomeIdx: number): void {
    if (longN !== null) {
      const net = numbers[outcomeIdx] === longN ? 35 : -1;
      longQueue.push({ index: outcomeIdx, net });
      longNet += net;
      longCnt += 1;
    }
    if (shortN !== null && outcomeIdx >= SHORT_WARMUP) {
      const net = numbers[outcomeIdx] === shortN ? 35 : -1;
      shortQueue.push({ index: outcomeIdx, net });
      shortNet += net;
      shortCnt += 1;
    }
  }

  function trimPaper(minOutcomeIndex: number): void {
    while (longQueueStart < longQueue.length && longQueue[longQueueStart].index < minOutcomeIndex) {
      longNet -= longQueue[longQueueStart].net;
      longCnt -= 1;
      longQueueStart += 1;
    }
    while (shortQueueStart < shortQueue.length && shortQueue[shortQueueStart].index < minOutcomeIndex) {
      shortNet -= shortQueue[shortQueueStart].net;
      shortCnt -= 1;
      shortQueueStart += 1;
    }
  }

  for (let i = LONG_WARMUP; i < numbers.length; i += 1) {
    if (i > LONG_WARMUP) pushPaper(longPicks[i - 1], shortPicks[i - 1], i - 1);
    trimPaper(Math.max(LONG_WARMUP, i - ADAPTIVE_LOOKBACK));

    if (i < ROI_START && shortPicks[i] !== null) {
      preEnvironmentNets.push(numbers[i] === shortPicks[i] ? 35 : -1);
    }
    if (!environmentEvaluated && i >= ROI_START) {
      environmentAllowsSignals = isHotEnvironmentAllowed(preEnvironmentNets);
      environmentEvaluated = true;
    }

    const pick = adaptivePick(numbers, longPicks[i], shortPicks[i], longCnt, longNet, shortCnt, shortNet);
    if (pick === null) continue;
    if (i >= ROI_START && !environmentAllowsSignals) continue;

    const hit = numbers[i] === pick.number;
    events.push({
      sessionId: session.id,
      sessionName: session.name,
      index: i,
      mode: pick.mode,
      pick: pick.number,
      result: numbers[i],
      hit,
      net: hit ? 35 : -1,
    });
  }

  return events;
}

function summarize(events: readonly HotEvent[]): Summary {
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let hits = 0;
  for (const event of events) {
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
    if (event.hit) hits += 1;
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
  };
}

function allowByFilter(level: HotTableSupportLevel | undefined, filter: string): boolean {
  if (filter === "strong") return level === "strong";
  if (filter === "support") return level === "strong" || level === "support";
  if (filter === "watch") return level === "strong" || level === "support" || level === "watch";
  if (filter === "notConflict") return level !== undefined && level !== "conflict" && level !== "unknown" && level !== "none";
  return true;
}

function profileTables(autoSessions: readonly TableProfileSession[]): TableProfileTable[] {
  const ids = [...new Set(autoSessions.map((session) => session.tableId).filter((id): id is string => Boolean(id)))];
  return ids.map((id) => ({ id, name: id, parentId: "auto" }));
}

function assignAutoTable(
  session: Session,
  assigned: readonly TableProfileSession[],
  nextClusterNumber: number,
): { tableId: string; nextClusterNumber: number; matchLevel: string; similarity: number; gap: number } {
  const profiles = buildTableProfiles(assigned, profileTables(assigned));
  if (profiles.length === 0) {
    return { tableId: `auto_${String(nextClusterNumber).padStart(2, "0")}`, nextClusterNumber: nextClusterNumber + 1, matchLevel: "new", similarity: 0, gap: 0 };
  }
  const match = matchTableProfile(session.numbers, profiles);
  if (match.profile && (match.level === "confirmed" || match.level === "probable")) {
    return { tableId: match.profile.tableId, nextClusterNumber, matchLevel: match.level, similarity: match.similarity, gap: match.gap };
  }
  return { tableId: `auto_${String(nextClusterNumber).padStart(2, "0")}`, nextClusterNumber: nextClusterNumber + 1, matchLevel: match.level, similarity: match.similarity, gap: match.gap };
}

function annotateEventsWithProfiles(
  session: Session,
  events: readonly HotEvent[],
  assigned: readonly TableProfileSession[],
  forcedTableId?: string,
): HotEvent[] {
  const profiles = buildTableProfiles(assigned, profileTables(assigned));
  return events.map((event) => {
    const prefix = session.numbers.slice(0, event.index);
    const support = evaluateHotNumberTableSupport(prefix, event.pick, profiles, forcedTableId);
    return {
      ...event,
      support: support.level,
      tableId: support.profile?.tableId,
      reason: support.reason,
    };
  });
}

function runAutoProfileSimulation(sessions: readonly Session[]): {
  allEvents: HotEvent[];
  annotatedEvents: HotEvent[];
  assignments: Array<{ name: string; manual: string; auto: string; matchLevel: string; similarity: number; gap: number; profilesBefore: number }>;
} {
  const allEvents: HotEvent[] = [];
  const annotatedEvents: HotEvent[] = [];
  const assignments: Array<{ name: string; manual: string; auto: string; matchLevel: string; similarity: number; gap: number; profilesBefore: number }> = [];
  const assigned: TableProfileSession[] = [];
  let nextClusterNumber = 1;

  for (const session of sessions) {
    const profilesBefore = buildTableProfiles(assigned, profileTables(assigned)).length;
    const baselineEvents = buildBaselineHotEvents(session);
    allEvents.push(...baselineEvents);
    annotatedEvents.push(...annotateEventsWithProfiles(session, baselineEvents, assigned));

    const assignment = assignAutoTable(session, assigned, nextClusterNumber);
    nextClusterNumber = assignment.nextClusterNumber;
    assigned.push({ id: session.id, name: session.name, numbers: session.numbers, tableId: assignment.tableId });
    assignments.push({
      name: session.name,
      manual: session.manualTable,
      auto: assignment.tableId,
      matchLevel: assignment.matchLevel,
      similarity: assignment.similarity,
      gap: assignment.gap,
      profilesBefore,
    });
  }

  return { allEvents, annotatedEvents, assignments };
}

function runManualKnownUpperBound(sessions: readonly Session[]): HotEvent[] {
  const assigned: TableProfileSession[] = [];
  const out: HotEvent[] = [];
  for (const session of sessions) {
    const baselineEvents = buildBaselineHotEvents(session);
    const knownProfiles = assigned.filter((item) => item.tableId === session.manualTable);
    out.push(...annotateEventsWithProfiles(session, baselineEvents, knownProfiles, session.manualTable));
    assigned.push({ id: session.id, name: session.name, numbers: session.numbers, tableId: session.manualTable });
  }
  return out;
}

function fmtSummary(summary: Summary): string {
  return [
    `sig=${String(summary.signals).padStart(4)}`,
    `hit=${String(summary.hits).padStart(3)}`,
    `net=${String(summary.net).padStart(5)}`,
    `ROI=${summary.roi.toFixed(2).padStart(7)}%`,
    `WR=${summary.wr.toFixed(2).padStart(6)}%`,
    `DD=${String(summary.maxDrawdown).padStart(4)}`,
  ].join(" ");
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

function printComparison(label: string, events: readonly HotEvent[]): void {
  const from201 = events.filter((event) => event.index >= ROI_START);
  console.log(`${label.padEnd(26)} all ${fmtSummary(summarize(events))} | 200+ ${fmtSummary(summarize(from201))}`);
}

function printFilterSet(label: string, events: readonly HotEvent[]): void {
  printComparison(`${label}: strong`, events.filter((event) => allowByFilter(event.support, "strong")));
  printComparison(`${label}: support+`, events.filter((event) => allowByFilter(event.support, "support")));
  printComparison(`${label}: watch+`, events.filter((event) => allowByFilter(event.support, "watch")));
}

function printHybridSet(label: string, events: readonly HotEvent[]): void {
  const supportOrUnknown = events.filter((event) => (
    event.support === "strong"
    || event.support === "support"
    || event.support === "unknown"
    || event.support === "none"
    || event.support === undefined
  ));
  const rejectConflictOnly = events.filter((event) => event.support !== "conflict");
  printComparison(`${label}: support/unknown`, supportOrUnknown);
  printComparison(`${label}: reject conflict`, rejectConflictOnly);
}

const sessions = loadTargetSessions();
const auto = runAutoProfileSimulation(sessions);
const manualUpper = runManualKnownUpperBound(sessions);

console.log(`Loaded target sessions: ${sessions.length}`);
console.log(`Total spins: ${sessions.reduce((sum, session) => sum + session.numbers.length, 0)}`);
console.log("\n=== Chronological sessions ===");
sessions.forEach((session, index) => {
  console.log(`${String(index + 1).padStart(2)} ${session.sortDate} ${String(session.sortOrder).padStart(6)} ${session.name.padEnd(24)} n=${String(session.numbers.length).padStart(3)} manual=${session.manualTable || "-"}`);
});

console.log("\n=== Auto table assignment ===");
auto.assignments.forEach((row, index) => {
  console.log(
    `${String(index + 1).padStart(2)} ${row.name.padEnd(24)} manual=${(row.manual || "-").padEnd(14)} auto=${row.auto.padEnd(8)} before=${row.profilesBefore} level=${row.matchLevel.padEnd(9)} sim=${row.similarity.toFixed(3)} gap=${row.gap.toFixed(3)}`,
  );
});

console.log("\n=== ROI comparison: current hot-number signal ===");
printComparison("baseline no table", auto.allEvents);
printFilterSet("auto profile", auto.annotatedEvents);
printHybridSet("auto hybrid", auto.annotatedEvents);
printFilterSet("manual upper", manualUpper);
printHybridSet("manual hybrid", manualUpper);

console.log("\n=== Support distribution, auto profile ===");
const bySupport = groupBy(auto.annotatedEvents, (event) => event.support ?? "undefined");
for (const key of ["strong", "support", "watch", "conflict", "unknown", "none", "undefined"]) {
  const rows = bySupport.get(key) ?? [];
  if (rows.length === 0) continue;
  console.log(`${key.padEnd(10)} all ${fmtSummary(summarize(rows))} | 200+ ${fmtSummary(summarize(rows.filter((event) => event.index >= ROI_START)))}`);
}

console.log("\n=== Auto cluster composition ===");
const assignmentByCluster = groupBy(auto.assignments, (row) => row.auto);
for (const [cluster, rows] of assignmentByCluster) {
  const manualCounts = [...groupBy(rows, (row) => row.manual || "-").entries()]
    .map(([manual, items]) => `${manual}:${items.length}`)
    .join(" ");
  console.log(`${cluster.padEnd(8)} n=${rows.length} ${manualCounts}`);
}

console.log("\n=== 200+ per session: baseline vs auto support+ ===");
const baselineBySession = groupBy(auto.allEvents.filter((event) => event.index >= ROI_START), (event) => event.sessionName);
const supportBySession = groupBy(auto.annotatedEvents.filter((event) => event.index >= ROI_START && allowByFilter(event.support, "support")), (event) => event.sessionName);
for (const session of sessions) {
  const base = summarize(baselineBySession.get(session.name) ?? []);
  const prof = summarize(supportBySession.get(session.name) ?? []);
  console.log(`${session.name.padEnd(24)} base ${fmtSummary(base)} | auto-support ${fmtSummary(prof)}`);
}
