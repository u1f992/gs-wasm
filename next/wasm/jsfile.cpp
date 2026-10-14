#include "jsfile.h"

#include <cstdio>
#include <initializer_list>
#include <string>

namespace gsapi {

struct JsFile {
  gp_file base;
  emscripten::val *ops;
};

namespace jsfile {

auto ops(gp_file *f) -> emscripten::val & { return *reinterpret_cast<JsFile *>(f)->ops; }

auto has(gp_file *f, const char *name) -> bool { return !ops(f)[name].isUndefined(); }

auto bytesView(void *buf, size_t length) {
  return emscripten::typed_memory_view(length, static_cast<unsigned char *>(buf));
}

auto read(gp_file *f, size_t size, unsigned int count, void *buf) -> int {
  int bytes = settled(ops(f)["read"](bytesView(buf, size * count))).as<int>();
  return bytes <= 0 || size == 0 ? 0 : static_cast<int>(bytes / size);
}

auto write(gp_file *f, size_t size, unsigned int count, const void *buf) -> int {
  int bytes = settled(ops(f)["write"](bytesView(const_cast<void *>(buf), size * count))).as<int>();
  return bytes <= 0 || size == 0 ? 0 : static_cast<int>(bytes / size);
}

auto close(gp_file *f) -> int {
  int ret = has(f, "close") ? settled(ops(f)["close"]()).as<int>() : 0;
  delete reinterpret_cast<JsFile *>(f)->ops;
  reinterpret_cast<JsFile *>(f)->ops = nullptr;
  return ret;
}

auto getc(gp_file *f) -> int {
  if (has(f, "getc")) {
    return settled(ops(f)["getc"]()).as<int>();
  }
  unsigned char c = 0;
  return read(f, 1, 1, &c) == 1 ? c : EOF;
}

auto putc(gp_file *f, int c) -> int {
  if (has(f, "putc")) {
    return settled(ops(f)["putc"](c)).as<int>();
  }
  unsigned char b = static_cast<unsigned char>(c);
  return write(f, 1, 1, &b) == 1 ? c : EOF;
}

auto seek(gp_file *f, gs_offset_t offset, int whence) -> int {
  if (!has(f, "seek")) {
    return -1;
  }
  return settled(ops(f)["seek"](static_cast<double>(offset), whence)).as<int>();
}

auto tell(gp_file *f) -> gs_offset_t {
  if (!has(f, "tell")) {
    return -1;
  }
  return static_cast<gs_offset_t>(settled(ops(f)["tell"]()).as<double>());
}

auto eof(gp_file *f) -> int {
  if (!has(f, "eof")) {
    return 0;
  }
  return settled(ops(f)["eof"]()).as<bool>() ? 1 : 0;
}

auto seekable(gp_file *f) -> int {
  if (!has(f, "seekable")) {
    return 0;
  }
  return settled(ops(f)["seekable"]()).as<bool>() ? 1 : 0;
}

auto pread(gp_file *f, size_t count, gs_offset_t offset, void *buf) -> int {
  if (has(f, "pread")) {
    return settled(ops(f)["pread"](bytesView(buf, count), static_cast<double>(offset))).as<int>();
  }
  gs_offset_t position = tell(f);
  if (position < 0 || seek(f, offset, SEEK_SET) != 0) {
    return -1;
  }
  int bytes = read(f, 1, count, buf);
  seek(f, position, SEEK_SET);
  return bytes;
}

auto pwrite(gp_file *f, size_t count, gs_offset_t offset, const void *buf) -> int {
  if (has(f, "pwrite")) {
    return settled(ops(f)["pwrite"](bytesView(const_cast<void *>(buf), count),
                                    static_cast<double>(offset)))
        .as<int>();
  }
  gs_offset_t position = tell(f);
  if (position < 0 || seek(f, offset, SEEK_SET) != 0) {
    return -1;
  }
  int bytes = write(f, 1, count, buf);
  seek(f, position, SEEK_SET);
  return bytes;
}

auto isCharBuffered(gp_file *f) -> int {
  if (!has(f, "is_char_buffered")) {
    return 0;
  }
  return settled(ops(f)["is_char_buffered"]()).as<bool>() ? 1 : 0;
}

auto fflush(gp_file *f) -> void {
  if (has(f, "fflush")) {
    settled(ops(f)["fflush"]());
  }
}

auto ferror(gp_file *f) -> int {
  if (!has(f, "ferror")) {
    return 0;
  }
  return settled(ops(f)["ferror"]()).as<bool>() ? 1 : 0;
}

auto clearerr(gp_file *f) -> void {
  if (has(f, "clearerr")) {
    settled(ops(f)["clearerr"]());
  }
}

const gp_file_ops_t prototype = {
    &close,  &getc,   &putc,           &read,   &write,  &seek,     &tell,   &eof,    nullptr,
    &seekable, &pread, &pwrite, &isCharBuffered, &fflush, &ferror, nullptr, &clearerr, nullptr,
};

auto copyName(char *dest, const emscripten::val &name) -> void {
  std::string s = name.as<std::string>();
  size_t n = s.size() < gp_file_name_sizeof - 1 ? s.size() : gp_file_name_sizeof - 1;
  s.copy(dest, n);
  dest[n] = '\0';
}

auto open(const gs_memory_t *mem, void *secret, const char *method, gp_file **file,
          char *rfname, std::initializer_list<emscripten::val> args) -> int {
  auto *registration = static_cast<FsRegistration *>(secret);
  emscripten::val fn = registration->fs[method];
  if (fn.isUndefined()) {
    return 0;
  }
  emscripten::val result = settled(fn.call<emscripten::val>(
      "apply", registration->fs, emscripten::val::array(args.begin(), args.end())));
  if (result.isNull() || result.isUndefined()) {
    return 0;
  }
  if (result.isNumber()) {
    return result.as<int>();
  }
  emscripten::val handle = result;
  if (rfname != nullptr) {
    if (!result["rfname"].isUndefined()) {
      copyName(rfname, result["rfname"]);
    }
    if (!result["file"].isUndefined()) {
      handle = result["file"];
    }
  }
  auto *f = reinterpret_cast<JsFile *>(gp_file_alloc(mem, &prototype, sizeof(JsFile), "JsFile"));
  if (f == nullptr) {
    return gs_error_VMerror;
  }
  f->ops = new emscripten::val(handle);
  *file = &f->base;
  return 0;
}

auto openFile(const gs_memory_t *mem, void *secret, const char *fname, const char *mode,
              gp_file **file) -> int {
  return open(mem, secret, "open_file", file, nullptr,
              {emscripten::val(std::string(fname)), emscripten::val(std::string(mode))});
}

auto openPipe(const gs_memory_t *mem, void *secret, const char *fname, char *rfname,
              const char *mode, gp_file **file) -> int {
  return open(mem, secret, "open_pipe", file, rfname,
              {emscripten::val(std::string(fname)), emscripten::val(std::string(mode))});
}

auto openScratch(const gs_memory_t *mem, void *secret, const char *prefix, char *rfname,
                 const char *mode, int rm, gp_file **file) -> int {
  return open(mem, secret, "open_scratch", file, rfname,
              {emscripten::val(std::string(prefix)), emscripten::val(std::string(mode)),
               emscripten::val(rm != 0)});
}

auto openPrinter(const gs_memory_t *mem, void *secret, char *fname, int binary, gp_file **file)
    -> int {
  return open(mem, secret, "open_printer", file, nullptr,
              {emscripten::val(std::string(fname)), emscripten::val(binary != 0)});
}

auto openHandle(const gs_memory_t *mem, void *secret, char *fname, const char *access,
                gp_file **file) -> int {
  return open(mem, secret, "open_handle", file, nullptr,
              {emscripten::val(std::string(fname)), emscripten::val(std::string(access))});
}

gsapi_fs_t fs = {&openFile, &openPipe, &openScratch, &openPrinter, &openHandle};

} // namespace jsfile

} // namespace gsapi
