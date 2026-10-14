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

class Instance {
public:
  void *instance = nullptr;

  Instance() = default;
  Instance(const Instance &) = delete;
  auto operator=(const Instance &) -> Instance & = delete;
  ~Instance() { gsapi_delete_instance(instance); }
};

auto newInstance() -> Instance * {
  auto *inst = new Instance();
  int ret = gsapi_new_instance(&inst->instance, inst);
  if (ret != 0) {
    delete inst;
    emscripten::val::global("Error")
        .new_("gsapi_new_instance returned " + std::to_string(ret))
        .throw_();
  }
  return inst;
}

EMSCRIPTEN_BINDINGS(gs) {
  emscripten::value_object<gsapi_revision_t>("Revision")
      .field("product", &Revision::getProduct, &Revision::setProduct)
      .field("copyright", &Revision::getCopyright, &Revision::setCopyright)
      .field("revision", &gsapi_revision_t::revision)
      .field("revisiondate", &gsapi_revision_t::revisiondate);

  emscripten::function("revision", &revision);

  emscripten::class_<Instance>("Instance");

  emscripten::function("newInstance", &newInstance, emscripten::allow_raw_pointers(),
                       emscripten::nonnull<emscripten::ret_val>());
}
