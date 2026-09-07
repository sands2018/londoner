import { useEffect, useState } from "react";
import { defaultSicBoSettings, isSicBoMinimum, isSicBoRule, type SicBoSettings } from "../../core/sicBo";

const key = "sands2018.sicbo.settings";
const event = "sands:sicbo-settings";
export function readSicBoSettings(): SicBoSettings {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null");
    return { rule: isSicBoRule(value?.rule) ? value.rule : defaultSicBoSettings.rule, minimum: isSicBoMinimum(value?.minimum) ? value.minimum : defaultSicBoSettings.minimum };
  } catch { return { ...defaultSicBoSettings }; }
}
export function writeSicBoSettings(value: SicBoSettings) {
  localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(event));
}
export function useSicBoSettings() {
  const [settings, setSettings] = useState(readSicBoSettings);
  useEffect(() => {
    const read = () => setSettings(readSicBoSettings());
    window.addEventListener(event, read);
    window.addEventListener("storage", read);
    return () => { window.removeEventListener(event, read); window.removeEventListener("storage", read); };
  }, []);
  return settings;
}
