#pragma once

#include "common.h"

#include <emscripten/val.h>

namespace gsapi {

struct FsRegistration {
  emscripten::val fs;
};

namespace jsfile {

extern gsapi_fs_t fs;

} // namespace jsfile

} // namespace gsapi
