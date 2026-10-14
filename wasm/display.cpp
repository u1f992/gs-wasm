#include "display.h"

#include <cstdint>
#include <string>

namespace gsapi {

template <typename... Args>
auto DisplayBridge::call(const char *name, Args... args) -> emscripten::val {
  emscripten::val fn = fns[name];
  if (fn.isUndefined()) {
    return emscripten::val::undefined();
  }
  return settled(fn(args...));
}

template <typename... Args> auto DisplayBridge::callInt(const char *name, Args... args) -> int {
  emscripten::val result = call(name, args...);
  return result.isUndefined() ? 0 : result.template as<int>();
}

auto DisplayBridge::devicePointer(void *device) -> double {
  return static_cast<double>(reinterpret_cast<uintptr_t>(device));
}

auto DisplayBridge::open(void *handle, void *device) -> int {
  return self(handle)->callInt("display_open", devicePointer(device));
}

auto DisplayBridge::preclose(void *handle, void *device) -> int {
  return self(handle)->callInt("display_preclose", devicePointer(device));
}

auto DisplayBridge::close(void *handle, void *device) -> int {
  return self(handle)->callInt("display_close", devicePointer(device));
}

auto DisplayBridge::presize(void *handle, void *device, int width, int height, int raster,
                            unsigned int format) -> int {
  return self(handle)->callInt("display_presize", devicePointer(device), width, height, raster,
                               format);
}

auto DisplayBridge::size(void *handle, void *device, int width, int height, int raster,
                         unsigned int format, unsigned char *pimage) -> int {
  return self(handle)->callInt("display_size", devicePointer(device), width, height, raster,
                               format, devicePointer(pimage));
}

auto DisplayBridge::sync(void *handle, void *device) -> int {
  return self(handle)->callInt("display_sync", devicePointer(device));
}

auto DisplayBridge::page(void *handle, void *device, int copies, int flush) -> int {
  return self(handle)->callInt("display_page", devicePointer(device), copies, flush);
}

auto DisplayBridge::update(void *handle, void *device, int x, int y, int w, int h) -> int {
  return self(handle)->callInt("display_update", devicePointer(device), x, y, w, h);
}

auto DisplayBridge::memalloc(void *handle, void *device, size_t size) -> void * {
  emscripten::val result =
      self(handle)->call("display_memalloc", devicePointer(device), static_cast<double>(size));
  if (result.isUndefined() || result.isNull()) {
    return nullptr;
  }
  return reinterpret_cast<void *>(static_cast<uintptr_t>(result.as<double>()));
}

auto DisplayBridge::memfree(void *handle, void *device, void *mem) -> int {
  return self(handle)->callInt("display_memfree", devicePointer(device), devicePointer(mem));
}

auto DisplayBridge::separation(void *handle, void *device, int component,
                               const char *componentName, unsigned short c, unsigned short m,
                               unsigned short y, unsigned short k) -> int {
  return self(handle)->callInt("display_separation", devicePointer(device), component,
                               std::string(componentName == nullptr ? "" : componentName), c, m,
                               y, k);
}

auto DisplayBridge::adjustBandHeight(void *handle, void *device, int bandheight) -> int {
  return self(handle)->callInt("display_adjust_band_height", devicePointer(device), bandheight);
}

auto DisplayBridge::rectangleRequest(void *handle, void *device, void **memory, int *ox, int *oy,
                                     int *raster, int *plane_raster, int *x, int *y, int *w,
                                     int *h) -> int {
  emscripten::val result = self(handle)->call("display_rectangle_request", devicePointer(device),
                                              *raster, *plane_raster);
  *memory = nullptr;
  *ox = *oy = *x = *y = *w = *h = 0;
  if (result.isUndefined() || result.isNull()) {
    return 0;
  }
  auto field = [&](const char *name, int fallback) -> int {
    emscripten::val v = result[name];
    return v.isUndefined() ? fallback : v.as<int>();
  };
  *memory = reinterpret_cast<void *>(static_cast<uintptr_t>(result["memory"].as<double>()));
  *ox = field("ox", 0);
  *oy = field("oy", 0);
  *raster = field("raster", *raster);
  *plane_raster = field("plane_raster", *plane_raster);
  *x = field("x", 0);
  *y = field("y", 0);
  *w = field("w", 0);
  *h = field("h", 0);
  return 0;
}

auto DisplayBridge::set(emscripten::val callbacks) -> display_callback * {
  fns = callbacks;
  callback = display_callback{};
  callback.size = sizeof(display_callback);
  callback.version_major = DISPLAY_VERSION_MAJOR;
  callback.version_minor = DISPLAY_VERSION_MINOR;
  callback.display_open = &open;
  callback.display_preclose = &preclose;
  callback.display_close = &close;
  callback.display_presize = &presize;
  callback.display_size = &size;
  callback.display_sync = &sync;
  callback.display_page = &page;
  auto provided = [&](const char *name) { return !callbacks[name].isUndefined(); };
  if (provided("display_update")) {
    callback.display_update = &update;
  }
  if (provided("display_memalloc") && provided("display_memfree")) {
    callback.display_memalloc = &memalloc;
    callback.display_memfree = &memfree;
  }
  if (provided("display_separation")) {
    callback.display_separation = &separation;
  }
  if (provided("display_adjust_band_height")) {
    callback.display_adjust_band_height = &adjustBandHeight;
  }
  if (provided("display_rectangle_request")) {
    callback.display_rectangle_request = &rectangleRequest;
  }
  return &callback;
}

auto DisplayBridge::clear() -> void { fns = emscripten::val::null(); }

auto DisplayBridge::callout(void *, void *calloutHandle, const char *deviceName, int id, int size,
                            void *data) -> int {
  if (deviceName == nullptr || std::string(deviceName) != "display" ||
      id != DISPLAY_CALLOUT_GET_CALLBACK ||
      size < static_cast<int>(sizeof(gs_display_get_callback_t))) {
    return gs_error_unknownerror;
  }
  auto *bridge = self(calloutHandle);
  auto *cb = static_cast<gs_display_get_callback_t *>(data);
  cb->callback = &bridge->callback;
  cb->caller_handle = bridge;
  return 0;
}

} // namespace gsapi
