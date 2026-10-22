// Builds public/cxx/sysroot.tar.gz: the headers and libraries the in-browser
// C++ compiler needs. Usage: node tools/cxx/build-sysroot.mjs <llvm-project>
//
// @yowasp/clang ships a WASI sysroot whose libc++/libc++abi were built
// without exceptions, so try/catch (and every library function that throws)
// can't link. This rebuilds libc++, libc++abi and libunwind from the same
// LLVM release with WebAssembly exceptions, using @yowasp/clang itself, and
// drops what a wasm32 program never uses (CUDA, x86/ARM intrinsics, ...).
import { commands } from "@yowasp/clang";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const FRONTEND = path.resolve(HERE, "../..");
const LLVM = path.resolve(process.argv[2] ?? "");
if (!fs.existsSync(`${LLVM}/libcxx/src`)) throw new Error("usage: build-sysroot.mjs <llvm-project checkout>");

// ---- the shipped sysroot (mounted by clang at /usr) ----

const readTar = (buffer) => {
  const files = new Map();
  for (let offset = 0; offset + 512 <= buffer.length; ) {
    const header = buffer.subarray(offset, offset + 512);
    const name = header.subarray(0, 100).toString("latin1").replace(/\0.*$/s, "");
    if (!name) break;
    const size = parseInt(header.subarray(124, 136).toString("latin1").replace(/\0.*$/s, "").trim() || "0", 8);
    const type = String.fromCharCode(header[156]);
    if (type === "0" || type === "\0") files.set(name, buffer.subarray(offset + 512, offset + 512 + size));
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
};

// ustar with directory entries first: the tar reader in @yowasp/clang needs
// each directory before its files and only reads the 100-byte name field
const writeTar = (files) => {
  const dirs = new Set();
  for (const name of files.keys()) {
    const parts = name.split("/");
    for (let i = 1; i < parts.length; i++) dirs.add(`${parts.slice(0, i).join("/")}/`);
  }
  const header = (name, size, type) => {
    if (name.length > 100) throw new Error(`path too long for tar: ${name}`);
    const h = Buffer.alloc(512);
    h.write(name, 0, "latin1");
    h.write(type === "5" ? "0000755\0" : "0000644\0", 100);
    h.write("0000000\0", 108);
    h.write("0000000\0", 116);
    h.write(`${size.toString(8).padStart(11, "0")}\0`, 124);
    h.write("00000000000\0", 136);
    h.write("        ", 148);
    h.write(type, 156);
    h.write("ustar\0" + "00", 257);
    let sum = 0;
    for (const b of h) sum += b;
    h.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148);
    return h;
  };
  const chunks = [];
  for (const dir of [...dirs].sort()) chunks.push(header(dir.slice(0, -1), 0, "5"));
  for (const [name, data] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    chunks.push(header(name, data.length, "0"), data, Buffer.alloc((512 - (data.length % 512)) % 512));
  }
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
};

const shipped = readTar(fs.readFileSync(path.join(FRONTEND, "node_modules/@yowasp/clang/gen/llvm-resources.tar")));

// ---- runtime libraries with exceptions ----

