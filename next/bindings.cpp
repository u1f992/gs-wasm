#include <cstdint>
#include <emscripten/bind.h>
#include <emscripten/val.h>
#include <gdevdsp.h>
#include <gserrors.h>
#include <iapi.h>
#include <memory>
#include <string>
#include <vector>

EMSCRIPTEN_DECLARE_VAL_TYPE(ArgList);
EMSCRIPTEN_DECLARE_VAL_TYPE(StdioCallback);
EMSCRIPTEN_DECLARE_VAL_TYPE(PollCallback);
EMSCRIPTEN_DECLARE_VAL_TYPE(CalloutCallback);
EMSCRIPTEN_DECLARE_VAL_TYPE(DisplayCallback);
EMSCRIPTEN_DECLARE_VAL_TYPE(ParamValue);
EMSCRIPTEN_DECLARE_VAL_TYPE(GetParamResult);
EMSCRIPTEN_DECLARE_VAL_TYPE(EnumerateParamsResult);
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

struct CalloutRegistration {
  emscripten::val fn;
};

class Instance {
  void *instance = nullptr;
  emscripten::val stdinFn = emscripten::val::null();
  emscripten::val stdoutFn = emscripten::val::null();
  emscripten::val stderrFn = emscripten::val::null();
  emscripten::val pollFn = emscripten::val::null();
  std::vector<std::unique_ptr<CalloutRegistration>> callouts;
  emscripten::val displayFns = emscripten::val::null();
  display_callback displayCallback{};
  void *paramIterator = nullptr;

  template <typename... Args>
  auto callDisplay(const char *name, Args... args) -> int {
    emscripten::val fn = displayFns[name];
    if (fn.isUndefined()) {
      return 0;
    }
    return settled(fn(args...)).template as<int>();
  }

  static auto devicePointer(void *device) -> double {
    return static_cast<double>(reinterpret_cast<uintptr_t>(device));
  }

  static auto onDisplayCallout(void *, void *calloutHandle, const char *deviceName, int id,
                               int size, void *data) -> int {
    if (deviceName == nullptr || std::string(deviceName) != "display" ||
        id != DISPLAY_CALLOUT_GET_CALLBACK ||
        size < static_cast<int>(sizeof(gs_display_get_callback_t))) {
      return gs_error_unknownerror;
    }
    auto *self = static_cast<Instance *>(calloutHandle);
    auto *cb = static_cast<gs_display_get_callback_t *>(data);
    cb->callback = &self->displayCallback;
    cb->caller_handle = self;
    return 0;
  }

  static auto displayOpen(void *handle, void *device) -> int {
    return static_cast<Instance *>(handle)->callDisplay("display_open", devicePointer(device));
  }

  static auto displayPreclose(void *handle, void *device) -> int {
    return static_cast<Instance *>(handle)->callDisplay("display_preclose",
                                                        devicePointer(device));
  }

  static auto displayClose(void *handle, void *device) -> int {
    return static_cast<Instance *>(handle)->callDisplay("display_close", devicePointer(device));
  }

  static auto displayPresize(void *handle, void *device, int width, int height, int raster,
                             unsigned int format) -> int {
    return static_cast<Instance *>(handle)->callDisplay("display_presize", devicePointer(device),
                                                        width, height, raster, format);
  }

  static auto displaySize(void *handle, void *device, int width, int height, int raster,
                          unsigned int format, unsigned char *pimage) -> int {
    auto view = emscripten::typed_memory_view(
        pimage == nullptr ? 0 : static_cast<size_t>(raster) * static_cast<size_t>(height),
        pimage);
    return static_cast<Instance *>(handle)->callDisplay("display_size", devicePointer(device),
                                                        width, height, raster, format, view);
  }

  static auto displaySync(void *handle, void *device) -> int {
    return static_cast<Instance *>(handle)->callDisplay("display_sync", devicePointer(device));
  }

  static auto displayPage(void *handle, void *device, int copies, int flush) -> int {
    return static_cast<Instance *>(handle)->callDisplay("display_page", devicePointer(device),
                                                        copies, flush);
  }

  static auto displayUpdate(void *handle, void *device, int x, int y, int w, int h) -> int {
    return static_cast<Instance *>(handle)->callDisplay("display_update", devicePointer(device),
                                                        x, y, w, h);
  }

