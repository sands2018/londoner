import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getHistorySortInfo } from "./historyTime";

type RouletteNumber = number;
type Mode = "long" | "short";

interface RawHistoryRow {
  Count?: number;
  Name?: string;
  Numbers?: string | number[];
  SaveTime?: string;
  tms?: number;
}

interface Session {
  index: number;
  name: string;
  numbers: RouletteNumber[];
  sortDate: string;
  year: string;
}

interface Pick {
  mode: Mode;
  number: RouletteNumber;
}

interface Event {
  hit: boolean;
  index: number;
  mode: Mode;
  net: number;
  session: string;
}

interface RunResult {
  events: Event[];
  closedSpins: number;
  reopens: number;
  toggles: number;
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const ROI_START = 200;
const LONG_WARMUP = 148;
const SHORT_WARMUP = 111;
const ACCEL_WINDOW = 148;
const SEG_SIZE = 49;
const ADAPTIVE_LOOKBACK = 90;
const ADAPTIVE_MIN_SHORT_SIGNALS = 5;
const ADAPTIVE_MIN_SHORT_ROI = -40;
const ADAPTIVE_SHORT_EDGE = -60;

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value) => Number.isInteger(value) && value >= 0 && value <= 36);
}

function parseSortDate(name: string, saveTime: string | undefined): string {
  const compact = name.match(/^(\d{4})(\d{2})(\d{2})/u);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  const wzs = name.match(/^wzs-(\d{4})-(\d{2})-(\d{2})/u);
  if (wzs) return `${wzs[1]}-${wzs[2]}-${wzs[3]}`;

  const fallback = String(saveTime ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (fallback) return `${fallback[1]}-${fallback[2]}-${fallback[3]}`;

  return "9999-12-31";
}

function loadSessions(): Session[] {
  const rows = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, index) => {
      const name = String(row.Name ?? `session-${index + 1}`);
      const sortDate = getHistorySortInfo(row, index).date;
      return {
        index,
        name,
        numbers: parseNumbers(row.Numbers),
        sortDate,
        year: sortDate.slice(0, 4),
      };
    })
    .filter((session) => session.numbers.length > ROI_START)
    .sort((left, right) => left.sortDate.localeCompare(right.sortDate) || left.index - right.index);
}

function countInWindow(numbers: readonly RouletteNumber[], num: number, window: number, end = numbers.length): number {
  const start = Math.max(0, end - window);
  let count = 0;
  for (let i = start; i < end; i += 1) {
    if (numbers[i] === num) count += 1;
  }
  return count;
}

function topNFromCounts(counts: ArrayLike<number>, limit: number): RouletteNumber[] {
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
    top.splice(insertAt, 0, num);
    if (top.length > limit) top.pop();
  }
  return top;
}

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
    if (i < start + SEG_SIZE) seg1Counts[num] += 1;
    else if (i < start + SEG_SIZE * 2) seg2Counts[num] += 1;
    else seg3Counts[num] += 1;
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
    const count = count74[num];
    const diff = seg3 - seg1;
    if (count > bestCount || (count === bestCount && diff > bestDiff)) {
      bestNum = num;
      bestCount = count;
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
      if (i < mid37) firstHalf37[num] += 1;
      else secondHalf37[num] += 1;
    }
    if (i >= end - 20) count20[num] += 1;
  }

  const hot37 = new Set(topNFromCounts(count37, 5));
  const hot74 = new Set(topNFromCounts(count74, 5));
  const hot111 = new Set(topNFromCounts(count111, 5));
  const candidates = [...hot37]
    .filter((num) => hot74.has(num) && hot111.has(num))
    .filter((num) => secondHalf37[num] > firstHalf37[num])
    .filter((num) => count20[num] < 4);

  if (candidates.length === 0) return null;
  candidates.sort((left, right) => count37[right] - count37[left] || left - right);
  return candidates[0] ?? null;
}

function precomputePicks(numbers: readonly RouletteNumber[]) {
  const n = numbers.length;
  const longPicks: Array<RouletteNumber | null> = new Array(n + 1).fill(null);
  const shortPicks: Array<RouletteNumber | null> = new Array(n + 1).fill(null);
  for (let i = LONG_WARMUP; i <= n; i += 1) longPicks[i] = selectLong(numbers, i);
  for (let i = SHORT_WARMUP; i <= n; i += 1) shortPicks[i] = selectShort(numbers, i);
  return { longPicks, shortPicks };
}

