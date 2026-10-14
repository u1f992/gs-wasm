#include "common.h"

#include <emscripten/bind.h>
#include <string>

namespace gsapi {

namespace Revision {
auto getProduct(const gsapi_revision_t &r) -> std::string { return r.product; }
auto setProduct(gsapi_revision_t &, std::string) -> void {}
auto getCopyright(const gsapi_revision_t &r) -> std::string { return r.copyright; }
auto setCopyright(gsapi_revision_t &, std::string) -> void {}
} // namespace Revision

auto revision() -> gsapi_revision_t {
  gsapi_revision_t r{};
  int ret = gsapi_revision(&r, sizeof(r));
  if (ret != 0) {
    throwReturned("gsapi_revision", ret);
  }
  return r;
}

} // namespace gsapi

EMSCRIPTEN_BINDINGS(revision) {
  emscripten::value_object<gsapi_revision_t>("Revision")
      .field("product", &gsapi::Revision::getProduct, &gsapi::Revision::setProduct)
      .field("copyright", &gsapi::Revision::getCopyright, &gsapi::Revision::setCopyright)
      .field("revision", &gsapi_revision_t::revision)
      .field("revisiondate", &gsapi_revision_t::revisiondate);

  emscripten::function("revision", &gsapi::revision);
}
