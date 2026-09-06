export const iphoneViewportKey = "londoner.simulateIPhone";
export const viewportFrameId = "londoner-viewport";
const preferenceMessage = "londoner:iphone-viewport";

// iPhone 17 Pro Max: 1320 x 2868 physical pixels at 3x density.
export const iphoneViewportSize = { width: 440, height: 956 } as const;

export function fitIPhoneViewport(width: number, height: number) {
  const scale = Math.min(width / iphoneViewportSize.width, height / iphoneViewportSize.height);
  return { scale, width: iphoneViewportSize.width * scale, height: iphoneViewportSize.height * scale };
}

export function loadSimulateIPhone() {
  return localStorage.getItem(iphoneViewportKey) === "1";
}

export function saveSimulateIPhone(enabled: boolean) {
  localStorage.setItem(iphoneViewportKey, enabled ? "1" : "0");
  window.parent.postMessage({ type: preferenceMessage, enabled }, window.location.origin);
}

export function isViewportPreferenceMessage(data: unknown): data is { enabled: boolean } {
  return typeof data === "object" && data !== null &&
    "type" in data && data.type === preferenceMessage &&
    "enabled" in data && typeof data.enabled === "boolean";
}