  static auto displaySeparation(void *handle, void *device, int component,
                                const char *componentName, unsigned short c, unsigned short m,
                                unsigned short y, unsigned short k) -> int {
    return static_cast<Instance *>(handle)->callDisplay(
        "display_separation", devicePointer(device), component,
        std::string(componentName == nullptr ? "" : componentName), c, m, y, k);
  }

  static auto displayAdjustBandHeight(void *handle, void *device, int bandheight) -> int {
    return static_cast<Instance *>(handle)->callDisplay("display_adjust_band_height",
                                                        devicePointer(device), bandheight);
  }

  static auto onCallout(void *, void *calloutHandle, const char *deviceName, int id, int size,
                        void *data) -> int {
    auto *registration = static_cast<CalloutRegistration *>(calloutHandle);
    auto view = emscripten::typed_memory_view(
        data == nullptr || size < 0 ? 0 : size, static_cast<const unsigned char *>(data));
    return settled(registration->fn(std::string(deviceName == nullptr ? "" : deviceName), id,
                                    size, view))
        .as<int>();
  }

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

  static auto onPoll(void *callerHandle) -> int {
    auto *self = static_cast<Instance *>(callerHandle);
    return settled(self->pollFn()).as<int>();
  }

  template <typename T>
  auto getScalarParam(const std::string &param, gs_set_param_type type) -> GetParamResult {
    T storage{};
    int code = gsapi_get_param(instance, param.c_str(), &storage, type);
    auto result = emscripten::val::object();
    result.set("code", code);
    result.set("value", code < 0 ? emscripten::val::null() : emscripten::val(storage));
    return GetParamResult(result);
  }

