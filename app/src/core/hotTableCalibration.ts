import { analyzeHotNumbers, type HotNumberOptions } from "./hotNumbers";
import type { RouletteNumber } from "./roulette";
import { inferSpatialVenueKey } from "./spatialTableClustering";
import {
  buildTableProfiles,
  evaluateHotNumberTableSupport,
  type HotTableSupport,
  type HotTableSupportLevel,
  type TableProfileSession,
  type TableProfileTable,
} from "./tableHotProfile";

export type HotTableCalibrationAction = "baseline" | "enhance" | "observe" | "hint" | "block";
export type HotTableCalibrationScope = "none" | "table" | "venue";
export type HotTableCalibrationSample = "none" | "tier" | "overall";

export interface HotTableCalibrationSession {
  id: string;
  name: string;
  numbers: readonly RouletteNumber[];
  updatedAt: string;
  importIndex?: number;
  tableId?: string;
}

export interface HotTableCalibrationStats {
  signals: number;
  bet: number;
  win: number;
  hits: number;
  net: number;
  roi: number;
}

export interface HotTableCalibrationBucket {
  key: string;
  scope: Exclude<HotTableCalibrationScope, "none">;
  label: string;
  venueKey: string;
  tableId?: string;
  total: HotTableCalibrationStats;
  tiers: Record<HotTableSupportLevel, HotTableCalibrationStats>;
}

export interface HotTableCalibrationState {
  bucketsByKey: Map<string, HotTableCalibrationBucket>;
  tableVenueById: Map<string, string>;
}

export interface HotTableCalibrationDecision {
  action: HotTableCalibrationAction;
  scope: HotTableCalibrationScope;
  sample: HotTableCalibrationSample;
  label: string;
  reason: string;
  supportLevel: HotTableSupportLevel;
  stats: HotTableCalibrationStats | null;
  bucket: HotTableCalibrationBucket | null;
}

const ROI_START_INDEX = 200;
const TABLE_TIER_MIN_SIGNALS = 24;
const TABLE_OVERALL_MIN_SIGNALS = 60;
const VENUE_TIER_MIN_SIGNALS = 45;
const VENUE_OVERALL_MIN_SIGNALS = 120;

const SUPPORT_LEVELS: HotTableSupportLevel[] = [
  "strong",
  "support",
  "watch",
  "conflict",
  "unknown",
  "none",
];

function isKnownTableId(tableId: string | undefined): tableId is string {
  return Boolean(tableId && !tableId.startsWith("t_unknown_"));
}

function emptyStats(): HotTableCalibrationStats {
  return { signals: 0, bet: 0, win: 0, hits: 0, net: 0, roi: 0 };
}

function emptyTierStats(): Record<HotTableSupportLevel, HotTableCalibrationStats> {
  return SUPPORT_LEVELS.reduce((tiers, level) => {
    tiers[level] = emptyStats();
    return tiers;
  }, {} as Record<HotTableSupportLevel, HotTableCalibrationStats>);
}

function updateStats(stats: HotTableCalibrationStats, hit: boolean): void {
  stats.signals += 1;
  stats.bet += 1;
  if (hit) {
    stats.hits += 1;
    stats.win += 36;
  }
  stats.net = stats.win - stats.bet;
  stats.roi = stats.bet > 0 ? (stats.net / stats.bet) * 100 : 0;
}

function sortSessionsChronologically<T extends HotTableCalibrationSession>(sessions: readonly T[]): T[] {
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

function tableName(tableId: string, tables: readonly TableProfileTable[]): string {
  return tables.find((table) => table.id === tableId)?.name ?? tableId;
}

function tableBucketKey(tableId: string): string {
  return `table:${tableId}`;
}

function venueBucketKey(venueKey: string): string {
  return `venue:${venueKey}`;
}

function inferVenueMap(sessions: readonly HotTableCalibrationSession[]): Map<string, string> {
  const countsByTable = new Map<string, Map<string, number>>();
  for (const session of sessions) {
    if (!isKnownTableId(session.tableId)) continue;
    const venueKey = inferSpatialVenueKey(session.name);
    if (venueKey === "unknown") continue;
    const counts = countsByTable.get(session.tableId) ?? new Map<string, number>();
    counts.set(venueKey, (counts.get(venueKey) ?? 0) + 1);
    countsByTable.set(session.tableId, counts);
  }

  const result = new Map<string, string>();
  for (const [tableId, counts] of countsByTable) {
    const best = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))[0];
    if (best) result.set(tableId, best[0]);
  }
  return result;
}

function ensureBucket(
  buckets: Map<string, HotTableCalibrationBucket>,
  params: {
    scope: Exclude<HotTableCalibrationScope, "none">;
    key: string;
    label: string;
    venueKey: string;
    tableId?: string;
  },
): HotTableCalibrationBucket {
  const existing = buckets.get(params.key);
  if (existing) return existing;
  const bucket: HotTableCalibrationBucket = {
    key: params.key,
    scope: params.scope,
    label: params.label,
    venueKey: params.venueKey,
    tableId: params.tableId,
    total: emptyStats(),
    tiers: emptyTierStats(),
  };
  buckets.set(params.key, bucket);
  return bucket;
}

function record(bucket: HotTableCalibrationBucket, level: HotTableSupportLevel, hit: boolean): void {
  updateStats(bucket.total, hit);
  updateStats(bucket.tiers[level], hit);
}

