#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <iapi.h>
#include <string>

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
    emscripten::val::global("Error")
        .new_("gsapi_revision returned " + std::to_string(ret))
        .throw_();
  }
  return r;
}

EMSCRIPTEN_BINDINGS(gs) {
  emscripten::value_object<gsapi_revision_t>("Revision")
      .field("product", &Revision::getProduct, &Revision::setProduct)
      .field("copyright", &Revision::getCopyright, &Revision::setCopyright)
      .field("revision", &gsapi_revision_t::revision)
      .field("revisiondate", &gsapi_revision_t::revisiondate);

  emscripten::function("revision", &revision);
}
