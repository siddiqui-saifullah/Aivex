import type { FlatFileTree } from "../types";

/**
 * Apply an AI change set: the AI only returns files it created or changed
 * (plus paths to delete), so merge instead of replacing the whole project.
 * The .aivex system file is never removed.
 */
export const applyFilePatch = (
  current: FlatFileTree,
  changed: FlatFileTree | null | undefined,
  deleted: string[] = [],
): FlatFileTree => {
  const next: FlatFileTree = { ...current, ...(changed ?? {}) };

  for (const path of deleted) {
    if (path === ".aivex") continue;
    delete next[path];
    for (const key of Object.keys(next)) {
      if (key.startsWith(path + "/")) delete next[key];
    }
  }

  return next;
};
