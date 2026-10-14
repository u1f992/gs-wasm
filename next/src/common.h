#pragma once

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

inline auto settled(emscripten::val result) -> emscripten::val {
  if (result.instanceof(emscripten::val::global("Promise"))) {
    return result.await();
  }
  return result;
}

} // namespace gsapi
