import type { RouletteNumber } from "../core/roulette";
import type { CasinoTable, SavedSession, StorageAdapter } from "./storage";

const currentNumbersKey = "londoner.currentNumbers";
const sessionsKey = "londoner.sessions";
const casinoTablesKey = "londoner.casinoTables";
const sessionMetadataKey = "londoner.sessionMetadata";
const legacyFileIndexKey = "FILE_INDEX_DATA";

const DEFAULT_UNKNOWN_CASINO_ID = "c_unknown";
const DEFAULT_UNKNOWN_TABLE_PREFIX = "t_unknown_";

function ensureDefaultCasinoTables(items: CasinoTable[]): CasinoTable[] {
  const result = [...items];
  const hasUnknownCasino = result.some((item) => item.id === DEFAULT_UNKNOWN_CASINO_ID);
  if (!hasUnknownCasino) {
    result.unshift({ id: DEFAULT_UNKNOWN_CASINO_ID, name: "未知", parentId: "0" });
  }
  const casinoIds = result.filter((item) => item.parentId === "0").map((item) => item.id);
  for (const casinoId of casinoIds) {
    const defaultTableId = `${DEFAULT_UNKNOWN_TABLE_PREFIX}${casinoId}`;
    const hasDefaultTable = result.some((item) => item.id === defaultTableId);
    if (!hasDefaultTable) {
      // Insert right after the casino entry or at the end
      const casinoIndex = result.findIndex((item) => item.id === casinoId);
      result.splice(casinoIndex + 1, 0, { id: defaultTableId, name: "未知", parentId: casinoId });
    }
  }
  return result;
}

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

interface SessionMetadata {
  dataTime?: string;
  sharedUploader?: string;
  tableId?: string;
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
  const metadata = parseJson<Record<string, SessionMetadata>>(localStorage.getItem(sessionMetadataKey), {});
  if (!Array.isArray(legacyIndex.rows)) return [];

  return legacyIndex.rows
    .filter((row) => row.p && row.n)
    .map((row) => {
      const id = row.p as string;
      const updatedAt = new Date(row.t ?? Date.now()).toISOString();
      return {
        id,
        name: row.n as string,
        numbers: parseNumbers(localStorage.getItem(id)),
        updatedAt,
        dataTime: metadata[id]?.dataTime,
        sharedUploader: metadata[id]?.sharedUploader ?? "",
        tableId: metadata[id]?.tableId,
      };
    });
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
    const sessions: SavedSession[] = raw.map((s) => {
      const updatedAt = typeof s.updatedAt === "string" ? s.updatedAt : new Date().toISOString();
      return {
        ...(s as unknown as SavedSession),
        updatedAt,
        dataTime: typeof s.dataTime === "string" && s.dataTime ? s.dataTime : undefined,
        sharedUploader: (s.sharedUploader as string) ?? (s.sharedId as string) ?? "",
      };
    });
    const seenIds = new Set(sessions.map((session) => session.id));
    const legacySessions = readLegacySessions().filter((session) => !seenIds.has(session.id));
    return [...sessions, ...legacySessions];
  }

  async saveSession(session: SavedSession): Promise<void> {
    const normalizedSession: SavedSession = {
      ...session,
      dataTime: session.dataTime || undefined,
    };
    if (isLegacyId(session.id)) {
      const legacyIndex = parseJson<LegacyFileIndex>(localStorage.getItem(legacyFileIndexKey), {});
      const rows = Array.isArray(legacyIndex.rows) ? legacyIndex.rows : [];
      const metadata = parseJson<Record<string, SessionMetadata>>(localStorage.getItem(sessionMetadataKey), {});
      const time = new Date(normalizedSession.updatedAt).getTime();
      saveLegacyRows(
        rows.map((row) =>
          row.p === normalizedSession.id ? { ...row, c: normalizedSession.numbers.length, n: normalizedSession.name, t: time } : row,
        ),
      );
      metadata[normalizedSession.id] = {
        dataTime: normalizedSession.dataTime,
        sharedUploader: normalizedSession.sharedUploader ?? "",
        tableId: normalizedSession.tableId,
      };
      localStorage.setItem(sessionMetadataKey, JSON.stringify(metadata));
      localStorage.setItem(normalizedSession.id, normalizedSession.numbers.join(","));
      return;
    }

    const sessions = await this.listSessions();
    const next = sessions.filter((item) => item.id !== normalizedSession.id && !isLegacyId(item.id));
    next.unshift(normalizedSession);
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
      const metadata = parseJson<Record<string, SessionMetadata>>(localStorage.getItem(sessionMetadataKey), {});
      delete metadata[id];
      localStorage.removeItem(id);
      localStorage.setItem(sessionMetadataKey, JSON.stringify(metadata));
      saveLegacyRows(rows.filter((row) => row.p !== id));
      return;
    }

    const sessions = await this.listSessions();
    localStorage.setItem(
      sessionsKey,
      JSON.stringify(sessions.filter((item) => item.id !== id && !isLegacyId(item.id))),
    );
  }

  // ── Casino / table location ──

  async listCasinoTables(): Promise<CasinoTable[]> {
    const raw = parseJson<CasinoTable[]>(localStorage.getItem(casinoTablesKey), []);
    const ensured = ensureDefaultCasinoTables(raw);
    if (ensured.length !== raw.length) {
      localStorage.setItem(casinoTablesKey, JSON.stringify(ensured));
    }
    return ensured;
  }

  async saveCasinoTable(item: CasinoTable): Promise<void> {
    const items = await this.listCasinoTables();
    const idx = items.findIndex((x) => x.id === item.id);
    if (idx >= 0) {
      items[idx] = item;
    } else {
      items.push(item);
    }
    localStorage.setItem(casinoTablesKey, JSON.stringify(items));
  }

  async deleteCasinoTable(id: string): Promise<void> {
    const items = await this.listCasinoTables();
    const idsToDelete = new Set<string>();
    idsToDelete.add(id);
    // Cascade: if deleting a casino, also delete all its tables
    const isCasino = items.some((item) => item.id === id && item.parentId === "0");
    if (isCasino) {
      for (const item of items) {
        if (item.parentId === id) idsToDelete.add(item.id);
      }
    }
    localStorage.setItem(
      casinoTablesKey,
      JSON.stringify(items.filter((item) => !idsToDelete.has(item.id))),
    );
  }
}

function isLegacyId(id: string): boolean {
  return id.startsWith("F_");
}
