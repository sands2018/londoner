import { viewportFrameId } from "./ui/iphoneViewport";
import { reloadApplication, retireLegacyAppCache } from "./ui/appRecovery";

// The child supplies a real CSS/JS viewport, including media queries and fixed dialogs.
if (window.frameElement?.id === viewportFrameId) {
  void import("./renderApp");
} else {
  void (async () => {
    const controlled = await Promise.race([retireLegacyAppCache(), new Promise<false>(resolve => setTimeout(() => resolve(false), 1500))]);
    // An already controlled document can still receive old files after
    // unregister(). Start a fresh document before any game mounts.
    if (controlled) { await reloadApplication(); return; }
    const { mountViewportHost } = await import("./ui/viewportHost");
    mountViewportHost(document.getElementById("root")!);
  })();
}
