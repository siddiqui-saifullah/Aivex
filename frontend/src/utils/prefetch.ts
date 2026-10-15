let prefetched = false;

/**
 * Download the project page and editor code while the user is idle on the
 * dashboard, so opening a project is instant. (The Node.js runtime itself is
 * booted by the project page, as before: booting it here was not needed.)
 */
export const prefetchProjectWorkspace = () => {
  if (prefetched || typeof window === "undefined") return;
  prefetched = true;

  const run = () => {
    import("../screens/Project").catch(() => {});
    import("../components/project/CodeEditor").catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 3000 });
  } else {
    setTimeout(run, 1500);
  }
};
