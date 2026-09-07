import { browserCrypto, dice, type Engine } from "random-js";

export type Die = 1 | 2 | 3 | 4 | 5 | 6;
export type Dice = [Die, Die, Die];
export type SicBoBet = { id: string; kind: "small" | "big" | "odd" | "even" | "triple" | "any-triple" | "double" | "pair" | "total" | "single"; label: string; faces: Die[]; odds: number; total?: number; singleTriple?: number };
export type SicBoRule = "macau" | "australia";
export type SicBoMinimum = 500 | 300 | 20;
export type SicBoSettings = { rule: SicBoRule; minimum: SicBoMinimum };
export const defaultSicBoSettings: SicBoSettings = { rule: "macau", minimum: 20 };
export const dieValues: Die[] = [1, 2, 3, 4, 5, 6];
const lowLimitChips = [10, 20, 30, 50, 100, 500, 1000];
const highLimitChips = [100, 500, 1000, 5000, 10000];
export const sicBoChips = [...lowLimitChips, 5000, 10000];
export const getSicBoChips = (minimum: SicBoMinimum): readonly number[] => minimum === 20 ? lowLimitChips : highLimitChips;
export function selectedSicBoChip(selected: number, minimum: SicBoMinimum) {
  const chips = getSicBoChips(minimum);
  return chips.reduce((chosen, n) => n <= selected ? n : chosen, chips[0]);
}
export const sicBoMaximum = 100000;
export const sicBoRules = {
  macau: { label: "澳门", url: "https://www.dicj.gov.mo/web/cn/rules/Cussec.html", triple: 150, anyTriple: 24, double: 8, pair: 5, singleTriple: 3, totals: [50, 18, 14, 12, 8, 6, 6, 6, 6, 8, 12, 14, 18, 50] },
  australia: { label: "澳洲", url: "https://www.star.com.au/sites/default/files/2024-06/Gold-Coast-Casino-Gaming-Rule-11-July-2023.pdf", triple: 180, anyTriple: 31, double: 11, pair: 6, singleTriple: 12, totals: [62, 31, 18, 12, 8, 7, 6, 6, 7, 8, 12, 18, 31, 62] },
} as const;
function makeBets(rule: SicBoRule): SicBoBet[] {
  const p = sicBoRules[rule];
  return [
  ...(["small", "big", "odd", "even"] as const).map((kind, i) => ({ id: kind, kind, label: ["小", "大", "单", "双"][i], odds: 1, faces: [] })),
  ...dieValues.map((n): SicBoBet => ({ id: `triple-${n}`, kind: "triple", label: `围骰 ${n}${n}${n}`, faces: [n, n, n], odds: p.triple })),
  { id: "any-triple", kind: "any-triple", label: "任意围骰", faces: [], odds: p.anyTriple },
  ...dieValues.map((n): SicBoBet => ({ id: `double-${n}`, kind: "double", label: `对子 ${n}${n}`, faces: [n, n], odds: p.double })),
  ...p.totals.map((odds, i): SicBoBet => ({ id: `total-${i + 4}`, kind: "total", label: `总点数 ${i + 4}`, faces: [], odds, total: i + 4 })),
  ...dieValues.flatMap((a) => dieValues.filter((b) => b > a).map((b): SicBoBet => ({ id: `pair-${a}-${b}`, kind: "pair", label: `组合 ${a}和${b}`, faces: [a, b], odds: p.pair }))),
  ...dieValues.map((n): SicBoBet => ({ id: `single-${n}`, kind: "single", label: `单骰 ${n}`, faces: [n], odds: 1, singleTriple: p.singleTriple })),
  ];
}
const tables = { macau: makeBets("macau"), australia: makeBets("australia") };
const betMaps = { macau: new Map(tables.macau.map(b => [b.id, b])), australia: new Map(tables.australia.map(b => [b.id, b])) };
export const getSicBoBets = (rule: SicBoRule) => tables[rule];
export const getSicBoBetMap = (rule: SicBoRule) => betMaps[rule];
export const sicBoBets = tables.macau;
export const sicBoBetById = new Map(sicBoBets.map((bet) => [bet.id, bet]));
export type SicBoWagers = Record<string, number>;
export type SicBoRound = { id: number; rule: SicBoRule; dice: Dice; bets: SicBoWagers; wagered: number; returned: number; profit: number };
export type SicBoStats = { rounds: number; wagered: number; returned: number; profit: number };
export type SicBoDistribution = { samples: number; faces: number[]; faceRounds: number[]; totals: number[]; triples: number[] };
export const emptySicBoDistribution = (): SicBoDistribution => ({ samples: 0, faces: Array(6).fill(0), faceRounds: Array(6).fill(0), totals: Array(16).fill(0), triples: Array(6).fill(0) });
export function recordSicBoDice(previous: SicBoDistribution, roll: Dice): SicBoDistribution {
  const next = structuredClone(previous);
  next.samples++;
  roll.forEach(n => next.faces[n - 1]++);
  new Set(roll).forEach(n => next.faceRounds[n - 1]++);
  next.totals[diceTotal(roll) - 3]++;
  if (isTriple(roll)) next.triples[roll[0] - 1]++;
  return next;
}
export function sicBoCategories(d: SicBoDistribution) {
  const totals = [...d.totals];
  d.triples.forEach((count, i) => { totals[(i + 1) * 3 - 3] -= count; });
  const count = (test: (total: number) => boolean) => totals.reduce((sum, n, i) => sum + (test(i + 3) ? n : 0), 0);
  return { big: count(n => n >= 11), small: count(n => n <= 10), odd: count(n => n % 2 === 1), even: count(n => n % 2 === 0), triple: d.triples.reduce((a, b) => a + b, 0) };
}
export type SicBoState = {
  version: 2; balance: number; selected: number; bets: SicBoWagers; undo: SicBoWagers[];
  lastBets: SicBoWagers; roundId: number; lastDice: Dice | null; history: SicBoRound[]; stats: SicBoStats;
  settled: SicBoRound | null; distribution: SicBoDistribution;
};
export const freshSicBo = (): SicBoState => ({ version: 2, balance: 10000, selected: 10, bets: {}, undo: [], lastBets: {}, roundId: 0, lastDice: null, history: [], stats: { rounds: 0, wagered: 0, returned: 0, profit: 0 }, settled: null, distribution: emptySicBoDistribution() });
export const wagerTotal = (bets: SicBoWagers) => Object.values(bets).reduce((a, b) => a + b, 0);
export const isTriple = (roll: Dice) => roll.every((n) => n === roll[0]);
export const diceTotal = (roll: Dice) => roll[0] + roll[1] + roll[2];
export function sicBoMinimumFor(bet: SicBoBet, minimum: SicBoMinimum) {
  return ["big", "small", "odd", "even"].includes(bet.kind) ? minimum : minimum === 20 ? 10 : 100;
}
export const belowSicBoMinimum = (bets: SicBoWagers, minimum: SicBoMinimum) => Object.entries(bets).filter(([id, amount]) => !sicBoBetById.has(id) || amount < sicBoMinimumFor(sicBoBetById.get(id)!, minimum)).map(([id]) => id);

