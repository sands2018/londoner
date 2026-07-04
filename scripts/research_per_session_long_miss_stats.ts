import fs from "node:fs";
import path from "node:path";

import { getNumberColRows, type RouletteNumber } from "../app/src/core/roulette";

interface RawRow {
  Name?: string;
  Numbers?: string | number[];
  DataTms?: number;
  tms?: number;
}

interface Session {
  importIndex: number;
  name: string;
  numbers: RouletteNumber[];
  updatedTms: number;
  dataTms?: number;
}

interface MissItem {
  label: string;
  hit: (number: RouletteNumber) => boolean;
}

interface MissEvent {
  item: string;
  gap: number;
  session: string;
  sessionIndex: number;
  startIndex: number;
  endIndex: number;
  trailing: boolean;
}

interface FamilyConfig {
  id: string;
  title: string;
  items: MissItem[];
  thresholds: number[];
}

interface FamilyStats {
  id: string;
  title: string;
  thresholds: number[];
  maxGap: number;
  counts: Record<number, number>;
  sessionsWith: Record<number, number>;
  topEvents: MissEvent[];
}

interface SessionFamilyStats {
  maxGap: number;
  counts: Record<number, number>;
  topEvent: MissEvent | null;
}

interface SessionRow {
  name: string;
  count: number;
  dataDate: string;
  family: Record<string, SessionFamilyStats>;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_MD = path.join(ROOT, "scripts", "output", "per-session-long-miss-stats-20260703.md");
const OUTPUT_CSV = path.join(ROOT, "scripts", "output", "per-session-long-miss-stats-20260703.csv");

const COL6_STARTS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31];
const COL3_STARTS = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];

function parseNumbers(raw: string | number[] | undefined): RouletteNumber[] {
  const values = Array.isArray(raw)
    ? raw
    : String(raw ?? "").split(/[,，\s]+/u).map((item) => Number(item.trim()));
  return values.filter((value): value is RouletteNumber => (
    Number.isInteger(value) && value >= 0 && value <= 36
  ));
}

function sessionTime(session: Pick<Session, "dataTms" | "updatedTms">): number {
  return Number.isFinite(session.dataTms) ? session.dataTms ?? 0 : session.updatedTms;
}

function formatDate(tms: number | undefined): string {
  if (!Number.isFinite(tms)) return "-";
  return new Date(tms as number).toISOString().slice(0, 10);
}

function loadSessions(): Session[] {
  const rawRows = JSON.parse(fs.readFileSync(INPUT_FILE, "utf8")) as RawRow[];
  return rawRows.map((row, index) => ({
    importIndex: index,
    name: row.Name ?? `row-${index + 1}`,
    numbers: parseNumbers(row.Numbers),
    updatedTms: row.tms ?? row.DataTms ?? index,
    dataTms: row.DataTms,
  }))
    .filter((session) => session.numbers.length > 0)
    .sort((left, right) => (
      sessionTime(left) - sessionTime(right)
      || left.importIndex - right.importIndex
      || left.name.localeCompare(right.name, "zh-Hans-CN")
    ));
}

function inRange(start: number, size: number): (number: RouletteNumber) => boolean {
  return (number) => number >= start && number < start + size;
}

function buildFamilies(): FamilyConfig[] {
  const groupLabels = ["一组", "二组", "三组"];
  const rowLabels = ["1行", "2行", "3行"];
  return [
    {
      id: "group",
      title: "组",
      thresholds: [10, 12, 15, 20],
      items: groupLabels.map((label, index) => ({
        label,
        hit: (number) => getNumberColRows(number).includes(index as 0 | 1 | 2),
      })),
    },
    {
      id: "row",
      title: "行",
      thresholds: [10, 12, 15, 20],
      items: rowLabels.map((label, offset) => ({
        label,
        hit: (number) => getNumberColRows(number).includes((offset + 3) as 3 | 4 | 5),
      })),
    },
    {
      id: "col6",
      title: "6数列",
      thresholds: [30, 50],
      items: COL6_STARTS.map((start) => ({
        label: `${start}-${start + 5}`,
        hit: inRange(start, 6),
      })),
    },
    {
      id: "col3",
      title: "3数列",
      thresholds: [30, 50, 80],
      items: COL3_STARTS.map((start) => ({
        label: `${start}-${start + 2}`,
        hit: inRange(start, 3),
      })),
    },
    {
      id: "number",
      title: "单号",
      thresholds: [200, 300],
      items: Array.from({ length: 37 }, (_, number) => ({
        label: String(number),
        hit: (value: RouletteNumber) => value === number,
      })),
    },
  ];
}

