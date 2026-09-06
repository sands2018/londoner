import { viewportFrameId } from "./ui/iphoneViewport";

// The child supplies a real CSS/JS viewport, including media queries and fixed dialogs.
if (window.frameElement?.id === viewportFrameId) {
  void import("./renderApp");
} else {
  void import("./ui/viewportHost").then(({ mountViewportHost }) => {
    mountViewportHost(document.getElementById("root")!);
  });

  // SW temporarily disabled during development.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      for (const reg of regs) void reg.unregister();
    });
  }
}
