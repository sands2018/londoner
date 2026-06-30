import fs from "node:fs";
import path from "node:path";
import { getHistorySortInfo } from "./historyTime";
import { buildAutoTableProfileState } from "../app/src/core/autoTableProfile";
import { buildTableProfiles, matchTableProfile, type TableProfileSession, type TableProfileTable } from "../app/src/core/tableHotProfile";
import {
  getGroupIndex,
  getNumberColRows,
  getRowIndex,
  type RouletteNumber,
} from "../app/src/core/roulette";
import {
  analyzeQuality124,
  QUALITY_124_TIER_ORDER,
  type Quality124Kind,
  type Quality124Tier,
} from "../app/src/core/quality124";
import {
  computeRoi,
  GAP_WINDOW,
  EXTREME_BUFFER,
  EXTREME_PCT,
  MIN_GAP,
  PROGRESSION,
  CHASE_LENGTH,
} from "../app/src/core/prediction";
import {
  analyzeChaseSixRolling,
  chaseSixWindowEnd,
  chaseSixWindowStart,
  CHASE6_CHASE_LEN,
  CHASE6_MAX_GAP,
  CHASE6_MIN_APPEARANCES,
  CHASE6_MIN_GAP,
  CHASE6_PROGRESSION,
  CHASE6_STRONG_APPEARANCES,
  CHASE6_WAVE_AVG5_MAX,
  CHASE6_WAVE_LONG20_RATE10_MAX,
  CHASE6_WINDOWS,
  isInChaseSixWindow,
} from "../app/src/core/chaseSix";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const ROI_START = 200;
const HISTORY_WINDOW = 200;

type Strategy = "quality124" | "cold" | "chase6";
type TableMode = "auto" | "manual";
type FilterKind = "tableOverall" | "entity" | "tier" | "tierEntity" | "strongEntity";

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
  updatedTms: number;
  importIndex: number;
  manualTableId?: string;
}

interface ParsedSession extends Session {
  sortDate: string;
  sortMinute: number;
  sortTie: number;
  sourceIndex: number;
}

interface StrategyEvent {
  strategy: Strategy;
  sessionId: string;
  sessionName: string;
  startIndex: number;
  settleIndex: number;
  key: string;
  altKey?: string;
  tier?: string;
  tableId?: string;
  bet: number;
  win: number;
  hit: boolean;
}

interface Summary {
  signals: number;
  bet: number;
  win: number;
  net: number;
  roi: number;
  hits: number;
  wr: number;
  dd: number;
}

interface FilterConfig {
  name: string;
  kind: FilterKind;
  minSignals: number;
  minRoi: number;
  keepUnknown: boolean;
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
    : String(raw ?? "").split(/[,，\s]+/).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
}

function parseSortInfo(name: string, saveTime: string | undefined, sourceIndex: number): { date: string; minute: number; tie: number } {
  const wzs = name.match(/^wzs-(\d{4})-(\d{2})-(\d{2})-(\d+)/u);
  const fallback = String(saveTime ?? "").match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/u);
  if (fallback) {
    return {
      date: `${fallback[1]}-${fallback[2]}-${fallback[3]}`,
      minute: Number(fallback[4] ?? "12") * 60 + Number(fallback[5] ?? "00"),
      tie: wzs ? Number(wzs[4]) : sourceIndex,
    };
  }

  if (wzs) {
    return { date: `${wzs[1]}-${wzs[2]}-${wzs[3]}`, minute: 12 * 60, tie: Number(wzs[4]) };
  }

  const compact = name.match(/^(\d{8})-(\d{4})/u);
  if (compact) {
    const rawDate = compact[1];
    const rawTime = compact[2];
    return {
      date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
      minute: Number(rawTime.slice(0, 2)) * 60 + Number(rawTime.slice(2, 4)),
      tie: sourceIndex,
    };
  }

  const compactDate = name.match(/^(\d{8})/u);
  if (compactDate) {
    const rawDate = compactDate[1];
    return {
      date: `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}`,
      minute: 12 * 60,
      tie: sourceIndex,
    };
  }

  return { date: "9999-12-31", minute: 12 * 60, tie: sourceIndex };
}

function makeUpdatedAt(sortDate: string, sortMinute: number, ordinal: number): string {
  const [year, month, day] = sortDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, Math.floor(sortMinute / 60), sortMinute % 60, ordinal % 60));
  return date.toISOString();
}

