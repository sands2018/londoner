import type { RouletteNumber } from "./roulette";

export const QUALITY_124_PROGRESSION = [1, 2, 4] as const;

export type Quality124Tier = "low" | "medium" | "high" | "ultra";

export interface Quality124Signal {
  ci: 1 | 2;
  label: string;
  tier: Quality124Tier;
  tierLabel: string;
  stars: number;
  entryAfter: number;
  round: number;
  chaseLen: number;
  betAmt: number;
  zoneRate: number;
  concentration: number;
  tempoBand: string;
}

export interface Quality124Roi {
  signals: number;
  bet: number;
  win: number;
  hits: number;
  roi: number;
}

export interface Quality124Analysis {
  activeSignals: Quality124Signal[];
  totalRoi: Quality124Roi;
  tierRois: Record<Quality124Tier, Quality124Roi>;
}

interface GroupState {
  ci: 0 | 1 | 2;
  missCount: number;
  seen: boolean;
  gaps: number[];
  active: Partial<Record<number, ActiveQuality124>>;
}

interface ActiveQuality124 {
  firstBetIndex: number;
  ci: 1 | 2;
  tier: Quality124Tier;
  entryAfter: number;
  roundIndex: number;
  bet: number;
  zoneRate: number;
  concentration: number;
  tempoBand: string;
}

const tierLabels: Record<Quality124Tier, string> = {
  low: "低频",
  medium: "中频",
  high: "高频",
  ultra: "超高频",
};

const tierStars: Record<Quality124Tier, number> = {
  low: 3,
  medium: 2,
  high: 1,
  ultra: 0,
};

function emptyRoi(): Quality124Roi {
  return { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 };
}

function getGroup(value: RouletteNumber): 0 | 1 | 2 | null {
  if (value === 0) return null;
  return Math.floor((value - 1) / 12) as 0 | 1 | 2;
}

