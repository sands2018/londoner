import fs from "node:fs";
import path from "node:path";
import { getHistoryDataTms } from "./historyTime";
import type { RouletteNumber } from "../app/src/core/roulette";

type Mode = "long" | "short";

interface RawRow {
  Count?: number;
  Name?: string;
  Numbers?: string | number[];
  SaveTime?: string;
  tms?: number;
  DataTms?: number;
  dataTms?: number;
  TableId?: string;
  tableId?: string;
}

interface Session {
  id: string;
  name: string;
  numbers: RouletteNumber[];
  dataTms: number;
}

interface Candidate {
  number: RouletteNumber;
  mode: Mode;
  count148: number;
  count74: number;
  count37: number;
  count20: number;
  seg1: number;
  seg2: number;
  seg3: number;
  lastGap: number;
  order: number;
}

interface Event {
  session: string;
  position: number;
  pick: RouletteNumber;
  mode: Mode;
  hit: boolean;
  net: number;
}

interface Strategy {
  name: string;
  missLimit: number;
  choose: (ctx: ChooseContext) => Candidate | null;
  chooseClosed?: (ctx: ChooseContext) => Candidate | null;
  confirmBase?: boolean;
  gate?: GateSpec;
}

type GateKind = "current" | "positive" | "lossOnly" | "lateNotBad" | "holdPositive" | "holdLossOnly" | "holdLateNotBad" | "always";

interface GateSpec {
  kind: GateKind;
  sampleOnly?: boolean;
  confirm?: number;
}

interface ChooseContext {
  numbers: readonly RouletteNumber[];
  end: number;
  candidates: readonly Candidate[];
  eligible: readonly Candidate[];
  broad: Candidate | null;
  rawMissStreak: ArrayLike<number>;
  numberStats: readonly NumberPaperStats[];
}

interface NumberPaperStats {
  nets: number[];
}

interface Summary {
  signals: number;
  hits: number;
  net: number;
  roi: number;
  hitRate: number;
  maxDrawdown: number;
  longestMiss: number;
  positiveSessions: number;
  activeSessions: number;
}

const ROOT = path.resolve(import.meta.dirname, "..");
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
const HOT_ENVIRONMENT_WINDOW = 90;
const HOT_ENVIRONMENT_CONFIRM = 3;

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,\uFF0C\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
}

function loadRows(file: string): Session[] {
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as RawRow[];
  return rows
    .map((row, index) => ({
      id: `${path.basename(file)}:${index}`,
      name: String(row.Name ?? `session-${index + 1}`),
      numbers: parseNumbers(row.Numbers),
      dataTms: getHistoryDataTms(row, index),
    }))
    .filter((session) => session.numbers.length > ROI_START)
    .sort((left, right) => left.dataTms - right.dataTms || left.name.localeCompare(right.name, "zh-Hans-CN"));
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
    top.splice(insertAt, 0, num as RouletteNumber);
    if (top.length > limit) top.pop();
  }
  return top;
}

function lastGap(numbers: readonly RouletteNumber[], num: RouletteNumber, end = numbers.length): number {
  for (let i = end - 1; i >= 0; i -= 1) {
    if (numbers[i] === num) return end - i;
  }
  return 999;
}

