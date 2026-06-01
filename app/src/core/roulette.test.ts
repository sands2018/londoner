import { describe, expect, it } from "vitest";
import { calculateColRowCompare } from "./colRowStats";
import { calculateFrequencyStats } from "./frequencyStats";
import { formatNumbers, parseNumbersText } from "./numberText";
import { analyzeRepeatNumber, analyzeShortRepeatNumber } from "./repeatNumber";
import { getColumnIndexes, getGroupIndex, getNumberColor, getNumberColRows, getRowIndex } from "./roulette";
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

  it("detects repeat-number signals and premium repeat stats", () => {
    const numbers = [18, 7, 1, 7, 18, 3, 7, 4, 5, 6, 8, 9, 10, 11, 12, 18, 18];
    const stats = analyzeRepeatNumber(numbers);

    expect(stats.normalRoi.signals).toBe(1);
    expect(stats.normalRoi.hits).toBe(1);
    expect(stats.normalRoi.roi).toBe(3500);
    expect(stats.premiumRoi.signals).toBe(1);
    expect(stats.activeSignals).toHaveLength(0);
  });

  it("uses full repeat history when ROI starts later", () => {
    const numbers = [18, 7, 1, 7, 2, 3, 7, 4, 5, 6, 18, 1, 2, 3, 4, 5, 6, 7, 8, 9, 18, 18];
    const stats = analyzeRepeatNumber(numbers, 20);

    expect(stats.normalRoi.signals).toBe(1);
    expect(stats.normalRoi.hits).toBe(1);
    expect(stats.premiumRoi.signals).toBe(1);
    expect(stats.premiumRoi.hits).toBe(1);
  });

  it("detects short repeat signals with a two-round chase", () => {
    const numbers = [18, 1, 18, 2, 3, 18, 4, 18, 18];
    const stats = analyzeShortRepeatNumber(numbers);

    expect(stats.totalRoi.signals).toBe(1);
    expect(stats.totalRoi.hits).toBe(1);
    expect(stats.totalRoi.bet).toBe(2);
    expect(stats.totalRoi.win).toBe(36);
    expect(stats.activeSignals).toHaveLength(0);
  });

  it("counts short repeat signals when a delayed ROI window includes chase bets", () => {
    const numbers = [18, 1, 18, 2, 3, 18, 4, 18];
    const stats = analyzeShortRepeatNumber(numbers, 7);

    expect(stats.totalRoi.signals).toBe(1);
    expect(stats.totalRoi.bet).toBe(1);
    expect(stats.totalRoi.hits).toBe(1);
    expect(stats.totalRoi.win).toBe(36);
  });
});
