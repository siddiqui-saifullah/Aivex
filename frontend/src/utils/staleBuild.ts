/**
 * After a new deploy, a tab that is still running the previous build asks for
 * code-split files (e.g. the dashboard's chunk) that no longer exist, and the
 * import fails. Reloading picks up the new build. Reload at most once a
 * minute so a real outage can't cause a reload loop.
 */
const KEY = "aivex:stale-build-reload";

export const isStaleBuildError = (error: unknown) =>
  /dynamically imported module|Importing a module script failed|error loading dynamically imported|Unable to preload CSS|is not a valid JavaScript MIME type/i.test(
    String((error as Error)?.message ?? error),
  );

/** Reloads the page once for a stale build; returns false if it already tried just now. */
export const reloadForNewBuild = () => {
  try {
    const last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // No storage: still reload once (this page load)
  }
  window.location.reload();
  return true;
};
