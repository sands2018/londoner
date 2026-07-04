import fs from "node:fs";
import path from "node:path";

import type { RouletteNumber } from "../app/src/core/roulette";

interface RawRow {
  Count?: number;
  Name?: string;
  Numbers?: string | number[];
  DataTms?: number;
  tms?: number;
  TableId?: string;
  tableId?: string;
}

interface Session {
  id: string;
  importIndex: number;
  name: string;
  numbers: RouletteNumber[];
  updatedTms: number;
  dataTms?: number;
}

interface Sector {
  startIndex: number;
  centerIndex: number;
  center: RouletteNumber;
  numbers: RouletteNumber[];
  count: number;
  z: number;
}

interface StateFeature {
  centers: Record<number, RouletteNumber>;
  zByWindow: Record<number, number>;
  vectors: Record<number, number[]>;
  lineShape: number[];
  drift80to160: number;
}

interface StateSample {
  id: string;
  session: Session;
  prefix: number;
  future: RouletteNumber[];
  feature: StateFeature;
}

interface FeatureMode {
  id: string;
  label: string;
  centerWeights: Array<[number, number]>;
  vectorWindow?: number;
  vectorWeight: number;
  lineWeight: number;
  driftWeight: number;
}

interface Candidate {
  id: string;
  mode: FeatureMode;
  k: number;
  sectorSize: number;
  lookahead: number;
  horizon: number;
  minEdgeRatio: number;
  resonanceMax: number | null;
}

interface TargetCache {
  sector: Sector;
  edgeRatio: number;
}

interface EvalResult {
  candidateId: string;
  signals: number;
  bet: number;
  win: number;
  hits: number;
  net: number;
  roi: number;
  sp100: number;
  maxDrawdown: number;
  activeSessions: number;
  positiveSessions: number;
  negativeSessions: number;
  signalGini: number;
  top5SignalShare: number;
  top10SignalShare: number;
  sessionRows: SessionEvalRow[];
}

interface SessionEvalRow {
  name: string;
  signals: number;
  bet: number;
  net: number;
  roi: number;
}

interface NeighborEntry {
  sample: StateSample;
  distance: number;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "state-matching-train-test-20260703.md");

const MIN_SESSION_NUMBERS = 230;
const ROI_START = 200;
const SAMPLE_STEP = 10;
const MAX_HORIZON = 5;
const MAX_K = 60;
const TEST_SESSION_COUNT = 20;
const VALIDATION_SESSION_COUNT = 20;
const WINDOWS = [80, 120, 160] as const;

const WHEEL_ORDER: RouletteNumber[] = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];

const WHEEL_INDEX = new Map<RouletteNumber, number>(
  WHEEL_ORDER.map((number, index) => [number, index]),
);

const GROUPS: RouletteNumber[][] = [
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  [13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24],
  [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36],
];

const ROWS: RouletteNumber[][] = [
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
];

const FEATURE_MODES: FeatureMode[] = [
  {
    id: "space120",
    label: "120口空间相似",
    centerWeights: [[120, 1]],
    vectorWindow: 120,
    vectorWeight: 0.7,
    lineWeight: 0,
    driftWeight: 0,
  },
  {
    id: "space160",
    label: "160口空间相似",
    centerWeights: [[160, 1]],
    vectorWindow: 160,
    vectorWeight: 0.7,
    lineWeight: 0,
    driftWeight: 0,
  },
  {
    id: "space80_160",
    label: "80/160共振",
    centerWeights: [[80, 0.7], [160, 1]],
    vectorWindow: 160,
    vectorWeight: 0.6,
    lineWeight: 0,
    driftWeight: 0.35,
  },
  {
    id: "space160_line",
    label: "160空间+行组形状",
    centerWeights: [[160, 1]],
    vectorWindow: 160,
    vectorWeight: 0.55,
    lineWeight: 0.45,
    driftWeight: 0,
  },
  {
    id: "triple_line",
    label: "80/120/160+行组",
    centerWeights: [[80, 0.5], [120, 0.7], [160, 1]],
    vectorWindow: 160,
    vectorWeight: 0.45,
    lineWeight: 0.35,
    driftWeight: 0.25,
  },
];

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => (
    Number.isInteger(value) && value >= 0 && value <= 36
  ));
}

