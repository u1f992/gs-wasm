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

{
  /*
   * Fix incompatible pointer types in gdevmpla.c for Emscripten 4.0.15+
   *
   * Emscripten 4.0.15 enforces stricter type checking where `size_t` and
   * `intptr_t` cannot be implicitly cast to `int64_t *`. We need to cast
   * `nbytes` to `int64_t *` explicitly when calling `check_64bit_multiply`.
   *
   * This patches two occurrences in base/gdevmpla.c:
   * - Line 1962: (size_t *)&nbytes -> (int64_t *)&nbytes
   * - Line 2022: &nbytes -> (int64_t *)&nbytes
   */
  const filePath = path.resolve(__dirname, "ghostpdl/base/gdevmpla.c");
  let lines = fs.readFileSync(filePath, "utf8").split("\n");

  // Fix line 1962
  if (
    lines[1961] ===
    "        if (check_64bit_multiply(height, chunky_sraster, (size_t *)&nbytes) != 0)"
  ) {
    lines[1961] =
      "        if (check_64bit_multiply(height, chunky_sraster, (int64_t *)&nbytes) != 0)";
  }

  // Fix line 2022
  if (
    lines[2021] ===
    "        if (check_64bit_multiply(chunky_t_height, chunky_t_raster, &nbytes) != 0)"
  ) {
    lines[2021] =
      "        if (check_64bit_multiply(chunky_t_height, chunky_t_raster, (int64_t *)&nbytes) != 0)";
  }

  fs.writeFileSync(filePath, lines.join("\n"), "utf8");
}
