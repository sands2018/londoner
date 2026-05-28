import type { RouletteNumber } from './roulette';

// ═══════════════════════════════════════════════════════════════════════════════
// 追6 基础配置
// 所有可调参数集中在此，与研究文档 chase6-wave-research.md 第 13 节对齐
// ═══════════════════════════════════════════════════════════════════════════════

/** 触发追打的冷 gap 下限（含） */
export const CHASE6_MIN_GAP = 25;
/** 触发追打的冷 gap 上限（含） */
export const CHASE6_MAX_GAP = 29;
/** 下注递增序列：第一轮 2 单位，之后各轮 1 单位 */
export const CHASE6_PROGRESSION = [2, 1, 1];
/** 最大追打轮数 */
export const CHASE6_CHASE_LEN = 3;
/** 6号滑动窗口数量（wi: 0-10，覆盖 1-6 到 31-36） */
export const CHASE6_WINDOWS = 11;
/** 触发追打所需的最低历史出现次数 */
export const CHASE6_MIN_APPEARANCES = 5;
/** 强信号的历史出现次数门槛 */
export const CHASE6_STRONG_APPEARANCES = 20;
/** 波浪过滤：触发前 5 个已完成 gap 的均值上限 */
export const CHASE6_WAVE_AVG5_MAX = 8;
/** 波浪过滤：触发前 10 个已完成 gap 中 >=20 的比例上限 */
export const CHASE6_WAVE_LONG20_RATE10_MAX = 0.2;

// ═══════════════════════════════════════════════════════════════════════════════
// 窗口几何
// 窗口 0 = 1-6, 窗口 1 = 4-9, ... 每个窗口 6 个数字，步长 3
// ═══════════════════════════════════════════════════════════════════════════════

/** 窗口 wi 的起始号码（含，1-based） */
export function chaseSixWindowStart(wi: number): number {
  return 1 + wi * 3;
}

/** 窗口 wi 的结束号码（含，1-based） */
export function chaseSixWindowEnd(wi: number): number {
  return 6 + wi * 3;
}

