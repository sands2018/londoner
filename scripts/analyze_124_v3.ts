/**
 * 124 Rhythm v3 — Bug-fixed with proper history + focused on what works
 * =====================================================================
 * Key fixes:
 * 1. minHistoryGaps=36 for strategies needing prior window comparison
 * 2. Proper aggregate entity computation
 * 3. Detailed investigation of WHY 1行 outperforms
 * 4. Time-decay analysis (recent data prioritized)
 *
 * Run: npx tsx scripts/analyze_124_v3.ts
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
interface Session { name: string; numbers: number[]; tms: number; }
interface BetResult {
  sessionName: string; entityLabel: string;
  entrySkip: number; betPlan: number[]; outcome: number; hitRound: number;
  recentMean: number; recentTrend: number; recentTargetRate: number;
}

function loadSessions(path: string): Session[] {
  const raw = readFileSync(path, "utf8");
  return (JSON.parse(raw) as any[])
    .filter((e: any) => e.Numbers)
    .map((e: any) => ({
      name: e.Name || "?",
      numbers: typeof e.Numbers === "string"
        ? e.Numbers.split(",").map((s: string) => Number(s.trim())).filter((n: number) => !isNaN(n))
        : e.Numbers,
      tms: e.tms || 0,
    }))
    .filter((s: Session) => s.numbers.length > 0);
}

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

// Stats helpers
const mu = (arr: number[]) => arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0;
const va = (arr: number[]) => {
  if (arr.length < 2) return 0;
  const avg = mu(arr);
  return arr.reduce((s,x)=>s+(x-avg)**2,0)/arr.length;
};

// ============================================================
// Backtest engine — unified
// ============================================================

type EntryFn = (gaps: number[], currentSkip: number) => number | null;
type BetFn = (gaps: number[], currentSkip: number) => number[];

function backtest(
  sessions: Session[],
  mapper: (n: number) => number | null,
  targetId: number,
  entryFn: EntryFn,
  betFn: BetFn,
  minGaps: number,
  label: string,
): BetResult[] {
  const results: BetResult[] = [];

  for (const sess of sessions) {
    const nums = sess.numbers;
    const gaps: number[] = [];
    let prevHit = -1;
    let nzIdx = 0;
    let betPlan: number[] = [];
    let betRound = 0;
    let invested = 0;
    let entrySkip = 0;
    let recentMean = 0, recentTrend = 0, recentTargetRate = 0;

    for (let si = 0; si < nums.length; si++) {
      const n = nums[si];

      // Process active bet on 0
      if (n === 0 && betPlan.length > 0) {
        const amt = betRound < betPlan.length ? betPlan[betRound] : 0;
        if (amt > 0) { invested += amt; betRound++; }
        if (betRound >= betPlan.length) {
          results.push({ sessionName: sess.name, entityLabel: label,
            entrySkip, betPlan: [...betPlan], outcome: -invested, hitRound: -1,
            recentMean, recentTrend, recentTargetRate });
          betPlan = []; betRound = 0; invested = 0;
        }
        continue;
      }
      if (n === 0) continue;

      const eid = mapper(n);
      let isTarget = targetId === -1 ? (eid !== null) : (eid === targetId);

      // Pending bet resolution
      if (betPlan.length > 0) {
        const amt = betRound < betPlan.length ? betPlan[betRound] : 0;
        if (isTarget) {
          if (amt > 0) invested += amt;
          const net = amt > 0 ? 3 * amt - invested : 0;
          results.push({ sessionName: sess.name, entityLabel: label,
            entrySkip, betPlan: [...betPlan], outcome: net, hitRound: betRound,
            recentMean, recentTrend, recentTargetRate });
          betPlan = []; betRound = 0; invested = 0;
        } else {
          if (amt > 0) { invested += amt; betRound++; }
          if (betRound >= betPlan.length) {
            results.push({ sessionName: sess.name, entityLabel: label,
              entrySkip, betPlan: [...betPlan], outcome: -invested, hitRound: -1,
              recentMean, recentTrend, recentTargetRate });
            betPlan = []; betRound = 0; invested = 0;
          }
        }
      }

      // Update gaps
      if (isTarget) {
        if (prevHit >= 0) gaps.push(nzIdx - prevHit - 1);
        prevHit = nzIdx;
      }
      nzIdx++;

      const cs = prevHit >= 0 ? nzIdx - prevHit - 1 : nzIdx;

      // Check entry
      if (betPlan.length === 0 && gaps.length >= minGaps) {
        const es = entryFn(gaps, cs);
        if (es !== null && es === cs) {
          // Record stats at entry time
          const rg = gaps.slice(-18);
          recentMean = mu(rg);
          const pg = gaps.length >= 36 ? gaps.slice(-36, -18) : gaps.slice(0, Math.max(0, gaps.length - 18));
          recentTrend = recentMean - mu(pg);
          recentTargetRate = rg.filter(g => g>=2 && g<=4).length / rg.length;

          betPlan = betFn(gaps, cs);
          betRound = 0;
          invested = 0;
          entrySkip = cs;
        }
      }
    }
  }
  return results;
}

// ============================================================
// Entry functions
// ============================================================

function entryBaseline(_g: number[], cs: number): number | null {
  return cs === 2 ? 2 : null;
}

// GPT-style: needs 36+ gaps for prior window
function entryGptFull(gaps: number[], cs: number): number | null {
  if (cs !== 2) return null;
  if (gaps.length < 36) return null;
  const r18 = gaps.slice(-18);
  const p18 = gaps.slice(-36, -18);
  const tr = r18.filter(g => g>=2 && g<=4).length / 18;
  const trend = mu(r18) - mu(p18);
  if (tr <= 0.5 && trend <= -0.5 && mu(r18) >= 2) return 2;
  return null;
}

// GPT tuned for individual entities (lower thresholds)
function entryGptIndiv(gaps: number[], cs: number): number | null {
  if (cs !== 2) return null;
  if (gaps.length < 36) return null;
  const r18 = gaps.slice(-18);
  const p18 = gaps.slice(-36, -18);
  const tr = r18.filter(g => g>=2 && g<=4).length / 18;
  const trend = mu(r18) - mu(p18);
  if (tr <= 0.40 && trend <= -0.20 && mu(r18) >= 1.5) return 2;
  return null;
}

// Velocity-based dynamic entry
function entryVelocity(gaps: number[], cs: number): number | null {
  if (gaps.length < 18) return null;
  const r18 = gaps.slice(-18);
  const r6 = gaps.slice(-6);
  const p12 = gaps.slice(-18, -6);
  if (p12.length < 12) return null;

  const mean18 = mu(r18);
  const vel = mu(r6) - mu(p12);
  const velPct = mu(p12) !== 0 ? vel / mu(p12) : 0;
  const tr = r18.filter(g => g>=2 && g<=4).length / 18;

  if (mean18 < 1.5) return null;
  if (tr > 0.45) return null;

  if (velPct < -0.25) return cs === 1 ? 1 : null;
  if (velPct < -0.10) return cs === 2 ? 2 : null;
  return cs === 3 ? 3 : null;
}

// Velocity + variance contraction (combined signal)
function entryVelocityVar(gaps: number[], cs: number): number | null {
  if (gaps.length < 24) return null;
  const r18 = gaps.slice(-18);
  const r6 = gaps.slice(-6);
  const p12 = gaps.slice(-18, -6);
  const r12 = gaps.slice(-12);
  const pp12 = gaps.slice(-24, -12);
  if (p12.length < 12 || pp12.length < 12) return null;

  const mean18 = mu(r18);
  const velPct = mu(p12) !== 0 ? (mu(r6) - mu(p12)) / mu(p12) : 0;
  const varRatio = va(pp12) > 0 ? va(r12) / va(pp12) : 999;
  const tr = r18.filter(g => g>=2 && g<=4).length / 18;

  if (mean18 < 1.5) return null;
  if (tr > 0.45) return null;

  // Variance contraction + velocity = stronger signal
  if (varRatio < 0.75 && velPct < -0.15) return cs === 1 ? 1 : null;
  if (varRatio < 0.85 && velPct < -0.05) return cs === 2 ? 2 : null;
  if (varRatio < 1.0 && velPct < 0.05) return cs === 3 ? 3 : null;
  return null;
}

// ============================================================
// Bet functions
// ============================================================

function bet124(): number[] { return [1, 2, 4]; }
function betShort(): number[] { return [1, 2]; }
function betAdaptive(_g: number[], cs: number): number[] {
  if (cs <= 1) return [1, 2, 4];   // 3 rounds for early entry
  if (cs === 2) return [1, 2, 4];   // standard
  return [1, 2];                      // late entry: short
}
function betMicro(_g: number[], cs: number): number[] {
  // Minimal risk: 2 rounds max
  if (cs <= 1) return [1, 1];
  if (cs === 2) return [1, 2];
  return [2];
}

// ============================================================
// Reporting
// ============================================================

function summarize(results: BetResult[], label: string, verbose = true) {
  if (!results.length) {
    if (verbose) console.log(`  ${label}: 0 signals`);
    return null;
  }
  let tb = 0, tw = 0, wins = 0, losses = 0;
  const bySess: Record<string, number> = {};
  const hitRounds: Record<string, number> = {};
  const byEntry: Record<number, any> = {};
  const byYear: Record<string, { b: number; w: number; s: number }> = {};

  for (const r of results) {
    const b = r.betPlan.reduce((a,x)=>a+x,0);
    tb += b; tw += r.outcome + b;
    if (r.outcome > 0) wins++; else if (r.outcome < 0) losses++;
    bySess[r.sessionName] = (bySess[r.sessionName]||0) + r.outcome;
    const hrk = r.hitRound >= 0 ? `R${r.hitRound+1}` : "miss";
    hitRounds[hrk] = (hitRounds[hrk]||0) + 1;

    const es = r.entrySkip;
    if (!byEntry[es]) byEntry[es] = { s:0, w:0, b:0, wa:0 };
    byEntry[es].s++; byEntry[es].b += b; byEntry[es].wa += r.outcome + b;
    if (r.outcome > 0) byEntry[es].w++;

    const yr = r.sessionName.slice(0,4);
    if (!byYear[yr]) byYear[yr] = { b:0, w:0, s:0 };
    byYear[yr].b += b; byYear[yr].w += r.outcome + b; byYear[yr].s++;
  }

  const net = tw - tb;
  const roi = tb > 0 ? (net/tb)*100 : 0;
  const wr = results.length > 0 ? (wins/results.length)*100 : 0;
  const pnls = Object.values(bySess);
  let cum=0, peak=0, maxDD=0;
  for (const p of pnls) { cum+=p; if(cum>peak) peak=cum; maxDD = Math.max(maxDD, peak-cum); }
  const ws = pnls.filter(p=>p>0).length, ls = pnls.filter(p=>p<0).length;

  if (verbose) {
    console.log(`  ${label}`);
    console.log(`    sig=${results.length} wr=${wr.toFixed(1)}% ROI=${roi>=0?"+":""}${roi.toFixed(2)}% net=${net>=0?"+":""}${net.toFixed(1)} bet=${tb} DD=${maxDD.toFixed(0)} sess=${ws}W/${ls}L`);
    console.log(`    hits: ${Object.entries(hitRounds).map(([k,v])=>`${k}=${v}`).join(" ")}`);
    const eLines: string[] = [];
    for (const es of Object.keys(byEntry).map(Number).sort((a,b)=>a-b)) {
      const e = byEntry[es];
      const eroi = e.b>0 ? ((e.wa-e.b)/e.b*100) : 0;
      eLines.push(`sk${es}:${e.s}s/${(e.w/e.s*100).toFixed(0)}%/${eroi>=0?"+":""}${eroi.toFixed(1)}%`);
    }
    console.log(`    by-entry: ${eLines.join(" | ")}`);
    const yLines: string[] = [];
    for (const yr of Object.keys(byYear).sort()) {
      const y = byYear[yr];
      const yroi = y.b>0 ? ((y.w-y.b)/y.b*100) : 0;
      yLines.push(`${yr}:${y.s}s/${yroi>=0?"+":""}${yroi.toFixed(1)}%`);
    }
    console.log(`    by-year: ${yLines.join(" | ")}`);
  }

  return { label, signals: results.length, net, roi, winRate: wr, totalBet: tb, maxDD, winSess: ws, loseSess: ls };
}

// ============================================================
// MAIN
// ============================================================

function main() {
  const dataPath = resolve(__dirname, "../HistoryData/wzs-merged.json");
  const sessions = loadSessions(dataPath).sort((a,b) => a.tms - b.tms);
  console.log(`${sessions.length} sessions, ${sessions[0].name} → ${sessions[sessions.length-1].name}`);

  // Split: first 72 (older) vs last 72 (newer)
  const mid = Math.floor(sessions.length / 2);
  const oldSessions = sessions.slice(0, mid);
  const newSessions = sessions.slice(mid);
  console.log(`Old: ${oldSessions.length} sessions (${oldSessions[0].name} → ${oldSessions[oldSessions.length-1].name})`);
  console.log(`New: ${newSessions.length} sessions (${newSessions[0].name} → ${newSessions[newSessions.length-1].name})`);

  // Entities to test
  const entities = [
    { mapper: getRow, targetId: 0, label: "1行" },
    { mapper: getRow, targetId: 1, label: "2行" },
    { mapper: getRow, targetId: 2, label: "3行" },
    { mapper: getGroup, targetId: 0, label: "一组" },
    { mapper: getGroup, targetId: 1, label: "二组" },
    { mapper: getGroup, targetId: 2, label: "三组" },
  ];

  const allResults: any[] = [];

  // ================================================================
  // TEST GRID
  // ================================================================
  const tests: { name: string; entry: EntryFn; bet: BetFn; minGaps: number; dataset: string }[] = [
    { name: "Baseline", entry: entryBaseline, bet: bet124, minGaps: 18, dataset: "all" },
    { name: "GPT-Full(tr≤0.5,trend≤-0.5,m≥2)", entry: entryGptFull, bet: bet124, minGaps: 36, dataset: "all" },
    { name: "GPT-Indiv(tr≤0.4,trend≤-0.2,m≥1.5)", entry: entryGptIndiv, bet: bet124, minGaps: 36, dataset: "all" },
    { name: "Velocity→124", entry: entryVelocity, bet: bet124, minGaps: 18, dataset: "all" },
    { name: "Velocity→Short", entry: entryVelocity, bet: betShort, minGaps: 18, dataset: "all" },
    { name: "Velocity→Adaptive", entry: entryVelocity, bet: betAdaptive, minGaps: 18, dataset: "all" },
    { name: "Velocity→Micro", entry: entryVelocity, bet: betMicro, minGaps: 18, dataset: "all" },
    { name: "VelocityVar→124", entry: entryVelocityVar, bet: bet124, minGaps: 24, dataset: "all" },
    { name: "VelocityVar→Short", entry: entryVelocityVar, bet: betShort, minGaps: 24, dataset: "all" },
  ];

  // Run on ALL data
  for (const test of tests) {
    console.log(`\n=== ${test.name} (minGaps=${test.minGaps}) ===`);
    for (const ent of entities) {
      const results = backtest(sessions, ent.mapper, ent.targetId,
        test.entry, test.bet, test.minGaps, ent.label);
      const s = summarize(results, `${test.name} | ${ent.label}`, true);
      if (s) allResults.push(s);
    }
  }

  // ================================================================
  // OLD vs NEW comparison (best strategies only)
  // ================================================================
  console.log(`\n\n########## OLD vs NEW DATA COMPARISON ##########`);

  const bestTests = [
    { name: "Velocity→Short", entry: entryVelocity, bet: betShort, minGaps: 18 },
    { name: "Velocity→124", entry: entryVelocity, bet: bet124, minGaps: 18 },
    { name: "Velocity→Micro", entry: entryVelocity, bet: betMicro, minGaps: 18 },
    { name: "GPT-Indiv", entry: entryGptIndiv, bet: bet124, minGaps: 36 },
  ];

  for (const test of bestTests) {
    console.log(`\n--- ${test.name}: OLD vs NEW ---`);
    for (const ent of entities.slice(0, 6)) {
      const oldR = backtest(oldSessions, ent.mapper, ent.targetId,
        test.entry, test.bet, test.minGaps, ent.label);
      const newR = backtest(newSessions, ent.mapper, ent.targetId,
        test.entry, test.bet, test.minGaps, ent.label);

      const oldS = summarize(oldR, "", false);
      const newS = summarize(newR, "", false);

      const oldROI = oldS ? oldS.roi.toFixed(2) : "N/A";
      const newROI = newS ? newS.roi.toFixed(2) : "N/A";
      const oldSig = oldS ? oldS.signals : 0;
      const newSig = newS ? newS.signals : 0;
      console.log(`  ${ent.label}: old ROI=${oldROI}% (${oldSig}s) → new ROI=${newROI}% (${newSig}s)`);
    }
  }

  // ================================================================
  // RANKING
  // ================================================================
  console.log(`\n\n########## TOP RESULTS (ROI sorted, min 20 signals) ##########`);
  const ranked = allResults.filter((s: any) => s && s.signals >= 20).sort((a:any,b:any) => b.roi - a.roi);
  for (let i = 0; i < Math.min(ranked.length, 30); i++) {
    const s = ranked[i];
    console.log(`  ${String(i+1).padStart(2)}. ${s.label.padEnd(55)} ROI=${s.roi>=0?"+":""}${s.roi.toFixed(2)}%  sig=${String(s.signals).padStart(4)}  net=${s.net>=0?"+":""}${s.net.toFixed(1)}  wr=${s.winRate.toFixed(1)}%  DD=${s.maxDD.toFixed(0)}`);
  }

  // ================================================================
  // WHAT MAKES SKIP=3 WORK FOR 1行?
  // ================================================================
  console.log(`\n\n########## DEEP DIVE: Why does 1行 Velocity→Short skip=3 work? ##########`);

  const ent1x = entities[0];
  const deepResults = backtest(sessions, ent1x.mapper, ent1x.targetId,
    entryVelocity, betShort, 18, "1行");

  // Analyze skip=3 entries specifically
  const skip3Results = deepResults.filter(r => r.entrySkip === 3);
  const skip3Wins = skip3Results.filter(r => r.outcome > 0);
  const skip3Losses = skip3Results.filter(r => r.outcome < 0);

  console.log(`\nSkip=3 entries: ${skip3Results.length} total, ${skip3Wins.length} wins, ${skip3Losses.length} losses`);
  console.log(`Win avg: mean=${mu(skip3Wins.map(r=>r.recentMean)).toFixed(2)} trend=${mu(skip3Wins.map(r=>r.recentTrend)).toFixed(2)} tr=${mu(skip3Wins.map(r=>r.recentTargetRate)).toFixed(3)}`);
  console.log(`Loss avg: mean=${mu(skip3Losses.map(r=>r.recentMean)).toFixed(2)} trend=${mu(skip3Losses.map(r=>r.recentTrend)).toFixed(2)} tr=${mu(skip3Losses.map(r=>r.recentTargetRate)).toFixed(3)}`);

  // Distribution of recentMean at entry for wins vs losses
  const winMeans = skip3Wins.map(r => r.recentMean).sort((a,b)=>a-b);
  const lossMeans = skip3Losses.map(r => r.recentMean).sort((a,b)=>a-b);
  console.log(`Win means: p25=${winMeans[Math.floor(winMeans.length*0.25)]?.toFixed(2)} p50=${winMeans[Math.floor(winMeans.length*0.5)]?.toFixed(2)} p75=${winMeans[Math.floor(winMeans.length*0.75)]?.toFixed(2)}`);
  console.log(`Loss means: p25=${lossMeans[Math.floor(lossMeans.length*0.25)]?.toFixed(2)} p50=${lossMeans[Math.floor(lossMeans.length*0.5)]?.toFixed(2)} p75=${lossMeans[Math.floor(lossMeans.length*0.75)]?.toFixed(2)}`);

  // Hit round distribution at skip=3
  const hitDist: Record<string, number> = {};
  for (const r of skip3Results) {
    const k = r.hitRound >= 0 ? `R${r.hitRound+1}` : "miss";
    hitDist[k] = (hitDist[k]||0) + 1;
  }
  console.log(`Hit distribution at skip=3: ${JSON.stringify(hitDist)}`);

  // ================================================================
  // RECENT-ONLY PERFORMANCE (last 36 sessions)
  // ================================================================
  console.log(`\n\n########## RECENT 36 SESSIONS PERFORMANCE ##########`);
  const recent36 = sessions.slice(-36);
  console.log(`Range: ${recent36[0].name} → ${recent36[recent36.length-1].name}`);

  for (const test of bestTests) {
    console.log(`\n--- ${test.name} (recent 36) ---`);
    for (const ent of entities.slice(0, 6)) {
      const r = backtest(recent36, ent.mapper, ent.targetId,
        test.entry, test.bet, test.minGaps, ent.label);
      const s = summarize(r, `  ${ent.label}`, false);
      if (s) {
        console.log(`  ${ent.label}: ROI=${s.roi>=0?"+":""}${s.roi.toFixed(2)}% sig=${s.signals} net=${s.net>=0?"+":""}${s.net.toFixed(1)} DD=${s.maxDD.toFixed(0)}`);
      } else {
        console.log(`  ${ent.label}: 0 signals`);
      }
    }
  }
}

main();