function loadSessions(): Session[] {
  const rows = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex) => {
      const name = String(row.Name ?? `session-${sourceIndex + 1}`);
      const { date, minute, tie, tms } = getHistorySortInfo(row, sourceIndex);
      return {
        id: `s${sourceIndex}`,
        name,
        numbers: parseNumbers(row.Numbers),
        updatedAt: makeUpdatedAt(date, minute, sourceIndex),
        updatedTms: tms,
        importIndex: sourceIndex,
        manualTableId: manualTableForName(name),
        sortDate: date,
        sortMinute: minute,
        sortTie: tie,
        sourceIndex,
      } satisfies ParsedSession;
    })
    .filter((session) => session.sortDate >= "2026-04-01" && session.sortDate < "2026-07-01")
    .sort((left, right) =>
      left.sortDate.localeCompare(right.sortDate) ||
      left.sortMinute - right.sortMinute ||
      left.sortTie - right.sortTie ||
      left.sourceIndex - right.sourceIndex,
    )
    .map((session, importIndex) => ({
      id: session.id,
      name: session.name,
      numbers: session.numbers,
      updatedAt: makeUpdatedAt(session.sortDate, session.sortMinute, importIndex),
      updatedTms: session.updatedTms,
      importIndex,
      manualTableId: session.manualTableId,
    }));
}

function emptySummary(): Summary {
  return { signals: 0, bet: 0, win: 0, net: 0, roi: 0, hits: 0, wr: 0, dd: 0 };
}

function summarize(events: readonly StrategyEvent[]): Summary {
  let running = 0;
  let peak = 0;
  let dd = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;
  for (const event of events) {
    bet += event.bet;
    win += event.win;
    if (event.hit) hits += 1;
    running += event.win - event.bet;
    peak = Math.max(peak, running);
    dd = Math.max(dd, peak - running);
  }
  if (bet === 0) return emptySummary();
  const net = win - bet;
  return {
    signals: events.length,
    bet,
    win,
    net,
    roi: (net / bet) * 100,
    hits,
    wr: (hits / events.length) * 100,
    dd,
  };
}

function entityIndex(kind: Quality124Kind, value: RouletteNumber): 0 | 1 | 2 | null {
  return kind === "group" ? getGroupIndex(value) : getRowIndex(value);
}

// ---- quality124 event backtest ----

const Q_PROG_1 = [1] as const;
const Q_PROG_12 = [1, 2] as const;
const Q_PROG_124 = [1, 2, 4] as const;
const Q_PROG_1235 = [1, 2, 3, 5] as const;
const Q_PROG_1248 = [1, 2, 4, 8] as const;
const STRONG_GROUP_CONCENTRATION = 0.55;

type TempoBand = "unknown" | "fast" | "medium_fast" | "medium" | "slow";

interface QualityState {
  kind: Quality124Kind;
  ci: 0 | 1 | 2;
  missCount: number;
  seen: boolean;
  gaps: number[];
  active: Partial<Record<number, QualityActive>>;
}

interface QualityRule {
  tier: Quality124Tier;
  progression: readonly number[];
  zone: number;
  conc: number;
  band: TempoBand;
}

interface QualityActive extends QualityRule {
  firstBetIndex: number;
  kind: Quality124Kind;
  ci: 0 | 1 | 2;
  entryAfter: number;
  roundIndex: number;
  bet: number;
}

