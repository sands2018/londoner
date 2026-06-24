import fs from "node:fs";
import path from "node:path";
import {
  computeColdRoiBreakdown,
  type ColdSignalStats,
} from "../app/src/core/prediction";
import type { RouletteNumber } from "../app/src/core/roulette";

const ROOT = path.resolve(import.meta.dirname, "..");
const HISTORY_PATH = path.join(ROOT, "HistoryData", "history_data.json");
const OUTPUT_PATH = path.join(ROOT, "scripts", "output", "cold-history-benchmark.md");
const ROI_START = 200;

const ALL_CIS = [0, 1, 2, 3, 4, 5] as const;
const GROUP_CIS = [0, 1, 2] as const;
const ROW_CIS = [3, 4, 5] as const;
const CI_LABELS = ["一组", "二组", "三组", "1行", "2行", "3行"] as const;

const MODE_META = {
  adaptiveRow: "自适应+默认行",
  adaptive: "自适应",
  all: "不切换",
  rows: "仅行",
  groups: "仅组",
} as const;

type ModeId = keyof typeof MODE_META;

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
  year: string;
}

interface Summary extends ColdSignalStats {
  net: number;
  sp100: number;
}

function emptyStats(): ColdSignalStats {
  return { signals: 0, bet: 0, win: 0, hits: 0, failures: 0, roi: 0 };
}

function addStats(target: ColdSignalStats, value: ColdSignalStats): void {
  target.signals += value.signals;
  target.bet += value.bet;
  target.win += value.win;
  target.hits += value.hits;
  target.failures += value.failures;
}

function summarize(stats: ColdSignalStats, denominatorSpins: number): Summary {
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
  if (typeof row.tms === "number" && Number.isFinite(row.tms)) return new Date(row.tms).toISOString();
  const text = String(row.SaveTime ?? "");
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/u);
  if (match) {
    const hour = match[4] ?? "12";
    const minute = match[5] ?? "00";
    return `${match[1]}-${match[2]}-${match[3]}T${hour}:${minute}:00.000+08:00`;
  }
  return new Date(sourceIndex).toISOString();
}

function getYear(name: string, updatedAt: string): string {
  const fromName = name.match(/(\d{4})/u)?.[1];
  if (fromName) return fromName;
  return updatedAt.slice(0, 4);
}

function loadSessions(): Session[] {
  const rows = JSON.parse(fs.readFileSync(HISTORY_PATH, "utf8")) as RawHistoryRow[];
  return rows
    .map((row, sourceIndex): Session => {
      const updatedAt = parseUpdatedAt(row, sourceIndex);
      const name = String(row.Name ?? `session-${sourceIndex + 1}`);
      return {
        id: `history_data_${sourceIndex}`,
        importIndex: row.ImportIndex ?? sourceIndex,
        name,
        numbers: parseNumbers(row.Numbers),
        updatedAt,
        year: getYear(name, updatedAt),
      };
    })
    .filter((session) => session.numbers.length > 0)
    .sort((left, right) => (
      new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime()
      || left.importIndex - right.importIndex
      || left.name.localeCompare(right.name, "zh-Hans-CN")
      || left.id.localeCompare(right.id)
    ));
}

function roiRatio(stats: ColdSignalStats): number {
  return stats.bet > 0 ? (stats.win - stats.bet) / stats.bet : 0;
}

function chooseAdaptiveCis(
  priorSameYearStats: readonly { rowsOnly: ColdSignalStats; groupsOnly: ColdSignalStats }[],
  defaultRows: boolean,
): readonly number[] {
  const rows = emptyStats();
  const groups = emptyStats();
  for (const stats of priorSameYearStats) {
    addStats(rows, stats.rowsOnly);
    addStats(groups, stats.groupsOnly);
  }
  if (rows.bet === 0 && groups.bet === 0) return defaultRows ? ROW_CIS : ALL_CIS;
  const rowRoi = roiRatio(rows);
  const groupRoi = roiRatio(groups);
  if (rowRoi > groupRoi) return ROW_CIS;
  if (groupRoi > rowRoi) return GROUP_CIS;
  return defaultRows ? ROW_CIS : ALL_CIS;
}

