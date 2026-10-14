#pragma once

#include <emscripten/emscripten.h>
#include <emscripten/val.h>
#include <string>

extern "C" {
#include <gdevdsp.h>
#include <gp.h>
#include <gserrors.h>
#include <iapi.h>
}

namespace gsapi {

[[noreturn]] inline auto throwReturned(const char *name, int ret) -> void {
  emscripten::val::global("Error")
      .new_(std::string(name) + " returned " + std::to_string(ret))
      .throw_();
}

inline auto ensureNotSuspended() -> void {
  int suspended = EM_ASM_INT({
    return typeof Asyncify !== "undefined" && Asyncify.currData ? 1 : 0;
  });
  if (suspended != 0) {
    emscripten::val::global("Error")
        .new_(std::string("gsapi: a call is suspended on a pending promise; await it before "
                          "calling into the module again"))
        .throw_();
  }
}

inline auto settled(emscripten::val result) -> emscripten::val {
  if (result.instanceof(emscripten::val::global("Promise"))) {
    return result.await();
  }
  return result;
}

} // namespace gsapi
