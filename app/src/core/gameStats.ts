import {
  getGroupIndex,
  getRowIndex,
  type RouletteNumber,
} from "./roulette";

export type GameSortField = "name" | "won" | "balance" | "live";
export type GameSortDirection = "asc" | "desc";

export interface GameStat {
  balance: number;
  completed: number;
  drew: number;
  live: number;
  lost: number;
  name: string;
  won: number;
}

export interface GameBetSettings {
  acrModes: string[];
  bets: number[][];
  rounds: number[];
}

interface GameRule {
  after: number;
  bets: number[];
}

interface GameItem {
  betIndex: number;
  hit: boolean;
  money: number;
  round: number;
  status: "active" | "done";
}

interface GameModel {
  acr: number;
  after: number;
  balance: number;
  bets: number[];
  completed: number;
  drew: number;
  items: GameItem[];
  live: number;
  lost: number;
  name: string;
  won: number;
}

export const defaultGameBets = [
  [1, 2, 4],
  [1, 2, 4, 8],
  [2, 3, 4, 6],
  [1, 2, 3, 5],
  [1, 1, 2, 3, 5],
  [1, 2, 4, 6, 9],
  [1, 1, 1, 2, 2, 3],
  [1, 2, 3, 4, 6, 9],
];

export const gameRounds = Array.from({ length: 9 }, (_, index) => index);
export const gameAcrOptions = ["“行、组合并”进行统计", "“行、组分开”进行统计", "“单个行、组”进行统计"];

export function calculateGameStats(
  numbers: readonly RouletteNumber[],
  scope: number,
  sortField: GameSortField,
  sortDirection: GameSortDirection,
): GameStat[] {
  const settings = loadGameBetSettings();
  const rules = settings.rounds.flatMap((after) =>
    settings.bets.map((bets) => ({
      after,
      bets,
    })),
  );

  const games = createGames(rules, settings.acrModes);
  const recent = numbers.slice(Math.max(0, numbers.length - scope));
  const distances = [0, 0, 0, 0, 0, 0];

  for (const value of recent) {
    addNumberToDistances(distances, value);
    for (const game of games) {
      addNumberToGame(game, value, distances);
    }
  }

  return sortGameStats(
    games.map((game) => ({
      balance: game.balance,
      completed: game.completed,
      drew: game.drew,
      live: game.live,
      lost: game.lost,
      name: game.name,
      won: game.won,
    })),
    sortField,
    sortDirection,
  );
}

export function loadGameBetSettings(): GameBetSettings {
  const bets = readLegacyRows<number[]>("DATA_BET_SELS")
    .filter(isValidBet)
    .slice(0, 20);
  const rounds = readLegacyRows<number>("DATA_RND_SELS")
    .filter((value) => Number.isInteger(value) && value >= 0 && value <= 8);
  const acrSelections = readLegacyRows<string>("DATA_ARC_SELS");

  return {
    acrModes: acrSelections.length > 0 ? acrSelections : [gameAcrOptions[1]],
    bets: bets.length > 0 ? bets : defaultGameBets,
    rounds: rounds.length > 0 ? rounds : gameRounds,
  };
}

export function loadGameBets(): number[][] {
  const bets = readLegacyRows<number[]>("DATA_BETS")
    .filter(isValidBet)
    .slice(0, 20);
  return bets.length > 0 ? bets : defaultGameBets;
}

export function saveGameBetSettings(settings: GameBetSettings) {
  writeLegacyRows("DATA_BET_SELS", settings.bets);
  writeLegacyRows("DATA_RND_SELS", settings.rounds);
  writeLegacyRows("DATA_ARC_SELS", settings.acrModes);
}

