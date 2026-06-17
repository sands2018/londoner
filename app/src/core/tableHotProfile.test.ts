import { describe, expect, it } from "vitest";
import {
  buildTableProfiles,
  evaluateHotNumberTableSupport,
  matchTableProfile,
  type TableProfileSession,
} from "./tableHotProfile";
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

describe("table hot profile", () => {
  it("builds profiles only from assigned local sessions", () => {
    const sessions: TableProfileSession[] = [
      { id: "a", name: "A", tableId: "t_1", numbers: tableOneNumbers },
      { id: "b", name: "B", tableId: "t_2", numbers: tableTwoNumbers },
      { id: "c", name: "Unknown", numbers: tableOneNumbers },
      { id: "d", name: "Default unknown", tableId: "t_unknown_c_1", numbers: tableTwoNumbers },
    ];

    const profiles = buildTableProfiles(sessions, [
      { id: "t_1", name: "澳门永利_01", parentId: "c_1" },
      { id: "t_2", name: "澳门永利_02", parentId: "c_1" },
    ]);

    expect(profiles).toHaveLength(2);
    expect(profiles.map((profile) => profile.tableName)).toEqual(["澳门永利_01", "澳门永利_02"]);
  });

  it("requires at least 120 numbers in a session before building a profile", () => {
    const profilesBelowBoundary = buildTableProfiles([
      { id: "short", name: "Short", tableId: "t_1", numbers: tableOneNumbers.slice(0, 119) },
    ]);
    const profilesAtBoundary = buildTableProfiles([
      { id: "enough", name: "Enough", tableId: "t_1", numbers: tableOneNumbers.slice(0, 120) },
    ]);

    expect(profilesBelowBoundary).toHaveLength(0);
    expect(profilesAtBoundary).toHaveLength(1);
  });

  it("matches current numbers against cached table profiles", () => {
    const profiles = buildTableProfiles([
      { id: "a", name: "A", tableId: "t_1", numbers: tableOneNumbers },
      { id: "b", name: "B", tableId: "t_2", numbers: tableTwoNumbers },
    ]);

    const match = matchTableProfile(repeat([22, 18, 29, 7, 28, 12, 35], 15), profiles);

    expect(match.profile?.tableId).toBe("t_1");
    expect(match.level).toBe("confirmed");
  });

  it("does not guess a different table when a forced table has no profile", () => {
    const profiles = buildTableProfiles([
      { id: "a", name: "A", tableId: "t_1", numbers: tableOneNumbers },
    ]);

    const match = matchTableProfile(repeat([22, 18, 29, 7, 28, 12, 35], 15), profiles, "t_missing");

    expect(match.level).toBe("none");
    expect(match.profile).toBeNull();
  });

  it("marks a hot number as supported by the matched table sector", () => {
    const profiles = buildTableProfiles([
      { id: "a", name: "A", tableId: "t_1", numbers: tableOneNumbers },
      { id: "b", name: "B", tableId: "t_2", numbers: tableTwoNumbers },
    ]);

    const support = evaluateHotNumberTableSupport(
      repeat([22, 18, 29, 7, 28, 12, 35], 15),
      29,
      profiles,
    );

    expect(support.profile?.tableId).toBe("t_1");
    expect(["support", "strong"]).toContain(support.level);
    expect(support.rank).toBeLessThanOrEqual(8);
  });

  it("does not over-promote a hot number outside the matched table center sector", () => {
    const profiles = buildTableProfiles([
      { id: "a", name: "A", tableId: "t_1", numbers: tableOneNumbers },
      { id: "b", name: "B", tableId: "t_2", numbers: tableTwoNumbers },
    ]);

    const support = evaluateHotNumberTableSupport(
      repeat([22, 18, 29, 7, 28, 12, 35], 15),
      4,
      profiles,
    );

    expect(support.profile?.tableId).toBe("t_1");
    expect(["watch", "conflict"]).toContain(support.level);
  });
});