function roiPercent(nets: readonly number[]): number {
  return nets.length > 0 ? (nets.reduce((sum, net) => sum + net, 0) / nets.length) * 100 : 0;
}

function isHotEnvironmentAllowed(preNets: readonly number[]): boolean {
  if (preNets.length === 0) return true;
  const overallRoi = roiPercent(preNets);
  const splitIndex = Math.floor(preNets.length / 2);
  const earlyRoi = roiPercent(preNets.slice(0, splitIndex));
  const lateRoi = roiPercent(preNets.slice(splitIndex));
  return overallRoi < 0 && lateRoi >= earlyRoi;
}

function chooseAdaptive(
  longPick: RouletteNumber | null,
  shortPick: RouletteNumber | null,
  longCnt: number,
  longNet: number,
  shortCnt: number,
  shortNet: number,
): Pick | null {
  if (longPick === null && shortPick === null) return null;
  const shortRoi = shortCnt > 0 ? (shortNet / shortCnt) * 100 : -999;
  const longRoi = longCnt > 0 ? (longNet / longCnt) * 100 : -999;
  const preferShort = shortCnt >= ADAPTIVE_MIN_SHORT_SIGNALS
    && shortRoi >= ADAPTIVE_MIN_SHORT_ROI
    && shortRoi >= longRoi + ADAPTIVE_SHORT_EDGE;

  if (preferShort) {
    if (shortPick !== null) return { mode: "short", number: shortPick };
    if (longPick !== null) return { mode: "long", number: longPick };
  }

  if (longPick !== null) return { mode: "long", number: longPick };
  if (shortPick !== null) return { mode: "short", number: shortPick };
  return null;
}

function buildTimeline(numbers: readonly RouletteNumber[]) {
  const { longPicks, shortPicks } = precomputePicks(numbers);
  const rawPicks: Array<Pick | null> = new Array(numbers.length + 1).fill(null);
  const shortNets: Array<number | null> = new Array(numbers.length).fill(null);
  const rawNets: Array<number | null> = new Array(numbers.length).fill(null);

  let longCnt = 0;
  let longNet = 0;
  let shortCnt = 0;
  let shortNet = 0;
  const longQueue: Array<{ index: number; net: number }> = [];
  const shortQueue: Array<{ index: number; net: number }> = [];
  let longQueueStart = 0;
  let shortQueueStart = 0;

  function pushPaper(longN: number | null, shortN: number | null, outcomeIndex: number) {
    if (longN !== null) {
      const net = numbers[outcomeIndex] === longN ? 35 : -1;
      longQueue.push({ index: outcomeIndex, net });
      longNet += net;
      longCnt += 1;
    }
    if (shortN !== null && outcomeIndex >= SHORT_WARMUP) {
      const net = numbers[outcomeIndex] === shortN ? 35 : -1;
      shortQueue.push({ index: outcomeIndex, net });
      shortNet += net;
      shortCnt += 1;
    }
  }

  function trimPaper(minOutcomeIndex: number) {
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

    const rawPick = chooseAdaptive(longPicks[i], shortPicks[i], longCnt, longNet, shortCnt, shortNet);
    rawPicks[i] = rawPick;

    if (shortPicks[i] !== null) shortNets[i] = numbers[i] === shortPicks[i] ? 35 : -1;
    if (rawPick !== null) rawNets[i] = numbers[i] === rawPick.number ? 35 : -1;
  }

  return { longPicks, shortNets, rawNets, rawPicks, shortPicks };
}

function lastSignalNets(nets: readonly Array<number | null>, beforeIndex: number, limit: number): number[] {
  const out: number[] = [];
  for (let i = beforeIndex - 1; i >= 0 && out.length < limit; i -= 1) {
    const net = nets[i];
    if (net !== null) out.push(net);
  }
  return out.reverse();
}

type Strategy =
  | { kind: "none"; name: string }
  | { kind: "static"; name: string }
  | { kind: "rolling"; name: string; source: "short" | "raw"; window: number }
  | { kind: "state"; name: string; source: "short" | "raw"; window: number; confirm: number }
  | { kind: "state-cont"; name: string; source: "short" | "raw"; window: number; confirm: number }
  | { kind: "multi"; name: string; source: "short" | "raw"; windows: number[]; minAllow: number }
  | { kind: "auto-score"; name: string; source: "short" | "raw"; windows: number[] }
  | { kind: "state-auto"; name: string; source: "short" | "raw"; windows: number[]; confirm: number }
  | { kind: "meta-window"; name: string; source: "short" | "raw"; windows: number[]; scoreLookback: number; minEvents: number; fallbackWindow: number };

