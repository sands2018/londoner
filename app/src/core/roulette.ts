export type RouletteNumber = number;

export type NumberColor = "green" | "red" | "black";

export type ColRowIndex = 0 | 1 | 2 | 3 | 4 | 5;

export const rouletteNumbers = Array.from({ length: 37 }, (_, index) => index);

const numberColors: NumberColor[] = [
  "green",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
  "black",
  "red",
];

export function isRouletteNumber(value: number): value is RouletteNumber {
  return Number.isInteger(value) && value >= 0 && value <= 36;
}

export function getNumberColor(value: RouletteNumber): NumberColor {
  return numberColors[value] ?? "green";
}

export function getGroupIndex(value: RouletteNumber): 0 | 1 | 2 | null {
  if (value === 0) return null;
  return Math.floor((value - 1) / 12) as 0 | 1 | 2;
}

export function getRowIndex(value: RouletteNumber): 0 | 1 | 2 | null {
  if (value === 0) return null;

  const remainder = value % 3;
  if (remainder === 1) return 2;
  if (remainder === 2) return 1;
  return 0;
}

export function getColRowLabel(index: ColRowIndex): string {
  const labels = ["一组", "二组", "三组", "1行", "2行", "3行"];
  return labels[index] ?? "";
}

export function getNumberColRows(value: RouletteNumber): ColRowIndex[] {
  const groupIndex = getGroupIndex(value);
  const rowIndex = getRowIndex(value);

  if (groupIndex === null || rowIndex === null) {
    return [];
  }

  return [groupIndex, (rowIndex + 3) as ColRowIndex];
}

export function getColumnIndexes(value: RouletteNumber): number[] {
  if (value === 0) return [];

  const first = Math.floor((value - 1) / 6) * 2;
  const second = value > 3 && value < 34 ? Math.floor((value - 4) / 6) * 2 + 1 : -1;

  return second >= 0 ? [first, second] : [first];
}