  auto getStringParam(const std::string &param, gs_set_param_type type) -> GetParamResult {
    int code = gsapi_get_param(instance, param.c_str(), nullptr, type);
    auto result = emscripten::val::object();
    if (code >= 0) {
      std::string storage(code, '\0');
      code = gsapi_get_param(instance, param.c_str(), storage.data(), type);
      result.set("value", code < 0 ? emscripten::val::null()
                                   : emscripten::val(std::string(storage.c_str())));
    } else {
      result.set("value", emscripten::val::null());
    }
    result.set("code", code);
    return GetParamResult(result);
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

  auto setPoll(PollCallback pollFn) -> int {
    this->pollFn = pollFn;
    int ret = gsapi_set_poll(instance, pollFn.isNull() ? nullptr : &onPoll);
    if (ret != 0) {
      throwReturned("gsapi_set_poll", ret);
    }
    return ret;
  }

  auto setDisplayCallback(DisplayCallback callback) -> int {
    bool wasSet = !displayFns.isNull();
    displayFns = callback;
    if (callback.isNull()) {
      if (wasSet) {
        gsapi_deregister_callout(instance, &onDisplayCallout, this);
      }
      int ret = gsapi_set_display_callback(instance, nullptr);
      if (ret != 0) {
        throwReturned("gsapi_set_display_callback", ret);
      }
      return ret;
    }
    displayCallback = display_callback{};
    displayCallback.size = sizeof(display_callback);
    displayCallback.version_major = DISPLAY_VERSION_MAJOR;
    displayCallback.version_minor = DISPLAY_VERSION_MINOR;
    displayCallback.display_open = &displayOpen;
    displayCallback.display_preclose = &displayPreclose;
    displayCallback.display_close = &displayClose;
    displayCallback.display_presize = &displayPresize;
    displayCallback.display_size = &displaySize;
    displayCallback.display_sync = &displaySync;
    displayCallback.display_page = &displayPage;
    if (!callback["display_update"].isUndefined()) {
      displayCallback.display_update = &displayUpdate;
    }
    if (!callback["display_separation"].isUndefined()) {
      displayCallback.display_separation = &displaySeparation;
    }
    if (!callback["display_adjust_band_height"].isUndefined()) {
      displayCallback.display_adjust_band_height = &displayAdjustBandHeight;
    }
    if (!wasSet) {
      int ret = gsapi_register_callout(instance, &onDisplayCallout, this);
      if (ret != 0) {
        throwReturned("gsapi_register_callout", ret);
      }
    }
    int ret = gsapi_set_display_callback(instance, &displayCallback);
    if (ret != 0) {
      throwReturned("gsapi_set_display_callback", ret);
    }
    return ret;
  }

  auto registerCallout(CalloutCallback fn) -> int {
    auto registration = std::make_unique<CalloutRegistration>(CalloutRegistration{fn});
    int ret = gsapi_register_callout(instance, &onCallout, registration.get());
    if (ret != 0) {
      throwReturned("gsapi_register_callout", ret);
    }
    callouts.push_back(std::move(registration));
    return ret;
  }

  auto deregisterCallout(CalloutCallback fn) -> void {
    for (auto it = callouts.begin(); it != callouts.end();) {
      if ((*it)->fn.strictlyEquals(fn)) {
        gsapi_deregister_callout(instance, &onCallout, it->get());
        it = callouts.erase(it);
      } else {
        ++it;
      }
    }
  }

  auto setDefaultDeviceList(const std::string &list) -> int {
    int ret = gsapi_set_default_device_list(instance, list.c_str(), list.size());
    if (ret != 0) {
      throwReturned("gsapi_set_default_device_list", ret);
    }
    return ret;
  }

  auto getDefaultDeviceList() -> std::string {
    char *list = nullptr;
    int listlen = 0;
    int ret = gsapi_get_default_device_list(instance, &list, &listlen);
    if (ret != 0) {
      throwReturned("gsapi_get_default_device_list", ret);
    }
    return {list, static_cast<size_t>(listlen)};
  }

  auto setArgEncoding(int encoding) -> int {
    int ret = gsapi_set_arg_encoding(instance, encoding);
    if (ret != 0) {
      throwReturned("gsapi_set_arg_encoding", ret);
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

  auto setParam(const std::string &param, const ParamValue &value, int type) -> AwaitableInt {
    auto paramType = static_cast<gs_set_param_type>(type);
    int ret = 0;
    switch (static_cast<gs_set_param_type>(type & ~gs_spt_more_to_come)) {
    case gs_spt_null:
      ret = gsapi_set_param(instance, param.c_str(), nullptr, paramType);
      break;
    case gs_spt_bool: {
      int storage = value.as<bool>() ? 1 : 0;
      ret = gsapi_set_param(instance, param.c_str(), &storage, paramType);
      break;
    }
    case gs_spt_int: {
      int storage = value.as<int>();
      ret = gsapi_set_param(instance, param.c_str(), &storage, paramType);
      break;
    }
    case gs_spt_float: {
      float storage = value.as<float>();
      ret = gsapi_set_param(instance, param.c_str(), &storage, paramType);
      break;
    }
    case gs_spt_name:
    case gs_spt_string:
    case gs_spt_parsed: {
      std::string storage = value.as<std::string>();
      ret = gsapi_set_param(instance, param.c_str(), storage.c_str(), paramType);
      break;
    }
    case gs_spt_long: {
      long storage = value.as<long>();
      ret = gsapi_set_param(instance, param.c_str(), &storage, paramType);
      break;
    }
    case gs_spt_i64: {
      int64_t storage = value.typeOf().as<std::string>() == "bigint"
                            ? value.as<int64_t>()
                            : static_cast<int64_t>(value.as<double>());
      ret = gsapi_set_param(instance, param.c_str(), &storage, paramType);
      break;
    }
    case gs_spt_size_t: {
      size_t storage = value.as<size_t>();
      ret = gsapi_set_param(instance, param.c_str(), &storage, paramType);
      break;
    }
    default:
      ret = gsapi_set_param(instance, param.c_str(), nullptr, paramType);
      break;
    }
    if (ret < 0) {
      throwReturned("gsapi_set_param", ret);
    }
    return AwaitableInt(emscripten::val(ret));
  }

  auto getParam(const std::string &param, int type) -> GetParamResult {
    auto paramType = static_cast<gs_set_param_type>(type);
    switch (paramType) {
    case gs_spt_bool:
      return getScalarParam<bool>(param, paramType);
    case gs_spt_int:
      return getScalarParam<int>(param, paramType);
    case gs_spt_float:
      return getScalarParam<float>(param, paramType);
    case gs_spt_long:
      return getScalarParam<long>(param, paramType);
    case gs_spt_i64:
      return getScalarParam<int64_t>(param, paramType);
    case gs_spt_size_t:
      return getScalarParam<size_t>(param, paramType);
    case gs_spt_name:
    case gs_spt_string:
    case gs_spt_parsed:
      return getStringParam(param, paramType);
    default: {
      int code = gsapi_get_param(instance, param.c_str(), nullptr, paramType);
      auto result = emscripten::val::object();
      result.set("code", code);
      result.set("value", emscripten::val::null());
      return GetParamResult(result);
    }
    }
  }

  auto enumerateParams() -> EnumerateParamsResult {
    const char *key = nullptr;
    gs_set_param_type type = gs_spt_invalid;
    int code = gsapi_enumerate_params(instance, &paramIterator, &key, &type);
    if (code != 0) {
      paramIterator = nullptr;
    }
    auto result = emscripten::val::object();
    result.set("code", code);
    result.set("key", std::string(key == nullptr ? "" : key));
    result.set("type", static_cast<int>(type));
    return EnumerateParamsResult(result);
  }

  auto addControlPath(int type, const std::string &path) -> int {
    int ret = gsapi_add_control_path(instance, type, path.c_str());
    if (ret < 0) {
      throwReturned("gsapi_add_control_path", ret);
    }
    return ret;
  }

  auto removeControlPath(int type, const std::string &path) -> int {
    int ret = gsapi_remove_control_path(instance, type, path.c_str());
    if (ret < 0) {
      throwReturned("gsapi_remove_control_path", ret);
    }
    return ret;
  }

  auto purgeControlPaths(int type) -> void { gsapi_purge_control_paths(instance, type); }

  auto activatePathControl(bool enable) -> void {
    gsapi_activate_path_control(instance, enable ? 1 : 0);
  }

  auto isPathControlActive() -> bool { return gsapi_is_path_control_active(instance) != 0; }
};

} // namespace gsapi

EMSCRIPTEN_BINDINGS(gs) {
  emscripten::register_type<ArgList>("string[]");
  emscripten::register_type<StdioCallback>(
      "((buf: Uint8Array) => number | Promise<number>) | null");
  emscripten::register_type<PollCallback>("(() => number | Promise<number>) | null");
  emscripten::register_type<CalloutCallback>(
      "(deviceName: string, id: number, size: number, data: Uint8Array) => number | "
      "Promise<number>");
  emscripten::register_type<DisplayCallback>(
      "{ "
      "display_open?: (device: number) => number | Promise<number>; "
      "display_preclose?: (device: number) => number | Promise<number>; "
      "display_close?: (device: number) => number | Promise<number>; "
      "display_presize?: (device: number, width: number, height: number, raster: number, "
      "format: number) => number | Promise<number>; "
      "display_size?: (device: number, width: number, height: number, raster: number, "
      "format: number, pimage: Uint8Array) => number | Promise<number>; "
      "display_sync?: (device: number) => number | Promise<number>; "
      "display_page?: (device: number, copies: number, flush: number) => number | "
      "Promise<number>; "
      "display_update?: (device: number, x: number, y: number, w: number, h: number) => "
      "number | Promise<number>; "
      "display_separation?: (device: number, component: number, componentName: string, "
      "c: number, m: number, y: number, k: number) => number | Promise<number>; "
      "display_adjust_band_height?: (device: number, bandheight: number) => number | "
      "Promise<number> "
      "} | null");
  emscripten::register_type<ParamValue>("boolean | number | bigint | string | null");
  emscripten::register_type<GetParamResult>(
      "{ code: number; value: boolean | number | bigint | string | null }");
  emscripten::register_type<EnumerateParamsResult>("{ code: number; key: string; type: number }");
  emscripten::register_type<AwaitableInt>("number | Promise<number>");
  emscripten::register_type<AwaitableRunResult>("RunResult | Promise<RunResult>");

  emscripten::constant("gs_error_Fatal", static_cast<int>(gs_error_Fatal));
  emscripten::constant("gs_error_Quit", static_cast<int>(gs_error_Quit));
  emscripten::constant("gs_error_NeedInput", static_cast<int>(gs_error_NeedInput));
  emscripten::constant("gs_error_Info", static_cast<int>(gs_error_Info));
  emscripten::constant("gs_error_undefined", static_cast<int>(gs_error_undefined));

  emscripten::constant("GS_ARG_ENCODING_LOCAL", static_cast<int>(GS_ARG_ENCODING_LOCAL));
  emscripten::constant("GS_ARG_ENCODING_UTF8", static_cast<int>(GS_ARG_ENCODING_UTF8));
  emscripten::constant("GS_ARG_ENCODING_UTF16LE", static_cast<int>(GS_ARG_ENCODING_UTF16LE));

  emscripten::constant("gs_spt_invalid", static_cast<int>(gs_spt_invalid));
  emscripten::constant("gs_spt_null", static_cast<int>(gs_spt_null));
  emscripten::constant("gs_spt_bool", static_cast<int>(gs_spt_bool));
  emscripten::constant("gs_spt_int", static_cast<int>(gs_spt_int));
  emscripten::constant("gs_spt_float", static_cast<int>(gs_spt_float));
  emscripten::constant("gs_spt_name", static_cast<int>(gs_spt_name));
  emscripten::constant("gs_spt_string", static_cast<int>(gs_spt_string));
  emscripten::constant("gs_spt_long", static_cast<int>(gs_spt_long));
  emscripten::constant("gs_spt_i64", static_cast<int>(gs_spt_i64));
  emscripten::constant("gs_spt_size_t", static_cast<int>(gs_spt_size_t));
  emscripten::constant("gs_spt_parsed", static_cast<int>(gs_spt_parsed));
  emscripten::constant("gs_spt_more_to_come", static_cast<int>(gs_spt_more_to_come));

  emscripten::constant("GS_PERMIT_FILE_READING", static_cast<int>(GS_PERMIT_FILE_READING));
  emscripten::constant("GS_PERMIT_FILE_WRITING", static_cast<int>(GS_PERMIT_FILE_WRITING));
  emscripten::constant("GS_PERMIT_FILE_CONTROL", static_cast<int>(GS_PERMIT_FILE_CONTROL));

  emscripten::constant("DISPLAY_CALLOUT_GET_CALLBACK",
                       static_cast<int>(DISPLAY_CALLOUT_GET_CALLBACK));
  emscripten::constant("DISPLAY_CALLOUT_GET_CALLBACK_LEGACY",
                       static_cast<int>(DISPLAY_CALLOUT_GET_CALLBACK_LEGACY));

  emscripten::constant("DISPLAY_VERSION_MAJOR", static_cast<int>(DISPLAY_VERSION_MAJOR));
  emscripten::constant("DISPLAY_VERSION_MINOR", static_cast<int>(DISPLAY_VERSION_MINOR));
  emscripten::constant("DISPLAY_COLORS_NATIVE", static_cast<int>(DISPLAY_COLORS_NATIVE));
  emscripten::constant("DISPLAY_COLORS_GRAY", static_cast<int>(DISPLAY_COLORS_GRAY));
  emscripten::constant("DISPLAY_COLORS_RGB", static_cast<int>(DISPLAY_COLORS_RGB));
  emscripten::constant("DISPLAY_COLORS_CMYK", static_cast<int>(DISPLAY_COLORS_CMYK));
  emscripten::constant("DISPLAY_COLORS_SEPARATION",
                       static_cast<int>(DISPLAY_COLORS_SEPARATION));
  emscripten::constant("DISPLAY_COLORS_MASK", static_cast<int>(DISPLAY_COLORS_MASK));
  emscripten::constant("DISPLAY_ALPHA_NONE", static_cast<int>(DISPLAY_ALPHA_NONE));
  emscripten::constant("DISPLAY_ALPHA_FIRST", static_cast<int>(DISPLAY_ALPHA_FIRST));
  emscripten::constant("DISPLAY_ALPHA_LAST", static_cast<int>(DISPLAY_ALPHA_LAST));
  emscripten::constant("DISPLAY_UNUSED_FIRST", static_cast<int>(DISPLAY_UNUSED_FIRST));
  emscripten::constant("DISPLAY_UNUSED_LAST", static_cast<int>(DISPLAY_UNUSED_LAST));
  emscripten::constant("DISPLAY_ALPHA_MASK", static_cast<int>(DISPLAY_ALPHA_MASK));
  emscripten::constant("DISPLAY_DEPTH_1", static_cast<int>(DISPLAY_DEPTH_1));
  emscripten::constant("DISPLAY_DEPTH_2", static_cast<int>(DISPLAY_DEPTH_2));
  emscripten::constant("DISPLAY_DEPTH_4", static_cast<int>(DISPLAY_DEPTH_4));
  emscripten::constant("DISPLAY_DEPTH_8", static_cast<int>(DISPLAY_DEPTH_8));
  emscripten::constant("DISPLAY_DEPTH_12", static_cast<int>(DISPLAY_DEPTH_12));
  emscripten::constant("DISPLAY_DEPTH_16", static_cast<int>(DISPLAY_DEPTH_16));
  emscripten::constant("DISPLAY_DEPTH_MASK", static_cast<int>(DISPLAY_DEPTH_MASK));
  emscripten::constant("DISPLAY_BIGENDIAN", static_cast<int>(DISPLAY_BIGENDIAN));
  emscripten::constant("DISPLAY_LITTLEENDIAN", static_cast<int>(DISPLAY_LITTLEENDIAN));
  emscripten::constant("DISPLAY_ENDIAN_MASK", static_cast<int>(DISPLAY_ENDIAN_MASK));
  emscripten::constant("DISPLAY_TOPFIRST", static_cast<int>(DISPLAY_TOPFIRST));
  emscripten::constant("DISPLAY_BOTTOMFIRST", static_cast<int>(DISPLAY_BOTTOMFIRST));
  emscripten::constant("DISPLAY_FIRSTROW_MASK", static_cast<int>(DISPLAY_FIRSTROW_MASK));
  emscripten::constant("DISPLAY_NATIVE_555", static_cast<int>(DISPLAY_NATIVE_555));
  emscripten::constant("DISPLAY_NATIVE_565", static_cast<int>(DISPLAY_NATIVE_565));
  emscripten::constant("DISPLAY_555_MASK", static_cast<int>(DISPLAY_555_MASK));
  emscripten::constant("DISPLAY_ROW_ALIGN_DEFAULT", static_cast<int>(DISPLAY_ROW_ALIGN_DEFAULT));
  emscripten::constant("DISPLAY_ROW_ALIGN_4", static_cast<int>(DISPLAY_ROW_ALIGN_4));
  emscripten::constant("DISPLAY_ROW_ALIGN_8", static_cast<int>(DISPLAY_ROW_ALIGN_8));
  emscripten::constant("DISPLAY_ROW_ALIGN_16", static_cast<int>(DISPLAY_ROW_ALIGN_16));
  emscripten::constant("DISPLAY_ROW_ALIGN_32", static_cast<int>(DISPLAY_ROW_ALIGN_32));
  emscripten::constant("DISPLAY_ROW_ALIGN_64", static_cast<int>(DISPLAY_ROW_ALIGN_64));
  emscripten::constant("DISPLAY_ROW_ALIGN_MASK", static_cast<int>(DISPLAY_ROW_ALIGN_MASK));
  emscripten::constant("DISPLAY_CHUNKY", static_cast<int>(DISPLAY_CHUNKY));
  emscripten::constant("DISPLAY_PLANAR", static_cast<int>(DISPLAY_PLANAR));
  emscripten::constant("DISPLAY_PLANAR_INTERLEAVED",
                       static_cast<int>(DISPLAY_PLANAR_INTERLEAVED));

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
      .function("setPoll", &gsapi::Instance::setPoll)
      .function("setDisplayCallback", &gsapi::Instance::setDisplayCallback)
      .function("registerCallout", &gsapi::Instance::registerCallout)
      .function("deregisterCallout", &gsapi::Instance::deregisterCallout)
      .function("setDefaultDeviceList", &gsapi::Instance::setDefaultDeviceList)
      .function("getDefaultDeviceList", &gsapi::Instance::getDefaultDeviceList)
      .function("setArgEncoding", &gsapi::Instance::setArgEncoding)
      .function("initWithArgs", &gsapi::Instance::initWithArgs)
      .function("runStringBegin", &gsapi::Instance::runStringBegin)
      .function("runStringContinue", &gsapi::Instance::runStringContinue)
      .function("runStringEnd", &gsapi::Instance::runStringEnd)
      .function("runStringWithLength", &gsapi::Instance::runStringWithLength)
      .function("runString", &gsapi::Instance::runString)
      .function("runFile", &gsapi::Instance::runFile)
      .function("exit", &gsapi::Instance::exit)
      .function("setParam", &gsapi::Instance::setParam)
      .function("getParam", &gsapi::Instance::getParam)
      .function("enumerateParams", &gsapi::Instance::enumerateParams)
      .function("addControlPath", &gsapi::Instance::addControlPath)
      .function("removeControlPath", &gsapi::Instance::removeControlPath)
      .function("purgeControlPaths", &gsapi::Instance::purgeControlPaths)
      .function("activatePathControl", &gsapi::Instance::activatePathControl)
      .function("isPathControlActive", &gsapi::Instance::isPathControlActive);
}
