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

  it("allows betting-area signals after a weak early environment recovers", () => {
    const numbers = makeNumbers(520, 1);

    expect(analyzeHotNumbers(numbers).activeNumber).not.toBeNull();
    const analysis = analyzeHotNumbers(numbers, 200);

    expect(analysis.activeNumber).not.toBeNull();
    expect(analysis.totalRoiFrom201).toMatchObject({
      signals: 61,
      bet: 61,
      win: 72,
      hits: 2,
    });
    expect(analysis.totalRoiFrom201.roi).toBeCloseTo(18.0328, 4);
  });

  it("can close the current signal after earlier betting-area signals", () => {
    const numbers = makeNumbers(520, 2);
    const analysis = analyzeHotNumbers(numbers, 200);

    expect(analysis.activeNumber).toBeNull();
    expect(analysis.totalRoiFrom201).toMatchObject({
      signals: 229,
      bet: 229,
      win: 252,
      hits: 7,
    });
    expect(analysis.totalRoiFrom201.roi).toBeCloseTo(10.0437, 4);
  });
});
