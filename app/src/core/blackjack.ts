// The package's published entry points at an absent dist file. Pin its version
// and import the browser-safe engine source, without its CLI or input handlers.
import Game from "@blackjacktrainer/blackjack-simulator/src/game";
import { Event } from "@blackjacktrainer/blackjack-simulator/src/event-emitter";
import { BlackjackPayout, GameStep, HandWinner, Move, rankToString, suitToString } from "@blackjacktrainer/blackjack-simulator/src/types";
import type Card from "@blackjacktrainer/blackjack-simulator/src/card";
import type Hand from "@blackjacktrainer/blackjack-simulator/src/hand";

export const blackjackChips = [10, 20, 30, 50, 100, 500, 1000] as const;
export const blackjackMinimum = 30;
export const blackjackInitialBalance = 10000;
export type BlackjackAction = "hit" | "stand" | "double" | "split" | "insurance" | "decline";
export type BlackjackPhase = "betting" | "insurance" | "playing" | "settled";
export type BlackjackCard = { id: string; rank: string; suit: string; hidden: boolean };
export type BlackjackHand = {
  id: string; cards: BlackjackCard[]; total: number; soft: boolean; natural: boolean;
  bet: number; result: "win" | "lose" | "push" | null;
};
export type BlackjackRound = { id: number; wagered: number; returned: number; profit: number; voided?: boolean };
export type BlackjackStats = { rounds: number; wagered: number; returned: number; profit: number; wins: number; losses: number; pushes: number };
export type BlackjackView = {
  phase: BlackjackPhase; balance: number; pendingBet: number; lastBet: number; selectedChip: number;
  shoeNumber: number; cardsLeft: number; shuffleNext: boolean; dealer: BlackjackHand;
  hands: BlackjackHand[]; activeHand: number; insurance: number; actions: BlackjackAction[];
  stats: BlackjackStats; history: BlackjackRound[]; lastRound: BlackjackRound | null;
};
type SavedHand = { cards: number[]; bet: number; splits: number; winner: HandWinner | null };
export type SavedBlackjack = {
  version: 1; shoe: { rank: number; suit: number; face: boolean }[]; cardIndex: number;
  step: GameStep; focused: number; dealer: SavedHand; hands: SavedHand[];
  balance: number; bet: number; pending: number[]; selected: number; lastBet: number;
  insurance: number; roundStartBalance: number; roundId: number; shoeNumber: number;
  stats: BlackjackStats; history: BlackjackRound[];
};
const emptyStats = (): BlackjackStats => ({ rounds: 0, wagered: 0, returned: 0, profit: 0, wins: 0, losses: 0, pushes: 0 });
const actionMoves: Record<BlackjackAction, Move> = {
  hit: Move.Hit, stand: Move.Stand, double: Move.Double, split: Move.Split,
  insurance: Move.NoInsurance, decline: Move.NoInsurance,
};
const waitingSteps = [GameStep.WaitingForInsuranceInput, GameStep.WaitingForPlayInput, GameStep.WaitingForNewGameInput];
const money = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1e12;

export class BlackjackTable {
  readonly engine: Game;
  private pending: number[] = [30];
  private selected = 30;
  private lastBet = 30;
  private insurance = 0;
  private roundStartBalance = blackjackInitialBalance;
  private roundId = 0;
  private shoeNumber = 1;
  private stats = emptyStats();
  private history: BlackjackRound[] = [];
  private roundVoided = false;

