import fs from "node:fs";
import path from "node:path";
import { analyzeHotNumbers, type HotNumberRoi } from "../app/src/core/hotNumbers";
import {
  QUALITY_124_TIER_ORDER,
  analyzeQuality124,
  type Quality124Roi,
  type Quality124Tier,
} from "../app/src/core/quality124";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUTPUT_PATH = path.join(ROOT, "scripts", "output", "random-hot-124ext-benchmark.md");
const ROI_START = 200;
const SESSION_COUNT = 50;
const SEED = 0x20260625;

const HOT_ACTION_ROWS = [
  { id: "enhance", label: "增强" },
  { id: "baseline", label: "原始" },
  { id: "observe", label: "观察" },
  { id: "hint", label: "提示" },
  { id: "block", label: "屏蔽" },
] as const;

const QUALITY_TIER_LABELS: Record<Quality124Tier, string> = {
  group1: "一组",
  group2: "二组",
  group2tempo: "二组短追",
  group3: "三组",
  row1: "1行",
  row2: "2行",
  row3: "3行",
};

interface Session {
  id: string;
  index: number;
  kind: "pure" | "biased";
  length: number;
  numbers: RouletteNumber[];
  biasNumbers: RouletteNumber[];
}

interface RoiLike {
  signals: number;
  bet: number;
  win: number;
  hits: number;
}

interface Summary extends RoiLike {
  net: number;
  roi: number;
  hitRate: number;
  sp100: number;
  avgBet: number;
}

