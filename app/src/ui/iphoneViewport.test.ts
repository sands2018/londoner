import { describe, expect, it } from "vitest";
import { fitIPhoneViewport, iphoneViewportSize, isViewportPreferenceMessage } from "./iphoneViewport";

describe("iPhone viewport", () => {
  it.each([[1920, 1080], [800, 600], [440, 956], [393, 720], [360, 640], [956, 440]])(
    "fits %i x %i without stretching or clipping", (width, height) => {
      const fit = fitIPhoneViewport(width, height);
      expect(fit.width / fit.height).toBeCloseTo(1320 / 2868, 12);
      expect(fit.width).toBeLessThanOrEqual(width + 0.000001);
      expect(fit.height).toBeLessThanOrEqual(height + 0.000001);
      expect(Math.min(width - fit.width, height - fit.height)).toBeCloseTo(0);
    },
  );

  it("uses an unscaled 440 x 956 logical viewport on the target device", () => {
    expect(fitIPhoneViewport(440, 956)).toEqual({ ...iphoneViewportSize, scale: 1 });
  });

  it("accepts only well-formed preference messages", () => {
    expect(isViewportPreferenceMessage({ type: "londoner:iphone-viewport", enabled: true })).toBe(true);
    for (const value of [null, true, {}, { type: "other", enabled: true }, { type: "londoner:iphone-viewport", enabled: "1" }]) {
      expect(isViewportPreferenceMessage(value)).toBe(false);
    }
  });
});
