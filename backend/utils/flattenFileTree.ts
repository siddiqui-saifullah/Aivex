/**
 * Flatten the AI's nested WebContainer-style tree into `{ "src/a.js": "..." }`.
 * Accepts `{ file: { contents } }`, `{ contents }`, plain strings and
 * `directory` wrappers.
 */
export const flattenFileTree = (
    tree: unknown,
    basePath = "",
    out: Record<string, string> = {},
): Record<string, string> => {
    if (!tree || typeof tree !== "object") return out;

    for (const [key, value] of Object.entries(tree as Record<string, unknown>)) {
        if (key === "directory" && value && typeof value === "object") {
            flattenFileTree(value, basePath, out);
            continue;
        }

        const path = basePath ? `${basePath}/${key}` : key;
        const node = value as { file?: { contents?: unknown }; contents?: unknown } | string | null;

        if (typeof node === "string") {
            out[path] = node;
        } else if (node && typeof node === "object") {
            if (typeof node.file?.contents === "string") {
                out[path] = node.file.contents;
            } else if (typeof node.contents === "string") {
                out[path] = node.contents;
            } else {
                flattenFileTree(node, path, out);
            }
        }
    }

    return out;
};
