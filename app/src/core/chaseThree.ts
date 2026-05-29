import type { RouletteNumber } from './roulette';

// ═══════════════════════════════════════════════════════════════════════════════
// 追3 基础配置
// 与研究文档 chase3-street-research.md 第 6、13 节对齐
// ═══════════════════════════════════════════════════════════════════════════════

/** 触发追打的冷 gap 下限（含） */
export const CHASE3_MIN_GAP = 47;
/** 触发追打的冷 gap 上限（含） */
export const CHASE3_MAX_GAP = 53;
/** 下注单位：只追 1 口，1 单位 */
export const CHASE3_PROGRESSION = [1];
/** 最大追打轮数 */
export const CHASE3_CHASE_LEN = 1;
/** 固定街口数量（1-3, 4-6, ..., 34-36） */
export const CHASE3_STREETS = 12;
/** 触发追打所需的最低历史出现次数 */
export const CHASE3_MIN_APPEARANCES = 5;
/** 3 个数字，命中回收 12 倍 */
export const CHASE3_PAY = 12;
/** 波浪过滤：avg10 上限 */
export const CHASE3_WAVE_AVG10_MAX = 18;
/** 波浪过滤：prevGap 上限 */
export const CHASE3_WAVE_PREV_GAP_MAX = 15;
/** 波浪精选：long30Rate10 下限 */
export const CHASE3_WAVE_LONG30_RATE10_MIN = 0.1;
/** gap 历史最大保留数 */
const MAX_GAP_HISTORY = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// 街口几何
// 街口 0 = 1-3, 街口 1 = 4-6, ... 街口 11 = 34-36
// ═══════════════════════════════════════════════════════════════════════════════

export function chaseThreeStreetStart(wi: number): number {
  return 1 + wi * 3;
}

export function chaseThreeStreetEnd(wi: number): number {
  return 3 + wi * 3;
}

