MAKEFLAGS += --jobs=$(shell nproc)

export LANG := C.UTF-8
export SOURCE_DATE_EPOCH := $(shell git -C ghostpdl log -1 --format=%ct HEAD)

ARCH_H := ghostpdl/arch/wasm32-unknown-emscripten.h
LIBGS := ghostpdl/bin/gs.a
OUTPUTS := src/gs.js src/gs.wasm src/gs.d.ts
SYSROOT := /emsdk/upstream/emscripten/cache/sysroot/include
TIDY_FLAGS := --checks='clang-analyzer-*,bugprone-*,modernize-*,performance-*' \
  --header-filter='wasm/.*'
TIDY_COMPILE_FLAGS := -std=c++17 \
  -Iwasm -Ighostpdl/psi -Ighostpdl/base -Ighostpdl/devices -Ighostpdl/obj \
  -isystem $(SYSROOT)/c++/v1 \
  -isystem $(SYSROOT) \
  -isystem $(SYSROOT)/compat \
  --target=wasm32-unknown-emscripten

.PHONY: all clean format tidy
.DELETE_ON_ERROR:

all: $(OUTPUTS)

format:
	clang-format -i $(wildcard wasm/*.cpp) $(wildcard wasm/*.h)

tidy: ghostpdl/obj/arch.h
	clang-tidy $(TIDY_FLAGS) $(wildcard wasm/*.cpp) -- $(TIDY_COMPILE_FLAGS)

ghostpdl/obj/arch.h: ghostpdl/Makefile
	cd ghostpdl && emmake $(MAKE) obj/arch.h

$(OUTPUTS) &: $(LIBGS) $(wildcard wasm/*.cpp) $(wildcard wasm/*.h)
	em++ -O2 \
	  -std=c++17 \
	  -Iwasm -Ighostpdl/psi -Ighostpdl/base -Ighostpdl/devices -Ighostpdl/obj \
	  -lembind \
	  -s STACK_SIZE=8388608 \
	  -s ALLOW_MEMORY_GROWTH=1 \
	  -s ASYNCIFY=1 \
	  -s ASYNCIFY_STACK_SIZE=1048576 \
	  -s MODULARIZE=1 \
	  -s EXPORT_ES6=1 \
	  -s EXPORTED_FUNCTIONS=_malloc,_free \
	  -s EXPORTED_RUNTIME_METHODS=FS,HEAPU8 \
	  --emit-tsd gs.d.ts \
	  -o src/gs.js \
	  $(wildcard wasm/*.cpp) $(LIBGS)

$(LIBGS): ghostpdl/Makefile FORCE
	cd ghostpdl && emmake $(MAKE) libgs

# WebAssembly is a 32-bit little-endian platform that shares calling
# conventions and data alignment with x86, so windows-x86-msvc's arch header
# works as the baseline for the wasm32-unknown-emscripten target.
$(ARCH_H): ghostpdl/arch/windows-x86-msvc.h
	cp $< $@

ghostpdl/configure: ghostpdl/configure.ac ghostpdl/autogen.sh
	cd ghostpdl && NOCONFIGURE=1 ./autogen.sh

# -Wno-error=incompatible-pointer-types keeps the build compatible with
# Ghostscript's upstream build, where this diagnostic is a warning. Clang
# promoted it to a default error in LLVM commit
# b24769855d97697de08e2296a548c033f193caf4 (PR #157364, 2025-09-15, first
# released in LLVM 22.1.0), and emsdk bundles a clang past that point.
ghostpdl/Makefile: ghostpdl/configure $(ARCH_H)
	cd ghostpdl && emconfigure ./configure \
	  CCAUX=gcc \
	  CFLAGS='-O2 -Wno-error=incompatible-pointer-types' \
	  LDFLAGS='-O2' \
	  --host=wasm32-unknown-emscripten \
	  --with-arch_h=arch/wasm32-unknown-emscripten.h

FORCE:

clean:
	rm -f $(OUTPUTS)
	git -C ghostpdl reset --hard
	git -C ghostpdl clean -fdx