function avg(values: readonly number[]): number {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function variance(values: readonly number[]): number {
  if (values.length < 2) return 0;
  const mean = avg(values);
  return values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
}

function zoneRate(gaps: readonly number[], entryAfter: number, window: number): number {
  const recent = gaps.slice(-window);
  if (recent.length === 0) return 0;
  const hi = entryAfter + QUALITY_124_PROGRESSION.length - 1;
  return recent.filter((gap) => gap >= entryAfter && gap <= hi).length / recent.length;
}

function concentration(gaps: readonly number[], window: number): number {
  const recent = gaps.slice(-window);
  if (recent.length === 0) return 0;
  const counts = new Map<number, number>();
  for (const gap of recent) counts.set(gap, (counts.get(gap) ?? 0) + 1);
  let mode = 0;
  let modeCount = -1;
  for (const [gap, count] of counts) {
    if (count > modeCount || (count === modeCount && gap < mode)) {
      mode = gap;
      modeCount = count;
    }
  }
  return recent.filter((gap) => Math.abs(gap - mode) <= 1).length / recent.length;
}

function tempoBand(gaps: readonly number[]): string {
  if (gaps.length < 6) return "unknown";

  const recent6 = gaps.slice(-6);
  const recent12 = gaps.slice(-12);
  const previous6 = gaps.slice(-12, -6);
  const mean6 = avg(recent6);
  const mean12 = avg(recent12);
  const prior6 = avg(previous6);
  const delta6 = avg(recent6.slice(1).map((value, index) => Math.abs(value - recent6[index])));
  const var6 = variance(recent6);

  const frequency = clamp((3.2 - mean6) / 2.7);
  const churn = clamp(delta6 / 2.8);
  const compression = previous6.length > 0 ? clamp((prior6 - mean6) / 2.5) : 0;
  const dispersion = clamp(var6 / 6);
  const score = 0.42 * frequency + 0.26 * churn + 0.22 * compression + 0.1 * dispersion;

  if (score >= 0.68) return "fast";
  if (score >= 0.48) return "medium_fast";
  if (score <= 0.24 || mean12 >= 3.4) return "slow";
  return "medium";
}

function selectTier(state: GroupState, entryAfter: number): { tier: Quality124Tier; zone: number; conc: number; band: string } | null {
  if (state.ci !== 1 && state.ci !== 2) return null;
  if (state.gaps.length < 18) return null;

  const zone = zoneRate(state.gaps, entryAfter, 18);
  const conc = concentration(state.gaps, 18);
  const band = tempoBand(state.gaps);
  const notFast = band !== "fast" && band !== "unknown";

  // 四档 124 使用优先级归类，避免同一个入场点在 UI 中重复显示。
  if (state.ci === 1 && entryAfter === 4 && zone >= 0.25 && conc >= 0.45) {
    return { tier: "low", zone, conc, band };
  }
  if (state.ci === 2 && (entryAfter === 3 || entryAfter === 4) && zone >= 0.25 && conc >= 0.45 && notFast) {
    return { tier: "medium", zone, conc, band };
  }
  if ((entryAfter === 3 || entryAfter === 4) && zone >= 0.25 && conc >= 0.45 && notFast) {
    return { tier: "high", zone, conc, band };
  }
  if (entryAfter === 3 && zone >= 0.2 && conc >= 0.45 && notFast) {
    return { tier: "ultra", zone, conc, band };
  }
  return null;
}

function settleRoi(roi: Quality124Roi): Quality124Roi {
  return { ...roi, roi: roi.bet > 0 ? ((roi.win - roi.bet) / roi.bet) * 100 : 0 };
}

function addResult(
  active: ActiveQuality124,
  hit: boolean,
  amount: number,
  roiStartIndex: number,
  total: Quality124Roi,
  tierRois: Record<Quality124Tier, Quality124Roi>,
): void {
  if (active.firstBetIndex < roiStartIndex) return;
  total.signals += 1;
  total.bet += active.bet;
  tierRois[active.tier].signals += 1;
  tierRois[active.tier].bet += active.bet;
  if (hit) {
    const payout = amount * 3;
    total.win += payout;
    total.hits += 1;
    tierRois[active.tier].win += payout;
    tierRois[active.tier].hits += 1;
  }
}

function toSignal(active: ActiveQuality124): Quality124Signal {
  return {
    ci: active.ci,
    label: active.ci === 1 ? "二组" : "三组",
    tier: active.tier,
    tierLabel: tierLabels[active.tier],
    stars: tierStars[active.tier],
    entryAfter: active.entryAfter,
    round: active.roundIndex + 1,
    chaseLen: QUALITY_124_PROGRESSION.length,
    betAmt: QUALITY_124_PROGRESSION[active.roundIndex] ?? QUALITY_124_PROGRESSION[QUALITY_124_PROGRESSION.length - 1],
    zoneRate: active.zoneRate,
    concentration: active.concentration,
    tempoBand: active.tempoBand,
  };
}

export function analyzeQuality124(numbers: readonly RouletteNumber[], roiStartIndex = 0): Quality124Analysis {
  const states: GroupState[] = [
    { ci: 0, missCount: 0, seen: false, gaps: [], active: {} },
    { ci: 1, missCount: 0, seen: false, gaps: [], active: {} },
    { ci: 2, missCount: 0, seen: false, gaps: [], active: {} },
  ];
  const total = emptyRoi();
  const tierRois: Record<Quality124Tier, Quality124Roi> = {
    low: emptyRoi(),
    medium: emptyRoi(),
    high: emptyRoi(),
    ultra: emptyRoi(),
  };

  for (let index = 0; index < numbers.length; index += 1) {
    const group = getGroup(numbers[index]);

    for (const state of states) {
      const hit = group === state.ci;
      for (const entryText of Object.keys(state.active)) {
        const entryAfter = Number(entryText);
        const active = state.active[entryAfter];
        if (!active) continue;
        const amount = QUALITY_124_PROGRESSION[active.roundIndex];
        active.bet += amount;
        if (hit) {
          addResult(active, true, amount, roiStartIndex, total, tierRois);
          delete state.active[entryAfter];
          continue;
        }
        active.roundIndex += 1;
        if (active.roundIndex >= QUALITY_124_PROGRESSION.length) {
          addResult(active, false, amount, roiStartIndex, total, tierRois);
          delete state.active[entryAfter];
        }
      }
    }

    for (const state of states) {
      const hit = group === state.ci;
      if (hit) {
        if (state.seen) state.gaps.push(state.missCount);
        state.missCount = 0;
        state.seen = true;
      } else if (state.seen) {
        state.missCount += 1;
      }
    }

    for (const state of states) {
      if (!state.seen) continue;
      const entryAfter = state.missCount;
      if (entryAfter < 3 || entryAfter > 4 || state.active[entryAfter]) continue;
      const selected = selectTier(state, entryAfter);
      if (!selected) continue;
      state.active[entryAfter] = {
        firstBetIndex: index + 1,
        ci: state.ci as 1 | 2,
        tier: selected.tier,
        entryAfter,
        roundIndex: 0,
        bet: 0,
        zoneRate: selected.zone,
        concentration: selected.conc,
        tempoBand: selected.band,
      };
    }
  }

  return {
    activeSignals: states
      .flatMap((state) => Object.values(state.active).filter((active): active is ActiveQuality124 => Boolean(active)).map(toSignal))
      .sort((a, b) => b.stars - a.stars || b.entryAfter - a.entryAfter || a.ci - b.ci),
    totalRoi: settleRoi(total),
    tierRois: {
      low: settleRoi(tierRois.low),
      medium: settleRoi(tierRois.medium),
      high: settleRoi(tierRois.high),
      ultra: settleRoi(tierRois.ultra),
    },
  };
}
