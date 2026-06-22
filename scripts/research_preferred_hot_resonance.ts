import fs from "node:fs";
import path from "node:path";
import { analyzeHotNumbers } from "../app/src/core/hotNumbers";
import { buildTableProfiles, matchTableProfile, type TableProfile, type TableProfileSession, type TableProfileTable } from "../app/src/core/tableHotProfile";
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

const WHEEL_INDEX = new Map<RouletteNumber, number>(WHEEL_ORDER.map((number, index) => [number, index]));

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

interface TableTransitionStats {
  counts: number[][];
  totals: number[];
}

interface ProfileContext {
  profiles: TableProfile[];
  transitionsByTable: Map<string, TableTransitionStats>;
}

interface PreferredEvent {
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

interface HotEvent {
  sessionId: string;
  sessionName: string;
  index: number;
  pick: RouletteNumber;
  mode: "long" | "short";
  result: RouletteNumber;
  bet: number;
  win: number;
  hit: boolean;
}

interface ComboEvent {
  sessionId: string;
  sessionName: string;
  tableId?: string;
  index: number;
  pick: RouletteNumber;
  result: RouletteNumber;
  bet: number;
  win: number;
  hit: boolean;
  source: string;
  hotMode?: "long" | "short";
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

function makeProfileContext(priorSessions: readonly Session[]): ProfileContext {
  const profileSessions = priorSessions
    .filter((session) => session.manualTableId)
    .map((session) => ({
      id: session.id,
      name: session.name,
      numbers: session.numbers,
      tableId: session.manualTableId,
    }));
  return {
    profiles: buildTableProfiles(profileSessions, TABLES),
    transitionsByTable: makeTransitionStats(profileSessions),
  };
}

function chooseBaselinePicks(replayCounts: readonly number[][], previous: RouletteNumber): RouletteNumber[] {
  return getMarkovTopNumbers(replayCounts, previous, PICK_COUNT);
}

function chooseTableBlendPicks(
  replayCounts: readonly number[][],
  previous: RouletteNumber,
  prefix: readonly RouletteNumber[],
  currentTableId: string | undefined,
  context: ProfileContext,
): RouletteNumber[] {
  const match = matchTableProfile(prefix, context.profiles, currentTableId);
  const profile = match.profile;
  if (!profile) return chooseBaselinePicks(replayCounts, previous);

  const tableTransitions = context.transitionsByTable.get(profile.tableId);
  const prevTotal = tableTransitions?.totals[previous] ?? 0;
  if (!tableTransitions || prevTotal < 2) return chooseBaselinePicks(replayCounts, previous);

  const alpha = 4;
  const scores = Array.from({ length: 37 }, (_, number) =>
    replayCounts[previous][number] + alpha * (tableTransitions.counts[previous][number] / prevTotal),
  );
  return topNumbersFromScores(scores, PICK_COUNT);
}

function replayPreferredSession(
  session: Session,
  context: ProfileContext | null,
  tableBlend: boolean,
): PreferredEvent[] {
  const replayCounts = createTransitionCounts();
  const basePaperHits: boolean[] = [];
  const variantPaperHits: boolean[] = [];
  const events: PreferredEvent[] = [];
  let cooldown = 0;

  for (let index = 1; index < session.numbers.length; index += 1) {
    const previous = session.numbers[index - 1];
    const result = session.numbers[index];
    const prefix = session.numbers.slice(0, index);
    const basePicks = chooseBaselinePicks(replayCounts, previous);
    const picks = tableBlend && context
      ? chooseTableBlendPicks(replayCounts, previous, prefix, session.manualTableId, context)
      : basePicks;
    const paperGate = tableBlend ? variantPaperHits : basePaperHits;
    const zoneHits = countRecentZoneHits(session.numbers, index, previous);
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

function replayPreferredWalkForward(sessions: readonly Session[], tableBlend: boolean): PreferredEvent[] {
  const events: PreferredEvent[] = [];
  for (let sessionIndex = 0; sessionIndex < sessions.length; sessionIndex += 1) {
    const prior = sessions.slice(0, sessionIndex);
    events.push(...replayPreferredSession(
      sessions[sessionIndex],
      tableBlend ? makeProfileContext(prior) : null,
      tableBlend,
    ));
  }
  return events;
}

function replayHot(sessions: readonly Session[]): HotEvent[] {
  const events: HotEvent[] = [];
  for (const session of sessions) {
    const analysis = analyzeHotNumbers(session.numbers, ROI_START);
    for (const event of analysis.events) {
      if (event.position < ROI_START) continue;
      events.push({
        sessionId: session.id,
        sessionName: session.name,
        index: event.position,
        pick: event.signal.number,
        mode: event.signal.mode,
        result: session.numbers[event.position],
        bet: 1,
        win: event.hit ? PAY : 0,
        hit: event.hit,
      });
    }
  }
  return events;
}

function maxDrawdown(events: readonly { win: number; bet: number }[]): number {
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

function summarize(events: readonly { sessionId: string; bet: number; win: number; hit: boolean }[], sessions: readonly Session[]): Summary {
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

function makeIndexKey(sessionId: string, index: number): string {
  return `${sessionId}:${index}`;
}

function resonanceSameSpin(preferred: readonly PreferredEvent[], hot: readonly HotEvent[], source: string): ComboEvent[] {
  const hotByIndex = new Map(hot.map((event) => [makeIndexKey(event.sessionId, event.index), event]));
  const events: ComboEvent[] = [];
  for (const pref of preferred) {
    const hotEvent = hotByIndex.get(makeIndexKey(pref.sessionId, pref.index));
    if (!hotEvent) continue;
    if (!pref.picks.includes(hotEvent.pick)) continue;
    const hit = hotEvent.result === hotEvent.pick;
    events.push({
      sessionId: pref.sessionId,
      sessionName: pref.sessionName,
      tableId: pref.tableId,
      index: pref.index,
      pick: hotEvent.pick,
      result: hotEvent.result,
      bet: 1,
      win: hit ? PAY : 0,
      hit,
      source,
      hotMode: hotEvent.mode,
    });
  }
  return events;
}

function resonanceSameSpinNear(preferred: readonly PreferredEvent[], hot: readonly HotEvent[], radius: number, source: string): ComboEvent[] {
  const hotByIndex = new Map(hot.map((event) => [makeIndexKey(event.sessionId, event.index), event]));
  const events: ComboEvent[] = [];
  for (const pref of preferred) {
    const hotEvent = hotByIndex.get(makeIndexKey(pref.sessionId, pref.index));
    if (!hotEvent) continue;
    const nearest = pref.picks
      .map((pick) => ({ pick, distance: wheelDistance(pick, hotEvent.pick) }))
      .sort((left, right) => left.distance - right.distance || left.pick - right.pick)[0];
    if (!nearest || nearest.distance > radius) continue;
    const hit = hotEvent.result === hotEvent.pick;
    events.push({
      sessionId: pref.sessionId,
      sessionName: pref.sessionName,
      tableId: pref.tableId,
      index: pref.index,
      pick: hotEvent.pick,
      result: hotEvent.result,
      bet: 1,
      win: hit ? PAY : 0,
      hit,
      source,
      hotMode: hotEvent.mode,
    });
  }
  return events;
}

function resonanceSameSpinNearBetPreferred(
  preferred: readonly PreferredEvent[],
  hot: readonly HotEvent[],
  radius: number,
  source: string,
): ComboEvent[] {
  const hotByIndex = new Map(hot.map((event) => [makeIndexKey(event.sessionId, event.index), event]));
  const events: ComboEvent[] = [];
  for (const pref of preferred) {
    const hotEvent = hotByIndex.get(makeIndexKey(pref.sessionId, pref.index));
    if (!hotEvent) continue;
    const nearest = pref.picks
      .map((pick) => ({ pick, distance: wheelDistance(pick, hotEvent.pick) }))
      .sort((left, right) => left.distance - right.distance || left.pick - right.pick)[0];
    if (!nearest || nearest.distance > radius) continue;
    const hit = hotEvent.result === nearest.pick;
    events.push({
      sessionId: pref.sessionId,
      sessionName: pref.sessionName,
      tableId: pref.tableId,
      index: pref.index,
      pick: nearest.pick,
      result: hotEvent.result,
      bet: 1,
      win: hit ? PAY : 0,
      hit,
      source,
      hotMode: hotEvent.mode,
    });
  }
  return events;
}

function resonanceDistanceRangeBetPreferred(
  preferred: readonly PreferredEvent[],
  hot: readonly HotEvent[],
  minDistance: number,
  maxDistance: number,
  source: string,
): ComboEvent[] {
  const hotByIndex = new Map(hot.map((event) => [makeIndexKey(event.sessionId, event.index), event]));
  const events: ComboEvent[] = [];
  for (const pref of preferred) {
    const hotEvent = hotByIndex.get(makeIndexKey(pref.sessionId, pref.index));
    if (!hotEvent) continue;
    const nearest = pref.picks
      .map((pick) => ({ pick, distance: wheelDistance(pick, hotEvent.pick) }))
      .sort((left, right) => left.distance - right.distance || left.pick - right.pick)[0];
    if (!nearest || nearest.distance < minDistance || nearest.distance > maxDistance) continue;
    const hit = hotEvent.result === nearest.pick;
    events.push({
      sessionId: pref.sessionId,
      sessionName: pref.sessionName,
      tableId: pref.tableId,
      index: pref.index,
      pick: nearest.pick,
      result: hotEvent.result,
      bet: 1,
      win: hit ? PAY : 0,
      hit,
      source,
      hotMode: hotEvent.mode,
    });
  }
  return events;
}

function resonanceFilteredPreferredBet(preferred: readonly PreferredEvent[], hot: readonly HotEvent[], source: string): ComboEvent[] {
  const hotByIndex = new Map(hot.map((event) => [makeIndexKey(event.sessionId, event.index), event]));
  const events: ComboEvent[] = [];
  for (const pref of preferred) {
    const hotEvent = hotByIndex.get(makeIndexKey(pref.sessionId, pref.index));
    if (!hotEvent || !pref.picks.includes(hotEvent.pick)) continue;
    events.push({
      sessionId: pref.sessionId,
      sessionName: pref.sessionName,
      tableId: pref.tableId,
      index: pref.index,
      pick: hotEvent.pick,
      result: pref.result,
      bet: pref.bet,
      win: pref.win,
      hit: pref.hit,
      source,
      hotMode: hotEvent.mode,
    });
  }
  return events;
}

function bothActiveDifferent(preferred: readonly PreferredEvent[], hot: readonly HotEvent[], source: string): ComboEvent[] {
  const hotByIndex = new Map(hot.map((event) => [makeIndexKey(event.sessionId, event.index), event]));
  const events: ComboEvent[] = [];
  for (const pref of preferred) {
    const hotEvent = hotByIndex.get(makeIndexKey(pref.sessionId, pref.index));
    if (!hotEvent || pref.picks.includes(hotEvent.pick)) continue;
    const hit = pref.hit;
    events.push({
      sessionId: pref.sessionId,
      sessionName: pref.sessionName,
      tableId: pref.tableId,
      index: pref.index,
      pick: pref.picks[0],
      result: pref.result,
      bet: pref.bet,
      win: pref.win,
      hit,
      source,
      hotMode: hotEvent.mode,
    });
  }
  return events;
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function printSummary(title: string, rows: Array<{ label: string; events: readonly { sessionId: string; bet: number; win: number; hit: boolean }[] }>, sessions: readonly Session[]): void {
  console.log(`\n## ${title}`);
  console.log("label\tsignals\tbet\tnet\tROI\thit%\tDD\tsess+\tsess-\tworst\tbest");
  for (const row of rows) {
    const s = summarize(row.events, sessions);
    console.log([
      row.label,
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

function breakdownByMonth(events: readonly ComboEvent[], sessions: readonly Session[]): void {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const grouped = new Map<string, ComboEvent[]>();
  for (const event of events) {
    const month = sessionById.get(event.sessionId)?.sortDate.slice(0, 7) ?? "unknown";
    grouped.set(month, [...(grouped.get(month) ?? []), event]);
  }
  console.log("month\tsignals\tbet\tnet\tROI\thit%");
  for (const [month, rows] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = summarize(rows, []);
    console.log([month, s.signals, s.bet, s.net, fmtPct(s.roi), fmtPct(s.wr)].join("\t"));
  }
}

function breakdownByTable(events: readonly ComboEvent[]): void {
  const grouped = new Map<string, ComboEvent[]>();
  for (const event of events) {
    const table = event.tableId ?? "unknown";
    grouped.set(table, [...(grouped.get(table) ?? []), event]);
  }
  console.log("table\tsignals\tbet\tnet\tROI\thit%");
  for (const [table, rows] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = summarize(rows, []);
    console.log([table, s.signals, s.bet, s.net, fmtPct(s.roi), fmtPct(s.wr)].join("\t"));
  }
}

function breakdownByHotMode(events: readonly ComboEvent[]): void {
  const grouped = new Map<string, ComboEvent[]>();
  for (const event of events) {
    const mode = event.hotMode ?? "unknown";
    grouped.set(mode, [...(grouped.get(mode) ?? []), event]);
  }
  console.log("hotMode\tsignals\tbet\tnet\tROI\thit%");
  for (const [mode, rows] of [...grouped.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const s = summarize(rows, []);
    console.log([mode, s.signals, s.bet, s.net, fmtPct(s.roi), fmtPct(s.wr)].join("\t"));
  }
}

function breakdownByWheelDistance(preferred: readonly PreferredEvent[], hot: readonly HotEvent[]): void {
  const hotByIndex = new Map(hot.map((event) => [makeIndexKey(event.sessionId, event.index), event]));
  const hotBetRows = new Map<number, ComboEvent[]>();
  const prefBetRows = new Map<number, ComboEvent[]>();
  for (const pref of preferred) {
    const hotEvent = hotByIndex.get(makeIndexKey(pref.sessionId, pref.index));
    if (!hotEvent) continue;
    const nearest = pref.picks
      .map((pick) => ({ pick, distance: wheelDistance(pick, hotEvent.pick) }))
      .sort((left, right) => left.distance - right.distance || left.pick - right.pick)[0];
    if (!nearest) continue;
    const hotHit = hotEvent.result === hotEvent.pick;
    const prefHit = hotEvent.result === nearest.pick;
    const hotRow: ComboEvent = {
      sessionId: pref.sessionId,
      sessionName: pref.sessionName,
      tableId: pref.tableId,
      index: pref.index,
      pick: hotEvent.pick,
      result: hotEvent.result,
      bet: 1,
      win: hotHit ? PAY : 0,
      hit: hotHit,
      source: "distanceHot",
      hotMode: hotEvent.mode,
    };
    const prefRow: ComboEvent = {
      ...hotRow,
      pick: nearest.pick,
      win: prefHit ? PAY : 0,
      hit: prefHit,
      source: "distancePref",
    };
    hotBetRows.set(nearest.distance, [...(hotBetRows.get(nearest.distance) ?? []), hotRow]);
    prefBetRows.set(nearest.distance, [...(prefBetRows.get(nearest.distance) ?? []), prefRow]);
  }
  console.log("dist\tsignals\thotNet\thotROI\tprefNet\tprefROI");
  const distances = [...new Set([...hotBetRows.keys(), ...prefBetRows.keys()])].sort((a, b) => a - b);
  for (const distance of distances) {
    const hotSummary = summarize(hotBetRows.get(distance) ?? [], []);
    const prefSummary = summarize(prefBetRows.get(distance) ?? [], []);
    console.log([
      distance,
      hotSummary.signals,
      hotSummary.net,
      fmtPct(hotSummary.roi),
      prefSummary.net,
      fmtPct(prefSummary.roi),
    ].join("\t"));
  }
}

function runSet(label: string, sessions: readonly Session[]): void {
  const preferredBase = replayPreferredWalkForward(sessions, false);
  const preferredTable = replayPreferredWalkForward(sessions, true);
  const hot = replayHot(sessions);
  const baseSame = resonanceSameSpin(preferredBase, hot, "baseSame");
  const tableSame = resonanceSameSpin(preferredTable, hot, "tableSame");
  const baseNear1 = resonanceSameSpinNear(preferredBase, hot, 1, "baseNear1");
  const tableNear1 = resonanceSameSpinNear(preferredTable, hot, 1, "tableNear1");
  const tableNear2 = resonanceSameSpinNear(preferredTable, hot, 2, "tableNear2");
  const tableNear1BetPref = resonanceSameSpinNearBetPreferred(preferredTable, hot, 1, "tableNear1BetPref");
  const tableNear2BetPref = resonanceSameSpinNearBetPreferred(preferredTable, hot, 2, "tableNear2BetPref");
  const tableDist1to2BetPref = resonanceDistanceRangeBetPreferred(preferredTable, hot, 1, 2, "tableDist1to2BetPref");
  const tableDist2BetPref = resonanceDistanceRangeBetPreferred(preferredTable, hot, 2, 2, "tableDist2BetPref");
  const tableSameBetBothPref = resonanceFilteredPreferredBet(preferredTable, hot, "tableSameBetBothPref");
  const tableBothDifferent = bothActiveDifferent(preferredTable, hot, "bothDifferent");

  printSummary(label, [
    { label: "preferred baseline", events: preferredBase },
    { label: "preferred tableBlend", events: preferredTable },
    { label: "hot baseline", events: hot },
    { label: "base same-number resonance", events: baseSame },
    { label: "table same-number resonance", events: tableSame },
    { label: "base near<=1 resonance", events: baseNear1 },
    { label: "table near<=1 resonance", events: tableNear1 },
    { label: "table near<=2 resonance", events: tableNear2 },
    { label: "table near<=1 bet preferred", events: tableNear1BetPref },
    { label: "table near<=2 bet preferred", events: tableNear2BetPref },
    { label: "table dist 1-2 bet preferred", events: tableDist1to2BetPref },
    { label: "table dist 2 bet preferred", events: tableDist2BetPref },
    { label: "table same but bet both preferred", events: tableSameBetBothPref },
    { label: "both active but different", events: tableBothDifferent },
  ], sessions);

  console.log(`\n### ${label} detail: table same-number resonance`);
  breakdownByMonth(tableSame, sessions);
  breakdownByTable(tableSame);

  console.log(`\n### ${label} detail: table near<=1 resonance`);
  breakdownByMonth(tableNear1, sessions);
  breakdownByTable(tableNear1);

  console.log(`\n### ${label} detail: table near<=2 resonance`);
  breakdownByMonth(tableNear2, sessions);
  breakdownByTable(tableNear2);
  breakdownByHotMode(tableNear2);

  console.log(`\n### ${label} distance distribution: table preferred vs hot`);
  breakdownByWheelDistance(preferredTable, hot);
}

const allSessions = loadSessions();
const target22 = allSessions.filter((session) => session.sortDate >= "2026-04-01" && session.sortDate < "2026-07-01");
const beforeTarget22 = allSessions.filter((session) => session.sortDate < "2026-04-01");

console.log(`Loaded sessions: all=${allSessions.length}, target22=${target22.length}`);
runSet("All76 200+ preferred/hot resonance", allSessions);
runSet("Before2026-04 200+ preferred/hot resonance", beforeTarget22);
runSet("Target22 200+ preferred/hot resonance", target22);
