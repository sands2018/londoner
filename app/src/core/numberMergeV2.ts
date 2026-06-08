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
  /** Minimum match rate for fuzzy tail/head de-duplication. */
  tolerantMatchRate?: number;
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

export interface NumberMergeEditIssue {
  indexA: number;
  indexB: number;
  kind: "a-extra" | "b-extra" | "substitution";
  valueA?: number;
  valueB?: number;
}

export type NumberMergeTolerantStepKind = "a-extra" | "b-extra" | "match" | "substitution";

export interface NumberMergeTolerantStep {
  indexA: number;
  indexB: number;
  kind: NumberMergeTolerantStepKind;
  valueA?: number;
  valueB?: number;
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

export interface NumberMergeTolerantAlignment {
  comparedCount: number;
  issues: NumberMergeEditIssue[];
  matchRate: number;
  matchedCount: number;
  mergedA: number[];
  mergedB: number[];
  overlapStartA: number;
  overlapEndA: number;
  overlapStartB: number;
  overlapEndB: number;
  overlapLength: number;
  prefix: number[];
  relationship: NumberMergeAlignmentRelationship;
  steps: NumberMergeTolerantStep[];
  suffix: number[];
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
  /** Fuzzy tail/head alignment allowing omissions, insertions, and substitutions. */
  tolerantAlignment?: NumberMergeTolerantAlignment;
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
  tolerantMatchRate: number;
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  minOverlap: 7,
  seedLength: 4,
  minMatchRate: 0.97,
  mismatchWindow: 10,
  maxMismatchesPerWindow: 1,
  tolerantMatchRate: 0.95,
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
  if (resolved.tolerantMatchRate <= 0 || resolved.tolerantMatchRate > 1) {
    throw new Error("tolerantMatchRate must be greater than 0 and no greater than 1");
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

type TolerantOp = NumberMergeTolerantStepKind;

interface TolerantState {
  issues: number;
  matches: number;
  op?: TolerantOp;
  prevI?: number;
  prevJ?: number;
  startA?: number;
}

function betterTolerantState(candidate: TolerantState, current: TolerantState | undefined): boolean {
  return !current
    || candidate.issues < current.issues
    || (candidate.issues === current.issues && candidate.matches > current.matches)
    || (
      candidate.issues === current.issues
      && candidate.matches === current.matches
      && candidate.startA !== undefined
      && (current.startA === undefined || candidate.startA < current.startA)
    );
}

function betterTolerantAlignment(
  candidate: NumberMergeTolerantAlignment,
  current: NumberMergeTolerantAlignment | null,
): boolean {
  return !current
    || candidate.matchedCount > current.matchedCount
    || (candidate.matchedCount === current.matchedCount && candidate.matchRate > current.matchRate)
    || (candidate.matchedCount === current.matchedCount && candidate.matchRate === current.matchRate && candidate.issues.length < current.issues.length);
}

function tolerantStepToIssue(step: NumberMergeTolerantStep): NumberMergeEditIssue | null {
  if (step.kind === "match") return null;
  return {
    indexA: step.indexA,
    indexB: step.indexB,
    kind: step.kind,
    valueA: step.valueA,
    valueB: step.valueB,
  };
}

function buildTolerantOverlapValues(steps: readonly NumberMergeTolerantStep[], issueChoices: readonly NumberMergeConflictChoice[]): number[] {
  const values: number[] = [];
  let issueIndex = 0;
  for (const step of steps) {
    if (step.kind === "match") {
      values.push(step.valueA!);
      continue;
    }

    const issueChoice = issueChoices[issueIndex] ?? "a";
    issueIndex++;
    if (step.kind === "substitution") {
      values.push(issueChoice === "a" ? step.valueA! : step.valueB!);
    } else if (step.kind === "a-extra") {
      if (issueChoice === "a") values.push(step.valueA!);
    } else if (step.kind === "b-extra") {
      if (issueChoice === "b") values.push(step.valueB!);
    }
  }
  return values;
}

function analyzeTolerantTailHead(
  a: readonly number[],
  b: readonly number[],
  options: ResolvedOptions,
): NumberMergeTolerantAlignment | null {
  const maxTailLength = b.length + Math.max(8, Math.ceil(b.length * 0.1));
  const startMin = Math.max(0, a.length - maxTailLength);
  let best: NumberMergeTolerantAlignment | null = null;

  function analyzeStart(startA: number): NumberMergeTolerantAlignment | null {
    const tailA = a.slice(startA);
    const m = tailA.length;
    const n = b.length;
    const dp: Array<Array<TolerantState | undefined>> = Array.from({ length: m + 1 }, () => new Array(n + 1));
    dp[0][0] = { issues: 0, matches: 0 };

    for (let i = 0; i <= m; i++) {
      for (let j = 0; j <= n; j++) {
        const state = dp[i][j];
        if (!state) continue;

        if (i < m && j < n) {
          const same = tailA[i] === b[j];
          const next: TolerantState = {
            issues: state.issues + (same ? 0 : 1),
            matches: state.matches + (same ? 1 : 0),
            op: same ? "match" : "substitution",
            prevI: i,
            prevJ: j,
          };
          if (betterTolerantState(next, dp[i + 1][j + 1])) dp[i + 1][j + 1] = next;
        }

        if (i < m) {
          const next: TolerantState = {
            issues: state.issues + 1,
            matches: state.matches,
            op: "a-extra",
            prevI: i,
            prevJ: j,
          };
          if (betterTolerantState(next, dp[i + 1][j])) dp[i + 1][j] = next;
        }

        if (j < n) {
          const next: TolerantState = {
            issues: state.issues + 1,
            matches: state.matches,
            op: "b-extra",
            prevI: i,
            prevJ: j,
          };
          if (betterTolerantState(next, dp[i][j + 1])) dp[i][j + 1] = next;
        }
      }
    }

    let bestEnd: { j: number; rate: number; state: TolerantState } | null = null;
    for (let j = 1; j <= n; j++) {
      const state = dp[m][j];
      // Perfect matches are handled by the strict path; this pass only reports imperfect overlaps.
      if (!state || state.issues === 0) continue;
      const comparedCount = state.matches + state.issues;
      const rate = comparedCount > 0 ? state.matches / comparedCount : 0;
      if (state.matches < options.minOverlap || rate < options.tolerantMatchRate) continue;
      if (
        !bestEnd
        || state.matches > bestEnd.state.matches
        || (state.matches === bestEnd.state.matches && state.issues < bestEnd.state.issues)
        || (state.matches === bestEnd.state.matches && state.issues === bestEnd.state.issues && j > bestEnd.j)
      ) {
        bestEnd = { j, rate, state };
      }
    }
    if (!bestEnd) return null;

    const steps: NumberMergeTolerantStep[] = [];
    let i = m;
    let j = bestEnd.j;
    while (i > 0 || j > 0) {
      const state = dp[i][j];
      if (!state?.op || state.prevI === undefined || state.prevJ === undefined) break;
      const prevI = state.prevI;
      const prevJ = state.prevJ;
      if (state.op === "match") {
        steps.push({
          indexA: startA + prevI,
          indexB: prevJ,
          kind: "match",
          valueA: tailA[prevI],
          valueB: b[prevJ],
        });
      } else if (state.op === "substitution") {
        steps.push({
          indexA: startA + prevI,
          indexB: prevJ,
          kind: "substitution",
          valueA: tailA[prevI],
          valueB: b[prevJ],
        });
      } else if (state.op === "a-extra") {
        steps.push({
          indexA: startA + prevI,
          indexB: prevJ,
          kind: "a-extra",
          valueA: tailA[prevI],
        });
      } else {
        steps.push({
          indexA: startA + prevI,
          indexB: prevJ,
          kind: "b-extra",
          valueB: b[prevJ],
        });
      }
      i = prevI;
      j = prevJ;
    }
    steps.reverse();
    const issues = steps
      .map(tolerantStepToIssue)
      .filter((issue): issue is NumberMergeEditIssue => issue !== null);
    const prefix = a.slice(0, startA);
    const suffix = b.slice(bestEnd.j);

    return {
      comparedCount: bestEnd.state.matches + bestEnd.state.issues,
      issues,
      matchRate: bestEnd.rate,
      matchedCount: bestEnd.state.matches,
      mergedA: [...prefix, ...buildTolerantOverlapValues(steps, issues.map(() => "a")), ...suffix],
      mergedB: [...prefix, ...buildTolerantOverlapValues(steps, issues.map(() => "b")), ...suffix],
      overlapStartA: startA,
      overlapEndA: a.length,
      overlapStartB: 0,
      overlapEndB: bestEnd.j,
      overlapLength: bestEnd.state.matches + bestEnd.state.issues,
      prefix,
      relationship: "a-then-b",
      steps,
      suffix,
    };
  }

  for (let startA = startMin; startA <= a.length - options.minOverlap; startA++) {
    const result = analyzeStart(startA);
    if (!result) continue;
    if (
      !best
      || result.matchedCount > best.matchedCount
      || (result.matchedCount === best.matchedCount && result.matchRate > best.matchRate)
      || (result.matchedCount === best.matchedCount && result.matchRate === best.matchRate && result.issues.length < best.issues.length)
    ) {
      best = result;
    }
  }

  return best;
}

function analyzeTolerantAContainsB(
  a: readonly number[],
  b: readonly number[],
  options: ResolvedOptions,
): NumberMergeTolerantAlignment | null {
  const m = a.length;
  const n = b.length;
  const dp: Array<Array<TolerantState | undefined>> = Array.from({ length: m + 1 }, () => new Array(n + 1));

  for (let i = 0; i <= m; i++) {
    dp[i][0] = { issues: 0, matches: 0, startA: i };
  }

  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      const state = dp[i][j];
      if (!state) continue;

      if (i < m && j < n) {
        const same = a[i] === b[j];
        const next: TolerantState = {
          issues: state.issues + (same ? 0 : 1),
          matches: state.matches + (same ? 1 : 0),
          op: same ? "match" : "substitution",
          prevI: i,
          prevJ: j,
          startA: state.startA ?? i,
        };
        if (betterTolerantState(next, dp[i + 1][j + 1])) dp[i + 1][j + 1] = next;
      }

      if (i < m && j > 0 && j < n) {
        const next: TolerantState = {
          issues: state.issues + 1,
          matches: state.matches,
          op: "a-extra",
          prevI: i,
          prevJ: j,
          startA: state.startA ?? i,
        };
        if (betterTolerantState(next, dp[i + 1][j])) dp[i + 1][j] = next;
      }

      if (j < n) {
        const next: TolerantState = {
          issues: state.issues + 1,
          matches: state.matches,
          op: "b-extra",
          prevI: i,
          prevJ: j,
          startA: state.startA ?? i,
        };
        if (betterTolerantState(next, dp[i][j + 1])) dp[i][j + 1] = next;
      }
    }
  }

