/**
 * Scan HistoryData/history_data.json with numberMergeV2 to find all relationships.
 * Usage: npx tsx scripts/scan_history_v2.ts
 */

import * as fs from "fs";
import { analyzeNumberMergeV2 } from "../app/src/core/numberMergeV2";

interface Session {
  Count: number;
  Name: string;
  Numbers: string;
  SaveTime: string;
  tms: number;
  ImportIndex: number;
  SharedUploader: string;
}

function parseNumbers(raw: string): number[] {
  return raw.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n));
}

const data: Session[] = JSON.parse(
  fs.readFileSync("HistoryData/history_data.json", "utf8"),
);

console.log(`Total sessions: ${data.length}\n`);

const parsed = data.map((s) => ({ session: s, nums: parseNumbers(s.Numbers) }));

// Categorize findings
const identical: { a: typeof parsed[0]; b: typeof parsed[0]; result: ReturnType<typeof analyzeNumberMergeV2> }[] = [];
const contains: { container: typeof parsed[0]; contained: typeof parsed[0]; result: ReturnType<typeof analyzeNumberMergeV2> }[] = [];
const mergable: { a: typeof parsed[0]; b: typeof parsed[0]; result: ReturnType<typeof analyzeNumberMergeV2> }[] = [];
const conflict: { a: typeof parsed[0]; b: typeof parsed[0]; result: ReturnType<typeof analyzeNumberMergeV2> }[] = [];
const ambiguous: { a: typeof parsed[0]; b: typeof parsed[0]; result: ReturnType<typeof analyzeNumberMergeV2> }[] = [];

let checked = 0;
const total = (parsed.length * (parsed.length - 1)) / 2;

for (let i = 0; i < parsed.length; i++) {
  for (let j = i + 1; j < parsed.length; j++) {
    checked++;
    if (checked % 2000 === 0) {
      console.log(`  Progress: ${checked}/${total} (${(checked / total * 100).toFixed(1)}%) — found ${identical.length + contains.length + mergable.length + conflict.length + ambiguous.length} so far`);
    }

    const a = parsed[i];
    const b = parsed[j];
    const result = analyzeNumberMergeV2(a.nums, b.nums);

    if (!result.found) continue;

    switch (result.relationship) {
      case "identical":
        identical.push({ a, b, result });
        break;
      case "a-contains-b":
        contains.push({ container: a, contained: b, result });
        break;
      case "b-contains-a":
        contains.push({ container: b, contained: a, result });
        break;
      case "a-then-b":
      case "b-then-a":
        if (result.safeToMerge) {
          mergable.push({ a, b, result });
        } else {
          conflict.push({ a, b, result });
        }
        break;
      case "conflict":
        conflict.push({ a, b, result });
        break;
      case "ambiguous":
        ambiguous.push({ a, b, result });
        break;
    }
  }
}

console.log(`\n${"=".repeat(70)}`);
console.log(`RESULTS: ${identical.length + contains.length + mergable.length + conflict.length + ambiguous.length} relationships found in ${checked} pairs`);
console.log(`${"=".repeat(70)}`);

// --- IDENTICAL ---
if (identical.length > 0) {
  console.log(`\n## IDENTICAL (${identical.length}) — one can be deleted`);
  console.log(`-`.repeat(50));
  for (const { a, b } of identical) {
    console.log(`  "${a.session.Name}" (${a.session.Count}n, idx=${a.session.ImportIndex})  ≡  "${b.session.Name}" (${b.session.Count}n, idx=${b.session.ImportIndex})`);
  }
}

// --- CONTAINS ---
if (contains.length > 0) {
  console.log(`\n## CONTAINS (${contains.length}) — smaller can be deleted`);
  console.log(`-`.repeat(50));
  for (const { container, contained } of contains) {
    console.log(`  "${container.session.Name}" (${container.session.Count}n)  ⊃  "${contained.session.Name}" (${contained.session.Count}n) — delete contained`);
  }
}

// --- MERGABLE ---
if (mergable.length > 0) {
  console.log(`\n## MERGABLE (${mergable.length}) — can be combined`);
  console.log(`-`.repeat(50));
  for (const { a, b, result } of mergable) {
    const mergedLen = result.merged?.length ?? "?";
    console.log(`  "${a.session.Name}" (${a.session.Count}n, idx=${a.session.ImportIndex})  +  "${b.session.Name}" (${b.session.Count}n, idx=${b.session.ImportIndex})  →  ${result.relationship}  →  merged ${mergedLen}n`);
  }
}

// --- CONFLICT ---
if (conflict.length > 0) {
  console.log(`\n## CONFLICT (${conflict.length}) — overlap found but contains mismatches, needs manual review`);
  console.log(`-`.repeat(50));
  for (const { a, b, result } of conflict) {
    const c = result.alignment?.conflicts;
    console.log(`  "${a.session.Name}" (${a.session.Count}n)  ↔  "${b.session.Name}" (${b.session.Count}n)  —  ${result.alignment?.overlapLength}n overlap, ${result.alignment?.mismatchCount} conflicts, rate=${(result.alignment?.matchRate ?? 0 * 100).toFixed(1)}%`);
    if (c && c.length <= 5) {
      for (const cf of c) {
        console.log(`    conflict at coordinate ${cf.coordinate}: A[${cf.indexA}]=${cf.valueA}  B[${cf.indexB}]=${cf.valueB}`);
      }
    }
  }
}

// --- AMBIGUOUS ---
if (ambiguous.length > 0) {
  console.log(`\n## AMBIGUOUS (${ambiguous.length}) — multiple equally-strong alignments, cannot auto-merge`);
  console.log(`-`.repeat(50));
  for (const { a, b, result } of ambiguous) {
    console.log(`  "${a.session.Name}" (${a.session.Count}n)  ↔  "${b.session.Name}" (${b.session.Count}n)  —  ${result.alternatives?.length} equally strong offsets`);
  }
}

console.log(`\n${"=".repeat(70)}`);
console.log("SUMMARY");
console.log(`${"=".repeat(70)}`);
console.log(`  Identical (可删其一):   ${identical.length}`);
console.log(`  Contains  (可删小的):   ${contains.length}`);
console.log(`  Mergable  (可合并):     ${mergable.length}`);
console.log(`  Conflict  (需人工):     ${conflict.length}`);
console.log(`  Ambiguous (需人工):     ${ambiguous.length}`);
