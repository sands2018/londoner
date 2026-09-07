import { BaccaratGameEngine, BaccaratResultsEngine, Card, RoadmapGenerator, type GameResult } from "baccarat-engine";
import { browserCrypto, shuffle, type Engine } from "random-js";

export const baccaratChips = [10, 20, 30, 50, 100, 500, 1000] as const;
export const baccaratMinimum = 20;
export const baccaratMaximum = 100000;
export const baccaratCut = 16;
export const baccaratBetIds = ["player", "tie", "banker", "player-pair", "banker-pair"] as const;
export type BaccaratBet = typeof baccaratBetIds[number];
export type BaccaratOutcome = "player" | "banker" | "tie";
export type BaccaratBets = Partial<Record<BaccaratBet, number>>;
export const baccaratLabels: Record<BaccaratBet, string> = { player: "闲", banker: "庄", tie: "和", "player-pair": "闲对", "banker-pair": "庄对" };
export const baccaratOdds: Record<BaccaratBet, string> = { player: "1:1", banker: "0.95:1", tie: "8:1", "player-pair": "11:1", "banker-pair": "11:1" };
export type BaccaratRound = {
  id: number; shoeNumber: number; player: number[]; banker: number[]; outcome: BaccaratOutcome;
  playerPair: boolean; bankerPair: boolean; natural: boolean; bets: BaccaratBets;
  wagered: number; returned: number; profit: number; commission: number;
};
export type BaccaratStats = {
  rounds: number; wagered: number; returned: number; profit: number; commission: number;
  player: number; banker: number; tie: number; playerPair: number; bankerPair: number;
};
export type BaccaratState = {
  version: 1; balance: number; selected: number; bets: BaccaratBets; undo: BaccaratBets[]; lastBets: BaccaratBets;
  shoe: number[]; shoeNumber: number; roundId: number; settled: BaccaratRound | null;
  history: BaccaratRound[]; shoeRounds: BaccaratRound[]; stats: BaccaratStats;
};
const emptyStats = (): BaccaratStats => ({ rounds: 0, wagered: 0, returned: 0, profit: 0, commission: 0, player: 0, banker: 0, tie: 0, playerPair: 0, bankerPair: 0 });
export const freshBaccarat = (): BaccaratState => ({ version: 1, balance: 10000, selected: 20, bets: {}, undo: [], lastBets: {}, shoe: [], shoeNumber: 0, roundId: 0, settled: null, history: [], shoeRounds: [], stats: emptyStats() });
export const baccaratWager = (bets: BaccaratBets) => Object.values(bets).reduce((a, b) => a + (b ?? 0), 0);
export const baccaratUnderMinimum = (bets: BaccaratBets) => baccaratBetIds.filter(id => (bets[id] ?? 0) > 0 && bets[id]! < baccaratMinimum);
const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const suits = ["club", "diamond", "heart", "spade"];
const suitCodes = ["c", "d", "h", "s"];
type ShoeCard = Card & { id: number };
const engineCard = (id: number): ShoeCard => Object.assign(new Card(suits[Math.floor(id % 52 / 13)], ranks[id % 13]), { id });
const results = new BaccaratResultsEngine();
export const baccaratPoints = (cards: readonly number[]) => results.calculateHandValue(cards.map(engineCard));
export const baccaratCard = (id: number, shoeNumber: number, hidden = false) => ({ id: `bac-${shoeNumber}-${id}`, rank: ranks[id % 13], suit: suitCodes[Math.floor(id % 52 / 13)], hidden });

// The library owns the drawing tableau; we supply a persisted, securely shuffled shoe.
export function drawBaccarat(shoe: readonly number[]) {
  if (shoe.length < 6) throw new Error("Not enough cards to complete a round");
  const engine = new BaccaratGameEngine();
  engine.shoe.cards = shoe.map(engineCard);
  const hand = engine.dealGame();
  const ids = (cards: Card[]) => cards.map(card => (card as ShoeCard).id);
  const player = ids(hand.playerCards), banker = ids(hand.bankerCards);
  const pair = results.calculatePairs({ playerCards: hand.playerCards.slice(0, 2), bankerCards: hand.bankerCards.slice(0, 2) });
  return {
    player, banker, shoe: ids(engine.shoe.cards), outcome: results.calculateOutcome(hand) as BaccaratOutcome,
    // v1.1.5's calculatePairs checks exactly two cards; pairs refer to the initial two even after a draw.
    playerPair: pair === "player" || pair === "both", bankerPair: pair === "banker" || pair === "both",
    natural: baccaratPoints(player.slice(0, 2)) >= 8 || baccaratPoints(banker.slice(0, 2)) >= 8,
  };
}
export const baccaratSequence = (r: Pick<BaccaratRound, "player" | "banker">) => [
  { side: "player", id: r.player[0] }, { side: "banker", id: r.banker[0] },
  { side: "player", id: r.player[1] }, { side: "banker", id: r.banker[1] },
  ...(r.player.length === 3 ? [{ side: "player", id: r.player[2] }] : []),
  ...(r.banker.length === 3 ? [{ side: "banker", id: r.banker[2] }] : []),
] as { side: "player" | "banker"; id: number }[];

