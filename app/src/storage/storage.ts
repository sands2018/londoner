import type { RouletteNumber } from "../core/roulette";

export interface SavedSession {
  id: string;
  name: string;
  numbers: RouletteNumber[];
  updatedAt: string;
  /** Data occurrence time. Defaults to updatedAt when not explicitly set. */
  dataTime?: string;
  /** 导入时的原始顺序索引, 用于自适应排序 tie-breaker */
  importIndex?: number;
  /** 从共享库导入时的上传者名, 本地保存的为空字符串 */
  sharedUploader?: string;
  /** Optional local casino table assignment. Unknown or unassigned sessions omit this. */
  tableId?: string;
}

function makeLocalDateIso(year: number, month: number, day: number, hour = 0, minute = 0): string | null {
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
  return date.toISOString();
}

export function inferDataTimeFromSessionName(name: string | undefined): string | null {
  const match = name?.match(/(?:^|[^\d])(\d{4})(\d{2})(\d{2})[-_ ]?(\d{2})(\d{2})(?:[^\d]|$)/u);
  if (!match) return null;
  return makeLocalDateIso(
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
  );
}

export function getSessionDataTime(session: Pick<SavedSession, "updatedAt" | "dataTime"> & { name?: string }): string {
  return session.dataTime || inferDataTimeFromSessionName(session.name) || session.updatedAt;
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
