import { strToU8, zip } from "fflate";
import type { FlatFileTree } from "../types";

/** Zip the project's files (without the internal .aivex marker) and download it. */
export const downloadProjectZip = (files: FlatFileTree, projectName: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const entries: Record<string, Uint8Array> = {};
    for (const [path, contents] of Object.entries(files)) {
      if (path === ".aivex") continue;
      entries[path] = strToU8(contents ?? "");
    }

    zip(entries, { level: 6 }, (err, data) => {
      if (err) return reject(err);

      const blob = new Blob([data as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName.replace(/[^\w.-]+/g, "-") || "project"}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      resolve();
    });
  });
