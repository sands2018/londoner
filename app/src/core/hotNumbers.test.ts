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
    expect(analysis.environmentOpen).toBe(true);
    expect(analysis.environmentHistory.some((event) => event.open)).toBe(true);
    expect(analysis.totalRoiFrom201).toMatchObject({
      signals: 71,
      bet: 71,
      win: 72,
      hits: 2,
    });
    expect(analysis.totalRoiFrom201.roi).toBeCloseTo(1.4085, 4);
  });

  it("can close the current signal after earlier betting-area signals", () => {
    const numbers = makeNumbers(520, 2);
    const analysis = analyzeHotNumbers(numbers, 200);

    expect(analysis.activeNumber).toBeNull();
    expect(analysis.environmentOpen).toBe(false);
    expect(analysis.environmentHistory.at(-1)?.open).toBe(false);
    expect(analysis.totalRoiFrom201).toMatchObject({
      signals: 283,
      bet: 283,
      win: 144,
      hits: 4,
    });
    expect(analysis.totalRoiFrom201.roi).toBeCloseTo(-49.1166, 4);
  });

  it("can wait for one betting-area paper hit before recording hot-number bets", () => {
    const numbers = makeNumbers(520, 2);
    const baseline = analyzeHotNumbers(numbers, 200);
    const confirmed = analyzeHotNumbers(numbers, 200, { requirePaperHitAfterRoiStart: true });
    const baselineBettingEvents = baseline.events.filter((event) => event.position >= 200);
    const confirmedBettingEvents = confirmed.events.filter((event) => event.position >= 200);

    expect(baselineBettingEvents.length).toBe(283);
    // Confirmation still follows the original raw hot-number line, while
    // recorded bets use the switch50base reranked pick after confirmation.
    expect(confirmedBettingEvents[0]?.position).toBe(271);
    expect(confirmed.totalRoiFrom201).toMatchObject({
      signals: 216,
      bet: 216,
      win: 108,
      hits: 3,
    });
  });

  it("marks the hot signal as pending before the first betting-area paper hit", () => {
    const source = makeNumbers(520, 2);
    const numbers = source.slice(0, 270);
    const confirmed = analyzeHotNumbers(numbers, 200, { requirePaperHitAfterRoiStart: true });

    expect(confirmed.paperHitPending).toBe(true);
    expect(confirmed.activeNumber).toBeNull();
    expect(confirmed.totalRoiFrom201.signals).toBe(0);
  });
});
