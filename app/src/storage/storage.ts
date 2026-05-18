import type { RouletteNumber } from "../core/roulette";

export interface SavedSession {
  id: string;
  name: string;
  numbers: RouletteNumber[];
  updatedAt: string;
}

export interface StorageAdapter {
  loadCurrent(): Promise<RouletteNumber[]>;
  saveCurrent(numbers: readonly RouletteNumber[]): Promise<void>;
  listSessions(): Promise<SavedSession[]>;
  saveSession(session: SavedSession): Promise<void>;
  renameSession(id: string, name: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
}
