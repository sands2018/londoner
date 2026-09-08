import type { Engine } from "random-js";
import { evaluateHoldem, pokerDeck, pokerMoney, pokerObject, validPokerCards } from "./pokerCards";

export const holdemNames = ["你", "林先生", "Anna", "陈先生", "Marco", "苏小姐"];
export const holdemSmallBlind = 50;
export const holdemBigBlind = 100;
export const holdemBuyIn = 10000;
export type HoldemStreet = "preflop" | "flop" | "turn" | "river";
export const holdemStreetNames: Record<HoldemStreet, string> = { preflop: "翻牌前", flop: "翻牌", turn: "转牌", river: "河牌" };
export type HoldemPlayer = { chips: number; hole: number[]; folded: boolean; committed: number; streetBet: number;
  actedAt: number | null; raiseSizeAtAction: number; action: string };
export type HoldemAction = { type: "fold" | "check" | "call" | "allin" } | { type: "raise"; to: number };
export type HoldemPot = { amount: number; eligible: number[]; winners: number[] };
export type HoldemResult = { id: number; button: number; board: number[]; holes: number[][]; folded: boolean[]; contributions: number[];
  payouts: number[]; refunds: number[]; pots: HoldemPot[]; labels: string[]; profit: number; showdown: boolean };
export type HoldemState = { version: 1; phase: "ready" | "playing" | "settled"; roundId: number; button: number;
  street: HoldemStreet; players: HoldemPlayer[]; deck: number[]; burns: number[]; board: number[];
  currentBet: number; minRaise: number; actor: number; tableTotal: number; log: string[];
  result: HoldemResult | null; history: HoldemResult[]; stats: { hands: number; wins: number; invested: number; returned: number; profit: number; showdowns: number } };
const blankPlayer = (chips = holdemBuyIn): HoldemPlayer => ({ chips, hole: [], folded: false, committed: 0, streetBet: 0, actedAt: null, raiseSizeAtAction: holdemBigBlind, action: "" });
export const freshHoldem = (): HoldemState => ({ version: 1, phase: "ready", roundId: 0, button: 5, street: "preflop",
  players: holdemNames.map(() => blankPlayer()), deck: [], burns: [], board: [], currentBet: 0, minRaise: holdemBigBlind,
  actor: -1, tableTotal: 6 * holdemBuyIn, log: [], result: null, history: [],
  stats: { hands: 0, wins: 0, invested: 0, returned: 0, profit: 0, showdowns: 0 } });
export const holdemPotTotal = (s: HoldemState) => s.players.reduce((n, p) => n + p.committed, 0);
const clockwise = (after: number) => Array.from({ length: 6 }, (_, i) => (after + i + 1) % 6);
const live = (s: HoldemState) => s.players.map((p, i) => !p.folded ? i : -1).filter(i => i >= 0);
const appendLog = (s: HoldemState, text: string) => { s.log = [...s.log, text].slice(-60); };
function pay(p: HoldemPlayer, amount: number) {
  const actual = Math.min(p.chips, amount);
  p.chips -= actual; p.streetBet += actual; p.committed += actual;
}
export function holdemLegal(s: HoldemState, seat = s.actor) {
  const p = s.players[seat];
  const isTurn = s.phase === "playing" && seat === s.actor && !!p && !p.folded && p.chips > 0;
  const opponents = s.players.filter((other, i) => i !== seat && !other.folded);
  const canContest = opponents.some(other => other.chips > 0);
  // A lone player with chips only needs to cover an all-in opponent's real wager.
  const target = canContest ? s.currentBet : Math.min(s.currentBet, Math.max(0, ...opponents.map(other => other.streetBet)));
  const call = p ? Math.min(p.chips, Math.max(0, target - p.streetBet)) : 0;
  const maxTo = p ? p.streetBet + p.chips : 0;
  // Even a short opening all-in must be raised by a full minimum increment.
  const minTo = s.currentBet + s.minRaise;
  const reopened = p && (p.actedAt === null || s.currentBet - p.actedAt >= p.raiseSizeAtAction);
  const canRaise = !!(isTurn && canContest && reopened && maxTo > s.currentBet);
  return { isTurn, call, canCheck: isTurn && call === 0, canRaise, minTo, maxTo,
    canAllIn: isTurn && (maxTo <= target || canRaise) };
}
function nextActor(s: HoldemState, after: number) {
  const funded = live(s).filter(i => s.players[i].chips > 0);
  if (!funded.length) return -1;
  if (funded.length === 1) {
    const seat = funded[0], p = s.players[seat];
    return live(s).some(i => i !== seat && s.players[i].streetBet > p.streetBet) ? seat : -1;
  }
  return clockwise(after).find(i => {
    const p = s.players[i];
    return !p.folded && p.chips > 0 && (p.actedAt === null || p.streetBet < s.currentBet);
  }) ?? -1;
}

