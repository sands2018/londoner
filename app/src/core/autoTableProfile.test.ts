import { describe, expect, it } from "vitest";
import {
  assignSessionToAutoTableProfileState,
  buildAutoTableProfileState,
  type AutoTableInputSession,
} from "./autoTableProfile";
import type { RouletteNumber } from "./roulette";

function repeat(values: RouletteNumber[], times: number): RouletteNumber[] {
  const result: RouletteNumber[] = [];
  for (let index = 0; index < times; index += 1) {
    result.push(...values);
  }
  return result;
}

const tableOneNumbers = repeat([22, 18, 29, 7, 28, 12, 35, 9], 20);
const tableTwoNumbers = repeat([24, 16, 33, 1, 20, 14, 31, 10], 20);
const probableTableOneNumbers = [
  ...tableTwoNumbers.slice(0, 100),
  ...tableOneNumbers.slice(0, 60),
];

const wynnTableOneNumbers = repeat([22, 18, 29, 7, 28, 12, 35], 20);
const wynnTableTwoNumbers = repeat([10, 5, 24, 16, 33, 1, 20], 20);
const wynnTableThreeNumbers = repeat([0, 32, 15, 19, 4, 21, 2], 20);

function makeSession(
  id: string,
  updatedAt: string,
  numbers: RouletteNumber[],
): AutoTableInputSession {
  return {
    id,
    name: `${id}-wynn`,
    updatedAt,
    numbers,
  };
}

