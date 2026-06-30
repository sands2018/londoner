/**
 * Apply Wayne's confirmed V2 history cleanup decisions to a new file.
 *
 * Source is read-only. This script never overwrites HistoryData/history_data.json.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import { analyzeNumberMergeV2 } from "../app/src/core/numberMergeV2";

interface Session {
  Count: number;
  Name: string;
  Numbers: string;
  SaveTime?: string;
  tms: number;
  ImportIndex?: number;
  SharedUploader?: string;
  [key: string]: unknown;
}

const SOURCE_PATH = "HistoryData/history_data.json";
const OUTPUT_PATH = "HistoryData/history_data_cleaned_v2.json";

const DELETE_NAMES = [
  "20231025-下午-伦敦人",
  "20191009-10-喜来登-老",
  "20260603-05",
  "20210620-2328",
  "20210620-1830",
  "20210619-2300",
  "20210618-2341",
  "20190330-1700",
  "20190329-1825",
  "20190129-sxr02",
  "20190129-sxr03",
  "20260602-1600-澳门永利",
  "wzs-2026-01-01-001",
  "wzs-2023-06-05-096",
  "wzs-2023-06-05-095",
  "wzs-2023-06-05-092",
  "wzs-2023-06-05-094",
  "wzs-2021-06-17-085",
  "wzs-2021-06-17-086",
  "wzs-2021-06-17-084",
  "20210619-2245",
  "wzs-2021-06-17-079",
  "wzs-2021-06-17-077",
  "wzs-2021-06-17-076",
] as const;

const MERGE_EARLIER_NAME = "20260602-1600-澳门永利";
const MERGE_TARGET_NAME = "20260603-0030-澳门永利";

function parseNumbers(raw: string): number[] {
  const numbers = raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter(Number.isFinite);

  if (numbers.some((value) => value < 0 || value > 36)) {
    throw new Error("Found a number outside the roulette range 0-36");
  }
  return numbers;
}

function hash(value: Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function findExactlyOne(sessions: readonly Session[], name: string): Session {
  const matches = sessions.filter((session) => session.Name === name);
  if (matches.length !== 1) {
    throw new Error(`Expected exactly one "${name}", found ${matches.length}`);
  }
  return matches[0];
}

function summarizeRelationships(sessions: readonly Session[]) {
  const parsed = sessions.map((session) => ({
    session,
    numbers: parseNumbers(session.Numbers),
  }));
  const summary = {
    identical: 0,
    contains: 0,
    mergeable: 0,
    conflict: 0,
    ambiguous: 0,
  };
  const details: string[] = [];

  for (let leftIndex = 0; leftIndex < parsed.length; leftIndex++) {
    for (let rightIndex = leftIndex + 1; rightIndex < parsed.length; rightIndex++) {
      const left = parsed[leftIndex];
      const right = parsed[rightIndex];
      const result = analyzeNumberMergeV2(left.numbers, right.numbers);
      if (!result.found) continue;

      switch (result.relationship) {
        case "identical":
          summary.identical++;
          break;
        case "a-contains-b":
        case "b-contains-a":
          summary.contains++;
          break;
        case "a-then-b":
        case "b-then-a":
          if (result.safeToMerge) summary.mergeable++;
          else summary.conflict++;
          break;
        case "conflict":
          summary.conflict++;
          break;
        case "ambiguous":
          summary.ambiguous++;
          break;
      }

      details.push(
        `${left.session.Name} <-> ${right.session.Name}: ${result.relationship}`
        + `, overlap=${result.alignment?.overlapLength ?? "?"}`
        + `, mismatches=${result.alignment?.mismatchCount ?? "?"}`,
      );
    }
  }

  return { summary, details };
}

const sourceBytesBefore = fs.readFileSync(SOURCE_PATH);
const sourceHashBefore = hash(sourceBytesBefore);
const source = JSON.parse(sourceBytesBefore.toString("utf8")) as Session[];

if (source.length !== 166) {
  throw new Error(`Expected 166 source sessions, found ${source.length}`);
}
if (new Set(DELETE_NAMES).size !== DELETE_NAMES.length) {
  throw new Error("Delete decision list contains duplicate names");
}

for (const name of DELETE_NAMES) {
  findExactlyOne(source, name);
}

const earlier = findExactlyOne(source, MERGE_EARLIER_NAME);
const target = findExactlyOne(source, MERGE_TARGET_NAME);
const earlierNumbers = parseNumbers(earlier.Numbers);
const targetNumbers = parseNumbers(target.Numbers);
const mergeAnalysis = analyzeNumberMergeV2(targetNumbers, earlierNumbers);

if (
  mergeAnalysis.relationship !== "conflict"
  || mergeAnalysis.alignment?.relationship !== "b-then-a"
  || mergeAnalysis.alignment.offsetB !== -300
  || mergeAnalysis.alignment.overlapLength !== 77
  || mergeAnalysis.alignment.mismatchCount !== 1
  || mergeAnalysis.alignment.conflicts[0]?.valueA !== 29
  || mergeAnalysis.alignment.conflicts[0]?.valueB !== 32
) {
  throw new Error(`Merge relationship changed unexpectedly: ${mergeAnalysis.description}`);
}

// Wayne chose the later target's value 29 in the sole conflict.
const mergedNumbers = [
  ...earlierNumbers.slice(0, -mergeAnalysis.alignment.offsetB),
  ...targetNumbers,
];
if (mergedNumbers.length !== 809) {
  throw new Error(`Expected merged length 809, found ${mergedNumbers.length}`);
}

const deleteSet = new Set<string>(DELETE_NAMES);
const cleaned = source
  .filter((session) => !deleteSet.has(session.Name))
  .map((session) => (
    session.Name === MERGE_TARGET_NAME
      ? { ...session, Count: mergedNumbers.length, Numbers: mergedNumbers.join(",") }
      : { ...session }
  ));

if (cleaned.length !== 142) {
  throw new Error(`Expected 142 cleaned sessions, found ${cleaned.length}`);
}
for (const name of DELETE_NAMES) {
  if (cleaned.some((session) => session.Name === name)) {
    throw new Error(`Deleted session still present: ${name}`);
  }
}

const cleanedTarget = findExactlyOne(cleaned, MERGE_TARGET_NAME);
if (cleanedTarget.Count !== 809 || parseNumbers(cleanedTarget.Numbers).length !== 809) {
  throw new Error("Merged target did not retain the expected 809 numbers");
}

fs.writeFileSync(OUTPUT_PATH, `${JSON.stringify(cleaned, null, 2)}\n`, "utf8");

const output = JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8")) as Session[];
const outputScan = summarizeRelationships(output);
const sourceHashAfter = hash(fs.readFileSync(SOURCE_PATH));
if (sourceHashAfter !== sourceHashBefore) {
  throw new Error("Source HistoryData/history_data.json changed during execution");
}

console.log(JSON.stringify({
  sourcePath: SOURCE_PATH,
  outputPath: OUTPUT_PATH,
  sourceHashBefore,
  sourceHashAfter,
  sourceUnchanged: sourceHashBefore === sourceHashAfter,
  sourceSessionCount: source.length,
  deletedSessionCount: DELETE_NAMES.length,
  outputSessionCount: output.length,
  mergedTarget: {
    name: cleanedTarget.Name,
    originalTargetLength: targetNumbers.length,
    earlierPrefixAdded: -mergeAnalysis.alignment.offsetB,
    conflictChoice: 29,
    finalLength: cleanedTarget.Count,
  },
  outputV2Scan: outputScan,
}, null, 2));
