#pragma once

#include "common.h"

#include <emscripten/val.h>

namespace gsapi {

class DisplayBridge {
  emscripten::val fns = emscripten::val::null();
  display_callback callback{};

  template <typename... Args> auto call(const char *name, Args... args) -> emscripten::val;
  template <typename... Args> auto callInt(const char *name, Args... args) -> int;

  static auto self(void *handle) -> DisplayBridge * { return static_cast<DisplayBridge *>(handle); }
  static auto devicePointer(void *device) -> double;

  static auto open(void *handle, void *device) -> int;
  static auto preclose(void *handle, void *device) -> int;
  static auto close(void *handle, void *device) -> int;
  static auto presize(void *handle, void *device, int width, int height, int raster,
                      unsigned int format) -> int;
  static auto size(void *handle, void *device, int width, int height, int raster,
                   unsigned int format, unsigned char *pimage) -> int;
  static auto sync(void *handle, void *device) -> int;
  static auto page(void *handle, void *device, int copies, int flush) -> int;
  static auto update(void *handle, void *device, int x, int y, int w, int h) -> int;
  static auto memalloc(void *handle, void *device, size_t size) -> void *;
  static auto memfree(void *handle, void *device, void *mem) -> int;
  static auto separation(void *handle, void *device, int component, const char *componentName,
                         unsigned short c, unsigned short m, unsigned short y, unsigned short k)
      -> int;
  static auto adjustBandHeight(void *handle, void *device, int bandheight) -> int;
  static auto rectangleRequest(void *handle, void *device, void **memory, int *ox, int *oy,
                               int *raster, int *plane_raster, int *x, int *y, int *w, int *h)
      -> int;

public:
  auto isSet() const -> bool { return !fns.isNull(); }
  auto set(emscripten::val callbacks) -> display_callback *;
  auto clear() -> void;

  static auto callout(void *instance, void *calloutHandle, const char *deviceName, int id,
                      int size, void *data) -> int;
};

} // namespace gsapi