function selectLongCandidates(numbers: readonly RouletteNumber[], end = numbers.length): Candidate[] {
  if (end < LONG_WARMUP) return [];
  const start = end - ACCEL_WINDOW;
  const count148 = new Uint8Array(37);
  const count74 = new Uint8Array(37);
  const count37 = new Uint8Array(37);
  const count20 = new Uint8Array(37);
  const seg1Counts = new Uint8Array(37);
  const seg2Counts = new Uint8Array(37);
  const seg3Counts = new Uint8Array(37);

  for (let i = start; i < end; i += 1) {
    const num = numbers[i];
    if (num === 0) continue;
    count148[num] += 1;
    if (i >= end - 74) count74[num] += 1;
    if (i >= end - 37) count37[num] += 1;
    if (i >= end - 20) count20[num] += 1;
    if (i < start + SEG_SIZE) seg1Counts[num] += 1;
    else if (i < start + SEG_SIZE * 2) seg2Counts[num] += 1;
    else seg3Counts[num] += 1;
  }

  return topNFromCounts(count148, 10)
    .map((num, order) => ({ num, order }))
    .filter(({ num }) => seg3Counts[num] > seg2Counts[num] && seg2Counts[num] > seg1Counts[num])
    .filter(({ num }) => count20[num] < 4)
    .map(({ num, order }) => ({
      number: num,
      mode: "long" as const,
      count148: count148[num],
      count74: count74[num],
      count37: count37[num],
      count20: count20[num],
      seg1: seg1Counts[num],
      seg2: seg2Counts[num],
      seg3: seg3Counts[num],
      lastGap: lastGap(numbers, num, end),
      order,
    }))
    .sort((left, right) => (
      right.count74 - left.count74
      || (right.seg3 - right.seg1) - (left.seg3 - left.seg1)
      || left.order - right.order
    ));
}

function selectShortCandidates(numbers: readonly RouletteNumber[], end = numbers.length): Candidate[] {
  if (end < SHORT_WARMUP) return [];
  const count37 = new Uint8Array(37);
  const count74 = new Uint8Array(37);
  const count111 = new Uint8Array(37);
  const count148 = new Uint8Array(37);
  const count20 = new Uint8Array(37);
  const firstHalf37 = new Uint8Array(37);
  const secondHalf37 = new Uint8Array(37);
  const start111 = end - 111;
  const start74 = end - 74;
  const start37 = end - 37;
  const start148 = Math.max(0, end - 148);
  const mid37 = start37 + 18;

  for (let i = start148; i < end; i += 1) {
    const num = numbers[i];
    if (num === 0) continue;
    count148[num] += 1;
    if (i >= start111) count111[num] += 1;
    if (i >= start74) count74[num] += 1;
    if (i >= start37) {
      count37[num] += 1;
      if (i < mid37) firstHalf37[num] += 1;
      else secondHalf37[num] += 1;
    }
    if (i >= end - 20) count20[num] += 1;
  }

  const h37 = new Set(topNFromCounts(count37, 5));
  const h74 = new Set(topNFromCounts(count74, 5));
  const h111 = new Set(topNFromCounts(count111, 5));
  return [...h37]
    .map((num, order) => ({ num, order }))
    .filter(({ num }) => h74.has(num) && h111.has(num))
    .filter(({ num }) => secondHalf37[num] > firstHalf37[num])
    .filter(({ num }) => count20[num] < 4)
    .map(({ num, order }) => ({
      number: num,
      mode: "short" as const,
      count148: count148[num],
      count74: count74[num],
      count37: count37[num],
      count20: count20[num],
      seg1: 0,
      seg2: 0,
      seg3: 0,
      lastGap: lastGap(numbers, num, end),
      order,
    }))
    .sort((left, right) => right.count37 - left.count37 || left.order - right.order);
}

function precomputeCandidates(numbers: readonly RouletteNumber[]) {
  const longCandidates: Candidate[][] = Array.from({ length: numbers.length + 1 }, () => []);
  const shortCandidates: Candidate[][] = Array.from({ length: numbers.length + 1 }, () => []);
  for (let i = LONG_WARMUP; i <= numbers.length; i += 1) longCandidates[i] = selectLongCandidates(numbers, i);
  for (let i = SHORT_WARMUP; i <= numbers.length; i += 1) shortCandidates[i] = selectShortCandidates(numbers, i);
  return { longCandidates, shortCandidates };
}

function netRoiPercent(nets: readonly number[]): number {
  return nets.length > 0 ? (nets.reduce((sum, net) => sum + net, 0) / nets.length) * 100 : 0;
}

function environmentMetrics(nets: readonly number[]): { overallRoi: number; earlyRoi: number; lateRoi: number } {
  const overallRoi = netRoiPercent(nets);
  const splitIndex = Math.floor(nets.length / 2);
  return {
    overallRoi,
    earlyRoi: netRoiPercent(nets.slice(0, splitIndex)),
    lateRoi: netRoiPercent(nets.slice(splitIndex)),
  };
}

