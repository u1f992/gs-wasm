#pragma once

#include "common.h"
#include "display.h"
#include "jsfile.h"
#include "types.h"

#include <emscripten/val.h>
#include <memory>
#include <string>
#include <vector>

namespace gsapi {

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
  emscripten::val stdioHandle = emscripten::val::undefined();
  emscripten::val pollFn = emscripten::val::null();
  emscripten::val pollHandle = emscripten::val::undefined();
  std::vector<std::unique_ptr<CalloutRegistration>> callouts;
  std::vector<std::unique_ptr<FsRegistration>> filesystems;
  DisplayBridge display;
  void *paramIterator = nullptr;

  static auto onStdin(void *callerHandle, char *buf, int len) -> int;
  static auto onStdout(void *callerHandle, const char *str, int len) -> int;
  static auto onStderr(void *callerHandle, const char *str, int len) -> int;
  static auto onPoll(void *callerHandle) -> int;
  static auto onCallout(void *instance, void *calloutHandle, const char *deviceName, int id,
                        int size, void *data) -> int;

  template <typename T>
  auto getScalarParam(const std::string &param, gs_set_param_type type) -> GetParamResult;
  auto getStringParam(const std::string &param, gs_set_param_type type) -> GetParamResult;

public:
  Instance() = default;
  Instance(const Instance &) = delete;
  auto operator=(const Instance &) -> Instance & = delete;
  ~Instance();

  static auto create() -> Instance *;

  auto setStdio(StdioCallback stdinFn, StdioCallback stdoutFn, StdioCallback stderrFn) -> int;
  auto setStdioWithHandle(StdioCallback stdinFn, StdioCallback stdoutFn, StdioCallback stderrFn,
                          CallerHandle callerHandle) -> int;
  auto setPoll(PollCallback pollFn) -> int;
  auto setPollWithHandle(PollCallback pollFn, CallerHandle callerHandle) -> int;
  auto setDisplayCallback(DisplayCallback callback) -> int;
  auto registerCallout(CalloutCallback fn) -> int;
  auto deregisterCallout(CalloutCallback fn) -> void;
  auto addFs(FileSystem fs) -> int;
  auto removeFs(FileSystem fs) -> void;
  auto setDefaultDeviceList(const std::string &list) -> int;
  auto getDefaultDeviceList() -> std::string;
  auto setArgEncoding(int encoding) -> int;
  auto initWithArgs(const ArgList &argv) -> AwaitableInt;
  auto runStringBegin(int userErrors) -> AwaitableRunResult;
  auto runStringContinue(const std::string &str, int userErrors) -> AwaitableRunResult;
  auto runStringEnd(int userErrors) -> AwaitableRunResult;
  auto runStringWithLength(const std::string &str, int userErrors) -> AwaitableRunResult;
  auto runString(const std::string &str, int userErrors) -> AwaitableRunResult;
  auto runFile(const std::string &fileName, int userErrors) -> AwaitableRunResult;
  auto exit() -> AwaitableInt;
  auto setParam(const std::string &param, const ParamValue &value, int type) -> AwaitableInt;
  auto getParam(const std::string &param, int type) -> GetParamResult;
  auto enumerateParams() -> EnumerateParamsResult;
  auto addControlPath(int type, const std::string &path) -> int;
  auto removeControlPath(int type, const std::string &path) -> int;
  auto purgeControlPaths(int type) -> void;
  auto activatePathControl(bool enable) -> void;
  auto isPathControlActive() -> bool;
};

} // namespace gsapi
