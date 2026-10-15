import { getWebContainer } from "../config/webContainer";

let prefetched = false;

/**
 * Warm up everything the project page needs while the user is idle on the
 * dashboard: the page and editor code, and the in-browser Node.js runtime.
 * Opening a project and pressing Run is then much faster.
 */
export const prefetchProjectWorkspace = () => {
  if (prefetched || typeof window === "undefined") return;
  prefetched = true;

  const run = () => {
    import("../screens/Project").catch(() => {});
    import("../components/project/CodeEditor").catch(() => {});
    // Booting needs cross-origin isolation; skip silently where unavailable
    if (window.crossOriginIsolated) getWebContainer().catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1500);
  }
};
