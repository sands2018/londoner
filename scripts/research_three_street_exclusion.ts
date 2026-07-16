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

interface Features {
  maxGap: number;
  fourthGap: number;
  fifthGap: number;
  minGap: number;
  boundaryGap: number;
  excludedMean: number;
  selectedMean: number;
  excludedRatio: number;
  gapSd: number;
  excludedOverlap: number;
  excludedSetStreak: number;
  lossStreak: number;
  zeroGap: number;
  rolling10: number;
  rolling20: number;
  rolling40: number;
  rolling80: number;
}

interface EventRow {
  order: number;
  sessionId: string;
  sessionName: string;
  date: string;
  year: string;
  position: number;
  result: RouletteNumber;
  resultStreet: number;
  excluded: number[];
  selected: number[];
  gaps: number[];
  features: Features;
  hit: boolean;
  net: number;
}

interface Rule {
  id: string;
  label: string;
  predicate: (event: EventRow) => boolean;
}

interface Summary {
  signals: number;
  hits: number;
  stake: number;
  net: number;
  roi: number;
  roiLow: number;
  roiHigh: number;
  sp100: number;
  maxDrawdown: number;
  maxLossStreak: number;
  activeSessions: number;
  positiveSessions: number;
  negativeSessions: number;
  flatSessions: number;
  positiveSessionRate: number;
  meanSessionRoi: number;
  medianSessionRoi: number;
  sessionRoiSd: number;
  signalGini: number;
  top5SignalShare: number;
  top10SignalShare: number;
  top5PositiveNetShare: number;
}

interface RuleResult {
  rule: Rule;
  discovery: Summary;
  holdout: Summary;
  all: Summary;
}

const ROOT = path.resolve(import.meta.dirname, "..");
const INPUT_FILE = path.join(ROOT, "HistoryData", "data_20260703.json");
const OUTPUT_FILE = path.join(ROOT, "scripts", "output", "three-street-exclusion-20260703.md");
const ROI_START = 200;
const STREETS = 12;
const EXCLUDED = 4;
const STAKE_PER_SIGNAL = 8;
const HIT_RETURN = 12;

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
  })).filter((session) => session.numbers.length > 0);

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

function streetOf(number: RouletteNumber): number {
  return number === 0 ? -1 : Math.floor((number - 1) / 3);
}

function mean(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function sd(values: readonly number[]): number {
  if (values.length <= 1) return 0;
  const average = mean(values);
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)));
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function rollingRate(values: readonly boolean[], window: number): number {
  const recent = values.slice(-window);
  return recent.length > 0 ? recent.filter(Boolean).length / recent.length : 0;
}