function sourceNets(timeline: ReturnType<typeof buildTimeline>, source: "short" | "raw") {
  return source === "short" ? timeline.shortNets : timeline.rawNets;
}

function allowForWindow(timeline: ReturnType<typeof buildTimeline>, source: "short" | "raw", index: number, window: number): boolean {
  return isHotEnvironmentAllowed(lastSignalNets(sourceNets(timeline, source), index, window));
}

function environmentParts(nets: readonly number[]) {
  if (nets.length === 0) {
    return { overall: 0, early: 0, late: 0, score: Number.NEGATIVE_INFINITY, allow: true };
  }
  const overall = roiPercent(nets);
  const splitIndex = Math.floor(nets.length / 2);
  const early = roiPercent(nets.slice(0, splitIndex));
  const late = roiPercent(nets.slice(splitIndex));
  return {
    allow: overall < 0 && late >= early,
    early,
    late,
    overall,
    score: late - early,
  };
}

function allowForAutoScore(
  timeline: ReturnType<typeof buildTimeline>,
  source: "short" | "raw",
  index: number,
  windows: readonly number[],
): boolean {
  let best = { allow: false, score: Number.NEGATIVE_INFINITY };
  for (const window of windows) {
    const nets = lastSignalNets(sourceNets(timeline, source), index, window);
    if (nets.length < Math.min(30, window)) continue;
    const parts = environmentParts(nets);
    if (parts.score > best.score) {
      best = { allow: parts.allow, score: parts.score };
    }
  }
  return best.allow;
}

function allowForMulti(
  timeline: ReturnType<typeof buildTimeline>,
  source: "short" | "raw",
  index: number,
  windows: readonly number[],
  minAllow: number,
): boolean {
  let allowed = 0;
  let valid = 0;
  for (const window of windows) {
    const nets = lastSignalNets(sourceNets(timeline, source), index, window);
    if (nets.length < Math.min(30, window)) continue;
    valid += 1;
    if (isHotEnvironmentAllowed(nets)) allowed += 1;
  }
  return valid > 0 && allowed >= Math.min(minAllow, valid);
}

function scoreWindow(
  timeline: ReturnType<typeof buildTimeline>,
  source: "short" | "raw",
  index: number,
  envWindow: number,
  scoreLookback: number,
) {
  const nets = sourceNets(timeline, "raw");
  const picked: number[] = [];
  for (let cursor = index - 1; cursor >= LONG_WARMUP && picked.length < scoreLookback; cursor -= 1) {
    const net = nets[cursor];
    if (net === null) continue;
    if (!allowForWindow(timeline, source, cursor, envWindow)) continue;
    picked.push(net);
  }
  return {
    events: picked.length,
    roi: roiPercent(picked),
  };
}

function chooseMetaWindow(
  timeline: ReturnType<typeof buildTimeline>,
  source: "short" | "raw",
  index: number,
  windows: readonly number[],
  scoreLookback: number,
  minEvents: number,
  fallbackWindow: number,
) {
  let bestWindow = fallbackWindow;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const window of windows) {
    const score = scoreWindow(timeline, source, index, window, scoreLookback);
    if (score.events < minEvents) continue;
    if (score.roi > bestScore) {
      bestScore = score.roi;
      bestWindow = window;
    }
  }
  return bestWindow;
}

function strategyAllows(strategy: Strategy, timeline: ReturnType<typeof buildTimeline>, index: number): boolean {
  if (strategy.kind === "none") return true;
  if (strategy.kind === "static") return true;
  if (strategy.kind === "rolling" || strategy.kind === "state" || strategy.kind === "state-cont") {
    return allowForWindow(timeline, strategy.source, index, strategy.window);
  }
  if (strategy.kind === "multi") {
    return allowForMulti(timeline, strategy.source, index, strategy.windows, strategy.minAllow);
  }
  if (strategy.kind === "auto-score" || strategy.kind === "state-auto") {
    return allowForAutoScore(timeline, strategy.source, index, strategy.windows);
  }
  if (strategy.kind === "meta-window") {
    const window = chooseMetaWindow(
      timeline,
      strategy.source,
      index,
      strategy.windows,
      strategy.scoreLookback,
      strategy.minEvents,
      strategy.fallbackWindow,
    );
    return allowForWindow(timeline, strategy.source, index, window);
  }
  return true;
}

