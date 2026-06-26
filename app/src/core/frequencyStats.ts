import { getNumberColRows, type RouletteNumber } from "./roulette";
import { colRowLabels } from "./colRowStats";

export const frequencyScopes = [18, 36, 72, 144, 288, 576] as const;
export type FrequencyScope = (typeof frequencyScopes)[number] | number;
export const frequencyDetailKeys = [0, 1, 2, 4, 5, 6] as const;
export const frequencyBandLabels = colRowLabels.slice(0, 8);

export interface FrequencyStats {
  frequencies: number[][][];
  nonZeroCount: number;
  zScores: number[][][];
}

export function calculateFrequencyStats(
  numbers: readonly RouletteNumber[],
  scopes: readonly FrequencyScope[] = frequencyScopes,
): FrequencyStats {
  const nonZeroNumbers = numbers.filter((value) => value !== 0);
  const frequencies = Array.from({ length: 8 }, () =>
    Array.from({ length: scopes.length }, () => [] as number[]),
  );
  const zScores = Array.from({ length: 8 }, () =>
    Array.from({ length: scopes.length }, () => [] as number[]),
  );

  for (let length = 1; length <= nonZeroNumbers.length; length += 1) {
    for (let scopeIndex = 0; scopeIndex < scopes.length; scopeIndex += 1) {
      const scope = scopes[scopeIndex];
      if (length < scope) continue;

      const counts = Array<number>(6).fill(0);
      for (let index = length - 1; index >= length - scope; index -= 1) {
        const hits = getNumberColRows(nonZeroNumbers[index]);
        for (const hit of hits) {
          counts[hit] += 1;
        }
      }

      const average = scope / 3;
      const standardDeviation = Math.sqrt((scope * 2) / 9);
      let maxOffset = 0;
      let maxZScore = 0;
      for (let index = 0; index < 6; index += 1) {
        const waveIndex = index >= 3 ? index + 1 : index;
        const offset = ((counts[index] - average) * 100) / average;
        const zScore = standardDeviation > 0 ? (counts[index] - average) / standardDeviation : 0;
        frequencies[waveIndex][scopeIndex].push(offset);
        zScores[waveIndex][scopeIndex].push(zScore);

        if (index % 3 === 0) {
          maxOffset = 0;
          maxZScore = 0;
        }

        maxOffset = Math.max(maxOffset, Math.abs(offset));
        maxZScore = Math.max(maxZScore, Math.abs(zScore));
        if (index % 3 === 2) {
          frequencies[waveIndex + 1][scopeIndex].push(maxOffset);
          zScores[waveIndex + 1][scopeIndex].push(maxZScore);
        }
      }
    }
  }

  return {
    frequencies,
    nonZeroCount: nonZeroNumbers.length,
    zScores,
  };
}
