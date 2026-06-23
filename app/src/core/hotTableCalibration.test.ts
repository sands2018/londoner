import { describe, expect, it } from "vitest";
import type { HotTableSupport } from "./tableHotProfile";
import {
  evaluateHotTableCalibration,
  type HotTableCalibrationBucket,
  type HotTableCalibrationState,
  type HotTableCalibrationStats,
} from "./hotTableCalibration";
import type { RouletteNumber } from "./roulette";

function stats(signals: number, hits: number): HotTableCalibrationStats {
  const bet = signals;
  const win = hits * 36;
  const net = win - bet;
  return {
    signals,
    bet,
    win,
    hits,
    net,
    roi: bet > 0 ? (net / bet) * 100 : 0,
  };
}

function emptyStats(): HotTableCalibrationStats {
  return stats(0, 0);
}

function bucket(params: Partial<HotTableCalibrationBucket> = {}): HotTableCalibrationBucket {
  return {
    key: "table:t_1",
    scope: "table",
    label: "T1",
    venueKey: "venue",
    tableId: "t_1",
    total: emptyStats(),
    tiers: {
      strong: emptyStats(),
      support: emptyStats(),
      watch: emptyStats(),
      conflict: emptyStats(),
      unknown: emptyStats(),
      none: emptyStats(),
    },
    ...params,
  };
}

function support(level: HotTableSupport["level"]): HotTableSupport {
  const profile = {
    tableId: "t_1",
    tableName: "T1",
    sessionCount: 3,
    totalNumbers: 600,
    sectorVector: [],
    sectorCounts: [],
    hotSectors: [],
  };
  return {
    level,
    profile,
    match: {
      level: "confirmed",
      profile,
      similarity: 0.8,
      gap: 0.4,
      secondSimilarity: null,
    },
    sector: {
      center: 1 as RouletteNumber,
      numbers: [1, 2, 3, 4, 5, 6, 7] as RouletteNumber[],
      count: 60,
      z: 1.2,
    },
    rank: 1,
    z: 1.2,
    reason: "",
  };
}

describe("hot table calibration", () => {
  it("uses same-table same-tier ROI before broader fallbacks", () => {
    const table = bucket({
      tiers: {
        ...bucket().tiers,
        support: stats(24, 2),
      },
      total: stats(80, 0),
    });
    const state: HotTableCalibrationState = {
      bucketsByKey: new Map([[table.key, table]]),
      tableVenueById: new Map([["t_1", "venue"]]),
    };

    const decision = evaluateHotTableCalibration(support("support"), state);

    expect(decision.action).toBe("enhance");
    expect(decision.sample).toBe("tier");
    expect(decision.scope).toBe("table");
  });

  it("falls back to same-table overall performance when tier sample is thin", () => {
    const table = bucket({
      tiers: {
        ...bucket().tiers,
        support: stats(8, 1),
      },
      total: stats(60, 1),
    });
    const state: HotTableCalibrationState = {
      bucketsByKey: new Map([[table.key, table]]),
      tableVenueById: new Map([["t_1", "venue"]]),
    };

    const decision = evaluateHotTableCalibration(support("support"), state);

    expect(decision.action).toBe("block");
    expect(decision.sample).toBe("overall");
  });

  it("falls back to the raw hot signal when there is not enough table or venue sample", () => {
    const table = bucket({ total: stats(20, 2) });
    const state: HotTableCalibrationState = {
      bucketsByKey: new Map([[table.key, table]]),
      tableVenueById: new Map([["t_1", "venue"]]),
    };

    const decision = evaluateHotTableCalibration(support("support"), state);

    expect(decision.action).toBe("baseline");
    expect(decision.sample).toBe("none");
  });
});
