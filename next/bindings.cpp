#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <gserrors.h>
#include <iapi.h>
#include <string>
#include <vector>

EMSCRIPTEN_DECLARE_VAL_TYPE(ArgList);
EMSCRIPTEN_DECLARE_VAL_TYPE(StdioCallback);
EMSCRIPTEN_DECLARE_VAL_TYPE(AwaitableInt);
EMSCRIPTEN_DECLARE_VAL_TYPE(AwaitableRunResult);

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

struct RunResult {
  int code;
  int exitCode;
};

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

  auto setStdio(StdioCallback stdinFn, StdioCallback stdoutFn, StdioCallback stderrFn) -> int {
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

  auto initWithArgs(const ArgList &argv) -> AwaitableInt {
    std::vector<std::string> args = emscripten::vecFromJSArray<std::string>(argv);
    std::vector<char *> argvPointers;
    for (auto &arg : args) {
      argvPointers.push_back(arg.data());
    }
    int ret = gsapi_init_with_args(instance, argvPointers.size(), argvPointers.data());
    if (ret < 0 && ret != gs_error_Quit && ret != gs_error_Info) {
      throwReturned("gsapi_init_with_args", ret);
    }
    return AwaitableInt(emscripten::val(ret));
  }

  auto runStringBegin(int userErrors) -> AwaitableRunResult {
    RunResult r{};
    r.code = gsapi_run_string_begin(instance, userErrors, &r.exitCode);
    return AwaitableRunResult(emscripten::val(r));
  }

  auto runStringContinue(const std::string &str, int userErrors) -> AwaitableRunResult {
    RunResult r{};
    r.code = gsapi_run_string_continue(instance, str.data(), str.size(), userErrors, &r.exitCode);
    return AwaitableRunResult(emscripten::val(r));
  }

  auto runStringEnd(int userErrors) -> AwaitableRunResult {
    RunResult r{};
    r.code = gsapi_run_string_end(instance, userErrors, &r.exitCode);
    return AwaitableRunResult(emscripten::val(r));
  }

  auto runStringWithLength(const std::string &str, int userErrors) -> AwaitableRunResult {
    RunResult r{};
    r.code =
        gsapi_run_string_with_length(instance, str.data(), str.size(), userErrors, &r.exitCode);
    return AwaitableRunResult(emscripten::val(r));
  }

  auto runString(const std::string &str, int userErrors) -> AwaitableRunResult {
    RunResult r{};
    r.code = gsapi_run_string(instance, str.c_str(), userErrors, &r.exitCode);
    return AwaitableRunResult(emscripten::val(r));
  }

  auto runFile(const std::string &fileName, int userErrors) -> AwaitableRunResult {
    RunResult r{};
    r.code = gsapi_run_file(instance, fileName.c_str(), userErrors, &r.exitCode);
    return AwaitableRunResult(emscripten::val(r));
  }

  auto exit() -> AwaitableInt {
    int ret = gsapi_exit(instance);
    if (ret != 0) {
      throwReturned("gsapi_exit", ret);
    }
    return AwaitableInt(emscripten::val(ret));
  }
};

} // namespace gsapi

EMSCRIPTEN_BINDINGS(gs) {
  emscripten::register_type<ArgList>("string[]");
  emscripten::register_type<StdioCallback>(
      "((buf: Uint8Array) => number | Promise<number>) | null");
  emscripten::register_type<AwaitableInt>("number | Promise<number>");
  emscripten::register_type<AwaitableRunResult>("RunResult | Promise<RunResult>");

  emscripten::constant("gs_error_Fatal", static_cast<int>(gs_error_Fatal));
  emscripten::constant("gs_error_Quit", static_cast<int>(gs_error_Quit));
  emscripten::constant("gs_error_NeedInput", static_cast<int>(gs_error_NeedInput));
  emscripten::constant("gs_error_Info", static_cast<int>(gs_error_Info));

  emscripten::value_object<gsapi_revision_t>("Revision")
      .field("product", &gsapi::Revision::getProduct, &gsapi::Revision::setProduct)
      .field("copyright", &gsapi::Revision::getCopyright, &gsapi::Revision::setCopyright)
      .field("revision", &gsapi_revision_t::revision)
      .field("revisiondate", &gsapi_revision_t::revisiondate);

  emscripten::function("revision", &gsapi::revision);

  emscripten::value_object<gsapi::RunResult>("RunResult")
      .field("code", &gsapi::RunResult::code)
      .field("exitCode", &gsapi::RunResult::exitCode);

  emscripten::class_<gsapi::Instance>("Instance")
      .constructor(&gsapi::Instance::create, emscripten::allow_raw_pointers())
      .function("setStdio", &gsapi::Instance::setStdio)
      .function("initWithArgs", &gsapi::Instance::initWithArgs)
      .function("runStringBegin", &gsapi::Instance::runStringBegin)
      .function("runStringContinue", &gsapi::Instance::runStringContinue)
      .function("runStringEnd", &gsapi::Instance::runStringEnd)
      .function("runStringWithLength", &gsapi::Instance::runStringWithLength)
      .function("runString", &gsapi::Instance::runString)
      .function("runFile", &gsapi::Instance::runFile)
      .function("exit", &gsapi::Instance::exit);
}