function sessionTime(session: Session): number {
  return Number.isFinite(session.dataTms) ? session.dataTms ?? 0 : session.updatedTms;
}

function formatDate(tms: number | undefined): string {
  if (!Number.isFinite(tms)) return "-";
  return new Date(tms as number).toISOString().slice(0, 10);
}

function loadSessions(): { sessions: Session[]; rawCount: number; manualRows: number } {
  const rawRows = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8")) as RawRow[];
  const sessions = rawRows.map((row, index) => ({
    id: `row-${index + 1}`,
    importIndex: index,
    name: row.Name ?? `row-${index + 1}`,
    numbers: parseNumbers(row.Numbers),
    updatedTms: row.tms ?? row.DataTms ?? index,
    dataTms: row.DataTms,
  })).filter((session) => session.numbers.length >= MIN_SESSION_NUMBERS);

  sessions.sort((left, right) => (
    sessionTime(left) - sessionTime(right)
    || left.importIndex - right.importIndex
    || left.name.localeCompare(right.name, "zh-Hans-CN")
  ));

  return {
    sessions,
    rawCount: rawRows.length,
    manualRows: rawRows.filter((row) => Boolean(row.TableId ?? row.tableId)).length,
  };
}

function wheelIndex(number: RouletteNumber): number {
  return WHEEL_INDEX.get(number) ?? 0;
}

function circularDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, WHEEL_ORDER.length - distance);
}

function sectorDistance(left: RouletteNumber, right: RouletteNumber): number {
  return circularDistance(wheelIndex(left), wheelIndex(right));
}

function makeCounts(numbers: readonly RouletteNumber[]): number[] {
  const counts = Array(WHEEL_ORDER.length).fill(0);
  for (const number of numbers) counts[wheelIndex(number)] += 1;
  return counts;
}

function sectorFromCounts(
  counts: readonly number[],
  startIndex: number,
  size: number,
  total: number,
): Sector {
  let count = 0;
  const numbers: RouletteNumber[] = [];
  for (let offset = 0; offset < size; offset += 1) {
    const index = (startIndex + offset) % WHEEL_ORDER.length;
    count += counts[index];
    numbers.push(WHEEL_ORDER[index]);
  }
  const p = size / WHEEL_ORDER.length;
  const expected = total * p;
  const variance = total * p * (1 - p);
  const centerIndex = (startIndex + Math.floor(size / 2)) % WHEEL_ORDER.length;
  return {
    startIndex,
    centerIndex,
    center: WHEEL_ORDER[centerIndex],
    numbers,
    count,
    z: variance > 0 ? (count - expected) / Math.sqrt(variance) : 0,
  };
}

function topSector(numbers: readonly RouletteNumber[], size: number): Sector {
  const counts = makeCounts(numbers);
  return WHEEL_ORDER
    .map((_, startIndex) => sectorFromCounts(counts, startIndex, size, numbers.length))
    .sort((left, right) => right.count - left.count || right.z - left.z)[0];
}

function sectorVector(numbers: readonly RouletteNumber[], size = 7): number[] {
  const counts = makeCounts(numbers);
  return WHEEL_ORDER.map((_, startIndex) => {
    const sector = sectorFromCounts(counts, startIndex, size, numbers.length);
    return numbers.length > 0 ? sector.count / numbers.length : 0;
  });
}

function correlation(left: readonly number[], right: readonly number[]): number {
  const length = Math.min(left.length, right.length);
  if (length === 0) return 0;
  const leftMean = left.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  const rightMean = right.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  let numerator = 0;
  let leftDenominator = 0;
  let rightDenominator = 0;
  for (let index = 0; index < length; index += 1) {
    const leftDiff = left[index] - leftMean;
    const rightDiff = right[index] - rightMean;
    numerator += leftDiff * rightDiff;
    leftDenominator += leftDiff * leftDiff;
    rightDenominator += rightDiff * rightDiff;
  }
  return leftDenominator > 0 && rightDenominator > 0
    ? numerator / Math.sqrt(leftDenominator * rightDenominator)
    : 0;
}

function lineShape(numbers: readonly RouletteNumber[]): number[] {
  const expected = numbers.length * (12 / 37);
  const variance = numbers.length * (12 / 37) * (25 / 37);
  const denominator = variance > 0 ? Math.sqrt(variance) : 1;
  return [...GROUPS, ...ROWS].map((line) => {
    const set = new Set(line);
    const count = numbers.filter((number) => set.has(number)).length;
    return (count - expected) / denominator;
  });
}