function sameSet(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function makeEvents(sessions: readonly Session[]): EventRow[] {
  const events: EventRow[] = [];
  let order = 0;

  for (const session of sessions) {
    const lastSeen = Array(STREETS).fill(-1) as number[];
    const priorHits: boolean[] = [];
    let previousExcluded: number[] = [];
    let excludedSetStreak = 0;
    let lossStreak = 0;
    let lastZero = -1;
    const date = formatDate(session.dataTms ?? session.updatedTms);
    const year = date === "-" ? "-" : date.slice(0, 4);

    for (let position = 0; position < session.numbers.length; position += 1) {
      const gaps = lastSeen.map((last, street) => ({
        street,
        gap: last >= 0 ? position - 1 - last : position,
      }));
      const ranked = [...gaps].sort((left, right) => right.gap - left.gap || left.street - right.street);
      const excluded = ranked.slice(0, EXCLUDED).map((item) => item.street).sort((left, right) => left - right);
      const excludedSet = new Set(excluded);
      const selected = Array.from({ length: STREETS }, (_, street) => street).filter((street) => !excludedSet.has(street));
      const sortedGaps = ranked.map((item) => item.gap);
      const excludedGaps = ranked.slice(0, EXCLUDED).map((item) => item.gap);
      const selectedGaps = ranked.slice(EXCLUDED).map((item) => item.gap);
      const totalGap = sortedGaps.reduce((sum, value) => sum + value, 0);
      const overlap = excluded.filter((street) => previousExcluded.includes(street)).length;
      excludedSetStreak = sameSet(excluded, previousExcluded) ? excludedSetStreak + 1 : 1;

      const result = session.numbers[position];
      const resultStreet = streetOf(result);
      const hit = resultStreet >= 0 && !excludedSet.has(resultStreet);
      const net = hit ? HIT_RETURN - STAKE_PER_SIGNAL : -STAKE_PER_SIGNAL;
      events.push({
        order,
        sessionId: session.id,
        sessionName: session.name,
        date,
        year,
        position,
        result,
        resultStreet,
        excluded,
        selected,
        gaps: gaps.map((item) => item.gap),
        features: {
          maxGap: sortedGaps[0],
          fourthGap: sortedGaps[3],
          fifthGap: sortedGaps[4],
          minGap: sortedGaps[sortedGaps.length - 1],
          boundaryGap: sortedGaps[3] - sortedGaps[4],
          excludedMean: mean(excludedGaps),
          selectedMean: mean(selectedGaps),
          excludedRatio: totalGap > 0 ? excludedGaps.reduce((sum, value) => sum + value, 0) / totalGap : 0,
          gapSd: sd(sortedGaps),
          excludedOverlap: overlap,
          excludedSetStreak,
          lossStreak,
          zeroGap: lastZero >= 0 ? position - 1 - lastZero : position,
          rolling10: rollingRate(priorHits, 10),
          rolling20: rollingRate(priorHits, 20),
          rolling40: rollingRate(priorHits, 40),
          rolling80: rollingRate(priorHits, 80),
        },
        hit,
        net,
      });

      priorHits.push(hit);
      lossStreak = hit ? 0 : lossStreak + 1;
      previousExcluded = excluded;
      if (resultStreet >= 0) lastSeen[resultStreet] = position;
      else lastZero = position;
      order += 1;
    }
  }

  return events;
}

function eligibleSpins(sessions: readonly Session[], start = ROI_START): number {
  return sessions.reduce((sum, session) => sum + Math.max(0, session.numbers.length - start), 0);
}

function gini(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].map((value) => Math.max(0, value)).sort((left, right) => left - right);
  const total = sorted.reduce((sum, value) => sum + value, 0);
  if (total === 0) return 0;
  let weighted = 0;
  sorted.forEach((value, index) => { weighted += (index + 1) * value; });
  return (2 * weighted) / (sorted.length * total) - (sorted.length + 1) / sorted.length;
}

function topShare(values: readonly number[], count: number): number {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return 0;
  return [...values].sort((left, right) => right - left).slice(0, count).reduce((sum, value) => sum + value, 0) / total;
}

function wilsonRoi(hits: number, signals: number): [number, number] {
  if (signals <= 0) return [0, 0];
  const z = 1.96;
  const p = hits / signals;
  const denominator = 1 + (z * z) / signals;
  const center = (p + (z * z) / (2 * signals)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p)) / signals + (z * z) / (4 * signals * signals)) / denominator;
  return [1.5 * Math.max(0, center - margin) - 1, 1.5 * Math.min(1, center + margin) - 1];
}

function summarize(events: readonly EventRow[], sessions: readonly Session[], denominator: number): Summary {
  const sessionRows = new Map(sessions.map((session) => [session.id, { signals: 0, net: 0 }]));
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  let currentLossStreak = 0;
  let maxLossStreak = 0;

  for (const event of events) {
    running += event.net;
    peak = Math.max(peak, running);
    maxDrawdown = Math.max(maxDrawdown, peak - running);
    currentLossStreak = event.hit ? 0 : currentLossStreak + 1;
    maxLossStreak = Math.max(maxLossStreak, currentLossStreak);
    const row = sessionRows.get(event.sessionId);
    if (row) {
      row.signals += 1;
      row.net += event.net;
    }
  }

  const signals = events.length;
  const hits = events.filter((event) => event.hit).length;
  const stake = signals * STAKE_PER_SIGNAL;
  const net = events.reduce((sum, event) => sum + event.net, 0);
  const active = [...sessionRows.values()].filter((row) => row.signals > 0);
  const sessionRois = active.map((row) => row.net / (row.signals * STAKE_PER_SIGNAL));
  const signalCounts = [...sessionRows.values()].map((row) => row.signals);
  const positiveNets = [...sessionRows.values()].map((row) => Math.max(0, row.net));
  const [roiLow, roiHigh] = wilsonRoi(hits, signals);
  const positiveSessions = active.filter((row) => row.net > 0).length;
  const negativeSessions = active.filter((row) => row.net < 0).length;

  return {
    signals,
    hits,
    stake,
    net,
    roi: stake > 0 ? net / stake : 0,
    roiLow,
    roiHigh,
    sp100: denominator > 0 ? signals * 100 / denominator : 0,
    maxDrawdown,
    maxLossStreak,
    activeSessions: active.length,
    positiveSessions,
    negativeSessions,
    flatSessions: active.length - positiveSessions - negativeSessions,
    positiveSessionRate: active.length > 0 ? positiveSessions / active.length : 0,
    meanSessionRoi: mean(sessionRois),
    medianSessionRoi: median(sessionRois),
    sessionRoiSd: sd(sessionRois),
    signalGini: gini(signalCounts),
    top5SignalShare: topShare(signalCounts, 5),
    top10SignalShare: topShare(signalCounts, 10),
    top5PositiveNetShare: topShare(positiveNets, 5),
  };
}