// Returns net odds; -1 means a losing bet. A triple also satisfies its double.
export function sicBoPayout(bet: SicBoBet, roll: Dice): number {
  const total = diceTotal(roll), triple = isTriple(roll);
  const matches = roll.filter((n) => n === bet.faces[0]).length;
  switch (bet.kind) {
    case "small": return !triple && total <= 10 ? 1 : -1;
    case "big": return !triple && total >= 11 ? 1 : -1;
    case "odd": return !triple && total % 2 === 1 ? 1 : -1;
    case "even": return !triple && total % 2 === 0 ? 1 : -1;
    case "triple": return matches === 3 ? bet.odds : -1;
    case "any-triple": return triple ? bet.odds : -1;
    case "double": return matches >= 2 ? bet.odds : -1;
    case "pair": return bet.faces.every((n) => roll.includes(n)) ? bet.odds : -1;
    case "total": return total === bet.total ? bet.odds : -1;
    case "single": return matches === 3 ? bet.singleTriple! : matches || -1;
  }
}

function changeBets(state: SicBoState, bets: SicBoWagers): SicBoState {
  if (state.settled || wagerTotal(bets) > Math.min(state.balance, sicBoMaximum)) return state;
  return { ...state, bets, undo: [...state.undo.slice(-99), state.bets] };
}
export function placeSicBoBet(state: SicBoState, id: string): SicBoState {
  if (!sicBoBetById.has(id)) return state;
  return changeBets(state, { ...state.bets, [id]: (state.bets[id] ?? 0) + state.selected });
}
export function undoSicBoBet(state: SicBoState): SicBoState {
  if (state.settled || !state.undo.length) return state;
  return { ...state, bets: state.undo[state.undo.length - 1], undo: state.undo.slice(0, -1) };
}
export function clearSicBoBets(state: SicBoState): SicBoState {
  return wagerTotal(state.bets) ? changeBets(state, {}) : state;
}
export function repeatSicBoBets(state: SicBoState): SicBoState {
  return wagerTotal(state.lastBets) ? changeBets(state, { ...state.lastBets }) : state;
}
export function doubleSicBoBets(state: SicBoState): SicBoState {
  return wagerTotal(state.bets) ? changeBets(state, Object.fromEntries(Object.entries(state.bets).map(([id, amount]) => [id, amount * 2]))) : state;
}
export function settleSicBo(state: SicBoState, roll: Dice, settings = defaultSicBoSettings): SicBoState {
  const wagered = wagerTotal(state.bets);
  if (state.settled || !validDice(roll) || !validBets(state.bets) || belowSicBoMinimum(state.bets, settings.minimum).length || wagered < 10 || wagered > Math.min(state.balance, sicBoMaximum)) return state;
  const table = getSicBoBetMap(settings.rule);
  const returned = Object.entries(state.bets).reduce((sum, [id, amount]) => sum + amount * (sicBoPayout(table.get(id)!, roll) + 1), 0);
  const round: SicBoRound = { id: state.roundId + 1, rule: settings.rule, dice: [...roll], bets: { ...state.bets }, wagered, returned, profit: returned - wagered };
  return {
    ...state, balance: state.balance + round.profit, bets: {}, undo: [], lastBets: round.bets,
    roundId: round.id, lastDice: round.dice, history: [round, ...state.history].slice(0, 200),
    stats: { rounds: state.stats.rounds + 1, wagered: state.stats.wagered + wagered, returned: state.stats.returned + returned, profit: state.stats.profit + round.profit },
    settled: round, distribution: recordSicBoDice(state.distribution, roll),
  };
}
export function rollSicBo(state: SicBoState, engine: Engine = browserCrypto, settings = defaultSicBoSettings): SicBoState {
  if (state.settled || !wagerTotal(state.bets) || belowSicBoMinimum(state.bets, settings.minimum).length) return state;
  return settleSicBo(state, dice(6, 3)(engine) as Dice, settings);
}
export const nextSicBoRound = (state: SicBoState): SicBoState => state.settled ? { ...state, settled: null } : state;
export function resetSicBoStats(state: SicBoState): SicBoState {
  return { ...state, history: [], stats: freshSicBo().stats, distribution: emptySicBoDistribution() };
}

