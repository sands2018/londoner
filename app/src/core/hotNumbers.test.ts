import { describe, expect, it } from "vitest";
import { analyzeHotNumbers } from "./hotNumbers";
import type { RouletteNumber } from "./roulette";

function makeNumbers(length: number, seed = 0x12345678): RouletteNumber[] {
  let state = seed;
  return Array.from({ length }, () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return (state % 37) as RouletteNumber;
  });
}

describe("analyzeHotNumbers", () => {
  it("uses the complete history for the current signal", () => {
    const source = makeNumbers(500);
    let numbers: RouletteNumber[] | undefined;
    let current = null;
    for (let length = 300; length <= source.length; length++) {
      const candidate = source.slice(0, length);
      const signal = analyzeHotNumbers(candidate).activeNumber;
      if (signal !== null) {
        numbers = candidate;
        current = signal;
        break;
      }
    }

    expect(numbers).toBeDefined();
    expect(current).not.toBeNull();
    if (!numbers || !current) return;

    const priorHistory = analyzeHotNumbers(numbers).totalRoi;
    const nextHistory = analyzeHotNumbers([...numbers, current.number]).totalRoi;

    expect(nextHistory.signals - priorHistory.signals).toBe(1);
    expect(nextHistory.hits - priorHistory.hits).toBe(1);
  });

  it("keeps total and betting-area ROI internally consistent", () => {
    const numbers = makeNumbers(500);
    const total = analyzeHotNumbers(numbers).totalRoi;
    const from201 = analyzeHotNumbers(numbers, 200).totalRoiFrom201;

    expect(total.signals).toBe(total.bet);
    expect(from201.signals).toBe(from201.bet);
    expect(from201.bet).toBeLessThanOrEqual(total.bet);
    expect(from201.hits).toBeLessThanOrEqual(total.hits);
  });

  it("suppresses betting-area signals when the first-200 hot environment fails", () => {
    const numbers = makeNumbers(520, 1);

    expect(analyzeHotNumbers(numbers).activeNumber).not.toBeNull();
    const gated = analyzeHotNumbers(numbers, 200);

    expect(gated.activeNumber).toBeNull();
    expect(gated.totalRoiFrom201.signals).toBe(0);
    expect(gated.totalRoiFrom201.bet).toBe(0);
  });

  it("keeps betting-area signals when the first-200 hot environment passes", () => {
    const numbers = makeNumbers(520, 2);
    const gated = analyzeHotNumbers(numbers, 200);

    expect(gated.activeNumber).not.toBeNull();
    expect(gated.totalRoiFrom201.signals).toBeGreaterThan(0);
    expect(gated.totalRoiFrom201.bet).toBe(gated.totalRoiFrom201.signals);
  });
});