function makeRules(): Rule[] {
  const rules: Rule[] = [];
  const add = (id: string, label: string, predicate: Rule["predicate"]) => rules.push({ id, label, predicate });

  [4, 5, 6, 7, 8, 9, 10, 12, 15, 18, 20].forEach((threshold) => {
    add(`g4-ge-${threshold}`, `第4远距离 >= ${threshold}`, (event) => event.features.fourthGap >= threshold);
  });
  [4, 5, 6, 7, 8, 9, 10].forEach((threshold) => {
    add(`g4-le-${threshold}`, `第4远距离 <= ${threshold}`, (event) => event.features.fourthGap <= threshold);
  });
  [8, 10, 12, 15, 18, 20, 25, 30].forEach((threshold) => {
    add(`g1-ge-${threshold}`, `最远距离 >= ${threshold}`, (event) => event.features.maxGap >= threshold);
  });
  [1, 2, 3, 4, 5, 6].forEach((threshold) => {
    add(`boundary-ge-${threshold}`, `第4与第5远断层 >= ${threshold}`, (event) => event.features.boundaryGap >= threshold);
  });
  [6, 7, 8, 9, 10, 12, 15].forEach((threshold) => {
    add(`excluded-mean-ge-${threshold}`, `排除4组平均距离 >= ${threshold}`, (event) => event.features.excludedMean >= threshold);
  });
  [0.45, 0.50, 0.55, 0.60, 0.65].forEach((threshold) => {
    add(`excluded-ratio-ge-${threshold}`, `排除4组占总距离 >= ${Math.round(threshold * 100)}%`, (event) => event.features.excludedRatio >= threshold);
  });
  [3, 4, 5, 6, 7, 8].forEach((threshold) => {
    add(`gap-sd-ge-${threshold}`, `12组距离标准差 >= ${threshold}`, (event) => event.features.gapSd >= threshold);
  });
  [3, 4].forEach((threshold) => {
    add(`overlap-ge-${threshold}`, `排除集合与上一口重合 >= ${threshold}组`, (event) => event.features.excludedOverlap >= threshold);
  });
  [2, 3, 5, 8, 13, 21].forEach((threshold) => {
    add(`set-streak-ge-${threshold}`, `同一排除集合持续 >= ${threshold}口`, (event) => event.features.excludedSetStreak >= threshold);
  });
  [1, 2, 3, 4, 5].forEach((threshold) => {
    add(`loss-streak-ge-${threshold}`, `本打法此前连错 >= ${threshold}口`, (event) => event.features.lossStreak >= threshold);
  });
  [10, 20, 30, 40, 50].forEach((threshold) => {
    add(`zero-gap-ge-${threshold}`, `0未出距离 >= ${threshold}`, (event) => event.features.zeroGap >= threshold);
  });
  ([10, 20, 40, 80] as const).forEach((window) => {
    ([0.55, 0.60, 0.65] as const).forEach((threshold) => {
      add(`r${window}-le-${threshold}`, `此前${window}口命中率 <= ${Math.round(threshold * 100)}%`, (event) => event.features[`rolling${window}`] <= threshold);
    });
    ([0.65, 0.70, 0.75] as const).forEach((threshold) => {
      add(`r${window}-ge-${threshold}`, `此前${window}口命中率 >= ${Math.round(threshold * 100)}%`, (event) => event.features[`rolling${window}`] >= threshold);
    });
  });

  return rules;
}