  constructor(saved?: SavedBlackjack) {
    this.engine = new Game({
      deckCount: 2, penetration: 0.75, hitSoft17: false,
      blackjackPayout: BlackjackPayout.ThreeToTwo, allowDoubleAfterSplit: true,
      allowLateSurrender: false, allowResplitAces: false, maxHandsAllowed: 4,
      minimumBet: blackjackMinimum, maximumBet: 100000, playerBankroll: blackjackInitialBalance,
      playerCount: 1, autoDeclineInsurance: false,
    });
    this.engine.on(Event.Shuffle, () => {
      this.shoeNumber += 1;
      this.engine.shoe.drawCard({ showingFace: false });
    });
    // If an exceptionally long split round exhausts the reserve, the engine
    // voids the round. Refund already-busted hands and insurance as well.
    this.engine.pushAllPlayersHands = () => {
      this.roundVoided = true;
      this.engine.player.handWinner.clear();
      this.engine.player.balance = this.roundStartBalance - this.engine.player.hands.reduce((sum, hand) => sum + hand.betAmount, 0);
      this.engine.player.hands.forEach((hand) => this.engine.player.setHandWinner({ hand, winner: HandWinner.Push }));
      const hole = this.engine.dealer.cards[0];
      if (hole && !hole.showingFace) {
        this.engine.dealer.firstHand.incrementTotalsForCard(hole);
        hole.flip();
      }
    };
    this.engine.shoe.drawCard({ showingFace: false });
    if (saved) this.restore(saved);
  }

  get phase(): BlackjackPhase {
    switch (this.engine.state.step) {
      case GameStep.Start: return "betting";
      case GameStep.WaitingForInsuranceInput: return "insurance";
      case GameStep.WaitingForNewGameInput: return "settled";
      default: return "playing";
    }
  }

  private get canBet() { return this.phase === "betting" || this.phase === "settled"; }
  private get pendingBet() { return this.pending.reduce((sum, chip) => sum + chip, 0); }

  selectChip(chip: number) {
    if (blackjackChips.some((value) => value === chip)) this.selected = chip;
  }

  addChip(chip = this.selected): boolean {
    if (!this.canBet || !blackjackChips.some((value) => value === chip)) return false;
    if (this.pendingBet + chip > Math.min(this.engine.player.balance, 100000)) return false;
    this.pending.push(chip);
    return true;
  }

  undoBet() { if (this.canBet) this.pending.pop(); }
  clearBet() { if (this.canBet) this.pending = []; }
  repeatBet() {
    if (this.canBet && this.lastBet <= this.engine.player.balance) this.pending = [this.lastBet];
  }

  deal(): boolean {
    if (!this.canBet || this.pendingBet < blackjackMinimum || this.pendingBet > 100000 || this.pendingBet > this.engine.player.balance) return false;
    if (this.phase === "settled") this.engine.step(Move.Stand);
    this.lastBet = this.pendingBet;
    this.engine.betAmount = this.lastBet;
    this.insurance = 0;
    this.roundVoided = false;
    this.roundId += 1;
    this.roundStartBalance = this.engine.player.balance;
    this.engine.step();
    this.advance();
    return true;
  }

  actions(): BlackjackAction[] {
    if (this.phase === "insurance") {
      return this.engine.player.balance >= this.engine.betAmount / 2 ? ["insurance", "decline"] : ["decline"];
    }
    if (this.phase !== "playing") return [];
    const hand = this.engine.focusedHand;
    const actions: BlackjackAction[] = ["hit", "stand"];
    if (hand.allowDouble && !hand.fromAceSplit && this.engine.player.balance >= hand.betAmount) actions.push("double");
    if (hand.allowSplit && !hand.fromAceSplit && this.engine.player.handsCount < 4 && this.engine.player.balance >= hand.betAmount) actions.push("split");
    return actions;
  }

  act(action: BlackjackAction): boolean {
    if (!this.actions().includes(action)) return false;
    // Insurance is a separate side wager. The upstream engine adds insurance
    // to the main hand's stake, so keep it separate here to avoid overpaying it.
    if (action === "insurance") {
      this.insurance = this.engine.betAmount / 2;
      this.engine.player.balance -= this.insurance;
    }
    this.engine.step(actionMoves[action]);
    if (action === "insurance" && this.engine.dealer.blackjack) this.engine.player.addChips(this.insurance * 3);
    this.advance();
    return true;
  }