export function buildHotTableCalibrationState(
  sessions: readonly HotTableCalibrationSession[],
  tables: readonly TableProfileTable[] = [],
  hotOptions: HotNumberOptions = {},
): HotTableCalibrationState {
  const sortedSessions = sortSessionsChronologically(sessions);
  const tableVenueById = inferVenueMap(sortedSessions);
  const bucketsByKey = new Map<string, HotTableCalibrationBucket>();
  const priorProfileSessions: TableProfileSession[] = [];

  for (const session of sortedSessions) {
    const tableId = isKnownTableId(session.tableId) ? session.tableId : undefined;
    const sessionVenueKey = inferSpatialVenueKey(session.name);
    const venueKey = tableId ? tableVenueById.get(tableId) ?? sessionVenueKey : sessionVenueKey;
    const profiles = buildTableProfiles(priorProfileSessions, tables);
    const analysis = analyzeHotNumbers(session.numbers, ROI_START_INDEX, hotOptions);

    for (const event of analysis.events) {
      if (event.position < ROI_START_INDEX) continue;
      const prefix = session.numbers.slice(0, event.position);
      const support = evaluateHotNumberTableSupport(prefix, event.signal.number, profiles, tableId);
      const effectiveTableId = support.profile?.tableId ?? tableId;

      if (venueKey !== "unknown") {
        const venueBucket = ensureBucket(bucketsByKey, {
          scope: "venue",
          key: venueBucketKey(venueKey),
          label: venueKey,
          venueKey,
        });
        record(venueBucket, support.level, event.hit);
      }

      if (effectiveTableId) {
        const tableVenueKey = tableVenueById.get(effectiveTableId) ?? venueKey;
        const tableBucket = ensureBucket(bucketsByKey, {
          scope: "table",
          key: tableBucketKey(effectiveTableId),
          label: tableName(effectiveTableId, tables),
          venueKey: tableVenueKey,
          tableId: effectiveTableId,
        });
        record(tableBucket, support.level, event.hit);
      }
    }

    if (tableId) {
      priorProfileSessions.push({
        id: session.id,
        name: session.name,
        numbers: session.numbers,
        tableId,
      });
    }
  }

  return { bucketsByKey, tableVenueById };
}

function classifyStats(stats: HotTableCalibrationStats): HotTableCalibrationAction {
  if (stats.roi >= 35) return "enhance";
  if (stats.roi >= 10) return "observe";
  if (stats.roi >= -5) return "hint";
  return "block";
}

function makeDecision(
  supportLevel: HotTableSupportLevel,
  bucket: HotTableCalibrationBucket,
  stats: HotTableCalibrationStats,
  sample: Exclude<HotTableCalibrationSample, "none">,
): HotTableCalibrationDecision {
  const action = classifyStats(stats);
  const scopeLabel = bucket.scope === "table" ? "桌画像" : "场地";
  const sampleLabel = sample === "tier" ? "同档" : "整体";
  const actionLabel = hotTableCalibrationActionLabel(action);
  return {
    action,
    scope: bucket.scope,
    sample,
    label: actionLabel,
    reason: `${scopeLabel}${sampleLabel} ${bucket.label}：${stats.signals} 信号，ROI ${stats.roi >= 0 ? "+" : ""}${stats.roi.toFixed(1)}%`,
    supportLevel,
    stats,
    bucket,
  };
}

export function evaluateHotTableCalibration(
  support: HotTableSupport,
  state: HotTableCalibrationState,
): HotTableCalibrationDecision {
  const supportLevel = support.level;
  const tableId = support.profile?.tableId;
  const tableBucket = tableId ? state.bucketsByKey.get(tableBucketKey(tableId)) ?? null : null;
  const venueKey = tableId ? state.tableVenueById.get(tableId) ?? tableBucket?.venueKey : undefined;
  const venueBucket = venueKey ? state.bucketsByKey.get(venueBucketKey(venueKey)) ?? null : null;

  if (tableBucket) {
    const tierStats = tableBucket.tiers[supportLevel];
    if (tierStats.signals >= TABLE_TIER_MIN_SIGNALS) {
      return makeDecision(supportLevel, tableBucket, tierStats, "tier");
    }
    if (tableBucket.total.signals >= TABLE_OVERALL_MIN_SIGNALS) {
      return makeDecision(supportLevel, tableBucket, tableBucket.total, "overall");
    }
  }

  if (venueBucket) {
    const tierStats = venueBucket.tiers[supportLevel];
    if (tierStats.signals >= VENUE_TIER_MIN_SIGNALS) {
      return makeDecision(supportLevel, venueBucket, tierStats, "tier");
    }
    if (venueBucket.total.signals >= VENUE_OVERALL_MIN_SIGNALS) {
      return makeDecision(supportLevel, venueBucket, venueBucket.total, "overall");
    }
  }

  return {
    action: "baseline",
    scope: "none",
    sample: "none",
    label: hotTableCalibrationActionLabel("baseline"),
    reason: "样本不足，沿用原始热门",
    supportLevel,
    stats: null,
    bucket: null,
  };
}

export function hotTableCalibrationActionLabel(action: HotTableCalibrationAction): string {
  if (action === "enhance") return "增强";
  if (action === "observe") return "观察";
  if (action === "hint") return "提示";
  if (action === "block") return "屏蔽";
  return "原始";
}
