import { getNumberColRows, getColRowLabel, type RouletteNumber, type ColRowIndex } from "./roulette";
import { computePeakStats, extractGaps as waveExtractGaps } from "./wave";

/** 历史间隔窗口: 最近N次出现 */
export const GAP_WINDOW = 30;
/** 极端分位: 超过92%的历史最大间隔 */
export const EXTREME_PCT = 0.92;
/** 超出阈值的buffer */
export const EXTREME_BUFFER = 3;
/** 最少等待轮数 */
export const MIN_GAP = 6;
/** 建议追号轮数 */
export const CHASE_LENGTH = 4;
/** 建议翻倍策略 */
export const PROGRESSION = [1, 2, 4, 8];

export interface ColdSignal {
  index: ColRowIndex;
  label: string;
  /** 当前连续未出现的轮数 */
  currentGap: number;
  /** 历史95%分位阈值 */
  threshold: number;
  /** 超出阈值的轮数 */
  excess: number;
  /** 建议追号长度 */
  chaseLength: number;
  /** 建议翻倍策略 */
  progression: number[];
}

function extractGapsLocal(numbers: readonly RouletteNumber[], targetIndex: number): number[] {
  return waveExtractGaps(numbers, targetIndex);
}

function getPercentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * pct))];
}

function analyzeOne(
  numbers: readonly RouletteNumber[],
  index: ColRowIndex,
): ColdSignal | null {
  const gaps = extractGapsLocal(numbers, index);
  const recentGaps = gaps.slice(-GAP_WINDOW);
  if (recentGaps.length < 5) return null;

  const sorted = [...recentGaps].sort((a, b) => a - b);
  const threshold = getPercentile(sorted, EXTREME_PCT);

  // 当前gap
  let lastSeen = -1;
  for (let r = numbers.length - 1; r >= 0; r--) {
    const value = numbers[r];
    if (value === 0) continue;
    if (getNumberColRows(value).map((h) => h as number).includes(index)) {
      lastSeen = r;
      break;
    }
  }
  const currentGap = lastSeen >= 0 ? numbers.length - lastSeen - 1 : numbers.length;

  // 极端条件: 超过95%分位+2, 且>=5轮
  if (currentGap >= threshold + EXTREME_BUFFER && currentGap >= MIN_GAP) {
    return {
      index,
      label: getColRowLabel(index),
      currentGap,
      threshold,
      excess: currentGap - threshold,
      chaseLength: CHASE_LENGTH,
      progression: PROGRESSION,
    };
  }

  return null;
}

export class ColdReversalEngine {
  analyze(numbers: readonly RouletteNumber[]): ColdSignal[] {
    if (numbers.length < 10) return [];
    const indices: ColRowIndex[] = [0, 1, 2, 3, 4, 5];
    const signals: ColdSignal[] = [];
    for (const i of indices) {
      const s = analyzeOne(numbers, i);
      if (s) signals.push(s);
    }
    return signals.sort((a, b) => b.excess - a.excess);
  }

  // 兼容旧接口
  train(_numbers: readonly RouletteNumber[]): void {}
  predict(numbers: readonly RouletteNumber[]): ColdSignal[] {
    return this.analyze(numbers);
  }
}

// ====== 节奏追号 自适应峰值 ======

/** 集中度阈值 */
const RHYTHM_MIN_PCT = 0.62;
/** 翻倍策略 (最多3轮) */
const RHYTHM_PROG = [1, 2, 4];

export interface RhythmSignal {
  index: ColRowIndex;
  label: string;
  /** 当前gap */
  currentGap: number;
  /** 峰值k */
  peak: number;
  /** 峰值±1集中度 */
  concentration: number;
  /** 建议追号长度 */
  chaseLength: number;
  /** 翻倍策略 */
  progression: number[];
}

function analyzeRhythm(
  numbers: readonly RouletteNumber[],
  index: ColRowIndex,
): RhythmSignal | null {
  const gaps = extractGapsLocal(numbers, index);
  if (gaps.length < 8) return null;

  const stats = computePeakStats(gaps);
  if (!stats || stats.conc < RHYTHM_MIN_PCT) return null;

  let lastSeen = -1;
  for (let r = numbers.length - 1; r >= 0; r--) {
    const value = numbers[r];
    if (value === 0) continue;
    if (getNumberColRows(value).map((h) => h as number).includes(index)) {
      lastSeen = r;
      break;
    }
  }
  const currentGap = lastSeen >= 0 ? numbers.length - lastSeen - 1 : numbers.length;
  // 自适应入场: gap必须等于峰值
  if (currentGap !== stats.peak) return null;

  const chaseLen = stats.zoneLen; // 自适应: 区间宽度(2-3轮)
  return {
    index,
    label: getColRowLabel(index),
    currentGap,
    peak: stats.peak,
    concentration: stats.conc,
    chaseLength: chaseLen,
    progression: RHYTHM_PROG.slice(0, chaseLen),
  };
}