function emptyCounts(thresholds: readonly number[]): Record<number, number> {
  return Object.fromEntries(thresholds.map((threshold) => [threshold, 0])) as Record<number, number>;
}

function analyzeFamilyForSession(
  session: Session,
  sessionIndex: number,
  family: FamilyConfig,
): SessionFamilyStats {
  const counts = emptyCounts(family.thresholds);
  const misses = Array<number>(family.items.length).fill(0);
  const missStarts = Array<number>(family.items.length).fill(0);
  let maxGap = 0;
  let topEvent: MissEvent | null = null;

  function recordEvent(itemIndex: number, endIndex: number, trailing: boolean): void {
    const gap = misses[itemIndex];
    if (gap <= 0) return;
    const event: MissEvent = {
      item: family.items[itemIndex].label,
      gap,
      session: session.name,
      sessionIndex,
      startIndex: missStarts[itemIndex],
      endIndex,
      trailing,
    };
    maxGap = Math.max(maxGap, gap);
    if (topEvent === null || gap > topEvent.gap) topEvent = event;
    for (const threshold of family.thresholds) {
      if (gap >= threshold) counts[threshold] += 1;
    }
  }

  session.numbers.forEach((number, index) => {
    family.items.forEach((item, itemIndex) => {
      if (item.hit(number)) {
        recordEvent(itemIndex, index, false);
        misses[itemIndex] = 0;
        missStarts[itemIndex] = index + 1;
      } else {
        if (misses[itemIndex] === 0) missStarts[itemIndex] = index;
        misses[itemIndex] += 1;
      }
    });
  });

  family.items.forEach((_, itemIndex) => {
    recordEvent(itemIndex, session.numbers.length, true);
  });

  return { maxGap, counts, topEvent };
}

function mergeFamilyStats(config: FamilyConfig, rows: readonly SessionRow[]): FamilyStats {
  const counts = emptyCounts(config.thresholds);
  const sessionsWith = emptyCounts(config.thresholds);
  const events: MissEvent[] = [];
  let maxGap = 0;

  for (const row of rows) {
    const stats = row.family[config.id];
    maxGap = Math.max(maxGap, stats.maxGap);
    if (stats.topEvent) events.push(stats.topEvent);
    for (const threshold of config.thresholds) {
      counts[threshold] += stats.counts[threshold] ?? 0;
      if ((stats.counts[threshold] ?? 0) > 0) sessionsWith[threshold] += 1;
    }
  }

  events.sort((left, right) => right.gap - left.gap || left.sessionIndex - right.sessionIndex);
  return {
    id: config.id,
    title: config.title,
    thresholds: config.thresholds,
    maxGap,
    counts,
    sessionsWith,
    topEvents: events.slice(0, 20),
  };
}

function analyze(): { sessions: Session[]; rows: SessionRow[]; families: FamilyConfig[]; aggregate: FamilyStats[] } {
  const sessions = loadSessions();
  const families = buildFamilies();
  const rows = sessions.map((session, sessionIndex) => {
    const familyStats: Record<string, SessionFamilyStats> = {};
    for (const family of families) {
      familyStats[family.id] = analyzeFamilyForSession(session, sessionIndex, family);
    }
    return {
      name: session.name,
      count: session.numbers.length,
      dataDate: formatDate(sessionTime(session)),
      family: familyStats,
    };
  });
  const aggregate = families.map((family) => mergeFamilyStats(family, rows));
  return { sessions, rows, families, aggregate };
}

function thresholdColumns(stats: SessionFamilyStats, thresholds: readonly number[]): string {
  return thresholds.map((threshold) => String(stats.counts[threshold] ?? 0)).join(" | ");
}

function formatTopEvent(event: MissEvent | null): string {
  if (!event) return "-";
  return `${event.item} ${event.gap}${event.trailing ? " 未结束" : ""} #${event.startIndex}-${event.endIndex}`;
}

function csvEscape(value: string | number): string {
  const text = String(value);
  return /[",\n]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
}

function buildCsv(rows: readonly SessionRow[], families: readonly FamilyConfig[]): string {
  const headers = ["date", "name", "count"];
  for (const family of families) {
    headers.push(`${family.id}.max`);
    for (const threshold of family.thresholds) headers.push(`${family.id}.ge${threshold}`);
    headers.push(`${family.id}.top`);
  }
  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    const values: Array<string | number> = [row.dataDate, row.name, row.count];
    for (const family of families) {
      const stats = row.family[family.id];
      values.push(stats.maxGap);
      for (const threshold of family.thresholds) values.push(stats.counts[threshold] ?? 0);
      values.push(formatTopEvent(stats.topEvent));
    }
    lines.push(values.map(csvEscape).join(","));
  }
  return lines.join("\n");
}