function makeFeature(numbers: readonly RouletteNumber[], prefix: number): StateFeature {
  const centers: Record<number, RouletteNumber> = {};
  const zByWindow: Record<number, number> = {};
  const vectors: Record<number, number[]> = {};
  for (const window of WINDOWS) {
    const slice = numbers.slice(Math.max(0, prefix - window), prefix);
    const sector = topSector(slice, 7);
    centers[window] = sector.center;
    zByWindow[window] = sector.z;
    vectors[window] = sectorVector(slice, 7);
  }
  const recent60 = numbers.slice(Math.max(0, prefix - 60), prefix);
  return {
    centers,
    zByWindow,
    vectors,
    lineShape: lineShape(recent60),
    drift80to160: sectorDistance(centers[80], centers[160]),
  };
}

function makeSamples(sessions: readonly Session[]): StateSample[] {
  const samples: StateSample[] = [];
  for (const session of sessions) {
    for (let prefix = ROI_START; prefix + MAX_HORIZON <= session.numbers.length; prefix += SAMPLE_STEP) {
      samples.push({
        id: `${session.id}:${prefix}`,
        session,
        prefix,
        future: session.numbers.slice(prefix, prefix + MAX_HORIZON),
        feature: makeFeature(session.numbers, prefix),
      });
    }
  }
  return samples;
}

function featureDistance(left: StateFeature, right: StateFeature, mode: FeatureMode): number {
  let weighted = 0;
  let weightSum = 0;
  for (const [window, weight] of mode.centerWeights) {
    weighted += weight * (sectorDistance(left.centers[window], right.centers[window]) / 18);
    weightSum += weight;
  }
  if (mode.vectorWindow && mode.vectorWeight > 0) {
    weighted += mode.vectorWeight * ((1 - correlation(left.vectors[mode.vectorWindow], right.vectors[mode.vectorWindow])) / 2);
    weightSum += mode.vectorWeight;
  }
  if (mode.lineWeight > 0) {
    const sumSquares = left.lineShape.reduce((sum, value, index) => {
      const diff = value - right.lineShape[index];
      return sum + diff * diff;
    }, 0);
    weighted += mode.lineWeight * Math.min(1, Math.sqrt(sumSquares / left.lineShape.length) / 4);
    weightSum += mode.lineWeight;
  }
  if (mode.driftWeight > 0) {
    weighted += mode.driftWeight * (Math.abs(left.drift80to160 - right.drift80to160) / 18);
    weightSum += mode.driftWeight;
  }
  return weightSum > 0 ? weighted / weightSum : 1;
}

function precomputeNeighbors(
  evalSamples: readonly StateSample[],
  referenceSamples: readonly StateSample[],
  mode: FeatureMode,
): Map<string, NeighborEntry[]> {
  const result = new Map<string, NeighborEntry[]>();
  for (const sample of evalSamples) {
    const neighbors = referenceSamples
      .map((reference) => ({
        sample: reference,
        distance: featureDistance(sample.feature, reference.feature, mode),
      }))
      .sort((left, right) => left.distance - right.distance)
      .slice(0, MAX_K);
    result.set(sample.id, neighbors);
  }
  return result;
}

function makeCandidates(): Candidate[] {
  const candidates: Candidate[] = [];
  for (const mode of FEATURE_MODES) {
    for (const k of [15, 25, 40, 60]) {
      for (const sectorSize of [5, 7, 9]) {
        for (const lookahead of [3, 5]) {
          for (const horizon of [1, 2, 3, 5]) {
            for (const minEdgeRatio of [0.05, 0.10, 0.15]) {
              for (const resonanceMax of [null, 3, 5] as Array<number | null>) {
                const id = [
                  mode.id,
                  `k${k}`,
                  `s${sectorSize}`,
                  `lh${lookahead}`,
                  `h${horizon}`,
                  `edge${minEdgeRatio.toFixed(2)}`,
                  resonanceMax === null ? "any" : `r${resonanceMax}`,
                ].join("-");
                candidates.push({ id, mode, k, sectorSize, lookahead, horizon, minEdgeRatio, resonanceMax });
              }
            }
          }
        }
      }
    }
  }
  return candidates;
}

