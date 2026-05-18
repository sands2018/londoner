import { describe, expect, it } from "vitest";
import { formatNumbers, parseNumbersText } from "./numberText";
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
});
