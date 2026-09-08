import { browserCrypto, integer, real, type Engine } from "random-js";
import { actHoldem, advanceHoldem, holdemLegal, holdemPotTotal, type HoldemAction, type HoldemState } from "./holdem";
import { evaluateHoldem } from "./pokerCards";

// This type deliberately has no deck, burn cards, or opponents' hole cards.
export type HoldemObservation = { seat: number; hole: number[]; board: number[]; opponents: number; pot: number;
  legal: ReturnType<typeof holdemLegal>; street: HoldemState["street"] };
export function observeHoldem(s: HoldemState, seat = s.actor): HoldemObservation {
  return { seat, hole: [...s.players[seat].hole], board: [...s.board], opponents: s.players.filter((p, i) => i !== seat && !p.folded).length,
    pot: holdemPotTotal(s), legal: holdemLegal(s, seat), street: s.street };
}
export function estimateHoldemEquity(view: HoldemObservation, random: Engine = browserCrypto, samples = 32) {
  const known = new Set([...view.hole, ...view.board]);
  const unseen = Array.from({ length: 52 }, (_, i) => i).filter(c => !known.has(c));
  let wins = 0;
  for (let sample = 0; sample < samples; sample++) {
    const deck = [...unseen];
    let cursor = 0;
    const draw = () => { const at = integer(cursor, deck.length - 1)(random); [deck[cursor], deck[at]] = [deck[at], deck[cursor]]; return deck[cursor++]; };
    const board = [...view.board];
    while (board.length < 5) board.push(draw());
    const own = evaluateHoldem([...view.hole, ...board]).score;
    let ties = 1, beaten = false;
    for (let i = 0; i < view.opponents; i++) {
      const other = evaluateHoldem([draw(), draw(), ...board]).score;
      if (other > own) beaten = true;
      if (other === own) ties++;
    }
    if (!beaten) wins += 1 / ties;
  }
  return wins / samples;
}
export function chooseHoldemAction(view: HoldemObservation, random: Engine = browserCrypto): HoldemAction {
  const { legal, pot } = view;
  const equity = estimateHoldemEquity(view, random);
  const roll = real(0, 1)(random);
  const caution = [0, .08, .02, .1, -.01, .05][view.seat];
  const price = legal.call / Math.max(1, pot + legal.call);
  if (legal.call > 0 && equity < price + caution && roll > .07) return { type: "fold" };
  const strong = equity > Math.min(.68, 1 / (view.opponents + 1) + .23 + caution);
  if (legal.canRaise && (strong && roll > .3 || legal.canCheck && roll < .06)) {
    const to = Math.min(legal.maxTo, Math.max(legal.minTo, legal.minTo + Math.round((pot + legal.call) * .45 / 50) * 50));
    return to === legal.maxTo ? { type: "allin" } : { type: "raise", to };
  }
  return legal.canCheck ? { type: "check" } : { type: "call" };
}
export function finishFoldedHoldem(s: HoldemState, random: Engine = browserCrypto): HoldemState {
  if (!s.players[0].folded) return s;
  let next = s;
  for (let steps = 0; steps < 500 && next.phase === "playing"; steps++) {
    const updated = next.actor === -1 ? advanceHoldem(next) : actHoldem(next, next.actor, chooseHoldemAction(observeHoldem(next), random));
    if (updated === next) throw new Error("Poker action made no progress");
    next = updated;
  }
  if (next.phase === "playing") throw new Error("Poker round exceeded action limit");
  return next;
}
