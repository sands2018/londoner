/**
 * 124 Rhythm Analysis v2 — Recalibrated for Individual + Aggregate Entities
 * ========================================================================
 * Fixes from v1:
 * 1. Thresholds recalibrated for individual rows/groups (mean gap ~1.96)
 * 2. Aggregate row/group analysis added (matching GPT's research scope)
 * 3. Smarter bet structures for different entry timing
 * 4. Filter sensitivity analysis — find the sweet spot
 *
 * Run: npx tsx scripts/analyze_124_v2.ts
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
  name: string; numbers: number[]; tms: number;
}

interface BetResult {
  sessionName: string; entityLabel: string;
  entrySkip: number; betPlan: number[]; outcome: number;
  hitRound: number; // 0-based, -1 = miss
}

type EntryFn = (recentGaps: number[], currentSkip: number) => number | null;
type BetFn = (recentGaps: number[], currentSkip: number, entrySkip: number) => number[];

// ============================================================
// Data
// ============================================================

function loadSessions(path: string): Session[] {
  const raw = readFileSync(path, "utf8");
  return (JSON.parse(raw) as any[])
    .filter((e: any) => e.Numbers)
    .map((e: any) => ({
      name: e.Name || "?",
      numbers: typeof e.Numbers === "string"
        ? e.Numbers.split(",").map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n))
        : e.Numbers,
      tms: getHistoryDataTms(e, e.tms || 0),
    }))
    .filter((s: Session) => s.numbers.length > 0);
}

// Row/Group mapping (matches roulette.ts)
// Row 0 = 3,6,9,12,15,18,21,24,27,30,33,36
// Row 1 = 2,5,8,11,14,17,20,23,26,29,32,35
// Row 2 = 1,4,7,10,13,16,19,22,25,28,31,34
// Group 0 = 1-12, Group 1 = 13-24, Group 2 = 25-36
function getGroup(n: number): number | null {
  if (n === 0) return null;
  return Math.floor((n - 1) / 12);
}
function getRow(n: number): number | null {
  if (n === 0) return null;
  const rem = n % 3;
  if (rem === 1) return 2;
  if (rem === 2) return 1;
  return 0;
}

const ROW_NAMES = ["1行(3,6,9…)", "2行(2,5,8…)", "3行(1,4,7…)"];
const GRP_NAMES = ["一组(1-12)", "二组(13-24)", "三组(25-36)"];

// Individual entity labels
const ENTITIES = [
  { type: "row", id: 0, label: "1行", mapper: getRow },
  { type: "row", id: 1, label: "2行", mapper: getRow },
  { type: "row", id: 2, label: "3行", mapper: getRow },
  { type: "group", id: 0, label: "一组", mapper: getGroup },
  { type: "group", id: 1, label: "二组", mapper: getGroup },
  { type: "group", id: 2, label: "三组", mapper: getGroup },
  // Aggregates
  { type: "rowAgg", id: -1, label: "行(全部)", mapper: getRow },
  { type: "groupAgg", id: -1, label: "组(全部)", mapper: getGroup },
  { type: "allAgg", id: -2, label: "行+组(全部)", mapper: (n: number) => {
    const r = getRow(n); const g = getGroup(n);
    return r !== null ? r : (g !== null ? g + 3 : null);
  }},
];

// ============================================================
// Gap computation (supports individual and aggregate)
// ============================================================

function computeGapSequence(
  numbers: number[],
  mapper: (n: number) => number | null,
  targetId: number, // -1 = any (aggregate), -2 = any row or group
): number[] {
  const gaps: number[] = [];
  let prevNonZeroIdx = -1;
  let nonZeroIdx = 0;

  for (const n of numbers) {
    if (n === 0) continue;
    const eid = mapper(n);
    if (eid === null) { nonZeroIdx++; continue; }

    let isTarget = false;
    if (targetId === -1) {
      isTarget = true; // aggregate: any entity of this type
    } else if (targetId === -2) {
      isTarget = true; // any row or group
    } else {
      isTarget = (eid === targetId);
    }

    if (isTarget) {
      if (prevNonZeroIdx >= 0) {
        gaps.push(nonZeroIdx - prevNonZeroIdx - 1);
      }
      prevNonZeroIdx = nonZeroIdx;
    }
    nonZeroIdx++;
  }
  return gaps;
}

// ============================================================
// Stats helpers
// ============================================================

function m(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}
function v(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = m(arr);
  return arr.reduce((s, x) => s + (x - avg) ** 2, 0) / arr.length;
}

// ============================================================
// Backtest engine
// ============================================================

function runBacktest(
  sessions: Session[],
  entityDef: typeof ENTITIES[0],
  entryFn: EntryFn,
  betFn: BetFn,
  minHistoryGaps: number = 18,
): BetResult[] {
  const results: BetResult[] = [];

  for (const sess of sessions) {
    const nums = sess.numbers;
    const gaps: number[] = [];
    let prevHitIdx = -1;
    let nonZeroIdx = 0;

    // Active bet state
    let betPlan: number[] = [];
    let betRound = 0;
    let totalInvested = 0;
    let entrySkip = 0;

    for (let si = 0; si < nums.length; si++) {
      const n = nums[si];

      // Check if 0 counts — no, it doesn't hit any entity
      if (n === 0) {
        // Active bet proceeds but can't win on 0
        if (betPlan.length > 0) {
          const amt = betRound < betPlan.length ? betPlan[betRound] : 0;
          if (amt > 0) {
            totalInvested += amt;
            betRound++;
            if (betRound >= betPlan.length) {
              results.push({
                sessionName: sess.name, entityLabel: entityDef.label,
                entrySkip, betPlan: [...betPlan],
                outcome: -totalInvested, hitRound: -1,
              });
              betPlan = []; betRound = 0; totalInvested = 0;
            }
          }
        }
        continue;
      }

      const eid = entityDef.mapper(n);
      let isTarget = false;
      if (entityDef.id === -1 || entityDef.id === -2) {
        isTarget = (eid !== null);
      } else {
        isTarget = (eid === entityDef.id);
      }

      // Process active bet
      if (betPlan.length > 0) {
        const amt = betRound < betPlan.length ? betPlan[betRound] : 0;
        if (isTarget) {
          // WIN
          if (amt > 0) totalInvested += amt;
          const net = amt > 0 ? 3 * amt - totalInvested : 0;
          results.push({
            sessionName: sess.name, entityLabel: entityDef.label,
            entrySkip, betPlan: [...betPlan],
            outcome: net, hitRound: betRound,
          });
          betPlan = []; betRound = 0; totalInvested = 0;
        } else {
          // MISS this round
          if (amt > 0) totalInvested += amt;
          betRound++;
          if (betRound >= betPlan.length) {
            results.push({
              sessionName: sess.name, entityLabel: entityDef.label,
              entrySkip, betPlan: [...betPlan],
              outcome: -totalInvested, hitRound: -1,
            });
            betPlan = []; betRound = 0; totalInvested = 0;
          }
        }
      }

      // Update gap tracking
      if (isTarget) {
        if (prevHitIdx >= 0) {
          gaps.push(nonZeroIdx - prevHitIdx - 1);
        }
        prevHitIdx = nonZeroIdx;
      }

      nonZeroIdx++;

      // Calculate current skip (rounds since last hit)
      const currentSkip = prevHitIdx >= 0 ? nonZeroIdx - prevHitIdx - 1 : nonZeroIdx;

      // Check entry
      if (betPlan.length === 0 && gaps.length >= minHistoryGaps) {
        const recent = gaps.slice(-minHistoryGaps);
        const es = entryFn(recent, currentSkip);
        if (es !== null && es === currentSkip) {
          betPlan = betFn(recent, currentSkip, es);
          betRound = 0;
          totalInvested = 0;
          entrySkip = currentSkip;
        }
      }
    }
  }
  return results;
}

// ============================================================
// Entry Functions — RECALIBRATED for individual entities
// ============================================================

// Individual row/group stats: mean gap ~1.96, 31% in 2-4 range
// Aggregate row stats: mean gap ~0.65, different distribution

function entryBaseline(_rg: number[], cs: number): number | null {
  return cs === 2 ? 2 : null;
}

// GPT filter adapted for INDIVIDUAL rows
// Original: targetRate≤0.5, trend≤-0.5, mean≥2
// For individual: baseline targetRate=31%, so ≤35% is more appropriate
// trend of -0.3 is already significant (15% of mean)
function entryGptIndiv(recentGaps: number[], cs: number): number | null {
  if (cs !== 2) return null;
  if (recentGaps.length < 18) return null;
  const r18 = recentGaps.slice(-18);
  const p18 = recentGaps.length >= 36 ? recentGaps.slice(-36, -18) : recentGaps.slice(0, -18);
  if (p18.length < 18) return null;

  const targetRate = r18.filter(g => g >= 2 && g <= 4).length / 18;
  const trend = m(r18) - m(p18);

  // Relaxed thresholds for individual entities
  if (targetRate <= 0.40 && trend <= -0.25 && m(r18) >= 1.5)
    return 2;
  return null;
}

// GPT filter for AGGREGATE rows (matching original research)
function entryGptAgg(recentGaps: number[], cs: number): number | null {
  if (cs !== 2) return null;
  if (recentGaps.length < 18) return null;
  const r18 = recentGaps.slice(-18);
  const p18 = recentGaps.length >= 36 ? recentGaps.slice(-36, -18) : recentGaps.slice(0, -18);
  if (p18.length < 18) return null;

  const targetRate = r18.filter(g => g >= 2 && g <= 4).length / 18;
  const trend = m(r18) - m(p18);

  if (targetRate <= 0.5 && trend <= -0.5 && m(r18) >= 2)
    return 2;
  return null;
}

// Dynamic velocity — tuned per entity
function entryVelocity(recentGaps: number[], cs: number): number | null {
  if (recentGaps.length < 18) return null;
  const r18 = recentGaps.slice(-18);
  const r6 = recentGaps.slice(-6);
  const p12 = recentGaps.slice(-18, -6);
  if (p12.length < 12) return null;

  const mean18 = m(r18);
  const mean6 = m(r6);
  const mean12 = m(p12);
  if (mean12 === 0) return null;

  const velocity = (mean6 - mean12) / mean12;
  const targetRate = r18.filter(g => g >= 2 && g <= 4).length / 18;

  // Can't be too tight or overheated
  if (mean18 < 1.5) return null;
  if (targetRate > 0.45) return null;

  let targetSkip: number;
  if (velocity < -0.25) targetSkip = 1;
  else if (velocity < -0.10) targetSkip = 2;
  else targetSkip = 3;

  return cs === targetSkip ? targetSkip : null;
}

// Velocity for aggregate (tighter mean, different scale)
function entryVelocityAgg(recentGaps: number[], cs: number): number | null {
  if (recentGaps.length < 18) return null;
  const r18 = recentGaps.slice(-18);
  const r6 = recentGaps.slice(-6);
  const p12 = recentGaps.slice(-18, -6);
  if (p12.length < 12) return null;

  const mean18 = m(r18);
  const mean6 = m(r6);
  const mean12 = m(p12);
  if (mean12 === 0) return null;

  const velocity = (mean6 - mean12) / mean12;
  const targetRate = r18.filter(g => g >= 2 && g <= 4).length / 18;

  // For aggregate: mean is lower (~0.65), so thresholds differ
  if (mean18 < 0.4) return null;
  if (targetRate > 0.5) return null;

  let targetSkip: number;
  if (velocity < -0.35) targetSkip = 1;
  else if (velocity < -0.15) targetSkip = 2;
  else targetSkip = 3;

  return cs === targetSkip ? targetSkip : null;
}

// ============================================================
// Bet functions
// ============================================================

function bet124(): number[] { return [1, 2, 4]; }

function betSmart(_rg: number[], cs: number, _es: number): number[] {
  // Early entry: shorter progression (most hits in first 2 rounds)
  if (cs <= 1) return [1, 2];
  // Standard: normal 124
  if (cs === 2) return [1, 2, 4];
  // Late entry: higher base, 2 rounds
  return [2, 4];
}

function betShort(_rg: number[], cs: number, _es: number): number[] {
  // Always 2 rounds, varying base
  if (cs <= 1) return [1, 2];
  if (cs === 2) return [1, 3];
  return [2, 4];
}

// ============================================================
// Reporting
// ============================================================

interface Summary {
  label: string; signals: number; net: number; roi: number;
  winRate: number; totalBet: number; maxDD: number;
  winSess: number; loseSess: number;
}

function summarize(results: BetResult[], label: string): Summary | null {
  if (!results.length) {
    console.log(`  ${label}: 0 signals`);
    return null;
  }
  let tb = 0, tw = 0, wins = 0, losses = 0;
  const bySess: Record<string, number> = {};
  const hitRounds: Record<string, number> = {};
  const byEntry: Record<number, { s: number; w: number; b: number; wa: number }> = {};

  for (const r of results) {
    const b = r.betPlan.reduce((a, x) => a + x, 0);
    tb += b; tw += r.outcome + b;
    if (r.outcome > 0) wins++; else if (r.outcome < 0) losses++;
    bySess[r.sessionName] = (bySess[r.sessionName] || 0) + r.outcome;
    const hrk = r.hitRound >= 0 ? `R${r.hitRound + 1}` : "miss";
    hitRounds[hrk] = (hitRounds[hrk] || 0) + 1;

    const es = r.entrySkip;
    if (!byEntry[es]) byEntry[es] = { s: 0, w: 0, b: 0, wa: 0 };
    byEntry[es].s++; byEntry[es].b += b; byEntry[es].wa += r.outcome + b;
    if (r.outcome > 0) byEntry[es].w++;
  }

  const net = tw - tb;
  const roi = tb > 0 ? (net / tb) * 100 : 0;
  const wr = results.length > 0 ? (wins / results.length) * 100 : 0;
  const pnls = Object.values(bySess);
  let cum = 0, peak = 0, maxDD = 0;
  for (const p of pnls) { cum += p; if (cum > peak) peak = cum; maxDD = Math.max(maxDD, peak - cum); }
  const ws = pnls.filter(p => p > 0).length;
  const ls = pnls.filter(p => p < 0).length;

  console.log(`\n  === ${label} ===`);
  console.log(`  信号:${results.length}  胜率:${wr.toFixed(1)}%  ROI:${roi>=0?"+":""}${roi.toFixed(2)}%  净利:${net>=0?"+":""}${net.toFixed(1)}  投入:${tb}  DD:${maxDD.toFixed(0)}`);
  console.log(`  盈利局:${ws}  亏损局:${ls}`);
  console.log(`  命中分布: ${Object.entries(hitRounds).map(([k,v]) => `${k}=${v}`).join(", ")}`);

  // Entry breakdown
  const entryLines: string[] = [];
  for (const es of Object.keys(byEntry).map(Number).sort((a,b) => a-b)) {
    const e = byEntry[es];
    const eroi = e.b > 0 ? ((e.wa - e.b) / e.b * 100) : 0;
    const ewr = e.s > 0 ? (e.w / e.s * 100) : 0;
    entryLines.push(`skip${es}=${e.s}信/${ewr.toFixed(0)}%/${eroi>=0?"+":""}${eroi.toFixed(1)}%`);
  }
  console.log(`  入场: ${entryLines.join(" | ")}`);

  return { label, signals: results.length, net, roi, winRate: wr, totalBet: tb, maxDD, winSess: ws, loseSess: ls };
}

// ============================================================
// Main
// ============================================================

function main() {
  const dataPath = resolve(__dirname, "../HistoryData/wzs-merged.json");
  console.log(`Loading ${dataPath}...`);
  const sessions = loadSessions(dataPath).sort((a, b) => a.tms - b.tms);
  console.log(`${sessions.length} sessions, ${sessions[0].name} → ${sessions[sessions.length-1].name}`);

  // Show individual gap stats for context
  console.log(`\n=== Gap Statistics (individual entities) ===`);
  for (const ent of ENTITIES.slice(0, 6)) {
    const allGaps: number[] = [];
    for (const sess of sessions) {
      allGaps.push(...computeGapSequence(sess.numbers, ent.mapper, ent.id));
    }
    console.log(`  ${ent.label}: n=${allGaps.length}, mean=${m(allGaps).toFixed(2)}, 2-4比例=${(allGaps.filter(g => g>=2 && g<=4).length/allGaps.length*100).toFixed(1)}%`);
  }

  console.log(`\n=== Gap Statistics (aggregate entities) ===`);
  for (const ent of ENTITIES.slice(6)) {
    const allGaps: number[] = [];
    for (const sess of sessions) {
      allGaps.push(...computeGapSequence(sess.numbers, ent.mapper, ent.id));
    }
    console.log(`  ${ent.label}: n=${allGaps.length}, mean=${m(allGaps).toFixed(2)}, 2-4比例=${(allGaps.filter(g => g>=2 && g<=4).length/allGaps.length*100).toFixed(1)}%`);
  }

  const allSummaries: Summary[] = [];

  // Determine which entry/bet combos to use per entity
  const isAgg = (ent: typeof ENTITIES[0]) => ent.id < 0;

  // ================================================================
  // Strategy grid: entry × bet × entity
  // ================================================================
  const strategies: { name: string; entry: EntryFn; bet: BetFn; aggEntry?: EntryFn }[] = [
    { name: "Baseline: skip2→124", entry: entryBaseline, bet: bet124 },
    { name: "GPT Filter→124", entry: entryGptIndiv, bet: bet124, aggEntry: entryGptAgg },
    { name: "Velocity→Smart", entry: entryVelocity, bet: betSmart, aggEntry: entryVelocityAgg },
    { name: "Velocity→124", entry: entryVelocity, bet: bet124, aggEntry: entryVelocityAgg },
    { name: "Velocity→Short", entry: entryVelocity, bet: betShort, aggEntry: entryVelocityAgg },
    { name: "Baseline→Smart", entry: entryBaseline, bet: betSmart },
    { name: "Baseline→Short", entry: entryBaseline, bet: betShort },
  ];

  for (const strat of strategies) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`  ${strat.name}`);
    console.log(`${"=".repeat(60)}`);

    for (const ent of ENTITIES) {
      const entryFn = (isAgg(ent) && strat.aggEntry) ? strat.aggEntry : strat.entry;
      const results = runBacktest(sessions, ent, entryFn, strat.bet);
      const label = `${strat.name.split("→")[0]} | ${ent.label}`;
      const s = summarize(results, label);
      if (s) allSummaries.push(s);
    }
  }

  // ================================================================
  // Sensitivity analysis: find best targetRate threshold
  // ================================================================
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  SENSITIVITY: targetRate threshold sweep (1行)`);
  console.log(`${"=".repeat(60)}`);

  const ent1x = ENTITIES[0]; // 1行
  for (const trMax of [0.30, 0.35, 0.40, 0.45, 0.50, 0.55]) {
    const entryFn: EntryFn = (rg, cs) => {
      if (cs !== 2) return null;
      if (rg.length < 18) return null;
      const r18 = rg.slice(-18);
      const p18 = rg.length >= 36 ? rg.slice(-36, -18) : rg.slice(0, -18);
      if (p18.length < 18) return null;
      const tr = r18.filter(g => g >= 2 && g <= 4).length / 18;
      const trend = m(r18) - m(p18);
      if (tr <= trMax && trend <= -0.2 && m(r18) >= 1.5) return 2;
      return null;
    };
    const results = runBacktest(sessions, ent1x, entryFn, bet124);
    const s = summarize(results, `1行 targetRate≤${trMax} + trend≤-0.2`);
    if (s) allSummaries.push(s);
  }

  // Sensitivity: trend threshold
  console.log(`\n  SENSITIVITY: trend threshold sweep (1行)`);
  for (const trendMax of [-0.10, -0.15, -0.20, -0.25, -0.30, -0.40]) {
    const entryFn: EntryFn = (rg, cs) => {
      if (cs !== 2) return null;
      if (rg.length < 18) return null;
      const r18 = rg.slice(-18);
      const p18 = rg.length >= 36 ? rg.slice(-36, -18) : rg.slice(0, -18);
      if (p18.length < 18) return null;
      const tr = r18.filter(g => g >= 2 && g <= 4).length / 18;
      const trend = m(r18) - m(p18);
      if (tr <= 0.40 && trend <= trendMax && m(r18) >= 1.5) return 2;
      return null;
    };
    const results = runBacktest(sessions, ent1x, entryFn, bet124);
    const s = summarize(results, `1行 trend≤${trendMax} + tr≤0.4`);
    if (s) allSummaries.push(s);
  }

  // Sensitivity: mean threshold
  console.log(`\n  SENSITIVITY: mean threshold sweep (1行)`);
  for (const meanMin of [1.0, 1.3, 1.5, 1.8, 2.0, 2.2]) {
    const entryFn: EntryFn = (rg, cs) => {
      if (cs !== 2) return null;
      if (rg.length < 18) return null;
      const r18 = rg.slice(-18);
      const p18 = rg.length >= 36 ? rg.slice(-36, -18) : rg.slice(0, -18);
      if (p18.length < 18) return null;
      const tr = r18.filter(g => g >= 2 && g <= 4).length / 18;
      const trend = m(r18) - m(p18);
      if (tr <= 0.40 && trend <= -0.2 && m(r18) >= meanMin) return 2;
      return null;
    };
    const results = runBacktest(sessions, ent1x, entryFn, bet124);
    const s = summarize(results, `1行 mean≥${meanMin} + tr≤0.4 + trend≤-0.2`);
    if (s) allSummaries.push(s);
  }

  // ================================================================
  // RANKING
  // ================================================================
  console.log(`\n${"#".repeat(70)}`);
  console.log(`# TOP RESULTS (by ROI, min 50 signals)`);
  console.log(`${"#".repeat(70)}`);
  const ranked = allSummaries.filter(s => s.signals >= 50).sort((a, b) => b.roi - a.roi);
  for (let i = 0; i < Math.min(ranked.length, 40); i++) {
    const s = ranked[i];
    console.log(
      `  ${String(i+1).padStart(2)}. ${s.label.padEnd(55)} ` +
      `ROI=${s.roi>=0?"+":""}${s.roi.toFixed(2)}%  sig=${String(s.signals).padStart(4)}  ` +
      `net=${s.net>=0?"+":""}${s.net.toFixed(1)}  wr=${s.winRate.toFixed(1)}%  DD=${s.maxDD.toFixed(0)}`,
    );
  }

  // Best per entity
  console.log(`\n${"#".repeat(70)}`);
  console.log(`# BEST PER ENTITY`);
  console.log(`${"#".repeat(70)}`);
  for (const entLabel of [...ENTITIES.map(e => e.label)]) {
    const best = ranked.filter(s => s.label.includes(entLabel))[0];
    if (best) {
      console.log(`  ${entLabel}: ${best.label.split(" | ")[0]} → ROI=${best.roi>=0?"+":""}${best.roi.toFixed(2)}% (${best.signals} signals)`);
    }
  }
}

main();
