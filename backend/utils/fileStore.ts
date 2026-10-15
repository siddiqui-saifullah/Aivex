/**
 * File trees travel over the API as a flat `{ "src/a.js": "<contents>" }`
 * object, but are stored as `[{ path, contents }]`. File paths almost always
 * contain "." and MongoDB discourages (and several tools reject) dotted keys.
 *
 * `fromStoredFiles` also accepts the legacy object format, so projects saved
 * before this change keep loading without a migration.
 */
export interface StoredFile {
    path: string;
    contents: string;
}

export type FlatFiles = Record<string, string>;

export const toStoredFiles = (files: FlatFiles | null | undefined): StoredFile[] =>
    Object.entries(files ?? {}).map(([path, contents]) => ({
        path,
        contents: typeof contents === "string" ? contents : String(contents ?? ""),
    }));

export const fromStoredFiles = (stored: unknown): FlatFiles => {
    if (Array.isArray(stored)) {
        const out: FlatFiles = {};
        for (const entry of stored) {
            if (entry && typeof entry.path === "string") {
                out[entry.path] = typeof entry.contents === "string" ? entry.contents : "";
            }
        }
        return out;
    }

    // Legacy: plain object keyed by path
    if (stored && typeof stored === "object") {
        return { ...(stored as FlatFiles) };
    }

    return {};
};
