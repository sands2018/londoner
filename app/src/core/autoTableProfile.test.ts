import { describe, expect, it } from "vitest";
import { buildAutoTableProfileState } from "./autoTableProfile";
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

describe("auto table profile", () => {
  it("creates an automatic profile for unassigned sessions and reuses it for similar sessions", () => {
    const state = buildAutoTableProfileState([
      { id: "a", name: "A", updatedAt: "2026-01-01T00:00:00.000Z", numbers: tableOneNumbers },
      { id: "b", name: "B", updatedAt: "2026-01-02T00:00:00.000Z", numbers: tableOneNumbers },
    ]);

    expect(state.assignmentsById.get("a")?.source).toBe("auto");
    expect(state.assignmentsById.get("a")?.autoMatchLevel).toBe("new");
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
    expect(assignment?.autoTableId).toBe("auto_01");
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
      "自动画像1",
      "自动画像2",
    ]);
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
