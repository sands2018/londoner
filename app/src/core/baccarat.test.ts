import { describe, expect, it } from "vitest";
import { MersenneTwister19937 } from "random-js";
import { baccaratBetIds, baccaratPoints, baccaratReturn, baccaratRoad, baccaratSequence, baccaratWager, clearBaccaratBets, dealBaccarat, doubleBaccaratBets, drawBaccarat, freshBaccarat, nextBaccaratRound, placeBaccaratBet, readBaccaratState, repeatBaccaratBets, resetBaccaratStats, undoBaccaratBet, type BaccaratState } from "./baccarat";

const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const ids = (values: string[]) => values.map((rank, i) => ranks.indexOf(rank) + i * 52);
function rig(values: string[], bets: BaccaratState["bets"] = { player: 20 }): BaccaratState {
  const sequence = ids(values);
  const rest = Array.from({ length: 416 }, (_, i) => i).filter(i => !sequence.includes(i)).slice(0, 408 - sequence.length);
  return { ...freshBaccarat(), balance: 100000, shoeNumber: 1, shoe: [...rest, ...sequence.reverse()], bets };
}
const pointRank = (n: number) => n ? String(n === 1 ? "A" : n) : "10";
const noRandom = { next() { throw new Error("Unexpected shuffle"); } };

