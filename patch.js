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

{
  /*
   * The callback type `gs_fapi_get_server_param_callback` was previously defined
   * to return an `int`, but in practice, all calls to this function pointer
   * ignore its return value. For instance, in both `gs_fapi_passfont` and
   * `gs_fapi_find_server`, the callback is invoked for its side effects only,
   * and the return value is neither stored nor used. Moreover, the primary
   * implementation of this callback, `pdfi_get_server_param`, is defined with
   * a `void` return type, not `int`.
   *
   * While this mismatch between the typedef and the actual implementation is
   * tolerated on native platforms such as x86 due to relaxed calling conventions
   * and ABI behavior, it causes a critical problem when targeting WebAssembly.
   * In WebAssembly, all function pointer invocations must strictly match their
   * declared signature. Any mismatch in argument types or return type results in
   * a runtime failure, specifically the error `RuntimeError: null function or function signature mismatch`.
   *
   * To resolve this, we align the typedef with both its actual usage and
   * implementation by changing the return type from `int` to `void`. This change
   * eliminates the signature mismatch and ensures correct behavior under the
   * WebAssembly runtime model.
   */
  const target = path.resolve(__dirname, "ghostpdl/base/gxfapi.h");
  const lines = fs.readFileSync(target, { encoding: "utf-8" }).split(/\r?\n/);
  const targetLineNumber = 397;
  const expectedLine =
    "typedef int (*gs_fapi_get_server_param_callback) (gs_fapi_server *I,";
  if (lines[targetLineNumber] !== expectedLine) {
    throw new Error("line 398 does not match.");
  }
  lines[targetLineNumber] =
    "typedef void (*gs_fapi_get_server_param_callback) (gs_fapi_server *I,";
  fs.writeFileSync(target, lines.join("\n"), { encoding: "utf-8" });
}
