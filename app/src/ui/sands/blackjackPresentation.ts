import type { BlackjackCard, BlackjackPlayback, BlackjackView } from "../../core/blackjack";

export type TableMotion = "collect" | "shuffle" | "deal" | "reveal" | "split" | "wager" | "settle" | "result";
export type TableFrame = { view: BlackjackView; motion: TableMotion; cardId?: string };
export const tableCards = (v: BlackjackView) => [...v.dealer.cards, ...v.hands.flatMap((h) => h.cards)];
export const dealerDisplayCards = (cards: BlackjackCard[]) => cards.length < 2 ? cards : [cards[1], cards[0], ...cards.slice(2)];
const stake = (v: BlackjackView) => v.hands.reduce((sum, h) => sum + h.bet, 0) + v.insurance;
const layout = (v: BlackjackView) => v.hands.map((h) => h.cards.map((c) => c.id).join(",")).join("|");

export function splitHandState(view: BlackjackView, index: number, busy: boolean): "active" | "processing" | "waiting" | "complete" | null {
  const hand = view.hands[index];
  if (!hand || view.hands.length < 2 || view.phase === "betting") return null;
  if (view.phase === "settled" || index < view.activeHand || hand.total >= 21 || hand.result) return "complete";
  if (index > view.activeHand) return "waiting";
  return busy ? "processing" : "active";
}

export function blackjackNextFrames({ before, after }: BlackjackPlayback): TableFrame[] {
  const frames: TableFrame[] = [{ view: before, motion: "collect" }];
  if (before.shoeNumber !== after.shoeNumber) frames.push({ view: after, motion: "shuffle" });
  return frames;
}

export function blackjackFrames(playback: BlackjackPlayback, dealing: boolean): TableFrame[] {
  const { before, snapshots, after } = playback;
  const frames: TableFrame[] = [];
  let current = before;
  let started = !dealing;
  if (dealing && tableCards(before).length) frames.push({ view: before, motion: "collect" });
  if (dealing) {
    current = { ...before, dealer: { ...before.dealer, cards: [], total: 0, natural: false, soft: false }, hands: [], insurance: 0 };
    if (after.shoeNumber !== before.shoeNumber) frames.push({ view: current, motion: "shuffle" });
  }
  for (const snapshot of snapshots) {
    const cards = tableCards(snapshot);
    if (!started) {
      // Reset emits partially cleared old hands; the first new card starts the round.
      if (snapshot.phase !== "betting" || cards.length !== 1 || !snapshot.hands[0]?.cards.length) continue;
      started = true;
    }
    if (!snapshot.hands.length || snapshot.hands.some((h) => h.bet === 0)) continue;
    const old = new Map(tableCards(current).map((c) => [c.id, c]));
    const incoming = cards.find((c) => !old.has(c.id));
    const revealed = cards.find((c) => !c.hidden && old.get(c.id)?.hidden);
    const split = snapshot.hands.length > current.hands.length && !incoming && layout(snapshot) !== layout(current);
    const wager = stake(snapshot) !== stake(current);
    const motion = incoming ? "deal" : revealed ? "reveal" : split ? "split" : wager ? "wager" : null;
    if (!motion) continue;
    const view: BlackjackView = {
      ...snapshot, phase: "playing", actions: [],
      balance: before.balance - Math.max(0, stake(snapshot) - (dealing ? 0 : stake(before))),
      pendingBet: before.pendingBet, stats: before.stats, history: before.history, lastRound: before.lastRound,
      hands: snapshot.hands.map((h) => ({ ...h, result: null })),
    };
    frames.push({ view, motion, cardId: incoming?.id ?? revealed?.id });
    current = view;
  }
  if (after.phase === "settled") {
    frames.push({ view: current, motion: "settle" });
    frames.push({ view: { ...after, balance: current.balance, stats: before.stats, history: before.history }, motion: "result" });
  }
  return frames;
}

export function frameDuration(motion: TableMotion, fast: boolean, reduced: boolean) {
  if (reduced) return 35;
  const durations: Record<TableMotion, number> = { deal: 640, reveal: 760, split: 560, wager: 360, collect: 440, shuffle: 850, settle: 400, result: 1700 };
  return Math.round(durations[motion] * (fast ? .6 : 1));
}

export const chipColors: Record<number, string> = { 10: "#858071", 20: "#2e8193", 30: "#8b6d9b", 50: "#47715b", 100: "#b88136", 500: "#9b4148", 1000: "#645079" };
export const chipColor = (value: number) => chipColors[[1000, 500, 100, 50, 30, 20, 10].find((n) => value >= n) ?? 10];

// A compact visual stack; the displayed total remains authoritative for large bets.
export function wagerChips(amount: number): number[] {
  const chips: number[] = [];
  for (const denomination of [1000, 500, 100, 50, 30, 20, 10]) {
    const count = Math.min(6 - chips.length, Math.floor(amount / denomination));
    chips.push(...Array<number>(count).fill(denomination));
    amount -= count * denomination;
    if (chips.length === 6) break;
  }
  return chips;
}
