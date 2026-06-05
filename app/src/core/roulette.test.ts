import { describe, expect, it } from "vitest";
import { calculateColRowCompare } from "./colRowStats";
import { calculateFrequencyStats } from "./frequencyStats";
import { formatNumbers, parseNumbersText } from "./numberText";
import { analyzePreferredNumber } from "./preferredNumber";
import {
  REPEAT_TIER_AGGRESSIVE,
  REPEAT_TIER_CORE,
  analyzeRepeatNumber,
  analyzeShortRepeatNumber,
} from "./repeatNumber";
import { getColumnIndexes, getGroupIndex, getNumberColor, getNumberColRows, getRowIndex, type RouletteNumber } from "./roulette";
import {
  calculateColRowDistances,
  calculateColumnDistances,
  calculateSnapshotStats,
} from "./stats";

describe("roulette rules", () => {
  it("matches the legacy red and black mapping", () => {
    expect(getNumberColor(0)).toBe("green");
    expect(getNumberColor(1)).toBe("red");
    expect(getNumberColor(2)).toBe("black");
    expect(getNumberColor(36)).toBe("red");
  });

  it("maps numbers to the legacy group and row indexes", () => {
    expect(getGroupIndex(1)).toBe(0);
    expect(getGroupIndex(13)).toBe(1);
    expect(getGroupIndex(25)).toBe(2);

    expect(getRowIndex(3)).toBe(0);
    expect(getRowIndex(2)).toBe(1);
    expect(getRowIndex(1)).toBe(2);
    expect(getNumberColRows(1)).toEqual([0, 5]);
  });

  it("maps numbers to legacy six-number column windows", () => {
    expect(getColumnIndexes(1)).toEqual([0]);
    expect(getColumnIndexes(4)).toEqual([0, 1]);
    expect(getColumnIndexes(33)).toEqual([10, 9]);
    expect(getColumnIndexes(36)).toEqual([10]);
  });

  it("calculates a basic snapshot", () => {
    const stats = calculateSnapshotStats([1, 2, 3, 0], 100);

    expect(stats.total).toBe(4);
    expect(stats.zeroCount).toBe(1);
    expect(stats.bisections.red).toBe(2);
    expect(stats.bisections.black).toBe(1);
    expect(stats.colRows.find((item) => item.label === "一组")?.count).toBe(3);
  });

  it("calculates consecutive col/row distances", () => {
    const distances = calculateColRowDistances([1]);

    expect(distances.find((item) => item.label === "一组")?.distance).toBe(0);
    expect(distances.find((item) => item.label === "3行")?.distance).toBe(0);
    expect(distances.find((item) => item.label === "二组")?.distance).toBe(1);
  });

  it("calculates consecutive six-number column distances", () => {
    const columns = calculateColumnDistances([1]);

    expect(columns.find((item) => item.label === "1-6")?.distance).toBe(0);
    expect(columns.find((item) => item.label === "4-9")?.distance).toBe(1);
  });

  it("parses and formats number text", () => {
    expect(parseNumbersText("1, 2，3、0").numbers).toEqual([1, 2, 3, 0]);
    expect(parseNumbersText("1, 37, x").invalidTokens).toEqual(["37", "x"]);
    expect(formatNumbers([1, 2, 0])).toBe("1,2,0");
  });
  it("uses the provided frequency scopes", () => {
    const stats = calculateFrequencyStats([1, 2, 3, 4, 5, 6, 7, 8, 9], [3, 5]);

    expect(stats.frequencies).toHaveLength(8);
    expect(stats.frequencies[0]).toHaveLength(2);
    expect(stats.frequencies[0][0]).toHaveLength(7);
    expect(stats.frequencies[0][1]).toHaveLength(5);
  });

  it("limits col-row compare results by scope", () => {
    const rawDistances = Array.from({ length: 8 }, () => [] as number[]);
    rawDistances[0] = [20, 8, 4];

    const narrow = calculateColRowCompare(rawDistances, 10, 0, 5);
    const wide = calculateColRowCompare(rawDistances, 20, 0, 5);

    expect(narrow[0]).toMatchObject({ succeeded: 1, failed: 0 });
    expect(wide[0]).toMatchObject({ succeeded: 1, failed: 1 });
  });

  it("detects repeat-number signals and core repeat stats", () => {
    const numbers = [18, 7, 1, 7, 18, 3, 7, 4, 5, 6, 8, 9, 10, 11, 12, 18, 18];
    const stats = analyzeRepeatNumber(numbers);

    expect(stats.aggressiveRoi.signals).toBe(1);
    expect(stats.aggressiveRoi.hits).toBe(1);
    expect(stats.aggressiveRoi.roi).toBe(3500);
    expect(stats.coreRoi.signals).toBe(1);
    expect(stats.activeSignals).toHaveLength(0);
  });

  it("uses full repeat history when ROI starts later", () => {
    const numbers = [18, 7, 1, 7, 2, 3, 7, 4, 5, 6, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 18, 18];
    const stats = analyzeRepeatNumber(numbers, 20);

    expect(stats.aggressiveRoi.signals).toBe(1);
    expect(stats.aggressiveRoi.hits).toBe(1);
    expect(stats.coreRoi.signals).toBe(1);
    expect(stats.coreRoi.hits).toBe(1);
  });

  it("detects short repeat signals with a two-round chase", () => {
    const numbers = [18, 1, 2, 18, 3, 4, 5, 18, 6, 18];
    const stats = analyzeShortRepeatNumber(numbers);

    expect(stats.totalRoi.signals).toBe(1);
    expect(stats.totalRoi.hits).toBe(1);
    expect(stats.totalRoi.bet).toBe(2);
    expect(stats.totalRoi.win).toBe(36);
    expect(stats.activeSignals).toHaveLength(0);
  });

  it("counts short repeat signals when a delayed ROI window includes chase bets", () => {
    const numbers = [18, 1, 2, 18, 3, 4, 5, 18, 6, 18];
    const stats = analyzeShortRepeatNumber(numbers, 9);

    expect(stats.totalRoi.signals).toBe(1);
    expect(stats.totalRoi.bet).toBe(1);
    expect(stats.totalRoi.hits).toBe(1);
    expect(stats.totalRoi.win).toBe(36);
  });

  it("separates core and aggressive short repeat tiers", () => {
    const gap2 = [18, 1, 18, 2, 3, 18, 4, 18];
    const gap2Core = analyzeShortRepeatNumber(gap2, 0, { tier: REPEAT_TIER_CORE });
    const gap2Aggressive = analyzeShortRepeatNumber(gap2, 0, { tier: REPEAT_TIER_AGGRESSIVE });

    expect(gap2Core.totalRoi.signals).toBe(0);
    expect(gap2Aggressive.totalRoi.signals).toBe(0);

    const gap3 = [18, 1, 2, 18, 3, 4, 5, 18, 6, 18];
    const gap3Core = analyzeShortRepeatNumber(gap3, 0, { tier: REPEAT_TIER_CORE });

    expect(gap3Core.totalRoi.signals).toBe(1);
    expect(gap3Core.totalRoi.hits).toBe(1);
  });

  it("separates core and aggressive long repeat tiers", () => {
    const core = [18, 7, 1, 7, 18, 3, 7, 4, 5, 6, 8, 9, 10, 11, 12, 18, 18];
    const coreStats = analyzeRepeatNumber(core, 0, { tier: REPEAT_TIER_CORE });

    expect(coreStats.coreRoi.signals).toBe(1);
    expect(coreStats.coreRoi.hits).toBe(1);

    const aggressive = [18, 7, 1, 7, 18, 3, 7, 4, 5, 6, 8, 9, 10, 18, 18];
    const aggressiveCore = analyzeRepeatNumber(aggressive, 0, { tier: REPEAT_TIER_CORE });
    const aggressiveStats = analyzeRepeatNumber(aggressive, 0, { tier: REPEAT_TIER_AGGRESSIVE });

    expect(aggressiveCore.coreRoi.signals).toBe(0);
    expect(aggressiveStats.aggressiveRoi.signals).toBe(1);
    expect(aggressiveStats.aggressiveRoi.hits).toBe(1);
  });

  it("uses a rolling short-repeat environment filter", () => {
    const numbers = Array.from({ length: 106 }, (_, index) => ((index % 36) + 1) as RouletteNumber);
    numbers[0] = 18;
    numbers[3] = 18;
    numbers[6] = 18;
    numbers[10] = 19;
    numbers[13] = 19;
    numbers[16] = 19;
    numbers[20] = 20;
    numbers[23] = 20;
    numbers[26] = 20;
    numbers[92] = 7;
    numbers[96] = 7;
    numbers[100] = 7;
    numbers[104] = 7;
    numbers[105] = 7;

    const blocked = analyzeShortRepeatNumber(numbers, 100, {
      tier: REPEAT_TIER_CORE,
      requireInitialFilter: true,
    });

    expect(blocked.environmentFilter.g2Count).toBeGreaterThan(blocked.environmentFilter.g3Count);
    expect(blocked.totalRoi.bet).toBe(0);
  });

  it("starts preferred-number bets after the paper Markov gate passes", () => {
    const numbers = Array.from({ length: 90 }, (_, index) => (index % 2 === 0 ? 1 : 2) as RouletteNumber);
    const stats = analyzePreferredNumber(numbers);

    expect(stats.totalRoi.signals).toBe(52);
    expect(stats.totalRoi.bet).toBe(104);
    expect(stats.totalRoi.hits).toBe(52);
    expect(stats.totalRoi.win).toBe(1872);
    expect(stats.activeSignals[0]?.numbers).toContain(1);
    expect(stats.activeSignals[0]?.zoneHits).toBeGreaterThanOrEqual(8);
  });

  it("blocks preferred-number bets when the wheel zone is not active", () => {
    const cycle: RouletteNumber[] = [0, 2, 13, 10, 20, 29];
    const numbers = Array.from({ length: 90 }, (_, index) => cycle[index % cycle.length]);
    const stats = analyzePreferredNumber(numbers);

    expect(stats.totalRoi.signals).toBe(0);
    expect(stats.totalRoi.bet).toBe(0);
    expect(stats.totalRoi.hits).toBe(0);
    expect(stats.activeSignals).toHaveLength(0);
  });

  it("pauses preferred-number betting for three spins after a miss", () => {
    const numbers = [
      ...Array.from({ length: 50 }, (_, index) => (index % 2 === 0 ? 1 : 2) as RouletteNumber),
      3 as RouletteNumber,
      ...Array.from({ length: 10 }, (_, index) => (index % 2 === 0 ? 1 : 2) as RouletteNumber),
    ];
    const stats = analyzePreferredNumber(numbers);

    expect(stats.totalRoi.signals).toBe(20);
    expect(stats.totalRoi.bet).toBe(40);
    expect(stats.totalRoi.hits).toBe(19);
    expect(stats.totalRoi.win).toBe(684);
  });
});

import { analyzeMerge } from "./numberMerge";

describe("numberMerge", () => {
  it("exact overlap", () => {
    const a = [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20];
    const b = [11,12,13,14,15,16,17,18,19,20,21,22,23,24,25];
    const r = analyzeMerge(a, b);
    expect(r.found).toBe(true);
    expect(r.type).toBe("overlap");
  });
  it("containment A in B", () => {
    const r = analyzeMerge(
      [5,6,7,8,9,10,11,12,13,14,15],
      [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]);
    expect(r.type).toBe("contained");
  });
  it("97pct match rate ok", () => {
    // 35-number overlap with 1 mismatch = 34/35 = 97.1% >= 97% → OK
    const a = Array.from({length:50},(_,i)=>i+1);
    const b = [36,37,38,39,99,41,42,43,44,45,46,47,48,49,50,51,52,53,54,55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70];
    expect(analyzeMerge(a, b).found).toBe(true);
  });
  it("no overlap", () => {
    expect(analyzeMerge([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15], [20,21,22,23,24,25,26,27,28,29,30,31,32,33,34]).found).toBe(false);
  });
  it("too short", () => {
    expect(analyzeMerge([1,2,3], [1,2,3]).found).toBe(false);
  });
});
