import { describe, expect, it } from "vitest";
import { integer, MersenneTwister19937 } from "random-js";
import { evaluateHoldem, evaluateThreeCard, pokerDeck, validPokerCards } from "./pokerCards";
import { actHoldem, advanceHoldem, freshHoldem, holdemLegal, readHoldemState, resetHoldemStats, settleHoldemPots, startHoldem, topUpHoldem, type HoldemState } from "./holdem";
import { chooseHoldemAction, observeHoldem } from "./holdemBot";
import { changeThreeBets, dealThreeCard, decideThreeCard, freshThreeCard, nextThreeCard, readThreeCardState, threeCardPayout, type ThreeRound } from "./threeCardPoker";
const cards = (text: string) => text.split(" ").map(c => "shcd".indexOf(c.at(-1)!) * 13 + "23456789TJQKA".indexOf(c[0]));
const seed = () => MersenneTwister19937.seed(2018);

describe("poker hand comparison", () => {
  it("orders all Hold'em categories and supports the wheel and royal flush", () => {
    const hands = ["As Jd 8c 5s 3h", "As Ad 8c 5s 3h", "As Ad 8c 8s 3h", "As Ad Ac 5s 3h", "As 2d 3c 4s 5h",
      "As Js 8s 5s 3s", "As Ad Ac 5s 5h", "As Ad Ac Ah 3h", "9s Ts Js Qs Ks"];
    hands.forEach((h, category) => expect(evaluateHoldem(cards(h)).category).toBe(category));
    for (let i = 1; i < hands.length; i++) expect(evaluateHoldem(cards(hands[i])).score).toBeGreaterThan(evaluateHoldem(cards(hands[i - 1])).score);
    expect(evaluateHoldem(cards("As Ks Qs Js Ts 2c 2d")).label).toBe("皇家同花顺");
    expect(evaluateHoldem(cards("As 2d 3c 4s 5h 8d 9d")).ranks).toEqual([5]);
  });
  it("selects full houses from two trips and uses all five kickers", () => {
    expect(evaluateHoldem(cards("As Ad Ac Ks Kd Kc 2h")).ranks).toEqual([14, 13]);
    expect(evaluateHoldem(cards("As Ad Ks Kd Qc Qd 2h")).ranks).toEqual([14, 13, 12]);
    expect(evaluateHoldem(cards("As Ad Ks Qd Tc 3d 2h")).score).toBeGreaterThan(evaluateHoldem(cards("Ac Ah Kc Qh 9c 4d 2s")).score);
    expect(evaluateHoldem(cards("As Ks Qs Js Ts 2c 3d")).score).toBe(evaluateHoldem(cards("As Ks Qs Js Ts 4c 5d")).score);
  });
  it("matches best-of-21 five-card combinations for 300 seeded seven-card hands", () => {
    const random = seed();
    for (let n = 0; n < 300; n++) {
      const hand = pokerDeck(random).slice(0, 7);
      let best = 0;
      for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) best = Math.max(best, evaluateHoldem(hand.filter((_, i) => i !== a && i !== b)).score);
      const actual = evaluateHoldem(hand);
      expect(actual.score).toBe(best);
      expect(actual.cards).toHaveLength(5);
      expect(evaluateHoldem(actual.cards).score).toBe(best);
    }
  });
  it("exhausts all 22,100 three-card combinations with the correct category counts", () => {
    const counts = [0, 0, 0, 0, 0, 0];
    for (let a = 0; a < 52; a++) for (let b = a + 1; b < 52; b++) for (let c = b + 1; c < 52; c++) counts[evaluateThreeCard([a, b, c]).category]++;
    expect(counts).toEqual([16440, 3744, 1096, 720, 52, 48]);
    expect(evaluateThreeCard(cards("As 2s 3s")).ranks).toEqual([3]);
    expect(evaluateThreeCard(cards("Qs Kh Ad")).score).toBeGreaterThan(evaluateThreeCard(cards("As Js 9s")).score);
    expect(evaluateThreeCard(cards("As 2d 3h")).score).toBeLessThan(evaluateThreeCard(cards("2s 3d 4h")).score);
  });
  it("rejects duplicate and invalid cards", () => {
    expect(validPokerCards([0, 0])).toBe(false);
    expect(() => evaluateHoldem([0, 0, 1, 2, 3])).toThrow();
    expect(() => evaluateThreeCard([52, 1, 2])).toThrow();
  });
});