export function startHoldem(s: HoldemState, random?: Engine): HoldemState {
  if (s.phase === "playing" || s.players[0].chips < 1) return s;
  const next: HoldemState = { ...s, phase: "playing", roundId: s.roundId + 1, button: (s.button + 1) % 6,
    street: "preflop", players: s.players.map((p, i) => blankPlayer(i > 0 && p.chips < holdemBigBlind ? holdemBuyIn : p.chips)),
    deck: pokerDeck(random), burns: [], board: [], currentBet: holdemBigBlind, minRaise: holdemBigBlind, actor: -1, log: [], result: null };
  next.tableTotal = next.players.reduce((n, p) => n + p.chips, 0);
  for (let card = 0; card < 2; card++) for (const seat of clockwise(next.button)) next.players[seat].hole.push(next.deck.pop()!);
  const sb = (next.button + 1) % 6, bb = (next.button + 2) % 6;
  pay(next.players[sb], holdemSmallBlind); pay(next.players[bb], holdemBigBlind);
  next.players[sb].action = `小盲 ${next.players[sb].streetBet}`;
  next.players[bb].action = `大盲 ${next.players[bb].streetBet}`;
  appendLog(next, `${holdemNames[sb]} 小盲 ${next.players[sb].streetBet} · ${holdemNames[bb]} 大盲 ${next.players[bb].streetBet}`);
  next.actor = nextActor(next, bb);
  return next;
}

/** Builds separate pots from contribution levels, returning unmatched chips first. */
export function settleHoldemPots(players: readonly Pick<HoldemPlayer, "committed" | "folded" | "hole">[], board: readonly number[], button: number) {
  const levels = [...new Set(players.map(p => p.committed).filter(n => n > 0))].sort((a, b) => a - b);
  const payouts = players.map(() => 0), refunds = players.map(() => 0), pots: HoldemPot[] = [];
  let previous = 0;
  for (const level of levels) {
    const contributors = players.map((p, i) => p.committed >= level ? i : -1).filter(i => i >= 0);
    const amount = (level - previous) * contributors.length;
    previous = level;
    if (contributors.length === 1) { refunds[contributors[0]] += amount; payouts[contributors[0]] += amount; continue; }
    const eligible = contributors.filter(i => !players[i].folded);
    if (!eligible.length) throw new Error("A pot must have a live claimant");
    const best = eligible.length === 1 ? 0 : Math.max(...eligible.map(i => evaluateHoldem([...players[i].hole, ...board]).score));
    const winners = eligible.filter(i => eligible.length === 1 || evaluateHoldem([...players[i].hole, ...board]).score === best)
      .sort((a, b) => (a - button - 1 + players.length) % players.length - (b - button - 1 + players.length) % players.length);
    const share = Math.floor(amount / winners.length);
    winners.forEach((seat, i) => { payouts[seat] += share + Number(i < amount % winners.length); });
    pots.push({ amount, eligible, winners });
  }
  return { payouts, refunds, pots };
}
function settle(s: HoldemState): HoldemState {
  const { payouts, refunds, pots } = settleHoldemPots(s.players, s.board, s.button);
  const showdown = live(s).length > 1;
  const result: HoldemResult = { id: s.roundId, button: s.button, board: [...s.board], holes: s.players.map(p => [...p.hole]), folded: s.players.map(p => p.folded),
    contributions: s.players.map(p => p.committed), payouts, refunds, pots,
    labels: s.players.map(p => !p.folded && showdown ? evaluateHoldem([...p.hole, ...s.board]).label : p.folded ? "弃牌" : "其他玩家弃牌"),
    profit: payouts[0] - s.players[0].committed, showdown };
  const invested = s.players[0].committed - refunds[0], returned = payouts[0] - refunds[0];
  return { ...s, phase: "settled", actor: -1, result, players: s.players.map((p, i) => ({ ...p, chips: p.chips + payouts[i] })),
    history: [result, ...s.history].slice(0, 200), stats: { hands: s.stats.hands + 1, wins: s.stats.wins + Number(result.profit > 0),
      invested: s.stats.invested + invested, returned: s.stats.returned + returned, profit: s.stats.profit + result.profit,
      showdowns: s.stats.showdowns + Number(showdown && !s.players[0].folded) } };
}

