// @ts-check

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
// // Use context mutex to provide thread-safe time
// cmsBool _cmsGetTime(struct tm* ptr_time)
// {
// #ifdef __EMSCRIPTEN__
//     if (ptr_time) {
//         memset(ptr_time, 0, sizeof(struct tm));  // 安全な初期化
//     }
//     return TRUE;
// #else
//     struct tm* t;
// #if defined(HAVE_GMTIME_R) || defined(HAVE__GMTIME64_S)
//     struct tm tm;
// #endif

//     time_t now = time(NULL);

// #ifdef HAVE_GMTIME_R
//     t = gmtime_r(&now, &tm);
// #elif defined(HAVE__GMTIME64_S)
//     t = _gmtime64_s(&tm, &now) == 0 ? &tm : NULL;
// #else
//     _cmsEnterCriticalSectionPrimitive(&_cmsContextPoolHeadMutex);
//     t = gmtime(&now);
//     _cmsLeaveCriticalSectionPrimitive(&_cmsContextPoolHeadMutex);
// #endif

//     if (t == NULL)
//         return FALSE;
//     else {
//         *ptr_time = *t;
//         return TRUE;
//     }
// #endif
// }
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

