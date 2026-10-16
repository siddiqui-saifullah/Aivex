// Packs a built XCC tree into the files the browser C runner loads:
//   public/wcc/cc.wasm       the C compiler (itself compiled to WebAssembly)
//   public/wcc/sysroot.json  headers and the wasm libc ({ path: base64 })
// Usage: node tools/wcc/pack.mjs <path-to-xcc>
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const xcc = process.argv[2];
if (!xcc) {
  console.error("usage: node tools/wcc/pack.mjs <path-to-xcc>");
  process.exit(1);
}
const outDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../public/wcc");
fs.mkdirSync(outDir, { recursive: true });

const list = JSON.parse(fs.readFileSync(path.join(xcc, "src/wcc/www/lib_list.json"), "utf8"));
const files = {};
const walk = (node, dir) => {
  for (const [name, value] of Object.entries(node)) {
    const target = dir ? `${dir}/${name}` : name;
    if (typeof value === "string") {
      if (target === "usr/bin/cc") continue; // shipped separately as cc.wasm
      files[target.replace(/^usr\//, "")] = fs.readFileSync(path.join(xcc, value)).toString("base64");
    } else {
      walk(value, target);
    }
  }
};
walk(list, "");

fs.copyFileSync(path.join(xcc, "cc.wasm"), path.join(outDir, "cc.wasm"));
fs.writeFileSync(path.join(outDir, "sysroot.json"), JSON.stringify(files));
console.log(`packed ${Object.keys(files).length} files into ${outDir}`);
