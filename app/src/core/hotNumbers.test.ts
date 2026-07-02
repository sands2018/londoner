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

function parseNumbersText(text: string): RouletteNumber[] {
  return text
    .split(/[\s,]+/u)
    .map((item) => Number(item.trim()))
    .filter((value): value is RouletteNumber => Number.isInteger(value) && value >= 0 && value <= 36);
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

  it("does not advance environment close confirmation without fresh short samples", () => {
    const numbers = parseNumbersText(`
      23,17,27,1,17,4,21,22,25,11,22,25,30,29,19,33,11,33,15,31,15,6,6,21,
      2,1,18,19,24,2,16,17,6,5,16,19,29,15,17,3,23,14,36,23,10,9,14,6,
      32,13,1,19,33,31,33,36,24,15,9,15,6,31,27,20,30,28,26,28,34,2,22,5,
      2,10,22,36,15,14,14,22,1,14,12,25,9,28,1,23,26,9,21,8,28,2,30,15,
      21,12,31,23,0,0,26,31,33,1,34,30,19,3,1,36,14,11,0,32,6,11,14,12,
      3,17,14,29,2,29,18,34,24,11,25,30,27,11,15,25,22,2,9,19,24,1,28,10,
      10,23,25,19,15,24,3,29,26,15,27,14,10,10,30,23,34,36,27,11,10,18,8,
      31,1,31,34,20,8,24,11,26,10,25,20,28,27,6,27,32,33,36,34,19,10,24,1,
      1,4,5,11,21,15,25,30,20,6,19,33,16,9,22,6,19,0,17,34,19,0,28,21,
      18,24,6,19,4,11,23,32,11,34,8,27,34,8,33,31,2,34,14,23,3,30,9,10,
      21,4,19,31,12,11,29,31,17,36,36,5,32,15,12,1,22,15,27,14,12,12,15,
      36,31,5,8,14,29,15,13,36,0,7,36,1,30,33,17,23,12,10,21,14,18,36,
      33,24,30,12,31,36,33,34,15,23,14,34,32,31,7,9,13,5,28,21,30,27,14,
      1,31,27,14,9,22,0,20,5,29,35,5,17,24,12,25,8,14,7,18,1,17,5,1,
      33,22,2,29,10,11,3,27,11,20,11,14,11,1,15,9,2,31,21,27
    `);
    const confirmed = analyzeHotNumbers(numbers, 200, { requirePaperHitAfterRoiStart: true });
    const filtered = analyzeHotNumbers(numbers, 200, {
      requirePaperHitAfterRoiStart: true,
      environmentSampleFilter: () => false,
    });

    expect(confirmed.environmentHistory).toEqual([{ position: 225, open: false }]);
    expect(confirmed.events.some((event) => event.position === 221)).toBe(true);
    expect(confirmed.totalRoiFrom201.signals).toBe(12);
    expect(filtered.environmentHistory).toEqual([]);
    expect(filtered.environmentOpen).toBe(true);
  });
});
