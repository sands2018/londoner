import { describe, expect, it } from "vitest";
import {
  analyzeNumberMergeV2,
  buildNumberMergeV2TolerantUnion,
  buildNumberMergeV2TolerantUnionWithChoices,
  buildNumberMergeV2Union,
} from "./numberMergeV2";

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

describe("numberMergeV2", () => {
  it("safely joins B after A", () => {
    const result = analyzeNumberMergeV2(range(1, 20), range(11, 25));

    expect(result.relationship).toBe("a-then-b");
    expect(result.safeToMerge).toBe(true);
    expect(result.merged).toEqual(range(1, 25));
  });

  it("safely joins A after B without losing either side", () => {
    const result = analyzeNumberMergeV2(range(11, 25), range(1, 20));

    expect(result.relationship).toBe("b-then-a");
    expect(result.safeToMerge).toBe(true);
    expect(result.merged).toEqual(range(1, 25));
  });

  it("handles exact containment in either direction", () => {
    const outer = range(1, 30);
    const inner = range(8, 22);

    const aContains = analyzeNumberMergeV2(outer, inner);
    expect(aContains.relationship).toBe("a-contains-b");
    expect(aContains.merged).toEqual(outer);

    const bContains = analyzeNumberMergeV2(inner, outer);
    expect(bContains.relationship).toBe("b-contains-a");
    expect(bContains.merged).toEqual(outer);
  });

  it("recognizes identical data", () => {
    const values = range(1, 20);
    const result = analyzeNumberMergeV2(values, values);

    expect(result.relationship).toBe("identical");
    expect(result.safeToMerge).toBe(true);
    expect(result.merged).toEqual(values);
  });

  it("rejects a matching middle fragment when the full timelines conflict", () => {
    const a = [30, 31, 1, 2, 3, 4, 5, 6, 7, 32, 33];
    const b = [34, 35, 1, 2, 3, 4, 5, 6, 7, 36, 0];
    const result = analyzeNumberMergeV2(a, b, { minOverlap: 7 });

    expect(result.found).toBe(false);
    expect(result.relationship).toBe("none");
    expect(result.merged).toBeUndefined();
  });

  it("reports a genuine 97 percent overlap as a conflict instead of guessing", () => {
    const a = range(1, 50);
    const b = range(16, 70);
    b[10] = 99;

    const result = analyzeNumberMergeV2(a, b);

    expect(result.relationship).toBe("conflict");
    expect(result.safeToMerge).toBe(false);
    expect(result.merged).toBeUndefined();
    expect(result.alignment?.overlapLength).toBe(35);
    expect(result.alignment?.matchedCount).toBe(34);
    expect(result.alignment?.matchRate).toBeCloseTo(34 / 35);
    expect(result.alignment?.conflicts).toHaveLength(1);
  });

  it("can resolve a reported conflict using either recording without losing timeline data", () => {
    const a = range(36, 80);
    const b = range(1, 70);
    b[50] = 99;
    const result = analyzeNumberMergeV2(a, b);

    expect(result.relationship).toBe("conflict");
    expect(result.alignment).toBeDefined();
    expect(buildNumberMergeV2Union(a, b, result.alignment!, "a")).toEqual(range(1, 80));
    expect(buildNumberMergeV2Union(a, b, result.alignment!, "b")).toEqual([
      ...range(1, 50),
      99,
      ...range(52, 80),
    ]);
  });

  it("reports clustered mismatches as manual tolerant review instead of auto-merging", () => {
    const a = range(1, 100);
    const b = [...a];
    b[10] = 201;
    b[15] = 202;
    b[60] = 203;

    const result = analyzeNumberMergeV2(a, b);

    expect(result.found).toBe(true);
    expect(result.relationship).toBe("conflict");
    expect(result.safeToMerge).toBe(false);
    expect(result.tolerantAlignment).toBeDefined();
    expect(result.tolerantAlignment?.issues.length).toBe(3);
  });

  it("accepts a seven-number overlap by default", () => {
    const a = range(1, 10);
    const b = range(4, 13);

    const result = analyzeNumberMergeV2(a, b);
    expect(result.safeToMerge).toBe(true);
    expect(result.merged).toEqual(range(1, 13));
  });

  it("does not choose between equally strong alignments with different unions", () => {
    const pattern = range(1, 10);
    const a = [...pattern, 50, ...pattern];
    const b = [50, ...pattern, 50];
    const result = analyzeNumberMergeV2(a, b);

    expect(result.relationship).toBe("ambiguous");
    expect(result.safeToMerge).toBe(false);
    expect(result.merged).toBeUndefined();
    expect(result.alternatives).toHaveLength(2);
  });

  it("preserves realistic roulette timelines across many slice directions", () => {
    let state = 0x12345678;
    const timeline = Array.from({ length: 400 }, () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state % 37;
    });

    for (let startA = 0; startA <= 180; startA += 30) {
      for (let startB = 20; startB <= 200; startB += 30) {
        const a = timeline.slice(startA, startA + 120);
        const b = timeline.slice(startB, startB + 120);
        const unionStart = Math.min(startA, startB);
        const unionEnd = Math.max(startA + a.length, startB + b.length);
        const overlap = Math.min(startA + a.length, startB + b.length) - Math.max(startA, startB);
        if (overlap < 7) continue;

        const result = analyzeNumberMergeV2(a, b);
        expect(result.safeToMerge).toBe(true);
        expect(result.merged).toEqual(timeline.slice(unionStart, unionEnd));
      }
    }
  });

  it("validates option ranges", () => {
    expect(() => analyzeNumberMergeV2(range(1, 20), range(1, 20), {
      minOverlap: 3,
      seedLength: 4,
    })).toThrow(/seedLength/);
  });

  it("reports fuzzy tail/head overlap with omissions and substitution", () => {
    const shared = range(1, 80).map((value) => value % 37);
    const a = [...range(90, 99), ...shared];
    const b = [...shared];
    b.splice(10, 1);
    b.splice(25, 1);
    b[40] = 99;
    b.push(5, 6, 7);

    const result = analyzeNumberMergeV2(a, b);

    expect(result.relationship).toBe("conflict");
    expect(result.safeToMerge).toBe(false);
    expect(result.tolerantAlignment).toBeDefined();
    expect(result.tolerantAlignment?.relationship).toBe("a-then-b");
    expect(result.tolerantAlignment?.issues.length).toBe(3);
    expect(result.tolerantAlignment?.matchRate).toBeGreaterThanOrEqual(0.95);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "a").slice(-3)).toEqual([5, 6, 7]);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "b").slice(-3)).toEqual([5, 6, 7]);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "a")).toEqual([
      ...a,
      5,
      6,
      7,
    ]);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "b")).toEqual([
      ...range(90, 99),
      ...b,
    ]);
  });

  it("reports reversed fuzzy tail/head overlap with omissions and substitution", () => {
    const shared = range(1, 80).map((value) => value % 37);
    const a = [...shared];
    a.splice(10, 1);
    a.splice(25, 1);
    a[40] = 99;
    a.push(5, 6, 7);
    const b = [...range(90, 99), ...shared];

    const result = analyzeNumberMergeV2(a, b);

    expect(result.relationship).toBe("conflict");
    expect(result.safeToMerge).toBe(false);
    expect(result.tolerantAlignment).toBeDefined();
    expect(result.tolerantAlignment?.relationship).toBe("b-then-a");
    expect(result.tolerantAlignment?.issues.length).toBe(3);
    expect(result.tolerantAlignment?.matchRate).toBeGreaterThanOrEqual(0.95);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "a").slice(-3)).toEqual([5, 6, 7]);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "b").slice(-3)).toEqual([5, 6, 7]);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "a")).toEqual([
      ...range(90, 99),
      ...a,
    ]);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "b")).toEqual([
      ...b,
      5,
      6,
      7,
    ]);
  });

  it("reports fuzzy containment when the containing recording has an extra number", () => {
    const shared = range(1, 200).map((value) => value % 37);
    const a = [...shared];
    const b = [
      31,
      32,
      ...shared.slice(0, 14),
      10,
      ...shared.slice(14),
      33,
      34,
    ];

    const result = analyzeNumberMergeV2(a, b);

    expect(result.relationship).toBe("conflict");
    expect(result.safeToMerge).toBe(false);
    expect(result.tolerantAlignment).toBeDefined();
    expect(result.tolerantAlignment?.relationship).toBe("b-contains-a");
    expect(result.tolerantAlignment?.issues).toEqual([
      {
        indexA: 14,
        indexB: 16,
        kind: "b-extra",
        valueA: undefined,
        valueB: 10,
      },
    ]);
    expect(result.tolerantAlignment?.matchRate).toBeGreaterThanOrEqual(0.95);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "a")).toEqual([
      31,
      32,
      ...shared,
      33,
      34,
    ]);
    expect(buildNumberMergeV2TolerantUnion(result.tolerantAlignment!, "b")).toEqual(b);
    expect(buildNumberMergeV2TolerantUnionWithChoices(result.tolerantAlignment!, ["a"])).toEqual([
      31,
      32,
      ...shared,
      33,
      34,
    ]);
    expect(buildNumberMergeV2TolerantUnionWithChoices(result.tolerantAlignment!, ["b"])).toEqual(b);
  });

  it("reports fuzzy containment with extras on both sides and a substitution", () => {
    const shared = range(1, 120).map((value) => value % 37);
    const a = [...shared];
    a.splice(20, 0, 88);
    a[60] = 77;
    const b = [31, 32, ...shared];
    b.splice(42, 0, 66);
    b.push(33, 34);

    const result = analyzeNumberMergeV2(a, b);

    expect(result.relationship).toBe("conflict");
    expect(result.safeToMerge).toBe(false);
    expect(result.tolerantAlignment).toBeDefined();
    expect(result.tolerantAlignment?.relationship).toBe("b-contains-a");
    expect(result.tolerantAlignment?.issues.map((issue) => issue.kind).sort()).toEqual([
      "a-extra",
      "b-extra",
      "substitution",
    ]);
    expect(result.tolerantAlignment?.matchRate).toBeGreaterThanOrEqual(0.95);

    const alignment = result.tolerantAlignment!;
    const mixed = buildNumberMergeV2TolerantUnionWithChoices(
      alignment,
      alignment.issues.map((issue) => issue.kind === "b-extra" ? "b" : "a"),
    );
    expect(mixed).toContain(88);
    expect(mixed).toContain(66);
    expect(mixed).toContain(77);
  });
});
