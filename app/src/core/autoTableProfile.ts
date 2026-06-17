import type { RouletteNumber } from "./roulette";
import {
  buildTableProfiles,
  matchTableProfile,
  type TableMatchLevel,
  type TableProfileSession,
  type TableProfileTable,
} from "./tableHotProfile";

export type TableAssignmentSource = "manual" | "auto" | "none";
export type AutoTableMatchLevel = TableMatchLevel | "new";

export interface AutoTableInputSession {
  id: string;
  name: string;
  numbers: readonly RouletteNumber[];
  updatedAt: string;
  importIndex?: number;
  tableId?: string;
}

export interface TableAssignment {
  sessionId: string;
  manualTableId?: string;
  autoTableId?: string;
  effectiveTableId?: string;
  source: TableAssignmentSource;
  autoMatchLevel: AutoTableMatchLevel;
  autoSimilarity: number;
  autoGap: number;
}

export interface AutoTableProfileState {
  assignments: TableAssignment[];
  assignmentsById: Map<string, TableAssignment>;
  profileSessions: TableProfileSession[];
  tables: TableProfileTable[];
}

export const AUTO_TABLE_PREFIX = "auto_";
export const AUTO_TABLE_PARENT_ID = "auto";

const MISSING_MANUAL_TABLE_PARENT_ID = "manual_missing";
const MIN_MANUAL_SESSIONS_FOR_PROBABLE_AUTO_MATCH = 3;

function isKnownManualTableId(tableId: string | undefined): tableId is string {
  return Boolean(tableId && !tableId.startsWith("t_unknown_"));
}

function isAutoTableId(tableId: string): boolean {
  return tableId.startsWith(AUTO_TABLE_PREFIX);
}

function sortSessionsChronologically<T extends AutoTableInputSession>(sessions: readonly T[]): T[] {
  return [...sessions].sort((left, right) => {
    const leftTime = new Date(left.updatedAt).getTime();
    const rightTime = new Date(right.updatedAt).getTime();
    const safeLeftTime = Number.isFinite(leftTime) ? leftTime : Number.MAX_SAFE_INTEGER;
    const safeRightTime = Number.isFinite(rightTime) ? rightTime : Number.MAX_SAFE_INTEGER;
    return safeLeftTime - safeRightTime
      || (left.importIndex ?? Number.MAX_SAFE_INTEGER) - (right.importIndex ?? Number.MAX_SAFE_INTEGER)
      || left.name.localeCompare(right.name, "zh-Hans-CN")
      || left.id.localeCompare(right.id);
  });
}

function nextAutoTableId(index: number): string {
  return `${AUTO_TABLE_PREFIX}${String(index).padStart(2, "0")}`;
}

function autoTableName(tableId: string): string {
  const suffix = tableId.slice(AUTO_TABLE_PREFIX.length).replace(/^0+/, "") || tableId.slice(AUTO_TABLE_PREFIX.length);
  return `自动画像${suffix}`;
}

function makeTables(
  manualTables: readonly TableProfileTable[],
  autoTableIds: readonly string[],
  manualTableIds: readonly string[] = [],
): TableProfileTable[] {
  const seen = new Set<string>();
  const result: TableProfileTable[] = [];
  for (const table of manualTables) {
    if (seen.has(table.id)) continue;
    seen.add(table.id);
    result.push(table);
  }
  for (const id of manualTableIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id, name: id, parentId: MISSING_MANUAL_TABLE_PARENT_ID });
  }
  for (const id of autoTableIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id, name: autoTableName(id), parentId: AUTO_TABLE_PARENT_ID });
  }
  return result;
}

function shouldAcceptAutoMatch(level: TableMatchLevel, targetManualSessionCount: number): boolean {
  if (level === "confirmed") return true;
  if (level !== "probable") return false;
  return targetManualSessionCount === 0 || targetManualSessionCount >= MIN_MANUAL_SESSIONS_FOR_PROBABLE_AUTO_MATCH;
}

export function buildAutoTableProfileState(
  sessions: readonly AutoTableInputSession[],
  manualTables: readonly TableProfileTable[] = [],
): AutoTableProfileState {
  const assignments: TableAssignment[] = [];
  const assignmentsById = new Map<string, TableAssignment>();
  const profileSessions: TableProfileSession[] = [];
  const autoTableIds: string[] = [];
  const manualTableIds = new Set<string>();
  const manualSessionCounts = new Map<string, number>();
  let autoTableIndex = 1;

  for (const session of sortSessionsChronologically(sessions)) {
    const manualTableId = isKnownManualTableId(session.tableId) ? session.tableId : undefined;
    const tables = makeTables(manualTables, autoTableIds, [...manualTableIds]);
    const profiles = buildTableProfiles(profileSessions, tables);
    const match = matchTableProfile(session.numbers, profiles);
    let autoTableId: string | undefined;
    let autoMatchLevel: AutoTableMatchLevel = match.level;
    let autoSimilarity = match.similarity;
    let autoGap = match.gap;

    const targetManualSessionCount = match.profile
      ? manualSessionCounts.get(match.profile.tableId) ?? 0
      : 0;
    if (match.profile && shouldAcceptAutoMatch(match.level, targetManualSessionCount)) {
      autoTableId = match.profile.tableId;
    } else if (!manualTableId) {
      autoTableId = nextAutoTableId(autoTableIndex);
      autoTableIndex += 1;
      autoMatchLevel = "new";
      autoSimilarity = 0;
      autoGap = 0;
      if (isAutoTableId(autoTableId)) autoTableIds.push(autoTableId);
    }

    const effectiveTableId = manualTableId ?? autoTableId;
    const source: TableAssignmentSource = manualTableId ? "manual" : autoTableId ? "auto" : "none";
    const assignment: TableAssignment = {
      sessionId: session.id,
      manualTableId,
      autoTableId,
      effectiveTableId,
      source,
      autoMatchLevel,
      autoSimilarity,
      autoGap,
    };

    assignments.push(assignment);
    assignmentsById.set(session.id, assignment);

    if (manualTableId) {
      manualTableIds.add(manualTableId);
      manualSessionCounts.set(manualTableId, (manualSessionCounts.get(manualTableId) ?? 0) + 1);
    }

    if (effectiveTableId) {
      profileSessions.push({
        id: session.id,
        name: session.name,
        numbers: session.numbers,
        tableId: effectiveTableId,
      });
      if (isAutoTableId(effectiveTableId) && !autoTableIds.includes(effectiveTableId)) {
        autoTableIds.push(effectiveTableId);
      }
    }
  }

  return {
    assignments,
    assignmentsById,
    profileSessions,
    tables: makeTables(manualTables, autoTableIds, [...manualTableIds]),
  };
}
