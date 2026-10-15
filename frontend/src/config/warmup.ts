import { setServerApiVersion } from "./serverInfo";

/**
 * The backend runs on a free tier that sleeps when idle and takes several
 * seconds to wake. Ping it as soon as the app loads (on any page) so it is
 * usually awake by the time the user logs in or opens a project. The reply
 * also tells us which API version is deployed.
 */
export const warmUpBackend = () => {
  const url = import.meta.env.VITE_API_URL;
  if (!url) return;

  fetch(url, { method: "GET", mode: "cors" })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: { apiVersion?: number } | null) => {
      if (data) setServerApiVersion(data.apiVersion);
    })
    .catch(() => {
      /* offline or waking up; features fail with their own messages */
    });
};
