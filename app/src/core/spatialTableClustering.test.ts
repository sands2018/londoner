import { describe, expect, it } from "vitest";
import { buildSpatialTableClusters, inferSpatialVenueKey } from "./spatialTableClustering";
import type { RouletteNumber } from "./roulette";

function repeat(values: RouletteNumber[], times: number): RouletteNumber[] {
  const result: RouletteNumber[] = [];
  for (let index = 0; index < times; index += 1) {
    result.push(...values);
  }
  return result;
}

const hotArc = repeat([22, 18, 29, 7, 28, 12, 35], 20);

describe("spatial table clustering", () => {
  it("does not infer a venue key from the session name", () => {
    expect(inferSpatialVenueKey("wzs-20260601")).toBe("all");
    expect(inferSpatialVenueKey("sxr-20260601")).toBe("all");
    expect(inferSpatialVenueKey("20260601-1630-wynn")).toBe("all");
  });

  it("clusters sessions globally instead of grouping by inferred name source", () => {
    const clusters = buildSpatialTableClusters([
      { id: "a", name: "wzs-20260601", updatedTms: 1, numbers: hotArc },
      { id: "b", name: "sxr-20260602", updatedTms: 2, numbers: hotArc },
      { id: "c", name: "20260603-1630-wynn", updatedTms: 3, numbers: hotArc },
    ]);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].venueKey).toBe("all");
    expect(clusters[0].sessionIds).toEqual(["a", "b", "c"]);
  });
});