function buildMarkdown(rows: readonly SessionRow[], families: readonly FamilyConfig[], aggregate: readonly FamilyStats[]): string {
  const totalNumbers = rows.reduce((sum, row) => sum + row.count, 0);
  const lines: string[] = [];
  lines.push("# 单局长套统计");
  lines.push("");
  lines.push("输入：`HistoryData/data_20260703.json`");
  lines.push(`口径：每一局单独统计，不跨局连接；0 对行/组/6数列/3数列算失败；单号 0 作为自己的号码统计。`);
  lines.push("缺失段统计包含局首、局中已结束长套，以及局末尾尚未结束的当前长套。阈值均为包含式，例如 `>=10`。");
  lines.push(`总局数 ${rows.length}，总号码 ${totalNumbers}。`);
  lines.push("");

  lines.push("## 总汇总");
  lines.push("");
  lines.push("| 类型 | 项数 | 最长长套 | 阈值次数 | 有该阈值的局数 |");
  lines.push("|---|---:|---:|---|---|");
  for (const stats of aggregate) {
    const itemCount = families.find((family) => family.id === stats.id)?.items.length ?? 0;
    const counts = stats.thresholds.map((threshold) => `>=${threshold}: ${stats.counts[threshold]}`).join("<br>");
    const sessionsWith = stats.thresholds.map((threshold) => `>=${threshold}: ${stats.sessionsWith[threshold]}`).join("<br>");
    lines.push(`| ${stats.title} | ${itemCount} | ${stats.maxGap} | ${counts} | ${sessionsWith} |`);
  }
  lines.push("");

  lines.push("## 各类型最长长套 Top 20");
  lines.push("");
  for (const stats of aggregate) {
    lines.push(`### ${stats.title}`);
    lines.push("");
    lines.push("| # | 长度 | 项 | 局 | 位置 |");
    lines.push("|---:|---:|---|---|---|");
    stats.topEvents.forEach((event, index) => {
      lines.push(`| ${index + 1} | ${event.gap} | ${event.item} | ${event.session} | ${event.trailing ? "未结束" : "已结束"} #${event.startIndex}-${event.endIndex} |`);
    });
    lines.push("");
  }

  lines.push("## 每局明细");
  lines.push("");
  lines.push("| date | name | count | 组max | 组>=10 | >=12 | >=15 | >=20 | 行max | 行>=10 | >=12 | >=15 | >=20 | 6数max | >=30 | >=50 | 3数max | >=30 | >=50 | >=80 | 单号max | >=200 | >=300 |");
  lines.push("|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  for (const row of rows) {
    const group = row.family.group;
    const rowStats = row.family.row;
    const col6 = row.family.col6;
    const col3 = row.family.col3;
    const number = row.family.number;
    lines.push([
      `| ${row.dataDate}`,
      row.name,
      String(row.count),
      String(group.maxGap),
      thresholdColumns(group, [10, 12, 15, 20]),
      String(rowStats.maxGap),
      thresholdColumns(rowStats, [10, 12, 15, 20]),
      String(col6.maxGap),
      thresholdColumns(col6, [30, 50]),
      String(col3.maxGap),
      thresholdColumns(col3, [30, 50, 80]),
      String(number.maxGap),
      thresholdColumns(number, [200, 300]) + " |",
    ].join(" | "));
  }
  lines.push("");
  return lines.join("\n");
}

const result = analyze();
fs.mkdirSync(path.dirname(OUTPUT_MD), { recursive: true });
fs.writeFileSync(OUTPUT_MD, buildMarkdown(result.rows, result.families, result.aggregate), "utf8");
fs.writeFileSync(OUTPUT_CSV, buildCsv(result.rows, result.families), "utf8");

console.log(`Wrote ${OUTPUT_MD}`);
console.log(`Wrote ${OUTPUT_CSV}`);
for (const stats of result.aggregate) {
  const counts = stats.thresholds.map((threshold) => `>=${threshold}:${stats.counts[threshold]}`).join(" ");
  console.log(`${stats.title}: max=${stats.maxGap} ${counts}`);
}