function avg(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = avg(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function zoneRate(gaps: readonly number[], entryAfter: number, window: number, zoneLen: number): number {
  const recent = gaps.slice(-window);
  if (recent.length === 0) return 0;
  const hi = entryAfter + zoneLen - 1;
  return recent.filter((gap) => gap >= entryAfter && gap <= hi).length / recent.length;
}

function concentration(gaps: readonly number[], window: number): number {
  const recent = gaps.slice(-window);
  if (recent.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const gap of recent) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  let mode = 0;
  let modeCount = -1;
  for (const [gap, count] of counts) {
    if (count > modeCount || (count === modeCount && gap < mode)) {
      mode = gap;
      modeCount = count;
    }
  }
  return recent.filter((gap) => Math.abs(gap - mode) <= 1).length / recent.length;
}

function tempoBand(gaps: readonly number[]): TempoBand {
  if (gaps.length < 6) return "unknown";
  const recent6 = gaps.slice(-6);
  const recent12 = gaps.slice(-12);
  const previous6 = gaps.slice(-12, -6);
  const mean6 = avg(recent6);
  const mean12 = avg(recent12);
  const prior6 = avg(previous6);
  const delta6 = avg(recent6.slice(1).map((value, index) => Math.abs(value - recent6[index])));
  const var6 = variance(recent6);
  const frequency = clamp((3.2 - mean6) / 2.7);
  const churn = clamp(delta6 / 2.8);
  const compression = previous6.length > 0 ? clamp((prior6 - mean6) / 2.5) : 0;
  const dispersion = clamp(var6 / 6);
  const score = 0.42 * frequency + 0.26 * churn + 0.22 * compression + 0.1 * dispersion;
  if (score >= 0.68) return "fast";
  if (score >= 0.48) return "medium_fast";
  if (score <= 0.24 || mean12 >= 3.4) return "slow";
  return "medium";
}

function isNotFast(band: TempoBand): boolean {
  return band !== "fast" && band !== "unknown";
}

function isMediumFast(band: TempoBand): boolean {
  return band === "medium_fast" || band === "fast";
}

function isMediumSlow(band: TempoBand): boolean {
  return band === "medium" || band === "slow";
}

function selectQualityRule(state: QualityState, entryAfter: number): QualityRule | null {
  const band = tempoBand(state.gaps);
  if (state.kind === "group") {
    if (state.ci === 0 && entryAfter === 4 && state.gaps.length >= 12) {
      const zone = zoneRate(state.gaps, entryAfter, 12, 4);
      const conc = concentration(state.gaps, 12);
      if (zone >= 0.2 && conc >= 0.45) return { tier: "group1", progression: Q_PROG_1, zone, conc, band };
    }
    if ((state.ci === 1 || state.ci === 2) && state.gaps.length >= 18) {
      const zone = zoneRate(state.gaps, entryAfter, 18, 3);
      const conc = concentration(state.gaps, 18);
      const notFast = isNotFast(band);
      if (state.ci === 1 && entryAfter === 4 && zone >= 0.25 && conc >= STRONG_GROUP_CONCENTRATION) {
        return { tier: "group2", progression: Q_PROG_124, zone, conc, band };
      }
      if (state.ci === 2 && (entryAfter === 3 || entryAfter === 4) && zone >= 0.25 && conc >= STRONG_GROUP_CONCENTRATION && notFast) {
        return { tier: "group3", progression: Q_PROG_1235, zone, conc, band };
      }
      if (state.ci === 1 && entryAfter === 3 && zone >= 0.25 && conc >= 0.45 && notFast) {
        return { tier: "group2tempo", progression: Q_PROG_12, zone, conc, band };
      }
    }
  }
  if (state.kind === "row") {
    if (state.ci === 0 && entryAfter === 3 && state.gaps.length >= 12) {
      const zone = zoneRate(state.gaps, entryAfter, 12, 4);
      const conc = concentration(state.gaps, 12);
      if (zone >= 0.3 && conc >= 0.35 && isMediumFast(band)) return { tier: "row1", progression: Q_PROG_1, zone, conc, band };
    }
    if (state.ci === 1 && entryAfter === 3 && state.gaps.length >= 24) {
      const zone = zoneRate(state.gaps, entryAfter, 24, 3);
      const conc = concentration(state.gaps, 24);
      if (zone >= 0.25 && conc >= 0.55) return { tier: "row2", progression: Q_PROG_124, zone, conc, band };
    }
    if (state.ci === 2 && entryAfter === 3 && state.gaps.length >= 37) {
      const zone = zoneRate(state.gaps, entryAfter, 37, 4);
      const conc = concentration(state.gaps, 37);
      if (zone >= 0.2 && conc >= 0.55 && isMediumSlow(band)) return { tier: "row3", progression: Q_PROG_1248, zone, conc, band };
    }
  }
  return null;
}

function createQualityStates(): QualityState[] {
  return (["group", "row"] as const).flatMap((kind) =>
    ([0, 1, 2] as const).map((ci) => ({ kind, ci, missCount: 0, seen: false, gaps: [], active: {} })),
  );
}

function qualityEvents(session: Session): StrategyEvent[] {
  const events: StrategyEvent[] = [];
  const states = createQualityStates();
  for (let index = 0; index < session.numbers.length; index += 1) {
    const value = session.numbers[index];
    for (const state of states) {
      const hit = entityIndex(state.kind, value) === state.ci;
      for (const entryText of Object.keys(state.active)) {
        const active = state.active[Number(entryText)];
        if (!active) continue;
        const amount = active.progression[Math.min(active.roundIndex, active.progression.length - 1)] ?? 1;
        active.bet += amount;
        if (hit) {
          events.push({
            strategy: "quality124",
            sessionId: session.id,
            sessionName: session.name,
            startIndex: active.firstBetIndex,
            settleIndex: index,
            key: `${active.kind}:${active.ci}`,
            altKey: `${active.tier}:${active.kind}:${active.ci}`,
            tier: active.tier,
            bet: active.bet,
            win: amount * 3,
            hit: true,
          });
          delete state.active[Number(entryText)];
          continue;
        }
        active.roundIndex += 1;
        if (active.roundIndex >= active.progression.length) {
          events.push({
            strategy: "quality124",
            sessionId: session.id,
            sessionName: session.name,
            startIndex: active.firstBetIndex,
            settleIndex: index,
            key: `${active.kind}:${active.ci}`,
            altKey: `${active.tier}:${active.kind}:${active.ci}`,
            tier: active.tier,
            bet: active.bet,
            win: 0,
            hit: false,
          });
          delete state.active[Number(entryText)];
        }
      }
    }
    for (const state of states) {
      const hit = entityIndex(state.kind, value) === state.ci;
      if (hit) {
        if (state.seen) state.gaps.push(state.missCount);
        state.missCount = 0;
        state.seen = true;
      } else if (state.seen) {
        state.missCount += 1;
      }
    }
    for (const state of states) {
      if (!state.seen) continue;
      const entryAfter = state.missCount;
      if (entryAfter < 3 || entryAfter > 4 || state.active[entryAfter]) continue;
      const selected = selectQualityRule(state, entryAfter);
      if (!selected) continue;
      state.active[entryAfter] = {
        firstBetIndex: index + 1,
        kind: state.kind,
        ci: state.ci,
        tier: selected.tier,
        progression: selected.progression,
        entryAfter,
        roundIndex: 0,
        bet: 0,
        zone: selected.zone,
        conc: selected.conc,
        band: selected.band,
      };
    }
  }
  return events;
}

// ---- cold events ----

function colRowHit(value: RouletteNumber, ci: number): boolean {
  return value !== 0 && getNumberColRows(value).map((item) => item as number).includes(ci);
}

function completedGapsAt(numbers: readonly RouletteNumber[], ci: number, end: number): number[] {
  const gaps: number[] = [];
  let last = -1;
  for (let index = 0; index < end; index += 1) {
    if (!colRowHit(numbers[index], ci)) continue;
    if (last >= 0) gaps.push(index - last - 1);
    last = index;
  }
  return gaps;
}

function coldEvents(session: Session): StrategyEvent[] {
  const events: StrategyEvent[] = [];
  const lastSeen = [-1, -1, -1, -1, -1, -1];
  const active: Array<{ ci: number; startIndex: number; startRound: number; bet: number; win: number; hit: boolean }> = [];
  for (let index = 0; index < session.numbers.length; index += 1) {
    const value = session.numbers[index];
    const hitCis = value !== 0 ? getNumberColRows(value).map((item) => item as number) : [];
    const remaining: typeof active = [];
    for (const chase of active) {
      const round = index - chase.startRound;
      if (round >= CHASE_LENGTH) continue;
      const amount = PROGRESSION[round] ?? PROGRESSION[PROGRESSION.length - 1];
      chase.bet += amount;
      if (hitCis.includes(chase.ci)) {
        chase.win += amount * 3;
        chase.hit = true;
        events.push({
          strategy: "cold",
          sessionId: session.id,
          sessionName: session.name,
          startIndex: chase.startIndex,
          settleIndex: index,
          key: `ci:${chase.ci}`,
          bet: chase.bet,
          win: chase.win,
          hit: true,
        });
      } else if (round + 1 < CHASE_LENGTH) {
        remaining.push(chase);
      } else {
        events.push({
          strategy: "cold",
          sessionId: session.id,
          sessionName: session.name,
          startIndex: chase.startIndex,
          settleIndex: index,
          key: `ci:${chase.ci}`,
          bet: chase.bet,
          win: chase.win,
          hit: false,
        });
      }
    }
    active.length = 0;
    active.push(...remaining);

    for (const ci of hitCis) lastSeen[ci] = index;
    if (index < 10) continue;
    for (let ci = 0; ci < 6; ci += 1) {
      if (active.some((chase) => chase.ci === ci)) continue;
      const gaps = completedGapsAt(session.numbers, ci, index).slice(-GAP_WINDOW);
      if (gaps.length < 5) continue;
      const sorted = [...gaps].sort((left, right) => left - right);
      const threshold = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * EXTREME_PCT))];
      const gap = lastSeen[ci] >= 0 ? index - lastSeen[ci] - 1 : index;
      if (gap < threshold + EXTREME_BUFFER || gap < MIN_GAP) continue;
      active.push({ ci, startIndex: index + 1, startRound: index + 1, bet: 0, win: 0, hit: false });
    }
  }
  for (const chase of active) {
    if (chase.bet > 0) {
      events.push({
        strategy: "cold",
        sessionId: session.id,
        sessionName: session.name,
        startIndex: chase.startIndex,
        settleIndex: session.numbers.length - 1,
        key: `ci:${chase.ci}`,
        bet: chase.bet,
        win: chase.win,
        hit: chase.hit,
      });
    }
  }
  return events;
}