interface SessionResult {
  session: Session;
  hot: RoiLike;
  hotLong: RoiLike;
  hotShort: RoiLike;
  quality124: RoiLike;
  quality124Tiers: Record<Quality124Tier, RoiLike>;
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(SEED);

function randint(min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickWeighted(weights: readonly number[]): RouletteNumber {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = rng() * total;
  for (let index = 0; index < weights.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) return index as RouletteNumber;
  }
  return 36;
}

function emptyRoi(): RoiLike {
  return { signals: 0, bet: 0, win: 0, hits: 0 };
}

function addRoi(target: RoiLike, value: RoiLike): void {
  target.signals += value.signals;
  target.bet += value.bet;
  target.win += value.win;
  target.hits += value.hits;
}

function summarize(roi: RoiLike, denominatorSpins: number): Summary {
  const net = roi.win - roi.bet;
  return {
    ...roi,
    net,
    roi: roi.bet > 0 ? (net / roi.bet) * 100 : 0,
    hitRate: roi.signals > 0 ? (roi.hits / roi.signals) * 100 : 0,
    sp100: denominatorSpins > 0 ? (roi.signals / denominatorSpins) * 100 : 0,
    avgBet: roi.signals > 0 ? roi.bet / roi.signals : 0,
  };
}

function fromHotEvents(events: ReturnType<typeof analyzeHotNumbers>["events"], mode?: "long" | "short"): RoiLike {
  const selected = events.filter((event) => event.position >= ROI_START && (!mode || event.signal.mode === mode));
  const hits = selected.filter((event) => event.hit).length;
  return {
    signals: selected.length,
    bet: selected.length,
    win: hits * 36,
    hits,
  };
}

function toRoiLike(roi: HotNumberRoi | Quality124Roi): RoiLike {
  return {
    signals: roi.signals,
    bet: roi.bet,
    win: roi.win,
    hits: roi.hits,
  };
}

function generateSession(index: number): Session {
  const length = randint(350, 600);
  const kind: Session["kind"] = index >= 44 ? "biased" : "pure";
  const biasNumbers: RouletteNumber[] = [];
  const weights = Array.from({ length: 37 }, () => 1);

  if (kind === "biased") {
    const biasCount = randint(2, 4);
    while (biasNumbers.length < biasCount) {
      const candidate = randint(0, 36) as RouletteNumber;
      if (!biasNumbers.includes(candidate)) biasNumbers.push(candidate);
    }
    for (const number of biasNumbers) {
      weights[number] = 1.45 + rng() * 0.65;
    }
  }

  const numbers = Array.from({ length }, () => pickWeighted(weights));
  return {
    id: `R${String(index + 1).padStart(2, "0")}`,
    index,
    kind,
    length,
    numbers,
    biasNumbers,
  };
}

function stddev(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length);
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
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

function maxDrawdown(values: readonly number[]): number {
  let running = 0;
  let peak = 0;
  let drawdown = 0;
  for (const value of values) {
    running += value;
    peak = Math.max(peak, running);
    drawdown = Math.max(drawdown, peak - running);
  }
  return drawdown;
}

function sessionUniformity(results: readonly SessionResult[], selector: (result: SessionResult) => RoiLike) {
  const rows = results.map((result) => {
    const roi = selector(result);
    const bettingSpins = Math.max(0, result.session.length - ROI_START);
    const summary = summarize(roi, bettingSpins);
    return {
      id: result.session.id,
      kind: result.session.kind,
      length: result.session.length,
      bettingSpins,
      signals: summary.signals,
      sp100: summary.sp100,
      net: summary.net,
      roi: summary.roi,
    };
  });
  const activeRows = rows.filter((row) => row.signals > 0);
  const signalCounts = rows.map((row) => row.signals);
  const nets = rows.map((row) => row.net);
  const rois = activeRows.map((row) => row.roi);
  const sp100s = rows.map((row) => row.sp100);
  const totalSignals = signalCounts.reduce((sum, value) => sum + value, 0);
  const top10Signals = [...signalCounts].sort((a, b) => b - a).slice(0, 10).reduce((sum, value) => sum + value, 0);

  return {
    rows,
    activeSessions: activeRows.length,
    noSignalSessions: rows.length - activeRows.length,
    positiveSessions: rows.filter((row) => row.net > 0).length,
    negativeSessions: rows.filter((row) => row.net < 0).length,
    meanNet: nets.reduce((sum, value) => sum + value, 0) / rows.length,
    medianNet: median(nets),
    sdNet: stddev(nets),
    meanRoi: rois.length > 0 ? rois.reduce((sum, value) => sum + value, 0) / rois.length : 0,
    medianRoi: median(rois),
    sdRoi: stddev(rois),
    meanSp100: sp100s.reduce((sum, value) => sum + value, 0) / rows.length,
    sdSp100: stddev(sp100s),
    signalGini: gini(signalCounts),
    netGini: gini(nets),
    top10SignalShare: totalSignals > 0 ? (top10Signals / totalSignals) * 100 : 0,
    sessionNetDrawdown: maxDrawdown(nets),
  };
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function fmtNum(value: number): string {
  return value.toFixed(2);
}

function summaryRow(label: string, summary: Summary): string {
  return `| ${label} | ${summary.signals} | ${summary.bet} | ${summary.win} | ${summary.hits} | ${summary.net} | ${fmtPct(summary.roi)} | ${summary.hitRate.toFixed(1)}% | ${summary.avgBet.toFixed(2)} | ${summary.sp100.toFixed(2)} |`;
}

function uniformityRow(label: string, metrics: ReturnType<typeof sessionUniformity>): string {
  return `| ${[
    label,
    metrics.activeSessions,
    metrics.noSignalSessions,
    `${metrics.positiveSessions}/${metrics.negativeSessions}`,
    metrics.meanNet.toFixed(2),
    metrics.medianNet.toFixed(2),
    metrics.sdNet.toFixed(2),
    fmtPct(metrics.meanRoi),
    fmtPct(metrics.medianRoi),
    metrics.meanSp100.toFixed(2),
    metrics.sdSp100.toFixed(2),
    metrics.signalGini.toFixed(3),
    metrics.netGini.toFixed(3),
    `${metrics.top10SignalShare.toFixed(1)}%`,
    metrics.sessionNetDrawdown,
  ].join(" | ")} |`;
}

function frequencyDiagnostics(sessions: readonly Session[]) {
  const counts = Array.from({ length: 37 }, () => 0);
  for (const session of sessions) {
    for (const number of session.numbers) counts[number] += 1;
  }
  const total = counts.reduce((sum, value) => sum + value, 0);
  const expected = total / 37;
  const chi2 = counts.reduce((sum, value) => sum + ((value - expected) ** 2) / expected, 0);
  const deviations = counts.map((count, number) => ({ number, count, diffPct: ((count - expected) / expected) * 100 }));
  const top = [...deviations].sort((a, b) => b.diffPct - a.diffPct).slice(0, 5);
  const bottom = [...deviations].sort((a, b) => a.diffPct - b.diffPct).slice(0, 5);
  return { total, expected, chi2, top, bottom };
}

const sessions = Array.from({ length: SESSION_COUNT }, (_, index) => generateSession(index));
const results: SessionResult[] = sessions.map((session) => {
  const hot = analyzeHotNumbers(session.numbers, ROI_START);
  const quality124 = analyzeQuality124(session.numbers, ROI_START);
  return {
    session,
    hot: toRoiLike(hot.totalRoiFrom201),
    hotLong: fromHotEvents(hot.events, "long"),
    hotShort: fromHotEvents(hot.events, "short"),
    quality124: toRoiLike(quality124.totalRoi),
    quality124Tiers: Object.fromEntries(
      QUALITY_124_TIER_ORDER.map((tier) => [tier, toRoiLike(quality124.tierRois[tier])]),
    ) as Record<Quality124Tier, RoiLike>,
  };
});

const bettingSpins = sessions.reduce((sum, session) => sum + Math.max(0, session.length - ROI_START), 0);
const totalSpins = sessions.reduce((sum, session) => sum + session.length, 0);
const pureBettingSpins = sessions.filter((session) => session.kind === "pure").reduce((sum, session) => sum + Math.max(0, session.length - ROI_START), 0);
const biasedBettingSpins = sessions.filter((session) => session.kind === "biased").reduce((sum, session) => sum + Math.max(0, session.length - ROI_START), 0);

function aggregate(selector: (result: SessionResult) => RoiLike, subset = results): RoiLike {
  const total = emptyRoi();
  for (const result of subset) addRoi(total, selector(result));
  return total;
}

const pureResults = results.filter((result) => result.session.kind === "pure");
const biasedResults = results.filter((result) => result.session.kind === "biased");
const hotTotal = summarize(aggregate((result) => result.hot), bettingSpins);
const hotLong = summarize(aggregate((result) => result.hotLong), bettingSpins);
const hotShort = summarize(aggregate((result) => result.hotShort), bettingSpins);
const hotPure = summarize(aggregate((result) => result.hot, pureResults), pureBettingSpins);
const hotBiased = summarize(aggregate((result) => result.hot, biasedResults), biasedBettingSpins);
const qualityTotal = summarize(aggregate((result) => result.quality124), bettingSpins);
const qualityPure = summarize(aggregate((result) => result.quality124, pureResults), pureBettingSpins);
const qualityBiased = summarize(aggregate((result) => result.quality124, biasedResults), biasedBettingSpins);

const qualityTierSummaries = QUALITY_124_TIER_ORDER.map((tier) => ({
  tier,
  summary: summarize(aggregate((result) => result.quality124Tiers[tier]), bettingSpins),
}));

const freq = frequencyDiagnostics(sessions);
const hotUniformity = sessionUniformity(results, (result) => result.hot);
const qualityUniformity = sessionUniformity(results, (result) => result.quality124);

const lines: string[] = [];
lines.push("# Random Benchmark: Hot + 124EXT");
lines.push("");
lines.push(`- seed: \`${SEED}\``);
lines.push(`- sessions: ${sessions.length} (${pureResults.length} pure independent uniform, ${biasedResults.length} lightly weighted independent)`);
lines.push(`- session length: ${Math.min(...sessions.map((session) => session.length))}..${Math.max(...sessions.map((session) => session.length))}`);
lines.push(`- spins: ${totalSpins}`);
lines.push(`- ROI/SP100 scope: index >= ${ROI_START}; bettingSpins=${bettingSpins}`);
lines.push("- no table profile: hot table enhancement/calibration is disabled; hot signals are counted as baseline/original only.");
lines.push("- no-future: both engines scan each session in order; random generation is fixed-seed and independent of outcomes.");
lines.push("");
lines.push("## Randomness Check");
lines.push("");
lines.push(`- total numbers: ${freq.total}`);
lines.push(`- expected count per number: ${freq.expected.toFixed(2)}`);
lines.push(`- chi-square vs uniform 0..36: ${freq.chi2.toFixed(2)} (df=36; includes 6 lightly biased sessions)`);
lines.push(`- top overrepresented: ${freq.top.map((item) => `${item.number}:${item.count} (${item.diffPct >= 0 ? "+" : ""}${item.diffPct.toFixed(1)}%)`).join(", ")}`);
lines.push(`- top underrepresented: ${freq.bottom.map((item) => `${item.number}:${item.count} (${item.diffPct >= 0 ? "+" : ""}${item.diffPct.toFixed(1)}%)`).join(", ")}`);
lines.push("");
lines.push("## Hot Numbers");
lines.push("");
lines.push("### Hot Action Rows (no table)");
lines.push("| action | signals | bet | win | hits | net | ROI | hitRate | avgBet | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const row of HOT_ACTION_ROWS) {
  const summary = row.id === "baseline" ? hotTotal : summarize(emptyRoi(), bettingSpins);
  lines.push(summaryRow(row.label, summary));
}
lines.push("");
lines.push("### Hot Diagnostics");
lines.push("| slice | signals | bet | win | hits | net | ROI | hitRate | avgBet | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
lines.push(summaryRow("raw total", hotTotal));
lines.push(summaryRow("long mode", hotLong));
lines.push(summaryRow("short mode", hotShort));
lines.push(summaryRow("pure sessions", hotPure));
lines.push(summaryRow("biased sessions", hotBiased));
lines.push("");
lines.push("## 124EXT");
lines.push("");
lines.push("### Total");
lines.push("| slice | signals | bet | win | hits | net | ROI | hitRate | avgBet | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
lines.push(summaryRow("total", qualityTotal));
lines.push(summaryRow("pure sessions", qualityPure));
lines.push(summaryRow("biased sessions", qualityBiased));
lines.push("");
lines.push("### Tier Rows");
lines.push("| tier | signals | bet | win | hits | net | ROI | hitRate | avgBet | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const row of qualityTierSummaries) lines.push(summaryRow(QUALITY_TIER_LABELS[row.tier], row.summary));
lines.push("");
lines.push("## Uniformity");
lines.push("");
lines.push("| strategy | activeSessions | noSignal | pos/neg | meanNet | medianNet | sdNet | meanSessionROI | medianSessionROI | meanSP100 | sdSP100 | signalGini | netGini | top10SignalShare | sessionNetDD |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
lines.push(uniformityRow("Hot raw", hotUniformity));
lines.push(uniformityRow("124EXT total", qualityUniformity));
lines.push("");
lines.push("## Per-session Detail");
lines.push("");
lines.push("| id | kind | len | bias | Hot sig/net/ROI/SP100 | 124EXT sig/bet/net/ROI/SP100 |");
lines.push("|---|---|---:|---|---:|---:|");
for (const result of results) {
  const betting = Math.max(0, result.session.length - ROI_START);
  const hot = summarize(result.hot, betting);
  const quality = summarize(result.quality124, betting);
  lines.push(`| ${[
    result.session.id,
    result.session.kind,
    result.session.length,
    result.session.biasNumbers.length > 0 ? result.session.biasNumbers.join(",") : "-",
    `${hot.signals}/${hot.net}/${fmtPct(hot.roi)}/${hot.sp100.toFixed(2)}`,
    `${quality.signals}/${quality.bet}/${quality.net}/${fmtPct(quality.roi)}/${quality.sp100.toFixed(2)}`,
  ].join(" | ")} |`);
}
lines.push("");

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");
console.log(lines.join("\n"));
console.log(`\nWrote ${path.relative(ROOT, OUTPUT_PATH)}`);