export function actHoldem(s: HoldemState, seat: number, action: HoldemAction): HoldemState {
  const legal = holdemLegal(s, seat);
  if (!legal.isTurn) return s;
  if (action.type === "check" && !legal.canCheck || action.type === "call" && legal.call === 0 || action.type === "allin" && !legal.canAllIn) return s;
  const to = action.type === "allin" ? legal.maxTo : action.type === "raise" ? action.to : 0;
  if (action.type === "raise" && (!legal.canRaise || !pokerMoney(to) || to > legal.maxTo || to <= s.currentBet || to < legal.minTo && to !== legal.maxTo)) return s;
  const next: HoldemState = { ...s, players: s.players.map(p => ({ ...p })) };
  const p = next.players[seat];
  if (action.type === "fold") { p.folded = true; p.action = "弃牌"; }
  else if (action.type === "check") p.action = "过牌";
  else if (action.type === "call" || action.type === "allin" && to <= s.currentBet) {
    pay(p, legal.call); p.action = p.chips ? `跟注 ${legal.call}` : `全下 ${p.streetBet}`;
  } else {
    pay(p, to - p.streetBet);
    const increase = to - next.currentBet;
    if (increase >= next.minRaise) next.minRaise = increase;
    next.currentBet = to;
    p.action = `${p.chips ? s.currentBet ? "加注至" : "下注" : "全下"} ${to}`;
  }
  p.actedAt = next.currentBet; p.raiseSizeAtAction = next.minRaise;
  appendLog(next, `${holdemNames[seat]} ${p.action}`);
  if (live(next).length === 1) return settle(next);
  next.actor = nextActor(next, seat);
  return next;
}

/** One explicit street transition lets the UI show flop, turn and river separately. */
export function advanceHoldem(s: HoldemState): HoldemState {
  if (s.phase !== "playing" || s.actor !== -1) return s;
  if (s.street === "river") return settle(s);
  const street: HoldemStreet = s.street === "preflop" ? "flop" : s.street === "flop" ? "turn" : "river";
  const next: HoldemState = { ...s, street, players: s.players.map(p => ({ ...p, streetBet: 0, actedAt: null, raiseSizeAtAction: holdemBigBlind, action: p.folded ? "弃牌" : p.chips === 0 ? "全下" : "" })),
    deck: [...s.deck], burns: [...s.burns], board: [...s.board], currentBet: 0, minRaise: holdemBigBlind };
  next.burns.push(next.deck.pop()!);
  for (let i = 0; i < (street === "flop" ? 3 : 1); i++) next.board.push(next.deck.pop()!);
  appendLog(next, `— ${holdemStreetNames[street]} —`);
  next.actor = nextActor(next, next.button);
  return next;
}
export const topUpHoldem = (s: HoldemState): HoldemState => s.phase === "playing" || s.players[0].chips > 1e12 - holdemBuyIn ? s
  : { ...s, tableTotal: s.tableTotal + holdemBuyIn, players: s.players.map((p, i) => i === 0 ? { ...p, chips: p.chips + holdemBuyIn } : p) };
export const resetHoldemStats = (s: HoldemState): HoldemState => s.phase === "playing" ? s : { ...s, history: [], stats: freshHoldem().stats };

