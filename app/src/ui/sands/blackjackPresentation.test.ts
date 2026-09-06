import { describe, expect, it } from "vitest";
import { Rank } from "@blackjacktrainer/blackjack-simulator/src/types";
import { Event } from "@blackjacktrainer/blackjack-simulator/src/event-emitter";
import { BlackjackTable, isSavedBlackjack } from "../../core/blackjack";
import { blackjackFrames, blackjackNextFrames, dealerDisplayCards, frameDuration, splitHandState, tableCards, wagerChips } from "./blackjackPresentation";

function rig(ranks: Rank[]) {
  const table = new BlackjackTable();
  const pool = [...table.engine.shoe.cards];
  const chosen = ranks.map((rank) => pool.splice(pool.findIndex((card) => card.rank === rank), 1)[0]);
  table.engine.shoe.setCards([...pool, ...chosen.reverse()]);
  return table;
}

describe("blackjack presentation playback", () => {
  it("deals player/dealer/player/hole in order, with only visible point totals", () => {
    const table = rig([Rank.Nine, Rank.Six, Rank.Eight, Rank.Ten]);
    const playback = table.perform("deal")!;
    const frames = blackjackFrames(playback, true);
    expect(frames.map((frame) => tableCards(frame.view).length)).toEqual([1, 2, 3, 4]);
    expect(frames.map((frame) => frame.view.hands[0].total)).toEqual([9, 9, 17, 17]);
    expect(frames.map((frame) => frame.view.dealer.total)).toEqual([0, 6, 6, 6]);
    expect(frames[3].view.dealer.cards[0]).toMatchObject({ hidden: true, rank: "", suit: "" });
    expect(dealerDisplayCards(frames[1].view.dealer.cards)).toHaveLength(1);
    expect(dealerDisplayCards(frames[3].view.dealer.cards).map((card) => card.hidden)).toEqual([false, true]);
  });

  it("reveals the hole before each separate dealer draw and defers payouts", () => {
    const table = rig([Rank.Ten, Rank.Two, Rank.Eight, Rank.Three, Rank.Four, Rank.Five, Rank.Six]);
    table.deal();
    const playback = table.perform("stand")!;
    const frames = blackjackFrames(playback, false);
    expect(frames.map((f) => f.motion)).toEqual(["reveal", "deal", "deal", "deal", "settle", "result"]);
    expect(frames.map((f) => f.view.dealer.total)).toEqual([5, 9, 14, 20, 20, 20]);
    expect(frames.every((f) => f.view.stats.rounds === 0 && f.view.balance === 9970)).toBe(true);
    expect(frames.slice(0, -1).every((f) => f.view.lastRound === null)).toBe(true);
    expect(frames.at(-1)?.view.lastRound?.profit).toBe(-30);
    expect(playback.after.stats.rounds).toBe(1);
    expect(playback.after.lastRound?.profit).toBe(-30);
    expect(isSavedBlackjack(table.save())).toBe(true);
  });

  it("shows a natural only after both player cards and still deals the hole", () => {
    const table = rig([Rank.Ace, Rank.Ten, Rank.King, Rank.Ace]);
    const playback = table.perform("deal")!;
    const frames = blackjackFrames(playback, true);
    expect(frames.slice(0, 2).every((f) => !f.view.hands[0].natural)).toBe(true);
    expect(frames[2].view.hands[0].natural).toBe(true);
    expect(frames.map((f) => f.motion)).toEqual(["deal", "deal", "deal", "deal", "reveal", "settle", "result"]);
    expect(playback.after.lastRound?.profit).toBe(0);
  });

  it("moves the pair into separate hands before dealing split cards", () => {
    const table = rig([Rank.Eight, Rank.Six, Rank.Eight, Rank.Ten, Rank.Three, Rank.Two]);
    table.deal();
    const frames = blackjackFrames(table.perform("split")!, false);
    expect(frames.map((f) => f.motion)).toEqual(["split", "deal", "deal"]);
    expect(frames[0].view.hands.map((h) => h.cards.length)).toEqual([1, 1]);
    expect(frames[1].view.hands.map((h) => h.total)).toEqual([11, 8]);
    expect(frames[2].view.hands.map((h) => h.total)).toEqual([11, 10]);
    expect(frames.every((f) => f.view.balance === 9940)).toBe(true);
  });

  it("shows doubling the wager before its single card, without premature wins", () => {
    const table = rig([Rank.Five, Rank.Six, Rank.Six, Rank.Ten, Rank.King, Rank.Four]);
    table.deal();
    const playback = table.perform("double")!;
    const frames = blackjackFrames(playback, false);
    expect(frames[0].motion).toBe("wager");
    expect(frames[0].view.hands[0].bet).toBe(60);
    expect(frames[1].view.hands[0].cards).toHaveLength(3);
    expect(frames.every((f) => f.view.balance === 9940)).toBe(true);
    expect(playback.after.balance).toBe(10060);
  });

  it("collects and optionally shuffles on next, without dealing or charging another round", () => {
    const table = rig([Rank.Nine, Rank.Seven, Rank.Eight, Rank.Ten]);
    table.deal(); table.act("stand");
    table.engine.shoe.currentCardIndex = 20;
    const playback = table.perform("next")!;
    const frames = blackjackNextFrames(playback);
    expect(frames.slice(0, 2).map((f) => f.motion)).toEqual(["collect", "shuffle"]);
    expect(tableCards(frames[1].view)).toHaveLength(0);
    expect(frames.filter((f) => f.motion === "deal")).toEqual([]);
    expect(playback.after.pendingBet).toBe(0);
    expect(playback.after.balance).toBe(playback.before.balance);
    expect(playback.after.stats).toEqual(playback.before.stats);
    expect(playback.after.shoeNumber).toBe(playback.before.shoeNumber + 1);
    expect(table.perform("deal")).toBeNull();
    table.repeatBet();
    expect(blackjackFrames(table.perform("deal")!, true).filter((f) => f.motion === "deal").slice(0, 4).map((f) => tableCards(f.view).length)).toEqual([1, 2, 3, 4]);
  });

  it("does not leak event listeners, accept invalid actions, or alter persisted accounting", () => {
    const table = rig([Rank.Nine, Rank.Seven, Rank.Eight, Rank.Ten]);
    const listeners = table.engine.events.get(Event.Change)?.length ?? 0;
    expect(table.perform("stand")).toBeNull();
    table.perform("deal"); table.perform("stand");
    expect(table.perform("stand")).toBeNull();
    expect(table.engine.events.get(Event.Change)?.length ?? 0).toBe(listeners);
    const saved = table.save();
    expect(new BlackjackTable(saved).view().stats).toEqual(table.view().stats);
    expect(table.view().stats.rounds).toBe(1);
  });

  it("keeps the placement journal and bounds visual chip stacks and reduced motion", () => {
    const table = new BlackjackTable();
    table.addChip(50); table.addChip(20);
    expect(table.view().pendingChips).toEqual([30, 50, 20]);
    table.undoBet(); expect(table.view().pendingChips).toEqual([30, 50]);
    table.clearBet(); expect(table.view().pendingChips).toEqual([]);
    expect(wagerChips(1020)).toEqual([1000, 20]);
    expect(wagerChips(100000)).toHaveLength(6);
    expect(frameDuration("deal", true, false)).toBeLessThan(frameDuration("deal", false, false));
    expect(frameDuration("deal", false, true)).toBe(35);
  });
  it("identifies the current split hand, then marks it finished when play moves on", () => {
    const table = rig([Rank.Eight, Rank.Six, Rank.Eight, Rank.Ten, Rank.Three, Rank.Two, Rank.Two, Rank.Three]);
    table.deal();
    expect(splitHandState(table.view(), 0, false)).toBeNull();
    table.act("split");
    expect([0, 1].map((i) => splitHandState(table.view(), i, false))).toEqual(["active", "waiting"]);
    expect(splitHandState(table.view(), 0, true)).toBe("processing");
    table.act("hit");
    expect(table.view().hands.map((h) => h.total)).toEqual([13, 10]);
    expect(splitHandState(table.view(), 0, false)).toBe("active");
    table.act("stand");
    expect([0, 1].map((i) => splitHandState(table.view(), i, false))).toEqual(["complete", "active"]);
    const restored = new BlackjackTable(table.save());
    expect(splitHandState(restored.view(), 1, false)).toBe("active");
    table.act("hit");
    expect(table.view().hands.map((h) => h.total)).toEqual([13, 13]);
    table.act("stand");
    expect([0, 1].map((i) => splitHandState(table.view(), i, false))).toEqual(["complete", "complete"]);
    expect(splitHandState(table.view(), 3, false)).toBeNull();
  });
  it("follows automatic hand completion after doubling or busting", () => {
    const doubled = rig([Rank.Eight, Rank.Six, Rank.Eight, Rank.Ten, Rank.Three, Rank.Two, Rank.King]);
    doubled.deal(); doubled.act("split"); doubled.act("double");
    expect(doubled.view().hands.map((h) => h.total)).toEqual([21, 10]);
    expect([0, 1].map((i) => splitHandState(doubled.view(), i, false))).toEqual(["complete", "active"]);
    const busted = rig([Rank.Eight, Rank.Six, Rank.Eight, Rank.Ten, Rank.Nine, Rank.Two, Rank.King]);
    busted.deal(); busted.act("split"); busted.act("hit");
    expect(busted.view().hands[0].total).toBe(27);
    expect([0, 1].map((i) => splitHandState(busted.view(), i, false))).toEqual(["complete", "active"]);
  });
});
