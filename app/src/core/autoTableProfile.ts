import type { RouletteNumber } from "./roulette";
import {
  buildTableProfiles,
  matchTableProfile,
  type TableMatchLevel,
  type TableProfileSession,
  type TableProfileTable,
} from "./tableHotProfile";
import {
  buildSpatialTableClusters,
  makeSpatialTableFingerprint,
  spatialCenterDistance,
  spatialFingerprintDistance,
  type SpatialTableCluster,
  type SpatialTableFingerprint,
} from "./spatialTableClustering";

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
  spatialModels: AutoTableSpatialModel[];
}

export interface AutoTableSpatialModel {
  tableId: string;
  venueKey: string;
  sessionCount: number;
  primaryCenters: RouletteNumber[];
  fingerprints: SpatialTableFingerprint[];
  representativeCenter: RouletteNumber;
  silhouette: number;
}

export const AUTO_TABLE_PREFIX = "auto_";
export const AUTO_TABLE_PARENT_ID = "auto";

const MISSING_MANUAL_TABLE_PARENT_ID = "manual_missing";
const MIN_MANUAL_SESSIONS_FOR_PROBABLE_AUTO_MATCH = 3;

function isKnownManualTableId(tableId: string | undefined): tableId is string {
  return Boolean(tableId && !tableId.startsWith("t_unknown_") && !isAutoTableId(tableId));
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

function autoMatchLevelFromSpatialCluster(cluster: SpatialTableCluster): AutoTableMatchLevel {
  if (cluster.sessionIds.length >= 3 && cluster.silhouette >= 0.25) return "confirmed";
  return "probable";
}

function makeSpatialModels(
  clusters: readonly SpatialTableCluster[],
  tableIdByClusterId: ReadonlyMap<string, string>,
): AutoTableSpatialModel[] {
  const models: AutoTableSpatialModel[] = [];
  for (const cluster of clusters) {
    const tableId = tableIdByClusterId.get(cluster.id);
    if (!tableId) continue;
    models.push({
      tableId,
      venueKey: cluster.venueKey,
      sessionCount: cluster.sessionIds.length,
      primaryCenters: cluster.primaryCenters,
      fingerprints: cluster.fingerprints,
      representativeCenter: cluster.representativeCenter,
      silhouette: cluster.silhouette,
    });
  }
  return models;
}

function makeUnassignedTableAssignment(sessionId: string, manualTableId?: string): TableAssignment {
  return {
    sessionId,
    manualTableId,
    effectiveTableId: manualTableId,
    source: manualTableId ? "manual" : "none",
    autoMatchLevel: "none",
    autoSimilarity: 0,
    autoGap: 0,
  };
}

function matchSpatialAutoTableModel(
  session: AutoTableInputSession,
  models: readonly AutoTableSpatialModel[],
): Pick<TableAssignment, "autoTableId" | "autoMatchLevel" | "autoSimilarity" | "autoGap"> | null {
  const fingerprint = makeSpatialTableFingerprint(session);
  if (!fingerprint || models.length === 0) return null;

  const sameVenueModels = fingerprint.venueKey !== "unknown"
    ? models.filter((model) => model.venueKey === fingerprint.venueKey)
    : [];
  const candidates = sameVenueModels.length > 0 ? sameVenueModels : models;

  const ranked = candidates
    .map((model) => {
      const bestPrimaryDistance = Math.min(
        ...model.primaryCenters.map((center) => spatialCenterDistance(fingerprint.primaryCenter, center)),
      );
      const bestFingerprintDistance = Math.min(
        ...model.fingerprints.map((modelFingerprint) => spatialFingerprintDistance(fingerprint, modelFingerprint)),
      );
      const representativeDistance = spatialCenterDistance(fingerprint.primaryCenter, model.representativeCenter);
      return { model, bestFingerprintDistance, bestPrimaryDistance, representativeDistance };
    })
    .sort((left, right) => (
      left.bestFingerprintDistance - right.bestFingerprintDistance
      || left.bestPrimaryDistance - right.bestPrimaryDistance
      || left.representativeDistance - right.representativeDistance
      || right.model.sessionCount - left.model.sessionCount
      || left.model.tableId.localeCompare(right.model.tableId)
    ));

  const best = ranked[0];
  if (!best || (best.bestFingerprintDistance > 6 && best.bestPrimaryDistance > 2)) return null;
  const secondDistance = ranked[1]?.bestFingerprintDistance;
  const autoSimilarity = Math.max(0, Math.min(1, 1 - Math.min(best.bestFingerprintDistance, 18) / 18));
  const autoGap = secondDistance === undefined
    ? autoSimilarity
    : Math.max(0, Math.min(1, (secondDistance - best.bestFingerprintDistance) / 18));

  return {
    autoTableId: best.model.tableId,
    autoMatchLevel: best.bestFingerprintDistance <= 0.001 ? "confirmed" : "probable",
    autoSimilarity,
    autoGap,
  };
}

export function assignSessionToAutoTableProfileState(
  session: AutoTableInputSession,
  state: AutoTableProfileState,
): TableAssignment {
  const manualTableId = isKnownManualTableId(session.tableId) ? session.tableId : undefined;
  const spatialMatch = matchSpatialAutoTableModel(session, state.spatialModels);
  const profiles = buildTableProfiles(state.profileSessions, state.tables);
  const profileMatch = matchTableProfile(session.numbers, profiles);
  const profileAssignment = profileMatch.profile && shouldAcceptAutoMatch(profileMatch.level, profileMatch.profile.sessionCount)
    ? {
      autoTableId: profileMatch.profile.tableId,
      autoMatchLevel: profileMatch.level,
      autoSimilarity: profileMatch.similarity,
      autoGap: profileMatch.gap,
    }
    : null;
  const chosenMatch = profileAssignment?.autoMatchLevel === "confirmed"
    ? profileAssignment
    : spatialMatch?.autoMatchLevel === "confirmed"
      ? spatialMatch
      : profileAssignment ?? spatialMatch;
  const autoTableId = chosenMatch?.autoTableId;
  const autoMatchLevel: AutoTableMatchLevel = chosenMatch?.autoMatchLevel ?? "none";
  const autoSimilarity = chosenMatch?.autoSimilarity ?? 0;
  const autoGap = chosenMatch?.autoGap ?? 0;

  if (!manualTableId && !autoTableId) return makeUnassignedTableAssignment(session.id);
  const effectiveTableId = manualTableId ?? autoTableId;
  return {
    sessionId: session.id,
    manualTableId,
    autoTableId,
    effectiveTableId,
    source: manualTableId ? "manual" : "auto",
    autoMatchLevel,
    autoSimilarity,
    autoGap,
  };
}

function rebuildAutoTableStateFromAssignments(
  sessions: readonly AutoTableInputSession[],
  assignments: readonly TableAssignment[],
  manualTables: readonly TableProfileTable[],
  spatialModels: readonly AutoTableSpatialModel[],
): AutoTableProfileState {
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.sessionId, assignment]));
  const profileSessions: TableProfileSession[] = [];
  const autoTableIds: string[] = [];
  const manualTableIds = new Set<string>();

  const addAutoTableId = (tableId: string): void => {
    if (isAutoTableId(tableId) && !autoTableIds.includes(tableId)) {
      autoTableIds.push(tableId);
    }
  };

  for (const session of sortSessionsChronologically(sessions)) {
    const assignment = assignmentsById.get(session.id);
    if (!assignment) continue;
    if (assignment.manualTableId) manualTableIds.add(assignment.manualTableId);
    if (!assignment.effectiveTableId) continue;
    if (isAutoTableId(assignment.effectiveTableId)) addAutoTableId(assignment.effectiveTableId);
    profileSessions.push({
      id: session.id,
      name: session.name,
      numbers: session.numbers,
      tableId: assignment.effectiveTableId,
    });
  }

  return {
    assignments: [...assignments],
    assignmentsById,
    profileSessions,
    tables: makeTables(manualTables, autoTableIds, [...manualTableIds]),
    spatialModels: [...spatialModels],
  };
}