function isHotEnvironmentAllowed(nets: readonly number[], kind: GateKind, currentlyOpen: boolean): boolean {
  if (nets.length === 0) return true;
  const { overallRoi, earlyRoi, lateRoi } = environmentMetrics(nets);

  if (kind === "always") return true;
  if (kind === "current") return overallRoi < 0 && lateRoi >= earlyRoi;
  if (kind === "positive") return overallRoi >= 0 || lateRoi >= earlyRoi;
  if (kind === "lossOnly") return !(overallRoi < -25 && lateRoi < earlyRoi && lateRoi < -25);
  if (kind === "lateNotBad") return overallRoi >= 0 || lateRoi >= earlyRoi || lateRoi >= -25;
  if (kind === "holdPositive") {
    return currentlyOpen
      ? overallRoi >= 0 || lateRoi >= earlyRoi
      : overallRoi < 0 && lateRoi >= earlyRoi;
  }
  if (kind === "holdLossOnly") {
    return currentlyOpen
      ? !(overallRoi < -25 && lateRoi < earlyRoi && lateRoi < -25)
      : overallRoi < 0 && lateRoi >= earlyRoi;
  }
  if (kind === "holdLateNotBad") {
    return currentlyOpen
      ? overallRoi >= 0 || lateRoi >= earlyRoi || lateRoi >= -25
      : overallRoi < 0 && lateRoi >= earlyRoi;
  }
  return true;
}

function updateHotEnvironmentState(
  recentShortNets: readonly number[],
  allowsSignals: boolean,
  allowConfirmCount: number,
  blockConfirmCount: number,
  gate: GateSpec,
) {
  const shouldAllow = isHotEnvironmentAllowed(recentShortNets, gate.kind, allowsSignals);
  const confirm = gate.confirm ?? HOT_ENVIRONMENT_CONFIRM;
  if (allowsSignals) {
    const nextBlockConfirmCount = shouldAllow ? 0 : blockConfirmCount + 1;
    if (nextBlockConfirmCount >= confirm) {
      return { allowsSignals: false, allowConfirmCount: 0, blockConfirmCount: 0 };
    }
    return { allowsSignals: true, allowConfirmCount: 0, blockConfirmCount: nextBlockConfirmCount };
  }
  const nextAllowConfirmCount = shouldAllow ? allowConfirmCount + 1 : 0;
  if (nextAllowConfirmCount >= confirm) {
    return { allowsSignals: true, allowConfirmCount: 0, blockConfirmCount: 0 };
  }
  return { allowsSignals: false, allowConfirmCount: nextAllowConfirmCount, blockConfirmCount: 0 };
}

function shouldPreferShort(longCnt: number, longNet: number, shortCnt: number, shortNet: number): boolean {
  const shortRoi = shortCnt > 0 ? (shortNet / shortCnt) * 100 : -999;
  const longRoi = longCnt > 0 ? (longNet / longCnt) * 100 : -999;
  return shortCnt >= ADAPTIVE_MIN_SHORT_SIGNALS
    && shortRoi >= ADAPTIVE_MIN_SHORT_ROI
    && shortRoi >= longRoi + ADAPTIVE_SHORT_EDGE;
}

function orderedCandidates(
  longCandidates: readonly Candidate[],
  shortCandidates: readonly Candidate[],
  preferShort: boolean,
): Candidate[] {
  return preferShort ? [...shortCandidates, ...longCandidates] : [...longCandidates, ...shortCandidates];
}

