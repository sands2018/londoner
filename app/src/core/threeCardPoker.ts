import type { Engine } from "random-js";
import { evaluateThreeCard, pokerDeck, pokerMoney, pokerObject, validPokerCards } from "./pokerCards";

export const threeCardChips = [20, 50, 100, 500, 1000] as const;
export const threeCardPairOdds = [0, 1, 3, 6, 30, 40] as const;
export const threeCardAnteBonusOdds = [0, 0, 0, 1, 4, 5] as const;
export type ThreeBets = { ante: number; pairPlus: number };
export type ThreeResult = { outcome: "win" | "lose" | "push" | "fold" | "unqualified"; qualifies: boolean;
  wagered: number; returned: number; profit: number; anteReturn: number; playReturn: number; pairReturn: number; bonus: number };
export type ThreeRound = { id: number; player: number[]; dealer: number[]; bets: ThreeBets; result: ThreeResult | null };
export type ThreeState = { version: 1; balance: number; selected: number; bets: ThreeBets; lastBets: ThreeBets; undo: ThreeBets[];
  roundId: number; hand: ThreeRound | null; history: ThreeRound[]; stats: { rounds: number; wins: number; wagered: number; returned: number; profit: number } };
const emptyBets = (): ThreeBets => ({ ante: 0, pairPlus: 0 });
export const freshThreeCard = (): ThreeState => ({ version: 1, balance: 10000, selected: 20, bets: emptyBets(), lastBets: emptyBets(), undo: [],
  roundId: 0, hand: null, history: [], stats: { rounds: 0, wins: 0, wagered: 0, returned: 0, profit: 0 } });
export const threeCardReserve = (bets: ThreeBets) => 2 * bets.ante + bets.pairPlus;
const validBets = (v: unknown): v is ThreeBets => pokerObject(v) && pokerMoney(v.ante) && pokerMoney(v.pairPlus)
  && v.ante % 10 === 0 && v.pairPlus % 10 === 0 && (v.ante === 0 || v.ante >= 20) && (v.pairPlus === 0 || v.pairPlus >= 20)
  && threeCardReserve(v as ThreeBets) <= 100000;
export function changeThreeBets(s: ThreeState, bets: ThreeBets): ThreeState {
  if (s.hand || !validBets(bets) || threeCardReserve(bets) > s.balance) return s;
  return { ...s, bets, undo: [...s.undo.slice(-99), s.bets] };
}
export const placeThreeBet = (s: ThreeState, target: keyof ThreeBets) => threeCardChips.includes(s.selected as typeof threeCardChips[number])
  ? changeThreeBets(s, { ...s.bets, [target]: s.bets[target] + s.selected }) : s;
