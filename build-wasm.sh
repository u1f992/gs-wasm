#!/bin/sh
set -eu
export LANG=C.UTF-8

node patch.js

cd ghostpdl
NOCONFIGURE=1 ./autogen.sh
emconfigure ./configure \
  CCAUX=gcc \
  CFLAGS='-g' \
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
