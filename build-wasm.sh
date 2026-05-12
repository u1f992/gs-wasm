#!/bin/sh
set -eu
export LANG=C.UTF-8

node patch.js

cd ghostpdl
export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct HEAD)
NOCONFIGURE=1 ./autogen.sh
# -Wno-error=incompatible-pointer-types keeps the build compatible with
# Ghostscript's upstream build, where this diagnostic is a warning. Clang
# promoted it to a default error in LLVM commit
# b24769855d97697de08e2296a548c033f193caf4 (PR #157364, 2025-09-15, first
# released in LLVM 22.1.0), and emsdk 4.0.15 ships a clang past that point.
emconfigure ./configure \
  CCAUX=gcc \
  CFLAGS='-g -Wno-error=incompatible-pointer-types' \
  LDFLAGS='-g' \
  --host=wasm32-unknown-emscripten \
  --with-arch_h=arch/wasm32-unknown-emscripten.h
rm -f a.wasm
emmake make \
  --jobs=`nproc` \
  XE='.js' \
  GS_LDFLAGS='--profiling-funcs -s STACK_SIZE=8388608 -s ALLOW_MEMORY_GROWTH=1 -s MODULARIZE=1 -s EXPORT_ES6=1 -s FORCE_FILESYSTEM=1 -s INVOKE_RUN=0 -s EXPORTED_RUNTIME_METHODS=["FS","callMain"]'

git reset --hard
git clean -fd