  let bestEnd: { i: number; rate: number; state: TolerantState } | null = null;
  for (let i = 0; i <= m; i++) {
    const state = dp[i][n];
    if (!state || state.issues === 0 || state.startA === undefined) continue;
    const comparedCount = state.matches + state.issues;
    const rate = comparedCount > 0 ? state.matches / comparedCount : 0;
    if (state.matches < options.minOverlap || rate < options.tolerantMatchRate) continue;
    if (
      !bestEnd
      || state.matches > bestEnd.state.matches
      || (state.matches === bestEnd.state.matches && state.issues < bestEnd.state.issues)
      || (state.matches === bestEnd.state.matches && state.issues === bestEnd.state.issues && i - state.startA > bestEnd.i - bestEnd.state.startA!)
    ) {
      bestEnd = { i, rate, state };
    }
  }
  if (!bestEnd || bestEnd.state.startA === undefined) return null;

  const steps: NumberMergeTolerantStep[] = [];
  let i = bestEnd.i;
  let j = n;
  while (j > 0) {
    const state = dp[i][j];
    if (!state?.op || state.prevI === undefined || state.prevJ === undefined) break;
    const prevI = state.prevI;
    const prevJ = state.prevJ;
    if (state.op === "match" || state.op === "substitution") {
      steps.push({
        indexA: prevI,
        indexB: prevJ,
        kind: state.op,
        valueA: a[prevI],
        valueB: b[prevJ],
      });
    } else if (state.op === "a-extra") {
      steps.push({
        indexA: prevI,
        indexB: prevJ,
        kind: "a-extra",
        valueA: a[prevI],
      });
    } else {
      steps.push({
        indexA: prevI,
        indexB: prevJ,
        kind: "b-extra",
        valueB: b[prevJ],
      });
    }
    i = prevI;
    j = prevJ;
  }

