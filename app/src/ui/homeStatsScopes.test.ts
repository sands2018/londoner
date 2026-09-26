import { describe, expect, it } from "vitest";
import { freshHomeStatsScopes, homeStatsScopeInputs, readHomeStatsScopes, validateHomeStatsScopeInputs } from "./homeStatsScopes";

const validValues = [1, 2, 3, 4, 5, 6, 7];
const validInputs = validValues.map(String);

describe("home statistics scope validation", () => {
  it("accepts seven strictly increasing positive integers without changing the input", () => {
    const inputs = ["001", "2", "3", "4", "5", "6", String(Number.MAX_SAFE_INTEGER)];
    const original = [...inputs];
    expect(validateHomeStatsScopeInputs(inputs)).toEqual({
      values: [1, 2, 3, 4, 5, 6, Number.MAX_SAFE_INTEGER], error: null, invalidIndex: null,
    });
    expect(inputs).toEqual(original);
  });

  it("rejects more than seven values", () => {
    const inputs = Array.from({ length: 8 }, (_, index) => String(index + 1));
    expect(validateHomeStatsScopeInputs(inputs)).toMatchObject({ values: null, invalidIndex: null });
  });

  it.each([0, 1, 2, 3, 4, 5, 6, 7])("accepts %i values followed only by empty fields", (length) => {
    const values = validValues.slice(0, length);
    const inputs = homeStatsScopeInputs(values);
    expect(inputs).toHaveLength(7);
    expect(inputs.slice(length)).toEqual(Array(7 - length).fill(""));
    expect(validateHomeStatsScopeInputs(inputs)).toEqual({ values, error: null, invalidIndex: null });
    expect(validateHomeStatsScopeInputs(values.map(String))).toEqual({ values, error: null, invalidIndex: null });
  });

  it.each([0, 1, 2, 3, 4, 5])("rejects a gap at position %i instead of removing it", (index) => {
    const inputs = [...validInputs];
    inputs[index] = "";
    expect(validateHomeStatsScopeInputs(inputs)).toEqual({
      values: null, error: `第 ${index + 1} 个区间留空后，后面的区间也必须留空。`, invalidIndex: index,
    });
  });

  it.each([" ", " 3", "3 ", "0", "-3", "+3", "3.0", "3.5", "3e0", "0x3", "3abc", "NaN", "Infinity", "３"])(
    "rejects an invalid third value: %j", (input) => {
      const inputs = [...validInputs];
      inputs[2] = input;
      const result = validateHomeStatsScopeInputs(inputs);
      expect(result).toMatchObject({ values: null, invalidIndex: 2 });
      expect(result.error).toBe("第 3 个区间值必须是大于 0 的正整数。");
    },
  );

  it.each(["9007199254740992", "9".repeat(400)])("explains that an oversized integer must be smaller", (input) => {
    const inputs = [...validInputs];
    inputs[6] = input;
    expect(validateHomeStatsScopeInputs(inputs)).toEqual({
      values: null, error: "第 7 个区间值过大，请填写更小的正整数。", invalidIndex: 6,
    });
  });

  it.each(["1", "2"])("rejects descending or duplicate values instead of sorting: %s", (input) => {
    const inputs = [...validInputs];
    inputs[2] = input;
    expect(validateHomeStatsScopeInputs(inputs)).toEqual({
      values: null, error: "第 3 个区间值必须大于第 2 个区间值。", invalidIndex: 2,
    });
  });
});

describe("home statistics scope storage", () => {
  it("returns independent defaults for each call", () => {
    const first = freshHomeStatsScopes();
    first.values[0] = 999;
    expect(freshHomeStatsScopes()).toEqual({ useDefault: true, values: [8, 13, 21, 34, 55, 89, 144] });
  });

  it.each([true, false])("restores saved custom values when useDefault is %s", (useDefault) => {
    for (let length = 0; length <= 7; length++) {
      const settings = { useDefault, values: validValues.slice(0, length) };
      expect(readHomeStatsScopes(JSON.stringify(settings))).toEqual(settings);
    }
  });

  it.each([
    null,
    "",
    "invalid json",
    "null",
    "[]",
    "true",
    "{}",
    JSON.stringify({ useDefault: "false", values: validValues }),
    JSON.stringify({ values: validValues }),
    JSON.stringify({ useDefault: false, values: validInputs }),
    JSON.stringify({ useDefault: false, values: [1, 2, 3, 4, 5, 6, 7, 8] }),
    JSON.stringify({ useDefault: false, values: [1, null, 3] }),
    JSON.stringify({ useDefault: false, values: [0, 2, 3, 4, 5, 6, 7] }),
    JSON.stringify({ useDefault: false, values: [-1, 2, 3, 4, 5, 6, 7] }),
    JSON.stringify({ useDefault: false, values: [1.5, 2, 3, 4, 5, 6, 7] }),
    JSON.stringify({ useDefault: false, values: [1, 2, 2, 4, 5, 6, 7] }),
    JSON.stringify({ useDefault: false, values: [2, 1, 3, 4, 5, 6, 7] }),
    JSON.stringify({ useDefault: false, values: [1, 2, 3, 4, 5, 6, Number.MAX_SAFE_INTEGER + 1] }),
    JSON.stringify({ useDefault: true, values: null }),
  ])("falls back safely for missing or corrupt storage: %j", (raw) => {
    expect(readHomeStatsScopes(raw)).toEqual(freshHomeStatsScopes());
  });
});
