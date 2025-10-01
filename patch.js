// @ts-check

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
{
  /*
   * To support WebAssembly builds, we copy the existing
   * `windows-x86-msvc.h` file to `wasm32-unknown-emscripten.h`.
   *
   * WebAssembly is a 32-bit little-endian platform and shares many
   * architectural characteristics with x86, particularly in calling conventions
   * and data alignment. In practice, the platform-specific configuration for
   * `windows-x86-msvc` serves as a suitable baseline for WebAssembly targets
   * compiled with Emscripten.
   */
  const src = path.resolve(__dirname, "ghostpdl/arch/windows-x86-msvc.h");
  const dest = path.resolve(
    __dirname,
    "ghostpdl/arch/wasm32-unknown-emscripten.h",
  );
  fs.copyFileSync(src, dest);
}
