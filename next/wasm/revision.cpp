#include "common.h"

#include <emscripten/bind.h>
#include <string>

namespace gsapi {

struct Revision {
  std::string product;
  std::string copyright;
  long revision;
  long revisiondate;
};

auto revision() -> Revision {
  ensureNotSuspended();
  gsapi_revision_t r{};
  int ret = gsapi_revision(&r, sizeof(r));
  if (ret != 0) {
    throwReturned("gsapi_revision", ret);
  }
  return {r.product, r.copyright, r.revision, r.revisiondate};
}

} // namespace gsapi

EMSCRIPTEN_BINDINGS(revision) {
  emscripten::value_object<gsapi::Revision>("Revision")
      .field("product", &gsapi::Revision::product)
      .field("copyright", &gsapi::Revision::copyright)
      .field("revision", &gsapi::Revision::revision)
      .field("revisiondate", &gsapi::Revision::revisiondate);

  emscripten::function("revision", &gsapi::revision);
}