function broadCoolCandidate(numbers: readonly RouletteNumber[], end: number): Candidate | null {
  let best: RouletteNumber | null = null;
  let bestScore = -Infinity;
  for (let num = 1; num <= 36; num += 1) {
    const n = num as RouletteNumber;
    const recentHalf = countInWindow(numbers, n, 18, end);
    const priorHalf = countInWindow(numbers, n, 19, end - 18);
    const count20 = countInWindow(numbers, n, 20, end);
    const count37 = recentHalf + priorHalf;
    const count74 = countInWindow(numbers, n, 74, end);
    const count111 = countInWindow(numbers, n, 111, end);
    const gap = lastGap(numbers, n, end);
    if (count37 < 2 || count74 < 3 || count111 < 4 || count20 > 3) continue;
    if (recentHalf <= priorHalf) continue;
    const score = count111 * 30 + count74 * 25 - count20 * 30 + Math.min(gap, 60);
    if (score > bestScore || (score === bestScore && n < (best ?? 37))) {
      best = n;
      bestScore = score;
    }
  }
  if (best === null) return null;
  return {
    number: best,
    mode: "long",
    count148: countInWindow(numbers, best, 148, end),
    count74: countInWindow(numbers, best, 74, end),
    count37: countInWindow(numbers, best, 37, end),
    count20: countInWindow(numbers, best, 20, end),
    seg1: 0,
    seg2: 0,
    seg3: 0,
    lastGap: lastGap(numbers, best, end),
    order: 0,
  };
}

function paperStatsScore(stats: NumberPaperStats, limit: number): { count: number; net: number; roi: number } {
  const slice = stats.nets.slice(-limit);
  const net = slice.reduce((sum, value) => sum + value, 0);
  return { count: slice.length, net, roi: slice.length > 0 ? (net / slice.length) * 100 : -999 };
}

function firstEligible(ctx: ChooseContext): Candidate | null {
  return ctx.eligible[0] ?? ctx.broad;
}

function firstWithMinGap(minGap: number) {
  return (ctx: ChooseContext): Candidate | null => ctx.eligible.find((candidate) => candidate.lastGap >= minGap)
    ?? firstEligible(ctx);
}

function bestByGap(ctx: ChooseContext): Candidate | null {
  if (ctx.eligible.length === 0) return ctx.broad;
  return [...ctx.eligible].sort((left, right) => (
    Math.min(right.lastGap, 45) - Math.min(left.lastGap, 45)
    || left.order - right.order
  ))[0] ?? null;
}

function bestByDueGap(ctx: ChooseContext): Candidate | null {
  if (ctx.eligible.length === 0) return ctx.broad;
  return [...ctx.eligible].sort((left, right) => (
    Math.abs(left.lastGap - 24) - Math.abs(right.lastGap - 24)
    || left.order - right.order
  ))[0] ?? null;
}

function bestByPaper(limit: number, minSamples: number) {
  return (ctx: ChooseContext): Candidate | null => {
    if (ctx.eligible.length === 0) return ctx.broad;
    const ranked = [...ctx.eligible].sort((left, right) => {
      const leftStats = paperStatsScore(ctx.numberStats[left.number], limit);
      const rightStats = paperStatsScore(ctx.numberStats[right.number], limit);
      const leftRoi = leftStats.count >= minSamples ? leftStats.roi : -999;
      const rightRoi = rightStats.count >= minSamples ? rightStats.roi : -999;
      return rightRoi - leftRoi
        || Math.min(right.lastGap, 45) - Math.min(left.lastGap, 45)
        || left.order - right.order;
    });
    return ranked[0] ?? firstEligible(ctx);
  };
}

function paperSwitch(limit: number, minSamples: number, edge: number) {
  return (ctx: ChooseContext): Candidate | null => {
    const current = firstEligible(ctx);
    if (current === null || ctx.eligible.length <= 1) return current;
    const currentStats = paperStatsScore(ctx.numberStats[current.number], limit);
    const currentRoi = currentStats.count >= minSamples ? currentStats.roi : -999;
    let best = current;
    let bestRoi = currentRoi;
    for (const candidate of ctx.eligible) {
      const stats = paperStatsScore(ctx.numberStats[candidate.number], limit);
      if (stats.count < minSamples) continue;
      if (stats.roi > bestRoi || (stats.roi === bestRoi && candidate.order < best.order)) {
        best = candidate;
        bestRoi = stats.roi;
      }
    }
    return best !== current && bestRoi >= currentRoi + edge ? best : current;
  };
}

