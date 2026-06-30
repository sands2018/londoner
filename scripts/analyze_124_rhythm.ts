/**
 * 124 Rhythm Analysis — Individual Row/Group, Dynamic Entry, Adaptive Exit
 * =========================================================================
 * 研究方向：
 * 1. 每个行(3个)、每个组(3个) 独立分析，不混合
 * 2. 动态入场轮次 — gap contraction velocity 决定从第几轮开始打
 * 3. 自适应退出 — 根据市场状态动态调整 124 的轮数和注码
 * 4. 数据按时间加权 — 新数据权重更高
 *
 * Run: npx tsx scripts/analyze_124_rhythm.ts
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { getHistoryDataTms } from "./historyTime";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// Types
// ============================================================

interface Session {
  name: string;
  numbers: number[];
  tms: number;
}

interface BetResult {
  sessionName: string;
  entityType: string;
  entityId: number;
  entryRound: number;
  betAmounts: number[];
  outcome: number;
  hitRound: number; // 0=first bet, 1=second, 2=third, 3=fourth, -1=miss
  gapAtEntry: number;
  entrySpinIdx: number;
}

type EntryFn = (recentGaps: number[], currentSkip: number) => number | null;
type BetFn = (recentGaps: number[], currentSkip: number, entryRound: number) => number[];

interface Summary {
  label: string;
  signals: number;
  net: number;
  roi: number;
  winRate: number;
  totalBet: number;
  maxDD: number;
  winningSessions: number;
  losingSessions: number;
}

// ============================================================
// Data loading
// ============================================================

function loadSessions(path: string): Session[] {
  const raw = readFileSync(path, "utf8");
  const data = JSON.parse(raw);
  return data
    .filter((entry: any) => entry.Numbers)
    .map((entry: any) => ({
      name: entry.Name || "unknown",
      numbers:
        typeof entry.Numbers === "string"
          ? entry.Numbers.split(",").map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n))
          : entry.Numbers,
      tms: getHistoryDataTms(entry, entry.tms || 0),
    }))
    .filter((s: Session) => s.numbers.length > 0);
}

// ============================================================
// Row/Group mapping (matching roulette.ts logic)
// ============================================================

function getGroup(n: number): number | null {
  if (n === 0) return null;
  return Math.floor((n - 1) / 12); // 0=1-12, 1=13-24, 2=25-36
}

function getRow(n: number): number | null {
  if (n === 0) return null;
  const rem = n % 3;
  if (rem === 1) return 2; // 1,4,7,... → row 2
  if (rem === 2) return 1; // 2,5,8,... → row 1
  return 0;                // 3,6,9,... → row 0
}

const ROW_LABELS = ["1行(3,6,9…)", "2行(2,5,8…)", "3行(1,4,7…)"];
const GROUP_LABELS = ["一组(1-12)", "二组(13-24)", "三组(25-36)"];

// ============================================================
// Gap computation
// ============================================================

interface GapData {
  gaps: number[];
  perSession: { name: string; tms: number; gaps: number[]; nonZeroLen: number }[];
}

function computeGaps(sessions: Session[], entityId: number, entityType: string): GapData {
  const mapper = entityType === "row" ? getRow : getGroup;
  const allGaps: number[] = [];
  const perSession: GapData["perSession"] = [];

  for (const sess of sessions) {
    const gaps: number[] = [];
    let prevIdx = -1;
    let nonZeroIdx = 0;
    for (const n of sess.numbers) {
      if (n === 0) continue;
      const eid = mapper(n);
      if (eid === entityId) {
        if (prevIdx >= 0) {
          gaps.push(nonZeroIdx - prevIdx - 1);
        }
        prevIdx = nonZeroIdx;
      }
      nonZeroIdx++;
    }
    allGaps.push(...gaps);
    perSession.push({
      name: sess.name,
      tms: sess.tms,
      gaps,
      nonZeroLen: sess.numbers.filter((n) => n !== 0).length,
    });
  }

  return { gaps: allGaps, perSession };
}

// ============================================================
// Statistics helpers
// ============================================================

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function variance(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
}

function stddev(arr: number[]): number {
  return Math.sqrt(variance(arr));
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ============================================================
// Backtest engine
// ============================================================

function runBacktest(
  sessions: Session[],
  entityType: string,
  entityId: number,
  entryFn: EntryFn,
  betFn: BetFn,
  minHistoryGaps: number = 18,
): BetResult[] {
  const mapper = entityType === "row" ? getRow : getGroup;
  const results: BetResult[] = [];

  for (const sess of sessions) {
    const nums = sess.numbers;
    const gaps: number[] = [];
    let prevHitIdx = -1;
    let nonZeroIdx = 0;
    let currentSkip = 0;

    let activeBetPlan: number[] = [];
    let activeBetRound = 0;
    let activeTotalBet = 0;
    let currentSkipAtEntry = 0;

    for (let spinIdx = 0; spinIdx < nums.length; spinIdx++) {
      const n = nums[spinIdx];

      if (n === 0) {
        // 0 doesn't count as a hit for any entity
        if (activeBetPlan.length > 0) {
          const betAmount = activeBetRound < activeBetPlan.length ? activeBetPlan[activeBetRound] : 0;
          if (betAmount > 0) {
            activeTotalBet += betAmount;
            activeBetRound++;
            if (activeBetRound >= activeBetPlan.length) {
              results.push({
                sessionName: sess.name,
                entityType,
                entityId,
                entryRound: currentSkipAtEntry,
                betAmounts: [...activeBetPlan],
                outcome: -activeTotalBet,
                hitRound: -1,
                gapAtEntry: currentSkipAtEntry,
                entrySpinIdx: spinIdx - activeBetPlan.length,
              });
              activeBetPlan = [];
              activeBetRound = 0;
              activeTotalBet = 0;
            }
          }
        }
        currentSkip++;
        continue;
      }

      const eid = mapper(n);
      const isHit = eid === entityId;

      // Check pending bet
      if (activeBetPlan.length > 0) {
        const betAmount = activeBetRound < activeBetPlan.length ? activeBetPlan[activeBetRound] : 0;
        if (isHit) {
          if (betAmount > 0) {
            activeTotalBet += betAmount;
          }
          // Win: payout = 3x bet_amount
          const net = betAmount > 0 ? 3 * betAmount - activeTotalBet : 0;
          results.push({
            sessionName: sess.name,
            entityType,
            entityId,
            entryRound: currentSkipAtEntry,
            betAmounts: [...activeBetPlan],
            outcome: net,
            hitRound: activeBetRound,
            gapAtEntry: currentSkipAtEntry,
            entrySpinIdx: spinIdx - activeBetRound - 1,
          });
          activeBetPlan = [];
          activeBetRound = 0;
          activeTotalBet = 0;
        } else {
          // Miss this round
          if (betAmount > 0) {
            activeTotalBet += betAmount;
          }
          activeBetRound++;
          if (activeBetRound >= activeBetPlan.length) {
            results.push({
              sessionName: sess.name,
              entityType,
              entityId,
              entryRound: currentSkipAtEntry,
              betAmounts: [...activeBetPlan],
              outcome: -activeTotalBet,
              hitRound: -1,
              gapAtEntry: currentSkipAtEntry,
              entrySpinIdx: spinIdx - activeBetPlan.length - 1,
            });
            activeBetPlan = [];
            activeBetRound = 0;
            activeTotalBet = 0;
          }
        }
      }

      // Update gap tracking
      if (isHit) {
        if (prevHitIdx >= 0) {
          gaps.push(nonZeroIdx - prevHitIdx - 1);
        }
        prevHitIdx = nonZeroIdx;
        currentSkip = 0;
      } else {
        currentSkip++;
      }

      nonZeroIdx++;

      // Check entry signal
      if (activeBetPlan.length === 0 && gaps.length >= minHistoryGaps) {
        const recent = gaps.slice(-minHistoryGaps);
        const entryOffset = entryFn(recent, currentSkip);
        if (entryOffset !== null && entryOffset === currentSkip) {
          activeBetPlan = betFn(recent, currentSkip, entryOffset);
          activeBetRound = 0;
          activeTotalBet = 0;
          currentSkipAtEntry = currentSkip;
        }
      }
    }
  }

  return results;
}

// ============================================================
// Entry functions
// ============================================================

function entryFixed2(recentGaps: number[], currentSkip: number): number | null {
  if (currentSkip === 2) return 2;
  return null;
}

function entryGptFilter(recentGaps: number[], currentSkip: number): number | null {
  if (currentSkip !== 2) return null;
  if (recentGaps.length < 18) return null;

  const recent18 = recentGaps.slice(-18);
  const prior18 =
    recentGaps.length >= 36 ? recentGaps.slice(-36, -18) : recentGaps.slice(0, -18);
  if (prior18.length < 18) return null;

  const targetRate = recent18.filter((g) => g >= 2 && g <= 4).length / recent18.length;
  const meanRecent = mean(recent18);
  const meanPrior = mean(prior18);
  const trend = meanRecent - meanPrior;

  if (targetRate <= 0.5 && trend <= -0.5 && meanRecent >= 2) {
    return 2;
  }
  return null;
}

function entryDynamicVelocity(recentGaps: number[], currentSkip: number): number | null {
  if (recentGaps.length < 18) return null;

  const recent6 = recentGaps.slice(-6);
  const prior12 = recentGaps.slice(-18, -6);
  const recent18 = recentGaps.slice(-18);

  if (prior12.length < 12) return null;

  const mean6 = mean(recent6);
  const mean12 = mean(prior12);
  const mean18 = mean(recent18);

  if (mean12 === 0) return null;
  const velocity = (mean6 - mean12) / mean12;

  // Minimum gap mean
  if (mean18 < 1.8) return null;

  // Overheat check
  const targetRate = recent18.filter((g) => g >= 2 && g <= 4).length / recent18.length;
  if (targetRate > 0.55) return null;

  let targetSkip: number;
  if (velocity < -0.3) {
    targetSkip = 1; // Fast contraction — enter early
  } else if (velocity < -0.12) {
    targetSkip = 2; // Moderate
  } else {
    targetSkip = 3; // Slow — wait longer
  }

  if (currentSkip === targetSkip) return targetSkip;
  return null;
}

function entryVarianceSignal(recentGaps: number[], currentSkip: number): number | null {
  if (recentGaps.length < 24) return null;

  const recent12 = recentGaps.slice(-12);
  const prior12 = recentGaps.slice(-24, -12);
  const recent18 = recentGaps.slice(-18);

  if (prior12.length < 12) return null;

  const var12 = recent12.length >= 3 ? variance(recent12) : 1;
  const var24 = prior12.length >= 3 ? variance(prior12) : 1;

  const varRatio = var24 === 0 ? (var12 === 0 ? 0 : 999) : var12 / var24;

  const mean6 = mean(recentGaps.slice(-6));
  const mean12Val = mean(prior12);
  const velocity = mean12Val !== 0 ? (mean6 - mean12Val) / mean12Val : 0;

  let targetSkip: number;
  if (varRatio < 0.65 && velocity < -0.1) {
    targetSkip = 1; // Aggressive early entry
  } else if (varRatio < 0.75 && velocity < 0) {
    targetSkip = 2;
  } else if (varRatio < 0.9) {
    targetSkip = 3;
  } else {
    return null;
  }

  const targetRate = recent18.filter((g) => g >= 2 && g <= 4).length / recent18.length;
  if (targetRate > 0.55) return null;

  if (currentSkip === targetSkip) return targetSkip;
  return null;
}

function entryGapCliff(recentGaps: number[], currentSkip: number): number | null {
  if (recentGaps.length < 18) return null;

  const recent3 = recentGaps.slice(-3);
  const recent6 = recentGaps.slice(-6);
  const recent18 = recentGaps.slice(-18);

  const mean3 = mean(recent3);
  const mean6 = mean(recent6);

  if (mean6 === 0) return null;
  const cliffRatio = mean3 / mean6;

  const prior18 =
    recentGaps.length >= 36 ? recentGaps.slice(-36, -18) : recentGaps.slice(0, -18);
  if (prior18.length < 18) return null;
  const trend = mean(recent18) - mean(prior18);

  const targetRate = recent18.filter((g) => g >= 2 && g <= 4).length / recent18.length;

  let targetSkip: number;
  if (cliffRatio < 0.55 && trend < -0.3 && targetRate <= 0.5) {
    targetSkip = 1;
  } else if (cliffRatio < 0.7 && trend < -0.1 && targetRate <= 0.5) {
    targetSkip = 2;
  } else if (cliffRatio < 0.85 && trend <= 0.0) {
    targetSkip = 3;
  } else {
    return null;
  }

  if (currentSkip === targetSkip) return targetSkip;
  return null;
}

// ============================================================
// Bet functions
// ============================================================

function betFixed124(
  _recentGaps: number[],
  _currentSkip: number,
  _entryRound: number,
): number[] {
  return [1, 2, 4];
}

function betAdaptive124(
  _recentGaps: number[],
  currentSkip: number,
  _entryRound: number,
): number[] {
  if (currentSkip <= 1) {
    return [1, 1, 2, 4]; // Gentle start, 4 rounds
  } else if (currentSkip === 2) {
    return [1, 2, 4]; // Standard
  } else {
    return [2, 4]; // Late but confident — fewer rounds
  }
}

function betAdaptiveVelocity(
  recentGaps: number[],
  currentSkip: number,
  _entryRound: number,
): number[] {
  if (recentGaps.length < 12) return [1, 2, 4];

  const recent6 = recentGaps.slice(-6);
  const prior6 = recentGaps.slice(-12, -6);

  const mean6 = mean(recent6);
  const meanPrior6 = prior6.length > 0 ? mean(prior6) : mean6;

  const velocity = meanPrior6 !== 0 ? (mean6 - meanPrior6) / meanPrior6 : 0;

  if (velocity < -0.3) {
    // Strong contraction: aggressive
    if (currentSkip <= 1) return [2, 4, 8];
    return [1, 3, 6];
  } else if (velocity < -0.12) {
    return [1, 2, 4];
  } else {
    return [2, 3]; // Conservative but higher base
  }
}

// ============================================================
// Reporting
// ============================================================

function summarizeResults(results: BetResult[], label: string): Summary | null {
  if (results.length === 0) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${label}: NO SIGNALS`);
    console.log(`${"=".repeat(60)}`);
    return null;
  }

  let totalBet = 0;
  let totalWin = 0;
  let wins = 0;
  let losses = 0;
  let zero = 0;
  const hitRounds: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  let misses = 0;
  const entryCounts: Record<number, number> = {};
  const perSessionPnl: Record<string, number> = {};

  for (const r of results) {
    const betSum = r.betAmounts.reduce((a, b) => a + b, 0);
    totalBet += betSum;
    totalWin += r.outcome + betSum;

    if (r.outcome > 0) wins++;
    else if (r.outcome < 0) losses++;
    else zero++;

    if (r.hitRound >= 0) {
      const hr = Math.min(r.hitRound, 3);
      hitRounds[hr] = (hitRounds[hr] || 0) + 1;
    } else {
      misses++;
    }

    entryCounts[r.entryRound] = (entryCounts[r.entryRound] || 0) + 1;
    perSessionPnl[r.sessionName] = (perSessionPnl[r.sessionName] || 0) + r.outcome;
  }

  const net = totalWin - totalBet;
  const roi = totalBet > 0 ? (net / totalBet) * 100 : 0;
  const winRate = results.length > 0 ? (wins / results.length) * 100 : 0;
  const hitRate = results.length > 0 ? ((wins + zero) / results.length) * 100 : 0;

  const sessionPnls = Object.values(perSessionPnl);
  const winningSessions = sessionPnls.filter((p) => p > 0).length;
  const losingSessions = sessionPnls.filter((p) => p < 0).length;
  const flatSessions = sessionPnls.filter((p) => p === 0).length;

  let cumPnl = 0;
  let maxDD = 0;
  let peak = 0;
  for (const p of sessionPnls) {
    cumPnl += p;
    if (cumPnl > peak) peak = cumPnl;
    const dd = peak - cumPnl;
    if (dd > maxDD) maxDD = dd;
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${"=".repeat(60)}`);
  console.log(`  信号数: ${results.length}`);
  console.log(`  命中(赢): ${wins}  未中(输): ${losses}  平: ${zero}`);
  console.log(`  胜率: ${winRate.toFixed(1)}%  命中率: ${hitRate.toFixed(1)}%`);
  console.log(`  总投入: ${totalBet}  总回收: ${totalWin}  净利: ${net}`);
  console.log(`  ROI: ${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`);
  console.log(`  盈利局: ${winningSessions}  亏损局: ${losingSessions}  平局: ${flatSessions}`);
  console.log(`  最大回撤: ${maxDD.toFixed(1)}`);
  console.log(
    `  入场分布: ${Object.entries(entryCounts)
      .map(([k, v]) => `${k}轮=${v}`)
      .join(", ")}`,
  );
  console.log(
    `  命中分布: 第1轮=${hitRounds[0] || 0}, 第2轮=${hitRounds[1] || 0}, 第3轮=${hitRounds[2] || 0}, 第4轮=${hitRounds[3] || 0}, 未中=${misses}`,
  );

  // By time period
  const timeStats = analyzeByTime(results);
  console.log(`\n  --- 按时段 ROI ---`);
  for (const [period, stats] of Object.entries(timeStats).slice(0, 12)) {
    console.log(
      `  ${period}: 信号=${stats.signals}, ROI=${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(2)}%`,
    );
  }

  return {
    label,
    signals: results.length,
    net,
    roi,
    winRate,
    totalBet,
    maxDD,
    winningSessions,
    losingSessions,
  };
}

function analyzeByTime(results: BetResult[]): Record<string, { signals: number; roi: number }> {
  const periods: Record<string, { bet: number; win: number; signals: number }> = {};

  for (const r of results) {
    const name = r.sessionName;
    const datePart = name.split("-")[0] || name.slice(0, 6);
    const period = datePart.length >= 6 ? datePart.slice(0, 6) : datePart.slice(0, 4);

    if (!periods[period]) periods[period] = { bet: 0, win: 0, signals: 0 };
    const betSum = r.betAmounts.reduce((a, b) => a + b, 0);
    periods[period].bet += betSum;
    periods[period].win += r.outcome + betSum;
    periods[period].signals++;
  }

  const result: Record<string, { signals: number; roi: number }> = {};
  for (const period of Object.keys(periods).sort()) {
    const s = periods[period];
    result[period] = {
      signals: s.signals,
      roi: s.bet > 0 ? ((s.win - s.bet) / s.bet) * 100 : 0,
    };
  }
  return result;
}

function detailedEntryAnalysis(results: BetResult[], label: string): void {
  if (results.length === 0) return;

  console.log(`\n--- ${label}: 按入场轮次分析 ---`);
  const byEntry: Record<
    number,
    { signals: number; wins: number; bet: number; winAmount: number; hitRounds: Record<string, number> }
  > = {};

  for (const r of results) {
    const er = r.entryRound;
    if (!byEntry[er]) byEntry[er] = { signals: 0, wins: 0, bet: 0, winAmount: 0, hitRounds: {} };

    byEntry[er].signals++;
    const betSum = r.betAmounts.reduce((a, b) => a + b, 0);
    byEntry[er].bet += betSum;
    byEntry[er].winAmount += r.outcome + betSum;
    if (r.outcome > 0) byEntry[er].wins++;
    const hrKey = r.hitRound >= 0 ? `第${r.hitRound + 1}轮` : "miss";
    byEntry[er].hitRounds[hrKey] = (byEntry[er].hitRounds[hrKey] || 0) + 1;
  }

  for (const er of Object.keys(byEntry).map(Number).sort((a, b) => a - b)) {
    const s = byEntry[er];
    const roi = s.bet > 0 ? ((s.winAmount - s.bet) / s.bet) * 100 : 0;
    const wr = s.signals > 0 ? (s.wins / s.signals) * 100 : 0;
    console.log(
      `  入场=${er}轮不出: 信号=${s.signals}, 胜率=${wr.toFixed(1)}%, ROI=${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%, 命中分布=${JSON.stringify(s.hitRounds)}`,
    );
  }
}

// ============================================================
// Per-entity breakdown
// ============================================================

function analyzeByEntity(
  results: BetResult[],
  entityType: string,
): Record<string, Summary> {
  const byEntity: Record<number, BetResult[]> = {};
  for (const r of results) {
    if (!byEntity[r.entityId]) byEntity[r.entityId] = [];
    byEntity[r.entityId].push(r);
  }

  const out: Record<string, Summary> = {};
  const labels = entityType === "row" ? ROW_LABELS : GROUP_LABELS;

  for (const eid of Object.keys(byEntity).map(Number).sort()) {
    const ers = byEntity[eid];
    let totalBet = 0;
    let totalWin = 0;
    let wins = 0;

    for (const r of ers) {
      const betSum = r.betAmounts.reduce((a, b) => a + b, 0);
      totalBet += betSum;
      totalWin += r.outcome + betSum;
      if (r.outcome > 0) wins++;
    }

    const net = totalWin - totalBet;
    const roi = totalBet > 0 ? (net / totalBet) * 100 : 0;
    const label = labels[eid] || `Entity ${eid}`;
    out[label] = {
      label,
      signals: ers.length,
      net,
      roi,
      winRate: ers.length > 0 ? (wins / ers.length) * 100 : 0,
      totalBet,
      maxDD: 0,
      winningSessions: 0,
      losingSessions: 0,
    };
  }

  return out;
}

// ============================================================
// Gap distribution analysis
// ============================================================

function analyzeGaps(sessions: Session[]): void {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  Individual Entity Gap Distribution`);
  console.log(`${"=".repeat(60)}`);

  for (const etype of ["row", "group"]) {
    const labels = etype === "row" ? ROW_LABELS : GROUP_LABELS;
    console.log(`\n--- ${etype.toUpperCase()} ---`);
    for (let eid = 0; eid < 3; eid++) {
      const gd = computeGaps(sessions, eid, etype);
      const gaps = gd.gaps;
      if (gaps.length === 0) continue;

      const m = mean(gaps);
      const med = median(gaps);
      const std = stddev(gaps);
      const total = gaps.length;
      const gap01 = gaps.filter((g) => g <= 1).length;
      const gap24 = gaps.filter((g) => g >= 2 && g <= 4).length;
      const gap5p = gaps.filter((g) => g >= 5).length;

      console.log(
        `  ${labels[eid]}: ` +
          `count=${total}, mean=${m.toFixed(2)}, median=${med}, std=${std.toFixed(2)}, ` +
          `≤1=${gap01}(${((gap01 / total) * 100).toFixed(1)}%), ` +
          `2-4=${gap24}(${((gap24 / total) * 100).toFixed(1)}%), ` +
          `≥5=${gap5p}(${((gap5p / total) * 100).toFixed(1)}%)`,
      );
    }
  }
}

// ============================================================
// Main
// ============================================================

function main(): void {
  const dataPath = resolve(__dirname, "../HistoryData/wzs-merged.json");
  console.log(`Loading data from ${dataPath}...`);
  const sessions = loadSessions(dataPath);
  console.log(`Loaded ${sessions.length} sessions`);

  // Sort by time
  sessions.sort((a, b) => a.tms - b.tms);

  console.log(`Date range: ${sessions[0].name} → ${sessions[sessions.length - 1].name}`);
  const totalSpins = sessions.reduce((sum, s) => sum + s.numbers.filter((n) => n !== 0).length, 0);
  console.log(`Total non-zero spins: ${totalSpins}`);

  // Gap distribution
  analyzeGaps(sessions);

  const allSummaries: Summary[] = [];

  // ================================================================
  // TEST 1: Baseline fixed 2→124
  // ================================================================
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# TEST 1: BASELINE — Fixed 2轮不出 → 124`);
  console.log(`${"#".repeat(60)}`);

  for (const etype of ["row", "group"]) {
    for (let eid = 0; eid < 3; eid++) {
      const results = runBacktest(sessions, etype, eid, entryFixed2, betFixed124);
      const labels = etype === "row" ? ROW_LABELS : GROUP_LABELS;
      const label = `Baseline | ${labels[eid]}`;
      const s = summarizeResults(results, label);
      if (s) allSummaries.push(s);
    }
  }

  // ================================================================
  // TEST 2: GPT filter
  // ================================================================
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# TEST 2: GPT Filter (targetRate≤0.5, trend≤-0.5, mean≥2)`);
  console.log(`${"#".repeat(60)}`);

  for (const etype of ["row", "group"]) {
    for (let eid = 0; eid < 3; eid++) {
      const results = runBacktest(sessions, etype, eid, entryGptFilter, betFixed124);
      const labels = etype === "row" ? ROW_LABELS : GROUP_LABELS;
      const label = `GPT Filter | ${labels[eid]}`;
      const s = summarizeResults(results, label);
      if (s) allSummaries.push(s);
    }
  }

  // ================================================================
  // TEST 3: Dynamic velocity entry
  // ================================================================
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# TEST 3: Dynamic Entry (gap velocity → adaptive skip 1/2/3)`);
  console.log(`${"#".repeat(60)}`);

  for (const etype of ["row", "group"]) {
    for (let eid = 0; eid < 3; eid++) {
      const results = runBacktest(sessions, etype, eid, entryDynamicVelocity, betAdaptive124);
      const labels = etype === "row" ? ROW_LABELS : GROUP_LABELS;
      const label = `Dynamic Velocity | ${labels[eid]}`;
      const s = summarizeResults(results, label);
      if (s) {
        allSummaries.push(s);
        detailedEntryAnalysis(results, label);
      }
    }
  }

  // ================================================================
  // TEST 4: Variance contraction
  // ================================================================
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# TEST 4: Variance Contraction Signal`);
  console.log(`${"#".repeat(60)}`);

  for (const etype of ["row", "group"]) {
    for (let eid = 0; eid < 3; eid++) {
      const results = runBacktest(sessions, etype, eid, entryVarianceSignal, betAdaptive124);
      const labels = etype === "row" ? ROW_LABELS : GROUP_LABELS;
      const label = `Var Contract | ${labels[eid]}`;
      const s = summarizeResults(results, label);
      if (s) {
        allSummaries.push(s);
        detailedEntryAnalysis(results, label);
      }
    }
  }

  // ================================================================
  // TEST 5: Gap Cliff
  // ================================================================
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# TEST 5: Gap Cliff (last3/last6 acceleration)`);
  console.log(`${"#".repeat(60)}`);

  for (const etype of ["row", "group"]) {
    for (let eid = 0; eid < 3; eid++) {
      const results = runBacktest(sessions, etype, eid, entryGapCliff, betAdaptive124);
      const labels = etype === "row" ? ROW_LABELS : GROUP_LABELS;
      const label = `Gap Cliff | ${labels[eid]}`;
      const s = summarizeResults(results, label);
      if (s) {
        allSummaries.push(s);
        detailedEntryAnalysis(results, label);
      }
    }
  }

  // ================================================================
  // TEST 6: Combo
  // ================================================================
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# TEST 6: Combo — Var Contract + Adaptive Velocity Bets`);
  console.log(`${"#".repeat(60)}`);

  for (const etype of ["row", "group"]) {
    for (let eid = 0; eid < 3; eid++) {
      const results = runBacktest(sessions, etype, eid, entryVarianceSignal, betAdaptiveVelocity);
      const labels = etype === "row" ? ROW_LABELS : GROUP_LABELS;
      const label = `Combo | ${labels[eid]}`;
      const s = summarizeResults(results, label);
      if (s) allSummaries.push(s);
    }
  }

  // ================================================================
  // RANKING
  // ================================================================
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# RANKING (by ROI)`);
  console.log(`${"#".repeat(60)}`);
  allSummaries.sort((a, b) => b.roi - a.roi);
  for (let i = 0; i < Math.min(allSummaries.length, 25); i++) {
    const s = allSummaries[i];
    console.log(
      `  ${(i + 1).toString().padStart(2)}. ${s.label.padEnd(50)}  ROI=${s.roi >= 0 ? "+" : ""}${s.roi.toFixed(2)}%  ` +
        `信号=${String(s.signals).padStart(4)}  净利=${s.net >= 0 ? "+" : ""}${s.net.toFixed(1)}  胜率=${s.winRate.toFixed(1)}%  DD=${s.maxDD.toFixed(0)}`,
    );
  }

  // ================================================================
  // Per-entity breakdown for best strategy
  // ================================================================
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# PER-ENTITY BREAKDOWN — Best Strategy Detail`);
  console.log(`${"#".repeat(60)}`);

  for (const etype of ["row", "group"]) {
    const results = runBacktest(sessions, etype, 0, entryVarianceSignal, betAdaptive124);
    // Collect all entity results
    const allResults: BetResult[] = [];
    for (let eid = 0; eid < 3; eid++) {
      allResults.push(...runBacktest(sessions, etype, eid, entryVarianceSignal, betAdaptive124));
    }
    const breakdown = analyzeByEntity(allResults, etype);
    console.log(`\n  --- ${etype.toUpperCase()} ---`);
    for (const [label, stats] of Object.entries(breakdown)) {
      console.log(
        `  ${label}: 信号=${stats.signals}, 净利=${stats.net >= 0 ? "+" : ""}${stats.net.toFixed(1)}, ROI=${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(2)}%, 胜率=${stats.winRate.toFixed(1)}%`,
      );
    }
  }
}

main();
