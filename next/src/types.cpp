#include "types.h"

#include <emscripten/bind.h>

EMSCRIPTEN_BINDINGS(types) {
  emscripten::register_type<ArgList>("string[]");
  emscripten::register_type<StdioCallback>(
      "StdioCallback",
      "((buf: Uint8Array, callerHandle: unknown) => number | Promise<number>) | null");
  emscripten::register_type<PollCallback>(
      "PollCallback", "((callerHandle: unknown) => number | Promise<number>) | null");
  emscripten::register_type<CallerHandle>("unknown");
  emscripten::register_type<CalloutCallback>(
      "CalloutCallback",
      "(deviceName: string, id: number, size: number, data: Uint8Array) => number | "
      "Promise<number>");
  emscripten::register_type<DisplayRectangle>(
      "DisplayRectangle",
      "{ memory: number; ox?: number; oy?: number; raster?: number; plane_raster?: number; "
      "x: number; y: number; w: number; h: number }");
  emscripten::register_type<DisplayCallback>(
      "DisplayCallback",
      "{ "
      "display_open?: (device: number) => number | Promise<number>; "
      "display_preclose?: (device: number) => number | Promise<number>; "
      "display_close?: (device: number) => number | Promise<number>; "
      "display_presize?: (device: number, width: number, height: number, raster: number, "
      "format: number) => number | Promise<number>; "
      "display_size?: (device: number, width: number, height: number, raster: number, "
      "format: number, pimage: number) => number | Promise<number>; "
      "display_sync?: (device: number) => number | Promise<number>; "
      "display_page?: (device: number, copies: number, flush: number) => number | "
      "Promise<number>; "
      "display_update?: (device: number, x: number, y: number, w: number, h: number) => "
      "number | Promise<number>; "
      "display_memalloc?: (device: number, size: number) => number | Promise<number>; "
      "display_memfree?: (device: number, mem: number) => number | Promise<number>; "
      "display_separation?: (device: number, component: number, componentName: string, "
      "c: number, m: number, y: number, k: number) => number | Promise<number>; "
      "display_adjust_band_height?: (device: number, bandheight: number) => number | "
      "Promise<number>; "
      "display_rectangle_request?: (device: number, raster: number, plane_raster: number) => "
      "DisplayRectangle | null | undefined | Promise<DisplayRectangle | null | undefined> "
      "} | null");
  emscripten::register_type<FileOps>(
      "FileOps",
      "{ "
      "close?: () => number | Promise<number>; "
      "getc?: () => number | Promise<number>; "
      "putc?: (c: number) => number | Promise<number>; "
      "read: (buf: Uint8Array) => number | Promise<number>; "
      "write: (buf: Uint8Array) => number | Promise<number>; "
      "seek?: (offset: number, whence: number) => number | Promise<number>; "
      "tell?: () => number | Promise<number>; "
      "eof?: () => boolean | Promise<boolean>; "
      "seekable?: () => boolean | Promise<boolean>; "
      "pread?: (buf: Uint8Array, offset: number) => number | Promise<number>; "
      "pwrite?: (buf: Uint8Array, offset: number) => number | Promise<number>; "
      "is_char_buffered?: () => boolean | Promise<boolean>; "
      "fflush?: () => void | Promise<void>; "
      "ferror?: () => boolean | Promise<boolean>; "
      "clearerr?: () => void | Promise<void> "
      "}");
  emscripten::register_type<FileOpenResult>(
      "FileOpenResult",
      "FileOps | { file: FileOps; rfname?: string } | number | null | undefined | "
      "Promise<FileOps | { file: FileOps; rfname?: string } | number | null | undefined>");
  emscripten::register_type<FileSystem>(
      "FileSystem",
      "{ "
      "open_file?: (fname: string, mode: string) => FileOpenResult; "
      "open_pipe?: (fname: string, mode: string) => FileOpenResult; "
      "open_scratch?: (prefix: string, mode: string, rm: boolean) => FileOpenResult; "
      "open_printer?: (fname: string, binary: boolean) => FileOpenResult; "
      "open_handle?: (fname: string, access: string) => FileOpenResult "
      "}");
  emscripten::register_type<ParamValue>("ParamValue",
                                        "boolean | number | bigint | string | null");
  emscripten::register_type<GetParamResult>("GetParamResult",
                                            "{ code: number; value: ParamValue }");
  emscripten::register_type<EnumerateParamsResult>("EnumerateParamsResult",
                                                   "{ code: number; key: string; type: number }");
  emscripten::register_type<AwaitableInt>("number | Promise<number>");
  emscripten::register_type<AwaitableRunResult>("RunResult | Promise<RunResult>");
}