function targetFromNeighbors(neighbors: readonly NeighborEntry[], candidate: Candidate): TargetCache | null {
  const selected = neighbors.slice(0, candidate.k);
  if (selected.length < candidate.k) return null;
  const futureNumbers = selected.flatMap((entry) => entry.sample.future.slice(0, candidate.lookahead));
  if (futureNumbers.length === 0) return null;
  const sector = topSector(futureNumbers, candidate.sectorSize);
  const rate = sector.count / futureNumbers.length;
  const expected = candidate.sectorSize / 37;
  return {
    sector,
    edgeRatio: expected > 0 ? (rate / expected) - 1 : 0,
  };
}

function gini(values: readonly number[]): number {
  const positives = values.filter((value) => value > 0).sort((left, right) => left - right);
  if (positives.length === 0) return 0;
  const total = positives.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  const weighted = positives.reduce((sum, value, index) => sum + (index + 1) * value, 0);
  return (2 * weighted) / (positives.length * total) - (positives.length + 1) / positives.length;
}

function topShare(values: readonly number[], top: number): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  const topTotal = [...values].sort((left, right) => right - left).slice(0, top).reduce((sum, value) => sum + value, 0);
  return topTotal / total;
}

function emptyEval(candidateId: string, eligibleSpins: number, sessionRows: SessionEvalRow[]): EvalResult {
  void eligibleSpins;
  return {
    candidateId,
    signals: 0,
    bet: 0,
    win: 0,
    hits: 0,
    net: 0,
    roi: 0,
    sp100: 0,
    maxDrawdown: 0,
    activeSessions: 0,
    positiveSessions: 0,
    negativeSessions: 0,
    signalGini: 0,
    top5SignalShare: 0,
    top10SignalShare: 0,
    sessionRows,
  };
}

function evaluateCandidate(
  candidate: Candidate,
  evalSamples: readonly StateSample[],
  neighborsBySample: ReadonlyMap<string, NeighborEntry[]>,
  eligibleSpins: number,
): EvalResult {
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;
  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const sessionStats = new Map<string, SessionEvalRow>();

  for (const sample of evalSamples) {
    const neighbors = neighborsBySample.get(sample.id);
    if (!neighbors) continue;
    const target = targetFromNeighbors(neighbors, candidate);
    if (!target || target.edgeRatio < candidate.minEdgeRatio) continue;
    if (
      candidate.resonanceMax !== null
      && sectorDistance(target.sector.center, sample.feature.centers[160]) > candidate.resonanceMax
    ) {
      continue;
    }

    signals += 1;
    const targetSet = new Set(target.sector.numbers);
    let eventHit = false;
    let eventBet = 0;
    let eventWin = 0;
    for (const number of sample.future.slice(0, candidate.horizon)) {
      eventBet += candidate.sectorSize;
      if (targetSet.has(number)) {
        eventHit = true;
        eventWin += 36;
      }
    }
    if (eventHit) hits += 1;
    bet += eventBet;
    win += eventWin;
    const net = eventWin - eventBet;
    balance += net;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);

    const row = sessionStats.get(sample.session.id) ?? {
      name: sample.session.name,
      signals: 0,
      bet: 0,
      net: 0,
      roi: 0,
    };
    row.signals += 1;
    row.bet += eventBet;
    row.net += net;
    row.roi = row.bet > 0 ? row.net / row.bet : 0;
    sessionStats.set(sample.session.id, row);
  }

  const rows = [...sessionStats.values()];
  if (signals === 0) return emptyEval(candidate.id, eligibleSpins, rows);
  const signalCounts = rows.map((row) => row.signals);
  return {
    candidateId: candidate.id,
    signals,
    bet,
    win,
    hits,
    net: win - bet,
    roi: bet > 0 ? (win - bet) / bet : 0,
    sp100: eligibleSpins > 0 ? signals / eligibleSpins * 100 : 0,
    maxDrawdown,
    activeSessions: rows.length,
    positiveSessions: rows.filter((row) => row.net > 0).length,
    negativeSessions: rows.filter((row) => row.net < 0).length,
    signalGini: gini(signalCounts),
    top5SignalShare: topShare(signalCounts, 5),
    top10SignalShare: topShare(signalCounts, 10),
    sessionRows: rows,
  };
}

