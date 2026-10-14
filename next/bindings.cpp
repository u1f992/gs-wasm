#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <gserrors.h>
#include <iapi.h>
#include <string>
#include <vector>

namespace gsapi {

auto throwReturned(const char *name, int ret) -> void {
  emscripten::val::global("Error")
      .new_(std::string(name) + " returned " + std::to_string(ret))
      .throw_();
}

auto settled(emscripten::val result) -> emscripten::val {
  if (result.instanceof(emscripten::val::global("Promise"))) {
    return result.await();
  }
  return result;
}

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

class Instance {
  void *instance = nullptr;
  emscripten::val stdinFn = emscripten::val::null();
  emscripten::val stdoutFn = emscripten::val::null();
  emscripten::val stderrFn = emscripten::val::null();

  static auto onStdin(void *callerHandle, char *buf, int len) -> int {
    auto *self = static_cast<Instance *>(callerHandle);
    auto view = emscripten::typed_memory_view(len, reinterpret_cast<unsigned char *>(buf));
    return settled(self->stdinFn(view)).as<int>();
  }

  static auto onStdout(void *callerHandle, const char *str, int len) -> int {
    auto *self = static_cast<Instance *>(callerHandle);
    auto view = emscripten::typed_memory_view(len, reinterpret_cast<const unsigned char *>(str));
    return settled(self->stdoutFn(view)).as<int>();
  }

  static auto onStderr(void *callerHandle, const char *str, int len) -> int {
    auto *self = static_cast<Instance *>(callerHandle);
    auto view = emscripten::typed_memory_view(len, reinterpret_cast<const unsigned char *>(str));
    return settled(self->stderrFn(view)).as<int>();
  }

public:
  Instance() = default;
  Instance(const Instance &) = delete;
  auto operator=(const Instance &) -> Instance & = delete;
  ~Instance() { gsapi_delete_instance(instance); }

  static auto create() -> Instance * {
    auto *inst = new Instance();
    int ret = gsapi_new_instance(&inst->instance, inst);
    if (ret != 0) {
      delete inst;
      throwReturned("gsapi_new_instance", ret);
    }
    return inst;
  }

  auto setStdio(emscripten::val stdinFn, emscripten::val stdoutFn, emscripten::val stderrFn)
      -> int {
    this->stdinFn = stdinFn;
    this->stdoutFn = stdoutFn;
    this->stderrFn = stderrFn;
    int ret = gsapi_set_stdio(instance, stdinFn.isNull() ? nullptr : &onStdin,
                              stdoutFn.isNull() ? nullptr : &onStdout,
                              stderrFn.isNull() ? nullptr : &onStderr);
    if (ret != 0) {
      throwReturned("gsapi_set_stdio", ret);
    }
    return ret;
  }

  auto initWithArgs(const emscripten::val &argv) -> int {
    std::vector<std::string> args = emscripten::vecFromJSArray<std::string>(argv);
    std::vector<char *> argvPointers;
    for (auto &arg : args) {
      argvPointers.push_back(arg.data());
    }
    int ret = gsapi_init_with_args(instance, argvPointers.size(), argvPointers.data());
    if (ret < 0 && ret != gs_error_Quit && ret != gs_error_Info) {
      throwReturned("gsapi_init_with_args", ret);
    }
    return ret;
  }

  auto exit() -> int {
    int ret = gsapi_exit(instance);
    if (ret != 0) {
      throwReturned("gsapi_exit", ret);
    }
    return ret;
  }
};

} // namespace gsapi

EMSCRIPTEN_BINDINGS(gs) {
  emscripten::constant("gs_error_Quit", static_cast<int>(gs_error_Quit));
  emscripten::constant("gs_error_Info", static_cast<int>(gs_error_Info));

  emscripten::value_object<gsapi_revision_t>("Revision")
      .field("product", &gsapi::Revision::getProduct, &gsapi::Revision::setProduct)
      .field("copyright", &gsapi::Revision::getCopyright, &gsapi::Revision::setCopyright)
      .field("revision", &gsapi_revision_t::revision)
      .field("revisiondate", &gsapi_revision_t::revisiondate);

  emscripten::function("revision", &gsapi::revision);

  emscripten::class_<gsapi::Instance>("Instance")
      .constructor(&gsapi::Instance::create, emscripten::allow_raw_pointers())
      .function("setStdio", &gsapi::Instance::setStdio)
      .function("initWithArgs", &gsapi::Instance::initWithArgs)
      .function("exit", &gsapi::Instance::exit);
}