function runSession(session: Session, strategy: Strategy): RunResult {
  const timeline = buildTimeline(session.numbers);
  const allowCache = new Map<string, { allowed: boolean[]; signalCounts: number[] }>();
  const cachedWindow = (source: "short" | "raw", window: number) => {
    const key = `${source}:${window}`;
    const cached = allowCache.get(key);
    if (cached) return cached;

    const nets = sourceNets(timeline, source);
    const allowed = new Array<boolean>(session.numbers.length + 1).fill(true);
    const signalCounts = new Array<number>(session.numbers.length + 1).fill(0);
    const recent: number[] = [];
    for (let index = 0; index <= session.numbers.length; index += 1) {
      const scoped = recent.slice(-window);
      allowed[index] = isHotEnvironmentAllowed(scoped);
      signalCounts[index] = scoped.length;
      const net = nets[index];
      if (net !== null && net !== undefined) recent.push(net);
    }

    const result = { allowed, signalCounts };
    allowCache.set(key, result);
    return result;
  };
  const windowAllows = (source: "short" | "raw", index: number, window: number) => cachedWindow(source, window).allowed[index] ?? true;
  const windowSignalCount = (source: "short" | "raw", index: number, window: number) => cachedWindow(source, window).signalCounts[index] ?? 0;
  const autoScoreAllows = (source: "short" | "raw", index: number, windows: readonly number[]) => {
    let best = { allow: false, score: Number.NEGATIVE_INFINITY };
    for (const window of windows) {
      const nets = lastSignalNets(sourceNets(timeline, source), index, window);
      if (nets.length < Math.min(30, window)) continue;
      const parts = environmentParts(nets);
      if (parts.score > best.score) {
        best = { allow: parts.allow, score: parts.score };
      }
    }
    return best.allow;
  };
  const multiAllows = (source: "short" | "raw", index: number, windows: readonly number[], minAllow: number) => {
    let allowed = 0;
    let valid = 0;
    for (const window of windows) {
      if (windowSignalCount(source, index, window) < Math.min(30, window)) continue;
      valid += 1;
      if (windowAllows(source, index, window)) allowed += 1;
    }
    return valid > 0 && allowed >= Math.min(minAllow, valid);
  };
  const scoreWindowLocal = (source: "short" | "raw", index: number, envWindow: number, scoreLookback: number) => {
    const nets = timeline.rawNets;
    const picked: number[] = [];
    for (let cursor = index - 1; cursor >= LONG_WARMUP && picked.length < scoreLookback; cursor -= 1) {
      const net = nets[cursor];
      if (net === null) continue;
      if (!windowAllows(source, cursor, envWindow)) continue;
      picked.push(net);
    }
    return { events: picked.length, roi: roiPercent(picked) };
  };
  const metaAllows = (strategy: Extract<Strategy, { kind: "meta-window" }>, index: number) => {
    let bestWindow = strategy.fallbackWindow;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const window of strategy.windows) {
      const score = scoreWindowLocal(strategy.source, index, window, strategy.scoreLookback);
      if (score.events < strategy.minEvents) continue;
      if (score.roi > bestScore) {
        bestScore = score.roi;
        bestWindow = window;
      }
    }
    return windowAllows(strategy.source, index, bestWindow);
  };
  const localStrategyAllows = (current: Strategy, index: number): boolean => {
    if (current.kind === "none" || current.kind === "static") return true;
    if (current.kind === "rolling" || current.kind === "state" || current.kind === "state-cont") {
      return windowAllows(current.source, index, current.window);
    }
    if (current.kind === "multi") return multiAllows(current.source, index, current.windows, current.minAllow);
    if (current.kind === "auto-score" || current.kind === "state-auto") return autoScoreAllows(current.source, index, current.windows);
    if (current.kind === "meta-window") return metaAllows(current, index);
    return true;
  };
  const preShortNets = timeline.shortNets.slice(0, ROI_START).filter((net): net is number => net !== null);
  const staticAllow = isHotEnvironmentAllowed(preShortNets);
  let allow = strategy.kind === "static" || strategy.kind === "state" ? staticAllow : true;
  let reopens = 0;
  let toggles = 0;
  let closedSeen = !allow;
  let openConfirm = 0;
  let closeConfirm = 0;
  const events: Event[] = [];
  let closedSpins = 0;

  for (let i = LONG_WARMUP; i < session.numbers.length; i += 1) {
    if (strategy.kind === "none") {
      allow = true;
    } else if (strategy.kind === "rolling") {
      const nextAllow = localStrategyAllows(strategy, i);
      if (i >= ROI_START && nextAllow !== allow) {
        toggles += 1;
        if (nextAllow && closedSeen) reopens += 1;
        if (!nextAllow) closedSeen = true;
      }
      allow = nextAllow;
    } else if (strategy.kind === "multi" || strategy.kind === "auto-score" || strategy.kind === "meta-window") {
      const nextAllow = localStrategyAllows(strategy, i);
      if (i >= ROI_START && nextAllow !== allow) {
        toggles += 1;
        if (nextAllow && closedSeen) reopens += 1;
        if (!nextAllow) closedSeen = true;
      }
      allow = nextAllow;
    } else if ((strategy.kind === "state" && i >= ROI_START) || strategy.kind === "state-cont" || strategy.kind === "state-auto") {
      const shouldAllow = localStrategyAllows(strategy, i);
      if (allow) {
        closeConfirm = shouldAllow ? 0 : closeConfirm + 1;
        openConfirm = 0;
        if (closeConfirm >= strategy.confirm) {
          allow = false;
          if (i >= ROI_START) {
            closedSeen = true;
            toggles += 1;
          }
          closeConfirm = 0;
        }
      } else {
        openConfirm = shouldAllow ? openConfirm + 1 : 0;
        closeConfirm = 0;
        if (openConfirm >= strategy.confirm) {
          allow = true;
          if (i >= ROI_START) {
            toggles += 1;
            if (closedSeen) reopens += 1;
          }
          openConfirm = 0;
        }
      }
    }

    if (i < ROI_START) continue;

    if (!allow) {
      closedSpins += 1;
      continue;
    }

    const pick = timeline.rawPicks[i];
    if (!pick) continue;
    const hit = session.numbers[i] === pick.number;
    events.push({
      hit,
      index: i,
      mode: pick.mode,
      net: hit ? 35 : -1,
      session: session.name,
    });
  }

  return { events, closedSpins, reopens, toggles };
}

