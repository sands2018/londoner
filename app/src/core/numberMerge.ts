/**
 * Number Sequence Merge — Overlap Detection & Global Matching
 * ===========================================================
 * Core function: given two number sequences, detect if they overlap
 * (anywhere in both arrays) or one contains the other.
 *
 * Merge rule:
 *   - Build a 4-gram hash index of A, scan B for matching seeds.
 *   - For each seed, extend forward and backward to find the full overlap.
 *   - Take the longest match with >= 97% match rate.
 *   - Merge: A[0..overlapStartA] + overlap + B[overlapEndB..]
 *
 * Containment: if A is fully contained within B (or vice versa), detect it.
 *
 * Used by:
 *   1. Data page: compare two selected sessions
 *   2. Home "接上" button: merge incoming data with current data
 */

export interface OverlapResult {
  /** Whether an overlap or containment was found */
  found: boolean;
  /** "overlap" | "contains" | "contained" | "none" */
  type: "overlap" | "contains" | "contained" | "none";
  /** For overlap: where in A the overlap starts */
  overlapStartA?: number;
  /** For overlap: where in A the overlap ends */
  overlapEndA?: number;
  /** For overlap: where in B the overlap starts */
  overlapStartB?: number;
  /** For overlap: where in B the overlap ends */
  overlapEndB?: number;
  /** How many numbers matched in the overlap region */
  matchedCount?: number;
  /** Total overlap length */
  overlapLength?: number;
  /** Match quality: matchedCount / overlapLength */
  matchRate?: number;
  /** Merged result (only for overlap/contains/contained) */
  merged?: number[];
  /** Description for UI */
  description: string;
}

const MIN_OVERLAP = 7;
const SEED_GRAM = 4;               // 4-number seed for hash index lookup
const SEED_STRIDE = 2;             // index every Nth position in A (reduce memory)
const MISMATCH_TOLERANCE = 1;      // max 1 mismatch per 10 in overlap region
const MIN_MATCH_RATE = 0.97;       // require 97% match rate overall

/**
 * Check if two numbers match.
 */
function fuzzyMatch(a: number, b: number): boolean {
  return a === b;
}

/**
 * Build a hash index: 4-gram string → positions in array.
 * Only indexes every SEED_STRIDE-th position.
 */
function buildGramIndex(arr: number[]): Map<string, number[]> {
  const index = new Map<string, number[]>();
  for (let i = 0; i <= arr.length - SEED_GRAM; i += SEED_STRIDE) {
    const key = arr.slice(i, i + SEED_GRAM).join(",");
    const list = index.get(key);
    if (list) list.push(i);
    else index.set(key, [i]);
  }
  return index;
}

/**
 * Count mismatches in a region, grouped by 10s, to see if it passes tolerance.
 */
function countMismatches(
  a: number[], startA: number,
  b: number[], startB: number,
  length: number,
): number {
  let mismatches = 0;
  for (let j = 0; j < length; j++) {
    if (!fuzzyMatch(a[startA + j], b[startB + j])) {
      mismatches++;
      // Check per-10 tolerance
      const groupStart = Math.floor(j / 10) * 10;
      let groupMismatch = 0;
      for (let k = groupStart; k < Math.min(groupStart + 10, j + 1); k++) {
        if (!fuzzyMatch(a[startA + k], b[startB + k])) groupMismatch++;
      }
      if (groupMismatch > MISMATCH_TOLERANCE) {
        return -1; // failed tolerance
      }
    }
  }
  return mismatches;
}

/**
 * Find the longest overlapping segment anywhere in A and B.
 *
 * Algorithm:
 *   1. Build a 4-gram hash index from A (sampled every SEED_STRIDE positions).
 *   2. Scan B for matching 4-gram seeds.
 *   3. For each seed match, extend forward and backward to find full overlap.
 *   4. Keep the longest match that passes the mismatch tolerance and rate.
 */
function findOverlapGlobal(a: number[], b: number[]): {
  found: boolean;
  startA: number;
  endA: number;
  startB: number;
  endB: number;
  matched: number;
  total: number;
} {
  const indexA = buildGramIndex(a);

  let best = { startA: 0, endA: 0, startB: 0, endB: 0, matched: 0, total: 0 };

  for (let j = 0; j <= b.length - SEED_GRAM; j++) {
    const key = b.slice(j, j + SEED_GRAM).join(",");
    const positions = indexA.get(key);
    if (!positions) continue;

    for (const i of positions) {
      // Extend forward
      let fwd = SEED_GRAM;
      while (i + fwd < a.length && j + fwd < b.length && fuzzyMatch(a[i + fwd], b[j + fwd])) {
        fwd++;
      }

      // Extend backward
      let bwd = 0;
      while (i - bwd - 1 >= 0 && j - bwd - 1 >= 0 && fuzzyMatch(a[i - bwd - 1], b[j - bwd - 1])) {
        bwd++;
      }

      const totalOverlap = bwd + fwd;
      if (totalOverlap < MIN_OVERLAP) continue;
      if (totalOverlap <= best.total) continue;

      // Validate with mismatch tolerance
      const mismatches = countMismatches(a, i - bwd, b, j - bwd, totalOverlap);
      if (mismatches < 0) continue; // failed per-10 tolerance

      const matched = totalOverlap - mismatches;
      const matchRate = matched / totalOverlap;
      if (matchRate < MIN_MATCH_RATE) continue;

      if (totalOverlap > best.total) {
        best = {
          startA: i - bwd,
          endA: i + fwd,
          startB: j - bwd,
          endB: j + fwd,
          matched,
          total: totalOverlap,
        };
      }
    }
  }

  if (best.total >= MIN_OVERLAP) {
    return { found: true, ...best };
  }
  return { found: false, startA: 0, endA: 0, startB: 0, endB: 0, matched: 0, total: 0 };
}

