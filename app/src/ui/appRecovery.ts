const appBase = new URL(import.meta.env.BASE_URL, location.origin);

/** Retire HTTP asset caches only; saved games and roulette data are untouched. */
export async function retireLegacyAppCache(): Promise<boolean> {
  const controlsApp = (script: string | undefined) => !!script && new URL(script).href === new URL("sw.js", appBase).href;
  const controlled = "serviceWorker" in navigator && controlsApp(navigator.serviceWorker.controller?.scriptURL);
  await Promise.allSettled([
    "serviceWorker" in navigator ? navigator.serviceWorker.getRegistrations().then(registrations =>
      Promise.all(registrations.filter(reg => reg.scope === appBase.href).map(reg => reg.unregister()))) : Promise.resolve(),
    "caches" in window ? caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("londoner-shell-")).map(key => caches.delete(key)))) : Promise.resolve(),
  ]);
  return controlled;
}

export async function reloadApplication() {
  // A stalled browser storage operation must not disable the recovery button.
  await Promise.race([retireLegacyAppCache(), new Promise(resolve => setTimeout(resolve, 1500))]);
  const host = window.parent === window ? window : window.parent;
  const url = new URL(host.location.href);
  url.hash = location.hash;
  // GitHub Pages caches HTML for ten minutes. A new document URL also resets
  // the browser's failed-module cache without deleting any saved game data.
  url.searchParams.set("_reload", Date.now().toString(36));
  host.location.replace(url.href);
}
