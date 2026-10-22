// Prepares public/cxx for the in-browser C++ compiler (runs before `vite`
// and `vite build`). The compiler is too big for git (~100 MB), so it is
// taken from the @yowasp/clang package (LLVM/Clang compiled to WebAssembly):
//   clang.js            the package's loader, patched to take its files from us
//   llvm.core*.wasm.gz  the compiler, gzipped (~22 MB instead of 73 MB)
//   stdc++.pch.gz       <bits/stdc++.h> precompiled: parsing the C++ standard
//                       headers takes ~5 s in the browser, loading this ~0.2 s
//   manifest.json       version (for cache busting) and download sizes
// sysroot.tar.gz (headers + libraries) is built by tools/cxx/build.sh.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";

const FRONTEND = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const PKG = path.join(FRONTEND, "node_modules/@yowasp/clang");
const OUT = path.join(FRONTEND, "public/cxx");
const CORES = ["llvm.core.wasm", "llvm.core2.wasm", "llvm.core3.wasm", "llvm.core4.wasm"];

const flags = JSON.parse(fs.readFileSync(path.join(FRONTEND, "src/runtime/cxx/flags.json"), "utf8"));
const sysrootGz = fs.readFileSync(path.join(OUT, "sysroot.tar.gz"));
const { version: clangVersion } = JSON.parse(fs.readFileSync(path.join(PKG, "package.json"), "utf8"));

const version = crypto
  .createHash("sha256")
  .update(clangVersion)
  .update(sysrootGz)
  .update(JSON.stringify(flags))
  .update(fs.readFileSync(new URL(import.meta.url)))
  .digest("hex")
  .slice(0, 12);

const manifestPath = path.join(OUT, "manifest.json");
const outputs = ["clang.js", "stdc++.pch.gz", ...CORES.map((f) => `${f}.gz`)];
try {
  const previous = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (previous.version === version && outputs.every((f) => fs.existsSync(path.join(OUT, f)))) {
    console.log(`C++ compiler is up to date (${version})`);
    process.exit(0);
  }
} catch {
  /* first run */
}
const started = Date.now();

// The loader fetches its files relative to itself; route them through
// setResources() instead so the page controls caching and progress.
const patch = (source, from, to) => {
  if (!source.includes(from)) throw new Error(`@yowasp/clang ${clangVersion}: patch target not found: ${from.slice(0, 60)}`);
  return source.replace(from, to);
};
let loader = fs.readFileSync(path.join(PKG, "gen/bundle.js"), "utf8");
loader = patch(loader, "var modules = async (fetch3) => ({", "var aivexResources = null;\nfunction setResources(resources) {\n  aivexResources = resources;\n}\nvar modules = async () => aivexResources.modules();\nvar unusedModules = async (fetch3) => ({");
loader = patch(loader, "var filesystem = async (fetch3) => ({", "var filesystem = async () => aivexResources.filesystem(unpackTarFilesystem);\nvar unusedFilesystem = async (fetch3) => ({");
loader = patch(loader, "export {\n  Exit,", "export {\n  setResources,\n  Exit,");
fs.writeFileSync(path.join(OUT, "clang.js"), `// @yowasp/clang ${clangVersion} (ISC license), patched by scripts/prepare-cxx.mjs\n${loader}`);

const sizes = { "sysroot.tar.gz": sysrootGz.length };
for (const core of CORES) {
  const gz = zlib.gzipSync(fs.readFileSync(path.join(PKG, "gen", core)), { level: 9 });
  fs.writeFileSync(path.join(OUT, `${core}.gz`), gz);
  sizes[`${core}.gz`] = gz.length;
}

// Precompile <bits/stdc++.h> with the exact flags programs are compiled with
const { setResources, commands } = await import(pathToFileURL(path.join(OUT, "clang.js")).href);
setResources({
  modules: async () =>
    Object.fromEntries(
      await Promise.all(CORES.map(async (f) => [f, await WebAssembly.compile(fs.readFileSync(path.join(PKG, "gen", f)))])),
    ),
  filesystem: async (unpackTar) => {
    const tar = zlib.gunzipSync(sysrootGz);
    return { usr: unpackTar(tar.buffer.slice(tar.byteOffset, tar.byteOffset + tar.byteLength)) };
  },
});
let log = "";
const capture = (bytes) => bytes && (log += new TextDecoder().decode(bytes));
let out;
try {
  out = await commands["clang++"](
    [...flags.compile, "-x", "c++-header", flags.pchHeader, "-o", "/out/stdc++.pch"],
    { out: {} },
    { stdout: capture, stderr: capture, fetchProgress: () => {} },
  );
} catch (err) {
  throw new Error(`Precompiling <bits/stdc++.h> failed: ${err.message}\n${log}`);
}
const pch = zlib.gzipSync(out.out["stdc++.pch"], { level: 9 });
fs.writeFileSync(path.join(OUT, "stdc++.pch.gz"), pch);
sizes["stdc++.pch.gz"] = pch.length;

fs.writeFileSync(manifestPath, `${JSON.stringify({ version, clang: clangVersion, sizes }, null, 2)}\n`);
console.log(`C++ compiler ready (${version}) in ${((Date.now() - started) / 1000).toFixed(0)} s`);
