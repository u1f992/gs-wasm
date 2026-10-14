FROM emscripten/emsdk:6.0.12

# clang-tidy parses wasm/ against the emsdk sysroot headers, so it must be the
# same major version as the clang bundled in this emsdk (24). Ubuntu noble ships
# clang-tidy 18, which crashes on those headers, and apt.llvm.org provides 24
# only through the snapshot suite llvm-toolchain-noble.
RUN wget -qO- https://apt.llvm.org/llvm-snapshot.gpg.key > /etc/apt/trusted.gpg.d/apt.llvm.org.asc \
  && echo 'deb http://apt.llvm.org/noble/ llvm-toolchain-noble main' > /etc/apt/sources.list.d/apt.llvm.org.list \
  && apt-get update \
  && apt-get install --yes --no-install-recommends autoconf automake clang-format-24 clang-tidy-24 \
  && ln -s /usr/bin/clang-format-24 /usr/local/bin/clang-format \
  && ln -s /usr/bin/clang-tidy-24 /usr/local/bin/clang-tidy \
  && rm -rf /var/lib/apt/lists/*
