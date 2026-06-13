import { getGroupIndex, getRowIndex, type RouletteNumber } from "./roulette";

const PROGRESSION_1 = [1] as const;
const PROGRESSION_12 = [1, 2] as const;
const PROGRESSION_124 = [1, 2, 4] as const;
// 三组的第四口历史上适合降斜率追，避免直接跳到 8 带来过大的回撤。
const PROGRESSION_1235 = [1, 2, 3, 5] as const;
const PROGRESSION_1248 = [1, 2, 4, 8] as const;
const STRONG_GROUP_CONCENTRATION = 0.55;

export const QUALITY_124_PROGRESSION = PROGRESSION_124;

export const QUALITY_124_TIER_ORDER = [
  "group1",
  "group2",
  "group2tempo",
  "group3",
  "row1",
  "row2",
  "row3",
] as const;

export type Quality124Tier = (typeof QUALITY_124_TIER_ORDER)[number];
export type Quality124Kind = "group" | "row";

type Progression = readonly number[];
type TempoBand = "unknown" | "fast" | "medium_fast" | "medium" | "slow";

export const QUALITY_124_TIER_META: Record<Quality124Tier, { label: string; stars: number; description: string }> = {
  group1: { label: "一组", stars: 1, description: "一组空4，近12口节奏活跃，只打一口" },
  group2: { label: "二组", stars: 3, description: "二组空4，近18口核心区高度集中，打1-2-4" },
  group2tempo: { label: "二组短追", stars: 1, description: "二组空3，近18口排除fast，打1-2" },
  group3: { label: "三组", stars: 2, description: "三组空3/4，近18口高度集中且排除fast，打1-2-3-5" },
  row1: { label: "1行", stars: 1, description: "1行空3，近12口中高速，只打一口" },
  row2: { label: "2行", stars: 2, description: "2行空3，近24口集中，打1-2-4" },
  row3: { label: "3行", stars: 2, description: "3行空3，近37口中慢集中，打1-2-4-8" },
};