function haveSameAutoTableAssignments(
  left: AutoTableProfileState,
  right: AutoTableProfileState,
): boolean {
  if (left.assignments.length !== right.assignments.length) return false;
  for (const assignment of left.assignments) {
    const next = right.assignmentsById.get(assignment.sessionId);
    if (!next) return false;
    if (assignment.effectiveTableId !== next.effectiveTableId) return false;
    if (assignment.source !== next.source) return false;
    if (assignment.autoMatchLevel !== next.autoMatchLevel) return false;
  }
  return true;
}

function buildSeedAutoTableProfileState(
  sessions: readonly AutoTableInputSession[],
  manualTables: readonly TableProfileTable[] = [],
): AutoTableProfileState {
  const assignments: TableAssignment[] = [];
  const assignmentsById = new Map<string, TableAssignment>();
  const profileSessions: TableProfileSession[] = [];
  const autoTableIds: string[] = [];
  const manualTableIds = new Set<string>();
  const manualSessionCounts = new Map<string, number>();
  const sortedSessions = sortSessionsChronologically(sessions);
  const sessionById = new Map(sortedSessions.map((session) => [session.id, session]));
  const spatialClusters = buildSpatialTableClusters(sortedSessions);
  const spatialClusterBySessionId = new Map<string, SpatialTableCluster>();
  const spatialManualTableIdsByClusterId = new Map<string, string[]>();
  const spatialTableIdByClusterId = new Map<string, string>();
  let autoTableIndex = 1;

  const addAutoTableId = (tableId: string): void => {
    if (isAutoTableId(tableId) && !autoTableIds.includes(tableId)) {
      autoTableIds.push(tableId);
    }
  };

  for (const cluster of spatialClusters) {
    const manualIds = new Set<string>();
    for (const sessionId of cluster.sessionIds) {
      spatialClusterBySessionId.set(sessionId, cluster);
      const tableId = sessionById.get(sessionId)?.tableId;
      if (isKnownManualTableId(tableId)) manualIds.add(tableId);
    }
    spatialManualTableIdsByClusterId.set(cluster.id, [...manualIds]);
  }

  const tableIdForSpatialCluster = (cluster: SpatialTableCluster): string => {
    const existing = spatialTableIdByClusterId.get(cluster.id);
    if (existing) return existing;
    const manualIds = spatialManualTableIdsByClusterId.get(cluster.id) ?? [];
    const tableId = manualIds.length === 1 ? manualIds[0] : nextAutoTableId(autoTableIndex);
    if (isAutoTableId(tableId)) {
      autoTableIndex += 1;
      addAutoTableId(tableId);
    }
    spatialTableIdByClusterId.set(cluster.id, tableId);
    return tableId;
  };

  for (const session of sortedSessions) {
    const manualTableId = isKnownManualTableId(session.tableId) ? session.tableId : undefined;
    const tables = makeTables(manualTables, autoTableIds, [...manualTableIds]);
    const profiles = buildTableProfiles(profileSessions, tables);
    const spatialCluster = spatialClusterBySessionId.get(session.id);
    const match = spatialCluster ? null : matchTableProfile(session.numbers, profiles);
    let autoTableId: string | undefined;
    let autoMatchLevel: AutoTableMatchLevel = match?.level ?? "none";
    let autoSimilarity = match?.similarity ?? 0;
    let autoGap = match?.gap ?? 0;

    if (spatialCluster) {
      autoTableId = tableIdForSpatialCluster(spatialCluster);
      autoMatchLevel = autoMatchLevelFromSpatialCluster(spatialCluster);
      autoSimilarity = Math.max(0, Math.min(1, spatialCluster.silhouette));
      autoGap = 0;
    } else if (match) {
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
        addAutoTableId(autoTableId);
      }
    } else if (!manualTableId) {
      autoTableId = nextAutoTableId(autoTableIndex);
      autoTableIndex += 1;
      autoMatchLevel = "new";
      autoSimilarity = 0;
      autoGap = 0;
      addAutoTableId(autoTableId);
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
        addAutoTableId(effectiveTableId);
      }
    }
  }

  return {
    assignments,
    assignmentsById,
    profileSessions,
    tables: makeTables(manualTables, autoTableIds, [...manualTableIds]),
    spatialModels: makeSpatialModels(spatialClusters, spatialTableIdByClusterId),
  };
}

export function buildAutoTableProfileState(
  sessions: readonly AutoTableInputSession[],
  manualTables: readonly TableProfileTable[] = [],
): AutoTableProfileState {
  let state = buildSeedAutoTableProfileState(sessions, manualTables);
  const sortedSessions = sortSessionsChronologically(sessions);

  for (let iteration = 0; iteration < 5; iteration += 1) {
    const assignments = sortedSessions.map((session) => assignSessionToAutoTableProfileState(session, state));
    const nextState = rebuildAutoTableStateFromAssignments(sessions, assignments, manualTables, state.spatialModels);
    if (haveSameAutoTableAssignments(state, nextState)) return nextState;
    state = nextState;
  }

  return state;
}
