import { getNumberColRows, type RouletteNumber } from "./roulette";
import { colRowLabels } from "./colRowStats";

export const frequencyScopes = [18, 36, 72, 144, 288, 576] as const;
export const frequencyDetailKeys = [0, 1, 2, 4, 5, 6] as const;
export const frequencyBandLabels = colRowLabels.slice(0, 8);

export interface FrequencyStats {
  frequencies: number[][][];
  nonZeroCount: number;
}

export function calculateFrequencyStats(numbers: readonly RouletteNumber[]): FrequencyStats {
  const nonZeroNumbers = numbers.filter((value) => value !== 0);
  const frequencies = Array.from({ length: 8 }, () =>
    Array.from({ length: frequencyScopes.length }, () => [] as number[]),
  );

  for (let length = 1; length <= nonZeroNumbers.length; length += 1) {
    for (let scopeIndex = 0; scopeIndex < frequencyScopes.length; scopeIndex += 1) {
      const scope = frequencyScopes[scopeIndex];
      if (length < scope) continue;

      const counts = Array<number>(6).fill(0);
      for (let index = length - 1; index >= length - scope; index -= 1) {
        const hits = getNumberColRows(nonZeroNumbers[index]);
        for (const hit of hits) {
          counts[hit] += 1;
        }
      }

      const average = scope / 3;
      let maxOffset = 0;
      for (let index = 0; index < 6; index += 1) {
        const waveIndex = index >= 3 ? index + 1 : index;
        const offset = ((counts[index] - average) * 100) / average;
        frequencies[waveIndex][scopeIndex].push(offset);

        if (index % 3 === 0) {
          maxOffset = 0;
        }

        maxOffset = Math.max(maxOffset, Math.abs(offset));
        if (index % 3 === 2) {
          frequencies[waveIndex + 1][scopeIndex].push(maxOffset);
        }
      }
    }
  }

  return {
    frequencies,
    nonZeroCount: nonZeroNumbers.length,
  };
}