export class RhythmEngine {
  analyze(numbers: readonly RouletteNumber[]): RhythmSignal[] {
    if (numbers.length < 15) return [];
    const indices: ColRowIndex[] = [0, 1, 2, 3, 4, 5];
    const signals: RhythmSignal[] = [];
    for (const i of indices) {
      const s = analyzeRhythm(numbers, i);
      if (s) signals.push(s);
    }
    return signals.sort((a, b) => b.concentration - a.concentration);
  }

  train(_numbers: readonly RouletteNumber[]): void {}
  predict(numbers: readonly RouletteNumber[]): RhythmSignal[] {
    return this.analyze(numbers);
  }
}

/** 计算ROI: 模拟冷门反转追号, 返回 {bet, win, roi} */
export function computeRoi(numbers: readonly RouletteNumber[]): { bet: number; win: number; roi: number } {
  let bet = 0, win = 0;
  const lastSeen = [-1, -1, -1, -1, -1, -1];
  const activeChases: { ci: number; startRound: number; chaseLen: number }[] = [];

  for (let r = 0; r < numbers.length; r++) {
    const value = numbers[r];
    const hitCis = value !== 0 ? getNumberColRows(value).map((h) => h as number) : [];
    const remaining: typeof activeChases = [];

    for (const c of activeChases) {
      const bi = r - c.startRound;
      if (bi >= c.chaseLen) continue;
      const amt = PROGRESSION[bi] ?? PROGRESSION[PROGRESSION.length - 1];
      bet += amt;
      if (hitCis.includes(c.ci)) { win += amt * 3; }
      else if (bi + 1 < c.chaseLen) remaining.push(c);
    }
    activeChases.length = 0;
    activeChases.push(...remaining);
    for (const ci of hitCis) lastSeen[ci] = r;
    if (r < 10) continue;

    for (let ci = 0; ci < 6; ci++) {
      const cg = lastSeen[ci] >= 0 ? r - lastSeen[ci] - 1 : r;
      const allGaps: number[] = [];
      let last = -1;
      for (let rr = 0; rr < r; rr++) {
        if (numbers[rr] === 0) continue;
        if (!getNumberColRows(numbers[rr]).map((h) => h as number).includes(ci)) continue;
        if (last >= 0) allGaps.push(rr - last - 1);
        last = rr;
      }
      const recentGaps = allGaps.slice(-GAP_WINDOW);
      if (recentGaps.length < 5) continue;
      const sorted = [...recentGaps].sort((a, b) => a - b);
      const threshold = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * EXTREME_PCT))];
      if (cg < threshold + EXTREME_BUFFER || cg < MIN_GAP) continue;
      if (activeChases.some((c) => c.ci === ci)) continue;
      activeChases.push({ ci, startRound: r + 1, chaseLen: CHASE_LENGTH });
    }
  }
  const roi = bet > 0 ? ((win - bet) / bet * 100) : 0;
  return { bet, win, roi };
}

/** 计算节奏追号ROI (自适应峰值, 按行组永久停) */
export function computeRhythmRoi(numbers: readonly RouletteNumber[]): { bet: number; win: number; roi: number } {
  let bet = 0, win = 0;
  const ls = [-1, -1, -1, -1, -1, -1];
  const ac: { ci: number; sr: number; cl: number }[] = [];
  const paused = [false, false, false, false, false, false];

  for (let r = 0; r < numbers.length; r++) {
    const v = numbers[r];
    const hc = v !== 0 ? getNumberColRows(v).map((h) => h as number) : [];
    const rm: typeof ac = [];
    for (const c of ac) {
      const bi = r - c.sr; if (bi >= c.cl) continue;
      const amt = RHYTHM_PROG[bi] ?? RHYTHM_PROG[RHYTHM_PROG.length - 1]; bet += amt;
      if (hc.includes(c.ci)) { win += amt * 3; }
      else if (bi + 1 < c.cl) rm.push(c);
      else paused[c.ci] = true;
    }
    ac.length = 0; ac.push(...rm);
    for (const ci of hc) ls[ci] = r;
    if (r < 15) continue;
    for (let ci = 0; ci < 6; ci++) {
      if (paused[ci]) continue;
      const cg = ls[ci] >= 0 ? r - ls[ci] - 1 : r;
      if (cg < 1 || cg > 6) continue;
      if (ac.some((c) => c.ci === ci)) continue;
      const gaps = extractGapsLocal(numbers.slice(0, r), ci);
      const stats = computePeakStats(gaps);
      if (!stats || stats.conc < RHYTHM_MIN_PCT) continue;
      if (cg !== stats.peak) continue;
      ac.push({ ci, sr: r + 1, cl: stats.zoneLen });
    }
  }
  const roi = bet > 0 ? ((win - bet) / bet * 100) : 0;
  return { bet, win, roi };
}

