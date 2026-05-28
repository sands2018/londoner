import type { RouletteNumber } from "../core/roulette";
import type { SavedSession, StorageAdapter } from "./storage";

const currentNumbersKey = "londoner.currentNumbers";
const sessionsKey = "londoner.sessions";
const legacyFileIndexKey = "FILE_INDEX_DATA";

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

interface LegacyFileIndex {
  rows?: Array<{
    c?: number;
    n?: string;
    p?: string;
    t?: number;
  }>;
  total?: number;
}

function parseNumbers(value: string | null): RouletteNumber[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => Number.parseInt(item, 10))
    .filter((item): item is RouletteNumber => Number.isInteger(item) && item >= 0 && item <= 36);
}

function readLegacySessions(): SavedSession[] {
  const legacyIndex = parseJson<LegacyFileIndex>(localStorage.getItem(legacyFileIndexKey), {});
  if (!Array.isArray(legacyIndex.rows)) return [];

  return legacyIndex.rows
    .filter((row) => row.p && row.n)
    .map((row) => ({
      id: row.p as string,
      name: row.n as string,
      numbers: parseNumbers(localStorage.getItem(row.p as string)),
      updatedAt: new Date(row.t ?? Date.now()).toISOString(),
    }));
}

function saveLegacyRows(rows: LegacyFileIndex["rows"]): void {
  localStorage.setItem(
    legacyFileIndexKey,
    JSON.stringify({
      rows,
      total: rows?.length ?? 0,
    }),
  );
}

export class LocalStorageAdapter implements StorageAdapter {
  async loadCurrent(): Promise<RouletteNumber[]> {
    return parseJson<RouletteNumber[]>(localStorage.getItem(currentNumbersKey), []);
  }

  async saveCurrent(numbers: readonly RouletteNumber[]): Promise<void> {
    localStorage.setItem(currentNumbersKey, JSON.stringify(numbers));
  }

  async listSessions(): Promise<SavedSession[]> {
    const raw = parseJson<Array<Record<string, unknown>>>(localStorage.getItem(sessionsKey), []);
    const sessions: SavedSession[] = raw.map((s) => ({
      ...(s as unknown as SavedSession),
      sharedUploader: (s.sharedUploader as string) ?? (s.sharedId as string) ?? "",
    }));
    const seenIds = new Set(sessions.map((session) => session.id));
    const legacySessions = readLegacySessions().filter((session) => !seenIds.has(session.id));
    return [...sessions, ...legacySessions];
  }

  async saveSession(session: SavedSession): Promise<void> {
    if (isLegacyId(session.id)) {
      const legacyIndex = parseJson<LegacyFileIndex>(localStorage.getItem(legacyFileIndexKey), {});
      const rows = Array.isArray(legacyIndex.rows) ? legacyIndex.rows : [];
      const time = new Date(session.updatedAt).getTime();
      saveLegacyRows(
        rows.map((row) =>
          row.p === session.id ? { ...row, c: session.numbers.length, n: session.name, t: time } : row,
        ),
      );
      localStorage.setItem(session.id, session.numbers.join(","));
      return;
    }

    const sessions = await this.listSessions();
    const next = sessions.filter((item) => item.id !== session.id && !isLegacyId(item.id));
    next.unshift(session);
    localStorage.setItem(sessionsKey, JSON.stringify(next));
  }

  async renameSession(id: string, name: string): Promise<void> {
    if (isLegacyId(id)) {
      const legacyIndex = parseJson<LegacyFileIndex>(localStorage.getItem(legacyFileIndexKey), {});
      const rows = Array.isArray(legacyIndex.rows) ? legacyIndex.rows : [];
      saveLegacyRows(rows.map((row) => (row.p === id ? { ...row, n: name } : row)));
      return;
    }

    const sessions = parseJson<SavedSession[]>(localStorage.getItem(sessionsKey), []);
    localStorage.setItem(
      sessionsKey,
      JSON.stringify(sessions.map((item) => (item.id === id ? { ...item, name } : item))),
    );
  }

  async deleteSession(id: string): Promise<void> {
    if (isLegacyId(id)) {
      const legacyIndex = parseJson<LegacyFileIndex>(localStorage.getItem(legacyFileIndexKey), {});
      const rows = Array.isArray(legacyIndex.rows) ? legacyIndex.rows : [];
      localStorage.removeItem(id);
      saveLegacyRows(rows.filter((row) => row.p !== id));
      return;
    }

    const sessions = await this.listSessions();
    localStorage.setItem(
      sessionsKey,
      JSON.stringify(sessions.filter((item) => item.id !== id && !isLegacyId(item.id))),
    );
  }
}

function isLegacyId(id: string): boolean {
  return id.startsWith("F_");
}