// ---- chase6 rolling events ----

interface Chase6Candidate {
  gap: number;
  isStrong: boolean;
  isWaveQualified: boolean;
  wi: number;
}

function computeChase6WaveFeatures(history: readonly number[]): { avg5: number; long20Rate10: number } {
  const recent10 = history.slice(0, 10);
  const recent5 = recent10.slice(0, 5);
  return {
    avg5: recent5.length > 0 ? recent5.reduce((sum, item) => sum + item, 0) / recent5.length : 0,
    long20Rate10: recent10.length > 0 ? recent10.filter((gap) => gap >= 20).length / recent10.length : 0,
  };
}

function chase6Candidate(history: readonly RouletteNumber[], value: RouletteNumber): Chase6Candidate | null {
  if (value === 0) return null;
  const gaps = new Array<number>(CHASE6_WINDOWS).fill(0);
  const appearCount = new Array<number>(CHASE6_WINDOWS).fill(0);
  const gapHistory: number[][] = Array.from({ length: CHASE6_WINDOWS }, () => []);
  for (const current of history) {
    if (current === 0) continue;
    for (let wi = 0; wi < CHASE6_WINDOWS; wi += 1) {
      if (isInChaseSixWindow(wi, current)) {
        gapHistory[wi].unshift(gaps[wi]);
        if (gapHistory[wi].length > 10) gapHistory[wi].length = 10;
        gaps[wi] = 0;
        appearCount[wi] += 1;
      } else {
        gaps[wi] += 1;
      }
    }
  }
  const candidates: Array<{ wi: number; gap: number }> = [];
  for (let wi = 0; wi < CHASE6_WINDOWS; wi += 1) {
    if (
      isInChaseSixWindow(wi, value) &&
      gaps[wi] >= CHASE6_MIN_GAP &&
      gaps[wi] <= CHASE6_MAX_GAP &&
      appearCount[wi] >= CHASE6_MIN_APPEARANCES
    ) {
      candidates.push({ wi, gap: gaps[wi] });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((left, right) => right.gap - left.gap || left.wi - right.wi);
  const selected = candidates[0];
  const wave = computeChase6WaveFeatures(gapHistory[selected.wi]);
  return {
    wi: selected.wi,
    gap: selected.gap,
    isStrong: appearCount[selected.wi] >= CHASE6_STRONG_APPEARANCES,
    isWaveQualified:
      wave.avg5 <= CHASE6_WAVE_AVG5_MAX &&
      wave.long20Rate10 < CHASE6_WAVE_LONG20_RATE10_MAX,
  };
}

function chaseSixEvents(session: Session): StrategyEvent[] {
  const events: StrategyEvent[] = [];
  const active: Array<{ wi: number; startIndex: number; round: number; bet: number; win: number; hit: boolean; isStrong: boolean; isWave: boolean }> = [];
  for (let index = 0; index < session.numbers.length; index += 1) {
    const value = session.numbers[index];
    const remaining: typeof active = [];
    for (const chase of active) {
      if (chase.round >= CHASE6_CHASE_LEN) continue;
      const amount = CHASE6_PROGRESSION[chase.round] ?? CHASE6_PROGRESSION[CHASE6_PROGRESSION.length - 1];
      chase.bet += amount;
      if (value !== 0 && isInChaseSixWindow(chase.wi, value)) {
        chase.win += amount * 6;
        chase.hit = true;
        events.push({
          strategy: "chase6",
          sessionId: session.id,
          sessionName: session.name,
          startIndex: chase.startIndex,
          settleIndex: index,
          key: `wi:${chase.wi}`,
          altKey: chase.isStrong ? chase.isWave ? "waveStrong" : "strong" : "base",
          bet: chase.bet,
          win: chase.win,
          hit: true,
        });
      } else if (chase.round + 1 < CHASE6_CHASE_LEN) {
        remaining.push({ ...chase, round: chase.round + 1 });
      } else {
        events.push({
          strategy: "chase6",
          sessionId: session.id,
          sessionName: session.name,
          startIndex: chase.startIndex,
          settleIndex: index,
          key: `wi:${chase.wi}`,
          altKey: chase.isStrong ? chase.isWave ? "waveStrong" : "strong" : "base",
          bet: chase.bet,
          win: chase.win,
          hit: false,
        });
      }
    }
    active.length = 0;
    active.push(...remaining);

    const history = session.numbers.slice(Math.max(0, index - HISTORY_WINDOW), index);
    const candidate = chase6Candidate(history, value);
    if (candidate && !active.some((chase) => chase.wi === candidate.wi)) {
      active.push({
        wi: candidate.wi,
        startIndex: index + 1,
        round: 0,
        bet: 0,
        win: 0,
        hit: false,
        isStrong: candidate.isStrong,
        isWave: candidate.isWaveQualified,
      });
    }
  }
  for (const chase of active) {
    if (chase.bet > 0) {
      events.push({
        strategy: "chase6",
        sessionId: session.id,
        sessionName: session.name,
        startIndex: chase.startIndex,
        settleIndex: session.numbers.length - 1,
        key: `wi:${chase.wi}`,
        altKey: chase.isStrong ? chase.isWave ? "waveStrong" : "strong" : "base",
        bet: chase.bet,
        win: chase.win,
        hit: chase.hit,
      });
    }
  }
  return events;
}

function attachTables(events: readonly StrategyEvent[], tableBySessionId: ReadonlyMap<string, string | undefined>): StrategyEvent[] {
  return events.map((event) => ({ ...event, tableId: tableBySessionId.get(event.sessionId) }));
}

function makeAutoTables(tableIds: Iterable<string>): TableProfileTable[] {
  return [...tableIds].map((id) => ({ id, name: id, parentId: "auto" }));
}

function attachAutoPrefixTables(
  sessions: readonly Session[],
  events: readonly StrategyEvent[],
  autoTableBySessionId: ReadonlyMap<string, string | undefined>,
): StrategyEvent[] {
  const eventsBySession = groupBy(events, (event) => event.sessionId);
  const profileSessions: TableProfileSession[] = [];
  const tableIds = new Set<string>();
  const result: StrategyEvent[] = [];

  for (const session of sessions) {
    const profiles = buildTableProfiles(profileSessions, makeAutoTables(tableIds));
    const currentEvents = eventsBySession.get(session.id) ?? [];
    for (const event of currentEvents) {
      const prefix = session.numbers.slice(0, Math.max(0, event.startIndex));
      const match = matchTableProfile(prefix, profiles);
      const tableId = match.profile && (match.level === "confirmed" || match.level === "probable")
        ? match.profile.tableId
        : undefined;
      result.push({ ...event, tableId });
    }

    const assignedTableId = autoTableBySessionId.get(session.id);
    if (assignedTableId) {
      tableIds.add(assignedTableId);
      profileSessions.push({
        id: session.id,
        name: session.name,
        numbers: session.numbers,
        tableId: assignedTableId,
      });
    }
  }

  return result;
}

function filterKey(event: StrategyEvent, kind: FilterKind): string {
  if (kind === "tableOverall") return "*";
  if (kind === "tier") return event.tier ?? event.altKey ?? event.key;
  if (kind === "tierEntity") return event.altKey ?? event.key;
  if (kind === "strongEntity") return `${event.altKey ?? "base"}:${event.key}`;
  return event.key;
}

function applyFilterBySession(
  sessions: readonly Session[],
  eventsBySession: ReadonlyMap<string, StrategyEvent[]>,
  tableBySessionId: ReadonlyMap<string, string | undefined>,
  config: FilterConfig,
): StrategyEvent[] {
  const selected: StrategyEvent[] = [];
  const prior: StrategyEvent[] = [];
  for (const session of sessions) {
    const currentEvents = eventsBySession.get(session.id) ?? [];
    for (const event of currentEvents) {
      const tableId = event.tableId ?? tableBySessionId.get(session.id);
      const tableEvents = tableId
        ? prior.filter((item) => item.tableId === tableId)
        : [];
      const key = filterKey(event, config.kind);
      const relevant = config.kind === "tableOverall"
        ? tableEvents
        : tableEvents.filter((item) => filterKey(item, config.kind) === key);
      if (relevant.length < config.minSignals) {
        if (config.keepUnknown) selected.push(event);
        continue;
      }
      const summary = summarize(relevant);
      if (summary.roi >= config.minRoi) selected.push(event);
    }
    prior.push(...currentEvents);
  }
  return selected;
}

function fmt(summary: Summary): string {
  return `sig=${String(summary.signals).padStart(4)} bet=${String(summary.bet).padStart(5)} net=${String(summary.net).padStart(5)} ROI=${summary.roi.toFixed(2).padStart(7)}% WR=${summary.wr.toFixed(2).padStart(6)}% DD=${String(summary.dd).padStart(4)}`;
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

function formatCounts(values: readonly (string | undefined)[]): string {
  return [...groupBy(values, (value) => value ?? "-").entries()]
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]))
    .map(([key, items]) => `${key}:${items.length}`)
    .join(", ");
}

