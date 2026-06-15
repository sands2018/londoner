/**
 * Scan history_data_cleaned.json for any remaining overlap/containment
 * between sessions, using the new global analyzeMerge algorithm.
 *
 * Usage: npx tsx scripts/find_overlaps.ts
 */

import * as fs from "fs";
import { analyzeMerge, OverlapResult } from "../app/src/core/numberMerge";

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
  fs.readFileSync("E:/_TRANSFER_/history_data_cleaned.json", "utf8"),
);

console.log(`Total sessions: ${data.length}`);

// Pre-parse all number arrays
const parsed: { session: Session; nums: number[] }[] = data.map((s) => ({
  session: s,
  nums: parseNumbers(s.Numbers),
}));

interface Finding {
  type: "overlap" | "contains" | "contained";
  a: { name: string; count: number; importIndex: number };
  b: { name: string; count: number; importIndex: number };
  result: OverlapResult;
}

const findings: Finding[] = [];
let checked = 0;
const total = (parsed.length * (parsed.length - 1)) / 2;

for (let i = 0; i < parsed.length; i++) {
  for (let j = i + 1; j < parsed.length; j++) {
    checked++;
    if (checked % 1000 === 0) {
      console.log(`  Progress: ${checked}/${total} (${(checked / total * 100).toFixed(1)}%) — ${findings.length} found so far`);
    }

    const a = parsed[i];
    const b = parsed[j];
    const result = analyzeMerge(a.nums, b.nums);

    if (result.found) {
      findings.push({
        type: result.type,
        a: { name: a.session.Name, count: a.session.Count, importIndex: a.session.ImportIndex },
        b: { name: b.session.Name, count: b.session.Count, importIndex: b.session.ImportIndex },
        result,
      });
    }
  }
}

console.log(`\n=== RESULTS ===`);
console.log(`Checked ${checked} pairs, found ${findings.length} with overlap/containment.\n`);

// Group by type
const byType = {
  overlap: findings.filter((f) => f.type === "overlap"),
  contains: findings.filter((f) => f.type === "contains"),
  contained: findings.filter((f) => f.type === "contained"),
};

for (const [type, list] of Object.entries(byType)) {
  if (list.length === 0) continue;
  console.log(`--- ${type} (${list.length}) ---`);
  for (const f of list) {
    console.log(`  ${f.a.name} (${f.a.count}n, idx=${f.a.importIndex})  <->  ${f.b.name} (${f.b.count}n, idx=${f.b.importIndex})`);
    console.log(`    ${f.result.description}`);
  }
  console.log();
}

// Summary for easy reading
console.log("=== SUMMARY ===");
console.log(`Overlap:    ${byType.overlap.length} pairs — A tail matches B head (or vice versa), can merge`);
console.log(`Contains:   ${byType.contains.length} pairs — B is fully inside A`);
console.log(`Contained:  ${byType.contained.length} pairs — A is fully inside B`);
console.log(`Total:      ${findings.length} pairs with detectable relationship`);
