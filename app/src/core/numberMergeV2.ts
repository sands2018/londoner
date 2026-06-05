/**
 * Safe number-sequence merge based on full timeline alignment.
 *
 * This module intentionally does not replace numberMerge.ts yet. It is a
 * standalone V2 implementation that can be evaluated before UI integration.
 *
 * B is placed on A's timeline at an integer offset. Every number in the full
 * intersection is then validated. This prevents a matching middle fragment
 * from being mistaken for a safe merge while unrelated data is discarded.
 */

export interface NumberMergeV2Options {
  /** Minimum number of shared positions required to establish a relationship. */
  minOverlap?: number;
  /** Exact seed length used to discover possible timeline offsets. */
  seedLength?: number;
  /** Minimum equality rate across the complete overlap. */
  minMatchRate?: number;
  /** Size of the rolling mismatch-control window. */
  mismatchWindow?: number;
  /** Maximum mismatches allowed in every rolling mismatch-control window. */
  maxMismatchesPerWindow?: number;
}

export type NumberMergeAlignmentRelationship =
  | "identical"
  | "a-contains-b"
  | "b-contains-a"
  | "a-then-b"
  | "b-then-a";

export type NumberMergeV2Relationship =
  | NumberMergeAlignmentRelationship
  | "conflict"
  | "ambiguous"
  | "none"
  | "insufficient";

export interface NumberMergeConflict {
  /** Position on A's timeline. */
  coordinate: number;
  indexA: number;
  indexB: number;
  valueA: number;
  valueB: number;
}

export interface NumberMergeAlignment {
  /** Position of B[0] on A's timeline. Negative means B begins before A. */
  offsetB: number;
  overlapStartA: number;
  overlapEndA: number;
  overlapStartB: number;
  overlapEndB: number;
  overlapLength: number;
  matchedCount: number;
  mismatchCount: number;
  matchRate: number;
  relationship: NumberMergeAlignmentRelationship;
  conflicts: NumberMergeConflict[];
}

export interface NumberMergeV2Result {
  /** Whether at least one plausible full-overlap alignment was found. */
  found: boolean;
  /** True only when V2 can create a result without guessing conflicting values. */
  safeToMerge: boolean;
  relationship: NumberMergeV2Relationship;
  /** Present only when the relationship is safe and unambiguous. */
  merged?: number[];
  /** Best alignment, including conflicts when manual review is required. */
  alignment?: NumberMergeAlignment;
  /** Equally strong alignments when more than one timeline placement is possible. */
  alternatives?: NumberMergeAlignment[];
  description: string;
}

export type NumberMergeConflictChoice = "a" | "b";

interface ResolvedOptions {
  minOverlap: number;
  seedLength: number;
  minMatchRate: number;
  mismatchWindow: number;
  maxMismatchesPerWindow: number;
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  minOverlap: 10,
  seedLength: 4,
  minMatchRate: 0.97,
  mismatchWindow: 10,
  maxMismatchesPerWindow: 1,
};

function resolveOptions(options: NumberMergeV2Options): ResolvedOptions {
  const resolved = { ...DEFAULT_OPTIONS, ...options };

  if (!Number.isInteger(resolved.minOverlap) || resolved.minOverlap < 1) {
    throw new Error("minOverlap must be a positive integer");
  }
  if (!Number.isInteger(resolved.seedLength) || resolved.seedLength < 1 || resolved.seedLength > resolved.minOverlap) {
    throw new Error("seedLength must be a positive integer no greater than minOverlap");
  }
  if (resolved.minMatchRate <= 0 || resolved.minMatchRate > 1) {
    throw new Error("minMatchRate must be greater than 0 and no greater than 1");
  }
  if (!Number.isInteger(resolved.mismatchWindow) || resolved.mismatchWindow < 1) {
    throw new Error("mismatchWindow must be a positive integer");
  }
  if (!Number.isInteger(resolved.maxMismatchesPerWindow) || resolved.maxMismatchesPerWindow < 0) {
    throw new Error("maxMismatchesPerWindow must be a non-negative integer");
  }

  return resolved;
}

function seedKey(values: readonly number[], start: number, length: number): string {
  let key = String(values[start]);
  for (let index = 1; index < length; index++) {
    key += `,${values[start + index]}`;
  }
  return key;
}