/** 节奏追号逐行组明细统计 */
export interface RhythmDetailRow { ci: number; label: string; successes: number; failures: number; roi: number; trend: "up" | "down" | "flat"; }

export function computeRhythmDetailStats(numbers: readonly RouletteNumber[]): RhythmDetailRow[] {
  const labels = ["一组", "二组", "三组", "1行", "2行", "3行"];
  const ciData = Array.from({ length: 6 }, () => ({ bet: 0, win: 0, successes: 0, failures: 0, timeline: [] as { round: number; bet: number; win: number }[] }));
  const ls = [-1, -1, -1, -1, -1, -1];
  const ac: { ci: number; sr: number; cl: number; totalBet: number }[] = [];
  const paused = [false, false, false, false, false, false];
  for (let r = 0; r < numbers.length; r++) {
    const v = numbers[r]; const hc = v !== 0 ? getNumberColRows(v).map((h) => h as number) : [];
    const rm: typeof ac = [];
    for (const c of ac) {
      const bi = r - c.sr; if (bi >= c.cl) continue;
      const amt = RHYTHM_PROG[bi] ?? RHYTHM_PROG[RHYTHM_PROG.length - 1];
      c.totalBet += amt; ciData[c.ci].bet += amt;
      if (hc.includes(c.ci)) { ciData[c.ci].win += amt * 3; ciData[c.ci].successes += 1; ciData[c.ci].timeline.push({ round: r, bet: c.totalBet, win: amt * 3 }); }
      else if (bi + 1 < c.cl) rm.push(c);
      else { ciData[c.ci].failures += 1; ciData[c.ci].timeline.push({ round: r, bet: c.totalBet, win: 0 }); paused[c.ci] = true; }
    }
    ac.length = 0; ac.push(...rm);
    for (const ci of hc) ls[ci] = r;
    if (r < 15) continue;
    for (let ci = 0; ci < 6; ci++) {
      if (paused[ci]) continue;
      const cg = ls[ci] >= 0 ? r - ls[ci] - 1 : r; if (cg < 1 || cg > 6) continue;
      if (ac.some((c) => c.ci === ci)) continue;
      const gaps = extractGapsLocal(numbers.slice(0, r), ci);
      const stats = computePeakStats(gaps);
      if (!stats || stats.conc < RHYTHM_MIN_PCT) continue;
      if (cg !== stats.peak) continue;
      ac.push({ ci, sr: r + 1, cl: stats.zoneLen, totalBet: 0 });
    }
  }
  return labels.map((label, ci) => { const d = ciData[ci]; const roi = d.bet > 0 ? ((d.win - d.bet) / d.bet * 100) : 0; let trend: "up" | "down" | "flat" = "flat"; if (d.timeline.length >= 4) { const mid = Math.floor(d.timeline.length / 2); let fb = 0, fw = 0, sb = 0, sw = 0; for (let i = 0; i < mid; i++) { fb += d.timeline[i].bet; fw += d.timeline[i].win; } for (let i = mid; i < d.timeline.length; i++) { sb += d.timeline[i].bet; sw += d.timeline[i].win; } const fRoi = fb > 0 ? (fw - fb) / fb : 0; const sRoi = sb > 0 ? (sw - sb) / sb : 0; if (sRoi > fRoi + 0.05) trend = "up"; else if (sRoi < fRoi - 0.05) trend = "down"; } return { ci, label, successes: d.successes, failures: d.failures, roi, trend }; });
}