function evaluateCurrentTopBaseline(
  evalSamples: readonly StateSample[],
  eligibleSpins: number,
  sectorSize: number,
  horizon: number,
): EvalResult {
  const candidateId = `baseline-current160-s${sectorSize}-h${horizon}`;
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;
  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const sessionStats = new Map<string, SessionEvalRow>();

  for (const sample of evalSamples) {
    const recent = sample.session.numbers.slice(Math.max(0, sample.prefix - 160), sample.prefix);
    const sector = topSector(recent, sectorSize);
    const targetSet = new Set(sector.numbers);
    signals += 1;
    let eventHit = false;
    let eventBet = 0;
    let eventWin = 0;
    for (const number of sample.future.slice(0, horizon)) {
      eventBet += sectorSize;
      if (targetSet.has(number)) {
        eventHit = true;
        eventWin += 36;
      }
    }
    if (eventHit) hits += 1;
    bet += eventBet;
    win += eventWin;
    const net = eventWin - eventBet;
    balance += net;
    peak = Math.max(peak, balance);
    maxDrawdown = Math.max(maxDrawdown, peak - balance);

    const row = sessionStats.get(sample.session.id) ?? {
      name: sample.session.name,
      signals: 0,
      bet: 0,
      net: 0,
      roi: 0,
    };
    row.signals += 1;
    row.bet += eventBet;
    row.net += net;
    row.roi = row.bet > 0 ? row.net / row.bet : 0;
    sessionStats.set(sample.session.id, row);
  }

  const rows = [...sessionStats.values()];
  const signalCounts = rows.map((row) => row.signals);
  return {
    candidateId,
    signals,
    bet,
    win,
    hits,
    net: win - bet,
    roi: bet > 0 ? (win - bet) / bet : 0,
    sp100: eligibleSpins > 0 ? signals / eligibleSpins * 100 : 0,
    maxDrawdown,
    activeSessions: rows.length,
    positiveSessions: rows.filter((row) => row.net > 0).length,
    negativeSessions: rows.filter((row) => row.net < 0).length,
    signalGini: gini(signalCounts),
    top5SignalShare: topShare(signalCounts, 5),
    top10SignalShare: topShare(signalCounts, 10),
    sessionRows: rows,
  };
}

function evaluateCandidateRollingBySession(
  candidate: Candidate,
  seedSessions: readonly Session[],
  rollingSessions: readonly Session[],
): EvalResult {
  let signals = 0;
  let bet = 0;
  let win = 0;
  let hits = 0;
  let balance = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const sessionStats = new Map<string, SessionEvalRow>();
  const historySessions: Session[] = [...seedSessions];

  for (const session of rollingSessions) {
    const referenceSamples = makeSamples(historySessions);
    const currentSamples = makeSamples([session]);
    const neighborsBySample = precomputeNeighbors(currentSamples, referenceSamples, candidate.mode);

    for (const sample of currentSamples) {
      const neighbors = neighborsBySample.get(sample.id);
      if (!neighbors) continue;
      const target = targetFromNeighbors(neighbors, candidate);
      if (!target || target.edgeRatio < candidate.minEdgeRatio) continue;
      if (
        candidate.resonanceMax !== null
        && sectorDistance(target.sector.center, sample.feature.centers[160]) > candidate.resonanceMax
      ) {
        continue;
      }

      signals += 1;
      const targetSet = new Set(target.sector.numbers);
      let eventHit = false;
      let eventBet = 0;
      let eventWin = 0;
      for (const number of sample.future.slice(0, candidate.horizon)) {
        eventBet += candidate.sectorSize;
        if (targetSet.has(number)) {
          eventHit = true;
          eventWin += 36;
        }
      }
      if (eventHit) hits += 1;
      bet += eventBet;
      win += eventWin;
      const net = eventWin - eventBet;
      balance += net;
      peak = Math.max(peak, balance);
      maxDrawdown = Math.max(maxDrawdown, peak - balance);

      const row = sessionStats.get(session.id) ?? {
        name: session.name,
        signals: 0,
        bet: 0,
        net: 0,
        roi: 0,
      };
      row.signals += 1;
      row.bet += eventBet;
      row.net += net;
      row.roi = row.bet > 0 ? row.net / row.bet : 0;
      sessionStats.set(session.id, row);
    }

    historySessions.push(session);
  }

  const rows = [...sessionStats.values()];
  if (signals === 0) return emptyEval(candidate.id, eligibleSpins(rollingSessions), rows);
  const signalCounts = rows.map((row) => row.signals);
  return {
    candidateId: candidate.id,
    signals,
    bet,
    win,
    hits,
    net: win - bet,
    roi: bet > 0 ? (win - bet) / bet : 0,
    sp100: eligibleSpins(rollingSessions) > 0 ? signals / eligibleSpins(rollingSessions) * 100 : 0,
    maxDrawdown,
    activeSessions: rows.length,
    positiveSessions: rows.filter((row) => row.net > 0).length,
    negativeSessions: rows.filter((row) => row.net < 0).length,
    signalGini: gini(signalCounts),
    top5SignalShare: topShare(signalCounts, 5),
    top10SignalShare: topShare(signalCounts, 10),
    sessionRows: rows,
  };
}

