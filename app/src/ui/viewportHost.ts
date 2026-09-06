/// <reference types="vite/client" />
import { fitIPhoneViewport, iphoneViewportKey, iphoneViewportSize, isViewportPreferenceMessage, loadSimulateIPhone, viewportFrameId } from "./iphoneViewport";
import "./viewportHost.css";

export function mountViewportHost(root: HTMLElement) {
  const host = document.createElement("div");
  host.className = "viewport-host";
  const frame = document.createElement("iframe");
  frame.id = viewportFrameId;
  frame.title = "Sands2018";
  frame.allow = "camera; clipboard-write";
  host.append(frame);
  root.append(host);
  let simulateIPhone = loadSimulateIPhone();

  const updateViewport = () => {
    host.classList.toggle("simulating-iphone", simulateIPhone);
    const viewport = window.visualViewport;
    const width = viewport?.width ?? window.innerWidth;
    const height = viewport?.height ?? window.innerHeight;
    if (simulateIPhone) {
      const fit = fitIPhoneViewport(width, height);
      Object.assign(frame.style, {
        width: `${iphoneViewportSize.width}px`,
        height: `${iphoneViewportSize.height}px`,
        left: `${(viewport?.offsetLeft ?? 0) + (width - fit.width) / 2}px`,
        top: `${(viewport?.offsetTop ?? 0) + (height - fit.height) / 2}px`,
        transform: `scale(${fit.scale})`,
      });
    } else {
      Object.assign(frame.style, { width: "100%", height: "100%", left: "0px", top: "0px", transform: "none" });
    }

    // An iframe has its own viewport, but not the outer device's safe-area insets.
    const childRoot = frame.contentDocument?.documentElement;
    if (childRoot) {
      const style = getComputedStyle(host);
      for (const side of ["top", "right", "bottom", "left"] as const) {
        childRoot.style.setProperty(`--app-safe-area-${side}`, simulateIPhone ? "0px" : style.getPropertyValue(`padding-${side}`));
      }
    }
  };

  const onPreference = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow || !isViewportPreferenceMessage(event.data)) return;
    simulateIPhone = event.data.enabled;
    updateViewport();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === iphoneViewportKey || event.key === null) {
      simulateIPhone = loadSimulateIPhone();
      updateViewport();
    }
  };
  frame.addEventListener("load", () => {
    updateViewport();
    frame.contentWindow?.focus();
  });
  window.addEventListener("message", onPreference);
  window.addEventListener("storage", onStorage);
  window.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("resize", updateViewport);
  window.visualViewport?.addEventListener("scroll", updateViewport);
  updateViewport();
  // Keep this frame mounted across mode changes so bets, navigation and timers survive.
  frame.src = window.location.href;

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener("message", onPreference);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("resize", updateViewport);
      window.visualViewport?.removeEventListener("scroll", updateViewport);
      host.remove();
    });
  }
}