function validateBaselines(sessions: readonly Session[], eventsByStrategy: Record<Strategy, StrategyEvent[]>): void {
  let qBet = 0, qWin = 0;
  let coldBet = 0, coldWin = 0;
  let chaseBet = 0, chaseWin = 0;
  for (const session of sessions) {
    const q = analyzeQuality124(session.numbers);
    qBet += q.totalRoi.bet;
    qWin += q.totalRoi.win;
    const c = computeRoi(session.numbers);
    coldBet += c.bet;
    coldWin += c.win;
    const six = analyzeChaseSixRolling(session.numbers, HISTORY_WINDOW);
    chaseBet += six.totalRoi.bet;
    chaseWin += six.totalRoi.win;
  }
  const q = summarize(eventsByStrategy.quality124);
  const c = summarize(eventsByStrategy.cold);
  const six = summarize(eventsByStrategy.chase6);
  console.log("\n=== Baseline validation against core totals ===");
  console.log(`quality124 events bet=${q.bet} win=${q.win} | core bet=${qBet} win=${qWin}`);
  console.log(`cold       events bet=${c.bet} win=${c.win} | core bet=${coldBet} win=${coldWin}`);
  console.log(`chase6     events bet=${six.bet} win=${six.win} | core bet=${chaseBet} win=${chaseWin}`);
}

