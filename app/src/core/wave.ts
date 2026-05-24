/**
 * 波浪分析 — 追踪行组gap分布峰值的变化趋势
 * 独立模块, 供各预测算法使用
 */

import { getNumberColRows, type ColRowIndex } from "./roulette";
import type { RouletteNumber } from "./roulette";

const SMA_WINDOW = 5;  // SMA平滑窗口(峰值采样数)
const PEAK_SAMPLE = 3;  // 每隔几个gap采样一次峰值

/** 提取gap序列 */
export function extractGaps(numbers: readonly RouletteNumber[], ci: number): number[] {
  const gaps: number[] = [];
  let last = -1;
  for (let r = 0; r < numbers.length; r++) {
    const value = numbers[r];
    if (value === 0) continue;
    if (!getNumberColRows(value).map((h) => h as number).includes(ci)) continue;
    if (last >= 0) gaps.push(r - last - 1);
    last = r;
  }
  return gaps;
}

/** 峰值分布统计 (仅看k=1-4) */
export interface PeakStats {
  peak: number;       // 峰值k (1-4)
  conc: number;       // 峰值±1集中度 (0-1)
  zoneLen: number;    // 区间宽度 (2-3)
  sma: number;        // 峰值移动平均 (平滑后的趋势值)
}

export function computePeakStats(gaps: number[], windowGaps: number = 20): PeakStats | null {
  const recent = gaps.slice(-windowGaps);
  if (recent.length < 8) return null;

  const counts = [0, 0, 0, 0, 0, 0];
  let total = 0;
  for (const g of recent) {
    if (g >= 1 && g <= 6) { counts[g - 1] += 1; total += 1; }
  }
  if (total < 5) return null;

  let peak = 1, peakV = 0;
  for (let i = 0; i < 4; i++) { if (counts[i] > peakV) { peakV = counts[i]; peak = i + 1; } }
  if (peakV === 0) return null;

  const lo = Math.max(1, peak - 1);
  const hi = Math.min(6, peak + 1);
  let inZone = 0;
  for (let i = lo - 1; i < hi; i++) inZone += counts[i];

  const sma = computePeakSma(gaps);

  return { peak, conc: inZone / total, zoneLen: hi - lo + 1, sma };
}

/** 计算峰值的移动平均 (反映波浪趋势) */
export function computePeakSma(gaps: number[]): number {
  const peaks: number[] = [];
  for (let i = 8; i <= gaps.length; i += PEAK_SAMPLE) {
    const counts = [0, 0, 0, 0, 0, 0];
    let total = 0;
    for (let j = Math.max(0, i - 20); j < i; j++) {
      const g = gaps[j];
      if (g >= 1 && g <= 6) { counts[g - 1] += 1; total += 1; }
    }
    if (total >= 5) {
      let p = 1, pv = 0;
      for (let k = 0; k < 4; k++) { if (counts[k] > pv) { pv = counts[k]; p = k + 1; } }
      peaks.push(p);
    }
  }
  const recent = peaks.slice(-SMA_WINDOW);
  return recent.length > 0 ? recent.reduce((a, b) => a + b, 0) / recent.length : 1;
}

/** 波浪恢复状态 */
export interface WaveRecoveryState {
  paused: boolean;
  failSma: number;
  failRound: number;
  phase: 0 | 1;  // 0=等上升, 1=等回落
}

/** 波浪恢复参数 */
export const WAVE_RISE = 0.5;
export const WAVE_MIN_RECOVER = 30;

/** 检查波浪恢复: 返回true表示应该解禁 */
export function checkWaveRecovery(
  state: WaveRecoveryState,
  gaps: number[],
  currentRound: number,
): boolean {
  const curSma = computePeakSma(gaps);
  if (state.phase === 0) {
    if (curSma >= state.failSma + WAVE_RISE) {
      state.phase = 1;
    }
    return false;
  }
  // phase === 1: 等回落
  if (curSma <= state.failSma) {
    const waited = currentRound - state.failRound;
    if (waited >= WAVE_MIN_RECOVER) {
      return true;
    }
    // 不够30轮, 重置等下一波
    state.phase = 0;
    state.failSma = curSma;
    state.failRound = currentRound;
  }
  return false;
}

/** 创建初始恢复状态 */
export function createRecoveryState(): WaveRecoveryState {
  return { paused: false, failSma: 0, failRound: -1, phase: 0 };
}
