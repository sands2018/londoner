import type { RouletteNumber } from "../core/roulette";

export interface SavedSession {
  id: string;
  name: string;
  numbers: RouletteNumber[];
  /** Save/update time in milliseconds. */
  updatedTms: number;
  /** Data occurrence time in milliseconds. Defaults to inferred name time, then updatedTms. */
  dataTms?: number;
  /** 导入时的原始顺序索引, 用于自适应排序 tie-breaker */
  importIndex?: number;
  /** 从共享库导入时的上传者名, 本地保存的为空字符串 */
  sharedUploader?: string;
  /** Optional local casino table assignment. Unknown or unassigned sessions omit this. */
  tableId?: string;
}

function normalizeTms(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : value;
}

export function parseLooseDateTimeToTms(value: unknown): number | null {
  const tms = normalizeTms(value);
  if (tms !== null) return tms;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/u.test(trimmed)) return parseLooseDateTimeToTms(Number(trimmed));

  const compact = trimmed.match(/^(\d{4})(\d{2})(\d{2})[-_ ]?(\d{2})(\d{2})$/u);
  if (compact) {
    return makeLocalDateTms(
      Number(compact[1]),
      Number(compact[2]),
      Number(compact[3]),
      Number(compact[4]),
      Number(compact[5]),
    );
  }

  const normalized = trimmed
    .replace(/^(\d{4})[.](\d{1,2})[.](\d{1,2})/u, (_all, year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
    .replace(/^(\d{4})-(\d{1,2})-(\d{1,2})/u, (_all, year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`)
    .replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function makeLocalDateTms(year: number, month: number, day: number, hour = 0, minute = 0): number | null {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (
    date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day
    || date.getHours() !== hour
    || date.getMinutes() !== minute
  ) {
    return null;
  }
  return date.getTime();
}

export function inferDataTmsFromSessionName(name: string | undefined): number | null {
  const match = name?.match(/(?:^|[^\d])(\d{4})(\d{2})(\d{2})[-_ ]?(\d{2})(\d{2})(?:[^\d]|$)/u);
  if (!match) return null;
  return makeLocalDateTms(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
}

export function getSessionUpdatedTms(session: Pick<SavedSession, "updatedTms"> & { updatedAt?: string }): number {
  return normalizeTms(session.updatedTms)
    ?? parseLooseDateTimeToTms(session.updatedAt)
    ?? Date.now();
}

export function getSessionDataTms(
  session: Pick<SavedSession, "updatedTms" | "dataTms"> & { name?: string; dataTime?: string; updatedAt?: string },
): number {
  return normalizeTms(session.dataTms)
    ?? parseLooseDateTimeToTms(session.dataTime)
    ?? inferDataTmsFromSessionName(session.name)
    ?? getSessionUpdatedTms(session);
}

/** Single flat table entry: casino has parentId="0", table has parentId=casino ID. */
export interface CasinoTable {
  id: string;
  name: string;
  parentId: string;
}

export interface StorageAdapter {
  loadCurrent(): Promise<RouletteNumber[]>;
  saveCurrent(numbers: readonly RouletteNumber[]): Promise<void>;
  listSessions(): Promise<SavedSession[]>;
  saveSession(session: SavedSession): Promise<void>;
  renameSession(id: string, name: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  /** Casino / table location management. */
  listCasinoTables(): Promise<CasinoTable[]>;
  saveCasinoTable(item: CasinoTable): Promise<void>;
  deleteCasinoTable(id: string): Promise<void>;
}