/** 长套逐行组明细统计 */
export function computeColdDetailStats(numbers: readonly RouletteNumber[]): RhythmDetailRow[] {
  const labels = ["一组", "二组", "三组", "1行", "2行", "3行"];
  const ciData = Array.from({ length: 6 }, () => ({
    bet: 0, win: 0, successes: 0, failures: 0,
    timeline: [] as { round: number; bet: number; win: number }[],
  }));
  const ls = [-1, -1, -1, -1, -1, -1];
  const ac: { ci: number; sr: number; cl: number; totalBet: number }[] = [];

  for (let r = 0; r < numbers.length; r++) {
    const v = numbers[r];
    const hc = v !== 0 ? getNumberColRows(v).map((h) => h as number) : [];
    const rm: typeof ac = [];
    for (const c of ac) {
      const bi = r - c.sr; if (bi >= c.cl) continue;
      const amt = PROGRESSION[bi] ?? PROGRESSION[PROGRESSION.length - 1];
      c.totalBet += amt;
      ciData[c.ci].bet += amt;
      if (hc.includes(c.ci)) {
        ciData[c.ci].win += amt * 3;
        ciData[c.ci].successes += 1;
        ciData[c.ci].timeline.push({ round: r, bet: c.totalBet, win: amt * 3 });
      } else if (bi + 1 < c.cl) {
        rm.push(c);
      } else {
        ciData[c.ci].failures += 1;
        ciData[c.ci].timeline.push({ round: r, bet: c.totalBet, win: 0 });
      }
    }
    ac.length = 0; ac.push(...rm);
    for (const ci of hc) ls[ci] = r;
    if (r < 10) continue;
    for (let ci = 0; ci < 6; ci++) {
      const cg = ls[ci] >= 0 ? r - ls[ci] - 1 : r;
      const gaps = extractGapsLocal(numbers.slice(0, r), ci);
      const recentGaps = gaps.slice(-GAP_WINDOW);
      if (recentGaps.length < 5) continue;
      const sorted = [...recentGaps].sort((a, b) => a - b);
      const threshold = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * EXTREME_PCT))];
      if (cg < threshold + EXTREME_BUFFER || cg < MIN_GAP) continue;
      if (ac.some((c) => c.ci === ci)) continue;
      ac.push({ ci, sr: r + 1, cl: CHASE_LENGTH, totalBet: 0 });
    }
  }
  return labels.map((label, ci) => {
    const d = ciData[ci];
    const roi = d.bet > 0 ? ((d.win - d.bet) / d.bet * 100) : 0;
    let trend: "up" | "down" | "flat" = "flat";
    if (d.timeline.length >= 4) {
      const mid = Math.floor(d.timeline.length / 2);
      let fb = 0, fw = 0, sb = 0, sw = 0;
      for (let i = 0; i < mid; i++) { fb += d.timeline[i].bet; fw += d.timeline[i].win; }
      for (let i = mid; i < d.timeline.length; i++) { sb += d.timeline[i].bet; sw += d.timeline[i].win; }
      const fRoi = fb > 0 ? (fw - fb) / fb : 0;
      const sRoi = sb > 0 ? (sw - sb) / sb : 0;
      if (sRoi > fRoi + 0.05) trend = "up";
      else if (sRoi < fRoi - 0.05) trend = "down";
    }
    return { ci, label, successes: d.successes, failures: d.failures, roi, trend };
  });
}

export class PredictionTracker {
  private records: Array<{ hitIndices: Set<number>; sortedIndices: number[] }> = [];
  private maxHistory = 200;

  record(signals: ColdSignal[], actualNumber: RouletteNumber): void {
    if (actualNumber === 0) return;
    const hitIndices = new Set(getNumberColRows(actualNumber).map((h) => h as number));
    const sortedIndices = signals.map((s) => s.index);
    this.records.push({ hitIndices, sortedIndices });
    if (this.records.length > this.maxHistory) this.records.shift();
  }

  getAccuracy(): { top1: number; top2: number; top3: number; averageRank: number } {
    if (this.records.length === 0) return { top1: 0, top2: 0, top3: 0, averageRank: 0 };
    let top1Hits = 0, top2Hits = 0, top3Hits = 0, totalRank = 0, totalHits = 0;
    for (const { hitIndices, sortedIndices } of this.records) {
      for (const hitIdx of hitIndices) {
        const rank = sortedIndices.indexOf(hitIdx);
        if (rank >= 0) {
          if (rank === 0) top1Hits += 1;
          if (rank <= 1) top2Hits += 1;
          if (rank <= 2) top3Hits += 1;
          totalRank += rank + 1;
          totalHits += 1;
        }
      }
    }
    return {
      top1: totalHits > 0 ? top1Hits / totalHits : 0,
      top2: totalHits > 0 ? top2Hits / totalHits : 0,
      top3: totalHits > 0 ? top3Hits / totalHits : 0,
      averageRank: totalHits > 0 ? totalRank / totalHits : 0,
    };
  }

  getFormattedAccuracy(): { top1: string; top2: string; top3: string; averageRank: string } {
    const acc = this.getAccuracy();
    return {
      top1: (acc.top1 * 100).toFixed(1) + "%",
      top2: (acc.top2 * 100).toFixed(1) + "%",
      top3: (acc.top3 * 100).toFixed(1) + "%",
      averageRank: acc.averageRank.toFixed(2),
    };
  }

  get count(): number { return this.records.length; }

  backfill(engine: ColdReversalEngine, numbers: readonly RouletteNumber[]): void {
    this.records = [];
    for (let i = 10; i < numbers.length; i++) {
      if (numbers[i] === 0) continue;
      const sigs = engine.predict(numbers.slice(0, i));
      if (sigs.length > 0) this.record(sigs, numbers[i]);
    }
  }

  clear(): void { this.records = []; }
}