function buildSeedIndex(values: readonly number[], seedLength: number): Map<string, number[]> {
  const index = new Map<string, number[]>();

  for (let start = 0; start <= values.length - seedLength; start++) {
    const key = seedKey(values, start, seedLength);
    const positions = index.get(key);
    if (positions) {
      positions.push(start);
    } else {
      index.set(key, [start]);
    }
  }

  return index;
}

function collectCandidateOffsets(
  a: readonly number[],
  b: readonly number[],
  seedLength: number,
): Set<number> {
  const indexA = buildSeedIndex(a, seedLength);
  const offsets = new Set<number>();

  for (let startB = 0; startB <= b.length - seedLength; startB++) {
    const positionsA = indexA.get(seedKey(b, startB, seedLength));
    if (!positionsA) continue;

    for (const startA of positionsA) {
      offsets.add(startA - startB);
    }
  }

  return offsets;
}

function passesRollingMismatchLimit(
  mismatchFlags: readonly boolean[],
  windowSize: number,
  maximum: number,
): boolean {
  if (mismatchFlags.length === 0) return true;
  if (mismatchFlags.length <= windowSize) {
    return mismatchFlags.filter(Boolean).length <= maximum;
  }

  let mismatches = 0;
  for (let index = 0; index < mismatchFlags.length; index++) {
    if (mismatchFlags[index]) mismatches++;
    if (index >= windowSize && mismatchFlags[index - windowSize]) mismatches--;
    if (index >= windowSize - 1 && mismatches > maximum) return false;
  }

  return true;
}

function classifyAlignment(offsetB: number, lengthA: number, lengthB: number): NumberMergeAlignmentRelationship {
  const endB = offsetB + lengthB;

  if (offsetB === 0 && lengthA === lengthB) return "identical";
  if (offsetB >= 0 && endB <= lengthA) return "a-contains-b";
  if (offsetB <= 0 && endB >= lengthA) return "b-contains-a";
  if (offsetB > 0) return "a-then-b";
  return "b-then-a";
}

function evaluateOffset(
  a: readonly number[],
  b: readonly number[],
  offsetB: number,
  options: ResolvedOptions,
): NumberMergeAlignment | undefined {
  const overlapStartA = Math.max(0, offsetB);
  const overlapStartB = Math.max(0, -offsetB);
  const overlapLength = Math.min(a.length - overlapStartA, b.length - overlapStartB);
  if (overlapLength < options.minOverlap) return undefined;

  const conflicts: NumberMergeConflict[] = [];
  const mismatchFlags: boolean[] = [];

  for (let offset = 0; offset < overlapLength; offset++) {
    const indexA = overlapStartA + offset;
    const indexB = overlapStartB + offset;
    const mismatch = a[indexA] !== b[indexB];
    mismatchFlags.push(mismatch);

    if (mismatch) {
      conflicts.push({
        coordinate: indexA,
        indexA,
        indexB,
        valueA: a[indexA],
        valueB: b[indexB],
      });
    }
  }

  const matchedCount = overlapLength - conflicts.length;
  const matchRate = matchedCount / overlapLength;
  if (matchRate < options.minMatchRate) return undefined;
  if (!passesRollingMismatchLimit(
    mismatchFlags,
    options.mismatchWindow,
    options.maxMismatchesPerWindow,
  )) {
    return undefined;
  }

  return {
    offsetB,
    overlapStartA,
    overlapEndA: overlapStartA + overlapLength,
    overlapStartB,
    overlapEndB: overlapStartB + overlapLength,
    overlapLength,
    matchedCount,
    mismatchCount: conflicts.length,
    matchRate,
    relationship: classifyAlignment(offsetB, a.length, b.length),
    conflicts,
  };
}

/**
 * Build the complete timeline union for a known alignment.
 *
 * When the overlap contains conflicts, conflictChoice decides which recording
 * supplies the value at those positions. The function never drops either
 * recording's non-overlapping prefix or suffix.
 */
export function buildNumberMergeV2Union(
  a: readonly number[],
  b: readonly number[],
  alignment: NumberMergeAlignment,
  conflictChoice: NumberMergeConflictChoice,
): number[] {
  const unionStart = Math.min(0, alignment.offsetB);
  const unionEnd = Math.max(a.length, alignment.offsetB + b.length);
  const merged: number[] = [];

  for (let coordinate = unionStart; coordinate < unionEnd; coordinate++) {
    const indexA = coordinate;
    const indexB = coordinate - alignment.offsetB;
    const hasA = indexA >= 0 && indexA < a.length;
    const hasB = indexB >= 0 && indexB < b.length;

    if (hasA && hasB && a[indexA] !== b[indexB]) {
      merged.push(conflictChoice === "a" ? a[indexA] : b[indexB]);
    } else if (hasA) {
      merged.push(a[indexA]);
    } else if (hasB) {
      merged.push(b[indexB]);
    } else {
      throw new Error("Alignment produced an empty timeline coordinate");
    }
  }

  return merged;
}