/**
 * Check if one array is fully contained in the other (with fuzzy matching).
 * Only checks when lengths are very different to avoid overlap confusion.
 */
function checkContainment(needle: number[], haystack: number[]): boolean {
  if (needle.length < MIN_OVERLAP || haystack.length < needle.length) return false;

  for (let start = 0; start <= haystack.length - needle.length; start++) {
    let matched = 0;
    for (let j = 0; j < needle.length; j++) {
      if (fuzzyMatch(needle[j], haystack[start + j])) {
        matched++;
      }
    }
    const minRequired = Math.ceil(needle.length * MIN_MATCH_RATE);
    if (matched >= minRequired) {
      return true;
    }
  }
  return false;
}

/**
 * Main merge analysis.
 *
 * Finds the longest overlapping segment between A and B anywhere in both arrays,
 * then produces a merged result: A[0..startA] + overlap + B[endB..].
 *
 * @param a - First number sequence (e.g., current data)
 * @param b - Second number sequence (e.g., incoming data)
 * @returns OverlapResult with merge info
 */
export function analyzeMerge(a: number[], b: number[]): OverlapResult {
  if (a.length < MIN_OVERLAP || b.length < MIN_OVERLAP) {
    return {
      found: false,
      type: "none",
      description: `数据量不足（需至少 ${MIN_OVERLAP} 个数字），A=${a.length}，B=${b.length}`,
    };
  }

  // 1. Check containment: A in B?
  if (checkContainment(a, b)) {
    return {
      found: true,
      type: "contained",
      description: `当前数据（${a.length}个）完全包含在新数据（${b.length}个）中`,
      merged: b,
    };
  }

  // 2. Check containment: B in A?
  if (checkContainment(b, a)) {
    return {
      found: true,
      type: "contains",
      description: `新数据（${b.length}个）完全包含在当前数据（${a.length}个）中，无需合并`,
      merged: a,
    };
  }

  // 3. Global overlap search
  const overlap = findOverlapGlobal(a, b);
  if (overlap.found) {
    // Merge direction is determined by which array has its head in the overlap.
    // The one whose head is in the overlap was recorded SECOND (started during
    // the other's tail). The first-recorded array is kept in full.
    //
    //   A head ↔ B tail  →  B first, A second  →  merge = B + A[endA..]
    //   B head ↔ A tail  →  A first, B second  →  merge = A + B[endB..]
    //
    // Threshold: head if overlap starts within MIN_OVERLAP of position 0.
    const headInA = overlap.startA < MIN_OVERLAP;
    const headInB = overlap.startB < MIN_OVERLAP;

    let merged: number[];
    let dir: string;

    if (headInA && !headInB) {
      // A's head overlaps B's tail → B recorded first
      merged = [...b, ...a.slice(overlap.endA)];
      dir = `B(${b.length}n) + A尾部(${a.length - overlap.endA}n)`;
    } else if (headInB && !headInA) {
      // B's head overlaps A's tail → A recorded first
      merged = [...a, ...b.slice(overlap.endB)];
      dir = `A(${a.length}n) + B尾部(${b.length - overlap.endB}n)`;
    } else {
      // Ambiguous — try both directions, pick the longer result
      const mAB = [...a, ...b.slice(overlap.endB)];
      const mBA = [...b, ...a.slice(overlap.endA)];
      if (mAB.length >= mBA.length) {
        merged = mAB;
        dir = `A(${a.length}n) + B尾部(${b.length - overlap.endB}n) [ambiguous, chose longer]`;
      } else {
        merged = mBA;
        dir = `B(${b.length}n) + A尾部(${a.length - overlap.endA}n) [ambiguous, chose longer]`;
      }
    }

    const rate = (overlap.matched / overlap.total * 100).toFixed(0);
    return {
      found: true,
      type: "overlap",
      overlapStartA: overlap.startA,
      overlapEndA: overlap.endA,
      overlapStartB: overlap.startB,
      overlapEndB: overlap.endB,
      matchedCount: overlap.matched,
      overlapLength: overlap.total,
      matchRate: overlap.matched / overlap.total,
      merged,
      description: `发现重叠区域（${overlap.total}个数字，匹配${overlap.matched}/${overlap.total}，${rate}%）。A[${overlap.startA}..${overlap.endA}] ↔ B[${overlap.startB}..${overlap.endB}]。合并方向：${dir}，合并后共${merged.length}个数字。`,
    };
  }

  return {
    found: false,
    type: "none",
    description: `未发现重叠（A=${a.length}，B=${b.length}）`,
  };
}