function topRows(
  strategy: Strategy,
  tableMode: TableMode,
  sessions: readonly Session[],
  baselineEvents: readonly StrategyEvent[],
  eventsBySession: ReadonlyMap<string, StrategyEvent[]>,
  tableBySessionId: ReadonlyMap<string, string | undefined>,
): Array<{ config: FilterConfig; summary: Summary; delta: number }> {
  const baseline200 = summarize(baselineEvents.filter((event) => event.startIndex >= ROI_START));
  const configs: FilterConfig[] = [
    { name: "overall>=5 roi>=0 keep", kind: "tableOverall", minSignals: 5, minRoi: 0, keepUnknown: true },
    { name: "overall>=10 roi>=0 keep", kind: "tableOverall", minSignals: 10, minRoi: 0, keepUnknown: true },
    { name: "entity>=3 roi>=0 keep", kind: "entity", minSignals: 3, minRoi: 0, keepUnknown: true },
    { name: "entity>=5 roi>=0 keep", kind: "entity", minSignals: 5, minRoi: 0, keepUnknown: true },
    { name: "entity>=3 roi>=-10 keep", kind: "entity", minSignals: 3, minRoi: -10, keepUnknown: true },
    { name: "entity>=3 roi>=0 drop", kind: "entity", minSignals: 3, minRoi: 0, keepUnknown: false },
    { name: "tier>=3 roi>=0 keep", kind: "tier", minSignals: 3, minRoi: 0, keepUnknown: true },
    { name: "tierEntity>=2 roi>=0 keep", kind: "tierEntity", minSignals: 2, minRoi: 0, keepUnknown: true },
  ];

  if (strategy === "chase6") {
    configs.push({ name: "strongEntity>=2 roi>=0 keep", kind: "strongEntity", minSignals: 2, minRoi: 0, keepUnknown: true });
  }

  return configs
    .map((config) => {
      const filtered = applyFilterBySession(sessions, eventsBySession, tableBySessionId, config)
        .filter((event) => event.startIndex >= ROI_START);
      const summary = summarize(filtered);
      return { config, summary, delta: summary.roi - baseline200.roi, strategy, tableMode };
    })
    .filter((row) => row.summary.bet > 0)
    .sort((left, right) => right.summary.roi - left.summary.roi || right.summary.net - left.summary.net);
}

