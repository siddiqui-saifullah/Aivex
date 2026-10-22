#!/usr/bin/env bash
# Rebuilds public/cxx/sysroot.tar.gz (C++ headers + libraries with exception
# support) for the in-browser C++ compiler. The compiler itself comes from the
# @yowasp/clang npm package (scripts/prepare-cxx.mjs copies it into public/).
# Needs: git, node, and `npm install` done in frontend/.
set -euo pipefail
LLVM_TAG=llvmorg-21.1.4 # must match the LLVM release of @yowasp/clang
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="${1:-$(mktemp -d)}"

git clone --depth 1 --branch "$LLVM_TAG" --filter=blob:none --sparse \
  https://github.com/llvm/llvm-project.git "$WORK/llvm-project"
git -C "$WORK/llvm-project" sparse-checkout set \
  libcxx/src libcxxabi libunwind libc/shared libc/src/__support libc/hdr libc/include libc/config
node "$HERE/build-sysroot.mjs" "$WORK/llvm-project"
