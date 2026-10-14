#include "common.h"

#include <emscripten/bind.h>

EMSCRIPTEN_BINDINGS(constants) {
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

  emscripten::constant("gp_file_name_sizeof", static_cast<int>(gp_file_name_sizeof));

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
}