export function addGameBet(text: string): { bets?: number[][]; error?: string } {
  const current = loadGameBets();
  if (current.length >= 20) return { error: "最多只能保存20种打法，请先删除再来添加" };

  const bet = parseGameBetText(text);
  if (!bet) return { error: "输入的打法不合法" };
  if (bet.length > 10) return { error: "押注不能超过10轮" };
  if (current.some((item) => areSameBet(item, bet))) return { error: "这个打法已经有了" };

  const next = [...current, bet];
  saveGameBets(next);
  saveSelectedBets(uniqueBets([...loadGameBetSettings().bets, bet]));
  return { bets: next };
}

export function deleteGameBets(items: number[][]): number[][] {
  const current = loadGameBets();
  if (items.length <= 0 || items.length >= current.length) return current;

  const next = current.filter((bet) => !items.some((item) => areSameBet(item, bet)));
  const selected = loadGameBetSettings().bets.filter((bet) => !items.some((item) => areSameBet(item, bet)));
  saveGameBets(next);
  saveSelectedBets(selected.length > 0 ? selected : [next[0]]);
  return next;
}

export function restoreDefaultGameBets(): number[][] {
  const custom = loadGameBets().filter(
    (bet) => !defaultGameBets.some((defaultBet) => areSameBet(defaultBet, bet)),
  );
  const next = [...defaultGameBets, ...custom].slice(0, 20);
  const selected = loadGameBetSettings().bets;
  saveGameBets(next);
  saveSelectedBets(
    uniqueBets([...defaultGameBets, ...selected.filter((bet) => next.some((item) => areSameBet(item, bet)))]),
  );
  return next;
}

export function formatGameBet(bet: readonly number[]): string {
  return bet.join(",");
}

export function isDefaultGameBet(bet: readonly number[]): boolean {
  return defaultGameBets.some((item) => areSameBet(item, bet));
}

function readLegacyRows<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { rows?: Array<{ v?: unknown }> };
    return Array.isArray(parsed.rows) ? parsed.rows.map((row) => row.v as T) : [];
  } catch {
    return [];
  }
}

function writeLegacyRows<T>(key: string, values: T[]) {
  localStorage.setItem(
    key,
    JSON.stringify({
      rows: values.map((value) => ({ v: Array.isArray(value) ? [...value] : value })),
      total: values.length,
    }),
  );
}

function saveGameBets(bets: number[][]) {
  writeLegacyRows("DATA_BETS", bets);
}

function saveSelectedBets(bets: number[][]) {
  writeLegacyRows("DATA_BET_SELS", bets);
}

function parseGameBetText(text: string): number[] | null {
  const normalized = text
    .replace(/[ ，；;、]+/g, ",")
    .replace(/,+/g, ",")
    .replace(/^,|,$/g, "");
  if (!normalized) return null;

  const values = normalized.split(",").map((item) => Number.parseInt(item, 10));
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 999)) return null;
  return values;
}

function isValidBet(value: unknown): value is number[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.length <= 10 &&
    value.every((item) => Number.isInteger(item) && item >= 0 && item <= 999)
  );
}

function createGames(rules: GameRule[], modes: string[]): GameModel[] {
  const combine = modes.includes(gameAcrOptions[0]);
  const separate = modes.includes(gameAcrOptions[1]);
  const specific = modes.includes(gameAcrOptions[2]);
  const games: GameModel[] = [];

  for (const rule of rules) {
    if (combine) games.push(createGame(rule, 0));
    if (separate) {
      games.push(createGame(rule, 1));
      games.push(createGame(rule, 2));
    }
    if (specific) {
      for (let acr = 10; acr <= 15; acr += 1) {
        games.push(createGame(rule, acr));
      }
    }
  }

  return games;
}

function createGame(rule: GameRule, acr: number): GameModel {
  const prefix = getGamePrefix(acr);
  const betName = rule.bets.join("");
  return {
    acr,
    after: rule.after,
    balance: 0,
    bets: rule.bets.map((value) => value * 10),
    completed: 0,
    drew: 0,
    items: [],
    live: 0,
    lost: 0,
    name: `${prefix}${rule.after}_${betName}`,
    won: 0,
  };
}