function gapSwitch(minGapEdge: number) {
  return (ctx: ChooseContext): Candidate | null => {
    const current = firstEligible(ctx);
    if (current === null || ctx.eligible.length <= 1) return current;
    const best = [...ctx.eligible].sort((left, right) => (
      Math.min(right.lastGap, 45) - Math.min(left.lastGap, 45)
      || left.order - right.order
    ))[0];
    return best && best.lastGap >= current.lastGap + minGapEdge ? best : current;
  };
}

function closedPaper(limit: number, minSamples: number, minRoi: number) {
  return (ctx: ChooseContext): Candidate | null => {
    if (ctx.eligible.length === 0) return null;
    let best: Candidate | null = null;
    let bestRoi = -999;
    for (const candidate of ctx.eligible) {
      const stats = paperStatsScore(ctx.numberStats[candidate.number], limit);
      if (stats.count < minSamples || stats.roi < minRoi) continue;
      if (stats.roi > bestRoi || (stats.roi === bestRoi && candidate.order < (best?.order ?? 99))) {
        best = candidate;
        bestRoi = stats.roi;
      }
    }
    return best;
  };
}

function hybridScore(ctx: ChooseContext): Candidate | null {
  if (ctx.eligible.length === 0) return ctx.broad;
  let best: Candidate | null = null;
  let bestScore = -Infinity;
  for (const candidate of ctx.eligible) {
    const stats37 = paperStatsScore(ctx.numberStats[candidate.number], 37);
    const stats74 = paperStatsScore(ctx.numberStats[candidate.number], 74);
    const paper = stats37.count >= 6 ? stats37.roi : (stats74.count >= 10 ? stats74.roi * 0.7 : -25);
    const gapScore = Math.min(candidate.lastGap, 45) * 2 - Math.max(0, 5 - candidate.lastGap) * 18;
    const accel = candidate.mode === "long" ? (candidate.seg3 - candidate.seg1) * 8 : candidate.count37 * 5;
    const score = paper * 0.35 + gapScore + accel - candidate.count20 * 12 - candidate.order * 4;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

function updateNumberStats(
  stats: NumberPaperStats[],
  candidates: readonly Candidate[],
  outcome: RouletteNumber,
): void {
  const seen = new Set<number>();
  for (const candidate of candidates) {
    if (seen.has(candidate.number)) continue;
    seen.add(candidate.number);
    const queue = stats[candidate.number].nets;
    queue.push(outcome === candidate.number ? 35 : -1);
    if (queue.length > 150) queue.shift();
  }
}

function runSession(session: Session, strategy: Strategy, requirePaperHitAfterRoiStart: boolean): Event[] {
  const numbers = session.numbers;
  if (numbers.length < LONG_WARMUP) return [];
  const { longCandidates, shortCandidates } = precomputeCandidates(numbers);

  const numberStats: NumberPaperStats[] = Array.from({ length: 37 }, () => ({ nets: [] }));
  const rawMissStreak = new Uint16Array(37);
  const recentShortEnvironmentNets: number[] = [];
  let environmentAllowsSignals = true;
  let allowConfirmCount = 0;
  let blockConfirmCount = 0;
  let hasPendingEnvironmentSample = false;
  let paperHitConfirmed = !requirePaperHitAfterRoiStart;
  let longCnt = 0;
  let longNet = 0;
  let shortCnt = 0;
  let shortNet = 0;
  const longQueue: Array<{ index: number; net: number }> = [];
  const shortQueue: Array<{ index: number; net: number }> = [];
  let longQueueStart = 0;
  let shortQueueStart = 0;
  const events: Event[] = [];

  function pushPaper(longN: Candidate | null, shortN: Candidate | null, outcomeIdx: number): void {
    if (longN !== null) {
      const net = numbers[outcomeIdx] === longN.number ? 35 : -1;
      longQueue.push({ index: outcomeIdx, net });
      longNet += net;
      longCnt += 1;
    }
    if (shortN !== null && outcomeIdx >= SHORT_WARMUP) {
      const net = numbers[outcomeIdx] === shortN.number ? 35 : -1;
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

  function pushShortEnvironmentNet(shortN: Candidate | null, outcomeIdx: number): void {
    if (shortN === null) return;
    recentShortEnvironmentNets.push(numbers[outcomeIdx] === shortN.number ? 35 : -1);
    if (recentShortEnvironmentNets.length > HOT_ENVIRONMENT_WINDOW) recentShortEnvironmentNets.shift();
    hasPendingEnvironmentSample = true;
  }

  for (let i = LONG_WARMUP; i < numbers.length; i += 1) {
    if (i > LONG_WARMUP) {
      pushPaper(longCandidates[i - 1][0] ?? null, shortCandidates[i - 1][0] ?? null, i - 1);
    }
    trimPaper(Math.max(LONG_WARMUP, i - ADAPTIVE_LOOKBACK));

    const gate = strategy.gate ?? { kind: "current" };
    if (!gate.sampleOnly || hasPendingEnvironmentSample) {
      const env = updateHotEnvironmentState(
        recentShortEnvironmentNets,
        environmentAllowsSignals,
        allowConfirmCount,
        blockConfirmCount,
        gate,
      );
      environmentAllowsSignals = env.allowsSignals;
      allowConfirmCount = env.allowConfirmCount;
      blockConfirmCount = env.blockConfirmCount;
      hasPendingEnvironmentSample = false;
    }

    const candidates = orderedCandidates(
      longCandidates[i],
      shortCandidates[i],
      shouldPreferShort(longCnt, longNet, shortCnt, shortNet),
    );
    const rawPick = candidates[0] ?? null;
    const eligible = candidates.filter((candidate) => rawMissStreak[candidate.number] < strategy.missLimit);
    const broad = broadCoolCandidate(numbers, i);
    const chooseContext = { numbers, end: i, candidates, eligible, broad, rawMissStreak, numberStats };
    const pick = environmentAllowsSignals
      ? strategy.choose(chooseContext)
      : strategy.chooseClosed?.(chooseContext) ?? null;

    if (pick !== null) {
      const hit = numbers[i] === pick.number;
      if (i >= ROI_START && !paperHitConfirmed) {
        const confirmPick = strategy.confirmBase ? firstEligible(chooseContext) : pick;
        if (confirmPick !== null && numbers[i] === confirmPick.number) paperHitConfirmed = true;
      } else if (i >= ROI_START) {
        events.push({
          session: session.name,
          position: i,
          pick: pick.number,
          mode: pick.mode,
          hit,
          net: hit ? 35 : -1,
        });
      }
    }

    if (rawPick !== null) {
      rawMissStreak[rawPick.number] = numbers[i] === rawPick.number ? 0 : rawMissStreak[rawPick.number] + 1;
    }
    updateNumberStats(numberStats, candidates, numbers[i]);
    pushShortEnvironmentNet(shortCandidates[i][0] ?? null, i);
  }
  return events;
}

function summarize(events: readonly Event[]): Summary {
  const signals = events.length;
  const hits = events.filter((event) => event.hit).length;
  const net = events.reduce((sum, event) => sum + event.net, 0);
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let currentMiss = 0;
  let longestMiss = 0;
  const sessionNet = new Map<string, number>();
  for (const event of events) {
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
    if (event.hit) currentMiss = 0;
    else currentMiss += 1;
    longestMiss = Math.max(longestMiss, currentMiss);
    sessionNet.set(event.session, (sessionNet.get(event.session) ?? 0) + event.net);
  }
  return {
    signals,
    hits,
    net,
    roi: signals > 0 ? (net / signals) * 100 : 0,
    hitRate: signals > 0 ? (hits / signals) * 100 : 0,
    maxDrawdown,
    longestMiss,
    positiveSessions: [...sessionNet.values()].filter((value) => value > 0).length,
    activeSessions: sessionNet.size,
  };
}

function runDataset(sessions: readonly Session[], strategy: Strategy, requireConfirm: boolean): { summary: Summary; events: Event[] } {
  const events = sessions.flatMap((session) => runSession(session, strategy, requireConfirm));
  return { summary: summarize(events), events };
}

function fmt(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function printRows(title: string, sessions: readonly Session[], strategies: readonly Strategy[], requireConfirm: boolean): void {
  console.log(`\n${title} sessions=${sessions.length} confirm=${requireConfirm}`);
  console.log("strategy           sig    hit      net       ROI      HR     DD  miss  pos/act");
  for (const strategy of strategies) {
    const { summary } = runDataset(sessions, strategy, requireConfirm);
    console.log([
      strategy.name.padEnd(17),
      String(summary.signals).padStart(5),
      String(summary.hits).padStart(5),
      String(summary.net).padStart(8),
      fmt(summary.roi).padStart(9),
      fmt(summary.hitRate).padStart(8),
      String(summary.maxDrawdown).padStart(6),
      String(summary.longestMiss).padStart(5),
      `${summary.positiveSessions}/${summary.activeSessions}`.padStart(8),
    ].join(" "));
  }
}

const strategies: Strategy[] = [
  { name: "current7", missLimit: 7, choose: firstEligible },
  { name: "current5", missLimit: 5, choose: firstEligible },
  { name: "current4", missLimit: 4, choose: firstEligible },
  { name: "gap>=3", missLimit: 7, choose: firstWithMinGap(3) },
  { name: "gap>=5", missLimit: 7, choose: firstWithMinGap(5) },
  { name: "gapMax", missLimit: 7, choose: bestByGap },
  { name: "gapDue24", missLimit: 7, choose: bestByDueGap },
  { name: "paper37", missLimit: 7, choose: bestByPaper(37, 6) },
  { name: "paper74", missLimit: 7, choose: bestByPaper(74, 10) },
  { name: "paper111", missLimit: 7, choose: bestByPaper(111, 12) },
  { name: "switch50+0", missLimit: 7, choose: paperSwitch(50, 8, 0) },
  { name: "switch50base", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true },
  { name: "sw50-sample", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "current", sampleOnly: true } },
  { name: "sw50-pos", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "positive" } },
  { name: "sw50-posS", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "positive", sampleOnly: true } },
  { name: "sw50-lossS", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "lossOnly", sampleOnly: true } },
  { name: "sw50-lateS", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "lateNotBad", sampleOnly: true } },
  { name: "sw50-holdPosS", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "holdPositive", sampleOnly: true } },
  { name: "sw50-holdLossS", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "holdLossOnly", sampleOnly: true } },
  { name: "sw50-holdLateS", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "holdLateNotBad", sampleOnly: true } },
  { name: "sw50-open", missLimit: 7, choose: paperSwitch(50, 8, 0), confirmBase: true, gate: { kind: "always" } },
  { name: "switch74+25", missLimit: 7, choose: paperSwitch(74, 10, 25) },
  { name: "switch74+50", missLimit: 7, choose: paperSwitch(74, 10, 50) },
  { name: "switch111+25", missLimit: 7, choose: paperSwitch(111, 12, 25) },
  { name: "switch111+50", missLimit: 7, choose: paperSwitch(111, 12, 50) },
  { name: "gapSwitch8", missLimit: 7, choose: gapSwitch(8) },
  { name: "gapSwitch12", missLimit: 7, choose: gapSwitch(12) },
  { name: "hybrid", missLimit: 7, choose: hybridScore },
  { name: "hybrid5", missLimit: 5, choose: hybridScore },
  { name: "softP74+50", missLimit: 7, choose: firstEligible, chooseClosed: closedPaper(74, 10, 50) },
  { name: "softP74+100", missLimit: 7, choose: firstEligible, chooseClosed: closedPaper(74, 10, 100) },
  { name: "softP111+50", missLimit: 7, choose: firstEligible, chooseClosed: closedPaper(111, 12, 50) },
];