const sessions = loadSessions();
const manualTables = [
  { id: "macau_wynn_01", name: "macau_wynn_01", parentId: "macau_wynn" },
  { id: "macau_wynn_02", name: "macau_wynn_02", parentId: "macau_wynn" },
  { id: "macau_wynn_03", name: "macau_wynn_03", parentId: "macau_wynn" },
];
const autoOnlyState = buildAutoTableProfileState(
  sessions.map((session) => ({ ...session, tableId: undefined })),
  [],
);
const manualState = buildAutoTableProfileState(
  sessions.map((session) => ({ ...session, tableId: session.manualTableId })),
  manualTables,
);
const autoTableBySession = new Map<string, string | undefined>(
  autoOnlyState.assignments.map((assignment) => [assignment.sessionId, assignment.effectiveTableId]),
);
const manualTableBySession = new Map<string, string | undefined>(
  sessions.map((session) => [session.id, session.manualTableId]),
);

const eventSets: Record<Strategy, StrategyEvent[]> = {
  quality124: sessions.flatMap(qualityEvents),
  cold: sessions.flatMap(coldEvents),
  chase6: sessions.flatMap(chaseSixEvents),
};

validateBaselines(sessions, eventSets);

const sessionEvents: Record<Strategy, Map<string, StrategyEvent[]>> = {
  quality124: groupBy(eventSets.quality124, (event) => event.sessionId),
  cold: groupBy(eventSets.cold, (event) => event.sessionId),
  chase6: groupBy(eventSets.chase6, (event) => event.sessionId),
};

const emptyTableBySession = new Map<string, string | undefined>();
const autoEvents: Record<Strategy, StrategyEvent[]> = {
  quality124: attachAutoPrefixTables(sessions, eventSets.quality124, autoTableBySession),
  cold: attachAutoPrefixTables(sessions, eventSets.cold, autoTableBySession),
  chase6: attachAutoPrefixTables(sessions, eventSets.chase6, autoTableBySession),
};
const manualEvents: Record<Strategy, StrategyEvent[]> = {
  quality124: attachTables(eventSets.quality124, manualTableBySession),
  cold: attachTables(eventSets.cold, manualTableBySession),
  chase6: attachTables(eventSets.chase6, manualTableBySession),
};