function summarize(events: readonly Event[]) {
  const signals = events.length;
  const hits = events.filter((event) => event.hit).length;
  const bet = signals;
  const win = hits * 36;
  const net = win - bet;
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const event of events) {
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
  }
  return {
    signals,
    hits,
    bet,
    win,
    net,
    roi: bet > 0 ? (net / bet) * 100 : 0,
    winRate: signals > 0 ? (hits / signals) * 100 : 0,
    maxDrawdown,
  };
}

function runDataset(sessions: readonly Session[], strategy: Strategy) {
  const results = sessions.map((session) => runSession(session, strategy));
  const events = results.flatMap((result) => result.events);
  const summary = summarize(events);
  return {
    ...summary,
    activeSessions: new Set(events.map((event) => event.session)).size,
    closedSpins: results.reduce((sum, result) => sum + result.closedSpins, 0),
    reopenedSessions: results.filter((result) => result.reopens > 0).length,
    reopens: results.reduce((sum, result) => sum + result.reopens, 0),
    toggles: results.reduce((sum, result) => sum + result.toggles, 0),
  };
}

function fmtNum(value: number, width: number): string {
  return String(value).padStart(width);
}

function fmtPct(value: number): string {
  return `${value.toFixed(2).padStart(8)}%`;
}

function printTable(title: string, sessions: readonly Session[], strategies: readonly Strategy[]) {
  console.log(`\n${title} sessions=${sessions.length}`);
  console.log("strategy              sig   hit     net      ROI       WR      DD active closed reopen toggles");
  for (const strategy of strategies) {
    const row = runDataset(sessions, strategy);
    console.log([
      strategy.name.padEnd(20),
      fmtNum(row.signals, 5),
      fmtNum(row.hits, 5),
      fmtNum(row.net, 7),
      fmtPct(row.roi),
      fmtPct(row.winRate),
      fmtNum(row.maxDrawdown, 6),
      fmtNum(row.activeSessions, 6),
      fmtNum(row.closedSpins, 6),
      fmtNum(row.reopenedSessions, 6),
      fmtNum(row.toggles, 7),
    ].join(" "));
  }
}

