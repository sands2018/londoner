import { useEffect, useState } from "react";
import { loadSimulateIPhone, saveSimulateIPhone } from "../iphoneViewport";

export type DisplayMode = "auto" | "desktop" | "mobile";
export const displaySettingsEvent = "sands:display-settings";
export const displayModeKey = "londoner.simulatorDesktopMode";
export const animationSpeedKey = "londoner.simulatorAnimationSpeed";
export function readDisplaySettings() {
  const stored = localStorage.getItem(displayModeKey);
  return {
    mode: (stored === "1" ? "desktop" : stored === "0" ? "mobile" : "auto") as DisplayMode,
    iphone: loadSimulateIPhone(),
    speed: localStorage.getItem(animationSpeedKey) === "fast" ? "fast" as const : "slow" as const,
  };
}
export function writeDisplaySettings(settings: ReturnType<typeof readDisplaySettings>) {
  localStorage.setItem(displayModeKey, settings.mode === "desktop" ? "1" : settings.mode === "mobile" ? "0" : "9");
  localStorage.setItem(animationSpeedKey, settings.speed);
  saveSimulateIPhone(settings.iphone);
  window.dispatchEvent(new Event(displaySettingsEvent));
}
export function useDisplaySettings() {
  const [settings, setSettings] = useState(readDisplaySettings);
  const [desktopDetected, setDesktopDetected] = useState(() => window.innerWidth >= 900 && matchMedia("(hover: hover) and (pointer: fine)").matches);
  useEffect(() => {
    const read = () => setSettings(readDisplaySettings());
    const resize = () => setDesktopDetected(window.innerWidth >= 900 && matchMedia("(hover: hover) and (pointer: fine)").matches);
    window.addEventListener(displaySettingsEvent, read);
    window.addEventListener("storage", read);
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener(displaySettingsEvent, read);
      window.removeEventListener("storage", read);
      window.removeEventListener("resize", resize);
    };
  }, []);
  return { ...settings, desktop: !settings.iphone && (settings.mode === "desktop" || (settings.mode === "auto" && desktopDetected)) };
}