describe("baccarat drawing and accounting", () => {
  it("matches all player/banker initial totals and all ten player third-card values", () => {
    for (let p = 0; p < 10; p++) for (let b = 0; b < 10; b++) for (let third = 0; third < 10; third++) {
      const s = rig([pointRank(p), pointRank(b), "K", "Q", pointRank(third), "7"]);
      const r = drawBaccarat(s.shoe);
      const natural = p >= 8 || b >= 8;
      const playerDraw = !natural && p <= 5;
      const bankerDraw = !natural && (!playerDraw ? b <= 5 : b <= 2 || b === 3 && third !== 8 || b === 4 && third >= 2 && third <= 7 || b === 5 && third >= 4 && third <= 7 || b === 6 && (third === 6 || third === 7));
      expect(r.player.length, `${p},${b},${third}`).toBe(playerDraw ? 3 : 2);
      expect(r.banker.length, `${p},${b},${third}`).toBe(bankerDraw ? 3 : 2);
      expect(r.natural).toBe(natural);
      expect(r.shoe.length).toBe(408 - r.player.length - r.banker.length);
      const pt = baccaratPoints(r.player), bt = baccaratPoints(r.banker);
      expect(r.outcome).toBe(pt === bt ? "tie" : pt > bt ? "player" : "banker");
    }
  });
  it("counts face cards as zero, aces as one, and takes the last digit", () => {
    expect(baccaratPoints(ids(["K", "Q", "J", "10"]))).toBe(0);
    expect(baccaratPoints(ids(["A", "9", "7"]))).toBe(7);
  });
  it("keeps initial pairs after a third card and distinguishes J from Q", () => {
    const r = dealBaccarat(rig(["2", "J", "2", "Q", "5", "7"], { "player-pair": 20, "banker-pair": 20 }), noRandom);
    expect(r.settled?.player).toHaveLength(3);
    expect(r.settled?.playerPair).toBe(true);
    expect(r.settled?.bankerPair).toBe(false);
    expect(r.settled?.returned).toBe(240);
    expect(readBaccaratState(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
  it("refunds main bets on a tie and settles both pairs independently", () => {
    const r = dealBaccarat(rig(["4", "9", "4", "9"], { player: 100, banker: 100, tie: 20, "player-pair": 20, "banker-pair": 20 }), noRandom);
    expect(r.settled).toMatchObject({ outcome: "tie", playerPair: true, bankerPair: true, commission: 0, wagered: 260, returned: 860, profit: 600 });
    expect(r.balance).toBe(100600);
  });
  it("deducts banker commission exactly, including half-unit payouts", () => {
    const r = dealBaccarat(rig(["3", "4", "4", "5"], { banker: 30, player: 20, tie: 20 }), noRandom);
    expect(r.settled).toMatchObject({ outcome: "banker", returned: 58.5, commission: 1.5, profit: -11.5 });
    expect(r.stats.profit).toBe(-11.5);
    expect(readBaccaratState(JSON.parse(JSON.stringify(r)))).toEqual(r);
  });
  it("uses each physical card at most once, preserves the shoe, and reshuffles only at the cut", () => {
    const random = MersenneTwister19937.seed(12018);
    let s = { ...freshBaccarat(), balance: 1000000 };
    let previousShoe = 0;
    let seen = new Set<number>();
    for (let i = 0; i < 250; i++) {
      s = { ...nextBaccaratRound(s), bets: { player: 20 } };
      const before = s;
      s = dealBaccarat(s, random);
      if (s.shoeNumber !== previousShoe) {
        expect(before.shoe.length).toBeLessThanOrEqual(16);
        expect(s.shoeNumber).toBe(previousShoe + 1);
        previousShoe = s.shoeNumber; seen = new Set();
      }
      baccaratSequence(s.settled!).forEach(c => { expect(seen.has(c.id)).toBe(false); seen.add(c.id); });
      expect(s.shoe.length + seen.size).toBe(408);
      expect(s.shoe.every(c => !seen.has(c))).toBe(true);
      if (i % 20 === 0) expect(readBaccaratState(s)).toEqual(s);
    }
    expect(s.shoeNumber).toBeGreaterThan(2);
    expect(s.history).toHaveLength(200);
    expect(s.stats.rounds).toBe(250);
  });
  it("does not mutate input, replay settlement or alter wagers while settled", () => {
    const before = rig(["A", "A", "7", "8"]);
    const copy = structuredClone(before);
    const s = dealBaccarat(before, noRandom);
    expect(before).toEqual(copy);
    expect(dealBaccarat(s, noRandom)).toBe(s);
    for (const action of [clearBaccaratBets, repeatBaccaratBets, doubleBaccaratBets, undoBaccaratBet]) expect(action(s)).toBe(s);
    expect(placeBaccaratBet(s, "banker")).toBe(s);
    expect(nextBaccaratRound(s)).toMatchObject({ settled: null, bets: {}, shoe: s.shoe, stats: s.stats });
  });
  it("supports atomic undo, clear, repeat and double within funds and limits", () => {
    let s = freshBaccarat();
    s = placeBaccaratBet(s, "banker");
    expect(s.bets).toEqual({ banker: 20 });
    s = doubleBaccaratBets(s);
    expect(s.bets.banker).toBe(40);
    s = undoBaccaratBet(s);
    expect(s.bets.banker).toBe(20);
    expect(undoBaccaratBet(clearBaccaratBets(s)).bets).toEqual(s.bets);
    expect(repeatBaccaratBets({ ...s, lastBets: { tie: 100 } }).bets).toEqual({ tie: 100 });
    const poor = { ...s, balance: 20 };
    expect(doubleBaccaratBets(poor)).toBe(poor);
    expect(placeBaccaratBet(poor, "player")).toBe(poor);
    const maximum = { ...s, balance: 200000, bets: { banker: 100000 } };
    expect(placeBaccaratBet(maximum, "player")).toBe(maximum);
    expect(doubleBaccaratBets(maximum)).toBe(maximum);
  });
  it("enforces per-cell minimum before generating cards", () => {
    for (const id of baccaratBetIds) {
      const s = { ...freshBaccarat(), bets: { [id]: 10 } };
      expect(dealBaccarat(s, noRandom)).toBe(s);
    }
    expect(dealBaccarat(freshBaccarat(), noRandom)).toEqual(freshBaccarat());
  });
  it("resets financial reports without losing the held result or shoe road", () => {
    const s = dealBaccarat(rig(["A", "A", "7", "8"]), noRandom);
    const reset = resetBaccaratStats(s);
    expect(reset.balance).toBe(s.balance);
    expect(reset.shoe).toEqual(s.shoe);
    expect(reset.shoeRounds).toEqual(s.shoeRounds);
    expect(reset.settled).toEqual(s.settled);
    expect(reset.history).toHaveLength(0);
    expect(reset.stats.rounds).toBe(0);
    expect(readBaccaratState(reset)).toEqual(reset);
  });
  it("rejects corrupt state instead of losing card conservation or paying invalid results", () => {
    expect(readBaccaratState(freshBaccarat())).toEqual(freshBaccarat());
    const s = dealBaccarat(rig(["A", "A", "7", "8"]), noRandom);
    for (const change of [{ balance: -1 }, { bets: { other: 20 } }, { shoe: [0, 0] }, { selected: 7 }, { settled: { ...s.settled, returned: 99999 } }, { stats: { ...s.stats, banker: 20 } }, { shoeRounds: [] }]) expect(readBaccaratState({ ...s, ...change })).toBeNull();
    const copy = readBaccaratState(s)!; copy.shoe.pop(); expect(copy.shoe).not.toEqual(s.shoe);
  });
  it("builds beads and big road with ties, pairs and six-row dragon tails", () => {
    const r = dealBaccarat(rig(["4", "9", "4", "9"]), noRandom).settled!;
    const onlyTies = baccaratRoad([r, r], "big");
    expect(onlyTies).toMatchObject([{ row: 0, column: 0, ties: 2 }]);
    const rounds = Array.from({ length: 10 }, (_, i) => ({ ...r, id: i + 1, outcome: i === 8 ? "tie" as const : "banker" as const }));
    const beads = baccaratRoad(rounds, "beads");
    expect(beads[6]).toMatchObject({ row: 0, column: 1, bankerPair: true, playerPair: true });
    const big = baccaratRoad(rounds, "big");
    expect(big.every(c => c.row < 6 && c.column < 18)).toBe(true);
    expect(new Set(big.map(c => `${c.row},${c.column}`)).size).toBe(big.length);
    expect(big.reduce((sum, c) => sum + c.ties, 0)).toBe(1);
  });
  it("reports payout gross of stake and balances all winning bet types", () => {
    const r = { outcome: "player" as const, playerPair: true, bankerPair: false };
    expect(baccaratReturn("player", 100, r)).toBe(200);
    expect(baccaratReturn("player-pair", 100, r)).toBe(1200);
    expect(baccaratReturn("banker-pair", 100, r)).toBe(0);
    expect(baccaratWager({ player: 20, tie: 30 })).toBe(50);
  });
  it("retains the entire shoe beyond the visible columns and preserves dragon-tail coordinates", () => {
    const r = dealBaccarat(rig(["4", "9", "4", "9"]), noRandom).settled!;
    const rounds = Array.from({ length: 100 }, (_, i) => ({ ...r, id: i + 1, outcome: i % 2 ? "player" as const : "banker" as const }));
    const beads = baccaratRoad(rounds, "beads", 8);
    expect(beads).toHaveLength(100);
    expect(beads[0]).toMatchObject({ column: 0, row: 0, outcome: "banker" });
    expect(beads.at(-1)).toMatchObject({ column: 16, row: 3, outcome: "player" });
    const big = baccaratRoad(rounds, "big", 8);
    expect(big).toHaveLength(100);
    expect(big.at(-1)).toMatchObject({ column: 99, row: 0 });
    const dragon = baccaratRoad([
      ...rounds.slice(0, 25).map(r => ({ ...r, outcome: "banker" as const })),
      { ...r, outcome: "player" }, { ...r, outcome: "tie" },
    ], "big", 8);
    expect(dragon).toHaveLength(26);
    expect(dragon[24]).toMatchObject({ column: 19, row: 5 });
    expect(dragon.at(-1)).toMatchObject({ column: 1, row: 0, outcome: "player", ties: 1 });
  });
});