export function baccaratReturn(id: BaccaratBet, amount: number, r: Pick<BaccaratRound, "outcome" | "playerPair" | "bankerPair">) {
  if (id === "player-pair") return r.playerPair ? amount * 12 : 0;
  if (id === "banker-pair") return r.bankerPair ? amount * 12 : 0;
  if (id === "tie") return r.outcome === "tie" ? amount * 9 : 0;
  if (r.outcome === "tie") return amount;
  if (r.outcome !== id) return 0;
  return id === "banker" ? amount * 39 / 20 : amount * 2;
}
function changeBets(s: BaccaratState, bets: BaccaratBets): BaccaratState {
  if (s.settled || !validBets(bets) || baccaratWager(bets) > s.balance) return s;
  return { ...s, bets, undo: [...s.undo.slice(-99), s.bets] };
}
export const placeBaccaratBet = (s: BaccaratState, id: BaccaratBet) => baccaratBetIds.includes(id) && baccaratChips.includes(s.selected as typeof baccaratChips[number]) ? changeBets(s, { ...s.bets, [id]: (s.bets[id] ?? 0) + s.selected }) : s;
export const undoBaccaratBet = (s: BaccaratState): BaccaratState => !s.settled && s.undo.length ? { ...s, bets: s.undo[s.undo.length - 1], undo: s.undo.slice(0, -1) } : s;
export const clearBaccaratBets = (s: BaccaratState) => baccaratWager(s.bets) ? changeBets(s, {}) : s;
export const repeatBaccaratBets = (s: BaccaratState) => baccaratWager(s.lastBets) ? changeBets(s, { ...s.lastBets }) : s;
export const doubleBaccaratBets = (s: BaccaratState) => baccaratWager(s.bets) ? changeBets(s, Object.fromEntries(Object.entries(s.bets).map(([id, n]) => [id, n * 2]))) : s;
export const nextBaccaratRound = (s: BaccaratState): BaccaratState => s.settled ? { ...s, settled: null } : s;
export const resetBaccaratStats = (s: BaccaratState): BaccaratState => ({ ...s, stats: emptyStats(), history: [] });

export function dealBaccarat(s: BaccaratState, random: Engine = browserCrypto): BaccaratState {
  const wagered = baccaratWager(s.bets);
  if (s.settled || !validBets(s.bets) || !wagered || wagered > s.balance || baccaratUnderMinimum(s.bets).length) return s;
  const newShoe = s.shoe.length <= baccaratCut;
  // Eight decks, burn eight cards, cut sixteen cards from the end. Never reshuffle mid-round.
  const shoe = newShoe ? shuffle(random, Array.from({ length: 416 }, (_, i) => i)).slice(0, -8) : s.shoe;
  const shoeNumber = s.shoeNumber + Number(newShoe);
  const drawn = drawBaccarat(shoe);
  const returned = baccaratBetIds.reduce((sum, id) => sum + baccaratReturn(id, s.bets[id] ?? 0, drawn), 0);
  const commission = drawn.outcome === "banker" ? (s.bets.banker ?? 0) / 20 : 0;
  const round: BaccaratRound = { id: s.roundId + 1, shoeNumber, player: drawn.player, banker: drawn.banker, outcome: drawn.outcome, playerPair: drawn.playerPair, bankerPair: drawn.bankerPair, natural: drawn.natural, bets: { ...s.bets }, wagered, returned, profit: returned - wagered, commission };
  const stats = s.stats;
  return { ...s, balance: s.balance + round.profit, shoe: drawn.shoe, shoeNumber, roundId: round.id, bets: {}, undo: [], lastBets: round.bets, settled: round,
    history: [round, ...s.history].slice(0, 200), shoeRounds: [...(newShoe ? [] : s.shoeRounds), round],
    stats: { ...stats, rounds: stats.rounds + 1, wagered: stats.wagered + wagered, returned: stats.returned + returned, profit: stats.profit + round.profit, commission: stats.commission + commission,
      [round.outcome]: stats[round.outcome] + 1, playerPair: stats.playerPair + Number(round.playerPair), bankerPair: stats.bankerPair + Number(round.bankerPair) },
  };
}