const money = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= 1e12;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const validDice = (v: unknown): v is Dice => Array.isArray(v) && v.length === 3 && v.every((n) => dieValues.includes(n));
function validBets(v: unknown): v is SicBoWagers {
  return object(v) && Object.entries(v).every(([id, n]) => sicBoBetById.has(id) && money(n) && n > 0 && n % 10 === 0) && wagerTotal(v as SicBoWagers) <= sicBoMaximum;
}
function validRound(v: unknown): v is SicBoRound {
  if (!object(v) || !money(v.id) || !isSicBoRule(v.rule) || !validDice(v.dice) || !validBets(v.bets) || !money(v.wagered) || !money(v.returned)) return false;
  const roll = v.dice;
  const table = getSicBoBetMap(v.rule);
  const returned = Object.entries(v.bets).reduce((sum, [id, amount]) => sum + amount * (sicBoPayout(table.get(id)!, roll) + 1), 0);
  return v.wagered > 0 && v.wagered === wagerTotal(v.bets) && v.returned === returned && v.profit === returned - v.wagered;
}
export function readSicBoState(v: unknown): SicBoState | null {
  if (!object(v)) return null;
  if (v.version === 1 && Array.isArray(v.history)) {
    const history = v.history.map(r => object(r) ? { ...r, rule: "australia" } : r);
    if (!history.every(validRound)) return null;
    v = { ...v, version: 2, history, settled: null, distribution: history.reduce((d, r) => recordSicBoDice(d, r.dice), emptySicBoDistribution()) };
  }
  if (!object(v) || v.version !== 2 || !money(v.balance) || !sicBoChips.includes(v.selected as number)
    || !validBets(v.bets) || wagerTotal(v.bets) > v.balance || !validBets(v.lastBets)
    || !Array.isArray(v.undo) || v.undo.length > 100 || !v.undo.every((b) => validBets(b) && wagerTotal(b) <= (v.balance as number))
    || !money(v.roundId) || !(v.lastDice === null || validDice(v.lastDice))
    || !Array.isArray(v.history) || v.history.length > 200 || !v.history.every(validRound)
    || !v.history.every((r, i, h) => r.id <= (v.roundId as number) && (i === 0 || r.id < h[i - 1].id))
    || !object(v.stats) || !money(v.stats.rounds) || !money(v.stats.wagered) || !money(v.stats.returned)
    || v.stats.rounds > v.roundId || v.stats.profit !== v.stats.returned - v.stats.wagered
    || !validDistribution(v.distribution) || v.distribution.samples > v.stats.rounds
    || !(v.settled === null || validRound(v.settled) && v.settled.id === v.roundId && !wagerTotal(v.bets) && !v.undo.length && JSON.stringify(v.lastDice) === JSON.stringify(v.settled.dice))) return null;
  return structuredClone(v) as SicBoState;
}
export const isSicBoRule = (v: unknown): v is SicBoRule => v === "macau" || v === "australia";
export const isSicBoMinimum = (v: unknown): v is SicBoMinimum => v === 500 || v === 300 || v === 20;
function validDistribution(v: unknown): v is SicBoDistribution {
  if (!object(v) || !money(v.samples)) return false;
  const samples = v.samples;
  const counts = (a: unknown, length: number, max: number): a is number[] => Array.isArray(a) && a.length === length && a.every(n => money(n) && n <= max);
  if (!counts(v.faces, 6, samples * 3) || !counts(v.faceRounds, 6, samples) || !counts(v.totals, 16, samples) || !counts(v.triples, 6, samples)) return false;
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  const d = v as SicBoDistribution;
  return sum(d.faces) === samples * 3 && sum(d.totals) === samples
    && d.faceRounds.every((n, i) => n <= d.faces[i] && n * 3 >= d.faces[i] && d.triples[i] <= n)
    && d.triples.every((n, i) => n <= d.totals[(i + 1) * 3 - 3]);
}