const sessions = loadSessions();
const strategies: Strategy[] = [
  { name: "static-current", kind: "static" },
  { name: "no-env", kind: "none" },
  { name: "roll-short-60", kind: "rolling", source: "short", window: 60 },
  { name: "roll-short-90", kind: "rolling", source: "short", window: 90 },
  { name: "roll-short-120", kind: "rolling", source: "short", window: 120 },
  { name: "roll-raw-60", kind: "rolling", source: "raw", window: 60 },
  { name: "roll-raw-90", kind: "rolling", source: "raw", window: 90 },
  { name: "roll-raw-120", kind: "rolling", source: "raw", window: 120 },
  { name: "state-short-90x2", kind: "state", source: "short", window: 90, confirm: 2 },
  { name: "state-raw-90x2", kind: "state", source: "raw", window: 90, confirm: 2 },
  { name: "cont-short-90x2", kind: "state-cont", source: "short", window: 90, confirm: 2 },
  { name: "cont-short-90x3", kind: "state-cont", source: "short", window: 90, confirm: 3 },
  { name: "multi-short-60-120", kind: "multi", source: "short", windows: [60, 90, 120], minAllow: 2 },
  { name: "auto-short-50-150", kind: "auto-score", source: "short", windows: [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150] },
  { name: "state-auto-short", kind: "state-auto", source: "short", windows: [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150], confirm: 2 },
  { name: "meta-short-80", kind: "meta-window", source: "short", windows: [60, 80, 90, 100, 120, 150], scoreLookback: 80, minEvents: 10, fallbackWindow: 90 },
  { name: "meta-short-120", kind: "meta-window", source: "short", windows: [60, 80, 90, 100, 120, 150], scoreLookback: 120, minEvents: 10, fallbackWindow: 90 },
];

printTable("ALL", sessions, strategies);
printTable("SINCE_2026_04", sessions.filter((session) => session.sortDate >= "2026-04-01"), strategies);

for (const year of [...new Set(sessions.map((session) => session.year))].sort()) {
  const yearSessions = sessions.filter((session) => session.year === year);
  if (yearSessions.length >= 3) printTable(`YEAR_${year}`, yearSessions, strategies.slice(0, 8));
}

function printTopScan(title: string, targetSessions: readonly Session[]) {
  const scan: Strategy[] = [];
  for (let window = 40; window <= 150; window += 10) {
    scan.push({ name: `roll-short-${window}`, kind: "rolling", source: "short", window });
    scan.push({ name: `state-short-${window}x2`, kind: "state", source: "short", window, confirm: 2 });
    scan.push({ name: `state-short-${window}x3`, kind: "state", source: "short", window, confirm: 3 });
    scan.push({ name: `cont-short-${window}x2`, kind: "state-cont", source: "short", window, confirm: 2 });
    scan.push({ name: `cont-short-${window}x3`, kind: "state-cont", source: "short", window, confirm: 3 });
  }
  scan.push({ name: "multi-60-90-120", kind: "multi", source: "short", windows: [60, 90, 120], minAllow: 2 });
  scan.push({ name: "multi-50-90-130", kind: "multi", source: "short", windows: [50, 90, 130], minAllow: 2 });
  scan.push({ name: "auto-50-150", kind: "auto-score", source: "short", windows: [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150] });
  scan.push({ name: "state-auto-50-150x2", kind: "state-auto", source: "short", windows: [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150], confirm: 2 });
  scan.push({ name: "state-auto-50-150x3", kind: "state-auto", source: "short", windows: [50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150], confirm: 3 });
  for (const lookback of [40, 60, 80, 100, 120]) {
    for (const minEvents of [5, 10, 15]) {
      scan.push({
        name: `meta-${lookback}-${minEvents}`,
        kind: "meta-window",
        source: "short",
        windows: [60, 80, 90, 100, 120, 150],
        scoreLookback: lookback,
        minEvents,
        fallbackWindow: 90,
      });
    }
  }
  const rows = scan
    .map((strategy) => ({ strategy, row: runDataset(targetSessions, strategy) }))
    .sort((left, right) => right.row.roi - left.row.roi)
    .slice(0, 12);
  console.log(`\n${title} top window scan`);
  console.log("strategy              sig   hit     net      ROI       WR      DD reopen toggles");
  for (const { strategy, row } of rows) {
    console.log([
      strategy.name.padEnd(20),
      fmtNum(row.signals, 5),
      fmtNum(row.hits, 5),
      fmtNum(row.net, 7),
      fmtPct(row.roi),
      fmtPct(row.winRate),
      fmtNum(row.maxDrawdown, 6),
      fmtNum(row.reopenedSessions, 6),
      fmtNum(row.toggles, 7),
    ].join(" "));
  }
}

printTopScan("SINCE_2026_04", sessions.filter((session) => session.sortDate >= "2026-04-01"));
printTopScan("ALL", sessions);