const historySessions = loadRows(HISTORY_PATH);
const extraPath = process.argv[2];
const extraSessions = extraPath && fs.existsSync(extraPath) ? loadRows(extraPath) : [];
const recent10 = historySessions.slice(-10);
const recent2026 = historySessions.filter((session) => new Date(session.dataTms).getFullYear() >= 2026);
const gateOnly = process.argv.includes("--gate-only");
const activeStrategies = gateOnly
  ? strategies.filter((strategy) => strategy.name === "switch50base" || strategy.name.startsWith("sw50-"))
  : strategies;

printRows("history-all", historySessions, activeStrategies, false);
printRows("history-all", historySessions, activeStrategies, true);
printRows("history-2026", recent2026, activeStrategies, true);
printRows("history-last10", recent10, activeStrategies, true);
if (extraSessions.length > 0) {
  printRows("attached-3", extraSessions, activeStrategies, true);
  for (const session of extraSessions) {
    printRows(session.name, [session], activeStrategies, true);
  }
}

function scanStrategies(): void {
  const generated: Strategy[] = [];
  for (const limit of [37, 50, 74, 90, 111, 148]) {
    for (const minSamples of [5, 8, 10, 12, 15]) {
      for (const edge of [0, 15, 25, 40, 50, 75, 100]) {
        generated.push({
          name: `sw${limit}-${minSamples}+${edge}`,
          missLimit: 7,
          choose: paperSwitch(limit, minSamples, edge),
        });
      }
    }
  }
  for (const edge of [4, 6, 8, 10, 12, 16, 20]) {
    generated.push({ name: `gapSw${edge}`, missLimit: 7, choose: gapSwitch(edge) });
  }
  for (const threshold of [50, 75, 100, 150, 200]) {
    generated.push({
      name: `soft74-${threshold}`,
      missLimit: 7,
      choose: firstEligible,
      chooseClosed: closedPaper(74, 10, threshold),
    });
  }

  const baseAll = runDataset(historySessions, strategies[0], true).summary;
  const baseRecent = runDataset(recent2026, strategies[0], true).summary;
  const baseLast10 = runDataset(recent10, strategies[0], true).summary;
  const baseExtra = extraSessions.length > 0 ? runDataset(extraSessions, strategies[0], true).summary : null;
  const rows = generated
    .map((strategy) => {
      const all = runDataset(historySessions, strategy, true).summary;
      const y2026 = runDataset(recent2026, strategy, true).summary;
      const last10 = runDataset(recent10, strategy, true).summary;
      const extra = baseExtra ? runDataset(extraSessions, strategy, true).summary : null;
      const signalFloor = all.signals >= baseAll.signals * 0.98 && y2026.signals >= baseRecent.signals * 0.95;
      const score = (all.roi - baseAll.roi) * 2
        + (y2026.roi - baseRecent.roi)
        + (last10.roi - baseLast10.roi) * 0.5
        + (extra && baseExtra ? (extra.net - baseExtra.net) * 0.05 : 0)
        - Math.max(0, baseAll.signals - all.signals) * 0.01;
      return { strategy, all, y2026, last10, extra, signalFloor, score };
    })
    .filter((row) => row.signalFloor)
    .sort((left, right) => right.score - left.score)
    .slice(0, 15);

  console.log("\nscan-top signalFloor all>=98% 2026>=95%");
  console.log("strategy           allROI allSig 26ROI 26Sig lastROI lastSig extraNet extraSig");
  for (const row of rows) {
    console.log([
      row.strategy.name.padEnd(17),
      fmt(row.all.roi).padStart(8),
      String(row.all.signals).padStart(6),
      fmt(row.y2026.roi).padStart(8),
      String(row.y2026.signals).padStart(6),
      fmt(row.last10.roi).padStart(8),
      String(row.last10.signals).padStart(7),
      String(row.extra?.net ?? 0).padStart(8),
      String(row.extra?.signals ?? 0).padStart(8),
    ].join(" "));
  }
}

if (!gateOnly) scanStrategies();
