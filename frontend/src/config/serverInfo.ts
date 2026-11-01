/**
 * Detects a backend that is older than this frontend (e.g. the frontend
 * deployed but the backend build failed and the old version is still live).
 * Newer features (prompt enhancer, message delete, code runner, ...) need
 * at least this API version.
 */
export const REQUIRED_API_VERSION = 5;

type Listener = (outdated: boolean) => void;

let outdated: boolean | null = null;
const listeners = new Set<Listener>();

export const setServerApiVersion = (version: unknown) => {
  outdated = typeof version !== "number" || version < REQUIRED_API_VERSION;
  listeners.forEach((l) => l(outdated!));
};

export const isServerOutdated = () => outdated;

export const onServerOutdatedChange = (listener: Listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
