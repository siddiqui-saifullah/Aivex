import type { FlatFileTree, WebContainerTree } from "../types";

/** Convert a flat `{ "src/a.js": "..." }` map into a WebContainer FileSystemTree. */
export function toWebContainerTree(flatTree: FlatFileTree): WebContainerTree {
  const root: WebContainerTree = {};

  for (const [path, contents] of Object.entries(flatTree)) {
    const parts = path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;

      if (isFile) {
        current[part] = {
          file: {
            contents: contents,
          },
        };
      } else {
        const existing = current[part];
        if (!existing || !("directory" in existing)) {
          current[part] = { directory: {} };
        }
        current = (current[part] as { directory: WebContainerTree }).directory;
      }
    }
  }

  return root;
}
