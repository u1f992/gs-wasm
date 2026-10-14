#include "instance.h"

#include <cstdint>
#include <emscripten/bind.h>

namespace gsapi {

Instance::~Instance() { gsapi_delete_instance(instance); }

auto Instance::create() -> Instance * {
  auto *inst = new Instance();
  int ret = gsapi_new_instance(&inst->instance, inst);
  if (ret != 0) {
    delete inst;
    throwReturned("gsapi_new_instance", ret);
  }
  return inst;
}

auto Instance::onStdin(void *callerHandle, char *buf, int len) -> int {
  auto *self = static_cast<Instance *>(callerHandle);
  auto view = emscripten::typed_memory_view(len, reinterpret_cast<unsigned char *>(buf));
  return settled(self->stdinFn(view, self->stdioHandle)).as<int>();
}

auto Instance::onStdout(void *callerHandle, const char *str, int len) -> int {
  auto *self = static_cast<Instance *>(callerHandle);
  auto view = emscripten::typed_memory_view(len, reinterpret_cast<const unsigned char *>(str));
  return settled(self->stdoutFn(view, self->stdioHandle)).as<int>();
}

auto Instance::onStderr(void *callerHandle, const char *str, int len) -> int {
  auto *self = static_cast<Instance *>(callerHandle);
  auto view = emscripten::typed_memory_view(len, reinterpret_cast<const unsigned char *>(str));
  return settled(self->stderrFn(view, self->stdioHandle)).as<int>();
}

auto Instance::onPoll(void *callerHandle) -> int {
  auto *self = static_cast<Instance *>(callerHandle);
  return settled(self->pollFn(self->pollHandle)).as<int>();
}

auto Instance::onCallout(void *, void *calloutHandle, const char *deviceName, int id, int size,
                         void *data) -> int {
  auto *registration = static_cast<CalloutRegistration *>(calloutHandle);
  auto view = emscripten::typed_memory_view(data == nullptr || size < 0 ? 0 : size,
                                            static_cast<const unsigned char *>(data));
  return settled(registration->fn(std::string(deviceName == nullptr ? "" : deviceName), id, size,
                                  view))
      .as<int>();
}

auto Instance::setStdio(StdioCallback stdinFn, StdioCallback stdoutFn, StdioCallback stderrFn)
    -> int {
  this->stdinFn = stdinFn;
  this->stdoutFn = stdoutFn;
  this->stderrFn = stderrFn;
  this->stdioHandle = emscripten::val::undefined();
  int ret = gsapi_set_stdio(instance, stdinFn.isNull() ? nullptr : &onStdin,
                            stdoutFn.isNull() ? nullptr : &onStdout,
                            stderrFn.isNull() ? nullptr : &onStderr);
  if (ret != 0) {
    throwReturned("gsapi_set_stdio", ret);
  }
  return ret;
}

auto Instance::setStdioWithHandle(StdioCallback stdinFn, StdioCallback stdoutFn,
                                  StdioCallback stderrFn, CallerHandle callerHandle) -> int {
  this->stdinFn = stdinFn;
  this->stdoutFn = stdoutFn;
  this->stderrFn = stderrFn;
  this->stdioHandle = callerHandle;
  int ret = gsapi_set_stdio_with_handle(instance, stdinFn.isNull() ? nullptr : &onStdin,
                                        stdoutFn.isNull() ? nullptr : &onStdout,
                                        stderrFn.isNull() ? nullptr : &onStderr, this);
  if (ret != 0) {
    throwReturned("gsapi_set_stdio_with_handle", ret);
  }
  return ret;
}

auto Instance::setPoll(PollCallback pollFn) -> int {
  this->pollFn = pollFn;
  this->pollHandle = emscripten::val::undefined();
  int ret = gsapi_set_poll(instance, pollFn.isNull() ? nullptr : &onPoll);
  if (ret != 0) {
    throwReturned("gsapi_set_poll", ret);
  }
  return ret;
}

auto Instance::setPollWithHandle(PollCallback pollFn, CallerHandle callerHandle) -> int {
  this->pollFn = pollFn;
  this->pollHandle = callerHandle;
  int ret = gsapi_set_poll_with_handle(instance, pollFn.isNull() ? nullptr : &onPoll, this);
  if (ret != 0) {
    throwReturned("gsapi_set_poll_with_handle", ret);
  }
  return ret;
}

auto Instance::setDisplayCallback(DisplayCallback callback) -> int {
  bool wasSet = display.isSet();
  if (callback.isNull()) {
    display.clear();
    if (wasSet) {
      gsapi_deregister_callout(instance, &DisplayBridge::callout, &display);
    }
    int ret = gsapi_set_display_callback(instance, nullptr);
    if (ret != 0) {
      throwReturned("gsapi_set_display_callback", ret);
    }
    return ret;
  }
  display_callback *structure = display.set(callback);
  if (!wasSet) {
    int ret = gsapi_register_callout(instance, &DisplayBridge::callout, &display);
    if (ret != 0) {
      throwReturned("gsapi_register_callout", ret);
    }
  }
  int ret = gsapi_set_display_callback(instance, structure);
  if (ret != 0) {
    throwReturned("gsapi_set_display_callback", ret);
  }
  return ret;
}

auto Instance::registerCallout(CalloutCallback fn) -> int {
  auto registration = std::make_unique<CalloutRegistration>(CalloutRegistration{fn});
  int ret = gsapi_register_callout(instance, &onCallout, registration.get());
  if (ret != 0) {
    throwReturned("gsapi_register_callout", ret);
  }
  callouts.push_back(std::move(registration));
  return ret;
}

auto Instance::deregisterCallout(CalloutCallback fn) -> void {
  for (auto it = callouts.begin(); it != callouts.end();) {
    if ((*it)->fn.strictlyEquals(fn)) {
      gsapi_deregister_callout(instance, &onCallout, it->get());
      it = callouts.erase(it);
    } else {
      ++it;
    }
  }
}

auto Instance::addFs(FileSystem fs) -> int {
  auto registration = std::make_unique<FsRegistration>(FsRegistration{fs});
  int ret = gsapi_add_fs(instance, &jsfile::fs, registration.get());
  if (ret < 0) {
    throwReturned("gsapi_add_fs", ret);
  }
  filesystems.push_back(std::move(registration));
  return ret;
}

auto Instance::removeFs(FileSystem fs) -> void {
  for (auto it = filesystems.begin(); it != filesystems.end();) {
    if ((*it)->fs.strictlyEquals(fs)) {
      gsapi_remove_fs(instance, &jsfile::fs, it->get());
      it = filesystems.erase(it);
    } else {
      ++it;
    }
  }
}

auto Instance::setDefaultDeviceList(const std::string &list) -> int {
  int ret = gsapi_set_default_device_list(instance, list.c_str(), list.size());
  if (ret != 0) {
    throwReturned("gsapi_set_default_device_list", ret);
  }
  return ret;
}

auto Instance::getDefaultDeviceList() -> std::string {
  char *list = nullptr;
  int listlen = 0;
  int ret = gsapi_get_default_device_list(instance, &list, &listlen);
  if (ret != 0) {
    throwReturned("gsapi_get_default_device_list", ret);
  }
  return {list, static_cast<size_t>(listlen)};
}

auto Instance::setArgEncoding(int encoding) -> int {
  int ret = gsapi_set_arg_encoding(instance, encoding);
  if (ret != 0) {
    throwReturned("gsapi_set_arg_encoding", ret);
  }
  return ret;
}

auto Instance::initWithArgs(const ArgList &argv) -> AwaitableInt {
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

auto Instance::runStringBegin(int userErrors) -> AwaitableRunResult {
  RunResult r{};
  r.code = gsapi_run_string_begin(instance, userErrors, &r.exitCode);
  return AwaitableRunResult(emscripten::val(r));
}

auto Instance::runStringContinue(const std::string &str, int userErrors) -> AwaitableRunResult {
  RunResult r{};
  r.code = gsapi_run_string_continue(instance, str.data(), str.size(), userErrors, &r.exitCode);
  return AwaitableRunResult(emscripten::val(r));
}

auto Instance::runStringEnd(int userErrors) -> AwaitableRunResult {
  RunResult r{};
  r.code = gsapi_run_string_end(instance, userErrors, &r.exitCode);
  return AwaitableRunResult(emscripten::val(r));
}

auto Instance::runStringWithLength(const std::string &str, int userErrors)
    -> AwaitableRunResult {
  RunResult r{};
  r.code =
      gsapi_run_string_with_length(instance, str.data(), str.size(), userErrors, &r.exitCode);
  return AwaitableRunResult(emscripten::val(r));
}

auto Instance::runString(const std::string &str, int userErrors) -> AwaitableRunResult {
  RunResult r{};
  r.code = gsapi_run_string(instance, str.c_str(), userErrors, &r.exitCode);
  return AwaitableRunResult(emscripten::val(r));
}

auto Instance::runFile(const std::string &fileName, int userErrors) -> AwaitableRunResult {
  RunResult r{};
  r.code = gsapi_run_file(instance, fileName.c_str(), userErrors, &r.exitCode);
  return AwaitableRunResult(emscripten::val(r));
}

auto Instance::exit() -> AwaitableInt {
  int ret = gsapi_exit(instance);
  if (ret != 0) {
    throwReturned("gsapi_exit", ret);
  }
  return AwaitableInt(emscripten::val(ret));
}

auto Instance::setParam(const std::string &param, const ParamValue &value, int type)
    -> AwaitableInt {
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

template <typename T>
auto Instance::getScalarParam(const std::string &param, gs_set_param_type type)
    -> GetParamResult {
  T storage{};
  int code = gsapi_get_param(instance, param.c_str(), &storage, type);
  auto result = emscripten::val::object();
  result.set("code", code);
  result.set("value", code < 0 ? emscripten::val::null() : emscripten::val(storage));
  return GetParamResult(result);
}

auto Instance::getStringParam(const std::string &param, gs_set_param_type type)
    -> GetParamResult {
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

auto Instance::getParam(const std::string &param, int type) -> GetParamResult {
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

auto Instance::enumerateParams() -> EnumerateParamsResult {
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

auto Instance::addControlPath(int type, const std::string &path) -> int {
  int ret = gsapi_add_control_path(instance, type, path.c_str());
  if (ret < 0) {
    throwReturned("gsapi_add_control_path", ret);
  }
  return ret;
}

auto Instance::removeControlPath(int type, const std::string &path) -> int {
  int ret = gsapi_remove_control_path(instance, type, path.c_str());
  if (ret < 0) {
    throwReturned("gsapi_remove_control_path", ret);
  }
  return ret;
}

auto Instance::purgeControlPaths(int type) -> void { gsapi_purge_control_paths(instance, type); }

auto Instance::activatePathControl(bool enable) -> void {
  gsapi_activate_path_control(instance, enable ? 1 : 0);
}

auto Instance::isPathControlActive() -> bool {
  return gsapi_is_path_control_active(instance) != 0;
}

} // namespace gsapi

EMSCRIPTEN_BINDINGS(instance) {
  emscripten::value_object<gsapi::RunResult>("RunResult")
      .field("code", &gsapi::RunResult::code)
      .field("exitCode", &gsapi::RunResult::exitCode);

  emscripten::class_<gsapi::Instance>("Instance")
      .constructor(&gsapi::Instance::create, emscripten::allow_raw_pointers())
      .function("setStdio", &gsapi::Instance::setStdio)
      .function("setStdioWithHandle", &gsapi::Instance::setStdioWithHandle)
      .function("setPoll", &gsapi::Instance::setPoll)
      .function("setPollWithHandle", &gsapi::Instance::setPollWithHandle)
      .function("setDisplayCallback", &gsapi::Instance::setDisplayCallback)
      .function("registerCallout", &gsapi::Instance::registerCallout)
      .function("deregisterCallout", &gsapi::Instance::deregisterCallout)
      .function("addFs", &gsapi::Instance::addFs)
      .function("removeFs", &gsapi::Instance::removeFs)
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