describe("three-card poker", () => {
  const hand = (player: string, dealer: string): ThreeRound => ({ id: 1, player: cards(player), dealer: cards(dealer), bets: { ante: 100, pairPlus: 20 }, result: null });
  it("settles qualifying wins, losses, ties and a dealer below queen high", () => {
    expect(threeCardPayout(hand("As Jd 8c", "Kh Jc 7s"), true)).toMatchObject({ outcome: "win", returned: 400, profit: 180 });
    expect(threeCardPayout(hand("Ts 8d 3c", "Qh Jc 7s"), true)).toMatchObject({ outcome: "lose", returned: 0, profit: -220 });
    expect(threeCardPayout(hand("Qs Jd 8c", "Qh Jc 8s"), true)).toMatchObject({ outcome: "push", returned: 200, profit: -20 });
    expect(threeCardPayout(hand("5s 8d 3c", "Jh 9c 7s"), true)).toMatchObject({ outcome: "unqualified", anteReturn: 200, playReturn: 100, profit: 80 });
  });
  it("pays pair and ante bonuses even when the dealer wins, and forfeits both on folding", () => {
    const straight = hand("5s 6d 7c", "Jh Qh Kh");
    expect(threeCardPayout(straight, true)).toMatchObject({ outcome: "lose", pairReturn: 140, bonus: 100, returned: 240, profit: 20 });
    expect(threeCardPayout(straight, false)).toMatchObject({ outcome: "fold", wagered: 120, returned: 0, bonus: 0, profit: -120 });
    expect(threeCardPayout(hand("5s 6s 7s", "Jh Qh Kh"), true)).toMatchObject({ pairReturn: 820, bonus: 500 });
  });
  it("reserves the future Play bet and supports persistent decisions with no duplicate payouts", () => {
    const small = { ...freshThreeCard(), balance: 100 };
    expect(changeThreeBets(small, { ante: 60, pairPlus: 0 })).toBe(small);
    let s = changeThreeBets(freshThreeCard(), { ante: 100, pairPlus: 20 });
    s = dealThreeCard(s, seed());
    expect(s.balance).toBe(9880);
    expect(readThreeCardState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(dealThreeCard(s, seed())).toBe(s);
    const settled = decideThreeCard(s, true);
    expect(settled.balance).toBe(10000 + settled.hand!.result!.profit);
    expect(decideThreeCard(settled, true)).toBe(settled);
    expect(readThreeCardState(settled)).toEqual(settled);
    expect(nextThreeCard(settled).hand).toBeNull();
    expect(readThreeCardState({ ...settled, hand: { ...settled.hand, result: { ...settled.hand!.result, returned: 999999 } } })).toBeNull();
  });
});

describe("no-limit Hold'em", () => {
  const complete = (s: HoldemState) => {
    let next = s;
    for (let i = 0; i < 200 && next.phase === "playing"; i++) next = next.actor < 0 ? advanceHoldem(next) : actHoldem(next, next.actor, { type: holdemLegal(next).canCheck ? "check" : "call" });
    return next;
  };
  it("posts blinds, deals clockwise, gives the big blind its option, and changes action order postflop", () => {
    let s = startHoldem(freshHoldem(), seed());
    expect(s).toMatchObject({ button: 0, actor: 3, currentBet: 100 });
    expect(s.players[1].streetBet).toBe(50);
    expect(s.players[2].streetBet).toBe(100);
    for (const seat of [3, 4, 5, 0, 1]) { expect(s.actor).toBe(seat); s = actHoldem(s, seat, { type: "call" }); }
    expect(s.actor).toBe(2);
    expect(holdemLegal(s).canCheck).toBe(true);
    s = actHoldem(s, 2, { type: "check" });
    expect(s.actor).toBe(-1);
    s = advanceHoldem(s);
    expect(s.actor).toBe(1); expect(s.board).toHaveLength(3); expect(s.burns).toHaveLength(1);
  });
  it("rejects actions out of turn and raises below the last full raise", () => {
    const s = startHoldem(freshHoldem(), seed());
    expect(actHoldem(s, 0, { type: "call" })).toBe(s);
    expect(actHoldem(s, 3, { type: "raise", to: 150 })).toBe(s);
    expect(actHoldem(s, 3, { type: "check" })).toBe(s);
    const raised = actHoldem(s, 3, { type: "raise", to: 400 });
    expect(holdemLegal(raised).minTo).toBe(700);
    expect(actHoldem(raised, 4, { type: "raise", to: 600 })).toBe(raised);
    expect(s.players[3].chips).toBe(10000);
  });
  it("does not reopen action after a short all-in, but does after cumulative full raises", () => {
    let s = startHoldem(freshHoldem(), seed());
    s.players[4].chips = 150; s.players[5].chips = 200;
    s.tableTotal = s.players.reduce((n, p) => n + p.chips + p.committed, 0);
    s = actHoldem(s, 3, { type: "call" });
    s = actHoldem(s, 4, { type: "allin" });
    for (const seat of [5, 0, 1, 2]) s = actHoldem(s, seat, { type: "call" });
    expect(s.actor).toBe(3); expect(holdemLegal(s).canRaise).toBe(false);
    expect(actHoldem(s, 3, { type: "raise", to: 250 })).toBe(s);
    s = actHoldem(s, 3, { type: "call" }); expect(s.actor).toBe(-1);
    let reopened = startHoldem(freshHoldem(), seed());
    reopened.players[4].chips = 150; reopened.players[5].chips = 200;
    reopened.tableTotal = reopened.players.reduce((n, p) => n + p.chips + p.committed, 0);
    reopened = actHoldem(reopened, 3, { type: "call" });
    reopened = actHoldem(reopened, 4, { type: "allin" });
    reopened = actHoldem(reopened, 5, { type: "allin" });
    for (const seat of [0, 1, 2]) reopened = actHoldem(reopened, seat, { type: "call" });
    expect(holdemLegal(reopened).canRaise).toBe(true); expect(holdemLegal(reopened).minTo).toBe(300);
  });
  it("settles main/side pots separately and returns uncalled chips", () => {
    const players = [
      { hole: cards("As Ah"), committed: 100, folded: false },
      { hole: cards("Ks Kh"), committed: 300, folded: false },
      { hole: cards("Qs Qh"), committed: 500, folded: false },
    ];
    const result = settleHoldemPots(players, cards("2c 4d 7s 9h Jc"), 2);
    expect(result.payouts).toEqual([300, 400, 200]); expect(result.refunds).toEqual([0, 0, 200]);
    expect(result.pots.map(p => p.amount)).toEqual([300, 400]);
  });
  it("requires a full increment over an opening all-in below one big blind", () => {
    let s = startHoldem(freshHoldem(), seed());
    for (const seat of [3, 4, 5, 0, 1]) s = actHoldem(s, seat, { type: "call" });
    s = advanceHoldem(actHoldem(s, 2, { type: "check" }));
    s.players[2].chips = 50;
    s.tableTotal = s.players.reduce((n, p) => n + p.chips + p.committed, 0);
    s = actHoldem(s, 1, { type: "check" });
    s = actHoldem(s, 2, { type: "allin" });
    expect(holdemLegal(s).minTo).toBe(150);
    expect(actHoldem(s, 3, { type: "raise", to: 100 })).toBe(s);
    const raised = actHoldem(s, 3, { type: "raise", to: 150 });
    expect(raised.minRaise).toBe(100);
  });
  it("awards odd chips left of the button, excludes folded hands and splits a board-only hand", () => {
    const players = [
      { hole: cards("2h 3h"), committed: 5, folded: false },
      { hole: cards("4h 5h"), committed: 5, folded: false },
      { hole: cards("6h 7h"), committed: 5, folded: true },
    ];
    expect(settleHoldemPots(players, cards("As Ks Qs Js Ts"), 0).payouts).toEqual([7, 8, 0]);
  });
  it("finishes after everyone folds, without revealing undealt community cards", () => {
    let s = startHoldem(freshHoldem(), seed());
    for (const seat of [3, 4, 5, 0, 1]) s = actHoldem(s, seat, { type: "fold" });
    expect(s.phase).toBe("settled"); expect(s.board).toHaveLength(0);
    expect(s.players[2].chips).toBe(10050); expect(s.result!.refunds[2]).toBe(50);
    expect(readHoldemState(s)).toEqual(s);
    expect(advanceHoldem(s)).toBe(s);
  });
  it("preserves cards, accounting and valid save states across 60 randomized rounds", () => {
    const random = seed(); let s = freshHoldem(); let heroDeposits = 10000;
    for (let hand = 0; hand < 60; hand++) {
      if (!s.players[0].chips) { s = topUpHoldem(s); heroDeposits += 10000; }
      s = startHoldem(s, random);
      for (let step = 0; step < 300 && s.phase === "playing"; step++) {
        const old = s;
        if (s.actor < 0) s = advanceHoldem(s);
        else {
          const legal = holdemLegal(s), roll = integer(0, 19)(random);
          s = actHoldem(s, s.actor, roll === 0 && legal.canAllIn ? { type: "allin" } : roll < 3 && legal.canRaise
            ? { type: "raise", to: Math.min(legal.maxTo, legal.minTo) } : roll < 5 && !legal.canCheck ? { type: "fold" } : { type: legal.canCheck ? "check" : "call" });
        }
        expect(s).not.toBe(old);
        expect(s.players.reduce((n, p) => n + p.chips + (s.phase === "playing" ? p.committed : 0), 0)).toBe(s.tableTotal);
        if (step % 5 === 0 || s.phase === "settled") expect(readHoldemState(s)).toEqual(s);
      }
      expect(s.phase).toBe("settled"); expect(s.stats.profit).toBe(s.players[0].chips - heroDeposits);
    }
    expect(s.stats.hands).toBe(60);
    expect(resetHoldemStats(s).players).toEqual(s.players);
  });
  it("hides private information from bot decisions and returns legal deterministic actions", () => {
    const s = startHoldem(freshHoldem(), seed());
    const other = structuredClone(s);
    [other.players[0].hole, other.players[1].hole] = [other.players[1].hole, other.players[0].hole]; other.deck.reverse();
    expect(observeHoldem(s)).toEqual(observeHoldem(other));
    const action = chooseHoldemAction(observeHoldem(s), seed());
    expect(action).toEqual(chooseHoldemAction(observeHoldem(other), seed()));
    expect(actHoldem(s, s.actor, action)).not.toBe(s);
    expect(Object.keys(observeHoldem(s))).not.toContain("deck");
  });
  it("rejects corrupt accounting and round data and persists a completed hand only once", () => {
    expect(readHoldemState(freshHoldem())).toEqual(freshHoldem());
    const s = complete(startHoldem(freshHoldem(), seed()));
    expect(s.stats.hands).toBe(1); expect(readHoldemState(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(advanceHoldem(s)).toBe(s);
    expect(readHoldemState({ ...s, tableTotal: 99 })).toBeNull();
    expect(readHoldemState({ ...s, board: [0, 0, 1, 2, 3] })).toBeNull();
    expect(readHoldemState({ ...s, result: { ...s.result, payouts: [60000, 0, 0, 0, 0, 0] } })).toBeNull();
    expect(readHoldemState({ ...s, result: { ...s.result, labels: [{}, ...s.result!.labels.slice(1)] } })).toBeNull();
    const mismatched = structuredClone(s);
    [mismatched.board[0], mismatched.deck[0]] = [mismatched.deck[0], mismatched.board[0]];
    expect(readHoldemState(mismatched)).toBeNull();
  });
});