  private advance() {
    // Engine steps are synchronous; stop only at an actual player decision.
    for (let i = 0; i < 20; i += 1) {
      const step = this.engine.state.step;
      if (step === GameStep.WaitingForPlayInput && (this.engine.focusedHand.fromAceSplit || this.engine.focusedHand.cardTotal >= 21)) {
        this.engine.step(Move.Stand);
      } else if (!waitingSteps.includes(step)) {
        this.engine.step();
      } else break;
    }
    if (this.phase === "settled" && this.history[0]?.id !== this.roundId) {
      const wagered = this.engine.player.hands.reduce((sum, hand) => sum + hand.betAmount, 0) + this.insurance;
      const profit = this.engine.player.balance - this.roundStartBalance;
      const round = { id: this.roundId, wagered, returned: wagered + profit, profit, ...(this.roundVoided ? { voided: true } : {}) };
      this.history = [round, ...this.history].slice(0, 50);
      this.stats = {
        rounds: this.stats.rounds + 1, wagered: this.stats.wagered + wagered,
        returned: this.stats.returned + round.returned, profit: this.stats.profit + profit,
        wins: this.stats.wins + Number(profit > 0), losses: this.stats.losses + Number(profit < 0),
        pushes: this.stats.pushes + Number(profit === 0),
      };
      this.pending = this.lastBet <= this.engine.player.balance ? [this.lastBet] : [];
    }
  }

  resetStats(): boolean {
    if (!this.canBet) return false;
    this.stats = emptyStats();
    this.history = [];
    return true;
  }

  addPracticeCredits(): boolean {
    if (!this.canBet) return false;
    this.engine.player.addChips(blackjackInitialBalance);
    return true;
  }

  private handView(hand: Hand): BlackjackHand {
    const result = this.engine.player.handWinner.get(hand.id);
    return {
      id: hand.id,
      cards: hand.cards.map((card) => ({ id: card.id, rank: card.showingFace ? rankToString(card.rank).replace("T", "10") : "", suit: card.showingFace ? suitToString(card.suit) : "", hidden: !card.showingFace })),
      total: hand.cardTotal, soft: hand.isSoft, natural: hand.blackjack, bet: hand.betAmount,
      result: result === undefined ? null : result === HandWinner.Player ? "win" : result === HandWinner.Dealer ? "lose" : "push",
    };
  }

  view(): BlackjackView {
    return {
      phase: this.phase, balance: this.engine.player.balance, pendingBet: this.pendingBet,
      lastBet: this.lastBet, selectedChip: this.selected, shoeNumber: this.shoeNumber,
      cardsLeft: this.engine.shoe.cardCount, shuffleNext: this.engine.shoe.needsReset,
      dealer: this.handView(this.engine.dealer.firstHand), hands: this.engine.player.hands.map((h) => this.handView(h)),
      activeHand: this.engine.state.focusedHandIndex, insurance: this.insurance, actions: this.actions(),
      stats: { ...this.stats }, history: [...this.history], lastRound: this.history[0] ?? null,
    };
  }

  save(): SavedBlackjack {
    const shoe = this.engine.shoe;
    const saveHand = (hand: Hand): SavedHand => ({
      cards: hand.cards.map((c) => shoe.cards.indexOf(c)), bet: hand.betAmount,
      splits: hand.splitCount, winner: this.engine.player.handWinner.get(hand.id) ?? null,
    });
    return {
      version: 1, shoe: shoe.cards.map((c) => ({ rank: c.rank, suit: c.suit, face: c.showingFace })), cardIndex: shoe.currentCardIndex,
      step: this.engine.state.step, focused: this.engine.state.focusedHandIndex,
      dealer: saveHand(this.engine.dealer.firstHand), hands: this.engine.player.hands.map(saveHand),
      balance: this.engine.player.balance, bet: this.engine.betAmount, pending: [...this.pending],
      selected: this.selected, lastBet: this.lastBet, insurance: this.insurance,
      roundStartBalance: this.roundStartBalance, roundId: this.roundId, shoeNumber: this.shoeNumber,
      stats: { ...this.stats }, history: [...this.history],
    };
  }