function scopeEvents(events: readonly EventRow[], sessions: readonly Session[], start = ROI_START): EventRow[] {
  const ids = new Set(sessions.map((session) => session.id));
  return events.filter((event) => ids.has(event.sessionId) && event.position >= start);
}

function formatPct(value: number, digits = 1): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
}

function formatSummary(summary: Summary): string {
  return [
    `sig=${summary.signals}`,
    `hit=${summary.hits}`,
    `net=${summary.net >= 0 ? "+" : ""}${summary.net}`,
    `ROI=${formatPct(summary.roi)}`,
    `SP100=${summary.sp100.toFixed(2)}`,
    `DD=${summary.maxDrawdown}`,
    `L=${summary.maxLossStreak}`,
    `pos=${summary.positiveSessions}/${summary.activeSessions}`,
    `gini=${summary.signalGini.toFixed(3)}`,
    `top5=${(summary.top5SignalShare * 100).toFixed(1)}%`,
  ].join(" ");
}

function shortSummary(summary: Summary): string {
  return `${summary.signals} / ${summary.net >= 0 ? "+" : ""}${summary.net} / ${formatPct(summary.roi)} / ${summary.sp100.toFixed(2)} / ${summary.maxDrawdown} / ${(summary.top5SignalShare * 100).toFixed(1)}%`;
}

function resultForRule(
  rule: Rule,
  allEvents: readonly EventRow[],
  discoveryEvents: readonly EventRow[],
  holdoutEvents: readonly EventRow[],
  allSessions: readonly Session[],
  discoverySessions: readonly Session[],
  holdoutSessions: readonly Session[],
): RuleResult {
  return {
    rule,
    discovery: summarize(discoveryEvents.filter(rule.predicate), discoverySessions, eligibleSpins(discoverySessions)),
    holdout: summarize(holdoutEvents.filter(rule.predicate), holdoutSessions, eligibleSpins(holdoutSessions)),
    all: summarize(allEvents.filter(rule.predicate), allSessions, eligibleSpins(allSessions)),
  };
}

function sessionSummaryRows(events: readonly EventRow[], sessions: readonly Session[]): Array<{ session: Session; summary: Summary }> {
  return sessions.map((session) => {
    const rows = events.filter((event) => event.sessionId === session.id);
    return { session, summary: summarize(rows, [session], Math.max(0, session.numbers.length - ROI_START)) };
  });
}