describe("auto table profile", () => {
  it("creates an automatic profile for unassigned sessions and reuses it for similar sessions", () => {
    const state = buildAutoTableProfileState([
      { id: "a", name: "A", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers },
      { id: "b", name: "B", updatedAt: "2026-01-02T00:00:00.000Z", numbers: tableOneNumbers },
    ]);

    expect(state.assignmentsById.get("a")?.source).toBe("auto");
    expect(state.assignmentsById.get("a")?.autoMatchLevel).toBe("confirmed");
    expect(state.assignmentsById.get("b")?.source).toBe("auto");
    expect(state.assignmentsById.get("b")?.effectiveTableId).toBe(state.assignmentsById.get("a")?.effectiveTableId);
  });

  it("uses manual table assignments as the effective table when present", () => {
    const state = buildAutoTableProfileState([
      { id: "a", name: "A", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers },
      { id: "b", name: "B", updatedAt: "2026-01-02T00:00:00.000Z", numbers: tableOneNumbers, tableId: "t_manual" },
    ], [
      { id: "t_manual", name: "澳门永利_01", parentId: "c_1" },
    ]);

    const assignment = state.assignmentsById.get("b");
    expect(assignment?.source).toBe("manual");
    expect(assignment?.manualTableId).toBe("t_manual");
    expect(assignment?.effectiveTableId).toBe("t_manual");
    expect(assignment?.autoTableId).toBe("t_manual");
  });

  it("can automatically match an unassigned session to a manually seeded table profile", () => {
    const state = buildAutoTableProfileState([
      { id: "seed", name: "Seed", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers, tableId: "t_1" },
      { id: "next", name: "Next", updatedAt: "2026-01-02T00:00:00.000Z", numbers: tableOneNumbers },
    ], [
      { id: "t_1", name: "澳门永利_01", parentId: "c_1" },
    ]);

    const assignment = state.assignmentsById.get("next");
    expect(assignment?.source).toBe("auto");
    expect(assignment?.autoTableId).toBe("t_1");
    expect(assignment?.effectiveTableId).toBe("t_1");
  });

  it("creates a new automatic profile when previous profiles are too weak", () => {
    const state = buildAutoTableProfileState([
      { id: "a", name: "A", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers },
      { id: "b", name: "B", updatedAt: "2026-01-02T00:00:00.000Z", numbers: tableTwoNumbers },
    ]);

    expect(state.assignmentsById.get("a")?.effectiveTableId).toBe("auto_01");
    expect(state.assignmentsById.get("b")?.effectiveTableId).toBe("auto_02");
    expect(state.tables.filter((table) => table.id.startsWith("auto_")).map((table) => table.name)).toEqual([
      "自-001",
      "自-002",
    ]);
  });

  it("uses batch spatial clustering to split same-venue history into table-like groups", () => {
    const state = buildAutoTableProfileState([
      makeSession("20260601-1630", "2026-06-01T08:30:00.000Z", wynnTableOneNumbers),
      makeSession("20260602-0018", "2026-06-01T16:18:00.000Z", wynnTableOneNumbers),
      makeSession("20260603-0030", "2026-06-02T16:30:00.000Z", wynnTableTwoNumbers),
      makeSession("20260603-0230", "2026-06-02T18:30:00.000Z", wynnTableThreeNumbers),
      makeSession("20260603-2101", "2026-06-03T13:01:00.000Z", wynnTableTwoNumbers),
      makeSession("20260604-1630", "2026-06-04T08:30:00.000Z", wynnTableOneNumbers),
      makeSession("20260604-2223", "2026-06-04T14:23:00.000Z", wynnTableTwoNumbers),
      makeSession("20260605-0230", "2026-06-04T18:30:00.000Z", wynnTableTwoNumbers),
      makeSession("20260606-0131", "2026-06-05T17:31:00.000Z", wynnTableThreeNumbers),
      makeSession("20260607-0217", "2026-06-06T18:17:00.000Z", wynnTableThreeNumbers),
    ]);

    const groupTableIds = (ids: string[]) => ids.map((id) => state.assignmentsById.get(id)?.effectiveTableId);
    const tableOneIds = groupTableIds(["20260601-1630", "20260602-0018", "20260604-1630"]);
    const tableTwoIds = groupTableIds(["20260603-0030", "20260603-2101", "20260604-2223", "20260605-0230"]);
    const tableThreeIds = groupTableIds(["20260603-0230", "20260606-0131", "20260607-0217"]);

    expect(new Set(tableOneIds).size).toBe(1);
    expect(new Set(tableTwoIds).size).toBe(1);
    expect(new Set(tableThreeIds).size).toBe(1);
    expect(new Set([tableOneIds[0], tableTwoIds[0], tableThreeIds[0]]).size).toBe(3);
    expect(state.tables.filter((table) => table.id.startsWith("auto_"))).toHaveLength(3);
  });

  it("classifies an unsaved current session against the existing spatial model without creating a table", () => {
    const state = buildAutoTableProfileState([
      makeSession("20260601-1630", "2026-06-01T08:30:00.000Z", wynnTableOneNumbers),
      makeSession("20260602-0018", "2026-06-01T16:18:00.000Z", wynnTableOneNumbers),
      makeSession("20260603-0030", "2026-06-02T16:30:00.000Z", wynnTableTwoNumbers),
      makeSession("20260603-0230", "2026-06-02T18:30:00.000Z", wynnTableThreeNumbers),
      makeSession("20260603-2101", "2026-06-03T13:01:00.000Z", wynnTableTwoNumbers),
      makeSession("20260604-1630", "2026-06-04T08:30:00.000Z", wynnTableOneNumbers),
      makeSession("20260604-2223", "2026-06-04T14:23:00.000Z", wynnTableTwoNumbers),
      makeSession("20260605-0230", "2026-06-04T18:30:00.000Z", wynnTableTwoNumbers),
      makeSession("20260606-0131", "2026-06-05T17:31:00.000Z", wynnTableThreeNumbers),
      makeSession("20260607-0217", "2026-06-06T18:17:00.000Z", wynnTableThreeNumbers),
    ]);
    const expectedTableId = state.assignmentsById.get("20260603-2101")?.effectiveTableId;

    const assignment = assignSessionToAutoTableProfileState({
      id: "current",
      name: "current-auto-table",
      updatedAt: "9999-12-31T23:59:59.999Z",
      numbers: wynnTableTwoNumbers,
    }, state);

    expect(assignment.source).toBe("auto");
    expect(assignment.effectiveTableId).toBe(expectedTableId);
    expect(state.assignmentsById.has("current")).toBe(false);
  });

  it("treats the default unknown manual table as unassigned", () => {
    const state = buildAutoTableProfileState([
      { id: "unknown", name: "Unknown", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers, tableId: "t_unknown_c_1" },
    ]);

    const assignment = state.assignmentsById.get("unknown");
    expect(assignment?.source).toBe("auto");
    expect(assignment?.manualTableId).toBeUndefined();
    expect(assignment?.effectiveTableId).toBe("auto_01");
  });

  it("treats persisted auto table ids as unassigned rather than manual", () => {
    const state = buildAutoTableProfileState([
      { id: "auto", name: "Auto", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers, tableId: "auto_99" },
    ]);

    const assignment = state.assignmentsById.get("auto");
    expect(assignment?.source).toBe("auto");
    expect(assignment?.manualTableId).toBeUndefined();
    expect(assignment?.effectiveTableId).toBe("auto_01");
  });

  it("requires confirmed matching before auto-joining a small manual table profile", () => {
    const state = buildAutoTableProfileState([
      { id: "seed", name: "Seed", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers, tableId: "t_1" },
      { id: "probable", name: "Probable", updatedAt: "2026-01-02T00:00:00.000Z", numbers: probableTableOneNumbers },
    ], [
      { id: "t_1", name: "澳门永利_01", parentId: "c_1" },
    ]);

    const assignment = state.assignmentsById.get("probable");
    expect(assignment?.source).toBe("auto");
    expect(assignment?.effectiveTableId).toBe("auto_01");
  });

  it("allows probable auto-joining after a manual table profile has enough manual samples", () => {
    const state = buildAutoTableProfileState([
      { id: "seed1", name: "Seed 1", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers, tableId: "t_1" },
      { id: "seed2", name: "Seed 2", updatedAt: "2026-01-02T00:00:00.000Z", numbers: tableOneNumbers, tableId: "t_1" },
      { id: "seed3", name: "Seed 3", updatedAt: "2026-01-03T00:00:00.000Z", numbers: tableOneNumbers, tableId: "t_1" },
      { id: "probable", name: "Probable", updatedAt: "2026-01-04T00:00:00.000Z", numbers: probableTableOneNumbers },
    ], [
      { id: "t_1", name: "澳门永利_01", parentId: "c_1" },
    ]);

    const assignment = state.assignmentsById.get("probable");
    expect(assignment?.source).toBe("auto");
    expect(assignment?.effectiveTableId).toBe("t_1");
  });

  it("uses importIndex as a stable chronological tie breaker", () => {
    const state = buildAutoTableProfileState([
      { id: "second", name: "Second", updatedAt: "2026-01-01T00:00:00.000Z", importIndex: 2, numbers: tableOneNumbers },
      { id: "first", name: "First", updatedAt: "2026-01-01T00:00:00.000Z", importIndex: 1, numbers: tableTwoNumbers },
    ]);

    expect(state.assignmentsById.get("first")?.effectiveTableId).toBe("auto_01");
    expect(state.assignmentsById.get("second")?.effectiveTableId).toBe("auto_02");
  });
});
