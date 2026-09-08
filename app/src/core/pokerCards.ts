import { browserCrypto, shuffle, type Engine } from "random-js";

export const pokerDeck = (random: Engine = browserCrypto) => shuffle(random, Array.from({ length: 52 }, (_, i) => i));
export const pokerRank = (card: number) => card % 13 + 2;
export const pokerSuit = (card: number) => Math.floor(card / 13);
export const pokerCard = (card: number, hand: number, hidden = false) => ({
  id: `poker-${hand}-${card}`, rank: ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"][card % 13],
  suit: ["s", "h", "c", "d"][pokerSuit(card)], hidden,
});
export const validPokerCards = (v: unknown): v is number[] => Array.isArray(v) && v.length <= 52
  && v.every(n => Number.isInteger(n) && n >= 0 && n < 52) && new Set(v).size === v.length;
export const pokerMoney = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 1e12;
export const pokerObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export type PokerHand = { category: number; score: number; ranks: number[]; cards: number[]; label: string };
export const holdemHandNames = ["高牌", "一对", "两对", "三条", "顺子", "同花", "葫芦", "四条", "同花顺"];
export const threeCardHandNames = ["高牌", "一对", "同花", "顺子", "三条", "同花顺"];
const score = (category: number, ranks: number[]) => Array.from({ length: 5 }, (_, i) => ranks[i] ?? 0).reduce((n, rank) => n * 15 + rank, category);
function straightHigh(ranks: number[], length: number) {
  const unique = new Set(ranks);
  if (unique.has(14)) unique.add(1);
  for (let high = 14; high >= length; high--) {
    if (Array.from({ length }, (_, i) => high - i).every(n => unique.has(n))) return high;
  }
  return 0;
}

/** Evaluates the best five from five to seven cards; suits never break a tie. */
export function evaluateHoldem(cards: readonly number[]): PokerHand {
  if (cards.length < 5 || cards.length > 7 || !validPokerCards(cards)) throw new Error("Expected five to seven distinct cards");
  const ordered = [...cards].sort((a, b) => pokerRank(b) - pokerRank(a));
  const ranks = ordered.map(pokerRank);
  const groups = [...new Set(ranks)].map(rank => ({ rank, count: ranks.filter(n => n === rank).length }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank);
  const flush = [0, 1, 2, 3].map(suit => ordered.filter(c => pokerSuit(c) === suit)).find(a => a.length >= 5);
  const straightCards = (source: number[], high: number) => Array.from({ length: 5 }, (_, i) => source.find(c => pokerRank(c) === (high - i === 1 ? 14 : high - i))!);
  const make = (category: number, values: number[], best: number[]): PokerHand => ({ category, ranks: values, score: score(category, values), cards: best,
    label: category === 8 && values[0] === 14 ? "皇家同花顺" : holdemHandNames[category] });
  const byRanks = (values: number[]) => values.flatMap(rank => ordered.filter(c => pokerRank(c) === rank));
  const sf = flush && straightHigh(flush.map(pokerRank), 5);
  if (sf) return make(8, [sf], straightCards(flush!, sf));
  if (groups[0].count === 4) {
    const kicker = ranks.find(r => r !== groups[0].rank)!;
    return make(7, [groups[0].rank, kicker], [...byRanks([groups[0].rank]), byRanks([kicker])[0]]);
  }
  const trips = groups.filter(g => g.count >= 3);
  const pair = trips.length && groups.find(g => g.rank !== trips[0].rank && g.count >= 2);
  if (pair) return make(6, [trips[0].rank, pair.rank], [...byRanks([trips[0].rank]).slice(0, 3), ...byRanks([pair.rank]).slice(0, 2)]);
  if (flush) return make(5, flush.slice(0, 5).map(pokerRank), flush.slice(0, 5));
  const straight = straightHigh(ranks, 5);
  if (straight) return make(4, [straight], straightCards(ordered, straight));
  if (trips.length) {
    const kickers = ordered.filter(c => pokerRank(c) !== trips[0].rank).slice(0, 2);
    return make(3, [trips[0].rank, ...kickers.map(pokerRank)], [...byRanks([trips[0].rank]), ...kickers]);
  }
  const pairs = groups.filter(g => g.count === 2).map(g => g.rank).sort((a, b) => b - a);
  if (pairs.length >= 2) {
    const kicker = ordered.find(c => !pairs.slice(0, 2).includes(pokerRank(c)))!;
    return make(2, [...pairs.slice(0, 2), pokerRank(kicker)], [...byRanks(pairs.slice(0, 2)), kicker]);
  }
  if (pairs.length) {
    const kickers = ordered.filter(c => pokerRank(c) !== pairs[0]).slice(0, 3);
    return make(1, [pairs[0], ...kickers.map(pokerRank)], [...byRanks(pairs), ...kickers]);
  }
  return make(0, ranks.slice(0, 5), ordered.slice(0, 5));
}

/** Three-card ranking differs from Hold'em: a straight beats a flush. */
export function evaluateThreeCard(cards: readonly number[]): PokerHand {
  if (cards.length !== 3 || !validPokerCards(cards)) throw new Error("Expected three distinct cards");
  const ordered = [...cards].sort((a, b) => pokerRank(b) - pokerRank(a));
  const ranks = ordered.map(pokerRank);
  const flush = ordered.every(c => pokerSuit(c) === pokerSuit(ordered[0]));
  const high = straightHigh(ranks, 3);
  const pairs = ranks.find(r => ranks.filter(n => n === r).length === 2);
  const category = flush && high ? 5 : new Set(ranks).size === 1 ? 4 : high ? 3 : flush ? 2 : pairs ? 1 : 0;
  const values = category === 5 || category === 3 ? [high] : category === 4 ? [ranks[0]] : pairs ? [pairs, ranks.find(r => r !== pairs)!] : ranks;
  return { category, ranks: values, score: score(category, values), cards: ordered, label: threeCardHandNames[category] };
}