function getGamePrefix(acr: number): string {
  if (acr === 1) return "组_";
  if (acr === 2) return "行_";
  if (acr >= 10 && acr <= 12) return `${acr - 9}组_`;
  if (acr >= 13 && acr <= 15) return `${acr - 12}行_`;
  return "";
}

function areSameBet(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function uniqueBets(bets: number[][]): number[][] {
  return bets.filter((bet, index) => bets.findIndex((item) => areSameBet(item, bet)) === index);
}

function addNumberToDistances(distances: number[], value: RouletteNumber) {
  if (value === 0) return;

  for (let index = 0; index < distances.length; index += 1) {
    distances[index] += 1;
  }

  const group = getGroupIndex(value);
  const row = getRowIndex(value);
  if (group !== null) distances[group] = 0;
  if (row !== null) distances[row + 3] = 0;
}

function addNumberToGame(game: GameModel, value: RouletteNumber, distances: number[]) {
  if (value === 0) {
    for (const item of game.items) {
      if (item.status === "active") {
        item.money -= game.bets[item.round - 1];
      }
    }
    refreshLiveMoney(game);
    return;
  }

  const hitIndexes = getHitIndexes(game.acr, value);

  for (const hitIndex of hitIndexes) {
    for (const item of game.items) {
      if (item.status === "done" || item.betIndex !== hitIndex) continue;

      item.money += game.bets[item.round - 1] * 3;
      item.status = "done";
      item.hit = true;
      finishItem(game, item);
    }
  }

  for (const item of game.items) {
    if (item.status === "done") continue;

    if (item.round === game.bets.length) {
      item.status = "done";
      item.hit = false;
      finishItem(game, item);
    } else {
      item.round += 1;
      item.money -= game.bets[item.round - 1];
    }
  }

  const start = getStartIndex(game.acr);
  const end = getEndIndex(game.acr);
  for (let index = start; index <= end; index += 1) {
    if (distances[index] !== game.after) continue;
    game.items.push({
      betIndex: index,
      hit: false,
      money: -game.bets[0],
      round: 1,
      status: "active",
    });
  }

  refreshLiveMoney(game);
}

function getHitIndexes(acr: number, value: RouletteNumber): number[] {
  const group = getGroupIndex(value);
  const row = getRowIndex(value);
  if (group === null || row === null) return [];

  if (acr === 0) return [group, row + 3];
  if (acr === 1 || (acr >= 10 && acr <= 12)) return [group];
  return [row + 3];
}

function getStartIndex(acr: number): number {
  if (acr === 2) return 3;
  if (acr >= 10) return acr - 10;
  return 0;
}

function getEndIndex(acr: number): number {
  if (acr === 1) return 2;
  if (acr >= 10) return acr - 10;
  return 5;
}

function finishItem(game: GameModel, item: GameItem) {
  game.completed += 1;
  if (item.money > 0) game.won += 1;
  else if (item.money === 0) game.drew += 1;
  else game.lost += 1;
  game.balance += item.money;
}

function refreshLiveMoney(game: GameModel) {
  game.live = game.balance;
  for (const item of game.items) {
    if (item.status === "active") {
      game.live += item.money;
    }
  }
}

function sortGameStats(
  stats: GameStat[],
  field: GameSortField,
  direction: GameSortDirection,
): GameStat[] {
  const multiplier = direction === "asc" ? 1 : -1;
  return [...stats].sort((left, right) => {
    let result = 0;
    if (field === "name") result = left.name.localeCompare(right.name, "zh-Hans-CN");
    else if (field === "won") {
      const leftRate = left.completed > 0 ? left.won / left.completed : 0;
      const rightRate = right.completed > 0 ? right.won / right.completed : 0;
      result = leftRate - rightRate || left.balance - right.balance;
    } else if (field === "balance") result = left.balance - right.balance;
    else result = left.live - right.live;
    return result * multiplier;
  });
}