function eligibleSpins(sessions: readonly Session[]): number {
  return sessions.reduce((sum, session) => sum + Math.max(0, session.numbers.length - ROI_START - MAX_HORIZON + 1), 0);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatResult(result: EvalResult): string {
  return [
    `sig=${result.signals}`,
    `bet=${result.bet}`,
    `net=${result.net}`,
    `ROI=${formatPct(result.roi)}`,
    `SP100=${result.sp100.toFixed(2)}`,
    `DD=${result.maxDrawdown}`,
    `pos=${result.positiveSessions}/${result.activeSessions}`,
    `gini=${result.signalGini.toFixed(3)}`,
    `top5=${formatPct(result.top5SignalShare)}`,
  ].join(" ");
}

function candidateSummary(candidate: Candidate): string {
  return [
    candidate.mode.label,
    `K=${candidate.k}`,
    `区=${candidate.sectorSize}`,
    `历史后看=${candidate.lookahead}`,
    `实押=${candidate.horizon}口`,
    `edge>=${formatPct(candidate.minEdgeRatio)}`,
    candidate.resonanceMax === null ? "不限共振" : `距160<=${candidate.resonanceMax}`,
  ].join(" / ");
}

function rankValidation(results: Array<{ candidate: Candidate; result: EvalResult }>): Array<{ candidate: Candidate; result: EvalResult; score: number }> {
  return results
    .filter(({ result }) => (
      result.signals >= 80
      && result.activeSessions >= 8
      && result.sp100 >= 2
      && result.top5SignalShare <= 0.75
    ))
    .map((item) => ({
      ...item,
      score:
        item.result.roi * 100
        + Math.min(item.result.sp100, 12) * 0.25
        - item.result.signalGini * 2
        - Math.max(0, item.result.top5SignalShare - 0.55) * 6
        - item.result.maxDrawdown / 300,
    }))
    .sort((left, right) => right.score - left.score);
}

function describeSplit(name: string, sessions: readonly Session[], samples: readonly StateSample[]): string {
  const spins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
  return `${name}: ${sessions.length} 局，${spins} 口，样本 ${samples.length}，${formatDate(sessionTime(sessions[0]))}~${formatDate(sessionTime(sessions[sessions.length - 1]))}`;
}

function main(): void {
  const { sessions, rawCount, manualRows } = loadSessions();
  const testSessions = sessions.slice(-TEST_SESSION_COUNT);
  const researchSessions = sessions.slice(0, -TEST_SESSION_COUNT);
  const validationSessions = researchSessions.slice(-VALIDATION_SESSION_COUNT);
  const fitSessions = researchSessions.slice(0, -VALIDATION_SESSION_COUNT);

  const fitSamples = makeSamples(fitSessions);
  const validationSamples = makeSamples(validationSessions);
  const researchSamples = makeSamples(researchSessions);
  const testSamples = makeSamples(testSessions);
  const validationEligible = eligibleSpins(validationSessions);
  const testEligible = eligibleSpins(testSessions);

  const candidates = makeCandidates();
  const validationNeighbors = new Map<string, Map<string, NeighborEntry[]>>();
  const testNeighbors = new Map<string, Map<string, NeighborEntry[]>>();
  for (const mode of FEATURE_MODES) {
    validationNeighbors.set(mode.id, precomputeNeighbors(validationSamples, fitSamples, mode));
    testNeighbors.set(mode.id, precomputeNeighbors(testSamples, researchSamples, mode));
  }

  const validationResults = candidates.map((candidate) => ({
    candidate,
    result: evaluateCandidate(
      candidate,
      validationSamples,
      validationNeighbors.get(candidate.mode.id) ?? new Map<string, NeighborEntry[]>(),
      validationEligible,
    ),
  }));
  const ranked = rankValidation(validationResults);
  const selected = ranked.slice(0, 12);

  const tested = selected.map(({ candidate, result: validationResult, score }) => ({
    candidate,
    validationResult,
    score,
    testResult: evaluateCandidate(
      candidate,
      testSamples,
      testNeighbors.get(candidate.mode.id) ?? new Map<string, NeighborEntry[]>(),
      testEligible,
    ),
  }));
  const chosenByValidation = tested[0];
  const firstTestSessionIds = new Set(testSessions.slice(0, Math.floor(testSessions.length / 2)).map((session) => session.id));
  const latestTestSessionIds = new Set(testSessions.slice(Math.floor(testSessions.length / 2)).map((session) => session.id));
  const firstTestSamples = testSamples.filter((sample) => firstTestSessionIds.has(sample.session.id));
  const latestTestSamples = testSamples.filter((sample) => latestTestSessionIds.has(sample.session.id));
  const firstTestEligible = eligibleSpins(testSessions.slice(0, Math.floor(testSessions.length / 2)));
  const latestTestEligible = eligibleSpins(testSessions.slice(Math.floor(testSessions.length / 2)));

  const baselines = [
    evaluateCurrentTopBaseline(validationSamples, validationEligible, 7, 3),
    evaluateCurrentTopBaseline(testSamples, testEligible, 7, 3),
    evaluateCurrentTopBaseline(validationSamples, validationEligible, 9, 3),
    evaluateCurrentTopBaseline(testSamples, testEligible, 9, 3),
  ];

  const lines: string[] = [];
  lines.push("# 局面匹配训练/测试研究");
  lines.push("");
  lines.push(`输入：\`${path.relative(ROOT, INPUT_FILE).replace(/\\/g, "/")}\``);
  lines.push(`原始记录 ${rawCount} 条；参与分析 ${sessions.length} 条；文件中带手工 TableId 的记录 ${manualRows} 条。脚本不读取/使用 TableId。`);
  lines.push(`切分：最旧 ${fitSessions.length} 条做相似样本库；中间 ${validationSessions.length} 条做规则筛选；最新 ${testSessions.length} 条只做最终测试。`);
  lines.push(`下注/统计口径：每局第 ${ROI_START + 1} 口开始，每 ${SAMPLE_STEP} 口最多产生一个状态信号；每个信号押一个轮盘连续区，连押 1/2/3/5 口。`);
  lines.push("");
  lines.push("## 数据切分");
  lines.push("");
  lines.push(`- ${describeSplit("相似样本库", fitSessions, fitSamples)}`);
  lines.push(`- ${describeSplit("规则筛选", validationSessions, validationSamples)}`);
  lines.push(`- ${describeSplit("最终测试", testSessions, testSamples)}`);
  lines.push("");
  lines.push("## 方法");
  lines.push("");
  lines.push("1. 每个历史前缀只用当前前缀号码生成局面画像：80/120/160 口空间热区、整圈 sectorVector、行组短窗形状、80 到 160 的漂移距离。");
  lines.push("2. 对每个待判断前缀，在更早的相似样本库里找 K 个最相似局面。");
  lines.push("3. 只看这些历史相似局面之后的号码，找未来短窗里最热的轮盘连续区，作为当前候选押注区。");
  lines.push("4. 如果历史相似局面的候选区相对数学期望没有足够 edge，或者和当前 160 口热区不共振，则不出信号。");
  lines.push("");
  lines.push("## 基线：只打当前 160 口热区");
  lines.push("");
  lines.push("| rule | validation | latest-test |");
  lines.push("|---|---|---|");
  lines.push(`| 当前160热区 7号区 连押3口 | ${formatResult(baselines[0])} | ${formatResult(baselines[1])} |`);
  lines.push(`| 当前160热区 9号区 连押3口 | ${formatResult(baselines[2])} | ${formatResult(baselines[3])} |`);
  lines.push("");
  lines.push("## 规则筛选集 Top 候选及最新测试");
  lines.push("");
  lines.push("| rank | rule | validation | latest-test |");
  lines.push("|---:|---|---|---|");
  tested.forEach((item, index) => {
    lines.push(`| ${index + 1} | ${candidateSummary(item.candidate)} | ${formatResult(item.validationResult)} | ${formatResult(item.testResult)} |`);
  });
  lines.push("");
  lines.push("## 最新测试按 ROI 排序");
  lines.push("");
  lines.push("| rank | rule | latest-test | validation |");
  lines.push("|---:|---|---|---|");
  [...tested]
    .sort((left, right) => right.testResult.roi - left.testResult.roi)
    .forEach((item, index) => {
      lines.push(`| ${index + 1} | ${candidateSummary(item.candidate)} | ${formatResult(item.testResult)} | ${formatResult(item.validationResult)} |`);
    });
  lines.push("");
  lines.push("## 验证集选出的首选规则：最新测试前后拆分");
  lines.push("");
  if (chosenByValidation) {
    const neighbors = testNeighbors.get(chosenByValidation.candidate.mode.id) ?? new Map<string, NeighborEntry[]>();
    const firstResult = evaluateCandidate(chosenByValidation.candidate, firstTestSamples, neighbors, firstTestEligible);
    const latestResult = evaluateCandidate(chosenByValidation.candidate, latestTestSamples, neighbors, latestTestEligible);
    const rollingResult = evaluateCandidateRollingBySession(chosenByValidation.candidate, researchSessions, testSessions);
    lines.push(`首选规则：${candidateSummary(chosenByValidation.candidate)}`);
    lines.push("");
    lines.push("| slice | result |");
    lines.push("|---|---|");
    lines.push(`| validation | ${formatResult(chosenByValidation.validationResult)} |`);
    lines.push(`| latest-test all | ${formatResult(chosenByValidation.testResult)} |`);
    lines.push(`| latest-test first 10 | ${formatResult(firstResult)} |`);
    lines.push(`| latest-test latest 10 | ${formatResult(latestResult)} |`);
    lines.push(`| latest-test rolling | ${formatResult(rollingResult)} |`);
    lines.push("");
    lines.push("递进测试口径：第 1 个测试局只用测试集之前的全部历史；第 2 个测试局可使用第 1 个测试局；以此类推。当前测试局内部每个信号只使用该信号之前的号码前缀。");
    lines.push("");
    lines.push("| rolling session | signals | bet | net | ROI |");
    lines.push("|---|---:|---:|---:|---:|");
    rollingResult.sessionRows
      .sort((left, right) => {
        const leftSession = testSessions.find((session) => session.name === left.name);
        const rightSession = testSessions.find((session) => session.name === right.name);
        return (leftSession ? sessionTime(leftSession) : 0) - (rightSession ? sessionTime(rightSession) : 0);
      })
      .forEach((row) => {
        lines.push(`| ${row.name} | ${row.signals} | ${row.bet} | ${row.net} | ${formatPct(row.roi)} |`);
      });
    lines.push("");
  }
  lines.push("## 最新测试分局明细：测试 ROI 最好候选");
  lines.push("");
  const bestTest = [...tested].sort((left, right) => right.testResult.roi - left.testResult.roi)[0];
  if (bestTest) {
    lines.push(`规则：${candidateSummary(bestTest.candidate)}`);
    lines.push("");
    lines.push("| session | signals | bet | net | ROI |");
    lines.push("|---|---:|---:|---:|---:|");
    bestTest.testResult.sessionRows
      .sort((left, right) => left.name.localeCompare(right.name, "zh-Hans-CN"))
      .forEach((row) => {
        lines.push(`| ${row.name} | ${row.signals} | ${row.bet} | ${row.net} | ${formatPct(row.roi)} |`);
      });
    lines.push("");
  }
  lines.push("## 初步结论");
  lines.push("");
  lines.push("1. 这版研究只证明“相似局面匹配”是否有统计倾向，不证明物理桌一致。");
  lines.push("2. 最新测试没有参与选规则，所以如果某条规则在 validation 和 latest-test 都为正，才值得继续深挖。");
  lines.push("3. 如果 validation 很强但 latest-test 变弱，说明该规则可能只是训练集局部形状，不能产品化。");
  lines.push("4. 下一步应做递进版：每推进一局，把更早测试局也纳入历史库，观察规则是否仍能稳定，而不是固定一次性切分。");

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(lines.join("\n"));
}

main();