  steps.reverse();
  const issues = steps
    .map(tolerantStepToIssue)
    .filter((issue): issue is NumberMergeEditIssue => issue !== null);
  const startA = bestEnd.state.startA;
  const endA = bestEnd.i;
  const prefix = a.slice(0, startA);
  const suffix = a.slice(endA);

  return {
    comparedCount: bestEnd.state.matches + bestEnd.state.issues,
    issues,
    matchRate: bestEnd.rate,
    matchedCount: bestEnd.state.matches,
    mergedA: [...prefix, ...buildTolerantOverlapValues(steps, issues.map(() => "a")), ...suffix],
    mergedB: [...prefix, ...buildTolerantOverlapValues(steps, issues.map(() => "b")), ...suffix],
    overlapStartA: startA,
    overlapEndA: endA,
    overlapStartB: 0,
    overlapEndB: b.length,
    overlapLength: bestEnd.state.matches + bestEnd.state.issues,
    prefix,
    relationship: "a-contains-b",
    steps,
    suffix,
  };
}

function reverseTolerantAlignment(result: NumberMergeTolerantAlignment): NumberMergeTolerantAlignment {
  const relationship: NumberMergeAlignmentRelationship = result.relationship === "a-then-b"
    ? "b-then-a"
    : result.relationship === "b-then-a"
      ? "a-then-b"
      : result.relationship === "a-contains-b"
        ? "b-contains-a"
        : result.relationship === "b-contains-a"
          ? "a-contains-b"
          : result.relationship;

  return {
    ...result,
    issues: result.issues.map((issue) => ({
      indexA: issue.indexB,
      indexB: issue.indexA,
      kind: issue.kind === "a-extra" ? "b-extra" : issue.kind === "b-extra" ? "a-extra" : "substitution",
      valueA: issue.valueB,
      valueB: issue.valueA,
    })),
    mergedA: result.mergedB,
    mergedB: result.mergedA,
    overlapStartA: result.overlapStartB,
    overlapEndA: result.overlapEndB,
    overlapStartB: result.overlapStartA,
    overlapEndB: result.overlapEndA,
    relationship,
    steps: result.steps.map((step) => ({
      indexA: step.indexB,
      indexB: step.indexA,
      kind: step.kind === "a-extra" ? "b-extra" : step.kind === "b-extra" ? "a-extra" : step.kind,
      valueA: step.valueB,
      valueB: step.valueA,
    })),
  };
}

function analyzeTolerantRelationships(
  a: readonly number[],
  b: readonly number[],
  options: ResolvedOptions,
): NumberMergeTolerantAlignment | null {
  const forward = analyzeTolerantTailHead(a, b, options);
  const backward = analyzeTolerantTailHead(b, a, options);
  const aContainsB = analyzeTolerantAContainsB(a, b, options);
  const bContainsA = analyzeTolerantAContainsB(b, a, options);
  const reversedTailHead = backward ? reverseTolerantAlignment(backward) : null;
  const reversedContains = bContainsA ? reverseTolerantAlignment(bContainsA) : null;
  const candidates = [forward, reversedTailHead, aContainsB, reversedContains]
    .filter((item): item is NumberMergeTolerantAlignment => item !== null);
  candidates.sort((left, right) => (
    right.matchedCount - left.matchedCount
    || right.matchRate - left.matchRate
    || left.issues.length - right.issues.length
  ));
  return candidates[0] ?? null;
}

export function buildNumberMergeV2TolerantUnion(
  alignment: NumberMergeTolerantAlignment,
  conflictChoice: NumberMergeConflictChoice,
): number[] {
  return buildNumberMergeV2TolerantUnionWithChoices(
    alignment,
    alignment.issues.map(() => conflictChoice),
  );
}

export function buildNumberMergeV2TolerantUnionWithChoices(
  alignment: NumberMergeTolerantAlignment,
  issueChoices: readonly NumberMergeConflictChoice[],
): number[] {
  return [
    ...alignment.prefix,
    ...buildTolerantOverlapValues(alignment.steps, issueChoices),
    ...alignment.suffix,
  ];
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
    const tolerantAlignment = analyzeTolerantRelationships(a, b, resolved);
    if (tolerantAlignment) {
      return {
        found: true,
        safeToMerge: false,
        relationship: "conflict",
        tolerantAlignment,
        description: `发现可容错的首尾重叠关系，匹配率 ${(tolerantAlignment.matchRate * 100).toFixed(1)}%，有 ${tolerantAlignment.issues.length} 个问题；需要人工确认，未自动合并。`,
      };
    }

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
