import type { RouletteNumber } from "../core/roulette";

export interface SavedSession {
  id: string;
  name: string;
  numbers: RouletteNumber[];
  updatedAt: string;
  /** 导入时的原始顺序索引, 用于自适应排序 tie-breaker */
  importIndex?: number;
  /** 从共享库导入时的上传者名, 本地保存的为空字符串 */
  sharedUploader?: string;
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