/** 号码 v 是否落在窗口 wi 内（v 为 0 时恒为 false） */
export function isInChaseSixWindow(wi: number, v: number): boolean {
  return v >= 1 + wi * 3 && v <= 6 + wi * 3;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════════════════════════════════════════

/** 当前活跃信号的 UI 展示数据 */
export interface ChaseSixActiveSignal {
  /** 窗口索引 0-10 */
  wi: number;
  /** 窗口名，如 "10-15" */
  windowName: string;
  /** 当前追打轮次 1-3 */
  round: number;
  /** 本轮下注额 */
  betAmt: number;
  /** 是否尚未开始追打（round === 1） */
  isNew: boolean;
  /** 追打总轮数 */
  chaseLen: number;
  /** 强信号：appearances >= 20 */
  isStrong: boolean;
  /** 波浪强信号：isStrong && 通过波浪过滤 */
  isWaveStrong: boolean;
}

export interface ChaseSixRoi {
  bet: number;
  win: number;
  /** 百分比，bet 为 0 时返回 0 */
  roi: number;
}

/** analyzeChaseSix() 的完整输出 */
export interface ChaseSixAnalysis {
  activeSignals: ChaseSixActiveSignal[];
  totalRoi: ChaseSixRoi;
  group1Roi: ChaseSixRoi;
  group2Roi: ChaseSixRoi;
  group3Roi: ChaseSixRoi;
  /** 仅 isStrong 信号的 ROI */
  strongRoi: ChaseSixRoi;
  /** 波浪强信号（strong + wave qualified）ROI */
  waveStrongRoi: ChaseSixRoi;
  /** 被波浪过滤排除的强信号（strong + NOT wave qualified）ROI */
  waveFilteredRoi: ChaseSixRoi;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 波浪特征计算
// ═══════════════════════════════════════════════════════════════════════════════

/** 窗口最近完成 gap 的记录数上限 */
const MAX_GAP_HISTORY = 10;

/**
 * 从窗口的历史已完成 gap 序列中提取波浪特征。
 *
 * gapHistory 按时间倒序排列（最新在前），每个元素是一次"数字落入该窗口"时
 * 与上一次落入之间经历的轮数。
 *
 * 这三个特征描述的是窗口在"这次 25-29 长冷"之前的周期行为：
 * - avg5 低 → 之前是短周期，这次冷是异常的
 * - long20Rate10 低 → 之前不经常长冷
 * - trend5 shortening → 周期有收缩趋势（不是必须，但额外加分）
 *
 * ## 数据不足时的处理
 * - 历史记录 < 5：trend5 为 "unknown"，avg5 按实际数量计算
 * - 历史记录 < 10：trend5 为 "unknown"，long20Rate10 按实际数量计算
 * - 实践中 minAppearances>=20 的信号至少有 19 条历史，所有特征均可靠
 */
function computeWaveFeatures(history: readonly number[]): {
  avg5: number;
  long20Rate10: number;
  trend5: 'shortening' | 'lengthening' | 'flat' | 'unknown';
} {
  // 取最近的 10 条历史（已按时间倒序，index 0 最新）
  const recent10 = history.slice(0, MAX_GAP_HISTORY);
  const recent5 = recent10.slice(0, 5);
  const prev5 = recent10.slice(5, 10);

  // avg5: 最近 5 个已完成 gap 的均值
  const avg5 = recent5.length > 0
    ? recent5.reduce((a, b) => a + b, 0) / recent5.length
    : 0;

  // long20Rate10: 最近 10 个 gap 中 >= 20 的比例
  const long20Rate10 = recent10.length > 0
    ? recent10.filter(g => g >= 20).length / recent10.length
    : 0;

  // trend5: 最近 5 个 gap 均值 vs 再往前 5 个 gap 均值
  // 需要至少 10 条历史才有意义
  let trend5: 'shortening' | 'lengthening' | 'flat' | 'unknown';
  if (recent5.length < 5 || prev5.length < 5) {
    trend5 = 'unknown';
  } else {
    const meanRecent = recent5.reduce((a, b) => a + b, 0) / 5;
    const meanPrev = prev5.reduce((a, b) => a + b, 0) / 5;
    // 阈值参考 GPT 研究中的实现
    if (meanRecent < meanPrev * 0.8) {
      trend5 = 'shortening';
    } else if (meanRecent > meanPrev * 1.2) {
      trend5 = 'lengthening';
    } else {
      trend5 = 'flat';
    }
  }

  return { avg5, long20Rate10, trend5 };
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROI 辅助
// ═══════════════════════════════════════════════════════════════════════════════

function makeRoi(bet: number, win: number): ChaseSixRoi {
  const roi = bet > 0 ? ((win - bet) / bet) * 100 : 0;
  return { bet, win, roi };
}

function sumRoi(parts: ChaseSixRoi[]): ChaseSixRoi {
  let bet = 0;
  let win = 0;
  for (const p of parts) {
    bet += p.bet;
    win += p.win;
  }
  return makeRoi(bet, win);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 分组定义
// 一组: 窗口 0-3  (1-6,4-9,7-12,10-15) → 号码 1-15
// 二组: 窗口 3-7  (10-15,13-18,16-21,19-24,22-27) → 号码 10-27
// 三组: 窗口 7-10 (22-27,25-30,28-33,31-36) → 号码 22-36
// 10-15 在一/二组重叠, 22-27 在二/三组重叠 — 分组 ROI 各算各的
// ═══════════════════════════════════════════════════════════════════════════════

const GROUP1_WINDOWS = [0, 1, 2, 3];
const GROUP2_WINDOWS = [3, 4, 5, 6, 7];
const GROUP3_WINDOWS = [7, 8, 9, 10];

// ═══════════════════════════════════════════════════════════════════════════════
// 主分析函数
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * 对历史号码序列做一次完整遍历，产出：
 * - 当前活跃的追6信号（供 UI 信号卡渲染）
 * - 总 ROI + 三组分 ROI
 * - 强信号 / 波浪强信号 / 被过滤强信号的 ROI 切面
 *
 * ## 算法流程
 *
 * 对每一轮号码 v：
 * 1. **结算活跃追打** — 每个活跃追打按 progression 下注；
 *    如果 v 命中窗口，回收 bet*6 并结束追打；未命中则继续（未超轮数限制时）。
 *    0 号永远不命中任何窗口。
 * 2. **检测新信号** — 如果 v 落入某窗口，且该窗口 gap 在 [25,29]，
 *    appearCount >= 5，且没有活跃追打，则成为候选。候选按 gap 降序、
 *    wi 升序排序，取第一个触发新追打。
 *    触发时计算波浪特征（基于该窗口**此前**已完成的 gap 历史）。
 * 3. **更新状态** — 仅当 v !== 0 时：
 *    对每个窗口，如果 v 落入则将该轮 gap 推入 gapHistory（保留最近 10）
 *    并归零 gap、增加 appearCount；否则 gap+1。
 *
 * ## 关于 0 号
 * 0 不更新 gap 和 appearCount，不触发信号，也不命中任何窗口。
 * 但活跃追打中的 0 算一轮未命中。
 *
 * ## 关于波浪过滤
 * 波浪过滤不是"隐藏信号"，而是"标记信号质量"。
 * 所有满足基础条件的信号都会正常展示；其中 isWaveStrong 为 true 的
 * 信号用更深更饱和的配色突出显示。
 */
export function analyzeChaseSix(numbers: readonly RouletteNumber[]): ChaseSixAnalysis {
  const W = CHASE6_WINDOWS;
  const MIN_G = CHASE6_MIN_GAP;
  const MAX_G = CHASE6_MAX_GAP;
  const PROG = CHASE6_PROGRESSION;
  const CHASE_LEN = CHASE6_CHASE_LEN;
  const STRONG_AP = CHASE6_STRONG_APPEARANCES;

  // — 活跃追打内部结构 —
  interface ActiveChase {
    wi: number;
    sr: number;
    isStrong: boolean;
    isWaveQualified: boolean;
  }

  interface PassResult {
    roiByWi: Array<{ bet: number; win: number }>;
    strongRoi: { bet: number; win: number };
    waveStrongRoi: { bet: number; win: number };
    waveFilteredRoi: { bet: number; win: number };
    activeChases: ActiveChase[];
  }

  /**
   * 对号码序列做一次完整遍历。
   *
   * @param allowedWindows - null 表示全 11 窗口；传数组则在候选阶段就过滤，
   *   确保分组独立统计时不会被别组窗口抢信号。
   */
  function runPass(allowedWindows: readonly number[] | null): PassResult {
    const gaps = new Array<number>(W).fill(0);
    const appearCount = new Array<number>(W).fill(0);
    const gapHistory: number[][] = Array.from({ length: W }, () => []);

    const activeChases: ActiveChase[] = [];

    const roiByWi: Array<{ bet: number; win: number }> =
      Array.from({ length: W }, () => ({ bet: 0, win: 0 }));
    let strongRoi = { bet: 0, win: 0 };
    let waveStrongRoi = { bet: 0, win: 0 };
    let waveFilteredRoi = { bet: 0, win: 0 };

    for (let r = 0; r < numbers.length; r++) {
      const v = numbers[r];

      // ── 1. 结算活跃追打 ──
      const surviving: ActiveChase[] = [];
      for (const c of activeChases) {
        const ri = r - c.sr;
        if (ri >= CHASE_LEN) continue;
        const amt = PROG[ri] ?? PROG[PROG.length - 1];

        roiByWi[c.wi].bet += amt;
        if (c.isStrong) {
          strongRoi.bet += amt;
          if (c.isWaveQualified) waveStrongRoi.bet += amt;
          else waveFilteredRoi.bet += amt;
        }

        if (v !== 0 && isInChaseSixWindow(c.wi, v)) {
          const won = amt * 6;
          roiByWi[c.wi].win += won;
          if (c.isStrong) {
            strongRoi.win += won;
            if (c.isWaveQualified) waveStrongRoi.win += won;
            else waveFilteredRoi.win += won;
          }
          continue;
        }

        if (ri + 1 < CHASE_LEN) surviving.push(c);
      }
      activeChases.length = 0;
      for (const c of surviving) activeChases.push(c);

      // ── 2. 检测新信号 ──
      if (v !== 0) {
        const candidates: Array<{ wi: number; gap: number }> = [];
        for (let wi = 0; wi < W; wi++) {
          // 分组独立统计：候选阶段就过滤 allowedWindows
          if (allowedWindows && !allowedWindows.includes(wi)) continue;
          if (
            isInChaseSixWindow(wi, v) &&
            gaps[wi] >= MIN_G &&
            gaps[wi] <= MAX_G &&
            appearCount[wi] >= CHASE6_MIN_APPEARANCES &&
            !activeChases.some(c => c.wi === wi)
          ) {
            candidates.push({ wi, gap: gaps[wi] });
          }
        }

        if (candidates.length > 0) {
          candidates.sort((a, b) => b.gap - a.gap || a.wi - b.wi);
          const sel = candidates[0];
          const isStrong = appearCount[sel.wi] >= STRONG_AP;

          const wave = computeWaveFeatures(gapHistory[sel.wi]);
          const isWaveQualified =
            wave.avg5 <= CHASE6_WAVE_AVG5_MAX &&
            wave.long20Rate10 < CHASE6_WAVE_LONG20_RATE10_MAX;

          activeChases.push({
            wi: sel.wi,
            sr: r + 1,
            isStrong,
            isWaveQualified,
          });
        }
      }

      // ── 3. 更新 gap 跟踪 ──
      if (v !== 0) {
        for (let wi = 0; wi < W; wi++) {
          if (isInChaseSixWindow(wi, v)) {
            gapHistory[wi].unshift(gaps[wi]);
            if (gapHistory[wi].length > MAX_GAP_HISTORY) {
              gapHistory[wi].length = MAX_GAP_HISTORY;
            }
            gaps[wi] = 0;
            appearCount[wi] += 1;
          } else {
            gaps[wi] += 1;
          }
        }
      }
    }

    return { roiByWi, strongRoi, waveStrongRoi, waveFilteredRoi, activeChases };
  }

  // ── 全局：全 11 窗口，产出活跃信号 + 总 ROI ──
  const global = runPass(null);

  const activeSignals: ChaseSixActiveSignal[] = [];
  for (const c of global.activeChases) {
    const roundsPlayed = Math.max(0, numbers.length - c.sr);
    const nr = roundsPlayed + 1;
    if (nr > CHASE_LEN) continue;
    const ws = chaseSixWindowStart(c.wi);
    const we = chaseSixWindowEnd(c.wi);
    activeSignals.push({
      wi: c.wi,
      windowName: `${ws}-${we}`,
      round: nr,
      betAmt: PROG[nr - 1] ?? PROG[PROG.length - 1],
      isNew: nr === 1,
      chaseLen: CHASE_LEN,
      isStrong: c.isStrong,
      isWaveStrong: c.isStrong && c.isWaveQualified,
    });
  }

  const totalRoi = sumRoi(global.roiByWi.map(p => makeRoi(p.bet, p.win)));

  // ── 分组：各自独立跑一趟，候选阶段就限制 allowedWindows ──
  function groupPass(wis: readonly number[]): ChaseSixRoi {
    const p = runPass(wis);
    return sumRoi(wis.map(wi => makeRoi(p.roiByWi[wi].bet, p.roiByWi[wi].win)));
  }

  return {
    activeSignals,
    totalRoi,
    group1Roi: groupPass(GROUP1_WINDOWS),
    group2Roi: groupPass(GROUP2_WINDOWS),
    group3Roi: groupPass(GROUP3_WINDOWS),
    strongRoi: makeRoi(global.strongRoi.bet, global.strongRoi.win),
    waveStrongRoi: makeRoi(global.waveStrongRoi.bet, global.waveStrongRoi.win),
    waveFilteredRoi: makeRoi(global.waveFilteredRoi.bet, global.waveFilteredRoi.win),
  };
}