const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const money = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v * 2) && v >= 0 && v <= 1e12;
const count = (v: unknown): v is number => money(v) && Number.isInteger(v);
const cards = (v: unknown): v is number[] => Array.isArray(v) && v.length <= 416 && v.every(n => Number.isInteger(n) && n >= 0 && n < 416) && new Set(v).size === v.length;
function validBets(v: unknown): v is BaccaratBets {
  return object(v) && Object.entries(v).every(([id, n]) => baccaratBetIds.includes(id as BaccaratBet) && money(n) && n > 0 && n % 10 === 0) && baccaratWager(v as BaccaratBets) <= baccaratMaximum;
}
function validRound(v: unknown): v is BaccaratRound {
  if (!object(v) || !count(v.id) || v.id < 1 || !count(v.shoeNumber) || v.shoeNumber < 1 || !cards(v.player) || !cards(v.banker)
    || ![2, 3].includes(v.player.length) || ![2, 3].includes(v.banker.length) || !cards([...v.player, ...v.banker]) || !validBets(v.bets) || !baccaratWager(v.bets) || baccaratUnderMinimum(v.bets).length) return false;
  const sequence = baccaratSequence({ player: v.player, banker: v.banker }).map(c => c.id);
  const check = drawBaccarat([...sequence, 414, 415].reverse());
  if (JSON.stringify(check.player) !== JSON.stringify(v.player) || JSON.stringify(check.banker) !== JSON.stringify(v.banker)
    || check.outcome !== v.outcome || check.playerPair !== v.playerPair || check.bankerPair !== v.bankerPair || check.natural !== v.natural) return false;
  const bets = v.bets;
  const returned = baccaratBetIds.reduce((sum, id) => sum + baccaratReturn(id, bets[id] ?? 0, check), 0);
  return v.wagered === baccaratWager(v.bets) && v.returned === returned && v.profit === returned - v.wagered
    && v.commission === (check.outcome === "banker" ? (v.bets.banker ?? 0) / 20 : 0);
}
export function readBaccaratState(v: unknown): BaccaratState | null {
  if (!object(v) || v.version !== 1 || !money(v.balance) || !baccaratChips.includes(v.selected as typeof baccaratChips[number])
    || !validBets(v.bets) || baccaratWager(v.bets) > v.balance || !validBets(v.lastBets) || !Array.isArray(v.undo) || v.undo.length > 100 || !v.undo.every(b => validBets(b) && baccaratWager(b) <= (v.balance as number))
    || !count(v.roundId) || !count(v.shoeNumber) || !cards(v.shoe) || !Array.isArray(v.history) || v.history.length > 200 || !v.history.every(validRound)
    || !Array.isArray(v.shoeRounds) || v.shoeRounds.length > 104 || !v.shoeRounds.every(validRound) || !object(v.stats)) return null;
  const s = v as unknown as BaccaratState;
  if (!Object.keys(emptyStats()).filter(k => k !== "profit").every(k => money(s.stats[k as keyof BaccaratStats])) || ![s.stats.rounds, s.stats.player, s.stats.banker, s.stats.tie, s.stats.playerPair, s.stats.bankerPair].every(count)
    || s.stats.rounds !== s.stats.player + s.stats.banker + s.stats.tie || s.stats.rounds > s.roundId || s.stats.playerPair > s.stats.rounds || s.stats.bankerPair > s.stats.rounds
    || s.stats.profit !== s.stats.returned - s.stats.wagered) return null;
  if (!s.history.every((r, i, a) => r.id <= s.roundId && r.shoeNumber <= s.shoeNumber && (i === 0 || r.id < a[i - 1].id))
    || !s.shoeRounds.every((r, i, a) => r.shoeNumber === s.shoeNumber && r.id <= s.roundId && (i === 0 || r.id === a[i - 1].id + 1))) return null;
  const played = s.shoeRounds.flatMap(r => [...r.player, ...r.banker]);
  if (!cards([...s.shoe, ...played]) || (s.shoeNumber === 0 ? s.shoe.length || s.roundId || s.shoeRounds.length : s.shoe.length + played.length !== 408 || s.shoeRounds.at(-1)?.id !== s.roundId)) return null;
  if (!(s.settled === null || validRound(s.settled) && s.settled.id === s.roundId && !baccaratWager(s.bets) && !s.undo.length && JSON.stringify(s.settled) === JSON.stringify(s.shoeRounds.at(-1)))) return null;
  return structuredClone(s);
}

export type BaccaratRoadCell = { row: number; column: number; outcome?: BaccaratOutcome; ties: number; playerPair: boolean; bankerPair: boolean };
export function baccaratRoad(rounds: readonly BaccaratRound[], kind: "beads" | "big", columns = 18): BaccaratRoadCell[] {
  const data = rounds.map(r => ({ outcome: r.outcome, natural: "none", pair: r.playerPair && r.bankerPair ? "both" : r.playerPair ? "player" : r.bankerPair ? "banker" : "none" })) as GameResult[];
  const road = new RoadmapGenerator();
  // Published types wrap results in objects, while v1.1.5 returns arrays directly.
  type Item = { row: number; column: number; ties?: unknown[]; result: Partial<GameResult> };
  // Keep the whole shoe. Horizontal scrolling belongs to the viewport, not the generator.
  const items = (kind === "big" ? road.bigRoad(data, { rows: 6, columns, scroll: false }) : road.beadPlate(data, { rows: 6, columns: Math.max(columns, Math.ceil(data.length / 6)) })) as unknown as Item[];
  return items.map(i => ({ row: i.row, column: i.column, outcome: i.result.outcome as BaccaratOutcome | undefined, ties: i.ties?.length ?? 0, playerPair: i.result.pair === "player" || i.result.pair === "both", bankerPair: i.result.pair === "banker" || i.result.pair === "both" }));
}