function buildExactUnion(
  a: readonly number[],
  b: readonly number[],
  alignment: NumberMergeAlignment,
): number[] | undefined {
  if (alignment.mismatchCount > 0) return undefined;
  return buildNumberMergeV2Union(a, b, alignment, "a");
}

function arraysEqual(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function relationshipText(relationship: NumberMergeAlignmentRelationship): string {
  switch (relationship) {
    case "identical": return "两组数据完全相同";
    case "a-contains-b": return "A 完整包含 B";
    case "b-contains-a": return "B 完整包含 A";
    case "a-then-b": return "B 接在 A 后面";
    case "b-then-a": return "A 接在 B 后面";
  }
}

/**
 * Analyze two sequences without modifying either input.
 *
 * Exact, unique alignments return a safe merged union. Plausible alignments
 * containing different values are reported as conflicts and never auto-merged.
 */
export function analyzeNumberMergeV2(
  a: readonly number[],
  b: readonly number[],
  options: NumberMergeV2Options = {},
): NumberMergeV2Result {
  const resolved = resolveOptions(options);

  if (a.length < resolved.minOverlap || b.length < resolved.minOverlap) {
    return {
      found: false,
      safeToMerge: false,
      relationship: "insufficient",
      description: `数据量不足：A=${a.length}，B=${b.length}，至少各需 ${resolved.minOverlap} 个数字。`,
    };
  }

  const candidates = [...collectCandidateOffsets(a, b, resolved.seedLength)]
    .map((offset) => evaluateOffset(a, b, offset, resolved))
    .filter((candidate): candidate is NumberMergeAlignment => candidate !== undefined)
    .sort((left, right) => (
      right.overlapLength - left.overlapLength
      || left.mismatchCount - right.mismatchCount
      || Math.abs(left.offsetB) - Math.abs(right.offsetB)
    ));

  if (candidates.length === 0) {
    return {
      found: false,
      safeToMerge: false,
      relationship: "none",
      description: `未发现满足完整重叠校验的关系：A=${a.length}，B=${b.length}。`,
    };
  }

  const best = candidates[0];
  const equallyStrong = candidates.filter((candidate) => (
    candidate.overlapLength === best.overlapLength
    && candidate.mismatchCount === best.mismatchCount
  ));

  if (equallyStrong.length > 1) {
    const unions = equallyStrong.map((candidate) => buildExactUnion(a, b, candidate));
    const firstUnion = unions[0];
    const sameSafeUnion = firstUnion !== undefined
      && unions.every((union) => union !== undefined && arraysEqual(firstUnion, union));

    if (!sameSafeUnion) {
      return {
        found: true,
        safeToMerge: false,
        relationship: "ambiguous",
        alignment: best,
        alternatives: equallyStrong,
        description: `发现 ${equallyStrong.length} 个同等强度的时间轴位置，无法安全确定合并顺序。`,
      };
    }

    return {
      found: true,
      safeToMerge: true,
      relationship: best.relationship,
      merged: firstUnion,
      alignment: best,
      alternatives: equallyStrong,
      description: `${relationshipText(best.relationship)}；虽然位置不唯一，但所有位置产生相同结果，共 ${firstUnion.length} 个数字。`,
    };
  }

  if (best.mismatchCount > 0) {
    return {
      found: true,
      safeToMerge: false,
      relationship: "conflict",
      alignment: best,
      description: `发现可能的重叠关系，但完整重叠区有 ${best.mismatchCount} 个冲突；需要人工确认，未自动合并。`,
    };
  }

  const merged = buildExactUnion(a, b, best);
  if (!merged) {
    return {
      found: true,
      safeToMerge: false,
      relationship: "conflict",
      alignment: best,
      description: "时间轴关系已找到，但构造并集时发现冲突；未自动合并。",
    };
  }

  return {
    found: true,
    safeToMerge: true,
    relationship: best.relationship,
    merged,
    alignment: best,
    description: `${relationshipText(best.relationship)}，完整重叠 ${best.overlapLength} 个数字，合并后共 ${merged.length} 个数字。`,
  };
}