  private restore(saved: SavedBlackjack) {
    if (!isSavedBlackjack(saved)) throw new Error("Invalid blackjack session");
    const available = [...this.engine.shoe.cards];
    const cards = saved.shoe.map((item) => {
      const index = available.findIndex((c) => c.rank === item.rank && c.suit === item.suit);
      const card = available.splice(index, 1)[0];
      card.showingFace = item.face;
      return card;
    });
    this.engine.shoe.cards = cards;
    this.engine.shoe.currentCardIndex = saved.cardIndex;
    const restoreHand = (record: SavedHand, player: Game["player"]) => {
      const hand = player.addHand(0, record.cards.map((i) => cards[i] as Card));
      hand.betAmount = record.bet;
      hand.splitCount = record.splits;
      if (record.winner !== null) player.handWinner.set(hand.id, record.winner);
    };
    restoreHand(saved.dealer, this.engine.dealer);
    // A pristine betting state has no dealer hand yet.
    if (saved.step === GameStep.Start) this.engine.dealer.removeCards();
    saved.hands.forEach((hand) => restoreHand(hand, this.engine.player));
    this.engine.player.balance = saved.balance;
    this.engine.betAmount = saved.bet;
    this.engine.state.step = saved.step;
    this.engine.state.focusedHandIndex = saved.focused;
    this.pending = [...saved.pending];
    this.selected = saved.selected;
    this.lastBet = saved.lastBet;
    this.insurance = saved.insurance;
    this.roundStartBalance = saved.roundStartBalance;
    this.roundId = saved.roundId;
    this.shoeNumber = saved.shoeNumber;
    this.stats = { ...saved.stats };
    this.history = [...saved.history];
  }
}

export function isSavedBlackjack(value: unknown): value is SavedBlackjack {
  if (!value || typeof value !== "object") return false;
  const s = value as SavedBlackjack;
  if (s.version !== 1 || !Array.isArray(s.shoe) || s.shoe.length !== 104) return false;
  const counts = new Map<string, number>();
  for (const c of s.shoe) {
    if (!c || !Number.isInteger(c.rank) || c.rank < 0 || c.rank > 12 || !Number.isInteger(c.suit) || c.suit < 0 || c.suit > 3 || typeof c.face !== "boolean") return false;
    const key = `${c.rank}:${c.suit}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if (counts.size !== 52 || [...counts.values()].some((n) => n !== 2)) return false;
  if (!Number.isInteger(s.cardIndex) || s.cardIndex < -1 || s.cardIndex > 103) return false;
  if (![GameStep.Start, ...waitingSteps].includes(s.step)) return false;
  if (!Array.isArray(s.hands) || s.hands.length > 4 || (s.step !== GameStep.Start && s.hands.length === 0)) return false;
  if (!s.dealer || !Array.isArray(s.dealer.cards)) return false;
  if (s.step === GameStep.Start && (s.hands.length !== 0 || s.dealer.cards.length !== 0)) return false;
  if (s.step !== GameStep.Start && (s.dealer.cards.length < 2 || s.hands.some((h) => !h || !Array.isArray(h.cards) || h.cards.length < 2))) return false;
  if (!Number.isInteger(s.focused) || s.focused < 0 || s.focused >= Math.max(1, s.hands.length)) return false;
  const used = new Set<number>();
  for (const h of [s.dealer, ...s.hands]) {
    if (!h || !Array.isArray(h.cards) || h.cards.length > 24 || !money(h.bet) || !Number.isInteger(h.splits) || h.splits < 0 || h.splits > 3) return false;
    if (h.winner !== null && ![HandWinner.Player, HandWinner.Dealer, HandWinner.Push].includes(h.winner)) return false;
    for (const i of h.cards) {
      if (!Number.isInteger(i) || i <= s.cardIndex || i > 103 || used.has(i)) return false;
      used.add(i);
    }
  }
  if (![s.balance, s.bet, s.lastBet, s.insurance, s.roundStartBalance, s.roundId, s.shoeNumber].every(money)) return false;
  if (!Array.isArray(s.pending) || s.pending.length > 10000 || !s.pending.every(money)) return false;
  if (!blackjackChips.some((n) => n === s.selected)) return false;
  if (!s.stats || ![s.stats.rounds, s.stats.wagered, s.stats.returned, s.stats.wins, s.stats.losses, s.stats.pushes].every(money) || !Number.isFinite(s.stats.profit)) return false;
  if (!Array.isArray(s.history) || s.history.length > 50 || !s.history.every((r) => r && [r.id, r.wagered, r.returned].every(money) && Number.isFinite(r.profit))) return false;
  return true;
}