const autoSessionEvents: Record<Strategy, Map<string, StrategyEvent[]>> = {
  quality124: groupBy(autoEvents.quality124, (event) => event.sessionId),
  cold: groupBy(autoEvents.cold, (event) => event.sessionId),
  chase6: groupBy(autoEvents.chase6, (event) => event.sessionId),
};
const manualSessionEvents: Record<Strategy, Map<string, StrategyEvent[]>> = {
  quality124: groupBy(manualEvents.quality124, (event) => event.sessionId),
  cold: groupBy(manualEvents.cold, (event) => event.sessionId),
  chase6: groupBy(manualEvents.chase6, (event) => event.sessionId),
};

console.log(`Loaded sessions: ${sessions.length}, spins=${sessions.reduce((sum, session) => sum + session.numbers.length, 0)}`);
console.log(`Full-session auto table assignments: ${formatCounts(autoOnlyState.assignments.map((assignment) => assignment.effectiveTableId))}`);
console.log(`Manual table assignments: ${formatCounts(manualState.assignments.map((assignment) => assignment.effectiveTableId))}`);
console.log(`Auto prefix event coverage 200+: quality124 ${formatCounts(autoEvents.quality124.filter((event) => event.startIndex >= ROI_START).map((event) => event.tableId))}`);
console.log(`Auto prefix event coverage 200+: cold       ${formatCounts(autoEvents.cold.filter((event) => event.startIndex >= ROI_START).map((event) => event.tableId))}`);
console.log(`Auto prefix event coverage 200+: chase6     ${formatCounts(autoEvents.chase6.filter((event) => event.startIndex >= ROI_START).map((event) => event.tableId))}`);
console.log("\n=== Auto vs manual table cross-tab ===");
for (const [autoTableId, rows] of groupBy(sessions, (session) => autoTableBySession.get(session.id) ?? "-")) {
  console.log(`${autoTableId.padEnd(8)} ${formatCounts(rows.map((session) => session.manualTableId))}`);
}
console.log("\n=== Baseline ROI, 200+ by signal start ===");
for (const strategy of ["quality124", "cold", "chase6"] as const) {
  const all = summarize(eventSets[strategy]);
  const from200 = summarize(eventSets[strategy].filter((event) => event.startIndex >= ROI_START));
  console.log(`${strategy.padEnd(10)} all ${fmt(all)} | 200+ ${fmt(from200)}`);
}

console.log("\n=== Best table filters, 200+ ===");
for (const strategy of ["quality124", "cold", "chase6"] as const) {
  const baseline = summarize(eventSets[strategy].filter((event) => event.startIndex >= ROI_START));
  console.log(`\n-- ${strategy} baseline ${fmt(baseline)}`);
  for (const mode of ["auto", "manual"] as const) {
    const rows = topRows(
      strategy,
      mode,
      sessions,
      mode === "auto" ? autoEvents[strategy] : manualEvents[strategy],
      mode === "auto" ? autoSessionEvents[strategy] : manualSessionEvents[strategy],
      mode === "auto" ? emptyTableBySession : manualTableBySession,
    ).slice(0, 5);
    for (const row of rows) {
      console.log(`${mode.padEnd(6)} ${row.config.name.padEnd(28)} ${fmt(row.summary)} delta=${row.delta.toFixed(2)}%`);
    }
  }
}

console.log("\n=== quality124 by tier, baseline 200+ ===");
for (const tier of QUALITY_124_TIER_ORDER) {
  const rows = eventSets.quality124.filter((event) => event.startIndex >= ROI_START && event.tier === tier);
  console.log(`${tier.padEnd(12)} ${fmt(summarize(rows))}`);
}

console.log("\n=== quality124 table/entity ROI, manual 200+ prior-independent summary ===");
for (const [tableId, rows] of groupBy(manualEvents.quality124.filter((event) => event.startIndex >= ROI_START), (event) => event.tableId ?? "-")) {
  console.log(`${tableId.padEnd(14)} ${fmt(summarize(rows))}`);
  const byEntity = [...groupBy(rows, (event) => event.key).entries()]
    .map(([key, items]) => ({ key, summary: summarize(items) }))
    .sort((left, right) => right.summary.roi - left.summary.roi);
  for (const row of byEntity) {
    console.log(`  ${row.key.padEnd(8)} ${fmt(row.summary)}`);
  }
}

console.log("\n=== quality124 table/tier ROI, manual 200+ prior-independent summary ===");
for (const [tableId, rows] of groupBy(manualEvents.quality124.filter((event) => event.startIndex >= ROI_START), (event) => event.tableId ?? "-")) {
  console.log(`${tableId.padEnd(14)} ${fmt(summarize(rows))}`);
  for (const tier of QUALITY_124_TIER_ORDER) {
    const tierRows = rows.filter((event) => event.tier === tier);
    if (tierRows.length > 0) console.log(`  ${tier.padEnd(12)} ${fmt(summarize(tierRows))}`);
  }
}
