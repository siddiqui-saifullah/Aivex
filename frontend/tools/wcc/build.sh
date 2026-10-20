#!/usr/bin/env bash
# Rebuilds the in-browser C compiler (public/wcc) from XCC (MIT, github.com/tyfkda/xcc).
# Needs: git, a C compiler (gcc/clang), make, llvm-ar, node.
set -euo pipefail
XCC_COMMIT=9eea241c1331d54730b9173cfb11c4dea7c893a4
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-$(mktemp -d)}"

git clone https://github.com/tyfkda/xcc.git "$WORK/xcc"
cd "$WORK/xcc"
git checkout "$XCC_COMMIT"
# Aivex changes: backward goto support in the wasm backend; glibc-compatible
# printf/scanf/strtod; prompt flushing before reading stdin; subnormal frexp;
# missing libc (C99 math + float variants, <time.h> tm/strftime/clock,
# <signal.h>, sleep, div, gets/rewind/setvbuf, <conio.h> basics)
git apply "$HERE/xcc-libc.patch"
make wcc          # native cross compiler + wasm libc
make wcc-gen2     # the compiler compiled to WebAssembly (cc.wasm)
node "$HERE/pack.mjs" "$WORK/xcc"
