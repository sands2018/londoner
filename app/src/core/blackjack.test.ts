import { describe, expect, it } from "vitest";
import { BlackjackTable, isSavedBlackjack } from "./blackjack";
import { Rank } from "@blackjacktrainer/blackjack-simulator/src/types";

const rankMap: Record<string, Rank> = { A: Rank.Ace, "2": Rank.Two, "3": Rank.Three, "4": Rank.Four, "5": Rank.Five, "6": Rank.Six, "7": Rank.Seven, "8": Rank.Eight, "9": Rank.Nine, T: Rank.Ten, J: Rank.Jack, Q: Rank.Queen, K: Rank.King };
function rig(sequence: string, table = new BlackjackTable()) {
  const pool = [...table.engine.shoe.cards];
  const chosen = sequence.split(" ").map((r) => {
    const index = pool.findIndex((c) => c.rank === rankMap[r]);
    if (index < 0) throw new Error(`No ${r} left`);
    return pool.splice(index, 1)[0];
  });
  table.engine.shoe.setCards([...pool, ...chosen.reverse()]);
  return table;
}
function finish(table: BlackjackTable) {
  for (let i = 0; i < 10 && table.phase !== "settled"; i++) table.act(table.phase === "insurance" ? "decline" : "stand");
  expect(table.phase).toBe("settled");
}

