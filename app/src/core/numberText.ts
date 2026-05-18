import { isRouletteNumber, type RouletteNumber } from "./roulette";

export interface ParsedNumbers {
  invalidTokens: string[];
  numbers: RouletteNumber[];
}

export function formatNumbers(numbers: readonly RouletteNumber[]): string {
  return numbers.join(",");
}

export function parseNumbersText(text: string): ParsedNumbers {
  const tokens = text
    .trim()
    .split(/[\s,，、;；|]+/)
    .filter(Boolean);
  const numbers: RouletteNumber[] = [];
  const invalidTokens: string[] = [];

  for (const token of tokens) {
    const value = Number(token);
    if (isRouletteNumber(value)) {
      numbers.push(value);
    } else {
      invalidTokens.push(token);
    }
  }

  return { invalidTokens, numbers };
}
