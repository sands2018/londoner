/**
 * Read-only detailed report for HistoryData/history_data.json using numberMergeV2.
 *
 * This script never writes to the source history file.
 */

import fs from "node:fs";
import { analyzeNumberMergeV2 } from "../app/src/core/numberMergeV2";
import { getHistoryDataIso, getHistorySaveTms } from "./historyTime";

interface Session {
  Count: number;
  Name: string;
  Numbers: string;
  SaveTime?: string;
  tms?: number;
  DataTms?: number;
  dataTms?: number;
  DataTime?: string;
  dataTime?: string;
  ImportIndex: number;
  SharedUploader: string;
}

function parseNumbers(raw: string): number[] {
  return raw
    .split(",")
    .map((value) => Number.parseInt(value.trim(), 10))
    .filter(Number.isFinite);
}

const sessions = JSON.parse(
  fs.readFileSync("HistoryData/history_data.json", "utf8"),
) as Session[];

const parsed = sessions.map((session, index) => ({
  session,
  numbers: parseNumbers(session.Numbers),
  position: index + 1,
}));

function metadata(item: (typeof parsed)[number]) {
  return {
    position: item.position,
    name: item.session.Name,
    countField: item.session.Count,
    actualCount: item.numbers.length,
    dataIso: getHistoryDataIso(item.session, item.position),
    saveTms: getHistorySaveTms(item.session, item.position),
    importIndex: item.session.ImportIndex,
    uploader: item.session.SharedUploader,
  };
}

const relationships = [];

for (let leftIndex = 0; leftIndex < parsed.length; leftIndex++) {
  for (let rightIndex = leftIndex + 1; rightIndex < parsed.length; rightIndex++) {
    const left = parsed[leftIndex];
    const right = parsed[rightIndex];
    const result = analyzeNumberMergeV2(left.numbers, right.numbers);
    if (!result.found) continue;

    const alignment = result.alignment;
    relationships.push({
      left: metadata(left),
      right: metadata(right),
      relationship: result.relationship,
      safeToMerge: result.safeToMerge,
      mergedLength: result.merged?.length,
      alignment: alignment ? {
        underlyingRelationship: alignment.relationship,
        offsetB: alignment.offsetB,
        overlapA: [alignment.overlapStartA, alignment.overlapEndA],
        overlapB: [alignment.overlapStartB, alignment.overlapEndB],
        overlapLength: alignment.overlapLength,
        matchedCount: alignment.matchedCount,
        mismatchCount: alignment.mismatchCount,
        matchRatePercent: Number((alignment.matchRate * 100).toFixed(4)),
        conflicts: alignment.conflicts,
      } : undefined,
      alternatives: result.alternatives?.map((alternative) => ({
        offsetB: alternative.offsetB,
        underlyingRelationship: alternative.relationship,
        overlapLength: alternative.overlapLength,
        mismatchCount: alternative.mismatchCount,
      })),
    });
  }
}

console.log(JSON.stringify({
  source: "HistoryData/history_data.json",
  sessionCount: parsed.length,
  countFieldMismatches: parsed
    .filter((item) => item.session.Count !== item.numbers.length)
    .map(metadata),
  relationships,
}, null, 2));
