/**
 * The backend runs on a free tier that sleeps when idle and takes several
 * seconds to wake. Ping it as soon as the app loads (on any page) so it is
 * usually awake by the time the user logs in or opens a project.
 */
export const warmUpBackend = () => {
  const url = import.meta.env.VITE_API_URL;
  if (!url) return;
  // Fire-and-forget; failures don't matter here
  fetch(url, { method: "GET", mode: "cors" }).catch(() => {});
};