function fmtPct(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function tsStats(summary: Summary): string {
  return `signals: ${summary.signals}, bet: ${summary.bet}, win: ${summary.win}, hits: ${summary.hits}, failures: ${summary.failures}, net: ${summary.net}, roi: ${summary.roi.toFixed(6)}, sp100: ${summary.sp100.toFixed(6)}`;
}

const sessions = loadSessions();
const totalSpins = sessions.reduce((sum, session) => sum + session.numbers.length, 0);
const bettingSpins = sessions.reduce((sum, session) => sum + Math.max(0, session.numbers.length - ROI_START), 0);

const modeStats = Object.fromEntries(Object.keys(MODE_META).map((id) => [id, emptyStats()])) as Record<ModeId, ColdSignalStats>;
const ciStats = ALL_CIS.map(() => emptyStats());
const fullSessionStats = sessions.map((session) => computeColdRoiBreakdown(session.numbers));

for (let index = 0; index < sessions.length; index += 1) {
  const session = sessions[index];
  const currentAll = computeColdRoiBreakdown(session.numbers, ALL_CIS, ROI_START);
  addStats(modeStats.all, currentAll.total);
  addStats(modeStats.rows, currentAll.rowsOnly);
  addStats(modeStats.groups, currentAll.groupsOnly);
  for (const row of currentAll.byCi) addStats(ciStats[row.ci], row);

  const priorSameYear = sessions
    .slice(0, index)
    .map((prior, priorIndex) => ({ prior, stats: fullSessionStats[priorIndex] }))
    .filter((item) => item.prior.year === session.year)
    .map((item) => ({ rowsOnly: item.stats.rowsOnly, groupsOnly: item.stats.groupsOnly }));

  const adaptiveRowCis = chooseAdaptiveCis(priorSameYear, true);
  const adaptiveCis = chooseAdaptiveCis(priorSameYear, false);
  addStats(modeStats.adaptiveRow, computeColdRoiBreakdown(session.numbers, adaptiveRowCis, ROI_START).total);
  addStats(modeStats.adaptive, computeColdRoiBreakdown(session.numbers, adaptiveCis, ROI_START).total);
}

const modeSummaries = (Object.keys(MODE_META) as ModeId[]).map((id) => ({
  id,
  label: MODE_META[id],
  summary: summarize(modeStats[id], bettingSpins),
}));
const ciSummaries = ALL_CIS.map((ci) => ({
  ci,
  label: CI_LABELS[ci],
  summary: summarize(ciStats[ci], bettingSpins),
}));

const lines: string[] = [];
lines.push("# Cold History Benchmark");
lines.push("");
lines.push(`- source: \`${path.relative(ROOT, HISTORY_PATH)}\``);
lines.push(`- sessions: ${sessions.length}`);
lines.push(`- spins: ${totalSpins}`);
lines.push(`- bettingSpins: ${bettingSpins}`);
lines.push(`- ROI/SP100 scope: index >= ${ROI_START}`);
lines.push("- no-future: adaptive modes choose row/group from same-year sessions before the current session only; in-session signals are generated before future settlement spins.");
lines.push("");
lines.push("## Mode Benchmark");
lines.push("| mode | signals | bet | win | hits | failures | net | ROI | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const row of modeSummaries) {
  const s = row.summary;
  lines.push(`| ${row.label} | ${s.signals} | ${s.bet} | ${s.win} | ${s.hits} | ${s.failures} | ${s.net} | ${fmtPct(s.roi)} | ${s.sp100.toFixed(2)} |`);
}
lines.push("");
lines.push("## Row/Group Benchmark");
lines.push("| row | signals | bet | win | hits | failures | net | ROI | SP100 |");
lines.push("|---|---:|---:|---:|---:|---:|---:|---:|---:|");
for (const row of ciSummaries) {
  const s = row.summary;
  lines.push(`| ${row.label} | ${s.signals} | ${s.bet} | ${s.win} | ${s.hits} | ${s.failures} | ${s.net} | ${fmtPct(s.roi)} | ${s.sp100.toFixed(2)} |`);
}
lines.push("");
lines.push("## TypeScript Literal");
lines.push("```ts");
lines.push("export const COLD_HISTORY_BENCHMARK = {");
lines.push('  source: "HistoryData/history_data.json",');
lines.push("  roiStartIndex: 200,");
lines.push(`  sessions: ${sessions.length},`);
lines.push(`  spins: ${totalSpins},`);
lines.push(`  bettingSpins: ${bettingSpins},`);
lines.push("  modes: [");
for (const row of modeSummaries) lines.push(`    { id: "${row.id}", label: "${row.label}", ${tsStats(row.summary)} },`);
lines.push("  ],");
lines.push("  rows: [");
for (const row of ciSummaries) lines.push(`    { ci: ${row.ci}, label: "${row.label}", ${tsStats(row.summary)} },`);
lines.push("  ],");
lines.push("} as const;");
lines.push("```");
lines.push("");

fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
fs.writeFileSync(OUTPUT_PATH, lines.join("\n"), "utf8");

console.log(lines.slice(0, lines.indexOf("## TypeScript Literal") - 1).join("\n"));
console.log(`Wrote ${path.relative(ROOT, OUTPUT_PATH)}`);