describe("Sands2018 double-deck blackjack", () => {
  it("has exactly two of each card, burns one and never draws with replacement", () => {
    const table = new BlackjackTable();
    expect(table.view().cardsLeft).toBe(103);
    const cards = table.engine.shoe.cards;
    const unique = new Set(cards.map((c) => `${c.rank}:${c.suit}`));
    expect(unique.size).toBe(52);
    unique.forEach((key) => expect(cards.filter((c) => `${c.rank}:${c.suit}` === key)).toHaveLength(2));
    table.deal(); finish(table);
    expect(new Set([...table.engine.player.cards, ...table.engine.dealer.cards].map((c) => c.id)).size).toBe(table.engine.player.cards.length + table.engine.dealer.cards.length);
  });
  it("enforces minimum and available funds, supports chip undo/clear/repeat", () => {
    const t = rig("8 6 9 T 5");
    t.clearBet(); t.addChip(10); t.addChip(10);
    expect(t.deal()).toBe(false);
    t.addChip(20); t.undoBet();
    expect(t.view().pendingBet).toBe(20);
    t.addChip(10); expect(t.deal()).toBe(true);
    expect(t.addChip(100)).toBe(false);
    finish(t); t.clearBet(); t.repeatBet(); expect(t.view().pendingBet).toBe(30);
    t.clearBet(); for (let i = 0; i < 10; i++) t.addChip(1000);
    expect(t.addChip(1000)).toBe(false);
  });
  it("pays a natural 3:2 including the returned original stake", () => {
    const t = rig("A 9 K 7"); t.deal(); finish(t);
    expect(t.view().lastRound).toMatchObject({ wagered: 30, returned: 75, profit: 45 });
    expect(t.view().balance).toBe(10045);
  });
  it("dealer peeks at a ten and both naturals push", () => {
    const lose = rig("9 T K A"); lose.deal(); expect(lose.phase).toBe("settled");
    expect(lose.view().lastRound?.profit).toBe(-30);
    const push = rig("A T K A"); push.deal(); expect(push.view().lastRound?.profit).toBe(0);
  });
  it("keeps the hidden dealer card out of the public UI view", () => {
    const t = rig("9 6 8 T"); t.deal();
    expect(t.view().dealer.cards[0]).toMatchObject({ rank: "", suit: "", hidden: true });
    expect(t.view().dealer.total).toBe(6);
  });
  it("stands on soft 17 and counts aces correctly", () => {
    const t = rig("T A 8 6"); t.deal(); t.act("decline"); finish(t);
    expect(t.view().dealer.total).toBe(17);
    expect(t.view().dealer.cards).toHaveLength(2);
    expect(t.view().lastRound?.profit).toBe(30);
    const aces = rig("A 7 5 9 A 3"); aces.deal(); aces.act("hit");
    expect(aces.view().hands[0].total).toBe(17); aces.act("hit"); expect(aces.view().hands[0].total).toBe(20);
  });
  it("settles insurance separately when the dealer has blackjack", () => {
    const t = rig("T A 8 K"); t.deal(); expect(t.phase).toBe("insurance");
    t.act("insurance"); expect(t.view().lastRound).toMatchObject({ wagered: 45, returned: 45, profit: 0 });
  });
  it("does not add losing insurance to a winning hand's payout", () => {
    const t = rig("T A K 8"); t.deal(); t.act("insurance"); finish(t);
    expect(t.view().lastRound).toMatchObject({ wagered: 45, returned: 60, profit: 15 });
  });
  it("natural plus insurance earns the same net with/without dealer blackjack", () => {
    for (const hole of ["K", "8"]) {
      const t = rig(`A A T ${hole}`); t.deal(); t.act("insurance"); finish(t);
      expect(t.view().lastRound).toMatchObject({ wagered: 45, returned: 75, profit: 30 });
    }
  });
  it("doubles only the first two cards and draws exactly one card", () => {
    const t = rig("5 6 6 T K 4"); t.deal(); expect(t.act("double")).toBe(true); finish(t);
    expect(t.view().hands[0].cards).toHaveLength(3);
    expect(t.view().lastRound).toMatchObject({ wagered: 60, returned: 120, profit: 60 });
    const h = rig("5 6 4 T 2"); h.deal(); h.act("hit"); expect(h.act("double")).toBe(false);
  });
  it("splits aces once, gives one card each, and pays split 21 only 1:1", () => {
    const t = rig("A 7 A T K 9"); t.deal(); t.act("split"); finish(t);
    expect(t.view().hands.map((h) => h.cards.length)).toEqual([2, 2]);
    expect(t.view().hands[0].natural).toBe(false);
    expect(t.view().lastRound).toMatchObject({ wagered: 60, returned: 120, profit: 60 });
    const aa = rig("A 7 A T A A"); aa.deal(); aa.act("split"); expect(aa.phase).toBe("settled");
  });
  it("enforces a total of four split hands and allows double after split", () => {
    const t = rig("8 6 8 T 8 8 8 8 8 8"); t.deal(); t.act("split"); t.act("split"); t.act("split");
    expect(t.view().hands).toHaveLength(4); expect(t.act("split")).toBe(false); finish(t);
    const d = rig("8 6 8 T 3 2 T 4"); d.deal(); d.act("split"); expect(d.act("double")).toBe(true); finish(d);
    expect(d.view().lastRound?.wagered).toBe(90);
  });
  it("restores an unfinished split/insurance hand without changing cards or balance", () => {
    const t = rig("8 A 8 6 3 2 T 4"); t.deal(); t.act("insurance"); t.act("split");
    const saved = t.save(); expect(isSavedBlackjack(saved)).toBe(true);
    const restored = new BlackjackTable(JSON.parse(JSON.stringify(saved)));
    expect(restored.view().cardsLeft).toBe(t.view().cardsLeft);
    expect(restored.view().balance).toBe(t.view().balance);
    expect(restored.view().hands.map((h) => h.total)).toEqual([11, 10]);
    expect(restored.act("double")).toBe(true); finish(restored);
    t.act("double"); finish(t);
    expect(restored.view().lastRound).toEqual(t.view().lastRound);
    const done = new BlackjackTable(restored.save());
    expect(done.view().stats).toEqual(restored.view().stats);
    expect(done.act("stand")).toBe(false);
  });
  it("resets only statistics, never the bankroll, shoe or in-progress bets", () => {
    const t = rig("8 9 9 8"); t.deal(); expect(t.resetStats()).toBe(false); finish(t);
    const before = t.view(); t.resetStats(); expect(t.view().balance).toBe(before.balance);
    expect(t.view().cardsLeft).toBe(before.cardsLeft); expect(t.view().stats.rounds).toBe(0);
    t.addPracticeCredits(); expect(t.view().balance).toBe(before.balance + 10000); expect(t.view().stats.profit).toBe(0);
  });
  it("reshuffles between rounds and keeps accounting balanced over many shoes", () => {
    const t = new BlackjackTable();
    for (let i = 0; i < 1200; i++) {
      const before = t.view();
      if (before.balance < 100) t.addPracticeCredits();
      t.repeatBet(); expect(t.deal()).toBe(true);
      if (before.shuffleNext) expect(t.view().shoeNumber).toBe(before.shoeNumber + 1);
      finish(t);
      const s = t.view();
      expect(s.stats.rounds).toBe(i + 1);
      expect(s.stats.returned - s.stats.wagered).toBe(s.stats.profit);
      expect(isSavedBlackjack(t.save())).toBe(true);
    }
    expect(t.view().shoeNumber).toBeGreaterThan(40);
  });
  it("rejects malformed stored decks and aliased card locations", () => {
    const t = rig("8 7 9 T"); t.deal(); const saved = t.save();
    expect(isSavedBlackjack({ ...saved, shoe: [] })).toBe(false);
    expect(isSavedBlackjack({ ...saved, balance: NaN })).toBe(false);
    saved.hands[0].cards.push(saved.hands[0].cards[0]); expect(isSavedBlackjack(saved)).toBe(false);
  });
  it("voids an exhausted shoe fairly, including a previously busted split hand", () => {
    const t = rig("8 7 8 T 8 8 T"); t.deal(); t.act("split"); t.act("hit");
    expect(t.view().hands[0].result).toBe("lose");
    t.engine.shoe.currentCardIndex = -1; t.act("hit");
    expect(t.view().balance).toBe(10000);
    expect(t.view().lastRound).toMatchObject({ wagered: 60, returned: 60, profit: 0, voided: true });
    const insured = rig("8 A 8 6"); insured.deal(); insured.act("insurance");
    insured.engine.shoe.currentCardIndex = -1; insured.act("hit");
    expect(insured.view().lastRound).toMatchObject({ wagered: 45, returned: 45, profit: 0 });
  });
});
