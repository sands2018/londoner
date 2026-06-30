import fs from "node:fs";
import path from "node:path";
import { getHistoryDataIso } from "./historyTime";
import {
  analyzeChaseSixSignalBreakdown,
  type ChaseSixBenchmarkRowId,
  type ChaseSixSignalStats,
} from "../app/src/core/chaseSix";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const OUTPUT_PATH = path.join(ROOT, "scripts", "output", "chase6-history-benchmark.md");
const ROI_START = 200;
const HISTORY_WINDOW = 200;

const ROW_ORDER: ChaseSixBenchmarkRowId[] = ["total", "group1", "group2", "group3", "strong", "waveStrong", "waveFiltered"];

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

interface Summary extends ChaseSixSignalStats {
  net: number;
  sp100: number;
}

function emptyStats(): ChaseSixSignalStats {
  return { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 };
}

function addStats(target: ChaseSixSignalStats, value: ChaseSixSignalStats): void {
  target.signals += value.signals;
  target.bet += value.bet;
  target.win += value.win;
  target.hits += value.hits;
}

function summarize(stats: ChaseSixSignalStats, denominatorSpins: number): Summary {
  const net = stats.win - stats.bet;
  return {
    ...stats,
    net,
    roi: stats.bet > 0 ? (net / stats.bet) * 100 : 0,
    sp100: denominatorSpins > 0 ? (stats.signals / denominatorSpins) * 100 : 0,
  };
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

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function tsStats(summary: Summary): string {
  return `signals: ${summary.signals}, bet: ${summary.bet}, win: ${summary.win}, hits: ${summary.hits}, net: ${summary.net}, roi: ${summary.roi.toFixed(6)}, sp100: ${summary.sp100.toFixed(6)}`;
}

const sessions = loadSessions();
const totalSpins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
const bettingSpins = sessions.reduce((sum, session) => sum + Math.max(0, session.numbers.length - ROI_START), 0);
const statsById = new Map<ChaseSixBenchmarkRowId, ChaseSixSignalStats>();
const labelsById = new Map<ChaseSixBenchmarkRowId, string>();
for (const id of ROW_ORDER) statsById.set(id, emptyStats());

for (const session of sessions) {
  const result = analyzeChaseSixSignalBreakdown(session.numbers, HISTORY_WINDOW, ROI_START);
  for (const row of result.rows) {
    const target = statsById.get(row.id);
    if (!target) continue;
    labelsById.set(row.id, row.label);
    addStats(target, row);
  }
}

const summaries = ROW_ORDER.map((id) => ({
  id,
  label: labelsById.get(id) ?? id,
  summary: summarize(statsById.get(id) ?? emptyStats(), bettingSpins),
}));

const lines: string[] = [];
lines.push("# Chase6 History Benchmark");
lines.push("");
lines.push(`- source: \`${path.relative(ROOT, HISTORY_PATH)}\``);
lines.push(`- sessions: ${sessions.length}`);
lines.push(`- spins: ${totalSpins}`);
lines.push(`- bettingSpins: ${bettingSpins}`);
lines.push(`- historyWindow: ${HISTORY_WINDOW}`);
lines.push(`- ROI/SP100 scope: index >= ${ROI_START}`);
lines.push("- no-future: each spin only uses its preceding history window to trigger a signal; future spins are settlement only.");
lines.push("");
lines.push("## Benchmark");
lines.push("| tier | signals | bet | win | hits | net | ROI | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
for (const row of summaries) {
  const s = row.summary;
  lines.push(`| ${row.label} | ${s.signals} | ${s.bet} | ${s.win} | ${s.hits} | ${s.net} | ${fmtPct(s.roi)} | ${s.sp100.toFixed(2)} |`);
}
lines.push("");
lines.push("## TypeScript Literal");
lines.push("```ts");
lines.push("export const CHASE6_HISTORY_BENCHMARK = {");
lines.push('  source: "HistoryData/history_data.json",');
lines.push("  roiStartIndex: 200,");
lines.push("  historyWindow: 200,");
lines.push(`  sessions: ${sessions.length},`);
lines.push(`  spins: ${totalSpins},`);
lines.push(`  bettingSpins: ${bettingSpins},`);
lines.push("  rows: [");
for (const row of summaries) lines.push(`    { id: "${row.id}", label: "${row.label}", ${tsStats(row.summary)} },`);
lines.push("  ],");
lines.push("} as const;");
lines.push("```");
lines.push("");

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");

console.log(lines.slice(0, lines.indexOf("## TypeScript Literal") - 1).join("\n"));
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
