import fs from "node:fs";
import path from "node:path";
import { getHistoryDataIso } from "./historyTime";
import {
  QUALITY_124_TIER_META,
  QUALITY_124_TIER_ORDER,
  analyzeQuality124,
  type Quality124Roi,
} from "../app/src/core/quality124";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const OUTPUT_PATH = path.join(ROOT, "scripts", "output", "quality124-history-benchmark.md");
const ROI_START = 200;

interface RawHistoryRow {
  Name?: string;
  Numbers?: string | number[];
  SaveTime?: string;
  tms?: number;
  ImportIndex?: number;
}

interface Session {
  id: string;
  importIndex: number;
  name: string;
  numbers: RouletteNumber[];
  updatedAt: string;
}

interface Summary extends Quality124Roi {
  net: number;
  sp100: number;
}

function emptyRoi(): Quality124Roi {
  return { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 };
}

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
      importIndex: row.ImportIndex ?? sourceIndex,
      name: String(row.Name ?? `session-${sourceIndex + 1}`),
      numbers: parseNumbers(row.Numbers),
      updatedAt: parseUpdatedAt(row, sourceIndex),
    }))
    .filter((session) => session.numbers.length > 0)
    .sort((left, right) => (
      new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
      || left.importIndex - right.importIndex
      || left.name.localeCompare(right.name, "zh-Hans-CN")
      || left.id.localeCompare(right.id)
    ));
}

function addRoi(target: Quality124Roi, value: Quality124Roi): void {
  target.signals += value.signals;
  target.bet += value.bet;
  target.win += value.win;
  target.hits += value.hits;
}

function summarize(roi: Quality124Roi, denominatorSpins: number): Summary {
  const net = roi.win - roi.bet;
  return {
    ...roi,
    net,
    roi: roi.bet > 0 ? (net / roi.bet) * 100 : 0,
    sp100: denominatorSpins > 0 ? (roi.signals / denominatorSpins) * 100 : 0,
  };
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function tsRow(tier: string, summary: Summary): string {
  return `    { tier: "${tier}", signals: ${summary.signals}, bet: ${summary.bet}, win: ${summary.win}, hits: ${summary.hits}, net: ${summary.net}, roi: ${summary.roi.toFixed(6)}, sp100: ${summary.sp100.toFixed(6)} },`;
}

const sessions = loadSessions();
const totalRoi = emptyRoi();
const tierRois = Object.fromEntries(QUALITY_124_TIER_ORDER.map((tier) => [tier, emptyRoi()])) as Record<(typeof QUALITY_124_TIER_ORDER)[number], Quality124Roi>;
const totalSpins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
const bettingSpins = sessions.reduce((sum, session) => sum + Math.max(0, session.numbers.length - ROI_START), 0);

for (const session of sessions) {
  const analysis = analyzeQuality124(session.numbers, ROI_START);
  addRoi(totalRoi, analysis.totalRoi);
  for (const tier of QUALITY_124_TIER_ORDER) addRoi(tierRois[tier], analysis.tierRois[tier]);
}

const totalSummary = summarize(totalRoi, bettingSpins);
const tierSummaries = QUALITY_124_TIER_ORDER.map((tier) => ({
  tier,
  meta: QUALITY_124_TIER_META[tier],
  summary: summarize(tierRois[tier], bettingSpins),
}));

const lines: string[] = [];
lines.push("# 124EXT History Benchmark");
lines.push("");
lines.push(`- source: \`${path.relative(ROOT, HISTORY_PATH)}\``);
lines.push(`- sessions: ${sessions.length}`);
lines.push(`- spins: ${totalSpins}`);
lines.push(`- bettingSpins: ${bettingSpins}`);
lines.push(`- ROI/SP100 scope: index >= ${ROI_START}`);
lines.push("- no-future: each session is scanned in chronological spin order; each signal is created before its future settlement spins are known.");
lines.push("");
lines.push("## Total Benchmark");
lines.push("| signals | bet | win | hits | net | ROI | SP100 |");
lines.push("|---:|---:|---:|---:|---:|---:|---:|");
lines.push(`| ${totalSummary.signals} | ${totalSummary.bet} | ${totalSummary.win} | ${totalSummary.hits} | ${totalSummary.net} | ${fmtPct(totalSummary.roi)} | ${totalSummary.sp100.toFixed(2)} |`);
lines.push("");
lines.push("## Tier Benchmark");
lines.push("| tier | signals | bet | win | hits | net | ROI | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
for (const row of tierSummaries) {
  const s = row.summary;
  lines.push(`| ${row.meta.label} | ${s.signals} | ${s.bet} | ${s.win} | ${s.hits} | ${s.net} | ${fmtPct(s.roi)} | ${s.sp100.toFixed(2)} |`);
}
lines.push("");
lines.push("## TypeScript Literal");
lines.push("```ts");
lines.push("export const QUALITY_124_HISTORY_BENCHMARK = {");
lines.push('  source: "HistoryData/history_data.json",');
lines.push("  roiStartIndex: 200,");
lines.push(`  sessions: ${sessions.length},`);
lines.push(`  spins: ${totalSpins},`);
lines.push(`  bettingSpins: ${bettingSpins},`);
lines.push(`  total: { signals: ${totalSummary.signals}, bet: ${totalSummary.bet}, win: ${totalSummary.win}, hits: ${totalSummary.hits}, net: ${totalSummary.net}, roi: ${totalSummary.roi.toFixed(6)}, sp100: ${totalSummary.sp100.toFixed(6)} },`);
lines.push("  rows: [");
for (const row of tierSummaries) lines.push(tsRow(row.tier, row.summary));
lines.push("  ],");
lines.push("} as const;");
lines.push("```");
lines.push("");

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");

console.log(lines.slice(0, lines.indexOf("## TypeScript Literal") - 1).join("\n"));
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