const SHARED = [
  "--target=wasm32-wasip1", "-fwasm-exceptions", "-Os", "-DNDEBUG", "-ffunction-sections", "-fdata-sections",
  "-D_FILE_OFFSET_BITS=64", "-D_LARGEFILE_SOURCE", "-D_LIBCPP_HAS_NO_PRAGMA_SYSTEM_HEADER",
  "-D__STDC_CONSTANT_MACROS", "-D__STDC_FORMAT_MACROS", "-D__STDC_LIMIT_MACROS", "-w",
];
const UNWIND = [
  ...SHARED, "-I/src/libunwind/include", "-funwind-tables", "-D_DEBUG", "-UNDEBUG",
  "-D_LIBUNWIND_IS_NATIVE_ONLY", "-D_LIBUNWIND_HAS_NO_THREADS", "-D_LIBUNWIND_HIDE_SYMBOLS", "-fno-rtti",
];
const CXXABI = [
  ...SHARED, "-std=c++23", "-DHAVE___CXA_THREAD_ATEXIT_IMPL", "-DLIBCXX_BUILDING_LIBCXXABI",
  "-D_LIBCPP_BUILDING_LIBRARY", "-D_LIBCXXABI_BUILDING_LIBRARY", "-D_LIBCXXABI_HAS_NO_THREADS",
  "-I/src/libunwind/include", "-I/src/libcxx/src", "-I/src/libcxxabi/include",
  "-fvisibility-inlines-hidden", "-fstrict-aliasing", "-funwind-tables", "-D_DEBUG", "-fsized-deallocation",
];
const CXX = [
  ...SHARED, "-std=c++23", "-DLIBCXX_BUILDING_LIBCXXABI", "-D_LIBCPP_BUILDING_LIBRARY",
  "-D_LIBCPP_REMOVE_TRANSITIVE_INCLUDES", "-I/src/libcxx/src", "-I/src/libcxxabi/include", "-I/src/libc",
  "-faligned-allocation", "-fvisibility-inlines-hidden", "-fvisibility=hidden", "-fsized-deallocation",
];

const LIBS = {
  "libunwind.a": [
    ...["libunwind.cpp", "Unwind-EHABI.cpp", "Unwind-seh.cpp"].map((f) => [`libunwind/src/${f}`, [...UNWIND, "-std=c++17", "-fno-exceptions"]]),
    ...["UnwindLevel1.c", "UnwindLevel1-gcc-ext.c", "Unwind-sjlj.c", "Unwind-wasm.c"].map((f) => [`libunwind/src/${f}`, [...UNWIND, "-std=c99", "-fexceptions"]]),
  ],
  "libc++abi.a": [
    "cxa_aux_runtime", "cxa_default_handlers", "cxa_demangle", "cxa_exception_storage", "cxa_guard", "cxa_handlers",
    "cxa_vector", "cxa_virtual", "stdlib_exception", "stdlib_stdexcept", "stdlib_typeinfo", "abort_message",
    "fallback_malloc", "private_typeinfo", "stdlib_new_delete", "cxa_exception", "cxa_personality",
  ].map((f) => [`libcxxabi/src/${f}.cpp`, CXXABI]),
  "libc++.a": [
    "algorithm", "any", "bind", "call_once", "charconv", "chrono", "error_category", "exception", "expected",
    "filesystem/filesystem_clock", "filesystem/filesystem_error", "filesystem/path", "functional", "hash", "memory",
    "memory_resource", "new_handler", "new_helpers", "optional", "print", "random_shuffle", "ryu/d2fixed", "ryu/d2s",
    "ryu/f2s", "stdexcept", "string", "system_error", "typeinfo", "valarray", "variant", "vector", "verbose_abort",
    "random", "fstream", "ios", "ios.instantiations", "iostream", "locale", "ostream", "regex", "strstream",
    "filesystem/directory_entry", "filesystem/directory_iterator", "filesystem/operations",
  ].map((f) => [`libcxx/src/${f}.cpp`, CXX]),
};

// The in-wasm filesystem doesn't resolve ".." in #include paths: make them absolute
const readSourceTree = (dir) => {
  const tree = {};
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${entry.name}`;
    if (entry.isDirectory()) tree[entry.name] = readSourceTree(p);
    else if (/\.(c|cpp|h|hpp|def|inc|ipp)$|^[^.]*$/.test(entry.name)) {
      const text = fs.readFileSync(p, "latin1").replace(
        /(#\s*include\s*")(\.\.\/[^"]+)"/g,
        (_, pre, rel) => `${pre}${path.resolve(dir, rel).replace(LLVM, "/src")}"`,
      );
      tree[entry.name] = Buffer.from(text, "latin1");
    }
  }
  return tree;
};
const src = {
  libcxx: { src: readSourceTree(`${LLVM}/libcxx/src`) },
  libcxxabi: { src: readSourceTree(`${LLVM}/libcxxabi/src`), include: readSourceTree(`${LLVM}/libcxxabi/include`) },
  libunwind: { src: readSourceTree(`${LLVM}/libunwind/src`), include: readSourceTree(`${LLVM}/libunwind/include`) },
  libc: Object.fromEntries(["shared", "src", "hdr", "include", "config"].map((d) => [d, readSourceTree(`${LLVM}/libc/${d}`)])),
};