export const undoThreeBet = (s: ThreeState): ThreeState => !s.hand && s.undo.length ? { ...s, bets: s.undo.at(-1)!, undo: s.undo.slice(0, -1) } : s;
export const clearThreeBets = (s: ThreeState) => changeThreeBets(s, emptyBets());
export const repeatThreeBets = (s: ThreeState) => changeThreeBets(s, { ...s.lastBets });
export function dealThreeCard(s: ThreeState, random?: Engine): ThreeState {
  if (s.hand || !validBets(s.bets) || s.bets.ante < 20 || threeCardReserve(s.bets) > s.balance) return s;
  const deck = pokerDeck(random);
  const hand: ThreeRound = { id: s.roundId + 1, player: [deck[0], deck[2], deck[4]], dealer: [deck[1], deck[3], deck[5]], bets: { ...s.bets }, result: null };
  return { ...s, roundId: hand.id, balance: s.balance - s.bets.ante - s.bets.pairPlus, hand, undo: [], lastBets: s.bets, bets: emptyBets() };
}
export function threeCardPayout(hand: Pick<ThreeRound, "player" | "dealer" | "bets">, play: boolean): ThreeResult {
  const player = evaluateThreeCard(hand.player), dealer = evaluateThreeCard(hand.dealer);
  const qualifies = dealer.category > 0 || dealer.ranks[0] >= 12;
  const comparison = Math.sign(player.score - dealer.score);
  const outcome = !play ? "fold" : !qualifies ? "unqualified" : comparison > 0 ? "win" : comparison === 0 ? "push" : "lose";
  const anteReturn = !play ? 0 : !qualifies || comparison > 0 ? 2 * hand.bets.ante : comparison === 0 ? hand.bets.ante : 0;
  const playReturn = !play ? 0 : !qualifies || comparison === 0 ? hand.bets.ante : comparison > 0 ? 2 * hand.bets.ante : 0;
  const pairReturn = play && player.category > 0 ? hand.bets.pairPlus * (threeCardPairOdds[player.category] + 1) : 0;
  const bonus = play ? hand.bets.ante * threeCardAnteBonusOdds[player.category] : 0;
  const wagered = (play ? 2 : 1) * hand.bets.ante + hand.bets.pairPlus;
  const returned = anteReturn + playReturn + pairReturn + bonus;
  return { outcome, qualifies, wagered, returned, profit: returned - wagered, anteReturn, playReturn, pairReturn, bonus };
}
export function decideThreeCard(s: ThreeState, play: boolean): ThreeState {
  if (!s.hand || s.hand.result || play && s.balance < s.hand.bets.ante) return s;
  const result = threeCardPayout(s.hand, play);
  const hand = { ...s.hand, result };
  return { ...s, hand, balance: s.balance - (play ? hand.bets.ante : 0) + result.returned, history: [hand, ...s.history].slice(0, 200),
    stats: { rounds: s.stats.rounds + 1, wins: s.stats.wins + Number(result.profit > 0), wagered: s.stats.wagered + result.wagered,
      returned: s.stats.returned + result.returned, profit: s.stats.profit + result.profit } };
}
export const nextThreeCard = (s: ThreeState): ThreeState => s.hand?.result ? { ...s, hand: null } : s;
export const resetThreeStats = (s: ThreeState): ThreeState => !s.hand || s.hand.result ? { ...s, history: [], stats: freshThreeCard().stats } : s;
function validRound(v: unknown): v is ThreeRound {
  if (!pokerObject(v) || !pokerMoney(v.id) || v.id < 1 || !validPokerCards(v.player) || !validPokerCards(v.dealer)
    || v.player.length !== 3 || v.dealer.length !== 3 || !validPokerCards([...v.player, ...v.dealer]) || !validBets(v.bets) || v.bets.ante < 20) return false;
  if (v.result === null) return true;
  if (!pokerObject(v.result)) return false;
  const expected = threeCardPayout(v as ThreeRound, v.result.outcome !== "fold");
  return Object.entries(expected).every(([k, value]) => v.result && (v.result as Record<string, unknown>)[k] === value);
}
export function readThreeCardState(v: unknown): ThreeState | null {
  if (!pokerObject(v) || v.version !== 1 || !pokerMoney(v.balance) || !threeCardChips.includes(v.selected as typeof threeCardChips[number])
    || !validBets(v.bets) || !validBets(v.lastBets) || threeCardReserve(v.bets) > v.balance || !pokerMoney(v.roundId)
    || !Array.isArray(v.undo) || v.undo.length > 100 || !v.undo.every(b => validBets(b) && threeCardReserve(b) <= (v.balance as number))
    || !Array.isArray(v.history) || v.history.length > 200 || !v.history.every(r => validRound(r) && !!r.result)
    || !(v.hand === null || validRound(v.hand)) || !pokerObject(v.stats)) return null;
  const s = v as unknown as ThreeState;
  if (![s.stats.rounds, s.stats.wins, s.stats.wagered, s.stats.returned].every(pokerMoney) || s.stats.rounds > s.roundId || s.stats.wins > s.stats.rounds
    || s.stats.profit !== s.stats.returned - s.stats.wagered || !s.history.every((r, i, a) => r.id <= s.roundId && (i === 0 || r.id < a[i - 1].id))) return null;
  if (s.hand && (s.hand.id !== s.roundId || s.bets.ante || s.bets.pairPlus || s.undo.length || !s.hand.result && s.balance < s.hand.bets.ante)) return null;
  return structuredClone(s);
}