function main(): void {
  const { sessions, rawCount, manualRows } = loadSessions();
  const bettingSessions = sessions.filter((session) => session.numbers.length > ROI_START);
  const events = makeEvents(sessions);
  const allBetEvents = scopeEvents(events, bettingSessions);
  const allRecordedEvents = scopeEvents(events, sessions, 0);
  const holdoutCount = Math.min(20, Math.max(10, Math.round(bettingSessions.length * 0.30)));
  const discoverySessions = bettingSessions.slice(0, -holdoutCount);
  const holdoutSessions = bettingSessions.slice(-holdoutCount);
  const discoveryEvents = scopeEvents(events, discoverySessions);
  const holdoutEvents = scopeEvents(events, holdoutSessions);
  const baseline = summarize(allBetEvents, bettingSessions, eligibleSpins(bettingSessions));
  const discoveryBaseline = summarize(discoveryEvents, discoverySessions, eligibleSpins(discoverySessions));
  const holdoutBaseline = summarize(holdoutEvents, holdoutSessions, eligibleSpins(holdoutSessions));
  const recordedBaseline = summarize(allRecordedEvents, sessions, eligibleSpins(sessions, 0));

  const minDiscoverySignals = Math.max(300, Math.round(eligibleSpins(discoverySessions) * 0.05));
  const minDiscoveryActive = Math.max(10, Math.ceil(discoverySessions.length * 0.45));
  const baseRules = makeRules();
  const baseResults = baseRules.map((rule) => resultForRule(
    rule,
    allBetEvents,
    discoveryEvents,
    holdoutEvents,
    bettingSessions,
    discoverySessions,
    holdoutSessions,
  ));
  const eligibleBaseResults = baseResults
    .filter((result) => result.discovery.signals >= minDiscoverySignals && result.discovery.activeSessions >= minDiscoveryActive)
    .sort((left, right) => right.discovery.roi - left.discovery.roi || right.discovery.signals - left.discovery.signals);

  const pairSeeds = eligibleBaseResults.slice(0, 12).map((result) => result.rule);
  const pairRules: Rule[] = [];
  for (let left = 0; left < pairSeeds.length; left += 1) {
    for (let right = left + 1; right < pairSeeds.length; right += 1) {
      const leftRule = pairSeeds[left];
      const rightRule = pairSeeds[right];
      pairRules.push({
        id: `${leftRule.id}+${rightRule.id}`,
        label: `${leftRule.label} 且 ${rightRule.label}`,
        predicate: (event) => leftRule.predicate(event) && rightRule.predicate(event),
      });
    }
  }
  const pairResults = pairRules.map((rule) => resultForRule(
    rule,
    allBetEvents,
    discoveryEvents,
    holdoutEvents,
    bettingSessions,
    discoverySessions,
    holdoutSessions,
  )).filter((result) => (
    result.discovery.signals >= minDiscoverySignals
    && result.discovery.activeSessions >= minDiscoveryActive
  )).sort((left, right) => right.discovery.roi - left.discovery.roi || right.discovery.signals - left.discovery.signals);

  const robust = [...eligibleBaseResults, ...pairResults]
    .filter((result) => result.discovery.roi > 0 && result.holdout.roi > 0)
    .sort((left, right) => Math.min(right.discovery.roi, right.holdout.roi) - Math.min(left.discovery.roi, left.holdout.roi))
    .slice(0, 8);

  const lines: string[] = [];
  lines.push("# 三号码组：排除最远4组回测");
  lines.push("");
  lines.push(`输入：\`${path.relative(ROOT, INPUT_FILE).replace(/\\/g, "/")}\``);
  lines.push(`原始 ${rawCount} 局，非空 ${sessions.length} 局，其中第201口后可下注 ${bettingSessions.length} 局，共 ${eligibleSpins(bettingSessions)} 口。`);
  lines.push(`文件带手工 TableId ${manualRows} 局；本研究完全忽略 TableId、名称分桌和自动归桌。`);
  lines.push("严格递进：第 N 口排除集合只由该局第1至N-1口计算；0计入未出距离并视为本打法落空。不同局不首尾相接。");
  lines.push("");
  lines.push("## 下注口径");
  lines.push("");
  lines.push("- 12组：1-3、4-6、…、34-36。每口排除当前未出距离最大的4组，押其余8组。");
  lines.push("- 每组选1单位，单口总押8单位；命中任一保留组返12单位，净+4；落入排除组或0，净-8。与每个号码押1单位的ROI完全相同。");
  lines.push("- SP100按下注口数计：一口同时押8组仍算1个信号，因此每口都押时SP100=100。");
  lines.push("- 随机轮盘理论命中率24/37=64.865%，理论ROI=-1/37=-2.703%。");
  lines.push("");
  lines.push("## 基线结果");
  lines.push("");
  lines.push(`- 押注区（每局第201口后）：${formatSummary(baseline)}`);
  lines.push(`- 全部录入号码（仅作参照）：${formatSummary(recordedBaseline)}`);
  lines.push(`- 押注区ROI 95% Wilson区间：${formatPct(baseline.roiLow)} 至 ${formatPct(baseline.roiHigh)}。`);
  lines.push(`- 活跃局：正 ${baseline.positiveSessions} / 负 ${baseline.negativeSessions} / 平 ${baseline.flatSessions}；局均ROI ${formatPct(baseline.meanSessionRoi)}，局中位ROI ${formatPct(baseline.medianSessionRoi)}，局ROI标准差 ${(baseline.sessionRoiSd * 100).toFixed(1)}个百分点。`);
  lines.push(`- 收益集中：top5正收益局占全部正收益 ${(baseline.top5PositiveNetShare * 100).toFixed(1)}%；信号gini ${baseline.signalGini.toFixed(3)}（基线信号随局长度分布）。`);
  lines.push("");
  lines.push("## 时间均匀度");
  lines.push("");
  lines.push("| 年份 | 局数 | 信号 | 净值 | ROI | 正/负/平 | DD |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|");
  [...new Set(bettingSessions.map((session) => formatDate(session.dataTms ?? session.updatedTms).slice(0, 4)))].forEach((year) => {
    const yearSessions = bettingSessions.filter((session) => formatDate(session.dataTms ?? session.updatedTms).startsWith(year));
    const summary = summarize(scopeEvents(events, yearSessions), yearSessions, eligibleSpins(yearSessions));
    lines.push(`| ${year} | ${yearSessions.length} | ${summary.signals} | ${summary.net >= 0 ? "+" : ""}${summary.net} | ${formatPct(summary.roi)} | ${summary.positiveSessions}/${summary.negativeSessions}/${summary.flatSessions} | ${summary.maxDrawdown} |`);
  });
  lines.push("");
  lines.push("| 时间四分段 | 局数 | 信号 | 净值 | ROI | 正/负/平 |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (let quarter = 0; quarter < 4; quarter += 1) {
    const start = Math.floor(bettingSessions.length * quarter / 4);
    const end = Math.floor(bettingSessions.length * (quarter + 1) / 4);
    const quarterSessions = bettingSessions.slice(start, end);
    const summary = summarize(scopeEvents(events, quarterSessions), quarterSessions, eligibleSpins(quarterSessions));
    lines.push(`| Q${quarter + 1} | ${quarterSessions.length} | ${summary.signals} | ${summary.net >= 0 ? "+" : ""}${summary.net} | ${formatPct(summary.roi)} | ${summary.positiveSessions}/${summary.negativeSessions}/${summary.flatSessions} |`);
  }
  lines.push("");
  lines.push("## 条件筛选：较早数据发现，最新数据留出检验");
  lines.push("");
  lines.push(`发现集 ${discoverySessions.length} 局/${eligibleSpins(discoverySessions)}口；最新留出集 ${holdoutSessions.length} 局/${eligibleSpins(holdoutSessions)}口。候选阈值只按发现集排序，留出集不参与选择。`);
  lines.push(`纳入排序门槛：发现集至少 ${minDiscoverySignals} 信号、覆盖至少 ${minDiscoveryActive} 局。`);
  lines.push(`发现集基线：${formatSummary(discoveryBaseline)}`);
  lines.push(`留出集基线：${formatSummary(holdoutBaseline)}`);
  lines.push("");
  lines.push("### 单条件：发现集排名前15");
  lines.push("");
  lines.push("| # | 条件 | 发现集 sig/net/ROI/SP100/DD/top5 | 留出集 sig/net/ROI/SP100/DD/top5 | 全部 sig/net/ROI/SP100/DD/top5 |");
  lines.push("|---:|---|---|---|---|");
  eligibleBaseResults.slice(0, 15).forEach((result, index) => {
    lines.push(`| ${index + 1} | ${result.rule.label} | ${shortSummary(result.discovery)} | ${shortSummary(result.holdout)} | ${shortSummary(result.all)} |`);
  });
  lines.push("");
  lines.push("### 双条件：由发现集前12个单条件两两组合，排名前15");
  lines.push("");
  lines.push("| # | 条件 | 发现集 sig/net/ROI/SP100/DD/top5 | 留出集 sig/net/ROI/SP100/DD/top5 | 全部 sig/net/ROI/SP100/DD/top5 |");
  lines.push("|---:|---|---|---|---|");
  pairResults.slice(0, 15).forEach((result, index) => {
    lines.push(`| ${index + 1} | ${result.rule.label} | ${shortSummary(result.discovery)} | ${shortSummary(result.holdout)} | ${shortSummary(result.all)} |`);
  });
  lines.push("");
  lines.push("### 发现集与留出集都为正的候选");
  lines.push("");
  if (robust.length === 0) {
    lines.push("没有满足样本/覆盖门槛且在发现集、留出集都为正ROI的条件。当前数据不支持用这些简单条件把打法提升为稳定正收益。");
  } else {
    lines.push("| 条件 | 发现集 | 留出集 | 全部 | 均匀度 |");
    lines.push("|---|---|---|---|---|");
    robust.forEach((result) => {
      lines.push(`| ${result.rule.label} | ${shortSummary(result.discovery)} | ${shortSummary(result.holdout)} | ${shortSummary(result.all)} | active ${result.all.activeSessions}/${bettingSessions.length}, gini ${result.all.signalGini.toFixed(3)}, top5 ${(result.all.top5SignalShare * 100).toFixed(1)}% |`);
    });
  }
  lines.push("");
  lines.push("### 全量看似转正、但时间拆分未同时为正的候选");
  lines.push("");
  const postHocPositive = [...eligibleBaseResults, ...pairResults]
    .filter((result) => result.all.roi > 0 && !(result.discovery.roi > 0 && result.holdout.roi > 0))
    .sort((left, right) => right.all.roi - left.all.roi)
    .slice(0, 8);
  if (postHocPositive.length === 0) {
    lines.push("没有。所有满足样本/覆盖门槛的条件在全量上仍为负。\n");
  } else {
    lines.push("以下只用于说明‘减少下注确实可能让历史ROI变好’，不能作为已验证规则，因为发现集和留出集没有同时为正。");
    lines.push("");
    lines.push("| 条件 | 发现集 | 留出集 | 全部 | 全部均匀度 |");
    lines.push("|---|---|---|---|---|");
    postHocPositive.forEach((result) => {
      lines.push(`| ${result.rule.label} | ${shortSummary(result.discovery)} | ${shortSummary(result.holdout)} | ${shortSummary(result.all)} | active ${result.all.activeSessions}/${bettingSessions.length}, gini ${result.all.signalGini.toFixed(3)}, top5 ${(result.all.top5SignalShare * 100).toFixed(1)}% |`);
    });
    lines.push("");
  }
  lines.push("## 最近10局基线");
  lines.push("");
  const latest10 = bettingSessions.slice(-10);
  const latest10Events = scopeEvents(events, latest10);
  lines.push(`总体：${formatSummary(summarize(latest10Events, latest10, eligibleSpins(latest10)))}`);
  lines.push("");
  lines.push("| 日期 | 名称 | 押注口 | 净值 | ROI | 最大回撤 | 最长连错 |");
  lines.push("|---|---|---:|---:|---:|---:|---:|");
  sessionSummaryRows(latest10Events, latest10).forEach(({ session, summary }) => {
    lines.push(`| ${formatDate(session.dataTms ?? session.updatedTms)} | ${session.name.replace(/\|/g, "/")} | ${summary.signals} | ${summary.net >= 0 ? "+" : ""}${summary.net} | ${formatPct(summary.roi)} | ${summary.maxDrawdown} | ${summary.maxLossStreak} |`);
  });
  lines.push("");
  lines.push("## 全部逐局基线");
  lines.push("");
  lines.push("| # | 日期 | 名称 | 押注口 | 净值 | ROI | DD | 最长连错 |");
  lines.push("|---:|---|---|---:|---:|---:|---:|---:|");
  sessionSummaryRows(allBetEvents, bettingSessions).forEach(({ session, summary }, index) => {
    lines.push(`| ${index + 1} | ${formatDate(session.dataTms ?? session.updatedTms)} | ${session.name.replace(/\|/g, "/")} | ${summary.signals} | ${summary.net >= 0 ? "+" : ""}${summary.net} | ${formatPct(summary.roi)} | ${summary.maxDrawdown} | ${summary.maxLossStreak} |`);
  });
  lines.push("");
  lines.push("## 判断原则");
  lines.push("");
  lines.push("1. 基线覆盖固定24/37号码；若历史结果接近-2.7%，说明‘排除最冷4组’本身没有明显优势。若偏离理论值，也要看年份、四分段和局级正负是否一致。");
  lines.push("2. 条件提高ROI必须同时看留出集、SP100、活跃局、gini、top5和回撤。发现集高、留出集转负，通常是阈值搜索过拟合。");
  lines.push("3. 本报告中的留出检验比全量事后排名更可信，但仍只是一份历史文件。任何正候选都应再用后续新局做完全前向验证后，才考虑进入观察层。");

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, `${lines.join("\n")}\n`, "utf8");
  console.log(lines.slice(0, 120).join("\n"));
  console.log(`\n完整报告：${path.relative(ROOT, OUTPUT_FILE)}`);
}

main();
