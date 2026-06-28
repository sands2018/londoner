import type { RouletteNumber } from "./roulette";
import {
  buildTableProfiles,
  matchTableProfile,
  type TableMatchLevel,
  type TableProfile,
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
const STRONG_PROFILE_CONFLICT_MIN_SIMILARITY = 0.6;
const STRONG_PROFILE_CONFLICT_MIN_ADVANTAGE = 0.05;

type AutoTableMatchCandidate = Pick<TableAssignment, "autoTableId" | "autoMatchLevel" | "autoSimilarity" | "autoGap">;

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
  const suffix = tableId.slice(AUTO_TABLE_PREFIX.length).replace(/\D/g, "");
  const index = Number.parseInt(suffix, 10);
  return `自-${Number.isFinite(index) ? String(index).padStart(3, "0") : "000"}`;
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

function representativeCenter(centers: readonly RouletteNumber[]): RouletteNumber {
  let best = centers[0] ?? 0;
  let bestCost = Number.POSITIVE_INFINITY;
  for (const candidate of centers) {
    const cost = centers.reduce((sum, center) => sum + spatialCenterDistance(candidate, center), 0);
    if (cost < bestCost) {
      best = candidate;
      bestCost = cost;
    }
  }
  return best;
}

function spatialModelSilhouette(centers: readonly RouletteNumber[]): number {
  if (centers.length <= 1) return 1;
  const representative = representativeCenter(centers);
  const averageDistance = centers.reduce((sum, center) => sum + spatialCenterDistance(representative, center), 0) / centers.length;
  return Math.max(0, Math.min(1, 1 - averageDistance / 18));
}

function buildSpatialModelsFromAssignedSessions(
  sessions: readonly AutoTableInputSession[],
  assignmentsById: ReadonlyMap<string, TableAssignment>,
): AutoTableSpatialModel[] {
  const grouped = new Map<string, {
    tableId: string;
    venueKey: string;
    primaryCenters: RouletteNumber[];
    fingerprints: SpatialTableFingerprint[];
  }>();

  for (const session of sortSessionsChronologically(sessions)) {
    const tableId = assignmentsById.get(session.id)?.effectiveTableId;
    if (!tableId) continue;
    const fingerprint = makeSpatialTableFingerprint(session);
    if (!fingerprint) continue;
    const key = `${tableId}\u0000${fingerprint.venueKey}`;
    const group = grouped.get(key) ?? {
      tableId,
      venueKey: fingerprint.venueKey,
      primaryCenters: [],
      fingerprints: [],
    };
    group.primaryCenters.push(fingerprint.primaryCenter);
    group.fingerprints.push(fingerprint);
    grouped.set(key, group);
  }

  return [...grouped.values()].map((group) => ({
    tableId: group.tableId,
    venueKey: group.venueKey,
    sessionCount: group.fingerprints.length,
    primaryCenters: group.primaryCenters,
    fingerprints: group.fingerprints,
    representativeCenter: representativeCenter(group.primaryCenters),
    silhouette: spatialModelSilhouette(group.primaryCenters),
  }));
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

function matchSpatialAutoTableModel(
  session: AutoTableInputSession,
  models: readonly AutoTableSpatialModel[],
): AutoTableMatchCandidate | null {
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

function makeProfileMatchCandidate(
  profileMatch: ReturnType<typeof matchTableProfile>,
): AutoTableMatchCandidate | null {
  if (!profileMatch.profile) return null;
  return {
    autoTableId: profileMatch.profile.tableId,
    autoMatchLevel: profileMatch.level,
    autoSimilarity: profileMatch.similarity,
    autoGap: profileMatch.gap,
  };
}

function profileSimilarityForTable(
  numbers: readonly RouletteNumber[],
  profiles: readonly TableProfile[],
  tableId: string | undefined,
): number {
  if (!tableId) return 0;
  const profile = profiles.find((item) => item.tableId === tableId);
  return profile ? matchTableProfile(numbers, [profile]).similarity : 0;
}

function shouldProtectStrongProfileMatch(
  numbers: readonly RouletteNumber[],
  profiles: readonly TableProfile[],
  profileMatch: ReturnType<typeof matchTableProfile>,
  spatialMatch: AutoTableMatchCandidate | null,
): boolean {
  if (!profileMatch.profile || !spatialMatch?.autoTableId) return false;
  if (spatialMatch.autoMatchLevel !== "probable") return false;
  if (profileMatch.profile.tableId === spatialMatch.autoTableId) return false;
  if (profileMatch.similarity < STRONG_PROFILE_CONFLICT_MIN_SIMILARITY) return false;

  const spatialProfileSimilarity = profileSimilarityForTable(numbers, profiles, spatialMatch.autoTableId);
  return profileMatch.similarity - spatialProfileSimilarity >= STRONG_PROFILE_CONFLICT_MIN_ADVANTAGE;
}

function makeRetainedAutoTableCandidate(
  session: AutoTableInputSession,
  state: AutoTableProfileState,
): AutoTableMatchCandidate | null {
  const existing = state.assignmentsById.get(session.id);
  const tableId = existing?.source === "auto"
    ? existing.autoTableId ?? existing.effectiveTableId
    : undefined;
  if (!tableId) return null;
  return {
    autoTableId: tableId,
    autoMatchLevel: "new",
    autoSimilarity: 0,
    autoGap: 0,
  };
}

export function assignSessionToAutoTableProfileState(
  session: AutoTableInputSession,
  state: AutoTableProfileState,
): TableAssignment {
  const manualTableId = isKnownManualTableId(session.tableId) ? session.tableId : undefined;
  const spatialMatch = matchSpatialAutoTableModel(session, state.spatialModels);
  const profileSessions = state.profileSessions.filter((profileSession) => profileSession.id !== session.id);
  const profiles = buildTableProfiles(profileSessions, state.tables);
  const profileMatch = matchTableProfile(session.numbers, profiles);
  const profileAssignment = profileMatch.profile && shouldAcceptAutoMatch(profileMatch.level, profileMatch.profile.sessionCount)
    ? makeProfileMatchCandidate(profileMatch)
    : null;
  const protectedProfileAssignment = shouldProtectStrongProfileMatch(
    session.numbers,
    profiles,
    profileMatch,
    spatialMatch,
  )
    ? makeProfileMatchCandidate(profileMatch)
    : null;
  const chosenMatch = profileAssignment?.autoMatchLevel === "confirmed"
    ? profileAssignment
    : protectedProfileAssignment
      ? protectedProfileAssignment
      : spatialMatch?.autoMatchLevel === "confirmed"
      ? spatialMatch
      : profileAssignment ?? spatialMatch ?? makeRetainedAutoTableCandidate(session, state);
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

function makeNewAutoTableAssignment(sessionId: string, tableId: string): TableAssignment {
  return {
    sessionId,
    autoTableId: tableId,
    effectiveTableId: tableId,
    source: "auto",
    autoMatchLevel: "new",
    autoSimilarity: 0,
    autoGap: 0,
  };
}

function makeManualTableAssignment(sessionId: string, tableId: string): TableAssignment {
  return {
    sessionId,
    manualTableId: tableId,
    autoTableId: tableId,
    effectiveTableId: tableId,
    source: "manual",
    autoMatchLevel: "confirmed",
    autoSimilarity: 1,
    autoGap: 1,
  };
}

function buildPriorAutoTableState(
  sessions: readonly AutoTableInputSession[],
  assignments: readonly TableAssignment[],
  manualTables: readonly TableProfileTable[],
): AutoTableProfileState {
  const assignmentsById = new Map(assignments.map((assignment) => [assignment.sessionId, assignment]));
  return rebuildAutoTableStateFromAssignments(
    sessions,
    assignments,
    manualTables,
    buildSpatialModelsFromAssignedSessions(sessions, assignmentsById),
  );
}

function buildFullSpaceSeedAutoTableProfileState(
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
      autoTableId: manualTableId ?? autoTableId,
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

function buildFullSpaceAutoTableProfileState(
  sessions: readonly AutoTableInputSession[],
  manualTables: readonly TableProfileTable[] = [],
): AutoTableProfileState {
  // Full-history classification should keep the spatial cluster structure stable.
  // Profile matching still handles non-clustered rows here and realtime current-session matching below.
  return buildFullSpaceSeedAutoTableProfileState(sessions, manualTables);
}

export function buildWalkForwardAutoTableProfileState(
  sessions: readonly AutoTableInputSession[],
  manualTables: readonly TableProfileTable[] = [],
): AutoTableProfileState {
  const assignments: TableAssignment[] = [];
  const assignmentsById = new Map<string, TableAssignment>();
  const autoTableIds: string[] = [];
  const sortedSessions = sortSessionsChronologically(sessions);
  let autoTableIndex = 1;

  const addAutoTableId = (tableId: string): void => {
    if (isAutoTableId(tableId) && !autoTableIds.includes(tableId)) {
      autoTableIds.push(tableId);
    }
  };

  for (let index = 0; index < sortedSessions.length; index += 1) {
    const session = sortedSessions[index];
    const manualTableId = isKnownManualTableId(session.tableId) ? session.tableId : undefined;
    const priorSessions = sortedSessions.slice(0, index);
    const priorState = buildPriorAutoTableState(priorSessions, assignments, manualTables);
    const matched = manualTableId
      ? makeManualTableAssignment(session.id, manualTableId)
      : assignSessionToAutoTableProfileState(session, priorState);
    let assignment = matched.effectiveTableId
      ? matched
      : null;

    if (!assignment) {
      const autoTableId = nextAutoTableId(autoTableIndex);
      autoTableIndex += 1;
      addAutoTableId(autoTableId);
      assignment = makeNewAutoTableAssignment(session.id, autoTableId);
    } else if (assignment.autoTableId && isAutoTableId(assignment.autoTableId)) {
      addAutoTableId(assignment.autoTableId);
    } else if (assignment.effectiveTableId && isAutoTableId(assignment.effectiveTableId)) {
      addAutoTableId(assignment.effectiveTableId);
    }

    assignments.push(assignment);
    assignmentsById.set(session.id, assignment);
  }

  return rebuildAutoTableStateFromAssignments(
    sortedSessions,
    assignments,
    manualTables,
    buildSpatialModelsFromAssignedSessions(sortedSessions, assignmentsById),
  );
}

export function buildAutoTableProfileState(
  sessions: readonly AutoTableInputSession[],
  manualTables: readonly TableProfileTable[] = [],
): AutoTableProfileState {
  return buildFullSpaceAutoTableProfileState(sessions, manualTables);
}
