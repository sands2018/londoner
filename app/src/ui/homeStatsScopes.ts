export const homeStatsScopesKey = "londoner.homeStatsScopes";

export interface HomeStatsScopesSettings {
  useDefault: boolean;
  values: number[];
}

type HomeStatsScopeValidation =
  | { values: number[]; error: null; invalidIndex: null }
  | { values: null; error: string; invalidIndex: number | null };

export function freshHomeStatsScopes(): HomeStatsScopesSettings {
  return { useDefault: true, values: [8, 13, 21, 34, 55, 89, 144] };
}

export function homeStatsScopeInputs(values: readonly number[]): string[] {
  return Array.from({ length: 7 }, (_, index) => values[index] === undefined ? "" : String(values[index]));
}

export function validateHomeStatsScopeInputs(inputs: readonly string[]): HomeStatsScopeValidation {
  if (inputs.length > 7) {
    return { values: null, error: "最多可设置 7 个区间。", invalidIndex: null };
  }

  const values: number[] = [];
  let firstEmptyIndex: number | null = null;
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (input === "") {
      firstEmptyIndex ??= index;
      continue;
    }
    if (firstEmptyIndex !== null) {
      return {
        values: null,
        error: `第 ${firstEmptyIndex + 1} 个区间留空后，后面的区间也必须留空。`,
        invalidIndex: firstEmptyIndex,
      };
    }
    const value = Number(input);
    if (!/^\d+$/.test(input) || value <= 0) {
      return {
        values: null,
        error: `第 ${index + 1} 个区间值必须是大于 0 的正整数。`,
        invalidIndex: index,
      };
    }
    if (!Number.isSafeInteger(value)) {
      return {
        values: null,
        error: `第 ${index + 1} 个区间值过大，请填写更小的正整数。`,
        invalidIndex: index,
      };
    }
    if (index > 0 && value <= values[index - 1]) {
      return {
        values: null,
        error: `第 ${index + 1} 个区间值必须大于第 ${index} 个区间值。`,
        invalidIndex: index,
      };
    }
    values.push(value);
  }

  return { values, error: null, invalidIndex: null };
}

export function readHomeStatsScopes(raw: string | null): HomeStatsScopesSettings {
  try {
    const parsed: unknown = raw === null ? null : JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return freshHomeStatsScopes();
    const settings = parsed as Partial<HomeStatsScopesSettings>;
    if (typeof settings.useDefault !== "boolean"
      || !Array.isArray(settings.values)
      || !settings.values.every((value) => typeof value === "number")) {
      return freshHomeStatsScopes();
    }
    const result = validateHomeStatsScopeInputs(settings.values.map(String));
    return result.values === null
      ? freshHomeStatsScopes()
      : { useDefault: settings.useDefault, values: result.values };
  } catch {
    return freshHomeStatsScopes();
  }
}