export interface Quality124Signal {
  kind: Quality124Kind;
  ci: 0 | 1 | 2;
  label: string;
  tier: Quality124Tier;
  tierLabel: string;
  stars: number;
  entryAfter: number;
  round: number;
  chaseLen: number;
  betAmt: number;
  progression: readonly number[];
  zoneRate: number;
  concentration: number;
  tempoBand: TempoBand;
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

interface EntityState {
  kind: Quality124Kind;
  ci: 0 | 1 | 2;
  missCount: number;
  seen: boolean;
  gaps: number[];
  active: Partial<Record<number, ActiveQuality124>>;
}

interface RuleSelection {
  tier: Quality124Tier;
  progression: Progression;
  zone: number;
  conc: number;
  band: TempoBand;
}

interface ActiveQuality124 extends RuleSelection {
  firstBetIndex: number;
  kind: Quality124Kind;
  ci: 0 | 1 | 2;
  entryAfter: number;
  roundIndex: number;
  bet: number;
}

function emptyRoi(): Quality124Roi {
  return { signals: 0, bet: 0, win: 0, hits: 0, roi: 0 };
}

function makeTierRois(): Record<Quality124Tier, Quality124Roi> {
  return Object.fromEntries(QUALITY_124_TIER_ORDER.map((tier) => [tier, emptyRoi()])) as Record<Quality124Tier, Quality124Roi>;
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

function zoneRate(gaps: readonly number[], entryAfter: number, window: number, zoneLen: number): number {
  const recent = gaps.slice(-window);
  if (recent.length === 0) return 0;
  const hi = entryAfter + zoneLen - 1;
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

function tempoBand(gaps: readonly number[]): TempoBand {
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

function isNotFast(band: TempoBand): boolean {
  return band !== "fast" && band !== "unknown";
}

function isMediumFast(band: TempoBand): boolean {
  return band === "medium_fast" || band === "fast";
}

function isMediumSlow(band: TempoBand): boolean {
  return band === "medium" || band === "slow";
}

function progressionAmount(progression: Progression, roundIndex: number): number {
  return progression[Math.min(roundIndex, progression.length - 1)] ?? 1;
}

function selectRule(state: EntityState, entryAfter: number): RuleSelection | null {
  const band = tempoBand(state.gaps);

  if (state.kind === "group") {
    if (state.ci === 0 && entryAfter === 4 && state.gaps.length >= 12) {
      // zoneLen 是历史节奏观察区间，不一定等于真实追轮数；一组只打一口，但观察 gap 4-7 的活跃度。
      const zone = zoneRate(state.gaps, entryAfter, 12, 4);
      const conc = concentration(state.gaps, 12);
      if (zone >= 0.2 && conc >= 0.45) {
        return { tier: "group1", progression: PROGRESSION_1, zone, conc, band };
      }
    }

    if ((state.ci === 1 || state.ci === 2) && state.gaps.length >= 18) {
      const zone = zoneRate(state.gaps, entryAfter, 18, 3);
      const conc = concentration(state.gaps, 18);
      const notFast = isNotFast(band);

      if (state.ci === 1 && entryAfter === 4 && zone >= 0.25 && conc >= STRONG_GROUP_CONCENTRATION) {
        return { tier: "group2", progression: PROGRESSION_124, zone, conc, band };
      }
      if (state.ci === 2 && (entryAfter === 3 || entryAfter === 4) && zone >= 0.25 && conc >= STRONG_GROUP_CONCENTRATION && notFast) {
        return { tier: "group3", progression: PROGRESSION_1235, zone, conc, band };
      }
      if (state.ci === 1 && entryAfter === 3 && zone >= 0.25 && conc >= 0.45 && notFast) {
        return { tier: "group2tempo", progression: PROGRESSION_12, zone, conc, band };
      }
    }
  }

  if (state.kind === "row") {
    if (state.ci === 0 && entryAfter === 3 && state.gaps.length >= 12) {
      // 1行也是只打一口，但用 gap 3-6 判断短窗口内是否正在向当前距离集中。
      const zone = zoneRate(state.gaps, entryAfter, 12, 4);
      const conc = concentration(state.gaps, 12);
      if (zone >= 0.3 && conc >= 0.35 && isMediumFast(band)) {
        return { tier: "row1", progression: PROGRESSION_1, zone, conc, band };
      }
    }

    if (state.ci === 1 && entryAfter === 3 && state.gaps.length >= 24) {
      const zone = zoneRate(state.gaps, entryAfter, 24, 3);
      const conc = concentration(state.gaps, 24);
      if (zone >= 0.25 && conc >= 0.55) {
        return { tier: "row2", progression: PROGRESSION_124, zone, conc, band };
      }
    }

    if (state.ci === 2 && entryAfter === 3 && state.gaps.length >= 37) {
      const zone = zoneRate(state.gaps, entryAfter, 37, 4);
      const conc = concentration(state.gaps, 37);
      if (zone >= 0.2 && conc >= 0.55 && isMediumSlow(band)) {
        return { tier: "row3", progression: PROGRESSION_1248, zone, conc, band };
      }
    }
  }

  return null;
}

function entityIndex(kind: Quality124Kind, value: RouletteNumber): 0 | 1 | 2 | null {
  return kind === "group" ? getGroupIndex(value) : getRowIndex(value);
}

function entityLabel(kind: Quality124Kind, ci: 0 | 1 | 2): string {
  if (kind === "group") return ["一组", "二组", "三组"][ci];
  return ["1行", "2行", "3行"][ci];
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
  const meta = QUALITY_124_TIER_META[active.tier];
  const betAmt = progressionAmount(active.progression, active.roundIndex);
  return {
    kind: active.kind,
    ci: active.ci,
    label: entityLabel(active.kind, active.ci),
    tier: active.tier,
    tierLabel: meta.label,
    stars: meta.stars,
    entryAfter: active.entryAfter,
    round: active.roundIndex + 1,
    chaseLen: active.progression.length,
    betAmt,
    progression: active.progression,
    zoneRate: active.zone,
    concentration: active.conc,
    tempoBand: active.band,
  };
}

function createStates(): EntityState[] {
  return (["group", "row"] as const).flatMap((kind) =>
    ([0, 1, 2] as const).map((ci) => ({
      kind,
      ci,
      missCount: 0,
      seen: false,
      gaps: [],
      active: {},
    })),
  );
}

export function analyzeQuality124(numbers: readonly RouletteNumber[], roiStartIndex = 0): Quality124Analysis {
  const states = createStates();
  const total = emptyRoi();
  const tierRois = makeTierRois();

  for (let index = 0; index < numbers.length; index += 1) {
    const value = numbers[index];

    for (const state of states) {
      const hit = entityIndex(state.kind, value) === state.ci;
      for (const entryText of Object.keys(state.active)) {
        const entryAfter = Number(entryText);
        const active = state.active[entryAfter];
        if (!active) continue;
        const amount = progressionAmount(active.progression, active.roundIndex);
        active.bet += amount;
        if (hit) {
          addResult(active, true, amount, roiStartIndex, total, tierRois);
          delete state.active[entryAfter];
          continue;
        }
        active.roundIndex += 1;
        if (active.roundIndex >= active.progression.length) {
          addResult(active, false, amount, roiStartIndex, total, tierRois);
          delete state.active[entryAfter];
        }
      }
    }

    for (const state of states) {
      const hit = entityIndex(state.kind, value) === state.ci;
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
      const selected = selectRule(state, entryAfter);
      if (!selected) continue;
      state.active[entryAfter] = {
        firstBetIndex: index + 1,
        kind: state.kind,
        ci: state.ci,
        tier: selected.tier,
        progression: selected.progression,
        entryAfter,
        roundIndex: 0,
        bet: 0,
        zone: selected.zone,
        conc: selected.conc,
        band: selected.band,
      };
    }
  }

  return {
    activeSignals: states
      .flatMap((state) => Object.values(state.active).filter((active): active is ActiveQuality124 => Boolean(active)).map(toSignal))
      // Active cards emphasize stronger/starred signals first; detail ROI tables use QUALITY_124_TIER_ORDER.
      .sort((a, b) => b.stars - a.stars || a.kind.localeCompare(b.kind) || a.ci - b.ci || b.entryAfter - a.entryAfter),
    totalRoi: settleRoi(total),
    tierRois: Object.fromEntries(
      QUALITY_124_TIER_ORDER.map((tier) => [tier, settleRoi(tierRois[tier])]),
    ) as Record<Quality124Tier, Quality124Roi>,
  };
}