/** 号码 v 落在哪个街口（0-indexed），0 返回 -1 */
export function streetOf(v: number): number {
  return v === 0 ? -1 : Math.floor((v - 1) / 3);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════════════════════

export interface ChaseThreeActiveSignal {
  /** 街口索引 0-11 */
  wi: number;
  /** 街口名，如 "13-15" */
  streetName: string;
  /** 触发时的冷度 gap */
  triggerGap: number;
  /** 当前追打轮次 1 */
  round: number;
  /** 本轮下注额 */
  betAmt: number;
  /** 是否尚未开始追打 */
  isNew: boolean;
  /** 追打总轮数 */
  chaseLen: number;
  /** 波浪强：avg10<=18 && prevGap<=15 */
  isStar1: boolean;
  /** 波浪精选：avg10<=18 && long30Rate10>=0.1 */
  isStar2: boolean;
}

export interface ChaseThreeRoi {
  bet: number;
  win: number;
  roi: number;
}

export interface ChaseThreeAnalysis {
  activeSignals: ChaseThreeActiveSignal[];
  totalRoi: ChaseThreeRoi;
  group1Roi: ChaseThreeRoi;
  group2Roi: ChaseThreeRoi;
  group3Roi: ChaseThreeRoi;
  star1Roi: ChaseThreeRoi;
  star2Roi: ChaseThreeRoi;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 波浪特征计算
// ═══════════════════════════════════════════════════════════════════════════════

function computeWaveFeatures(history: readonly number[]): {
  avg10: number;
  prevGap: number;
  long30Rate10: number;
} {
  const recent10 = history.slice(0, MAX_GAP_HISTORY);
  const avg10 = recent10.length > 0
    ? recent10.reduce((a, b) => a + b, 0) / recent10.length
    : 0;
  const prevGap = recent10.length > 0 ? recent10[0] : 0;
  const long30Rate10 = recent10.length > 0
    ? recent10.filter(g => g >= 30).length / recent10.length
    : 0;
  return { avg10, prevGap, long30Rate10 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROI 辅助
// ═══════════════════════════════════════════════════════════════════════════════

function makeRoi(bet: number, win: number): ChaseThreeRoi {
  const roi = bet > 0 ? ((win - bet) / bet) * 100 : 0;
  return { bet, win, roi };
}

function sumRoi(parts: ChaseThreeRoi[]): ChaseThreeRoi {
  let bet = 0, win = 0;
  for (const p of parts) { bet += p.bet; win += p.win; }
  return makeRoi(bet, win);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 分组定义（不重叠，三组各 4 个街口覆盖 12 个数字）
// 一组: 街口 0-3  → 号码 1-12
// 二组: 街口 4-7  → 号码 13-24
// 三组: 街口 8-11 → 号码 25-36
// ═══════════════════════════════════════════════════════════════════════════════

const GROUP1_STREETS = [0, 1, 2, 3];
const GROUP2_STREETS = [4, 5, 6, 7];
const GROUP3_STREETS = [8, 9, 10, 11];

// ═══════════════════════════════════════════════════════════════════════════════
// 主分析函数
// ═══════════════════════════════════════════════════════════════════════════════

export function analyzeChaseThree(numbers: readonly RouletteNumber[]): ChaseThreeAnalysis {
  const W = CHASE3_STREETS;
  const MIN_G = CHASE3_MIN_GAP;
  const MAX_G = CHASE3_MAX_GAP;
  const PROG = CHASE3_PROGRESSION;
  const CHASE_LEN = CHASE3_CHASE_LEN;
  const PAY = CHASE3_PAY;

  interface ActiveChase {
    wi: number;
    sr: number;
    triggerGap: number;
    isStar1: boolean;
    isStar2: boolean;
  }

  interface PassResult {
    roiByWi: Array<{ bet: number; win: number }>;
    star1Roi: { bet: number; win: number };
    star2Roi: { bet: number; win: number };
    activeChases: ActiveChase[];
  }

  function runPass(allowedStreets: readonly number[] | null): PassResult {
    const gaps = new Array<number>(W).fill(0);
    const appearCount = new Array<number>(W).fill(0);
    const gapHistory: number[][] = Array.from({ length: W }, () => []);

    const activeChases: ActiveChase[] = [];
    const roiByWi: Array<{ bet: number; win: number }> =
      Array.from({ length: W }, () => ({ bet: 0, win: 0 }));
    let star1Roi = { bet: 0, win: 0 };
    let star2Roi = { bet: 0, win: 0 };

    for (let r = 0; r < numbers.length; r++) {
      const v = numbers[r];

      // ── 1. 结算活跃追打 ──
      const surviving: ActiveChase[] = [];
      for (const c of activeChases) {
        const ri = r - c.sr;
        if (ri >= CHASE_LEN) continue;
        const amt = PROG[ri] ?? PROG[PROG.length - 1];

        roiByWi[c.wi].bet += amt;
        if (c.isStar1) star1Roi.bet += amt;
        if (c.isStar2) star2Roi.bet += amt;

        if (v !== 0 && streetOf(v) === c.wi) {
          const won = amt * PAY;
          roiByWi[c.wi].win += won;
          if (c.isStar1) star1Roi.win += won;
          if (c.isStar2) star2Roi.win += won;
          continue;
        }

        if (ri + 1 < CHASE_LEN) surviving.push(c);
      }
      activeChases.length = 0;
      for (const c of surviving) activeChases.push(c);

      // ── 2. 检测新信号 ──
      if (v !== 0) {
        const wi = streetOf(v);
        if (wi >= 0) {
          if (allowedStreets && !allowedStreets.includes(wi)) {
            // skip — not in allowed set for this pass
          } else if (
            gaps[wi] >= MIN_G &&
            gaps[wi] <= MAX_G &&
            appearCount[wi] >= CHASE3_MIN_APPEARANCES &&
            !activeChases.some(c => c.wi === wi)
          ) {
            const wave = computeWaveFeatures(gapHistory[wi]);
            const isStar1 =
              wave.avg10 <= CHASE3_WAVE_AVG10_MAX &&
              wave.prevGap <= CHASE3_WAVE_PREV_GAP_MAX;
            const isStar2 =
              wave.avg10 <= CHASE3_WAVE_AVG10_MAX &&
              wave.long30Rate10 >= CHASE3_WAVE_LONG30_RATE10_MIN;

            activeChases.push({ wi, sr: r + 1, triggerGap: gaps[wi], isStar1, isStar2 });
          }
        }
      }

      // ── 3. 更新 gap 跟踪 ──
      if (v !== 0) {
        for (let si = 0; si < W; si++) {
          if (streetOf(v) === si) {
            gapHistory[si].unshift(gaps[si]);
            if (gapHistory[si].length > MAX_GAP_HISTORY) {
              gapHistory[si].length = MAX_GAP_HISTORY;
            }
            gaps[si] = 0;
            appearCount[si] += 1;
          } else {
            gaps[si] += 1;
          }
        }
      }
    }

    return { roiByWi, star1Roi, star2Roi, activeChases };
  }

  // ── 全局：全 12 街口，产出活跃信号 + 总 ROI ──
  const global = runPass(null);

  const activeSignals: ChaseThreeActiveSignal[] = [];
  for (const c of global.activeChases) {
    const roundsPlayed = Math.max(0, numbers.length - c.sr);
    const nr = roundsPlayed + 1;
    if (nr > CHASE_LEN) continue;
    const ws = chaseThreeStreetStart(c.wi);
    const we = chaseThreeStreetEnd(c.wi);
    activeSignals.push({
      wi: c.wi,
      streetName: `${ws}-${we}`,
      triggerGap: c.triggerGap,
      round: nr,
      betAmt: PROG[nr - 1] ?? PROG[PROG.length - 1],
      isNew: nr === 1,
      chaseLen: CHASE_LEN,
      isStar1: c.isStar1,
      isStar2: c.isStar2,
    });
  }

  const totalRoi = sumRoi(global.roiByWi.map(p => makeRoi(p.bet, p.win)));

  function groupPass(streets: readonly number[]): ChaseThreeRoi {
    const p = runPass(streets);
    return sumRoi(streets.map(wi => makeRoi(p.roiByWi[wi].bet, p.roiByWi[wi].win)));
  }

  return {
    activeSignals,
    totalRoi,
    group1Roi: groupPass(GROUP1_STREETS),
    group2Roi: groupPass(GROUP2_STREETS),
    group3Roi: groupPass(GROUP3_STREETS),
    star1Roi: makeRoi(global.star1Roi.bet, global.star1Roi.win),
    star2Roi: makeRoi(global.star2Roi.bet, global.star2Roi.win),
  };
}
