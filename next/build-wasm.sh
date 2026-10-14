#!/bin/sh
set -eu
export LANG=C.UTF-8

# WebAssembly is a 32-bit little-endian platform that shares calling
# conventions and data alignment with x86, so windows-x86-msvc's arch header
# works as the baseline for the wasm32-unknown-emscripten target.
cp ghostpdl/arch/windows-x86-msvc.h ghostpdl/arch/wasm32-unknown-emscripten.h

cd ghostpdl
export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct HEAD)
NOCONFIGURE=1 ./autogen.sh
# -Wno-error=incompatible-pointer-types keeps the build compatible with
# Ghostscript's upstream build, where this diagnostic is a warning. Clang
# promoted it to a default error in LLVM commit
# b24769855d97697de08e2296a548c033f193caf4 (PR #157364, 2025-09-15, first
# released in LLVM 22.1.0), and emsdk bundles a clang past that point.
emconfigure ./configure \
  CCAUX=gcc \
  CFLAGS='-g -Wno-error=incompatible-pointer-types' \
  LDFLAGS='-g' \
  --host=wasm32-unknown-emscripten \
  --with-arch_h=arch/wasm32-unknown-emscripten.h
emmake make --jobs=`nproc` libgs
cd ..

em++ -g --profiling-funcs \
  -Ighostpdl/psi -Ighostpdl/base -Ighostpdl/devices -Ighostpdl/obj \
  -lembind \
  -s STACK_SIZE=8388608 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s ASYNCIFY=1 \
  -s ASYNCIFY_STACK_SIZE=1048576 \
  -s MODULARIZE=1 \
  -s EXPORT_ES6=1 \
  -s EXPORTED_RUNTIME_METHODS=FS \
  --emit-tsd gs.d.ts \
  -o next/gs.js \
  next/bindings.cpp ghostpdl/bin/gs.a

cd ghostpdl
git reset --hard
git clean -fd
