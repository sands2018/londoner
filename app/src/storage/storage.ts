import type { RouletteNumber } from "../core/roulette";

export interface SavedSession {
  id: string;
  name: string;
  numbers: RouletteNumber[];
  updatedAt: string;
  /** 导入时的原始顺序索引, 用于自适应排序 tie-breaker */
  importIndex?: number;
}

export interface StorageAdapter {
  loadCurrent(): Promise<RouletteNumber[]>;
  saveCurrent(numbers: readonly RouletteNumber[]): Promise<void>;
  listSessions(): Promise<SavedSession[]>;
  saveSession(session: SavedSession): Promise<void>;
  renameSession(id: string, name: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
}