const quiet = { fetchProgress: () => {} };
const compile = async (file, flags, extraFiles = {}) => {
  let log = "";
  const capture = (bytes) => bytes && (log += new TextDecoder().decode(bytes));
  const driver = file.endsWith(".c") ? "clang" : "clang++";
  try {
    const out = await commands[driver]([...flags, "-c", `/src/${file}`, "-o", "/out/a.o"], { src: { ...src, ...extraFiles }, out: {} }, {
      ...quiet, stdout: capture, stderr: capture,
    });
    return out.out["a.o"];
  } catch (err) {
    throw new Error(`${file}: ${err.message}\n${log}`);
  }
};

const archive = async (name, objects) => {
  const files = Object.fromEntries(objects.map((o, i) => [`${i}-${path.basename(o.file)}.o`, o.data]));
  const out = await commands.ar(["crs", `/w/${name}`, ...Object.keys(files).map((f) => `/w/${f}`)], { w: files }, quiet);
  return out.w[name];
};

await commands.clang(null, {}, quiet); // fetch the toolchain once
const built = new Map();
for (const [lib, sources] of Object.entries(LIBS)) {
  const objects = [];
  for (const [file, flags] of sources) objects.push({ file, data: await compile(file, flags) });
  built.set(lib, await archive(lib, objects));
  console.log(`${lib}: ${objects.length} objects`);
}
const uncaught = await compile("aivex/uncaught.cpp", ["--target=wasm32-wasip1", "-O2", "-fwasm-exceptions"], {
  aivex: { "uncaught.cpp": fs.readFileSync(`${HERE}/uncaught.cpp`) },
});

// ---- trimmed sysroot ----

const DROP = [
  /^share\//,
  /^include\/(orc|fuzzer|sanitizer|profile|xray|cuda_wrappers|openmp_wrappers|ppc_wrappers|llvm_offload_wrappers|hlsl|llvm_libc_wrappers|zos_wrappers)\//,
  /^include\/c\+\+\/v1\/__cxx03\//,
  /^include\/[^/]*(intrin|cuda|hip|spirv|opencl|altivec|arm_|armintr|arm64intr|avx|amx|riscv|sifive|andes|hexagon|hvx|htm|s390|msa|lsx|lasx|velintrin|mm3dnow|cpuid|cet|mm_malloc|hlsl|gpuintrin|ptx|nvptx|amdgpu)[^/]*\.h$/,
  /^lib\/wasm32-unknown-wasip1\/libclang_rt\.profile\.a$/,
  /^lib\/wasm32-wasip1\/(libc\+\+\.modules\.json|libc-printscan-.*|libwasi-emulated-.*|crt1-reactor\.o)$/,
];
const sysroot = new Map();
for (const [name, data] of shipped) if (!DROP.some((re) => re.test(name))) sysroot.set(name, data);
for (const [lib, data] of built) sysroot.set(`lib/wasm32-wasip1/${lib}`, data);
sysroot.set("lib/wasm32-wasip1/aivex-uncaught.o", uncaught);
sysroot.set("include/c++/v1/bits/stdc++.h", fs.readFileSync(`${HERE}/stdc++.h`));

const tar = writeTar(sysroot);
const gz = zlib.gzipSync(tar, { level: 9 });
fs.mkdirSync(path.join(FRONTEND, "public/cxx"), { recursive: true });
fs.writeFileSync(path.join(FRONTEND, "public/cxx/sysroot.tar.gz"), gz);
console.log(`sysroot: ${sysroot.size} files, ${(tar.length / 1e6).toFixed(1)} MB, ${(gz.length / 1e6).toFixed(1)} MB gzipped`);
