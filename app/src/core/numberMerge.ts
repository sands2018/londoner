/**
 * Number Sequence Merge — Overlap Detection & Fuzzy Matching
 * ===========================================================
 * Core function: given two number sequences, detect if they overlap
 * (tail of A matches head of B) or one contains the other.
 *
 * Merge rule:
 *   - Take the last 10-30 numbers of A, search in B with fuzzy matching.
 *   - If >= 10 consecutive matches (allowing ≤1 mismatch per 10), it's an overlap.
 *   - Merge: A + B[overlapEnd..]
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
  /** For overlap: where in A the overlap starts (index from end) */
  overlapStartA?: number;
  /** For overlap: where in B the overlap ends (index from start) */
  overlapEndB?: number;
  /** How many numbers matched in the overlap region */
  matchedCount?: number;
  /** Total overlap length checked */
  overlapLength?: number;
  /** Match quality: matchedCount / overlapLength */
  matchRate?: number;
  /** Merged result (only for overlap/contains) */
  merged?: number[];
  /** Description for UI */
  description: string;
}

const MIN_OVERLAP = 7;
const MAX_CHECK_A = 40;
const MAX_CHECK_B = 60;
const MISMATCH_TOLERANCE = 1;      // max 1 mismatch per 10
const MIN_MATCH_RATE = 0.97;       // require 97% match rate

/**
 * Check if two numbers match (fuzzy: allow off-by-1 for possible OCR errors).
 */
function fuzzyMatch(a: number, b: number): boolean {
  return a === b;
}

/**
 * Try to find the tail of A within the head of B.
 * Uses sliding window with fuzzy matching.
 */
function findOverlap(a: number[], b: number[]): {
  found: boolean;
  overlapStartA: number;
  overlapEndB: number;
  matched: number;
  total: number;
} {
  const checkLen = Math.min(MAX_CHECK_A, a.length);
  const searchLen = Math.min(MAX_CHECK_B, b.length);

  let bestMatch = { startA: 0, endB: 0, matched: 0, total: 0 };

  // For each possible overlap length (from MIN_OVERLAP to checkLen)
  for (let overlapLen = checkLen; overlapLen >= MIN_OVERLAP; overlapLen--) {
    const aSlice = a.slice(-overlapLen);

    // Slide through B's head
    for (let bStart = 0; bStart <= searchLen - MIN_OVERLAP; bStart++) {
      const bSlice = b.slice(bStart, bStart + overlapLen);
      if (bSlice.length < MIN_OVERLAP) continue;

      let matched = 0;
      let mismatches = 0;
      for (let j = 0; j < overlapLen; j++) {
        if (fuzzyMatch(aSlice[j], bSlice[j])) {
          matched++;
        } else {
          mismatches++;
          // Allow at most MISMATCH_TOLERANCE per group of 10
          const groupStart = Math.floor(j / 10) * 10;
          let groupMismatch = 0;
          for (let k = groupStart; k < Math.min(groupStart + 10, j + 1); k++) {
            if (!fuzzyMatch(aSlice[k], bSlice[k])) groupMismatch++;
          }
          if (groupMismatch > MISMATCH_TOLERANCE) {
            matched = -1;
            break;
          }
        }
      }

      if (matched > 0 && matched / overlapLen >= MIN_MATCH_RATE) {
        const matchRate = matched / overlapLen;
        if (matchRate > (bestMatch.matched / Math.max(1, bestMatch.total))) {
          bestMatch = {
            startA: a.length - overlapLen,
            endB: bStart + overlapLen,
            matched,
            total: overlapLen,
          };
        }
      }
    }

    // If we found a good match at this length, return it
    const matchRate = bestMatch.total > 0 ? bestMatch.matched / bestMatch.total : 0;
    if (bestMatch.total >= MIN_OVERLAP && matchRate >= MIN_MATCH_RATE) {
      return {
        found: true,
        overlapStartA: bestMatch.startA,
        overlapEndB: bestMatch.endB,
        matched: bestMatch.matched,
        total: bestMatch.total,
      };
    }
  }

  return { found: false, overlapStartA: 0, overlapEndB: 0, matched: 0, total: 0 };
}

/**
 * Check if one array contains the other (with fuzzy matching).
 */
function checkContainment(needle: number[], haystack: number[]): boolean {
  if (needle.length < MIN_OVERLAP || haystack.length < needle.length) return false;

  for (let start = 0; start <= haystack.length - needle.length; start++) {
    let matched = 0;
    let ok = true;
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

  // 3. Check overlap: tail of A in B
  const overlap = findOverlap(a, b);
  if (overlap.found) {
    const merged = [...a.slice(0, overlap.overlapStartA), ...b.slice(overlap.overlapEndB)];
    const rate = (overlap.matched / overlap.total * 100).toFixed(0);
    return {
      found: true,
      type: "overlap",
      overlapStartA: overlap.overlapStartA,
      overlapEndB: overlap.overlapEndB,
      matchedCount: overlap.matched,
      overlapLength: overlap.total,
      matchRate: overlap.matched / overlap.total,
      merged,
      description: `发现首尾重叠：A的末尾${overlap.total}个 ↔ B的开头${overlap.total}个（匹配${overlap.matched}/${overlap.total}，${rate}%）。合并后共${merged.length}个数字。`,
    };
  }

  // 4. Also check: tail of B in A (reverse direction)
  const overlap2 = findOverlap(b, a);
  if (overlap2.found) {
    const merged = [...b.slice(0, overlap2.overlapStartA), ...a.slice(overlap2.overlapEndB)];
    const rate = (overlap2.matched / overlap2.total * 100).toFixed(0);
    return {
      found: true,
      type: "overlap",
      overlapStartA: overlap2.overlapStartA,
      overlapEndB: overlap2.overlapEndB,
      matchedCount: overlap2.matched,
      overlapLength: overlap2.total,
      matchRate: overlap2.matched / overlap2.total,
      merged,
      description: `发现首尾重叠（反向）：B的末尾${overlap2.total}个 ↔ A的开头${overlap2.total}个（匹配${overlap2.matched}/${overlap2.total}，${rate}%）。合并后共${merged.length}个数字。`,
    };
  }

  return {
    found: false,
    type: "none",
    description: `未发现重叠（A=${a.length}，B=${b.length}）`,
  };
}