function validResult(v: unknown): v is HoldemResult {
  if (!pokerObject(v) || !pokerMoney(v.id) || v.id < 1 || !Number.isInteger(v.button) || (v.button as number) < 0 || (v.button as number) > 5 || !validPokerCards(v.board) || ![0, 3, 4, 5].includes(v.board.length)
    || !Array.isArray(v.holes) || v.holes.length !== 6 || !v.holes.every(c => validPokerCards(c) && c.length === 2)
    || !validPokerCards([...v.board, ...v.holes.flat()]) || !Array.isArray(v.folded) || v.folded.length !== 6 || !v.folded.every(b => typeof b === "boolean")
    || ![v.contributions, v.payouts, v.refunds].every(a => Array.isArray(a) && a.length === 6 && a.every(pokerMoney))
    || typeof v.showdown !== "boolean" || !Array.isArray(v.labels) || v.labels.length !== 6 || !v.labels.every(label => typeof label === "string" && label.length < 80)) return false;
  const r = v as unknown as HoldemResult;
  const survivors = r.folded.filter(b => !b).length;
  if (!survivors || r.showdown !== (survivors > 1) || r.showdown && r.board.length !== 5) return false;
  try {
    const check = settleHoldemPots(r.holes.map((hole, i) => ({ hole, folded: r.folded[i], committed: r.contributions[i] })), r.board, r.button);
    return JSON.stringify(r.payouts) === JSON.stringify(check.payouts)
      && r.profit === r.payouts[0] - r.contributions[0] && JSON.stringify(r.refunds) === JSON.stringify(check.refunds)
      && Array.isArray(r.pots) && r.pots.length === check.pots.length && r.pots.every((pot, i) => pokerObject(pot) && pot.amount === check.pots[i].amount
        && JSON.stringify(pot.eligible) === JSON.stringify(check.pots[i].eligible) && Array.isArray(pot.winners)
        && [...pot.winners].sort().join() === [...check.pots[i].winners].sort().join());
  } catch { return false; }
}
export function readHoldemState(v: unknown): HoldemState | null {
  if (!pokerObject(v) || v.version !== 1 || !["ready", "playing", "settled"].includes(v.phase as string)
    || !pokerMoney(v.roundId) || !Number.isInteger(v.button) || (v.button as number) < 0 || (v.button as number) > 5
    || !["preflop", "flop", "turn", "river"].includes(v.street as string) || !Array.isArray(v.players) || v.players.length !== 6
    || !v.players.every(p => pokerObject(p) && pokerMoney(p.chips) && pokerMoney(p.committed) && pokerMoney(p.streetBet) && p.streetBet <= p.committed
      && validPokerCards(p.hole) && typeof p.folded === "boolean" && (p.actedAt === null || pokerMoney(p.actedAt))
      && pokerMoney(p.raiseSizeAtAction) && p.raiseSizeAtAction >= holdemBigBlind && typeof p.action === "string" && p.action.length < 80)
    || !validPokerCards(v.deck) || !validPokerCards(v.board) || !validPokerCards(v.burns) || !pokerMoney(v.currentBet) || !pokerMoney(v.minRaise) || v.minRaise < holdemBigBlind
    || !Number.isInteger(v.actor) || (v.actor as number) < -1 || (v.actor as number) > 5 || !pokerMoney(v.tableTotal)
    || !Array.isArray(v.log) || v.log.length > 60 || !v.log.every(t => typeof t === "string" && t.length < 100)
    || !Array.isArray(v.history) || v.history.length > 200 || !v.history.every(validResult) || !pokerObject(v.stats)
    || !(v.result === null || validResult(v.result))) return null;
  const s = v as unknown as HoldemState;
  const cards = [...s.deck, ...s.burns, ...s.board, ...s.players.flatMap(p => p.hole)];
  if (!validPokerCards(cards) || cards.length !== (s.phase === "ready" ? 0 : 52)
    || s.players.some(p => p.hole.length !== (s.phase === "ready" ? 0 : 2))
    || s.board.length !== ({ preflop: 0, flop: 3, turn: 4, river: 5 }[s.street])
    || s.burns.length !== ({ preflop: 0, flop: 1, turn: 2, river: 3 }[s.street])
    || s.players.reduce((n, p) => n + p.chips + (s.phase === "playing" ? p.committed : 0), 0) !== s.tableTotal) return null;
  if (s.phase === "playing" ? s.result !== null || live(s).length < 2 || s.actor !== -1 && !holdemLegal(s).isTurn
    || s.currentBet < Math.max(...s.players.map(p => p.streetBet)) || (s.actor === -1 ? nextActor(s, s.button) !== -1 : nextActor(s, (s.actor + 5) % 6) !== s.actor)
    : s.actor !== -1 || (s.phase === "settled" ? !s.result || s.result.id !== s.roundId : s.roundId !== 0 || s.result !== null)) return null;
  if (s.result && (s.result.button !== s.button || JSON.stringify(s.result.board) !== JSON.stringify(s.board)
    || s.players.some((p, i) => JSON.stringify(p.hole) !== JSON.stringify(s.result!.holes[i])
      || p.folded !== s.result!.folded[i] || p.committed !== s.result!.contributions[i]))) return null;
  if (![s.stats.hands, s.stats.wins, s.stats.invested, s.stats.returned, s.stats.showdowns].every(pokerMoney)
    || s.stats.hands > s.roundId || s.stats.wins > s.stats.hands || s.stats.showdowns > s.stats.hands || s.stats.profit !== s.stats.returned - s.stats.invested
    || !s.history.every((r, i, a) => r.id <= s.roundId && (i === 0 || r.id < a[i - 1].id))) return null;
  return structuredClone(s);
}
